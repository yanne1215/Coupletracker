import { useState, useRef, useCallback } from "react";

// ─── i18n ────────────────────────────────────────────────────────────────────
const T = {
  en: {
    appSubtitle: "YANNE & TIM",
    overview: "Overview", addExpense: "Add Expense", statistics: "Statistics",
    allExpenses: "All Expenses", settings: "Settings",
    navOverview: "Overview", navAdd: "Add", navStats: "Stats",
    navHistory: "History", navSettings: "Settings",
    totalSpent: "TOTAL SPENT", total: "TOTAL",
    ofTotal: "% of total",
    timOwesYanne: (a) => `Tim owes Yanne ${a}`,
    yanneOwesTim: (a) => `Yanne owes Tim ${a}`,
    recent: "RECENT", noExpenses: "No expenses this period",
    scanReceipt: "Scan Receipt", aiDetects: "AI detects amount, store & category",
    scanning: "Scanning...", scanned: "Scanned · tap to change",
    amount: "AMOUNT", store: "STORE / MERCHANT", selectStore: "Select store...",
    category: "CATEGORY", note: "NOTE", noteOptional: "Optional",
    date: "DATE", paidBy: "PAID BY", paymentMethod: "PAYMENT METHOD",
    saveExpense: "Save Expense", newStore: "+ New store", newCategory: "+ New category",
    splitLabel: "Split 50/50",
    byCategory: "BY CATEGORY", topStores: "TOP STORES", byPayment: "BY PAYMENT METHOD",
    categories: "CATEGORIES", stores: "STORES",
    addCategoryTitle: "New Category", categoryName: "Category name",
    iconEmoji: "Icon emoji", color: "Color:", addCategoryBtn: "Add Category",
    newStoreTitle: "New Store", storeName: "Store / merchant name", addStoreBtn: "Add Store",
    selectCurrency: "Select Currency",
    deleteTitle: "Delete expense?", deleteMsg: "This cannot be undone.",
    cancel: "Cancel", delete: "Delete", remove: "remove",
    needOneCategory: "Need at least 1 category",
    invalidAmount: "Enter a valid amount",
    receiptScanned: "Receipt scanned!",
    photoUploaded: "Photo uploaded — fill in details",
    expenseSaved: "Expense saved",
    deleted: "Deleted",
    categoryAdded: "Category added",
    storeAdded: "Store added",
    currencyLabel: "Currency",
    language: "Language",
    monthShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    paymentMethods: ["Credit Card","Debit Card","Cash","E-Transfer","PayPal","Apple Pay","Google Pay","Other"],
    defaultCategories: [
      { id: "groceries", label: "Groceries", icon: "🛒", color: "#10B981" },
      { id: "dining", label: "Dining", icon: "🍽️", color: "#F59E0B" },
      { id: "transport", label: "Transport", icon: "🚗", color: "#3B82F6" },
      { id: "shopping", label: "Shopping", icon: "🛍️", color: "#8B5CF6" },
      { id: "entertainment", label: "Entertainment", icon: "🎬", color: "#EF4444" },
      { id: "travel", label: "Travel", icon: "✈️", color: "#06B6D4" },
      { id: "health", label: "Health", icon: "💊", color: "#EC4899" },
      { id: "utilities", label: "Utilities", icon: "⚡", color: "#F97316" },
      { id: "home", label: "Home", icon: "🏠", color: "#6B7280" },
      { id: "other", label: "Other", icon: "📦", color: "#64748B" },
    ],
  },
  zh: {
    appSubtitle: "Yanne & Tim 的帳本",
    overview: "總覽", addExpense: "新增支出", statistics: "統計分析",
    allExpenses: "所有支出", settings: "設定",
    navOverview: "總覽", navAdd: "新增", navStats: "統計",
    navHistory: "明細", navSettings: "設定",
    totalSpent: "本期總支出", total: "總計",
    ofTotal: "% 佔比",
    timOwesYanne: (a) => `Tim 欠 Yanne ${a}`,
    yanneOwesTim: (a) => `Yanne 欠 Tim ${a}`,
    recent: "最近記錄", noExpenses: "本期暫無支出",
    scanReceipt: "掃描收據", aiDetects: "AI 自動辨識金額、商店與分類",
    scanning: "辨識中...", scanned: "已掃描 · 點擊重新拍攝",
    amount: "金額", store: "商店 / 付款對象", selectStore: "選擇商店...",
    category: "分類", note: "備註", noteOptional: "選填",
    date: "日期", paidBy: "付款人", paymentMethod: "付款方式",
    saveExpense: "儲存記錄", newStore: "+ 新增商店", newCategory: "+ 新增分類",
    splitLabel: "各付一半",
    byCategory: "各分類支出", topStores: "消費最多商店", byPayment: "付款方式分析",
    categories: "分類管理", stores: "商店管理",
    addCategoryTitle: "新增分類", categoryName: "分類名稱",
    iconEmoji: "圖示 emoji", color: "顏色：", addCategoryBtn: "新增分類",
    newStoreTitle: "新增商店", storeName: "商店 / 商家名稱", addStoreBtn: "新增商店",
    selectCurrency: "選擇幣別",
    deleteTitle: "刪除這筆支出？", deleteMsg: "此操作無法復原。",
    cancel: "取消", delete: "刪除", remove: "移除",
    needOneCategory: "至少保留一個分類",
    invalidAmount: "請輸入有效金額",
    receiptScanned: "收據辨識完成！",
    photoUploaded: "照片已上傳，請填寫資料",
    expenseSaved: "記錄已儲存",
    deleted: "已刪除",
    categoryAdded: "分類已新增",
    storeAdded: "商店已新增",
    currencyLabel: "幣別",
    language: "語言",
    monthShort: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
    paymentMethods: ["信用卡","金融卡","現金","電子轉帳","PayPal","Apple Pay","Google Pay","其他"],
    defaultCategories: [
      { id: "groceries", label: "生活雜貨", icon: "🛒", color: "#10B981" },
      { id: "dining", label: "餐飲", icon: "🍽️", color: "#F59E0B" },
      { id: "transport", label: "交通", icon: "🚗", color: "#3B82F6" },
      { id: "shopping", label: "購物", icon: "🛍️", color: "#8B5CF6" },
      { id: "entertainment", label: "娛樂", icon: "🎬", color: "#EF4444" },
      { id: "travel", label: "旅遊", icon: "✈️", color: "#06B6D4" },
      { id: "health", label: "醫療", icon: "💊", color: "#EC4899" },
      { id: "utilities", label: "水電費", icon: "⚡", color: "#F97316" },
      { id: "home", label: "居家", icon: "🏠", color: "#6B7280" },
      { id: "other", label: "其他", icon: "📦", color: "#64748B" },
    ],
  },
};

