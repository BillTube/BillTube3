
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

  const scheduleFrame = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (cb) => setTimeout(cb, 16);

  const supportsIntersectionObserver = typeof IntersectionObserver === "function";
  const observer = supportsIntersectionObserver ? new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = entry.target;
      if (supportsIntersectionObserver) observer.unobserve(target);
      prepCell(target);
    });
  }) : null;

  let rafId;
  function scan(){
    if (rafId) return;
    rafId = scheduleFrame(() => {
      if (!supportsIntersectionObserver) {
        $$(".btfw-emoji-grid .btfw-emoji-cell").forEach(prepCell);
        rafId = null;
        return;
      }

      $$(".btfw-emoji-grid .btfw-emoji-cell:not([data-observed])").forEach(cell => {
        cell.dataset.observed = "true";
        observer.observe(cell);
      });
      rafId = null;
    });
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
