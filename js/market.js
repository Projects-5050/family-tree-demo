/* ===== سوق العائلة: إعلانات مشاريع وخدمات أبناء العائلة ===== */
const MK_ICON = {
  food:'<path d="M6 3v8a3 3 0 0 0 6 0V3M9 3v18M17 3c-2 2-2 6 0 8v10"/>',
  home:'<path d="M14 6l4 4-8 8H6v-4zM16 4l4 4"/>',
  shop:'<path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>',
  edu:'<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
  care:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  car:'<path d="M4 15l2-6h12l2 6v3H4z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>',
  other:'<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
  all:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};
const MK_CATS = [
  {k:"", n:"الكل", ic:"all", c:"#1c2c47"}, {k:"food", n:"مطاعم وحلويات", ic:"food", c:"#c76a2b"}, {k:"home", n:"خدمات منزلية", ic:"home", c:"#2b6cc4"},
  {k:"shop", n:"تجارة وملابس", ic:"shop", c:"#c0477a"}, {k:"edu", n:"تعليم ودروس", ic:"edu", c:"#7a4fc0"}, {k:"care", n:"صحة وجمال", ic:"care", c:"#1f8a4c"},
  {k:"car", n:"سيارات", ic:"car", c:"#4a5468"}, {k:"other", n:"أخرى", ic:"other", c:"#9c7a3c"},
];
const MK_PAL = [["#c76a2b","#f1b56b"],["#1d4e9e","#6fa3f0"],["#9c2f5f","#f08bb6"],["#176b3a","#7fd3a0"],["#5b35a0","#b393f0"],["#2f3646","#8a94a8"]];
const MK_ART = ["dots","waves","grid","arcs","stripes","dots"];
const MK_STATUS = {pending:"بانتظار الموافقة", approved:"منشور", rejected:"مرفوض", paused:"موقوف"};
const MK = {ads:[], likes:[], cat:"", q:"", view:"grid", ci:0, timer:null, tileTimer:null, loaded:false};
const MK_SVG_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.4-4A8 8 0 1 1 8 18.7z"/></svg>';
const MK_SVG_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>';
const mkCat = k => MK_CATS.find(c => c.k === k) || MK_CATS[MK_CATS.length - 1];
const mkLive = a => a.status === "approved" && new Date(a.expires_at) > new Date();
const mkMine = a => (a.owner_email || "") === S.email;
const mkCanEdit = a => isAdmin() || mkMine(a);
const mkIsNew = a => mkLive(a) && Date.now() - new Date(a.approved_at || a.created_at) < 7 * 864e5;
const mkLikes = id => MK.likes.filter(l => l.ad_id === id).length;
const mkLiked = id => MK.likes.some(l => l.ad_id === id && l.email === S.email);
const mkSeen = (() => { try{ return new Set(JSON.parse(localStorage.getItem("f4_mk_seen") || "[]")); }catch(e){ return new Set(); } })();
const mkSaveSeen = () => { try{ localStorage.setItem("f4_mk_seen", JSON.stringify([...mkSeen].slice(-200))); }catch(e){} };
const mkWaLink = n => { let d = String(n || "").replace(/\D/g, ""); if(!d) return ""; if(d.length === 8) d = "973" + d; return "https://wa.me/" + d; };
const igLink = h => { h = String(h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, ""); return h ? "https://instagram.com/" + encodeURIComponent(h) : ""; };