const USERS = [
  { id: "yanne", label: "Yanne", color: "#A78BFA" },
  { id: "tim",   label: "Tim",   color: "#34D399" },
  { id: "split", label: "split", color: "#94A3B8" },
];

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

const DEFAULT_STORES = [
  "Loblaws","No Frills","Metro","Sobeys","Costco","Walmart",
  "Tim Hortons","McDonald's","A&W","Harvey's","Swiss Chalet","The Keg",
  "Canadian Tire","Home Depot","IKEA","Shoppers Drug Mart",
  "Petro-Canada","Esso","Shell","Cineplex","Sport Chek","Winners",
  "LCBO","Beer Store","Best Buy","Dollarama",
];

const INITIAL_RECORDS = [
  { id:1, date:"2026-04-18", store:"Loblaws",           category:"groceries",    amount:87.43,  note:"Weekly groceries", payer:"yanne", paymentMethod:"Credit Card", currency:"CAD", photo:null },
  { id:2, date:"2026-04-16", store:"Tim Hortons",        category:"dining",       amount:14.25,  note:"Coffee & bagels",  payer:"split", paymentMethod:"Apple Pay",   currency:"CAD", photo:null },
  { id:3, date:"2026-04-14", store:"Shoppers Drug Mart", category:"health",       amount:32.10,  note:"Cold medicine",    payer:"tim",   paymentMethod:"Debit Card",   currency:"CAD", photo:null },
  { id:4, date:"2026-04-12", store:"Canadian Tire",      category:"home",         amount:56.80,  note:"Tools",            payer:"yanne", paymentMethod:"Credit Card", currency:"CAD", photo:null },
  { id:5, date:"2026-04-10", store:"Cineplex",           category:"entertainment",amount:38.00,  note:"Movie night",      payer:"split", paymentMethod:"Credit Card", currency:"CAD", photo:null },
  { id:6, date:"2026-03-28", store:"IKEA",               category:"home",         amount:210.50, note:"Shelving",         payer:"split", paymentMethod:"Credit Card", currency:"CAD", photo:null },
  { id:7, date:"2026-03-15", store:"Sport Chek",         category:"shopping",     amount:129.99, note:"Running shoes",    payer:"tim",   paymentMethod:"Debit Card",   currency:"CAD", photo:null },
];

