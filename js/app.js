/* ===== التنقل والدخول والشاشات العامة ===== */
const ROUTES = {
  home:     {title:"الرئيسية", render:renderHome},
  add:      {title:"إضافة سجل", render:() => renderSerialGate("add"), perm:"add"},
  edit:     {title:"تعديل سجل", render:() => renderSerialGate("edit"), perm:"edit"},
  delete:   {title:"حذف سجل", render:() => renderSerialGate("delete"), perm:"delete"},
  rec:      {title:"الملف الكامل", render:id => renderRecord(+id)},
  new:      {title:"سجل جديد", render:serial => renderRecord(null, +serial), perm:"add"},
  list:     {title:"البحث والملفات", render:renderList},
  family:   {title:"الأسرة", render:id => renderFamily(+id)},
  kinship:  {title:"قرابة العوائل", render:renderKinship},
  tree:     {title:"شجرة العائلة", render:id => { if(!NAV_WAS_BACK) TREE_MODE = "cards"; renderTree(id ? +id : null); }},
  reports:  {title:"التقارير", render:renderReports},
  report:   {title:"تقرير", render:key => renderReport(key)},
  whatsapp: {title:"مراسلة واتساب", render:renderWhatsapp},
  settings: {title:"الإعدادات والقوائم", render:renderSettings, admin:true},
  users:    {title:"المستخدمون", render:renderUsers, admin:true},
  requests: {title:"طلبات الانضمام", render:id => { RQ.focusDone = false; return renderRequests(id); }, admin:true},
  data:     {title:"استيراد وتصدير", render:renderData},
  about:    {title:"من نحن", render:n => renderAbout(n)},
  events:   {title:"مناسبات العائلة", render:renderEvents},
  event:    {title:"مناسبة", render:id => renderEvent(+id)},
  heritage: {title:"تراث العائلة", render:t => renderHeritage(t)},
  market:   {title:"سوق العائلة", render:renderMarket, admin:true}, // مخفي عن المستخدمين مؤقتاً — للمدير فقط
};
let currentHash = "", skipGuard = false, restoring = false;
let NAV_FROM_BACK = false, NAV_WAS_BACK = false, PAGE_NAME = "home";
/* سجل التنقل الخاص بالبرنامج: يبقى بعد تحديث الصفحة، وزر «رجوع» يرجع خطوة واحدة فقط */
let NAV_STACK = (() => { try{ return JSON.parse(sessionStorage.getItem("f4_nav") || "[]"); }catch(e){ return []; } })();
const saveNav = () => { try{ sessionStorage.setItem("f4_nav", JSON.stringify(NAV_STACK.slice(-60))); }catch(e){} };
/* خطوات داخل الصفحة نفسها (مثل اختيار عائلة أو تغيير طريقة العرض): «رجوع» يتراجع عنها أولاً */
let PAGE_STEPS = [];
function pageStep(undo){ PAGE_STEPS.push(undo); }
function trackNav(hash){
  const h = hash || "#/home";
  NAV_WAS_BACK = false;
  if(NAV_FROM_BACK){ NAV_FROM_BACK = false; NAV_WAS_BACK = true; }
  else if(NAV_STACK.length > 1 && NAV_STACK[NAV_STACK.length - 2] === h){ NAV_STACK.pop(); NAV_WAS_BACK = true; } // زر الرجوع في المتصفح/الهاتف
  else if(NAV_STACK[NAV_STACK.length - 1] !== h) NAV_STACK.push(h);
  if(NAV_STACK[NAV_STACK.length - 1] !== h) NAV_STACK.push(h);
  saveNav();
}

function parseHash(){
  const [name = "home", ...args] = location.hash.replace(/^#\/?/, "").split("/");
  return {name: ROUTES[name] ? name : "home", args: args.map(decodeURIComponent)};
}
async function route(){
  if(!S.me) return;
  if(restoring){ restoring = false; return; } // رجوع بعد إلغاء الخروج — نبقي التعديلات كما هي
  if(S.dirty && !skipGuard && location.hash !== currentHash){
    if(!(await ask("تغييرات غير محفوظة", "لم تحفظ التعديلات. الخروج بدون حفظ؟", {okText:"خروج بدون حفظ", danger:true}))){
      restoring = true; if(NAV_FROM_BACK){ NAV_FROM_BACK = false; NAV_STACK.push(currentHash || "#/home"); saveNav(); } location.hash = currentHash; return;
    }
    S.dirty = false;
  }
  skipGuard = false; S.dirty = false; currentHash = location.hash;
  const {name, args} = parseHash(), r = ROUTES[name];
  if(S.mustRegister){ closeNav(); PAGE_NAME = "home"; $("#crumb").textContent = "إكمال التسجيل"; renderSelfRegister(); return; }
  useTreeData(name === "tree");
  trackNav(location.hash); PAGE_STEPS = []; PAGE_NAME = name;
  closeNav();
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === (name === "event" ? "events" : name)));
  $("#crumb").textContent = r.title;
  const v = $("#view");
  if((r.perm && !can(r.perm)) || (r.admin && !isAdmin())){
    v.innerHTML = `<div class="card narrow"><h3>غير مسموح</h3><p>ليست لديك صلاحية «${esc(r.title)}». اطلب من المدير تفعيلها لك.</p><a class="btn" href="#/home">العودة للرئيسية</a></div>`;
    return;
  }
  window.scrollTo(0, 0);
  try{ await r.render(...args); }
  catch(err){ console.error(err); v.innerHTML = `<div class="card narrow"><p class="err">${esc(errMsg(err))}</p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div>`; }
  v.focus({preventScroll:true});
}
window.addEventListener("hashchange", route);
/* زر «رجوع» داخل الصفحة نفسها (أعلى المحتوى) في كل الصفحات عدا الرئيسية */
const BACK_HTML = `<button type="button" class="page-back" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>رجوع</button>`;
function ensureBack(){
  const v = $("#view"); if(!v) return;
  const has = v.firstElementChild && v.firstElementChild.matches(".page-back");
  if(PAGE_NAME === "home" || PAGE_NAME === "event"){ if(has) v.firstElementChild.remove(); return; }
  if(!has && v.firstElementChild) v.insertAdjacentHTML("afterbegin", BACK_HTML);
}
new MutationObserver(ensureBack).observe($("#view"), {childList:true});
document.addEventListener("click", e => {
  if(!e.target.closest("[data-back]")) return;
  if(PAGE_STEPS.length){ PAGE_STEPS.pop()(); return; }
  const cur = location.hash || "#/home";
  while(NAV_STACK.length && NAV_STACK[NAV_STACK.length - 1] === cur) NAV_STACK.pop();
  const prev = NAV_STACK[NAV_STACK.length - 1] || "#/home";
  saveNav(); NAV_FROM_BACK = true; location.hash = prev;
});
window.addEventListener("beforeunload", e => { if(S.dirty){ e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]");
  if(o){ e.preventDefault();
    if(S.allowed && isRestricted() && !S.allowed.has(+o.dataset.open)) return toast("لا تملك صلاحية الاطلاع على بيانات هذا الفرد", true);
    const d = o.closest("dialog"); if(d) d.close(); location.hash = "#/rec/" + o.dataset.open; }
});

/* القائمة الجانبية على الجوال */
function closeNav(){ $("#sidenav").classList.remove("open"); $("#scrim").hidden = true; $("#navBtn").setAttribute("aria-expanded", "false"); }
$("#navBtn").onclick = () => { const o = !$("#sidenav").classList.contains("open"); $("#sidenav").classList.toggle("open", o); $("#scrim").hidden = !o; $("#navBtn").setAttribute("aria-expanded", String(o)); };
$("#scrim").onclick = closeNav;

/* الوضع الليلي */
(function(){ let t = null; try{ t = localStorage.getItem("f4-theme"); }catch(e){} if(t) document.documentElement.dataset.theme = t; })();
$("#themeBtn").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const nx = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = nx;
  try{ localStorage.setItem("f4-theme", nx); }catch(e){}
};

