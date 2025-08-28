/* BillTube Framework — feature:player
   Custom Video.js control-bar theme + robust attach when player appears */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {

  // CSS from your CodePen, scoped to Video.js
  const videoPlayerThemeCSS = `
    /* Main control bar background and layout */
    .video-js .vjs-control-bar {
      background-color: #162027 !important;
      height: 60px !important;
      display: flex;
      align-items: center;
      padding: 0 15px !important;
      box-shadow: 0 -2px 6px rgba(0,0,0,.3);
    }

    /* Remove default gradients */
    .video-js .vjs-control-bar,
    .video-js .vjs-big-play-button,
    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background-color: transparent !important;
      background: none !important;
    }

    /* Big Play Button in the center */
    .video-js .vjs-big-play-button {
      width: 150px !important;
      height: 150px !important;
      border-radius: 50% !important;
      border: 1px solid #fff !important;
      background-color: rgba(22, 32, 39, 0.5) !important;
      top: 50% !important;
      left: 50% !important;
      margin-top: -75px !important;
      margin-left: -75px !important;
    }
    .video-js .vjs-big-play-button .vjs-icon-placeholder::before {
      font-size: 80px !important;
      line-height: 150px !important;
    }

    /* General icon sizing */
    .video-js .vjs-control {
      width: 30px;
    }

    /* Progress / Seek bar */
    .video-js .vjs-progress-control {
      position: absolute !important;
      left: 60px !important;
      right: 200px !important; /* space for time + volume */
      top: 50% !important;
      transform: translateY(-50%);
      height: 5px !important;
    }
    .video-js .vjs-progress-holder {
      height: 100% !important;
      border-radius: 20px !important;
      margin: 0 !important;
    }
    .video-js .vjs-play-progress,
    .video-js .vjs-load-progress {
      border-radius: 20px !important;
    }
    .video-js .vjs-slider-handle {
      width: 20px !important;
      height: 20px !important;
      border-radius: 50% !important;
      top: -7.5px !important; /* center handle */
    }

    /* Time display */
    .video-js .vjs-time-control {
      font-family: Arial, sans-serif;
      font-size: 12px !important;
      letter-spacing: 3px !important;
      line-height: 60px !important;
      width: auto !important;
      padding: 0 15px !important;
    }

    /* Volume (vertical) */
    .video-js .vjs-volume-panel {
      width: 30px !important;
      position: absolute !important;
      right: 15px;
      top: -120px; /* above the bar */
      transform: rotate(-90deg);
      transform-origin: bottom right;
    }
    .video-js .vjs-volume-panel .vjs-volume-control.vjs-volume-horizontal {
      width: 150px !important;
      height: 5px !important;
    }
    .vjs-volume-bar.vjs-slider-horizontal {
      margin: 2px 0 !important;
    }

    /* Hide elements not used in this custom theme */
    .video-js .vjs-remaining-time,
    .video-js .vjs-fullscreen-control,
    .video-js .vjs-picture-in-picture-control {
      display: none !important;
    }
  `;

  function applyPlayerTheme() {
    if (document.getElementById("btfw-video-theme")) return;
    const style = document.createElement("style");
    style.id = "btfw-video-theme";
    style.type = "text/css";
    style.appendChild(document.createTextNode(videoPlayerThemeCSS));
    document.head.appendChild(style);
    console.log("[feature:player] custom Video.js theme applied");
  }

  function hasVideoJS() {
    return !!document.querySelector("#videowrap .video-js");
  }

  // Watch #videowrap for Video.js player insertion / media changes
  let mo;
  function watch() {
    const target = document.getElementById("videowrap");
    if (!target) return;
    if (mo) mo.disconnect();
    mo = new MutationObserver(() => {
      if (hasVideoJS()) applyPlayerTheme();
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  function boot() {
    // If a Video.js player is already present, style immediately
    if (hasVideoJS()) applyPlayerTheme();
    // Always watch for later swaps (changeMedia, etc.)
    watch();
  }

  // Run after layout so #videowrap is in place
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return { name: "feature:player", apply: applyPlayerTheme };
});
