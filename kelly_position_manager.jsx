import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from "recharts";

// --- 凱利公式核心邏輯 ---
const kelly = (p, b) => {
  if (b <= 0 || p <= 0 || p >= 1) return 0;
  return Math.max(0, (b * p - (1 - p)) / b);
};

// --- 格式化工具 ---
const fmt = (num) => (num ? num.toFixed(2) : "0.00");

const KellyPositionManager = () => {
  // 1. 初始化資料 (嘗試從瀏覽器本地存儲讀取)
  const [positions, setPositions] = useState(() => {
    const saved = localStorage.getItem("kelly_positions");
    return saved ? JSON.parse(saved) : [
      { id: 1, symbol: "BTC", market: "加密貨幣", entry: 82000, units: 0.25, p: 0.6, b: 2, price: null },
      { id: 2, symbol: "ETH", market: "加密貨幣", entry: 2100, units: 2, p: 0.55, b: 1.5, price: null },
      { id: 3, symbol: "NVDA", market: "美股", entry: 900, units: 10, p: 0.65, b: 1.8, price: null },
      { id: 4, symbol: "2330", market: "台股", entry: 870, units: 100, p: 0.6, b: 2.2, price: null }
    ];
  });

  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanel, setAiPanel] = useState(false);

  // 2. 當倉位變動時，自動存檔
  useEffect(() => {
    localStorage.setItem("kelly_positions", JSON.stringify(positions));
  }, [positions]);

  // 3. 計算增強數據
  const enriched = useMemo(() => {
    return positions.map(p => {
      const currentPrice = p.price || p.entry;
      const pnlPct = ((currentPrice - p.entry) / p.entry) * 100;
      const fFull = kelly(p.p, p.b);
      return { ...p, currentPrice, pnlPct, fFull };
    });
  }, [positions]);

  const totalCost = enriched.reduce((sum, p) => sum + (p.entry * p.units), 0);

  // 4. Gemini AI 分析邏輯 (已針對 Google Gemini 1.5 Flash 優化)
  const runAI = useCallback(async () => {
    setAiLoading(true);
    setAiPanel(true);
    setAiResult("");

    const summary = enriched.map(p => 
      `${p.symbol}: 成本${p.entry}, 現價${p.currentPrice}, 損益${fmt(p.pnlPct)}%, 凱利建議比率${fmt(p.fFull * 100)}%`
    ).join("\n");

    const prompt = `你是一位專業的量化交易顧問。請分析以下凱利公式倉位數據，並用繁體中文給出具體的操作建議：
    
    ${summary}
    
    請包含：
    1. 哪些標的目前超額持倉（高於凱利值）。
    2. 哪些標的目前持倉不足。
    3. 整體的風險預警與優化清單。`;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 分析暫時無法讀取，請檢查 API 設定。";
      setAiResult(text);
    } catch (e) {
      setAiResult("⚠ 連線失敗。請確認 Vercel 環境變數 VITE_GEMINI_API_KEY 是否正確，且 CSP 政策已放行。");
    }
    setAiLoading(false);
  }, [enriched]);

  // 5. 渲染介面 (簡化版)
  return (
    <div style={{ padding: "20px", backgroundColor: "#121212", color: "#fff", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#f39c12" }}>凱利倉位導航儀</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => alert("功能開發中")} style={btnStyle}>➕ 新增倉位</button>
          <button onClick={runAI} style={{ ...btnStyle, backgroundColor: "#8e44ad" }}>✨ AI 策略分析</button>
        </div>
      </header>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
              <th style={thStyle}>標的</th>
              <th style={thStyle}>成本價</th>
              <th style={thStyle}>損益%</th>
              <th style={thStyle}>凱利建議% (Full)</th>
              <th style={thStyle}>凱利建議% (Half)</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={tdStyle}>{p.symbol}</td>
                <td style={tdStyle}>${p.entry}</td>
                <td style={{ ...tdStyle, color: p.pnlPct >= 0 ? "#2ecc71" : "#e74c3c" }}>{fmt(p.pnlPct)}%</td>
                <td style={{ ...tdStyle, color: "#f1c40f" }}>{(p.fFull * 100).toFixed(2)}%</td>
                <td style={{ ...tdStyle, color: "#e67e22" }}>{(p.fFull * 50).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aiPanel && (
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
            <h3>🤖 AI 凱利策略分析 (Gemini)</h3>
            <button onClick={() => setAiPanel(false)} style={{ background: "none", color: "#666", border: "none", cursor: "pointer" }}>✕ 關閉</button>
          </div>
          {aiLoading ? <p>正在運算深度建議...</p> : <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{aiResult}</div>}
        </div>
      )}
    </div>
  );
};

// --- 樣式設定 ---
const thStyle = { padding: "12px", color: "#888", fontWeight: "400" };
const tdStyle = { padding: "12px" };
const btnStyle = { padding: "10px 20px", backgroundColor: "#333", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" };
const panelStyle = { marginTop: "30px", padding: "20px", backgroundColor: "#1e1e1e", borderRadius: "10px", border: "1px solid #333" };

export default KellyPositionManager;
