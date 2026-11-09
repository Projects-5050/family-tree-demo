/* ===== الإعدادات، المستخدمون، الاستيراد والتصدير، واتساب ===== */

/* ---------- الإعدادات والقوائم ---------- */
const LK_COL = {governorate:"governorate", area:"area", branch:"branch", family:"family", nickname:"nickname", marital:"marital", blood:"blood",
  education:"education", specialization:"specialization", job:"job", workside:"workside", hobby:"hobby", birthplace:"birth_place", burial:"burial_place"};
let LK_KIND = "area", LK_GOV = "";
function renderSettings(){
  $("#view").innerHTML = `
    <div class="page-h"><h2>الإعدادات والقوائم</h2></div>
    <p class="muted" style="margin-top:0">هذه القوائم تظهر كخيارات في شاشة السجل. تعديل اسم عنصر يحدّث السجلات التي تستخدمه.</p>
    <div class="tabs" role="tablist">${Object.entries(LOOKUP_KINDS).map(([k, v]) => `<button type="button" class="tab ${k === LK_KIND ? "on" : ""}" data-kind="${k}">${v.label} <small class="muted">(${(S.lookups[k] || []).length})</small></button>`).join("")}</div>
    <div id="lkBox"></div>`;
  $$("[data-kind]").forEach(b => b.onclick = () => { LK_KIND = b.dataset.kind; renderSettings(); });
  drawLookups();
}
function drawLookups(){
  const k = LK_KIND, def = LOOKUP_KINDS[k], isArea = k === "area";
  let rows = S.lookups[k] || [];
  if(isArea && LK_GOV) rows = rows.filter(r => r.parent === LK_GOV);
  const used = v => S.people.filter(p => p[LK_COL[k]] === v).length;
  $("#lkBox").innerHTML = `
    <form class="card toolbar" id="lkForm" novalidate style="align-items:flex-end">
      <div class="field" style="flex:2 1 200px"><label for="lkName">إضافة إلى «${def.label}»</label><input class="inp" id="lkName" maxlength="80" required placeholder="الاسم الجديد"></div>
      ${isArea ? `<div class="field" style="flex:1 1 180px"><label for="lkParent">المحافظة</label><select class="inp" id="lkParent">${lk("governorate").map(g => `<option ${g === LK_GOV ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>` : ""}
      <button class="btn primary" type="submit">إضافة</button>
    </form>
    ${isArea ? `<div class="toolbar"><select class="inp" id="lkGov" style="max-width:260px" aria-label="تصفية حسب المحافظة">${opt(lk("governorate"), LK_GOV, "كل المحافظات")}</select></div>` : ""}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th>${isArea ? "<th>المحافظة</th>" : ""}<th>مستخدم في</th><th style="text-align:end">إجراءات</th></tr></thead><tbody>
      ${rows.length ? rows.map(r => `<tr><td><b>${esc(r.name)}</b></td>${isArea ? `<td>${esc(r.parent || "")}</td>` : ""}<td class="num">${used(r.name)} سجل</td>
        <td style="text-align:end;white-space:nowrap"><button class="btn small" data-up="${r.id}" aria-label="تحريك للأعلى">▲</button> <button class="btn small" data-down="${r.id}" aria-label="تحريك للأسفل">▼</button>
        <button class="btn small" data-ren="${r.id}">تعديل</button> <button class="btn small danger" data-del="${r.id}">حذف</button></td></tr>`).join("")
        : `<tr><td colspan="4" class="empty">القائمة فارغة — أضف أول عنصر من الأعلى</td></tr>`}
    </tbody></table></div>`;
  if($("#lkGov")) $("#lkGov").onchange = e => { LK_GOV = e.target.value; drawLookups(); };
  $("#lkForm").onsubmit = async e => {
    e.preventDefault(); const name = $("#lkName").value.trim(); if(!name) return;
    const list = S.lookups[k] || [];
    const row = {kind:k, name, parent:isArea ? $("#lkParent").value : null, sort:list.reduce((m, x) => Math.max(m, x.sort), 0) + 1};
    const {data, error} = await db.from("f4_lookups").insert(row).select().single();
    if(error){ toast(error.code === "23505" ? "هذا الاسم موجود في القائمة" : errMsg(error), true); return; }
    (S.lookups[k] ||= []).push(data); toast("تمت الإضافة"); renderSettings(); $("#lkName")?.focus();
  };
  $("#lkBox").querySelector("tbody").onclick = async e => {
    const b = e.target.closest("button"); if(!b) return;
    const list = S.lookups[k], id = +(b.dataset.up || b.dataset.down || b.dataset.ren || b.dataset.del), r = list.find(x => x.id === id);
    if(b.dataset.del){
      const n = used(r.name);
      if(!(await ask("حذف من القائمة", `حذف «${r.name}»؟${n ? ` السجلات الـ${n} التي تستخدمه تبقى كما هي.` : ""}`, {okText:"حذف", danger:true}))) return;
      const {error} = await db.from("f4_lookups").delete().eq("id", id); if(error) return toast(errMsg(error), true);
      S.lookups[k] = list.filter(x => x.id !== id); renderSettings(); return;
    }
    if(b.dataset.ren){
      const name = await ask("تعديل الاسم", `الاسم الجديد بدل «${r.name}»`, {input:true, value:r.name}); if(name === null || !name.trim()) return;
      const upd = {name:name.trim()};
      if(isArea){ const g = await ask("المحافظة", "اكتب المحافظة", {input:true, value:r.parent || ""}); if(g !== null && g.trim()) upd.parent = g.trim(); }
      const {data, error} = await db.from("f4_lookups").update(upd).eq("id", id).select().single();
      if(error) return toast(error.code === "23505" ? "هذا الاسم موجود في القائمة" : errMsg(error), true);
      const old = r.name; Object.assign(r, data);
      if(old !== data.name && used(old)){
        const col = LK_COL[k]; const res = await db.from("f4_people").update({[col]:data.name}).eq(col, old).select();
        if(res.error) toast("تعذر تحديث السجلات: " + errMsg(res.error), true); else res.data.forEach(upsertLocal);
      }
      if(k === "governorate"){ const res = await db.from("f4_lookups").update({parent:data.name}).eq("kind", "area").eq("parent", old).select(); if(!res.error) res.data.forEach(x => Object.assign(S.lookups.area.find(a => a.id === x.id) || {}, x)); }
      toast("تم التعديل"); renderSettings(); return;
    }
    const i = list.indexOf(r), j = b.dataset.up ? i - 1 : i + 1;
    if(j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((x, n) => x.sort = n + 1);
    const res = await Promise.all([list[i], list[j]].map(x => db.from("f4_lookups").update({sort:x.sort}).eq("id", x.id)));
    if(res.some(x => x.error)) toast("تعذر حفظ الترتيب", true);
    drawLookups();
  };
}

/* ---------- المستخدمون ---------- */
let USERS = [];
async function renderUsers(){
  $("#view").innerHTML = `
    <div class="page-h"><h2>المستخدمون والصلاحيات</h2></div>
    <form class="card" id="uForm" novalidate>
      <h3>إضافة مستخدم</h3>
      <div class="fgrid">
        <div class="field req"><label for="uEmail">البريد الإلكتروني</label><input class="inp ltr" id="uEmail" type="email" required></div>
        <div class="field"><label for="uName">الاسم</label><input class="inp" id="uName" maxlength="60"></div>
        <div class="field"><label for="uRole">النوع</label><select class="inp" id="uRole"><option value="user">مستخدم</option><option value="admin">مدير (كل الصلاحيات)</option></select></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:10px 0">
        <label class="check"><input type="checkbox" id="uAdd" checked> إضافة</label>
        <label class="check"><input type="checkbox" id="uEdit" checked> تعديل</label>
        <label class="check"><input type="checkbox" id="uDel"> حذف</label>
      </div>
      <div class="err" id="uErr"></div>
      <button class="btn primary" type="submit">إضافة المستخدم</button>
      <p class="muted" style="font-size:13px;margin-bottom:0">بعد الإضافة: يفتح المستخدم رابط البرنامج، يكتب بريده وكلمة سر جديدة، ويضغط «أول مرة؟ أنشئ كلمة سر». المستخدم بدون أي صلاحية يستطيع المشاهدة والتقارير فقط. كل الأعضاء يشاهدون كل العائلة، والعضو يعدّل على سجله وسجلات أسرته التي تليه (أبناؤه وأحفاده وأزواجهم) فقط، لذلك اربطه بسجله في العائلة.</p>
    </form>
    <div class="qr-bar"><button class="btn" type="button" id="qrAllBtn">▦ بطاقات QR لكل الأعضاء</button><span class="muted">رمز لكل عضو يدخل به مباشرة من كاميرا الجوال بدون كلمة سر</span></div>
    <div class="card"><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>البريد</th><th>الاسم</th><th>النوع</th><th>إضافة</th><th>تعديل</th><th>حذف</th><th>سجله في العائلة</th><th>ما يراه</th><th>الحالة</th><th>الزيارات</th><th>آخر زيارة</th><th></th></tr></thead><tbody id="uBody"><tr><td colspan="12"><div class="spin"></div></td></tr></tbody></table></div></div>`;
  const load = async () => {
    const [{data, error}, vis] = await Promise.all([db.from("f4_users").select("*").order("created_at"), db.rpc("f4_visit_by_user")]);
    if(error){ $("#uBody").innerHTML = `<tr><td colspan="12" class="err">${esc(errMsg(error))}</td></tr>`; return; }
    USERS = data;
    const V = new Map((vis.data || []).map(r => [r.email, r]));
    const ago = t => { if(!t) return "—"; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? "الآن" : m < 60 ? `قبل ${m} د` : m < 1440 ? `قبل ${Math.round(m / 60)} س` : fmtDate(new Date(t).toLocaleDateString("en-CA", {timeZone:"Asia/Bahrain"})); };
    $("#uBody").innerHTML = data.map(u => { const me = u.email === S.email, adm = u.role === "admin";
      const cb = f => `<input type="checkbox" data-u="${esc(u.email)}" data-f="${f}" ${u[f] || adm ? "checked" : ""} ${adm || me ? "disabled" : ""} aria-label="${f}">`;
      return `<tr class="${u.frozen && !adm ? "u-frozen" : ""}"><td class="ltr" style="text-align:start">${esc(u.email)}</td><td>${esc(u.display_name || "")}</td>
        <td><select class="inp" data-u="${esc(u.email)}" data-f="role" ${me ? "disabled" : ""} style="min-width:110px"><option value="user" ${adm ? "" : "selected"}>مستخدم</option><option value="admin" ${adm ? "selected" : ""}>مدير</option></select></td>
        <td>${cb("can_add")}</td><td>${cb("can_edit")}</td><td>${cb("can_delete")}</td>
        <td><button type="button" class="btn small" data-link-u="${esc(u.email)}" style="white-space:nowrap">${u.person_id && S.byId.get(u.person_id) ? nm(S.byId.get(u.person_id), fullName(S.byId.get(u.person_id), 3)) : "ربط بسجل"}</button></td>
        <td class="muted" style="font-size:13px;white-space:nowrap">${adm ? "الجميع" : u.person_id ? "يشاهد الجميع · يعدّل أسرته" : "يشاهد الجميع · لا تعديل حتى يُربط"}</td>
        <td>${adm || me ? '<span class="muted" style="font-size:13px">نشط</span>' : `<button type="button" class="btn small ${u.frozen ? "fz-on" : ""}" data-freeze="${esc(u.email)}" aria-pressed="${!!u.frozen}" title="${u.frozen ? "الحساب مجمّد — اضغط لإلغاء التجميد" : "تجميد الحساب: يمنعه من الدخول دون حذفه"}">${u.frozen ? "❄ مجمّد" : "تجميد"}</button>`}</td>
        <td><b>${V.get(u.email)?.visits ?? 0}</b></td><td class="muted" style="font-size:13px;white-space:nowrap">${ago(V.get(u.email)?.last_visit)}</td>
        <td style="text-align:end">${me ? '<span class="muted" style="font-size:13px">أنت</span>' : `<span style="display:inline-flex;gap:6px">${adm ? "" : `<button class="btn small" type="button" data-qr="${esc(u.email)}" title="رمز دخول سريع">QR</button>`}<button class="btn small danger" type="button" data-rm="${esc(u.email)}">إزالة</button></span>`}</td></tr>`; }).join("");
  };
  $("#qrAllBtn").onclick = () => qrAll(USERS || []);
  $("#uRole").onchange = e => { const a = e.target.value === "admin"; ["#uAdd","#uEdit","#uDel"].forEach(s => { $(s).checked = a || $(s).checked; $(s).disabled = a; }); };
  $("#uForm").onsubmit = async e => {
    e.preventDefault(); $("#uErr").textContent = "";
    const email = $("#uEmail").value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ $("#uErr").textContent = "اكتب بريداً صحيحاً"; return; }
    const adm = $("#uRole").value === "admin";
    const row = {email, display_name:$("#uName").value.trim() || null, role:$("#uRole").value, can_add:adm || $("#uAdd").checked, can_edit:adm || $("#uEdit").checked, can_delete:adm || $("#uDel").checked};
    const {error} = await db.from("f4_users").insert(row);
    if(error){ $("#uErr").textContent = error.code === "23505" ? "هذا البريد مضاف مسبقاً" : errMsg(error); return; }
    toast("تمت إضافة المستخدم"); $("#uForm").reset(); load();
  };
  $("#uBody").onchange = async e => {
    const el = e.target.closest("[data-u]"); if(!el) return;
    const f = el.dataset.f, v = f === "role" ? el.value : el.checked;
    if(f === "family_only" && v && !USERS.find(x => x.email === el.dataset.u)?.person_id){ el.checked = false; return toast("اربط المستخدم بسجله في العائلة أولاً", true); }
    const upd = {[f]:v}; if(f === "role" && v === "admin") Object.assign(upd, {can_add:true, can_edit:true, can_delete:true});
    const {error} = await db.from("f4_users").update(upd).eq("email", el.dataset.u);
    toast(error ? errMsg(error) : "تم الحفظ", !!error); load();
  };
  $("#uBody").onclick = async e => {
    const qb = e.target.closest("[data-qr]"); if(qb){ const u = USERS.find(x => x.email === qb.dataset.qr); if(u) qrCard(u); return; }
    const fz = e.target.closest("[data-freeze]");
    if(fz){
      const u = USERS.find(x => x.email === fz.dataset.freeze); if(!u) return;
      const on = !u.frozen, who = u.display_name || u.email;
      if(!(await ask(on ? "تجميد الحساب" : "إلغاء التجميد", on ? `تجميد حساب «${who}»؟ لن يستطيع الدخول أو مشاهدة أي بيانات حتى تلغي التجميد، وتبقى بياناته وصلاحياته محفوظة.` : `إلغاء تجميد حساب «${who}»؟ سيعود للدخول بنفس صلاحياته السابقة.`, {okText:on ? "تجميد" : "إلغاء التجميد", danger:on}))) return;
      const {error} = await db.from("f4_users").update({frozen:on}).eq("email", u.email);
      toast(error ? errMsg(error) : on ? "تم تجميد الحساب ❄" : "تم إلغاء التجميد", !!error); load(); return;
    }
    const lk = e.target.closest("[data-link-u]");
    if(lk){
      const u = USERS.find(x => x.email === lk.dataset.linkU);
      const r = await pickPerson(`سجل ${u?.display_name || lk.dataset.linkU} في العائلة`, {allowNone:true});
      if(r === null) return;
      const upd = {person_id: r ? r.id : null}; if(!r) upd.family_only = false;
      const {error} = await db.from("f4_users").update(upd).eq("email", lk.dataset.linkU);
      toast(error ? errMsg(error) : "تم الحفظ", !!error); return load();
    }
    const b = e.target.closest("[data-rm]"); if(!b) return;
    if(!(await ask("إزالة مستخدم", `إزالة ${b.dataset.rm} من البرنامج؟`, {okText:"إزالة", danger:true}))) return;
    const {error} = await db.from("f4_users").delete().eq("email", b.dataset.rm);
    toast(error ? errMsg(error) : "تمت الإزالة", !!error); load();
  };
  load();
}

/* ---------- الاستيراد والتصدير ---------- */
const XL_EXTRA = {father:"رقم الأب", mother:"رقم الأم", spouses:"الأزواج/الزوجات"};
function personToRow(p){
  const r = {};
  Object.entries(FIELDS).forEach(([k, f]) => { r[f.xl] = p[k] ?? ""; });
  r[XL_EXTRA.father] = S.byId.get(p.father_id)?.serial ?? "";
  r[XL_EXTRA.mother] = S.byId.get(p.mother_id)?.serial ?? "";
  r[XL_EXTRA.spouses] = spousesOf(p).filter(s => s.own).map(spouseLabel).join("، ");
  return r;
}
async function exportPeople(list, name){
  if(!list.length){ toast("لا توجد سجلات للتصدير", true); return; }
  try{ await exportXlsx(list.map(personToRow), "الأفراد", name + "-" + todayISO()); }
  catch(err){ toast(errMsg(err), true); }
}
let IMP = null;
function renderData(){
  $("#view").innerHTML = `
    <div class="page-h"><h2>استيراد وتصدير</h2></div>
    <div class="card"><h3>تصدير</h3>
      <p class="muted" style="margin-top:0">ملف Excel فيه كل الحقول، مع أرقام تسلسل الأب والأم لإعادة الاستيراد لاحقاً.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="xAll">تصدير كل السجلات (${S.people.length})</button>
      <button class="btn" type="button" id="xTpl">تنزيل قالب فارغ للاستيراد</button></div></div>
    <div class="card" ${isAdmin() ? "" : "hidden"}><h3>استيراد من Excel</h3>
      <p class="muted" style="margin-top:0">استخدم نفس عناوين أعمدة القالب. السطر الذي رقم تسلسله موجود <b>يُحدَّث</b>، والجديد <b>يُضاف</b>. عمودا «رقم الأب» و«رقم الأم» يربطان الأبناء تلقائياً.</p>
      <input type="file" id="impFile" accept=".xlsx,.xls,.csv" class="inp">
      <div id="impOut" style="margin-top:12px"></div>
      <button class="btn primary" type="button" id="impGo" disabled style="margin-top:10px">تنفيذ الاستيراد</button></div>
    <div class="card bk-card" ${isAdmin() ? "" : "hidden"}><h3>نسخة احتياطية كاملة</h3>
      <p class="muted" style="margin-top:0">تحفظ كل شيء في ملف على جهازك: الأفراد والأزواج والقوائم والمستخدمين والمناسبات وصفحة «من نحن». احفظ الملف في مكان آمن (بريدك أو Google Drive) ويمكن استعادة البرنامج منه عند الحاجة.</p>
      <p class="bk-last" id="bkLast"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="bkData">تنزيل نسخة البيانات</button>
      <button class="btn" type="button" id="bkFull">نسخة كاملة مع الصور والفيديو (ZIP)</button></div>
      <p class="muted" id="bkOut" style="margin:10px 0 0"></p></div>`;
  $("#xAll").onclick = () => exportPeople(S.people, "سجل-العائلة-كامل");
  $("#xTpl").onclick = async () => { try{ await loadScript(XLSX_URL); const ws = XLSX.utils.aoa_to_sheet([Object.values(FIELDS).map(f => f.xl).concat([XL_EXTRA.father, XL_EXTRA.mother])]); const wb = XLSX.utils.book_new(); wb.Workbook = {Views:[{RTL:true}]}; XLSX.utils.book_append_sheet(wb, ws, "الأفراد"); XLSX.writeFile(wb, "قالب-استيراد-العائلة.xlsx"); }catch(err){ toast(errMsg(err), true); } };
  $("#impFile").onchange = readImport;
  $("#impGo").onclick = runImport;
  if(isAdmin()){ showLastBackup(); $("#bkData").onclick = () => runBackup(false); $("#bkFull").onclick = () => runBackup(true); }
}

/* ===== النسخ الاحتياطي ===== */
const BK_TABLES = [["f4_people","serial"], ["f4_spouses","id"], ["f4_lookups","id"], ["f4_users","email"], ["f4_settings","key"], ["f4_occasions","id"], ["f4_media","id"]];
/* صانع ZIP بسيط (بدون ضغط — الصور والفيديو مضغوطة أصلاً) */
const CRC_T = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function makeZip(entries){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for(const [name, data] of entries){
    const nm = enc.encode(name), u8 = typeof data === "string" ? enc.encode(data) : new Uint8Array(await data.arrayBuffer()), crc = crc32(u8);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, u8.length, true); h.setUint32(22, u8.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(h, nm, u8);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, u8.length, true); c.setUint32(24, u8.length, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(c, nm);
    off += 30 + nm.length + u8.length;
  }
  const csize = central.reduce((a, x) => a + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e], {type:"application/zip"});
}
async function showLastBackup(){
  const {data} = await db.from("f4_settings").select("value").eq("key", "last_backup").maybeSingle();
  const el = $("#bkLast"); if(!el) return;
  if(!data?.value){ el.innerHTML = '<span class="bk-warn">لم تُؤخذ نسخة احتياطية من البرنامج بعد</span>'; return; }
  const days = Math.floor((Date.now() - new Date(data.value)) / 864e5);
  el.innerHTML = `آخر نسخة: <b>${fmtDate(data.value.slice(0, 10))}</b> ${days > 30 ? `<span class="bk-warn">— مرّ ${days} يوماً، يُنصح بأخذ نسخة جديدة</span>` : ""}`;
}
async function runBackup(withFiles){
  const out = $("#bkOut"), btns = [$("#bkData"), $("#bkFull")];
  btns.forEach(b => b.disabled = true);
  try{
    out.textContent = "جارٍ جمع البيانات…";
    const data = {_meta:{app:"family-system", created:new Date().toISOString(), by:S.email, version:1}};
    for(const [t, o] of BK_TABLES) data[t] = await fetchAll(t, o);
    const stamp = todayISO();
    const json = JSON.stringify(data, null, 1);
    const counts = `${data.f4_people.length} فرداً، ${data.f4_occasions.length} مناسبة`;
    if(!withFiles){
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], {type:"application/json"}));
      a.download = `نسخة-احتياطية-شجرة-العائلة-${stamp}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      out.textContent = `تم تنزيل النسخة (${counts}).`;
    }else{
      const entries = [["data.json", json]];
      const files = [
        ...data.f4_people.filter(p => p.photo_path).map(p => [PHOTO_BUCKET, p.photo_path]),
        ...data.f4_media.filter(m => m.path).flatMap(m => m.kind === "photo" ? [[MEDIA_BUCKET, m.path], [MEDIA_BUCKET, thumbOf(m.path)]] : [[MEDIA_BUCKET, m.path]]),
      ];
      let done = 0, miss = 0;
      for(const [bucket, path] of files){
        out.textContent = `جارٍ تنزيل الملفات ${++done} من ${files.length}…`;
        const {data:blob, error} = await db.storage.from(bucket).download(path);
        if(error || !blob){ miss++; continue; }
        entries.push([`${bucket}/${path}`, blob]);
      }
      out.textContent = "جارٍ تجهيز ملف ZIP…";
      const z = await makeZip(entries);
      const a = document.createElement("a"); a.href = URL.createObjectURL(z);
      a.download = `نسخة-كاملة-شجرة-العائلة-${stamp}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      out.textContent = `تم تنزيل النسخة الكاملة (${counts}، الملفات: ${files.length - miss}، الحجم ${(z.size / 1048576).toFixed(1)} ميجابايت)${miss ? ` — تعذر تنزيل ${miss} من الملفات` : ""}.`;
    }
    await db.from("f4_settings").upsert([{key:"last_backup", value:new Date().toISOString(), updated_by:S.email}], {onConflict:"key"});
    showLastBackup(); toast("تم أخذ النسخة الاحتياطية");
  }catch(e){ out.textContent = ""; toast("تعذر أخذ النسخة: " + errMsg(e), true); }
  btns.forEach(b => b.disabled = false);
}
function xlDate(v){
  if(v === "" || v == null) return null;
  if(v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if(typeof v === "number"){ const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m;
  if((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if((m = s.match(/^(\d{4})$/))) return `${m[1]}-01-01`;
  return undefined;
}
async function readImport(e){
  const file = e.target.files[0]; IMP = null; $("#impGo").disabled = true; if(!file) return;
  $("#impOut").innerHTML = '<div class="spin"></div>';
  try{
    await loadScript(XLSX_URL);
    const wb = XLSX.read(await file.arrayBuffer(), {cellDates:true});
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:""});
    const xl2k = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [norm(f.xl), k]));
    const rows = [], errs = [], serials = new Set();
    raw.forEach((r, i) => {
      const o = {}, line = i + 2; let fa = null, mo = null;
      Object.entries(r).forEach(([h, v]) => {
        const hk = norm(h);
        if(hk === norm(XL_EXTRA.father)) fa = parseInt(v, 10) || null;
        else if(hk === norm(XL_EXTRA.mother)) mo = parseInt(v, 10) || null;
        else if(xl2k[hk]) o[xl2k[hk]] = typeof v === "string" ? v.trim() : v;
      });
      if(Object.values(o).every(v => v === "" || v == null)) return;
      const serial = parseInt(o.serial, 10);
      if(!(serial > 0)){ errs.push(`سطر ${line}: رقم التسلسل مفقود`); return; }
      if(serials.has(serial)){ errs.push(`سطر ${line}: رقم التسلسل ${serial} مكرر في الملف`); return; }
      if(!o.name1){ errs.push(`سطر ${line}: الاسم الأول مفقود`); return; }
      const row = {};
      Object.keys(FIELDS).forEach(k => { if(k in o){ let v = o[k]; if(v === "") v = null; if(v != null && typeof v !== "string" && !["birth_date","death_date"].includes(k)) v = String(v); row[k] = v; } });
      row.serial = serial;
      for(const k of ["birth_date","death_date"]) if(k in o){ const d = xlDate(o[k]); if(d === undefined){ errs.push(`سطر ${line}: تاريخ غير مفهوم «${o[k]}»`); return; } row[k] = d; }
      if(row.cpr != null){ row.cpr = String(row.cpr).replace(/\D/g, ""); if(!/^\d{9}$/.test(row.cpr)){ errs.push(`سطر ${line}: الرقم الشخصي يجب أن يكون 9 أرقام`); return; } }
      if(row.gender && !["ذكر","أنثى"].includes(row.gender)){ const g = norm(row.gender); row.gender = /^(ذكر|m|male)$/.test(g) ? "ذكر" : /^(انثي|f|female)$/.test(g) ? "أنثى" : null; }
      if(row.affiliation != null) row.affiliation = /زواج|نسيب|صهر/.test(row.affiliation) ? "منتسب بالزواج" : /عائل|نسب/.test(row.affiliation) ? "من العائلة" : null;
      if(row.status != null) row.status = /متوف/.test(row.status) ? "متوفى" : "على قيد الحياة";
      if(row.area && !row.governorate) row.governorate = govOfArea(row.area) || null;
      serials.add(serial); rows.push({row, fa, mo});
    });
    const upd = rows.filter(x => S.bySerial.has(x.row.serial)).length;
    IMP = {rows};
    $("#impOut").innerHTML = `<div class="notice ${errs.length ? "" : "okbox"}">جاهز: <b>${rows.length - upd}</b> سجل جديد، و<b>${upd}</b> تحديث لسجلات موجودة.${errs.length ? `<br>سيتم تجاهل ${errs.length} سطر:<br>${errs.slice(0, 15).map(esc).join("<br>")}${errs.length > 15 ? "<br>…" : ""}` : ""}</div>`;
    $("#impGo").disabled = !rows.length;
  }catch(err){ $("#impOut").innerHTML = `<p class="err">${esc(errMsg(err))}</p>`; }
}
async function runImport(){
  if(!IMP) return;
  if(!(await ask("تأكيد الاستيراد", `استيراد ${IMP.rows.length} سجل؟ السجلات الموجودة بنفس رقم التسلسل ستُحدَّث.`, {okText:"استيراد"}))) return;
  const btn = $("#impGo"); btn.disabled = true; btn.textContent = "جاري الاستيراد…";
  try{
    for(let i = 0; i < IMP.rows.length; i += 200){
      const batch = IMP.rows.slice(i, i + 200).map(x => x.row);
      const {data, error} = await db.from("f4_people").upsert(batch, {onConflict:"serial"}).select(); if(error) throw error;
      data.forEach(upsertLocal);
    }
    const links = IMP.rows.filter(x => x.fa || x.mo).map(x => {
      const me = S.bySerial.get(x.row.serial), f = S.bySerial.get(x.fa), m = S.bySerial.get(x.mo);
      return me && {id:me.id, father_id:f && f.id !== me.id ? f.id : me.father_id ?? null, mother_id:m && m.id !== me.id ? m.id : me.mother_id ?? null};
    }).filter(Boolean);
    for(const l of links){ const {data, error} = await db.from("f4_people").update({father_id:l.father_id, mother_id:l.mother_id}).eq("id", l.id).select().single(); if(!error) upsertLocal(data); }
    toast(`تم استيراد ${IMP.rows.length} سجل ✓`); renderData();
  }catch(err){ toast(errMsg(err), true); btn.disabled = false; btn.textContent = "تنفيذ الاستيراد"; }
}

/* ---------- مراسلة واتساب ---------- */
/* المستلمون: مربع بجانب كل اسم + أزرار مجموعات سريعة + «إرسال للتالي» يفتح المحددين واحداً بعد الآخر */
const WA = {msg:"السلام عليكم {الاسم}،\n", src:"sel", branch:"", gov:"", sent:new Set(), pick:new Set(), grp:""};
const WA_GROUPS = {
  all:   {t:"الكل", f:() => true},
  m:     {t:"الذكور", f:p => p.gender === "ذكر"},
  f:     {t:"الإناث", f:p => p.gender === "أنثى"},
  bday:  {t:"أعياد ميلاد هذا الشهر", f:p => !!p.birth_date && +p.birth_date.slice(5, 7) === +todayISO().slice(5, 7)},
  fam:   {t:"من العائلة", f:p => p.affiliation === "من العائلة"},
  inlaw: {t:"المنتسبون بالزواج", f:p => p.affiliation === "منتسب بالزواج"},
};
const waText = p => WA.msg.replaceAll("{الاسم_الكامل}", fullName(p, 3)).replaceAll("{الاسم}", p.name1 || "");
function waList(){
  const list = WA.src === "sel" ? S.people.filter(p => S.sel.has(p.id)) : S.people.filter(p => !isDead(p) && (!WA.branch || p.branch === WA.branch) && (!WA.gov || p.governorate === WA.gov));
  return {ok:list.filter(p => waNumber(p.phone)), bad:list.filter(p => !waNumber(p.phone)).length};
}
function renderWhatsapp(){
  if(!S.sel.size && WA.src === "sel") WA.src = "all";
  $("#view").innerHTML = `
    <div class="page-h"><h2>مراسلة واتساب</h2><div class="acts"><a class="btn wa" data-contact href="${esc(contactLink())}" target="_blank" rel="noopener">تواصل مع إدارة البرنامج</a></div></div>
    <div class="card">
      <div class="field"><label for="waMsg">نص الرسالة</label><textarea class="inp" id="waMsg" maxlength="2000">${esc(WA.msg)}</textarea></div>
      <p class="muted" style="font-size:13px">اكتب <b>{الاسم}</b> ليُستبدل بالاسم الأول لكل شخص، و<b>{الاسم_الكامل}</b> للاسم الكامل.</p>
      <div class="toolbar" style="margin:0">
        <select class="inp" id="waSrc" aria-label="القائمة"><option value="sel" ${WA.src === "sel" ? "selected" : ""}>المحددون من شاشة البحث (${S.sel.size})</option><option value="all" ${WA.src === "all" ? "selected" : ""}>كل الأحياء الذين لديهم هاتف</option></select>
        <select class="inp" id="waBranch" aria-label="الفرع" ${WA.src === "sel" ? "hidden" : ""}>${opt(lkUsed("branch"), WA.branch, "كل الفروع")}</select>
        <select class="inp" id="waGov" aria-label="المحافظة" ${WA.src === "sel" ? "hidden" : ""}>${opt(lk("governorate"), WA.gov, "كل المحافظات")}</select>
      </div>
    </div>
    <div class="card wa-pick">
      <div class="wa-pick-h"><b>من يصله المسج؟</b><span class="muted" id="waCount"></span></div>
      <div class="wa-groups" id="waGroups" role="group" aria-label="اختيار سريع">${Object.entries(WA_GROUPS).map(([k, g]) => `<button type="button" class="wa-g" data-g="${k}" aria-pressed="${WA.grp === k}">${g.t}</button>`).join("")}
        <button type="button" class="wa-g clr" id="waNone">إلغاء التحديد</button></div>
      <div class="wa-next"><button class="btn wa" type="button" id="waNext">إرسال للتالي</button><span id="waNextMsg" class="muted"></span></div>
    </div>
    <div class="notice" style="margin-top:14px">واتساب لا يسمح بالإرسال الجماعي التلقائي. حدّد المستلمين بالمربعات أو بالأزرار، ثم اضغط «إرسال للتالي» مرة لكل شخص: تنفتح المحادثة والرسالة جاهزة، فتضغط إرسال في واتساب وترجع.</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:38px"><input type="checkbox" id="waAll" aria-label="تحديد الكل"></th><th>#</th><th>الاسم</th><th>الهاتف</th><th></th></tr></thead><tbody id="waBody"></tbody></table></div>`;
  $("#waMsg").oninput = e => { WA.msg = e.target.value; };
  $("#waSrc").onchange = e => { WA.src = e.target.value; WA.grp = ""; renderWhatsapp(); };
  $("#waBranch").onchange = e => { WA.branch = e.target.value; drawWa(); };
  $("#waGov").onchange = e => { WA.gov = e.target.value; drawWa(); };
  $("#waGroups").onclick = e => {
    const b = e.target.closest("[data-g]"); if(!b) return;
    WA.grp = b.dataset.g; WA.pick = new Set(waList().ok.filter(WA_GROUPS[WA.grp].f).map(p => p.id)); drawWa();
  };
  $("#waNone").onclick = () => { WA.pick.clear(); WA.grp = ""; $("#waNextMsg").textContent = ""; drawWa(); };
  $("#waAll").onchange = e => { const ids = waList().ok.map(p => p.id); WA.grp = ""; WA.pick = e.target.checked ? new Set(ids) : new Set(); drawWa(); };
  $("#waBody").onchange = e => { const c = e.target.closest("[data-pk]"); if(!c) return; c.checked ? WA.pick.add(+c.dataset.pk) : WA.pick.delete(+c.dataset.pk); WA.grp = ""; drawWa(); };
  $("#waBody").onclick = e => { const a = e.target.closest("[data-wa]"); if(!a) return;
    const p = S.byId.get(+a.dataset.wa); a.href = waLink(p.phone, waText(p)); WA.sent.add(p.id); setTimeout(drawWa, 300); };
  $("#waNext").onclick = () => {
    const ok = waList().ok, picked = ok.filter(p => WA.pick.has(p.id)), next = picked.find(p => !WA.sent.has(p.id)), msg = $("#waNextMsg");
    if(!picked.length){ msg.textContent = "حدّد المستلمين أولاً"; return; }
    if(!next){ msg.textContent = `تم فتح المحادثات لكل المحددين (${picked.length}) ✓`; return; }
    window.open(waLink(next.phone, waText(next)), "_blank", "noopener");
    WA.sent.add(next.id);
    const done = picked.filter(p => WA.sent.has(p.id)).length;
    msg.textContent = `فُتحت محادثة ${fullName(next, 3)} — ${done} من ${picked.length}`;
    drawWa();
  };
  drawWa();
}
function drawWa(){
  const {ok, bad} = waList(), ids = new Set(ok.map(p => p.id));
  WA.pick.forEach(id => { if(!ids.has(id)) WA.pick.delete(id); }); // من خرج من القائمة بالفلترة لا يبقى محدداً
  $("#waBody").innerHTML = (ok.length ? ok.map(p => `<tr class="${WA.pick.has(p.id) ? "picked" : ""}"><td><input type="checkbox" data-pk="${p.id}" ${WA.pick.has(p.id) ? "checked" : ""} aria-label="${esc(fullName(p, 3))}"></td><td class="num">${p.serial}</td><td>${nm(p, fullName(p, 3))}</td><td class="ltr" style="text-align:start">${esc(p.phone)}</td>
      <td style="text-align:end">${WA.sent.has(p.id) ? '<span class="chip">✓ فُتحت</span> ' : ""}<a class="btn small wa" data-wa="${p.id}" href="#" target="_blank" rel="noopener">إرسال</a></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">${WA.src === "sel" ? "لم تحدد أحداً بعد — حدّد الأشخاص من شاشة «البحث والملفات»" : "لا يوجد أحد لديه رقم هاتف صحيح"}</td></tr>`)
    + (bad ? `<tr><td colspan="5" class="muted" style="font-size:13px">${bad} شخص بدون رقم هاتف صالح لم يظهروا في القائمة</td></tr>` : "");
  const n = WA.pick.size, sent = ok.filter(p => WA.pick.has(p.id) && WA.sent.has(p.id)).length;
  $("#waCount").textContent = n ? `محدد ${n} من ${ok.length}${sent ? ` · فُتحت ${sent}` : ""}` : `لم تحدد أحداً بعد (${ok.length} في القائمة)`;
  const all = $("#waAll"); all.checked = ok.length > 0 && n === ok.length; all.indeterminate = n > 0 && n < ok.length;
  $$("#waGroups [data-g]").forEach(b => b.setAttribute("aria-pressed", String(WA.grp === b.dataset.g)));
  $("#waNext").textContent = n && sent >= n ? "تم فتح الكل ✓" : "إرسال للتالي";
}
