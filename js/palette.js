/* ===== اختيار ألوان البرنامج: «موف وبيج» (الافتراضي) أو «كحلي وذهبي» =====
   كل لوحة لها ملف تنسيق وشعارات خاصة بها، والاختيار يُحفظ في هذا الجهاز. */
const PAL = {
  mauve:{css:"css/app.css?v=100", img:"img/", bar:"#913768"},
  navy: {css:"css/app-navy.css?v=1", img:"img/navy/", bar:"#1c2c47"},
};
const palNow = () => document.documentElement.dataset.palette === "navy" ? "navy" : "mauve";
/* مسارات الشعارات تتبع اللوحة المختارة، بما فيها الصور التي تظهر لاحقاً */
function palFixImg(img){
  const src = img.getAttribute("src") || "", m = src.match(/^img\/(?:navy\/)?(logo-[\w-]+\.png)$/);
  if(m){ const want = PAL[palNow()].img + m[1]; if(src !== want) img.setAttribute("src", want); }
}
function palFixAll(root = document){ root.querySelectorAll("img[src^='img/']").forEach(palFixImg); }
new MutationObserver(list => list.forEach(r => r.addedNodes.forEach(n => {
  if(n.nodeType !== 1) return; if(n.tagName === "IMG") palFixImg(n); else palFixAll(n);
}))).observe(document.documentElement, {childList:true, subtree:true});

function palApply(name){
  const p = PAL[name] || PAL.mauve;
  if(name === "navy") document.documentElement.dataset.palette = "navy"; else delete document.documentElement.dataset.palette;
  $("#appCss").href = p.css;
  document.querySelector('meta[name="theme-color"]').content = p.bar;
  try{ localStorage.setItem("demo-palette", name); }catch(e){}
  palFixAll(); palMark();
}
function palMark(){ $$(".pal-opt").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pal === palNow()))); }
function palOpen(open){ if(open) $("#palMenu").style.setProperty("--pal-top", Math.round($("#palBtn").getBoundingClientRect().bottom + 8) + "px"); $("#palMenu").hidden = !open; $("#palBtn").setAttribute("aria-expanded", String(open)); if(open) $(".pal-opt[aria-pressed='true']")?.focus(); }

palFixAll(); palMark();
$("#palBtn").onclick = e => { e.stopPropagation(); palOpen($("#palMenu").hidden); };
$$(".pal-opt").forEach(b => b.onclick = () => { palApply(b.dataset.pal); palOpen(false); $("#palBtn").focus(); });
document.addEventListener("click", e => { if(!$("#palMenu").hidden && !e.target.closest("#pal")) palOpen(false); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("#palMenu").hidden){ palOpen(false); $("#palBtn").focus(); } });
