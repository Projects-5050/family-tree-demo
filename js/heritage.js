/* ===== تراث العائلة: حكايات، صور قديمة، وثائق، مهن وأماكن، خط زمني ===== */
const HER_KINDS = {
  story:{tab:"الحكايات", one:"حكاية", hint:"قصة رُويت عن الأجداد، قول أو مثل كانوا يرددونه، أو ذكرى"},
  photo:{tab:"الصور القديمة", one:"صورة قديمة", hint:"صورة قديمة للأجداد أو البيت أو المكان"},
  doc:{tab:"الوثائق", one:"وثيقة", hint:"وثيقة، مخطوطة، رسالة أو دفتر قديم (صورة أو PDF)"},
  place:{tab:"المهن والأماكن", one:"مهنة أو مكان", hint:"مهنة عمل بها الأجداد، أو مكان عاشت فيه العائلة"},
  event:{tab:"الخط الزمني", one:"حدث", hint:"حدث مهم في تاريخ العائلة مع سنته"},
};
const HER_FILE_MAX = 20 * 1024 * 1024;
const HR = {tab:"story", items:[], loaded:false};
const IC_HER = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4c-6 6-6 12 0 18 6-6 6-12 0-18z"/><path d="M20 22v14M12 36h16"/><path d="M8 18c4 0 8 2 12 6M32 18c-4 0-8 2-12 6"/></svg>';
const IC_DOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/></svg>';
const IC_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const canEditHer = h => isAdmin() || (h.created_by || "") === S.email;
const herPerson = h => h.person_id ? S.byId.get(h.person_id) : null;
const herCount = k => HR.items.filter(h => h.kind === k).length;

async function loadHeritage(){
  const {data, error} = await db.from("f4_heritage").select("*").order("created_at", {ascending:false});
  if(error) throw error;
  HR.items = data || []; HR.loaded = true;
}
/* عدّاد بطاقة الرئيسية */
async function fillHeritageTile(){
  const el = $("#herCnt"); if(!el) return;
  try{
    if(!HR.loaded) await loadHeritage();
    const parts = [["story","حكاية"],["photo","صورة قديمة"],["doc","وثيقة"]].map(([k, w]) => `<span>${herCount(k)} ${w}</span>`);
    if($("#herCnt")) $("#herCnt").innerHTML = HR.items.length ? parts.join("") : "<span>ابدأ بإضافة أول حكاية</span>";
  }catch(e){ el.hidden = true; }
}
function heritageTile(){
  return `<a class="tile her-tile" href="#/heritage"><span class="her-seal">${IC_HER}</span>
    <span class="her-tt"><b>تراث العائلة</b><small>حكايات الأجداد، صورهم، وثائقهم ومهنهم — محفوظة للأجيال</small><span class="her-cnt" id="herCnt"></span></span></a>`;
}

