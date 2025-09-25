
BTFW.define("feature:footerForms", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function ensureFooterSlot(){
    const stackContainer = document.querySelector("#btfw-stack-footer .btfw-footer .container");
    if (stackContainer) return stackContainer;

    let foot = $("#btfw-footer");
    if (!foot) {
      foot = document.createElement("div");
      foot.id = "btfw-footer";
      foot.className = "btfw-footer";
      const stack = $("#btfw-content-stack") || $("#mainpage") || document.body;
      stack.appendChild(foot);
    }
    foot.classList.add("btfw-footer--standalone");
    return foot;
  }

  function ensureAuthWrap(host){
    if (!host) return null;
    let wrap = host.querySelector?.(".btfw-footer__auth");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "btfw-footer__auth";
      host.appendChild(wrap);
    }
    return wrap;
  }

  function moveForms(){
    const host = ensureFooterSlot();
    if (!host) return;
    const wrap = ensureAuthWrap(host);
    if (!wrap) return;

    ["#logoutform", "#loginform"].forEach(sel=>{
      $$(sel).forEach(form=>{
        if (!wrap.contains(form)) {
          form.classList.remove("navbar-text", "pull-right");
          form.classList.add("btfw-footer__form");
          form.style.margin = "0";
          form.style.display = "inline-flex";
          wrap.appendChild(form);
        }
      });
    });
  }

  function boot(){
    moveForms();
    // Watch later DOM changes (CyTube can re-render header)
    const mo = new MutationObserver(moveForms);
    mo.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:footerForms" };
});
