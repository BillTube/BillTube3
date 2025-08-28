
BTFW.define("feature:styleCore", [], async () => {
  // Ensure Bootswatch Slate (fallback) + FA6 + fluid layout
  function ensureSlate(){
    const hasBoot = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some(l => /(bootstrap.*\.css|bootswatch.*slate)/i.test(l.href||""));
    if (hasBoot) return;
    if (document.querySelector('link[data-btfw-slate]')) return;
    const s=document.createElement("link"); s.rel="stylesheet";
    s.href="https://cdn.jsdelivr.net/npm/bootswatch@3.4.1/slate/bootstrap.min.css";
    s.dataset.btfwSlate="1";
    document.head.insertBefore(s, document.head.firstChild);
  }
  ensureSlate(); setTimeout(ensureSlate, 400);

  if (!document.querySelector('link[data-btfw-fa6]') && !document.querySelector('link[href*="fontawesome"]')) {
    const fa6=document.createElement("link"); fa6.rel="stylesheet";
    fa6.href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css";
    fa6.dataset.btfwFa6="1";
    fa6.onerror=function(){
      if (document.querySelector('link[data-btfw-fa4]')) return;
      const fa4=document.createElement("link"); fa4.rel="stylesheet";
      fa4.href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
      fa4.dataset.btfwFa4="1"; document.head.appendChild(fa4);
    };
    document.head.appendChild(fa6);
  }
  try {
    localStorage.setItem("cytube-layout", "fluid");
    localStorage.setItem("layout", "fluid");
    if (typeof window.setPreferredLayout === "function") window.setPreferredLayout("fluid");
  } catch(e){}
  return { name:"feature:styleCore" };
});