/* ===== الدخول ===== */
$("#loginForm").onsubmit = async e => {
  e.preventDefault(); const btn = $("#lBtn"); $("#lErr").textContent = "";
  const email = $("#lEmail").value.trim().toLowerCase(), password = $("#lPass").value;
  if(!email || !password){ $("#lErr").textContent = "أدخل البريد وكلمة السر"; return; }
  btn.disabled = true; btn.textContent = "جاري الدخول…";
  GATE.want = !gateReduce(); // حركة البوابة الذهبية بعد نجاح الدخول
  try{ const {error} = await db.auth.signInWithPassword({email, password}); if(error) throw error; }
  catch(err){ GATE.want = false; $("#lErr").textContent = (/not confirmed|Invalid login/i.test(err.message || "") && await pendingLoginMessage(email)) || errMsg(err); }
  finally{ btn.disabled = false; btn.textContent = "دخول"; }
};
$("#lForgot").onclick = async () => {
  const email = $("#lEmail").value.trim().toLowerCase();
  if(!email){ $("#lErr").textContent = "اكتب بريدك أولاً ثم اضغط «نسيت كلمة السر»"; return; }
  const {error} = await db.auth.resetPasswordForEmail(email, {redirectTo: APP_URL});
  $("#lErr").textContent = error ? errMsg(error) : "أرسلنا رابط تعيين كلمة السر إلى بريدك";
};
$("#lSignup").onclick = openJoin;
$("#myQrBtn").onclick = () => { closeNav(); qrMine(); };
$("#pwBtn").onclick = async () => {
  closeNav();
  const p1 = await ask("تغيير كلمة السر", "اكتب كلمة السر الجديدة (6 أحرف على الأقل)", {input:true, type:"password", okText:"متابعة"});
  if(p1 === null) return;
  if(p1.length < 6){ toast("كلمة السر يجب أن تكون 6 أحرف على الأقل", true); return; }
  const p2 = await ask("تأكيد كلمة السر", "اكتب كلمة السر الجديدة مرة ثانية", {input:true, type:"password", okText:"حفظ"});
  if(p2 === null) return;
  if(p1 !== p2){ toast("كلمتا السر غير متطابقتين — حاول مرة ثانية", true); return; }
  const {error} = await db.auth.updateUser({password:p1});
  toast(error ? errMsg(error) : "تم تغيير كلمة السر ✓", !!error);
};
$("#logoutBtn").onclick = async () => {
  if(S.dirty && !(await ask("تغييرات غير محفوظة", "الخروج سيلغي التعديلات. متابعة؟", {danger:true}))) return;
  S.dirty = false; await db.auth.signOut();
};

