/* BTFW — feature:layout (native CyTube panes)
   Uses #leftpane / #rightpane; adds a resizer between them; makes #wrap>.row a flex row.
   Also moves #footer into #leftpane (last) so it stays with the content stack.
*/

BTFW.define("feature:layout", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  // ---------- Helpers ----------
  function purgeGrid(el){
    if (!el || !el.className) return;
    const keep = el.className.split(/\s+/).filter(c => !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row");
    el.className = keep.join(" ");
  }
  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // avoid cycles
    parent.appendChild(child);
    return true;
  }
  function cssOnce(){
    if (document.getElementById("btfw-layout-native-css")) return;
    const css = `
      /* make the CyTube row truly horizontal */
      #wrap > .row { display:flex; flex-direction:row; align-items:stretch; gap:0; }
      #leftpane, #rightpane { display:flex; flex-direction:column; min-height:0; }
      #leftpane  { min-width:520px; }
      #rightpane { min-width:320px; }
      #btfw-resizer { flex:0 0 6px; background:var(--btfw-mute-800,#1f2937); cursor:col-resize; }
      /* chat fill */
      #chatwrap { display:flex; flex-direction:column; height:100%; min-height:0; }
      #messagebuffer { flex:1 1 auto; min-height:0; overflow:auto; }
      #chatlinewrap  { flex:0 0 auto; }
      body.btfw-resizing { user-select:none; cursor:col-resize; }
    `.trim();
    const st = document.createElement("style");
    st.id = "btfw-layout-native-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- Core ----------
  const LS_KEY   = "btfw:split:leftWidth";
  const MIN_LEFT = 520;
  const MIN_RIGHT= 320;

  function getPanes(){
    // Typical structure: #wrap > .row > (#leftpane, #rightpane)
    const left  = $("#leftpane");
    const right = $("#rightpane");
    const row   = left?.parentElement || right?.parentElement;
    return { left, right, row };
  }

  function ensureResizer(){
    const { left, right, row } = getPanes();
    if (!left || !right || !row) return null;

    cssOnce();

    // Normalize: remove bootstrap grid constraints on panes
    purgeGrid(left); purgeGrid(right);

    // Ensure there's a resizer sibling between them
    let bar = $("#btfw-resizer");
    if (!bar){
      bar = document.createElement("div");
      bar.id = "btfw-resizer";
      row.insertBefore(bar, right);
    } else {
      if (bar.parentElement !== row) row.insertBefore(bar, right);
    }
    return bar;
  }

  function applySplit(px){
    const { left, right, row } = getPanes();
    if (!left || !right || !row) return;

    // Compute within the row width
    const total = row.clientWidth || window.innerWidth;
    const L = Math.max(MIN_LEFT, Math.min(px, Math.max(MIN_LEFT, total - MIN_RIGHT)));

    left.style.flex   = `0 0 ${L}px`;
    right.style.flex  = `1 1 auto`;
    right.style.minWidth = MIN_RIGHT + "px";
    try { localStorage.setItem(LS_KEY, String(L)); } catch(_) {}
  }

  function loadSplit(initial=false){
    const { row } = getPanes();
    if (!row) return;
    let L = Math.floor((row.clientWidth || window.innerWidth) * 0.62);
    try {
      const s = parseInt(localStorage.getItem(LS_KEY)||"",10);
      if (!isNaN(s)) L = s;
    } catch(_){}
    applySplit(L);
    if (initial && !window._btfwLayoutReadyDispatched){
      window._btfwLayoutReadyDispatched = true;
      document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
    }
  }

  function moveFooterIntoLeft(){
    const { left } = getPanes();
    if (!left) return;
    const footer = $("#footer");
    if (footer && footer.parentElement !== left) safeAppend(footer, left);
    if (footer && footer !== left.lastElementChild) safeAppend(footer, left); // keep last
  }

  function wireResizer(){
    const bar = ensureResizer();
    if (!bar || bar._btfwWired) return;
    bar._btfwWired = true;

    let dragging=false, startX=0, startL=0;
    function onDown(e){
      const { left } = getPanes();
      if (!left) return;
      dragging=true;
      startX=("touches" in e)?e.touches[0].clientX:e.clientX;
      startL=left.getBoundingClientRect().width;
      document.body.classList.add("btfw-resizing");
      e.preventDefault();
    }
    function onMove(e){
      if (!dragging) return;
      const x=("touches" in e)?e.touches[0].clientX:e.clientX;
      applySplit(startL + (x - startX));
    }
    function onUp(){
      if (!dragging) return;
      dragging=false;
      document.body.classList.remove("btfw-resizing");
    }

    bar.addEventListener("mousedown",  onDown, {passive:false});
    bar.addEventListener("touchstart", onDown, {passive:false});
    window.addEventListener("mousemove", onMove, {passive:false});
    window.addEventListener("touchmove", onMove, {passive:false});
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchend",  onUp);
    window.addEventListener("resize", ()=> loadSplit(false));
  }

  function boot(){
    ensureResizer();
    moveFooterIntoLeft();
    wireResizer();
    loadSplit(true);

    // Keep it stable if CyTube reflows
    const mo = new MutationObserver(()=>{
      ensureResizer();
      moveFooterIntoLeft();
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:layout", reflow(){ loadSplit(false); } };
});
