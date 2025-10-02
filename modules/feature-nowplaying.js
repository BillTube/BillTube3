/* BTFW – feature:nowplaying (Fixed version with robust mounting) */
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  const state = {
    lastCleanTitle: null,
    lastMediaKey: null,
    pendingUpdate: null
  };

  function stripPrefix(t) {
    return String(t || "")
      .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "")
      .replace(/[.]/g, ' ')
      .trim();
  }

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
      console.log('[nowplaying] Created topbar');
    }
    
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
      console.log('[nowplaying] Created slot');
    }
    
    return slot;
  }

  function findCurrentTitle() {
    return $("#currenttitle") || document.querySelector(".currenttitle") || null;
  }

  function createCurrentTitle() {
    const ct = document.createElement("span");
    ct.id = "currenttitle";
    ct.className = "btfw-nowplaying";
    return ct;
  }

  function mountTitleIntoSlot() {
    const slot = ensureSlot();
    if (!slot) {
      console.warn('[nowplaying] Cannot mount - slot unavailable');
      return false;  // Return false to indicate failure
    }

    let ct = findCurrentTitle();
    if (!ct) {
      ct = createCurrentTitle();
      console.log('[nowplaying] Created new currenttitle element');
    }

    // ✅ CRITICAL FIX: Only clear and mount if needed
    if (ct.parentElement !== slot) {
      // Don't clear innerHTML if slot already contains the correct element
      if (slot.firstChild !== ct) {
        slot.innerHTML = "";
      }
      slot.appendChild(ct);
      ct.classList.add("btfw-nowplaying");
      console.log('[nowplaying] Mounted title into slot');
    }
    
    return true;  // Success
  }

  function getQueueActiveTitle() {
    const active = document.querySelector("#queue .queue_active .qe_title a, #queue .queue_active .qe_title");
    return active && active.textContent ? active.textContent.trim() : "";
  }

  function setTitle(newTitle, options = {}) {
    let ct = findCurrentTitle();
    if (!ct) {
      ct = createCurrentTitle();
      const slot = ensureSlot();
      if (slot) {
        slot.appendChild(ct);
      }
    }

    const title = newTitle || getQueueActiveTitle();
    const cleanTitle = stripPrefix(title);

    const currentText = ct.textContent || "";
    const nextText = cleanTitle || "";
    
    // ✅ FIX: More strict check - only update if ACTUALLY different
    const textChanged = currentText !== nextText;
    const titleAttrChanged = ct.title !== nextText;
    const titleStateChanged = state.lastCleanTitle !== cleanTitle;
    
    const needsUpdate = textChanged || titleAttrChanged || options.force;

    if (!needsUpdate && !titleStateChanged) {
      return false;
    }

    // ✅ FIX: Only update DOM if actually changed
    if (textChanged || options.force) {
      ct.textContent = cleanTitle || "";
    }
    
    if (titleAttrChanged || options.force) {
      ct.title = cleanTitle || "";
    }
    
    const currentLength = ct.style.getPropertyValue("--length");
    const newLength = String((cleanTitle || "").length);
    if (currentLength !== newLength) {
      ct.style.setProperty("--length", newLength);
    }

    state.lastCleanTitle = cleanTitle;

    if (titleStateChanged || options.forceLog) {
      console.log('[nowplaying] Set title:', cleanTitle);
    }

    return true;
  }

  // ✅ FIX: Add debouncing to handle rapid socket events
  function debouncedSetTitle(title, options = {}) {
    if (state.pendingUpdate) {
      clearTimeout(state.pendingUpdate);
    }
    
    // If it's a force update, do it immediately
    if (options.force) {
      setTitle(title, options);
      return;
    }
    
    // Otherwise debounce
    state.pendingUpdate = setTimeout(() => {
      state.pendingUpdate = null;
      setTitle(title, options);
    }, 100);
  }

  function handleMediaChange(data) {
    const mediaKey = mediaIdentity(data);
    const forceUpdate = mediaKey && mediaKey !== state.lastMediaKey;
    
    // ✅ FIX: Use debounced version for non-forced updates
    if (forceUpdate) {
      setTitle(data?.title || "", { force: true, forceLog: true });
      mountTitleIntoSlot();
      if (mediaKey) {
        state.lastMediaKey = mediaKey;
      }
    } else {
      debouncedSetTitle(data?.title || "");
    }
  }

  function mediaIdentity(media) {
    if (!media) return "";

    const parts = [
      media.uid,
      media.queue?.uid,
      media.qe?.uid,
      media.temp?.uid,
      media.uniqueID,
      media.id && media.type ? `${media.type}:${media.id}` : null,
      media.id,
      media.title ? stripPrefix(media.title) : null
    ]
      .map(value => (value === undefined || value === null) ? null : String(value))
      .filter(value => value);

    if (!parts.length) return "";

    return `m:${parts.join('|')}`;
  }

  function boot() {
    console.log('[nowplaying] Initializing...');
    
    // ✅ Initial mount attempt with success tracking
    const mounted = mountTitleIntoSlot();
    const existing = findCurrentTitle();
    const initialTitle = existing?.textContent || getQueueActiveTitle();
    setTitle(initialTitle);

    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", handleMediaChange);
        socket.on("setCurrent", handleMediaChange);
        socket.on("mediaUpdate", data => {
          debouncedSetTitle(data?.title, { force: false });
          mountTitleIntoSlot();
        });
      }
    } catch (e) {
      console.warn('[nowplaying] Socket not available:', e);
    }

    try {
      if (window.Callbacks && Callbacks.changeMedia) {
        const originalChangeMedia = Callbacks.changeMedia;
        Callbacks.changeMedia = function(data) {
          originalChangeMedia(data);
          handleMediaChange(data);
        };
      }
    } catch (e) {
      console.warn('[nowplaying] Could not override Callbacks.changeMedia:', e);
    }

    const q = $("#queue");
    if (q && !q._btfwNPObs) {
      const mo = new MutationObserver(() => {
        const queueTitle = getQueueActiveTitle();
        if (queueTitle) {
          debouncedSetTitle(queueTitle);
        }
        mountTitleIntoSlot();
      });
      mo.observe(q, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class'] 
      });
      q._btfwNPObs = mo;
    }

    // ✅ FIX: Watch for title element being moved elsewhere
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

    // ✅ FIX: Watch for chatwrap being added or modified
    if (!document._btfwNpChatwrapObs) {
      const chatwrapObs = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const chatwrap = $("#chatwrap");
            if (chatwrap) {
              const slot = chatwrap.querySelector("#btfw-nowplaying-slot");
              const ct = findCurrentTitle();
              
              // If slot exists but doesn't contain title, mount it
              if (slot && ct && !slot.contains(ct)) {
                console.log('[nowplaying] Chatwrap modified, remounting title');
                mountTitleIntoSlot();
              }
            }
          }
        }
      });
      
      chatwrapObs.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      document._btfwNpChatwrapObs = chatwrapObs;
    }

    // ✅ IMPROVED: Exponential retry with verification
    const retryDelays = [200, 500, 1000, 2000];
    let retryCount = 0;
    
    const retryMount = () => {
      const ct = findCurrentTitle();
      const slot = $("#btfw-nowplaying-slot");
      
      // ✅ Check if already properly mounted
      if (ct && slot && slot.contains(ct)) {
        console.log('[nowplaying] Title properly mounted, stopping retries');
        return;
      }
      
      // Try to mount again
      console.log(`[nowplaying] Retry mount attempt ${retryCount + 1}`);
      const success = mountTitleIntoSlot();
      
      // ✅ Schedule next retry if needed and we haven't exhausted attempts
      retryCount++;
      if (!success && retryCount < retryDelays.length) {
        setTimeout(retryMount, retryDelays[retryCount]);
      } else if (success) {
        const title = getQueueActiveTitle();
        if (title) setTitle(title);
      } else {
        console.warn('[nowplaying] Exhausted retry attempts, title may not be visible');
      }
    };
    
    // Start retry chain if initial mount failed or for robustness
    if (!mounted) {
      console.log('[nowplaying] Initial mount failed, starting retry chain');
      setTimeout(retryMount, retryDelays[0]);
    } else {
      // Even if mounted successfully, do one verification check
      setTimeout(() => {
        const ct = findCurrentTitle();
        const slot = $("#btfw-nowplaying-slot");
        if (!ct || !slot || !slot.contains(ct)) {
          console.log('[nowplaying] Verification failed, starting retry chain');
          retryMount();
        }
      }, retryDelays[0]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { 
    name: "feature:nowplaying", 
    setTitle, 
    mountTitleIntoSlot 
  };
});
