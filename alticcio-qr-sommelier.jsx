import { useState, useEffect, useRef, useCallback } from "react";

const SHOPIFY_DOMAIN   = "alticciowinestore.co.uk";
const STOREFRONT_TOKEN = "cd62cb74df448bf274bcaa2e44eb9812";
const ADMIN_PIN        = "9876";
const STORAGE_KEY      = "alticcio_bar_wines_v1";

async function fetchShopifyWines() {
const query = `{ products(first: 50) { edges { node { id title handle description priceRange { minVariantPrice { amount } } variants(first: 1) { edges { node { availableForSale } } } tags } } } }`;
try {
const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
method: "POST",
headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN },
body: JSON.stringify({ query }),
});
const data = await res.json();
const edges = data?.data?.products?.edges || [];
return edges.map(({ node }) => {
const t = node.title.toLowerCase();
const type = t.includes("prosecco")||t.includes("champagne")||t.includes("sparkling")||t.includes("cremant")||t.includes("spumante") ? "sparkling"
: t.includes("rose")||t.includes("rose") ? "rose"
: t.includes("white")||t.includes("blanc")||t.includes("sauvignon")||t.includes("chardonnay") ? "white" : "red";
return {
id: node.id, name: node.title, region: "", vintage: "", type,
style: type === "red" ? "medium" : type === "sparkling" ? "dry" : "crisp",
desc: node.description || "", pairing: "",
bottlePrice: parseFloat(node.priceRange.minVariantPrice.amount).toFixed(2),
glass: false, glassPrice: "", bottle: true,
available: node.variants.edges[0]?.node?.availableForSale ?? true,
fromShopify: true, handle: node.handle,
};
});
} catch(e) { console.error("Shopify fetch failed:", e); return []; }
}

function scoreWine(wine, msg) {
let s = 0;
const bold    = /bold|rich|full.?body|heavy|strong|robust|powerful|dark/i.test(msg);
const light   = /light|delicate|elegant|soft|gentle|easy|smooth/i.test(msg);
const bubbly  = /sparkling|prosecco|champagne|bubbles|fizz|spumante|cremant|celebration|celebrate/i.test(msg);
const white   = /white|blanc|sauvignon|chardonnay|crisp|fresh/i.test(msg);
const red     = /red|rouge|merlot|cabernet|pinot|shiraz|syrah|barbera|primitivo|grenache/i.test(msg);
const rose    = /ros[ee]/i.test(msg);
const glass   = /glass|kieliszek|just one|single|try/i.test(msg);
const bottle  = /bottle|butelk|whole|sharing|evening|dinner/i.test(msg);
const cheap   = /cheap|budget|affordable|under.?15|under.?10/i.test(msg);
const premium = /special|premium|best|finest|expensive|treat|over.?20/i.test(msg);
const cheese      = /cheese|sery|ser|fromage|board|brie|camembert|cheddar|goat|blue|stilton|manchego|parmesan|gouda/i.test(msg);
const charcuterie = /charcuterie|wedliny|meat|cured|salami|prosciutto|ham|chorizo|cold cuts/i.test(msg);
const softCheese  = /brie|camembert|goat|soft|cream/i.test(msg);
const blueCheese  = /blue|stilton|roquefort|gorgonzola/i.test(msg);
const hardCheese  = /cheddar|manchego|parmesan|gouda|aged|hard/i.test(msg);
const gift    = /gift|present|special occasion|birthday|anniversary/i.test(msg);

if (bubbly && wine.type==="sparkling") s+=40;
if (white  && wine.type==="white")     s+=40;
if (red    && wine.type==="red")       s+=40;
if (rose   && wine.type==="rose")      s+=40;
if (bold   && wine.style==="bold")     s+=25;
if (light  && wine.style==="light")    s+=25;
if (glass  && wine.glass)              s+=15;
if (bottle && wine.bottle)             s+=15;
const price = parseFloat(wine.bottlePrice)||0;
if (cheap   && price<15)  s+=20;
if (premium && price>=20) s+=20;
if (gift    && price>=20) s+=20;
if (cheese      && /cheese|charcuterie|cured|salami/i.test(wine.pairing||"")) s+=20;
if (charcuterie && /charcuterie|cured|salami|meat/i.test(wine.pairing||""))   s+=20;
if (softCheese  && (wine.type==="white"||wine.type==="sparkling"))             s+=15;
if (blueCheese  && wine.type==="red" && wine.style==="bold")                  s+=15;
if (hardCheese  && wine.type==="red")                                         s+=10;
if (wine.available) s+=5;
s += Math.random()*3;
return s;
}

