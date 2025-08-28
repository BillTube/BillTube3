
BTFW.define("feature:bulma", [], async ({}) => {
  function disableBootstrapAndSlate(){
    Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).forEach(function(lnk){
      var href=(lnk.getAttribute("href")||"").toLowerCase();
      if (/bootstrap|slate/.test(href)) {
        if (!lnk.dataset.btfwDisabledMedia) lnk.dataset.btfwDisabledMedia = lnk.media || "all";
        lnk.media = "not all"; // reversible
      }
    });
  }
  function ensureBulma(){
    if (document.querySelector('link[data-btfw-bulma]')) return;
    var css=document.createElement("link"); css.rel="stylesheet";
    css.href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css";
    css.dataset.btfwBulma="1"; document.head.appendChild(css);
  }
  function ensureFA(){
    if (document.querySelector('link[data-btfw-fa6]') || document.querySelector('link[href*="fontawesome"]')) return;
    var fa6=document.createElement("link"); fa6.rel="stylesheet";
    fa6.href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css";
    fa6.dataset.btfwFa6="1";
    fa6.onerror=function(){
      if (document.querySelector('link[data-btfw-fa4]')) return;
      var fa4=document.createElement("link"); fa4.rel="stylesheet";
      fa4.href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
      fa4.dataset.btfwFa4="1"; document.head.appendChild(fa4);
      console.warn("[BTFW] FA6 failed; loaded FA4 fallback");
    };
    document.head.appendChild(fa6);
  }
  function bridgeBootstrapToBulma(root){
    root=root||document;
    root.querySelectorAll(".btn").forEach(el=>el.classList.add("button"));
    root.querySelectorAll(".btn-primary").forEach(el=>el.classList.add("is-primary"));
    root.querySelectorAll(".btn-success").forEach(el=>el.classList.add("is-success"));
    root.querySelectorAll(".btn-danger").forEach(el=>el.classList.add("is-danger"));
    root.querySelectorAll(".btn-warning").forEach(el=>el.classList.add("is-warning"));
    root.querySelectorAll(".btn-info").forEach(el=>el.classList.add("is-info"));
    root.querySelectorAll(".btn-default,.btn-secondary").forEach(el=>el.classList.add("is-light"));
    root.querySelectorAll('input.form-control').forEach(el=>el.classList.add("input"));
    root.querySelectorAll('select.form-control').forEach(el=>el.classList.add("select"));
    root.querySelectorAll('textarea.form-control').forEach(el=>el.classList.add("textarea"));
  }
  function observeBridge(){
    new MutationObserver(m=>m.forEach(r=>r.addedNodes&&r.addedNodes.forEach(n=>{ if(n.nodeType===1) bridgeBootstrapToBulma(n); })))
      .observe(document.body,{childList:true,subtree:true});
  }

  disableBootstrapAndSlate();
  ensureBulma();
  ensureFA();
  bridgeBootstrapToBulma(document);
  observeBridge();

  // Always force Fluid layout preference
  try {
    localStorage.setItem("cytube-layout", "fluid");
    localStorage.setItem("layout", "fluid");
    if (typeof window.setPreferredLayout === "function") window.setPreferredLayout("fluid");
  } catch(e){}

  return {name:"feature:bulma"};
});
