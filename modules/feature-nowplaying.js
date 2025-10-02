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
    if (!cw) return null;
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

  function createCurrentTitle() {
    const ct = document.createElement("span");
    ct.id = "currenttitle";
    ct.className = "btfw-nowplaying";
    return ct;
  }

function mountTitleIntoSlot() {
    const slot = ensureSlot();
    if (!slot) return;

    let ct = findCurrentTitle();
    if (!ct) {
      ct = createCurrentTitle();
    }

    if (ct.parentElement !== slot) {
      // ✅ FIX: Don't clear slot if it already contains the currenttitle element
      const slotHasTitle = slot.contains(ct);
      if (!slotHasTitle) {
        slot.innerHTML = "";
      }
      slot.appendChild(ct);
      ct.classList.add("btfw-nowplaying");
    }
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

    // Get the title from various sources
    const title = newTitle || ct.textContent || getQueueActiveTitle();
    const cleanTitle = stripPrefix(title);

    const currentText = ct.textContent || "";
    const nextText = cleanTitle || "";
    
    const textChanged = currentText !== nextText;
    
    // Always update if the clean title is different or if forced
    if ((textChanged && cleanTitle) || options.force) {
      ct.textContent = cleanTitle;
      ct.title = cleanTitle;
      ct.style.setProperty("--length", String(cleanTitle.length));
      state.lastCleanTitle = cleanTitle;
      console.log('[nowplaying] Set title:', cleanTitle);
    }

    return true;
  }


    // If CyTube already set content, don't override it unless forced
    const cytubeContent = ct.textContent && ct.textContent.trim();
    if (cytubeContent && !options.force) {
      console.log('[nowplaying] Using CyTube content:', cytubeContent);
      state.lastCleanTitle = cytubeContent;
      return true;
    }

    // Only set title if CyTube hasn't set it yet or if forced
    const title = newTitle || getQueueActiveTitle();
    const cleanTitle = stripPrefix(title);

    const currentText = ct.textContent || "";
    const nextText = cleanTitle || "";
    
    const textChanged = currentText !== nextText;
    
    if (textChanged && cleanTitle) {
      ct.textContent = cleanTitle;
      ct.title = cleanTitle;
      ct.style.setProperty("--length", String(cleanTitle.length));
      state.lastCleanTitle = cleanTitle;
      console.log('[nowplaying] Set title:', cleanTitle);
    }

    return true;
  }

  function debouncedSetTitle(title, options = {}) {
    if (state.pendingUpdate) {
      clearTimeout(state.pendingUpdate);
    }
    
    if (options.force) {
      setTitle(title, options);
      return;
    }
    
    state.pendingUpdate = setTimeout(() => {
      state.pendingUpdate = null;
      setTitle(title, options);
    }, 100);
  }

  function handleMediaChange(data) {
    const mediaKey = mediaIdentity(data);
    const forceUpdate = mediaKey && mediaKey !== state.lastMediaKey;
    
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
    
    mountTitleIntoSlot();
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

    // Watch for title element being moved elsewhere
    if (!document._btfwNpMoveObs) {
      const obs = new MutationObserver(() => {
        const ct = findCurrentTitle();
        const slot = $("#btfw-nowplaying-slot");
        if (ct && slot && !slot.contains(ct)) {
          mountTitleIntoSlot();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      document._btfwNpMoveObs = obs;
    }

    // ✅ NEW: Watch for CyTube updating #currenttitle's text content
    if (!document._btfwNpTextObs) {
      const textObs = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const ct = findCurrentTitle();
            if (ct && ct.textContent && ct.textContent.trim()) {
              console.log('[nowplaying] CyTube updated title text:', ct.textContent.trim());
              // Just ensure it's mounted, don't override the text
              mountTitleIntoSlot();
              // Update the CSS variable
              ct.style.setProperty("--length", String(ct.textContent.length));
              state.lastCleanTitle = ct.textContent.trim();
            }
          }
        }
      });
      
      // Start observing once currenttitle exists
      const waitForTitle = setInterval(() => {
        const ct = findCurrentTitle();
        if (ct) {
          textObs.observe(ct, { 
            characterData: true, 
            childList: true, 
            subtree: true 
          });
          document._btfwNpTextObs = textObs;
          clearInterval(waitForTitle);
          console.log('[nowplaying] Started watching currenttitle text changes');
        }
      }, 200);
      
      // Stop trying after 5 seconds
      setTimeout(() => clearInterval(waitForTitle), 5000);
    }

    [500, 1500].forEach(delay => {
      setTimeout(() => {
        mountTitleIntoSlot();
        const title = getQueueActiveTitle();
        if (title) setTitle(title);
      }, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
// ✅ Re-initialize when theme is fully loaded
  document.addEventListener('btfw:ready', () => {
    console.log('[nowplaying] Theme ready, re-initializing title...');
    setTimeout(() => {
      mountTitleIntoSlot();
      
      // Try to get title from CyTube's currenttitle element
      const ct = findCurrentTitle();
      if (ct && ct.textContent && ct.textContent.trim()) {
        console.log('[nowplaying] Found existing title:', ct.textContent.trim());
        ct.style.setProperty("--length", String(ct.textContent.length));
        state.lastCleanTitle = ct.textContent.trim();
      } else {
        // Fallback to queue
        const queueTitle = getQueueActiveTitle();
        if (queueTitle) {
          console.log('[nowplaying] Setting title from queue:', queueTitle);
          setTitle(queueTitle, { force: true });
        }
      }
    }, 200);
  });

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
