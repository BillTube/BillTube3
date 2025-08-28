
BTFW.define("feature:themeSettings", ["feature:layout"], async () => {
  function ensure(){
    if(document.getElementById("btfw-theme-modal")) return;
    const m=document.createElement("div"); m.id="btfw-theme-modal"; m.className="btfw-modal hidden";
    m.innerHTML = '<div class="btfw-modal__backdrop"></div><div class="btfw-modal__card"><div class="btfw-modal__header"><h3 style="margin:0">Theme Settings</h3><button class="btfw-close">&times;</button></div><div class="btfw-modal__body">Coming soon…</div></div>';
    document.body.appendChild(m);
    m.querySelector(".btfw-close").onclick=()=>m.classList.add("hidden");
    m.querySelector(".btfw-modal__backdrop").onclick=()=>m.classList.add("hidden");
  }
  document.addEventListener("btfw:openThemeSettings", ()=>{ ensure(); document.getElementById("btfw-theme-modal").classList.remove("hidden"); });
  return { name:"feature:themeSettings" };
});
