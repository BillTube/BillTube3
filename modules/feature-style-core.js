
BTFW.define("feature:styleCore", [], async () => {
  // 1) Re-enable any Bootstrap/Slate links that were muted by older builds
  Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).forEach(function(lnk){
    var href = (lnk.getAttribute("href")||"").toLowerCase();
    if (lnk.media === "not all" && (lnk.dataset.btfwDisabledMedia || /(bootstrap|slate)/i.test(href))) {
      lnk.media = lnk.dataset.btfwDisabledMedia || "all";
    }
  });

  // 2) Ensure a Bootstrap theme exists (load Slate if missing or body looks unstyled)
  function needSlate(){
    var hasBootstrap = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(function(l){ return /(bootstrap.*\.css|bootswatch.*slate)/i.test(l.href||""); });
    if (hasBootstrap) return false;
    var bg = window.getComputedStyle(document.body).backgroundColor;
    // crude: if background is pure white and fonts look default, consider it unstyled
    return !hasBootstrap || bg === "rgb(255, 255, 255)" || bg === "#ffffff";
  }
  function ensureSlate(){
    if (!needSlate()) return;
    if (document.querySelector('link[data-btfw-slate]')) return;
    var s=document.createElement("link"); s.rel="stylesheet";
    s.href="https://cdn.jsdelivr.net/npm/bootswatch@3.4.1/slate/bootstrap.min.css"; // pinned
    s.dataset.btfwSlate="1";
    document.head.insertBefore(s, document.head.firstChild);
    console.warn("[BTFW] Injected Bootswatch Slate fallback");
  }
  ensureSlate();
  setTimeout(ensureSlate, 400); // run again in case other scripts modified links late

  // 3) Ensure Font Awesome 6 (with FA4 fallback)
  if (!document.querySelector('link[data-btfw-fa6]') && !document.querySelector('link[href*="fontawesome"]')) {
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

  // 4) Force Fluid layout (for consistent widths)
  try {
    localStorage.setItem("cytube-layout", "fluid");
    localStorage.setItem("layout", "fluid");
    if (typeof window.setPreferredLayout === "function") window.setPreferredLayout("fluid");
  } catch(e){}

  return { name:"feature:styleCore" };
});
