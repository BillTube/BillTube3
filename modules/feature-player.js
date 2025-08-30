/* BillTube Framework — feature:player (THEME + GUARD merged)
   - Applies a dark, streamlined Video.js theme
   - Disables context menu on the player surface
   - Prevents left-click on the video surface from toggling pause
     (control-bar interactions are unaffected)
*/

BTFW.define("feature:player", [], async () => {
  const THEME_ID = "btfw-video-theme";

  const videoPlayerThemeCSS = `
    /* ==== BillTube Player Theme ==== */
    .video-js {
      --btfw-bg: #0e141a;
      --btfw-bar: #162027;
      --btfw-fg: #e6eef7;
      --btfw-sub: #a9b2c3;
      --btfw-accent: #6d4df6;
      --btfw-accent-2: #8b5cf6;
      color: var(--btfw-fg);
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background-color: #000; /* keep canvas black on load */
    }

    /* Control bar */
    .video-js .vjs-control-bar {
      background-color: var(--btfw-bar) !important;
      height: 56px !important;
      display: flex; align-items: center;
      padding: 0 14px !important;
      box-shadow: 0 -2px 8px rgba(0,0,0,.35);
    }
    .video-js .vjs-control { width: 30px; }
    .video-js .vjs-time-control { width: auto !important; padding: 0 10px; color: var(--btfw-sub); letter-spacing: .06em; font-size: 12px; }

    /* Strip default gradients */
    .video-js .vjs-control-bar,
    .video-js .vjs-big-play-button,
    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: none !important;
    }

    /* Big Play */
    .video-js .vjs-big-play-button {
      width: 120px !important; height: 120px !important;
      border-radius: 50% !important;
      border: 1px solid #fff !important;
      background-color: rgba(22, 32, 39, 0.45) !important;
      top: 50% !important; left: 50% !important;
      margin-top: -60px !important; margin-left: -60px !important;
      transition: transform .12s ease, background-color .12s ease;
    }
    .video-js .vjs-big-play-button:hover { transform: scale(1.04); background-color: rgba(22,32,39,.6)!important; }
    .video-js .vjs-big-play-button .vjs-icon-placeholder::before { font-size: 64px !important; line-height: 120px !important; }

    /* Progress area */
    .video-js .vjs-progress-control {
      position: absolute !important;
      left: 58px !important; right: 180px !important;
      top: 50% !important; transform: translateY(-50%); height: 6px !important;
    }
    .video-js .vjs-progress-holder {
      height: 100% !important; margin: 0 !important; border-radius: 999px !important;
      background: rgba(255,255,255,.1) !important;
    }
    .video-js .vjs-load-progress, .video-js .vjs-play-progress { border-radius: 999px !important; }
    .video-js .vjs-load-progress { background: rgba(255,255,255,.18) !important; }
    .video-js .vjs-play-progress {
      background: linear-gradient(90deg, var(--btfw-accent), var(--btfw-accent-2)) !important;
    }
    .video-js .vjs-slider-handle {
      width: 18px !important; height: 18px !important; border-radius: 50% !important;
      top: -6px !important; background: #fff !important; box-shadow: 0 2px 6px rgba(0,0,0,.45);
    }

    /* Volume menu look */
    .video-js .vjs-volume-panel { margin-left: 8px; }
    .video-js .vjs-volume-panel .vjs-volume-control .vjs-volume-bar {
      border-radius: 999px; overflow: hidden;
      background: rgba(255,255,255,.1);
    }
    .video-js .vjs-volume-level { background: linear-gradient(90deg, var(--btfw-accent), var(--btfw-accent-2)); }

    /* Hide stuff we don't need (toggle as you like) */
    .video-js .vjs-remaining-time,
    .video-js .vjs-picture-in-picture-control { display: none !important; }

    /* Menu styling (quality, captions) */
    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background: rgba(15,20,26,.96) !important;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px;
      backdrop-filter: blur(6px) saturate(120%);
      box-shadow: 0 10px 28px rgba(0,0,0,.45);
    }
    .video-js .vjs-menu li { color: var(--btfw-fg); }
    .video-js .vjs-menu li.vjs-selected, .video-js .vjs-menu li:focus, .video-js .vjs-menu li:hover {
      background: rgba(109,77,246,.18);
    }
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
