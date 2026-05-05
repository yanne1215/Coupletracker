import { useState, useRef, useCallback, useEffect } from "react";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://lkxsliacyqqkiazmepja.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHNsaWFjeXFxa2lhem1lcGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODI1MDUsImV4cCI6MjA5MjQ1ODUwNX0.7iKHGbPlgIgMx8TcnV09EfZ95XsUPvETluAiBPcA_pM";

const db = {
  async getAll() {
    const res = await fetch(`${SUPA_URL}/rest/v1/expenses?order=date.desc,id.desc`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    if (!res.ok) throw new Error("fetch failed");
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id, date: r.date, store: r.store || "",
      category: r.category || "other", amount: Number(r.amount),
      note: r.note || "", payer: r.payer || "split",
      paymentMethod: r.payment_method || "Credit Card",
      currency: r.currency || "CAD", photo: null,
    }));
  },
  async insert(rec) {
    const res = await fetch(`${SUPA_URL}/rest/v1/expenses`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ date: rec.date, store: rec.store, category: rec.category, amount: rec.amount, note: rec.note, payer: rec.payer, payment_method: rec.paymentMethod, currency: rec.currency })
    });
    if (!res.ok) throw new Error("insert failed");
    return (await res.json())[0].id;
  },
  async update(id, rec) {
    await fetch(`${SUPA_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ date: rec.date, store: rec.store, category: rec.category, amount: rec.amount, note: rec.note, payer: rec.payer, payment_method: rec.paymentMethod, currency: rec.currency })
    });
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
  { id: "yanne", label: "Yanne", color: "#A78BFA" },
  { id: "tim",   label: "Tim",   color: "#34D399" },
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

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DEFAULT_CATEGORIES = [
  { id:"groceries",     label:"Groceries",    icon:"🛒", color:"#10B981" },
  { id:"dining",        label:"Dining",        icon:"🍽️", color:"#F59E0B" },
  { id:"transport",     label:"Transport",     icon:"🚗", color:"#3B82F6" },
  { id:"shopping",      label:"Shopping",      icon:"🛍️", color:"#8B5CF6" },
  { id:"entertainment", label:"Entertainment", icon:"🎬", color:"#EF4444" },
  { id:"travel",        label:"Travel",        icon:"✈️", color:"#06B6D4" },
  { id:"health",        label:"Health",        icon:"💊", color:"#EC4899" },
  { id:"utilities",     label:"Utilities",     icon:"⚡", color:"#F97316" },
  { id:"home",          label:"Home",          icon:"🏠", color:"#6B7280" },
  { id:"other",         label:"Other",         icon:"📦", color:"#64748B" },
];

const DEFAULT_PAYMENT_METHODS = ["Credit Card","Debit Card","Cash","E-Transfer","PayPal","Apple Pay","Google Pay","Other"];

const DEFAULT_STORES = [
  "Loblaws","No Frills","Metro","Sobeys","Costco","Walmart",
  "Tim Hortons","McDonald's","A&W","Harvey's","Swiss Chalet","The Keg",
  "Canadian Tire","Home Depot","IKEA","Shoppers Drug Mart",
  "Petro-Canada","Esso","Shell","Cineplex","Sport Chek","Winners",
  "LCBO","Beer Store","Best Buy","Dollarama",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, code = "CAD") {
  const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
  const dec = code === "JPY" ? 0 : 2;
  return `${cur.symbol}${Number(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
}
function lsGet(k, fb) { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch { return fb; } }
function lsSet(k, v)  { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} }

const today    = new Date().toISOString().split("T")[0];
const nowMonth = new Date().getMonth()+1;
const nowYear  = new Date().getFullYear();

const S = {
  bg:"#0A0A0A", surface:"#111111", surface2:"#1A1A1A",
  border:"#1E1E1E", border2:"#2A2A2A",
  text:"#F5F5F5", muted:"#555555", muted2:"#888888",
};

// ─── Split logic (Splitwise style) ────────────────────────────────────────────
// Each expense: payer pays full amount
// For split: both owe half → payer is owed half by the other
// Returns net: positive = Tim owes Yanne, negative = Yanne owes Tim
function calcBalance(records) {
  let net = 0; // positive → Tim owes Yanne
  records.forEach(r => {
    const a = r.amount;
    if (r.payer === "yanne") {
      // Yanne paid → if split, Tim owes half
      if (r.split === "equal") net += a / 2;
      else if (r.split === "yanne") net += 0; // Yanne's expense only
      else if (r.split === "tim")   net += a;  // Tim's expense, Yanne fronted
    } else if (r.payer === "tim") {
      if (r.split === "equal") net -= a / 2;
      else if (r.split === "tim")   net -= 0;
      else if (r.split === "yanne") net -= a;
    }
  });
  return net;
}

// Per-expense display helpers
function splitLabel(payer, split) {
  if (split === "equal")  return "Split equally";
  if (split === "yanne")  return "Yanne's expense";
  if (split === "tim")    return "Tim's expense";
  return "Split equally";
}

function owedDesc(payer, split, amount, currency) {
  const half = fmt(amount/2, currency);
  const full = fmt(amount, currency);
  if (split === "equal") {
    if (payer === "yanne") return `Tim owes Yanne ${half}`;
    if (payer === "tim")   return `Yanne owes Tim ${half}`;
  }
  if (split === "yanne" && payer === "tim")  return `Yanne owes Tim ${full}`;
  if (split === "tim"   && payer === "yanne") return `Tim owes Yanne ${full}`;
  return "";
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]                   = useState("home");
  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [syncing, setSyncing]             = useState(false);
  const [categories, setCategories]       = useState(() => lsGet("ct_cat", DEFAULT_CATEGORIES));
  const [stores, setStores]               = useState(() => lsGet("ct_stores", DEFAULT_STORES));
  const [payMethods, setPayMethods]       = useState(() => lsGet("ct_pm", DEFAULT_PAYMENT_METHODS));
  const [currency, setCurrency]           = useState(() => lsGet("ct_cur", "CAD"));
  const [filterMonth, setFilterMonth]     = useState(nowMonth);
  const [filterYear, setFilterYear]       = useState(nowYear);
  const [toast, setToast]                 = useState(null);
  const [modal, setModal]                 = useState(null); // "addCat"|"editCat"|"addStore"|"editStore"|"addPM"|"editPM"|"currency"|"editRecord"|"deleteConfirm"
  const [modalData, setModalData]         = useState(null);
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const fileRef  = useRef();
  const editFileRef = useRef();

  const EMPTY_FORM = { date:today, store:"", category:"groceries", amount:"", note:"", payer:"yanne", split:"equal", paymentMethod:"Credit Card", currency:"CAD", photo:null };
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    db.getAll()
      .then(rows => {
        // migrate old records that have payer=split → payer=yanne, split=equal
        const migrated = rows.map(r => ({
          ...r,
          split: r.split || (r.payer === "split" ? "equal" : "equal"),
          payer: r.payer === "split" ? "yanne" : r.payer,
        }));
        setRecords(migrated);
        setLoading(false);
      })
      .catch(() => { showToast("Could not load records","err"); setLoading(false); });
  }, []);

  useEffect(() => { lsSet("ct_cat",    categories);  }, [categories]);
  useEffect(() => { lsSet("ct_stores", stores);       }, [stores]);
  useEffect(() => { lsSet("ct_pm",     payMethods);   }, [payMethods]);
  useEffect(() => { lsSet("ct_cur",    currency);     }, [currency]);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),2800); };
  const getCat    = id => categories.find(c=>c.id===id) || categories[categories.length-1];
  const openModal = (name, data=null) => { setModal(name); setModalData(data); };
  const closeModal = () => { setModal(null); setModalData(null); };

  // ── Photo scanning ──
  const handlePhoto = useCallback(async (file, setter) => {
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64  = e.target.result.split(",")[1];
      const catList = categories.map(c=>c.id).join("|");
      try {
        const res  = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514", max_tokens:500,
            messages:[{ role:"user", content:[
              { type:"image", source:{ type:"base64", media_type:file.type, data:base64 } },
              { type:"text", text:`Analyze this receipt/photo. Respond ONLY with JSON:\n{"amount":number,"store":"Canadian retailer or exact name (Loblaws,No Frills,Metro,Sobeys,Costco,Walmart,Tim Hortons,McDonald's,A&W,Harvey's,The Keg,Canadian Tire,Home Depot,IKEA,Shoppers Drug Mart,Petro-Canada,Esso,Cineplex,Sport Chek,LCBO,Beer Store,Best Buy,Dollarama)","category":"one of [${catList}]","note":"under 40 chars","currency":"CAD|USD|EUR|GBP|HKD|TWD|JPY|AUD"}` }
            ]}]
          })
        });
        const data   = await res.json();
        const text   = data.content?.map(i=>i.text||"").join("")||"";
        const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
        setter(f => ({ ...f, amount:parsed.amount||"", store:parsed.store||"", category:parsed.category||"other", note:parsed.note||"", currency:parsed.currency||f.currency, photo:e.target.result }));
        showToast("Receipt scanned!");
      } catch {
        setter(f => ({ ...f, photo:e.target.result }));
        showToast("Photo uploaded — fill in details","info");
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  }, [categories]);

  // ── Save new ──
  const handleSave = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount)<=0) { showToast("Enter a valid amount","err"); return; }
    setSyncing(true);
    const newRec = { ...form, amount:Number(form.amount) };
    try {
      const id = await db.insert(newRec);
      newRec.id = id;
      setRecords(r=>[newRec,...r]);
      setForm(EMPTY_FORM);
      setView("home");
      showToast("Expense saved");
    } catch { showToast("Failed to save","err"); }
    setSyncing(false);
  };

  // ── Edit existing ──
  const handleEditSave = async (edited) => {
    setSyncing(true);
    try {
      await db.update(edited.id, edited);
      setRecords(r=>r.map(x=>x.id===edited.id?edited:x));
      closeModal();
      showToast("Updated");
    } catch { showToast("Failed to update","err"); }
    setSyncing(false);
  };

  // ── Delete ──
  const handleDelete = async (id) => {
    setSyncing(true);
    try {
      await db.remove(id);
      setRecords(r=>r.filter(x=>x.id!==id));
      closeModal();
      showToast("Deleted","info");
    } catch { showToast("Failed to delete","err"); }
    setSyncing(false);
  };

  // ── Derived data ──
  const filtered   = records.filter(r=>{ const d=new Date(r.date); return d.getMonth()+1===filterMonth&&d.getFullYear()===filterYear; });
  const total      = filtered.reduce((s,r)=>s+r.amount,0);
  const catStats   = categories.map(cat=>({ ...cat, total:filtered.filter(r=>r.category===cat.id).reduce((s,r)=>s+r.amount,0), count:filtered.filter(r=>r.category===cat.id).length })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  // Splitwise balance across ALL records
  const allNet = records.reduce((net,r)=>{
    const a = r.amount;
    const sp = r.split||"equal";
    if (r.payer==="yanne") {
      if (sp==="equal") return net + a/2;
      if (sp==="tim")   return net + a;
      return net;
    } else if (r.payer==="tim") {
      if (sp==="equal") return net - a/2;
      if (sp==="yanne") return net - a;
      return net;
    }
    return net;
  }, 0);

  // Month balance
  const monthNet = filtered.reduce((net,r)=>{
    const a = r.amount;
    const sp = r.split||"equal";
    if (r.payer==="yanne") {
      if (sp==="equal") return net + a/2;
      if (sp==="tim")   return net + a;
      return net;
    } else if (r.payer==="tim") {
      if (sp==="equal") return net - a/2;
      if (sp==="yanne") return net - a;
      return net;
    }
    return net;
  }, 0);

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:0;}
    .btn{cursor:pointer;border:none;outline:none;transition:all 0.15s;background:transparent;}
    .btn:active{transform:scale(0.96);}
    input,select,textarea{font-family:'DM Sans',sans-serif;background:#1A1A1A;border:1.5px solid #2A2A2A;border-radius:10px;color:#F5F5F5;padding:11px 14px;width:100%;font-size:15px;outline:none;transition:border-color 0.15s;-webkit-appearance:none;}
    input:focus,select:focus{border-color:#6366F1;}
    input::placeholder{color:#444;}
    select option{background:#1A1A1A;color:#F5F5F5;}
    .card{background:#111111;border-radius:16px;border:1px solid #1E1E1E;}
    .slide-up{animation:slideUp 0.22s ease;}
    @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .toast-wrap{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;animation:toastIn 0.2s ease;white-space:nowrap;}
    @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    .nav-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;border:none;background:transparent;flex:1;transition:color 0.15s;font-family:'DM Sans',sans-serif;padding:0;}
    .scan-zone{border:1.5px dashed #2A2A2A;border-radius:14px;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:110px;cursor:pointer;transition:all 0.15s;}
    .scan-zone:hover{border-color:#6366F1;}
    .upload-btn{border:1.5px dashed #2A2A2A;border-radius:12px;background:#161616;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;cursor:pointer;transition:all 0.15s;font-size:13px;color:#555;font-weight:500;}
    .upload-btn:hover{border-color:#6366F1;color:#818CF8;}
    .progress-bar{height:5px;background:#1E1E1E;border-radius:3px;overflow:hidden;margin-top:6px;}
    .progress-fill{height:100%;border-radius:3px;transition:width 0.6s ease;}
    .shimmer{background:linear-gradient(90deg,#111 25%,#1E1E1E 50%,#111 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite;}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:800;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.18s ease;}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .modal{background:#111;border:1px solid #222;border-radius:22px 22px 0 0;padding:22px 18px;width:100%;max-width:480px;animation:slideModal 0.22s ease;max-height:90vh;overflow-y:auto;}
    @keyframes slideModal{from{transform:translateY(16px)}to{transform:translateY(0)}}
    .row{display:flex;align-items:center;padding:13px 16px;gap:12px;border-bottom:1px solid #1A1A1A;transition:background 0.1s;}
    .row:last-child{border-bottom:none;}
    .row:active{background:#141414;}
    .seg-btn{flex:1;padding:9px 4px;border-radius:9px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:'DM Sans',sans-serif;}
    .split-btn{flex:1;padding:10px 6px;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;font-family:'DM Sans',sans-serif;text-align:center;}
    .tag-green{background:#052E16;color:#6EE7B7;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;}
    .tag-purple{background:#1E1B4B;color:#A5B4FC;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;}
    .tag-orange{background:#431407;color:#FED7AA;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;}
  `;
  const NAV_H = 58;

  return (
    <div style={{minHeight:"100vh",background:S.bg,fontFamily:"'DM Sans',sans-serif",color:S.text}}>
      <style>{CSS}</style>

      {syncing && <div style={{position:"fixed",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#6366F1,#818CF8)",zIndex:9999,backgroundSize:"200% 100%",animation:"shimmer 1s linear infinite"}}/>}

      {toast && (
        <div className="toast-wrap">
          <div style={{background:toast.type==="err"?"#3B0000":toast.type==="info"?"#0F172A":"#052E16",color:toast.type==="err"?"#FCA5A5":toast.type==="info"?"#93C5FD":"#6EE7B7",padding:"10px 20px",borderRadius:50,fontSize:13,fontWeight:500,border:`1px solid ${toast.type==="err"?"#7F1D1D":toast.type==="info"?"#1E3A5F":"#14532D"}`}}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* ── Edit Record Modal ── */}
      {modal==="editRecord" && modalData && (
        <EditRecordModal
          record={modalData} categories={categories} stores={stores} payMethods={payMethods}
          onSave={handleEditSave} onDelete={()=>handleDelete(modalData.id)}
          onClose={closeModal} isAnalyzing={isAnalyzing}
          onPhoto={(file)=>handlePhoto(file, updated=>setModalData(d=>({...d,...updated})))}
          editFileRef={editFileRef} S={S}
        />
      )}

      {/* ── Currency Modal ── */}
      {modal==="currency" && (
        <div className="overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>Select Currency</div>
            {CURRENCIES.map(c=>(
              <button key={c.code} className="btn" onClick={()=>{setCurrency(c.code);closeModal();showToast(`Currency: ${c.code}`);}}
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

      {/* ── Settings Modals ── */}
      {(modal==="addCat"||modal==="editCat") && (
        <EditItemModal
          title={modal==="addCat"?"New Category":"Edit Category"}
          fields={[
            {key:"label",label:"Name",placeholder:"Category name"},
            {key:"icon", label:"Emoji",placeholder:"🏷️"},
            {key:"color",label:"Color",type:"color"},
          ]}
          initial={modalData||{label:"",icon:"🏷️",color:"#6366F1"}}
          onSave={val=>{
            if (!val.label.trim()) return;
            if (modal==="addCat") {
              const id=val.label.toLowerCase().replace(/\s+/g,"_")+"_"+Date.now();
              setCategories(c=>[...c,{id,label:val.label.trim(),icon:val.icon||"🏷️",color:val.color||"#6366F1"}]);
            } else {
              setCategories(c=>c.map(x=>x.id===modalData.id?{...x,...val}:x));
            }
            closeModal(); showToast(modal==="addCat"?"Category added":"Category updated");
          }}
          onDelete={modal==="editCat"?()=>{
            if(categories.length<=1){showToast("Need at least 1 category","err");return;}
            setCategories(c=>c.filter(x=>x.id!==modalData.id));
            closeModal(); showToast("Category deleted","info");
          }:null}
          onClose={closeModal} S={S}
        />
      )}

      {(modal==="addStore"||modal==="editStore") && (
        <EditItemModal
          title={modal==="addStore"?"New Store":"Edit Store"}
          fields={[{key:"label",label:"Store name",placeholder:"e.g. Loblaws"}]}
          initial={modalData?{label:modalData}:{label:""}}
          onSave={val=>{
            if (!val.label.trim()) return;
            if (modal==="addStore") {
              setStores(s=>[val.label.trim(),...s]);
            } else {
              setStores(s=>s.map(x=>x===modalData?val.label.trim():x));
            }
            closeModal(); showToast(modal==="addStore"?"Store added":"Store updated");
          }}
          onDelete={modal==="editStore"?()=>{
            setStores(s=>s.filter(x=>x!==modalData));
            closeModal(); showToast("Store deleted","info");
          }:null}
          onClose={closeModal} S={S}
        />
      )}

      {(modal==="addPM"||modal==="editPM") && (
        <EditItemModal
          title={modal==="addPM"?"New Payment Method":"Edit Payment Method"}
          fields={[{key:"label",label:"Method name",placeholder:"e.g. WeChat Pay"}]}
          initial={modalData?{label:modalData}:{label:""}}
          onSave={val=>{
            if (!val.label.trim()) return;
            if (modal==="addPM") {
              setPayMethods(m=>[...m,val.label.trim()]);
            } else {
              setPayMethods(m=>m.map(x=>x===modalData?val.label.trim():x));
            }
            closeModal(); showToast(modal==="addPM"?"Method added":"Method updated");
          }}
          onDelete={modal==="editPM"?()=>{
            if(payMethods.length<=1){showToast("Need at least 1","err");return;}
            setPayMethods(m=>m.filter(x=>x!==modalData));
            closeModal(); showToast("Deleted","info");
          }:null}
          onClose={closeModal} S={S}
        />
      )}

      {/* ── Header ── */}
      <div style={{background:S.surface,borderBottom:`1px solid ${S.border}`,padding:"52px 20px 14px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:S.muted,letterSpacing:1.5}}>YANNE & TIM</div>
            <div style={{fontSize:20,fontWeight:700,marginTop:1}}>
              {view==="home"&&"Overview"}{view==="add"&&"Add Expense"}
              {view==="stats"&&"Statistics"}{view==="history"&&"All Expenses"}{view==="settings"&&"Settings"}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn" onClick={()=>openModal("currency")} style={{background:S.surface2,border:`1px solid ${S.border2}`,borderRadius:10,padding:"8px 10px",color:S.muted2,fontSize:12,fontWeight:600}}>
              {CURRENCIES.find(c=>c.code===currency)?.flag} {currency}
            </button>
            {view==="home"&&<button className="btn" onClick={()=>setView("add")} style={{background:"#6366F1",color:"#fff",padding:"9px 14px",borderRadius:10,fontWeight:700,fontSize:14}}>+ Add</button>}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{maxWidth:480,margin:"0 auto",padding:`16px 14px ${NAV_H+16}px`}}>
        {loading ? (
          <div style={{textAlign:"center",color:S.muted,paddingTop:60}}>
            <div style={{fontSize:28,marginBottom:12}}>☁️</div>
            <div style={{fontSize:14}}>Loading records...</div>
          </div>
        ) : <>
          {view==="home"    && <HomeView     filtered={filtered} total={total} monthNet={monthNet} allNet={allNet} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} onEdit={r=>openModal("editRecord",r)} getCat={getCat} currency={currency} S={S}/>}
          {view==="add"     && <AddView      form={form} setForm={setForm} onSave={handleSave} onPhoto={(f)=>handlePhoto(f,setForm)} fileRef={fileRef} isAnalyzing={isAnalyzing} syncing={syncing} categories={categories} stores={stores} payMethods={payMethods} S={S}/>}
          {view==="stats"   && <StatsView    catStats={catStats} total={total} monthNet={monthNet} allNet={allNet} filtered={filtered} filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} currency={currency} S={S}/>}
          {view==="history" && <HistoryView  records={records} onEdit={r=>openModal("editRecord",r)} getCat={getCat} currency={currency} S={S}/>}
          {view==="settings"&& <SettingsView categories={categories} stores={stores} payMethods={payMethods} openModal={openModal} S={S}/>}
        </>}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:S.surface,borderTop:`1px solid ${S.border}`,height:NAV_H,display:"flex",alignItems:"center"}}>
        {[{id:"home",icon:"⊞",label:"Overview"},{id:"add",icon:"+",label:"Add"},{id:"stats",icon:"◑",label:"Stats"},{id:"history",icon:"≡",label:"History"},{id:"settings",icon:"⚙",label:"Settings"}].map(tab=>(
          <button key={tab.id} className="nav-btn btn" onClick={()=>setView(tab.id)} style={{color:view===tab.id?"#818CF8":S.muted,height:"100%"}}>
            <span style={{fontSize:tab.id==="add"?24:18,fontWeight:700,lineHeight:1}}>{tab.icon}</span>
            <span style={{fontSize:10,fontWeight:view===tab.id?600:400}}>{tab.label}</span>
          </button>
        ))}
      </div>

      <input type="file" ref={fileRef} accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files[0],setForm)}/>
      <input type="file" ref={editFileRef} accept="image/*" style={{display:"none"}} onChange={e=>handlePhoto(e.target.files[0],updated=>setModalData(d=>({...d,...updated})))}/>
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

// ─── Balance Card (Splitwise style) ───────────────────────────────────────────
function BalanceCard({allNet, monthNet, currency, S}) {
  const absAll   = Math.abs(allNet);
  const absMonth = Math.abs(monthNet);
  const allWho   = allNet>0?"Tim owes Yanne":"Yanne owes Tim";
  const monWho   = monthNet>0?"Tim owes Yanne":"Yanne owes Tim";
  return (
    <div style={{background:"#0D0D0D",border:`1px solid ${S.border2}`,borderRadius:18,padding:"18px 20px",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,color:S.muted,letterSpacing:1,marginBottom:12}}>BALANCE SUMMARY</div>
      {/* Overall */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:S.muted2,marginBottom:4}}>Overall (all time)</div>
        {absAll < 0.01 ? (
          <div style={{fontSize:17,fontWeight:700,color:"#6EE7B7"}}>✓ All settled up!</div>
        ) : (
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:24,fontWeight:700,fontFamily:"'DM Mono',monospace",color:allNet>0?"#A78BFA":"#34D399"}}>{fmt(absAll,currency)}</span>
            <span style={{fontSize:13,color:S.muted2}}>{allWho}</span>
          </div>
        )}
      </div>
      {/* Divider */}
      <div style={{height:1,background:S.border2,marginBottom:12}}/>
      {/* This month */}
      <div>
        <div style={{fontSize:11,color:S.muted2,marginBottom:4}}>This period</div>
        {absMonth < 0.01 ? (
          <div style={{fontSize:15,fontWeight:600,color:"#6EE7B7"}}>✓ Even this period</div>
        ) : (
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,fontFamily:"'DM Mono',monospace",color:monthNet>0?"#A78BFA":"#34D399"}}>{fmt(absMonth,currency)}</span>
            <span style={{fontSize:12,color:S.muted2}}>{monWho}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────
function ExpenseRow({record,onEdit,getCat,currency,S}) {
  const cat  = getCat(record.category);
  const user = USERS.find(u=>u.id===record.payer)||USERS[0];
  const sp   = record.split||"equal";
  const owed = owedDesc(record.payer, sp, record.amount, record.currency||currency);
  return (
    <div className="row" onClick={()=>onEdit(record)} style={{cursor:"pointer"}}>
      <div style={{width:40,height:40,borderRadius:11,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{record.store||record.note||cat.label}</div>
        <div style={{fontSize:11,color:S.muted,marginTop:2,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <span>{record.date}</span>
          <span style={{color:cat.color}}>· {cat.label}</span>
          <span style={{color:user.color}}>· {user.label} paid</span>
        </div>
        {owed && <div style={{fontSize:11,color:"#818CF8",marginTop:2}}>{owed}</div>}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14}}>{fmt(record.amount,record.currency||currency)}</div>
        <div style={{fontSize:10,color:S.muted,marginTop:1}}>{splitLabel(record.payer,sp)}</div>
      </div>
    </div>
  );
}

// ─── Home View ─────────────────────────────────────────────────────────────────
function HomeView({filtered,total,monthNet,allNet,filterMonth,filterYear,setFilterMonth,setFilterYear,onEdit,getCat,currency,S}) {
  const recent = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S}/>
      <BalanceCard allNet={allNet} monthNet={monthNet} currency={currency} S={S}/>
      <div style={{color:S.muted,fontSize:11,fontWeight:600,letterSpacing:1,marginBottom:8}}>RECENT · {MONTH_SHORT[filterMonth-1]} {filterYear} · {fmt(total,currency)}</div>
      {recent.length===0
        ?<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses — tap + Add to get started</div>
        :<div className="card" style={{overflow:"hidden"}}>{recent.map(r=><ExpenseRow key={r.id} record={r} onEdit={onEdit} getCat={getCat} currency={currency} S={S}/>)}</div>
      }
    </div>
  );
}

// ─── Expense Form Fields (shared by Add & Edit) ───────────────────────────────
function ExpenseFields({form,setForm,onPhoto,fileRef,isAnalyzing,categories,stores,payMethods,S,showPhotoPreview=true}) {
  return (
    <>
      {/* Photo zone */}
      {showPhotoPreview && (
        <div style={{marginBottom:12}}>
          <div className={`scan-zone${isAnalyzing?" shimmer":""}`} onClick={()=>fileRef.current?.click()} style={{position:"relative",overflow:"hidden"}}>
            {form.photo?(
              <>
                <img src={form.photo} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.22}}/>
                <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
                  <div style={{fontSize:22}}>{isAnalyzing?"🔍":"✓"}</div>
                  <div style={{fontSize:12,color:"#888",fontWeight:500}}>{isAnalyzing?"Scanning...":"Receipt scanned · tap camera to change"}</div>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:24}}>📷</div>
                <div style={{fontWeight:600,fontSize:13,color:"#555"}}>Take Photo / Scan Receipt</div>
                <div style={{fontSize:11,color:"#444"}}>AI detects amount, store & category</div>
              </>
            )}
          </div>
          {/* Upload from library */}
          <label className="upload-btn" style={{marginTop:8,display:"flex"}}>
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>onPhoto(e.target.files[0])}/>
            🖼️ Upload from library
          </label>
        </div>
      )}

      {/* Amount */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>AMOUNT</label>
        <div style={{display:"flex",gap:8}}>
          <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{width:"auto",flexShrink:0}}>
            {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
          <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:18,flex:1}}/>
        </div>
      </div>

      {/* Store */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>STORE</label>
        <select value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}>
          <option value="">Select store...</option>
          {stores.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Category */}
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

      {/* Note */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>NOTE</label>
        <input placeholder="Optional" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
      </div>

      {/* Date */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>DATE</label>
        <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
      </div>

      {/* Who paid */}
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

      {/* Split */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:8,letterSpacing:1}}>SPLIT</label>
        <div style={{display:"flex",gap:6,background:S.surface2,padding:4,borderRadius:12}}>
          {[
            {id:"equal", label:"Split equally"},
            {id:"yanne", label:"Yanne's only"},
            {id:"tim",   label:"Tim's only"},
          ].map(opt=>(
            <button key={opt.id} onClick={()=>setForm(f=>({...f,split:opt.id}))} className="split-btn"
              style={{background:form.split===opt.id?"#1E1B4B":"transparent",border:`1.5px solid ${form.split===opt.id?"#6366F1":"transparent"}`,color:form.split===opt.id?"#A5B4FC":S.muted2}}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* Preview */}
        {form.amount && !isNaN(form.amount) && Number(form.amount)>0 && (
          <div style={{marginTop:8,padding:"10px 14px",background:S.surface2,borderRadius:10,fontSize:12,color:"#A5B4FC"}}>
            {(() => {
              const a = Number(form.amount);
              const payer = USERS.find(u=>u.id===form.payer)||USERS[0];
              const other = USERS.find(u=>u.id!==form.payer)||USERS[1];
              if (form.split==="equal") return `${payer.label} pays ${fmt(a,form.currency)} → ${other.label} owes ${fmt(a/2,form.currency)}`;
              if (form.split===form.payer) return `${payer.label}'s own expense — no one owes anything`;
              return `${payer.label} fronts ${fmt(a,form.currency)} → ${other.label} owes full ${fmt(a,form.currency)}`;
            })()}
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div>
        <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5,letterSpacing:1}}>PAYMENT METHOD</label>
        <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
          {payMethods.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </>
  );
}

// ─── Add View ─────────────────────────────────────────────────────────────────
function AddView({form,setForm,onSave,onPhoto,fileRef,isAnalyzing,syncing,categories,stores,payMethods,S}) {
  return (
    <div className="slide-up">
      <div className="card" style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        <ExpenseFields form={form} setForm={setForm} onPhoto={onPhoto} fileRef={fileRef} isAnalyzing={isAnalyzing} categories={categories} stores={stores} payMethods={payMethods} S={S}/>
      </div>
      <button onClick={onSave} disabled={syncing} className="btn" style={{width:"100%",marginTop:14,padding:"15px",background:syncing?"#3730A3":"#6366F1",borderRadius:13,fontSize:15,fontWeight:700,color:"#fff",opacity:syncing?0.7:1}}>
        {syncing?"Saving...":"Save Expense"}
      </button>
    </div>
  );
}

// ─── Edit Record Modal ─────────────────────────────────────────────────────────
function EditRecordModal({record,categories,stores,payMethods,onSave,onDelete,onClose,isAnalyzing,onPhoto,editFileRef,S}) {
  const [form,setForm] = useState({...record});
  const [confirmDelete,setConfirmDelete] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:17}}>Edit Expense</div>
          <button className="btn" onClick={onClose} style={{color:S.muted2,fontSize:20}}>×</button>
        </div>

        {/* Photo preview + upload */}
        <div style={{marginBottom:12}}>
          {form.photo && (
            <img src={form.photo} alt="" style={{width:"100%",height:120,objectFit:"cover",borderRadius:12,marginBottom:8,opacity:0.7}}/>
          )}
          <label className="upload-btn" style={{display:"flex"}}>
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>onPhoto(e.target.files[0])}/>
            {isAnalyzing?"🔍 Scanning...":"🖼️ Upload / change photo"}
          </label>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <ExpenseFields form={form} setForm={setForm} onPhoto={onPhoto} fileRef={editFileRef} isAnalyzing={isAnalyzing} categories={categories} stores={stores} payMethods={payMethods} S={S} showPhotoPreview={false}/>
        </div>

        <div style={{display:"flex",gap:10,marginTop:16}}>
          {!confirmDelete ? (
            <>
              <button className="btn" onClick={()=>setConfirmDelete(true)} style={{padding:"13px 16px",borderRadius:11,background:"#1C0A0A",color:"#FCA5A5",fontWeight:600,fontSize:14,border:"1px solid #7F1D1D"}}>Delete</button>
              <button className="btn" onClick={()=>onSave({...form,amount:Number(form.amount)})} style={{flex:1,padding:"13px",borderRadius:11,background:"#6366F1",fontSize:15,fontWeight:700,color:"#fff"}}>Save Changes</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"13px",borderRadius:11,background:S.surface2,fontSize:14,fontWeight:500,color:S.muted2}}>Cancel</button>
              <button className="btn" onClick={onDelete} style={{flex:1,padding:"13px",borderRadius:11,background:"#7F1D1D",fontSize:14,fontWeight:700,color:"#FCA5A5"}}>Confirm Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generic Edit Item Modal ──────────────────────────────────────────────────
function EditItemModal({title,fields,initial,onSave,onDelete,onClose,S}) {
  const [vals,setVals] = useState({...initial});
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>{title}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fields.map(f=>(
            <div key={f.key}>
              <label style={{fontSize:11,fontWeight:600,color:S.muted,display:"block",marginBottom:5}}>{f.label.toUpperCase()}</label>
              {f.type==="color"
                ?<div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="color" value={vals[f.key]||"#6366F1"} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))} style={{width:48,height:40,padding:2,borderRadius:8,cursor:"pointer",flex:"none"}}/>
                  <span style={{fontSize:13,color:S.muted2}}>{vals[f.key]}</span>
                </div>
                :<input placeholder={f.placeholder} value={vals[f.key]||""} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}/>
              }
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}>
          {onDelete && <button className="btn" onClick={onDelete} style={{padding:"13px 16px",borderRadius:11,background:"#1C0A0A",color:"#FCA5A5",fontWeight:600,fontSize:14,border:"1px solid #7F1D1D"}}>Delete</button>}
          <button className="btn" onClick={()=>onSave(vals)} style={{flex:1,padding:"13px",borderRadius:11,background:"#6366F1",fontSize:15,fontWeight:700,color:"#fff"}}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats View ───────────────────────────────────────────────────────────────
function StatsView({catStats,total,monthNet,allNet,filtered,filterMonth,filterYear,setFilterMonth,setFilterYear,currency,S}) {
  const maxCat    = catStats[0]?.total||1;
  const storeMap  = {}; filtered.forEach(r=>{ const s=r.store||"—"; storeMap[s]=(storeMap[s]||0)+r.amount; });
  const topStores = Object.entries(storeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const pmMap     = {}; filtered.forEach(r=>{ pmMap[r.paymentMethod||"Other"]=(pmMap[r.paymentMethod||"Other"]||0)+r.amount; });
  const pmList    = Object.entries(pmMap).sort((a,b)=>b[1]-a[1]);
  return (
    <div className="slide-up">
      <PeriodPicker filterMonth={filterMonth} filterYear={filterYear} setFilterMonth={setFilterMonth} setFilterYear={setFilterYear} S={S}/>
      <BalanceCard allNet={allNet} monthNet={monthNet} currency={currency} S={S}/>
      <div className="card" style={{padding:18,marginBottom:12}}>
        <div style={{color:S.muted,fontSize:11,fontWeight:600,letterSpacing:1,marginBottom:4}}>TOTAL SPENT</div>
        <div style={{fontSize:30,fontWeight:700,fontFamily:"'DM Mono',monospace",letterSpacing:-1}}>{fmt(total,currency)}</div>
      </div>
      {catStats.length===0
        ?<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses this period</div>
        :<div className="card" style={{overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>BY CATEGORY</div>
          {catStats.map(cat=>(
            <div key={cat.id} style={{padding:"12px 16px",borderTop:`1px solid ${S.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{cat.icon}</span>
                  <span style={{fontWeight:500,fontSize:14}}>{cat.label}</span>
                  <span style={{fontSize:11,color:S.muted,background:S.surface2,padding:"2px 7px",borderRadius:6}}>{cat.count}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:cat.color}}>{total>0?Math.round((cat.total/total)*100):0}%</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14}}>{fmt(cat.total,currency)}</span>
                </div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${(cat.total/maxCat)*100}%`,background:cat.color}}/></div>
            </div>
          ))}
        </div>
      }
      {topStores.length>0&&(
        <div className="card" style={{overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>TOP STORES</div>
          {topStores.map(([store,amount],i)=>(
            <div key={store} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderTop:`1px solid ${S.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:S.muted,fontSize:11,fontFamily:"'DM Mono',monospace",width:16}}>{i+1}</span>
                <span style={{fontSize:14,fontWeight:500}}>{store}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:S.muted}}>{total>0?Math.round((amount/total)*100):0}%</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{fmt(amount,currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {pmList.length>0&&(
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"14px 16px 10px",fontWeight:600,fontSize:11,color:S.muted,letterSpacing:1}}>BY PAYMENT METHOD</div>
          {pmList.map(([method,amount])=>(
            <div key={method} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderTop:`1px solid ${S.border}`}}>
              <span style={{fontSize:14,fontWeight:500}}>{method}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:S.muted}}>{total>0?Math.round((amount/total)*100):0}%</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{fmt(amount,currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────
function HistoryView({records,onEdit,getCat,currency,S}) {
  const sorted  = [...records].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const grouped = sorted.reduce((acc,r)=>{ const k=r.date.slice(0,7); if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; },{});
  return (
    <div className="slide-up">
      {Object.keys(grouped).length===0&&<div className="card" style={{padding:32,textAlign:"center",color:S.muted}}>No expenses yet</div>}
      {Object.entries(grouped).map(([month,recs])=>{
        const [y,m]=month.split("-");
        const total=recs.reduce((s,r)=>s+r.amount,0);
        return (
          <div key={month} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:11,color:S.muted,letterSpacing:1}}>{MONTH_SHORT[parseInt(m)-1].toUpperCase()} {y}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:S.muted2}}>{fmt(total,currency)}</span>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              {recs.map(r=><ExpenseRow key={r.id} record={r} onEdit={onEdit} getCat={getCat} currency={currency} S={S}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────
function SettingsView({categories,stores,payMethods,openModal,S}) {
  const Section = ({title,items,onAdd,onEdit,renderItem}) => (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:11,color:S.muted,letterSpacing:1}}>{title}</div>
        <button className="btn" onClick={onAdd} style={{fontSize:12,color:"#818CF8",fontWeight:600}}>+ Add</button>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        {items.map((item,i)=>(
          <div key={i} className="row" onClick={()=>onEdit(item)} style={{cursor:"pointer"}}>
            {renderItem(item)}
            <span style={{color:S.muted,fontSize:12,marginLeft:"auto"}}>Edit ›</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="slide-up">
      <Section title="CATEGORIES" items={categories} onAdd={()=>openModal("addCat")} onEdit={cat=>openModal("editCat",cat)}
        renderItem={cat=>(
          <>
            <div style={{width:36,height:36,borderRadius:10,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cat.icon}</div>
            <span style={{flex:1,fontSize:14,fontWeight:500}}>{cat.label}</span>
            <div style={{width:10,height:10,borderRadius:"50%",background:cat.color}}/>
          </>
        )}
      />
      <Section title="STORES" items={stores} onAdd={()=>openModal("addStore")} onEdit={s=>openModal("editStore",s)}
        renderItem={s=><span style={{flex:1,fontSize:14}}>{s}</span>}
      />
      <Section title="PAYMENT METHODS" items={payMethods} onAdd={()=>openModal("addPM")} onEdit={m=>openModal("editPM",m)}
        renderItem={m=><span style={{flex:1,fontSize:14}}>{m}</span>}
      />
    </div>
  );
}
