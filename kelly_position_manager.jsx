import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from "recharts";

// ── Kelly Math ───────────────────────────────────────────────────────
const kelly = (p, b) => {
  if (b <= 0 || p <= 0 || p >= 1) return 0;
  return Math.max(0, (b * p - (1 - p)) / b);
};

// ── CoinGecko ID map ─────────────────────────────────────────────────
const CG = {
  BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin',XRP:'ripple',
  ADA:'cardano',DOGE:'dogecoin',DOT:'polkadot',AVAX:'avalanche-2',
  LINK:'chainlink',UNI:'uniswap',ATOM:'cosmos',LTC:'litecoin',
  SUI:'sui',APT:'aptos',TON:'the-open-network',OP:'optimism',
  ARB:'arbitrum',INJ:'injective-protocol',MATIC:'matic-network',
  NEAR:'near',FTM:'fantom',ALGO:'algorand',VET:'vechain',
  ICP:'internet-computer',FIL:'filecoin',SAND:'the-sandbox',
  MANA:'decentraland',CRO:'crypto-com-chain',SHIB:'shiba-inu',
};

// ── FX rates (fallback) ──────────────────────────────────────────────
const FX = { USD:1, TWD:32.5, JPY:155, EUR:0.92, GBP:0.79, HKD:7.82 };

// ── UID ──────────────────────────────────────────────────────────────
let _id = 1; const uid = () => `p${Date.now()}${_id++}`;

// ── Colour palette ────────────────────────────────────────────────────
const T = {
  bg:'#080b10', panel:'#0d1117', panel2:'#111820',
  border:'#1c2535', border2:'#243040',
  amber:'#f59e0b', amberDim:'#92610a',
  green:'#10b981', greenDim:'#065f46',
  red:'#ef4444', redDim:'#7f1d1d',
  blue:'#38bdf8', blueDim:'#0c4a6e',
  text:'#e2e8f0', dim:'#64748b', muted:'#94a3b8',
  cyan:'#22d3ee',
};

const PIE_COLORS = [T.amber,T.green,T.blue,T.cyan,'#a78bfa','#fb923c','#f472b6','#34d399'];

