/* BTFW – feature:nowplaying */
BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  const state = {
    lastCleanTitle: null,
    lastMediaKey: null,
    pendingUpdate: null,
    lastLookupInfo: null,
    progressTimer: null,
    progress: {
      currentTime: 0,
      duration: 0,
      paused: false,
      sampledAt: 0,
      lastPercent: null
    }
  };

  const PROGRESS_INTERVAL_MS = 1000;
  const HIDDEN_PROGRESS_INTERVAL_MS = 4000;

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

  function ensureProgress() {
    const top = $("#chatwrap .btfw-chat-topbar");
    if (!top) return null;

    let progress = top.querySelector("#btfw-playback-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.id = "btfw-playback-progress";
      progress.hidden = true;
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", "Playback progress");
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.innerHTML = '<span class="btfw-playback-progress__fill"></span>';
    }

    // Keep this as a direct grid child immediately below the title row. The
    // ratings and event modules can then occupy the following rows without
    // squeezing the title or nesting competing controls inside its slot.
    const left = top.querySelector(".btfw-chat-topbar-left");
    const anchor = left || top.querySelector("#btfw-nowplaying-slot");
    if (anchor && progress.previousElementSibling !== anchor) {
      anchor.insertAdjacentElement("afterend", progress);
    } else if (!progress.parentElement) {
      top.prepend(progress);
    }

    return progress;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function updatePlaybackSample(data, options = {}) {
    if (!data || typeof data !== "object") return;

    const durationCandidates = [data.seconds, data.duration, data.length];
    const timeCandidates = [data.currentTime, data.time, data.position];
    const duration = durationCandidates.map(finiteNumber).find(value => value > 0);
    const currentTime = timeCandidates.map(finiteNumber).find(value => value >= 0);

    if (options.reset) {
      state.progress.currentTime = 0;
      state.progress.duration = 0;
      state.progress.lastPercent = null;
    }
    if (Number.isFinite(duration)) state.progress.duration = duration;
    if (Number.isFinite(currentTime)) state.progress.currentTime = currentTime;
    if (typeof data.paused === "boolean") state.progress.paused = data.paused;
    state.progress.sampledAt = performance.now();
  }

  function readPlayback() {
    // Native/direct media is the cheapest and most accurate clock. The
    // fallbacks cover CyTube providers that wrap their own player API.
    const videos = document.querySelectorAll("#videowrap video, video");
    for (const video of videos) {
      const duration = finiteNumber(video.duration);
      const currentTime = finiteNumber(video.currentTime);
      if (duration > 0 && currentTime >= 0) {
        return { duration, currentTime, paused: Boolean(video.paused) };
      }
    }

    const player = window.PLAYER;
    const durationCandidates = [
      () => player?.getDuration?.(),
      () => player?.getLength?.(),
      () => player?.media?.seconds,
      () => player?.media?.duration,
      () => player?.player?.getDuration?.(),
      () => player?.player?.duration?.(),
      () => player?.videojs?.duration?.()
    ];
    const timeCandidates = [
      () => player?.getTime?.(),
      () => player?.getCurrentTime?.(),
      () => player?.currentTime?.(),
      () => player?.player?.getCurrentTime?.(),
      () => player?.player?.currentTime?.(),
      () => player?.videojs?.currentTime?.()
    ];
    const readFirst = (candidates, predicate) => {
      for (const read of candidates) {
        try {
          const value = finiteNumber(read());
          if (predicate(value)) return value;
        } catch (_) {}
      }
      return NaN;
    };
    const duration = readFirst(durationCandidates, value => value > 0);
    const currentTime = readFirst(timeCandidates, value => value >= 0);
    if (duration > 0 && currentTime >= 0) return { duration, currentTime, paused: false };

    const fallbackDuration = state.progress.duration;
    let fallbackTime = state.progress.currentTime;
    if (!state.progress.paused && state.progress.sampledAt) {
      fallbackTime += Math.max(0, performance.now() - state.progress.sampledAt) / 1000;
    }
    return { duration: fallbackDuration, currentTime: fallbackTime, paused: state.progress.paused };
  }

  function formatRemaining(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function updateProgress() {
    const progress = ensureProgress();
    if (!progress) return;

    const playback = readPlayback();
    if (!(playback.duration > 0) || !(playback.currentTime >= 0)) {
      progress.hidden = true;
      return;
    }

    const percent = Math.max(0, Math.min(100, (playback.currentTime / playback.duration) * 100));
    const fill = progress.querySelector(".btfw-playback-progress__fill");
    if (!fill) return;

    const previous = state.progress.lastPercent;
    const isFirstPaint = previous === null;
    const isLargeJump = previous !== null && Math.abs(percent - previous) > 4;
    progress.hidden = false;
    progress.classList.toggle("is-seeking", isLargeJump);
    if (isFirstPaint) progress.classList.add("is-initializing");
    fill.style.transform = `scaleX(${percent / 100})`;
    progress.setAttribute("aria-valuenow", String(Math.round(percent)));
    progress.setAttribute(
      "aria-valuetext",
      `${Math.round(percent)}% watched, ${formatRemaining(playback.duration - playback.currentTime)} remaining`
    );
    progress.title = `${Math.round(percent)}% watched`;
    state.progress.lastPercent = percent;

    if (isFirstPaint) {
      requestAnimationFrame(() => progress.classList.remove("is-initializing"));
    } else if (isLargeJump) {
      setTimeout(() => progress.classList.remove("is-seeking"), 260);
    }
  }

  function scheduleProgressUpdate(immediate = false) {
    if (state.progressTimer) clearTimeout(state.progressTimer);
    const delay = immediate ? 0 : (document.hidden ? HIDDEN_PROGRESS_INTERVAL_MS : PROGRESS_INTERVAL_MS);
    state.progressTimer = setTimeout(() => {
      state.progressTimer = null;
      updateProgress();
      scheduleProgressUpdate();
    }, delay);
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
    updatePlaybackSample(data, { reset: true });
    scheduleProgressUpdate(true);
    // Handle both object with title and just queue position number
    if (data && typeof data === 'object' && data.title) {
      const mediaKey = mediaIdentity(data);
      if (mediaKey) {
        state.lastMediaKey = mediaKey;
      }
      requestAnimationFrame(() => {
        setTitle(data.title, { force: true });
        mountTitleIntoSlot();
      });
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
          updatePlaybackSample(data);
          scheduleProgressUpdate(true);
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

    document.addEventListener("visibilitychange", () => scheduleProgressUpdate(true));
    scheduleProgressUpdate(true);

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
    mountTitleIntoSlot,
    updateProgress
  };
});
