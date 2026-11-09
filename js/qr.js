/* ===== الدخول السريع برمز QR ===== */
const QR_LIB = "js/vendor/qrcode.js"; // مكتبة qrcode-generator (MIT) محلية — تعمل بدون إنترنت خارجي
const qrUrl = tok => APP_URL + "#/qr/" + tok;
async function qrLib(){ if(window.qrcode) return; await loadScript(QR_LIB); }
function qrSvg(text, cell = 6){ const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({cellSize:cell, margin:2, scalable:true}); }
function qrDataUrl(text, cell = 8){ const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createDataURL(cell, 2); }
const qrName = u => { const p = u.person_id ? S.byId.get(u.person_id) : null; return p ? fullName(p, 3) : (u.display_name || u.email); };
const qrPhone = u => { const p = u.person_id ? S.byId.get(u.person_id) : null; return p ? (p.phone || p.phone2 || "") : ""; };

/* ---------- الدخول عند فتح رابط الرمز ---------- */
let QR_PENDING = (() => {
  const m = location.hash.match(/^#\/qr\/([A-Za-z0-9_-]{24,64})$/);
  if(!m) return null;
  history.replaceState(null, "", location.pathname + location.search + "#/home"); // لا نُبقي الرمز في شريط العنوان
  return m[1];
})();
async function qrLogin(tok){
  $("#app").hidden = true; $("#vLogin").hidden = false;
  const msg = $("#lErr"); msg.classList.remove("ok"); msg.textContent = "جارٍ الدخول برمز QR…";
  try{
    await db.auth.signOut({scope:"local"}).catch(() => {});
    const {data, error} = await db.functions.invoke("f4-qr-login", {body:{token:tok}});
    if(error || !data?.token_hash){
      let code = data?.error; try{ code = code || (await error?.context?.json())?.error; }catch(e){}
      throw new Error(code === "frozen" ? "frozen" : "invalid");
    }
    QR_PENDING = null;
    const v = await db.auth.verifyOtp({type:"magiclink", token_hash:data.token_hash});
    if(v.error) throw v.error;
    msg.textContent = "";
  }catch(e){
    QR_PENDING = null;
    msg.textContent = e.message === "frozen" ? "هذا الحساب مجمّد — تواصل مع إدارة البرنامج"
      : e.message === "invalid" ? "رمز الدخول غير صالح أو تم إلغاؤه — اطلب رمزاً جديداً من المدير، أو ادخل بالبريد وكلمة السر"
      : "تعذر الدخول بالرمز: " + errMsg(e);
  }
}

/* ---------- بطاقة QR لعضو (للمدير) ---------- */
async function qrCard(u){
  try{ await qrLib(); }catch(e){ return toast("تعذر تحميل مولّد رمز QR — تحقق من الإنترنت", true); }
  const get = async fresh => { const {data, error} = await db.rpc("f4_qr_get", {p_email:u.email, p_new:fresh}); if(error) throw error; return data; };
  let tok; try{ tok = await get(false); }catch(e){ return toast(errMsg(e), true); }
  const info = ((await db.rpc("f4_qr_list")).data || []).find(r => r.email === u.email);
  const draw = () => {
    const link = qrUrl(tok), name = qrName(u), ph = qrPhone(u);
    modal(`رمز الدخول السريع — ${name}`, `
      <div class="qr-card" id="qrCardBox">
        <div class="qr-hd"><img src="img/logo-mark.png" alt="" width="40" height="40"><span><b>شجرة العائلة</b><small>دخول مباشر بدون كلمة سر</small></span></div>
        <div class="qr-code">${qrSvg(link)}</div>
        <b class="qr-name">${esc(name)}</b>
        <small class="qr-hint">امسح الرمز بكاميرا الجوال لتدخل مباشرة</small>
      </div>
      <div class="qr-warn">🔒 هذا الرمز مفتاح شخصي لحساب ${esc(name)}: من يمسحه يدخل بحسابه. أعطه للعضو نفسه فقط، وإذا ضاع اضغط «رمز جديد» فيتوقف القديم فوراً.</div>
      ${info?.last_used_at ? `<p class="muted" style="font-size:13px;margin:6px 0 0">استُخدم ${info.uses} ${info.uses === 1 ? "مرة" : "مرات"} · آخر استخدام ${fmtDate(info.last_used_at.slice(0, 10))}</p>` : `<p class="muted" style="font-size:13px;margin:6px 0 0">لم يُستخدم بعد</p>`}
      <div class="qr-acts">
        <button class="btn" type="button" id="qrDown">تنزيل صورة</button>
        ${ph ? `<a class="btn wa" href="${esc(waLink(ph, `السلام عليكم ${name.split(/\s+/)[0]}، هذا رابط دخولك المباشر لبرنامج شجرة العائلة (لا تشاركه مع أحد):\n${link}`))}" target="_blank" rel="noopener">إرسال عبر واتساب</a>` : ""}
        <button class="btn" type="button" id="qrCopy">نسخ الرابط</button>
        <button class="btn" type="button" id="qrPrint">طباعة</button>
      </div>`,
      {foot:`<button class="btn danger" type="button" id="qrRevoke">إلغاء الرمز</button><button class="btn" type="button" id="qrNew">رمز جديد</button><button class="btn primary" type="button" onclick="this.closest('dialog').close()">إغلاق</button>`});
    $("#qrCopy").onclick = async () => { try{ await navigator.clipboard.writeText(link); toast("نُسخ رابط الدخول"); }catch(e){ toast("تعذر النسخ", true); } };
    $("#qrDown").onclick = () => qrPng(name, link);
    $("#qrPrint").onclick = () => qrPrint([{name, link}]);
    $("#qrNew").onclick = async () => {
      if(!(await ask("رمز جديد", `إنشاء رمز جديد لـ «${name}»؟ الرمز القديم يتوقف فوراً.`, {okText:"إنشاء"}))) return qrCard(u);
      try{ tok = await get(true); toast("أُنشئ رمز جديد ✓"); }catch(e){ toast(errMsg(e), true); } qrCard(u);
    };
    $("#qrRevoke").onclick = async () => {
      if(!(await ask("إلغاء الرمز", `إلغاء رمز الدخول السريع لـ «${name}»؟ يبقى يدخل بالبريد وكلمة السر.`, {okText:"إلغاء الرمز", danger:true}))) return qrCard(u);
      const {error} = await db.rpc("f4_qr_revoke", {p_email:u.email}); toast(error ? errMsg(error) : "أُلغي الرمز", !!error);
    };
  };
  draw();
}
/* صورة PNG للبطاقة */
function qrPng(name, link){
  const img = new Image();
  img.onload = () => {
    const W = 600, H = 760, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    g.fillStyle = "#1c2c47"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#fffdf8"; g.beginPath(); g.roundRect(30, 120, W - 60, H - 150, 28); g.fill();
    g.direction = "rtl"; g.textAlign = "center"; g.fillStyle = "#f1d796"; g.font = "bold 40px Tajawal, sans-serif"; g.fillText("شجرة العائلة", W / 2, 70);
    g.fillStyle = "#d6dcea"; g.font = "22px Tajawal, sans-serif"; g.fillText("دخول مباشر بدون كلمة سر", W / 2, 104);
    g.imageSmoothingEnabled = false; g.drawImage(img, (W - 420) / 2, 150, 420, 420);
    g.fillStyle = "#1a2235"; g.font = "bold 32px Tajawal, sans-serif"; g.fillText(name, W / 2, 630);
    g.fillStyle = "#7c8496"; g.font = "22px Tajawal, sans-serif"; g.fillText("امسح الرمز بكاميرا الجوال", W / 2, 672);
    const a = document.createElement("a"); a.download = `QR-${name}.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  img.src = qrDataUrl(link, 10);
}
/* طباعة بطاقة أو مجموعة بطاقات */
function qrPrint(items){
  const w = window.open("", "_blank");
  if(!w) return toast("اسمح بالنوافذ المنبثقة للطباعة", true);
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقات الدخول السريع</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;800&display=swap" rel="stylesheet">
    <style>body{font-family:Tajawal,sans-serif;margin:0;padding:12mm;color:#1a2235}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
    .c{border:1.5px solid #1c2c47;border-radius:5mm;padding:5mm;text-align:center;break-inside:avoid}.c h4{margin:0;color:#1c2c47;font-size:14pt}
    .c small{display:block;color:#7c8496;font-size:9pt}.c svg{width:42mm;height:42mm;margin:3mm auto;display:block}.c b{font-size:12pt}
    @media print{body{padding:6mm}}</style></head><body><div class="g">${items.map(i => `<div class="c"><h4>شجرة العائلة</h4><small>دخول مباشر بدون كلمة سر</small>${qrSvg(i.link, 4)}<b>${esc(i.name)}</b><small>امسح الرمز بكاميرا الجوال</small></div>`).join("")}</div>
    <script>setTimeout(()=>print(),600)<\/script></body></html>`);
  w.document.close();
}
/* بطاقات لكل الأعضاء */
async function qrAll(users){
  const list = users.filter(u => u.role !== "admin" && !u.frozen);
  if(!list.length) return toast("لا يوجد أعضاء", true);
  if(!(await ask("بطاقات QR لكل الأعضاء", `تجهيز بطاقات دخول سريع لـ ${list.length} عضواً للطباعة؟ من ليس له رمز يُنشأ له رمز جديد، ومن له رمز يبقى كما هو.`, {okText:"تجهيز"}))) return;
  try{ await qrLib(); }catch(e){ return toast("تعذر تحميل مولّد رمز QR — تحقق من الإنترنت", true); }
  const items = [];
  for(const u of list){ const {data, error} = await db.rpc("f4_qr_get", {p_email:u.email, p_new:false}); if(!error && data) items.push({name:qrName(u), link:qrUrl(data)}); }
  qrPrint(items);
}

/* ---------- رمز العضو نفسه (يظهر في ملفه) ---------- */
async function qrMine(){
  try{ await qrLib(); }catch(e){ return toast("تعذر تحميل مولّد رمز QR — تحقق من الإنترنت", true); }
  const get = async fresh => { const {data, error} = await db.rpc("f4_qr_mine", {p_new:fresh}); if(error) throw error; return data; };
  let tok; try{ tok = await get(false); }catch(e){ return toast(errMsg(e), true); }
  const name = qrName(S.me), link = qrUrl(tok);
  modal("رمز دخولك السريع", `
    <div class="qr-card">
      <div class="qr-hd"><img src="img/logo-mark.png" alt="" width="40" height="40"><span><b>شجرة العائلة</b><small>دخول مباشر بدون كلمة سر</small></span></div>
      <div class="qr-code">${qrSvg(link)}</div>
      <b class="qr-name">${esc(name)}</b>
      <small class="qr-hint">امسح الرمز بكاميرا الجوال لتدخل مباشرة</small>
    </div>
    <p class="muted" style="text-align:center;font-size:13.5px;margin:10px 0 0">احفظ الصورة في جوالك أو خذ لقطة شاشة، وامسحها من أي جهاز لتدخل بحسابك مباشرة.</p>
    <div class="qr-warn">🔒 هذا الرمز مفتاح حسابك: لا ترسله لأحد. إذا شاركته بالخطأ اضغط «رمز جديد» فيتوقف القديم فوراً.</div>
    <div class="qr-acts"><button class="btn primary" type="button" id="qrDown">تنزيل صورة</button><button class="btn" type="button" id="qrPrint">طباعة</button></div>`,
    {foot:`<button class="btn" type="button" id="qrNew">رمز جديد</button><button class="btn primary" type="button" onclick="this.closest('dialog').close()">إغلاق</button>`});
  $("#qrDown").onclick = () => qrPng(name, link);
  $("#qrPrint").onclick = () => qrPrint([{name, link}]);
  $("#qrNew").onclick = async () => {
    if(!(await ask("رمز جديد", "إنشاء رمز جديد؟ الرمز القديم وأي صورة محفوظة منه تتوقف فوراً.", {okText:"إنشاء"}))) return qrMine();
    try{ await get(true); toast("أُنشئ رمز جديد ✓ — نزّل الصورة الجديدة"); }catch(e){ toast(errMsg(e), true); } qrMine();
  };
}
/* بطاقة QR صغيرة داخل ملف الشخص: لصاحب الملف نفسه، وللمدير إن كان الملف مربوطاً بحساب عضو */
async function qrRecordButton(p){
  const box = $("#rQrSlot"); if(!box || !p) return;
  let tok = null, open = null, name = "", title = "";
  try{
    if(!isAdmin() && S.me.person_id === p.id){
      await qrLib(); const r = await db.rpc("f4_qr_mine", {p_new:false}); if(r.error) return; tok = r.data; open = qrMine; name = qrName(S.me); title = "رمز دخولك السريع";
    }else if(isAdmin()){
      const {data} = await db.from("f4_users").select("*").eq("person_id", p.id).order("created_at");
      if((data || []).some(x => x.role === "admin") && !(data || []).some(x => x.role !== "admin")) return; // ملف مدير
      const u = (data || []).find(x => x.role !== "admin");
      if(!u){ // لا يوجد حساب: نعرض إنشاء رمز دخول للفرد
        if(isDead(p) || !$("#rQrSlot")) return;
        box.innerHTML = `<span class="rq-code rq-empty" aria-hidden="true">▦</span><div class="rq-tx"><b>رمز الدخول السريع</b><small>لا يوجد حساب دخول لهذا الفرد بعد</small>
          <span class="rq-acts"><button class="btn small primary" type="button" id="rQrMake">إنشاء رمز دخول</button></span></div>`;
        box.hidden = false;
        $("#rQrMake").onclick = async () => {
          if(!(await ask("إنشاء رمز دخول", `إنشاء حساب ورمز دخول سريع لـ «${fullName(p, 3)}»؟ يدخل بالرمز مباشرة بدون بريد ولا كلمة سر، بصلاحية إضافة وتعديل (بدون حذف)، ويشاهد كل العائلة ويعدّل على نفسه وأسرته فقط. تستطيع تغيير صلاحياته أو تجميده من صفحة المستخدمين.`, {okText:"إنشاء"}))) return;
          const {error} = await db.rpc("f4_qr_for_person", {p_person:p.id});
          if(error) return toast(errMsg(error), true);
          toast("أُنشئ رمز الدخول ✓"); qrRecordButton(p);
        };
        return;
      }
      await qrLib(); const r = await db.rpc("f4_qr_get", {p_email:u.email, p_new:false}); if(r.error) return; tok = r.data; open = () => qrCard(u); name = qrName(u); title = "رمز الدخول السريع";
    }else return;
  }catch(e){ return; }
  if(!tok || !$("#rQrSlot")) return;
  const link = qrUrl(tok);
  box.innerHTML = `<button type="button" class="rq-code" id="rQrBig" title="تكبير الرمز">${qrSvg(link, 4)}</button>
    <div class="rq-tx"><b>${title}</b><small>امسحه بكاميرا الجوال للدخول مباشرة</small>
      <span class="rq-acts"><button class="btn small" type="button" id="rQrDown">تنزيل صورة</button><button class="btn small" type="button" id="rQrMore">المزيد</button></span></div>`;
  box.hidden = false;
  $("#rQrDown").onclick = () => qrPng(name, link);
  $("#rQrBig").onclick = open; $("#rQrMore").onclick = open;
}
