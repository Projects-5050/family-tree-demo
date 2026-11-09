/* ===== مركز التقارير (مقابل تقارير Access r01…r28) ===== */
const REP_ARGS = {person:null, gender:"", status:"", gov:"", branch:"", family:"", month:""};

const COLS = {
  serial:["#", p => p.serial], cpr:["الرقم الشخصي", p => p.cpr], name:["الاسم", p => fullName(p, 4)], longname:["الاسم الكامل", p => longName(p)],
  parents:["الأب / الأم", p => parentsText(p)], father:["الأب", p => nameTag(S.byId.get(p.father_id))], mother:["الأم", p => nameTag(S.byId.get(p.mother_id)) || p.mother_name || ""],
  gender:["الجنس", p => p.gender], status:["الحالة", p => p.status], age:["العمر", p => ageOf(p)], birth:["تاريخ الميلاد", p => fmtDate(p.birth_date)],
  birthplace:["مكان الميلاد", p => p.birth_place], gov:["المحافظة", p => p.governorate], area:["المنطقة", p => p.area],
  address:["العنوان", p => [p.house_no && "منزل " + p.house_no, p.flat_no && "شقة " + p.flat_no, p.road_no && "طريق " + p.road_no, p.block_no && "مجمع " + p.block_no].filter(Boolean).join("، ")],
  phone:["الهاتف", p => [p.phone, p.phone2].filter(Boolean).join(" / ")], email:["البريد", p => p.email], branch:["الفرع", p => p.branch], family:["العائلة", p => p.family],
  blood:["فصيلة الدم", p => p.blood], education:["المؤهل", p => p.education], specialization:["التخصص", p => p.specialization], job:["الوظيفة", p => p.job],
  workside:["جهة العمل", p => p.workside], marital:["الحالة الاجتماعية", p => p.marital], aff:["الانتساب", p => p.affiliation], hobby:["الهواية", p => p.hobby],
  death:["تاريخ الوفاة", p => fmtDate(p.death_date)], burial:["مكان الدفن", p => p.burial_place], kids:["الأبناء", p => childrenOf(p).length || ""],
};
function peopleTable(list, cols){
  if(!list.length) return `<p class="muted">لا توجد سجلات</p>`;
  return `<table><thead><tr>${cols.map(c => `<th>${COLS[c][0]}</th>`).join("")}</tr></thead><tbody>${list.map(p => `<tr>${cols.map(c => `<td>${c === "name" || c === "longname" ? nm(p, COLS[c][1](p) ?? "") : esc(COLS[c][1](p) ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function peopleRows(list, cols, extra = {}){ return list.map(p => Object.assign({...extra}, Object.fromEntries(cols.map(c => [COLS[c][0], COLS[c][1](p) ?? ""])))); }
function reportFrame(title, sub, body){
  return `<div class="report"><div class="rh"><div><h1>${esc(title)}</h1>${sub ? `<small>${esc(sub)}</small>` : ""}</div><small>شجرة العائلة · ${esc(fmtDate(todayISO()))}</small></div>${body}<p class="foot">طُبع من شجرة العائلة</p></div>`;
}
function filterNote(F){
  const t = [F.gender, F.status, F.gov, F.area, F.branch && "فرع " + F.branch, F.family && "عائلة " + F.family, F.marital].filter(Boolean);
  return t.length ? "التصفية: " + t.join(" · ") : "كل السجلات";
}
const bySerial = (a, b) => a.serial - b.serial;

/* تقرير مجمّع حسب حقل */
function grouped(field, list, cols, order){
  const groups = new Map();
  list.forEach(p => { const k = p[field] || "غير محدد"; (groups.get(k) || groups.set(k, []).get(k)).push(p); });
  const keys = [...groups.keys()].sort((a, b) => {
    if(a === "غير محدد") return 1; if(b === "غير محدد") return -1;
    const ia = order ? order.indexOf(a) : -1, ib = order ? order.indexOf(b) : -1;
    if(ia >= 0 && ib >= 0) return ia - ib; if(ia >= 0) return -1; if(ib >= 0) return 1;
    return groups.get(b).length - groups.get(a).length || a.localeCompare(b, "ar");
  });
  const summary = `<table style="max-width:520px"><thead><tr><th>${esc(FIELDS[field]?.label || field)}</th><th>العدد</th><th></th></tr></thead><tbody>${keys.map(k => { const n = groups.get(k).length; return `<tr><td>${esc(k)}</td><td>${n}</td><td><span class="bar" style="width:${Math.max(4, Math.round(n / list.length * 160))}px"></span></td></tr>`; }).join("")}</tbody></table>`;
  const html = summary + keys.map(k => `<h2>${esc(k)} (${groups.get(k).length})</h2>${peopleTable(groups.get(k).sort(bySerial), cols)}`).join("");
  const rows = keys.flatMap(k => peopleRows(groups.get(k).sort(bySerial), cols, {[FIELDS[field]?.label || field]: k}));
  return {html, rows};
}
function needPerson(){ return {html:`<p class="muted">اختر شخصاً من الأعلى لعرض التقرير.</p>`, rows:[]}; }
const P = () => S.byId.get(REP_ARGS.person);
const F = () => filterPeople({q:"", gender:REP_ARGS.gender, status:REP_ARGS.status, gov:REP_ARGS.gov, area:"", branch:REP_ARGS.branch, family:REP_ARGS.family, marital:""});

const REPORTS = [
  /* ---- تقارير الفرد ---- */
  {key:"personal_long", grp:"الفرد", t:"الملف الشخصي المطوّل", d:"كل بيانات الفرد مع النسب والزواج والأبناء والصورة", params:["person"],
    async build(){ const p = P(); if(!p) return needPerson(); return {raw:await personReport(p, true), rows:peopleRows([p], Object.keys(COLS))}; }},
  {key:"personal_short", grp:"الفرد", t:"البطاقة الشخصية المختصرة", d:"الاسم والعنوان والبيانات الأساسية", params:["person"],
    async build(){ const p = P(); if(!p) return needPerson(); return {raw:await personReport(p, false), rows:peopleRows([p], ["serial","longname","cpr","birth","age","area","phone"])}; }},

  /* ---- الأسرة والنسب ---- */
  {key:"parents", grp:"الأسرة والنسب", t:"الآباء والأمهات", d:"كل فرد مع اسم أبيه وأمه", params:["filters"],
    build(){ const l = F(); return {html:peopleTable(l, ["serial","name","father","mother"]), rows:peopleRows(l, ["serial","name","father","mother"]), sub:filterNote(REP_ARGS)}; }},
  {key:"siblings", grp:"الأسرة والنسب", t:"الإخوة والأخوات", d:"إخوة شخص محدد، أو كل مجموعات الإخوة", params:["person?"],
    build(){
      const p = P();
      if(p){ const l = siblingsOf(p); return {html:`<p>إخوة وأخوات <b>${nm(p, longName(p))}</b></p>` + `<table><thead><tr><th>#</th><th>الاسم</th><th>القرابة</th><th>العمر</th><th>الحالة</th></tr></thead><tbody>${l.map(x => `<tr><td>${x.serial}</td><td>${nm(x, fullName(x, 4))}</td><td>${isM(x) ? "أخ" : "أخت"} ${siblingKind(p, x)}</td><td>${ageOf(x)}</td><td>${esc(x.status)}</td></tr>`).join("")}</tbody></table>`, rows:peopleRows(l, ["serial","name","gender","age","status"])}; }
      const fathers = S.people.filter(x => isM(x) && childrenOf(x).length > 1).sort(bySerial);
      return {html:fathers.map(f => `<h2>أبناء ${nm(f, fullName(f, 3))} (${childrenOf(f).length})</h2>${peopleTable(childrenOf(f), ["serial","name","gender","birth","age","status"])}`).join("") || '<p class="muted">لا توجد مجموعات إخوة</p>',
        rows:fathers.flatMap(f => peopleRows(childrenOf(f), ["serial","name","gender","birth","age","status"], {"الأب": fullName(f, 3)}))};
    }},
  {key:"children", grp:"الأسرة والنسب", t:"الأبناء", d:"أبناء شخص محدد، أو قائمة الآباء وعدد أبنائهم", params:["person?"],
    build(){
      const p = P();
      if(p){ const l = childrenOf(p); return {html:`<p>أبناء <b>${nm(p, longName(p))}</b> (${l.length})</p>` + peopleTable(l, ["serial","name","mother","gender","birth","age","status","marital"]), rows:peopleRows(l, ["serial","name","mother","gender","birth","age","status"])}; }
      const l = S.people.filter(x => childrenOf(x).length).sort((a, b) => childrenOf(b).length - childrenOf(a).length);
      return {html:`<table><thead><tr><th>#</th><th>الاسم</th><th>الأبناء</th><th>الذكور</th><th>الإناث</th><th>الأحفاد</th></tr></thead><tbody>${l.map(x => { const k = childrenOf(x); return `<tr><td>${x.serial}</td><td>${nm(x, fullName(x, 4))}</td><td>${k.length}</td><td>${k.filter(isM).length}</td><td>${k.filter(y => !isM(y)).length}</td><td>${k.reduce((n, y) => n + childrenOf(y).length, 0)}</td></tr>`; }).join("")}</tbody></table>`,
        rows:l.map(x => ({"#":x.serial, "الاسم":fullName(x, 4), "الأبناء":childrenOf(x).length}))};
    }},
  {key:"grandchildren", grp:"الأسرة والنسب", t:"الأحفاد والذرية", d:"ذرية شخص مقسمة حسب الأجيال", params:["person"],
    build(){ const p = P(); if(!p) return needPerson(); const g = descendantsByGen(p);
      const names = ["الأبناء","الأحفاد","أبناء الأحفاد"];
      return {html:`<p>ذرية <b>${nm(p, longName(p))}</b>: ${g.reduce((n, x) => n + x.length, 0)} فرداً في ${g.length} أجيال</p>` + g.map((x, i) => `<h2>${names[i] || "الجيل " + (i + 1)} (${x.length})</h2>${peopleTable(x, ["serial","name","parents","age","status"])}`).join(""),
        rows:g.flatMap((x, i) => peopleRows(x, ["serial","name","parents","age","status"], {"الجيل": names[i] || i + 1}))}; }},
  {key:"father_line", grp:"الأسرة والنسب", t:"شجرة النسب من جهة الأب", d:"سلسلة الآباء والأجداد صعوداً", params:["person"],
    build(){ const p = P(); if(!p) return needPerson(); return lineReport(p, "father_id", "الأب"); }},
  {key:"mother_line", grp:"الأسرة والنسب", t:"شجرة النسب من جهة الأم", d:"الأم وأبوها وأجدادها", params:["person"],
    build(){ const p = P(); if(!p) return needPerson(); const m = S.byId.get(p.mother_id);
      if(!m) return {html:`<p>الأم ${p.mother_name ? "«" + esc(p.mother_name) + "» غير مسجلة" : "غير محددة"} في البرنامج.</p>`, rows:[]};
      const r = lineReport(m, "father_id", "أب الأم"); r.html = `<p>الأم: <b>${nm(m, longName(m))}</b> (#${m.serial})</p>` + r.html; return r; }},
  {key:"tree", grp:"الأسرة والنسب", t:"شجرة العائلة للطباعة", d:"الشجرة الكاملة لذرية شخص", params:["person?"],
    build(){ const roots = treeRoots().sort((a, b) => descCount(b) - descCount(a)); const p = P() || roots[0]; if(!p) return {html:'<p class="muted">لا توجد شجرة</p>', rows:[]};
      const seen = new Set(), F = treeSet(p);
      const node = (x, viaM) => { if(seen.has(x.id)) return ""; seen.add(x.id); const k = nodeKids(x, F); const fa = viaM && S.byId.get(x.father_id);
        return `<li><b>${esc(x.name1)}</b> <small>(#${x.serial}${fa ? "، ابن" + (isM(x) ? " " : "ة ") + esc(fa.name1) : ""}${isDead(x) ? "، متوفى" : ""})</small>${k.length ? `<ul>${k.map(c => c.ref ? `<li style="color:#7f8b8d">${esc(c.p.name1)} <small>(#${c.p.serial}، تحت أبيه)</small></li>` : node(c.p, !isM(x))).join("")}</ul>` : ""}</li>`; };
      return {html:`<p>ذرية <b>${nm(p, longName(p))}</b> — ${descCount(p)} فرداً</p><div class="tree-p"><ul>${node(p, false)}</ul></div>`, rows:[]}; }},
  {key:"book", grp:"الأسرة والنسب", t:"كتاب العائلة", d:"كل رب أسرة مع زوجاته وأبنائه، جيلاً بعد جيل", params:["filters"],
    build(){
      const heads = F().filter(x => isM(x) && (childrenOf(x).length || spousesOf(x).length));
      const depth = x => lineChain(x).length;
      heads.sort((a, b) => depth(a) - depth(b) || bySerial(a, b));
      let lastD = -1, html = "";
      heads.forEach(h => { const d = depth(h); if(d !== lastD){ html += `<h2>الجيل ${d + 1}</h2>`; lastD = d; }
        const sp = spousesOf(h).map(spouseLabel).filter(Boolean), kids = childrenOf(h);
        html += `<div style="margin:0 0 10px;padding:8px 10px;border:1px solid #dfe6e8;border-radius:6px;break-inside:avoid"><b>${nm(h, longName(h))}</b> <small>#${h.serial}${h.birth_date ? " · مواليد " + h.birth_date.slice(0, 4) : ""}${isDead(h) ? " · متوفى" : ""}</small>
          ${sp.length ? `<div><span style="color:#5d6b6e">الزوجات: </span>${esc(sp.join("، "))}</div>` : ""}
          ${kids.length ? `<div><span style="color:#5d6b6e">الأبناء (${kids.length}): </span>${esc(kids.map(k => k.name1 + (isDead(k) ? " (متوفى)" : "")).join("، "))}</div>` : ""}</div>`; });
      return {html:html || '<p class="muted">لا توجد أسر</p>', sub:filterNote(REP_ARGS),
        rows:heads.map(h => ({"#":h.serial, "رب الأسرة":longName(h), "الجيل":depth(h) + 1, "الزوجات":spousesOf(h).map(spouseLabel).join("، "), "الأبناء":childrenOf(h).map(k => k.name1).join("، ")}))};
    }},
  {key:"inlaws", grp:"الأسرة والنسب", t:"المنتسبون إلى العائلة بالزواج", d:"الأزواج والزوجات من عوائل أخرى، ومن تزوجوا من العائلة", params:[],
    build(){
      const l = S.people.filter(p => p.affiliation === "منتسب بالزواج").sort((a, b) => (a.family || "").localeCompare(b.family || "", "ar") || a.serial - b.serial);
      const inFam = p => spousesOf(p).filter(s => s.person && s.person.affiliation === "من العائلة").map(s => nameTag(s.person));
      const rows = l.map(p => ({"#":p.serial, "الاسم":fullName(p, 4), "عائلته الأصلية":p.family || "", "الجنس":p.gender || "", "متزوج من":inFam(p).join("، "), "الأبناء":childrenOf(p).length || "", "الحالة":p.status}));
      const fams = new Map(); l.forEach(p => fams.set(p.family || "غير محدد", (fams.get(p.family || "غير محدد") || 0) + 1));
      return {html:`<p>${l.length} منتسباً من ${fams.size} عائلات: ${esc([...fams].map(([f, n]) => `${f} (${n})`).join("، "))}</p>` +
        `<table><thead><tr>${Object.keys(rows[0] || {"#":1}).map(k => `<th>${k}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${Object.values(r).map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`, rows};
    }},
  {key:"marriages", grp:"الأسرة والنسب", t:"سجل الزواج", d:"كل الأزواج والزوجات المسجلين", params:[],
    build(){ const rows = S.spouses.map(s => ({p:S.byId.get(s.person_id), s})).filter(x => x.p).sort((a, b) => a.p.serial - b.p.serial || a.s.ord - b.s.ord);
      const r = rows.map(({p, s}) => ({"#":p.serial, "الاسم":fullName(p, 4), "الترتيب":s.ord, "الزوج/الزوجة":S.byId.get(s.spouse_id) ? nameTag(S.byId.get(s.spouse_id)) : s.spouse_name, "مسجل":S.byId.get(s.spouse_id) ? "نعم" : "لا"}));
      return {html:`<table><thead><tr><th>#</th><th>الاسم</th><th>الترتيب</th><th>الزوج / الزوجة</th><th>مسجل في البرنامج</th></tr></thead><tbody>${r.map(x => `<tr>${Object.values(x).map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`, rows:r}; }},

  /* ---- حسب البيانات ---- */
  {key:"filtered", grp:"حسب البيانات", t:"قائمة الأفراد المفلترة", d:"اختر الجنس والحالة والمحافظة والفرع", params:["filters"],
    build(){ const l = F(); const c = ["serial","name","gender","age","status","area","phone"]; return {html:`<p>${l.length} سجل</p>` + peopleTable(l, c), rows:peopleRows(l, c), sub:filterNote(REP_ARGS)}; }},
  {key:"blood", grp:"حسب البيانات", t:"فصائل الدم", d:"للتبرع والطوارئ — مع أرقام الهواتف", params:["filters"],
    build(){ const r = grouped("blood", F().filter(p => !isDead(p)), ["serial","name","age","phone","area"], lk("blood")); r.sub = "الأحياء فقط · " + filterNote(REP_ARGS); return r; }},
  {key:"region", grp:"حسب البيانات", t:"المحافظات والمناطق", d:"توزيع الأفراد حسب السكن", params:["filters"],
    build(){
      const l = F(), govs = new Map();
      l.forEach(p => { const g = p.governorate || govOfArea(p.area) || "غير محدد"; const a = p.area || "غير محدد"; if(!govs.has(g)) govs.set(g, new Map()); const m = govs.get(g); (m.get(a) || m.set(a, []).get(a)).push(p); });
      const order = lk("governorate"), keys = [...govs.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
      let html = "", rows = [];
      keys.forEach(g => { const m = govs.get(g), n = [...m.values()].reduce((s, x) => s + x.length, 0); html += `<h2>${esc(g)} (${n})</h2>`;
        [...m.keys()].sort((a, b) => m.get(b).length - m.get(a).length).forEach(a => { html += `<p style="margin:8px 0 4px"><b>${esc(a)}</b> — ${m.get(a).length}</p>` + peopleTable(m.get(a).sort(bySerial), ["serial","name","address","phone"]);
          rows = rows.concat(peopleRows(m.get(a), ["serial","name","address","phone"], {"المحافظة":g, "المنطقة":a})); }); });
      return {html:html || '<p class="muted">لا توجد بيانات</p>', rows, sub:filterNote(REP_ARGS)};
    }},
  {key:"education", grp:"حسب البيانات", t:"المؤهلات العلمية", d:"الأفراد حسب المؤهل والتخصص", params:["filters"],
    build(){ return grouped("education", F(), ["serial","name","specialization","age"], lk("education")); }},
  {key:"spec", grp:"حسب البيانات", t:"التخصصات", d:"الأفراد حسب التخصص الدقيق", params:["filters"],
    build(){ return grouped("specialization", F(), ["serial","name","education","job"]); }},
  {key:"jobs", grp:"حسب البيانات", t:"الوظائف وجهات العمل", d:"المسمى الوظيفي وجهة العمل", params:["filters"],
    build(){ return grouped("job", F(), ["serial","name","workside","phone"]); }},
  {key:"workside", grp:"حسب البيانات", t:"جهات العمل", d:"الأفراد حسب جهة العمل", params:["filters"],
    build(){ return grouped("workside", F(), ["serial","name","job","phone"]); }},
  {key:"marital", grp:"حسب البيانات", t:"الحالة الاجتماعية", d:"أعزب، متزوج، مطلق، أرمل", params:["filters"],
    build(){ return grouped("marital", F(), ["serial","name","age","gender"], lk("marital")); }},
  {key:"hobby", grp:"حسب البيانات", t:"الهوايات", d:"الأفراد حسب الهواية", params:["filters"],
    build(){ return grouped("hobby", F(), ["serial","name","age","phone"]); }},
  {key:"deceased", grp:"حسب البيانات", t:"المتوفون", d:"تاريخ الوفاة ومكان الدفن والعمر عند الوفاة", params:["filters"],
    build(){ const l = F().filter(isDead).sort((a, b) => (b.death_date || "").localeCompare(a.death_date || "") || bySerial(a, b)); const c = ["serial","longname","death","age","burial"];
      return {html:`<p>${l.length} متوفى (العمر = العمر عند الوفاة)</p>` + peopleTable(l, c), rows:peopleRows(l, c)}; }},
  {key:"notes", grp:"حسب البيانات", t:"الملاحظات", d:"كل السجلات التي فيها ملاحظات", params:["filters"],
    async build(){
      const l = F().filter(p => p.notes);
      if(!l.length) return {html:'<p class="muted">لا توجد ملاحظات</p>', rows:[]};
      const urls = await photoUrls(l);
      return {html:l.map(p => { const u = urls.get(p.photo_path);
        return `<div class="note-card"><div class="note-h">${u ? `<img class="note-ph" src="${esc(u)}" alt="">` : `<span class="note-ph none ${gcls(p)}">${esc((p.name1 || "?").slice(0, 1))}</span>`}<div><b class="note-name">${nm(p, longName(p))}</b><small>#${p.serial}${p.birth_date ? " · مواليد " + esc(fmtDate(p.birth_date)) : ""}${isDead(p) ? " · متوفى" : ""}</small></div></div><p class="note-txt">${esc(p.notes)}</p></div>`; }).join(""),
        rows:l.map(p => ({"#":p.serial, "الاسم":longName(p), "الملاحظات":p.notes}))};
    }},
  {key:"phones", grp:"حسب البيانات", t:"دليل الهواتف", d:"أرقام التواصل للأحياء", params:["filters"],
    build(){ const l = F().filter(p => !isDead(p) && (p.phone || p.phone2 || p.email)).sort((a, b) => a.name1.localeCompare(b.name1, "ar")); const c = ["name","phone","email","area"];
      return {html:peopleTable(l, c), rows:peopleRows(l, c), sub:filterNote(REP_ARGS)}; }},

  /* ---- إحصائيات ---- */
  {key:"demographics", grp:"إحصائيات", t:"الإحصاء السكاني", d:"الأعداد حسب الجنس والعمر والسكن والتعليم", params:["filters"],
    build(){
      const l = F(), alive = l.filter(p => !isDead(p));
      const bands = [["أقل من 10",0,9],["10 – 17",10,17],["18 – 29",18,29],["30 – 44",30,44],["45 – 59",45,59],["60 – 74",60,74],["75 فأكثر",75,200]];
      const tbl = (title, pairs) => { const max = Math.max(1, ...pairs.map(x => x[1])); return `<h2>${title}</h2><table style="max-width:560px"><tbody>${pairs.map(([k, n]) => `<tr><td style="width:40%">${esc(k)}</td><td style="width:60px">${n}</td><td><span class="bar" style="width:${Math.round(n / max * 220)}px"></span></td></tr>`).join("")}</tbody></table>`; };
      const count = (arr, f) => { const m = new Map(); arr.forEach(p => { const k = f(p) || "غير محدد"; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
      const ageKnown = alive.filter(p => ageOf(p) !== "");
      const pairs = {
        "الإجمالي": [["إجمالي الأفراد", l.length], ["على قيد الحياة", alive.length], ["متوفون", l.length - alive.length]],
        "الجنس (الأحياء)": count(alive, p => p.gender),
        "الفئات العمرية (الأحياء ذوو تاريخ ميلاد)": bands.map(([t, a, b]) => [t, ageKnown.filter(p => ageOf(p) >= a && ageOf(p) <= b).length]),
        "المحافظات": count(alive, p => p.governorate || govOfArea(p.area)),
        "الفروع": count(l, p => p.branch), "المؤهلات": count(alive, p => p.education), "الحالة الاجتماعية": count(alive, p => p.marital),
      };
      const avg = ageKnown.length ? Math.round(ageKnown.reduce((s, p) => s + ageOf(p), 0) / ageKnown.length) : "—";
      return {html:`<p>متوسط العمر للأحياء: <b>${avg}</b> سنة · لديهم تاريخ ميلاد: ${ageKnown.length} من ${alive.length}</p>` + Object.entries(pairs).map(([t, p]) => tbl(t, p)).join(""),
        rows:Object.entries(pairs).flatMap(([t, p]) => p.map(([k, n]) => ({"البند":t, "القيمة":k, "العدد":n}))), sub:filterNote(REP_ARGS)};
    }},
  {key:"birthdays", grp:"إحصائيات", t:"أعياد الميلاد", d:"حسب الشهر — للتهنئة والتواصل", params:["month","filters"],
    build(){
      const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      const l = F().filter(p => !isDead(p) && p.birth_date), sel = REP_ARGS.month ? [+REP_ARGS.month] : months.map((_, i) => i + 1);
      let html = "", rows = [];
      sel.forEach(m => { const x = l.filter(p => +p.birth_date.slice(5, 7) === m).sort((a, b) => a.birth_date.slice(8) - b.birth_date.slice(8));
        if(!x.length && !REP_ARGS.month) return;
        html += `<h2>${months[m - 1]} (${x.length})</h2>` + `<table><thead><tr><th>اليوم</th><th>الاسم</th><th>العمر هذا العام</th><th>الهاتف</th></tr></thead><tbody>${x.map(p => `<tr><td>${+p.birth_date.slice(8)}</td><td>${nm(p, fullName(p, 4))}</td><td>${+todayISO().slice(0, 4) - +p.birth_date.slice(0, 4)}</td><td>${esc(p.phone || "")}</td></tr>`).join("")}</tbody></table>`;
        rows = rows.concat(x.map(p => ({"الشهر":months[m - 1], "اليوم":+p.birth_date.slice(8), "الاسم":fullName(p, 4), "الهاتف":p.phone || ""}))); });
      return {html:html || '<p class="muted">لا توجد تواريخ ميلاد مسجلة لهذه الفترة</p>', rows};
    }},
  {key:"ages", grp:"إحصائيات", t:"الأعمار", d:"الأحياء مرتبين من الأكبر سناً", params:["filters"],
    build(){ const l = F().filter(p => !isDead(p) && p.birth_date).sort((a, b) => a.birth_date.localeCompare(b.birth_date)); const c = ["serial","name","birth","age","gender"];
      return {html:peopleTable(l, c), rows:peopleRows(l, c)}; }},
  {key:"missing", grp:"إحصائيات", t:"البيانات الناقصة", d:"سجلات تنقصها بيانات مهمة لاستكمالها", params:["filters"],
    build(){
      const checks = [["الجنس", p => !p.gender], ["تاريخ الميلاد", p => !p.birth_date], ["الأب", p => !p.father_id], ["الأم", p => !p.mother_id && !p.mother_name], ["الرقم الشخصي", p => !p.cpr && !isDead(p)], ["الهاتف", p => !p.phone && !isDead(p)], ["المنطقة", p => !p.area && !isDead(p)]];
      const l = F().map(p => ({p, miss:checks.filter(c => c[1](p)).map(c => c[0])})).filter(x => x.miss.length).sort((a, b) => b.miss.length - a.miss.length || a.p.serial - b.p.serial);
      const summary = `<table style="max-width:420px"><tbody>${checks.map(([t, f]) => `<tr><td>بدون ${t}</td><td>${F().filter(f).length}</td></tr>`).join("")}</tbody></table>`;
      return {html:summary + `<h2>السجلات (${l.length})</h2><table><thead><tr><th>#</th><th>الاسم</th><th>الناقص</th></tr></thead><tbody>${l.map(x => `<tr><td>${x.p.serial}</td><td>${nm(x.p, fullName(x.p, 4))}</td><td>${esc(x.miss.join("، "))}</td></tr>`).join("")}</tbody></table>`,
        rows:l.map(x => ({"#":x.p.serial, "الاسم":fullName(x.p, 4), "الناقص":x.miss.join("، ")}))};
    }},
];
REPORTS.forEach((r, i) => r.no = i + 1);

function lineReport(p, key, word){
  const chain = [p, ...lineChain(p, key)];
  return {html:`<p>سلسلة النسب: <b>${esc(chain.map(x => x.name1).join(" بن "))}${chain.at(-1).family ? " " + esc(chain.at(-1).family) : ""}</b></p>` +
    `<table><thead><tr><th>الدرجة</th><th>#</th><th>الاسم</th><th>الميلاد</th><th>الوفاة</th><th>الأم</th></tr></thead><tbody>${chain.map((x, i) => `<tr><td>${i === 0 ? "الشخص" : i === 1 ? word : "الجد " + (i - 1)}</td><td>${x.serial}</td><td>${nm(x, fullName(x, 3))}</td><td>${fmtDate(x.birth_date)}</td><td>${fmtDate(x.death_date)}</td><td>${esc(nameTag(S.byId.get(x.mother_id)) || x.mother_name || "")}</td></tr>`).join("")}</tbody></table>`,
    rows:chain.map((x, i) => ({"الدرجة":i, "#":x.serial, "الاسم":fullName(x, 3)}))};
}

/* التقرير الشخصي (مختصر / مطوّل) */
async function personReport(p, long){
  const kv = pairs => `<div class="kv">${pairs.filter(x => long || x[1]).map(([k, v]) => `<div><span>${k}:</span><b>${esc(v ?? "")}</b></div>`).join("")}</div>`;
  const url = await photoUrl(p.photo_path);
  const f = S.byId.get(p.father_id), m = S.byId.get(p.mother_id);
  let h = `<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:6px">${url ? `<img class="ph" src="${esc(url)}" alt="">` : ""}<div style="flex:1">
    <div style="font-size:20px;font-weight:700;color:#1c2c47">${nm(p, longName(p))}</div>
    ${kv([["رقم التسلسل", p.serial], ["الرقم الشخصي", p.cpr], ["الفرع", p.branch], ["الكنية", p.nickname]])}</div></div>`;
  h += `<h2>البيانات الأساسية</h2>` + kv([["الجنس", p.gender], ["تاريخ الميلاد", fmtDate(p.birth_date)], ["العمر", ageOf(p) !== "" ? ageOf(p) + " سنة" : ""], ["مكان الميلاد", p.birth_place], ["الحالة", p.status], ...(isDead(p) ? [["تاريخ الوفاة", fmtDate(p.death_date)], ["مكان الدفن", p.burial_place]] : []), ["الحالة الاجتماعية", p.marital], ["فصيلة الدم", p.blood]]);
  h += `<h2>السكن والاتصال</h2>` + kv([["المحافظة", p.governorate], ["المنطقة", p.area], ["العنوان", COLS.address[1](p)], ["الهاتف", p.phone], ["هاتف آخر", p.phone2], ["البريد", p.email]]);
  if(!long) return reportFrame("البطاقة الشخصية", "", h);
  h += `<h2>التعليم والعمل</h2>` + kv([["المؤهل", p.education], ["التخصص", p.specialization], ["الوظيفة", p.job], ["جهة العمل", p.workside], ["الهواية", p.hobby]]);
  const sp = spousesOf(p), kids = childrenOf(p), sib = siblingsOf(p);
  h += `<h2>النسب</h2>` + kv([["الأب", nameTag(f)], ["الأم", nameTag(m) || p.mother_name], ["الجد لأب", nameTag(f && S.byId.get(f.father_id))], ["الجدة لأب", nameTag(f && S.byId.get(f.mother_id))], ["الجد لأم", nameTag(m && S.byId.get(m.father_id))], ["الجدة لأم", nameTag(m && S.byId.get(m.mother_id))]]);
  if(sp.length) h += `<h2>${isM(p) ? "الزوجات" : "الزوج"} (${sp.length})</h2><p style="margin:0">${esc(sp.map(spouseLabel).join("، "))}</p>`;
  if(sib.length) h += `<h2>الإخوة والأخوات (${sib.length})</h2><p style="margin:0">${esc(sib.map(x => x.name1 + " (" + siblingKind(p, x) + ")").join("، "))}</p>`;
  if(kids.length) h += `<h2>الأبناء (${kids.length})</h2>` + peopleTable(kids, ["serial","name","birth","age","status"]);
  if(p.notes) h += `<h2>الملاحظات</h2><p style="white-space:pre-wrap;margin:0">${esc(p.notes)}</p>`;
  return reportFrame("الملف الشخصي", "", h);
}

/* ===== الشاشات ===== */
function renderReports(){
  const groups = [...new Set(REPORTS.map(r => r.grp))];
  $("#view").innerHTML = `<div class="page-h"><h2>التقارير</h2></div>` + groups.map(g => `<div class="sec-h">${g === "الفرد" ? "تقارير الفرد" : g}</div><div class="rep-grid">${REPORTS.filter(r => r.grp === g).map(r => `<a class="rep-item" href="#/report/${r.key}"><span class="no">${r.no}</span><span><b>${r.t}</b><small>${r.d}</small></span></a>`).join("")}</div>`).join("");
}
async function renderReport(key){
  const r = REPORTS.find(x => x.key === key); if(!r){ location.hash = "#/reports"; return; }
  $("#crumb").textContent = r.t;
  const hasP = r.params.some(x => x.startsWith("person")), hasF = r.params.includes("filters"), hasM = r.params.includes("month");
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  if(hasM && REP_ARGS.month === "") REP_ARGS.month = String(+todayISO().slice(5, 7));
  const p = S.byId.get(REP_ARGS.person);
  $("#view").innerHTML = `
    <div class="page-h"><h2>${r.t}</h2><div class="acts">
      <button class="btn primary" type="button" id="rpPrint">طباعة</button>
      <button class="btn" type="button" id="rpXls">تصدير Excel</button>
      <a class="btn" href="#/reports">كل التقارير</a></div></div>
    ${hasP || hasF || hasM ? `<div class="card rep-params">
      ${hasP ? `<div class="field"><label>الشخص${r.params.includes("person?") ? " (اختياري)" : ""}</label><div class="linkf"><button type="button" class="pv ${p ? "" : "empty"}" id="rpPerson">${p ? nm(p, fullName(p, 4)) + ` <small class="muted">#${p.serial}</small>` : "اختر…"}</button>${p ? `<button class="btn small" type="button" id="rpClr" aria-label="إزالة">✕</button>` : ""}</div></div>` : ""}
      ${hasM ? `<div class="field"><label for="rpMonth">الشهر</label><select class="inp" id="rpMonth"><option value="">كل الشهور</option>${months.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === REP_ARGS.month ? "selected" : ""}>${m}</option>`).join("")}</select></div>` : ""}
      ${hasF ? `
        <div class="field"><label for="rpG">الجنس</label><select class="inp" id="rpG" data-a="gender">${opt(["ذكر","أنثى"], REP_ARGS.gender, "الكل")}</select></div>
        <div class="field"><label for="rpS">الحالة</label><select class="inp" id="rpS" data-a="status">${opt(["على قيد الحياة","متوفى"], REP_ARGS.status, "الكل")}</select></div>
        <div class="field"><label for="rpGov">المحافظة</label><select class="inp" id="rpGov" data-a="gov">${opt(lk("governorate"), REP_ARGS.gov, "الكل")}</select></div>
        <div class="field"><label for="rpB">الفرع</label><select class="inp" id="rpB" data-a="branch">${opt(lkUsed("branch"), REP_ARGS.branch, "الكل")}</select></div>
        <div class="field"><label for="rpF">العائلة</label><select class="inp" id="rpF" data-a="family">${opt(lkUsed("family"), REP_ARGS.family, "الكل")}</select></div>` : ""}
    </div>` : ""}
    <div class="rep-paper" id="rpOut"><div class="spin"></div></div>`;
  let out = null;
  const build = async () => {
    try{ out = await r.build(); $("#rpOut").innerHTML = out.raw || reportFrame(r.t, out.sub || (P() && hasP ? "" : ""), out.html); }
    catch(err){ console.error(err); $("#rpOut").innerHTML = `<p class="err">${esc(errMsg(err))}</p>`; }
  };
  $$("[data-a]").forEach(s => s.onchange = () => { REP_ARGS[s.dataset.a] = s.value; build(); });
  if($("#rpMonth")) $("#rpMonth").onchange = e => { REP_ARGS.month = e.target.value; build(); };
  if($("#rpPerson")) $("#rpPerson").onclick = async () => { const x = await pickPerson("اختيار الشخص"); if(x){ REP_ARGS.person = x.id; renderReport(key); } };
  if($("#rpClr")) $("#rpClr").onclick = () => { REP_ARGS.person = null; renderReport(key); };
  $("#rpPrint").onclick = () => printHtml($("#rpOut").innerHTML);
  $("#rpXls").onclick = async () => {
    if(!out?.rows?.length){ toast("لا توجد بيانات جدولية لتصديرها", true); return; }
    try{ await exportXlsx(out.rows, r.t, r.t + "-" + todayISO()); }catch(err){ toast(errMsg(err), true); }
  };
  await build();
}
