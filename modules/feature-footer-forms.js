
BTFW.define("feature:footerForms", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function ensureFooterSlot(){
    let foot = $("#btfw-footer");
    if (!foot) {
      foot = document.createElement("div");
      foot.id = "btfw-footer";
      foot.className = "btfw-footer";
      // stick it at the very bottom of the content stack
      const stack = $("#btfw-content-stack") || $("#mainpage") || document.body;
      stack.appendChild(foot);
    }
    return foot;
  }

  function moveForms(){
    const foot = ensureFooterSlot();
    ["#logoutform", "#loginform"].forEach(sel=>{
      $$(sel).forEach(form=>{
        if (!foot.contains(form)) {
          form.style.margin = "8px 0";
          form.style.display = "inline-block";
          foot.appendChild(form);
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
