/* ===== أصوات الأزرار — نمط «زجاجية» (مولّدة بالمتصفح، بدون ملفات) ===== */
const SND = (() => {
  let ctx = null, on = true;
  try{ on = localStorage.getItem("f4-sound") !== "off"; }catch(e){}
  const VOL = .6;
  function ac(){
    if(!ctx){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; ctx = new C(); }
    if(ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(f, d, g, at = 0){
    const c = ac(); if(!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), v = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g * VOL, t + .004); v.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(v).connect(c.destination); o.start(t); o.stop(t + d + .02);
  }
  let last = 0;
  const play = fn => { if(!on) return; const n = performance.now(); if(n - last < 40) return; last = n; try{ fn(); }catch(e){} };
  return {
    click: () => play(() => { tone(2400, .12, .12); tone(3600, .08, .06); }),
    ok:    () => play(() => { tone(1568, .25, .12); tone(2093, .3, .1, .09); tone(2637, .4, .08, .18); }),
    warn:  () => play(() => { tone(1200, .15, .12); tone(900, .25, .12, .12); }),
    get on(){ return on; },
    set on(v){ on = v; try{ localStorage.setItem("f4-sound", v ? "on" : "off"); }catch(e){} },
  };
})();

/* ضغطة على أي زر أو رابط أو بطاقة */
document.addEventListener("click", e => {
  if(e.target.closest("button, a.btn, a.tile, .sidenav a, .rep-item, .pick-row, .pbtn, [data-open], select")) SND.click();
}, true);

/* نجاح الحفظ = رنّة صاعدة، والخطأ = نغمة هابطة */
const _toastPlain = toast;
toast = function(msg, bad = false){ setTimeout(bad ? SND.warn : SND.ok, 60); return _toastPlain(msg, bad); };
/* حوار الحذف والتأكيد الخطِر = نغمة تنبيه */
const _askPlain = ask;
ask = function(title, msg, opts = {}){ if(opts.danger) setTimeout(SND.warn, 60); return _askPlain(title, msg, opts); };

/* زر تشغيل/إيقاف الأصوات في الشريط العلوي */
(function(){
  const b = document.getElementById("soundBtn"); if(!b) return;
  const paint = () => {
    b.setAttribute("aria-pressed", String(SND.on));
    b.setAttribute("aria-label", SND.on ? "إيقاف أصوات الأزرار" : "تشغيل أصوات الأزرار");
    b.title = b.getAttribute("aria-label");
    b.innerHTML = SND.on
      ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  };
  b.onclick = () => { SND.on = !SND.on; paint(); if(SND.on) SND.ok(); };
  paint();
})();
