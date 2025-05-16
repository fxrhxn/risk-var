import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type PreviewRow = { date: string; return: number };

export default function App() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [ticker, setTicker] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [returns, setReturns] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // General
  const [portfolioValue, setPortfolioValue] = useState<number>(1_000_000);
  const [horizon, setHorizon] = useState<"1-day" | "10-day">("1-day");
  const [confidence, setConfidence] = useState<0.95 | 0.99>(0.95);

  // Method & settings
  const [method, setMethod] = useState<"historical" | "parametric" | "montecarlo">("historical");
  const [lookback, setLookback] = useState<number>(250);
  const [mean, setMean] = useState<number>(0.0005);
  const [vol, setVol] = useState<number>(0.02);
  const [sims, setSims] = useState<number>(10_000);

  // Results
  const [var95, setVar95] = useState<number | null>(null);
  const [var99, setVar99] = useState<number | null>(null);

  // Chart modal
  const [showChart, setShowChart] = useState(false);

  // ─── Handlers ────────────────────────────────────────────────────────────

  // 1) Fetch returns + preview
  const fetchData = async () => {
    if (!ticker) {
      alert("Enter a ticker");
      return;
    }
    setLoading(true);
    setVar95(null);
    setVar99(null);

    const res = await fetch("http://localhost:8000/api/fetch_returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: ticker.toUpperCase() }),
    });
    const data = await res.json();
    setReturns(data.returns);
    setPreview(
      data.preview.map((r: any) => ({
        date: r.date,
        return: r["return"] as number,
      }))
    );
    setLoading(false);
  };

  // 2) Compute VaR
  const computeVaR = async () => {
    if (returns.length === 0) {
      alert("Fetch data first");
      return;
    }
    setLoading(true);
    // compute 95%
    const res95 = await fetch("http://localhost:8000/api/compute_var", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        returns,
        confidence: confidence,
      }),
    });
    const { var: v95 } = await res95.json();
    setVar95(v95);

    // compute 99%
    const res99 = await fetch("http://localhost:8000/api/compute_var", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        returns,
        confidence: 0.99,
      }),
    });
    const { var: v99 } = await res99.json();
    setVar99(v99);

    setLoading(false);
  };

  // 3) Download report
  const handleDownload = () => {
    const rows: string[][] = [
      ["Date", "Return"],
      ...preview.map((r) => [r.date, (r.return * 100).toFixed(4)]),
      [],
      ["Parameter", "Value"],
      ["Portfolio Value", portfolioValue.toString()],
      ["Horizon", horizon],
      ["Confidence", `${confidence * 100}%`],
      ["Method", method],
      [],
      ["VaR Level", "VaR (%)"],
      ["95%", var95 !== null ? (var95 * 100).toFixed(4) : ""],
      ["99%", var99 !== null ? (var99 * 100).toFixed(4) : ""],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker}_var_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Histogram Data ──────────────────────────────────────────────────────
  const histogramData = useMemo(() => {
    if (returns.length === 0) return [];
    const bins = 20;
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const width = (max - min) / bins;
    const counts = Array(bins).fill(0);
    returns.forEach((r) => {
      let i = Math.floor((r - min) / width);
      if (i === bins) i = bins - 1;
      counts[i]++;
    });
    return counts.map((count, i) => {
      const lower = min + i * width;
      const upper = lower + width;
      return {
        binLabel: `${(lower * 100).toFixed(1)}%–${(upper * 100).toFixed(1)}%`,
        count,
      };
    });
  }, [returns]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>💸 Value at Risk Calculator</h1>

      {/* Ticker + Fetch */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Ticker (e.g. AAPL)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          style={{ padding: 8, width: 200 }}
        />
        <button onClick={fetchData} disabled={loading} style={{ marginLeft: 8, padding: "8px 16px" }}>
          {loading ? "Loading…" : "Fetch Data"}
        </button>
      </div>

      {/* Preview Table */}
      {preview.length > 0 && (
        <table border={1} cellPadding={8} style={{ marginBottom: 16, width: "100%" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Return</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i}>
                <td>{row.date}</td>
                <td>{(row.return * 100).toFixed(4)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* General Parameters */}
      <fieldset style={{ marginBottom: 16 }}>
        <legend>⚙️ General Parameters</legend>
        <label>
          Portfolio Value: $
          <input
            type="number"
            value={portfolioValue}
            onChange={(e) => setPortfolioValue(+e.target.value)}
            style={{ marginLeft: 4, width: 120 }}
          />
        </label>
        <label style={{ marginLeft: 16 }}>
          Horizon:
          <select value={horizon} onChange={(e) => setHorizon(e.target.value as any)} style={{ marginLeft: 4 }}>
            <option value="1-day">1-day</option>
            <option value="10-day">10-day</option>
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Confidence:
          <select
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value) as 0.95 | 0.99)}
            style={{ marginLeft: 4 }}
          >
            <option value={0.90}>90%</option>
            <option value={0.95}>95%</option>
            <option value={0.99}>99%</option>
          </select>
        </label>
      </fieldset>

      {/* Method Selector */}
      <fieldset style={{ marginBottom: 16 }}>
        <legend>🔹 Select Method</legend>
        {(["historical", "parametric", "montecarlo"] as const).map((m) => (
          <label key={m} style={{ marginRight: 16 }}>
            <input
              type="radio"
              name="method"
              value={m}
              checked={method === m}
              onChange={() => setMethod(m)}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
      </fieldset>

      {/* Method-specific Settings */}
      <fieldset style={{ marginBottom: 16 }}>
        <legend>🧩 Method‐Specific Settings</legend>
        {method === "historical" && (
          <label>
            Look‐back window (days):
            <input
              type="number"
              value={lookback}
              onChange={(e) => setLookback(+e.target.value)}
              style={{ marginLeft: 4, width: 80 }}
            />
          </label>
        )}
        {method === "parametric" && (
          <>
            <label>
              μ:
              <input
                type="number"
                step="0.0001"
                value={mean}
                onChange={(e) => setMean(+e.target.value)}
                style={{ marginLeft: 4, width: 80 }}
              />
            </label>
            <label style={{ marginLeft: 16 }}>
              σ:
              <input
                type="number"
                step="0.0001"
                value={vol}
                onChange={(e) => setVol(+e.target.value)}
                style={{ marginLeft: 4, width: 80 }}
              />
            </label>
          </>
        )}
        {method === "montecarlo" && (
          <label>
            Simulations:
            <input
              type="number"
              value={sims}
              onChange={(e) => setSims(+e.target.value)}
              style={{ marginLeft: 4, width: 100 }}
            />
          </label>
        )}
      </fieldset>

      {/* Compute */}
      <button onClick={computeVaR} disabled={loading || returns.length === 0} style={{ padding: "8px 16px" }}>
        {loading ? "Computing…" : "Compute VaR"}
      </button>

      {/* Results */}
      {(var95 !== null || var99 !== null) && (
        <div style={{ marginTop: 16 }}>
          <h2>📊 Results</h2>
          {var95 !== null && <div>95% VaR: {(var95 * 100).toFixed(2)}%</div>}
          {var99 !== null && <div>99% VaR: {(var99 * 100).toFixed(2)}%</div>}
          <button onClick={() => setShowChart(true)} style={{ marginTop: 8 }}>
            View P&L Distribution
          </button>
        </div>
      )}

      {/* Chart Modal */}
      {showChart && (
        <div style={{
          position: "fixed", top: 40, left: 40,
          background: "#fff", padding: 16, border: "1px solid #000",
          width: 600, height: 400
        }}>
          <h3>P&L Distribution (Histogram)</h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="binLabel" interval={2} angle={-45} textAnchor="end" height={60}/>
              <YAxis />
              <Tooltip formatter={(value) => [value, "Count"]} />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
          <button onClick={() => setShowChart(false)} style={{ marginTop: 8 }}>Close</button>
        </div>
      )}

      {/* Download */}
      <button onClick={handleDownload} style={{ marginTop: 24, padding: "8px 16px" }}>
        📥 Download Report as CSV
      </button>
    </div>
  );
}