function getAIResponse(wines, message) {
const available = wines.filter(w => w.available);
if (!available.length) return "Our wine list is being updated – please ask our team for tonight's selection.";
if (/^(hi|hello|hey|good evening|bonjour|hola|ciao)/i.test(message.trim()))
return "Good evening! I'm your Alticcio sommelier. Tell me what you're in the mood for – an occasion, a flavour, a dish you're having – and I'll find the perfect wine for you. ?";
if (/^(help|what can you do|how does this work)/i.test(message.trim()))
return "Simply tell me what you fancy – ‘something bold and red', ‘a crisp white with fish', ‘a glass of bubbles to celebrate', or even ‘what goes with steak?' – and I'll recommend from our current list.";

const scored = available
.map(w => ({ wine: w, score: scoreWine(w, message) }))
.sort((a,b) => b.score-a.score)
.filter(x => x.score>3)
.slice(0,2).map(x=>x.wine);
const recs = scored.length ? scored : available.slice(0,2);
if (!recs.length) return "I'm afraid we don't have anything that matches exactly right now. Could you tell me a little more – red, white, or sparkling?";

const top = recs[0];
const isGlass = /glass|kieliszek|just one|single|try/i.test(message);
const hasAnyGlass = top.glassSmall || top.glassMedium || top.glassLarge;
let serving = "";
if (isGlass && hasAnyGlass) {
const sizes = [];
if (top.glassSmall)  sizes.push(`small GBP${top.glassSmall}`);
if (top.glassMedium) sizes.push(`medium GBP${top.glassMedium}`);
if (top.glassLarge)  sizes.push(`large GBP${top.glassLarge}`);
serving = `by the glass -- ${sizes.join(", ")}`;
} else {
serving = `by the bottle at GBP${top.bottlePrice}`;
}
let reply = `My recommendation for you this evening is **${top.name}**`;
if (top.region) reply += ` from ${top.region}`;
if (top.vintage && top.vintage!=="NV") reply += ` (${top.vintage})`;
reply += `.\n\n`;
if (top.desc) reply += `${top.desc}\n\n`;
if (top.pairing) reply += `? *Pairs beautifully with: ${top.pairing}*\n\n`;
reply += `Available ${serving}.`;
if (recs[1]) {
const r2 = recs[1];
const r2glass = r2.glassSmall || r2.glassMedium || r2.glassLarge;
const s2 = isGlass && r2glass
? [r2.glassSmall&&`small GBP${r2.glassSmall}`, r2.glassMedium&&`medium GBP${r2.glassMedium}`, r2.glassLarge&&`large GBP${r2.glassLarge}`].filter(Boolean).join(", ")
: `GBP${r2.bottlePrice} a bottle`;
reply += `\n\nI'd also suggest **${r2.name}** as an alternative -- ${s2}.`;
}
return reply;
}

function Markdown({ text }) {
return <span>{text.split(/(**[^*]+**|*[^*]+*)/g).map((p,i) =>
p.startsWith("**")&&p.endsWith("**") ? <strong key={i}>{p.slice(2,-2)}</strong>
: p.startsWith("*")&&p.endsWith("*") ? <em key={i}>{p.slice(1,-1)}</em>
: <span key={i}>{p}</span>
)}</span>;
}

