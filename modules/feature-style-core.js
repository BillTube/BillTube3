
BTFW.define("feature:styleCore", [], async () => {
  function ensureSlate(){
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasBoot = links.some(l => /(bootstrap.*\.css|bootswatch.*slate)/i.test(l.href||""));
    if (!hasBoot && !document.querySelector('link[data-btfw-slate]')){
      const s=document.createElement("link"); s.rel="stylesheet"; s.href="https://cdn.jsdelivr.net/npm/bootswatch@3.4.1/slate/bootstrap.min.css"; s.dataset.btfwSlate="1"; document.head.insertBefore(s, document.head.firstChild);
    }
  }
  ensureSlate(); setTimeout(ensureSlate, 400);
  if (!document.querySelector('link[data-btfw-fa6]') && !document.querySelector('link[href*="fontawesome"]')){
    const fa=document.createElement("link"); fa.rel="stylesheet"; fa.href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css"; fa.dataset.btfwFa6="1"; document.head.appendChild(fa);
  }
  try { localStorage.setItem("cytube-layout","fluid"); localStorage.setItem("layout","fluid"); if (window.setPreferredLayout) window.setPreferredLayout("fluid"); } catch(e){}
  return { name:"feature:styleCore" };
});
