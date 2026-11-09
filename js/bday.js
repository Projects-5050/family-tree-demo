/* ===== تهاني أعياد الميلاد — تنبيه للمديرين قبل عدد أيام يختارونه، والتهنئة يرسلها المدير بنفسه من واتساب ===== */
const BD = {msg:null, greets:[], days:1};
/* خيارات مدة التنبيه المسبق (بالأيام) */
const BD_DAY_OPTS = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30];
const bdDaysLabel = n => n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`;
/* التهنئة تُرسل دائماً باسم العائلة — لا باسم المدير المرسل */
const BD_SIGN = "عن عائلة المرجان ومنتسبيها";
const BD_DEFAULT = "كل عام وأنت بخير يا {الاسم} 🎂\nبمناسبة عيد ميلادك، نتمنى لك عاماً مليئاً بالصحة والسعادة والتوفيق.\n{المرسل}";

function bdAddDays(iso, n){ const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const bdLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/* هل يوافق عيد ميلاد الشخص هذا التاريخ؟ (مواليد 29 فبراير يُحتفل بهم 28 فبراير في السنوات غير الكبيسة) */
function bdOn(p, iso){
  if(!p.birth_date) return false;
  const md = p.birth_date.slice(5, 10), y = +iso.slice(0, 4);
  return md === iso.slice(5, 10) || (md === "02-29" && !bdLeap(y) && iso.slice(5, 10) === "02-28");
}
function bdPeople(iso){
  const all = S.full ? S.full.people : S.people;
  return all.filter(p => !isDead(p) && bdOn(p, iso)).sort((a, b) => a.serial - b.serial);
}
const bdAge = (p, iso) => +iso.slice(0, 4) - +p.birth_date.slice(0, 4);

async function bdLoad(){
  const y = +todayISO().slice(0, 4);
  const [st, gr, dd] = await Promise.all([
    db.from("f4_settings").select("value").eq("key", "bday_msg").maybeSingle(),
    db.from("f4_bday_greets").select("*").in("year", [y, y + 1]),
    db.from("f4_settings").select("value").eq("key", "bday_days").maybeSingle(),
  ]);
  BD.msg = st.data?.value || BD_DEFAULT;
  const nd = parseInt(dd.data?.value, 10); BD.days = BD_DAY_OPTS.includes(nd) ? nd : 1;
  BD.greets = gr.data || [];
}
function bdText(p){
  let t = BD.msg.replace(/\{الاسم\}/g, p.name1 || "");
  t = /\{المرسل\}/.test(t) ? t.replace(/\{المرسل\}/g, BD_SIGN) : (t.includes(BD_SIGN) ? t : t.trim() + "\n" + BD_SIGN);
  return t.trim();
}
/* أعياد الميلاد القادمة خلال مدة التنبيه: [{iso, n, people}] */
function bdUpcoming(){
  const t = todayISO(), out = [];
  for(let n = 1; n <= BD.days; n++){ const iso = bdAddDays(t, n), people = bdPeople(iso); if(people.length) out.push({iso, n, people}); }
  return out;
}
const bdWhen = n => n === 1 ? "غداً" : n === 2 ? "بعد يومين" : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يوماً`;
function bdSentBy(p, iso){ return BD.greets.filter(g => g.person_id === p.id && g.year === +iso.slice(0, 4)); }

