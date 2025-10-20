/* BTFW – feature:nowplaying */
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  const state = {
    lastCleanTitle: null,
    lastMediaKey: null,
    pendingUpdate: null,
    lastLookupInfo: null
  };

  function deriveLookupInfo(rawTitle) {
    const original = String(rawTitle || "").trim();

    if (!original) {
      return {
        original: "",
        base: "",
        year: "",
        canonical: "",
        query: ""
      };
    }

    const parenMatch = original.match(/\(\s*((?:19|20)\d{2})\s*\)\s*$/);
    let base = original;
    let year = "";
    let canonical = original;

    if (parenMatch) {
      year = parenMatch[1];
      const basePart = original.slice(0, parenMatch.index).trim();
      base = basePart;
      canonical = basePart ? `${basePart} (${year})` : `(${year})`;
    } else {
      const bareYearMatch = /(?:^|[\s,;:|/-])((?:19|20)\d{2})\s*$/.exec(original);
      if (bareYearMatch) {
        year = bareYearMatch[1];
        const basePart = original
          .slice(0, bareYearMatch.index)
          .replace(/[\s,;:|/-]+$/, "")
          .trim();

        if (basePart) {
          base = basePart;
          canonical = `${basePart} (${year})`;
        } else {
          base = original;
          canonical = original;
        }
      }
    }

    if (!base) {
      base = original;
    }

    const query = canonical || base || original;

    return {
      original,
      base,
      year,
      canonical,
      query
    };
  }

  function setLookupDataset(el, info) {
    if (!el || !info) return;
    const map = el.dataset;
    const canonical = info.canonical || "";
    const base = info.base || "";
    const year = info.year || "";
    const original = info.original || canonical || base || "";
    const query = info.query || canonical || original;

    map.btfwLookup = canonical;
    map.btfwLookupQuery = query;
    map.btfwLookupBase = base;
    map.btfwLookupYear = year;
    map.btfwLookupOriginal = original;
  }

  function applyLookupMetadata(info, options = {}) {
    const normalized = info
      ? {
          original: info.original || "",
          base: info.base || "",
          year: info.year || "",
          canonical: info.canonical || info.query || info.original || "",
          query: info.query || info.canonical || info.original || ""
        }
      : {
          original: "",
          base: "",
          year: "",
          canonical: "",
          query: ""
        };

    state.lastLookupInfo = normalized;

    const ct = findCurrentTitle();
    if (ct) {
      setLookupDataset(ct, normalized);
    }

    const slot = $("#btfw-nowplaying-slot");
    if (slot) {
      setLookupDataset(slot, normalized);
    }

    try {
      window.BTFW = window.BTFW || {};
      window.BTFW.nowPlayingLookup = { ...normalized };
      if (!window.BTFW.normalizeTitleForLookup) {
        window.BTFW.normalizeTitleForLookup = deriveLookupInfo;
      }
    } catch (_) {}

    if (!options.skipEvent) {
      try {
        document.dispatchEvent(
          new CustomEvent("btfw:nowplayingLookup", { detail: { ...normalized } })
        );
      } catch (_) {}
    }
  }

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
      if (state.lastLookupInfo) {
        applyLookupMetadata(state.lastLookupInfo, { skipEvent: true });
      }
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

    const title = newTitle || ct.textContent || getQueueActiveTitle();
    const cleanTitle = stripPrefix(title);

    if (!cleanTitle) {
      return false;
    }

    const currentText = stripPrefix(ct.textContent || "");
    
    if (currentText !== cleanTitle || options.force) {
      ct.textContent = cleanTitle;
      const lookupInfo = deriveLookupInfo(cleanTitle);
      ct.title = lookupInfo.canonical || cleanTitle;
      ct.style.setProperty("--length", String(cleanTitle.length));
      state.lastCleanTitle = cleanTitle;
      applyLookupMetadata(lookupInfo);
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
    // Handle both object with title and just queue position number
    if (data && typeof data === 'object' && data.title) {
      setTitle(data.title, { force: true });
      mountTitleIntoSlot();

      const mediaKey = mediaIdentity(data);
      if (mediaKey) {
        state.lastMediaKey = mediaKey;
      }
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

  function requestMediaInfo() {
    // Don't request if we already have a title
    if (state.lastCleanTitle) {
      return;
    }
    
    if (window.socket && socket.connected) {
      socket.emit('playerReady');
    } else if (window.socket) {
      socket.once('connect', () => {
        socket.emit('playerReady');
      });
    }
  }

  function boot() {
    mountTitleIntoSlot();

    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", handleMediaChange);
        socket.on("setCurrent", handleMediaChange);
        socket.on("mediaUpdate", data => {
          if (data && data.title) {
            debouncedSetTitle(data.title, { force: false });
          }
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

    // Request media info from server immediately and after delays
    setTimeout(requestMediaInfo, 500);
    setTimeout(requestMediaInfo, 2000);
    
    // Also request when theme is ready
    document.addEventListener('btfw:ready', () => {
      setTimeout(requestMediaInfo, 500);
    });

    [500, 1500].forEach(delay => {
      setTimeout(() => {
        mountTitleIntoSlot();
        const ct = findCurrentTitle();
        if (ct && ct.textContent) {
          const existing = ct.textContent.trim();
          if (existing) {
            setTitle(existing, { force: true });
          }
        }
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
