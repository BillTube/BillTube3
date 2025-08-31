/* BTFW — feature:layout (strict split + controls/stack/footer placement, cycle-safe) */
BTFW.define("feature:layout", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  // Fallback CSS so split works even if theme CSS is late/missing
  function cssOnce(){
    if (document.getElementById("btfw-layout-fallback-css")) return;
    const css = `
      html,body {height:100%}
      #btfw-app{display:flex;flex-direction:row;align-items:stretch;width:100%;height:calc(100vh - var(--btfw-navbar-h,48px));min-height:480px}
      #btfw-leftpad,#btfw-rightpad{display:flex;flex-direction:column;min-height:0}
      #btfw-leftpad{flex:0 0 62%;min-width:520px}
      #btfw-rightpad{flex:1 1 auto;min-width:320px}
      #btfw-resizer{flex:0 0 6px;cursor:col-resize;background:var(--btfw-mute-800,#1f2937);border-left:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(0,0,0,.3)}
      #chatwrap{display:flex;flex-direction:column;min-height:0;height:100%}
      #messagebuffer{flex:1 1 auto;min-height:0;overflow:auto}
      #chatlinewrap{flex:0 0 auto}
      #btfw-controls-row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:8px 0}
      body.btfw-resizing{user-select:none;cursor:col-resize}
    `.trim();
    const style = document.createElement("style");
    style.id = "btfw-layout-fallback-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function purgeGrid(el){
    if (!el || !el.className) return;
    const keep = el.className.split(/\s+/).filter(c => !/^col-(xs|sm|md|lg|xl)-\d+$/i.test(c) && c.toLowerCase() !== "row");
    el.className = keep.join(" ");
  }

  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // prevent cycles
    parent.appendChild(child);
    return true;
  }

  function ensureShell(){
    cssOnce();
    let app = $("#btfw-app");
    if (!app) {
      const host = $("#main") || $("#wrap") || document.body;
      app = document.createElement("div");
      app.id = "btfw-app";
      host.appendChild(app);
    }
    let left = $("#btfw-leftpad");  if (!left){ left = document.createElement("div"); left.id="btfw-leftpad"; app.appendChild(left); }
    let bar  = $("#btfw-resizer");  if (!bar) { bar  = document.createElement("div"); bar.id ="btfw-resizer"; app.appendChild(bar); }
    let right= $("#btfw-rightpad"); if (!right){right= document.createElement("div"); right.id="btfw-rightpad";app.appendChild(right); }

    // enforce order left | bar | right
    if (app.firstElementChild !== left) app.insertBefore(left, app.firstChild);
    if (bar.previousElementSibling !== left) app.insertBefore(bar, left.nextSibling);
    if (bar.nextElementSibling !== right) app.insertBefore(right, bar.nextSibling);

    return {app,left,bar,right};
  }

  function ensureLeftColumn(){
    const {left} = ensureShell();
    const video = $("#videowrap");
    if (video){ purgeGrid(video); safeAppend(video, left); }

    // controls row (wrap left/rightcontrols)
    let row = $("#btfw-controls-row");
    if (!row){ row = document.createElement("div"); row.id="btfw-controls-row"; }
    const lc = $("#leftcontrols");
    const rc = $("#rightcontrols");
    if (lc || rc){
      if (!row.parentElement) {
        // place right under video when present, otherwise top of left
        if (video && video.parentElement === left) video.insertAdjacentElement("afterend", row);
        else left.insertBefore(row, left.firstChild);
      }
      if (lc) safeAppend(lc, row);
      if (rc) safeAppend(rc, row);
    } else {
      // if nothing to show, remove empty row
      if (row.parentElement && row.childElementCount === 0) row.remove();
    }

    // stack container under video/controls
    let stack = $("#btfw-stack");
    if (!stack){ stack = document.createElement("div"); stack.id="btfw-stack"; stack.className="btfw-stack"; }
    if (!stack.parentElement) {
      const anchor = $("#btfw-controls-row") || video;
      if (anchor && anchor.parentElement === left) anchor.insertAdjacentElement("afterend", stack);
      else left.appendChild(stack);
    }

    // footer pinned at bottom of left column (not re-orderable)
    const footer = $("#footer");
    if (footer && footer !== left.lastElementChild){
      // Place footer as the last child of left
      safeAppend(footer, left);
    }
    return {left};
  }

  // Split persistence + resizer
  const LS_KEY="btfw:split:leftWidth"; const MIN_LEFT=520, MIN_RIGHT=320;
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function applySplit(px){
    const {app,left,right} = ensureShell();
    const total = app.clientWidth || window.innerWidth;
    const L = clamp(px, MIN_LEFT, Math.max(MIN_LEFT, total - MIN_RIGHT));
    left.style.flexBasis  = L + "px";
    right.style.flexBasis = (total - L) + "px";
    try { localStorage.setItem(LS_KEY, String(L)); } catch(_) {}
  }
  function loadSplit(initial=false){
    ensureLeftColumn();
    const {app} = ensureShell();
    const total = app.clientWidth || window.innerWidth;
    let L = Math.floor(total*0.62);
    try { const s = parseInt(localStorage.getItem(LS_KEY)||"",10); if (!isNaN(s)) L = s; } catch(_){}
    applySplit(L);
    if (initial && !window._btfwLayoutReadyDispatched){
      window._btfwLayoutReadyDispatched=true;
      document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
    }
  }

  let dragging=false, startX=0, startL=0;
  function onDown(e){
    const {left}=ensureShell();
    dragging=true; startX=("touches" in e)?e.touches[0].clientX:e.clientX; startL=left.getBoundingClientRect().width;
    document.body.classList.add("btfw-resizing"); e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    const x=("touches" in e)?e.touches[0].clientX:e.clientX;
    applySplit(startL + (x - startX));
  }
  function onUp(){ if(!dragging) return; dragging=false; document.body.classList.remove("btfw-resizing"); }

  function wire(){
    const {bar}=ensureShell();
    if (!bar || bar._wired) return;
    bar._wired=true;
    bar.addEventListener("mousedown", onDown, {passive:false});
    bar.addEventListener("touchstart", onDown, {passive:false});
    window.addEventListener("mousemove", onMove, {passive:false});
    window.addEventListener("touchmove", onMove, {passive:false});
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("resize", ()=>loadSplit(false));
  }

  function boot(){
    ensureLeftColumn();
    wire();
    loadSplit(true);

    // keep order stable if DOM shifts
    const mo = new MutationObserver(()=>{
      ensureLeftColumn();
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:layout", reflow(){ loadSplit(false); } };
});
