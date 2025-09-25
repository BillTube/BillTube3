/* BTFW — feature:player (VideoJS player theming, tech guards, responsive fit) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const THEME_ID = "btfw-videojs-zen-theme";

  // Zen-inspired VideoJS theme CSS - clean, minimal, modern
  const videoPlayerThemeCSS = /* css */`
    :root {
      --btfw-videojs-radius: 14px;
      --btfw-videojs-control-size: 42px;
      --btfw-videojs-control-gap: 8px;
      --btfw-videojs-surface: linear-gradient(180deg, rgba(8, 10, 18, 0.92), rgba(8, 10, 18, 0.55));
      --btfw-videojs-bar-bg: rgba(255, 255, 255, 0.22);
      --btfw-videojs-bar-fill: var(--btfw-color-accent, #6d4df6);
      --btfw-videojs-pill-bg: rgba(10, 12, 20, 0.55);
    }

    .video-js {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 14px;
      line-height: 1.4;
      color: #fff;
      background-color: #000;
      vertical-align: top;
      box-sizing: border-box;
      background-size: cover;
      background-position: center;
      user-select: none;
      border-radius: var(--btfw-videojs-radius);
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    }

    .video-js * {
      box-sizing: border-box;
    }

    .video-js .vjs-poster {
      background-size: cover;
      background-position: center;
    }

    .video-js .vjs-control-bar {
      display: flex;
      align-items: center;
      gap: var(--btfw-videojs-control-gap);
      padding: 12px 16px;
      background: var(--btfw-videojs-surface);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      transition: opacity 0.25s ease, transform 0.25s ease;
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
    }

    .video-js.vjs-user-inactive .vjs-control-bar {
      opacity: 0;
      transform: translateY(14px);
      pointer-events: none;
    }

    .video-js:not(.vjs-user-inactive) .vjs-control-bar,
    .video-js.vjs-paused .vjs-control-bar,
    .video-js:hover .vjs-control-bar {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .video-js .vjs-control {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--btfw-videojs-control-size);
      height: var(--btfw-videojs-control-size);
      min-width: var(--btfw-videojs-control-size);
      min-height: var(--btfw-videojs-control-size);
      border-radius: 12px;
      color: inherit;
      background: transparent;
      transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }

    .video-js .vjs-control .vjs-icon-placeholder {
      font-size: 18px;
      line-height: 1;
    }

    .video-js .vjs-play-control .vjs-icon-placeholder {
      font-size: 22px;
    }

    .video-js .vjs-button:hover,
    .video-js .vjs-button:focus-visible {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
      outline: none;
    }

    .video-js .vjs-button:active {
      transform: translateY(0);
    }

    .video-js .vjs-volume-panel {
      display: flex !important;
      align-items: center;
      gap: 6px;
    }

    .video-js .vjs-volume-panel .vjs-volume-control {
      width: 90px;
      max-width: 120px;
      transition: width 0.2s ease, opacity 0.2s ease;
    }

    .video-js .vjs-volume-panel.vjs-mute-toggle-only .vjs-volume-control {
      width: 0;
      opacity: 0;
      overflow: hidden;
    }

    .video-js .vjs-volume-bar {
      background: var(--btfw-videojs-bar-bg);
      border-radius: 999px;
      height: 6px;
    }

    .video-js .vjs-volume-level {
      background: var(--btfw-videojs-bar-fill);
      border-radius: inherit;
    }

    .video-js .vjs-progress-control {
      flex: 1;
      display: flex;
      align-items: center;
      height: 8px;
      cursor: pointer;
      margin: 0 12px;
    }

    .video-js .vjs-progress-holder {
      flex: 1;
      position: relative;
      height: 100%;
      background: rgba(255, 255, 255, 0.24);
      border-radius: 999px;
      overflow: hidden;
    }

    .video-js .vjs-load-progress {
      background: rgba(255, 255, 255, 0.36);
    }

    .video-js .vjs-play-progress {
      background: linear-gradient(90deg,
        var(--btfw-videojs-bar-fill),
        color-mix(in srgb, var(--btfw-videojs-bar-fill) 78%, #ffffff 22%)
      );
      border-radius: inherit;
      position: relative;
      transition: background 0.2s ease;
    }

    .video-js .vjs-play-progress::after {
      content: '';
      position: absolute;
      right: -8px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .video-js .vjs-progress-control:hover .vjs-play-progress::after {
      transform: translate(-1px, -50%) scale(1.05);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    }

    .video-js .vjs-time-tooltip {
      background: rgba(8, 10, 18, 0.9);
      color: #fff;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    }

    .video-js .vjs-time-control {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      height: var(--btfw-videojs-control-size);
      border-radius: 999px;
      background: var(--btfw-videojs-pill-bg);
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      font-size: 13px;
      min-width: auto;
    }

    .video-js .vjs-time-control .vjs-time-divider {
      color: rgba(255, 255, 255, 0.55);
    }

    .video-js .vjs-remaining-time {
      display: none !important;
    }

    .video-js .vjs-spacer {
      flex: 0 0 12px;
    }

    .video-js .vjs-menu-button-popup .vjs-menu {
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%);
    }

    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: rgba(10, 12, 20, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      min-width: 140px;
      max-height: 240px;
      overflow-y: auto;
      padding: 8px 0;
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.55);
    }

    .video-js .vjs-menu-button-popup .vjs-menu li {
      color: rgba(255, 255, 255, 0.85);
      padding: 10px 18px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .video-js .vjs-menu-button-popup .vjs-menu li:hover,
    .video-js .vjs-menu-button-popup .vjs-menu li:focus-visible {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      outline: none;
    }

    .video-js .vjs-menu-button-popup .vjs-menu li.vjs-selected {
      background: var(--btfw-videojs-bar-fill);
      color: #fff;
    }

    .video-js .vjs-menu-button-popup .vjs-menu li.vjs-menu-title {
      color: rgba(255, 255, 255, 0.68);
      font-weight: 600;
      padding: 8px 18px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      margin-bottom: 4px;
    }

    .video-js .vjs-text-track-display {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 18px;
      font-weight: 600;
      text-shadow: 2px 2px 12px rgba(0, 0, 0, 0.9);
      bottom: 78px;
    }

    .video-js .vjs-big-play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: rgba(8, 10, 16, 0.82);
      border: 2px solid rgba(255, 255, 255, 0.28);
      color: #fff;
      font-size: 28px;
      cursor: pointer;
      transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
    }

    .video-js .vjs-big-play-button:hover,
    .video-js .vjs-big-play-button:focus-visible {
      background: rgba(8, 10, 16, 0.95);
      border-color: var(--btfw-videojs-bar-fill);
      transform: translate(-50%, -50%) scale(1.05);
      outline: none;
    }

    .video-js .vjs-big-play-button .vjs-icon-placeholder {
      font-size: inherit;
    }

    .video-js .vjs-loading-spinner {
      border: 3px solid rgba(255, 255, 255, 0.18);
      border-top-color: var(--btfw-videojs-bar-fill);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: btfw-video-spin 1s linear infinite;
    }

    @keyframes btfw-video-spin {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    .video-js .vjs-loading-spinner .vjs-control-text {
      display: none;
    }

    .video-js .vjs-error-display {
      background: rgba(6, 8, 14, 0.92);
      color: #fff;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px;
      font-size: 16px;
      text-align: center;
      margin: 24px;
    }

    .video-js .vjs-picture-in-picture-control,
    .video-js .vjs-fullscreen-control {
      display: none !important;
    }

    .video-js .vjs-subs-caps-button {
      display: flex;
    }

    @media (max-width: 768px) {
      .video-js {
        border-radius: 12px;
      }

      .video-js .vjs-control-bar {
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
      }

      .video-js .vjs-progress-control {
        order: 4;
        height: 6px;
      }

      .video-js .vjs-time-control {
        order: 10;
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
