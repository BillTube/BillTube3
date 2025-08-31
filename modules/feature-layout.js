/* BTFW — feature:layout (self-healing split + integrated resizer)
   Guarantees:
     #btfw-app (flex row)
       #btfw-leftpad   (video + stack)
       #btfw-resizer   (drag handle)
       #btfw-rightpad  (chat)
   Also:
     - Injects fallback CSS so split works even if theme CSS is missing.
     - Removes Bootstrap grid classes that force vertical stacking.
     - Persists split width in localStorage.
*/

BTFW.define("feature:layout", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  // ---- Fallback CSS (safe to keep even if your main CSS loads) ----
  function injectFallbackCSS(){
    if ($("#btfw-layout-fallback-css")) return;
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
      #btfw-leftpad, #btfw-rightpad {
        display:flex;
        flex-direction:column;
        min-height:0;
      }
      #btfw-leftpad  { flex: 0 0 62%; min-width:520px; }
      #btfw-rightpad { flex: 1 1 auto; min-width:320px; }
      #btfw-resizer  {
        flex: 0 0 6px;
        cursor: col-resize;
        background: var(--btfw-mute-800, #1f2937);
        border-left: 1px solid rgba(255,255,255,.06);
        border-right:1px solid rgba(0,0,0,.3);
      }
      /* Make chat fill height properly */
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

  // ---- Bootstrap class purger (prevents reflow to vertical) ----
  function purgeBootstrapGrid(el){
    if (!el) return;
    const classes = (el.className||"").split(/\s+/);
    const keep = classes.filter(c => !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row");
    if (keep.length !== classes.length) el.className = keep.join(" ");
  }

  // ---- Ensure structure exists and move content into place ----
  function ensureStructure(){
    injectFallbackCSS();

    let app = $("#btfw-app");
    if (!app) {
      // Place under main content container if available
      const main = $("#main") || $("#wrap") || document.body;
      app = document.createElement("div");
      app.id = "btfw-app";
      main.appendChild(app);
    }

    let left  = $("#btfw-leftpad");
    let right = $("#btfw-rightpad");
    let bar   = $("#btfw-resizer");

    if (!left)  { left  = document.createElement("div"); left.id  = "btfw-leftpad";  app.appendChild(left); }
    if (!bar)   { bar   = document.createElement("div"); bar.id   = "btfw-resizer";  app.appendChild(bar);  }
    if (!right) { right = document.createElement("div"); right.id = "btfw-rightpad"; app.appendChild(right);}

    // Ensure order: left | bar | right
    if (app.firstElementChild !== left) app.insertBefore(left, app.firstChild);
    if (bar.previousElementSibling !== left) app.insertBefore(bar, right);
    if (bar.nextElementSibling !== right) app.insertBefore(right, bar.nextSibling);

    // Move known content to correct pads if not already
    const videowrap  = $("#videowrap");
    const stack      = $("#btfw-stack") || $("#mainpage") || $("#motdwrap")?.parentElement;
    const chatwrap   = $("#chatwrap");

    // Left side: video + stack
    if (videowrap && videowrap.parentElement !== left) left.appendChild(videowrap);
    if (stack && stack.parentElement !== left) left.appendChild(stack);

    // Right side: chat
    if (chatwrap && chatwrap.parentElement !== right) right.appendChild(chatwrap);

    // Remove bootstrap grid classes that force stacking
    purgeBootstrapGrid(videowrap);
    purgeBootstrapGrid(chatwrap);

    return { app, left, right, bar };
  }

  // ---- Split persistence & resizer logic ----
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
  function onUp(){ if (!dragging) return; dragging=false; document.body.classList.remove("btfw-resizing"); }

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

  // ---- Boot + observers ----
  function boot(){
    ensureStructure();
    wireResizer();
    loadSplit(true);

    // Keep structure healthy if DOM changes massively (e.g., CyTube reflows)
    const mo = new MutationObserver(()=>{
      ensureStructure();
      wireResizer();
      // Re-apply split after DOM mutations
      loadSplit(false);
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Public helpers (optional)
  return {
    name: "feature:layout",
    setSplit(px){ applySplit(px); },
    getSplit(){ try { return parseInt(localStorage.getItem(LS_KEY)||"",10); } catch(_) { return null; } },
    reflow(){ loadSplit(false); }
  };
});
