/* ===== الحالة العامة والأدوات المشتركة ===== */
const S = {
  email: "", me: null,          // صف المستخدم من f4_users
  people: [], byId: new Map(), bySerial: new Map(),
  spouses: [], lookups: {},
  sel: new Set(),               // السجلات المحددة (للواتساب والتقارير)
  dirty: false,
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isAdmin = () => S.me?.role === "admin";
const can = perm => isAdmin() || !!S.me?.["can_" + perm];

/* تطبيع النص العربي للبحث */
function norm(s){
  return String(s ?? "").toLowerCase().replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}
function fmtDate(d){ if(!d) return ""; const [y,m,dd] = String(d).slice(0,10).split("-"); return `${+dd}/${+m}/${y}`; }
function todayISO(){ return new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Bahrain"}); }
function ageOf(p){
  if(!p?.birth_date) return "";
  const b = new Date(p.birth_date + "T00:00:00");
  const e = p.status === "متوفى" && p.death_date ? new Date(p.death_date + "T00:00:00") : new Date(todayISO() + "T00:00:00");
  let a = e.getFullYear() - b.getFullYear();
  if(e.getMonth() < b.getMonth() || (e.getMonth() === b.getMonth() && e.getDate() < b.getDate())) a--;
  return a >= 0 ? a : "";
}
const isM = p => p?.gender !== "أنثى";
const isDead = p => p?.status === "متوفى";

/* الأسماء */
function fullName(p, parts = 4){
  if(!p) return "";
  return [p.name1, p.name2, p.name3, p.name4, p.name5, p.name6].slice(0, parts).filter(Boolean).concat(p.family ? [p.family] : []).join(" ");
}
function longName(p){ return fullName(p, 6); }
function shortName(p){ return p ? [p.name1, p.name2].filter(Boolean).join(" ") : ""; }
/* لون الاسم حسب الجنس: ذكر أزرق، أنثى وردي */
function gcls(p){ return !p ? "" : p.gender === "ذكر" ? "nm-m" : p.gender === "أنثى" ? "nm-f" : ""; }
function nm(p, text){ const c = gcls(p); return c ? `<span class="${c}">${esc(text)}</span>` : esc(text); }
function nameTag(p){ return p ? `${fullName(p, 3)} (${p.serial})` : ""; }

/* العلاقات العائلية */
function childrenOf(p){
  if(!p) return [];
  return S.people.filter(c => c.father_id === p.id || c.mother_id === p.id)
    .sort((a, b) => (a.birth_date || "9").localeCompare(b.birth_date || "9") || a.serial - b.serial);
}
function siblingsOf(p){
  if(!p || (!p.father_id && !p.mother_id)) return [];
  return S.people.filter(x => x.id !== p.id && ((p.father_id && x.father_id === p.father_id) || (p.mother_id && x.mother_id === p.mother_id)))
    .sort((a, b) => (a.birth_date || "9").localeCompare(b.birth_date || "9") || a.serial - b.serial);
}
function siblingKind(p, x){
  const sameF = p.father_id && x.father_id === p.father_id, sameM = p.mother_id && x.mother_id === p.mother_id;
  if(sameF && sameM) return "شقيق";
  return sameF ? "من الأب" : "من الأم";
}
/* الأزواج: ما أُدخل في سجل الشخص + من أدخله زوجاً في سجله */
function spousesOf(p){
  if(!p) return [];
  const own = S.spouses.filter(s => s.person_id === p.id).sort((a, b) => a.ord - b.ord)
    .map(s => ({ord:s.ord, person:S.byId.get(s.spouse_id) || null, name:s.spouse_name || "", own:true}));
  const ids = new Set(own.filter(x => x.person).map(x => x.person.id));
  S.spouses.filter(s => s.spouse_id === p.id && !ids.has(s.person_id)).forEach(s => {
    const o = S.byId.get(s.person_id); if(o){ ids.add(o.id); own.push({ord:null, person:o, name:"", own:false}); }
  });
  // أبوان لأبناء مشتركين بدون تسجيل زواج
  childrenOf(p).forEach(k => {
    const other = S.byId.get(isM(p) ? k.mother_id : k.father_id);
    if(other && !ids.has(other.id)){ ids.add(other.id); own.push({ord:null, person:other, name:"", own:false}); }
  });
  // اسم مكتوب يدوياً لنفس الشخص المربوط كسجل — لا نكرره
  const linked = own.filter(x => x.person).map(x => norm(longName(x.person)));
  return own.filter(x => x.person || !linked.some(n => n && (n === norm(x.name) || n.startsWith(norm(x.name)) || norm(x.name).startsWith(n))));
}
function spouseLabel(s){ return s.person ? nameTag(s.person) : s.name; }
function descendantsByGen(p, maxGen = 12){
  const gens = []; let cur = [p]; const seen = new Set([p.id]);
  for(let g = 0; g < maxGen; g++){
    const next = [];
    cur.forEach(x => childrenOf(x).forEach(k => { if(!seen.has(k.id)){ seen.add(k.id); next.push(k); } }));
    if(!next.length) break; gens.push(next); cur = next;
  }
  return gens;
}
function isDescendant(ancestorId, id){
  const stack = [ancestorId], seen = new Set();
  while(stack.length){
    const x = stack.pop(); if(seen.has(x)) continue; seen.add(x);
    for(const c of S.people) if(c.father_id === x || c.mother_id === x){ if(c.id === id) return true; stack.push(c.id); }
  }
  return false;
}
function lineChain(p, key = "father_id", max = 30){
  const out = []; let x = p, g = 0;
  while(x && g++ < max){ const n = S.byId.get(x[key]); if(!n) break; out.push(n); x = n; }
  return out;
}

/* القوائم */
function lk(kind){ return (S.lookups[kind] || []).map(x => x.name); }
/* القائمة + القيم المكتوبة يدوياً في السجلات (للفرز والتقارير) */
function lkUsed(kind, col = kind){ return [...new Set([...lk(kind), ...S.people.map(p => p[col]).filter(Boolean)])]; }
function areasOf(gov){ return (S.lookups.area || []).filter(a => !gov || a.parent === gov).map(a => a.name); }
function govOfArea(area){ return (S.lookups.area || []).find(a => a.name === area)?.parent || ""; }

/* الهاتف وواتساب */
function waNumber(phone){
  let d = String(phone || "").replace(/[^\d]/g, "");
  if(!d) return "";
  if(d.startsWith("00")) d = d.slice(2);
  if(d.length === 8) d = COUNTRY_CODE + d;
  return d.length >= 10 ? d : "";
}
/* رابط التواصل مع الإدارة — يُعبّأ في كل عنصر يحمل data-contact */
function contactLink(){ return waLink(CONTACT_WA, "السلام عليكم، بخصوص شجرة العائلة: "); }
document.addEventListener("DOMContentLoaded", fillContact);
function fillContact(){ $$("[data-contact]").forEach(a => a.href = contactLink()); $$("[data-contact-num]").forEach(s => s.textContent = CONTACT_WA.replace(/(\d{4})(\d{4})/, "$1 $2")); }
function waLink(phone, text = ""){ const n = waNumber(phone); return n ? `https://wa.me/${n}${text ? "?text=" + encodeURIComponent(text) : ""}` : ""; }

/* ===== البيانات ===== */
async function fetchAll(table, order){
  let out = [], from = 0;
  for(;;){
    const {data, error} = await db.from(table).select("*").order(order).range(from, from + 999);
    if(error) throw error;
    out = out.concat(data); if(data.length < 1000) break; from += 1000;
  }
  return out;
}
const isRestricted = () => !isAdmin(); /* العضو يرى بيانات نفسه وأسرته التي تليه فقط، والشجرة كاملة بالأسماء — المدير يرى الكل */
/* التعديل: المدير على الكل، والعضو على نفسه وأسرته التي تليه وما أضافه هو */
const ownsP = p => !!p && (S.editIds?.has(p.id) || (p.created_by || "") === S.email);
const canEditP = p => isAdmin() || ((can("edit") || can("add")) && ownsP(p));
const canDelP = p => isAdmin() || (can("delete") && ownsP(p) && p.id !== S.me?.person_id);
/* تبديل البيانات: صفحة الشجرة تستخدم كل العائلة، وباقي الصفحات المسموح فقط */
function useTreeData(on){
  if(!S.treeAll) return;
  if(on && !S.full){ S.full = {people:S.people, spouses:S.spouses}; S.people = S.treeAll.people; S.spouses = S.treeAll.spouses; indexPeople(); }
  else if(!on && S.full){ S.people = S.full.people; S.spouses = S.full.spouses; S.full = null; indexPeople(); }
}
function indexPeople(){
  S.byId = new Map(S.people.map(p => [p.id, p]));
  S.bySerial = new Map(S.people.map(p => [p.serial, p]));
}
async function loadAll(){
  const [people, spouses, lookups] = await Promise.all([fetchAll("f4_people", "serial"), fetchAll("f4_spouses", "id"), fetchAll("f4_lookups", "sort")]);
  S.people = people; S.spouses = spouses; indexPeople();
  S.full = null; S.treeAll = null;
  /* العضو المقيّد: الشجرة تعرض فرع جده لأبيه وكل من ينحدر منه */
  if(isRestricted()){
    const [tp, ts] = await Promise.all([db.rpc("f4_tree_people"), db.rpc("f4_tree_spouses")]);
    if(!tp.error && !ts.error){
      const own = new Map(people.map(p => [p.id, p]));
      S.allowed = new Set(own.keys());
      S.treeAll = {
        people:(tp.data || []).map(t => own.get(t.id) || {...t, _stub:true, birth_date:t.birth_year ? `${t.birth_year}-01-01` : null, photo_path:null}).sort((a, b) => a.serial - b.serial),
        spouses:ts.data || []
      };
    }
  }
  S.editIds = new Set();
  if(S.me && !isAdmin()){ const {data} = await db.rpc("f4_edit_ids"); (data || []).forEach(x => S.editIds.add(+x)); }
  S.lookups = {}; lookups.forEach(l => (S.lookups[l.kind] ||= []).push(l));
  Object.values(S.lookups).forEach(a => a.sort((x, y) => x.sort - y.sort || x.name.localeCompare(y.name, "ar")));
}
function upsertLocal(row){
  const i = S.people.findIndex(p => p.id === row.id);
  if(i >= 0) S.people[i] = row; else S.people.push(row);
  S.people.sort((a, b) => a.serial - b.serial); indexPeople();
}
/* أول رقم تسلسل فارغ (أصغر رقم غير مستخدم) */
function nextSerial(){ const used = new Set(S.people.map(p => p.serial)); let n = 1; while(used.has(n)) n++; return n; }

async function photoUrl(path){
  if(!path) return "";
  const {data, error} = await db.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  return error ? "" : data.signedUrl;
}
async function compressImage(file, maxSide = 900, quality = .82){
  const img = await createImageBitmap(file);
  const r = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, "image/jpeg", quality));
}