// ── Sample Positions ─────────────────────────────────────────────────
const SAMPLES = [
  { id:uid(), symbol:'BTC',  name:'Bitcoin',  market:'crypto',    ccy:'USD', units:0.25, entry:82000, price:0, p:0.58, w:0.12, l:0.06 },
  { id:uid(), symbol:'ETH',  name:'Ethereum', market:'crypto',    ccy:'USD', units:2,    entry:2100,  price:0, p:0.55, w:0.10, l:0.05 },
  { id:uid(), symbol:'NVDA', name:'NVIDIA',   market:'us_stock',  ccy:'USD', units:10,   entry:900,   price:0, p:0.60, w:0.15, l:0.07 },
  { id:uid(), symbol:'2330', name:'台積電',   market:'tw_stock',  ccy:'TWD', units:100,  entry:870,   price:0, p:0.62, w:0.08, l:0.04 },
];

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (n, d=2) => isNaN(n)||!isFinite(n) ? '—' : Number(n).toFixed(d);
const fmtMoney = (n, ccy='USD') => {
  if (isNaN(n)||!isFinite(n)) return '—';
  const sym = { USD:'$', TWD:'NT$', JPY:'¥', EUR:'€', GBP:'£', HKD:'HK$' }[ccy]||'$';
  return `${sym}${Number(n).toLocaleString('en',{maximumFractionDigits:ccy==='TWD'?0:2})}`;
};
const pctColor = v => v > 0 ? T.green : v < 0 ? T.red : T.dim;
const nowStr = () => new Date().toLocaleTimeString('zh-TW',{hour12:false});

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Sora:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:${T.bg}}
::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px}
input,select{outline:none;font-family:inherit}
input[type=range]{appearance:none;height:3px;border-radius:2px;cursor:pointer}
input[type=range]::-webkit-slider-thumb{appearance:none;width:12px;height:12px;border-radius:50%;background:${T.amber};cursor:pointer}
.row-hover:hover{background:${T.panel2}!important}
.btn-hover:hover{opacity:.8;transform:translateY(-1px)}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .3s ease forwards}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.pulse{animation:pulse 1.5s ease infinite}
`;

// ── Sub-components ────────────────────────────────────────────────────
const Tag = ({children, color=T.amber}) => (
  <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'.08em',
    background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:3,
    padding:'1px 5px',textTransform:'uppercase',whiteSpace:'nowrap'}}>
    {children}
  </span>
);

const Pill = ({label,active,onClick}) => (
  <button onClick={onClick} style={{
    border:`1px solid ${active?T.amber:T.border}`,borderRadius:20,padding:'4px 13px',
    background:active?`${T.amber}18`:'none',color:active?T.amber:T.dim,cursor:'pointer',
    fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:'all .15s'
  }}>{label}</button>
);

const KBox = ({label,value,color=T.amber,sub}) => (
  <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:8,
    padding:'12px 16px',flex:1,minWidth:0}}>
    <div style={{fontSize:9,color:T.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4}}>{label}</div>
    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,color,fontWeight:700,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:T.dim,marginTop:4}}>{sub}</div>}
  </div>
);

const SmallSlider = ({label,value,min,max,step,onChange,color,fmt:f=v=>v.toFixed(2)}) => (
  <div style={{marginBottom:10}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
      <span style={{fontSize:10,color:T.dim}}>{label}</span>
      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color}}>{f(value)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(parseFloat(e.target.value))}
      style={{width:'100%',background:`linear-gradient(to right,${color} ${((value-min)/(max-min))*100}%,${T.border} 0%)`}}/>
  </div>
);

const ChartTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:T.panel2,border:`1px solid ${T.border}`,borderRadius:6,
      padding:'8px 12px',fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
      <div style={{color:T.dim,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||T.amber}}>{p.name}: {typeof p.value==='number'?p.value.toFixed(2):p.value}</div>
      ))}
    </div>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────
const Modal = ({onClose,children}) => (
  <div style={{position:'fixed',inset:0,background:'#000a',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}}
    onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="fade-in" style={{background:T.panel,border:`1px solid ${T.border2}`,borderRadius:12,
      width:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px #000a'}}>
      {children}
    </div>
  </div>
);

// ── Main App ──────────────────────────────────────────────────────────
export default function KellyTrader() {
  const [positions, setPositions]   = useState(SAMPLES);
  const [marketFilter, setMkt]      = useState('all');
  const [displayCcy, setDCcy]       = useState('USD');
  const [editPos, setEditPos]       = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [expandedId, setExpanded]   = useState(null);
  const [aiPanel, setAiPanel]       = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiResult, setAiResult]     = useState('');
  const [fetchLog, setFetchLog]     = useState('');
  const [activeTab, setActiveTab]   = useState('positions');
  const [snapshotMsg, setSnapMsg]   = useState('');
  const snapshotRef = useRef(null);

  // ── Computed per position ───────────────────────────────────────────
  const enriched = useMemo(() => positions.map(pos => {
    const b = pos.w / (pos.l||0.01);
    const fFull = kelly(pos.p, b);
    const fHalf = fFull / 2;
    const fQtr  = fFull / 4;
    const costBasis = pos.units * pos.entry;
    const currentVal = pos.price > 0 ? pos.units * pos.price : 0;
    const pnlAbs = currentVal - costBasis;
    const pnlPct = costBasis > 0 ? (pnlAbs / costBasis) * 100 : 0;
    return { ...pos, b, fFull, fHalf, fQtr, costBasis, currentVal, pnlAbs, pnlPct };
  }), [positions]);

  const filtered = useMemo(() =>
    marketFilter === 'all' ? enriched : enriched.filter(p => p.market === marketFilter)
  , [enriched, marketFilter]);

  // Convert to display currency
  const toDisplay = useCallback((amt, ccy) => {
    if (displayCcy === ccy) return amt;
    const inUSD = amt / (FX[ccy]||1);
    return inUSD * (FX[displayCcy]||1);
  }, [displayCcy]);

  const totCost = useMemo(() =>
    enriched.reduce((s,p) => s + toDisplay(p.costBasis, p.ccy), 0)
  , [enriched, toDisplay]);

  const totVal = useMemo(() =>
    enriched.filter(p=>p.price>0).reduce((s,p) => s + toDisplay(p.currentVal, p.ccy), 0)
  , [enriched, toDisplay]);

  // ── Price Fetching ──────────────────────────────────────────────────
  const fetchPrices = useCallback(async (ids) => {
    const cryptoPositions = positions.filter(p =>
      (ids ? ids.includes(p.id) : true) && p.market === 'crypto' && CG[p.symbol.toUpperCase()]
    );
    const stockPositions = positions.filter(p =>
      (ids ? ids.includes(p.id) : true) && (p.market === 'us_stock')
    );
    const twPositions = positions.filter(p =>
      (ids ? ids.includes(p.id) : true) && p.market === 'tw_stock'
    );

    setPositions(prev => prev.map(p =>
      (ids ? ids.includes(p.id) : true) ? {...p, fetching:true} : p
    ));
    setFetchLog('正在獲取行情資料…');

    const updates = {};

    // Crypto via CoinGecko
    if (cryptoPositions.length > 0) {
      try {
        const cgIds = cryptoPositions.map(p => CG[p.symbol.toUpperCase()]).filter(Boolean);
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd,twd,eur,gbp`;
        const r = await fetch(url);
        const data = await r.json();
        cryptoPositions.forEach(p => {
          const cgId = CG[p.symbol.toUpperCase()];
          if (data[cgId]) {
            const ccyKey = {USD:'usd',TWD:'twd',EUR:'eur',GBP:'gbp'}[p.ccy]||'usd';
            updates[p.id] = data[cgId][ccyKey] || data[cgId]['usd'];
          }
        });
        setFetchLog(`✓ 加密貨幣: ${cryptoPositions.length} 檔`);
      } catch(e) { setFetchLog('⚠ 加密貨幣行情獲取失敗'); }
    }

    // US Stocks via Yahoo Finance
    for (const p of stockPositions) {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${p.symbol}?interval=1d&range=1d`,
          { headers: { 'Accept': 'application/json' } }
        );
        const data = await r.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) updates[p.id] = price;
        setFetchLog(prev => prev + ` ✓ ${p.symbol}`);
      } catch(e) {
        setFetchLog(prev => prev + ` ⚠${p.symbol}`);
      }
    }

    // TW Stocks via TWSE
    for (const p of twPositions) {
      try {
        const r = await fetch(
          `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${p.symbol}.tw&json=1&delay=0`
        );
        const data = await r.json();
        const price = parseFloat(data?.msgArray?.[0]?.z || data?.msgArray?.[0]?.y || '0');
        if (price > 0) updates[p.id] = price;
        setFetchLog(prev => prev + ` ✓ ${p.symbol}`);
      } catch(e) {
        setFetchLog(prev => prev + ` ⚠${p.symbol}`);
      }
    }

    setPositions(prev => prev.map(p => ({
      ...p,
      fetching: false,
      price: updates[p.id] !== undefined ? updates[p.id] : p.price,
      lastFetched: updates[p.id] !== undefined ? nowStr() : p.lastFetched,
    })));
    setTimeout(() => setFetchLog(''), 4000);
  }, [positions]);

  // ── AI Analysis ─────────────────────────────────────────────────────
  const runAI = useCallback(async () => {
    setAiLoading(true);
    setAiPanel(true);
    setAiResult('');
    const summary = enriched.map(p =>
      `${p.symbol}(${p.market}) 持倉:${p.units} 成本:${p.entry} 現價:${p.price||'未知'} PnL:${fmt(p.pnlPct)}% 勝率:${(p.p*100).toFixed(0)}% 盈虧比:${fmt(p.b)} Full Kelly:${fmt(p.fFull*100)}%`
    ).join('\n');

    const prompt = `你是一位量化交易分析師，專精凱利公式動態控倉。請分析以下投資組合並給出具體建議：

【當前倉位快照】
${summary}

請從以下角度分析（使用繁體中文，結構清晰）：
1. 📊 整體倉位評估：組合集中度、相關性風險、總槓桿
2. 🎯 凱利建議：哪些倉位偏高/偏低，具體調整方向
3. ⚠️ 風險警示：最值得注意的風險因素
4. 💡 優化建議：如何改善策略參數（勝率、盈虧比）
5. 📅 行動清單：按優先順序列出3-5個具體操作

語氣專業但簡潔，每點控制在2-3句。`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role:'user', content: prompt }],
        })
      });
      const data = await res.json();
      const text = data.content?.map(c=>c.text||'').join('') || '分析失敗，請稍後再試。';
      setAiResult(text);
    } catch(e) {
      setAiResult('⚠ 連線失敗，請確認網路狀態後重試。');
    }
    setAiLoading(false);
  }, [enriched]);

  // ── Snapshot ─────────────────────────────────────────────────────────
  const snapshot = useCallback(() => {
    const lines = [
      `凱利倉位快照  ${new Date().toLocaleString('zh-TW')}`,
      `═══════════════════════════════════════`,
      ...enriched.map(p =>
        `${p.symbol.padEnd(6)} ${p.market.padEnd(10)} 持倉:${p.units} 成本:${fmt(p.entry)} 現價:${p.price>0?fmt(p.price):'N/A'} PnL:${fmt(p.pnlPct)}% Kelly:${fmt(p.fFull*100)}%`
      ),
      `───────────────────────────────────────`,
      `總成本 ${fmtMoney(totCost,displayCcy)}  已知市值 ${totVal>0?fmtMoney(totVal,displayCcy):'—'}`,
    ];
    const txt = lines.join('\n');
    navigator.clipboard?.writeText(txt);
    setSnapMsg('✓ 已複製到剪貼簿');
    setTimeout(()=>setSnapMsg(''),2500);
  }, [enriched, totCost, totVal, displayCcy]);

  // ── Add/Edit form state ───────────────────────────────────────────────
  const blankForm = { symbol:'', name:'', market:'crypto', ccy:'USD', units:'', entry:'', price:'', p:0.55, w:0.10, l:0.05 };
  const [form, setForm] = useState(blankForm);

  const openAdd = () => { setForm(blankForm); setShowAdd(true); };
  const openEdit = (pos) => {
    setForm({ symbol:pos.symbol, name:pos.name, market:pos.market, ccy:pos.ccy,
      units:pos.units, entry:pos.entry, price:pos.price, p:pos.p, w:pos.w, l:pos.l });
    setEditPos(pos.id);
  };

  const saveForm = () => {
    const base = { symbol:form.symbol.toUpperCase(), name:form.name||form.symbol.toUpperCase(),
      market:form.market, ccy:form.ccy, units:parseFloat(form.units)||0,
      entry:parseFloat(form.entry)||0, price:parseFloat(form.price)||0,
      p:form.p, w:form.w, l:form.l, fetching:false, lastFetched:null };
    if (editPos) {
      setPositions(prev => prev.map(p => p.id===editPos ? {...p,...base} : p));
      setEditPos(null);
    } else {
      setPositions(prev => [...prev, { id:uid(), ...base }]);
      setShowAdd(false);
    }
  };

  const deletePos = (id) => setPositions(prev => prev.filter(p=>p.id!==id));

  // ── Chart data ────────────────────────────────────────────────────────
  const allocationData = useMemo(() =>
    enriched.filter(p=>p.costBasis>0).map(p=>({
      name: p.symbol,
      value: parseFloat(toDisplay(p.costBasis, p.ccy).toFixed(2)),
    }))
  , [enriched, toDisplay]);

  const kellyBarData = useMemo(() =>
    enriched.map(p=>({
      symbol: p.symbol,
      'Full Kelly': parseFloat((p.fFull*100).toFixed(1)),
      'Half Kelly': parseFloat((p.fHalf*100).toFixed(1)),
      '安全線': 5,
    }))
  , [enriched]);

  const MARKET_LABELS = { crypto:'加密貨幣', us_stock:'美股', tw_stock:'台股', forex:'外匯' };
  const CCY_OPTIONS = { crypto:['USD','TWD','EUR'], us_stock:['USD','TWD'], tw_stock:['TWD'], forex:['USD','EUR','GBP'] };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.text,
      fontFamily:"'Sora','Noto Sans TC',sans-serif" }}>
      <style>{CSS}</style>

      {/* ══ Header ══════════════════════════════════════════════════════ */}
      <div style={{ background:T.panel, borderBottom:`1px solid ${T.border}`,
        position:'sticky', top:0, zIndex:200, backdropFilter:'blur(12px)' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', padding:'0 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:`linear-gradient(135deg,${T.amber},#ef4444)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:16, color:'#000' }}>K</div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, letterSpacing:'.03em' }}>凱利倉位導航儀</div>
              <div style={{ fontSize:9, color:T.dim, letterSpacing:'.1em', fontFamily:"'JetBrains Mono',monospace" }}>
                KELLY CRITERION · DYNAMIC POSITION MANAGER
              </div>
            </div>
          </div>

          {/* Market filter */}
          <div style={{ display:'flex', gap:6 }}>
            {['all','crypto','us_stock','tw_stock','forex'].map(m => (
              <Pill key={m} label={m==='all'?'全部':MARKET_LABELS[m]} active={marketFilter===m}
                onClick={() => setMkt(m)} />
            ))}
          </div>

          {/* Currency + stats */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex', gap:4 }}>
              {['USD','TWD'].map(c => (
                <button key={c} onClick={() => setDCcy(c)} style={{
                  padding:'4px 10px', borderRadius:6, border:`1px solid ${c===displayCcy?T.amber:T.border}`,
                  background: c===displayCcy?`${T.amber}18`:'none', color: c===displayCcy?T.amber:T.dim,
                  fontFamily:"'JetBrains Mono',monospace", fontSize:11, cursor:'pointer', transition:'all .15s',
                }}>{c}</button>
              ))}
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, textAlign:'right' }}>
              <div style={{ color:T.dim, fontSize:10 }}>總成本</div>
              <div style={{ color:T.amber, fontWeight:600 }}>{fmtMoney(totCost, displayCcy)}</div>
            </div>
            {totVal > 0 && (
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, textAlign:'right' }}>
                <div style={{ color:T.dim, fontSize:10 }}>市值</div>
                <div style={{ color: totVal>=totCost?T.green:T.red, fontWeight:600 }}>
                  {fmtMoney(totVal, displayCcy)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth:1440, margin:'0 auto', padding:'0 24px', display:'flex', gap:0, borderTop:`1px solid ${T.border}` }}>
          {[['positions','📋 倉位管理'],['charts','📊 圖表分析']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding:'8px 20px', background:'none', border:'none', cursor:'pointer',
              color: activeTab===id ? T.amber : T.dim,
              borderBottom: activeTab===id ? `2px solid ${T.amber}` : '2px solid transparent',
              fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight: activeTab===id?600:400,
              transition:'all .15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1440, margin:'0 auto', padding:'24px 24px 80px' }}>

        {/* ══ Positions Tab ══════════════════════════════════════════════ */}
        {activeTab === 'positions' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Action bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button className="btn-hover" onClick={openAdd} style={{
                  padding:'8px 18px', borderRadius:8, background:T.amber, color:'#000',
                  border:'none', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all .15s',
                }}>＋ 新增倉位</button>
                <button className="btn-hover" onClick={() => fetchPrices(null)} style={{
                  padding:'8px 16px', borderRadius:8, background:'none', color:T.cyan,
                  border:`1px solid ${T.cyan}66`, fontSize:12, cursor:'pointer', transition:'all .15s',
                  fontFamily:"'JetBrains Mono',monospace",
                }}>⟳ 刷新全部行情</button>
                <button className="btn-hover" onClick={runAI} style={{
                  padding:'8px 16px', borderRadius:8, background:'none', color:'#a78bfa',
                  border:`1px solid #a78bfa66`, fontSize:12, cursor:'pointer', transition:'all .15s',
                  fontFamily:"'JetBrains Mono',monospace",
                }}>✦ AI 分析建議</button>
                <button className="btn-hover" onClick={snapshot} style={{
                  padding:'8px 16px', borderRadius:8, background:'none', color:T.dim,
                  border:`1px solid ${T.border}`, fontSize:12, cursor:'pointer', transition:'all .15s',
                  fontFamily:"'JetBrains Mono',monospace",
                }}>📋 截取快照</button>
                {snapshotMsg && <span style={{ fontSize:11, color:T.green, fontFamily:"'JetBrains Mono',monospace" }}>{snapshotMsg}</span>}
              </div>
              {fetchLog && (
                <div style={{ fontSize:11, color:T.cyan, fontFamily:"'JetBrains Mono',monospace",
                  background:`${T.cyan}11`, border:`1px solid ${T.cyan}33`, borderRadius:6, padding:'4px 10px' }}>
                  {fetchLog}
                </div>
              )}
            </div>

            {/* Position Table */}
            <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden' }}>
              {/* Table header */}
              <div style={{ display:'grid',
                gridTemplateColumns:'120px 90px 80px 110px 110px 90px 80px 80px 80px 1fr',
                padding:'10px 20px', background:T.panel2, borderBottom:`1px solid ${T.border}` }}>
                {['標的','市場','幣別','成本價','現價','損益%','Full K%','Half K%','凱利倉%','操作'].map(h => (
                  <div key={h} style={{ fontSize:10, color:T.dim, letterSpacing:'.08em',
                    fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {filtered.length === 0 && (
                <div style={{ padding:'40px', textAlign:'center', color:T.dim, fontSize:13 }}>
                  尚無倉位，點擊「新增倉位」開始
                </div>
              )}

              {filtered.map((pos, idx) => (
                <div key={pos.id}>
                  <div className="row-hover" onClick={() => setExpanded(expandedId===pos.id?null:pos.id)}
                    style={{ display:'grid',
                      gridTemplateColumns:'120px 90px 80px 110px 110px 90px 80px 80px 80px 1fr',
                      padding:'14px 20px', borderBottom:`1px solid ${T.border}22`,
                      cursor:'pointer', transition:'background .15s',
                      background: expandedId===pos.id ? T.panel2 : 'transparent' }}>

                    {/* Symbol */}
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color: pos.price>0&&pos.price>=pos.entry?T.green:pos.price>0?T.red:T.text }}>
                        {pos.symbol}
                      </div>
                      <div style={{ fontSize:10, color:T.dim }}>{pos.name}</div>
                    </div>

                    {/* Market */}
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <Tag color={pos.market==='crypto'?T.amber:pos.market==='us_stock'?T.blue:pos.market==='tw_stock'?T.green:T.cyan}>
                        {MARKET_LABELS[pos.market]||pos.market}
                      </Tag>
                    </div>

                    {/* Ccy */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.dim, alignSelf:'center' }}>
                      {pos.ccy}
                    </div>

                    {/* Entry */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, alignSelf:'center' }}>
                      {fmtMoney(pos.entry, pos.ccy)}
                      <div style={{ fontSize:9, color:T.dim }}>×{pos.units}</div>
                    </div>

                    {/* Current price */}
                    <div style={{ alignSelf:'center' }}>
                      {pos.fetching ? (
                        <span className="pulse" style={{ color:T.amber, fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>獲取中…</span>
                      ) : pos.price > 0 ? (
                        <>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:pos.price>=pos.entry?T.green:T.red, fontWeight:600 }}>
                            {fmtMoney(pos.price, pos.ccy)}
                          </div>
                          {pos.lastFetched && <div style={{ fontSize:9, color:T.dim }}>{pos.lastFetched}</div>}
                        </>
                      ) : (
                        <button onClick={e=>{e.stopPropagation();fetchPrices([pos.id])}} style={{
                          background:'none', border:`1px solid ${T.cyan}44`, borderRadius:5,
                          color:T.cyan, fontSize:10, padding:'3px 8px', cursor:'pointer',
                          fontFamily:"'JetBrains Mono',monospace"
                        }}>⟳ 取得</button>
                      )}
                    </div>

                    {/* PnL */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, alignSelf:'center',
                      color: pos.price > 0 ? pctColor(pos.pnlPct) : T.dim, fontWeight: pos.price>0?600:400 }}>
                      {pos.price > 0 ? `${pos.pnlPct>=0?'+':''}${fmt(pos.pnlPct)}%` : '—'}
                    </div>

                    {/* Full Kelly */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, alignSelf:'center',
                      color: pos.fFull>0.2?T.red:pos.fFull>0.1?T.amber:T.green, fontWeight:700 }}>
                      {fmt(pos.fFull*100)}%
                    </div>

                    {/* Half Kelly */}
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, alignSelf:'center',
                      color: T.amber, fontWeight:600 }}>
                      {fmt(pos.fHalf*100)}%
                    </div>

                    {/* Recommended size bar */}
                    <div style={{ alignSelf:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ height:6, width:60, background:T.border, borderRadius:3 }}>
                          <div style={{ height:6, width:`${Math.min(pos.fHalf*100/30*100,100)}%`,
                            background: pos.fHalf>0.15?T.red:pos.fHalf>0.08?T.amber:T.green,
                            borderRadius:3, transition:'width .3s' }}/>
                        </div>
                        <span style={{ fontSize:10, color:T.dim, fontFamily:"'JetBrains Mono',monospace" }}>
                          {fmt(pos.fHalf*100)}%
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'flex-end' }}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(pos)} style={{
                        background:'none', border:`1px solid ${T.border2}`, borderRadius:6,
                        color:T.muted, fontSize:11, padding:'4px 10px', cursor:'pointer',
                        fontFamily:"'JetBrains Mono',monospace"
                      }}>編輯</button>
                      <button onClick={() => fetchPrices([pos.id])} style={{
                        background:'none', border:`1px solid ${T.cyan}44`, borderRadius:6,
                        color:T.cyan, fontSize:11, padding:'4px 10px', cursor:'pointer',
                        fontFamily:"'JetBrains Mono',monospace"
                      }}>⟳</button>
                      <button onClick={() => deletePos(pos.id)} style={{
                        background:'none', border:`1px solid ${T.red}44`, borderRadius:6,
                        color:T.red, fontSize:11, padding:'4px 10px', cursor:'pointer',
                        fontFamily:"'JetBrains Mono',monospace"
                      }}>✕</button>
                    </div>
                  </div>

                  {/* ── Expanded row detail ── */}
                  {expandedId === pos.id && (
                    <div className="fade-in" style={{
                      background:`${T.panel2}cc`, borderBottom:`1px solid ${T.border}`,
                      padding:'20px 24px',
                    }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 280px', gap:24 }}>

                        {/* Strategy params */}
                        <div>
                          <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
                            ▸ 策略參數調整
                          </div>
                          <SmallSlider label="勝率 p" value={pos.p} min={0.3} max={0.9} step={0.01}
                            color={T.amber} fmt={v=>`${(v*100).toFixed(0)}%`}
                            onChange={v => setPositions(prev => prev.map(p2=>p2.id===pos.id?{...p2,p:v}:p2))} />
                          <SmallSlider label="平均獲利 w" value={pos.w} min={0.01} max={0.5} step={0.005}
                            color={T.green} fmt={v=>`+${(v*100).toFixed(1)}%`}
                            onChange={v => setPositions(prev => prev.map(p2=>p2.id===pos.id?{...p2,w:v}:p2))} />
                          <SmallSlider label="平均虧損 l" value={pos.l} min={0.01} max={0.2} step={0.005}
                            color={T.red} fmt={v=>`-${(v*100).toFixed(1)}%`}
                            onChange={v => setPositions(prev => prev.map(p2=>p2.id===pos.id?{...p2,l:v}:p2))} />
                        </div>

                        {/* Kelly breakdown */}
                        <div>
                          <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
                            ▸ 凱利倉位建議
                          </div>
                          <div style={{ fontSize:10, color:T.dim, fontFamily:"'JetBrains Mono',monospace", marginBottom:10 }}>
                            f* = (b·p − q) / b  |  b={fmt(pos.b)}  E[R]={(((pos.p*pos.w-(1-pos.p)*pos.l)*100)).toFixed(2)}%
                          </div>
                          {[
                            { label:'Full Kelly', f:pos.fFull, note:'最大化長期成長率', color:T.red },
                            { label:'Half Kelly', f:pos.fHalf, note:'推薦：平衡成長與回撤', color:T.amber },
                            { label:'Quarter Kelly', f:pos.fQtr,  note:'保守配置，多策略適用', color:T.green },
                          ].map(({label,f,note,color}) => (
                            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                              marginBottom:8, padding:'8px 12px', background:T.bg, borderRadius:6,
                              border:`1px solid ${T.border}` }}>
                              <div>
                                <div style={{ fontSize:11, color:T.muted }}>{label}</div>
                                <div style={{ fontSize:9, color:T.dim }}>{note}</div>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, color, fontWeight:700 }}>
                                  {fmt(f*100)}%
                                </div>
                                <div style={{ fontSize:9, color:T.dim, fontFamily:"'JetBrains Mono',monospace" }}>
                                  {fmtMoney(pos.costBasis * f / (pos.entry||1) * (pos.price||pos.entry), pos.ccy)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Position summary */}
                        <div>
                          <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
                            ▸ 倉位摘要
                          </div>
                          {[
                            { k:'持倉數量', v:`${pos.units} ${pos.symbol}` },
                            { k:'成本基礎', v: fmtMoney(pos.costBasis, pos.ccy) },
                            { k:'當前市值', v: pos.price>0 ? fmtMoney(pos.currentVal, pos.ccy) : '—' },
                            { k:'未實現損益', v: pos.price>0 ? `${fmtMoney(pos.pnlAbs, pos.ccy)} (${fmt(pos.pnlPct)}%)` : '—',
                              color: pos.pnlPct>=0?T.green:T.red },
                            { k:'盈虧比 b', v: fmt(pos.b) },
                            { k:'期望值 E[R]', v: `${((pos.p*pos.w-(1-pos.p)*pos.l)*100).toFixed(2)}%`,
                              color: pos.p*pos.w-(1-pos.p)*pos.l > 0 ? T.green : T.red },
                          ].map(({k,v,color}) => (
                            <div key={k} style={{ display:'flex', justifyContent:'space-between',
                              padding:'5px 0', borderBottom:`1px solid ${T.border}22` }}>
                              <span style={{ fontSize:11, color:T.dim }}>{k}</span>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:color||T.text }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary stats */}
            <div style={{ display:'flex', gap:12 }}>
              <KBox label="總投入部位數" value={positions.length} sub="個倉位" />
              <KBox label="平均 Full Kelly" color={T.amber}
                value={`${fmt(enriched.reduce((s,p)=>s+p.fFull,0)/Math.max(enriched.length,1)*100)}%`}
                sub="全組合均值" />
              <KBox label="平均 Half Kelly" color={T.green}
                value={`${fmt(enriched.reduce((s,p)=>s+p.fHalf,0)/Math.max(enriched.length,1)*100)}%`}
                sub="推薦投入比例" />
              <KBox label="持倉 P&L" color={totVal>totCost?T.green:T.red}
                value={totVal>0?`${totVal>=totCost?'+':''}${((totVal-totCost)/totCost*100).toFixed(2)}%`:'—'}
                sub={totVal>0?fmtMoney(totVal-totCost,displayCcy):'等待行情'} />
            </div>
          </div>
        )}

        {/* ══ Charts Tab ═════════════════════════════════════════════════ */}
        {activeTab === 'charts' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

              {/* Kelly bar chart */}
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 24px' }}>
                <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase',
                  fontFamily:"'JetBrains Mono',monospace", marginBottom:16 }}>▸ 各標的凱利建議比例</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={kellyBarData} margin={{ top:4, right:8, left:0, bottom:8 }}>
                    <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
                    <XAxis dataKey="symbol" tick={{ fill:T.dim, fontSize:11 }} />
                    <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:T.dim, fontSize:11 }} />
                    <Tooltip content={<ChartTip/>} />
                    <Legend wrapperStyle={{ fontSize:11 }} />
                    <Bar dataKey="Full Kelly" fill={T.amber} opacity={0.8} radius={[3,3,0,0]} />
                    <Bar dataKey="Half Kelly" fill={T.green} opacity={0.9} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Allocation pie */}
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 24px' }}>
                <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase',
                  fontFamily:"'JetBrains Mono',monospace", marginBottom:16 }}>▸ 成本基礎分配</div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" outerRadius={100}
                      dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={false}>
                      {allocationData.map((_,i)=>(
                        <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v=>[fmtMoney(v,displayCcy),'成本']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Kelly risk profile radar */}
            <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase',
                fontFamily:"'JetBrains Mono',monospace", marginBottom:16 }}>▸ 各標的策略雷達 — 勝率 · 盈虧比 · 凱利比 · 期望值</div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={enriched.map(p => ({
                  subject: p.symbol,
                  勝率: (p.p*100).toFixed(0),
                  盈虧比: Math.min(p.b*20, 100).toFixed(0),
                  凱利比: Math.min(p.fFull*300, 100).toFixed(0),
                  期望值: Math.max(Math.min((p.p*p.w-(1-p.p)*p.l)*500, 100), 0).toFixed(0),
                }))}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill:T.dim, fontSize:11 }} />
                  {['勝率','盈虧比','凱利比','期望值'].map((k,i) => (
                    <Radar key={k} name={k} dataKey={k} stroke={PIE_COLORS[i]}
                      fill={PIE_COLORS[i]} fillOpacity={0.12} />
                  ))}
                  <Legend wrapperStyle={{ fontSize:11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ══ Add/Edit Modal ══════════════════════════════════════════════ */}
      {(showAdd || editPos) && (
        <Modal onClose={() => { setShowAdd(false); setEditPos(null); }}>
          <div style={{ padding:'24px 28px' }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>
              {editPos ? '編輯倉位' : '新增倉位'}
            </div>
            <div style={{ fontSize:11, color:T.dim, marginBottom:24 }}>填入標的資訊與策略參數</div>

            {/* Market tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:20 }}>
              {['crypto','us_stock','tw_stock','forex'].map(m => (
                <button key={m} onClick={() => {
                  const ccys = CCY_OPTIONS[m];
                  setForm(f=>({...f, market:m, ccy:ccys[0]}));
                }} style={{
                  padding:'5px 12px', borderRadius:20, border:`1px solid ${form.market===m?T.amber:T.border}`,
                  background: form.market===m?`${T.amber}15`:'none', color: form.market===m?T.amber:T.dim,
                  fontSize:11, cursor:'pointer', fontFamily:"'JetBrains Mono',monospace",
                }}>{MARKET_LABELS[m]}</button>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
              {[
                { label:'標的代碼', key:'symbol', placeholder: form.market==='crypto'?'BTC':form.market==='tw_stock'?'2330':'AAPL' },
                { label:'名稱', key:'name', placeholder:'選填' },
                { label:'持倉數量', key:'units', placeholder:'e.g. 0.5', type:'number' },
                { label:'成本均價', key:'entry', placeholder:'e.g. 85000', type:'number' },
                { label:'現價（可選）', key:'price', placeholder:'留空則稍後取得', type:'number' },
              ].map(({label,key,placeholder,type}) => (
                <div key={key} style={{ gridColumn: key==='symbol'?'1':'auto' }}>
                  <div style={{ fontSize:10, color:T.dim, marginBottom:5, letterSpacing:'.06em',
                    fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>{label}</div>
                  <input type={type||'text'} value={form[key]} placeholder={placeholder}
                    onChange={e => setForm(f=>({...f,[key]:e.target.value}))}
                    style={{ width:'100%', background:T.bg, border:`1px solid ${T.border2}`, borderRadius:7,
                      padding:'9px 12px', color:T.text, fontSize:13,
                      fontFamily:"'JetBrains Mono',monospace" }} />
                </div>
              ))}

              {/* Currency */}
              <div>
                <div style={{ fontSize:10, color:T.dim, marginBottom:5, letterSpacing:'.06em',
                  fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>計價幣別</div>
                <select value={form.ccy} onChange={e=>setForm(f=>({...f,ccy:e.target.value}))}
                  style={{ width:'100%', background:T.bg, border:`1px solid ${T.border2}`, borderRadius:7,
                    padding:'9px 12px', color:T.text, fontSize:13,
                    fontFamily:"'JetBrains Mono',monospace", cursor:'pointer' }}>
                  {(CCY_OPTIONS[form.market]||['USD']).map(c=>(
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Strategy params */}
            <div style={{ background:T.bg, borderRadius:8, padding:'16px', border:`1px solid ${T.border}`, marginBottom:20 }}>
              <div style={{ fontSize:10, color:T.dim, letterSpacing:'.1em', textTransform:'uppercase',
                fontFamily:"'JetBrains Mono',monospace", marginBottom:14 }}>▸ 策略參數（凱利計算依據）</div>
              <SmallSlider label="勝率 p" value={form.p} min={0.3} max={0.9} step={0.01}
                color={T.amber} fmt={v=>`${(v*100).toFixed(0)}%`}
                onChange={v=>setForm(f=>({...f,p:v}))} />
              <SmallSlider label="平均獲利 w" value={form.w} min={0.01} max={0.5} step={0.005}
                color={T.green} fmt={v=>`+${(v*100).toFixed(1)}%`}
                onChange={v=>setForm(f=>({...f,w:v}))} />
              <SmallSlider label="平均虧損 l" value={form.l} min={0.01} max={0.2} step={0.005}
                color={T.red} fmt={v=>`-${(v*100).toFixed(1)}%`}
                onChange={v=>setForm(f=>({...f,l:v}))} />
              <div style={{ marginTop:12, padding:'10px 12px', background:T.panel, borderRadius:6, border:`1px solid ${T.border}`,
                fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
                <span style={{ color:T.dim }}>f* = </span>
                <span style={{ color:T.amber, fontWeight:700 }}>
                  {fmt(kelly(form.p, form.w/(form.l||0.01))*100)}%
                </span>
                <span style={{ color:T.dim }}>  Half Kelly = </span>
                <span style={{ color:T.green, fontWeight:700 }}>
                  {fmt(kelly(form.p, form.w/(form.l||0.01))/2*100)}%
                </span>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setEditPos(null); }} style={{
                padding:'10px 20px', borderRadius:8, background:'none', border:`1px solid ${T.border}`,
                color:T.dim, cursor:'pointer', fontSize:13
              }}>取消</button>
              <button onClick={saveForm} disabled={!form.symbol||!form.units||!form.entry} style={{
                padding:'10px 24px', borderRadius:8, background:T.amber, border:'none',
                color:'#000', fontWeight:700, fontSize:13, cursor:'pointer',
                opacity: (!form.symbol||!form.units||!form.entry)?0.4:1,
              }}>
                {editPos ? '儲存變更' : '新增倉位'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ AI Panel ════════════════════════════════════════════════════ */}
      {aiPanel && (
        <div style={{ position:'fixed', inset:0, background:'#000c', zIndex:300,
          display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:24 }}
          onClick={e=>{ if(e.target===e.currentTarget) setAiPanel(false) }}>
          <div className="fade-in" style={{ width:520, maxHeight:'80vh', background:T.panel,
            border:`1px solid ${'#a78bfa'}55`, borderRadius:14, overflow:'hidden',
            boxShadow:`0 0 80px ${'#a78bfa'}22`, display:'flex', flexDirection:'column' }}>

            {/* AI header */}
            <div style={{ padding:'18px 22px', borderBottom:`1px solid ${T.border}`,
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:`${'#a78bfa'}0d` }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#a78bfa' }}>✦ AI 凱利策略分析</div>
                <div style={{ fontSize:10, color:T.dim, marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>
                  Claude · 量化倉位建議
                </div>
              </div>
              <button onClick={() => setAiPanel(false)} style={{
                background:'none', border:'none', color:T.dim, cursor:'pointer', fontSize:18
              }}>✕</button>
            </div>

            {/* AI content */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>
              {aiLoading ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, paddingTop:40 }}>
                  <div className="spin" style={{ width:32, height:32, border:`2px solid ${T.border}`,
                    borderTop:`2px solid ${'#a78bfa'}`, borderRadius:'50%' }} />
                  <div style={{ color:T.dim, fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>
                    分析中，請稍候…
                  </div>
                </div>
              ) : aiResult ? (
                <div style={{ fontSize:13, lineHeight:1.9, color:T.text, whiteSpace:'pre-wrap' }}>
                  {aiResult}
                </div>
              ) : null}
            </div>

            {/* Rerun */}
            {!aiLoading && aiResult && (
              <div style={{ padding:'14px 22px', borderTop:`1px solid ${T.border}` }}>
                <button onClick={runAI} style={{
                  width:'100%', padding:'9px', borderRadius:8, background:`${'#a78bfa'}20`,
                  border:`1px solid ${'#a78bfa'}44`, color:'#a78bfa', cursor:'pointer', fontSize:13
                }}>↻ 重新分析</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import React from 'react';
import ReactDOM from 'react-dom/client';

// 假設你的主組件名稱叫 KellyTrader
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <KellyTrader />
  </React.StrictMode>
);