const WINE_TYPES = { red:"? Red", white:"? White", sparkling:"? Sparkling", "rose":"? Rose" };
const EMPTY = { name:"", region:"", vintage:"", type:"red", style:"", glass:false, bottle:true, glassSmall:"", glassMedium:"", glassLarge:"", bottlePrice:"", desc:"", pairing:"", available:true, fromShopify:false };
const CHIPS = ["Something bold and red ?","What goes with a cheese board? ?","A glass of bubbles ?","Best wine with charcuterie? ?","Something light and elegant","Surprise me! ?"];

export default function App() {
const [view, setView]           = useState("customer");
const [barWines, setBarWines]   = useState([]);
const [shopWines, setShopWines] = useState([]);
const [loadingSh, setLoadingSh] = useState(false);
const [overrides, setOverrides] = useState({});
const [msgs, setMsgs]           = useState([{ role:"assistant", text:"Good evening! I'm your Alticcio sommelier. Tell me what you're in the mood for tonight – a flavour, an occasion, a dish – and I'll find the perfect wine for you. ?" }]);
const [input, setInput]         = useState("");
const [typing, setTyping]       = useState(false);
const [pin, setPin]             = useState("");
const [pinErr, setPinErr]       = useState(false);
const [form, setForm]           = useState(EMPTY);
const [editId, setEditId]       = useState(null);
const [showForm, setShowForm]   = useState(false);
const chatEnd = useRef(null);

useEffect(() => {
try { setBarWines(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")); } catch{}
},[]);

useEffect(() => {
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(barWines)); } catch{}
},[barWines]);

const OVERRIDES_KEY = "alticcio_overrides_v1";
useEffect(() => {
try { const o = JSON.parse(localStorage.getItem(OVERRIDES_KEY)||"{}"); setOverrides(o); } catch{}
},[]);
useEffect(() => {
try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)); } catch{}
},[overrides]);

const loadShopify = useCallback(async () => {
setLoadingSh(true);
const w = await fetchShopifyWines();
setShopWines(w);
setLoadingSh(false);
},[]);