/* غلاف مرسوم بالـSVG */
function mkArt(a, h = 200){
  const [c1, c2] = MK_PAL[a.color || 0] || MK_PAL[0], kind = MK_ART[a.color || 0], g = "m" + (a.id || 0) + Math.random().toString(36).slice(2, 6);
  const pat = {dots:`<pattern id="p${g}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="3" fill="#fff" opacity=".22"/></pattern><rect width="100%" height="100%" fill="url(#p${g})"/>`,
    waves:`<path d="M0 ${h*.65} Q 100 ${h*.45} 200 ${h*.65} T 400 ${h*.65} T 600 ${h*.65} V ${h} H0Z" fill="#fff" opacity=".14"/><path d="M0 ${h*.8} Q 120 ${h*.62} 240 ${h*.8} T 480 ${h*.8} T 720 ${h*.8} V ${h} H0Z" fill="#fff" opacity=".12"/>`,
    grid:`<pattern id="p${g}" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#fff" opacity=".18"/></pattern><rect width="100%" height="100%" fill="url(#p${g})"/>`,
    arcs:`<circle cx="85%" cy="20%" r="${h*.6}" fill="none" stroke="#fff" stroke-width="18" opacity=".12"/><circle cx="85%" cy="20%" r="${h*.3}" fill="#fff" opacity=".1"/>`,
    stripes:`<pattern id="p${g}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="18" fill="#fff" opacity=".1"/></pattern><rect width="100%" height="100%" fill="url(#p${g})"/>`}[kind];
  return `<svg class="mk-art" viewBox="0 0 600 ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="l${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#l${g})"/>${pat}<g transform="translate(40 ${h/2-55}) scale(4.6)" fill="none" stroke="#fff" stroke-width="1.3" opacity=".35" stroke-linecap="round" stroke-linejoin="round">${MK_ICON[mkCat(a.cat).ic]}</g></svg>`;
}
/* الغلاف: أول صورة إن وُجدت وإلا الرسم */
const mkCover = (a, h, url) => { const p = (a.photos || [])[0]; const s = p && url ? url(thumbOf(p)) || url(p) : ""; return s ? `<img class="mk-img" src="${esc(s)}" alt="" loading="lazy">` : mkArt(a, h); };
const mkLogo = (a, url) => { const s = a.logo_path && url ? url(a.logo_path) : ""; return s ? `<img src="${esc(s)}" alt="">` : esc((a.title || "؟").trim().charAt(0)); };
async function mkUrls(list){
  const paths = []; list.forEach(a => { if(a.logo_path) paths.push(a.logo_path); (a.photos || []).forEach((p, i) => { paths.push(p); if(i === 0) paths.push(thumbOf(p)); }); });
  return paths.length ? mediaUrls(paths) : () => "";
}

async function loadMarket(){
  const [a, l] = await Promise.all([db.from("f4_ads").select("*").order("created_at", {ascending:false}), db.from("f4_ad_likes").select("ad_id,email")]);
  if(a.error) throw a.error;
  MK.ads = a.data || []; MK.likes = l.data || []; MK.loaded = true;
}

