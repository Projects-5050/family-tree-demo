/* ===== حركة الدخول: البوابة الذهبية =====
   عند الدخول بكلمة السر: تُغلق بوابة كحلية بإطار ذهبي فوق شاشة الدخول، يدور الختم في وسطها
   بينما يُحمّل البرنامج خلفها، ثم تنفتح البوابة إلى الجانبين وتظهر الرئيسية بالتتابع.
   لا تظهر عند فتح الموقع بجلسة محفوظة، ولا لمن فعّل «تقليل الحركة» في جهازه. */
const GATE = {want:false, el:null, closed:null, t0:0};
const gateReduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const gAnim = (el, kf, o) => el.animate(kf, {fill:"forwards", ...o}).finished.catch(() => {});

function gateClose(){
  if(GATE.el) return GATE.closed;
  const g = document.createElement("div");
  g.id = "gate"; g.setAttribute("aria-hidden", "true");
  g.innerHTML = `<div class="g-door g-r"></div><div class="g-door g-l"></div>
    <div class="g-seal"><img src="img/logo-mark-light.png" alt=""></div>`;
  document.body.appendChild(g); GATE.el = g;
  const [r, l] = g.querySelectorAll(".g-door"), seal = g.querySelector(".g-seal");
  const ease = "cubic-bezier(.55,.06,.68,.19)";
  GATE.closed = Promise.all([
    gAnim(r, [{transform:"translateX(100%)"}, {transform:"translateX(0)"}], {duration:500, easing:ease}),
    gAnim(l, [{transform:"translateX(-100%)"}, {transform:"translateX(0)"}], {duration:500, easing:ease}),
  ]).then(() => gAnim(seal, [{transform:"scale(0)"}, {transform:"scale(1)"}], {duration:350, easing:"cubic-bezier(.34,1.8,.64,1)"}))
    .then(() => { seal.getAnimations().forEach(x => x.cancel()); seal.style.transform = "none"; GATE.t0 = performance.now(); seal.classList.add("spin"); });
  /* أمان: لا تبقى البوابة مغلقة أكثر من 10 ثوانٍ مهما حدث */
  setTimeout(() => gateOpen(), 10000);
  return GATE.closed;
}
async function gateOpen(){
  const g = GATE.el; if(!g || g.dataset.opening) return; g.dataset.opening = "1";
  await GATE.closed;
  const wait = 650 - (performance.now() - GATE.t0); if(wait > 0) await new Promise(r => setTimeout(r, wait)); // دورة ختم كاملة على الأقل
  const [r, l] = g.querySelectorAll(".g-door"), seal = g.querySelector(".g-seal");
  seal.classList.remove("spin");
  await gAnim(seal, [{transform:"rotate(0) scale(1)", opacity:1}, {transform:"rotate(180deg) scale(0)", opacity:0}], {duration:300, easing:"ease-in"});
  const ease = "cubic-bezier(.65,0,.35,1)";
  gateHomeIn();
  await Promise.all([
    gAnim(r, [{transform:"translateX(0)"}, {transform:"translateX(100%)"}], {duration:700, easing:ease}),
    gAnim(l, [{transform:"translateX(0)"}, {transform:"translateX(-100%)"}], {duration:700, easing:ease}),
  ]);
  g.remove(); GATE.el = null; GATE.want = false;
}
/* ظهور أجزاء الرئيسية بالتتابع خلف البوابة وهي تنفتح */
function gateHomeIn(){
  const items = [...document.querySelectorAll("#view > *")].slice(0, 8);
  items.forEach((el, i) => el.animate([{opacity:0, transform:"translateY(16px)"}, {opacity:1, transform:"none"}],
    {duration:450, delay:250 + i * 60, easing:"cubic-bezier(.2,.8,.2,1)", fill:"backwards"}));
}
