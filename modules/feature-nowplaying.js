BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  const state = {
    lastCleanTitle: null,
    lastMediaKey: null,
    pendingUpdate: null  // ← Add debounce state
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
      slot.innerHTML = "";
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
    
    mountTitleIntoSlot();
    const existing = findCurrentTitle();
    const initialTitle = existing?.textContent || getQueueActiveTitle();
    setTitle(initialTitle);

    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", handleMediaChange);
        socket.on("setCurrent", handleMediaChange);
        socket.on("mediaUpdate", data => {
          // ✅ FIX: Use debounced version
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
          // ✅ FIX: Use debounced version
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

    // ✅ FIX: Reduce the number of retry attempts
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

  return { 
    name: "feature:nowplaying", 
    setTitle, 
    mountTitleIntoSlot 
  };
});
