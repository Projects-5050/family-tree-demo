/* ===== نسخة العرض (ديمو): قاعدة بيانات وهمية داخل المتصفح =====
   تحل محل مكتبة Supabase: نفس الواجهة التي يستخدمها البرنامج (from / rpc / auth / storage)،
   لكن البيانات من demo-data.js وتبقى في ذاكرة الصفحة فقط — إعادة فتح الصفحة تعيدها كما كانت. */
(function(){
  const DEMO_EMAIL = "demo@family-demo.app";
  const clone = x => JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  const T = clone(window.DEMO_DATA.tables);
  const seq = {};
  Object.entries(T).forEach(([t, rows]) => { seq[t] = rows.reduce((m, r) => Math.max(m, +r.id || 0), 0); });

  /* افتراضيات كل جدول عند الإضافة */
  const DEF = {
    f4_people:   () => ({status:"على قيد الحياة", selected:false, created_at:now(), updated_at:now(), created_by:DEMO_EMAIL}),
    f4_occasions:() => ({created_by:DEMO_EMAIL, created_at:now(), updated_at:now()}),
    f4_media:    () => ({created_by:DEMO_EMAIL, created_at:now()}),
    f4_heritage: () => ({created_by:DEMO_EMAIL, created_at:now()}),
    f4_ads:      () => ({color:0, photos:[], owner_email:DEMO_EMAIL, status:"approved", featured:false, created_at:now(), updated_at:now(),
                         approved_at:now(), expires_at:new Date(Date.now() + 182 * 864e5).toISOString()}),
    f4_ad_likes: () => ({email:DEMO_EMAIL}),
    f4_bday_greets:() => ({sent_by:DEMO_EMAIL, sent_at:now()}),
    f4_users:    () => ({role:"user", can_add:false, can_edit:false, can_delete:false, created_at:now(), family_only:true, frozen:false}),
    f4_visits:   () => ({email:DEMO_EMAIL, visited_at:now()}),
    f4_settings: () => ({updated_at:now(), updated_by:DEMO_EMAIL}),
    f4_requests: () => ({status:"pending", created_at:now(), accepted_terms_at:now()}),
    f4_lookups:  () => ({sort:0}),
    f4_spouses:  () => ({}),
  };
  const KEYS = {f4_settings:["key"], f4_users:["email"]}; // جداول مفتاحها ليس id
  const UNIQUE = {f4_people:[["serial", "f4_people_serial_key"], ["cpr", "f4_people_cpr_key"]]};

  const cmp = (a, b) => (a == null) - (b == null) || (a < b ? -1 : a > b ? 1 : 0);
  const err = m => ({message:m, code:"demo"});

  function prepNew(t, r){
    const row = Object.assign((DEF[t] || (() => ({})))(), r);
    if(!KEYS[t] && row.id == null) row.id = ++seq[t];
    else if(row.id != null) seq[t] = Math.max(seq[t] || 0, +row.id);
    return row;
  }
  function checkUnique(t, row, selfId){
    for(const [col, name] of UNIQUE[t] || []){
      if(row[col] == null || row[col] === "") continue;
      if((T[t] || []).some(x => x !== selfId && x[col] === row[col])) return err(`duplicate key value violates unique constraint "${name}"`);
    }
    return null;
  }

  class Query {
    constructor(t){ this.t = t; this.op = "select"; this.f = []; this.ord = []; this.rng = null; this.ret = false; this.one = null; this.opts = {}; }
    select(cols, opts){ if(this.op === "select"){ this.opts = opts || {}; } else this.ret = true; return this; }
    insert(v){ this.op = "insert"; this.v = v; return this; }
    update(v){ this.op = "update"; this.v = v; return this; }
    upsert(v, o){ this.op = "upsert"; this.v = v; this.uo = o || {}; return this; }
    delete(){ this.op = "delete"; return this; }
    eq(c, v){ this.f.push(r => r[c] == v); return this; }
    neq(c, v){ this.f.push(r => r[c] != v); return this; }
    in(c, a){ this.f.push(r => a.includes(r[c])); return this; }
    is(c, v){ this.f.push(r => (r[c] ?? null) === v); return this; }
    match(o){ Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
    order(c, o = {}){ this.ord.push([c, o.ascending !== false, o.nullsFirst]); return this; }
    range(a, b){ this.rng = [a, b]; return this; }
    limit(n){ this.rng = [0, n - 1]; return this; }
    single(){ this.one = "single"; return this; }
    maybeSingle(){ this.one = "maybe"; return this; }
    then(res, rej){ return Promise.resolve().then(() => this.run()).then(res, rej); }
    catch(f){ return this.then(null, f); }
    rows(){ return (T[this.t] ||= []).filter(r => this.f.every(fn => fn(r))); }
    run(){
      const t = this.t; T[t] ||= []; let out, e = null;
      if(this.op === "select"){
        out = this.rows();
        if(this.ord.length) out = out.slice().sort((a, b) => { for(const [c, asc, nf] of this.ord){
          const an = a[c] == null, bn = b[c] == null;
          if(an !== bn) return (nf ?? !asc) ? (an ? -1 : 1) : (an ? 1 : -1);
          const d = cmp(a[c], b[c]); if(d) return asc ? d : -d; } return 0; });
        const count = out.length;
        if(this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
        if(this.opts.head) return {data:null, error:null, count};
        return this.finish(clone(out), count);
      }
      if(this.op === "insert"){
        const list = [].concat(this.v).map(r => prepNew(t, clone(r)));
        for(const r of list){ e = checkUnique(t, r); if(e) return {data:null, error:e}; }
        T[t].push(...list); out = list;
      }
      else if(this.op === "update"){
        const hit = this.rows();
        for(const r of hit){ e = checkUnique(t, {...r, ...this.v}, r); if(e) return {data:null, error:e}; }
        hit.forEach(r => { Object.assign(r, clone(this.v)); if("updated_at" in r && !("updated_at" in this.v)) r.updated_at = now(); });
        out = hit;
      }
      else if(this.op === "upsert"){
        const keys = (this.uo.onConflict || (KEYS[t] || ["id"]).join(",")).split(",").map(s => s.trim());
        out = [];
        for(const r0 of [].concat(this.v)){
          const r = clone(r0), ex = T[t].find(x => keys.every(k => x[k] == r[k]));
          if(ex){ if(!this.uo.ignoreDuplicates){ Object.assign(ex, r); out.push(ex); } }
          else { const n = prepNew(t, r); T[t].push(n); out.push(n); }
        }
      }
      else if(this.op === "delete"){
        const hit = new Set(this.rows()); out = [...hit];
        T[t] = T[t].filter(r => !hit.has(r));
        cascade(t, out);
      }
      return this.ret || this.one ? this.finish(clone(out)) : {data:null, error:null};
    }
    finish(data, count){
      if(this.one){
        if(data.length > 1 || (this.one === "single" && !data.length)) return {data:null, error:err("JSON object requested, multiple (or no) rows returned")};
        return {data:data[0] || null, error:null};
      }
      return {data, error:null, count};
    }
  }
  /* حذف السجلات التابعة (مثل قاعدة البيانات الأصلية) */
  function cascade(t, gone){
    const ids = new Set(gone.map(r => r.id));
    if(t === "f4_people"){
      T.f4_spouses = T.f4_spouses.filter(s => !ids.has(s.person_id) && !ids.has(s.spouse_id));
      T.f4_people.forEach(p => { if(ids.has(p.father_id)) p.father_id = null; if(ids.has(p.mother_id)) p.mother_id = null; });
      T.f4_users.forEach(u => { if(ids.has(u.person_id)) u.person_id = null; });
    }
    if(t === "f4_occasions") T.f4_media = T.f4_media.filter(m => !ids.has(m.occasion_id));
    if(t === "f4_ads") T.f4_ad_likes = T.f4_ad_likes.filter(l => !ids.has(l.ad_id));
  }

  /* ===== الدوال (RPC) ===== */
  const norm = s => String(s || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
  const bh = d => new Date(new Date(d).getTime() + 3 * 36e5).toISOString().slice(0, 10);
  const QR = {};
  const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join("");
  const RPC = {
    f4_request_status:({p_email}) => T.f4_users.some(u => u.email === String(p_email).trim().toLowerCase()) ? "member"
      : (T.f4_requests.filter(r => r.email.toLowerCase() === String(p_email).trim().toLowerCase()).sort((a, b) => cmp(b.created_at, a.created_at))[0] || {}).status || null,
    f4_visit_stats:() => { const today = bh(now()), mon = today.slice(0, 7), v = T.f4_visits;
      return {total:v.length, today:v.filter(x => bh(x.visited_at) === today).length, month:v.filter(x => bh(x.visited_at).startsWith(mon)).length, visitors:new Set(v.map(x => x.email)).size}; },
    f4_visit_by_user:() => { const m = new Map(); T.f4_visits.forEach(v => { const o = m.get(v.email) || {email:v.email, visits:0, last_visit:null}; o.visits++; if(!o.last_visit || v.visited_at > o.last_visit) o.last_visit = v.visited_at; m.set(v.email, o); }); return [...m.values()]; },
    f4_tree_people:() => T.f4_people.map(p => ({id:p.id, serial:p.serial, name1:p.name1, name2:p.name2, name3:p.name3, name4:p.name4, name5:p.name5, name6:p.name6, family:p.family, gender:p.gender, father_id:p.father_id, mother_id:p.mother_id, birth_year:null, status:p.status, death_date:null, affiliation:p.affiliation})),
    f4_tree_spouses:() => T.f4_spouses.map(s => ({id:s.id, person_id:s.person_id, ord:s.ord, spouse_id:s.spouse_id, spouse_name:s.spouse_name})),
    f4_edit_ids:() => [],
    f4_get_terms:() => (T.f4_settings.find(s => s.key === "terms") || {}).value || null,
    f4_join_names:({q}) => {
      const w = norm(q).split(" "); if(norm(q).length < 2) return [];
      const by = new Map(T.f4_people.map(p => [p.id, p]));
      return T.f4_people.filter(p => p.status !== "متوفى" && w.every((x, i) => i > 3 || norm(p["name" + (i + 1)]).startsWith(x)))
        .sort((a, b) => cmp(a.name1, b.name1) || cmp(a.name2, b.name2) || a.serial - b.serial).slice(0, 40)
        .map(p => { const f = by.get(p.father_id);
          return {id:p.id, serial:p.serial, full_name:[p.name1, p.name2, p.name3, p.name4, p.name5, p.family].filter(Boolean).join(" "),
            parent:[f ? f.name1 : p.name2, f ? f.name2 : p.name3, f ? f.name3 : p.name4].filter(Boolean).join(" ") || null,
            gender:p.gender, taken:T.f4_users.some(u => u.person_id === p.id)}; });
    },
    f4_request_join2:(a) => { const r = prepNew("f4_requests", {full_name:a.p_name, email:String(a.p_email).toLowerCase(), phone:a.p_phone, relation:a.p_relation, person_id:a.p_person});
      T.f4_requests.push(r); return r.id; },
    f4_reject_request:({p_id}) => { const r = T.f4_requests.find(x => x.id === p_id); if(r){ r.status = "rejected"; r.decided_at = now(); r.decided_by = DEMO_EMAIL; } return "ok"; },
    f4_approve_request:(a) => {
      const r = T.f4_requests.find(x => x.id === a.p_id); if(!r) throw err("not found");
      r.status = "approved"; r.decided_at = now(); r.decided_by = DEMO_EMAIL;
      if(!T.f4_users.some(u => u.email === r.email)) T.f4_users.push(prepNew("f4_users", {email:r.email, display_name:r.full_name, role:a.p_role, can_add:a.p_add, can_edit:a.p_edit, can_delete:a.p_delete, person_id:a.p_person, family_only:a.p_family_only}));
      return "ok";
    },
    f4_self_register:() => { throw err("التسجيل الذاتي غير متاح في نسخة العرض"); },
    f4_qr_get:({p_email, p_new}) => { const u = T.f4_users.find(x => x.email === p_email); if(!u) throw err("no such user");
      if(u.role === "admin") throw err("رمز الدخول السريع غير متاح لحسابات المدير");
      if(p_new || !QR[u.email]) QR[u.email] = {token:tok(), created_at:now(), last_used_at:null, uses:0}; return QR[u.email].token; },
    f4_qr_list:() => Object.entries(QR).map(([email, q]) => ({email, created_at:q.created_at, last_used_at:q.last_used_at, uses:q.uses})),
    f4_qr_revoke:({p_email}) => { delete QR[p_email]; return null; },
    f4_qr_mine:() => { throw err("رمز الدخول السريع غير متاح لحسابات المدير"); },
    f4_qr_for_person:({p_person}) => {
      const p = T.f4_people.find(x => x.id === p_person); if(!p) throw err("السجل غير موجود");
      let u = T.f4_users.find(x => x.person_id === p.id && x.role !== "admin"), created = false;
      if(!u){ if(T.f4_users.some(x => x.person_id === p.id)) throw err("هذا السجل مربوط بحساب مدير");
        u = prepNew("f4_users", {email:`m${p.serial}-${tok().slice(0, 6).toLowerCase()}@members.demo.test`, display_name:[p.name1, p.name2, p.name3, p.family].filter(Boolean).join(" "), role:"user", can_add:true, can_edit:true, person_id:p.id, family_only:true});
        T.f4_users.push(u); created = true; }
      if(!QR[u.email]) QR[u.email] = {token:tok(), created_at:now(), last_used_at:null, uses:0};
      return {email:u.email, token:QR[u.email].token, created};
    },
  };

  /* ===== الملفات (صور ومقاطع) ===== */
  const FILES = new Map(Object.entries(window.DEMO_DATA.files || {}));
  const fileUrl = p => FILES.get(p) || FILES.get(String(p).replace(/_t\.jpg$/, ".jpg")) || "";
  const storage = {from:() => ({
    upload:async (path, blob) => { FILES.set(path, URL.createObjectURL(blob)); return {data:{path}, error:null}; },
    remove:async paths => { paths.forEach(p => FILES.delete(p)); return {data:[], error:null}; },
    createSignedUrl:async path => { const u = fileUrl(path); return u ? {data:{signedUrl:u}, error:null} : {data:null, error:err("Object not found")}; },
    createSignedUrls:async paths => ({data:paths.map(path => ({path, signedUrl:fileUrl(path) || null})), error:null}),
    download:async path => { const u = fileUrl(path); if(!u) return {data:null, error:err("Object not found")}; return {data:await (await fetch(u)).blob(), error:null}; },
  })};

  /* ===== الدخول: يدخل مباشرة بحساب مدير العرض ===== */
  const session = {user:{id:"demo", email:DEMO_EMAIL}, access_token:"demo"};
  let current = session; const subs = [];
  const emit = ev => subs.forEach(cb => { try{ cb(ev, current); }catch(e){ console.error(e); } });
  const auth = {
    onAuthStateChange(cb){ subs.push(cb); setTimeout(() => cb("INITIAL_SESSION", current), 0); return {data:{subscription:{unsubscribe(){ subs.splice(subs.indexOf(cb), 1); }}}}; },
    getSession:async () => ({data:{session:current}, error:null}),
    getUser:async () => ({data:{user:current && current.user}, error:null}),
    signInWithPassword:async () => { current = session; setTimeout(() => emit("SIGNED_IN"), 0); return {data:{session}, error:null}; },
    signOut:async () => { current = null; setTimeout(() => emit("SIGNED_OUT"), 0); return {error:null}; },
    resetPasswordForEmail:async () => ({error:err("استعادة كلمة السر غير متاحة في نسخة العرض — ادخل بأي بريد وكلمة سر")}),
    updateUser:async () => ({data:null, error:null}),
    verifyOtp:async () => ({data:{session}, error:null}),
  };

  const client = {
    from:t => new Query(t),
    rpc:(name, args) => Promise.resolve().then(() => {
      const fn = RPC[name]; if(!fn) return {data:null, error:err("الوظيفة غير متاحة في نسخة العرض")};
      try{ return {data:clone(fn(args || {}) ?? null), error:null}; }catch(e){ return {data:null, error:e.message ? e : err(String(e))}; }
    }),
    auth, storage,
    functions:{invoke:async () => ({data:null, error:err("غير متاح في نسخة العرض")})},
  };
  window.supabase = {createClient:() => client};
  window.DEMO = {email:DEMO_EMAIL, tables:T};
})();