useEffect(() => { loadShopify(); },[loadShopify]);
useEffect(() => { chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[msgs,typing]);

const allWines = [
...shopWines.map(w => {
const ov = overrides[w.id] || {};
return {
...w,
available:    ov.available    ?? w.available,
glass:        ov.glass        ?? w.glass,
glassSmall:   ov.glassSmall   ?? "",
glassMedium:  ov.glassMedium  ?? "",
glassLarge:   ov.glassLarge   ?? "",
bottlePrice:  ov.barBottlePrice ? ov.barBottlePrice : w.bottlePrice,
shopifyPrice: w.bottlePrice,
};
}),
...barWines,
];

const send = (text) => {
if (!text?.trim()) return;
setMsgs(p => [...p, { role:"user", text }]);
setInput(""); setTyping(true);
setTimeout(() => {
setMsgs(p => [...p, { role:"assistant", text: getAIResponse(allWines, text) }]);
setTyping(false);
}, 800+Math.random()*400);
};

const checkPin = () => {
if (pin===ADMIN_PIN) { setView("admin"); setPin(""); setPinErr(false); }
else { setPinErr(true); setPin(""); }
};

const saveWine = () => {
if (!form.name.trim()) return;
if (editId) { setBarWines(p => p.map(w => w.id===editId ? {...form,id:editId} : w)); setEditId(null); }
else setBarWines(p => [...p, {...form, id:Date.now()}]);
setForm(EMPTY); setShowForm(false);
};

const C = {
app:    { fontFamily:"Georgia,‘Times New Roman',serif", minHeight:"100vh", background:"#0e0b08", color:"#F5F0E8" },
// Customer
cWrap:  { minHeight:"100vh", background:"linear-gradient(160deg,#0e0b08 0%,#1a1008 50%,#0e0b08 100%)", display:"flex", flexDirection:"column" },
hdr:    { padding:"18px 20px 14px", borderBottom:"1px solid rgba(201,168,76,.18)", background:"linear-gradient(135deg,#1a1410,#221a14)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 },
logo:   { fontFamily:"Georgia,serif", fontSize:21, letterSpacing:".2em", color:"#C9A84C" },
sub:    { fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:10, letterSpacing:".22em", color:"#8A8279", textTransform:"uppercase", marginTop:2 },
chat:   { flex:1, overflowY:"auto", padding:"18px 14px", display:"flex", flexDirection:"column", gap:12 },
bubble: r => ({ maxWidth:"83%", alignSelf:r==="user"?"flex-end":"flex-start", background:r==="user"?"#6B1F2A":"rgba(255,255,255,.04)", border:r==="user"?"none":"1px solid rgba(201,168,76,.13)", borderRadius:r==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"12px 15px", fontSize:14, lineHeight:1.65, color:r==="user"?"#F5F0E8":"#E8E0D0" }),
typing: { alignSelf:"flex-start", background:"rgba(255,255,255,.04)", border:"1px solid rgba(201,168,76,.13)", borderRadius:"18px 18px 18px 4px", padding:"12px 16px", display:"flex", gap:5, alignItems:"center" },
dot:    i => ({ width:6, height:6, borderRadius:"50%", background:"#C9A84C", opacity:.7, animation:`bounce 1.2s ease-in-out ${i*.2}s infinite` }),
chips:  { display:"flex", gap:7, flexWrap:"wrap", padding:"0 14px 12px" },
chip:   { background:"rgba(201,168,76,.07)", border:"1px solid rgba(201,168,76,.2)", borderRadius:20, padding:"7px 13px", fontSize:12, color:"#C9A84C", cursor:"pointer", fontFamily:"Helvetica Neue,Arial,sans-serif", letterSpacing:".04em" },
ibar:   { padding:"10px 14px", borderTop:"1px solid rgba(201,168,76,.14)", background:"#141008", display:"flex", gap:9, alignItems:"center", flexShrink:0 },
ifield: { flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(201,168,76,.2)", borderRadius:24, padding:"11px 17px", color:"#F5F0E8", fontSize:14, fontFamily:"Georgia,serif", outline:"none" },
sbtn:   { width:42, height:42, borderRadius:"50%", background:"#6B1F2A", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
stbtn:  { background:"transparent", border:"1px solid rgba(201,168,76,.2)", borderRadius:20, padding:"6px 13px", color:"#8A8279", fontSize:11, fontFamily:"Helvetica Neue,Arial,sans-serif", letterSpacing:".1em", cursor:"pointer", textTransform:"uppercase" },
// PIN
pWrap:  { minHeight:"100vh", background:"#0e0b08", display:"flex", alignItems:"center", justifyContent:"center", padding:24 },
pBox:   { background:"#1a1410", border:"1px solid rgba(201,168,76,.2)", borderRadius:16, padding:"38px 30px", textAlign:"center", maxWidth:300, width:"100%" },
pTitle: { fontFamily:"Georgia,serif", fontSize:22, color:"#C9A84C", marginBottom:8 },
pSub:   { fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:11, color:"#8A8279", letterSpacing:".1em", marginBottom:22 },
pInput: { width:"100%", background:"rgba(255,255,255,.04)", border:"1px solid rgba(201,168,76,.25)", borderRadius:10, padding:"13px 15px", color:"#F5F0E8", fontSize:22, fontFamily:"Helvetica Neue,Arial,sans-serif", outline:"none", textAlign:"center", letterSpacing:".3em", marginBottom:10 },
pBtn:   { width:"100%", background:"#6B1F2A", border:"none", borderRadius:10, padding:13, color:"#F5F0E8", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, fontWeight:700, letterSpacing:".16em", textTransform:"uppercase", cursor:"pointer" },
pBack:  { display:"block", marginTop:13, color:"#8A8279", fontSize:11, fontFamily:"Helvetica Neue,Arial,sans-serif", cursor:"pointer", textDecoration:"underline" },
pErr:   { color:"#8B2535", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, marginBottom:8 },
// Admin
aWrap:  { minHeight:"100vh", background:"#0e0b08" },
aHdr:   { background:"linear-gradient(135deg,#1a1410,#221a14)", borderBottom:"1px solid rgba(201,168,76,.18)", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 },
aTitle: { fontFamily:"Georgia,serif", fontSize:19, color:"#C9A84C", letterSpacing:".12em" },
aBody:  { padding:"20px 22px", maxWidth:860, margin:"0 auto" },
secT:   { fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:10, fontWeight:700, letterSpacing:".22em", textTransform:"uppercase", color:"#C9A84C", margin:"24px 0 12px", display:"flex", alignItems:"center", gap:10 },
secL:   { flex:1, height:1, background:"rgba(201,168,76,.15)" },
row:    { background:"rgba(255,255,255,.025)", border:"1px solid rgba(201,168,76,.1)", borderRadius:11, padding:"13px 16px", marginBottom:9, display:"flex", alignItems:"center", gap:12 },
rInfo:  { flex:1, minWidth:0 },
rName:  { fontFamily:"Georgia,serif", fontSize:14, color:"#F5F0E8", marginBottom:3 },
rDet:   { fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:11, color:"#8A8279" },
badge:  t => ({ display:"inline-block", padding:"2px 7px", borderRadius:20, fontSize:10, fontFamily:"Helvetica Neue,Arial,sans-serif", fontWeight:600, textTransform:"uppercase", marginRight:6, background:{red:"rgba(107,31,42,.4)",white:"rgba(201,168,76,.15)",sparkling:"rgba(100,149,237,.15)","rose":"rgba(255,105,180,.15)"}[t]||"rgba(255,255,255,.1)", color:{red:"#C97070",white:"#C9A84C",sparkling:"#88AADD","rose":"#E8A0C0"}[t]||"#aaa" }),
tog:    on => ({ width:34, height:19, borderRadius:10, background:on?"#2a7a4a":"#4a2020", border:"none", cursor:"pointer", position:"relative", flexShrink:0 }),
knob:   on => ({ position:"absolute", top:2, left:on?16:2, width:15, height:15, borderRadius:"50%", background:on?"#5dba7d":"#8B2535", transition:"left .25s" }),
ibtn:   { background:"transparent", border:"none", cursor:"pointer", color:"#8A8279", fontSize:15, padding:"3px 5px", borderRadius:6 },
addB:   { background:"#6B1F2A", border:"none", borderRadius:9, padding:"10px 18px", color:"#F5F0E8", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, fontWeight:700, letterSpacing:".13em", textTransform:"uppercase", cursor:"pointer" },
syncB:  { background:"transparent", border:"1px solid rgba(201,168,76,.25)", borderRadius:9, padding:"10px 18px", color:"#C9A84C", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer" },
backB:  { background:"transparent", border:"1px solid rgba(255,255,255,.1)", borderRadius:9, padding:"10px 18px", color:"#8A8279", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, letterSpacing:".08em", textTransform:"uppercase", cursor:"pointer" },
// Form
fWrap:  { background:"rgba(201,168,76,.04)", border:"1px solid rgba(201,168,76,.18)", borderRadius:13, padding:20, marginBottom:18 },
fTitle: { fontFamily:"Georgia,serif", fontSize:17, color:"#C9A84C", marginBottom:16 },
fGrid:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
fFull:  { gridColumn:"1 / -1" },
lbl:    { display:"block", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:10, letterSpacing:".2em", color:"#C9A84C", textTransform:"uppercase", marginBottom:5 },
inp:    { width:"100%", background:"rgba(255,255,255,.04)", border:"1px solid rgba(201,168,76,.2)", borderRadius:8, padding:"10px 13px", color:"#F5F0E8", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:13, outline:"none" },
sel:    { width:"100%", background:"#1a1410", border:"1px solid rgba(201,168,76,.2)", borderRadius:8, padding:"10px 13px", color:"#F5F0E8", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:13, outline:"none" },
chk:    { display:"flex", alignItems:"center", gap:7, fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, color:"#E8E0D0", cursor:"pointer" },
fBtns:  { display:"flex", gap:9, marginTop:16 },
savB:   { background:"#C9A84C", border:"none", borderRadius:8, padding:"11px 22px", color:"#1a1410", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, fontWeight:700, letterSpacing:".13em", textTransform:"uppercase", cursor:"pointer" },
canB:   { background:"transparent", border:"1px solid rgba(201,168,76,.25)", borderRadius:8, padding:"11px 22px", color:"#8A8279", fontFamily:"Helvetica Neue,Arial,sans-serif", fontSize:12, textTransform:"uppercase", cursor:"pointer" },
hint:   { background:"rgba(201,168,76,.05)", border:"1px solid rgba(201,168,76,.15)", borderRadius:11, padding:"16px 18px", marginTop:28 },
};

// ?? CUSTOMER ??
if (view==="customer") return (
<div style={C.app}>
<style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#6B1F2A;border-radius:2px}`}</style>
<div style={C.cWrap}>
<div style={C.hdr}>
<div><div style={C.logo}>ALTICCIO</div><div style={C.sub}>AI Sommelier ? Wine Bar</div></div>
<button style={C.stbtn} onClick={()=>setView("pin")}>Staff ?</button>
</div>
<div style={C.chat}>
{msgs.map((m,i) => (
<div key={i} style={C.bubble(m.role)}>
{m.role==="assistant" ? <Markdown text={m.text}/> : m.text}
</div>
))}
{typing && <div style={C.typing}>{[0,1,2].map(i=><div key={i} style={C.dot(i)}/>)}</div>}
<div ref={chatEnd}/>
</div>
<div style={C.chips}>
{CHIPS.map((c,i) => <button key={i} style={C.chip} onClick={()=>send(c)}>{c}</button>)}
</div>
<div style={C.ibar}>
<input style={C.ifield} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Tell me what you fancy tonight..."/>
<button style={C.sbtn} onClick={()=>send(input)}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F5F0E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
</button>
</div>
</div>
</div>
);

// ?? PIN ??
if (view==="pin") return (
<div style={{...C.app,...C.pWrap}}>
<div style={C.pBox}>
<div style={C.pTitle}>Staff Access</div>
<div style={C.pSub}>ENTER YOUR PIN</div>
{pinErr && <div style={C.pErr}>Incorrect PIN – try again</div>}
<input type="password" maxLength={6} style={C.pInput} value={pin} onChange={e=>{setPin(e.target.value);setPinErr(false);}} onKeyDown={e=>e.key==="Enter"&&checkPin()} placeholder="????" autoFocus/>
<button style={C.pBtn} onClick={checkPin}>ENTER</button>
<span style={C.pBack} onClick={()=>{setView("customer");setPin("");setPinErr(false);}}>? Back to Sommelier</span>
</div>
</div>
);

// ?? ADMIN ??
const barOnly = barWines.filter(w => !shopWines.find(s=>s.id===w.id));

return (
<div style={C.app}>
<div style={C.aWrap}>
<div style={C.aHdr}>
<div style={C.aTitle}>ALTICCIO ? Wine Manager</div>
<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
<button style={C.syncB} onClick={loadShopify}>{loadingSh?"? Syncing...":"? Sync Shopify"}</button>
<button style={C.addB} onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}}>+ Add Wine</button>
<button style={C.backB} onClick={()=>setView("customer")}>? Sommelier</button>
</div>
</div>

```
    <div style={C.aBody}>

      {/* FORM */}
      {showForm && (
        <div style={C.fWrap}>
          <div style={C.fTitle}>{editId?"Edit Wine":"Add Bar-Only Wine"}</div>
          <div style={C.fGrid}>
            <div style={C.fFull}><label style={C.lbl}>Wine Name *</label><input style={C.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Chateau Margaux 2018"/></div>
            <div><label style={C.lbl}>Region</label><input style={C.inp} value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))} placeholder="e.g. Bordeaux, France"/></div>
            <div><label style={C.lbl}>Vintage</label><input style={C.inp} value={form.vintage} onChange={e=>setForm(f=>({...f,vintage:e.target.value}))} placeholder="2021 or NV"/></div>
            <div><label style={C.lbl}>Type</label>
              <select style={C.sel} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="red">? Red</option><option value="white">? White</option><option value="sparkling">? Sparkling</option><option value="rose">? Rose</option>
              </select>
            </div>
            <div><label style={C.lbl}>Style</label><input style={C.inp} value={form.style} onChange={e=>setForm(f=>({...f,style:e.target.value}))} placeholder="bold, light, crisp..."/></div>
            <div style={C.fFull}><label style={C.lbl}>Tasting Notes</label><input style={C.inp} value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="What does it taste like?"/></div>
            <div style={C.fFull}><label style={C.lbl}>Food Pairing</label><input style={C.inp} value={form.pairing} onChange={e=>setForm(f=>({...f,pairing:e.target.value}))} placeholder="e.g. Red meats, pasta, cheese"/></div>
            <div><label style={C.lbl}>Bottle Price GBP (bar)</label><input style={C.inp} type="number" step="0.01" value={form.bottlePrice} onChange={e=>setForm(f=>({...f,bottlePrice:e.target.value}))} placeholder="14.00"/></div>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={C.lbl}>Glass Prices (leave empty if not served by glass)</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:6}}>
                {[["glassSmall","Small GBP"],["glassMedium","Medium GBP"],["glassLarge","Large GBP"]].map(([k,l])=>(
                  <div key={k}>
                    <label style={{...C.lbl,fontSize:9}}>{l}</label>
                    <input style={C.inp} type="number" step="0.01" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder="0.00"/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
              {[["glass","By glass"],["bottle","By bottle"],["available","In stock"]].map(([k,l])=>(
                <label key={k} style={C.chk}><input type="checkbox" checked={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.checked}))}/>{l}</label>
              ))}
            </div>
          </div>
          <div style={C.fBtns}>
            <button style={C.savB} onClick={saveWine}>Save</button>
            <button style={C.canB} onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY);}}>Cancel</button>
          </div>
        </div>
      )}

      {/* SHOPIFY WINES */}
      <div style={C.secT}><span>Shopify Wines</span><div style={C.secL}/><span style={{fontSize:10,color:"#8A8279",fontWeight:400}}>{shopWines.length} wines ? {loadingSh?"syncing...":"synced"}</span></div>
      {loadingSh && <div style={{color:"#8A8279",fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:13,padding:"16px 0"}}>Loading from Shopify...</div>}
      {shopWines.map(w => {
        const ov = overrides[w.id]||{};
        const avail    = ov.available    ?? w.available;
        const hasGlass = ov.glass        ?? w.glass;
        const barBP    = ov.barBottlePrice ?? "";
        const gS = ov.glassSmall  ?? "";
        const gM = ov.glassMedium ?? "";
        const gL = ov.glassLarge  ?? "";
        return (
          <div key={w.id} style={{...C.row, flexWrap:"wrap", gap:10}}>
            <div style={C.rInfo}>
              <div style={C.rName}><span style={C.badge(w.type)}>{WINE_TYPES[w.type]||w.type}</span>{w.name}</div>
              <div style={C.rDet}>
                {w.region||"--"} ?
                <span style={{color:"#8A8279"}}> Online GBP{w.bottlePrice}</span>
                {barBP ? <span style={{color:"#C9A84C"}}> ? Bar GBP{barBP}</span> : <span style={{color:"#5A5250"}}> ? Bar price not set</span>}
                <span style={{color:"#5A9B6A"}}> ? SHOPIFY</span>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,flexWrap:"wrap"}}>
              {/* Bar bottle price */}
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:9,color:"#8A8279",marginBottom:3}}>BOTTLE GBP (bar)</div>
                <input style={{...C.inp,width:64,padding:"5px 8px",fontSize:12,textAlign:"center"}} placeholder={w.bottlePrice} value={barBP} onChange={e=>setOverrides(p=>({...p,[w.id]:{...p[w.id],barBottlePrice:e.target.value}}))}/>
              </div>
              {/* Glass toggle */}
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:9,color:"#8A8279",marginBottom:3}}>BY GLASS</div>
                <button style={C.tog(hasGlass)} onClick={()=>setOverrides(p=>({...p,[w.id]:{...p[w.id],glass:!hasGlass}}))}>
                  <div style={C.knob(hasGlass)}/>
                </button>
              </div>
              {/* Three glass sizes */}
              {hasGlass && <>
                {[["glassSmall","SMALL GBP",gS],["glassMedium","MEDIUM GBP",gM],["glassLarge","LARGE GBP",gL]].map(([key,lbl,val])=>(
                  <div key={key} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:9,color:"#C9A84C",marginBottom:3}}>{lbl}</div>
                    <input style={{...C.inp,width:56,padding:"5px 8px",fontSize:12,textAlign:"center"}} placeholder="0.00" value={val} onChange={e=>setOverrides(p=>({...p,[w.id]:{...p[w.id],[key]:e.target.value}}))}/>
                  </div>
                ))}
              </>}
              {/* Stock toggle */}
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:9,color:avail?"#5dba7d":"#8B2535",marginBottom:3}}>{avail?"IN STOCK":"OUT"}</div>
                <button style={C.tog(avail)} onClick={()=>setOverrides(p=>({...p,[w.id]:{...p[w.id],available:!avail}}))}>
                  <div style={C.knob(avail)}/>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* BAR-ONLY WINES */}
      <div style={C.secT}><span>Bar-Only Wines</span><div style={C.secL}/><span style={{fontSize:10,color:"#8A8279",fontWeight:400}}>{barOnly.length} wines</span></div>
      {barOnly.length===0 && <div style={{color:"#8A8279",fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:13,padding:"12px 0"}}>No bar-only wines yet -- add wines not in your Shopify store (e.g. by-the-glass only selections).</div>}
      {barOnly.map(w => (
        <div key={w.id} style={C.row}>
          <div style={C.rInfo}>
            <div style={C.rName}><span style={C.badge(w.type)}>{WINE_TYPES[w.type]||w.type}</span>{w.name}</div>
            <div style={C.rDet}>
                {w.region||"--"}{w.vintage?` ? ${w.vintage}`:""}
                {w.bottlePrice?` ? Bottle GBP${w.bottlePrice}`:""}
                {w.glassSmall  ? ` ? S GBP${w.glassSmall}`  : ""}
                {w.glassMedium ? ` ? M GBP${w.glassMedium}` : ""}
                {w.glassLarge  ? ` ? L GBP${w.glassLarge}`  : ""}
              </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:9,color:w.available?"#5dba7d":"#8B2535"}}>{w.available?"IN STOCK":"OUT"}</div>
            <button style={C.tog(w.available)} onClick={()=>setBarWines(p=>p.map(x=>x.id===w.id?{...x,available:!x.available}:x))}><div style={C.knob(w.available)}/></button>
            <button style={C.ibtn} onClick={()=>{setForm({...w});setEditId(w.id);setShowForm(true);}}>??</button>
            <button style={C.ibtn} onClick={()=>setBarWines(p=>p.filter(x=>x.id!==w.id))}>?</button>
          </div>
        </div>
      ))}

      {/* QR HINT */}
      <div style={C.hint}>
        <div style={{fontFamily:"Georgia,serif",fontSize:15,color:"#C9A84C",marginBottom:7}}>? QR Code for tables</div>
        <div style={{fontFamily:"Helvetica Neue,Arial,sans-serif",fontSize:12,color:"#8A8279",lineHeight:1.7}}>
          Host this app at e.g. <strong style={{color:"#E8D5A3"}}>sommelier.alticciowinestore.co.uk</strong> ? generate a QR code at <strong style={{color:"#E8D5A3"}}>qr-code-generator.com</strong> pointing to that URL ? print and place on each table. Customers scan and chat with your sommelier instantly. No app download needed.
        </div>
      </div>
      <div style={{height:36}}/>
    </div>
  </div>
</div>


);
}