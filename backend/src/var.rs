use rand_distr::{Distribution, Normal};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct VarRequest {
    pub method: String,
    pub returns: Vec<f64>,
    pub confidence: f64,
}

pub fn compute_var(method: &str, returns: &mut Vec<f64>, confidence: f64) -> f64 {
    match method {
        "historical" => {
            returns.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let idx = ((1.0 - confidence) * returns.len() as f64).floor() as usize;
            -returns[idx]
        }
        "parametric" => {
            let mean = returns.iter().sum::<f64>() / returns.len() as f64;
            let std = (returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64).sqrt();
            let z = 1.644853;
            -(mean - z * std)
        }
        "montecarlo" => {
            let mean = returns.iter().sum::<f64>() / returns.len() as f64;
            let std = (returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64).sqrt();
            let normal = Normal::new(mean, std).unwrap();
            let mut rng = rand::thread_rng();
            let mut sims: Vec<f64> = (0..10_000).map(|_| normal.sample(&mut rng)).collect();
            sims.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let idx = ((1.0 - confidence) * sims.len() as f64).floor() as usize;
            -sims[idx]
        }
        _ => panic!("Unknown method"),
    }
}
