/* BTFW — feature:layout (safe split + strict order)
   Guarantees:
     #btfw-app (flex row)
       #btfw-leftpad  (column) → [ #videowrap, #btfw-stack ]
       #btfw-resizer
       #btfw-rightpad (column) → [ #chatwrap ]
   No moving of large ancestors; only places the two leaves we own.
*/

BTFW.define("feature:layout", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  // Fallback CSS so the split works even if theme CSS is late/missing
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
      }
      #btfw-leftpad, #btfw-rightpad { display:flex; flex-direction:column; min-height:0; }
      #btfw-leftpad  { flex: 0 0 62%; min-width:520px; }
      #btfw-rightpad { flex: 1 1 auto; min-width:320px; }
      #btfw-resizer  { flex: 0 0 6px; cursor: col-resize; background: var(--btfw-mute-800,#1f2937); }
      #chatwrap { display:flex; flex-direction:column; min-height:0; height:100%; }
      #messagebuffer { flex:1 1 auto; min-height:0; overflow:auto; }
      #chatlinewrap  { flex:0 0 auto; }
      body.btfw-resizing { user-select:none; cursor:col-resize; }
    `.trim();
    const style = document.createElement("style");
    style.id = "btfw-layout-fallback-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function purgeBootstrapGrid(el){
    if (!el || !el.className) return;
    const keep = el.className.split(/\s+/).filter(c => !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row");
    el.className = keep.join(" ");
  }

  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // avoid parent/child cycle
    parent.appendChild(child);
    return true;
  }

  function ensureStructure(){
    injectFallbackCSS();

    let app = $("#btfw-app");
    if (!app) {
      const mount = $("#main") || $("#wrap") || document.body;
      app = document.createElement("div");
      app.id = "btfw-app";
      mount.appendChild(app);
    }
    let left  = $("#btfw-leftpad")  || Object.assign(document.createElement("div"), {id:"btfw-leftpad"});
    let bar   = $("#btfw-resizer")  || Object.assign(document.createElement("div"), {id:"btfw-resizer"});
    let right = $("#btfw-rightpad") || Object.assign(document.createElement("div"), {id:"btfw-rightpad"});

    // Ensure order: left | bar | right
    if (!left.parentElement)  app.appendChild(left);
    if (!bar.parentElement)   app.appendChild(bar);
    if (!right.parentElement) app.appendChild(right);
    if (app.firstElementChild !== left) app.insertBefore(left, app.firstChild);
    if (bar.previousElementSibling !== left) app.insertBefore(bar, left.nextSibling);
    if (bar.nextElementSibling !== right) app.insertBefore(right, bar.nextSibling);

    // Place leaves
    const videowrap = $("#videowrap");
    const chatwrap  = $("#chatwrap");
    if (videowrap){ purgeBootstrapGrid(videowrap); safeAppend(videowrap, left); }
    if (chatwrap) { purgeBootstrapGrid(chatwrap);  safeAppend(chatwrap, right); }

    // Make sure #btfw-stack exists and is AFTER #videowrap
    let stack = $("#btfw-stack");
    if (!stack) {
      stack = document.createElement("div"); stack.id = "btfw-stack"; stack.className = "btfw-stack";
      if (videowrap && videowrap.parentElement === left) videowrap.insertAdjacentElement("afterend", stack);
      else left.appendChild(stack);
    } else {
      // ensure stack is inside left and after video
      if (stack.contains(left)) { stack.remove(); stack = document.createElement("div"); stack.id="btfw-stack"; stack.className="btfw-stack"; }
      if (stack.parentElement !== left) safeAppend(stack, left);
      if (videowrap && stack.previousElementSibling !== videowrap && videowrap.parentElement === left) {
        safeAppend(stack, left); // ensure parent correct
        videowrap.insertAdjacentElement("afterend", stack);
      }
    }

    return { app, left, right, bar, stack };
  }

  // Split persistence / resizer
  const LS_KEY   = "btfw:split:leftWidth"; // px
  const MIN_LEFT = 520, MIN_RIGHT = 320;

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
    try { const s = parseInt(localStorage.getItem(LS_KEY)||"",10); if (!isNaN(s)) L = s; } catch(_) {}
    applySplit(L);
    if (initial && !window._btfwLayoutReadyDispatched){
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

  function boot(){
    ensureStructure();
    wireResizer();
    loadSplit(true);

    // Keep strict order if DOM changes massively
    const mo = new MutationObserver(()=>{
      const { left, stack } = ensureStructure();
      // Enforce [video, stack] order inside left
      const video = $("#videowrap");
      if (video && video.parentElement !== left) safeAppend(video, left);
      if (stack && stack.parentElement !== left) safeAppend(stack, left);
      if (video && stack && stack.previousElementSibling !== video) {
        video.insertAdjacentElement("afterend", stack);
      }
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:layout", reflow(){ loadSplit(false); } };
});
