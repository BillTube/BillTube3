BTFW.define("feature:ui",["core"],async function(){
  function addHeaderButtons(){
    const nav = document.querySelector("#nav-collapsible") ||
                document.querySelector("nav .navbar-collapse") ||
                document.querySelector("nav.navbar");
    if(!nav || nav.querySelector(".btfw-controls")) return;
    const wrap=document.createElement("div");
    wrap.className="btfw-controls";
    const themeBtn=document.createElement("button");
    themeBtn.className="btfw-btn";
    themeBtn.textContent="Theme Settings";
    themeBtn.addEventListener("click", ()=> window.BTFW_themeSettings && window.BTFW_themeSettings.open && window.BTFW_themeSettings.open());
    wrap.appendChild(themeBtn);
    nav.appendChild(wrap);
  }
  function boot(){ addHeaderButtons(); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  return {};
});
