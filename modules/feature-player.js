/* BTFW — feature:player (VideoJS player theming, tech guards, responsive fit) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const THEME_ID = "btfw-videojs-zen-theme";

  // Zen-inspired VideoJS theme CSS - clean, minimal, modern
  const videoPlayerThemeCSS = `
    /* Zen Theme - Clean & Minimal Video.js Styling - Override Default */
    .video-js {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif) !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      color: #fff !important;
      background-color: #000 !important;
      position: relative !important;
      vertical-align: top !important;
      box-sizing: border-box !important;
      background-size: cover !important;
      background-position: center !important;
      user-select: none !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    }

    /* Reset any default margins/padding */
    .video-js * {
      box-sizing: border-box !important;
    }

    /* Control bar - sleek and minimal - override default */
    .video-js .vjs-control-bar {
      display: flex !important;
      align-items: center !important;
      background: linear-gradient(to top,
        rgba(0, 0, 0, 0.9) 0%,
        rgba(0, 0, 0, 0.7) 50%,
        transparent 100%) !important;
      border: none !important;
      height: 56px !important;
      padding: 0 16px !important;
      transition: all 0.3s ease !important;
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      border-radius: 0 !important;
    }

    /* Show/hide control bar based on user activity */
    .video-js:not(.vjs-user-inactive) .vjs-control-bar {
      transform: translateY(0) !important;
      opacity: 1 !important;
    }

    .video-js.vjs-user-inactive .vjs-control-bar {
      transform: translateY(100%) !important;
      opacity: 0 !important;
    }

    .video-js.vjs-paused .vjs-control-bar,
    .video-js:hover .vjs-control-bar {
      transform: translateY(0) !important;
      opacity: 1 !important;
    }

    /* Buttons - clean design - override defaults */
    .video-js .vjs-button {
      background: transparent !important;
      border: none !important;
      color: #fff !important;
      cursor: pointer !important;
      margin: 0 6px !important;
      padding: 10px !important;
      border-radius: 8px !important;
      width: auto !important;
      height: auto !important;
      min-width: 44px !important;
      min-height: 44px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s ease !important;
      position: relative !important;
      font-size: 18px !important;
    }

    .video-js .vjs-button:hover,
    .video-js .vjs-button:focus {
      background: rgba(255, 255, 255, 0.15) !important;
      transform: scale(1.05) !important;
      outline: none !important;
      color: #fff !important;
    }

    .video-js .vjs-button:active {
      transform: scale(0.95) !important;
    }

    /* Icon placeholders */
    .video-js .vjs-icon-placeholder {
      font-size: inherit !important;
      line-height: 1 !important;
      width: auto !important;
      height: auto !important;
    }

    /* Play/Pause button - slightly larger */
    .video-js .vjs-play-control {
      margin-right: 12px !important;
      font-size: 22px !important;
    }

    /* Volume panel */
    .video-js .vjs-volume-panel {
      display: flex !important;
      align-items: center !important;
      margin: 0 8px !important;
    }

    .video-js .vjs-mute-control {
      margin: 0 !important;
    }

    .video-js .vjs-volume-control {
      width: 0 !important;
      transition: width 0.3s ease !important;
      overflow: hidden !important;
      opacity: 0 !important;
    }

    .video-js .vjs-volume-panel:hover .vjs-volume-control,
    .video-js .vjs-volume-panel.vjs-hover .vjs-volume-control {
      width: 100px !important;
      opacity: 1 !important;
    }

    .video-js .vjs-volume-bar {
      background: rgba(255, 255, 255, 0.3) !important;
      border-radius: 4px !important;
      height: 6px !important;
      margin: 0 12px !important;
      position: relative !important;
    }

    .video-js .vjs-volume-level {
      background: var(--btfw-color-accent, #6d4df6) !important;
      border-radius: 4px !important;
      height: 100% !important;
    }

    /* Time displays - better spacing */
    .video-js .vjs-current-time,
    .video-js .vjs-duration,
    .video-js .vjs-time-divider {
      display: block !important;
      flex: none !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      color: rgba(255, 255, 255, 0.95) !important;
      padding: 0 !important;
      margin: 0 6px !important;
      line-height: 1 !important;
      min-width: auto !important;
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif) !important;
    }

    .video-js .vjs-time-divider {
      padding: 0 4px !important;
      margin: 0 2px !important;
      color: rgba(255, 255, 255, 0.7) !important;
    }

    /* Progress control - modern slider */
    .video-js .vjs-progress-control {
      flex: 1 !important;
      display: flex !important;
      align-items: center !important;
      margin: 0 16px !important;
      height: 8px !important;
      cursor: pointer !important;
      transition: height 0.2s ease !important;
      position: relative !important;
    }

    .video-js .vjs-progress-control:hover {
      height: 12px !important;
    }

    .video-js .vjs-progress-holder {
      flex: 1 !important;
      display: flex !important;
      align-items: center !important;
      height: 100% !important;
      margin: 0 !important;
      background: rgba(255, 255, 255, 0.25) !important;
      border-radius: 6px !important;
      position: relative !important;
      overflow: hidden !important;
    }

    .video-js .vjs-load-progress {
      background: rgba(255, 255, 255, 0.4) !important;
      border-radius: 6px !important;
      height: 100% !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
    }

    .video-js .vjs-play-progress {
      background: var(--btfw-color-accent, #6d4df6) !important;
      background: linear-gradient(90deg,
        var(--btfw-color-accent, #6d4df6),
        color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 85%, #fff 15%)
      ) !important;
      border-radius: 6px !important;
      height: 100% !important;
      position: relative !important;
    }

    .video-js .vjs-play-progress:before {
      content: '' !important;
      position: absolute !important;
      top: 50% !important;
      right: -8px !important;
      transform: translateY(-50%) !important;
      width: 16px !important;
      height: 16px !important;
      background: #fff !important;
      border-radius: 50% !important;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4) !important;
      opacity: 0 !important;
      transition: opacity 0.2s ease !important;
      z-index: 1 !important;
    }

    .video-js .vjs-progress-control:hover .vjs-play-progress:before {
      opacity: 1 !important;
    }

    /* Time tooltips */
    .video-js .vjs-time-tooltip {
      background: rgba(0, 0, 0, 0.9) !important;
      color: #fff !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
    }

    /* Big play button - clean centered design */
    .video-js .vjs-big-play-button {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 88px !important;
      height: 88px !important;
      background: rgba(0, 0, 0, 0.8) !important;
      border: 3px solid rgba(255, 255, 255, 0.3) !important;
      border-radius: 50% !important;
      color: #fff !important;
      font-size: 32px !important;
      transition: all 0.3s ease !important;
      cursor: pointer !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 2 !important;
    }

    .video-js .vjs-big-play-button:hover,
    .video-js .vjs-big-play-button:focus {
      background: rgba(0, 0, 0, 0.95) !important;
      border-color: var(--btfw-color-accent, #6d4df6) !important;
      transform: translate(-50%, -50%) scale(1.08) !important;
      outline: none !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
    }

    .video-js .vjs-big-play-button:active {
      transform: translate(-50%, -50%) scale(0.95) !important;
    }

    .video-js .vjs-big-play-button .vjs-icon-placeholder {
      position: absolute !important;
      top: 50% !important;
      left: 56% !important;
      transform: translate(-50%, -50%) !important;
      font-size: inherit !important;
    }

    /* Loading spinner - custom design */
    .video-js .vjs-loading-spinner {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      border: 4px solid rgba(255, 255, 255, 0.2) !important;
      border-top: 4px solid var(--btfw-color-accent, #6d4df6) !important;
      border-radius: 50% !important;
      width: 48px !important;
      height: 48px !important;
      animation: vjs-zen-spin 1s linear infinite !important;
      margin: 0 !important;
    }

    @keyframes vjs-zen-spin {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }

    /* Hide spinner text */
    .video-js .vjs-loading-spinner .vjs-control-text {
      display: none !important;
    }

    /* Error display */
    .video-js .vjs-error-display {
      background: rgba(0, 0, 0, 0.9) !important;
      color: #fff !important;
      border-radius: 12px !important;
      margin: 24px !important;
      padding: 24px !important;
      font-size: 16px !important;
      text-align: center !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    /* Poster image */
    .video-js .vjs-poster {
      background-size: cover !important;
      background-position: center !important;
      border-radius: 12px !important;
    }

    /* Menu styling (quality, captions, etc.) */
    .video-js .vjs-menu-button-popup .vjs-menu {
      position: absolute !important;
      bottom: 100% !important;
      margin-bottom: 12px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }

    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: rgba(0, 0, 0, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 12px !important;
      min-width: 140px !important;
      max-height: 240px !important;
      overflow-y: auto !important;
      padding: 8px 0 !important;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6) !important;
      margin: 0 !important;
    }

    .video-js .vjs-menu li {
      color: rgba(255, 255, 255, 0.9) !important;
      padding: 10px 18px !important;
      font-size: 14px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      border: none !important;
      margin: 0 !important;
    }

    .video-js .vjs-menu li:hover,
    .video-js .vjs-menu li:focus {
      background: rgba(255, 255, 255, 0.12) !important;
      color: #fff !important;
    }

    .video-js .vjs-menu li.vjs-selected {
      background: var(--btfw-color-accent, #6d4df6) !important;
      color: #fff !important;
    }

    .video-js .vjs-menu li.vjs-menu-title {
      color: rgba(255, 255, 255, 0.7) !important;
      font-weight: 600 !important;
      padding: 8px 18px 12px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      margin-bottom: 4px !important;
    }

    /* Text tracks / subtitles */
    .video-js .vjs-text-track-display {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif) !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.9) !important;
      bottom: 80px !important;
    }

    /* Fullscreen button */
    .video-js .vjs-fullscreen-control {
      margin-left: 8px !important;
    }

    /* Hide unwanted default controls */
    .video-js .vjs-remaining-time,
    .video-js .vjs-picture-in-picture-control,
    .video-js .vjs-playback-rate.vjs-hidden,
    .video-js .vjs-chapters-button.vjs-hidden,
    .video-js .vjs-descriptions-button.vjs-hidden,
    .video-js .vjs-subs-caps-button.vjs-hidden,
    .video-js .vjs-audio-button.vjs-hidden {
      display: none !important;
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
      .video-js .vjs-control-bar {
        height: 50px !important;
        padding: 0 12px !important;
      }

      .video-js .vjs-button {
        margin: 0 4px !important;
        padding: 8px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        font-size: 16px !important;
      }

      .video-js .vjs-play-control {
        font-size: 20px !important;
      }

      .video-js .vjs-big-play-button {
        width: 72px !important;
        height: 72px !important;
        font-size: 26px !important;
      }

      .video-js .vjs-current-time,
      .video-js .vjs-duration {
        font-size: 12px !important;
        margin: 0 4px !important;
      }

      .video-js .vjs-progress-control {
        margin: 0 12px !important;
      }

      .video-js .vjs-text-track-display {
        bottom: 70px !important;
        font-size: 16px !important;
      }
    }
  `;

  function ensureThemeStyle() {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return null;

    let style = document.getElementById(THEME_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = THEME_ID;
      style.type = "text/css";
      style.appendChild(document.createTextNode(videoPlayerThemeCSS));
    } else if (!style.firstChild || style.textContent !== videoPlayerThemeCSS) {
      style.textContent = videoPlayerThemeCSS;
    }

    if (style.parentNode !== head || head.lastElementChild !== style) {
      head.appendChild(style); // move to end to override legacy styles
    }


    return style;
  }

  const LEGACY_CLASS_REGEX = /^(?:vjs-default-skin|vjs-theme-.*)$/;

  function stripLegacySkinClasses() {
    document.querySelectorAll(".video-js").forEach((player) => {
      const classesToRemove = Array.from(player.classList).filter((cls) => LEGACY_CLASS_REGEX.test(cls));
      classesToRemove.forEach((cls) => player.classList.remove(cls));
      player.classList.add("btfw-videojs-themed");
    });
  }

  function ensureTheme() {
    ensureThemeStyle();
    stripLegacySkinClasses();
  }

  /* ===== Guard: block context menu + surface click-to-pause ===== */
  const GUARD_MARK = "_btfwGuarded";

  function shouldAllowClick(target) {
    if (!target) return false;
    if (target.closest(".vjs-control-bar,.vjs-control,.vjs-menu,.vjs-menu-content,.vjs-slider,.vjs-volume-panel")) {
      return true;
    }
    return false;
  }

  function attachGuardsTo(el) {
    if (!el || el[GUARD_MARK]) return;
    el[GUARD_MARK] = true;

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);

    const block = (e) => {
      if (shouldAllowClick(e.target)) return;
      if (e.type === "click" && e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    el.addEventListener("click", block, true);
    el.addEventListener("pointerdown", (e) => {
      if (!shouldAllowClick(e.target) && e.button === 0) e.preventDefault();
    }, true);
    el.addEventListener("touchstart", block, true);
  }

  function attachGuards() {
    const candidates = [
      ...document.querySelectorAll("#ytapiplayer"),
      ...document.querySelectorAll(".video-js"),
      ...document.querySelectorAll(".video-js .vjs-tech"),
      ...document.querySelectorAll(".video-js .vjs-poster"),
      ...document.querySelectorAll(".video-js .vjs-loading-spinner")
    ];
    candidates.forEach(attachGuardsTo);
  }

  function watchPlayerMount() {
    const target = document.getElementById("videowrap") || document.body;
    if (!target) return;
    if (watchPlayerMount._mo) {
      try { watchPlayerMount._mo.disconnect(); } catch (_) {}
    }
    const mo = new MutationObserver(() => {
      ensureTheme();
      attachGuards();
    });
    mo.observe(target, { childList: true, subtree: true });
    watchPlayerMount._mo = mo;
  }

  function watchHead() {
    const head = document.head;
    if (!head || watchHead._mo) return;
    const mo = new MutationObserver(() => ensureThemeStyle());
    mo.observe(head, { childList: true });
    watchHead._mo = mo;
  }

  function boot() {
    ensureTheme();
    attachGuards();
    watchPlayerMount();
    watchHead();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return {
    name: "feature:player",
    applyTheme: ensureTheme,
    attachGuards
  };
});