/* ---------- بطاقة الرئيسية ---------- */
function marketTile(){
  return `<a class="tile mk-tile" href="#/market" aria-label="فتح سوق العائلة"><span class="mk-slides" id="mkSlides">${mkArt({id:0, color:0, cat:"shop"}, 160)}</span><span class="mk-sh"></span>
    <span class="mk-in"><span class="mk-live" id="mkLive" hidden><i></i><span></span></span><b>سوق العائلة</b><small>مشاريع وخدمات أبناء العائلة — ادعم أهلك أولاً</small></span></a>`;
}
async function fillMarketTile(){
  clearInterval(MK.tileTimer);
  try{ await loadMarket(); }catch(e){ return; }
  const box = $("#mkSlides"); if(!box) return;
  const live = MK.ads.filter(mkLive), url = await mkUrls(live.slice(0, 5));
  if(live.length) box.innerHTML = live.slice(0, 5).map((a, i) => `<span class="mk-sl ${i ? "" : "on"}">${mkCover(a, 160, url)}</span>`).join("");
  const nNew = live.filter(mkIsNew).length, nPend = isAdmin() ? MK.ads.filter(a => a.status === "pending").length : 0;
  const lv = $("#mkLive");
  if(lv && (nPend || nNew || live.length)){ lv.hidden = false; lv.classList.toggle("warn", !!nPend);
    lv.querySelector("span").textContent = nPend ? `${nPend} بانتظار موافقتك` : nNew ? `${nNew} ${nNew === 1 ? "إعلان جديد" : "إعلانات جديدة"} هذا الأسبوع` : `${live.length} ${live.length === 1 ? "إعلان" : "إعلانات"}`; }
  const sl = $$("#mkSlides .mk-sl"); let i = 0;
  if(sl.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    MK.tileTimer = setInterval(() => { if(!document.body.contains(sl[0])){ clearInterval(MK.tileTimer); return; } sl[i].classList.remove("on"); i = (i + 1) % sl.length; sl[i].classList.add("on"); }, 3200);
}

/* ---------- الصفحة ---------- */
async function renderMarket(){
  clearInterval(MK.timer);
  const v = $("#view");
  v.innerHTML = `<div class="mk-page">
    <div class="page-h"><div><h2>سوق العائلة</h2><p class="muted" style="margin:0">مشاريع أبناء وبنات العائلة وخدماتهم — تواصل معهم مباشرة.</p></div><div class="acts"><button class="btn mk-gold" type="button" id="mkAdd">＋ أضف إعلانك</button></div></div>
    <div id="mkBody"><p class="muted">جارٍ التحميل…</p></div></div>`;
  $("#mkAdd").onclick = () => adForm(null);
  try{ await loadMarket(); }catch(e){ $("#mkBody").innerHTML = `<p class="err">${esc(errMsg(e))}</p>`; return; }
  if(!location.hash.startsWith("#/market")) return;
  await drawMarket();
}
async function drawMarket(){
  clearInterval(MK.timer);
  const live = MK.ads.filter(mkLive), pend = isAdmin() ? MK.ads.filter(a => a.status === "pending") : [];
  const mine = MK.ads.filter(a => mkMine(a) && !mkLive(a));
  const feat = live.filter(a => a.featured), stories = live.filter(a => mkIsNew(a) || a.featured).slice(0, 14);
  const url = await mkUrls([...live, ...pend, ...mine]);
  MK.url = url;
  const row = (title, list, cls = "") => list.length ? `<div class="mk-sec ${cls}"><div class="sec-h">${title}</div><div class="mk-grid">${list.map((a, i) => mkCard(a, i, url)).join("")}</div></div>` : "";
  $("#mkBody").innerHTML = `
    ${row(`بانتظار موافقتك (${pend.length})`, pend, "mk-pend")}
    ${row("إعلاناتي غير المنشورة", mine.filter(a => !pend.includes(a)))}
    ${stories.length ? `<div class="mk-stories" aria-label="أنشطة جديدة">${stories.map(a => `<button type="button" class="mk-st ${mkSeen.has(a.id) ? "seen" : ""}" data-ad="${a.id}"><span class="ring"><span>${mkCover(a, 120, url)}</span></span><small>${esc(a.title)}</small></button>`).join("")}</div>` : ""}
    ${feat.length ? `<div class="mk-car" id="mkCar" aria-roledescription="carousel" aria-label="إعلانات مميزة">${feat.map((a, i) => `<div class="mk-slide ${i === MK.ci % feat.length ? "on" : ""}" data-i="${i}">${mkCover(a, 220, url)}<div class="mk-shade"></div>
        <div class="mk-txt"><span class="mk-pin">★ إعلان مميز</span><h3>${esc(a.title)}</h3>${a.descr ? `<p>${esc(cut(a.descr, 140))}</p>` : ""}<div class="own">${esc([a.owner_name, a.area].filter(Boolean).join(" · "))}</div>
        <div class="go">${a.whatsapp ? `<a class="wa" href="${esc(mkWaLink(a.whatsapp))}" target="_blank" rel="noopener">واتساب</a>` : ""}<button type="button" class="more" data-ad="${a.id}">التفاصيل</button></div></div></div>`).join("")}
        ${feat.length > 1 ? `<div class="mk-dots">${feat.map((a, i) => `<button type="button" data-d="${i}" class="${i === MK.ci % feat.length ? "on" : ""}" aria-label="إعلان ${i + 1}"></button>`).join("")}</div>` : ""}</div>` : ""}
    ${live.length ? `<div class="mk-tools"><input class="inp" id="mkQ" type="search" placeholder="ابحث باسم النشاط أو صاحبه أو المنطقة…" value="${esc(MK.q)}" aria-label="بحث">
        <div class="mk-view" role="group" aria-label="طريقة العرض"><button type="button" data-v="grid" aria-pressed="${MK.view === "grid"}" aria-label="شبكة"><svg viewBox="0 0 24 24">${MK_ICON.all}</svg></button><button type="button" data-v="list" aria-pressed="${MK.view === "list"}" aria-label="قائمة"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></svg></button></div></div>
      <div class="mk-cats" role="group" aria-label="التصنيفات">${MK_CATS.filter(c => !c.k || live.some(a => a.cat === c.k)).map(c => `<button type="button" class="mk-cat" data-c="${c.k}" aria-pressed="${MK.cat === c.k}"><span class="ci" style="background:${c.c}"><svg viewBox="0 0 24 24">${MK_ICON[c.ic]}</svg></span><b>${c.n}</b><small>${c.k ? live.filter(a => a.cat === c.k).length : live.length}</small></button>`).join("")}</div>
      <div class="mk-grid ${MK.view === "list" ? "list" : ""}" id="mkGrid"></div>`
    : `<div class="her-empty"><span class="mk-emp">${MK_SVG_HEART}</span><b>لا توجد إعلانات منشورة بعد</b><p>إذا كان لديك مشروع أو خدمة، أضف إعلانك ليراه أهل العائلة.</p><button class="btn mk-gold" type="button" id="mkFirst">＋ أضف إعلانك</button></div>`}`;
  const f = $("#mkFirst"); if(f) f.onclick = () => adForm(null);
  drawMkGrid();
  const q = $("#mkQ"); if(q) q.oninput = () => { MK.q = q.value; drawMkGrid(); };
  // التنقل في الشريط
  const go = i => { const s = $$("#mkCar .mk-slide"); if(!s.length) return; MK.ci = (i + s.length) % s.length; s.forEach(x => x.classList.toggle("on", +x.dataset.i === MK.ci)); $$("#mkCar .mk-dots button").forEach((d, j) => d.classList.toggle("on", j === MK.ci)); };
  const auto = () => { clearInterval(MK.timer); if(feat.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) MK.timer = setInterval(() => { if(!$("#mkCar")){ clearInterval(MK.timer); return; } go(MK.ci + 1); }, 4500); };
  const car = $("#mkCar"); if(car){ car.onmouseenter = () => clearInterval(MK.timer); car.onmouseleave = auto; auto(); }
  $("#mkBody").onclick = async e => {
    const lk = e.target.closest("[data-like]"); if(lk){ e.stopPropagation(); return toggleLike(+lk.dataset.like); }
    if(e.target.closest("a")) return;
    const c = e.target.closest(".mk-cat"); if(c){ MK.cat = c.dataset.c; $$(".mk-cat").forEach(x => x.setAttribute("aria-pressed", x === c)); drawMkGrid(); return; }
    const d = e.target.closest("[data-d]"); if(d){ go(+d.dataset.d); auto(); return; }
    const vw = e.target.closest("[data-v]"); if(vw){ MK.view = vw.dataset.v; $$("[data-v]").forEach(x => x.setAttribute("aria-pressed", x === vw)); $("#mkGrid")?.classList.toggle("list", MK.view === "list"); return; }
    const o = e.target.closest("[data-ad]"); if(o) adView(+o.dataset.ad);
  };
  $("#mkBody").onkeydown = e => { const o = e.target.closest(".mk-ad"); if(o && (e.key === "Enter" || e.key === " ") && e.target === o){ e.preventDefault(); adView(+o.dataset.ad); } };
}
function drawMkGrid(){
  const g = $("#mkGrid"); if(!g) return;
  const t = norm(MK.q);
  const L = MK.ads.filter(mkLive).filter(a => (!MK.cat || a.cat === MK.cat) && (!t || norm([a.title, a.descr, a.owner_name, a.area].join(" ")).includes(t)))
    .sort((a, b) => b.featured - a.featured || (b.approved_at || "").localeCompare(a.approved_at || ""));
  g.innerHTML = L.length ? L.map((a, i) => mkCard(a, i, MK.url)).join("") : `<p class="muted mk-none">لا توجد إعلانات مطابقة</p>`;
}
function mkCard(a, i, url){
  const c = mkCat(a.cat), n = mkLikes(a.id), on = mkLiked(a.id), [c1] = MK_PAL[a.color || 0] || MK_PAL[0];
  const st = !mkLive(a) ? `<span class="st-${a.status}">${MK_STATUS[a.status] || ""}${a.status === "approved" ? " · منتهي" : ""}</span>` : "";
  return `<article class="mk-ad" tabindex="0" data-ad="${a.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
    <div class="mk-cv">${mkCover(a, 130, url)}</div>
    <div class="mk-badge">${st}${a.featured && mkLive(a) ? "<span>★ مميز</span>" : ""}${mkIsNew(a) ? "<span>جديد</span>" : ""}</div>
    ${mkLive(a) ? `<button class="mk-heart ${on ? "on" : ""}" type="button" data-like="${a.id}" aria-pressed="${on}" aria-label="إعجاب">${MK_SVG_HEART}${n}</button>` : ""}
    <span class="mk-lgo" style="background:${c1}">${mkLogo(a, url)}</span>
    <div class="mk-bd"><span class="mk-ct" style="color:${c.c}">${c.n}</span><h3>${esc(a.title)}</h3>${a.descr ? `<p>${esc(cut(a.descr, 110))}</p>` : ""}${a.offer ? `<span class="mk-off">🎁 ${esc(a.offer)}</span>` : ""}
      <div class="mk-ft"><span class="own"><i>${esc((a.owner_name || "؟").charAt(0))}</i>${esc([a.owner_name, a.area].filter(Boolean).join(" · "))}</span>${a.whatsapp ? `<a class="wa" href="${esc(mkWaLink(a.whatsapp))}" target="_blank" rel="noopener" aria-label="واتساب ${esc(a.title)}">${MK_SVG_WA}</a>` : ""}</div></div></article>`;
}
async function toggleLike(id){
  const on = mkLiked(id);
  const r = on ? await db.from("f4_ad_likes").delete().eq("ad_id", id).eq("email", S.email) : await db.from("f4_ad_likes").insert({ad_id:id});
  if(r.error) return toast(errMsg(r.error), true);
  MK.likes = on ? MK.likes.filter(l => !(l.ad_id === id && l.email === S.email)) : [...MK.likes, {ad_id:id, email:S.email}];
  $$(`[data-like="${id}"]`).forEach(b => { const n = mkLikes(id); b.classList.toggle("on", !on); b.setAttribute("aria-pressed", !on); b.innerHTML = MK_SVG_HEART + n; });
}

/* ---------- التفاصيل ---------- */
async function adView(id){
  const a = MK.ads.find(x => x.id === id); if(!a) return;
  if(mkLive(a) && !mkSeen.has(a.id)){ mkSeen.add(a.id); mkSaveSeen(); $$(`.mk-st[data-ad="${a.id}"]`).forEach(x => x.classList.add("seen")); }
  const url = await mkUrls([a]), c = mkCat(a.cat), p = a.person_id ? S.byId.get(a.person_id) : null;
  const ph = a.photos || [];
  const exp = new Date(a.expires_at);
  const d = modal(a.title, `
    <div class="mk-dcv">${mkCover(a, 220, url)}<span class="mk-lgo big" style="background:${(MK_PAL[a.color || 0] || MK_PAL[0])[0]}">${mkLogo(a, url)}</span></div>
    <div class="mk-db">
      <span class="mk-ct" style="color:${c.c}">${c.n}</span>
      ${a.descr ? `<p style="margin:0;white-space:pre-wrap">${esc(a.descr)}</p>` : ""}
      <div class="mk-chips">${!mkLive(a) ? `<span class="st-${a.status}">${MK_STATUS[a.status]}${a.status === "approved" ? " · منتهي" : ""}</span>` : ""}${a.area ? `<span>📍 ${esc(a.area)}</span>` : ""}${mkLive(a) ? `<span>❤ ${mkLikes(a.id)} إعجاب</span>` : ""}${a.offer ? `<span class="off">🎁 ${esc(a.offer)}</span>` : ""}</div>
      ${ph.length ? `<div class="mk-gal">${ph.map((x, i) => `<button type="button" data-ph="${i}"><img src="${esc(url(thumbOf(x)) || url(x))}" alt="صورة ${i + 1}" loading="lazy"></button>`).join("")}</div>` : ""}
      ${p ? personBtn(p, "صاحب النشاط") : a.owner_name ? `<div class="mk-own"><i>${esc(a.owner_name.charAt(0))}</i><b>${esc(a.owner_name)}</b></div>` : ""}
      <div class="mk-acts">
        ${a.whatsapp ? `<a class="btn wa" href="${esc(mkWaLink(a.whatsapp))}" target="_blank" rel="noopener">واتساب</a>` : ""}
        ${a.phone ? `<a class="btn" href="tel:${esc(String(a.phone).replace(/\s/g, ""))}">اتصال <span class="ltr">${esc(a.phone)}</span></a>` : ""}
        ${a.instagram ? `<a class="btn" href="${esc(igLink(a.instagram))}" target="_blank" rel="noopener">إنستغرام</a>` : ""}
        <button class="btn" type="button" id="adShare">مشاركة</button>
      </div>
      ${mkCanEdit(a) ? `<p class="muted" style="font-size:13px;margin:0">${a.status === "approved" ? `ينتهي في ${fmtDate(exp.toISOString().slice(0, 10))}` : ""}${a.owner_email && isAdmin() ? ` · أضافه: <span class="ltr">${esc(a.owner_email)}</span>` : ""}</p>` : ""}
    </div>`,
    {wide:true, foot:`${isAdmin() && a.status !== "approved" ? `<button class="btn ok-fill" type="button" data-act="approve">موافقة ونشر</button>` : ""}
      ${isAdmin() && a.status === "pending" ? `<button class="btn" type="button" data-act="reject">رفض</button>` : ""}
      ${isAdmin() && mkLive(a) ? `<button class="btn" type="button" data-act="feature">${a.featured ? "إلغاء التمييز" : "★ تمييز"}</button>` : ""}
      ${mkCanEdit(a) && a.status === "approved" ? `<button class="btn" type="button" data-act="pause">إيقاف مؤقت</button>` : ""}
      ${mkCanEdit(a) && a.status === "paused" && a.approved_at ? `<button class="btn" type="button" data-act="resume">إعادة النشر</button>` : ""}
      ${mkCanEdit(a) && a.status === "approved" && exp - Date.now() < 30 * 864e5 ? `<button class="btn" type="button" data-act="renew">تجديد ٦ أشهر</button>` : ""}
      ${mkCanEdit(a) ? `<button class="btn" type="button" data-act="edit">تعديل</button><button class="btn danger" type="button" data-act="del">حذف</button>` : ""}
      <button class="btn primary" type="button" onclick="this.closest('dialog').close()">إغلاق</button>`});
  d.querySelector(".pbtn")?.addEventListener("click", () => d.close());
  $$("[data-ph]", d).forEach(b => b.onclick = () => window.open(url(ph[+b.dataset.ph]), "_blank", "noopener"));
  $("#adShare").onclick = async () => {
    const txt = `${a.title}${a.descr ? "\n" + a.descr : ""}${a.whatsapp ? "\nواتساب: " + mkWaLink(a.whatsapp) : ""}${a.instagram ? "\nإنستغرام: " + igLink(a.instagram) : ""}\n— من سوق عائلة النشابة`;
    try{ if(navigator.share){ await navigator.share({title:a.title, text:txt}); return; } await navigator.clipboard.writeText(txt); toast("نُسخ نص الإعلان — الصقه في واتساب"); }catch(e){}
  };
  $$("[data-act]", d.closest("dialog")).forEach(b => b.onclick = async () => {
    const act = b.dataset.act;
    if(act === "edit"){ d.close(); return adForm(a); }
    if(act === "del"){
      d.close(); if(!(await ask("حذف الإعلان", `حذف «${a.title}» نهائياً؟`, {okText:"حذف", danger:true}))) return;
      const {error} = await db.from("f4_ads").delete().eq("id", a.id); if(error) return toast(errMsg(error), true);
      const files = [...(a.photos || []).flatMap(x => [x, thumbOf(x)]), a.logo_path].filter(Boolean); if(files.length) db.storage.from(MEDIA_BUCKET).remove(files);
      MK.ads = MK.ads.filter(x => x.id !== a.id); toast("تم حذف الإعلان"); return drawMarket();
    }
    const upd = {approve:{status:"approved", expires_at:new Date(Date.now() + 182 * 864e5).toISOString()}, reject:{status:"rejected"}, feature:{featured:!a.featured},
      pause:{status:"paused"}, resume:{status:"approved"}, renew:{expires_at:new Date(Date.now() + 182 * 864e5).toISOString()}}[act];
    const {data, error} = await db.from("f4_ads").update(upd).eq("id", a.id).select().single();
    if(error) return toast(errMsg(error), true);
    MK.ads = MK.ads.map(x => x.id === a.id ? data : x); d.close();
    toast({approve:"نُشر الإعلان ✓", reject:"رُفض الإعلان", feature:data.featured ? "أصبح إعلاناً مميزاً ★" : "أُلغي التمييز", pause:"أُوقف الإعلان مؤقتاً", resume:"أُعيد نشر الإعلان", renew:"جُدّد الإعلان ٦ أشهر"}[act]);
    drawMarket();
  });
}

/* ---------- إضافة / تعديل مع معاينة حيّة ---------- */
async function adForm(a){
  const isNew = !a;
  a = a || {title:"", cat:"food", descr:"", area:"", offer:"", whatsapp:"", phone:"", instagram:"", color:0, photos:[], logo_path:null, person_id:S.me.person_id || null};
  let person = a.person_id ? S.byId.get(a.person_id) || null : null, color = a.color || 0;
  let keep = [...(a.photos || [])], newPhotos = [], logoFile = null, dropLogo = false;
  const url = await mkUrls([a]);
  const d = modal(isNew ? "إعلان جديد في سوق العائلة" : "تعديل الإعلان", `<div class="mk-fw">
    <div class="mk-form">
      <div class="fgrid"><div class="field"><label for="afTitle">اسم النشاط *</label><input class="inp" id="afTitle" maxlength="80" value="${esc(a.title)}"></div>
        <div class="field"><label for="afCat">التصنيف *</label><select class="inp" id="afCat">${MK_CATS.slice(1).map(c => `<option value="${c.k}" ${c.k === a.cat ? "selected" : ""}>${c.n}</option>`).join("")}</select></div></div>
      <div class="field"><label for="afDesc">وصف قصير</label><textarea class="inp" id="afDesc" rows="3" maxlength="600">${esc(a.descr || "")}</textarea></div>
      <div class="fgrid">
        <div class="field"><label for="afArea">المنطقة</label><input class="inp" id="afArea" maxlength="60" value="${esc(a.area || "")}" placeholder="مثال: المحرق، أو متجر إلكتروني"></div>
        <div class="field"><label for="afOffer">عرض لأهل العائلة (اختياري)</label><input class="inp" id="afOffer" maxlength="80" value="${esc(a.offer || "")}" placeholder="مثال: خصم ١٠٪"></div>
        <div class="field"><label for="afWa">رقم الواتساب</label><input class="inp ltr" id="afWa" inputmode="tel" maxlength="20" value="${esc(a.whatsapp || "")}" placeholder="3xxxxxxx"></div>
        <div class="field"><label for="afPhone">رقم الاتصال (اختياري)</label><input class="inp ltr" id="afPhone" inputmode="tel" maxlength="20" value="${esc(a.phone || "")}"></div>
        <div class="field"><label for="afIg">إنستغرام (اختياري)</label><input class="inp ltr" id="afIg" maxlength="60" value="${esc(a.instagram || "")}" placeholder="@اسم_الحساب"></div>
        <div class="field"><label>صاحب النشاط</label><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" type="button" id="afPerson" ${isAdmin() ? "" : "disabled"}></button></div></div>
      </div>
      <div class="field"><span class="lbl">لون الغلاف</span><div class="mk-sw" role="group" aria-label="لون الغلاف">${MK_PAL.map((p, i) => `<button type="button" data-p="${i}" aria-pressed="${i === color}" style="background:linear-gradient(135deg,${p[1]},${p[0]})" aria-label="لون ${i + 1}"></button>`).join("")}</div></div>
      <div class="fgrid">
        <div class="field"><label for="afLogo">الشعار (اختياري)</label><input class="inp" id="afLogo" type="file" accept="image/*">${a.logo_path ? `<label class="check"><input type="checkbox" id="afDropLogo"> حذف الشعار الحالي</label>` : ""}</div>
        <div class="field"><label for="afPhotos">صور النشاط (حتى ٦، الأولى غلاف)</label><input class="inp" id="afPhotos" type="file" accept="image/*" multiple></div>
      </div>
      <div class="mk-thumbs" id="afThumbs"></div>
      <div class="mk-rev">⏳ <span>${isAdmin() ? "أنت المدير: يُنشر إعلانك مباشرة." : "يظهر الإعلان بعد موافقة المدير. أي تعديل لاحق يعيده للمراجعة."} ينتهي الإعلان بعد ٦ أشهر ويمكن تجديده.</span></div>
      <p class="err" id="afErr"></p>
    </div>
    <div class="mk-prev"><span class="lbl">هكذا سيظهر إعلانك:</span><div id="afPrev"></div></div></div>`,
    {wide:true, foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn mk-gold" type="button" id="afSave">${isNew ? (isAdmin() ? "نشر الإعلان" : "إرسال للمراجعة") : "حفظ"}</button>`});
  const drawP = () => { $("#afPerson").textContent = person ? fullName(person, 3) : (S.me.display_name || "أنت"); };
  const val = id => $("#" + id).value.trim();
  const blobUrls = [];
  const thumbs = () => {
    $("#afThumbs").innerHTML = keep.map((x, i) => `<span><img src="${esc(url(thumbOf(x)) || url(x))}" alt=""><button type="button" data-k="${i}" aria-label="حذف الصورة">✕</button></span>`).join("")
      + newPhotos.map((f, i) => { const u = URL.createObjectURL(f); blobUrls.push(u); return `<span><img src="${u}" alt=""><button type="button" data-n="${i}" aria-label="حذف الصورة">✕</button></span>`; }).join("");
  };
  const prev = () => {
    const tmp = {id:0, title:val("afTitle") || "اسم نشاطك", cat:$("#afCat").value, descr:val("afDesc") || "وصف قصير لنشاطك", area:val("afArea"), offer:val("afOffer"), whatsapp:val("afWa"),
      color, status:"approved", expires_at:new Date(Date.now() + 864e5).toISOString(), approved_at:new Date().toISOString(), owner_name:person ? fullName(person, 3) : (S.me.display_name || ""), photos:[], logo_path:null};
    let html = mkCard(tmp, 0, null);
    const cover = newPhotos[0] ? URL.createObjectURL(newPhotos[0]) : keep[0] ? (url(thumbOf(keep[0])) || url(keep[0])) : "";
    if(cover) html = html.replace(/<div class="mk-cv">[\s\S]*?<\/svg><\/div>/, `<div class="mk-cv"><img class="mk-img" src="${esc(cover)}" alt=""></div>`);
    const lg = logoFile ? URL.createObjectURL(logoFile) : (!dropLogo && a.logo_path ? url(a.logo_path) : "");
    if(lg) html = html.replace(/(<span class="mk-lgo"[^>]*>)[^<]*(<\/span>)/, `$1<img src="${esc(lg)}" alt="">$2`);
    $("#afPrev").innerHTML = html;
  };
  drawP(); thumbs(); prev();
  d.querySelector(".mk-form").addEventListener("input", prev);
  $$(".mk-sw [data-p]", d).forEach(b => b.onclick = () => { color = +b.dataset.p; $$(".mk-sw [data-p]", d).forEach(x => x.setAttribute("aria-pressed", x === b)); prev(); });
  $("#afPerson").onclick = async () => { d.close(); const p = await pickPerson("صاحب النشاط"); d.showModal(); if(p){ person = p; drawP(); prev(); } };
  $("#afLogo").onchange = e => { logoFile = e.target.files[0] || null; prev(); };
  const dl = $("#afDropLogo"); if(dl) dl.onchange = () => { dropLogo = dl.checked; prev(); };
  $("#afPhotos").onchange = e => { const add = [...e.target.files].filter(f => /^image\//.test(f.type)); newPhotos = [...newPhotos, ...add].slice(0, 6 - keep.length); e.target.value = ""; thumbs(); prev(); if(add.length > newPhotos.length) toast("الحد الأقصى ٦ صور", true); };
  $("#afThumbs").onclick = e => { const k = e.target.closest("[data-k]"), n = e.target.closest("[data-n]"); if(k) keep.splice(+k.dataset.k, 1); else if(n) newPhotos.splice(+n.dataset.n, 1); else return; thumbs(); prev(); };
  $("#afSave").onclick = async () => {
    const err = $("#afErr"); err.textContent = "";
    const row = {title:val("afTitle"), cat:$("#afCat").value, descr:val("afDesc") || null, area:val("afArea") || null, offer:val("afOffer") || null,
      whatsapp:val("afWa").replace(/[^\d+ ]/g, "") || null, phone:val("afPhone").replace(/[^\d+ ]/g, "") || null, instagram:val("afIg") || null, color,
      person_id:person ? person.id : null, owner_name:person ? fullName(person, 3) : (S.me.display_name || null)};
    if(row.title.length < 2){ err.textContent = "اكتب اسم النشاط"; $("#afTitle").focus(); return; }
    if(!row.whatsapp && !row.phone && !row.instagram){ err.textContent = "أضف وسيلة تواصل واحدة على الأقل: واتساب أو اتصال أو إنستغرام"; $("#afWa").focus(); return; }
    const btn = $("#afSave"); btn.disabled = true; btn.textContent = "جارٍ الحفظ…";
    const uploaded = [];
    try{
      const up = async (f, side) => {
        const path = `ads/${Date.now()}-${rnd()}.jpg`;
        const [big, small] = await Promise.all([compressImage(f, side, .84), compressImage(f, 520, .74)]);
        let r = await db.storage.from(MEDIA_BUCKET).upload(path, big, {contentType:"image/jpeg"}); if(r.error) throw r.error; uploaded.push(path);
        r = await db.storage.from(MEDIA_BUCKET).upload(thumbOf(path), small, {contentType:"image/jpeg"}); if(r.error) throw r.error; uploaded.push(thumbOf(path));
        return path;
      };
      const added = []; for(const f of newPhotos) added.push(await up(f, 1600));
      row.photos = [...keep, ...added];
      if(logoFile) row.logo_path = await up(logoFile, 400); else if(dropLogo) row.logo_path = null;
      if(isNew) row.expires_at = new Date(Date.now() + 182 * 864e5).toISOString();
      if(isNew && isAdmin()) Object.assign(row, {status:"approved", approved_at:new Date().toISOString()});
      const q = isNew ? db.from("f4_ads").insert(row) : db.from("f4_ads").update(row).eq("id", a.id);
      const {data, error} = await q.select().single(); if(error) throw error;
      if(!isNew){ const gone = [...(a.photos || []).filter(x => !keep.includes(x)).flatMap(x => [x, thumbOf(x)]), ...((logoFile || dropLogo) && a.logo_path ? [a.logo_path, thumbOf(a.logo_path)] : [])]; if(gone.length) db.storage.from(MEDIA_BUCKET).remove(gone); }
      MK.ads = isNew ? [data, ...MK.ads] : MK.ads.map(x => x.id === data.id ? data : x);
      blobUrls.forEach(u => URL.revokeObjectURL(u)); d.close();
      toast(data.status === "approved" ? "نُشر الإعلان ✓" : "أُرسل الإعلان للمدير للموافقة ✓");
      if(location.hash.startsWith("#/market")) drawMarket(); else location.hash = "#/market";
    }catch(e){ if(uploaded.length) db.storage.from(MEDIA_BUCKET).remove(uploaded); err.textContent = errMsg(e); btn.disabled = false; btn.textContent = isNew ? "إرسال" : "حفظ"; }
  };
  $("#afTitle").focus();
}
