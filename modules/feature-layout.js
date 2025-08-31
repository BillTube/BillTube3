
BTFW.define("feature:layout", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);

  // ---- Config / persistence
  const LS_KEY   = "btfw:split:leftWidth"; // px
  const MIN_LEFT = 520;                    // px: ensure video+stack stay usable
  const MIN_RIGHT= 320;                    // px: keep chat usable

  let dragging   = false;
  let startX     = 0;
  let startLeftW = 0;

  function nodes(){
    return {
      app  : $("#btfw-app"),
      left : $("#btfw-leftpad"),
      right: $("#btfw-rightpad"),
      bar  : $("#btfw-resizer")
    };
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  // Apply split width to flex-basis
  function apply(leftPx){
    const { app, left, right } = nodes();
    if (!app || !left || !right) return;
    const total = app.clientWidth || window.innerWidth;
    const L = clamp(leftPx, MIN_LEFT, Math.max(MIN_LEFT, total - MIN_RIGHT));
    left.style.flexBasis  = L + "px";
    right.style.flexBasis = (total - L) + "px";
    try { localStorage.setItem(LS_KEY, String(L)); } catch(_) {}
  }

  function loadAndApply(initial=false){
    const { app, left, right } = nodes();
    if (!app || !left || !right) return;
    const total = app.clientWidth || window.innerWidth;
    let L = Math.floor(total * 0.62);
    try {
      const saved = parseInt(localStorage.getItem(LS_KEY) || "", 10);
      if (!isNaN(saved)) L = saved;
    } catch(_) {}
    apply(L);
    if (initial) {
      // Fire once to let dependents wire up sizes after first layout
      if (!window._btfwLayoutReadyDispatched) {
        window._btfwLayoutReadyDispatched = true;
        document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
      }
    }
  }

  function ensureResizer(){
    const { app, left, right, bar } = nodes();
    if (!app || !left || !right) return null;

    if (bar && bar.parentElement === app) return bar;

    // Create or move the bar between left and right
    const el = bar || document.createElement("div");
    el.id = "btfw-resizer";
    if (!bar) {
      // visual fallback (in case CSS didn’t ship for some reason)
      el.style.minWidth = "6px";
      el.style.cursor   = "col-resize";
    }
    if (right.previousElementSibling !== el) {
      app.insertBefore(el, right);
    }
    return el;
  }

  function onDown(e){
    const { app, left } = nodes();
    if (!app || !left) return;
    dragging = true;
    startX = ("touches" in e) ? e.touches[0].clientX : e.clientX;
    startLeftW = left.getBoundingClientRect().width;
    document.body.classList.add("btfw-resizing");
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    const x = ("touches" in e) ? e.touches[0].clientX : e.clientX;
    const delta = x - startX;
    apply(startLeftW + delta);
  }
  function onUp(){
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("btfw-resizing");
  }

  function wireResizer(){
    const bar = ensureResizer();
    if (!bar || bar._btfwWired) return;
    bar._btfwWired = true;

    // Mouse
    bar.addEventListener("mousedown", onDown, { passive:false });
    window.addEventListener("mousemove", onMove, { passive:false });
    window.addEventListener("mouseup",   onUp);

    // Touch
    bar.addEventListener("touchstart", onDown, { passive:false });
    window.addEventListener("touchmove", onMove, { passive:false });
    window.addEventListener("touchend",  onUp);

    // Resize
    window.addEventListener("resize", ()=> loadAndApply(false));
  }

  function observeLayoutMount(){
    // If layout mounts later or gets reparented, keep the bar present & wired
    const mo = new MutationObserver(()=>{
      ensureResizer();
      wireResizer();
      // If app width changed due to DOM mutations, reapply split
      loadAndApply(false);
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  function boot(){
    ensureResizer();
    wireResizer();
    loadAndApply(true);
    observeLayoutMount();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:layout",
    // Expose helpers if other features want to control the split
    setSplit(px){ apply(px); },
    getSplit(){
      try { return parseInt(localStorage.getItem(LS_KEY)||"",10); } catch(_) { return null; }
    },
    reflow(){ loadAndApply(false); }
  };
});
