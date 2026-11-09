/* ===== تسجيل عضو جديد: نموذج ← ترحيب وشروط ← طلب للإدارة ===== */
const JOIN = {step:1, data:{}};
let TERMS_CACHE = null;

async function loadTerms(){
  if(TERMS_CACHE !== null) return TERMS_CACHE;
  const {data, error} = await db.rpc("f4_get_terms");
  TERMS_CACHE = error ? "" : (data || "");
  return TERMS_CACHE;
}
/* يحوّل نص الشروط إلى فقرات: السطر القصير في أول الفقرة عنوان، والأسطر المرقّمة قائمة */
function termsHtml(txt){
  return String(txt || "").replace(/\r/g, "").split(/\n\s*\n/).map(blk => {
    const L = blk.split("\n").map(x => x.trim()).filter(Boolean); if(!L.length) return "";
    const head = L.length > 1 && L[0].length <= 50 && !/[.،؟!]$/.test(L[0]) ? L.shift() : "";
    const items = L.filter(x => /^\d+[.)-]\s*/.test(x)), plain = L.filter(x => !/^\d+[.)-]\s*/.test(x));
    return `${head ? `<h4>${esc(head)}</h4>` : ""}${plain.map(x => `<p>${esc(x)}</p>`).join("")}${items.length ? `<ol>${items.map(x => `<li>${esc(x.replace(/^\d+[.)-]\s*/, ""))}</li>`).join("")}</ol>` : ""}`;
  }).join("");
}

