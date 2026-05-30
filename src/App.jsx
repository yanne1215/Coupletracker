import { useState, useRef, useCallback, useEffect } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://lkxsliacyqqkiazmepja.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHNsaWFjeXFxa2lhem1lcGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODI1MDUsImV4cCI6MjA5MjQ1ODUwNX0.7iKHGbPlgIgMx8TcnV09EfZ95XsUPvETluAiBPcA_pM";
const H  = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
const HJ = { ...H, "Content-Type": "application/json" };

// ─── Supabase DB ──────────────────────────────────────────────────────────────
const db = {
  async getExpenses() {
    const r = await fetch(`${SUPA_URL}/rest/v1/expenses?order=date.desc,id.desc`, { headers: H });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return (await r.json()).map(row => ({
      id: row.id,
      date: row.date || new Date().toISOString().split("T")[0],
      store: row.store || "",
      category: row.category || "other",
      amount: Number(row.amount) || 0,
      note: row.note || "",
      payer: (row.payer === "split" || !row.payer) ? "yanne" : row.payer,
      paymentMethod: row.payment_method || "Credit Card",
      currency: row.currency || "CAD",
      split: row.split || "equal",
      isSettlement: row.is_settlement || false,
      photo: null,
    }));
  },
  async insertExpense(rec) {
    const r = await fetch(`${SUPA_URL}/rest/v1/expenses`, {
      method: "POST",
      headers: { ...HJ, Prefer: "return=representation" },
      body: JSON.stringify({
        date: rec.date, store: rec.store || "", category: rec.category,
        amount: rec.amount, note: rec.note || "", payer: rec.payer,
        payment_method: rec.paymentMethod, currency: rec.currency,
        split: rec.split, is_settlement: rec.isSettlement || false,
      }),
    });
    if (!r.ok) throw new Error(`Insert failed: ${await r.text()}`);
    return (await r.json())[0].id;
  },
  async insertMany(recs) {
    if (!recs.length) return [];
    const r = await fetch(`${SUPA_URL}/rest/v1/expenses`, {
      method: "POST",
      headers: { ...HJ, Prefer: "return=representation" },
      body: JSON.stringify(recs.map(rec => ({
        date: rec.date, store: rec.store || "", category: rec.category || "other",
        amount: rec.amount, note: rec.note || "", payer: rec.payer || "yanne",
        payment_method: rec.paymentMethod || "Credit Card",
        currency: rec.currency || "CAD", split: rec.split || "equal",
        is_settlement: false,
      }))),
    });
    if (!r.ok) throw new Error(`Bulk insert failed: ${await r.text()}`);
    return await r.json();
  },
  async updateExpense(id, rec) {
    const r = await fetch(`${SUPA_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: "PATCH", headers: HJ,
      body: JSON.stringify({
        date: rec.date, store: rec.store || "", category: rec.category,
        amount: rec.amount, note: rec.note || "", payer: rec.payer,
        payment_method: rec.paymentMethod, currency: rec.currency, split: rec.split,
      }),
    });
    if (!r.ok) throw new Error(`Update failed: ${await r.text()}`);
  },
  async deleteExpense(id) {
    await fetch(`${SUPA_URL}/rest/v1/expenses?id=eq.${id}`, { method: "DELETE", headers: H });
  },
  // Settings — returns null instead of throwing if table doesn't exist
  async getSetting(key) {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.${encodeURIComponent(key)}`, { headers: H });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows.length ? rows[0].value : null;
    } catch { return null; }
  },
  async setSetting(key, value) {
    try {
      await fetch(`${SUPA_URL}/rest/v1/settings`, {
        method: "POST",
        headers: { ...HJ, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ key, value }),
      });
    } catch { /* silently fail — settings are non-critical */ }
  },
};

