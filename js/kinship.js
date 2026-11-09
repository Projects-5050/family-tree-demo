/* ===== قرابة العوائل: المصاهرة بين العوائل وحاسبة القرابة بين شخصين ===== */
const KIN = {a:null, b:null, open:null};
const famOf = p => (p && (p.family || "").trim()) || "بدون عائلة";

/* الروابط بين العوائل: زيجات مسجلة + أبناء أبوهم من عائلة وأمهم من أخرى */
function familyLinks(){
  const fams = new Map();
  S.people.forEach(p => { const f = famOf(p); fams.set(f, (fams.get(f) || 0) + 1); });
  const pairs = new Map(), key = (x, y) => [x, y].sort((a, b) => a.localeCompare(b, "ar")).join("|");
  const touch = (x, y) => { const k = key(x, y); if(!pairs.has(k)) pairs.set(k, {a:k.split("|")[0], b:k.split("|")[1], marriages:0, kids:0, couples:new Map()}); return pairs.get(k); };
  const coupleKey = (h, w) => h.id + "-" + w.id;
  const addCouple = (pr, h, w) => { const ck = coupleKey(h, w); if(!pr.couples.has(ck)) pr.couples.set(ck, {h, w, kids:0}); return pr.couples.get(ck); };
  const seen = new Set();
  S.spouses.forEach(s => {
    const a = S.byId.get(s.person_id), b = S.byId.get(s.spouse_id); if(!a || !b) return;
    const h = isM(a) ? a : b, w = h === a ? b : a, ck = coupleKey(h, w);
    if(seen.has(ck)) return; seen.add(ck);
    const pr = touch(famOf(h), famOf(w)); pr.marriages++; addCouple(pr, h, w);
  });
  S.people.forEach(k => {
    const f = S.byId.get(k.father_id), m = S.byId.get(k.mother_id); if(!f || !m) return;
    const pr = touch(famOf(f), famOf(m)); pr.kids++;
    const c = addCouple(pr, f, m); c.kids++;
    if(!seen.has(coupleKey(f, m))){ seen.add(coupleKey(f, m)); pr.marriages++; }
  });
  const list = [...pairs.values()].map(p => ({...p, score:p.marriages * 2 + p.kids, couples:[...p.couples.values()]}));
  return {fams:[...fams.entries()].sort((x, y) => y[1] - x[1]), pairs:list};
}
const strength = s => s >= 10 ? ["قوية جداً", "s4"] : s >= 5 ? ["قوية", "s3"] : s >= 3 ? ["متوسطة", "s2"] : ["بسيطة", "s1"];

/* خريطة الترتيب: أشرطة لكل عائلة حسب قوة رابطها مع العائلة الأكبر */
function kinMapSvg(fams, pairs){
  const between = pairs.filter(p => p.a !== p.b);
  const linked = new Set(between.flatMap(p => [p.a, p.b]));
  const nodes = fams.filter(([f]) => linked.has(f) && f !== "بدون عائلة");
  if(!nodes.length) return `<p class="muted">لا توجد روابط مسجلة بين عوائل مختلفة بعد.</p>`;
  const [hub, hubN] = nodes[0];
  const rest = nodes.slice(1).map(([f, c]) => {
    const d = between.find(p => (p.a === hub && p.b === f) || (p.b === hub && p.a === f));
    return {f, c, s:d ? d.score : 0, m:d ? d.marriages : 0, k:d ? d.kids : 0};
  }).sort((x, y) => y.s - x.s || y.c - x.c);
  const maxS = Math.max(1, ...rest.map(x => x.s));
  return `<div class="kb-hub km-node main" data-fam="${esc(hub)}" tabindex="0" role="button"><b>${esc(hub)}</b><span>${hubN} فرداً · مرتبطة بـ ${rest.filter(x => x.s).length} عائلة</span></div>
    <div class="kb-list">${rest.map((x, i) => `
      <div class="kb-row km-node" data-fam="${esc(x.f)}" tabindex="0" role="button" style="--i:${i}" aria-label="${esc(x.f)}: قوة ${x.s}">
        <span class="kb-name">${esc(x.f)}</span>
        <span class="kb-track"><i style="width:${x.s ? Math.max(4, 100 * x.s / maxS).toFixed(0) : 0}%"></i></span>
        <span class="kb-score">${x.s || "—"}</span>
        <small class="kb-meta">${x.s ? `${x.m} زواج · ${x.k} من الأبناء` : "مرتبطة بعوائل أخرى"} · ${x.c === 1 ? "فرد واحد" : x.c === 2 ? "فردان" : `${x.c} ${x.c < 11 ? "أفراد" : "فرداً"}`}</small>
      </div>`).join("")}</div>`;
}

