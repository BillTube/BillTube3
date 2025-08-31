/* BTFW — feature:layout (safe split + integrated resizer, no ancestor cycles)
   Ensures:
     #btfw-app (flex row)
       #btfw-leftpad (video, stack handled by other modules)
       #btfw-resizer
       #btfw-rightpad (chat)
   Notes:
     - We DO NOT move #mainpage or other large wrappers to avoid cycles.
     - We only place #videowrap into left and #chatwrap into right.
     - Safe-append prevents “new child contains the parent” errors.
*/

BTFW.define("feature:layout", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);

  // ---- Fallback CSS so split works even if theme CSS is late/missing
  function injectFallbackCSS(){
    if (document.getElementById("btfw-layout-fallback-css")) return;
    const css = `
      html, body { height:100%; }
      #btfw-app {
        display:flex !important;
        flex-direction:row !important;
        align-items:stretch;
        width:100%;
        height:calc(100vh - var(--btfw-navbar-h, 48px));
        min-height:480px;
        gap:0;
      }
      #btfw-leftpad, #btfw-rightpad { display:flex; flex-direction:column; min-height:0; }
      #btfw-leftpad  { flex: 0 0 62%; min-width:520px; }
      #btfw-rightpad { flex: 1 1 auto; min-width:320px; }
      #btfw-resizer  {
        flex: 0 0 6px;
        cursor: col-resize;
        background: var(--btfw-mute-800, #1f2937);
        border-left: 1px solid rgba(255,255,255,.06);
        border-right:1px solid rgba(0,0,0,.3);
      }
      #chatwrap { display:flex; flex-direction:column; min-height:0; height:100%; }
      #messagebuffer { flex:1 1 auto; min-height:0; overflow:auto; }
      #chatlinewrap { flex: 0 0 auto; }
      body.btfw-resizing { user-select:none; cursor:col-resize; }
    `.trim();
    const style = document.createElement("style");
    style.id = "btfw-layout-fallback-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Remove Bootstrap grid classes that can stack our panes vertically
  function purgeBootstrapGrid(el){
    if (!el || !el.className) return;
    const keep = el.className.split(/\s+/).filter(c =>
      !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row"
    );
    el.className = keep.join(" ");
  }

  // Prevent parent-child cycles when moving DOM
  function safeAppend(child, parent){
    if (!child || !parent) return;
    if (child === parent) return;                 // same node, ignore
    if (child.contains(parent)) return;           // would create a cycle → skip
    if (child.parentElement === parent) return;   // already in place
    parent.appendChild(child);
  }

  function ensureStructure(){
    injectFallbackCSS();

    // Create or get the core container and pads
    let app = document.getElementById("btfw-app");
    if (!app) {
      const main = document.getElementById("main") || document.getElementById("wrap") || document.body;
      app = document.createElement("div");
      app.id = "btfw-app";
      main.appendChild(app);
    }

    let left  = document.getElementById("btfw-leftpad");
    let right = document.getElementById("btfw-rightpad");
    let bar   = document.getElementById("btfw-resizer");

    if (!left)  { left  = document.createElement("div"); left.id  = "btfw-leftpad";  app.appendChild(left); }
    if (!bar)   { bar   = document.createElement("div"); bar.id   = "btfw-resizer";  app.appendChild(bar);  }
    if (!right) { right = document.createElement("div"); right.id = "btfw-rightpad"; app.appendChild(right);}

    // Ensure order: left | bar | right
    if (app.firstElementChild !== left) app.insertBefore(left, app.firstChild);
    if (bar.previousElementSibling !== left) app.insertBefore(bar, left.nextSibling);
    if (bar.nextElementSibling !== right) app.insertBefore(right, bar.nextSibling);

    // Move ONLY the specific leaves we own to avoid cycles:
    const videowrap = document.getElementById("videowrap");
    if (videowrap) {
      purgeBootstrapGrid(videowrap);
      safeAppend(videowrap, left);
    }

    const chatwrap = document.getElementById("chatwrap");
    if (chatwrap) {
      purgeBootstrapGrid(chatwrap);
      safeAppend(chatwrap, right);
    }

    return { app, left, right, bar };
  }

  // ---- Split persistence & resizer
  const LS_KEY   = "btfw:split:leftWidth"; // px
  const MIN_LEFT = 520;
  const MIN_RIGHT= 320;

  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  function applySplit(leftPx){
    const { app, left, right } = ensureStructure();
    const total = app.clientWidth || window.innerWidth;
    const L = clamp(leftPx, MIN_LEFT, Math.max(MIN_LEFT, total - MIN_RIGHT));
    left.style.flexBasis  = L + "px";
    right.style.flexBasis = (total - L) + "px";
    try { localStorage.setItem(LS_KEY, String(L)); } catch(_) {}
  }

  function loadSplit(initial=false){
    const { app } = ensureStructure();
    const total = app.clientWidth || window.innerWidth;
    let L = Math.floor(total * 0.62);
    try {
      const saved = parseInt(localStorage.getItem(LS_KEY)||"",10);
      if (!isNaN(saved)) L = saved;
    } catch(_) {}
    applySplit(L);

    if (initial && !window._btfwLayoutReadyDispatched) {
      window._btfwLayoutReadyDispatched = true;
      document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
    }
  }

  let dragging=false, startX=0, startL=0;
  function onDown(e){
    const { left } = ensureStructure();
    dragging = true;
    startX = ("touches" in e) ? e.touches[0].clientX : e.clientX;
    startL = left.getBoundingClientRect().width;
    document.body.classList.add("btfw-resizing");
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    const x = ("touches" in e) ? e.touches[0].clientX : e.clientX;
    applySplit(startL + (x - startX));
  }
  function onUp(){
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("btfw-resizing");
  }

  function wireResizer(){
    const { bar } = ensureStructure();
    if (!bar || bar._btfwWired) return;
    bar._btfwWired = true;

    bar.addEventListener("mousedown",  onDown, { passive:false });
    bar.addEventListener("touchstart", onDown, { passive:false });
    window.addEventListener("mousemove", onMove, { passive:false });
    window.addEventListener("touchmove", onMove, { passive:false });
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchend",  onUp);
    window.addEventListener("resize", ()=> loadSplit(false));
  }

  function boot(){
    ensureStructure();
    wireResizer();
    loadSplit(true);

    // If CyTube reflows DOM, keep our split stable without reparenting ancestors
    const mo = new MutationObserver(()=>{
      // Only try to (re)place the two leaf nodes to avoid cycles
      const { left, right } = ensureStructure();
      const videowrap = document.getElementById("videowrap");
      const chatwrap  = document.getElementById("chatwrap");
      if (videowrap && videowrap.parentElement !== left) safeAppend(videowrap, left);
      if (chatwrap  && chatwrap.parentElement  !== right) safeAppend(chatwrap,  right);
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:layout",
    setSplit(px){ applySplit(px); },
    getSplit(){ try { return parseInt(localStorage.getItem(LS_KEY)||"",10); } catch(_) { return null; } },
    reflow(){ loadSplit(false); }
  };
});
