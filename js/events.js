/* ===== مناسبات العائلة: ألبومات صور وفيديوهات ===== */
const MEDIA_BUCKET = "f4-media";
const EV_KINDS = ["زواج", "عيد", "تجمع عائلي", "مولود جديد", "تخرج", "رحلة", "عزاء", "أخرى"];
const VIDEO_MAX = 50 * 1024 * 1024;
const EV = {kind:"", q:"", tab:"photo", cur:null, occ:[], media:[], urls:new Map()};

const IC_CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const IC_VID = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>';
const IC_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

const canAddMedia = () => can("add") || can("edit");
const canDelMedia = m => isAdmin() || can("delete") || (m.created_by || "") === S.email;
const canEditOcc = o => isAdmin() || can("edit") || (o.created_by || "") === S.email;
const canDelOcc = o => isAdmin() || (o.created_by || "") === S.email;
const thumbOf = path => path ? path.replace(/\.jpg$/, "_t.jpg") : "";
const ytId = u => (String(u || "").match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/) || [])[1] || "";

/* روابط موقّعة دفعة واحدة مع ذاكرة مؤقتة */
async function mediaUrls(paths){
  const need = [...new Set(paths.filter(p => p && !EV.urls.has(p)))];
  for(let i = 0; i < need.length; i += 100){
    const {data} = await db.storage.from(MEDIA_BUCKET).createSignedUrls(need.slice(i, i + 100), 3600 * 6);
    (data || []).forEach(r => { if(r.signedUrl) EV.urls.set(r.path, r.signedUrl); });
  }
  return p => EV.urls.get(p) || "";
}

async function loadEvents(){
  const [o, m] = await Promise.all([
    db.from("f4_occasions").select("*").order("occ_date", {ascending:false, nullsFirst:false}).order("id", {ascending:false}),
    db.from("f4_media").select("id,occasion_id,kind,path,url,caption,created_by,created_at").order("created_at", {ascending:true}),
  ]);
  if(o.error || m.error) throw (o.error || m.error);
  EV.occ = o.data || []; EV.media = m.data || [];
}
const mediaOf = (id, kind) => EV.media.filter(x => x.occasion_id === id && (!kind || x.kind === kind));
const coverPath = o => o.cover_path || (mediaOf(o.id, "photo")[0] || {}).path || "";