let booted = false;
db.auth.onAuthStateChange((event, session) => {
  if(QR_PENDING) return; // دخول برمز QR قيد التنفيذ
  if(event === "PASSWORD_RECOVERY"){
    setTimeout(async () => {
      const p = await ask("كلمة سر جديدة", "اكتب كلمة السر الجديدة (6 أحرف على الأقل)", {input:true, type:"password"});
      if(p){ const {error} = await db.auth.updateUser({password:p}); toast(error ? errMsg(error) : "تم تغيير كلمة السر", !!error); }
    }, 0);
  }
  if(!session){ booted = false; S.me = null; S.mustRegister = false; $("#app").hidden = true; $("#vLogin").hidden = false;
    const jm = location.hash.match(/^#\/join(?:\/([^/]*))?(?:\/([^/]*))?/);
    if(jm && !$("#dJoin").open){ const dec = x => { try{ return decodeURIComponent(x || ""); }catch(e){ return ""; } }; setTimeout(() => openJoin({name:dec(jm[1]), relation:dec(jm[2])}), 50); }
    return; }
  if(booted) return; booted = true;
  setTimeout(() => boot(session), 0); // خارج نداء المصادقة لتجنب التعليق
});
if(QR_PENDING) qrLogin(QR_PENDING);

async function boot(session){
  S.email = (session.user.email || "").toLowerCase();
  if(GATE.want) await gateClose(); // تُغلق البوابة فوق شاشة الدخول أولاً
  $("#vLogin").hidden = true; $("#app").hidden = false;
  $("#view").innerHTML = `<div class="spin" aria-label="جاري التحميل"></div>`;
  try{
    const {data, error} = await db.from("f4_users").select("*").eq("email", S.email).maybeSingle();
    if(error) throw error;
    if(!data){
      const st = (await db.rpc("f4_request_status", {p_email:S.email})).data;
      $("#view").innerHTML = st === "pending" ? `<div class="card narrow"><h3>طلبك قيد المراجعة</h3><p>وصل طلب انضمامك إلى الإدارة، وستتمكن من استخدام البرنامج بعد الموافقة وتحديد صلاحياتك.</p><button class="btn" type="button" id="noRoleOut">تسجيل الخروج</button></div>`
        : st === "rejected" ? `<div class="card narrow"><h3>لم تتم الموافقة على الطلب</h3><p>للاستفسار تواصل مع إدارة البرنامج عبر واتساب: <span class="ltr">${esc(CONTACT_WA)}</span></p><button class="btn" type="button" id="noRoleOut">تسجيل الخروج</button></div>`
        : `<div class="card narrow"><h3>الحساب غير مفعّل</h3><p>البريد <b class="ltr">${esc(S.email)}</b> غير مضاف إلى البرنامج بعد. سجّل طلب انضمام من زر «تسجيل عضو جديد» في شاشة الدخول، أو اطلب من المدير إضافتك.</p><button class="btn" type="button" id="noRoleOut">تسجيل الخروج</button></div>`;
      $("#noRoleOut").onclick = () => db.auth.signOut(); return;
    }
    if(data.frozen && data.role !== "admin"){
      $("#view").innerHTML = `<div class="card narrow frozen-card"><div class="fz-ic" aria-hidden="true">❄</div><h3>الحساب مجمّد</h3><p>تم تجميد حسابك مؤقتاً من إدارة البرنامج، فلا يمكنك الدخول الآن. للاستفسار تواصل مع الإدارة عبر واتساب: <span class="ltr">${esc(CONTACT_WA)}</span></p><button class="btn" type="button" id="noRoleOut">تسجيل الخروج</button></div>`;
      $("#noRoleOut").onclick = () => db.auth.signOut(); return;
    }
    S.me = data;
    applyPerms();
    renderTopExtra();
    logVisit();
    refreshReqBadge(true);
    await Promise.all([loadAll(), treeFullLoad()]);
    currentHash = location.hash;
    S.mustRegister = needsSelfRegister();
    route();
    bdBadge(true);
  }catch(err){
    $("#view").innerHTML = `<div class="card narrow"><p class="err">${esc(errMsg(err))}</p><button class="btn" type="button" onclick="location.reload()">إعادة المحاولة</button></div>`;
  }finally{ if(GATE.el) gateOpen(); }
}
/* شريط «آخر التحديثات» في الرئيسية: يمشي من اليمين إلى اليسار، يتوقف عند المرور أو اللمس وبزر الإيقاف.
   المحتوى مكرر مرتين (الثانية مخفية عن قارئ الشاشة) ليدور بلا انقطاع */
function newsTicker(list){
  const item = p => `<button type="button" class="nt-chip" data-open="${p.id}"><b>${nm(p, fullName(p, 3))}</b>${p.updated_at ? `<small>حُدّث ${fmtDate(p.updated_at.slice(0, 10))}</small>` : ""}</button><span class="nt-sep" aria-hidden="true">✦</span>`;
  const L = list.length < 6 ? Array.from({length:Math.ceil(6 / list.length)}, () => list).flat() : list; // سجلات قليلة: تُكرر حتى يمتلئ الشريط
  const set = L.map(item).join("");
  const dur = Math.max(24, list.length * 4.5);
  return `<div class="sec-h nt-h">آخر السجلات المحدّثة</div>
    <div class="nt" role="region" aria-label="آخر السجلات المحدّثة"><span class="nt-lbl"><i aria-hidden="true"></i>آخر التحديثات</span>
      <div class="nt-tk" id="ntTk"><div class="nt-track" style="--nt-dur:${dur}s"><div class="nt-set">${set}</div><div class="nt-set" aria-hidden="true">${set.replace(/<button /g, '<button tabindex="-1" ')}</div></div></div>
      <button type="button" class="nt-pause" id="ntPause" aria-pressed="false">إيقاف</button></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("#ntPause"); if(!b) return;
  const on = $("#ntTk").classList.toggle("paused"); b.setAttribute("aria-pressed", on); b.textContent = on ? "تشغيل" : "إيقاف";
});
/* عناصر الشريط العلوي: الترحيب، «من نحن»، عداد الزيارات */
function renderTopExtra(){
  const el = $("#topExtra"); if(!el) return;
  el.innerHTML = `<span class="greet-h"><button type="button" class="greet" id="greet" title="اضغط لتطلق سهماً">أهلاً ${esc(S.me.display_name || "")}</button><span class="greet-score" id="greetScore" hidden></span></span>${aboutMenuHtml()}<${isAdmin() ? 'a href="#/users"' : "span"} class="visits-pill" id="statVisits" title="عدد الزيارات"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg><b>…</b><span>زيارة</span><small></small></${isAdmin() ? "a" : "span"}>`;
  bindAboutMenu(); bindGreet(); fillVisitStat();
}

/* الترحيب التفاعلي: كل ضغطة تطلق سهماً يصيب الكلمة */
let GREET_HITS = 0;
const GREET_ARROW = '<svg viewBox="0 0 64 14" aria-hidden="true"><path d="M60 7H6"/><path d="M14 2 6 7l8 5"/><path d="M60 7l-6-5M60 7l-6 5M54 7l-6-5M54 7l-6 5"/></svg>';
function bindGreet(){
  const g = $("#greet"); if(!g) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shoot = (count = true) => {
    const a = document.createElement("span"); a.className = "greet-fly"; a.innerHTML = GREET_ARROW; g.appendChild(a);
    setTimeout(() => {
      a.remove();
      g.classList.remove("hit"); void g.offsetWidth; g.classList.add("hit");
      for(let i = 0; i < 10; i++){
        const sp = document.createElement("i"), ang = Math.random() * Math.PI * 2, d = 26 + Math.random() * 46;
        sp.className = "greet-spark"; sp.style.setProperty("--x", Math.cos(ang) * d + "px"); sp.style.setProperty("--y", Math.sin(ang) * d + "px");
        g.appendChild(sp); setTimeout(() => sp.remove(), 750);
      }
      if(count){ GREET_HITS++; const sc = $("#greetScore"); if(sc){ sc.hidden = false; sc.textContent = GREET_HITS + " إصابة"; } }
    }, reduce ? 0 : 340);
  };
  g.onclick = () => shoot(true);
  if(GREET_HITS){ const sc = $("#greetScore"); sc.hidden = false; sc.textContent = GREET_HITS + " إصابة"; }
  /* سهم ترحيبي واحد عند أول فتح للرئيسية في الجلسة */
  let first = false; try{ first = !sessionStorage.getItem("f4-greet"); sessionStorage.setItem("f4-greet", "1"); }catch(e){}
  if(first && !reduce) setTimeout(() => { if(document.body.contains(g)) shoot(false); }, 700);
}

/* تسجيل زيارة واحدة لكل جلسة متصفح */
function logVisit(){
  const k = "f4-visit-" + S.email;
  try{ if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); }catch(e){}
  const device = matchMedia("(max-width: 760px), (pointer: coarse)").matches ? "mobile" : "desktop";
  db.from("f4_visits").insert({email:S.email, device}).then(({error}) => { if(error) try{ sessionStorage.removeItem(k); }catch(e){} });
}
async function fillVisitStat(){
  const el = $("#statVisits"); if(!el) return;
  const {data, error} = await db.rpc("f4_visit_stats");
  if(!$("#statVisits")) return;
  if(error || !data){ el.hidden = true; return; }
  el.querySelector("b").textContent = Number(data.total).toLocaleString("en-US");
  el.querySelector("small").textContent = `اليوم ${data.today}`;
  el.title = `عدد الزيارات: ${data.total} — اليوم ${data.today} · هذا الشهر ${data.month} · ${data.visitors} زائراً`;
}
function applyPerms(){
  $$("[data-perm]").forEach(el => el.hidden = !can(el.dataset.perm));
  $$("[data-admin]").forEach(el => el.hidden = !isAdmin());
  const mq = $("#myQrBtn"); if(mq) mq.hidden = isAdmin();
  const rights = (isAdmin() ? "مدير" : ["add","edit","delete"].filter(can).map(p => ({add:"إضافة", edit:"تعديل", delete:"حذف"}[p])).join("، ") || "مشاهدة فقط") + (!isAdmin() && (can("add") || can("edit")) ? " · لنفسه وأسرته" : "");
  $("#whoAmI").innerHTML = `<div class="who-l1"><b>${esc(S.me.display_name || "مرحباً")}</b><span class="who-role">${esc(rights)}</span></div><span class="who-mail ltr">${esc(S.email)}</span>`;
  $("#whoAmI").title = S.email;
}

/* ===== الرئيسية ===== */
const ICON = {
  add:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', edit:'<path d="M4 20h4l11-11-4-4L4 16z"/>',
  del:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  tree:'<rect x="9" y="2.5" width="6" height="5" rx="1"/><rect x="2.5" y="16.5" width="6" height="5" rx="1"/><rect x="15.5" y="16.5" width="6" height="5" rx="1"/><path d="M12 7.5V12M5.5 16.5V12h13v4.5"/>',
  rep:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>', wa:'<path d="M4 20l1.4-4A8 8 0 1 1 8 18.7z"/>',
  set:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/>', data:'<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v3h16v-3"/>',
  kin:'<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 9 11 15.5M15.5 9 13 15.5M9 7h6"/>',
  cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  about:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  cake:'<path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0M12 13V9M12 6.5a1.2 1.2 0 0 1 0-2.5"/>',
};
const tile = (href, ic, t, s, attr = "") => `<a class="tile" href="${href}" ${attr}><span class="ic"><svg viewBox="0 0 24 24">${ICON[ic]}</svg></span><b>${t}</b><small>${s}</small></a>`;
function renderHome(){
  const P = S.people, alive = P.filter(p => !isDead(p)).length;
  const m = P.filter(p => p.gender === "ذكر").length, f = P.filter(p => p.gender === "أنثى").length;
  const fams = new Set(P.filter(p => childrenOf(p).length && isM(p)).map(p => p.id)).size;
  const mon = +todayISO().slice(5, 7);
  const bdays = P.filter(p => p.birth_date && !isDead(p) && +p.birth_date.slice(5, 7) === mon).length;
  const recent = P.slice().sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 10);
  $("#view").innerHTML = `
    <section class="hero-banner" aria-label="شجرة العائلة">
      <img class="hb-water" src="img/logo-mark-light.png" alt="" aria-hidden="true">
      <span class="logo-anim hb-mark"><i class="la-beam"></i><span class="la-in"><img src="img/logo-mark-light.png" alt="شعار شجرة العائلة" width="96" height="128"><i class="la-glow"></i><i class="la-shine"></i></span></span>
      <div class="hb-text">
        <span class="hb-kick">أهلاً بكم في</span>
        <h1>شجرة العائلة</h1>
        <p>جذور ممتدة وأجيال متصلة</p>
        <div class="hb-facts"><span><b>${P.length}</b> فرداً</span><span><b>${P.length ? Math.max(...P.map(p => lineChain(p).length)) + 1 : 0}</b> أجيال</span><span><b>${fams}</b> أسرة</span></div>
      </div>
      <div class="hb-acts"><a class="hb-btn gold" href="#/add" data-perm="add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>إضافة سجل</a><a class="hb-btn" href="#/list"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>بحث</a></div>
      <svg class="hb-arc" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 Q500 -10 1000 60 Z"></path></svg>
    </section>

    ${isAdmin() ? new24Html() : ""}
    ${bdayCardHtml()}
    <div class="stats">
      <div class="stat gold"><b>${P.length}</b><span>إجمالي الأفراد</span></div>
      <div class="stat st-alive"><b>${alive}</b><span>على قيد الحياة</span></div>
      <div class="stat st-dead"><b>${P.length - alive}</b><span>متوفون</span></div>
      <div class="stat st-m"><b>${m}</b><span>ذكور</span></div>
      <div class="stat st-f"><b>${f}</b><span>إناث</span></div>
      <div class="stat"><b>${fams}</b><span>آباء لهم أبناء</span></div>
      <a class="stat" href="#/report/inlaws" style="text-decoration:none"><b>${P.filter(p => p.affiliation === "منتسب بالزواج").length}</b><span>منتسبون بالزواج</span></a>
    </div>
    <div class="tiles">
      ${heritageTile()}
      ${isAdmin() ? marketTile() : ""}
      ${tile("#/add","add","إضافة سجل","ملف جديد برقم تسلسل", 'data-perm="add"')}
      ${tile("#/edit","edit","تعديل سجل","بالرقم أو بالاسم", 'data-perm="edit"')}
      ${tile("#/delete","del","حذف سجل","مع تأكيد قبل الحذف", 'data-perm="delete"')}
      ${tile("#/list","search","البحث والملفات","فرز حسب المنطقة والفرع والحالة")}
      ${tile("#/tree","tree","شجرة العائلة","الأبناء والأحفاد تلقائياً")}
      ${tile("#/events","cam","مناسبات العائلة","صور وفيديوهات المناسبات")}
      ${tile("#/kinship","kin","قرابة العوائل","الروابط بين العوائل وحاسبة القرابة")}
      ${tile("#/reports","rep","التقارير",`${REPORTS.length} تقريراً جاهزاً للطباعة`)}
      ${tile("#/report/birthdays","cake","أعياد الميلاد",`${bdays} هذا الشهر`)}
      ${tile("#/whatsapp","wa","مراسلة واتساب","رسالة جماعية للأفراد")}
      ${tile("#/settings","set","الإعدادات والقوائم","المناطق والمؤهلات والوظائف…", "data-admin")}
      ${tile("#/users","users","المستخدمون","صلاحيات الإضافة والتعديل والحذف", "data-admin")}
      ${tile("#/data","data","استيراد وتصدير","Excel")}
    </div>
    ${recent.length ? newsTicker(recent) : ""}`;
  applyPerms(); fillVisitStat(); homeOdo(); fillHeritageTile(); bindNew24(); if(isAdmin()){ fillMarketTile(); fillBdayCard(); }
}

/* عدّاد المضافين خلال 24 ساعة — للمدير فقط */
const added24 = () => { const t = Date.now() - 864e5; return S.people.filter(p => p.created_at && new Date(p.created_at).getTime() >= t).sort((a, b) => b.created_at.localeCompare(a.created_at)); };
function new24Html(){
  const n = added24().length;
  return `<button type="button" class="new24${n ? "" : " zero"}" id="new24" data-admin aria-label="المضافون خلال آخر 24 ساعة: ${n}">
    <span class="n24"><b>${n}</b></span><span class="t24"><b>${n ? (n === 1 ? "سجل جديد" : n === 2 ? "سجلان جديدان" : n <= 10 ? "سجلات جديدة" : "سجلاً جديداً") : "لا سجلات جديدة"}</b><small>أُضيفت خلال آخر 24 ساعة · للمدير فقط</small></span>${n ? '<span class="go24">عرض ‹</span>' : ""}</button>`;
}
const agoT = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? "الآن" : m < 60 ? `قبل ${m} دقيقة` : `قبل ${Math.round(m / 60)} ساعة`; };
function bindNew24(){
  const b = $("#new24"); if(!b) return;
  b.onclick = () => {
    const L = added24(); if(!L.length) return;
    const by = p => (p.created_by || p.updated_by || "").split("@")[0];
    const d = modal(`المضافون خلال آخر 24 ساعة (${L.length})`, `<div class="plist">${L.map(p => personBtn(p, [agoT(p.created_at), by(p) && "بواسطة " + by(p)].filter(Boolean).join(" · "))).join("")}</div>`,
      {foot:`<button class="btn primary" type="button" onclick="this.closest('dialog').close()">إغلاق</button>`});
    d.querySelectorAll(".pbtn").forEach(x => x.addEventListener("click", () => d.close()));
  };
}

/* عدّاد دوّار لأرقام الصفحة الرئيسية — يعمل في كل مرة تُعرض فيها */
function odo(el, delay){
  const s = (el.textContent || "").trim();
  if(!/^\d+$/.test(s) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.setAttribute("aria-label", s);
  el.innerHTML = '<span class="odo" aria-hidden="true">' + [...s].map(() => '<span class="col">' + [...Array(20)].map((_, i) => "<span>" + (i % 10) + "</span>").join("") + "</span>").join("") + "</span>";
  const cols = el.querySelectorAll(".col");
  setTimeout(() => cols.forEach((c, i) => { c.style.transitionDelay = (i * 0.08) + "s"; c.style.transform = "translateY(-" + ((10 + +s[i]) * 1.15) + "em)"; }), delay + 30);
}
function homeOdo(){
  document.querySelectorAll("#view .hb-facts b").forEach((b, i) => odo(b, 200 + i * 120));
  document.querySelectorAll("#view .stats .stat > b").forEach((b, i) => odo(b, 350 + i * 90));
  const n24 = document.querySelector("#view .new24 .n24 b"); if(n24) odo(n24, 150);
}

/* ===== من نحن ===== */
let ABOUT = null;
const ABOUT_DEFAULT = ["عن العائلة", "رؤيتنا", "أهدافنا", "كلمة أخيرة"];
/* يقسم النص إلى أقسام: السطر القصير في أول الفقرة (مع : أو بدونها) عنوان القسم */
function aboutSections(txt){
  const out = [];
  String(txt || "").replace(/\r/g, "").split(/\n\s*\n/).forEach(blk => {
    const raw = blk.split("\n").filter(x => x.trim());
    if(!raw.length) return;
    const first = raw[0].trim().replace(/[:：]\s*$/, "").trim();
    const isHead = first.length <= 40 && !/[.،؟!]$/.test(first) && (raw.length > 1 || /[:：]\s*$/.test(raw[0]));
    const lines = (isHead ? raw.slice(1) : raw).map(x => ({t:x.trim(), sign:/^\s{8,}/.test(x)}));
    if(isHead || !out.length) out.push({title:isHead ? first : "", lines});
    else out[out.length - 1].lines.push(...lines);
  });
  return out;
}
async function loadAbout(){
  if(ABOUT !== null) return ABOUT;
  const {data, error} = await db.from("f4_settings").select("value").eq("key", "about").maybeSingle();
  if(error) throw error;
  return (ABOUT = data ? data.value : "");
}
const aboutTitles = () => { const t = aboutSections(ABOUT || "").map(x => x.title).filter(Boolean); return t.length ? t : ABOUT_DEFAULT; };

/* القائمة المنسدلة لزر «من نحن» */
function aboutMenuHtml(){
  return `<div class="dd" id="abDD"><button type="button" class="btn dd-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="abMenu">من نحن<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="dd-menu" id="abMenu" role="menu" hidden></div></div>`;
}
function bindAboutMenu(){
  const dd = $("#abDD"); if(!dd) return;
  const btn = dd.querySelector(".dd-btn"), menu = $("#abMenu");
  const fill = () => { menu.innerHTML = aboutTitles().map((t, i) => `<a role="menuitem" href="#/about/${i}"><span class="dd-n">${i + 1}</span>${esc(t)}</a>`).join(""); };
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); document.removeEventListener("click", outside, true); document.removeEventListener("keydown", onKey); };
  const outside = e => { if(!dd.contains(e.target)) close(); };
  const onKey = e => {
    const items = [...menu.querySelectorAll("a")], k = items.indexOf(document.activeElement);
    if(e.key === "Escape"){ close(); btn.focus(); }
    else if(e.key === "ArrowDown"){ e.preventDefault(); items[(k + 1) % items.length]?.focus(); }
    else if(e.key === "ArrowUp"){ e.preventDefault(); items[(k - 1 + items.length) % items.length]?.focus(); }
  };
  btn.onclick = async () => {
    if(!menu.hidden) return close();
    fill(); menu.hidden = false; btn.setAttribute("aria-expanded", "true");
    document.addEventListener("click", outside, true); document.addEventListener("keydown", onKey);
    if(ABOUT === null){ try{ await loadAbout(); fill(); }catch(e){} }
  };
  menu.onclick = e => { if(e.target.closest("a")) close(); };
  if(ABOUT === null) loadAbout().catch(() => {});
}