function renderKinship(){
  PAGE_STEPS = [];
  const {fams, pairs} = familyLinks();
  const cross = pairs.filter(p => p.a !== p.b).sort((x, y) => y.score - x.score);
  const internal = pairs.find(p => p.a === p.b && p.a === (fams[0] || [])[0]);
  const maxS = Math.max(1, ...cross.map(p => p.score));
  $("#view").innerHTML = `
    <div class="page-h"><h2>قرابة العوائل</h2></div>
    <p class="muted" style="margin-top:-6px">كيف ترتبط العوائل المسجلة ببعضها: بالزواج، وبالأبناء الذين أبوهم من عائلة وأمهم من أخرى. قوة الرابط = الزيجات × 2 + الأبناء المشتركون.</p>
    <div class="kin-sum">
      <div><b>${fams.length}</b><span>عائلة مسجلة</span></div>
      <div><b>${cross.length}</b><span>رابط بين عائلتين</span></div>
      <div><b>${cross.reduce((n, p) => n + p.marriages, 0)}</b><span>زواج بين عوائل مختلفة</span></div>
      <div><b>${cross.reduce((n, p) => n + p.kids, 0)}</b><span>من الأبناء يجمعون عائلتين</span></div>
    </div>
    <section class="card"><h3 class="kin-h">ترتيب العوائل حسب القرابة</h3>${kinMapSvg(fams, pairs)}
      <p class="muted kin-note">طول الشريط والرقم = قوة الرابط مع العائلة الأكبر. اضغط على عائلة لعرض روابطها.</p></section>
    <section class="card"><h3 class="kin-h">ترتيب الروابط بين العوائل</h3>
      <div class="kin-filter" id="kinFilter"></div>
      <div class="kin-list" id="kinList">${cross.length ? cross.map((p, i) => { const [lbl, cls] = strength(p.score); return `
        <div class="kin-row" data-a="${esc(p.a)}" data-b="${esc(p.b)}">
          <button type="button" class="kin-head" data-i="${i}" aria-expanded="false">
            <span class="kin-fams"><b>${esc(p.a)}</b><span class="kin-x">↔</span><b>${esc(p.b)}</b></span>
            <span class="kin-bar"><i style="width:${(100 * p.score / maxS).toFixed(0)}%"></i></span>
            <span class="kin-meta">${p.marriages} زواج · ${p.kids} من الأبناء</span>
            <span class="kin-tag ${cls}">${lbl}</span>
          </button>
          <div class="kin-detail" hidden>${p.couples.map(c => `<div class="kin-couple"><span>${nm(c.h, fullName(c.h, 3))}</span><span class="kin-amp">و</span><span>${nm(c.w, fullName(c.w, 3))}</span>${c.kids ? `<small>${c.kids} من الأبناء</small>` : ""}</div>`).join("")}</div>
        </div>`; }).join("") : `<p class="muted">لا توجد روابط بين عوائل مختلفة بعد.</p>`}</div>
      ${internal ? `<p class="muted kin-note">داخل عائلة ${esc(internal.a)} نفسها: ${internal.marriages} زواج و${internal.kids} من الأبناء.</p>` : ""}
    </section>
    <section class="card"><h3 class="kin-h">حاسبة القرابة بين شخصين</h3>
      <div class="kin-calc">
        <button type="button" class="pv kin-pick" id="kinA">${KIN.a ? nm(KIN.a, fullName(KIN.a, 4)) : "اختر الشخص الأول…"}</button>
        <span class="kin-x">↔</span>
        <button type="button" class="pv kin-pick" id="kinB">${KIN.b ? nm(KIN.b, fullName(KIN.b, 4)) : "اختر الشخص الثاني…"}</button>
      </div>
      <div id="kinOut">${KIN.a && KIN.b ? kinResultHtml(KIN.a, KIN.b) : '<p class="muted">اختر شخصين لمعرفة صلة القرابة بينهما والجد المشترك.</p>'}</div>
    </section>`;
  const famsWithLinks = [...new Set(cross.flatMap(p => [p.a, p.b]))];
  $("#kinFilter").innerHTML = `<button type="button" class="chipbtn on" data-f="">الكل</button>` + famsWithLinks.map(f => `<button type="button" class="chipbtn" data-f="${esc(f)}">${esc(f)}</button>`).join("");
  let curF = "";
  const filter = (f, undoing) => {
    if(f === curF) return;
    if(!undoing){ const was = curF; pageStep(() => filter(was, true)); }
    curF = f;
    $$("#kinFilter .chipbtn").forEach(b => b.classList.toggle("on", b.dataset.f === f));
    $$(".kin-row").forEach(r => { r.hidden = !!f && r.dataset.a !== f && r.dataset.b !== f; });
    $$(".km-node").forEach(n => n.classList.toggle("dim", !!f && n.dataset.fam !== f && !cross.some(p => (p.a === f && p.b === n.dataset.fam) || (p.b === f && p.a === n.dataset.fam))));
  };
  $("#kinFilter").onclick = e => { const b = e.target.closest("[data-f]"); if(b) filter(b.dataset.f); };
  $$(".km-node").forEach(n => { const go = () => { filter(n.dataset.fam); $("#kinList").scrollIntoView({behavior:"smooth", block:"start"}); }; n.onclick = go; n.onkeydown = e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); go(); } }; });
  $("#kinList").onclick = e => { const h = e.target.closest(".kin-head"); if(!h) return; const d = h.nextElementSibling, o = d.hidden; d.hidden = !o; h.setAttribute("aria-expanded", String(o)); };
  const pick = async which => { const p = await pickPerson(which === "a" ? "الشخص الأول" : "الشخص الثاني"); if(!p) return; KIN[which] = p; renderKinship(); setTimeout(() => $("#kinOut").scrollIntoView({behavior:"smooth", block:"center"}), 50); };
  $("#kinA").onclick = () => pick("a"); $("#kinB").onclick = () => pick("b");
}

