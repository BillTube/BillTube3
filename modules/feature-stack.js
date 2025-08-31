/* BTFW — feature:stack (native panes)
   Creates #btfw-stack inside #leftpane, just under the video, and moves LEAF rows into it:
   order: controlsrow → btfw-channel-slider → motdrow → playlistrow → pollwrap
   Footer stays outside (layout handles it).
*/

BTFW.define("feature:stack", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  const LS_ORDER = "btfw:stack:order";
  const DEFAULT = [
    "controlsrow",
    "btfw-channel-slider",
    "motdrow",
    "playlistrow",
    "pollwrap"
  ];

  function readOrder(){
    try { const s = localStorage.getItem(LS_ORDER); if (!s) return null;
      const arr = JSON.parse(s); return Array.isArray(arr)?arr:null;
    } catch(_){ return null; }
  }
  function writeOrder(list){ try { localStorage.setItem(LS_ORDER, JSON.stringify(list)); } catch(_){} }
  function currentOrder(){
    const saved = readOrder();
    const ids = new Set(DEFAULT);
    let out = saved ? saved.filter(id => ids.has(id)) : DEFAULT.slice();
    DEFAULT.forEach(id => { if (!out.includes(id)) out.push(id); });
    return out;
  }

  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // avoid cycles
    parent.appendChild(child);
    return true;
  }

  function ensureStack(){
    const left = $("#leftpane");
    if (!left) return null;

    // Prefer to anchor after the video container if present
    const video = $("#videowrap") || left.querySelector(".embed-responsive, .videowrap");
    let stack = $("#btfw-stack");
    if (!stack){
      stack = document.createElement("div");
      stack.id = "btfw-stack";
      stack.className = "btfw-stack";
      if (video && video.parentElement === left) video.insertAdjacentElement("afterend", stack);
      else left.insertBefore(stack, left.firstChild);
    } else if (stack.parentElement !== left){
      safeAppend(stack, left);
    }

    // Keep stack after video (if video exists)
    if (video && video.parentElement === left && stack.previousElementSibling !== video) {
      video.insertAdjacentElement("afterend", stack);
    }
    return stack;
  }

  function ensureMoveUI(el, id){
    if (!el || el._btfwMoveUI) return;
    el._btfwMoveUI = true;

    const bar = document.createElement("div");
    bar.className = "btfw-stack-toolbar";
    bar.style.cssText = "display:flex; gap:6px; justify-content:flex-end; margin:4px 0;";
    bar.innerHTML = `
      <button class="button is-small" data-dir="up"   title="Move up">▲</button>
      <button class="button is-small" data-dir="down" title="Move down">▼</button>
    `;
    const up = bar.querySelector('[data-dir="up"]');
    const dn = bar.querySelector('[data-dir="down"]');
    up.addEventListener("click", (e)=>{ e.preventDefault();
      const o = currentOrder(); const i=o.indexOf(id); if (i>0){ [o[i-1],o[i]]=[o[i],o[i-1]]; writeOrder(o); arrange(); }
    });
    dn.addEventListener("click", (e)=>{ e.preventDefault();
      const o = currentOrder(); const i=o.indexOf(id); if (i>=0 && i<o.length-1){ [o[i],o[i+1]]=[o[i+1],o[i]]; writeOrder(o); arrange(); }
    });

    el.insertBefore(bar, el.firstChild);
  }

  function arrange(){
    const stack = ensureStack();
    if (!stack) return;

    // Place modules in order
    currentOrder().forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      safeAppend(el, stack);
      ensureMoveUI(el, id);
    });
  }

  let raf=0;
  function schedule(){ if (raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ raf=0; try{ arrange(); }catch(e){ console.error("[feature:stack] arrange",e);} }); }

  function boot(){
    arrange();

    const mo = new MutationObserver((ml)=>{
      let touched=false;
      for (const m of ml){
        for (const n of m.addedNodes){
          if (!(n instanceof HTMLElement)) continue;
          if (n.id && (n.id==="leftpane" || n.id==="videowrap" || DEFAULT.includes(n.id))) { touched=true; break; }
          if (DEFAULT.some(id => n.querySelector?.("#"+id))) { touched=true; break; }
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
