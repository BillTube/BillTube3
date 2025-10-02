/* BTFW – feature:nowplaying (simplified - just moves the element) */
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  function findCurrentTitle() {
    return $("#currenttitle") || document.querySelector(".currenttitle") || null;
  }

  function mountTitleIntoSlot() {
    // Find the slot (created by feature-chat or feature-layout)
    const slot = $("#btfw-nowplaying-slot");
    if (!slot) {
      console.warn('[nowplaying] #btfw-nowplaying-slot not found');
      return false;
    }

    // Find the title element (created by CyTube)
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

    // Watch for the element being moved elsewhere and remount it
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

    // Retry with exponential backoff if initial mount failed
    const retryDelays = [200, 500, 1000, 2000];
    let retryCount = 0;
    
    const retryMount = () => {
      const ct = findCurrentTitle();
      const slot = $("#btfw-nowplaying-slot");
      
      // Check if already properly mounted
      if (ct && slot && slot.contains(ct)) {
        console.log('[nowplaying] Title properly mounted');
        return;
      }
      
      // Try to mount again
      console.log(`[nowplaying] Retry mount attempt ${retryCount + 1}`);
      const success = mountTitleIntoSlot();
      
      // Schedule next retry if needed
      retryCount++;
      if (!success && retryCount < retryDelays.length) {
        setTimeout(retryMount, retryDelays[retryCount]);
      }
    };
    
    // Start retry chain if initial mount failed
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
