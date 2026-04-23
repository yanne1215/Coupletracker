import { useState, useRef, useCallback, useEffect } from "react";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://lkxsliacyqqkiazmepja.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHNsaWFjeXFxa2lhem1lcGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODI1MDUsImV4cCI6MjA5MjQ1ODUwNX0.7iKHGbPlgIgMx8TcnV09EfZ95XsUPvETluAiBPcA_pM";

const db = {
  async getAll() {
    const res = await fetch(`${SUPA_URL}/rest/v1/expenses?order=date.desc`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    if (!res.ok) throw new Error("fetch failed");
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      store: r.store || "",
      category: r.category || "other",
      amount: Number(r.amount),
      note: r.note || "",
      payer: r.payer || "split",
      paymentMethod: r.payment_method || "Credit Card",
      currency: r.currency || "CAD",
      photo: null,
    }));
  },
  async insert(rec) {
    const res = await fetch(`${SUPA_URL}/rest/v1/expenses`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json", Prefer: "return=representation"
      },
      body: JSON.stringify({
        date: rec.date, store: rec.store, category: rec.category,
        amount: rec.amount, note: rec.note, payer: rec.payer,
        payment_method: rec.paymentMethod, currency: rec.currency,
      })
    });
    if (!res.ok) throw new Error("insert failed");
    const rows = await res.json();
    return rows[0].id;
  },
  async remove(id) {
    await fetch(`${SUPA_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
  }
};

// ─── Constants ───────────────────────────────────────────────────────────────
const USERS = [
  { id: "yanne", label: "Yanne",      color: "#A78BFA" },
  { id: "tim",   label: "Tim",        color: "#34D399" },
  { id: "split", label: "Split 50/50",color: "#94A3B8" },
];

const PAYMENT_METHODS = ["Credit Card","Debit Card","Cash","E-Transfer","PayPal","Apple Pay","Google Pay","Other"];

const CURRENCIES = [
  { code: "CAD", symbol: "CA$", flag: "🇨🇦" },
  { code: "USD", symbol: "US$", flag: "🇺🇸" },
  { code: "EUR", symbol: "€",   flag: "🇪🇺" },
  { code: "GBP", symbol: "£",   flag: "🇬🇧" },
  { code: "HKD", symbol: "HK$", flag: "🇭🇰" },
  { code: "TWD", symbol: "NT$", flag: "🇹🇼" },
  { code: "JPY", symbol: "¥",   flag: "🇯🇵" },
  { code: "AUD", symbol: "A$",  flag: "🇦🇺" },
];

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DEFAULT_CATEGORIES = [
  { id: "groceries",     label: "Groceries",    icon: "🛒", color: "#10B981" },
  { id: "dining",        label: "Dining",        icon: "🍽️", color: "#F59E0B" },
  { id: "transport",     label: "Transport",     icon: "🚗", color: "#3B82F6" },
  { id: "shopping",      label: "Shopping",      icon: "🛍️", color: "#8B5CF6" },
  { id: "entertainment", label: "Entertainment", icon: "🎬", color: "#EF4444" },
  { id: "travel",        label: "Travel",        icon: "✈️", color: "#06B6D4" },
  { id: "health",        label: "Health",        icon: "💊", color: "#EC4899" },
  { id: "utilities",     label: "Utilities",     icon: "⚡", color: "#F97316" },
  { id: "home",          label: "Home",          icon: "🏠", color: "#6B7280" },
  { id: "other",         label: "Other",         icon: "📦", color: "#64748B" },
];

const DEFAULT_STORES = [
  "Loblaws","No Frills","Metro","Sobeys","Costco","Walmart",
  "Tim Hortons","McDonald's","A&W","Harvey's","Swiss Chalet","The Keg",
  "Canadian Tire","Home Depot","IKEA","Shoppers Drug Mart",
  "Petro-Canada","Esso","Shell","Cineplex","Sport Chek","Winners",
  "LCBO","Beer Store","Best Buy","Dollarama",
];

function fmt(n, code = "CAD") {
  const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
  const dec = code === "JPY" ? 0 : 2;
  return `${cur.symbol}${Number(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const today    = new Date().toISOString().split("T")[0];
const nowMonth = new Date().getMonth() + 1;
const nowYear  = new Date().getFullYear();

const S = {
  bg:"#0A0A0A", surface:"#111111", surface2:"#1A1A1A",
  border:"#1E1E1E", border2:"#2A2A2A",
  text:"#F5F5F5", muted:"#555555", muted2:"#888888",
};

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]               = useState("home");
  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [categories, setCategories]   = useState(() => lsGet("ct_categories", DEFAULT_CATEGORIES));
  const [stores, setStores]           = useState(() => lsGet("ct_stores", DEFAULT_STORES));
  const [currency, setCurrency]       = useState(() => lsGet("ct_currency", "CAD"));
  const [filterMonth, setFilterMonth] = useState(nowMonth);
  const [filterYear, setFilterYear]   = useState(nowYear);
  const [toast, setToast]             = useState(null);
  const [deleteId, setDeleteId]       = useState(null);
  const [modal, setModal]             = useState(null);
  const [newCatName, setNewCatName]   = useState("");
  const [newCatIcon, setNewCatIcon]   = useState("🏷️");
  const [newCatColor, setNewCatColor] = useState("#6366F1");
  const [newStore, setNewStore]       = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    date: today, store: "", category: "groceries",
    amount: "", note: "", payer: "split",
    paymentMethod: "Credit Card", currency: "CAD", photo: null,
  });

  // Load records from Supabase on mount
  useEffect(() => {
    db.getAll()
      .then(rows => { setRecords(rows); setLoading(false); })
      .catch(() => { showToast("Could not load records", "err"); setLoading(false); });
  }, []);

  // Persist settings locally
  useEffect(() => { lsSet("ct_categories", categories); }, [categories]);
  useEffect(() => { lsSet("ct_stores",     stores);     }, [stores]);
  useEffect(() => { lsSet("ct_currency",   currency);   }, [currency]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const getCat = (id) => categories.find(c => c.id === id) || categories[categories.length - 1];

  const handlePhoto = useCallback(async (file) => {
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64  = e.target.result.split(",")[1];
      const catList = categories.map(c => c.id).join("|");
      try {
        const res  = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
                { type: "text", text: `Analyze this receipt/photo. Respond ONLY with JSON, no other text:
{
  "amount": number (total amount, 0 if not found),
  "store": "store name" (Canadian retailers: Loblaws, No Frills, Metro, Sobeys, Costco, Walmart, Tim Hortons, McDonald's, A&W, Harvey's, Swiss Chalet, The Keg, Boston Pizza, Canadian Tire, Home Depot, IKEA, Shoppers Drug Mart, Petro-Canada, Esso, Shell, Cineplex, Sport Chek, Winners, LCBO, Beer Store, Best Buy, Dollarama — or exact name from receipt),
  "category": one of [${catList}],
  "note": "brief description under 40 chars",
  "currency": "CAD|USD|EUR|GBP|HKD|TWD|JPY|AUD"
}` }
              ]
            }]
          })
        });
        const data   = await res.json();
        const text   = data.content?.map(i => i.text || "").join("") || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setForm(f => ({ ...f, amount: parsed.amount||"", store: parsed.store||"", category: parsed.category||"other", note: parsed.note||"", currency: parsed.currency||f.currency, photo: e.target.result }));
        showToast("Receipt scanned!");
      } catch {
        setForm(f => ({ ...f, photo: e.target.result }));
        showToast("Photo uploaded — fill in details", "info");
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  }, [categories]);

  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      showToast("Enter a valid amount", "err"); return;
    }
    setSyncing(true);
    const newRec = { ...form, amount: Number(form.amount) };
    try {
      const id = await db.insert(newRec);
      newRec.id = id;
      setRecords(r => [newRec, ...r]);
      setForm({ date: today, store: "", category: "groceries", amount: "", note: "", payer: "split", paymentMethod: "Credit Card", currency: "CAD", photo: null });
      setView("home");
      showToast("Expense saved");
    } catch {
      showToast("Failed to save — check connection", "err");
    }
    setSyncing(false);
  };

  const handleDelete = async (id) => {
    setSyncing(true);
    try {
      await db.remove(id);
      setRecords(r => r.filter(x => x.id !== id));
      showToast("Deleted", "info");
    } catch {
      showToast("Failed to delete", "err");
    }
    setDeleteId(null);
    setSyncing(false);
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    setCategories(c => [...c, { id, label: newCatName.trim(), icon: newCatIcon, color: newCatColor }]);
    setNewCatName(""); setNewCatIcon("🏷️"); setNewCatColor("#6366F1");
    setModal(null); showToast("Category added");
  };

  const addStore = () => {
    if (!newStore.trim()) return;
    setStores(s => [newStore.trim(), ...s]);
    setNewStore(""); setModal(null); showToast("Store added");
  };

  const filtered   = records.filter(r => { const d = new Date(r.date); return d.getMonth()+1===filterMonth && d.getFullYear()===filterYear; });
  const total      = filtered.reduce((s,r) => s+r.amount, 0);
  const yanneShare = filtered.reduce((s,r) => s+(r.payer==="yanne"?r.amount:r.payer==="split"?r.amount/2:0), 0);
  const timShare   = filtered.reduce((s,r) => s+(r.payer==="tim"?r.amount:r.payer==="split"?r.amount/2:0), 0);
  const catStats   = categories.map(cat => ({ ...cat, total: filtered.filter(r=>r.category===cat.id).reduce((s,r)=>s+r.amount,0), count: filtered.filter(r=>r.category===cat.id).length })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:0;}
    .btn{cursor:pointer;border:none;outline:none;transition:all 0.15s ease;background:transparent;}
    .btn:active{transform:scale(0.96);}
    input,select,textarea{font-family:'DM Sans',sans-serif;background:#1A1A1A;border:1.5px solid #2A2A2A;border-radius:10px;color:#F5F5F5;padding:11px 14px;width:100%;font-size:15px;outline:none;transition:border-color 0.15s;-webkit-appearance:none;}
    input:focus,select:focus,textarea:focus{border-color:#6366F1;}
    input::placeholder,textarea::placeholder{color:#444;}
    select option{background:#1A1A1A;color:#F5F5F5;}
    .card{background:#111111;border-radius:16px;border:1px solid #1E1E1E;}
    .slide-up{animation:slideUp 0.22s ease;}
    @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .toast-wrap{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;animation:toastIn 0.2s ease;white-space:nowrap;}
    @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    .nav-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;border:none;background:transparent;flex:1;transition:color 0.15s;font-family:'DM Sans',sans-serif;padding:0;}
    .scan-zone{border:1.5px dashed #2A2A2A;border-radius:14px;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:120px;cursor:pointer;transition:all 0.15s;}
    .scan-zone:hover{border-color:#6366F1;}
    .progress-bar{height:5px;background:#1E1E1E;border-radius:3px;overflow:hidden;margin-top:6px;}
    .progress-fill{height:100%;border-radius:3px;transition:width 0.6s ease;}
    .shimmer{background:linear-gradient(90deg,#111 25%,#1E1E1E 50%,#111 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite;}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:800;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .modal{background:#111;border:1px solid #222;border-radius:22px 22px 0 0;padding:24px 20px;width:100%;max-width:480px;animation:slideModal 0.25s ease;}
    @keyframes slideModal{from{transform:translateY(16px)}to{transform:translateY(0)}}
    .row{display:flex;align-items:center;padding:13px 16px;gap:12px;border-bottom:1px solid #1A1A1A;transition:background 0.1s;}
    .row:last-child{border-bottom:none;}
    .row:hover{background:#141414;}
    .seg-btn{flex:1;padding:9px 4px;border-radius:9px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:'DM Sans',sans-serif;}
    .spin{animation:spin 1s linear infinite;}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  `;

  const NAV_H = 58;

  return (
    <div style={{ minHeight:"100vh", background:S.bg, fontFamily:"'DM Sans',sans-serif", color:S.text }}>
      <style>{CSS}</style>

      {/* Syncing indicator */}
      {syncing && (
        <div style={{ position:"fixed", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#6366F1,#818CF8)", zIndex:9999, animation:"shimmer 1s linear infinite", backgroundSize:"200% 100%" }} />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-wrap">
          <div style={{ background:toast.type==="err"?"#3B0000":toast.type==="info"?"#0F172A":"#052E16", color:toast.type==="err"?"#FCA5A5":toast.type==="info"?"#93C5FD":"#6EE7B7", padding:"10px 20px", borderRadius:50, fontSize:13, fontWeight:500, border:`1px solid ${toast.type==="err"?"#7F1D1D":toast.type==="info"?"#1E3A5F":"#14532D"}` }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:6 }}>Delete expense?</div>
            <div style={{ color:S.muted2, fontSize:14, marginBottom:20 }}>This cannot be undone.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ flex:1, padding:"13px", borderRadius:11, background:S.surface2, fontSize:15, fontWeight:500, color:S.muted2 }}>Cancel</button>
              <button className="btn" onClick={() => handleDelete(deleteId)} style={{ flex:1, padding:"13px", borderRadius:11, background:"#7F1D1D", fontSize:15, fontWeight:700, color:"#FCA5A5" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {modal === "addCategory" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>New Category</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <div style={{ display:"flex", gap:10 }}>
                <input placeholder="Icon emoji" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} style={{ flex:1 }} />
                <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
                  <span style={{ color:S.muted2, fontSize:13 }}>Color:</span>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width:44, height:40, padding:"2px", borderRadius:8, cursor:"pointer", flex:"none" }} />
                </div>
              </div>
              <button className="btn" onClick={addCategory} style={{ padding:"13px", borderRadius:11, background:"#6366F1", fontSize:15, fontWeight:700, color:"#fff", marginTop:4 }}>Add Category</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Store Modal */}
      {modal === "addStore" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>New Store</div>
            <input placeholder="Store / merchant name" value={newStore} onChange={e => setNewStore(e.target.value)} style={{ marginBottom:12 }} />
            <button className="btn" onClick={addStore} style={{ width:"100%", padding:"13px", borderRadius:11, background:"#6366F1", fontSize:15, fontWeight:700, color:"#fff" }}>Add Store</button>
          </div>
        </div>
      )}

      {/* Currency Modal */}
      {modal === "currency" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Select Currency</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CURRENCIES.map(c => (
                <button key={c.code} className="btn" onClick={() => { setCurrency(c.code); setModal(null); showToast(`Currency: ${c.code}`); }}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", borderRadius:12, background:currency===c.code?"#1E1B4B":S.surface2, border:`1.5px solid ${currency===c.code?"#6366F1":"transparent"}`, color:S.text }}>
                  <span style={{ fontSize:22 }}>{c.flag}</span>
                  <span style={{ fontWeight:600 }}>{c.code}</span>
                  <span style={{ color:S.muted2, fontSize:13 }}>{c.symbol}</span>
                  {currency===c.code && <span style={{ marginLeft:"auto", color:"#818CF8" }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:S.surface, borderBottom:`1px solid ${S.border}`, padding:"52px 20px 14px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:480, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1.5 }}>YANNE & TIM</div>
            <div style={{ fontSize:20, fontWeight:700, marginTop:1 }}>
              {view==="home"&&"Overview"}{view==="add"&&"Add Expense"}
              {view==="stats"&&"Statistics"}{view==="history"&&"All Expenses"}{view==="settings"&&"Settings"}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button className="btn" onClick={() => setModal("currency")} style={{ background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:10, padding:"8px 10px", color:S.muted2, fontSize:12, fontWeight:600 }}>
              {CURRENCIES.find(c=>c.code===currency)?.flag} {currency}
            </button>
            {view==="home" && (
              <button className="btn" onClick={() => setView("add")} style={{ background:"#6366F1", color:"#fff", padding:"9px 14px", borderRadius:10, fontWeight:700, fontSize:14 }}>+ Add</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:480, margin:"0 auto", padding:`16px 14px ${NAV_H+16}px` }}>
        {loading ? (
          <div style={{ textAlign:"center", color:S.muted, paddingTop:60 }}>
            <div style={{ fontSize:28, marginBottom:12 }}>☁️</div>
            <div style={{ fontSize:14 }}>Loading records...</div>
          </div>
        ) : (
          <>
            {view==="home"     && <HomeView     filtered={filtered} total={total} yanneShare={yanneShare} timShare={timShare} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} onDelete={setDeleteId} getCat={getCat} currency={currency} S={S} />}
            {view==="add"      && <AddView      form={form} setForm={setForm} onSave={handleSave} onPhoto={handlePhoto} fileRef={fileRef} isAnalyzing={isAnalyzing} syncing={syncing} categories={categories} stores={stores} setModal={setModal} S={S} />}
            {view==="stats"    && <StatsView    catStats={catStats} total={total} yanneShare={yanneShare} timShare={timShare} filtered={filtered} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} currency={currency} S={S} />}
            {view==="history"  && <HistoryView  records={records} onDelete={setDeleteId} getCat={getCat} currency={currency} S={S} />}
            {view==="settings" && <SettingsView categories={categories} setCategories={setCategories} stores={stores} setStores={setStores} setModal={setModal} S={S} showToast={showToast} />}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:S.surface, borderTop:`1px solid ${S.border}`, height:NAV_H, display:"flex", alignItems:"center" }}>
        {[
          { id:"home",     icon:"⊞", label:"Overview" },
          { id:"add",      icon:"+", label:"Add" },
          { id:"stats",    icon:"◑", label:"Stats" },
          { id:"history",  icon:"≡", label:"History" },
          { id:"settings", icon:"⚙", label:"Settings" },
        ].map(tab => (
          <button key={tab.id} className="nav-btn btn" onClick={() => setView(tab.id)} style={{ color:view===tab.id?"#818CF8":S.muted, height:"100%" }}>
            <span style={{ fontSize:tab.id==="add"?24:18, fontWeight:700, lineHeight:1 }}>{tab.icon}</span>
            <span style={{ fontSize:10, fontWeight:view===tab.id?600:400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      <input type="file" ref={fileRef} accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => handlePhoto(e.target.files[0])} />
    </div>
  );
}

// ─── Period Picker ─────────────────────────────────────────────────────────────
function PeriodPicker({ filterMonth, filterYear, setFilterMonth, setFilterYear, S }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:11, flex:2 }}>
        <button className="btn" onClick={() => setFilterMonth(m=>m===1?12:m-1)} style={{ color:S.muted2, padding:"10px 12px", fontSize:16 }}>‹</button>
        <span style={{ flex:1, textAlign:"center", fontWeight:600, fontSize:14 }}>{MONTH_SHORT[filterMonth-1]}</span>
        <button className="btn" onClick={() => setFilterMonth(m=>m===12?1:m+1)} style={{ color:S.muted2, padding:"10px 12px", fontSize:16 }}>›</button>
      </div>
      <div style={{ display:"flex", alignItems:"center", background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:11, flex:1 }}>
        <button className="btn" onClick={() => setFilterYear(y=>y-1)} style={{ color:S.muted2, padding:"10px", fontSize:16 }}>‹</button>
        <span style={{ flex:1, textAlign:"center", fontWeight:600, fontSize:14 }}>{filterYear}</span>
        <button className="btn" onClick={() => setFilterYear(y=>y+1)} style={{ color:S.muted2, padding:"10px", fontSize:16 }}>›</button>
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────
function ExpenseRow({ record, onDelete, getCat, currency, S }) {
  const cat  = getCat(record.category);
  const user = USERS.find(u=>u.id===record.payer)||USERS[2];
  return (
    <div className="row">
      <div style={{ width:40, height:40, borderRadius:11, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{cat.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{record.store||record.note||cat.label}</div>
        <div style={{ fontSize:11, color:S.muted, marginTop:2, display:"flex", gap:5, flexWrap:"wrap" }}>
          <span>{record.date}</span>
          <span style={{ color:cat.color }}>· {cat.label}</span>
          <span style={{ color:user.color }}>· {user.label}</span>
          {record.paymentMethod && <span>· {record.paymentMethod}</span>}
        </div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontWeight:700, fontFamily:"'DM Mono',monospace", fontSize:14 }}>{fmt(record.amount, record.currency||currency)}</div>
        <button className="btn" onClick={() => onDelete(record.id)} style={{ color:"#3A3A3A", fontSize:10, marginTop:2 }}>delete</button>
      </div>
    </div>
  );
}

// ─── Home View ─────────────────────────────────────────────────────────────────
function HomeView({ filtered, total, yanneShare, timShare, filterMonth, filterYear, setFilterMonth, setFilterYear, onDelete, getCat, currency, S }) {
  const balance = yanneShare - timShare;
  const recent  = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S} />
      <div style={{ background:"#0D0D0D", border:`1px solid ${S.border2}`, borderRadius:18, padding:"20px", marginBottom:12 }}>
        <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1 }}>TOTAL · {MONTH_SHORT[filterMonth-1]} {filterYear}</div>
        <div style={{ fontSize:34, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:-1, marginTop:4, marginBottom:16 }}>{fmt(total,currency)}</div>
        {total > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:S.muted, marginBottom:6 }}>
              <span style={{ color:"#A78BFA" }}>Yanne {Math.round((yanneShare/total)*100)}%</span>
              <span style={{ color:"#34D399" }}>Tim {Math.round((timShare/total)*100)}%</span>
            </div>
            <div style={{ height:6, borderRadius:3, background:S.border2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(yanneShare/total)*100}%`, background:"linear-gradient(90deg,#A78BFA,#7C3AED)", borderRadius:3 }} />
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          {[{u:USERS[0],v:yanneShare},{u:USERS[1],v:timShare}].map(x=>(
            <div key={x.u.id} style={{ flex:1, background:x.u.color+"11", borderRadius:12, padding:"12px", border:`1px solid ${x.u.color}22` }}>
              <div style={{ fontSize:10, fontWeight:700, color:x.u.color, letterSpacing:1, marginBottom:4 }}>{x.u.label.toUpperCase()}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:16 }}>{fmt(x.v,currency)}</div>
            </div>
          ))}
        </div>
        {balance!==0&&total>0&&(
          <div style={{ marginTop:12, padding:"10px 14px", background:"#0A0A0A", border:`1px solid ${S.border2}`, borderRadius:10, fontSize:12, color:S.muted2, fontWeight:500 }}>
            {balance>0?`Tim owes Yanne ${fmt(Math.abs(balance),currency)}`:`Yanne owes Tim ${fmt(Math.abs(balance),currency)}`}
          </div>
        )}
      </div>
      <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:8 }}>RECENT</div>
      {recent.length===0
        ?<div className="card" style={{ padding:32, textAlign:"center", color:S.muted }}>No expenses this period — tap + Add to get started</div>
        :<div className="card" style={{ overflow:"hidden" }}>{recent.map(r=><ExpenseRow key={r.id} record={r} onDelete={onDelete} getCat={getCat} currency={currency} S={S}/>)}</div>
      }
    </div>
  );
}

// ─── Add View ─────────────────────────────────────────────────────────────────
function AddView({ form, setForm, onSave, onPhoto, fileRef, isAnalyzing, syncing, categories, stores, setModal, S }) {
  return (
    <div className="slide-up">
      <div className={`scan-zone${isAnalyzing?" shimmer":""}`} onClick={()=>fileRef.current?.click()} style={{ marginBottom:14, position:"relative", overflow:"hidden" }}>
        {form.photo?(
          <>
            <img src={form.photo} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.2 }}/>
            <div style={{ position:"relative", zIndex:1, textAlign:"center" }}>
              <div style={{ fontSize:24 }}>{isAnalyzing?"🔍":"✓"}</div>
              <div style={{ fontSize:13, color:"#888", fontWeight:500 }}>{isAnalyzing?"Scanning...":"Scanned · tap to change"}</div>
            </div>
          </>
        ):(
          <>
            <div style={{ fontSize:26 }}>📷</div>
            <div style={{ fontWeight:600, fontSize:14, color:"#555" }}>Scan Receipt</div>
            <div style={{ fontSize:12, color:"#444" }}>AI detects amount, store & category</div>
          </>
        )}
      </div>
      <div className="card" style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>AMOUNT</label>
          <div style={{ display:"flex", gap:8 }}>
            <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width:"auto", flexShrink:0 }}>
              {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, flex:1 }}/>
          </div>
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1 }}>STORE</label>
            <button className="btn" onClick={()=>setModal("addStore")} style={{ fontSize:11, color:"#818CF8" }}>+ New store</button>
          </div>
          <select value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}>
            <option value="">Select store...</option>
            {stores.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1 }}>CATEGORY</label>
            <button className="btn" onClick={()=>setModal("addCategory")} style={{ fontSize:11, color:"#818CF8" }}>+ New category</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
            {categories.map(cat=>(
              <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))} className="btn"
                style={{ padding:"8px 4px", borderRadius:10, background:form.category===cat.id?cat.color+"22":S.surface2, border:`1.5px solid ${form.category===cat.id?cat.color:"transparent"}`, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <span style={{ fontSize:18 }}>{cat.icon}</span>
                <span style={{ fontSize:9, fontWeight:500, color:form.category===cat.id?cat.color:S.muted, textAlign:"center", lineHeight:1.2 }}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>NOTE</label>
          <input placeholder="Optional" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>DATE</label>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:8, letterSpacing:1 }}>PAID BY</label>
          <div style={{ display:"flex", gap:6, background:S.surface2, padding:4, borderRadius:12 }}>
            {USERS.map(u=>(
              <button key={u.id} onClick={()=>setForm(f=>({...f,payer:u.id}))} className="seg-btn"
                style={{ background:form.payer===u.id?u.color+"22":"transparent", border:`1.5px solid ${form.payer===u.id?u.color:"transparent"}`, color:form.payer===u.id?u.color:S.muted2 }}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>PAYMENT METHOD</label>
          <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
            {PAYMENT_METHODS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <button onClick={onSave} disabled={syncing} className="btn" style={{ width:"100%", marginTop:14, padding:"15px", background:syncing?"#3730A3":"#6366F1", borderRadius:13, fontSize:15, fontWeight:700, color:"#fff", opacity:syncing?0.7:1 }}>
        {syncing ? "Saving..." : "Save Expense"}
      </button>
    </div>
  );
}

// ─── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ catStats, total, yanneShare, timShare, filtered, filterMonth, filterYear, setFilterMonth, setFilterYear, currency, S }) {
  const maxCat    = catStats[0]?.total||1;
  const balance   = yanneShare-timShare;
  const storeMap  = {}; filtered.forEach(r=>{ const s=r.store||"—"; storeMap[s]=(storeMap[s]||0)+r.amount; });
  const topStores = Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const pmMap     = {}; filtered.forEach(r=>{ pmMap[r.paymentMethod||"Other"]=(pmMap[r.paymentMethod||"Other"]||0)+r.amount; });
  const pmList    = Object.entries(pmMap).sort((a,b)=>b[1]-a[1]);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S}/>
      <div className="card" style={{ padding:18, marginBottom:12 }}>
        <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:4 }}>TOTAL SPENT</div>
        <div style={{ fontSize:30, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:-1, marginBottom:14 }}>{fmt(total,currency)}</div>
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          {[{u:USERS[0],v:yanneShare},{u:USERS[1],v:timShare}].map(x=>(
            <div key={x.u.id} style={{ flex:1, background:x.u.color+"11", border:`1px solid ${x.u.color}22`, borderRadius:12, padding:"12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:x.u.color, letterSpacing:1 }}>{x.u.label.toUpperCase()}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:16, marginTop:4 }}>{fmt(x.v,currency)}</div>
              <div style={{ fontSize:11, color:S.muted, marginTop:2 }}>{total>0?Math.round((x.v/total)*100):0}% of total</div>
            </div>
          ))}
        </div>
        {balance!==0&&total>0&&(
          <div style={{ padding:"10px 14px", background:S.surface2, borderRadius:10, fontSize:12, color:S.muted2 }}>
            {balance>0?`Tim owes Yanne ${fmt(Math.abs(balance),currency)}`:`Yanne owes Tim ${fmt(Math.abs(balance),currency)}`}
          </div>
        )}
      </div>
      {catStats.length===0
        ?<div className="card" style={{ padding:32, textAlign:"center", color:S.muted }}>No expenses this period</div>
        :<div className="card" style={{ overflow:"hidden", marginBottom:12 }}>
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>BY CATEGORY</div>
          {catStats.map(cat=>(
            <div key={cat.id} style={{ padding:"12px 16px", borderTop:`1px solid ${S.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>{cat.icon}</span>
                  <span style={{ fontWeight:500, fontSize:14 }}>{cat.label}</span>
                  <span style={{ fontSize:11, color:S.muted, background:S.surface2, padding:"2px 7px", borderRadius:6 }}>{cat.count}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:cat.color }}>{total>0?Math.round((cat.total/total)*100):0}%</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:14 }}>{fmt(cat.total,currency)}</span>
                </div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${(cat.total/maxCat)*100}%`, background:cat.color }}/></div>
            </div>
          ))}
        </div>
      }
      {topStores.length>0&&(
        <div className="card" style={{ overflow:"hidden", marginBottom:12 }}>
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>TOP STORES</div>
          {topStores.map(([store,amount],i)=>(
            <div key={store} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderTop:`1px solid ${S.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ color:S.muted, fontSize:11, fontFamily:"'DM Mono',monospace", width:16 }}>{i+1}</span>
                <span style={{ fontSize:14, fontWeight:500 }}>{store}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:S.muted }}>{total>0?Math.round((amount/total)*100):0}%</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700 }}>{fmt(amount,currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {pmList.length>0&&(
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>BY PAYMENT METHOD</div>
          {pmList.map(([method,amount])=>(
            <div key={method} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 16px", borderTop:`1px solid ${S.border}` }}>
              <span style={{ fontSize:14, fontWeight:500 }}>{method}</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:S.muted }}>{total>0?Math.round((amount/total)*100):0}%</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700 }}>{fmt(amount,currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────
function HistoryView({ records, onDelete, getCat, currency, S }) {
  const sorted  = [...records].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const grouped = sorted.reduce((acc,r)=>{ const k=r.date.slice(0,7); if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; },{});
  return (
    <div className="slide-up">
      {Object.keys(grouped).length===0&&(
        <div className="card" style={{ padding:32, textAlign:"center", color:S.muted }}>No expenses yet</div>
      )}
      {Object.entries(grouped).map(([month,recs])=>{
        const [y,m]=month.split("-");
        const total=recs.reduce((s,r)=>s+r.amount,0);
        return (
          <div key={month} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>{MONTH_SHORT[parseInt(m)-1].toUpperCase()} {y}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700, color:S.muted2 }}>{fmt(total,currency)}</span>
            </div>
            <div className="card" style={{ overflow:"hidden" }}>
              {recs.map(r=><ExpenseRow key={r.id} record={r} onDelete={onDelete} getCat={getCat} currency={currency} S={S}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────
function SettingsView({ categories, setCategories, stores, setStores, setModal, S, showToast }) {
  const removeCategory = (id) => {
    if (categories.length<=1){ showToast("Need at least 1 category","err"); return; }
    setCategories(c=>c.filter(x=>x.id!==id));
  };
  const removeStore = (name) => setStores(s=>s.filter(x=>x!==name));
  return (
    <div className="slide-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>CATEGORIES</div>
        <button className="btn" onClick={()=>setModal("addCategory")} style={{ fontSize:12, color:"#818CF8", fontWeight:600 }}>+ Add</button>
      </div>
      <div className="card" style={{ overflow:"hidden", marginBottom:16 }}>
        {categories.map((cat,i)=>(
          <div key={cat.id} style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12, borderBottom:i<categories.length-1?`1px solid ${S.border}`:"none" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cat.icon}</div>
            <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{cat.label}</span>
            <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color }}/>
            <button className="btn" onClick={()=>removeCategory(cat.id)} style={{ color:"#3A3A3A", fontSize:11, padding:"4px 8px" }}>remove</button>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>STORES</div>
        <button className="btn" onClick={()=>setModal("addStore")} style={{ fontSize:12, color:"#818CF8", fontWeight:600 }}>+ Add</button>
      </div>
      <div className="card" style={{ overflow:"hidden" }}>
        {stores.map((store,i)=>(
          <div key={store} style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12, borderBottom:i<stores.length-1?`1px solid ${S.border}`:"none" }}>
            <span style={{ flex:1, fontSize:14 }}>{store}</span>
            <button className="btn" onClick={()=>removeStore(store)} style={{ color:"#3A3A3A", fontSize:11 }}>remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
