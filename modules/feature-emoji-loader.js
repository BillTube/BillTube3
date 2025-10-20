
BTFW.define("feature:emoji-loader", [], async () => {
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function prepCell(cell){
    if (!cell || cell._btfwReady) return;
    cell._btfwReady = true;
    const img = cell.querySelector(".btfw-emoji-img");
    if (!img) return;
    cell.classList.add("loading");
    img.addEventListener("load", ()=> {
      cell.classList.remove("loading");
      cell.classList.add("ready");
    }, { once:true });
    img.addEventListener("error", ()=> {
      cell.classList.remove("loading");
      img.style.display = "none";
    }, { once:true });
    if (img.complete && img.naturalWidth > 0) {
      // already cached
      cell.classList.remove("loading");
      cell.classList.add("ready");
    }
  }

  function scan(){
    $$(".btfw-emoji-grid .btfw-emoji-cell").forEach(prepCell);
  }

  let scanTimeout;
  const mo = new MutationObserver(() => {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scan, 50);
  });
  mo.observe(document.body, { childList:true, subtree:true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();

  return { name:"feature:emoji-loader" };
});