// ─── File → base64 (handles empty file.type from screenshots) ─────────────────
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = e => {
      const dataUrl = e.target.result;
      const base64  = dataUrl.split(",")[1];
      let mt = (file.type && file.type.startsWith("image/")) ? file.type : null;
      if (!mt) {
        const ext = (file.name || "").split(".").pop().toLowerCase();
        mt = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png",
               gif:"image/gif",  webp:"image/webp",  heic:"image/jpeg",
               heif:"image/jpeg" }[ext] || "image/jpeg";
      }
      resolve({ base64, mt, dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

// ─── Extract JSON from AI response (handles markdown fences, extra text) ───────
function extractJSON(raw) {
  const text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Try array first, then object
  for (const [open, close] of [["[", "]"], ["{", "}"]]) {
    const start = text.indexOf(open);
    const end   = text.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
  }
  throw new Error("No JSON found in AI response");
}

// ─── AI image analysis — defined OUTSIDE component to avoid stale closures ────
async function analyzeImage(file, prompt, maxTokens = 800) {
  const { base64, mt } = await fileToBase64(file);
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mt, data: base64 } },
        { type: "text",  text: prompt },
      ]}],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `API error ${resp.status}`);
  return data.content?.map(i => i.text || "").join("") || "";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const USERS = [
  { id:"yanne", label:"Yanne", color:"#A78BFA" },
  { id:"tim",   label:"Tim",   color:"#34D399"  },
];
const CURRENCIES = [
  { code:"CAD", symbol:"CA$", flag:"🇨🇦" }, { code:"USD", symbol:"US$", flag:"🇺🇸" },
  { code:"EUR", symbol:"€",   flag:"🇪🇺" }, { code:"GBP", symbol:"£",   flag:"🇬🇧" },
  { code:"HKD", symbol:"HK$", flag:"🇭🇰" }, { code:"TWD", symbol:"NT$", flag:"🇹🇼" },
  { code:"JPY", symbol:"¥",   flag:"🇯🇵" }, { code:"AUD", symbol:"A$",  flag:"🇦🇺" },
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DEFAULT_CATEGORIES = [
  { id:"dining",        label:"Dining",        icon:"🍽️", color:"#F59E0B" },
  { id:"entertainment", label:"Entertainment",  icon:"🎬", color:"#EF4444" },
  { id:"groceries",     label:"Groceries",      icon:"🛒", color:"#10B981" },
  { id:"health",        label:"Health",         icon:"💊", color:"#EC4899" },
  { id:"home",          label:"Home",           icon:"🏠", color:"#6B7280" },
  { id:"other",         label:"Other",          icon:"📦", color:"#64748B" },
  { id:"shopping",      label:"Shopping",       icon:"🛍️", color:"#8B5CF6" },
  { id:"transport",     label:"Transport",      icon:"🚗", color:"#3B82F6" },
  { id:"travel",        label:"Travel",         icon:"✈️", color:"#06B6D4" },
  { id:"utilities",     label:"Utilities",      icon:"⚡", color:"#F97316" },
];
const DEFAULT_PAYMENT_METHODS = ["Apple Pay","Cash","Credit Card","Debit Card","E-Transfer","Google Pay","Other","PayPal"];
const DEFAULT_STORES = [
  "A&W","Beer Store","Best Buy","Canadian Tire","Cineplex","Costco",
  "Dollarama","Esso","Harvey's","Home Depot","IKEA","LCBO","Loblaws",
  "McDonald's","Metro","No Frills","Petro-Canada","Shell","Shoppers Drug Mart",
  "Sobeys","Sport Chek","Swiss Chalet","The Keg","Tim Hortons","Walmart","Winners",
];

const CANADIAN_STORES =
  "Loblaws, No Frills, Metro, Sobeys, Costco, Walmart, Tim Hortons, McDonald's, A&W, Harvey's, " +
  "The Keg, Boston Pizza, Swiss Chalet, Canadian Tire, Home Depot, IKEA, Shoppers Drug Mart, " +
  "Petro-Canada, Esso, Shell, Cineplex, Sport Chek, LCBO, Beer Store, Best Buy, Dollarama, Winners";

function fmt(n, code = "CAD") {
  const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
  return `${cur.symbol}${Number(n).toFixed(code === "JPY" ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
function sortAZ(arr)     { return [...arr].sort((a, b) => a.localeCompare(b)); }
function sortCatsAZ(arr) { return [...arr].sort((a, b) => a.label.localeCompare(b.label)); }

const nowMonth = new Date().getMonth() + 1;
const nowYear  = new Date().getFullYear();
const todayStr = new Date().toISOString().split("T")[0];

const S = {
  bg:"#0A0A0A", surface:"#111111", surface2:"#1A1A1A",
  border:"#1E1E1E", border2:"#2A2A2A",
  text:"#F5F5F5", muted:"#555555", muted2:"#888888",
};

// ─── Balance logic ────────────────────────────────────────────────────────────
// positive = Tim owes Yanne | negative = Yanne owes Tim
function calcNet(recs) {
  return recs.reduce((net, r) => {
    const a = r.amount, sp = r.split || "equal";
    if (r.isSettlement) return r.payer === "tim" ? net - a : net + a;
    if (r.payer === "yanne") return sp === "equal" ? net + a/2 : sp === "tim"   ? net + a : net;
    if (r.payer === "tim")   return sp === "equal" ? net - a/2 : sp === "yanne" ? net - a : net;
    return net;
  }, 0);
}
function splitLabel(sp) {
  return sp === "yanne" ? "Yanne's expense" : sp === "tim" ? "Tim's expense" : "Split equally";
}
function owedDesc(payer, sp, amount, cur) {
  const half = fmt(amount / 2, cur), full = fmt(amount, cur);
  if (sp === "equal")                 return payer === "yanne" ? `Tim owes Yanne ${half}` : `Yanne owes Tim ${half}`;
  if (sp === "yanne" && payer === "tim")   return `Yanne owes Tim ${full}`;
  if (sp === "tim"   && payer === "yanne") return `Tim owes Yanne ${full}`;
  return "";
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]               = useState("home");
  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [categories, setCategories]   = useState(DEFAULT_CATEGORIES);
  const [stores, setStores]           = useState(DEFAULT_STORES);
  const [payMethods, setPayMethods]   = useState(DEFAULT_PAYMENT_METHODS);
  const [currency, setCurrency]       = useState("CAD");
  const [filterMonth, setFilterMonth] = useState(nowMonth);
  const [filterYear, setFilterYear]   = useState(nowYear);
  const [toast, setToast]             = useState(null);
  const [modal, setModal]             = useState(null);
  const [modalData, setModalData]     = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bulkItems, setBulkItems]     = useState(null);
  const [bulkError, setBulkError]     = useState("");

  const cameraRef  = useRef(); // take photo
  const libraryRef = useRef(); // pick from library
  const bulkRef    = useRef(); // bank statement
  const editRef    = useRef(); // photo in edit modal

  const EMPTY_FORM = {
    date: todayStr, store: "", category: "groceries", amount: "",
    note: "", payer: "yanne", split: "equal",
    paymentMethod: "Credit Card", currency: "CAD", photo: null, isSettlement: false,
  };
  const [form, setForm] = useState(EMPTY_FORM);

  // ── showToast defined early so useEffect can use it ──────────────────────────
  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Load: expenses separately from settings so one failing doesn't block all ─
  useEffect(() => {
    // 1. Load expenses (critical)
    db.getExpenses()
      .then(exps => { setRecords(exps); setLoading(false); })
      .catch(err  => {
        console.error("Expenses load error:", err);
        setLoading(false);
        showToast("Could not load expenses — check your connection", "err");
      });

    // 2. Load settings (non-critical — silently skip if table missing)
    Promise.allSettled([
      db.getSetting("categories"),
      db.getSetting("stores"),
      db.getSetting("payMethods"),
      db.getSetting("currency"),
    ]).then(([cats, sts, pms, cur]) => {
      if (cats.value) setCategories(sortCatsAZ(cats.value));
      if (sts.value)  setStores(sortAZ(sts.value));
      if (pms.value)  setPayMethods(sortAZ(pms.value));
      if (cur.value)  setCurrency(cur.value);
    });
  }, [showToast]);

  const getCat     = useCallback(id => categories.find(c => c.id === id) || categories[categories.length - 1], [categories]);
  const openModal  = useCallback((name, data = null) => { setModal(name); setModalData(data); }, []);
  const closeModal = useCallback(() => { setModal(null); setModalData(null); }, []);

  const saveSetting = useCallback(async (key, val) => { await db.setSetting(key, val); }, []);

  // ── Photo scan (single receipt) ───────────────────────────────────────────────
  const handlePhoto = useCallback(async (file, setter) => {
    if (!file) return;
    setIsAnalyzing(true);
    // Show photo immediately before AI runs
    const { dataUrl } = await fileToBase64(file).catch(() => ({ dataUrl: null }));
    if (dataUrl) setter(f => ({ ...f, photo: dataUrl }));

    const catIds = categories.map(c => c.id).join("|");
    try {
      const text = await analyzeImage(
        file,
        `Look at this receipt or shopping photo. Reply with ONLY a raw JSON object (no markdown, no explanation):\n` +
        `{"amount":number,"store":"merchant name — recognize Canadian stores: ${CANADIAN_STORES}","category":"one of [${catIds}]","note":"max 40 chars","currency":"CAD|USD|EUR|GBP|HKD|TWD|JPY|AUD"}`,
        700,
      );
      const p = extractJSON(text);
      setter(f => ({
        ...f,
        amount:   p.amount   || "",
        store:    p.store    || "",
        category: catIds.includes(p.category) ? p.category : "other",
        note:     p.note     || "",
        currency: p.currency || f.currency,
        photo:    dataUrl,
      }));
      showToast("Receipt scanned!");
    } catch (err) {
      console.error("Receipt scan error:", err);
      showToast("Photo saved — fill in details manually", "info");
    }
    setIsAnalyzing(false);
  }, [categories, showToast]);

  // ── Bulk scan (bank statement) ────────────────────────────────────────────────
  const handleBulkScan = useCallback(async (file) => {
    if (!file) return;
    setBulkItems(null);
    setBulkError("");
    setIsAnalyzing(true);
    openModal("bulkReview");

    const catIds = categories.map(c => c.id).join("|");
    try {
      const text = await analyzeImage(
        file,
        `This image shows a bank statement or transaction history. Extract every purchase/debit.\n` +
        `Reply with ONLY a raw JSON array (no markdown, no explanation):\n` +
        `[{"date":"${nowYear}-MM-DD","amount":number,"store":"merchant name","category":"one of [${catIds}]","note":"max 30 chars","currency":"CAD|USD|EUR|GBP|HKD|TWD|JPY|AUD"}]\n` +
        `Rules: amounts must be positive numbers. Skip credits/refunds. Use ${nowYear} if year not shown. Return [] if no transactions found.`,
        3000,
      );
      const parsed = extractJSON(text);
      if (!Array.isArray(parsed)) throw new Error("Result was not an array");
      setBulkItems(parsed.map((t, i) => ({
        id:            `b${i}`,
        date:          t.date     || todayStr,
        store:         t.store    || "",
        category:      catIds.includes(t.category) ? t.category : "other",
        amount:        Math.abs(Number(t.amount) || 0),
        note:          t.note     || "",
        currency:      t.currency || "CAD",
        payer:         "yanne",
        split:         "equal",
        paymentMethod: "Credit Card",
        selected:      true,
      })));
    } catch (err) {
      console.error("Bulk scan error:", err);
      setBulkError(
        "Could not read transactions.\n\nTips:\n" +
        "• Make sure amounts and dates are clearly visible\n" +
        "• Try cropping out the top/bottom headers\n" +
        "• Avoid dark-mode screenshots if possible"
      );
      setBulkItems([]);
    }
    setIsAnalyzing(false);
  }, [categories, openModal]);

  // ── Save bulk ──────────────────────────────────────────────────────────────────
  const handleBulkSave = useCallback(async () => {
    const toSave = (bulkItems || []).filter(i => i.selected && i.amount > 0);
    if (!toSave.length) { showToast("Select at least one expense", "err"); return; }
    setSyncing(true);
    try {
      const saved = await db.insertMany(toSave);
      setRecords(prev => [
        ...saved.map((r, i) => ({ ...toSave[i], id: r.id, isSettlement: false, photo: null })),
        ...prev,
      ]);
      setBulkItems(null);
      closeModal();
      showToast(`${toSave.length} expense${toSave.length > 1 ? "s" : ""} saved!`);
    } catch (err) {
      console.error("Bulk save:", err);
      showToast("Failed to save — check connection", "err");
    }
    setSyncing(false);
  }, [bulkItems, closeModal, showToast]);

  // ── CRUD ───────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      showToast("Enter a valid amount", "err"); return;
    }
    setSyncing(true);
    try {
      const rec = { ...form, amount: Number(form.amount) };
      const id  = await db.insertExpense(rec);
      setRecords(r => [{ ...rec, id }, ...r]);
      setForm(EMPTY_FORM);
      setView("home");
      showToast("Expense saved");
    } catch (err) { console.error(err); showToast("Failed to save", "err"); }
    setSyncing(false);
  }, [form, showToast]);

  const handleEditSave = useCallback(async edited => {
    setSyncing(true);
    try {
      await db.updateExpense(edited.id, edited);
      setRecords(r => r.map(x => x.id === edited.id ? edited : x));
      closeModal();
      showToast("Updated");
    } catch (err) { console.error(err); showToast("Failed to update", "err"); }
    setSyncing(false);
  }, [closeModal, showToast]);

  const handleDelete = useCallback(async id => {
    setSyncing(true);
    try {
      await db.deleteExpense(id);
      setRecords(r => r.filter(x => x.id !== id));
      closeModal();
      showToast("Deleted", "info");
    } catch (err) { console.error(err); showToast("Failed to delete", "err"); }
    setSyncing(false);
  }, [closeModal, showToast]);

  const handleSettle = useCallback(async () => {
    // Compute net inside callback to avoid "before initialization" error
    const net    = calcNet(records);
    const absNet = Math.abs(net);
    if (absNet < 0.01) { showToast("Already settled!", "info"); return; }
    const payer  = net > 0 ? "tim"   : "yanne";
    const pLabel = net > 0 ? "Tim"   : "Yanne";
    const rLabel = net > 0 ? "Yanne" : "Tim";
    setSyncing(true);
    try {
      const s = {
        date: todayStr, store: "", category: "other", amount: absNet,
        note: `${pLabel} paid ${rLabel} — settled up`, payer,
        split: "equal", paymentMethod: "E-Transfer", currency, isSettlement: true, photo: null,
      };
      const id = await db.insertExpense(s);
      setRecords(r => [{ ...s, id }, ...r]);
      closeModal();
      showToast(`Settled! ${pLabel} → ${rLabel} ${fmt(absNet, currency)}`);
    } catch (err) { console.error(err); showToast("Failed to record settlement", "err"); }
    setSyncing(false);
  }, [records, currency, closeModal, showToast]);

  // ── Settings sync ──────────────────────────────────────────────────────────────
  const updateCategories = useCallback(async arr => {
    const s = sortCatsAZ(arr); setCategories(s); await saveSetting("categories", s);
  }, [saveSetting]);
  const updateStores     = useCallback(async arr => {
    const s = sortAZ(arr); setStores(s); await saveSetting("stores", s);
  }, [saveSetting]);
  const updatePayMethods = useCallback(async arr => {
    const s = sortAZ(arr); setPayMethods(s); await saveSetting("payMethods", s);
  }, [saveSetting]);
  const updateCurrency   = useCallback(async c => {
    setCurrency(c); await saveSetting("currency", c);
  }, [saveSetting]);

  // ── Derived ────────────────────────────────────────────────────────────────────
  const allNet   = calcNet(records);
  const filtered = records.filter(r => {
    const d = new Date(r.date);
    return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
  });
  const monthNet = calcNet(filtered);
  const total    = filtered.filter(r => !r.isSettlement).reduce((s, r) => s + r.amount, 0);
  const catStats = categories
    .map(c => ({
      ...c,
      total: filtered.filter(r => !r.isSettlement && r.category === c.id).reduce((s, r) => s + r.amount, 0),
      count: filtered.filter(r => !r.isSettlement && r.category === c.id).length,
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // ── CSS ────────────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:0;}
    .btn{cursor:pointer;border:none;outline:none;transition:all 0.15s;background:transparent;}
    .btn:active{transform:scale(0.95);}
    input,select{font-family:'DM Sans',sans-serif;background:#1A1A1A;border:1.5px solid #2A2A2A;border-radius:10px;color:#F5F5F5;padding:11px 14px;width:100%;font-size:15px;outline:none;transition:border-color 0.15s;-webkit-appearance:none;}
    input:focus,select:focus{border-color:#6366F1;}
    input::placeholder{color:#444;}
    select option{background:#1A1A1A;color:#F5F5F5;}
    .card{background:#111111;border-radius:16px;border:1px solid #1E1E1E;}
    .slide-up{animation:slideUp 0.22s ease;}
    @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .toast-wrap{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;animation:toastIn 0.2s ease;white-space:nowrap;pointer-events:none;}
    @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    .scan-zone{border:1.5px dashed #2A2A2A;border-radius:14px;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:110px;cursor:pointer;transition:border-color 0.2s;}
    .scan-zone:active{border-color:#6366F1;}
    .upload-btn{border:1.5px dashed #2A2A2A;border-radius:12px;background:#161616;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;cursor:pointer;font-size:13px;color:#555;font-weight:500;width:100%;transition:all 0.15s;}
    .upload-btn:active{border-color:#6366F1;color:#818CF8;}
    .progress-bar{height:5px;background:#1E1E1E;border-radius:3px;overflow:hidden;margin-top:6px;}
    .progress-fill{height:100%;border-radius:3px;transition:width 0.6s ease;}
    .shimmer{background:linear-gradient(90deg,#111 25%,#1E1E1E 50%,#111 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite;}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:800;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.18s ease;}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .modal{background:#111;border:1px solid #222;border-radius:22px 22px 0 0;padding:22px 18px 32px;width:100%;max-width:480px;animation:slideUp 0.22s ease;max-height:92vh;overflow-y:auto;}
    .row{display:flex;align-items:center;padding:13px 16px;gap:12px;border-bottom:1px solid #1A1A1A;transition:background 0.1s;cursor:pointer;}
    .row:last-child{border-bottom:none;}
    .row:active{background:#141414;}
    .seg-btn{flex:1;padding:9px 4px;border-radius:9px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:'DM Sans',sans-serif;}
    .split-btn{flex:1;padding:10px 6px;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:'DM Sans',sans-serif;text-align:center;}
    .bulk-item{background:#161616;border:1px solid #2A2A2A;border-radius:12px;padding:12px 14px;margin-bottom:10px;transition:border-color 0.15s;}
    .bulk-item.on{border-color:#6366F1;background:#1A1833;}
    .chk{width:22px;height:22px;border-radius:6px;border:2px solid #444;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all 0.15s;}
    .chk.on{background:#6366F1;border-color:#6366F1;}
    .nav-bar{position:fixed;bottom:0;left:0;right:0;background:#111111;border-top:1px solid #1E1E1E;display:flex;height:58px;z-index:200;}
    .nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;border:none;background:transparent;font-family:'DM Sans',sans-serif;padding:0;transition:color 0.15s;}
  `;

  return (
    <div style={{ minHeight:"100vh", background:S.bg, fontFamily:"'DM Sans',sans-serif", color:S.text }}>
      <style>{CSS}</style>

      {/* Hidden file inputs */}
      <input style={{display:"none"}} ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={e=>{if(e.target.files[0]){handlePhoto(e.target.files[0],setForm);e.target.value="";}}} />
      <input style={{display:"none"}} ref={libraryRef} type="file" accept="image/*"                       onChange={e=>{if(e.target.files[0]){handlePhoto(e.target.files[0],setForm);e.target.value="";}}} />
      <input style={{display:"none"}} ref={bulkRef}    type="file" accept="image/*"                       onChange={e=>{if(e.target.files[0]){handleBulkScan(e.target.files[0]);e.target.value="";}}} />
      <input style={{display:"none"}} ref={editRef}    type="file" accept="image/*"                       onChange={e=>{if(e.target.files[0]){handlePhoto(e.target.files[0],u=>setModalData(d=>({...d,...u})));e.target.value="";}}} />

      {/* Syncing bar */}
      {syncing && <div style={{position:"fixed",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#6366F1,#818CF8)",zIndex:9999,backgroundSize:"200% 100%",animation:"shimmer 1s linear infinite"}} />}

      {/* Toast */}
      {toast && (
        <div className="toast-wrap">
          <div style={{background:toast.type==="err"?"#3B0000":toast.type==="info"?"#0F172A":"#052E16",color:toast.type==="err"?"#FCA5A5":toast.type==="info"?"#93C5FD":"#6EE7B7",padding:"10px 20px",borderRadius:50,fontSize:13,fontWeight:500,border:`1px solid ${toast.type==="err"?"#7F1D1D":toast.type==="info"?"#1E3A5F":"#14532D"}`}}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Settle confirm modal */}
      {modal === "settle" && (
        <div className="overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>🤝</div>
              <div style={{fontWeight:700,fontSize:19,marginBottom:8}}>Settle Up</div>
              {Math.abs(allNet) < 0.01 ? (
                <div style={{color:S.muted2,fontSize:14}}>You're already settled up!</div>
              ) : (
                <>
                  <div style={{background:"#0D1117",border:`1px solid ${S.border2}`,borderRadius:14,padding:16,marginBottom:20}}>
                    <div style={{fontSize:13,color:S.muted,marginBottom:6}}>Amount to settle</div>
                    <div style={{fontSize:32,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"#6EE7B7"}}>{fmt(Math.abs(allNet),currency)}</div>
                    <div style={{fontSize:13,color:S.muted2,marginTop:6}}>{allNet>0?"Tim pays Yanne":"Yanne pays Tim"}</div>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn" onClick={closeModal} style={{flex:1,padding:"13px",borderRadius:11,background:S.surface2,fontSize:15,color:S.muted2}}>Cancel</button>
                    <button className="btn" onClick={handleSettle} disabled={syncing} style={{flex:2,padding:"13px",borderRadius:11,background:"#059669",fontSize:15,fontWeight:700,color:"#fff"}}>{syncing?"Saving...":"Confirm ✓"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk review modal */}
      {modal === "bulkReview" && (
        <div className="overlay">
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontWeight:700,fontSize:17}}>Review Transactions</div>
              <button className="btn" onClick={()=>{setBulkItems(null);setBulkError("");closeModal();}} style={{color:S.muted2,fontSize:24,lineHeight:1}}>×</button>
            </div>
            <div style={{fontSize:12,color:S.muted,marginBottom:14}}>Tap to toggle · edit fields inline</div>

            {isAnalyzing && (
              <div style={{textAlign:"center",padding:"50px 0",color:S.muted}}>
                <div style={{fontSize:36,marginBottom:14}}>🔍</div>
                <div style={{fontSize:15,fontWeight:600}}>Scanning statement...</div>
                <div style={{fontSize:12,marginTop:6}}>This may take 15–30 seconds</div>
              </div>
            )}

            {!isAnalyzing && bulkError && (
              <div style={{background:"#3B0000",border:"1px solid #7F1D1D",borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{fontWeight:600,color:"#FCA5A5",marginBottom:8}}>⚠️ Could not read statement</div>
                <div style={{fontSize:12,color:"#FCA5A5",opacity:0.85,whiteSpace:"pre-line"}}>{bulkError}</div>
                <button className="btn upload-btn" style={{marginTop:14,borderColor:"#7F1D1D",color:"#FCA5A5"}} onClick={()=>bulkRef.current?.click()}>
                  Try another screenshot
                </button>
              </div>
            )}

            {!isAnalyzing && bulkItems?.length === 0 && !bulkError && (
              <div style={{textAlign:"center",padding:"30px 0",color:S.muted2,fontSize:14}}>No transactions found in this image.</div>
            )}

            {!isAnalyzing && bulkItems?.length > 0 && (
              <>
                <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:S.muted}}>{bulkItems.filter(i=>i.selected).length} of {bulkItems.length} selected</span>
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn" onClick={()=>setBulkItems(b=>b.map(i=>({...i,selected:true})))}  style={{fontSize:12,color:"#818CF8",fontWeight:600}}>All</button>
                    <button className="btn" onClick={()=>setBulkItems(b=>b.map(i=>({...i,selected:false})))} style={{fontSize:12,color:S.muted}}>None</button>
                  </div>
                </div>
                {bulkItems.map((item,idx)=>(
                  <div key={item.id} className={`bulk-item${item.selected?" on":""}`}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div className={`chk${item.selected?" on":""}`} onClick={()=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,selected:!x.selected}:x))}>
                        {item.selected&&<span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                      </div>
                      <input value={item.store||""} placeholder="Merchant" onChange={e=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,store:e.target.value}:x))} style={{flex:1,fontSize:14,fontWeight:600,padding:"7px 10px"}}/>
                      <input type="number" value={item.amount||""} onChange={e=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,amount:Number(e.target.value)}:x))} style={{width:88,fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,padding:"7px 8px",textAlign:"right"}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",gap:6}}>
                      <input type="date" value={item.date||todayStr} onChange={e=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,date:e.target.value}:x))} style={{fontSize:12,padding:"6px 8px"}}/>
                      <select value={item.category||"other"} onChange={e=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,category:e.target.value}:x))} style={{fontSize:12,padding:"6px 8px"}}>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                      </select>
                      <select value={item.payer||"yanne"} onChange={e=>setBulkItems(b=>b.map((x,i)=>i===idx?{...x,payer:e.target.value}:x))} style={{fontSize:12,padding:"6px 8px"}}>
                        {USERS.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button className="btn" onClick={handleBulkSave} disabled={syncing} style={{width:"100%",marginTop:8,padding:"15px",background:syncing?"#3730A3":"#6366F1",borderRadius:13,fontSize:15,fontWeight:700,color:"#fff"}}>
                  {syncing?"Saving...":bulkItems.filter(i=>i.selected).length>0?`Save ${bulkItems.filter(i=>i.selected).length} Expense${bulkItems.filter(i=>i.selected).length>1?"s":""}`:("Select at least one")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit record modal */}
      {modal === "editRecord" && modalData && (
        <EditRecordModal
          record={modalData} categories={categories} stores={stores} payMethods={payMethods}
          onSave={handleEditSave} onDelete={()=>handleDelete(modalData.id)}
          onClose={closeModal} isAnalyzing={isAnalyzing}
          onPhotoClick={()=>editRef.current?.click()} S={S}
        />
      )}

      {/* Currency modal */}
      {modal === "currency" && (
        <div className="overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>Select Currency</div>
            {CURRENCIES.map(c=>(
              <button key={c.code} className="btn" onClick={()=>{updateCurrency(c.code);closeModal();showToast(`Currency: ${c.code}`);}}
                style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderRadius:12,background:currency===c.code?"#1E1B4B":S.surface2,border:`1.5px solid ${currency===c.code?"#6366F1":"transparent"}`,color:S.text,width:"100%",marginBottom:6}}>
                <span style={{fontSize:22}}>{c.flag}</span>
                <span style={{fontWeight:600}}>{c.code}</span>
                <span style={{color:S.muted2,fontSize:13}}>{c.symbol}</span>
                {currency===c.code&&<span style={{marginLeft:"auto",color:"#818CF8"}}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category modal */}
      {(modal==="addCat"||modal==="editCat") && (
        <EditItemModal
          title={modal==="addCat"?"New Category":"Edit Category"}
          fields={[{key:"label",label:"Name",placeholder:"Category name"},{key:"icon",label:"Emoji",placeholder:"🏷️"},{key:"color",label:"Color",type:"color"}]}
          initial={modalData||{label:"",icon:"🏷️",color:"#6366F1"}}
          onSave={async v=>{
            if (!v.label?.trim()) return;
            const id  = modal==="addCat" ? v.label.toLowerCase().replace(/\s+/g,"_")+"_"+Date.now() : modalData.id;
            const arr = modal==="addCat" ? [...categories,{id,label:v.label.trim(),icon:v.icon||"🏷️",color:v.color||"#6366F1"}] : categories.map(x=>x.id===id?{...x,...v,label:v.label.trim()}:x);
            await updateCategories(arr); closeModal(); showToast(modal==="addCat"?"Category added":"Updated");
          }}
          onDelete={modal==="editCat"?async()=>{
            if (categories.length<=1){showToast("Need at least 1 category","err");return;}
            await updateCategories(categories.filter(x=>x.id!==modalData.id));
            closeModal(); showToast("Deleted","info");
          }:null}
          onClose={closeModal} S={S}/>
      )}

      {/* Store modal */}
      {(modal==="addStore"||modal==="editStore") && (
        <EditItemModal
          title={modal==="addStore"?"New Store":"Edit Store"}
          fields={[{key:"label",label:"Store name",placeholder:"e.g. Loblaws"}]}
          initial={modalData?{label:modalData}:{label:""}}
          onSave={async v=>{
            if (!v.label?.trim()) return;
            const arr=modal==="addStore"?[...stores,v.label.trim()]:stores.map(x=>x===modalData?v.label.trim():x);
            await updateStores(arr); closeModal(); showToast(modal==="addStore"?"Store added":"Updated");
          }}
          onDelete={modal==="editStore"?async()=>{await updateStores(stores.filter(x=>x!==modalData));closeModal();showToast("Deleted","info");}:null}
          onClose={closeModal} S={S}/>
      )}

      {/* Payment method modal */}
      {(modal==="addPM"||modal==="editPM") && (
        <EditItemModal
          title={modal==="addPM"?"New Payment Method":"Edit Payment Method"}
          fields={[{key:"label",label:"Method name",placeholder:"e.g. WeChat Pay"}]}
          initial={modalData?{label:modalData}:{label:""}}
          onSave={async v=>{
            if (!v.label?.trim()) return;
            const arr=modal==="addPM"?[...payMethods,v.label.trim()]:payMethods.map(x=>x===modalData?v.label.trim():x);
            await updatePayMethods(arr); closeModal(); showToast(modal==="addPM"?"Method added":"Updated");
          }}
          onDelete={modal==="editPM"?async()=>{
            if (payMethods.length<=1){showToast("Need at least 1","err");return;}
            await updatePayMethods(payMethods.filter(x=>x!==modalData));
            closeModal(); showToast("Deleted","info");
          }:null}
          onClose={closeModal} S={S}/>
      )}

      {/* Header */}
      <div style={{background:S.surface,borderBottom:`1px solid ${S.border}`,padding:"52px 20px 14px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:S.muted,letterSpacing:1.5}}>YANNE & TIM</div>
            <div style={{fontSize:20,fontWeight:700,marginTop:1}}>
              {view==="home"&&"Overview"}{view==="add"&&"Add Expense"}
              {view==="stats"&&"Statistics"}{view==="history"&&"All Expenses"}{view==="settings"&&"Settings"}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="btn" onClick={()=>openModal("currency")} style={{background:S.surface2,border:`1px solid ${S.border2}`,borderRadius:10,padding:"8px 10px",color:S.muted2,fontSize:12,fontWeight:600}}>
              {CURRENCIES.find(c=>c.code===currency)?.flag} {currency}
            </button>
            {view==="home"&&<button className="btn" onClick={()=>setView("add")} style={{background:"#6366F1",color:"#fff",padding:"9px 14px",borderRadius:10,fontWeight:700,fontSize:14}}>+ Add</button>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 14px 74px"}}>
        {loading ? (
          <div style={{textAlign:"center",color:S.muted,paddingTop:60}}>
            <div style={{fontSize:28,marginBottom:12}}>☁️</div>
            <div style={{fontSize:14}}>Loading...</div>
          </div>
        ) : (
          <>
            {view==="home"    &&<HomeView     filtered={filtered} total={total} allNet={allNet} monthNet={monthNet} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} onEdit={r=>openModal("editRecord",r)} onSettle={()=>openModal("settle")} getCat={getCat} currency={currency} S={S}/>}
            {view==="add"     &&<AddView      form={form} setForm={setForm} onSave={handleSave} onCameraClick={()=>cameraRef.current?.click()} onLibraryClick={()=>libraryRef.current?.click()} onBulkClick={()=>bulkRef.current?.click()} isAnalyzing={isAnalyzing} syncing={syncing} categories={categories} stores={stores} payMethods={payMethods} S={S}/>}
            {view==="stats"   &&<StatsView    catStats={catStats} total={total} allNet={allNet} monthNet={monthNet} filtered={filtered} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} onSettle={()=>openModal("settle")} currency={currency} S={S}/>}
            {view==="history" &&<HistoryView  records={records} onEdit={r=>openModal("editRecord",r)} getCat={getCat} currency={currency} S={S}/>}
            {view==="settings"&&<SettingsView categories={categories} stores={stores} payMethods={payMethods} openModal={openModal} S={S}/>}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="nav-bar">
        {[{id:"home",icon:"⊞",label:"Overview"},{id:"add",icon:"+",label:"Add",lg:true},{id:"stats",icon:"◑",label:"Stats"},{id:"history",icon:"≡",label:"History"},{id:"settings",icon:"⚙",label:"Settings"}].map(t=>(
          <button key={t.id} className="nav-item" onClick={()=>setView(t.id)} style={{color:view===t.id?"#818CF8":S.muted}}>
            <span style={{fontSize:t.lg?22:18,fontWeight:700,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:view===t.id?600:400}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Period Picker ─────────────────────────────────────────────────────────────
function PeriodPicker({filterMonth,filterYear,setFilterMonth,setFilterYear,S}) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",background:S.surface2,border:`1px solid ${S.border2}`,borderRadius:11,flex:2}}>
        <button className="btn" onClick={()=>setFilterMonth(m=>m===1?12:m-1)} style={{color:S.muted2,padding:"10px 12px",fontSize:16}}>‹</button>
        <span style={{flex:1,textAlign:"center",fontWeight:600,fontSize:14}}>{MONTH_SHORT[filterMonth-1]}</span>
        <button className="btn" onClick={()=>setFilterMonth(m=>m===12?1:m+1)} style={{color:S.muted2,padding:"10px 12px",fontSize:16}}>›</button>
      </div>
      <div style={{display:"flex",alignItems:"center",background:S.surface2,border:`1px solid ${S.border2}`,borderRadius:11,flex:1}}>
        <button className="btn" onClick={()=>setFilterYear(y=>y-1)} style={{color:S.muted2,padding:"10px",fontSize:16}}>‹</button>
        <span style={{flex:1,textAlign:"center",fontWeight:600,fontSize:14}}>{filterYear}</span>
        <button className="btn" onClick={()=>setFilterYear(y=>y+1)} style={{color:S.muted2,padding:"10px",fontSize:16}}>›</button>
      </div>
    </div>
  );
}

// ─── Balance Card ──────────────────────────────────────────────────────────────
function BalanceCard({allNet,monthNet,currency,onSettle,S}) {
  const abs=Math.abs(allNet),absM=Math.abs(monthNet),settled=abs<0.01;
  return (
    <div style={{background:"#0D0D0D",border:`1px solid ${settled?"#14532D":S.border2}`,borderRadius:18,padding:"18px 20px",marginBottom:12}}>
      <div style={{fontSize:11,color:S.muted,fontWeight:600,letterSpacing:1,marginBottom:10}}>OVERALL BALANCE</div>
      {settled ? (
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"#052E16",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✓</div>
          <div><div style={{fontWeight:700,fontSize:18,color:"#6EE7B7"}}>All settled up!</div><div style={{fontSize:12,color:S.muted,marginTop:2}}>No one owes anything</div></div>
        </div>
      ) : (
        <>
          <div style={{fontSize:30,fontWeight:700,fontFamily:"'DM Mono',monospace",color:allNet>0?"#A78BFA":"#34D399",marginBottom:4}}>{fmt(abs,currency)}</div>
          <div style={{fontSize:14,color:S.muted2,marginBottom:14}}>{allNet>0?"🟣 Tim owes Yanne":"🟢 Yanne owes Tim"}<span style={{fontSize:12,color:S.muted}}> · all time</span></div>
          <button className="btn" onClick={onSettle} style={{width:"100%",padding:"13px",borderRadius:12,background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🤝 Settle Up — Record Payment
          </button>
        </>
      )}
      <div style={{height:1,background:S.border2,margin:"14px 0"}}/>
      <div style={{fontSize:11,color:S.muted,fontWeight:600,letterSpacing:1,marginBottom:6}}>THIS PERIOD</div>
      {absM<0.01
        ?<div style={{fontSize:13,color:"#6EE7B7",fontWeight:600}}>✓ Even this period</div>
        :<div style={{fontSize:14,color:S.muted2}}><span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:monthNet>0?"#A78BFA":"#34D399"}}>{fmt(absM,currency)}</span><span style={{marginLeft:8}}>{monthNet>0?"Tim owes Yanne":"Yanne owes Tim"}</span></div>
      }
    </div>
  );
}

// ─── Expense Row ───────────────────────────────────────────────────────────────
function ExpenseRow({record,onEdit,getCat,currency,S}) {
  if (record.isSettlement) return (
    <div className="row" onClick={()=>onEdit(record)} style={{background:"#071A0F"}}>
      <div style={{width:40,height:40,borderRadius:11,background:"#052E16",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🤝</div>
      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:"#6EE7B7"}}>Settled Up</div><div style={{fontSize:11,color:"#4ADE80",marginTop:2}}>{record.date} · {record.note}</div></div>
      <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14,color:"#6EE7B7"}}>-{fmt(record.amount,record.currency||currency)}</div><div style={{fontSize:10,color:"#4ADE80"}}>settlement</div></div>
    </div>
  );
  const cat=getCat(record.category);
  const user=USERS.find(u=>u.id===record.payer)||USERS[0];
  const sp=record.split||"equal";
  const owed=owedDesc(record.payer,sp,record.amount,record.currency||currency);
  return (
    <div className="row" onClick={()=>onEdit(record)}>
      <div style={{width:40,height:40,borderRadius:11,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{record.store||record.note||cat.label}</div>
        <div style={{fontSize:11,color:S.muted,marginTop:2,display:"flex",gap:5,flexWrap:"wrap"}}>
          <span>{record.date}</span>
          <span style={{color:cat.color}}>· {cat.label}</span>
          <span style={{color:user.color}}>· {user.label} paid</span>
        </div>
        {owed&&<div style={{fontSize:11,color:"#818CF8",marginTop:2}}>{owed}</div>}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14}}>{fmt(record.amount,record.currency||currency)}</div>
        <div style={{fontSize:10,color:S.muted,marginTop:1}}>{splitLabel(sp)}</div>
      </div>
    </div>
  );
}

// ─── Home View ─────────────────────────────────────────────────────────────────
function HomeView({filtered,total,allNet,monthNet,filterMonth,filterYear,setFilterMonth,setFilterYear,onEdit,onSettle,getCat,currency,S}) {
  const recent=[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S}/>
      <BalanceCard allNet={allNet} monthNet={monthNet} currency={currency} onSettle={onSettle} S={S}/>
      <div style={{color:S.muted,fontSize:11,fontWeight:600,letterSpacing:1,marginBottom:8}}>RECENT · {MONTH_SHORT[filterMonth-1]} {filterYear} · {fmt(total,currency)}</div>
      {recent.length===0
        ?<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses — tap + Add to get started</div>
        :<div className="card" style={{overflow:"hidden"}}>{recent.map(r=><ExpenseRow key={r.id} record={r} onEdit={onEdit} getCat={getCat} currency={currency} S={S}/>)}</div>
      }
    </div>
  );
}

// ─── Expense Form Fields ───────────────────────────────────────────────────────
function ExpenseFields({form,setForm,onCameraClick,onLibraryClick,isAnalyzing,categories,stores,payMethods,S,showPhoto=true}) {
  return (
    <>
      {showPhoto && (
        <div>
          <div className={`scan-zone${isAnalyzing?" shimmer":""}`} onClick={onCameraClick} style={{position:"relative",overflow:"hidden"}}>
            {form.photo ? (
              <>
                <img src={form.photo} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.22}}/>
                <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
                  <div style={{fontSize:22}}>{isAnalyzing?"🔍":"✓"}</div>
                  <div style={{fontSize:12,color:"#888"}}>{isAnalyzing?"Scanning...":"Scanned · tap to retake"}</div>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:24}}>📷</div>
                <div style={{fontWeight:600,fontSize:13,color:"#555"}}>Take Photo / Scan Receipt</div>
                <div style={{fontSize:11,color:"#444"}}>AI fills in amount, store & category</div>
              </>
            )}
          </div>
          <button className="btn upload-btn" style={{marginTop:8}} onClick={onLibraryClick}>
            🖼️ Upload from photo library
          </button>
        </div>
      )}

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>AMOUNT</label>
        <div style={{display:"flex",gap:8}}>
          <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{width:"auto",flexShrink:0}}>
            {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
          <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:18,flex:1}}/>
        </div>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>STORE</label>
        <select value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}>
          <option value="">Select store...</option>
          {stores.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:8,letterSpacing:1}}>CATEGORY</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
          {categories.map(cat=>(
            <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))} className="btn"
              style={{padding:"8px 4px",borderRadius:10,background:form.category===cat.id?cat.color+"22":S.surface2,border:`1.5px solid ${form.category===cat.id?cat.color:"transparent"}`,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <span style={{fontSize:18}}>{cat.icon}</span>
              <span style={{fontSize:9,fontWeight:500,color:form.category===cat.id?cat.color:S.muted,textAlign:"center",lineHeight:1.2}}>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>NOTE</label>
        <input placeholder="Optional" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>DATE</label>
        <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:8,letterSpacing:1}}>PAID BY</label>
        <div style={{display:"flex",gap:6,background:S.surface2,padding:4,borderRadius:12}}>
          {USERS.map(u=>(
            <button key={u.id} onClick={()=>setForm(f=>({...f,payer:u.id}))} className="seg-btn"
              style={{background:form.payer===u.id?u.color+"22":"transparent",border:`1.5px solid ${form.payer===u.id?u.color:"transparent"}`,color:form.payer===u.id?u.color:S.muted2}}>
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:8,letterSpacing:1}}>SPLIT</label>
        <div style={{display:"flex",gap:6,background:S.surface2,padding:4,borderRadius:12}}>
          {[{id:"equal",label:"Split equally"},{id:"yanne",label:"Yanne only"},{id:"tim",label:"Tim only"}].map(o=>(
            <button key={o.id} onClick={()=>setForm(f=>({...f,split:o.id}))} className="split-btn"
              style={{background:form.split===o.id?"#1E1B4B":"transparent",border:`1.5px solid ${form.split===o.id?"#6366F1":"transparent"}`,color:form.split===o.id?"#A5B4FC":S.muted2}}>
              {o.label}
            </button>
          ))}
        </div>
        {form.amount&&!isNaN(form.amount)&&Number(form.amount)>0&&(
          <div style={{marginTop:8,padding:"10px 14px",background:S.surface2,borderRadius:10,fontSize:12,color:"#A5B4FC"}}>
            {(()=>{
              const a=Number(form.amount);
              const p=USERS.find(u=>u.id===form.payer)||USERS[0];
              const o=USERS.find(u=>u.id!==form.payer)||USERS[1];
              if(form.split==="equal") return`${p.label} pays ${fmt(a,form.currency)} → ${o.label} owes ${fmt(a/2,form.currency)}`;
              if(form.split===form.payer) return`${p.label}'s own expense — no debt`;
              return`${p.label} fronts ${fmt(a,form.currency)} → ${o.label} owes full ${fmt(a,form.currency)}`;
            })()}
          </div>
        )}
      </div>

      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>PAYMENT METHOD</label>
        <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
          {payMethods.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </>
  );
}

// ─── Add View ──────────────────────────────────────────────────────────────────
function AddView({form,setForm,onSave,onCameraClick,onLibraryClick,onBulkClick,isAnalyzing,syncing,categories,stores,payMethods,S}) {
  return (
    <div className="slide-up">
      <button className="btn upload-btn" onClick={onBulkClick} style={{marginBottom:14,background:"#0F172A",borderColor:"#1E3A5F",color:"#93C5FD",height:58,gap:10}}>
        <span style={{fontSize:22}}>🏦</span>
        <div style={{textAlign:"left"}}>
          <div style={{fontWeight:700,fontSize:13}}>Scan Bank Statement</div>
          <div style={{fontSize:11,opacity:0.7}}>Import multiple transactions at once</div>
        </div>
      </button>
      <div className="card" style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        <ExpenseFields form={form} setForm={setForm} onCameraClick={onCameraClick} onLibraryClick={onLibraryClick} isAnalyzing={isAnalyzing} categories={categories} stores={stores} payMethods={payMethods} S={S}/>
      </div>
      <button onClick={onSave} disabled={syncing} className="btn" style={{width:"100%",marginTop:14,padding:"15px",background:syncing?"#3730A3":"#6366F1",borderRadius:13,fontSize:15,fontWeight:700,color:"#fff",opacity:syncing?0.7:1}}>
        {syncing?"Saving...":"Save Expense"}
      </button>
    </div>
  );
}

// ─── Edit Record Modal ─────────────────────────────────────────────────────────
function EditRecordModal({record,categories,stores,payMethods,onSave,onDelete,onClose,isAnalyzing,onPhotoClick,S}) {
  const [form,setForm]           = useState({...record});
  const [showConfirm,setConfirm] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:17}}>{record.isSettlement?"Settlement":"Edit Expense"}</div>
          <button className="btn" onClick={onClose} style={{color:S.muted2,fontSize:24,lineHeight:1}}>×</button>
        </div>

        {!record.isSettlement && (
          <div style={{marginBottom:12}}>
            {form.photo&&<img src={form.photo} alt="" style={{width:"100%",height:110,objectFit:"cover",borderRadius:12,marginBottom:8,opacity:0.65}}/>}
            <button className="btn upload-btn" onClick={onPhotoClick}>
              {isAnalyzing?"🔍 Scanning...":"🖼️ Upload / change photo"}
            </button>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <ExpenseFields form={form} setForm={setForm} onCameraClick={onPhotoClick} onLibraryClick={onPhotoClick} isAnalyzing={isAnalyzing} categories={categories} stores={stores} payMethods={payMethods} S={S} showPhoto={false}/>
        </div>

        <div style={{display:"flex",gap:10,marginTop:16}}>
          {showConfirm ? (
            <>
              <button className="btn" onClick={()=>setConfirm(false)} style={{flex:1,padding:"13px",borderRadius:11,background:S.surface2,fontSize:14,color:S.muted2}}>Cancel</button>
              <button className="btn" onClick={onDelete}               style={{flex:1,padding:"13px",borderRadius:11,background:"#7F1D1D",fontSize:14,fontWeight:700,color:"#FCA5A5"}}>Confirm Delete</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={()=>setConfirm(true)} style={{padding:"13px 16px",borderRadius:11,background:"#1C0A0A",color:"#FCA5A5",fontWeight:600,fontSize:14,border:"1px solid #7F1D1D"}}>Delete</button>
              <button className="btn" onClick={()=>onSave({...form,amount:Number(form.amount)})} style={{flex:1,padding:"13px",borderRadius:11,background:"#6366F1",fontSize:15,fontWeight:700,color:"#fff"}}>Save Changes</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generic Edit Item Modal ───────────────────────────────────────────────────
function EditItemModal({title,fields,initial,onSave,onDelete,onClose,S}) {
  const [vals,setVals]=useState({...initial});
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>{title}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fields.map(f=>(
            <div key={f.key}>
              <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5}}>{f.label.toUpperCase()}</label>
              {f.type==="color" ? (
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="color" value={vals[f.key]||"#6366F1"} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))} style={{width:48,height:40,padding:2,borderRadius:8,cursor:"pointer",flex:"none"}}/>
                  <span style={{fontSize:13,color:S.muted2}}>{vals[f.key]}</span>
                </div>
              ) : (
                <input placeholder={f.placeholder} value={vals[f.key]||""} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}/>
              )}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}>
          {onDelete&&<button className="btn" onClick={onDelete} style={{padding:"13px 16px",borderRadius:11,background:"#1C0A0A",color:"#FCA5A5",fontWeight:600,fontSize:14,border:"1px solid #7F1D1D"}}>Delete</button>}
          <button className="btn" onClick={()=>onSave(vals)} style={{flex:1,padding:"13px",borderRadius:11,background:"#6366F1",fontSize:15,fontWeight:700,color:"#fff"}}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats View ────────────────────────────────────────────────────────────────
function StatsView({catStats,total,allNet,monthNet,filtered,filterMonth,filterYear,setFilterMonth,setFilterYear,onSettle,currency,S}) {
  const maxCat=catStats[0]?.total||1;
  const exp=filtered.filter(r=>!r.isSettlement);
  const storeMap={}; exp.forEach(r=>{const s=r.store||"—";storeMap[s]=(storeMap[s]||0)+r.amount;});
  const topStores=Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const pmMap={}; exp.forEach(r=>{const m=r.paymentMethod||"Other";pmMap[m]=(pmMap[m]||0)+r.amount;});
  const pmList=Object.entries(pmMap).sort((a,b)=>b[1]-a[1]);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S}/>
      <BalanceCard allNet={allNet} monthNet={monthNet} currency={currency} onSettle={onSettle} S={S}/>
      <div className="card" style={{padding:18,marginBottom:12}}>
        <div style={{color:S.muted,fontSize:11,fontWeight:600,letterSpacing:1,marginBottom:4}}>TOTAL SPENT THIS PERIOD</div>
        <div style={{fontSize:30,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(total,currency)}</div>
      </div>
      {catStats.length===0
        ?<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses this period</div>
        :<div className="card" style={{overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>BY CATEGORY</div>
          {catStats.map(c=>(
            <div key={c.id} style={{padding:"12px 16px",borderTop:`1px solid ${S.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{fontWeight:500,fontSize:14}}>{c.label}</span>
                  <span style={{fontSize:11,color:S.muted,background:S.surface2,padding:"2px 7px",borderRadius:6}}>{c.count}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:c.color}}>{total>0?Math.round((c.total/total)*100):0}%</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14}}>{fmt(c.total,currency)}</span>
                </div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${(c.total/maxCat)*100}%`,background:c.color}}/></div>
            </div>
          ))}
        </div>
      }
      {topStores.length>0&&<div className="card" style={{overflow:"hidden",marginBottom:12}}>
        <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>TOP STORES</div>
        {topStores.map(([s,a],i)=>(
          <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderTop:`1px solid ${S.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{color:S.muted,fontSize:11,width:16}}>{i+1}</span>
              <span style={{fontSize:14,fontWeight:500}}>{s}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:S.muted}}>{total>0?Math.round((a/total)*100):0}%</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{fmt(a,currency)}</span>
            </div>
          </div>
        ))}
      </div>}
      {pmList.length>0&&<div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>BY PAYMENT METHOD</div>
        {pmList.map(([m,a])=>(
          <div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderTop:`1px solid ${S.border}`}}>
            <span style={{fontSize:14,fontWeight:500}}>{m}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:S.muted}}>{total>0?Math.round((a/total)*100):0}%</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{fmt(a,currency)}</span>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── History View ──────────────────────────────────────────────────────────────
function HistoryView({records,onEdit,getCat,currency,S}) {
  const sorted=[...records].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const grouped=sorted.reduce((acc,r)=>{const k=r.date.slice(0,7);if(!acc[k])acc[k]=[];acc[k].push(r);return acc;},{});
  return (
    <div className="slide-up">
      {Object.keys(grouped).length===0&&<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses yet</div>}
      {Object.entries(grouped).map(([month,recs])=>{
        const [y,m]=month.split("-");
        const t=recs.filter(r=>!r.isSettlement).reduce((s,r)=>s+r.amount,0);
        return (
          <div key={month} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:11,color:S.muted,letterSpacing:1}}>{MONTH_SHORT[parseInt(m)-1].toUpperCase()} {y}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:S.muted2}}>{fmt(t,currency)}</span>
            </div>
            <div className="card" style={{overflow:"hidden"}}>{recs.map(r=><ExpenseRow key={r.id} record={r} onEdit={onEdit} getCat={getCat} currency={currency} S={S}/>)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings View ─────────────────────────────────────────────────────────────
function SettingsView({categories,stores,payMethods,openModal,S}) {
  const Sec=({title,items,onAdd,onEdit,render})=>(
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:11,color:S.muted,letterSpacing:1}}>{title}</div>
        <button className="btn" onClick={onAdd} style={{fontSize:12,color:"#818CF8",fontWeight:600}}>+ Add</button>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        {items.map((item,i)=>(
          <div key={i} className="row" onClick={()=>onEdit(item)}>
            {render(item)}
            <span style={{color:S.muted,fontSize:12,marginLeft:"auto"}}>Edit ›</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="slide-up">
      <Sec title="CATEGORIES (A–Z)" items={categories} onAdd={()=>openModal("addCat")} onEdit={c=>openModal("editCat",c)}
        render={c=><><div style={{width:36,height:36,borderRadius:10,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.icon}</div><span style={{flex:1,fontSize:14,fontWeight:500}}>{c.label}</span><div style={{width:10,height:10,borderRadius:"50%",background:c.color}}/></>}
      />
      <Sec title="STORES (A–Z)" items={stores} onAdd={()=>openModal("addStore")} onEdit={s=>openModal("editStore",s)}
        render={s=><span style={{flex:1,fontSize:14}}>{s}</span>}
      />
      <Sec title="PAYMENT METHODS (A–Z)" items={payMethods} onAdd={()=>openModal("addPM")} onEdit={m=>openModal("editPM",m)}
        render={m=><span style={{flex:1,fontSize:14}}>{m}</span>}
      />
    </div>
  );
}
