/* BTFW – feature:nowplaying */
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

  // NEW: Get title directly from CyTube's PLAYER object
  function getTitleFromPlayer() {
    try {
      if (window.PLAYER && window.PLAYER.mediaTitle) {
        return window.PLAYER.mediaTitle;
      }
    } catch (e) {}
    return "";
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

    // Try multiple sources for the title
    const title = newTitle || getTitleFromPlayer() || ct.textContent || getQueueActiveTitle();
    const cleanTitle = stripPrefix(title);

    if (!cleanTitle) {
      console.log('[nowplaying] No title available yet');
      return false;
    }

    const currentText = stripPrefix(ct.textContent || "");
    
    // Only update if different or forced
    if (currentText !== cleanTitle || options.force) {
      ct.textContent = cleanTitle;
      ct.title = cleanTitle;
      ct.style.setProperty("--length", String(cleanTitle.length));
      state.lastCleanTitle = cleanTitle;
      console.log('[nowplaying] Set title:', cleanTitle);
      return true;
    }

    return false;
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
    console.log('[nowplaying] Media changed:', data);
    const title = data?.title || getTitleFromPlayer();
    setTitle(title, { force: true });
    mountTitleIntoSlot();
  }

  // Continuously poll for title updates
  function startTitlePolling() {
    setInterval(() => {
      const currentDisplayed = stripPrefix(findCurrentTitle()?.textContent || "");
      const actualTitle = getTitleFromPlayer();
      
      if (actualTitle && stripPrefix(actualTitle) !== currentDisplayed) {
        console.log('[nowplaying] Detected title change via polling');
        setTitle(actualTitle, { force: true });
      }
    }, 2000); // Check every 2 seconds
  }

  function boot() {
    console.log('[nowplaying] Initializing...');
    
    mountTitleIntoSlot();

    // Try to set initial title
    setTimeout(() => {
      const title = getTitleFromPlayer() || getQueueActiveTitle();
      if (title) {
        setTitle(title, { force: true });
      }
    }, 1000);

    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", handleMediaChange);
        socket.on("setCurrent", handleMediaChange);
      }
    } catch (e) {
      console.warn('[nowplaying] Socket not available:', e);
    }

    // Start polling for title changes
    startTitlePolling();

    // Retry mounting periodically
    [2000, 4000].forEach(delay => {
      setTimeout(() => {
        mountTitleIntoSlot();
        const title = getTitleFromPlayer();
        if (title) setTitle(title, { force: true });
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
