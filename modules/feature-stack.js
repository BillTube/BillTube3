/* BTFW — feature:stack (safe module stack under video)
   Places selected leaf modules under the video in a stable, cycle-safe way.
   Default order: channel slider → MOTD → PLAYLIST → POLL.
   Important: we DO NOT move big ancestors like #mainpage to avoid DOM cycles.
*/

BTFW.define("feature:stack", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  // Which module roots to stack (leaves only; adjust if you add more)
  const ORDER = [
    "#btfw-channel-slider", // your custom slider if present
    "#motdwrap",
    "#playlistwrap",
    "#pollwrap"
  ];

  // Utility: safe append, avoiding parent/child cycles and no-ops
  function safeAppend(child, parent){
    if (!child || !parent) return false;
    if (child === parent) return false;
    if (child.parentElement === parent) return false;
    if (child.contains(parent)) {
      console.warn("[feature:stack] skip append — child contains parent:", child.id||child, "→", parent.id||parent);
      return false;
    }
    parent.appendChild(child);
    return true;
  }

  // Ensure we have a stack container INSIDE leftpad (not an ancestor of it)
  function ensureStackContainer(){
    const left = $("#btfw-leftpad");
    if (!left) return null;

    // Prefer to place after videowrap if present
    let stack = $("#btfw-stack");
    const video = $("#videowrap");

    // If an existing #btfw-stack is an ancestor of leftpad, that's unsafe — recreate
    if (stack && stack.contains(left)) {
      console.warn("[feature:stack] existing #btfw-stack contains #btfw-leftpad — recreating a safe container");
      stack = null;
    }

    if (!stack) {
      stack = document.createElement("div");
      stack.id = "btfw-stack";
      stack.className = "btfw-stack";
      if (video && video.parentElement === left) {
        video.insertAdjacentElement("afterend", stack);
      } else {
        left.appendChild(stack);
      }
    } else {
      // If it's not inside leftpad, try to move it safely
      if (stack.parentElement !== left) {
        if (!safeAppend(stack, left)) {
          // If we can't move it, make a fresh safe one inside left
          const fresh = document.createElement("div");
          fresh.id = "btfw-stack";
          fresh.className = "btfw-stack";
          if (video && video.parentElement === left) {
            video.insertAdjacentElement("afterend", fresh);
          } else {
            left.appendChild(fresh);
          }
          stack = fresh;
        }
      }
    }
    return stack;
  }

  // Arrange known modules into the stack in ORDER
  function arrange(){
    const stack = ensureStackContainer();
    if (!stack) return;

    // Ensure stack itself is not wrapping #btfw-leftpad by accident
    const left = $("#btfw-leftpad");
    if (stack.contains(left)) {
      console.warn("[feature:stack] stack contains leftpad — clearing/recreating stack");
      stack.remove();
      arrange(); // retry once with a fresh stack
      return;
    }

    ORDER.forEach(sel => {
      const el = $(sel);
      if (!el) return;

      // If this module is an ancestor of leftpad, never move it (would cycle)
      if (el.contains(left)) {
        console.warn("[feature:stack] skip", sel, "because it contains #btfw-leftpad");
        return;
      }

      // Only move leaves; common CyTube wrappers to avoid:
      // #mainpage, #wrap, #main, or anything that contains leftpad
      if (el.id === "mainpage" || el.id === "wrap" || el.id === "main") {
        console.warn("[feature:stack] skip moving ancestor wrapper:", el.id);
        return;
      }

      // Finally, append safely under the stack
      safeAppend(el, stack);
    });
  }

  // Debounced observer callback (avoid flapping)
  let rafId = 0;
  function scheduleArrange(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(()=> {
      rafId = 0;
      try { arrange(); } catch(e){ console.error("[feature:stack] arrange error:", e); }
    });
  }

  function boot(){
    arrange();

    // Watch for relevant DOM changes (modules appearing) and re-arrange safely
    const mo = new MutationObserver((mutList) => {
      // Only rescan if one of our known modules or targets appeared/moved
      const hits = mutList.some(m => {
        return Array.from(m.addedNodes||[]).some(n => {
          if (!(n instanceof HTMLElement)) return false;
          if (n.matches && (n.matches("#videowrap") || n.matches("#chatwrap") || n.matches("#btfw-leftpad") || n.matches("#btfw-stack"))) {
            return true;
          }
          return ORDER.some(sel => n.matches?.(sel) || n.querySelector?.(sel));
        });
      });
      if (hits) scheduleArrange();
    });
    mo.observe(document.body, { childList:true, subtree:true });

    // Also arrange after layout is ready (when leftpad exists)
    document.addEventListener("btfw:layoutReady", scheduleArrange, { once:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:stack", arrange };
});