/* ===== رسائل وحوارات ===== */
function errMsg(e){
  const m = String(e?.message || e || "");
  if(/Invalid login credentials/i.test(m)) return "البريد أو كلمة السر غير صحيحة";
  if(/Email not confirmed/i.test(m)) return "لم يتم تأكيد البريد بعد — افتح رسالة التأكيد في بريدك";
  if(/f4_people_serial_key/.test(m)) return "رقم التسلسل مستخدم لسجل آخر";
  if(/f4_people_cpr_key/.test(m)) return "الرقم الشخصي مسجل لشخص آخر";
  if(/f4_people_cpr_check/.test(m)) return "الرقم الشخصي يجب أن يكون 9 أرقام";
  if(/row-level security|permission denied/i.test(m)) return "ليست لديك صلاحية لهذه العملية";
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return "تعذر الاتصال بالإنترنت — حاول مرة أخرى";
  if(/User already registered/i.test(m)) return "هذا البريد لديه حساب — استخدم «دخول» أو «نسيت كلمة السر»";
  if(/Password should be/i.test(m)) return "كلمة السر يجب أن تكون 6 أحرف على الأقل";
  if(/different from the old password/i.test(m)) return "كلمة السر الجديدة لازم تختلف عن القديمة";
  if(/reauthentication|Session expired|JWT/i.test(m)) return "انتهت الجلسة — سجّل خروج ثم ادخل مرة ثانية وحاول";
  return m || "حدث خطأ غير متوقع";
}
function toast(msg, bad = false){
  $$(".toast").forEach(x => x.remove());
  const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : "");
  t.setAttribute("role", "status"); t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), bad ? 4500 : 2600);
}
/* حوار تأكيد/إدخال — يعيد true/false أو النص */
function ask(title, msg, {input = false, value = "", type = "text", okText = "موافق", danger = false, noCancel = false} = {}){
  return new Promise(res => {
    const d = $("#dAsk");
    $("#askT").textContent = title; $("#askMsg").textContent = msg;
    const inp = $("#askInp"); inp.hidden = !input; inp.type = type; inp.value = value;
    $("#askNo").hidden = noCancel;
    const yes = $("#askYes"); yes.textContent = okText; yes.className = "btn " + (danger ? "danger-fill" : "primary");
    const done = v => { d.close(); yes.onclick = null; $("#askNo").onclick = null; res(v); };
    yes.onclick = () => done(input ? inp.value : true);
    $("#askNo").onclick = () => done(input ? null : false);
    d.oncancel = e => { e.preventDefault(); done(input ? null : false); };
    $("#askForm").onsubmit = e => { e.preventDefault(); yes.click(); };
    d.showModal(); (input ? inp : yes).focus();
  });
}
/* نافذة عامة */
function modal(title, html, {wide = false, foot = ""} = {}){
  const d = $("#dModal"); $("#modalT").textContent = title; $("#modalB").innerHTML = html;
  $("#modalF").innerHTML = foot; $("#modalF").hidden = !foot;
  d.classList.toggle("wide", wide); if(!d.open) d.showModal(); return d;
}
function loadScript(src){
  return new Promise((res, rej) => {
    if(document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("تعذر تحميل مكتبة Excel"));
    document.head.append(s);
  });
}
function avatar(p, cls = ""){
  return `<span class="av ${cls} ${isM(p) ? "" : "f"} ${isDead(p) ? "dead" : ""}" aria-hidden="true">${esc((p?.name1 || "؟").trim().charAt(0))}</span>`;
}
function personBtn(p, sub = ""){
  return `<button type="button" class="pbtn" data-open="${p.id}">${avatar(p, "sm")}<span><b>${nm(p, fullName(p, 3))}</b><small>#${p.serial}${sub ? " · " + esc(sub) : ""}${isDead(p) ? " · متوفى" : ""}</small></span></button>`;
}