function openJoin(pre){
  JOIN.step = 1;
  JOIN.data = {email:$("#lEmail").value.trim().toLowerCase(), ...(pre && typeof pre === "object" && !pre.type ? pre : {})};
  const d = $("#dJoin"); drawJoin(); d.showModal();
}
function drawJoin(){
  const b = $("#joinBody"), D = JOIN.data;
  $("#joinSteps").innerHTML = ["بياناتك", "الشروط", "تم الإرسال"].map((t, i) => `<span class="${i + 1 === JOIN.step ? "on" : i + 1 < JOIN.step ? "done" : ""}"><b>${i + 1}</b>${t}</span>`).join("");
  if(JOIN.step === 1){
    b.innerHTML = `
      <p class="muted" style="margin-top:0">سجّل بياناتك، ثم اقرأ شروط البرنامج ووافق عليها ليصل طلبك إلى الإدارة.</p>
      <form id="joinForm" novalidate class="join-form">
        <div class="field req"><label for="jName">الاسم الكامل</label>
          <div class="sr-pick"><input class="inp" id="jName" maxlength="120" autocomplete="off" value="${esc(D.name || "")}" placeholder="اكتب اسمك الأول ثم اسم أبيك…" aria-describedby="jNameHint" aria-autocomplete="list" aria-controls="jNames"><div class="sr-list jn-list" id="jNames" role="listbox" hidden></div></div>
          <div class="sr-chosen" id="jChosen" ${D.person ? "" : "hidden"}>${D.person ? jChosenHtml(D.person) : ""}</div>
          <small class="muted" id="jNameHint">إذا كان اسمك مسجلاً في العائلة يظهر في القائمة — اختره لتحديد أسرتك.</small></div>
        <div class="field req"><label for="jEmail">البريد الإلكتروني</label><input class="inp ltr" id="jEmail" type="email" inputmode="email" autocomplete="username" maxlength="160" value="${esc(D.email || "")}"></div>
        <div class="field req"><label for="jPhone">رقم الهاتف</label><input class="inp ltr" id="jPhone" type="tel" inputmode="tel" maxlength="30" autocomplete="tel" value="${esc(D.phone || "")}" placeholder="3xxxxxxx"></div>
        <div class="field"><label for="jRel">صلتك بالعائلة</label><input class="inp" id="jRel" maxlength="200" value="${esc(D.relation || "")}" placeholder="مثال: ابن عمار احمد علي، أو زوجة فلان"></div>
        <div class="grid2">
          <div class="field req"><label for="jPass">كلمة السر</label><input class="inp ltr" id="jPass" type="password" autocomplete="new-password" minlength="6"></div>
          <div class="field req"><label for="jPass2">تأكيد كلمة السر</label><input class="inp ltr" id="jPass2" type="password" autocomplete="new-password" minlength="6"></div>
        </div>
        <div class="err" id="jErr" role="alert"></div>
        <button class="btn primary block" type="submit">متابعة</button>
      </form>`;
    setTimeout(() => (D.name ? $("#jPass") : $("#jName")).focus(), 30);
    bindJoinNames();
    $("#joinForm").onsubmit = e => {
      e.preventDefault();
      const v = {name:$("#jName").value.trim(), email:$("#jEmail").value.trim().toLowerCase(), phone:$("#jPhone").value.trim(), relation:$("#jRel").value.trim()};
      const p1 = $("#jPass").value, p2 = $("#jPass2").value, err = m => { $("#jErr").textContent = m; };
      if(v.name.split(/\s+/).length < 2) return err("اكتب اسمك الكامل (الاسم واسم الأب على الأقل)");
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return err("اكتب بريداً إلكترونياً صحيحاً");
      if(!/^\+?[\d\s-]{7,}$/.test(v.phone)) return err("اكتب رقم هاتف صحيحاً");
      if(p1.length < 6) return err("كلمة السر 6 أحرف على الأقل");
      if(p1 !== p2) return err("كلمتا السر غير متطابقتين");
      if(JOIN.data.person && norm(v.name) !== norm(JOIN.data.person.full_name)) JOIN.data.person = null;
      Object.assign(JOIN.data, v, {password:p1}); JOIN.step = 2; drawJoin();
    };
  }else if(JOIN.step === 2){
    b.innerHTML = `
      <div class="join-hello"><b>أهلاً بك يا ${esc(D.name.split(/\s+/)[0])}</b><span>يسعدنا انضمامك إلى شجرة العائلة</span></div>
      <div class="terms" id="jTerms" tabindex="0"><div class="spin"></div></div>
      <label class="check join-accept"><input type="checkbox" id="jAgree"> قرأت الشروط والقوانين وأوافق عليها</label>
      <div class="err" id="jErr" role="alert"></div>
      <div class="join-acts"><button class="btn" type="button" id="jBack">رجوع</button><button class="btn primary" type="button" id="jSend" disabled>أوافق وأرسل الطلب</button></div>`;
    loadTerms().then(t => { const el = $("#jTerms"); if(el) el.innerHTML = termsHtml(t) || '<p class="muted">تعذر تحميل الشروط، حاول مرة ثانية.</p>'; });
    $("#jAgree").onchange = e => { $("#jSend").disabled = !e.target.checked; };
    $("#jBack").onclick = () => { JOIN.step = 1; drawJoin(); };
    $("#jSend").onclick = sendJoin;
  }else{
    const st = D.result;
    const reqLink = APP_URL + "#/requests/" + (D.reqId || "");
    const wa = waLink(CONTACT_WA, `السلام عليكم، سجلت طلب انضمام لشجرة العائلة.\nالاسم: ${D.name}\nالبريد: ${D.email}\nالهاتف: ${D.phone}${D.relation ? "\nصلتي بالعائلة: " + D.relation : ""}\n\nرابط الطلب:\n${reqLink}`);
    b.innerHTML = st === "member" ? `
      <div class="join-done"><span class="jd-ic ok">✓</span><b>بريدك مضاف في البرنامج مسبقاً</b><p>ادخل ببريدك وكلمة السر الخاصة بحسابك، وإن نسيتها اطلب كلمة سر جديدة من الإدارة.</p>
      <button class="btn primary block" type="button" id="jClose">الذهاب لتسجيل الدخول</button></div>` : `
      <div class="join-done"><span class="jd-ic">✓</span><b>تم إرسال طلبك إلى الإدارة</b>
      <p>ستراجع الإدارة طلبك وتحدد صلاحياتك. بعد الموافقة تستطيع الدخول ببريدك <b class="ltr">${esc(D.email)}</b> وكلمة السر التي اخترتها.</p>
      <div class="jd-wa"><b>خطوة أخيرة: أرسل طلبك للإدارة عبر واتساب</b><span>اضغط الزر، سيفتح واتساب والرسالة جاهزة، ثم اضغط «إرسال» في واتساب.</span>
      <a class="btn wa block big" id="jWa" href="${esc(wa)}" target="_blank" rel="noopener">إرسال الطلب عبر واتساب</a></div>
      <button class="btn block" type="button" id="jClose">إغلاق</button></div>`;
    $("#jClose").onclick = () => { $("#dJoin").close(); $("#lEmail").value = D.email; $("#lPass").focus(); };
    const jw = $("#jWa"); if(jw) jw.addEventListener("click", () => { jw.textContent = "تم فتح واتساب — اضغط «إرسال» هناك"; });
  }
}
async function sendJoin(){
  const D = JOIN.data, btn = $("#jSend"), err = m => { $("#jErr").textContent = m; };
  btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
  try{
    /* بدون رسائل بريد: كلمة السر تُحفظ مشفّرة، ويُنشأ الحساب عند موافقة الإدارة */
    const {data, error} = await db.rpc("f4_request_join2", {p_name:D.name, p_email:D.email, p_phone:D.phone, p_relation:D.relation || "", p_password:D.password, p_person:D.person ? D.person.id : null});
    if(error) throw error;
    if(data === "busy") throw new Error("طلبات كثيرة الآن، حاول بعد قليل");
    const m = /^created:(\d+)$/.exec(String(data || ""));
    D.reqId = m ? +m[1] : null;
    D.result = m ? "created" : data; D.password = ""; JOIN.step = 3; drawJoin();
  }catch(e){ err(errMsg(e)); btn.disabled = false; btn.textContent = "أوافق وأرسل الطلب"; }
}
/* قائمة الأسماء المسجلة: يكتب العضو اسمه فتظهر كل الأسماء المطابقة مع أسرها، فيختار نفسه */
function jChosenHtml(p){
  return `<span>✓ ${esc(p.full_name)} <small>${p.parent ? (p.gender === "أنثى" ? "بنت " : "ابن ") + esc(p.parent) : ""} · #${p.serial}</small></span><button type="button" class="linkbtn" id="jUnpick">تغيير</button>`;
}
function bindJoinNames(){
  const inp = $("#jName"), L = $("#jNames"), D = JOIN.data;
  let timer = 0, seq = 0, rows = [];
  const close = () => { L.hidden = true; inp.setAttribute("aria-expanded", "false"); };
  const showChosen = () => {
    const c = $("#jChosen");
    if(!D.person){ c.hidden = true; c.innerHTML = ""; return; }
    c.hidden = false; c.innerHTML = jChosenHtml(D.person);
    $("#jUnpick").onclick = () => { D.person = null; showChosen(); inp.focus(); search(); };
  };
  const search = async () => {
    const q = inp.value.trim(), my = ++seq;
    if(norm(q).length < 2){ close(); return; }
    const {data, error} = await db.rpc("f4_join_names", {q});
    if(my !== seq || !$("#jNames")) return;
    rows = error ? [] : (data || []);
    const groups = new Map();
    rows.forEach(r => { const k = r.parent || "—"; (groups.get(k) || groups.set(k, []).get(k)).push(r); });
    L.innerHTML = (rows.length ? `<p class="jn-h">اختر اسمك من القائمة (${rows.length}${rows.length >= 40 ? "+" : ""}):</p>` + rows.map(r => `<button type="button" role="option" data-jid="${r.id}" ${r.taken ? "disabled" : ""}>
        <b>${esc(r.full_name)}</b><small>${r.parent ? (r.gender === "أنثى" ? "بنت " : "ابن ") + esc(r.parent) : "الأسرة غير محددة"} · #${r.serial}${r.taken ? " · لديه حساب مسبقاً" : ""}</small></button>`).join("")
      : `<p class="muted">لا يوجد اسم مطابق في السجل</p>`) +
      `<button type="button" class="jn-none" data-jid="0">اسمي غير موجود في القائمة — متابعة كتسجيل جديد</button>`;
    L.hidden = false; inp.setAttribute("aria-expanded", "true");
  };
  inp.addEventListener("input", () => { if(D.person){ D.person = null; showChosen(); } clearTimeout(timer); timer = setTimeout(search, 250); });
  inp.addEventListener("focus", () => { if(!D.person && inp.value.trim()) search(); });
  inp.addEventListener("keydown", e => { if(e.key === "Escape") close(); });
  L.onclick = e => {
    const b = e.target.closest("[data-jid]"); if(!b || b.disabled) return;
    const id = +b.dataset.jid;
    if(id){ const r = rows.find(x => x.id === id); D.person = r; inp.value = r.full_name; }
    else D.person = null;
    close(); showChosen(); $("#jEmail").focus();
  };
  if(!window._jnDoc){ window._jnDoc = true; document.addEventListener("click", e => { const l = $("#jNames"); if(l && !e.target.closest(".sr-pick")) l.hidden = true; }); }
  if(D.person) showChosen();
}

