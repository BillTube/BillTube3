
BTFW.define("feature:styleCore", [], async () => {
  // Re-enable any Bootstrap/Slate <link> tags if some other script disabled them
  Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).forEach(function(lnk){
    if (lnk.media === "not all" && (lnk.dataset.btfwDisabledMedia || /(bootstrap|slate)/i.test(lnk.href||""))) {
      lnk.media = lnk.dataset.btfwDisabledMedia || "all";
    }
  });

  // Font Awesome (for icons) with FA4 fallback
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

  // Always force Fluid layout preference (so columns can breathe)
  try {
    localStorage.setItem("cytube-layout", "fluid");
    localStorage.setItem("layout", "fluid");
    if (typeof window.setPreferredLayout === "function") window.setPreferredLayout("fluid");
  } catch(e){}

  // If Slate stylesheet is absent entirely and you want a minimal fallback, you can uncomment:
  // var hasSlate = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l=>/slate/i.test(l.href||""));
  // if (!hasSlate) { var s=document.createElement("link"); s.rel="stylesheet"; s.href="https://cdn.jsdelivr.net/npm/bootswatch@3.4.1/slate/bootstrap.min.css"; document.head.appendChild(s); }

  return { name:"feature:styleCore" };
});