/* ---------- الصفحة ---------- */
async function renderHeritage(tab){
  if(tab && (HER_KINDS[tab] || tab === "time")) HR.tab = tab === "time" ? "event" : tab;
  const v = $("#view");
  v.innerHTML = `<div class="her-cover">
      <svg class="her-orn" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="34"/><path d="M50 4l13 33 33 13-33 13-13 33-13-33L4 50l33-13z"/></svg>
      <div class="her-eye">أرشيف عائلة المرجان</div><h2>تراث العائلة</h2>
      <p>هنا نجمع ما تركه الأجداد: حكاياتهم كما رُويت لنا، صورهم القديمة، وثائقهم، مهنهم، والأماكن التي عاشوا فيها. كل فرد يستطيع أن يضيف ما يعرفه.</p>
      <button class="her-add" type="button" id="herAdd">＋ أضف إلى التراث</button></div>
    <div class="her-tabs" role="tablist" aria-label="أقسام التراث" id="herTabs"></div>
    <div id="herBody"><p class="muted">جارٍ التحميل…</p></div>`;
  $("#herAdd").onclick = () => heritageForm(null, HR.tab);
  try{ await loadHeritage(); }catch(e){ $("#herBody").innerHTML = `<p class="err">${esc(errMsg(e))}</p>`; return; }
  if(!location.hash.startsWith("#/heritage")) return;
  drawHeritage();
}
function drawHeritage(){
  $("#herTabs").innerHTML = Object.entries(HER_KINDS).map(([k, o]) => {
    const n = k === "event" ? HR.items.filter(h => h.year).length : herCount(k);
    return `<button role="tab" type="button" aria-selected="${HR.tab === k}" data-t="${k}">${o.tab}<b>${n}</b></button>`;
  }).join("");
  $$("#herTabs [data-t]").forEach(b => b.onclick = () => {
    const prev = HR.tab; HR.tab = b.dataset.t; pageStep(() => { HR.tab = prev; drawHeritage(); }); drawHeritage();
  });
  const body = $("#herBody"), k = HR.tab;
  const L = k === "event" ? HR.items.filter(h => h.year).sort((a, b) => a.year - b.year || a.id - b.id) : HR.items.filter(h => h.kind === k);
  if(!L.length){
    body.innerHTML = `<div class="her-empty">${IC_HER}<b>لا يوجد شيء في «${HER_KINDS[k].tab}» بعد</b><p>${HER_KINDS[k].hint}.</p><button class="btn primary" type="button" id="herFirst">＋ أضف ${HER_KINDS[k].one}</button></div>`;
    $("#herFirst").onclick = () => heritageForm(null, k); return;
  }
  if(k === "event"){
    body.innerHTML = `<ol class="her-tl">${L.map(h => `<li><button type="button" class="her-tl-i" data-h="${h.id}"><span class="yr">${esc(h.era || String(h.year))}</span><b>${esc(h.title)}</b>${h.kind !== "event" ? `<small>${HER_KINDS[h.kind].one}</small>` : ""}${h.body ? `<p>${esc(cut(h.body, 160))}</p>` : ""}</button></li>`).join("")}</ol>`;
  }else if(k === "story"){
    body.innerHTML = `<div class="her-grid">${L.map(h => `<button type="button" class="her-story" data-h="${h.id}">
      <b class="t">${esc(h.title)}</b>${h.body ? `<q>${esc(cut(h.body, 260))}</q>` : ""}
      <span class="by">${[h.narrator && "رواها: " + h.narrator, herPerson(h) && "عن: " + fullName(herPerson(h), 3), h.era].filter(Boolean).map(esc).join(" · ")}</span>
      ${h.file_kind === "audio" ? `<span class="her-chip">${IC_MIC}تسجيل صوتي</span>` : ""}</button>`).join("")}</div>`;
  }else{
    body.innerHTML = `<div class="her-grid ${k === "photo" ? "her-photos" : ""}">${L.map(h => {
      const img = h.file_kind === "image" ? `<span class="her-img" data-src="${esc(thumbOf(h.path))}"></span>` : h.file_kind === "pdf" ? `<span class="her-pg">${IC_DOC}<i>PDF</i></span>` : (k === "photo" ? "" : `<span class="her-pg">${IC_DOC}</span>`);
      return `<div role="button" tabindex="0" class="her-card her-k-${k}" data-h="${h.id}">${img}<span class="tx"><b>${esc(h.title)}</b><small>${[h.era, herPerson(h) && fullName(herPerson(h), 3)].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small>${h.body && k !== "photo" ? `<span class="ds">${esc(cut(h.body, 120))}</span>` : ""}</span></div>`;
    }).join("")}</div>`;
    const imgs = $$(".her-img[data-src]", body);
    if(imgs.length) mediaUrls(imgs.map(x => x.dataset.src)).then(u => imgs.forEach(x => { const s = u(x.dataset.src); if(s) x.style.backgroundImage = `url("${s}")`; }));
  }
  $$("[data-h]", body).forEach(b => { b.onclick = () => heritageView(HR.items.find(h => h.id === +b.dataset.h)); b.onkeydown = e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); b.click(); } }; });
}
const cut = (s, n) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n).trim() + "…" : s; };

/* ---------- عرض عنصر ---------- */
async function heritageView(h){
  if(!h) return;
  let media = "";
  if(h.path){
    const u = await mediaUrls([h.path]), src = u(h.path);
    if(h.file_kind === "image") media = `<img class="her-big" src="${esc(src)}" alt="${esc(h.title)}">`;
    else if(h.file_kind === "audio") media = `<audio class="her-audio" src="${esc(src)}" controls preload="metadata"></audio>`;
    else if(h.file_kind === "pdf") media = `<a class="btn" href="${esc(src)}" target="_blank" rel="noopener">${IC_DOC} فتح الوثيقة (PDF)</a>`;
  }
  const p = herPerson(h);
  const meta = [h.era || (h.year && String(h.year)), h.narrator && "رواها: " + h.narrator].filter(Boolean).map(esc).join(" · ");
  const d = modal(`${HER_KINDS[h.kind].one}: ${h.title}`, `
    ${media}
    ${meta ? `<p class="muted" style="margin:10px 0 0">${meta}</p>` : ""}
    ${h.body ? `<div class="her-text ${h.kind === "story" ? "story" : ""}">${esc(h.body)}</div>` : ""}
    ${p ? `<div style="margin-top:12px">${personBtn(p, "مرتبط بهذا السجل")}</div>` : ""}
    <p class="muted" style="font-size:13px;margin:12px 0 0">أضيف ${fmtDate(h.created_at.slice(0, 10))}</p>`,
    {wide:h.file_kind === "image", foot:`${canEditHer(h) ? `<button class="btn danger" type="button" id="hvDel">حذف</button><button class="btn" type="button" id="hvEdit">تعديل</button>` : ""}<button class="btn primary" type="button" onclick="this.closest('dialog').close()">إغلاق</button>`});
  d.querySelector(".pbtn")?.addEventListener("click", () => d.close());
  const ed = $("#hvEdit"); if(ed) ed.onclick = () => heritageForm(h, h.kind);
  const dl = $("#hvDel"); if(dl) dl.onclick = async () => {
    d.close();
    if(!(await ask("حذف من التراث", `حذف «${h.title}» نهائياً؟`, {okText:"حذف", danger:true}))) return;
    const {error} = await db.from("f4_heritage").delete().eq("id", h.id);
    if(error) return toast(errMsg(error), true);
    if(h.path) db.storage.from(MEDIA_BUCKET).remove(h.file_kind === "image" ? [h.path, thumbOf(h.path)] : [h.path]);
    HR.items = HR.items.filter(x => x.id !== h.id); toast("تم الحذف"); drawHeritage();
  };
}

