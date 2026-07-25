/* BTFW — feature:player (Video.js theme + tech guards) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const PLAYER_SELECTOR = "#videowrap .video-js";
  const DEFAULT_SKIN_CLASS = "vjs-default-skin";
  const CITY_THEME_CLASS = "vjs-theme-city";
  const BIG_PLAY_CLASS = "vjs-big-play-centered";
  const INLINE_VIDEO_SELECTORS = [
    "#videowrap video",
    "#ytapiplayer video",
    "#videowrap .video-js video",
    "#videowrap .video-js .vjs-tech"
  ].join(",");
  const INLINE_VIDEO_ATTRIBUTES = {
    playsinline: "",
    "webkit-playsinline": "",
    "x5-video-player-type": "h5",
    "x5-video-player-fullscreen": "false",
    "x5-video-orientation": "portrait"
  };
  const BASE_STYLES_LINK_ID = "btfw-videojs-base-css";
  const CITY_STYLES_LINK_ID = "btfw-videojs-city-css";
  const BASE_STYLES_URLS = ["https://vjs.zencdn.net/7.20.3/video-js.css"];
  const CITY_STYLES_URLS = [
    "https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/city/index.css",
    "https://unpkg.com/@videojs/themes@1/dist/city/index.css"
  ];
  // Caption timing is intentionally kept here so the experiment is simple to
  // tune. Channels can also override the step before boot with
  // BTFW.captionSyncStepSeconds (for example, 1 for one-second jumps).
  const CAPTION_SYNC_STEP_SECONDS = 0.5;
  const CAPTION_SYNC_MIN_SECONDS = -30;
  const CAPTION_SYNC_MAX_SECONDS = 30;
  const captionSyncStates = new WeakMap();

  function ensureStylesheet(id, urls) {
    const doc = document;
    if (!doc || !doc.head) return;
    if (doc.getElementById(id)) return;

    const link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    const sources = Array.isArray(urls) ? urls.slice() : [urls];
    const tryNext = () => {
      if (!sources.length) return false;
      const href = sources.shift();
      if (!href) return tryNext();
      link.href = href;
      return true;
    };
    link.addEventListener("error", () => {
      if (tryNext()) return;
      link.remove();
    });
    if (tryNext()) {
      doc.head.appendChild(link);
    }
  }

  function baseStylesActive() {
    if (typeof window === "undefined" || !document.body) return false;
    const probe = document.createElement("div");
    probe.className = `video-js ${DEFAULT_SKIN_CLASS}`;
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    probe.style.width = "1px";
    probe.style.height = "1px";
    document.body.appendChild(probe);
    const fontSize = window.getComputedStyle(probe).fontSize;
    probe.remove();
    return fontSize && Math.abs(parseFloat(fontSize) - 10) < 0.2;
  }

  function ensureBaseStylesheet() {
    if (baseStylesActive()) return;
    const existing = document.querySelector(
      'link[href*="video-js"], link[href*="videojs"], style[data-vjs-styles]'
    );
    if (existing) return;
    ensureStylesheet(BASE_STYLES_LINK_ID, BASE_STYLES_URLS);
  }

  function ensureCityStylesheet() {
    const existing = document.querySelector(
      'link[href*="videojs" i][href*="city" i], link[href*="@videojs/themes" i][href*="city" i]'
    );
    if (existing) return;
    ensureStylesheet(CITY_STYLES_LINK_ID, CITY_STYLES_URLS);
  }

  function applyCityTheme() {
    ensureBaseStylesheet();
    ensureCityStylesheet();
    document.querySelectorAll(PLAYER_SELECTOR).forEach((player) => {
      if (player.classList.contains(DEFAULT_SKIN_CLASS)) {
        player.classList.remove(DEFAULT_SKIN_CLASS);
      }
      Array.from(player.classList).forEach((cls) => {
        if (cls.startsWith("vjs-theme-") && cls !== CITY_THEME_CLASS) {
          player.classList.remove(cls);
        }
      });
      if (!player.classList.contains(CITY_THEME_CLASS)) {
        player.classList.add(CITY_THEME_CLASS);
      }
      if (!player.classList.contains(BIG_PLAY_CLASS)) {
        player.classList.add(BIG_PLAY_CLASS);
      }
      // Mark the player as themed so css/player.css's full Video.js
      // restyle (rounded control bar, accent play button, modern progress
      // rail, big-play overlay) actually applies. Without this class the
      // rules sit dormant and the raw city skin shows through.
      if (!player.classList.contains("btfw-videojs-themed")) {
        player.classList.add("btfw-videojs-themed");
      }
    });
  }

  function getVideojsPlayer(playerEl) {
    if (!playerEl || typeof window === "undefined" || !window.videojs) return null;
    try {
      return playerEl.player || playerEl.player_ ||
        window.videojs.players?.[playerEl.id] || window.videojs(playerEl.id);
    } catch (_) {
      return null;
    }
  }

  function captionSyncStep() {
    const configured = Number(window.BTFW?.captionSyncStepSeconds);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : CAPTION_SYNC_STEP_SECONDS;
  }

  function captionSyncState(playerEl) {
    let state = captionSyncStates.get(playerEl);
    if (!state) {
      state = {
        offset: 0,
        cueTimes: new WeakMap(),
        retryTimers: [],
        eventsBound: false
      };
      captionSyncStates.set(playerEl, state);
    }
    return state;
  }

  function captionTracks(player) {
    if (!player || typeof player.textTracks !== "function") return [];
    const tracks = player.textTracks();
    const result = [];
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      if (track && (track.kind === "captions" || track.kind === "subtitles")) {
        result.push(track);
      }
    }
    return result;
  }

  function shiftTrackCues(track, state) {
    if (!track?.cues) return;
    for (let index = 0; index < track.cues.length; index += 1) {
      const cue = track.cues[index];
      if (!cue) continue;

      let original = state.cueTimes.get(cue);
      if (!original) {
        original = { startTime: cue.startTime, endTime: cue.endTime };
        state.cueTimes.set(cue, original);
      }

      const startTime = Math.max(0, original.startTime + state.offset);
      const endTime = Math.max(startTime + 0.001, original.endTime + state.offset);
      try {
        cue.startTime = startTime;
        cue.endTime = endTime;
      } catch (_) {
        // Some embedded playback technologies expose immutable cues. They are
        // left untouched while native Video.js tracks continue to sync.
      }
    }
  }

  function applyCaptionOffset(playerEl) {
    const state = captionSyncState(playerEl);
    const player = getVideojsPlayer(playerEl);
    captionTracks(player).forEach((track) => shiftTrackCues(track, state));
  }

  function scheduleCaptionOffset(playerEl) {
    const state = captionSyncState(playerEl);
    state.retryTimers.forEach(clearTimeout);
    state.retryTimers = [0, 250, 1000, 2500].map((delay) => setTimeout(() => {
      applyCaptionOffset(playerEl);
    }, delay));
  }

  function formatCaptionOffset(value) {
    if (Math.abs(value) < 0.001) return "0.0s";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}s`;
  }

  function updateCaptionSyncUi(playerEl) {
    const state = captionSyncState(playerEl);
    const formattedOffset = formatCaptionOffset(state.offset);
    playerEl.querySelectorAll(".btfw-caption-sync__value").forEach((output) => {
      if (output.value !== formattedOffset) output.value = formattedOffset;
      if (output.textContent !== formattedOffset) output.textContent = formattedOffset;
      output.classList.toggle("is-adjusted", Math.abs(state.offset) >= 0.001);
    });
    playerEl.querySelectorAll(".btfw-caption-sync__reset").forEach((reset) => {
      const shouldDisable = Math.abs(state.offset) < 0.001;
      if (reset.disabled !== shouldDisable) reset.disabled = shouldDisable;
    });

    const player = getVideojsPlayer(playerEl);
    const menuSync = playerEl.querySelector(".btfw-caption-menu-sync");
    const captionsActive = captionTracks(player).some((track) => track.mode === "showing");
    if (menuSync && menuSync.hidden === captionsActive) {
      menuSync.hidden = !captionsActive;
    }
  }

  function setCaptionOffset(playerEl, nextOffset) {
    const state = captionSyncState(playerEl);
    const clamped = Math.min(CAPTION_SYNC_MAX_SECONDS,
      Math.max(CAPTION_SYNC_MIN_SECONDS, nextOffset));
    state.offset = Math.round(clamped * 10) / 10;
    updateCaptionSyncUi(playerEl);
    scheduleCaptionOffset(playerEl);
  }

  function bindCaptionSyncEvents(playerEl) {
    const state = captionSyncState(playerEl);
    if (state.eventsBound) return;
    const player = getVideojsPlayer(playerEl);
    if (!player) return;
    state.eventsBound = true;

    const reapply = () => {
      ensureCaptionMenuSyncControls(playerEl);
      updateCaptionSyncUi(playerEl);
      scheduleCaptionOffset(playerEl);
    };
    if (typeof player.on === "function") {
      player.on("texttrackchange", reapply);
      player.on("loadeddata", reapply);
    }
    const tracks = typeof player.textTracks === "function" ? player.textTracks() : null;
    tracks?.addEventListener?.("addtrack", reapply);
    tracks?.addEventListener?.("change", reapply);
  }

  function ensureCaptionMenuSyncControls(playerEl) {
    if (!playerEl) return;
    const menuContent = playerEl.querySelector(".vjs-subs-caps-button .vjs-menu-content");
    if (!menuContent) return;

    let sync = menuContent.querySelector(".btfw-caption-menu-sync");
    if (!sync) {
      const step = captionSyncStep();
      sync = document.createElement("li");
      sync.className = "btfw-caption-menu-sync";
      sync.setAttribute("role", "none");
      sync.hidden = true;
      sync.innerHTML = `
        <button type="button" class="btfw-caption-menu-sync__step" data-caption-sync-delta="-1" aria-label="Show subtitles ${step} seconds earlier" title="Show subtitles ${step} seconds earlier">←</button>
        <output class="btfw-caption-sync__value" aria-live="polite" title="Current subtitle timing offset">0.0s</output>
        <button type="button" class="btfw-caption-menu-sync__step" data-caption-sync-delta="1" aria-label="Show subtitles ${step} seconds later" title="Show subtitles ${step} seconds later">→</button>`;
      sync.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = Number(button.dataset.captionSyncDelta);
        if (!direction) return;
        const state = captionSyncState(playerEl);
        setCaptionOffset(playerEl, state.offset + (direction * captionSyncStep()));
      });
      menuContent.prepend(sync);
    }

    bindCaptionSyncEvents(playerEl);
    updateCaptionSyncUi(playerEl);
  }

  function ensureCaptionSyncControls() {
    document.querySelectorAll(PLAYER_SELECTOR).forEach(ensureCaptionMenuSyncControls);
    document.querySelectorAll(`${PLAYER_SELECTOR} .vjs-text-track-settings`).forEach((modal) => {
      if (modal.querySelector(".btfw-caption-sync")) return;
      const playerEl = modal.closest(".video-js");
      const content = modal.querySelector(".vjs-modal-dialog-content");
      if (!playerEl || !content) return;

      const heading = document.createElement("header");
      heading.className = "btfw-caption-settings__header";
      heading.innerHTML = `<h2>Caption settings</h2><p>Customize how subtitles look and line them up with the video.</p>`;
      content.prepend(heading);

      const sync = document.createElement("section");
      sync.className = "btfw-caption-sync";
      sync.setAttribute("aria-labelledby", "btfw-caption-sync-title");
      const step = captionSyncStep();
      sync.innerHTML = `
        <div class="btfw-caption-sync__copy">
          <h3 id="btfw-caption-sync-title">Subtitle timing</h3>
          <p>Negative shows captions earlier; positive shows them later.</p>
        </div>
        <div class="btfw-caption-sync__controls">
          <button type="button" class="btfw-caption-sync__step" data-caption-sync-delta="-1" aria-label="Show subtitles ${step} seconds earlier" title="Subtitles earlier">
            <span aria-hidden="true">←</span>
          </button>
          <output class="btfw-caption-sync__value" aria-live="polite">0.0s</output>
          <button type="button" class="btfw-caption-sync__step" data-caption-sync-delta="1" aria-label="Show subtitles ${step} seconds later" title="Subtitles later">
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" class="btfw-caption-sync__reset" disabled>Reset</button>
        </div>`;

      const controls = content.querySelector(".vjs-track-settings-controls");
      content.insertBefore(sync, controls || null);
      sync.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.classList.contains("btfw-caption-sync__reset")) {
          setCaptionOffset(playerEl, 0);
          return;
        }
        const direction = Number(button.dataset.captionSyncDelta);
        if (!direction) return;
        const state = captionSyncState(playerEl);
        setCaptionOffset(playerEl, state.offset + (direction * captionSyncStep()));
      });

      bindCaptionSyncEvents(playerEl);
      updateCaptionSyncUi(playerEl);
    });
  }

  function applyPosterUrl() {
    if (typeof window === "undefined") return;
    
    const posterUrl = window.BTFW?.channelPosterUrl;
    if (!posterUrl) return;
    
    document.querySelectorAll(PLAYER_SELECTOR).forEach(player => {
      // Set the poster attribute on the video element
      if (player.poster !== posterUrl) {
        player.poster = posterUrl;
      }
      
      // Update VideoJS poster component if it exists
      try {
        const vjsPlayer = player.player || player.player_ || (window.videojs && window.videojs.players && window.videojs.players[player.id]);
        if (vjsPlayer && typeof vjsPlayer.poster === "function") {
          vjsPlayer.poster(posterUrl);
        }
      } catch (_) {
        // Fallback: manually update the poster div
        const posterDiv = player.querySelector('.vjs-poster');
        if (posterDiv) {
          posterDiv.style.backgroundImage = `url("${posterUrl}")`;
        }
      }
    });
  }

  function togglePosterVisibility() {
    if (typeof window === "undefined") return;
    
    // Check if we have a global PLAYER object like in billtube2
    const mediaType = window.PLAYER?.mediaType;
    const posterElements = document.querySelectorAll('.vjs-poster');
    
    posterElements.forEach(poster => {
      // Hide poster for embedded video platforms (they have their own thumbnails)
      if (mediaType === 'yt' || mediaType === 'dm' || mediaType === 'vi' || mediaType === 'tw') {
        poster.classList.add('hidden');
      } else {
        // Show poster for direct files (fi), Google Drive (gd), and other media
        poster.classList.remove('hidden');
      }
    });
  }

  function ensureInlinePlayback() {
    const nodes = document.querySelectorAll(INLINE_VIDEO_SELECTORS);
    nodes.forEach((node) => {
      if (!(node instanceof HTMLVideoElement)) return;
      if (typeof node.playsInline === "boolean") {
        node.playsInline = true;
      }
      Object.entries(INLINE_VIDEO_ATTRIBUTES).forEach(([attr, value]) => {
        try {
          node.setAttribute(attr, value);
        } catch (_) {
          /* no-op */
        }
      });
    });
  }

  function patchVideojsTextContent() {
    if (typeof window === "undefined") return false;
    const vjs = window.videojs;
    if (!vjs) return false;
    const dom = vjs.dom || vjs;
    if (!dom || typeof dom.textContent !== "function") return false;
    if (dom.textContent && dom.textContent._btfwOptimized) return true;

    const original = dom.textContent.bind(dom);

    const patched = function patchedTextContent(el, text) {
      if (!el) return el;

      let currentValue;
      try {
        if (typeof el.textContent !== "undefined") {
          currentValue = el.textContent;
        } else if (typeof el.innerText !== "undefined") {
          currentValue = el.innerText;
        }
      } catch (_) {
        currentValue = undefined;
      }

      if (currentValue !== undefined) {
        const nextValue = text === null || text === undefined ? "" : String(text);
        if (currentValue === nextValue) {
          return el;
        }
      }

      return original(el, text);
    };

    patched._btfwOptimized = true;
    patched._btfwOriginal = original;
    dom.textContent = patched;

    return true;
  }

  function ensureTextContentPatch() {
    if (patchVideojsTextContent()) {
      ensureTextContentPatch._tries = 0;
      return;
    }

    if (ensureTextContentPatch._tries > 20) return;
    ensureTextContentPatch._tries = (ensureTextContentPatch._tries || 0) + 1;

    setTimeout(ensureTextContentPatch, 250);
  }

  /* ===== Guard: block context menu + surface click-to-pause ===== */
  const GUARD_MARK = "_btfwGuarded";

  function shouldAllowClick(target) {
    if (!target) return false;

    const allowSelectors = [
      ".vjs-control-bar",
      ".vjs-control",
      ".vjs-menu",
      ".vjs-menu-content",
      ".vjs-slider",
      ".vjs-volume-panel",
      ".vjs-text-track-settings",  
      ".vjs-tech .alert",
      ".vjs-tech [role=\"alert\"]",
      ".vjs-tech [role=\"dialog\"]",
      ".vjs-tech .modal",
      ".vjs-tech .modal-dialog"
    ].join(",");

    if (target.closest(allowSelectors)) {
      return true;
    }

    return false;
  }

  function attachGuardsTo(el) {
    if (!el || el[GUARD_MARK]) return;
    el[GUARD_MARK] = true;

    const block = (e) => {
      if (shouldAllowClick(e.target)) return;
      if (e.type === "click" && e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    el.addEventListener("click", block, true);
    el.addEventListener("pointerdown", (e) => {
      if (!shouldAllowClick(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    el.addEventListener("contextmenu", block, true);
  }

  function attachGuards() {
    document.querySelectorAll(PLAYER_SELECTOR).forEach(attachGuardsTo);
  }

  function watchPlayerMount() {
    if (watchPlayerMount._mo) return;
    
    const target = document.getElementById("videowrap") || document.body;
    const mo = new MutationObserver((mutations) => {
      let shouldReact = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && 
              (node.classList?.contains('video-js') || 
               node.tagName === 'VIDEO' ||
               node.tagName === 'IFRAME' ||
               node.querySelector?.(PLAYER_SELECTOR))) {
            shouldReact = true;
            break;
          }
        }
        
        for (const node of mutation.removedNodes) {
          if (node.nodeType === 1 && 
              (node.classList?.contains('video-js') || 
               node.tagName === 'VIDEO' ||
               node.tagName === 'IFRAME')) {
            shouldReact = true;
            break;
          }
        }
      }
      
      if (shouldReact) {
        applyCityTheme();
        attachGuards();
        ensureInlinePlayback();
        applyPosterUrl();
        togglePosterVisibility();
        ensureQualitySelector();
      }
      ensureCaptionSyncControls();
    });
    
    mo.observe(target, { 
      childList: true, 
      subtree: true,
      characterData: false
    });
    watchPlayerMount._mo = mo;
  }

  /* ===== Custom quality selector (replaces broken vjs-resolution-switcher) ===== */
  const QUALITY_BUTTON_CLASS = "btfw-quality-button";
  const BROKEN_RES_BUTTON_CLASS = "vjs-resolution-button";
  const qualityState = {
    byMediaId: new Map(),
    lastMediaId: null,
    boundPlayer: null
  };

  function ensureQualitySelectorStyles() {
    if (document.getElementById("btfw-quality-selector-style")) return;
    const style = document.createElement("style");
    style.id = "btfw-quality-selector-style";
    style.textContent = `
      /* Hide the broken Video.js resolution-switcher button for good. */
      .vjs-resolution-button,
      .video-js .vjs-resolution-button {
        display: none !important;
      }
      /* Keep our custom button aligned with the rest of the control bar. */
      .vjs-control-bar .${QUALITY_BUTTON_CLASS} {
        order: 98;
      }
    `;
    document.head.appendChild(style);
  }

  function getVideojsPlayerSafe() {
    if (typeof window === "undefined" || !window.videojs) return null;
    try {
      return window.videojs.players?.ytapiplayer || window.videojs("ytapiplayer");
    } catch (_) {
      return null;
    }
  }

  function getMediaId() {
    return window.PLAYER && window.PLAYER.mediaId ? window.PLAYER.mediaId : null;
  }

  function getPlayerSources() {
    const player = window.PLAYER;
    if (player && Array.isArray(player.sources) && player.sources.length > 1) {
      return player.sources;
    }
    return null;
  }

  function normalizeUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url, window.location.href);
      return `${u.origin}${u.pathname}`;
    } catch (_) {
      return url.split("?")[0];
    }
  }

  function removeBrokenResolutionButton() {
    document.querySelectorAll(`.${BROKEN_RES_BUTTON_CLASS}`).forEach((btn) => {
      btn.remove();
    });
  }

  function buildQualityMenuItem(source, isSelected) {
    const li = document.createElement("li");
    li.className = `vjs-menu-item ${isSelected ? "vjs-selected" : ""}`;
    li.setAttribute("role", "menuitemradio");
    li.setAttribute("aria-checked", isSelected ? "true" : "false");
    li.textContent = source.label || `${source.res}p`;
    li.dataset.res = String(source.res);
    return li;
  }

  function desiredMenuSignature(sources, currentRes) {
    return sources.map((s) => `${s.res}:${String(s.res) === String(currentRes)}`).join("|");
  }

  function updateQualityButtonState(button, sources, currentRes) {
    const menuContent = button.querySelector(".vjs-menu-content");
    if (!menuContent) return;

    const nextSig = desiredMenuSignature(sources, currentRes);
    if (menuContent.dataset.btfwQualitySig === nextSig) return;
    menuContent.dataset.btfwQualitySig = nextSig;

    menuContent.innerHTML = "";
    sources.forEach((source) => {
      const isSelected = String(source.res) === String(currentRes);
      menuContent.appendChild(buildQualityMenuItem(source, isSelected));
    });

    const labelSpan = button.querySelector(".btfw-quality-label");
    if (labelSpan) {
      const current = sources.find((s) => String(s.res) === String(currentRes));
      labelSpan.textContent = current ? (current.label || `${current.res}p`) : "";
    }
  }

  function getCurrentResFromSrc(sources) {
    const player = getVideojsPlayerSafe();
    if (!player) return null;
    const currentSrc = normalizeUrl(player.currentSrc());
    if (!currentSrc) return null;
    const match = sources.find((s) => normalizeUrl(s.src) === currentSrc);
    return match ? match.res : null;
  }

  function resolveCurrentRes(sources) {
    const mediaId = getMediaId();
    if (mediaId && qualityState.byMediaId.has(mediaId)) {
      const stored = qualityState.byMediaId.get(mediaId);
      if (sources.some((s) => String(s.res) === String(stored))) {
        return stored;
      }
    }
    const fromSrc = getCurrentResFromSrc(sources);
    if (fromSrc != null) return fromSrc;
    return sources[0] ? sources[0].res : null;
  }

  function switchQualitySource(source) {
    const player = getVideojsPlayerSafe();
    if (!player) return;

    const mediaId = getMediaId();
    if (mediaId) {
      qualityState.byMediaId.set(mediaId, source.res);
    }
    qualityState.lastMediaId = mediaId;

    // Keep CyTube's error-fallback index in sync with the chosen source
    if (window.PLAYER && Array.isArray(window.PLAYER.sources)) {
      const idx = window.PLAYER.sources.findIndex((s) => String(s.res) === String(source.res));
      if (idx >= 0) window.PLAYER.sourceIdx = idx;
    }

    const currentTime = player.currentTime() || 0;
    const wasPlaying = !player.paused();

    try {
      player.pause();
    } catch (_) {}

    player.src({ src: source.src, type: source.type, res: source.res });

    const resume = () => {
      try {
        player.currentTime(currentTime);
        if (wasPlaying) player.play().catch(() => {});
      } catch (_) {}
    };

    player.one("loadeddata", resume);
    player.one("loadedmetadata", resume);
    setTimeout(() => {
      try {
        if (Math.abs(player.currentTime() - currentTime) > 0.5) {
          player.currentTime(currentTime);
        }
      } catch (_) {}
    }, 500);
  }

  function buildQualityButton() {
    const button = document.createElement("button");
    button.className = `vjs-menu-button vjs-menu-button-popup vjs-button ${QUALITY_BUTTON_CLASS}`;
    button.type = "button";
    button.title = "Quality";
    button.setAttribute("aria-disabled", "false");
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    button.innerHTML = `
      <span class="vjs-icon-placeholder" aria-hidden="true"></span>
      <span class="vjs-control-text" aria-live="polite">Quality</span>
      <span class="btfw-quality-label"></span>
      <div class="vjs-menu">
        <ul class="vjs-menu-content" role="menu"></ul>
      </div>
    `;

    button.addEventListener("mouseenter", () => button.classList.add("vjs-hover"));
    button.addEventListener("mouseleave", () => button.classList.remove("vjs-hover"));
    button.addEventListener("focus", () => button.classList.add("vjs-hover"));
    button.addEventListener("blur", () => button.classList.remove("vjs-hover"));

    button.addEventListener("click", (event) => {
      const item = event.target.closest(".vjs-menu-item");
      if (!item) {
        button.classList.toggle("vjs-hover");
        return;
      }

      const res = item.dataset.res;
      const sources = getPlayerSources();
      if (!sources) return;

      const source = sources.find((s) => String(s.res) === res);
      if (!source) return;

      event.preventDefault();
      event.stopPropagation();

      switchQualitySource(source);
      updateQualityButtonState(button, sources, source.res);
      button.classList.remove("vjs-hover");
    });

    return button;
  }

  function bindQualityPlayerEvents() {
    const player = getVideojsPlayerSafe();
    if (!player || typeof player.on !== "function") return;
    if (qualityState.boundPlayer === player) return;

    qualityState.boundPlayer = player;
    // Update button label when the source is swapped out by other code
    // (e.g. the audio enhancer proxying through a CORS worker).
    ["sourceset", "loadstart", "loadedmetadata", "resolutionchange"].forEach((event) => {
      try {
        player.on(event, () => {
          if (!document.body) return;
          const button = document.querySelector(`#ytapiplayer .${QUALITY_BUTTON_CLASS}`);
          const sources = getPlayerSources();
          if (!button || !sources) return;
          updateQualityButtonState(button, sources, resolveCurrentRes(sources));
        });
      } catch (_) {}
    });
  }

  function ensureQualitySelector() {
    ensureQualitySelectorStyles();
    const controlBar = document.querySelector("#ytapiplayer .vjs-control-bar");
    if (!controlBar) return;

    removeBrokenResolutionButton();

    let button = controlBar.querySelector(`.${QUALITY_BUTTON_CLASS}`);
    const sources = getPlayerSources();

    if (!sources) {
      if (button) button.remove();
      return;
    }

    bindQualityPlayerEvents();

    const mediaId = getMediaId();
    if (mediaId && qualityState.lastMediaId && mediaId !== qualityState.lastMediaId) {
      qualityState.byMediaId.delete(qualityState.lastMediaId);
    }
    qualityState.lastMediaId = mediaId;

    const currentRes = resolveCurrentRes(sources);

    if (!button) {
      button = buildQualityButton();
      const fullscreenBtn = controlBar.querySelector(".vjs-fullscreen-control");
      if (fullscreenBtn) {
        controlBar.insertBefore(button, fullscreenBtn);
      } else {
        controlBar.appendChild(button);
      }
    }

    updateQualityButtonState(button, sources, currentRes);
  }

  function handleVideoChange() {
    [100, 500, 1000, 2500].forEach((delay) => {
      setTimeout(() => {
        ensureInlinePlayback();
        applyPosterUrl();
        togglePosterVisibility();
        ensureQualitySelector();
      }, delay);
    });
  }

  function boot() {
    applyCityTheme();
    attachGuards();
    ensureInlinePlayback();
    ensureTextContentPatch();
    ensureCaptionSyncControls();
    applyPosterUrl();
    togglePosterVisibility();
    ensureQualitySelector();
    watchPlayerMount();

    // Periodic check like billtube2.js
    setInterval(() => {
      togglePosterVisibility();
      ensureQualitySelector();
    }, 1000);

    if (typeof window !== "undefined" && window.socket && typeof socket.on === "function") {
      try {
        if (typeof socket.off === "function") {
          socket.off("changeMedia", handleVideoChange);
        }
        socket.on("changeMedia", handleVideoChange);
      } catch (err) {
        console.warn("[feature:player] Unable to bind changeMedia handler", err);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return {
    name: "feature:player",
    applyCityTheme,
    attachGuards,
    ensureInlinePlayback,
    applyPosterUrl,
    togglePosterVisibility
  };
});
