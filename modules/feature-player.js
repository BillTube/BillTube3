/* BTFW — feature:player (VideoJS player theming, tech guards, responsive fit) */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {
  const THEME_ID = "btfw-videojs-streamlined-theme";

  // Streamlined VideoJS theme CSS - minimal, palette-aware, performant
  const videoPlayerThemeCSS = /* css */`
    :root {
      --btfw-videojs-radius: 18px;
      --btfw-videojs-control-height: 44px;
      --btfw-videojs-control-padding: 14px;
      --btfw-videojs-chrome: color-mix(in srgb, var(--btfw-color-panel, #121824) 92%, transparent 8%);
      --btfw-videojs-chrome-alt: color-mix(in srgb, var(--btfw-color-panel, #121824) 82%, transparent 18%);
      --btfw-videojs-border: color-mix(in srgb, var(--btfw-color-accent, #4ade80) 22%, transparent 78%);
      --btfw-videojs-accent: var(--btfw-color-accent, #4ade80);
      --btfw-videojs-text: var(--btfw-color-text, #f5faff);
      --btfw-videojs-text-soft: color-mix(in srgb, var(--btfw-videojs-text) 70%, transparent 30%);
    }

    .video-js {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 14px;
      line-height: 1.4;
      color: var(--btfw-videojs-text);
      background: var(--btfw-videojs-chrome);
      border-radius: var(--btfw-videojs-radius);
      overflow: hidden;
      box-shadow: 0 10px 28px color-mix(in srgb, var(--btfw-color-bg, #02060c) 48%, transparent 52%);
    }

    .video-js .vjs-tech,
    .video-js .vjs-poster {
      border-radius: inherit;
      background-color: color-mix(in srgb, var(--btfw-color-bg, #000) 72%, black 28%);
    }

    .video-js .vjs-poster {
      background-position: center;
      background-size: cover;
    }

    .video-js .vjs-control-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: var(--btfw-videojs-control-padding) calc(var(--btfw-videojs-control-padding) + 4px);
      background: linear-gradient(180deg,
        color-mix(in srgb, var(--btfw-videojs-chrome) 88%, transparent 12%),
        color-mix(in srgb, var(--btfw-videojs-chrome-alt) 92%, transparent 8%)
      );
      border-top: 1px solid var(--btfw-videojs-border);
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .video-js.vjs-user-inactive .vjs-control-bar {
      opacity: 0;
      transform: translateY(10px);
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--btfw-videojs-control-height);
      height: var(--btfw-videojs-control-height);
      min-width: var(--btfw-videojs-control-height);
      min-height: var(--btfw-videojs-control-height);
      border-radius: 12px;
      color: inherit;
      background: transparent;
      transition: background 0.16s ease, color 0.16s ease;
    }

    .video-js .vjs-control .vjs-icon-placeholder {
      font-size: 18px;
    }

    .video-js .vjs-play-control .vjs-icon-placeholder {
      font-size: 24px;
    }

    .video-js .vjs-button:hover,
    .video-js .vjs-button:focus-visible {
      background: color-mix(in srgb, var(--btfw-videojs-accent) 24%, transparent 76%);
      color: var(--btfw-color-on-accent, #111);
      outline: none;
    }

    .video-js .vjs-button:active {
      transform: scale(0.96);
    }

    .video-js .vjs-volume-panel {
      display: inline-flex !important;
      align-items: center;
      gap: 6px;
    }

    .video-js .vjs-volume-panel .vjs-volume-control {
      width: 96px;
      transition: width 0.18s ease, opacity 0.18s ease;
    }

    .video-js .vjs-volume-panel.vjs-mute-toggle-only .vjs-volume-control {
      width: 0;
      opacity: 0;
      overflow: hidden;
    }

    .video-js .vjs-volume-bar {
      height: 6px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--btfw-videojs-text-soft) 30%, transparent 70%);
    }

    .video-js .vjs-volume-level {
      background: var(--btfw-videojs-accent);
    }

    .video-js .vjs-progress-control {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      height: 8px;
    }

    .video-js .vjs-progress-holder {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 999px;
      background: color-mix(in srgb, var(--btfw-videojs-text-soft) 32%, transparent 68%);
      overflow: hidden;
    }

    .video-js .vjs-load-progress {
      background: color-mix(in srgb, var(--btfw-videojs-text-soft) 46%, transparent 54%);
    }

    .video-js .vjs-play-progress {
      background: color-mix(in srgb, var(--btfw-videojs-accent) 88%, white 12%);
      position: relative;
    }

    .video-js .vjs-play-progress::after {
      content: "";
      position: absolute;
      right: -7px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--btfw-videojs-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-bg, #02060c) 72%, transparent 28%);
      transition: transform 0.16s ease;
    }

    .video-js .vjs-progress-control:hover .vjs-play-progress::after {
      transform: translate(-1px, -50%) scale(1.05);
    }

    .video-js .vjs-time-tooltip {
      background: color-mix(in srgb, var(--btfw-videojs-chrome-alt) 86%, transparent 14%);
      color: var(--btfw-videojs-text);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      border: 1px solid var(--btfw-videojs-border);
      box-shadow: 0 10px 24px color-mix(in srgb, var(--btfw-color-bg, #02060c) 55%, transparent 45%);
    }

    .video-js .vjs-time-control {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      height: var(--btfw-videojs-control-height);
      border-radius: 999px;
      background: color-mix(in srgb, var(--btfw-videojs-chrome-alt) 80%, transparent 20%);
      color: var(--btfw-videojs-text-soft);
      font-weight: 600;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    .video-js .vjs-time-control .vjs-time-divider {
      color: color-mix(in srgb, var(--btfw-videojs-text-soft) 80%, transparent 20%);
    }

    .video-js .vjs-remaining-time {
      display: none !important;
    }

    .video-js .vjs-spacer {
      flex: 0 0 8px;
    }

    .video-js .vjs-menu-button-popup .vjs-menu {
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%);
    }

    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: color-mix(in srgb, var(--btfw-videojs-chrome) 94%, transparent 6%);
      border: 1px solid var(--btfw-videojs-border);
      border-radius: 12px;
      min-width: 150px;
      max-height: 220px;
      overflow-y: auto;
      padding: 8px 0;
      box-shadow: 0 16px 36px color-mix(in srgb, var(--btfw-color-bg, #02060c) 52%, transparent 48%);
    }

    .video-js .vjs-menu-button-popup .vjs-menu li {
      padding: 9px 18px;
      font-size: 13px;
      color: var(--btfw-videojs-text-soft);
      transition: background 0.15s ease, color 0.15s ease;
    }

    .video-js .vjs-menu-button-popup .vjs-menu li:hover,
    .video-js .vjs-menu-button-popup .vjs-menu li:focus-visible {
      background: color-mix(in srgb, var(--btfw-videojs-accent) 22%, transparent 78%);
      color: var(--btfw-color-on-accent, #111);
      outline: none;
    }

    .video-js .vjs-menu-button-popup .vjs-menu li.vjs-selected {
      background: var(--btfw-videojs-accent);
      color: var(--btfw-color-on-accent, #111);
    }

    .video-js .vjs-menu-button-popup .vjs-menu li.vjs-menu-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--btfw-videojs-text-soft);
      padding: 8px 18px 12px;
    }

    .video-js .vjs-text-track-display {
      font-family: var(--btfw-theme-font-family, 'Inter', sans-serif);
      font-size: 18px;
      font-weight: 600;
      text-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
      bottom: 78px;
    }

    .video-js .vjs-big-play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--btfw-videojs-chrome-alt) 78%, transparent 22%);
      border: 2px solid color-mix(in srgb, var(--btfw-videojs-accent) 36%, transparent 64%);
      color: var(--btfw-videojs-text);
      transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }

    .video-js .vjs-big-play-button:hover,
    .video-js .vjs-big-play-button:focus-visible {
      transform: translate(-50%, -50%) scale(1.05);
      background: color-mix(in srgb, var(--btfw-videojs-accent) 24%, transparent 76%);
      border-color: var(--btfw-videojs-accent);
      color: var(--btfw-color-on-accent, #111);
      outline: none;
    }

    .video-js .vjs-big-play-button .vjs-icon-placeholder {
      font-size: 28px;
    }

    .video-js .vjs-loading-spinner {
      border: 3px solid color-mix(in srgb, var(--btfw-videojs-text-soft) 36%, transparent 64%);
      border-top-color: var(--btfw-videojs-accent);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: btfw-video-spin 0.9s linear infinite;
    }

    .video-js .vjs-loading-spinner .vjs-control-text {
      display: none;
    }

    @keyframes btfw-video-spin {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    .video-js .vjs-error-display {
      background: color-mix(in srgb, var(--btfw-videojs-chrome) 94%, transparent 6%);
      border: 1px solid var(--btfw-videojs-border);
      border-radius: 16px;
      color: var(--btfw-videojs-text);
      padding: 24px;
      margin: 24px;
      font-size: 16px;
      text-align: center;
    }

    .video-js .vjs-picture-in-picture-control,
    .video-js .vjs-fullscreen-control {
      display: none !important;
    }

    .video-js .vjs-subs-caps-button {
      display: inline-flex;
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