/* ---------- إضافة / تعديل ---------- */
function heritageForm(h, kind){
  const isNew = !h; h = h || {kind, title:"", body:"", era:"", year:null, narrator:"", person_id:null};
  let person = h.person_id ? S.byId.get(h.person_id) || null : null, file = null, dropFile = false;
  const accept = k => k === "photo" ? "image/*" : k === "doc" ? "image/*,application/pdf" : k === "story" ? "audio/*,image/*" : "image/*";
  const d = modal(isNew ? "إضافة إلى تراث العائلة" : "تعديل", `
    <div class="field"><label for="hfKind">النوع</label><select class="inp" id="hfKind" ${isNew ? "" : "disabled"}>${Object.entries(HER_KINDS).map(([k, o]) => `<option value="${k}" ${k === h.kind ? "selected" : ""}>${o.one}</option>`).join("")}</select><small class="muted" id="hfHint"></small></div>
    <div class="field"><label for="hfTitle">العنوان *</label><input class="inp" id="hfTitle" maxlength="160" value="${esc(h.title)}"></div>
    <div class="field"><label for="hfBody">النص / الوصف</label><textarea class="inp" id="hfBody" rows="6" maxlength="20000">${esc(h.body || "")}</textarea></div>
    <div class="fgrid">
      <div class="field"><label for="hfEra">الزمن (كما يُروى)</label><input class="inp" id="hfEra" maxlength="60" placeholder="مثال: الخمسينات، ١٩٦٠ تقريباً" value="${esc(h.era || "")}"></div>
      <div class="field"><label for="hfYear">السنة (للخط الزمني)</label><input class="inp ltr" id="hfYear" type="number" min="1500" max="2200" placeholder="1960" value="${h.year || ""}"></div>
    </div>
    <div class="field" id="hfNarrBox"><label for="hfNarr">الراوي</label><input class="inp" id="hfNarr" maxlength="120" placeholder="من روى هذه الحكاية؟" value="${esc(h.narrator || "")}"></div>
    <div class="field"><label>مرتبط بسجل في العائلة</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" type="button" id="hfPerson"></button><button class="btn small" type="button" id="hfPersonX" aria-label="إزالة الربط">✕</button></div></div>
    <div class="field"><label for="hfFile" id="hfFileL">ملف مرفق</label><input class="inp" id="hfFile" type="file">
      <small class="muted" id="hfFileInfo">${h.path ? "يوجد ملف مرفق — اختر ملفاً جديداً لاستبداله" : ""}</small>
      ${h.path ? `<label class="check" style="margin-top:6px"><input type="checkbox" id="hfDrop"> حذف الملف المرفق</label>` : ""}</div>
    <p class="err" id="hfErr"></p>`,
    {foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn primary" type="button" id="hfSave">${isNew ? "إضافة" : "حفظ"}</button>`});
  const sync = () => {
    const k = $("#hfKind").value;
    $("#hfHint").textContent = HER_KINDS[k].hint;
    $("#hfNarrBox").hidden = k !== "story";
    $("#hfFile").accept = accept(k);
    $("#hfFileL").textContent = k === "photo" ? "الصورة *" : k === "doc" ? "صورة الوثيقة أو ملف PDF" : k === "story" ? "تسجيل صوتي أو صورة (اختياري)" : "صورة (اختياري)";
  };
  const drawP = () => { $("#hfPerson").textContent = person ? fullName(person, 4) : "اختيار شخص…"; $("#hfPersonX").hidden = !person; };
  $("#hfKind").onchange = sync; sync(); drawP();
  $("#hfPerson").onclick = async () => {
    d.close(); const p = await pickPerson("مرتبط بسجل"); d.showModal(); if(p) { person = p; drawP(); }
  };
  $("#hfPersonX").onclick = () => { person = null; drawP(); };
  $("#hfFile").onchange = e => { file = e.target.files[0] || null; $("#hfFileInfo").textContent = file ? `${file.name} — ${(file.size / 1048576).toFixed(1)} ميجابايت` : ""; };
  const dr = $("#hfDrop"); if(dr) dr.onchange = () => dropFile = dr.checked;
  $("#hfSave").onclick = async () => {
    const k = $("#hfKind").value, err = $("#hfErr"); err.textContent = "";
    const row = {kind:k, title:$("#hfTitle").value.trim(), body:$("#hfBody").value.trim() || null, era:$("#hfEra").value.trim() || null,
      year:$("#hfYear").value ? parseInt($("#hfYear").value, 10) : null, narrator:k === "story" ? ($("#hfNarr").value.trim() || null) : null, person_id:person ? person.id : null};
    if(!row.title){ err.textContent = "اكتب العنوان"; $("#hfTitle").focus(); return; }
    if(row.year && (row.year < 1500 || row.year > 2200)){ err.textContent = "السنة غير صحيحة"; return; }
    if(k === "event" && !row.year){ err.textContent = "الحدث يحتاج سنة ليظهر في الخط الزمني"; $("#hfYear").focus(); return; }
    let fk = null;
    if(file){
      fk = /^image\//.test(file.type) ? "image" : /^audio\//.test(file.type) ? "audio" : file.type === "application/pdf" ? "pdf" : null;
      if(!fk || !accept(k).split(",").some(a => a === file.type || (a.endsWith("/*") && file.type.startsWith(a.slice(0, -1))))){ err.textContent = "نوع الملف غير مناسب لهذا القسم"; return; }
      if(fk !== "image" && file.size > HER_FILE_MAX){ err.textContent = "الملف أكبر من 20 ميجابايت"; return; }
    }
    if(k === "photo" && !file && !(h.path && !dropFile)){ err.textContent = "اختر الصورة"; return; }
    const btn = $("#hfSave"); btn.disabled = true; btn.textContent = "جارٍ الحفظ…";
    const oldPath = h.path, oldKind = h.file_kind;
    try{
      if(file){
        const base = `her/${Date.now()}-${rnd()}`;
        if(fk === "image"){
          const [big, small] = await Promise.all([compressImage(file, 1800, .84), compressImage(file, 480, .74)]);
          const path = base + ".jpg";
          let r = await db.storage.from(MEDIA_BUCKET).upload(path, big, {contentType:"image/jpeg"}); if(r.error) throw r.error;
          r = await db.storage.from(MEDIA_BUCKET).upload(thumbOf(path), small, {contentType:"image/jpeg"}); if(r.error){ db.storage.from(MEDIA_BUCKET).remove([path]); throw r.error; }
          row.path = path;
        }else{
          const ext = (file.name.match(/\.(\w{2,5})$/) || [, fk === "pdf" ? "pdf" : "m4a"])[1].toLowerCase();
          const path = `${base}.${ext}`;
          const r = await db.storage.from(MEDIA_BUCKET).upload(path, file, {contentType:file.type}); if(r.error) throw r.error;
          row.path = path;
        }
        row.file_kind = fk;
      }else if(dropFile){ row.path = null; row.file_kind = null; }
      const q = isNew ? db.from("f4_heritage").insert(row) : db.from("f4_heritage").update(row).eq("id", h.id);
      const {data, error} = await q.select().single();
      if(error){ if(row.path) db.storage.from(MEDIA_BUCKET).remove(fk === "image" ? [row.path, thumbOf(row.path)] : [row.path]); throw error; }
      if(!isNew && oldPath && (file || dropFile)) db.storage.from(MEDIA_BUCKET).remove(oldKind === "image" ? [oldPath, thumbOf(oldPath)] : [oldPath]);
      HR.items = isNew ? [data, ...HR.items] : HR.items.map(x => x.id === data.id ? data : x);
      d.close(); toast(isNew ? "أُضيف إلى تراث العائلة ✓" : "تم الحفظ");
      if(location.hash.startsWith("#/heritage")){ HR.tab = k; drawHeritage(); } else location.hash = "#/heritage";
    }catch(e){ err.textContent = errMsg(e); btn.disabled = false; btn.textContent = isNew ? "إضافة" : "حفظ"; }
  };
  $("#hfTitle").focus();
}
