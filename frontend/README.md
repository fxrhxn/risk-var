# Value at Risk (VaR) Calculator

A simple full‑stack VaR calculator that fetches live equity price data by ticker, computes daily returns, and calculates Value at Risk using Historical, Parametric, or Monte Carlo methods. Includes a React UI with parameter controls, histogram visualization, and CSV report export.


---

## Real‑World Use

> **What is VaR?**
>
> Value at Risk (VaR) estimates the maximum expected loss over a specified time horizon at a given confidence level. For example, a 95% 1‑day VaR of 2.93% on a \$200k position implies there’s a 5% chance of losing more than \~\$5.9k in one day.

In top quant firms, VaR acts as a **real‑time speed limit** on trading desks. Each desk has a daily VaR budget (e.g., \$50 M 95% VaR). As trades accumulate, a central risk engine recomputes the desk’s aggregate VaR by the second, throttling or hedging new orders once the budget is nearly exhausted—ensuring the firm **never** exceeds its risk tolerance.

---

## 📁 Repository Structure

```
root
├── backend          # Rust + Axum API server
│   ├── Cargo.toml
│   ├── src
│   │   └── main.rs
│   └── .env         # environment file for API keys
└── frontend         # React + Vite web app
    ├── package.json
    ├── src
    │   └── App.tsx
    └── ...
```

---

## 🛠️ Prerequisites

* **Rust** (1.65+)
* **Node.js & npm** (v16+)
* **Alpha Vantage** API key (free)

---

## ⚙️ Backend Setup

1. **Clone & enter** the repo:

   ```bash
   git clone <repo-url>
   cd backend
   ```

2. **Create a `.env`** file in `backend/`:

   ```dotenv
   ALPHA_VANTAGE_KEY=YOUR_ALPHA_VANTAGE_KEY_HERE
   ```

3. **Install dependencies & run**:

   ```bash
   cargo install # if needed
   cargo clean
   cargo run
   ```

   The API server will start at **[http://127.0.0.1:8000](http://127.0.0.1:8000)** with two endpoints:

   * `POST /api/fetch_returns` – fetches 1-year returns & 5-day preview
   * `POST /api/compute_var` – computes VaR given `method`, `returns`, `confidence`

---

## ⚛️ Frontend Setup

1. **Install & enter** the frontend:

   ```bash
   cd ../frontend
   npm install
   npm install recharts
   ```

2. **Run** the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser to access the VaR dashboard.

---

## 🎨 How to Use

1. **Ticker & Fetch**: type a symbol (e.g. AAPL, NVDA), click **Fetch Data**. See the last 5 daily returns.
2. **General Parameters**: set portfolio size, horizon (1‑day, 10‑day), and confidence (90%, 95%, 99%).
3. **Select Method**: choose **Historical**, **Parametric** (Normal µ/σ), or **Monte Carlo** (# sims).
4. **Compute VaR**: click **Compute VaR** to display both 95% and 99% VaR.
5. **View Chart**: click **View P\&L Distribution** to open a histogram of your return distribution.
6. **Download CSV**: click **Download Report as CSV** to export your data and results.

---

## 📄 Example `.env`

```dotenv
ALPHA_VANTAGE_KEY=1M2GN4LAOP4Q9EDP
```

*Never commit your real key to source control!* Copy this file to `.env` and replace with your own.

---

## 🤝 Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-idea`
2. Make your changes and add tests.
3. Submit a pull request for review.

---

## 📜 License

MIT © 
