BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const THEME_ID = "btfw-videojs-zen-theme";

  const videoPlayerThemeCSS = `
    /* Zen Theme - Clean & Minimal Video.js Styling */
    .video-js {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 14px;
      line-height: 1.4;
      color: #fff;
      background-color: #000;
      position: relative;
      vertical-align: top;
      box-sizing: border-box;
      background-size: cover;
      background-position: center;
      user-select: none;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    /* Control bar - sleek and minimal */
    .video-js .vjs-control-bar {
      display: flex;
      align-items: center;
      background: linear-gradient(to top, 
        rgba(0, 0, 0, 0.8) 0%, 
        rgba(0, 0, 0, 0.6) 50%, 
        transparent 100%);
      backdrop-filter: blur(8px);
      border: none;
      height: 48px;
      padding: 0 12px;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .video-js:not(.vjs-user-inactive) .vjs-control-bar {
      transform: translateY(0);
      opacity: 1;
    }

    .video-js.vjs-user-inactive .vjs-control-bar {
      transform: translateY(8px);
      opacity: 0;
    }

    /* Buttons - clean circular design */
    .video-js .vjs-button {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      margin: 0 4px;
      padding: 8px;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
    }

    .video-js .vjs-button:hover,
    .video-js .vjs-button:focus {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.05);
      outline: none;
    }

    .video-js .vjs-button:active {
      transform: scale(0.95);
    }

    /* Play/Pause button - slightly larger */
    .video-js .vjs-play-control {
      width: 44px;
      height: 44px;
      margin-right: 8px;
    }

    /* Progress control - modern slider */
    .video-js .vjs-progress-control {
      flex: auto;
      display: flex;
      align-items: center;
      margin: 0 12px;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      cursor: pointer;
      transition: height 0.2s ease;
    }

    .video-js .vjs-progress-control:hover {
      height: 8px;
    }

    .video-js .vjs-progress-holder {
      flex: auto;
      display: flex;
      align-items: center;
      height: 100%;
      margin: 0;
      background: transparent;
      border-radius: 3px;
    }

    .video-js .vjs-play-progress {
      background: var(--btfw-color-accent, #6d4df6);
      background: linear-gradient(90deg, 
        var(--btfw-color-accent, #6d4df6), 
        color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 80%, #fff 20%)
      );
      border-radius: 3px;
      height: 100%;
      position: relative;
    }

    .video-js .vjs-play-progress:before {
      content: '';
      position: absolute;
      top: 50%;
      right: -6px;
      transform: translateY(-50%);
      width: 12px;
      height: 12px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .video-js .vjs-progress-control:hover .vjs-play-progress:before {
      opacity: 1;
    }

    .video-js .vjs-load-progress {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      height: 100%;
    }

    /* Time displays */
    .video-js .vjs-current-time,
    .video-js .vjs-duration,
    .video-js .vjs-time-divider {
      display: block;
      flex: none;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      padding: 0;
      margin: 0 4px;
      line-height: 1;
      min-width: auto;
    }

    .video-js .vjs-time-divider {
      padding: 0 2px;
    }

    /* Volume control */
    .video-js .vjs-volume-panel {
      display: flex;
      align-items: center;
    }

    .video-js .vjs-volume-control {
      width: 0;
      transition: width 0.3s ease;
      overflow: hidden;
    }

    .video-js .vjs-volume-panel:hover .vjs-volume-control {
      width: 80px;
    }

    .video-js .vjs-volume-bar {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      height: 4px;
      margin: 0 8px;
    }

    .video-js .vjs-volume-level {
      background: var(--btfw-color-accent, #6d4df6);
      border-radius: 2px;
      height: 100%;
    }

    /* Fullscreen button */
    .video-js .vjs-fullscreen-control {
      margin-left: 4px;
    }

    /* Big play button - clean centered design */
    .video-js .vjs-big-play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      color: #fff;
      font-size: 24px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .video-js .vjs-big-play-button:hover,
    .video-js .vjs-big-play-button:focus {
      background: rgba(0, 0, 0, 0.9);
      border-color: var(--btfw-color-accent, #6d4df6);
      transform: translate(-50%, -50%) scale(1.05);
      outline: none;
    }

    .video-js .vjs-big-play-button:active {
      transform: translate(-50%, -50%) scale(0.95);
    }

    .video-js .vjs-big-play-button .vjs-icon-placeholder:before {
      position: absolute;
      top: 50%;
      left: 55%;
      transform: translate(-50%, -50%);
    }

    /* Loading spinner */
    .video-js .vjs-loading-spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top: 3px solid var(--btfw-color-accent, #6d4df6);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: vjs-spin 1s linear infinite;
    }

    @keyframes vjs-spin {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }

    /* Error display */
    .video-js .vjs-error-display {
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      color: #fff;
      border-radius: 8px;
      margin: 20px;
      padding: 20px;
      font-size: 16px;
      text-align: center;
    }

    /* Poster image */
    .video-js .vjs-poster {
      background-size: cover;
      background-position: center;
      border-radius: 12px;
    }

    /* Menu styling (quality, captions, etc.) */
    .video-js .vjs-menu-button-popup .vjs-menu {
      position: absolute;
      bottom: 100%;
      margin-bottom: 8px;
    }

    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      min-width: 120px;
      max-height: 200px;
      overflow-y: auto;
      padding: 4px 0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .video-js .vjs-menu li {
      color: rgba(255, 255, 255, 0.9);
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .video-js .vjs-menu li:hover,
    .video-js .vjs-menu li:focus {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .video-js .vjs-menu li.vjs-selected {
      background: var(--btfw-color-accent, #6d4df6);
      color: #fff;
    }

    /* Text tracks / subtitles */
    .video-js .vjs-text-track-display {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 16px;
      font-weight: 500;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      bottom: 60px;
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
      .video-js .vjs-control-bar {
        height: 44px;
        padding: 0 8px;
      }

      .video-js .vjs-button {
        width: 32px;
        height: 32px;
        margin: 0 2px;
      }

      .video-js .vjs-play-control {
        width: 36px;
        height: 36px;
      }

      .video-js .vjs-big-play-button {
        width: 64px;
        height: 64px;
        font-size: 20px;
      }

      .video-js .vjs-current-time,
      .video-js .vjs-duration {
        font-size: 11px;
        margin: 0 2px;
      }
    }

    /* Hide unwanted controls */
    .video-js .vjs-remaining-time { display: none !important; }
    .video-js .vjs-picture-in-picture-control { display: none !important; }
  `;

  function applyPlayerTheme() {
    if (document.getElementById(THEME_ID)) return;
    const style = document.createElement("style");
    style.id = THEME_ID;
    style.type = "text/css";
    style.appendChild(document.createTextNode(videoPlayerThemeCSS));
    document.head.appendChild(style);
  }

  /* ===== Guard: block context menu + surface click-to-pause ===== */
  const GUARD_MARK = "_btfwGuarded";

  function shouldAllowClick(target) {
    // Allow clicks on any control UI
    if (target.closest(".vjs-control-bar,.vjs-control,.vjs-menu,.vjs-menu-content,.vjs-slider,.vjs-volume-panel")) {
      return true;
    }
    return false;
  }

  function attachGuardsTo(el) {
    if (!el || el[GUARD_MARK]) return;
    el[GUARD_MARK] = true;

    // No right-click menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);

    // Block surface left-click (capture) so Video.js doesn't toggle pause
    const block = (e) => {
      // Only block direct video surface / poster / spinner, not controls
      if (shouldAllowClick(e.target)) return;
      // Only block primary button
      if (e.type === "click" && e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    el.addEventListener("click", block, true);
    el.addEventListener("pointerdown", (e)=> { if (!shouldAllowClick(e.target) && e.button===0) e.preventDefault(); }, true);
    el.addEventListener("touchstart", block, true);
  }

  function attachGuards() {
    // CyTube container + Video.js root + tech element
    const candidates = [
      ...document.querySelectorAll("#ytapiplayer"),
      ...document.querySelectorAll(".video-js"),
      ...document.querySelectorAll(".video-js .vjs-tech"),
      ...document.querySelectorAll(".video-js .vjs-poster"),
      ...document.querySelectorAll(".video-js .vjs-loading-spinner")
    ];
    candidates.forEach(attachGuardsTo);
  }

  /* ===== Observe player mount/reloads ===== */
  let mo = null;
  function watchPlayerMount() {
    const target = document.getElementById("videowrap") || document.body;
    if (mo) { try { mo.disconnect(); } catch(_){} mo = null; }
    mo = new MutationObserver(() => {
      // Each mutation pass: ensure theme + guards
      applyPlayerTheme();
      attachGuards();
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  function boot() {
    applyPlayerTheme();
    attachGuards();
    watchPlayerMount();
  }

  // Boot on ready and when layout signals ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return {
    name: "feature:player",
    applyTheme: applyPlayerTheme,
    attachGuards
  };
});