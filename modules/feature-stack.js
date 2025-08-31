/* BTFW — feature:stack (leaf modules under video in #btfw-stack, with Up/Down reorder) */
BTFW.define("feature:stack", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);
  const LS_ORDER = "btfw:stack:order";

  // Leaf modules we manage (IDs must match your DOM)
  const DEFAULT_ORDER = [
    "btfw-controls-row",   // controls row (left/rightcontrols) — shown inside stack for consistency
    "btfw-channel-slider", // your slider (if present)
    "motdwrap",
    "playlistwrap",
    "pollwrap"
  ];

  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // avoid cycles
    parent.appendChild(child);
    return true;
  }

  function readOrder(){
    try {
      const s = localStorage.getItem(LS_ORDER);
      if (!s) return null;
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : null;
    } catch(_){ return null; }
  }
  function writeOrder(list){
    try { localStorage.setItem(LS_ORDER, JSON.stringify(list)); } catch(_){}
  }

  function currentOrder(){
    const saved = readOrder();
    const ids = new Set(DEFAULT_ORDER);
    let ordered = saved ? saved.filter(id => ids.has(id)) : DEFAULT_ORDER.slice();
    // Append any new IDs not seen before
    DEFAULT_ORDER.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    return ordered;
  }

  function ensureStack(){
    const left = document.getElementById("btfw-leftpad");
    if (!left) return null;
    let stack = document.getElementById("btfw-stack");
    if (!stack){
      stack = document.createElement("div");
      stack.id = "btfw-stack";
      stack.className = "btfw-stack";
      const anchor = document.getElementById("btfw-controls-row") || document.getElementById("videowrap");
      if (anchor && anchor.parentElement === left) anchor.insertAdjacentElement("afterend", stack);
      else left.appendChild(stack);
    } else if (stack.parentElement !== left){
      safeAppend(stack, left);
    }
    // Keep stack AFTER controls row (or after video if no controls)
    const controls = document.getElementById("btfw-controls-row");
    const video = document.getElementById("videowrap");
    if (controls && controls.parentElement === left && stack.previousElementSibling !== controls){
      controls.insertAdjacentElement("afterend", stack);
    } else if (!controls && video && video.parentElement === left && stack.previousElementSibling !== video){
      video.insertAdjacentElement("afterend", stack);
    }
    return stack;
  }

  function find(id){
    return document.getElementById(id);
  }

  function ensureMoveUI(el, id){
    if (!el || el._btfwMoveUI) return;
    el._btfwMoveUI = true;

    // Skip move UI for pinned elements? Footer is NOT in stack, so we can allow move on all here.
    const bar = document.createElement("div");
    bar.className = "btfw-stack-toolbar";
    bar.style.cssText = "display:flex;gap:6px;justify-content:flex-end;margin:4px 0;";
    bar.innerHTML = `
      <button class="button is-small" data-dir="up"   title="Move up">▲</button>
      <button class="button is-small" data-dir="down" title="Move down">▼</button>
    `;
    const btnUp = bar.querySelector('[data-dir="up"]');
    const btnDn = bar.querySelector('[data-dir="down"]');

    btnUp.addEventListener("click", (e)=>{
      e.preventDefault();
      const order = currentOrder();
      const i = order.indexOf(id);
      if (i > 0) {
        const tmp = order[i-1]; order[i-1] = order[i]; order[i] = tmp;
        writeOrder(order);
        arrange(); // re-render
      }
    });
    btnDn.addEventListener("click", (e)=>{
      e.preventDefault();
      const order = currentOrder();
      const i = order.indexOf(id);
      if (i >= 0 && i < order.length-1) {
        const tmp = order[i+1]; order[i+1] = order[i]; order[i] = tmp;
        writeOrder(order);
        arrange(); // re-render
      }
    });

    // Place toolbar at top of the module container
    el.insertBefore(bar, el.firstChild);
  }

  function arrange(){
    const stack = ensureStack();
    if (!stack) return;

    // Place modules in order
    const order = currentOrder();
    order.forEach(id => {
      const el = find(id);
      if (!el) return;
      // Controls row sometimes lives directly under leftpad; we want it inside stack visually
      // but *functionally* it’s fine either way. We’ll place it inside stack for reordering.
      safeAppend(el, stack);
      ensureMoveUI(el, id);
    });

    // Ensure FOOTER is NOT in stack and pinned after it (layout does this, but keep idempotent)
    const left   = document.getElementById("btfw-leftpad");
    const footer = document.getElementById("footer");
    if (left && footer && footer.parentElement !== left) {
      // move footer to left, as the last child
      safeAppend(footer, left);
    }
    if (left && footer && footer.previousElementSibling !== left.lastElementChild){
      // enforce footer at bottom (last child)
      safeAppend(footer, left);
    }
  }

  // Debounce with rAF
  let raf=0;
  function schedule(){ if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>{ raf=0; try{ arrange(); }catch(e){ console.error("[stack] arrange",e);} }); }

  function boot(){
    arrange();

    // Watch for the elements we care about to appear/move
    const mo = new MutationObserver((mutList)=>{
      let touched = false;
      for (const m of mutList){
        for (const n of m.addedNodes){
          if (!(n instanceof HTMLElement)) continue;
          if (n.id && (DEFAULT_ORDER.includes(n.id) || n.id === "btfw-stack" || n.id === "videowrap" || n.id === "footer")) { touched = true; break; }
          for (const id of DEFAULT_ORDER){ if (n.querySelector?.(`#${id}`)) { touched = true; break; } }
          if (touched) break;
        }
        if (touched) break;
      }
      if (touched) schedule();
    });
    mo.observe(document.body, { childList:true, subtree:true });

    document.addEventListener("btfw:layoutReady", schedule, { once:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:stack", arrange };
});