/* اختيار شخص من السجلات */
function pickPerson(title, {filter = null, allowNone = false} = {}){
  return new Promise(res => {
    const d = $("#dPick"); $("#pickT").textContent = title; const q = $("#pickQ"); q.value = "";
    let settled = false;
    const finish = v => { if(settled) return; settled = true; d.close(); res(v); };
    const render = () => {
      const t = norm(q.value), words = t.split(" ").filter(Boolean);
      let list = S.people.filter(p => !filter || filter(p));
      if(words.length) list = list.filter(p => String(p.serial) === t || (p.cpr || "").includes(t) ||
        words.every(w => norm(longName(p)).split(" ").some(x => x.startsWith(w))));
      $("#pickList").innerHTML = (allowNone ? `<button type="button" class="pick-row none" data-pid="0">— بدون —</button>` : "") +
        (list.slice(0, 60).map(p => `<button type="button" class="pick-row" data-pid="${p.id}">${avatar(p, "sm")}<span><b>${nm(p, fullName(p, 4))}</b><small>#${p.serial}${p.birth_date ? " · " + fmtDate(p.birth_date) : ""}</small></span></button>`).join("")
        || `<p class="empty">لا توجد نتائج</p>`);
    };
    q.oninput = render;
    $("#pickList").onclick = e => { const b = e.target.closest("[data-pid]"); if(b) finish(+b.dataset.pid ? S.byId.get(+b.dataset.pid) : 0); };
    d.onclose = () => finish(null);
    render(); d.showModal(); q.focus();
  });
}

/* طباعة */
function printHtml(html){
  const a = $("#printArea"); a.innerHTML = html;
  /* ننتظر تحميل الصور (حتى 4 ثوانٍ) قبل فتح نافذة الطباعة */
  const imgs = [...a.querySelectorAll("img")].filter(i => !i.complete);
  const ready = Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; })));
  Promise.race([ready, new Promise(r => setTimeout(r, 4000))]).then(() => setTimeout(() => window.print(), 200));
}
/* روابط صور شخصية موقّعة لعدة أشخاص دفعة واحدة */
async function photoUrls(people){
  const paths = [...new Set(people.map(p => p.photo_path).filter(Boolean))], map = new Map();
  for(let i = 0; i < paths.length; i += 100){
    const {data} = await db.storage.from(PHOTO_BUCKET).createSignedUrls(paths.slice(i, i + 100), 3600);
    (data || []).forEach(r => { if(r.signedUrl) map.set(r.path, r.signedUrl); });
  }
  return map;
}
async function exportXlsx(rows, sheetName, fileName){
  await loadScript(XLSX_URL);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new(); wb.Workbook = {Views:[{RTL:true}]};
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName + ".xlsx");
}