/* ---------- حاسبة القرابة ---------- */
function ancestorsMap(p){
  const m = new Map(); const q = [[p, 0, []]];
  while(q.length){ const [x, d, path] = q.shift(); if(!x || m.has(x.id)) continue; m.set(x.id, {d, path:[...path, x]});
    [x.father_id, x.mother_id].forEach(id => { const y = S.byId.get(id); if(y && d < 14) q.push([y, d + 1, [...path, x]]); }); }
  return m;
}
function relationLabel(A, B, dA, dB, pathA, pathB){
  const f = B.gender === "أنثى";
  const g = (m, w) => f ? w : m;
  const aParent = pathA[1], bParent = pathB[pathB.length - 2]; // أب/أم A في الطريق، وأب/أم B
  const viaFather = aParent && aParent.id === A.father_id;
  if(dA === 0 && dB === 0) return "الشخص نفسه";
  if(dA === 0) return [null, g("ابن", "ابنة"), g("حفيد", "حفيدة"), g("ابن الحفيد", "ابنة الحفيد")][dB] || `من ذريته في الجيل ${dB}`;
  if(dB === 0) return [null, g("أب", "أم"), g("جد", "جدة"), g("جد الأب أو الأم", "جدة الأب أو الأم")][dA] || `جد أعلى (قبل ${dA} أجيال)`;
  if(dA === 1 && dB === 1){
    const full = A.father_id && A.father_id === B.father_id && A.mother_id && A.mother_id === B.mother_id;
    return full ? g("أخ شقيق", "أخت شقيقة") : (A.father_id && A.father_id === B.father_id ? g("أخ من الأب", "أخت من الأب") : g("أخ من الأم", "أخت من الأم"));
  }
  if(dA === 2 && dB === 1) return viaFather ? g("عم", "عمة") : g("خال", "خالة");
  if(dA === 1 && dB === 2) return isM(bParent) ? g("ابن الأخ", "ابنة الأخ") : g("ابن الأخت", "ابنة الأخت");
  if(dA === 2 && dB === 2){ const side = viaFather ? (isM(bParent) ? "العم" : "العمة") : (isM(bParent) ? "الخال" : "الخالة"); return `${g("ابن", "ابنة")} ${side}`; }
  if(dA === 3 && dB === 1) return viaFather ? g("عم الأب", "عمة الأب") : g("خال الأم أو عمها", "خالة الأم أو عمتها");
  if(dA === 1 && dB === 3) return g("حفيد الأخ أو الأخت", "حفيدة الأخ أو الأخت");
  if(dA === dB) return `${g("قريب", "قريبة")} من أبناء العمومة البعيدة (الدرجة ${dA - 1})`;
  return `${g("قريب", "قريبة")} — يجمعهما جد مشترك قبل ${dA} أجيال من الأول و${dB} من الثاني`;
}
function kinResultHtml(A, B){
  if(A.id === B.id) return `<p class="muted">اخترت نفس الشخص مرتين.</p>`;
  const ma = ancestorsMap(A), mb = ancestorsMap(B);
  let best = null;
  ma.forEach((va, id) => { const vb = mb.get(id); if(vb && (!best || va.d + vb.d < best.da + best.db)) best = {id, da:va.d, db:vb.d, pa:va.path, pb:vb.path}; });
  const spouses = p => spousesOf(p).map(s => s.person).filter(Boolean);
  if(!best){
    if(spouses(A).some(s => s.id === B.id)) return kinBox(isM(B) ? "زوج" : "زوجة", A, B, null);
    for(const s of spouses(A)){ const r = quickRel(s, B); if(r) return kinBox(`${r} ${isM(A) ? "الزوجة" : "الزوج"}`, A, B, null, "قرابة بالمصاهرة"); }
    for(const s of spouses(B)){ const r = quickRel(A, s); if(r) return kinBox(`${isM(B) ? "زوج" : "زوجة"} ${r}`, A, B, null, "قرابة بالمصاهرة"); }
    const link = familyLinks().pairs.find(p => (p.a === famOf(A) && p.b === famOf(B)) || (p.b === famOf(A) && p.a === famOf(B)));
    return `<div class="kin-res none"><b>لا توجد قرابة دم مسجلة بين الشخصين</b><p>${link && famOf(A) !== famOf(B) ? `لكن بين عائلتي ${esc(famOf(A))} و${esc(famOf(B))} رابط مصاهرة (${link.marriages} زواج، ${link.kids} من الأبناء).` : "قد تكون القرابة موجودة لكن الآباء أو الأمهات غير مربوطين في السجل."}</p></div>`;
  }
  const lca = S.byId.get(best.id);
  const label = relationLabel(A, B, best.da, best.db, best.pa, best.pb);
  return kinBox(label, A, B, {lca, pa:best.pa, pb:best.pb, da:best.da, db:best.db});
}
function quickRel(A, B){
  const ma = ancestorsMap(A), mb = ancestorsMap(B); let best = null;
  ma.forEach((va, id) => { const vb = mb.get(id); if(vb && (!best || va.d + vb.d < best.da + best.db)) best = {da:va.d, db:vb.d, pa:va.path, pb:vb.path}; });
  return best && best.da + best.db <= 4 ? relationLabel(A, B, best.da, best.db, best.pa, best.pb) : "";
}
function kinBox(label, A, B, x, kind = "قرابة دم"){
  const chain = path => path.map((p, i) => `<li class="${i === path.length - 1 ? "lca" : ""}">${nm(p, fullName(p, 3))} <small>#${p.serial}</small></li>`).join("");
  return `<div class="kin-res">
    <div class="kin-res-h"><span class="kin-kind">${kind}</span><b>${nm(B, fullName(B, 3))}</b> بالنسبة لـ ${nm(A, fullName(A, 3))}: <em>${esc(label)}</em></div>
    ${x ? `<p class="kin-lca">الجد المشترك: ${nm(x.lca, fullName(x.lca, 4))} — يبعد ${x.da} ${x.da === 1 ? "جيلاً" : "أجيال"} عن الأول و${x.db} عن الثاني</p>
    <div class="kin-paths"><ol>${chain(x.pa)}</ol><ol>${chain(x.pb)}</ol></div>` : ""}
  </div>`;
}
