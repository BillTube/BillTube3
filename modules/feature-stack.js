/* BTFW — feature:stack (leaf modules under video, cycle-safe)
   Stacks specific leaves into #btfw-stack in this order:
     1) #btfw-channel-slider  2) #motdwrap  3) #playlistwrap  4) #pollwrap
   Never moves large ancestors. Every move is cycle-checked.
*/

BTFW.define("feature:stack", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);

  // Alternatives in case IDs differ slightly on your CyTube build
  const TARGETS = [
    { name:"slider",   selectors: ["#btfw-channel-slider"] },
    { name:"motd",     selectors: ["#motdwrap", "#motdrow", "#motd-container", "#motd"] },
    { name:"playlist", selectors: ["#playlistwrap", "#playlistrow", "#playlist"] },
    { name:"poll",     selectors: ["#pollwrap", "#pollpane", "#poll"] }
  ];

  function findFirst(selectors){
    for (const s of selectors){ const el = document.querySelector(s); if (el) return el; }
    return null;
  }

  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return true;
    if (child.contains(parent)) return false; // would create a cycle
    parent.appendChild(child);
    return true;
  }

  function ensureStack(){
    const left = document.getElementById("btfw-leftpad");
    if (!left) return null;
    let stack = document.getElementById("btfw-stack");
    // If stack somehow wraps left, recreate safely
    if (stack && stack.contains(left)) { stack.remove(); stack = null; }
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "btfw-stack";
      stack.className = "btfw-stack";
      const video = document.getElementById("videowrap");
      if (video && video.parentElement === left) {
        video.insertAdjacentElement("afterend", stack);
      } else {
        left.appendChild(stack);
      }
    } else if (stack.parentElement !== left) {
      safeAppend(stack, left);
    }
    return stack;
  }

  function arrange(){
    const stack = ensureStack();
    if (!stack) return;

    // enforce order: after #videowrap
    const video = document.getElementById("videowrap");
    if (video && stack.previousElementSibling !== video) {
      video.insertAdjacentElement("afterend", stack);
    }

    for (const t of TARGETS){
      const el = findFirst(t.selectors);
      if (!el) continue;
      // If element is an ancestor of leftpad, we must not move it (skip wrapper)
      const left = document.getElementById("btfw-leftpad");
      if (el.contains(left)) { console.warn("[stack] skip ancestor:", t.name, el.id||el); continue; }
      safeAppend(el, stack);
    }
  }

  // Debounce with rAF
  let raf = 0;
  function schedule(){ if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>{ raf=0; try{ arrange(); }catch(e){ console.error("[stack] arrange", e);} }); }

  function boot(){
    arrange();
    // Respond to layoutReady and DOM changes
    document.addEventListener("btfw:layoutReady", schedule);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:stack", arrange };
});