function fmt(n, code = "CAD") {
  const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
  const dec = code === "JPY" ? 0 : 2;
  return `${cur.symbol}${Number(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const S = {
  bg:"#0A0A0A", surface:"#111111", surface2:"#1A1A1A",
  border:"#222222", border2:"#2A2A2A",
  text:"#F5F5F5", muted:"#666666", muted2:"#888888",
};

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState("en");
  const t = T[lang];

  const [view, setView]               = useState("home");
  const [records, setRecords]         = useState(INITIAL_RECORDS);
  const [categories, setCategories]   = useState(T.en.defaultCategories);
  const [stores, setStores]           = useState(DEFAULT_STORES);
  const [currency, setCurrency]       = useState("CAD");
  const [filterMonth, setFilterMonth] = useState(4);
  const [filterYear, setFilterYear]   = useState(2026);
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
    date:"2026-04-21", store:"", category:"groceries",
    amount:"", note:"", payer:"split",
    paymentMethod:"Credit Card", currency:"CAD", photo:null,
  });

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const getCat = (id) => categories.find(c => c.id === id) || categories[categories.length - 1];

  const switchLang = (l) => {
    setLang(l);
    setCategories(prev => prev.map(cat => {
      const match = T[l].defaultCategories.find(d => d.id === cat.id);
      return match ? { ...cat, label: match.label } : cat;
    }));
    setModal(null);
  };

  const handlePhoto = useCallback(async (file) => {
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      const catList = categories.map(c => c.id).join("|");
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  "store": "store name" (identify Canadian retailers: Loblaws, No Frills, Metro, Sobeys, Costco, Walmart, Tim Hortons, McDonald's, A&W, Harvey's, Swiss Chalet, The Keg, Boston Pizza, Canadian Tire, Home Depot, IKEA, Shoppers Drug Mart, Petro-Canada, Esso, Shell, Cineplex, Sport Chek, Winners, LCBO, Beer Store, Best Buy, Dollarama, or exact name from receipt),
  "category": one of [${catList}],
  "note": "brief description under 40 chars",
  "currency": "CAD|USD|EUR|GBP|HKD|TWD|JPY|AUD"
}` }
              ]
            }]
          })
        });
        const data = await res.json();
        const text = data.content?.map(i => i.text || "").join("") || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setForm(f => ({ ...f, amount: parsed.amount||"", store: parsed.store||"", category: parsed.category||"other", note: parsed.note||"", currency: parsed.currency||f.currency, photo: e.target.result }));
        showToast(t.receiptScanned);
      } catch {
        setForm(f => ({ ...f, photo: e.target.result }));
        showToast(t.photoUploaded, "info");
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  }, [categories, t]);

  const handleSave = () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      showToast(t.invalidAmount, "err"); return;
    }
    setRecords(r => [{ ...form, id: Date.now(), amount: Number(form.amount) }, ...r]);
    setForm({ date:"2026-04-21", store:"", category:"groceries", amount:"", note:"", payer:"split", paymentMethod:"Credit Card", currency:"CAD", photo:null });
    setView("home");
    showToast(t.expenseSaved);
  };

  const handleDelete = (id) => {
    setRecords(r => r.filter(x => x.id !== id));
    setDeleteId(null);
    showToast(t.deleted, "info");
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.toLowerCase().replace(/\s+/g,"_") + "_" + Date.now();
    setCategories(c => [...c, { id, label: newCatName.trim(), icon: newCatIcon, color: newCatColor }]);
    setNewCatName(""); setNewCatIcon("🏷️"); setNewCatColor("#6366F1");
    setModal(null); showToast(t.categoryAdded);
  };

  const addStore = () => {
    if (!newStore.trim()) return;
    setStores(s => [newStore.trim(), ...s]);
    setNewStore(""); setModal(null); showToast(t.storeAdded);
  };

  const filtered    = records.filter(r => { const d = new Date(r.date); return d.getMonth()+1===filterMonth && d.getFullYear()===filterYear; });
  const total       = filtered.reduce((s,r) => s+r.amount, 0);
  const yanneShare  = filtered.reduce((s,r) => s+(r.payer==="yanne"?r.amount:r.payer==="split"?r.amount/2:0), 0);
  const timShare    = filtered.reduce((s,r) => s+(r.payer==="tim"?r.amount:r.payer==="split"?r.amount/2:0), 0);
  const catStats    = categories.map(cat => ({ ...cat, total: filtered.filter(r=>r.category===cat.id).reduce((s,r)=>s+r.amount,0), count: filtered.filter(r=>r.category===cat.id).length })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const getUserLabel = (id) => id==="split" ? t.splitLabel : (USERS.find(u=>u.id===id)?.label||id);

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
    .nav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;border:none;background:transparent;padding:8px 0;flex:1;transition:color 0.15s;font-family:'DM Sans',sans-serif;}
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
  `;

  return (
    <div style={{ minHeight:"100vh", background:S.bg, fontFamily:"'DM Sans',sans-serif", color:S.text }}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div className="toast-wrap">
          <div style={{ background:toast.type==="err"?"#3B0000":toast.type==="info"?"#0F172A":"#052E16", color:toast.type==="err"?"#FCA5A5":toast.type==="info"?"#93C5FD":"#6EE7B7", padding:"10px 20px", borderRadius:50, fontSize:13, fontWeight:500, border:`1px solid ${toast.type==="err"?"#7F1D1D":toast.type==="info"?"#1E3A5F":"#14532D"}` }}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {deleteId && (
        <div className="overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:6 }}>{t.deleteTitle}</div>
            <div style={{ color:S.muted2, fontSize:14, marginBottom:20 }}>{t.deleteMsg}</div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn" onClick={() => setDeleteId(null)} style={{ flex:1, padding:"13px", borderRadius:11, background:S.surface2, fontSize:15, fontWeight:500, color:S.muted2 }}>{t.cancel}</button>
              <button className="btn" onClick={() => handleDelete(deleteId)} style={{ flex:1, padding:"13px", borderRadius:11, background:"#7F1D1D", fontSize:15, fontWeight:700, color:"#FCA5A5" }}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "addCategory" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>{t.addCategoryTitle}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input placeholder={t.categoryName} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <div style={{ display:"flex", gap:10 }}>
                <input placeholder={t.iconEmoji} value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} style={{ flex:1 }} />
                <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
                  <span style={{ color:S.muted2, fontSize:13 }}>{t.color}</span>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ width:44, height:40, padding:"2px", borderRadius:8, cursor:"pointer", flex:"none" }} />
                </div>
              </div>
              <button className="btn" onClick={addCategory} style={{ padding:"13px", borderRadius:11, background:"#6366F1", fontSize:15, fontWeight:700, color:"#fff", marginTop:4 }}>{t.addCategoryBtn}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "addStore" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>{t.newStoreTitle}</div>
            <input placeholder={t.storeName} value={newStore} onChange={e => setNewStore(e.target.value)} style={{ marginBottom:12 }} />
            <button className="btn" onClick={addStore} style={{ width:"100%", padding:"13px", borderRadius:11, background:"#6366F1", fontSize:15, fontWeight:700, color:"#fff" }}>{t.addStoreBtn}</button>
          </div>
        </div>
      )}

      {modal === "currency" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>{t.selectCurrency}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CURRENCIES.map(c => (
                <button key={c.code} className="btn" onClick={() => { setCurrency(c.code); setModal(null); showToast(`${t.currencyLabel}: ${c.code}`); }}
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

      {modal === "language" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>{t.language}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[{ code:"en", label:"🇨🇦  English" },{ code:"zh", label:"🇹🇼  繁體中文" }].map(l => (
                <button key={l.code} className="btn" onClick={() => switchLang(l.code)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px", borderRadius:12, background:lang===l.code?"#1E1B4B":S.surface2, border:`1.5px solid ${lang===l.code?"#6366F1":"transparent"}`, color:S.text, fontSize:16, fontWeight:600 }}>
                  <span>{l.label}</span>
                  {lang===l.code && <span style={{ color:"#818CF8" }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background:S.surface, borderBottom:`1px solid ${S.border}`, padding:"52px 20px 14px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:480, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1.5 }}>{t.appSubtitle}</div>
            <div style={{ fontSize:20, fontWeight:700, marginTop:1 }}>
              {view==="home"&&t.overview}{view==="add"&&t.addExpense}
              {view==="stats"&&t.statistics}{view==="history"&&t.allExpenses}{view==="settings"&&t.settings}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button className="btn" onClick={() => setModal("language")} style={{ background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:10, padding:"8px 10px", color:S.muted2, fontSize:12, fontWeight:600 }}>
              {lang==="en" ? "EN" : "中文"}
            </button>
            <button className="btn" onClick={() => setModal("currency")} style={{ background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:10, padding:"8px 10px", color:S.muted2, fontSize:12, fontWeight:600 }}>
              {CURRENCIES.find(c=>c.code===currency)?.flag} {currency}
            </button>
            {view==="home" && (
              <button className="btn" onClick={() => setView("add")} style={{ background:"#6366F1", color:"#fff", padding:"9px 12px", borderRadius:10, fontWeight:700, fontSize:15 }}>+</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 14px 100px" }}>
        {view==="home"     && <HomeView     t={t} filtered={filtered} total={total} yanneShare={yanneShare} timShare={timShare} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} onDelete={setDeleteId} getCat={getCat} getUserLabel={getUserLabel} currency={currency} S={S} />}
        {view==="add"      && <AddView      t={t} form={form} setForm={setForm} onSave={handleSave} onPhoto={handlePhoto} fileRef={fileRef} isAnalyzing={isAnalyzing} categories={categories} stores={stores} setModal={setModal} S={S} />}
        {view==="stats"    && <StatsView    t={t} catStats={catStats} total={total} yanneShare={yanneShare} timShare={timShare} filtered={filtered} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} currency={currency} S={S} />}
        {view==="history"  && <HistoryView  t={t} records={records} onDelete={setDeleteId} getCat={getCat} getUserLabel={getUserLabel} currency={currency} S={S} />}
        {view==="settings" && <SettingsView t={t} categories={categories} setCategories={setCategories} stores={stores} setStores={setStores} setModal={setModal} S={S} showToast={showToast} />}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:S.surface, borderTop:`1px solid ${S.border}`, display:"flex", paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
        {[
          { id:"home",     icon:"◻", label:t.navOverview },
          { id:"add",      icon:"+", label:t.navAdd },
          { id:"stats",    icon:"◑", label:t.navStats },
          { id:"history",  icon:"≡", label:t.navHistory },
          { id:"settings", icon:"⚙", label:t.navSettings },
        ].map(tab => (
          <button key={tab.id} className="nav-btn" onClick={() => setView(tab.id)} style={{ color:view===tab.id?"#818CF8":S.muted }}>
            <span style={{ fontSize:tab.id==="add"?22:17, fontWeight:700, lineHeight:1 }}>{tab.icon}</span>
            <span style={{ fontSize:10, fontWeight:view===tab.id?600:400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      <input type="file" ref={fileRef} accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => handlePhoto(e.target.files[0])} />
    </div>
  );
}

// ─── Period Picker ────────────────────────────────────────────────────────────
function PeriodPicker({ t, filterMonth, filterYear, setFilterMonth, setFilterYear, S }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:11, padding:"0 4px", flex:2 }}>
        <button className="btn" onClick={() => setFilterMonth(m=>m===1?12:m-1)} style={{ color:S.muted2, padding:"10px", fontSize:16 }}>‹</button>
        <span style={{ flex:1, textAlign:"center", fontWeight:600, fontSize:14 }}>{t.monthShort[filterMonth-1]}</span>
        <button className="btn" onClick={() => setFilterMonth(m=>m===12?1:m+1)} style={{ color:S.muted2, padding:"10px", fontSize:16 }}>›</button>
      </div>
      <div style={{ display:"flex", alignItems:"center", background:S.surface2, border:`1px solid ${S.border2}`, borderRadius:11, padding:"0 4px", flex:1 }}>
        <button className="btn" onClick={() => setFilterYear(y=>y-1)} style={{ color:S.muted2, padding:"10px 8px", fontSize:16 }}>‹</button>
        <span style={{ flex:1, textAlign:"center", fontWeight:600, fontSize:14 }}>{filterYear}</span>
        <button className="btn" onClick={() => setFilterYear(y=>y+1)} style={{ color:S.muted2, padding:"10px 8px", fontSize:16 }}>›</button>
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────
function ExpenseRow({ t, record, onDelete, getCat, getUserLabel, currency, S }) {
  const cat  = getCat(record.category);
  const user = USERS.find(u => u.id === record.payer) || USERS[2];
  return (
    <div className="row">
      <div style={{ width:40, height:40, borderRadius:11, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{cat.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{record.store||record.note||cat.label}</div>
        <div style={{ fontSize:11, color:S.muted, marginTop:2, display:"flex", gap:5, flexWrap:"wrap" }}>
          <span>{record.date}</span>
          <span style={{ color:cat.color }}>· {cat.label}</span>
          <span style={{ color:user.color }}>· {getUserLabel(record.payer)}</span>
          {record.paymentMethod && <span>· {record.paymentMethod}</span>}
        </div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontWeight:700, fontFamily:"'DM Mono',monospace", fontSize:14 }}>{fmt(record.amount, record.currency||currency)}</div>
        <button className="btn" onClick={() => onDelete(record.id)} style={{ color:"#444", fontSize:10, marginTop:2 }}>{t.delete}</button>
      </div>
    </div>
  );
}

// ─── Home View ────────────────────────────────────────────────────────────────
function HomeView({ t, filtered, total, yanneShare, timShare, filterMonth, filterYear, setFilterMonth, setFilterYear, onDelete, getCat, getUserLabel, currency, S }) {
  const balance = yanneShare - timShare;
  const recent  = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  return (
    <div className="slide-up">
      <PeriodPicker t={t} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S} />
      <div style={{ background:"#0D0D0D", border:`1px solid ${S.border2}`, borderRadius:18, padding:"20px", marginBottom:12 }}>
        <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1 }}>{t.total} · {t.monthShort[filterMonth-1]} {filterYear}</div>
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
        {balance!==0 && total>0 && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"#0A0A0A", border:`1px solid ${S.border2}`, borderRadius:10, fontSize:12, color:S.muted2, fontWeight:500 }}>
            {balance>0 ? t.timOwesYanne(fmt(Math.abs(balance),currency)) : t.yanneOwesTim(fmt(Math.abs(balance),currency))}
          </div>
        )}
      </div>
      <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:8 }}>{t.recent}</div>
      {recent.length===0
        ? <div className="card" style={{ padding:30, textAlign:"center", color:S.muted }}>{t.noExpenses}</div>
        : <div className="card" style={{ overflow:"hidden" }}>{recent.map(r=><ExpenseRow key={r.id} t={t} record={r} onDelete={onDelete} getCat={getCat} getUserLabel={getUserLabel} currency={currency} S={S}/>)}</div>
      }
    </div>
  );
}

// ─── Add View ─────────────────────────────────────────────────────────────────
function AddView({ t, form, setForm, onSave, onPhoto, fileRef, isAnalyzing, categories, stores, setModal, S }) {
  return (
    <div className="slide-up">
      <div className={`scan-zone${isAnalyzing?" shimmer":""}`} onClick={()=>fileRef.current?.click()} style={{ marginBottom:14, position:"relative", overflow:"hidden" }}>
        {form.photo ? (
          <>
            <img src={form.photo} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.2 }} />
            <div style={{ position:"relative", zIndex:1, textAlign:"center" }}>
              <div style={{ fontSize:24 }}>{isAnalyzing?"🔍":"✓"}</div>
              <div style={{ fontSize:13, color:"#888", fontWeight:500 }}>{isAnalyzing?t.scanning:t.scanned}</div>
            </div>
          </>
        ):(
          <>
            <div style={{ fontSize:26 }}>📷</div>
            <div style={{ fontWeight:600, fontSize:14, color:"#555" }}>{t.scanReceipt}</div>
            <div style={{ fontSize:12, color:"#444" }}>{t.aiDetects}</div>
          </>
        )}
      </div>

      <div className="card" style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>{t.amount}</label>
          <div style={{ display:"flex", gap:8 }}>
            <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{ width:"auto", flexShrink:0 }}>
              {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, flex:1 }} />
          </div>
        </div>

        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1 }}>{t.store}</label>
            <button className="btn" onClick={()=>setModal("addStore")} style={{ fontSize:11, color:"#818CF8" }}>{t.newStore}</button>
          </div>
          <select value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}>
            <option value="">{t.selectStore}</option>
            {stores.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:600, color:S.muted, letterSpacing:1 }}>{t.category}</label>
            <button className="btn" onClick={()=>setModal("addCategory")} style={{ fontSize:11, color:"#818CF8" }}>{t.newCategory}</button>
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
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>{t.note}</label>
          <input placeholder={t.noteOptional} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} />
        </div>

        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>{t.date}</label>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
        </div>

        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:8, letterSpacing:1 }}>{t.paidBy}</label>
          <div style={{ display:"flex", gap:6, background:S.surface2, padding:4, borderRadius:12 }}>
            {USERS.map(u=>(
              <button key={u.id} onClick={()=>setForm(f=>({...f,payer:u.id}))} className="seg-btn"
                style={{ background:form.payer===u.id?u.color+"22":"transparent", border:`1.5px solid ${form.payer===u.id?u.color:"transparent"}`, color:form.payer===u.id?u.color:S.muted2 }}>
                {u.id==="split"?t.splitLabel:u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize:11, fontWeight:600, color:S.muted, display:"block", marginBottom:5, letterSpacing:1 }}>{t.paymentMethod}</label>
          <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
            {t.paymentMethods.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <button onClick={onSave} className="btn" style={{ width:"100%", marginTop:14, padding:"15px", background:"#6366F1", borderRadius:13, fontSize:15, fontWeight:700, color:"#fff" }}>
        {t.saveExpense}
      </button>
    </div>
  );
}

// ─── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ t, catStats, total, yanneShare, timShare, filtered, filterMonth, filterYear, setFilterMonth, setFilterYear, currency, S }) {
  const maxCat    = catStats[0]?.total||1;
  const balance   = yanneShare-timShare;
  const storeMap  = {}; filtered.forEach(r=>{ const s=r.store||"—"; storeMap[s]=(storeMap[s]||0)+r.amount; });
  const topStores = Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const pmMap     = {}; filtered.forEach(r=>{ pmMap[r.paymentMethod||"Other"]=(pmMap[r.paymentMethod||"Other"]||0)+r.amount; });
  const pmList    = Object.entries(pmMap).sort((a,b)=>b[1]-a[1]);

  return (
    <div className="slide-up">
      <PeriodPicker t={t} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S} />

      <div className="card" style={{ padding:18, marginBottom:12 }}>
        <div style={{ color:S.muted, fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:4 }}>{t.totalSpent}</div>
        <div style={{ fontSize:30, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:-1, marginBottom:14 }}>{fmt(total,currency)}</div>
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          {[{u:USERS[0],v:yanneShare},{u:USERS[1],v:timShare}].map(x=>(
            <div key={x.u.id} style={{ flex:1, background:x.u.color+"11", border:`1px solid ${x.u.color}22`, borderRadius:12, padding:"12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:x.u.color, letterSpacing:1 }}>{x.u.label.toUpperCase()}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:16, marginTop:4 }}>{fmt(x.v,currency)}</div>
              <div style={{ fontSize:11, color:S.muted, marginTop:2 }}>{total>0?Math.round((x.v/total)*100):0}{t.ofTotal}</div>
            </div>
          ))}
        </div>
        {balance!==0&&total>0&&(
          <div style={{ padding:"10px 14px", background:S.surface2, borderRadius:10, fontSize:12, color:S.muted2 }}>
            {balance>0?t.timOwesYanne(fmt(Math.abs(balance),currency)):t.yanneOwesTim(fmt(Math.abs(balance),currency))}
          </div>
        )}
      </div>

      {catStats.length===0
        ?<div className="card" style={{ padding:32, textAlign:"center", color:S.muted }}>{t.noExpenses}</div>
        :<div className="card" style={{ overflow:"hidden", marginBottom:12 }}>
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.byCategory}</div>
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
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.topStores}</div>
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
          <div style={{ padding:"14px 16px 10px", fontWeight:600, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.byPayment}</div>
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
function HistoryView({ t, records, onDelete, getCat, getUserLabel, currency, S }) {
  const sorted  = [...records].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const grouped = sorted.reduce((acc,r)=>{ const k=r.date.slice(0,7); if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; },{});
  return (
    <div className="slide-up">
      {Object.entries(grouped).map(([month,recs])=>{
        const [y,m]=month.split("-");
        const total=recs.reduce((s,r)=>s+r.amount,0);
        return (
          <div key={month} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.monthShort[parseInt(m)-1]} {y}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700, color:S.muted2 }}>{fmt(total,currency)}</span>
            </div>
            <div className="card" style={{ overflow:"hidden" }}>
              {recs.map(r=><ExpenseRow key={r.id} t={t} record={r} onDelete={onDelete} getCat={getCat} getUserLabel={getUserLabel} currency={currency} S={S}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────
function SettingsView({ t, categories, setCategories, stores, setStores, setModal, S, showToast }) {
  const removeCategory = (id) => {
    if (categories.length<=1){ showToast(t.needOneCategory,"err"); return; }
    setCategories(c=>c.filter(x=>x.id!==id));
  };
  const removeStore = (name) => setStores(s=>s.filter(x=>x!==name));

  return (
    <div className="slide-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.categories}</div>
        <button className="btn" onClick={()=>setModal("addCategory")} style={{ fontSize:12, color:"#818CF8", fontWeight:600 }}>+ Add</button>
      </div>
      <div className="card" style={{ overflow:"hidden", marginBottom:16 }}>
        {categories.map((cat,i)=>(
          <div key={cat.id} style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12, borderBottom:i<categories.length-1?`1px solid ${S.border}`:"none" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cat.icon}</div>
            <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{cat.label}</span>
            <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color }}/>
            <button className="btn" onClick={()=>removeCategory(cat.id)} style={{ color:"#444", fontSize:11, padding:"4px 8px" }}>{t.remove}</button>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:11, color:S.muted, letterSpacing:1 }}>{t.stores}</div>
        <button className="btn" onClick={()=>setModal("addStore")} style={{ fontSize:12, color:"#818CF8", fontWeight:600 }}>+ Add</button>
      </div>
      <div className="card" style={{ overflow:"hidden" }}>
        {stores.map((store,i)=>(
          <div key={store} style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12, borderBottom:i<stores.length-1?`1px solid ${S.border}`:"none" }}>
            <span style={{ flex:1, fontSize:14 }}>{store}</span>
            <button className="btn" onClick={()=>removeStore(store)} style={{ color:"#444", fontSize:11 }}>{t.remove}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