/* البطاقة في الرئيسية — للمدير فقط */
function bdayCardHtml(){ return isAdmin() ? `<section class="bday-card" id="bdayCard" aria-label="أعياد الميلاد"><div class="spin"></div></section>` : ""; }
async function fillBdayCard(){
  const box = $("#bdayCard"); if(!box) return;
  try{ await bdLoad(); }catch(e){}
  if(!$("#bdayCard")) return;
  const t = todayISO(), today = bdPeople(t), up = bdUpcoming();
  const row = (p, iso) => {
    const sent = bdSentBy(p, iso), mine = sent.some(g => g.sent_by === S.email);
    const wa = waLink(p.phone || p.phone2, bdText(p));
    return `<div class="bd-row" data-bp="${p.id}" data-iso="${iso}">
      ${avatar(p, "sm")}
      <div class="bd-who"><b>${nm(p, fullName(p, 4))}</b><small>#${p.serial} · يكمل ${bdAge(p, iso)} سنة${p.phone || p.phone2 ? "" : " · لا يوجد رقم هاتف"}</small></div>
      <div class="bd-acts">
        ${wa ? `<a class="btn small wa" href="${esc(wa)}" target="_blank" rel="noopener" data-bsend>${mine ? "إرسال مرة أخرى" : "إرسال التهنئة"}</a>` : `<button class="btn small" type="button" data-bcopy>نسخ الرسالة</button>`}
        ${mine ? `<button class="btn small" type="button" data-bundo>إلغاء «تم»</button>` : `<button class="btn small" type="button" data-bdone>تم الإرسال</button>`}
        <a class="btn small" href="#/rec/${p.id}">الملف</a>
      </div>
      <div class="bd-sent">${sent.length ? sent.map(g => `<span class="ok">✓ أرسلها ${esc(g.sent_by_name || g.sent_by)}</span>`).join(" · ") : "لم تُرسل التهنئة بعد"}</div>
    </div>`;
  };
  box.innerHTML = `
    <div class="bd-h"><h3><span class="bd-ic" aria-hidden="true">🎂</span>أعياد الميلاد</h3>
      <div class="bd-acts">
        <label class="bd-days" for="bdDays">التنبيه قبل
          <select class="inp" id="bdDays">${BD_DAY_OPTS.map(n => `<option value="${n}" ${n === BD.days ? "selected" : ""}>${bdDaysLabel(n)}</option>`).join("")}</select></label>
        <button class="btn small" type="button" id="bdEdit">تعديل نص التهنئة</button><a class="btn small" href="#/report/birthdays">كل أعياد الشهر</a></div></div>
    ${up.length ? up.map(g => `<div class="bd-sec">${bdWhen(g.n)} · ${fmtDate(g.iso)} — تنبيه مسبق لترسل تهنئتك</div>${g.people.map(p => row(p, g.iso)).join("")}`).join("")
      : `<div class="empty">لا توجد أعياد ميلاد ${BD.days === 1 ? "غداً" : "خلال " + bdDaysLabel(BD.days) + " القادمة"}</div>`}
    ${today.length ? `<div class="bd-sec">اليوم · ${fmtDate(t)}</div>${today.map(p => row(p, t)).join("")}` : ""}`;
  $("#bdEdit").onclick = bdEditMsg;
  $("#bdDays").onchange = async e => {
    const n = +e.target.value;
    const {error} = await db.from("f4_settings").upsert([{key:"bday_days", value:String(n), updated_at:new Date().toISOString(), updated_by:S.email}], {onConflict:"key"});
    if(error){ toast(errMsg(error), true); e.target.value = BD.days; return; }
    BD.days = n; toast(`سيصلك التنبيه قبل ${bdDaysLabel(n)} من عيد الميلاد`); fillBdayCard(); bdBadge();
  };
  box.onclick = async e => {
    const r = e.target.closest(".bd-row"); if(!r) return;
    const p = S.byId.get(+r.dataset.bp) || (S.full?.people || []).find(x => x.id === +r.dataset.bp), iso = r.dataset.iso;
    if(e.target.closest("[data-bsend]") || e.target.closest("[data-bdone]")){
      await bdMark(p, iso, true);
      if(e.target.closest("[data-bdone]")) fillBdayCard(); else setTimeout(fillBdayCard, 400);
    }else if(e.target.closest("[data-bundo]")){ await bdMark(p, iso, false); fillBdayCard(); }
    else if(e.target.closest("[data-bcopy]")){
      try{ await navigator.clipboard.writeText(bdText(p)); toast("تم نسخ الرسالة"); }catch(err){ toast("تعذر النسخ", true); }
    }
  };
}
async function bdMark(p, iso, on){
  const y = +iso.slice(0, 4);
  const {error} = on
    ? await db.from("f4_bday_greets").upsert([{person_id:p.id, year:y, sent_by:S.email, sent_by_name:S.me?.display_name || null}], {onConflict:"person_id,year,sent_by", ignoreDuplicates:true})
    : await db.from("f4_bday_greets").delete().match({person_id:p.id, year:y, sent_by:S.email});
  if(error) toast(errMsg(error), true);
  bdBadge();
}
function bdEditMsg(){
  modal("نص تهنئة عيد الميلاد", `<div class="field"><label for="bdTxt">الرسالة التي تُفتح في واتساب عند الضغط على «إرسال التهنئة»</label>
    <textarea class="inp" id="bdTxt" rows="7" maxlength="1500">${esc(BD.msg || BD_DEFAULT)}</textarea></div>
    <p class="muted" style="font-size:13px;margin:0">اكتب <b>{الاسم}</b> ليُستبدل باسم صاحب عيد الميلاد، و<b>{المرسل}</b> ليُستبدل بـ«${BD_SIGN}». التهنئة تُرسل دائماً باسم العائلة لا باسم المدير. النص مشترك بين المديرين، وتستطيع تعديل الرسالة في واتساب قبل الإرسال.</p>`,
    {foot:`<button class="btn" type="button" onclick="this.closest('dialog').close()">إلغاء</button><button class="btn primary" type="button" id="bdSave">حفظ</button>`});
  $("#bdSave").onclick = async () => {
    const val = $("#bdTxt").value.trim() || BD_DEFAULT;
    const {error} = await db.from("f4_settings").upsert([{key:"bday_msg", value:val, updated_at:new Date().toISOString(), updated_by:S.email}], {onConflict:"key"});
    if(error) return toast(errMsg(error), true);
    BD.msg = val; $("#dModal").close(); toast("تم حفظ نص التهنئة"); fillBdayCard();
  };
}

/* تنبيه عند الدخول + شارة في القائمة: أعياد الميلاد القادمة (خلال مدة التنبيه) التي لم يرسل لها المدير تهنئته */
async function bdBadge(toastIt = false){
  if(!isAdmin()) return;
  try{ if(BD.msg === null) await bdLoad(); }catch(e){ return; }
  const pend = []; bdUpcoming().forEach(g => g.people.forEach(p => { if(!bdSentBy(p, g.iso).some(x => x.sent_by === S.email)) pend.push({p, n:g.n}); }));
  const pending = pend.map(x => x.p), tm = bdAddDays(todayISO(), 1);
  const b = $("#bdBadge"); if(b){ b.hidden = !pending.length; b.textContent = pending.length || ""; }
  if(toastIt && pending.length){
    const k = "f4-bd-toast-" + tm; let shown = false;
    try{ shown = !!sessionStorage.getItem(k); sessionStorage.setItem(k, "1"); }catch(e){}
    if(!shown) setTimeout(() => toast(pending.length === 1 ? `🎂 ${bdWhen(pend[0].n)} عيد ميلاد ${fullName(pending[0], 3)} — أرسل تهنئتك من الرئيسية` : `🎂 ${pending.length} أعياد ميلاد ${BD.days === 1 ? "غداً" : "خلال " + bdDaysLabel(BD.days) + " القادمة"} — أرسل تهانيك من الرئيسية`), 1200);
  }
}
