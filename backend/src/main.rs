use axum::{routing::post, Json, Router};
use tower_http::cors::CorsLayer;
use tokio::net::TcpListener;
use std::{env, net::SocketAddr};
use serde_json::{json, Value};
use chrono::{Utc, Duration, TimeZone};
use dotenv::dotenv;

mod var;
use var::{VarRequest, compute_var};

use serde::{Deserialize, Serialize};
use reqwest;

// Payload to fetch returns
#[derive(Deserialize)]
struct FetchRequest {
    ticker: String,
}

// One row of preview
#[derive(Debug, Serialize)]
struct PreviewRow {
    date: String,
    #[serde(rename = "return")]
    ret: f64,
}

// Response from /api/fetch_returns
#[derive(Serialize)]
struct FetchResponse {
    returns: Vec<f64>,
    preview: Vec<PreviewRow>,
}

#[tokio::main]
async fn main() {
    // Load .env
    dotenv().ok();

    let app = Router::new()
        .route("/api/fetch_returns", post(fetch_returns_handler))
        .route("/api/compute_var",    post(var_handler))
        .layer(CorsLayer::very_permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("🚀 Backend running on http://{}", addr);

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

/// VaR endpoint
async fn var_handler(Json(payload): Json<VarRequest>) -> Json<serde_json::Value> {
    let result = compute_var(&payload.method, &mut payload.returns.clone(), payload.confidence);
    Json(json!({ "var": result }))
}

/// Fetch returns, Yahoo → Alpha Vantage fallback
async fn fetch_returns_handler(Json(payload): Json<FetchRequest>) -> Json<FetchResponse> {
    let ticker = payload.ticker.to_uppercase();
    let now = Utc::now();
    let (start_ts, end_ts) = ((now - Duration::days(365)).timestamp(), now.timestamp());

    // 1) Try Yahoo JSON API
    let yahoo_url = format!(
        "https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?\
         period1={start}&period2={end}&interval=1d&includePrePost=false&events=history",
        ticker=&ticker, start=start_ts, end=end_ts
    );
    println!("🔗 Trying Yahoo: {}", yahoo_url);

    let mut data: Vec<(String, f64)> = Vec::new();
    let fall_back = match reqwest::get(&yahoo_url).await {
        Ok(resp) if resp.status().is_success() => {
            let body: Value = resp.json().await.unwrap_or_default();
            if body["chart"]["error"].is_null() {
                let result = &body["chart"]["result"][0];
                // **clone** the arrays into owned Vec<Value>
                let timestamps: Vec<Value> = result["timestamp"]
                    .as_array().cloned().unwrap_or_default();
                let closes: Vec<Value> = result["indicators"]["adjclose"][0]["adjclose"]
                    .as_array().cloned().unwrap_or_default();

                for (ts_val, price_val) in timestamps.iter().zip(closes.iter()) {
                    if let (Some(ts), Some(p)) = (ts_val.as_i64(), price_val.as_f64()) {
                        let date = Utc.timestamp_opt(ts, 0).single().unwrap()
                            .format("%Y-%m-%d").to_string();
                        data.push((date, p));
                    }
                }
                println!("🔢 Yahoo returned {} points", data.len());
                false
            } else {
                println!("⚠️ Yahoo JSON error");
                true
            }
        }
        Ok(r) => {
            println!("❌ Yahoo HTTP {}", r.status());
            true
        }
        Err(e) => {
            eprintln!("❌ Yahoo request failed: {}", e);
            true
        }
    };


    // 2) Fallback to Alpha Vantage if needed
    if fall_back {
        let key = env::var("ALPHA_VANTAGE_KEY")
            .expect("ALPHA_VANTAGE_KEY not set in .env");
        let av_url = format!(
            "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY\
             &symbol={ticker}&outputsize=compact&apikey={key}&datatype=json",
            ticker=&ticker, key=&key
        );
        println!("🔗 Fallback to Alpha Vantage (daily): {}", av_url);

        let resp = reqwest::get(&av_url).await.unwrap();
        let body: Value = resp.json().await.unwrap_or_default();
        println!("🔄 Alpha Vantage raw JSON:\n{}", body);

        // handle rate-limit notes or errors
        if let Some(note) = body.get("Note").or_else(|| body.get("Information")).or_else(|| body.get("Error Message")) {
            eprintln!("⚠️ Alpha Vantage returned an error/note: {}", note);
        } else if let Some(ts_map) = body.get("Time Series (Daily)").and_then(|v| v.as_object()) {
            // parse the time‐series map using the "4. close" field
            let mut vec: Vec<_> = ts_map.iter().map(|(date, obj)| {
                let close = obj["4. close"].as_str()
                    .unwrap_or("0")
                    .parse::<f64>()
                    .unwrap_or(0.0);
                (date.clone(), close)
            }).collect();
            vec.sort_by_key(|(d, _)| d.clone());
            data = vec;
            println!("🔢 Alpha Vantage returned {} points", data.len());
        } else {
            eprintln!("❌ Unexpected Alpha Vantage JSON structure");
        }
    }



    // 3) Compute returns
    let mut returns = Vec::new();
    for window in data.windows(2) {
        let p0 = window[0].1;
        let p1 = window[1].1;
        returns.push((p1 - p0) / p0);
    }
    println!("🔢 Computed {} returns", returns.len());

    // 4) Build last-5 preview
    let mut preview = Vec::new();
    for i in (1..data.len()).rev().take(5) {
        let (ref date, price) = &data[i];
        let prev_price = data[i - 1].1;
        preview.push(PreviewRow {
            date: date.clone(),
            ret: (price - prev_price) / prev_price,
        });
    }
    preview.reverse();
    println!("🔢 Preview rows: {:?}", preview);

    Json(FetchResponse { returns, preview })
}
