/* BTFW – feature:nowplaying (SIMPLIFIED - just moves the element) */
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  function ensureSlot() {
    const cw = $("#chatwrap");
    if (!cw) {
      console.warn('[nowplaying] chatwrap not found');
      return null;
    }
    
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      cw.prepend(top);
    }
    
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
    }
    
    return slot;
  }

  function findCurrentTitle() {
    return $("#currenttitle") || document.querySelector(".currenttitle") || null;
  }

  function mountTitleIntoSlot() {
    const slot = ensureSlot();
    if (!slot) {
      console.warn('[nowplaying] Cannot mount - slot unavailable');
      return false;
    }

    const ct = findCurrentTitle();
    if (!ct) {
      console.warn('[nowplaying] #currenttitle not found yet');
      return false;
    }

    // Only move it if it's not already in the slot
    if (ct.parentElement !== slot) {
      slot.appendChild(ct);
      ct.classList.add("btfw-nowplaying");
      console.log('[nowplaying] Mounted #currenttitle into slot');
    }
    
    return true;
  }

  function boot() {
    console.log('[nowplaying] Initializing...');
    
    // Try to mount immediately
    const mounted = mountTitleIntoSlot();

    // Watch for the element being moved elsewhere
    if (!document._btfwNpMoveObs) {
      const obs = new MutationObserver(() => {
        const ct = findCurrentTitle();
        const slot = $("#btfw-nowplaying-slot");
        if (ct && slot && !slot.contains(ct)) {
          console.log('[nowplaying] Title moved, remounting');
          mountTitleIntoSlot();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      document._btfwNpMoveObs = obs;
    }

    // Retry with exponential backoff
    const retryDelays = [200, 500, 1000, 2000];
    let retryCount = 0;
    
    const retryMount = () => {
      const ct = findCurrentTitle();
      const slot = $("#btfw-nowplaying-slot");
      
      if (ct && slot && slot.contains(ct)) {
        console.log('[nowplaying] Title properly mounted');
        return;
      }
      
      console.log(`[nowplaying] Retry mount attempt ${retryCount + 1}`);
      const success = mountTitleIntoSlot();
      
      retryCount++;
      if (!success && retryCount < retryDelays.length) {
        setTimeout(retryMount, retryDelays[retryCount]);
      }
    };
    
    if (!mounted) {
      setTimeout(retryMount, retryDelays[0]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { 
    name: "feature:nowplaying", 
    mountTitleIntoSlot 
  };
});
