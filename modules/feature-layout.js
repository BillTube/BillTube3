/* BTFW — feature:layout (native CyTube panes; force flex on the real container) */
BTFW.define("feature:layout", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  // ---- utilities
  function purgeGrid(el){
    if (!el || !el.className) return;
    const keep = el.className.split(/\s+/).filter(c =>
      !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row"
    );
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

  // find the *closest* ancestor that contains both left & right
  function findCommonContainer(left, right){
    if (!left || !right) return null;
    let a = left.parentElement;
    while (a && a !== document.body){
      if (a.contains(right)) return a;
      a = a.parentElement;
    }
    return null;
  }

  function forceFlexRow(row){
    // inline styles so we don’t rely on selectors that may miss on some channels
    row.style.display      = "flex";
    row.style.flexDirection= "row";
    row.style.alignItems   = "stretch";
    row.style.flexWrap     = "nowrap";
    row.style.gap          = "0px";
    row.style.minHeight    = "0";
  }

  // basic chat fill so it doesn’t collapse
  function cssOnce(){
    if (document.getElementById("btfw-layout-native-css")) return;
    const css = `
      #leftpane,#rightpane{display:flex;flex-direction:column;min-height:0}
      #chatwrap{display:flex;flex-direction:column;min-height:0;height:100%}
      #messagebuffer{flex:1 1 auto;min-height:0;overflow:auto}
      #chatlinewrap{flex:0 0 auto}
      #btfw-resizer{flex:0 0 6px;cursor:col-resize;background:var(--btfw-mute-800,#1f2937)}
      body.btfw-resizing{user-select:none;cursor:col-resize}
    `.trim();
    const st=document.createElement("style");
    st.id="btfw-layout-native-css";
    st.textContent=css;
    document.head.appendChild(st);
  }

  const LS_KEY="btfw:split:leftWidth";
  const MIN_LEFT=520, MIN_RIGHT=320;

  function getPieces(){
    const left  = $("#leftpane");
    const right = $("#rightpane");
    const row   = findCommonContainer(left, right); // <-- robust
    return {left, right, row};
  }

  function ensureResizer(){
    cssOnce();
    const {left, right, row} = getPieces();
    if (!left || !right || !row) return null;

    // make the real container a flex row
    forceFlexRow(row);

    purgeGrid(left); purgeGrid(right);

    // ensure order: left | bar | right (all direct children of row)
    let bar = $("#btfw-resizer");
    if (!bar){
      bar = document.createElement("div");
      bar.id = "btfw-resizer";
    }
    // if panes aren’t direct children of row, we cannot insert the bar → bail safely
    if (left.parentElement !== row || right.parentElement !== row){
      console.warn("[layout] left/right are not siblings of the same row; cannot place resizer reliably");
      return null;
    }
    if (!bar.parentElement) row.insertBefore(bar, right);
    if (row.firstElementChild !== left) row.insertBefore(left, row.firstChild);
    if (bar.previousElementSibling !== left) row.insertBefore(bar, left.nextSibling);
    if (bar.nextElementSibling !== right) row.insertBefore(right, bar.nextSibling);

    return bar;
  }

  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function applySplit(px){
    const {left,right,row} = getPieces();
    if (!left || !right || !row) return;
    const total = row.clientWidth || window.innerWidth;
    const L = clamp(px, MIN_LEFT, Math.max(MIN_LEFT, total - MIN_RIGHT));
    left.style.flex  = `0 0 ${L}px`;
    left.style.minWidth = `${MIN_LEFT}px`;
    right.style.flex = `1 1 auto`;
    right.style.minWidth = `${MIN_RIGHT}px`;
    try { localStorage.setItem(LS_KEY, String(L)); } catch(_){}
  }
  function loadSplit(initial=false){
    const {row} = getPieces();
    if (!row) return;
    let L = Math.floor((row.clientWidth || window.innerWidth) * 0.62);
    try { const s=parseInt(localStorage.getItem(LS_KEY)||"",10); if(!isNaN(s)) L=s; } catch(_){}
    applySplit(L);
    if (initial && !window._btfwLayoutReadyDispatched){
      window._btfwLayoutReadyDispatched=true;
      document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
    }
  }

  function moveFooterIntoLeft(){
    const {left} = getPieces();
    if (!left) return;
    const footer = $("#footer");
    if (footer && footer.parentElement !== left) safeAppend(footer, left);
    if (footer && footer !== left.lastElementChild) safeAppend(footer, left);
  }

  function wireResizer(){
    const bar = ensureResizer();
    if (!bar || bar._btfwWired) return;
    bar._btfwWired = true;

    let dragging=false, startX=0, startL=0;
    function onDown(e){
      const {left} = getPieces(); if (!left) return;
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
    function onUp(){ if(!dragging) return; dragging=false; document.body.classList.remove("btfw-resizing"); }

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

    // keep it stable if DOM reflows
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