/* رسالة واضحة عند محاولة الدخول قبل موافقة الإدارة */
async function pendingLoginMessage(email){
  const {data} = await db.rpc("f4_request_status", {p_email:email});
  if(data === "pending") return "طلبك قيد المراجعة لدى الإدارة — ستتمكن من الدخول بعد الموافقة";
  if(data === "rejected") return "لم تتم الموافقة على طلب الانضمام. للاستفسار تواصل مع الإدارة";
  return "";
}

/* ===== شاشة المدير: طلبات الانضمام ===== */
const RQ = {tab:"pending", sel:{}};
async function refreshReqBadge(toastIt = false){
  if(!isAdmin()) return;
  const {count} = await db.from("f4_requests").select("id", {count:"exact", head:true}).eq("status", "pending");
  const b = $("#reqBadge"); if(b){ b.hidden = !count; b.textContent = count || ""; }
  if(toastIt && count){
    let shown = false; try{ shown = sessionStorage.getItem("f4-req-toast") === String(count); sessionStorage.setItem("f4-req-toast", String(count)); }catch(e){}
    if(!shown) toast(count === 1 ? "لديك طلب انضمام جديد بانتظار موافقتك" : `لديك ${count} طلبات انضمام بانتظار موافقتك`);
  }
}
async function renderRequests(focusId){
  const v = $("#view");
  focusId = +focusId || 0;
  if(focusId && !RQ.focusDone){
    const {data:one} = await db.from("f4_requests").select("status").eq("id", focusId).maybeSingle();
    if(one) RQ.tab = one.status;
  }
  v.innerHTML = `<div class="page-h"><h2>طلبات الانضمام</h2><div class="acts"><button class="btn" id="rqTerms">تعديل الشروط والقوانين</button></div></div>
    <div class="ev-tabs" role="tablist">${[["pending","بانتظار الموافقة"],["approved","المقبولة"],["rejected","المرفوضة"]].map(([k, t]) => `<button role="tab" class="ev-tab ${RQ.tab === k ? "on" : ""}" data-t="${k}" aria-selected="${RQ.tab === k}">${t}</button>`).join("")}</div>
    <div id="rqBody"><div class="spin"></div></div>`;
  $$(".ev-tab").forEach(b => b.onclick = () => { RQ.tab = b.dataset.t; RQ.focusDone = true; renderRequests(); });
  $("#rqTerms").onclick = editTerms;
  const {data, error} = await db.from("f4_requests").select("*").eq("status", RQ.tab).order("created_at", {ascending:false});
  if(!$("#rqBody")) return;
  if(error){ $("#rqBody").innerHTML = `<p class="err">${esc(errMsg(error))}</p>`; return; }
  if(!data.length){ $("#rqBody").innerHTML = `<div class="empty card">${RQ.tab === "pending" ? "لا توجد طلبات جديدة" : "لا توجد طلبات"}</div>`; return; }
  const when = t => fmtDate(new Date(t).toLocaleDateString("en-CA", {timeZone:"Asia/Bahrain"}));
  $("#rqBody").innerHTML = data.map(r => {
    const s = RQ.sel[r.id] || (RQ.sel[r.id] = {add:true, edit:true, del:false, family:true, person:r.person_id || null, role:"user"});
    const pp = s.person && S.byId.get(s.person);
    return `<article class="card rq-card" data-id="${r.id}">
      <div class="rq-h"><div><b class="rq-name">${esc(r.full_name)}</b><small>طلب بتاريخ ${when(r.created_at)} · وافق على الشروط</small></div>
        ${r.status !== "pending" ? `<span class="chip ${r.status === "approved" ? "" : "dead"}">${r.status === "approved" ? "مقبول" : "مرفوض"}${r.decided_at ? " · " + when(r.decided_at) : ""}</span>` : ""}</div>
      <dl class="rq-info">
        <div><dt>البريد</dt><dd class="ltr">${esc(r.email)}</dd></div>
        <div><dt>الهاتف</dt><dd class="ltr">${esc(r.phone || "—")}</dd></div>
        <div><dt>صلته بالعائلة</dt><dd>${esc(r.relation || "—")}</dd></div>
        ${r.person_id ? `<div><dt>اختار اسمه من السجل</dt><dd>${S.byId.get(r.person_id) ? nm(S.byId.get(r.person_id), fullName(S.byId.get(r.person_id), 5)) + ` <small class="muted">#${S.byId.get(r.person_id).serial}</small>` : "#" + r.person_id}</dd></div>` : ""}
      </dl>
      ${r.status === "pending" ? `
      <div class="rq-perms">
        <div class="rq-row"><span class="rq-lbl">سجله في العائلة</span><button type="button" class="btn small" data-act="link">${pp ? nm(pp, fullName(pp, 4)) + ` <small class="muted">#${pp.serial}</small>` : "اختيار السجل…"}</button></div>
        <div class="rq-row"><span class="rq-lbl">الصلاحيات</span>
          <label class="check"><input type="checkbox" data-k="role" ${s.role === "admin" ? "checked" : ""}> مدير</label>
          <label class="check"><input type="checkbox" data-k="add" ${s.add ? "checked" : ""} ${s.role === "admin" ? "disabled" : ""}> إضافة</label>
          <label class="check"><input type="checkbox" data-k="edit" ${s.edit ? "checked" : ""} ${s.role === "admin" ? "disabled" : ""}> تعديل</label>
          <label class="check"><input type="checkbox" data-k="del" ${s.del ? "checked" : ""} ${s.role === "admin" ? "disabled" : ""}> حذف</label>
        </div>
        <p class="muted rq-hint">بدون أي صلاحية يكون العضو «مشاهدة فقط». إذا لم تربطه بسجل، سيُطلب منه تسجيل بياناته في سجل العائلة عند أول دخول قبل التصفح.</p>
      </div>
      <div class="rq-acts"><button class="btn primary" type="button" data-act="ok">موافقة وإضافة العضو</button><button class="btn danger" type="button" data-act="no">رفض</button>
        ${r.phone ? `<a class="btn wa" href="${esc(waLink(r.phone, `السلام عليكم ${r.full_name.split(/\s+/)[0]}، بخصوص طلب انضمامك لشجرة العائلة`))}" target="_blank" rel="noopener">واتساب</a>` : ""}</div>` :
      r.status === "approved" && r.phone ? `<div class="rq-acts"><a class="btn wa" href="${esc(waLink(r.phone, `السلام عليكم ${r.full_name.split(/\s+/)[0]}، تمت الموافقة على طلب انضمامك لشجرة العائلة. تستطيع الدخول الآن ببريدك وكلمة السر التي اخترتها:\n${APP_URL}`))}" target="_blank" rel="noopener">إبلاغه بالموافقة عبر واتساب</a></div>` : ""}
    </article>`;
  }).join("");
  if(focusId && !RQ.focusDone){
    RQ.focusDone = true;
    const card = $(`.rq-card[data-id="${focusId}"]`);
    if(card){ card.classList.add("rq-focus"); setTimeout(() => card.scrollIntoView({behavior:"smooth", block:"center"}), 60); }
    else toast("هذا الطلب غير موجود — ربما حُذف", true);
  }
  $("#rqBody").onchange = e => {
    const c = e.target.closest("[data-k]"); if(!c) return;
    const id = +c.closest(".rq-card").dataset.id, s = RQ.sel[id], k = c.dataset.k;
    if(k === "role") s.role = c.checked ? "admin" : "user"; else s[k] = c.checked;
    if(k === "role") renderRequests();
  };
  $("#rqBody").onclick = async e => {
    const b = e.target.closest("[data-act]"); if(!b) return;
    const card = b.closest(".rq-card"), id = +card.dataset.id, s = RQ.sel[id], r = data.find(x => x.id === id);
    if(b.dataset.act === "link"){
      const p = await pickPerson(`سجل ${r.full_name} في العائلة`, {allowNone:true});
      if(p === null) return; s.person = p ? p.id : null; return renderRequests();
    }
    if(b.dataset.act === "no"){
      if(!await ask("رفض الطلب", `رفض طلب انضمام ${r.full_name}؟`, {okText:"رفض", danger:true})) return;
      const {error} = await db.rpc("f4_reject_request", {p_id:id});
      if(error) return toast(errMsg(error), true);
      toast("تم رفض الطلب"); refreshReqBadge(); return renderRequests();
    }
    if(b.dataset.act === "ok"){
      const rights = s.role === "admin" ? "مدير (كل الصلاحيات)" : [s.add && "إضافة", s.edit && "تعديل", s.del && "حذف"].filter(Boolean).join("، ") || "مشاهدة فقط";
      if(!await ask("الموافقة على العضو", `إضافة ${r.full_name} بصلاحية: ${rights}${s.role !== "admin" ? " · يشاهد كل العائلة ويعدّل على نفسه وأسرته" : ""}${!s.person && s.role !== "admin" ? " — وسيُطلب منه تسجيل بياناته عند أول دخول" : ""}؟`, {okText:"موافقة"})) return;
      const {data:res, error} = await db.rpc("f4_approve_request", {p_id:id, p_role:s.role, p_add:s.add, p_edit:s.edit, p_delete:s.del, p_person:s.person, p_family_only:false});
      if(error) return toast(errMsg(error), true);
      toast(res === "no_account" ? "تمت الموافقة — لكن هذا طلب قديم بدون كلمة سر، اطلب منه تسجيل طلب جديد بنفس البريد أو أنشئ له كلمة سر" : "تمت الموافقة وأُضيف العضو، ويستطيع الدخول الآن");
      refreshReqBadge(); RQ.tab = "approved"; renderRequests();
    }
  };
}
async function editTerms(){
  const t = await loadTerms();
  modal("الشروط والقوانين", `<div class="field"><label for="tmTxt">النص الذي يظهر للعضو الجديد قبل إرسال طلبه</label><textarea class="inp" id="tmTxt" rows="16" maxlength="8000">${esc(t)}</textarea></div>
    <p class="muted" style="font-size:13px">اترك سطراً فارغاً بين الأقسام. الأسطر التي تبدأ برقم (1. 2. …) تظهر قائمة مرقّمة.</p>`,
    {foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn primary" type="button" id="tmSave">حفظ</button>`});
  $("#tmSave").onclick = async () => {
    const val = $("#tmTxt").value;
    const {error} = await db.from("f4_settings").upsert([{key:"terms", value:val, updated_at:new Date().toISOString(), updated_by:S.email}], {onConflict:"key"});
    if(error) return toast(errMsg(error), true);
    TERMS_CACHE = val; $("#dModal").close(); toast("تم حفظ الشروط");
  };
}

/* ===== إكمال التسجيل: العضو غير المربوط بسجل يسجّل بياناته قبل التصفح ===== */
const needsSelfRegister = () => !!(S.me && S.me.role !== "admin" && !S.me.person_id);
const SR = {father:null, unknown:false};
function renderSelfRegister(){
  const v = $("#view"), all = (S.treeAll ? S.treeAll.people : S.people);
  const first = (S.me.display_name || "").trim().split(/\s+/)[0] || "";
  const opt = (arr, ph) => `<option value="">${ph}</option>` + arr.map(x => `<option>${esc(x)}</option>`).join("");
  v.innerHTML = `
    <section class="card sr-card">
      <div class="join-hello"><b>أهلاً بك يا ${esc(first || "عضو العائلة")}</b><span>خطوة واحدة قبل التصفح: سجّل بياناتك في سجل العائلة</span></div>
      <p class="muted" style="margin:0">تمت الموافقة على حسابك. اكتب بياناتك واختر والدك من العائلة، وسيُضاف سجلك إلى الشجرة ويُربط بحسابك.</p>
      <form id="srForm" class="join-form" novalidate>
        <div class="grid2">
          <div class="field req"><label for="srName">اسمك الأول</label><input class="inp" id="srName" maxlength="40" value="${esc(first)}"></div>
          <div class="field req"><label for="srGender">الجنس</label><select class="inp" id="srGender"><option value="">اختر</option><option>ذكر</option><option>أنثى</option></select></div>
        </div>
        <div class="field req"><label for="srFq">والدك في العائلة</label>
          <div class="sr-pick"><input class="inp" id="srFq" placeholder="اكتب اسم والدك للبحث" autocomplete="off"><div class="sr-list" id="srList" hidden></div></div>
          <div class="sr-chosen" id="srChosen" hidden></div>
          <label class="check" style="margin-top:6px"><input type="checkbox" id="srUnknown"> والدي غير مسجل في العائلة</label>
        </div>
        <div class="grid2 sr-manual" id="srManual" hidden>
          <div class="field"><label for="srN2">اسم الأب</label><input class="inp" id="srN2" maxlength="40"></div>
          <div class="field"><label for="srN3">اسم الجد</label><input class="inp" id="srN3" maxlength="40"></div>
          <div class="field"><label for="srN4">اسم جد الأب</label><input class="inp" id="srN4" maxlength="40"></div>
          <div class="field"><label for="srFam">العائلة</label><input class="inp" id="srFam" maxlength="40" value=""></div>
        </div>
        <div class="sr-preview" id="srPreview"></div>
        <div class="grid2">
          <div class="field"><label for="srMother">اسم الأم</label><input class="inp" id="srMother" maxlength="80"></div>
          <div class="field"><label for="srBirth">تاريخ الميلاد</label><input class="inp" id="srBirth" type="date"></div>
          <div class="field req"><label for="srPhone">الهاتف</label><input class="inp ltr" id="srPhone" type="tel" maxlength="30"></div>
          <div class="field"><label for="srMarital">الحالة الاجتماعية</label><select class="inp" id="srMarital">${opt(lk("marital"), "اختر")}</select></div>
          <div class="field"><label for="srGov">المحافظة</label><select class="inp" id="srGov">${opt(lk("governorate"), "اختر")}</select></div>
          <div class="field"><label for="srArea">المنطقة</label><select class="inp" id="srArea">${opt([], "اختر المحافظة أولاً")}</select></div>
          <div class="field"><label for="srJob">الوظيفة</label><input class="inp" id="srJob" maxlength="80"></div>
        </div>
        <div class="err" id="srErr" role="alert"></div>
        <button class="btn primary block" type="submit" id="srSave">حفظ بياناتي ومتابعة</button>
        <button class="linkbtn" type="button" id="srOut" style="justify-self:center">تسجيل الخروج</button>
      </form>
    </section>`;
  const fathers = all.filter(p => p.gender === "ذكر");
  const preview = () => {
    const f = SR.father, n1 = $("#srName").value.trim();
    const parts = SR.unknown || !f ? [n1, $("#srN2").value.trim(), $("#srN3").value.trim(), $("#srN4").value.trim(), $("#srFam").value.trim()] : [n1, f.name1, f.name2, f.name3, f.name4, f.family];
    const name = parts.filter(Boolean).join(" ");
    $("#srPreview").innerHTML = name ? `اسمك في السجل: <b>${esc(name)}</b>` : "";
  };
  const drawList = () => {
    const q = norm($("#srFq").value), L = $("#srList");
    if(!q){ L.hidden = true; return; }
    const words = q.split(" ").filter(Boolean);
    const res = fathers.filter(p => words.every(w => norm(longName(p)).split(" ").some(x => x.startsWith(w)))).slice(0, 12);
    L.innerHTML = res.length ? res.map(p => `<button type="button" data-fid="${p.id}">${esc(fullName(p, 5))} <small>#${p.serial}</small></button>`).join("") : `<p class="muted">لا يوجد اسم مطابق — اختر «والدي غير مسجل في العائلة»</p>`;
    L.hidden = false;
  };
  $("#srFq").oninput = drawList;
  $("#srList").onclick = e => {
    const b = e.target.closest("[data-fid]"); if(!b) return;
    SR.father = all.find(p => p.id === +b.dataset.fid); SR.unknown = false; $("#srUnknown").checked = false; $("#srManual").hidden = true;
    $("#srList").hidden = true; $("#srFq").value = "";
    $("#srChosen").hidden = false; $("#srChosen").innerHTML = `<span>${esc(fullName(SR.father, 5))} <small>#${SR.father.serial}</small></span><button type="button" class="linkbtn" id="srClear">تغيير</button>`;
    $("#srClear").onclick = () => { SR.father = null; $("#srChosen").hidden = true; preview(); $("#srFq").focus(); };
    preview();
  };
  $("#srUnknown").onchange = e => { SR.unknown = e.target.checked; $("#srManual").hidden = !SR.unknown; if(SR.unknown){ SR.father = null; $("#srChosen").hidden = true; } preview(); };
  ["#srName", "#srN2", "#srN3", "#srN4", "#srFam"].forEach(s => $(s).addEventListener("input", preview));
  $("#srGov").onchange = e => { $("#srArea").innerHTML = opt(areasOf(e.target.value), "اختر"); };
  $("#srOut").onclick = () => db.auth.signOut();
  $("#srForm").onsubmit = async e => {
    e.preventDefault();
    const err = m => { $("#srErr").textContent = m; };
    const d = {name1:$("#srName").value.trim(), gender:$("#srGender").value, father_id:SR.father ? SR.father.id : "", name2:$("#srN2").value.trim(), name3:$("#srN3").value.trim(), name4:$("#srN4").value.trim(), family:$("#srFam").value.trim(),
      mother_name:$("#srMother").value.trim(), birth_date:$("#srBirth").value, phone:$("#srPhone").value.trim(), marital:$("#srMarital").value, governorate:$("#srGov").value, area:$("#srArea").value, job:$("#srJob").value.trim()};
    if(!d.name1) return err("اكتب اسمك الأول");
    if(!d.gender) return err("اختر الجنس");
    if(!SR.father && !SR.unknown) return err("اختر والدك من العائلة، أو ضع علامة على «والدي غير مسجل في العائلة»");
    if(SR.unknown && !d.name2) return err("اكتب اسم الأب");
    if(!/^\+?[\d\s-]{7,}$/.test(d.phone)) return err("اكتب رقم هاتف صحيحاً");
    const btn = $("#srSave"); btn.disabled = true; btn.textContent = "جارٍ الحفظ…";
    const {data:pid, error} = await db.rpc("f4_self_register", {p:d});
    if(error){ btn.disabled = false; btn.textContent = "حفظ بياناتي ومتابعة"; return err(errMsg(error)); }
    const me = await db.from("f4_users").select("*").eq("email", S.email).maybeSingle();
    if(me.data) S.me = me.data;
    S.mustRegister = false; applyPerms();
    await loadAll();
    toast("تم حفظ بياناتك وإضافتك إلى سجل العائلة");
    if(location.hash === "#/home") route(); else location.hash = "#/home";
  };
}