async function renderAbout(n){
  const v = $("#view");
  v.innerHTML = `<div class="page-h"><h2>من نحن</h2><div class="acts"><button class="btn" id="abEdit" data-admin hidden>تعديل النص</button></div></div><div id="abBody"><p class="muted">جارٍ التحميل…</p></div>`;
  applyPerms();
  try{ await loadAbout(); }catch(e){ $("#abBody").innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`; return; }
  if(!$("#abBody")) return;
  const P = S.people, alive = P.filter(p => !isDead(p)).length;
  const show = () => {
    const secs = aboutSections(ABOUT);
    if(!secs.length){ $("#abBody").innerHTML = '<div class="card"><p class="muted">لم يُكتب نص بعد.</p></div>'; return; }
    const i = Math.min(Math.max(0, parseInt(n, 10) || 0), secs.length - 1), sec = secs[i];
    const prev = secs[i - 1], next = secs[i + 1];
    $("#abBody").innerHTML = `
      ${secs.length > 1 ? `<nav class="ab-tabs" aria-label="أقسام من نحن">${secs.map((x, k) => `<a href="#/about/${k}" class="${k === i ? "on" : ""}" ${k === i ? 'aria-current="page"' : ""}>${esc(x.title || "مقدمة")}</a>`).join("")}</nav>` : ""}
      <article class="card about">
        <header class="ab-hero"><span class="ab-kick">من نحن · ${i + 1} من ${secs.length}</span><h3>${esc(sec.title || "من نحن")}</h3></header>
        <div class="ab-body">${sec.lines.map(l => `<p class="${l.sign ? "ab-sign" : ""}">${esc(l.t)}</p>`).join("")}</div>
        ${secs.length > 1 ? `<div class="ab-pn">${prev ? `<a href="#/about/${i - 1}" class="ab-prev"><small>السابق</small>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="#/about/${i + 1}" class="ab-next"><small>التالي</small>${esc(next.title)}</a>` : ""}</div>` : ""}
        <div class="ab-nums"><div><b>${P.length}</b><span>فرداً مسجلاً</span></div><div><b>${alive}</b><span>على قيد الحياة</span></div><div><b>${P.length ? Math.max(...P.map(p => lineChain(p).length)) + 1 : 0}</b><span>جيلاً في السجل</span></div></div>
        <a class="btn wa ab-wa" data-contact href="${esc(contactLink())}" target="_blank" rel="noopener">تواصل مع إدارة البرنامج</a>
      </article>`;
    fillContact();
  };
  show();
  const ed = $("#abEdit");
  if(isAdmin()) ed.hidden = false;
  ed.onclick = () => {
    $("#abBody").innerHTML = `<div class="card about-edit">
      <div class="field"><label for="abTxt">نص صفحة «من نحن»</label><textarea class="inp" id="abTxt" rows="18" maxlength="12000">${esc(ABOUT)}</textarea></div>
      <p class="muted" style="font-size:13px">اترك سطراً فارغاً بين الأقسام. السطر القصير في أول القسم (مثل «رؤيتنا:») يصبح عنواناً له ويظهر في قائمة «من نحن».</p>
      <div class="toolbar" style="margin:0"><button class="btn primary" id="abSave">حفظ</button><button class="btn" id="abCancel">إلغاء</button></div></div>`;
    ed.hidden = true;
    $("#abCancel").onclick = () => { ed.hidden = false; show(); };
    $("#abSave").onclick = async () => {
      const val = $("#abTxt").value;
      const {error} = await db.from("f4_settings").upsert([{key:"about", value:val, updated_at:new Date().toISOString(), updated_by:S.me.email}], {onConflict:"key"});
      if(error) return toast(errMsg(error), true);
      ABOUT = val; ed.hidden = false; show(); toast("تم حفظ النص");
    };
  };
}

/* ===== بوابة رقم التسلسل (إضافة / تعديل / حذف) ===== */
function renderSerialGate(mode){
  if(mode === "add" && !isAdmin()){ location.replace("#/new/0"); return; } // العضو لا يختار رقم التسلسل
  const T = {add:["إضافة سجل","أدخل رقم التسلسل للسجل الجديد. اقترحنا الرقم التالي المتاح.","متابعة"],
             edit:["تعديل سجل","أدخل رقم التسلسل، أو ابحث بالاسم.","فتح السجل"],
             delete:["حذف سجل","أدخل رقم تسلسل السجل المراد حذفه، أو ابحث بالاسم.","عرض السجل"]}[mode];
  $("#view").innerHTML = `
    <div class="page-h"><h2>${T[0]}</h2></div>
    <form class="card narrow" id="gate" novalidate>
      <p class="muted" style="margin-top:0">${T[1]}</p>
      <div class="field req"><label for="gSerial">رقم التسلسل</label><input class="inp ltr" id="gSerial" type="number" inputmode="numeric" min="1" required value="${mode === "add" ? nextSerial() : ""}"></div>
      <div class="err" id="gErr" role="alert"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <button class="btn primary" type="submit">${T[2]}</button>
        ${mode !== "add" ? `<button class="btn" type="button" id="gFind">بحث بالاسم…</button>` : ""}
        <a class="btn" href="#/home">رجوع</a>
      </div>
      <div id="gOut"></div>
    </form>`;
  const inp = $("#gSerial"); inp.focus(); inp.select();
  const go = p => mode === "delete" ? showDeleteCard(p) : (location.hash = "#/rec/" + p.id);
  $("#gate").onsubmit = e => {
    e.preventDefault(); $("#gErr").textContent = ""; $("#gOut").innerHTML = "";
    const n = parseInt(inp.value, 10);
    if(!(n > 0)){ $("#gErr").textContent = "أدخل رقم تسلسل صحيح"; return; }
    const ex = S.bySerial.get(n);
    if(mode === "add"){
      if(ex){ $("#gErr").innerHTML = `هذا الرقم مسجل مسبقاً لـ «${nm(ex, fullName(ex))}». <a href="#/rec/${ex.id}">فتح السجل</a>`; return; }
      location.hash = "#/new/" + n; return;
    }
    if(!ex){ $("#gErr").textContent = `لا يوجد سجل برقم ${n}`; return; }
    go(ex);
  };
  if($("#gFind")) $("#gFind").onclick = async () => { const p = await pickPerson("اختيار السجل"); if(p){ inp.value = p.serial; go(p); } };
}
function showDeleteCard(p){
  const kids = childrenOf(p), sp = spousesOf(p);
  $("#gOut").innerHTML = `<div class="notice" style="margin-top:14px">
    <div style="display:flex;gap:10px;align-items:center">${avatar(p)}<div><b>${nm(p, longName(p))}</b><br><small>#${p.serial}${p.cpr ? " · " + esc(p.cpr) : ""}</small></div></div>
    <p style="margin:10px 0 4px">سيُحذف هذا السجل نهائياً. ${kids.length ? `<b>${kids.length}</b> من الأبناء سيبقون في البرنامج لكن بدون ربط بهذا الوالد.` : ""} ${sp.length ? `وسيُلغى ربط ${sp.length} زواج.` : ""}</p>
    <button class="btn danger-fill" type="button" id="gDel">حذف السجل</button></div>`;
  $("#gDel").onclick = () => deletePerson(p, () => { $("#gOut").innerHTML = ""; $("#gSerial").value = ""; });
}
async function deletePerson(p, after){
  if(!(await ask("تأكيد الحذف", `هل أنت متأكد من حذف سجل «${fullName(p)}» رقم ${p.serial}؟`, {okText:"نعم، احذف", danger:true}))) return;
  if(!(await ask("تأكيد أخير", "لا يمكن التراجع عن الحذف. متابعة؟", {okText:"حذف نهائي", danger:true}))) return;
  /* حذف أسطر الزواج التي تشير لهذا الشخص في سجلات الآخرين أولاً (وإلا ترفضها قاعدة البيانات) */
  const sx = await db.from("f4_spouses").delete().eq("spouse_id", p.id);
  if(sx.error){ toast(errMsg(sx.error), true); return; }
  const {error} = await db.from("f4_people").delete().eq("id", p.id);
  if(error){ toast(errMsg(error), true); return; }
  if(p.photo_path) db.storage.from(PHOTO_BUCKET).remove([p.photo_path]);
  S.people = S.people.filter(x => x.id !== p.id);
  S.people.forEach(x => { if(x.father_id === p.id) x.father_id = null; if(x.mother_id === p.id) x.mother_id = null; });
  S.spouses = S.spouses.filter(s => s.person_id !== p.id && s.spouse_id !== p.id);
  S.sel.delete(p.id); indexPeople();
  toast("تم حذف السجل"); after && after();
}

/* ===== البحث والملفات ===== */
const LIST = {q:"", gender:"", status:"", gov:"", area:"", branch:"", family:"", marital:"", aff:"", page:0, sort:"serial"};
const PAGE = 50;
function filterPeople(F = LIST){
  const words = norm(F.q).split(" ").filter(Boolean), t = norm(F.q);
  return S.people.filter(p =>
    (!F.gender || p.gender === F.gender) && (!F.status || p.status === F.status) &&
    (!F.gov || p.governorate === F.gov) && (!F.area || p.area === F.area) &&
    (!F.branch || p.branch === F.branch) && (!F.family || p.family === F.family) &&
    (!F.marital || p.marital === F.marital) && (!F.aff || (p.affiliation || "غير محدد") === F.aff) &&
    (!words.length || String(p.serial) === t || (p.cpr || "").includes(t) || (p.phone || "").includes(t) || (p.phone2 || "").includes(t) ||
      words.every(w => norm([longName(p), p.nickname, p.branch].join(" ")).split(" ").some(x => x.startsWith(w)))));
}
function opt(list, val, all){ return `<option value="">${all}</option>` + list.map(o => `<option ${o === val ? "selected" : ""}>${esc(o)}</option>`).join(""); }
function renderList(){
  $("#view").innerHTML = `
    <div class="page-h"><h2>البحث والملفات</h2><div class="acts">
      <button class="btn" type="button" id="lExport">تصدير Excel</button>
      <button class="btn" type="button" id="lPrint">طباعة القائمة</button>
      <a class="btn primary" href="#/add" data-perm="add">+ إضافة</a></div></div>
    <div class="toolbar">
      <input class="inp grow" id="fQ" type="search" placeholder="الاسم، رقم التسلسل، الرقم الشخصي أو الهاتف…" aria-label="بحث" value="${esc(LIST.q)}">
      <select class="inp" id="fGender" aria-label="الجنس">${opt(["ذكر","أنثى"], LIST.gender, "كل الجنسين")}</select>
      <select class="inp" id="fStatus" aria-label="الحالة">${opt(["على قيد الحياة","متوفى"], LIST.status, "كل الحالات")}</select>
      <select class="inp" id="fGov" aria-label="المحافظة">${opt(lk("governorate"), LIST.gov, "كل المحافظات")}</select>
      <select class="inp" id="fArea" aria-label="المنطقة">${opt(areasOf(LIST.gov), LIST.area, "كل المناطق")}</select>
      <select class="inp" id="fBranch" aria-label="الفرع">${opt(lkUsed("branch"), LIST.branch, "كل الفروع")}</select>
      <select class="inp" id="fFamily" aria-label="العائلة">${opt(lkUsed("family"), LIST.family, "كل العائلات")}</select>
      <select class="inp" id="fMarital" aria-label="الحالة الاجتماعية">${opt(lk("marital"), LIST.marital, "كل الحالات الاجتماعية")}</select>
      <select class="inp" id="fAff" aria-label="الانتساب للعائلة">${opt(["من العائلة","منتسب بالزواج","غير محدد"], LIST.aff, "كل أنواع الانتساب")}</select>
    </div>
    <div class="toolbar" style="align-items:center">
      <span class="muted" id="lCount"></span><span style="flex:1"></span>
      <span class="muted" id="lSel"></span>
      <button class="btn small" type="button" id="lSelAll">تحديد النتائج</button>
      <button class="btn small" type="button" id="lSelNone">إلغاء التحديد</button>
      <a class="btn small wa" href="#/whatsapp">واتساب للمحددين</a>
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th style="width:36px"><span class="sr" hidden>تحديد</span></th><th>#</th><th>الاسم</th><th class="hm">الأب / الأم</th><th>الحالة</th><th class="hm">العمر</th><th class="hm">المنطقة</th><th class="hm">الهاتف</th>
    </tr></thead><tbody id="lBody"></tbody></table></div>
    <div class="pager" id="lPager"></div>`;
  applyPerms();
  const bind = (id, key, reset) => $(id).addEventListener(id === "#fQ" ? "input" : "change", e => { LIST[key] = e.target.value; LIST.page = 0; if(reset) reset(); drawList(); });
  bind("#fQ","q"); bind("#fGender","gender"); bind("#fStatus","status"); bind("#fArea","area"); bind("#fBranch","branch"); bind("#fFamily","family"); bind("#fMarital","marital"); bind("#fAff","aff");
  bind("#fGov","gov", () => { LIST.area = ""; $("#fArea").innerHTML = opt(areasOf(LIST.gov), "", "كل المناطق"); });
  $("#lSelAll").onclick = () => { filterPeople().forEach(p => S.sel.add(p.id)); drawList(); };
  $("#lSelNone").onclick = () => { S.sel.clear(); drawList(); };
  $("#lExport").onclick = () => exportPeople(filterPeople(), "قائمة-الأفراد");
  $("#lPrint").onclick = () => printHtml(reportFrame("قائمة الأفراد", filterNote(LIST), peopleTable(filterPeople(), ["serial","name","parents","age","area","phone"])));
  $("#lBody").addEventListener("click", e => {
    const cb = e.target.closest("input[type=checkbox]");
    if(cb){ cb.checked ? S.sel.add(+cb.dataset.id) : S.sel.delete(+cb.dataset.id); $("#lSel").textContent = S.sel.size ? `${S.sel.size} محدد` : ""; return; }
    const tr = e.target.closest("tr[data-id]"); if(tr) location.hash = "#/rec/" + tr.dataset.id;
  });
  drawList(); $("#fQ").focus();
}
function parentsText(p){
  const f = S.byId.get(p.father_id), m = S.byId.get(p.mother_id);
  return [f ? shortName(f) : "", m ? shortName(m) : (p.mother_name || "")].filter(Boolean).join(" / ");
}
function drawList(){
  const rows = filterPeople(), pages = Math.max(1, Math.ceil(rows.length / PAGE));
  LIST.page = Math.min(LIST.page, pages - 1);
  const slice = rows.slice(LIST.page * PAGE, LIST.page * PAGE + PAGE);
  $("#lCount").textContent = `${rows.length} من ${S.people.length} سجل`;
  $("#lSel").textContent = S.sel.size ? `${S.sel.size} محدد` : "";
  $("#lBody").innerHTML = slice.length ? slice.map(p => `<tr class="click" data-id="${p.id}">
      <td><input type="checkbox" data-id="${p.id}" ${S.sel.has(p.id) ? "checked" : ""} aria-label="تحديد ${esc(p.name1)}"></td>
      <td class="num">${p.serial}</td>
      <td><div style="display:flex;gap:8px;align-items:center">${avatar(p, "sm")}<b>${nm(p, fullName(p, 4))}</b></div></td>
      <td class="hm">${esc(parentsText(p))}</td>
      <td>${isDead(p) ? '<span class="chip dead">متوفى</span>' : '<span class="chip">حي</span>'}</td>
      <td class="num hm">${ageOf(p)}</td><td class="hm">${esc(p.area || "")}</td><td class="ltr hm" style="text-align:start">${esc(p.phone || "")}</td></tr>`).join("")
    : `<tr><td colspan="8" class="empty">لا توجد سجلات مطابقة للبحث</td></tr>`;
  $("#lPager").innerHTML = pages > 1 ? `<button class="btn small" ${LIST.page ? "" : "disabled"} id="pPrev">السابق</button><span class="muted">صفحة ${LIST.page + 1} من ${pages}</span><button class="btn small" ${LIST.page < pages - 1 ? "" : "disabled"} id="pNext">التالي</button>` : "";
  if($("#pPrev")){ $("#pPrev").onclick = () => { LIST.page--; drawList(); }; $("#pNext").onclick = () => { LIST.page++; drawList(); }; }
}

/* ===== الأسرة (الوالدان، الإخوة، الأبناء، الأحفاد، الأجداد) ===== */
function renderFamily(id){
  const p = S.byId.get(id); if(!p){ $("#view").innerHTML = isRestricted() ? `<div class="card narrow empty">لا تملك صلاحية الاطلاع على بيانات هذا الفرد. <a href="#/tree">العودة للشجرة</a></div>` : `<div class="card narrow empty">السجل غير موجود</div>`; return; }
  const f = S.byId.get(p.father_id), m = S.byId.get(p.mother_id);
  const gp = [[f && S.byId.get(f.father_id), "الجد لأب"], [f && S.byId.get(f.mother_id), "الجدة لأب"], [m && S.byId.get(m.father_id), "الجد لأم"], [m && S.byId.get(m.mother_id), "الجدة لأم"]].filter(x => x[0]);
  const sib = siblingsOf(p), kids = childrenOf(p), gens = descendantsByGen(p), sp = spousesOf(p), anc = lineChain(p);
  const grp = (t, items) => `<div class="fam-grp"><h4>${t} (${items.length})</h4>${items.length ? `<div class="plist">${items.join("")}</div>` : '<p class="muted" style="margin:0">لا يوجد</p>'}</div>`;
  $("#view").innerHTML = `
    <div class="page-h"><h2>أسرة ${nm(p, fullName(p, 3))}</h2><div class="acts">
      <a class="btn" href="#/rec/${p.id}">الملف الكامل</a><a class="btn" href="#/tree/${p.id}">الشجرة من هنا</a></div></div>
    <div class="card">
      ${grp("الوالدان", [f && personBtn(f, "الأب"), m && personBtn(m, "الأم")].filter(Boolean).concat(!m && p.mother_name ? [`<div class="pbtn" style="cursor:default"><span class="av sm f">${esc(p.mother_name.charAt(0))}</span><span><b>${esc(p.mother_name)}</b><small>الأم · غير مسجلة</small></span></div>`] : []))}
      ${grp("الأجداد", gp.map(([x, t]) => personBtn(x, t)))}
      ${grp(isM(p) ? "الزوجات" : "الأزواج", sp.map(s => s.person ? personBtn(s.person, s.ord ? (isM(p) ? "الزوجة " : "الزوج ") + s.ord : "") : `<div class="pbtn" style="cursor:default"><span class="av sm">${esc(s.name.charAt(0))}</span><span><b>${esc(s.name)}</b><small>غير مسجل</small></span></div>`))}
      ${grp("الإخوة والأخوات", sib.map(x => personBtn(x, siblingKind(p, x))))}
      ${grp("الأبناء", kids.map(x => personBtn(x, isM(x) ? "ابن" : "بنت")))}
      ${gens.slice(1).map((g, i) => grp(i === 0 ? "الأحفاد" : `الجيل ${i + 3}`, g.map(x => personBtn(x, shortName(S.byId.get(x.father_id) || S.byId.get(x.mother_id)))))).join("")}
      ${anc.length ? `<div class="fam-grp"><h4>سلسلة النسب من جهة الأب (${anc.length})</h4><p style="margin:0;line-height:2">${[p, ...anc].map(x => `<a href="#/rec/${x.id}">${esc(x.name1)}</a>`).join(" بن ")}${anc.at(-1).family ? " " + esc(anc.at(-1).family) : ""}</p></div>` : ""}
    </div>`;
}

/* ===== شجرة العائلة ===== */
function treeKids(p){
  // الأبناء تحت الأب؛ وتحت الأم فقط إن لم يكن الأب مسجلاً
  return S.people.filter(c => isM(p) ? c.father_id === p.id : (c.mother_id === p.id && !S.byId.get(c.father_id)))
    .sort((a, b) => (a.birth_date || "9").localeCompare(b.birth_date || "9") || a.serial - b.serial);
}
function treeRoots(){ return S.people.filter(p => !S.byId.get(p.father_id) && !S.byId.get(p.mother_id) && treeKids(p).length); }
const GI_M = '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></svg>', GI_F = '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/></svg>';
let TREE_MODE = "cards"; // الشجرة تفتح دائماً بالبطاقات
try{ localStorage.removeItem("f4-tree-mode"); }catch(e){}
let TREE_Z = 1, TREE_STATE = null, TREE_SCROLL_KEY = "";
window.addEventListener("scroll", () => { if(PAGE_NAME === "tree" && TREE_STATE && TREE_STATE.key === TREE_SCROLL_KEY) TREE_STATE.y = window.scrollY; }, {passive:true});
function renderTree(rootId){
  const roots = treeRoots().sort((a, b) => descCount(b) - descCount(a));
  const root = S.byId.get(rootId) || roots[0];
  const cards = TREE_MODE === "cards", F = root ? treeSet(root) : new Set();
  const big = F.size > 40;
  $("#view").innerHTML = `
    <div class="page-h"><h2>شجرة العائلة</h2><div class="acts">
      <div class="seg" role="group" aria-label="طريقة العرض"><button type="button" class="${cards ? "on" : ""}" data-mode="cards" aria-pressed="${cards}">بطاقات</button><button type="button" class="${cards ? "" : "on"}" data-mode="list" aria-pressed="${!cards}">قائمة</button></div>
      <button class="btn small" type="button" id="tPick">البدء من شخص…</button>
      <button class="btn small" type="button" id="tOpen">فتح الكل</button>
      <button class="btn small" type="button" id="tClose">طي الكل</button>
      <button class="btn small" type="button" id="tPrint">نسخة للطباعة</button>${cards ? treeFullSwitch() : ""}</div></div>
    ${roots.length > 1 ? `<div class="toolbar"><select class="inp" id="tRoot" aria-label="رأس الشجرة">${roots.map(r => `<option value="${r.id}" ${r.id === root?.id ? "selected" : ""}>${esc(fullName(r, 3))} — ${descCount(r)} من الذرية</option>`).join("")}${root && !roots.includes(root) ? `<option value="${root.id}" selected>${esc(fullName(root, 3))}</option>` : ""}</select></div>` : ""}
    ${cards ? `<div class="legend"><span class="lm">${GI_M} ذكر</span><span class="lf">${GI_F} أنثى</span><span class="ld">متوفى</span><span class="lr">رأس الشجرة</span><span class="muted" style="border:0;background:none;padding:3px 0">مرّر على البطاقة (أو المسها مرة على الجوال) لتضيء سلسلة آبائها · اضغط مرة ثانية لفتح الملف · اسحب للتنقل</span></div>` : `<p class="muted" style="font-size:13px;margin:0 0 10px">الأبناء يظهرون تحت الأب وتحت الأم. الإطار المتقطع = متوفى، والإطار الباهت = يظهر كاملاً تحت أبيه. اضغط على الاسم لفتح الملف.</p>`}
    ${!root ? '<div class="card"><p class="empty">لا توجد روابط أب وأبناء بعد</p></div>'
      : cards ? `<div class="ochart-box"><div class="ochart-wrap" id="treeBox"><div class="ochart" id="ochart"><ul>${cardHtml(root, 0, new Set(), F, false, big ? 3 : 4)}</ul></div></div>
          <div class="zoomer" role="group" aria-label="التكبير"><button type="button" id="zIn" aria-label="تكبير">+</button><span id="zPct">100%</span><button type="button" id="zOut" aria-label="تصغير">−</button><button type="button" id="zFit" aria-label="ملاءمة الشاشة" title="ملاءمة الشاشة">⤢</button></div></div>`
      : `<div class="card tree" id="treeBox"><ul>${nodeHtml(root, 0, new Set(), F, false)}</ul></div>`}`;
  fillTreePhotos();
  $$("[data-mode]").forEach(b => b.onclick = () => { if(b.dataset.mode === TREE_MODE) return; const was = TREE_MODE; pageStep(() => { TREE_MODE = was; renderTree(root?.id); }); TREE_MODE = b.dataset.mode; renderTree(root?.id); });
  if($("#tRoot")) $("#tRoot").onchange = e => location.hash = "#/tree/" + e.target.value;
  $("#tPick").onclick = async () => { const p = await pickPerson("بداية الشجرة"); if(p) location.hash = "#/tree/" + p.id; };
  if($("#tFull")) $("#tFull").onclick = treeFullToggle;
  $("#tPrint").onclick = () => { REP_ARGS.person = root?.id || null; location.hash = "#/report/tree"; };
  if(!root) return;
  /* حفظ حالة الشجرة (الفروع المفتوحة، التكبير، موضع التمرير) حتى يرجعها زر «رجوع» كما كانت،
     وكل فتح/طي خطوة يتراجع عنها زر «رجوع» */
  const box = $("#treeBox"), key = root.id + "|" + TREE_MODE;
  const setTog = (b, open) => { if(!b) return; if(cards){ b.setAttribute("aria-expanded", open); b.querySelector("i").textContent = open ? "−" : "+"; } else b.textContent = open ? "−" : "+"; };
  const togOf = u => u.parentElement.querySelector(cards ? ":scope>.ktog" : ":scope>.tog");
  const snap = () => [...box.querySelectorAll("li>ul")].map(u => u.hidden ? 0 : 1).join("");
  const apply = st => [...box.querySelectorAll("li>ul")].forEach((u, i) => { if(st[i] === undefined) return; u.hidden = st[i] === "0"; setTog(togOf(u), !u.hidden); });
  const save = () => { TREE_STATE = {key, s:snap(), sl:box.scrollLeft, st:box.scrollTop, y:window.scrollY, z:TREE_Z}; };
  const step = fn => { const before = snap(); fn(); if(snap() !== before) pageStep(() => { apply(before); save(); }); save(); };
  const restoring = NAV_WAS_BACK && TREE_STATE && TREE_STATE.key === key;
  const R = restoring ? {...TREE_STATE} : null;
  if(R) apply(R.s);
  box.addEventListener("scroll", () => { if(TREE_STATE && TREE_STATE.key === key){ TREE_STATE.sl = box.scrollLeft; TREE_STATE.st = box.scrollTop; } }, {passive:true});
  TREE_SCROLL_KEY = key;
  if(!cards){
    $("#tOpen").onclick = () => step(() => $$("#treeBox li>ul").forEach(u => { u.hidden = false; setTog(togOf(u), true); }));
    $("#tClose").onclick = () => step(() => $$("#treeBox>ul>li>ul>li ul").forEach(u => { u.hidden = true; setTog(togOf(u), false); }));
    box.onclick = e => { const t = e.target.closest(".tog"); if(t && !t.classList.contains("leaf")) step(() => { const u = t.parentElement.querySelector(":scope>ul"); u.hidden = !u.hidden; setTog(t, !u.hidden); }); };
    if(R){ TREE_STATE = R; requestAnimationFrame(() => window.scrollTo(0, R.y)); } else save();
    return;
  }
  // ===== عرض البطاقات =====
  const wrap = box, chart = $("#ochart");
  const setZ = z => { TREE_Z = Math.min(1.6, Math.max(.15, Math.round(z * 100) / 100)); chart.style.zoom = TREE_Z; $("#zPct").textContent = Math.round(TREE_Z * 100) + "%"; if(TREE_STATE && TREE_STATE.key === key) TREE_STATE.z = TREE_Z; };
  const center = () => { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; };
  if(R){ TREE_STATE = R; setZ(R.z || TREE_Z); requestAnimationFrame(() => requestAnimationFrame(() => { wrap.scrollLeft = R.sl; wrap.scrollTop = R.st; window.scrollTo(0, R.y); TREE_STATE = {...R}; })); }
  else { setZ(TREE_Z); requestAnimationFrame(() => { center(); save(); }); }
  $("#zIn").onclick = () => setZ(TREE_Z + .1);
  $("#zOut").onclick = () => setZ(TREE_Z - .1);
  $("#zFit").onclick = () => { setZ(1); setZ(Math.min(1, (wrap.clientWidth - 24) / chart.scrollWidth)); requestAnimationFrame(center); };
  $("#tOpen").onclick = () => { step(() => { $$("#ochart ul[hidden]").forEach(u => u.hidden = false); $$("#ochart .ktog").forEach(b => setTog(b, true)); }); requestAnimationFrame(center); };
  $("#tClose").onclick = () => { step(() => $$("#ochart>ul>li>ul li>ul").forEach(u => { u.hidden = true; setTog(togOf(u), false); })); requestAnimationFrame(center); };
  wrap.addEventListener("click", e => {
    const t = e.target.closest(".ktog"); if(!t) return;
    step(() => { const u = t.parentElement.querySelector(":scope>ul"); u.hidden = !u.hidden; setTog(t, !u.hidden); });
  });
  // السحب بالفأرة للتنقل
  // إضاءة سلسلة الآباء عند المرور على بطاقة
  const clearLit = () => $$("#ochart .lit, #ochart .litline, #ochart .litend").forEach(x => x.classList.remove("lit", "litline", "litend"));
  const light = card => { clearLit(); let li = card.closest("li"); card.classList.add("lit"); li.classList.add("litend");
    while(li){ if(!li.classList.contains("litend")) li.classList.add("litline"); const up = li.parentElement.closest("li"); if(!up) break; up.querySelector(":scope>.pcard").classList.add("lit"); li = up; } };
  wrap.addEventListener("pointerover", e => { if(e.pointerType === "mouse"){ const c = e.target.closest(".pcard"); if(c) light(c); } });
  // اللمس: لمسة أولى تُضيء السلسلة، والثانية تفتح الملف
  let lastPtr = "mouse";
  wrap.addEventListener("pointerdown", e => { lastPtr = e.pointerType; }, true);
  wrap.addEventListener("click", e => {
    const c = e.target.closest(".pcard"); if(!c || lastPtr === "mouse") return;
    if(!c.classList.contains("sel")){ e.preventDefault(); e.stopPropagation(); $$("#ochart .pcard.sel").forEach(x => x.classList.remove("sel")); c.classList.add("sel"); light(c); }
  }, true);
  wrap.addEventListener("focusin", e => { const c = e.target.closest(".pcard"); if(c) light(c); });
  wrap.addEventListener("pointerleave", e => { if(e.pointerType === "mouse") clearLit(); });
  wrap.addEventListener("pointerdown", e => { if(e.pointerType !== "mouse" || e.target.closest("button")) return; TREE_DRAG = {wrap, x:e.clientX, y:e.clientY, l:wrap.scrollLeft, t:wrap.scrollTop}; wrap.classList.add("grab"); });
}
let TREE_DRAG = null;
window.addEventListener("pointermove", e => { const d = TREE_DRAG; if(!d) return; d.wrap.scrollLeft = d.l - (e.clientX - d.x); d.wrap.scrollTop = d.t - (e.clientY - d.y); });
window.addEventListener("pointerup", () => { if(TREE_DRAG){ TREE_DRAG.wrap.classList.remove("grab"); TREE_DRAG = null; } });
/* صور الأفراد في الشجرة: كل من له صورة في سجله تظهر صورته تملأ بطاقته (عرض «بطاقات»)، وصغيرة في عرض «قائمة» */
const treePhotoOn = p => !!p?.photo_path;
/* «الصور الكاملة»: مفتاح للمدير في صفحة الشجرة، يُحفظ في f4_settings (tree_full) ويسري على الجميع. عند الإيقاف تبقى الصورة صغيرة في الدائرة */
let TREE_FULL = true;
async function treeFullLoad(){
  try{ const {data} = await db.from("f4_settings").select("value").eq("key", "tree_full").maybeSingle(); TREE_FULL = data?.value !== "0"; }catch(e){}
}
const treeFullOn = p => TREE_FULL && treePhotoOn(p);
function treeFullSwitch(){
  return isAdmin() ? `<button type="button" class="sw" role="switch" id="tFull" aria-checked="${TREE_FULL}"><span class="sw-tr" aria-hidden="true"></span>الصور الكاملة <span class="sw-st">${TREE_FULL ? "مفعّلة" : "متوقفة"}</span></button>` : "";
}
function treeFullApply(on){
  TREE_FULL = on;
  $$("#ochart [data-tfull]").forEach(c => c.classList.toggle("ph-full", on));
  const b = $("#tFull"); if(b){ b.setAttribute("aria-checked", on); b.querySelector(".sw-st").textContent = on ? "مفعّلة" : "متوقفة"; }
}
async function treeFullToggle(){
  const was = TREE_FULL, on = !was, b = $("#tFull");
  treeFullApply(on); if(b) b.disabled = true;
  const {error} = await db.from("f4_settings").upsert([{key:"tree_full", value:on ? "1" : "0", updated_at:new Date().toISOString(), updated_by:S.email}], {onConflict:"key"});
  if(b) b.disabled = false;
  if(error){ treeFullApply(was); toast("تعذّر الحفظ: " + errMsg(error), true); return; }
  toast(on ? "تم تفعيل الصور الكاملة لجميع الأعضاء" : "تم إيقاف الصور الكاملة لجميع الأعضاء");
}
function treeAv(p, cls = ""){
  const h = avatar(p, cls);
  return treePhotoOn(p) ? h.replace('<span class="av ', `<span data-tph="${p.id}" class="av has-ph `) : h;
}
async function fillTreePhotos(){
  const full = $$("#treeBox [data-tfull]");
  if(full.length){
    const fu = await photoUrls([...new Set(full.map(e => +e.dataset.tfull))].map(id => S.byId.get(id)).filter(Boolean));
    full.forEach(e => { const p = S.byId.get(+e.dataset.tfull), u = p && fu.get(p.photo_path); if(u) e.style.setProperty("--ph", `url("${u}")`); });
  }
  const els = $$("#treeBox [data-tph]"); if(!els.length) return;
  const ppl = [...new Set(els.map(e => +e.dataset.tph))].map(id => S.byId.get(id)).filter(Boolean);
  const urls = await photoUrls(ppl);
  els.forEach(e => { const p = S.byId.get(+e.dataset.tph), u = p && urls.get(p.photo_path); if(u && document.body.contains(e)) e.innerHTML = `<img src="${esc(u)}" alt="">`; });
}
function cardHtml(p, depth, seen, F, viaMother, openDepth){
  if(seen.has(p.id)) return ""; seen.add(p.id);
  const kids = nodeKids(p, F).reverse(); // الشجرة داخلياً من اليسار لليمين؛ نعكس ليكون الأكبر على اليمين
  const sp = spousesOf(p).filter(s => s.person || s.name).map(s => s.person ? s.person.name1 : s.name.split(" ")[0]);
  const fa = viaMother && S.byId.get(p.father_id);
  const yrs = [p.birth_date?.slice(0, 4), isDead(p) ? (p.death_date?.slice(0, 4) || "متوفى") : ""].filter(Boolean).join(" – ");
  const open = depth < openDepth - 1;
  return `<li><button type="button" class="pcard ${isM(p) ? "" : "f"} ${isDead(p) ? "dead" : ""} ${depth === 0 ? "root" : ""} ${p._stub ? "locked" : ""} ${treeFullOn(p) ? "ph-full" : ""}" ${treePhotoOn(p) ? `data-tfull="${p.id}"` : ""} data-open="${p.id}" style="animation-delay:${Math.min(depth, 6) * 60}ms" aria-label="${esc(fullName(p, 3))}، ${isM(p) ? "ذكر" : "أنثى"}">
      <span class="gx">${isM(p) ? GI_M : GI_F}</span>${treeAv(p)}<b class="nm">${esc(p.name1)}</b>
      <span class="sub">${esc(fa ? `ابن${isM(p) ? "" : "ة"} ${fa.name1}` : p.name2 ? (isM(p) ? "بن " : "بنت ") + p.name2 : (p.family || ""))}</span>
      <span class="sub ${isDead(p) ? "yr" : ""}">#${p.serial}${yrs ? " · " + esc(yrs) : ""}</span>
      ${sp.length ? `<span class="sp">${isM(p) ? "زوجته" : "زوجها"}: ${esc(sp.join("، "))}</span>` : ""}
    </button>
    ${kids.length ? `<button type="button" class="ktog ${isM(p) ? "m" : "f"}" aria-expanded="${open}" aria-label="الأبناء"><i>${open ? "−" : "+"}</i> ${kids.length}</button>
      <ul ${open ? "" : "hidden"}>${kids.map(k => k.ref ? refCard(k.p) : cardHtml(k.p, depth + 1, seen, F, !isM(p), openDepth)).join("")}</ul>` : ""}</li>`;
}
function refCard(c){
  const f = S.byId.get(c.father_id);
  return `<li><button type="button" class="pcard ref ${isM(c) ? "" : "f"} ${c._stub ? "locked" : ""} ${treeFullOn(c) ? "ph-full" : ""}" ${treePhotoOn(c) ? `data-tfull="${c.id}"` : ""} data-open="${c.id}"><span class="gx">${isM(c) ? GI_M : GI_F}</span>${treeAv(c)}<b class="nm">${esc(c.name1)}</b><span class="sub">#${c.serial}</span><span class="sub">تحت أبيه ${esc(f ? f.name1 : "")}</span></button></li>`;
}
/* كل ذرية الشخص من جهة الأب والأم */
function treeSet(root){
  const F = new Set([root.id]), q = [root];
  while(q.length){ const x = q.shift(); childrenOf(x).forEach(k => { if(!F.has(k.id)){ F.add(k.id); q.push(k); } }); }
  return F;
}
function descCount(p){ return treeSet(p).size - 1; }
/* أبناء العقدة: تحت الأب كاملين؛ وتحت الأم كاملين إلا إذا كان أبوهم ضمن نفس الشجرة (يظهر كإشارة فقط لتجنّب التكرار) */
function nodeKids(p, F){
  return childrenOf(p).filter(c => isM(p) ? c.father_id === p.id : c.mother_id === p.id)
    .map(c => ({p:c, ref: !isM(p) && !!c.father_id && F.has(c.father_id)}));
}
function nodeHtml(p, depth, seen, F, viaMother){
  if(seen.has(p.id)) return ""; seen.add(p.id);
  const kids = nodeKids(p, F);
  const sp = spousesOf(p).filter(s => s.person || s.name).map(s => s.person ? s.person.name1 : s.name.split(" ")[0]);
  const fa = viaMother && S.byId.get(p.father_id);
  const sub = [`#${p.serial}`, kids.length && `${kids.length} أبناء`, sp.length && `${isM(p) ? "زوجته" : "زوجها"} ${sp.join("، ")}`, fa && `ابن${isM(p) ? "" : "ة"} ${fa.name1} ${fa.name2 || ""}`.trim()].filter(Boolean).join(" · ");
  return `<li><button type="button" class="tog ${kids.length ? "" : "leaf"}" aria-label="فتح/طي">${depth < 2 ? "−" : "+"}</button><button type="button" class="node ${isM(p) ? "" : "f"} ${isDead(p) ? "dead" : ""} ${p._stub ? "locked" : ""}" data-open="${p.id}">${treeAv(p, "sm")}<span><b>${esc(p.name1)}</b> <small>${esc(sub)}</small></span></button>
    ${kids.length ? `<ul ${depth < 2 ? "" : "hidden"}>${kids.map(k => k.ref ? refHtml(k.p) : nodeHtml(k.p, depth + 1, seen, F, !isM(p))).join("")}</ul>` : ""}</li>`;
}
function refHtml(c){
  const f = S.byId.get(c.father_id);
  return `<li><button type="button" class="tog leaf" tabindex="-1" aria-hidden="true"></button><button type="button" class="node ref ${isM(c) ? "" : "f"} ${c._stub ? "locked" : ""}" data-open="${c.id}">${treeAv(c, "sm")}<span><b>${esc(c.name1)}</b> <small>#${c.serial} · يظهر تحت أبيه ${esc(f ? f.name1 : "")}</small></span></button></li>`;
}
