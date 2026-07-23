/* BTFW — feature:adaptiveAtmosphere
   Samples the active HTML5 video at a very low resolution a couple of times
   per second, derives a subdued ambient colour profile, and exposes it as
   --btfw-atmo-* CSS custom properties. The page layer, player glow and chat
   tint all read those variables, so the surrounding theme slowly drifts
   toward the video's atmosphere without ever touching the video itself.

   Design rules inherited from the spec this implements:
   - Smooth in JS (exponential), never write raw measurements to CSS.
   - When unsure whether an effect is too weak or too strong, go weaker.
   - CORS-tainted or iframe-based media silently falls back to neutral.
   - Nothing here may interfere with Video.js, CyTube sync, or playback.
*/
BTFW.define("feature:adaptiveAtmosphere", ["util:motion"], async () => {
  const motion = await BTFW.init("util:motion");

  /* ---------- settings -------------------------------------------------- */
  const STORAGE_KEY = "btfw:video:adaptiveAtmosphere";
  const DEBUG_KEY   = "btfw:atmo:debug";
  // Mode -> intensity. The overlay button toggles on/off; the strength is
  // picked from its hover dropdown (same UX as the audio boost/norm buttons).
  const MODES = {
    off: { intensity: 0,    label: "Off" },
    min: { intensity: 0.2,  label: "Minimal" },
    med: { intensity: 0.35, label: "Medium" },
    max: { intensity: 0.5,  label: "Strong" }
  };
  const MODE_ORDER = ["off", "min", "med", "max"];

  // Same provider list feature:audioEnhancer uses (see CyTube player.js):
  // fi=raw file, cm=custom HTML5, gd=Google Drive raw, hl=HLS. Everything
  // else is iframe-based and can never be canvas-read. gd usually taints
  // the canvas too — the SecurityError path below handles that.
  const HTML5_MEDIA_TYPES = new Set(["fi", "cm", "gd", "hl"]);

  /* ---------- sampling / analysis tuning -------------------------------- */
  const QUALITY_MODES = {
    high:   { width: 96, height: 54, interval: 400,  pixelStep: 2 },
    normal: { width: 80, height: 45, interval: 600,  pixelStep: 4 },
    low:    { width: 64, height: 36, interval: 1000, pixelStep: 6 }
  };
  const SLOW_ANALYSIS_MS = 10;   // downgrade quality when the rolling average exceeds this
  // Ignore subtitle band and frame edges (spec §9): bottom 15% + 5% edges.
  const CROP = { left: 0.05, top: 0.05, right: 0.95, bottom: 0.85 };
  const NORMAL_SMOOTHING = 0.06;
  const SCENE_SMOOTHING  = 0.12;
  const FADE_STEP_MS     = 120;  // fade-ticker cadence when not sampling
  // Dead zones: below these deltas the target is treated as unchanged.
  const DEAD_ZONE = { brightness: 0.025, saturation: 0.03, warmth: 0.03, contrast: 0.03, rgb: 6 };
  // A single-sample brightness spike this large (with heavy frame motion)
  // is treated as a transient flash and not followed (spec §19).
  const FLASH_BRIGHTNESS_JUMP = 0.3;
  const FLASH_MOTION          = 0.35;

  // Theme-anchored fallbacks. NEUTRAL is the resting state; BASE_AMBIENT is
  // what detected video colours get biased toward so the result always stays
  // in BillTube's dark palette family.
  const NEUTRAL = { r: 18, g: 22, b: 30, brightness: 0.15, saturation: 0.15, warmth: 0, contrast: 0.25, bg: 0, glow: 0, panel: 0, mix: 0 };
  const BASE_AMBIENT = { r: 18, g: 22, b: 30 };
  const MAX_SATURATION = 0.5;   // ambient colours never exceed this
  const MIN_LIGHTNESS  = 0.14;  // keep a readable hue even for near-black
  const MAX_LIGHTNESS  = 0.34;  // scenes — darkness is expressed via opacity,
                                // not by sinking the colour to black

  /* ---------- state ------------------------------------------------------ */
  const state = {
    mode: "off",
    intensity: 0,
    sampling: false,       // actively reading frames
    halted: false,         // manual stop() via the public API
    unsupported: false,    // current media tainted the canvas / not HTML5
    mediaCapable: false,   // current media is HTML5 and canvas-readable
    reducedMotion: false,
    video: null,
    quality: "normal",
    smooth: { ...NEUTRAL },
    target: { ...NEUTRAL }
  };

  let canvas = null;
  let ctx = null;
  let rafId = null;
  let lastSampleTime = 0;
  let lastFadeTime = 0;
  let prevLuma = null;     // Float32Array of previous frame luminance
  let prevLumaW = 0, prevLumaH = 0;
  let luma = null;         // reused luminance buffer
  let bucketCount = null;  // 3-bits-per-channel dominant-colour histogram
  let bucketR = null, bucketG = null, bucketB = null;
  let prevRaw = null;      // last raw analysis (flash/scene detection)
  let sceneBoostUntil = 0; // faster smoothing window after a scene change
  let perfTimes = [];      // rolling analysis-duration window
  let seekResumeTimer = null;
  let attachRetryTimer = null;
  let safetyInterval = null;
  let domObserver = null;
  let domCheckTimer = null;
  let socketBound = false;
  let destroyed = false;
  let debugEl = null;

  function isDebug() {
    try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch (_) { return false; }
  }
  function debugLog(...args) {
    if (isDebug()) console.log("[atmosphere]", ...args);
  }

  /* ---------- small colour helpers -------------------------------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixRgb(a, b, t) {
    return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h / 6, s, l };
  }
  function hslToRgb(h, s, l) {
    if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
  }
  // Clamp saturation/lightness into the subdued ambient band (spec §12, §28).
  function restrainColor(rgb) {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.s = Math.min(hsl.s, MAX_SATURATION);
    hsl.l = clamp(hsl.l, MIN_LIGHTNESS, MAX_LIGHTNESS);
    return hslToRgb(hsl.h, hsl.s, hsl.l);
  }

  /* ---------- CSS ---------------------------------------------------------
     Default variables live here (alpha 0) so the layers cost nothing while
     the feature is off; the JS renderer overwrites them on <html>. */
  const STYLE_ID = "btfw-adaptive-atmosphere-style";
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --btfw-atmo-rgb: 18, 22, 30;
        --btfw-atmo-brightness: 0.15;
        --btfw-atmo-opacity: 0;
        --btfw-atmo-glow-opacity: 0;
        --btfw-atmo-panel-opacity: 0;
        --btfw-atmo-mix: 0;
      }
      /* The real atmosphere carrier: re-tint the theme's own base tokens.
         Every main surface (#wrap, #chatwrap, #videowrap, playlist, cards,
         overlays) derives from these three, so the whole page chrome — chat
         background included — shifts with the video instead of whispering
         behind a 92%-opaque #wrap. Channel themes still flow through via
         --btfw-theme-*. Panel/surface mix less than bg to protect text
         contrast on cards and overlays. */
      html[data-btfw-atmosphere="on"] {
        --btfw-color-bg: color-mix(in srgb,
          rgb(var(--btfw-atmo-rgb)) calc(var(--btfw-atmo-mix) * 100%),
          var(--btfw-theme-bg, #0b0f12));
        --btfw-color-panel: color-mix(in srgb,
          rgb(var(--btfw-atmo-rgb)) calc(var(--btfw-atmo-mix) * 60%),
          var(--btfw-theme-panel, #171d27));
        --btfw-color-surface: color-mix(in srgb,
          rgb(var(--btfw-atmo-rgb)) calc(var(--btfw-atmo-mix) * 45%),
          var(--btfw-theme-surface, #11161d));
      }
      /* Fixed page layer — sits with body::before (z-index:-1) above the page
         background but below all content. Pure gradients; no canvas, no
         filters, and JS smoothing does the transitioning. */
      #btfw-adaptive-atmosphere {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        contain: strict;
        background:
          radial-gradient(90% 60% at 50% 18%,
            rgba(var(--btfw-atmo-rgb), calc(var(--btfw-atmo-opacity) * 0.9)) 0%,
            transparent 62%),
          radial-gradient(70% 55% at 50% 100%,
            rgba(var(--btfw-atmo-rgb), calc(var(--btfw-atmo-opacity) * 0.55)) 0%,
            transparent 65%),
          linear-gradient(180deg,
            rgba(var(--btfw-atmo-rgb), calc(var(--btfw-atmo-opacity) * 0.35)) 0%,
            transparent 70%);
      }
      /* Player glow — #videowrap has overflow:hidden (pseudo-elements would be
         clipped), but an element's own box-shadow still paints outside it.
         base.css forces box-shadow:none !important on #videowrap, so this
         needs the attribute gate + !important to win. The desktop grid runs
         the player flush against its neighbours, so the glow needs real
         reach (70px) to read as a halo rather than a seam. */
      html[data-btfw-atmosphere="on"] #videowrap {
        box-shadow: 0 0 70px 10px rgba(var(--btfw-atmo-rgb), var(--btfw-atmo-glow-opacity)) !important;
      }
      /* Restrained panel tints — inset whispers only; every surface keeps its
         own background, border and (absent here) shadow untouched. */
      html[data-btfw-atmosphere="on"] #chatwrap {
        box-shadow: inset 0 0 90px rgba(var(--btfw-atmo-rgb), var(--btfw-atmo-panel-opacity)) !important;
      }
      html[data-btfw-atmosphere="on"] #btfw-navhost > :is(nav.navbar, .navbar, #navbar, .navbar-fixed-top) {
        box-shadow: inset 0 0 48px rgba(var(--btfw-atmo-rgb), var(--btfw-atmo-panel-opacity));
      }
      /* Debug overlay — localStorage btfw:atmo:debug = "1" only. */
      #btfw-atmo-debug {
        position: fixed;
        left: 8px;
        bottom: 8px;
        z-index: 9999;
        background: rgba(10, 14, 24, 0.88);
        color: #cfe3ff;
        font: 11px/1.5 monospace;
        padding: 8px 10px;
        border-radius: 8px;
        pointer-events: none;
        white-space: pre;
      }
    `;
    document.head.appendChild(style);
  }

  let layerEl = null;
  function ensureLayer() {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = document.getElementById("btfw-adaptive-atmosphere");
    if (!layerEl) {
      layerEl = document.createElement("div");
      layerEl.id = "btfw-adaptive-atmosphere";
      layerEl.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(layerEl);
    }
    return layerEl;
  }

  /* ---------- overlay button + preset menu -------------------------------
     Mirrors feature:audioEnhancer's boost/norm buttons: icon-only toggle,
     strength picked from a hover dropdown, active state tinted inline. */
  let atmoButton = null;
  let atmoMenu = null;
  let lastActiveMode = "med";

  // Same purple family as the BTFW boot overlay accent (#6d4df6).
  const ATMO_ACTIVE_PALETTE = {
    bg: "rgba(109, 77, 246, 0.3)",
    border: "#6d4df6",
    color: "#8b6cf6"
  };

  function isHtml5Media() {
    const t = window.PLAYER && window.PLAYER.mediaType;
    // Unknown type (mid-swap): allow an attempt — the canvas read decides.
    return t ? HTML5_MEDIA_TYPES.has(t) : true;
  }

  /* ---------- media capability --------------------------------------------
     Whether the CURRENT media can actually be analysed: iframe providers
     (YouTube/Vimeo/Twitch) never can; HTML5 video can when the canvas read
     succeeds directly, or when the origin passed the CORS probe (a one-time
     reload then makes it readable). The poller re-assesses on every media
     signature change. Incapable media pauses the effect — the stored mode
     is kept, so it resumes by itself when a capable video plays. */
  let lastAssessSig = null;

  function mediaSignature(video) {
    const t = (window.PLAYER && window.PLAYER.mediaType) || "";
    const src = video ? (video.currentSrc || video.src || "") : "";
    return t + "|" + src;
  }

  // Actual read test on a small disposable canvas. Returns true/false, or
  // null when the video has no decodable frame yet (retry next poll).
  function probeCanvasReadable(video) {
    try {
      if (!video || !video.isConnected) return null;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null;
      const c = document.createElement("canvas");
      c.width = 8; c.height = 8;
      const x = c.getContext("2d", { alpha: false, willReadFrequently: true });
      x.drawImage(video, 0, 0, 8, 8);
      x.getImageData(0, 0, 8, 8);
      return true;
    } catch (_) { return false; }
  }

  function setMediaCapable(capable) {
    const changed = state.mediaCapable !== capable;
    state.mediaCapable = capable;
    if (!capable) {
      state.unsupported = true; // blocks sampling
      if (changed) fadeToNeutral();
    } else {
      state.unsupported = false;
      if (changed && state.intensity > 0 && state.video && !state.video.paused) startLoop();
    }
    updateButton();
  }

  function assessMediaCapability(force) {
    const video = state.video || findVideoElement();
    const sig = mediaSignature(video);
    if (!force && sig === lastAssessSig) return;
    if (!isHtml5Media() || !video) { lastAssessSig = sig; setMediaCapable(false); return; }
    const direct = probeCanvasReadable(video);
    if (direct === true) { lastAssessSig = sig; setMediaCapable(true); return; }
    if (direct === false) {
      // Tainted right now — still capable if the origin allows a CORS reload.
      maybeUpgradeCors(video); // starts the one-time fetch probe if needed
      lastAssessSig = sig;
      try {
        const origin = new URL(video.currentSrc || video.src, location.href).origin;
        setMediaCapable(corsProbedOrigins.get(origin) === true);
      } catch (_) { setMediaCapable(false); }
    }
    // null (no frame yet): keep the current state, decide on the next poll.
  }

  function updateButton() {
    if (!atmoButton) return;
    const active = state.mode !== "off";
    atmoButton.classList.toggle("active", active);
    atmoButton.style.background = active ? ATMO_ACTIVE_PALETTE.bg : "";
    atmoButton.style.borderColor = active ? ATMO_ACTIVE_PALETTE.border : "";
    atmoButton.style.color = active ? ATMO_ACTIVE_PALETTE.color : "";
    atmoButton.style.boxShadow = active ? `0 0 12px ${ATMO_ACTIVE_PALETTE.color}` : "";
    atmoButton.setAttribute("aria-pressed", active ? "true" : "false");
    atmoButton.title = `Toggle Adaptive Atmosphere (${MODES[state.mode].label})`;
    // The button only exists where the effect can actually run — iframe
    // providers and CORS-blocked sources hide it entirely.
    atmoButton.style.display = state.mediaCapable ? "" : "none";
  }

  function buildButton() {
    const btn = document.createElement("button");
    btn.id = "btfw-vo-atmosphere";
    btn.type = "button";
    btn.className = "btn btn-sm btn-default btfw-vo-adopted";
    btn.setAttribute("data-btfw-overlay", "1");
    btn.setAttribute("aria-label", "Toggle adaptive atmosphere");
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';

    btn.addEventListener("click", () => {
      applyMode(state.mode === "off" ? lastActiveMode : "off", { persist: true });
    });
    btn.addEventListener("mouseenter", () => showAtmoMenu());
    btn.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!atmoMenu?.matches(":hover") && !btn.matches(":hover")) {
          hideAtmoMenu();
        }
      }, 100);
    });
    return btn;
  }

  function ensureAtmoMenu() {
    if (atmoMenu) return atmoMenu;
    const menu = document.createElement("div");
    menu.id = "btfw-atmo-context-menu";
    menu.style.cssText = `
      position: absolute;
      background: rgba(20, 31, 54, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(109, 77, 246, 0.3);
      border-radius: 8px;
      padding: 6px;
      display: none;
      z-index: 10000;
      min-width: 110px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    `;

    MODE_ORDER.forEach((key) => {
      const item = document.createElement("button");
      item.className = "btfw-context-item";
      item.textContent = MODES[key].label;
      item.style.cssText = `
        display: block;
        width: 100%;
        padding: 6px 12px;
        background: transparent;
        border: none;
        color: #e0e0e0;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
        transition: background 150ms ease, color 150ms ease;
      `;

      item.addEventListener("mouseenter", () => {
        if (state.mode !== key) item.style.background = "rgba(109, 77, 246, 0.2)";
      });
      item.addEventListener("mouseleave", () => {
        if (state.mode !== key) item.style.background = "transparent";
      });
      item.addEventListener("click", () => {
        applyMode(key, { persist: true });
      });
      menu.appendChild(item);
    });

    menu.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!atmoButton?.matches(":hover")) hideAtmoMenu();
      }, 100);
    });

    document.body.appendChild(menu);
    atmoMenu = menu;
    updateAtmoMenuSelection();
    return menu;
  }

  function showAtmoMenu() {
    if (!atmoButton) return;
    const menu = ensureAtmoMenu();
    const rect = atmoButton.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.display = "block";
    updateAtmoMenuSelection();
  }

  function hideAtmoMenu() {
    if (atmoMenu) atmoMenu.style.display = "none";
  }

  function updateAtmoMenuSelection() {
    if (!atmoMenu) return;
    const items = atmoMenu.querySelectorAll(".btfw-context-item");
    MODE_ORDER.forEach((key, idx) => {
      const item = items[idx];
      if (!item) return;
      if (state.mode === key) {
        item.style.background = ATMO_ACTIVE_PALETTE.bg;
        item.style.color = ATMO_ACTIVE_PALETTE.color;
      } else {
        item.style.background = "transparent";
        item.style.color = "#e0e0e0";
      }
    });
  }

  function addButtonToOverlay() {
    const host = document.getElementById("btfw-vo-left");
    if (!host) return false;
    if (atmoButton && atmoButton.parentElement === host) { updateButton(); return true; }
    if (atmoButton) atmoButton.remove();
    // Defensive: a stray button from a previous instance must never stack.
    host.querySelectorAll("#btfw-vo-atmosphere").forEach((b) => b.remove());
    atmoButton = buildButton();
    // Slot right after the audio buttons when present, else append.
    const anchor = document.getElementById("btfw-vo-audionorm")
                || document.getElementById("btfw-vo-audioboost");
    if (anchor && anchor.parentElement === host) host.insertBefore(atmoButton, anchor.nextSibling);
    else host.appendChild(atmoButton);
    updateButton();
    return true;
  }

  function startButtonWatcher() {
    if (safetyInterval) return;
    safetyInterval = setInterval(() => {
      if (destroyed) return;
      addButtonToOverlay();
      // Cheap safety net: re-verify video attachment (covers player rebuilds
      // the MutationObserver missed) and re-assess capability when the media
      // signature changed under the same element.
      const el = findVideoElement();
      if (el !== state.video) attachToVideo();
      else assessMediaCapability();
    }, 2500);
  }

  /* ---------- mode / settings -------------------------------------------- */
  function readStoredMode() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return MODES[v] ? v : "off";
    } catch (_) { return "off"; }
  }

  function applyMode(mode, opts = {}) {
    if (!MODES[mode]) mode = "off";
    state.mode = mode;
    state.intensity = MODES[mode].intensity;
    if (mode !== "off") lastActiveMode = mode;
    if (opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
    }
    // Keep the theme-settings select in sync if it exists.
    const sel = document.getElementById("btfw-atmosphere-mode");
    if (sel && sel.value !== mode) sel.value = mode;

    if (mode === "off") {
      fadeToNeutral();
    } else {
      state.halted = false;
      document.documentElement.dataset.btfwAtmosphere = "on";
      ensureLayer();
      maybeUpgradeCors(state.video);
      if (state.video && !state.video.paused) startLoop();
    }
    updateButton();
    updateAtmoMenuSelection();
    debugLog("mode:", mode);
  }

  function setEnabled(enabled) {
    applyMode(enabled ? (state.mode === "off" ? "med" : state.mode) : "off", { persist: true });
  }

  function setIntensity(value) {
    const v = clamp(Number(value) || 0, 0, 0.6);
    // Snap to the nearest named mode so the UI stays consistent.
    let best = "off", bestDist = Infinity;
    for (const key of MODE_ORDER) {
      const d = Math.abs(MODES[key].intensity - v);
      if (d < bestDist) { bestDist = d; best = key; }
    }
    applyMode(best, { persist: true });
  }

  /* ---------- video attachment ------------------------------------------- */
  function findVideoElement() {
    // Prefer the live Video.js tech element, fall back to the DOM.
    try {
      if (window.videojs) {
        const player = window.videojs("ytapiplayer");
        const techEl = player && typeof player.tech === "function" && player.tech(true) && player.tech(true).el();
        if (techEl && techEl.tagName === "VIDEO") return techEl;
      }
    } catch (_) {}
    const el = document.querySelector("#ytapiplayer video")
            || document.querySelector("#videowrap .video-js video")
            || document.querySelector("#videowrap video");
    return el && el.tagName === "VIDEO" ? el : null;
  }

  const videoEvents = {
    play:    () => { if (state.mediaCapable) { state.unsupported = false; startLoop(); } },
    playing: () => { if (state.mediaCapable) { state.unsupported = false; startLoop(); } },
    pause:   () => { stopSamplingKeepAtmosphere(); },
    seeking: () => { stopSamplingKeepAtmosphere(); },
    seeked:  () => {
      // Let the decoder settle after a jump before reading pixels again.
      clearTimeout(seekResumeTimer);
      seekResumeTimer = setTimeout(() => { prevLuma = null; startLoop(); }, 400);
    },
    waiting: () => { stopSamplingKeepAtmosphere(); },
    ended:   () => { fadeToNeutral(); },
    emptied: () => { fadeToNeutral(); }
  };

  function detachVideo() {
    if (!state.video) return;
    for (const [ev, fn] of Object.entries(videoEvents)) {
      try { state.video.removeEventListener(ev, fn); } catch (_) {}
    }
    state.video = null;
  }

  function attachToVideo() {
    const el = findVideoElement();
    if (el === state.video) { ensureLoop(); return; }
    detachVideo();
    state.video = el;
    prevLuma = null;
    prevRaw = null;
    corsRetriedSrc = null;
    state.unsupported = false;
    if (!el) { scheduleAttachRetry(); return; }
    for (const [ev, fn] of Object.entries(videoEvents)) {
      try { el.addEventListener(ev, fn, { passive: true }); } catch (_) {}
    }
    maybeUpgradeCors(el);
    assessMediaCapability(true);
    if (!el.paused && !el.ended) startLoop();
  }

  /* CyTube keeps one <video> element per HTML5 tech and only swaps its src on
     media changes. Canvas reads taint when the element was loaded WITHOUT
     crossorigin="anonymous" — but the attribute is re-read on every future
     load, so setting it once upgrades every later source on the same element
     (no reload, zero playback interference). Only done after a probe proves
     the origin actually answers CORS requests; otherwise the next load would
     fail outright, so we leave the element alone and stay in fallback. */
  const corsProbedOrigins = new Map(); // origin -> boolean allowed
  function maybeUpgradeCors(video) {
    try {
      if (!video || video.crossOrigin) return;
      const src = video.currentSrc || video.src;
      if (!src) return;
      const url = new URL(src, location.href);
      if (url.origin === location.origin) return; // already readable
      const cached = corsProbedOrigins.get(url.origin);
      if (cached === true) { video.crossOrigin = "anonymous"; return; }
      if (cached === false) return;
      corsProbedOrigins.set(url.origin, false);
      fetch(url.href, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        credentials: "omit", // matches what crossorigin="anonymous" sends
        cache: "no-store"
      }).then((r) => {
        try { r.body && r.body.cancel(); } catch (_) {}
        const allowed = r.ok || r.status === 206;
        corsProbedOrigins.set(url.origin, allowed);
        if (allowed) {
          try { video.crossOrigin = "anonymous"; } catch (_) {}
          debugLog("CORS upgrade enabled for", url.origin);
        }
        // The probe settled capability for this origin — re-assess so the
        // button/effect reflect it (a CORS reload makes the current source
        // readable on the next sample attempt).
        assessMediaCapability(true);
      }).catch(() => {});
    } catch (_) {}
  }

  /* The attribute above only helps FUTURE loads — the currently playing
     resource was already fetched without CORS and stays tainted. When the
     probe proved the origin allows CORS, do ONE controlled reload of the
     current resource in CORS mode, preserving position/playback state.
     CyTube's own sync would correct any residual drift. Guarded per-src so
     a server that still taints after reload can never loop. */
  let corsRetriedSrc = null;
  function attemptCorsReload(video) {
    try {
      if (!video || state.intensity <= 0) return;
      if (video.crossOrigin !== "anonymous") return; // probe didn't allow CORS
      const src = video.currentSrc || video.src;
      if (!src || corsRetriedSrc === src) return;
      corsRetriedSrc = src;
      const t = video.currentTime;
      const wasPlaying = !video.paused && !video.ended;
      video.addEventListener("loadeddata", () => {
        try { video.currentTime = t; } catch (_) {}
        if (wasPlaying) { try { video.play().catch(() => {}); } catch (_) {} }
      }, { once: true });
      video.load();
      debugLog("reloaded media in CORS mode");
    } catch (_) {}
  }

  function scheduleAttachRetry() {
    clearTimeout(attachRetryTimer);
    attachRetryTimer = setTimeout(() => { if (!destroyed) attachToVideo(); }, 1200);
  }

  function handleMediaChange() {
    // Fade out, drop frame history, then re-attach once CyTube has swapped
    // the player tech (it rebuilds asynchronously after changeMedia).
    fadeToNeutral();
    detachVideo();
    state.unsupported = false;
    assessMediaCapability(true); // hides the button fast on iframe providers
    clearTimeout(attachRetryTimer);
    attachRetryTimer = setTimeout(() => { if (!destroyed) attachToVideo(); }, 600);
  }

  function bindSocket() {
    if (socketBound) return;
    const socket = window.socket;
    if (!socket || typeof socket.on !== "function") return;
    try {
      socket.on("changeMedia", handleMediaChange);
      socketBound = true;
    } catch (_) {}
  }

  function bindDomWatcher() {
    // Fallback for player-tech replacement that doesn't come with a
    // changeMedia we can use. Scoped to #videowrap so chat spam never
    // reaches this observer.
    const host = document.getElementById("videowrap") || document.body;
    if (!host) return;
    domObserver = new MutationObserver(() => {
      clearTimeout(domCheckTimer);
      domCheckTimer = setTimeout(() => {
        if (destroyed) return;
        const el = findVideoElement();
        if (el !== state.video) attachToVideo();
      }, 500);
    });
    try { domObserver.observe(host, { childList: true, subtree: true }); } catch (_) {}
  }

  /* ---------- sampling loop ---------------------------------------------- */
  function ensureCanvas() {
    if (canvas) return true;
    try {
      canvas = document.createElement("canvas");
      const q = QUALITY_MODES[state.quality];
      canvas.width = q.width;
      canvas.height = q.height;
      ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      return !!ctx;
    } catch (_) {
      canvas = null; ctx = null;
      return false;
    }
  }

  function setQuality(name) {
    if (!QUALITY_MODES[name] || state.quality === name) return;
    state.quality = name;
    if (canvas) {
      canvas.width = QUALITY_MODES[name].width;
      canvas.height = QUALITY_MODES[name].height;
    }
    luma = null;
    prevLuma = null;
    debugLog("quality ->", name);
  }

  function canSampleNow() {
    const v = state.video;
    return !!(
      state.intensity > 0 &&
      !state.halted &&
      state.mediaCapable &&
      !state.unsupported &&
      !document.hidden &&
      v && v.isConnected &&
      !v.paused && !v.seeking && !v.ended &&
      v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      v.videoWidth > 0 && v.videoHeight > 0
    );
  }

  function startLoop() {
    if (state.intensity <= 0) return;
    ensureLoop();
  }

  function ensureLoop() {
    if (destroyed || rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  function stopSamplingKeepAtmosphere() {
    state.sampling = false;
    // Loop stays alive briefly via the fade path if needed; nothing else to
    // do — the last stable atmosphere simply persists while paused/seeking.
  }

  function tick(ts) {
    rafId = null;
    if (destroyed) return;
    let needMore = false;

    if (canSampleNow()) {
      state.sampling = true;
      const interval = state.reducedMotion
        ? QUALITY_MODES[state.quality].interval * 2
        : QUALITY_MODES[state.quality].interval;
      if (ts - lastSampleTime >= interval) {
        lastSampleTime = ts;
        sampleFrame();
      }
      needMore = true;
    } else {
      state.sampling = false;
      // Not sampling — keep easing toward the current target (neutral fade
      // on pause/end/disable/CORS) until converged, then stop the loop.
      if (!isConverged()) {
        if (ts - lastFadeTime >= FADE_STEP_MS) {
          lastFadeTime = ts;
          stepSmoothing();
          render();
        }
        needMore = true;
      }
    }

    if (needMore && !destroyed) rafId = requestAnimationFrame(tick);
  }

  function sampleFrame() {
    if (!ensureCanvas()) { state.unsupported = true; fadeToNeutral(); return; }
    const v = state.video;
    const q = QUALITY_MODES[state.quality];

    const t0 = performance.now();
    try {
      const sx = v.videoWidth * CROP.left;
      const sy = v.videoHeight * CROP.top;
      const sw = v.videoWidth * (CROP.right - CROP.left);
      const sh = v.videoHeight * (CROP.bottom - CROP.top);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, q.width, q.height);
      const frame = ctx.getImageData(0, 0, q.width, q.height);
      const raw = analyzeFrame(frame.data, q.width, q.height, q.pixelStep);
      handleRawAnalysis(raw);
    } catch (err) {
      // SecurityError = cross-origin taint. One tainted draw poisons the
      // sampling canvas permanently (getImageData keeps throwing even for
      // later clean sources), so drop it — a fresh canvas is created if a
      // readable source arrives. Never spam: mark this source, fade back to
      // neutral, and stay quiet until the next media change or play event.
      canvas = null; ctx = null;
      state.unsupported = true;
      debugLog("frame read failed, disabling for this media:", err && err.name);
      fadeToNeutral();
      attemptCorsReload(v);
      // If no CORS reload is possible the origin simply doesn't allow pixel
      // reads — treat the media as incapable (button hides, setting kept).
      if (v && v.crossOrigin !== "anonymous") setMediaCapable(false);
      return;
    }

    const duration = performance.now() - t0;
    perfTimes.push(duration);
    if (perfTimes.length > 10) perfTimes.shift();
    const avg = perfTimes.reduce((a, b) => a + b, 0) / perfTimes.length;
    if (avg > SLOW_ANALYSIS_MS) {
      if (state.quality === "high") setQuality("normal");
      else if (state.quality === "normal") setQuality("low");
      perfTimes = [];
    }
  }

  /* ---------- frame analysis --------------------------------------------- */
  function analyzeFrame(data, w, h, pixelStep) {
    const pixelCount = w * h;
    if (!luma || luma.length !== pixelCount) luma = new Float32Array(pixelCount);
    if (!bucketCount) {
      bucketCount = new Uint32Array(512);
      bucketR = new Uint32Array(512);
      bucketG = new Uint32Array(512);
      bucketB = new Uint32Array(512);
    } else {
      bucketCount.fill(0); bucketR.fill(0); bucketG.fill(0); bucketB.fill(0);
    }

    let sumR = 0, sumG = 0, sumB = 0, colorSamples = 0;
    let sumL = 0, sumL2 = 0, sumSat = 0;

    for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luma[p] = L;
      sumL += L;
      sumL2 += L * L;

      if (p % pixelStep !== 0) continue;
      colorSamples++;
      sumR += r; sumG += g; sumB += b;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      sumSat += sat;
      // Dominant-colour histogram: skip near-black / near-white / greyish.
      if (sat > 0.15 && L > 20 && L < 235) {
        const bi = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        bucketCount[bi]++;
        bucketR[bi] += r; bucketG[bi] += g; bucketB[bi] += b;
      }
    }

    const avgR = sumR / colorSamples;
    const avgG = sumG / colorSamples;
    const avgB = sumB / colorSamples;
    const meanL = sumL / pixelCount;
    const variance = Math.max(0, sumL2 / pixelCount - meanL * meanL);
    const contrast = clamp(Math.sqrt(variance) / 255 / 0.35, 0, 1);

    // Dominant bucket — needs a meaningful share of the frame, else fall
    // back to the plain average.
    let dom = { r: avgR, g: avgG, b: avgB };
    let bestBucket = -1, bestCount = 0;
    for (let bi = 0; bi < 512; bi++) {
      if (bucketCount[bi] > bestCount) { bestCount = bucketCount[bi]; bestBucket = bi; }
    }
    if (bestBucket >= 0 && bestCount > colorSamples * 0.03) {
      dom = {
        r: bucketR[bestBucket] / bestCount,
        g: bucketG[bestBucket] / bestCount,
        b: bucketB[bestBucket] / bestCount
      };
    }

    // Motion: mean absolute luminance delta vs previous sample.
    let motionLevel = 0;
    if (prevLuma && prevLumaW === w && prevLumaH === h) {
      let diff = 0;
      for (let p = 0; p < pixelCount; p += 4) diff += Math.abs(luma[p] - prevLuma[p]);
      motionLevel = clamp(diff / (pixelCount / 4) / 255, 0, 1);
    }
    if (!prevLuma || prevLuma.length !== pixelCount) prevLuma = new Float32Array(pixelCount);
    prevLuma.set(luma);
    prevLumaW = w; prevLumaH = h;

    const raw = {
      avgColor: { r: avgR, g: avgG, b: avgB },
      dominantColor: dom,
      brightness: clamp(meanL / 255, 0, 1),
      saturation: clamp(sumSat / colorSamples, 0, 1),
      warmth: clamp((avgR - avgB) / 255, -1, 1),
      contrast,
      motion: motionLevel,
      flash: false,
      sceneChange: false
    };

    // Flash protection: a single-sample brightness spike with heavy motion is
    // a transient (lightning, explosions, white title cards) — don't follow it.
    if (prevRaw) {
      const bJump = raw.brightness - prevRaw.brightness;
      if (bJump > FLASH_BRIGHTNESS_JUMP && raw.motion > FLASH_MOTION) {
        raw.flash = true;
        raw.brightness = prevRaw.brightness;
      }
      // Confident scene change: big simultaneous brightness + content shift.
      if (Math.abs(raw.brightness - prevRaw.brightness) > 0.12 && raw.motion > 0.25) {
        raw.sceneChange = true;
      }
    }
    prevRaw = raw;
    return raw;
  }

  /* ---------- target computation + smoothing ------------------------------ */
  function deadZone(prev, next, threshold) {
    return Math.abs(next - prev) < threshold ? prev : next;
  }

  function handleRawAnalysis(raw) {
    if (raw.sceneChange) sceneBoostUntil = performance.now() + 2000;

    // Blend average + dominant, restrain into the ambient band, then bias
    // toward the BillTube base colour. Intensity controls how much of the
    // video colour survives the mix (spec §12, §28).
    let src = mixRgb(raw.avgColor, raw.dominantColor, 0.6);
    src = restrainColor(src);
    const mixFactor = clamp(state.intensity * 1.6, 0, 1);
    const color = mixRgb(BASE_AMBIENT, src, raw.flash ? mixFactor * 0.3 : mixFactor);

    // Asymmetric brightness response: dark scenes may dim the ambience a bit
    // more than bright scenes may lift it (spec §18).
    const b = raw.brightness;
    const ambientBrightness = lerp(0.12, 0.22, clamp(b, 0, 1));

    const motionTrim = state.reducedMotion ? 0.6 : 1;
    const bgOpacity = clamp(state.intensity * (0.55 + 0.5 * b), 0, 0.4) * motionTrim;
    const glowBase = state.intensity * 0.9 + (state.reducedMotion ? 0 : raw.motion * 0.05);
    const glowOpacity = clamp(glowBase, 0, 0.45) * motionTrim;
    const panelOpacity = clamp(state.intensity * 0.35, 0, 0.15) * motionTrim;
    // Token mix — how far the theme's own bg/panel/surface colours shift
    // toward the atmosphere colour. Primary visible carrier of the effect.
    const tokenMix = clamp(state.intensity * 0.7, 0, 0.4) * motionTrim;

    const t = state.target;
    t.r = deadZone(t.r, color.r, DEAD_ZONE.rgb);
    t.g = deadZone(t.g, color.g, DEAD_ZONE.rgb);
    t.b = deadZone(t.b, color.b, DEAD_ZONE.rgb);
    t.brightness = deadZone(t.brightness, ambientBrightness, DEAD_ZONE.brightness);
    t.saturation = deadZone(t.saturation, Math.min(raw.saturation, MAX_SATURATION), DEAD_ZONE.saturation);
    t.warmth = deadZone(t.warmth, raw.warmth, DEAD_ZONE.warmth);
    t.contrast = deadZone(t.contrast, raw.contrast, DEAD_ZONE.contrast);
    t.bg = bgOpacity;
    t.glow = glowOpacity;
    t.panel = panelOpacity;
    t.mix = tokenMix;

    stepSmoothing();
    render();
  }

  function stepSmoothing() {
    const factor = performance.now() < sceneBoostUntil ? SCENE_SMOOTHING : NORMAL_SMOOTHING;
    const s = state.smooth, t = state.target;
    for (const key of ["r", "g", "b", "brightness", "saturation", "warmth", "contrast", "bg", "glow", "panel", "mix"]) {
      s[key] += (t[key] - s[key]) * factor;
    }
  }

  function isConverged() {
    const s = state.smooth, t = state.target;
    return Math.abs(t.r - s.r) < 1 && Math.abs(t.g - s.g) < 1 && Math.abs(t.b - s.b) < 1 &&
      Math.abs(t.bg - s.bg) < 0.004 && Math.abs(t.glow - s.glow) < 0.004 &&
      Math.abs(t.panel - s.panel) < 0.004 && Math.abs(t.mix - s.mix) < 0.004 &&
      Math.abs(t.brightness - s.brightness) < 0.004;
  }

  function fadeToNeutral() {
    state.target = { ...NEUTRAL };
    if (state.intensity <= 0) document.documentElement.dataset.btfwAtmosphere = "off";
    ensureLoop(); // fade ticker eases smooth -> neutral, then stops
  }

  /* ---------- renderer ----------------------------------------------------- */
  const rootStyle = document.documentElement.style;
  function render() {
    const s = state.smooth;
    rootStyle.setProperty("--btfw-atmo-rgb",
      `${Math.round(s.r)}, ${Math.round(s.g)}, ${Math.round(s.b)}`);
    rootStyle.setProperty("--btfw-atmo-brightness", s.brightness.toFixed(3));
    rootStyle.setProperty("--btfw-atmo-opacity", s.bg.toFixed(3));
    rootStyle.setProperty("--btfw-atmo-glow-opacity", s.glow.toFixed(3));
    rootStyle.setProperty("--btfw-atmo-panel-opacity", s.panel.toFixed(3));
    rootStyle.setProperty("--btfw-atmo-mix", s.mix.toFixed(3));
    if (debugEl) updateDebug();
  }

  /* ---------- debug overlay ------------------------------------------------ */
  function ensureDebugEl() {
    if (!isDebug() || debugEl) return;
    debugEl = document.createElement("div");
    debugEl.id = "btfw-atmo-debug";
    document.body.appendChild(debugEl);
  }
  function updateDebug() {
    const s = state.smooth;
    debugEl.textContent =
      `atmosphere: ${state.mode}${state.unsupported ? " (unsupported media)" : ""}\n` +
      `sampling: ${state.sampling ? "yes" : "no"}  quality: ${state.quality}\n` +
      `rgb: ${Math.round(s.r)}, ${Math.round(s.g)}, ${Math.round(s.b)}  brightness: ${s.brightness.toFixed(2)}\n` +
      `opacity bg/glow/panel: ${s.bg.toFixed(2)} / ${s.glow.toFixed(2)} / ${s.panel.toFixed(2)}\n` +
      (prevRaw ? `raw b/sat/warm/motion: ${prevRaw.brightness.toFixed(2)} / ${prevRaw.saturation.toFixed(2)} / ${prevRaw.warmth.toFixed(2)} / ${prevRaw.motion.toFixed(2)}` : "");
  }

  /* ---------- lifecycle ---------------------------------------------------- */
  function onVisibility() {
    if (document.hidden) {
      state.sampling = false; // rAF stops firing in hidden tabs anyway
    } else if (state.video && !state.video.paused && state.intensity > 0) {
      startLoop();
    }
  }

  function onMotionPreference() {
    state.reducedMotion = motion.prefersReducedMotion();
  }

  function boot() {
    ensureStyles();
    state.reducedMotion = motion.prefersReducedMotion();
    document.documentElement.dataset.btfwAtmosphere = "off";
    applyMode(readStoredMode(), { persist: false });
    bindSocket();
    attachToVideo();
    bindDomWatcher();
    addButtonToOverlay();
    startButtonWatcher();
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
    document.addEventListener("btfw:motion:preferenceApplied", onMotionPreference);
    // Theme-settings modal applies here:
    document.addEventListener("btfw:adaptiveAtmosphere:changed", (e) => {
      applyMode(e && e.detail && e.detail.mode, { persist: true });
    });
    // The overlay chrome rebuilds on layout changes — re-seat the button.
    document.addEventListener("btfw:videoOverlayReady", () => addButtonToOverlay(), { passive: true });
    document.addEventListener("btfw:layoutReady", () => addButtonToOverlay(), { passive: true });
    ensureDebugEl();
  }

  function destroy() {
    destroyed = true;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    clearTimeout(seekResumeTimer);
    clearTimeout(attachRetryTimer);
    clearTimeout(domCheckTimer);
    if (safetyInterval) { clearInterval(safetyInterval); safetyInterval = null; }
    if (domObserver) { domObserver.disconnect(); domObserver = null; }
    detachVideo();
    if (socketBound && window.socket) {
      try { window.socket.off("changeMedia", handleMediaChange); } catch (_) {}
      socketBound = false;
    }
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("btfw:motion:preferenceApplied", onMotionPreference);
    prevLuma = null; luma = null; prevRaw = null; perfTimes = [];
    bucketCount = bucketR = bucketG = bucketB = null;
    canvas = null; ctx = null;
    if (layerEl) { layerEl.remove(); layerEl = null; }
    if (atmoButton) { atmoButton.remove(); atmoButton = null; }
    if (atmoMenu) { atmoMenu.remove(); atmoMenu = null; }
    if (debugEl) { debugEl.remove(); debugEl = null; }
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    for (const prop of ["--btfw-atmo-rgb", "--btfw-atmo-brightness", "--btfw-atmo-opacity",
                        "--btfw-atmo-glow-opacity", "--btfw-atmo-panel-opacity", "--btfw-atmo-mix"]) {
      rootStyle.removeProperty(prop);
    }
    delete document.documentElement.dataset.btfwAtmosphere;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {
    name: "feature:adaptiveAtmosphere",
    start: () => { state.halted = false; state.unsupported = false; attachToVideo(); startLoop(); },
    stop: () => { state.halted = true; state.sampling = false; },
    destroy,
    setEnabled,
    setIntensity,
    setMode: (mode) => applyMode(mode, { persist: true }),
    getMode: () => state.mode,
    isRunning: () => state.sampling,
    getState: () => ({
      mode: state.mode,
      intensity: state.intensity,
      sampling: state.sampling,
      unsupported: state.unsupported,
      mediaCapable: state.mediaCapable,
      reducedMotion: state.reducedMotion,
      quality: state.quality,
      atmosphere: { ...state.smooth }
    })
  };
});