/* ---------- قائمة المناسبات ---------- */
async function renderEvents(){
  const v = $("#view");
  v.innerHTML = `<div class="page-h"><h2>مناسبات العائلة</h2><div class="acts"><button class="btn primary" id="evNew" ${canAddMedia() ? "" : "hidden"}>+ مناسبة جديدة</button></div></div><p class="muted">جارٍ التحميل…</p>`;
  try{ await loadEvents(); }catch(e){ v.querySelector("p.muted").textContent = errMsg(e); return; }
  if(!location.hash.startsWith("#/events")) return;
  const url = await mediaUrls(EV.occ.map(o => thumbOf(coverPath(o))));
  const kinds = [...new Set(EV.occ.map(o => o.kind).filter(Boolean))];
  const draw = () => {
    const q = norm(EV.q);
    const L = EV.occ.filter(o => (!EV.kind || o.kind === EV.kind) && (!q || norm([o.title, o.place, o.kind, o.description].join(" ")).includes(q)));
    const totP = EV.media.filter(x => x.kind === "photo").length, totV = EV.media.length - totP;
    $("#evBody").innerHTML = `
      <div class="ev-sum"><span><b>${EV.occ.length}</b> مناسبة</span><span>${IC_CAM}<b>${totP}</b> صورة</span><span>${IC_VID}<b>${totV}</b> فيديو</span></div>
      ${L.length ? `<div class="ev-grid">${L.map((o, i) => {
        const cp = coverPath(o), src = cp ? url(thumbOf(cp)) : "";
        const np = mediaOf(o.id, "photo").length, nv = mediaOf(o.id, "video").length;
        return `<a class="ev-card" href="#/event/${o.id}" style="--i:${i}">
          <div class="ev-cover">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<div class="ev-ph">${IC_CAM}</div>`}${o.kind ? `<span class="ev-kind">${esc(o.kind)}</span>` : ""}</div>
          <div class="ev-info"><b>${esc(o.title)}</b><small>${[o.occ_date && fmtDate(o.occ_date), o.place].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small>
          <div class="ev-cnt"><span>${IC_CAM}${np}</span><span>${IC_VID}${nv}</span></div></div></a>`;
      }).join("")}</div>`
      : `<div class="empty card"><div class="ev-ph big">${IC_CAM}</div><b>${EV.occ.length ? "لا توجد مناسبات تطابق البحث" : "لم تُضف أي مناسبة بعد"}</b>${!EV.occ.length && canAddMedia() ? '<p class="muted">أنشئ أول مناسبة، ثم أضف إليها الصور والفيديوهات.</p>' : ""}</div>`}`;
  };
  v.innerHTML = `
    <div class="page-h"><h2>مناسبات العائلة</h2><div class="acts"><button class="btn primary" id="evNew" ${canAddMedia() ? "" : "hidden"}>+ مناسبة جديدة</button></div></div>
    <div class="toolbar">
      <input class="inp" id="evQ" type="search" placeholder="ابحث باسم المناسبة أو المكان" value="${esc(EV.q)}" aria-label="بحث">
      <div class="ev-chips" role="group" aria-label="نوع المناسبة">${["", ...kinds].map(k => `<button type="button" class="chipbtn ${EV.kind === k ? "on" : ""}" data-k="${esc(k)}">${k ? esc(k) : "الكل"}</button>`).join("")}</div>
    </div>
    <div id="evBody"></div>`;
  draw();
  $("#evQ").oninput = e => { EV.q = e.target.value; draw(); };
  $$(".ev-chips .chipbtn").forEach(b => b.onclick = () => { EV.kind = b.dataset.k; $$(".ev-chips .chipbtn").forEach(x => x.classList.toggle("on", x === b)); draw(); });
  $("#evNew").onclick = () => occForm();
}

/* ---------- نموذج المناسبة ---------- */
function occForm(o = null){
  const d = modal(o ? "تعديل المناسبة" : "مناسبة جديدة", `
    <div class="field"><label for="ocT">اسم المناسبة *</label><input class="inp" id="ocT" maxlength="150" value="${esc(o?.title || "")}" placeholder="مثال: زواج حسن مكي"></div>
    <div class="grid2">
      <div class="field"><label for="ocK">النوع</label><input class="inp" id="ocK" list="ocKinds" maxlength="40" value="${esc(o?.kind || "")}" placeholder="اختر أو اكتب"><datalist id="ocKinds">${[...new Set([...EV_KINDS, ...EV.occ.map(x => x.kind).filter(Boolean)])].map(k => `<option value="${esc(k)}">`).join("")}</datalist></div>
      <div class="field"><label for="ocD">التاريخ</label><input class="inp" id="ocD" type="date" value="${esc(o?.occ_date || "")}"></div>
    </div>
    <div class="field"><label for="ocP">المكان</label><input class="inp" id="ocP" maxlength="120" value="${esc(o?.place || "")}"></div>
    <div class="field"><label for="ocS">وصف قصير</label><textarea class="inp" id="ocS" rows="3" maxlength="1500">${esc(o?.description || "")}</textarea></div>`,
    {foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn primary" type="button" id="ocSave">${o ? "حفظ" : "إنشاء المناسبة"}</button>`});
  setTimeout(() => $("#ocT").focus(), 30);
  $("#ocSave").onclick = async () => {
    const rec = {title:$("#ocT").value.trim(), kind:$("#ocK").value.trim() || null, occ_date:$("#ocD").value || null, place:$("#ocP").value.trim() || null, description:$("#ocS").value.trim() || null};
    if(!rec.title){ toast("اكتب اسم المناسبة", true); $("#ocT").focus(); return; }
    const btn = $("#ocSave"); btn.disabled = true;
    const q = o ? db.from("f4_occasions").update(rec).eq("id", o.id) : db.from("f4_occasions").insert(rec);
    const {data, error} = await q.select().single();
    btn.disabled = false;
    if(error) return toast(errMsg(error), true);
    d.close(); toast(o ? "تم حفظ المناسبة" : "تم إنشاء المناسبة");
    if(o) renderEvent(o.id); else location.hash = "#/event/" + data.id;
  };
}

/* ---------- صفحة المناسبة ---------- */
async function renderEvent(id){
  const v = $("#view");
  if(EV.cur !== id){ EV.cur = id; EV.tab = "photo"; }
  v.innerHTML = `<p class="muted">جارٍ التحميل…</p>`;
  try{ await loadEvents(); }catch(e){ v.innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`; return; }
  const o = EV.occ.find(x => x.id === id);
  if(!o){ v.innerHTML = `<div class="empty card"><b>المناسبة غير موجودة</b><a class="btn" href="#/events">العودة للمناسبات</a></div>`; return; }
  const photos = mediaOf(id, "photo"), videos = mediaOf(id, "video");
  const url = await mediaUrls([...photos.map(m => thumbOf(m.path)), ...videos.map(m => m.path), thumbOf(coverPath(o))]);
  if(location.hash !== "#/event/" + id) return;
  const cp = coverPath(o), cover = cp ? url(thumbOf(cp)) : "";
  v.innerHTML = `
    <a class="back" href="#/events">→ كل المناسبات</a>
    <header class="ev-hero">${cover ? `<img src="${esc(cover)}" alt="">` : ""}
      <div class="ev-hero-in">
        ${o.kind ? `<span class="ev-kind">${esc(o.kind)}</span>` : ""}
        <h2>${esc(o.title)}</h2>
        <p>${[o.occ_date && fmtDate(o.occ_date), o.place].filter(Boolean).map(esc).join(" · ")}</p>
        ${o.description ? `<p class="ev-desc">${esc(o.description)}</p>` : ""}
      </div>
      <div class="ev-hero-acts">${canEditOcc(o) ? '<button class="btn" id="ocEdit">تعديل</button>' : ""}${canDelOcc(o) ? '<button class="btn danger" id="ocDel">حذف</button>' : ""}</div>
    </header>
    <div class="ev-tabs" role="tablist">
      <button role="tab" class="ev-tab ${EV.tab === "photo" ? "on" : ""}" data-t="photo" aria-selected="${EV.tab === "photo"}">${IC_CAM}الصور <b>${photos.length}</b></button>
      <button role="tab" class="ev-tab ${EV.tab === "video" ? "on" : ""}" data-t="video" aria-selected="${EV.tab === "video"}">${IC_VID}الفيديوهات <b>${videos.length}</b></button>
    </div>
    <section id="evPane" role="tabpanel"></section>`;
  const pane = () => {
    const P = $("#evPane");
    if(EV.tab === "photo"){
      P.innerHTML = `
        ${canAddMedia() ? `<div class="ev-add"><label class="btn primary">${IC_CAM}إضافة صور<input type="file" id="upP" accept="image/*" multiple hidden></label><span class="muted">تُضغط الصور تلقائياً لتوفير المساحة</span></div>` : ""}
        ${photos.length ? `<div class="ev-photos">${photos.map((m, i) => `<button type="button" class="ev-ph-btn" data-i="${i}" aria-label="عرض الصورة ${i + 1}"><img src="${esc(url(thumbOf(m.path)))}" alt="${esc(m.caption || "")}" loading="lazy"></button>`).join("")}</div>`
          : `<div class="empty card"><div class="ev-ph big">${IC_CAM}</div><b>لا توجد صور بعد</b></div>`}`;
      $$(".ev-ph-btn").forEach(b => b.onclick = () => lightbox(photos.map(m => ({type:"photo", m})), +b.dataset.i, o));
      const up = $("#upP"); if(up) up.onchange = () => uploadPhotos(o, [...up.files]);
    }else{
      P.innerHTML = `
        ${canAddMedia() ? `<div class="ev-add"><button class="btn primary" id="upV">${IC_VID}إضافة فيديو</button><span class="muted">ملف حتى 50 ميجابايت، أو رابط يوتيوب</span></div>` : ""}
        ${videos.length ? `<div class="ev-videos">${videos.map((m, i) => {
          const y = ytId(m.url);
          const poster = m.path ? `<video src="${esc(url(m.path))}#t=0.5" preload="metadata" muted playsinline></video>` : y ? `<img src="https://i.ytimg.com/vi/${y}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">` : `<div class="ev-ph">${IC_VID}</div>`;
          return `<button type="button" class="ev-vid" data-i="${i}"><div class="ev-vid-p">${poster}<span class="ev-play">${IC_PLAY}</span>${y ? '<span class="ev-src">YouTube</span>' : ""}</div><span class="ev-cap">${esc(m.caption || "فيديو " + (i + 1))}</span></button>`;
        }).join("")}</div>`
          : `<div class="empty card"><div class="ev-ph big">${IC_VID}</div><b>لا توجد فيديوهات بعد</b></div>`}`;
      $$(".ev-vid").forEach(b => b.onclick = () => lightbox(videos.map(m => ({type:"video", m})), +b.dataset.i, o));
      const up = $("#upV"); if(up) up.onclick = () => videoForm(o);
    }
  };
  pane();
  $$(".ev-tab").forEach(b => b.onclick = () => { EV.tab = b.dataset.t; $$(".ev-tab").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); pane(); });
  const ed = $("#ocEdit"); if(ed) ed.onclick = () => occForm(o);
  const dl = $("#ocDel"); if(dl) dl.onclick = () => deleteOcc(o);
}

/* ---------- رفع الصور ---------- */
function progress(msg){
  let p = $("#evProg");
  if(!p){ p = document.createElement("div"); p.id = "evProg"; p.className = "ev-prog"; p.setAttribute("role", "status"); document.body.append(p); }
  if(msg === null){ p.remove(); return; }
  p.innerHTML = `<span class="spin"></span>${esc(msg)}`;
}
const rnd = () => Math.random().toString(36).slice(2, 8);
async function uploadPhotos(o, files){
  files = files.filter(f => /^image\//.test(f.type));
  if(!files.length) return;
  let ok = 0;
  for(const [i, f] of files.entries()){
    progress(`جارٍ رفع الصورة ${i + 1} من ${files.length}…`);
    try{
      const [big, small] = await Promise.all([compressImage(f, 1600, .82), compressImage(f, 420, .74)]);
      const path = `occ/${o.id}/p-${Date.now()}-${rnd()}.jpg`;
      const a = await db.storage.from(MEDIA_BUCKET).upload(path, big, {contentType:"image/jpeg"});
      if(a.error) throw a.error;
      const b = await db.storage.from(MEDIA_BUCKET).upload(thumbOf(path), small, {contentType:"image/jpeg"});
      if(b.error){ db.storage.from(MEDIA_BUCKET).remove([path]); throw b.error; }
      const r = await db.from("f4_media").insert({occasion_id:o.id, kind:"photo", path});
      if(r.error){ db.storage.from(MEDIA_BUCKET).remove([path, thumbOf(path)]); throw r.error; }
      ok++;
    }catch(e){ toast(`تعذر رفع «${f.name}»: ${errMsg(e)}`, true); }
  }
  progress(null);
  if(ok) toast(ok === 1 ? "تمت إضافة صورة" : `تمت إضافة ${ok} صور`);
  EV.tab = "photo"; renderEvent(o.id);
}

/* ---------- إضافة فيديو ---------- */
function videoForm(o){
  const d = modal("إضافة فيديو", `
    <div class="ev-seg" role="tablist"><button type="button" class="on" data-s="file">رفع ملف</button><button type="button" data-s="link">رابط يوتيوب</button></div>
    <div id="vfFile">
      <label class="ev-drop"><input type="file" id="vfF" accept="video/mp4,video/quicktime,video/webm,video/3gpp" hidden>${IC_VID}<b>اختر ملف الفيديو</b><small>MP4 أو MOV — حتى 50 ميجابايت</small></label>
      <p class="muted" id="vfName"></p>
    </div>
    <div id="vfLink" hidden><div class="field"><label for="vfU">رابط الفيديو</label><input class="inp ltr" id="vfU" type="url" placeholder="https://youtu.be/..."></div><p class="muted" style="font-size:13px">للفيديوهات الطويلة: ارفعها على يوتيوب (يمكن جعلها «غير مدرجة») ثم الصق الرابط هنا.</p></div>
    <div class="field"><label for="vfC">عنوان الفيديو</label><input class="inp" id="vfC" maxlength="120" placeholder="مثال: الزفة"></div>`,
    {foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn primary" type="button" id="vfSave">إضافة</button>`});
  let mode = "file";
  $$(".ev-seg button").forEach(b => b.onclick = () => { mode = b.dataset.s; $$(".ev-seg button").forEach(x => x.classList.toggle("on", x === b)); $("#vfFile").hidden = mode !== "file"; $("#vfLink").hidden = mode !== "link"; });
  $("#vfF").onchange = e => { const f = e.target.files[0]; $("#vfName").textContent = f ? `${f.name} — ${(f.size / 1048576).toFixed(1)} ميجابايت` : ""; if(f && f.size > VIDEO_MAX) $("#vfName").innerHTML = `<b style="color:var(--danger,#b42318)">الملف أكبر من 50 ميجابايت. ارفعه على يوتيوب والصق الرابط.</b>`; };
  $("#vfSave").onclick = async () => {
    const caption = $("#vfC").value.trim() || null, btn = $("#vfSave");
    if(mode === "link"){
      const u = $("#vfU").value.trim();
      if(!/^https?:\/\//i.test(u)) return toast("الصق رابطاً صحيحاً يبدأ بـ https://", true);
      btn.disabled = true;
      const {error} = await db.from("f4_media").insert({occasion_id:o.id, kind:"video", url:u, caption});
      btn.disabled = false;
      if(error) return toast(errMsg(error), true);
    }else{
      const f = $("#vfF").files[0];
      if(!f) return toast("اختر ملف الفيديو", true);
      if(f.size > VIDEO_MAX) return toast("الملف أكبر من 50 ميجابايت", true);
      const ext = (f.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
      const path = `occ/${o.id}/v-${Date.now()}-${rnd()}.${ext}`;
      btn.disabled = true; d.close(); progress("جارٍ رفع الفيديو… لا تغلق الصفحة");
      const a = await db.storage.from(MEDIA_BUCKET).upload(path, f, {contentType:f.type || "video/mp4"});
      if(a.error){ progress(null); return toast("تعذر رفع الفيديو: " + errMsg(a.error), true); }
      const r = await db.from("f4_media").insert({occasion_id:o.id, kind:"video", path, caption});
      progress(null);
      if(r.error){ db.storage.from(MEDIA_BUCKET).remove([path]); return toast(errMsg(r.error), true); }
    }
    if(d.open) d.close();
    toast("تمت إضافة الفيديو"); EV.tab = "video"; renderEvent(o.id);
  };
}

/* ---------- العارض (صور وفيديو) ---------- */
function lightbox(items, i, o){
  let d = $("#dLight");
  if(!d){ d = document.createElement("dialog"); d.id = "dLight"; d.className = "lb"; d.setAttribute("aria-label", "عارض الوسائط"); document.body.append(d); }
  const show = async () => {
    const it = items[i], m = it.m;
    let stage;
    if(m.kind === "photo"){
      const u = await mediaUrls([m.path]);
      stage = `<img src="${esc(u(m.path))}" alt="${esc(m.caption || "")}">`;
    }else if(m.path){
      const u = await mediaUrls([m.path]);
      stage = `<video src="${esc(u(m.path))}" controls autoplay playsinline></video>`;
    }else if(ytId(m.url)){
      stage = `<iframe src="https://www.youtube-nocookie.com/embed/${ytId(m.url)}?autoplay=1&rel=0" title="${esc(m.caption || "فيديو")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }else{
      stage = `<div class="lb-link">${IC_VID}<a class="btn primary" href="${esc(m.url)}" target="_blank" rel="noopener">فتح الفيديو في صفحة جديدة</a></div>`;
    }
    const isCover = m.kind === "photo" && o.cover_path === m.path;
    d.innerHTML = `
      <div class="lb-top"><span class="lb-n">${i + 1} / ${items.length}</span><span class="lb-cap">${esc(m.caption || "")}</span>
        <div class="lb-acts">
          ${m.kind === "photo" && canEditOcc(o) ? `<button class="lb-b" id="lbCover" ${isCover ? "disabled" : ""}>${isCover ? "صورة الغلاف" : "اجعلها غلافاً"}</button>` : ""}
          ${m.path ? `<button class="lb-b" id="lbDown">تنزيل</button>` : ""}
          ${canDelMedia(m) ? `<button class="lb-b danger" id="lbDel">حذف</button>` : ""}
          <button class="lb-b lb-x" id="lbClose" aria-label="إغلاق">✕</button>
        </div></div>
      <div class="lb-stage">${stage}</div>
      ${items.length > 1 ? `<button class="lb-nav prev" id="lbPrev" aria-label="السابق">›</button><button class="lb-nav next" id="lbNext" aria-label="التالي">‹</button>` : ""}`;
    $("#lbClose").onclick = () => d.close();
    const nx = $("#lbNext"), pv = $("#lbPrev");
    if(nx){ nx.onclick = () => go(1); pv.onclick = () => go(-1); }
    const cv = $("#lbCover"); if(cv) cv.onclick = async () => {
      const {error} = await db.from("f4_occasions").update({cover_path:m.path}).eq("id", o.id);
      if(error) return toast(errMsg(error), true);
      o.cover_path = m.path; toast("تم تعيين صورة الغلاف"); show();
    };
    const dn = $("#lbDown"); if(dn) dn.onclick = async () => {
      const {data, error} = await db.storage.from(MEDIA_BUCKET).download(m.path);
      if(error) return toast(errMsg(error), true);
      const a = document.createElement("a"); a.href = URL.createObjectURL(data);
      a.download = `${o.title}-${i + 1}.${m.path.split(".").pop()}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    const dl = $("#lbDel"); if(dl) dl.onclick = async () => {
      if(!await ask("حذف نهائي", m.kind === "photo" ? "حذف هذه الصورة نهائياً؟" : "حذف هذا الفيديو نهائياً؟", {okText:"حذف", danger:true})) return;
      const {error} = await db.from("f4_media").delete().eq("id", m.id);
      if(error) return toast(errMsg(error), true);
      if(m.path) db.storage.from(MEDIA_BUCKET).remove(m.kind === "photo" ? [m.path, thumbOf(m.path)] : [m.path]);
      if(o.cover_path === m.path) await db.from("f4_occasions").update({cover_path:null}).eq("id", o.id);
      d.close(); toast("تم الحذف"); renderEvent(o.id);
    };
  };
  const go = s => { i = (i + s + items.length) % items.length; show(); };
  d.onkeydown = e => { if(e.key === "ArrowLeft") go(1); else if(e.key === "ArrowRight") go(-1); };
  let x0 = null;
  d.ontouchstart = e => { x0 = e.touches[0].clientX; };
  d.ontouchend = e => { if(x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if(Math.abs(dx) > 50 && items.length > 1 && !e.target.closest("video,iframe")) go(dx > 0 ? 1 : -1); };
  d.onclose = () => { d.innerHTML = ""; };
  show(); if(!d.open) d.showModal();
}

/* ---------- حذف المناسبة ---------- */
async function deleteOcc(o){
  const M = mediaOf(o.id);
  if(!await ask("حذف المناسبة", `سيتم حذف «${o.title}» مع ${M.length} من الصور والفيديوهات نهائياً.`, {okText:"متابعة", danger:true})) return;
  const t = await ask("تأكيد أخير", "اكتب كلمة «حذف» للتأكيد", {input:true, okText:"حذف نهائي", danger:true});
  if(t === null) return;
  if(t.trim() !== "حذف") return toast("لم يتم الحذف — الكلمة غير مطابقة", true);
  const paths = M.flatMap(m => m.path ? (m.kind === "photo" ? [m.path, thumbOf(m.path)] : [m.path]) : []);
  const {error} = await db.from("f4_occasions").delete().eq("id", o.id);
  if(error) return toast(errMsg(error), true);
  for(let i = 0; i < paths.length; i += 100) await db.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100));
  toast("تم حذف المناسبة"); location.hash = "#/events";
}
