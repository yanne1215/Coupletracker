import { useState, useRef, useCallback } from “react”;

const CATEGORIES = [
{ id: “groceries”, label: “Groceries”, icon: “🛒”, color: “#2ECC71” },
{ id: “dining”, label: “Dining”, icon: “🍽️”, color: “#E67E22” },
{ id: “transport”, label: “Transport”, icon: “🚗”, color: “#3498DB” },
{ id: “shopping”, label: “Shopping”, icon: “🛍️”, color: “#9B59B6” },
{ id: “entertainment”, label: “Entertainment”, icon: “🎬”, color: “#E74C3C” },
{ id: “travel”, label: “Travel”, icon: “✈️”, color: “#1ABC9C” },
{ id: “health”, label: “Health”, icon: “💊”, color: “#E91E63” },
{ id: “utilities”, label: “Utilities”, icon: “⚡”, color: “#F39C12” },
{ id: “home”, label: “Home”, icon: “🏠”, color: “#607D8B” },
{ id: “other”, label: “Other”, icon: “📦”, color: “#95A5A6” },
];

const PAYERS = [
{ id: “me”, label: “Me” },
{ id: “partner”, label: “Partner” },
{ id: “split”, label: “Split 50/50” },
];

function fmt(n) {
return `CA$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function getCat(id) {
return CATEGORIES.find(c => c.id === id) || CATEGORIES[9];
}

const INITIAL = [
{ id: 1, date: “2026-04-18”, store: “Loblaws”, category: “groceries”, amount: 87.43, note: “Weekly groceries”, payer: “me”, photo: null },
{ id: 2, date: “2026-04-16”, store: “Tim Hortons”, category: “dining”, amount: 14.25, note: “Coffee & bagels”, payer: “split”, photo: null },
{ id: 3, date: “2026-04-14”, store: “Shoppers Drug Mart”, category: “health”, amount: 32.10, note: “Cold medicine”, payer: “partner”, photo: null },
{ id: 4, date: “2026-04-12”, store: “Canadian Tire”, category: “home”, amount: 56.80, note: “Light bulbs & tools”, payer: “me”, photo: null },
{ id: 5, date: “2026-04-10”, store: “Cineplex”, category: “entertainment”, amount: 38.00, note: “Movie night”, payer: “split”, photo: null },
{ id: 6, date: “2026-04-08”, store: “No Frills”, category: “groceries”, amount: 63.27, note: “Groceries”, payer: “partner”, photo: null },
{ id: 7, date: “2026-03-28”, store: “IKEA”, category: “home”, amount: 210.50, note: “Shelving unit”, payer: “split”, photo: null },
{ id: 8, date: “2026-03-22”, store: “Esso”, category: “transport”, amount: 74.18, note: “Gas”, payer: “me”, photo: null },
{ id: 9, date: “2026-03-15”, store: “Sport Chek”, category: “shopping”, amount: 129.99, note: “Running shoes”, payer: “partner”, photo: null },
{ id: 10, date: “2026-03-10”, store: “The Keg”, category: “dining”, amount: 148.70, note: “Anniversary dinner”, payer: “split”, photo: null },
];

export default function App() {
const [view, setView] = useState(“home”);
const [records, setRecords] = useState(INITIAL);
const [form, setForm] = useState({ date: “2026-04-21”, store: “”, category: “groceries”, amount: “”, note: “”, payer: “split”, photo: null });
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [statsMonth, setStatsMonth] = useState(4);
const [toast, setToast] = useState(null);
const [deleteId, setDeleteId] = useState(null);
const fileRef = useRef();

const showToast = (msg, type = “success”) => {
setToast({ msg, type });
setTimeout(() => setToast(null), 3000);
};

const handlePhoto = useCallback(async (file) => {
if (!file) return;
setIsAnalyzing(true);
const reader = new FileReader();
reader.onload = async (e) => {
const base64 = e.target.result.split(”,”)[1];
try {
const res = await fetch(“https://api.anthropic.com/v1/messages”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
model: “claude-sonnet-4-20250514”,
max_tokens: 500,
messages: [{
role: “user”,
content: [
{ type: “image”, source: { type: “base64”, media_type: file.type, data: base64 } },
{ type: “text”, text: `Analyze this receipt or shopping photo. Extract the following and respond ONLY with a JSON object, no other text: { "amount": number (total amount in CAD, 0 if not found), "store": "store name" (identify the Canadian retailer - e.g. Loblaws, Costco, Canadian Tire, Tim Hortons, Shoppers Drug Mart, No Frills, Metro, Sobeys, Winners, HomeSense, The Bay, Sport Chek, Best Buy, Dollarama, LCBO, Beer Store, Esso, Petro-Canada, Shell, McDonald's, A&W, Harvey's, Swiss Chalet, Boston Pizza, Cineplex, etc. If unsure write the store name from the receipt.), "category": "groceries|dining|transport|shopping|entertainment|travel|health|utilities|home|other", "note": "brief description under 40 chars" }` }
]
}]
})
});
const data = await res.json();
const text = data.content?.map(i => i.text || “”).join(””) || “”;
const clean = text.replace(/`json|`/g, “”).trim();
const parsed = JSON.parse(clean);
setForm(f => ({
…f,
amount: parsed.amount || “”,
store: parsed.store || “”,
category: parsed.category || “other”,
note: parsed.note || “”,
photo: e.target.result
}));
showToast(“Receipt scanned successfully”);
} catch {
setForm(f => ({ …f, photo: e.target.result }));
showToast(“Photo uploaded — please fill in details”, “info”);
}
setIsAnalyzing(false);
};
reader.readAsDataURL(file);
}, []);

const handleSave = () => {
if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
showToast(“Please enter a valid amount”, “error”); return;
}
setRecords(r => [{ …form, id: Date.now(), amount: Number(form.amount) }, …r]);
setForm({ date: “2026-04-21”, store: “”, category: “groceries”, amount: “”, note: “”, payer: “split”, photo: null });
setView(“home”);
showToast(“Expense added”);
};

const handleDelete = (id) => {
setRecords(r => r.filter(x => x.id !== id));
setDeleteId(null);
showToast(“Expense deleted”, “info”);
};

const monthRecords = records.filter(r => new Date(r.date).getMonth() + 1 === statsMonth);
const total = monthRecords.reduce((s, r) => s + r.amount, 0);
const myShare = monthRecords.reduce((s, r) => s + (r.payer === “me” ? r.amount : r.payer === “split” ? r.amount / 2 : 0), 0);
const partnerShare = monthRecords.reduce((s, r) => s + (r.payer === “partner” ? r.amount : r.payer === “split” ? r.amount / 2 : 0), 0);
const balance = myShare - partnerShare;

const catStats = CATEGORIES.map(cat => ({
…cat,
total: monthRecords.filter(r => r.category === cat.id).reduce((s, r) => s + r.amount, 0)
})).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

const MONTH_NAMES = [“Jan”,“Feb”,“Mar”,“Apr”,“May”,“Jun”,“Jul”,“Aug”,“Sep”,“Oct”,“Nov”,“Dec”];

return (
<div style={{ minHeight: “100vh”, background: “#F5F4F0”, fontFamily: “‘DM Sans’, sans-serif”, color: “#1A1A1A” }}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F5F4F0; } ::-webkit-scrollbar { width: 0; } .btn { cursor: pointer; border: none; outline: none; transition: all 0.15s ease; } .btn:active { transform: scale(0.97); } .card { background: #fff; border-radius: 14px; border: 1px solid #E8E6E1; } input, select, textarea { font-family: 'DM Sans', sans-serif; background: #fff; border: 1.5px solid #E8E6E1; border-radius: 10px; color: #1A1A1A; padding: 11px 14px; width: 100%; font-size: 15px; outline: none; transition: border-color 0.15s; } input:focus, select:focus, textarea:focus { border-color: #2563EB; } input::placeholder, textarea::placeholder { color: #AAAAAA; } select option { background: #fff; } .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; } .slide-up { animation: slideUp 0.25s ease; } @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } } .toast-wrap { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; animation: toastIn 0.2s ease; white-space: nowrap; } @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(-8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } } .nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; border: none; background: transparent; padding: 8px 0; flex: 1; transition: color 0.15s; } .scan-zone { border: 2px dashed #D4D0C8; border-radius: 12px; background: #FAFAF8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 130px; cursor: pointer; transition: all 0.15s; } .scan-zone:hover { border-color: #2563EB; background: #F0F5FF; } .progress-bar { height: 6px; background: #F0EDE8; border-radius: 3px; overflow: hidden; } .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; } .shimmer { background: linear-gradient(90deg, #f0ede8 25%, #e8e5e0 50%, #f0ede8 75%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; } @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} } .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 800; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s ease; } @keyframes fadeIn { from{opacity:0} to{opacity:1} } .modal-box { background: #fff; border-radius: 20px 20px 0 0; padding: 24px; width: 100%; max-width: 480px; animation: slideModal 0.25s ease; } @keyframes slideModal { from{transform:translateY(20px)} to{transform:translateY(0)} } .row-hover:hover { background: #FAFAF8; }`}</style>

```
  {/* Toast */}
  {toast && (
    <div className="toast-wrap">
      <div style={{ background: toast.type === "error" ? "#FEE2E2" : toast.type === "info" ? "#EFF6FF" : "#DCFCE7", color: toast.type === "error" ? "#991B1B" : toast.type === "info" ? "#1E40AF" : "#166534", padding: "10px 18px", borderRadius: 50, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
        {toast.msg}
      </div>
    </div>
  )}

  {/* Delete Confirm Modal */}
  {deleteId && (
    <div className="modal-bg" onClick={() => setDeleteId(null)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8 }}>Delete this expense?</div>
        <div style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>This action cannot be undone.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#F5F4F0", fontSize: 15, fontWeight: 500, color: "#444" }}>Cancel</button>
          <button className="btn" onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#EF4444", fontSize: 15, fontWeight: 600, color: "#fff" }}>Delete</button>
        </div>
      </div>
    </div>
  )}

  {/* Header */}
  <div style={{ background: "#fff", borderBottom: "1px solid #E8E6E1", padding: "52px 20px 16px", position: "sticky", top: 0, zIndex: 100 }}>
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#999", letterSpacing: 1.5, textTransform: "uppercase" }}>Shared Expenses</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
          {view === "home" && "Overview"}
          {view === "add" && "Add Expense"}
          {view === "stats" && "Monthly Stats"}
          {view === "history" && "All Expenses"}
        </div>
      </div>
      {view === "home" && (
        <button className="btn" onClick={() => setView("add")} style={{ background: "#2563EB", color: "#fff", padding: "10px 16px", borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
          + Add
        </button>
      )}
    </div>
  </div>

  {/* Content */}
  <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 100px" }}>
    {view === "home" && <HomeView records={records} statsMonth={statsMonth} total={total} myShare={myShare} partnerShare={partnerShare} balance={balance} onDelete={setDeleteId} />}
    {view === "add" && <AddView form={form} setForm={setForm} onSave={handleSave} onPhoto={handlePhoto} fileRef={fileRef} isAnalyzing={isAnalyzing} />}
    {view === "stats" && <StatsView catStats={catStats} total={total} myShare={myShare} partnerShare={partnerShare} balance={balance} month={statsMonth} setMonth={setStatsMonth} monthNames={MONTH_NAMES} monthRecords={monthRecords} />}
    {view === "history" && <HistoryView records={records} onDelete={setDeleteId} />}
  </div>

  {/* Bottom Nav */}
  <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E8E6E1", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
    {[
      { id: "home", icon: "⊞", label: "Overview" },
      { id: "add", icon: "+", label: "Add", isAdd: true },
      { id: "stats", icon: "◑", label: "Stats" },
      { id: "history", icon: "≡", label: "History" },
    ].map(t => (
      <button key={t.id} className="nav-item btn" onClick={() => setView(t.id)}
        style={{ color: view === t.id ? "#2563EB" : "#999" }}>
        <span style={{ fontSize: t.isAdd ? 22 : 18, fontWeight: 700, lineHeight: 1 }}>{t.icon}</span>
        <span style={{ fontSize: 10, fontWeight: view === t.id ? 600 : 400 }}>{t.label}</span>
      </button>
    ))}
  </div>

  <input type="file" ref={fileRef} accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handlePhoto(e.target.files[0])} />
</div>
```

);
}

function HomeView({ records, total, myShare, partnerShare, balance, onDelete }) {
const recent = […records].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
const aprRecords = records.filter(r => new Date(r.date).getMonth() + 1 === 4);
const aprTotal = aprRecords.reduce((s, r) => s + r.amount, 0);

return (
<div className="slide-up">
{/* Balance Card */}
<div className=“card” style={{ padding: “20px”, marginBottom: 12, background: “#1A1A1A”, border: “none” }}>
<div style={{ color: “rgba(255,255,255,0.5)”, fontSize: 12, fontWeight: 500, marginBottom: 4 }}>April 2026 · Total Spent</div>
<div style={{ color: “#fff”, fontSize: 32, fontWeight: 700, fontFamily: “‘DM Mono’, monospace”, letterSpacing: -1 }}>{fmt(aprTotal)}</div>
<div style={{ display: “flex”, gap: 12, marginTop: 16 }}>
<div style={{ flex: 1, background: “rgba(255,255,255,0.08)”, borderRadius: 10, padding: “12px” }}>
<div style={{ color: “rgba(255,255,255,0.45)”, fontSize: 11, fontWeight: 500, marginBottom: 4 }}>YOU PAID</div>
<div style={{ color: “#fff”, fontSize: 17, fontWeight: 600, fontFamily: “‘DM Mono’, monospace” }}>{fmt(myShare)}</div>
</div>
<div style={{ flex: 1, background: “rgba(255,255,255,0.08)”, borderRadius: 10, padding: “12px” }}>
<div style={{ color: “rgba(255,255,255,0.45)”, fontSize: 11, fontWeight: 500, marginBottom: 4 }}>PARTNER PAID</div>
<div style={{ color: “#fff”, fontSize: 17, fontWeight: 600, fontFamily: “‘DM Mono’, monospace” }}>{fmt(partnerShare)}</div>
</div>
</div>
{balance !== 0 && (
<div style={{ marginTop: 12, background: “rgba(255,255,255,0.06)”, borderRadius: 8, padding: “10px 14px”, fontSize: 13, color: “rgba(255,255,255,0.7)” }}>
{balance > 0 ? `Partner owes you ${fmt(Math.abs(balance))}` : `You owe partner ${fmt(Math.abs(balance))}`}
</div>
)}
</div>

```
  {/* Recent */}
  <div style={{ fontWeight: 600, fontSize: 14, color: "#888", marginBottom: 8, marginTop: 4 }}>RECENT EXPENSES</div>
  <div className="card" style={{ overflow: "hidden" }}>
    {recent.map((r, i) => <ExpenseRow key={r.id} record={r} last={i === recent.length - 1} onDelete={onDelete} />)}
  </div>
</div>
```

);
}

function ExpenseRow({ record, last, onDelete }) {
const cat = getCat(record.category);
const payer = PAYERS.find(p => p.id === record.payer);
return (
<div className=“row-hover” style={{ display: “flex”, alignItems: “center”, padding: “13px 16px”, gap: 12, borderBottom: last ? “none” : “1px solid #F0EDE8” }}>
<div style={{ width: 38, height: 38, borderRadius: 10, background: cat.color + “18”, display: “flex”, alignItems: “center”, justifyContent: “center”, fontSize: 18, flexShrink: 0 }}>
{cat.icon}
</div>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 600, fontSize: 14, whiteSpace: “nowrap”, overflow: “hidden”, textOverflow: “ellipsis” }}>{record.store || record.note || cat.label}</div>
<div style={{ fontSize: 12, color: “#999”, marginTop: 1 }}>{record.date} · <span style={{ color: cat.color, fontWeight: 500 }}>{cat.label}</span> · {payer?.label}</div>
</div>
<div style={{ textAlign: “right”, flexShrink: 0 }}>
<div style={{ fontWeight: 700, fontFamily: “‘DM Mono’, monospace”, fontSize: 14 }}>{fmt(record.amount)}</div>
<button className=“btn” onClick={() => onDelete(record.id)} style={{ color: “#CCC”, fontSize: 11, padding: “2px 0”, marginTop: 2, background: “transparent” }}>delete</button>
</div>
</div>
);
}

function AddView({ form, setForm, onSave, onPhoto, fileRef, isAnalyzing }) {
return (
<div className="slide-up">
{/* Scan Zone */}
<div className={`scan-zone ${isAnalyzing ? "shimmer" : ""}`} onClick={() => fileRef.current?.click()} style={{ marginBottom: 16, position: “relative”, overflow: “hidden” }}>
{form.photo ? (
<>
<img src={form.photo} alt=”” style={{ position: “absolute”, inset: 0, width: “100%”, height: “100%”, objectFit: “cover”, opacity: 0.25 }} />
<div style={{ position: “relative”, zIndex: 1, textAlign: “center” }}>
<div style={{ fontSize: 26 }}>{isAnalyzing ? “🔍” : “✓”}</div>
<div style={{ fontSize: 13, color: “#555”, fontWeight: 500 }}>{isAnalyzing ? “Scanning receipt…” : “Receipt scanned · tap to change”}</div>
</div>
</>
) : (
<>
<div style={{ fontSize: 28 }}>📷</div>
<div style={{ fontWeight: 600, fontSize: 14, color: “#444” }}>Scan Receipt</div>
<div style={{ fontSize: 12, color: “#999” }}>AI detects amount, store & category</div>
</>
)}
</div>

```
  <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
    {/* Amount */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>AMOUNT (CAD)</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 600, color: "#666", fontFamily: "'DM Mono', monospace" }}>CA$</span>
        <input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ paddingLeft: 48, fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 18 }} />
      </div>
    </div>

    {/* Store */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>STORE / MERCHANT</label>
      <input placeholder="e.g. Loblaws, Tim Hortons, Canadian Tire..." value={form.store} onChange={e => setForm(f => ({ ...f, store: e.target.value }))} />
    </div>

    {/* Category */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 8 }}>CATEGORY</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setForm(f => ({ ...f, category: cat.id }))} className="btn"
            style={{ padding: "8px 4px", borderRadius: 10, background: form.category === cat.id ? cat.color + "20" : "#F5F4F0", border: `1.5px solid ${form.category === cat.id ? cat.color : "transparent"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 18 }}>{cat.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 500, color: form.category === cat.id ? cat.color : "#777", lineHeight: 1.2, textAlign: "center" }}>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Note */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>NOTE</label>
      <input placeholder="Optional description" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
    </div>

    {/* Date */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>DATE</label>
      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
    </div>

    {/* Payer */}
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#888", display: "block", marginBottom: 8 }}>PAID BY</label>
      <div style={{ display: "flex", gap: 8 }}>
        {PAYERS.map(p => (
          <button key={p.id} onClick={() => setForm(f => ({ ...f, payer: p.id }))} className="btn"
            style={{ flex: 1, padding: "11px 8px", borderRadius: 10, background: form.payer === p.id ? "#EFF6FF" : "#F5F4F0", border: `1.5px solid ${form.payer === p.id ? "#2563EB" : "transparent"}`, fontSize: 13, fontWeight: form.payer === p.id ? 600 : 400, color: form.payer === p.id ? "#2563EB" : "#666" }}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  </div>

  <button onClick={onSave} className="btn" style={{ width: "100%", marginTop: 14, padding: "15px", background: "#2563EB", borderRadius: 12, fontSize: 15, fontWeight: 700, color: "#fff" }}>
    Save Expense
  </button>
</div>
```

);
}

function StatsView({ catStats, total, myShare, partnerShare, balance, month, setMonth, monthNames, monthRecords }) {
const maxCat = catStats[0]?.total || 1;
return (
<div className="slide-up">
{/* Month Picker */}
<div style={{ display: “flex”, alignItems: “center”, justifyContent: “space-between”, marginBottom: 16 }}>
<button className=“btn” onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} style={{ background: “#fff”, border: “1px solid #E8E6E1”, borderRadius: 8, padding: “8px 14px”, fontSize: 16, color: “#444” }}>‹</button>
<div style={{ fontWeight: 700, fontSize: 17 }}>{monthNames[month - 1]} 2026</div>
<button className=“btn” onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} style={{ background: “#fff”, border: “1px solid #E8E6E1”, borderRadius: 8, padding: “8px 14px”, fontSize: 16, color: “#444” }}>›</button>
</div>

```
  {/* Summary */}
  <div className="card" style={{ padding: 18, marginBottom: 12 }}>
    <div style={{ color: "#999", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>TOTAL SPENT</div>
    <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>{fmt(total)}</div>
    <div style={{ display: "flex", gap: 10 }}>
      {[{ l: "You", v: myShare, c: "#2563EB" }, { l: "Partner", v: partnerShare, c: "#9333EA" }].map(x => (
        <div key={x.l} style={{ flex: 1, background: x.c + "10", borderRadius: 10, padding: "12px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: x.c, marginBottom: 4 }}>{x.l.toUpperCase()}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 16, color: "#1A1A1A" }}>{fmt(x.v)}</div>
        </div>
      ))}
    </div>
    {balance !== 0 && total > 0 && (
      <div style={{ marginTop: 12, padding: "10px 14px", background: "#F5F4F0", borderRadius: 8, fontSize: 13, color: "#555", fontWeight: 500 }}>
        {balance > 0 ? `→ Partner owes you ${fmt(Math.abs(balance))}` : `→ You owe partner ${fmt(Math.abs(balance))}`}
      </div>
    )}
  </div>

  {/* Categories */}
  {catStats.length === 0 ? (
    <div className="card" style={{ padding: 32, textAlign: "center", color: "#999" }}>No expenses this month</div>
  ) : (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", fontWeight: 600, fontSize: 12, color: "#888" }}>BY CATEGORY</div>
      {catStats.map((cat, i) => (
        <div key={cat.id} style={{ padding: "12px 16px", borderTop: "1px solid #F0EDE8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{cat.icon}</span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{cat.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "#999" }}>{total > 0 ? Math.round((cat.total / total) * 100) : 0}%</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 14 }}>{fmt(cat.total)}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(cat.total / maxCat) * 100}%`, background: cat.color }} />
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Top stores */}
  {monthRecords.length > 0 && (() => {
    const stores = {};
    monthRecords.forEach(r => { const s = r.store || "Unknown"; stores[s] = (stores[s] || 0) + r.amount; });
    const top = Object.entries(stores).sort((a,b) => b[1]-a[1]).slice(0, 5);
    return (
      <div className="card" style={{ marginTop: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 10px", fontWeight: 600, fontSize: 12, color: "#888" }}>TOP STORES</div>
        {top.map(([store, amount], i) => (
          <div key={store} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderTop: "1px solid #F0EDE8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#CCC", fontSize: 11, fontFamily: "'DM Mono', monospace", width: 16 }}>{i + 1}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{store}</span>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600 }}>{fmt(amount)}</span>
          </div>
        ))}
      </div>
    );
  })()}
</div>
```

);
}

function HistoryView({ records, onDelete }) {
const sorted = […records].sort((a, b) => new Date(b.date) - new Date(a.date));
const grouped = sorted.reduce((acc, r) => {
const key = r.date.slice(0, 7);
if (!acc[key]) acc[key] = [];
acc[key].push(r);
return acc;
}, {});
const MONTH_NAMES = [“Jan”,“Feb”,“Mar”,“Apr”,“May”,“Jun”,“Jul”,“Aug”,“Sep”,“Oct”,“Nov”,“Dec”];

return (
<div className="slide-up">
{Object.entries(grouped).map(([month, recs]) => {
const [y, m] = month.split(”-”);
const total = recs.reduce((s, r) => s + r.amount, 0);
return (
<div key={month} style={{ marginBottom: 16 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 8 }}>
<span style={{ fontWeight: 600, fontSize: 12, color: “#888” }}>{MONTH_NAMES[parseInt(m)-1].toUpperCase()} {y}</span>
<span style={{ fontFamily: “‘DM Mono’, monospace”, fontSize: 12, fontWeight: 600, color: “#888” }}>{fmt(total)}</span>
</div>
<div className=“card” style={{ overflow: “hidden” }}>
{recs.map((r, i) => <ExpenseRow key={r.id} record={r} last={i === recs.length - 1} onDelete={onDelete} />)}
</div>
</div>
);
})}
</div>
);
}
