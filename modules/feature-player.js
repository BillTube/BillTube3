/* BillTube Framework — feature:player
   Custom Video.js skin to match the provided mockup. */
BTFW.define("feature:player", ["feature:layout"], async ({}) => {

  const videoPlayerThemeCSS = `
    /* ====== CONTAINER ====== */
    #videowrap .video-js {
      border-radius: 16px !important;
      overflow: hidden !important;
      box-shadow: 0 16px 40px rgba(0,0,0,.45) !important;
      background: #0e141a !important;
    }
    /* Dark glass overlay (subtle) */
    #videowrap .video-js::after{
      content:"";
      position:absolute; inset:0;
      background: rgba(0,0,0,.22);
      pointer-events:none;
      transition: opacity .25s ease;
    }
    #videowrap .video-js.vjs-has-started::after { opacity: .12; }

    /* ====== BIG CENTER PLAY ====== */
    #videowrap .video-js .vjs-big-play-button{
      width: 150px !important;
      height: 150px !important;
      border-radius: 50% !important;
      border: 6px solid #fff !important;
      background: rgba(22,32,39,.45) !important;
      top: 50% !important; left: 50% !important;
      transform: translate(-50%,-50%);
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
    }
    #videowrap .video-js .vjs-big-play-button .vjs-icon-placeholder::before{
      font-size: 80px !important;
      line-height: 150px !important;
      color: #fff !important;
      text-shadow: 0 2px 8px rgba(0,0,0,.35);
    }

    /* ====== CONTROL BAR LAYOUT (minimal, at bottom) ====== */
    #videowrap .video-js .vjs-control-bar{
      position: absolute !important;
      left: 0; right: 0; bottom: 0;
      height: 64px !important;
      background: transparent !important;
      display: block !important; /* we position children absolutely */
      box-shadow: none !important;
      padding: 0 !important;
    }

    /* Play button bottom-left */
    #videowrap .video-js .vjs-play-control{
      position: absolute !important;
      bottom: 14px; left: 16px;
      width: 36px !important; height: 36px !important;
      color: #fff !important;
      background: transparent !important;
    }
    #videowrap .video-js .vjs-play-control .vjs-icon-placeholder::before{
      font-size: 20px !important;
      line-height: 36px !important;
    }

    /* Mute button bottom-right (speaker icon) */
    #videowrap .video-js .vjs-mute-control{
      position: absolute !important;
      bottom: 14px; right: 16px;
      width: 36px !important; height: 36px !important;
      color: #fff !important;
      background: transparent !important;
    }
    #videowrap .video-js .vjs-mute-control .vjs-icon-placeholder::before{
      font-size: 18px !important;
      line-height: 36px !important;
    }

    /* ====== SEEK LINE ACROSS BOTTOM ====== */
    #videowrap .video-js .vjs-progress-control{
      position: absolute !important;
      left: 64px !important;   /* room for play icon */
      right: 64px !important;  /* room for volume/mute */
      bottom: 24px !important;
      height: 6px !important;
      display: block !important;
    }
    #videowrap .video-js .vjs-progress-holder{
      height: 6px !important;
      border-radius: 999px !important;
      margin: 0 !important;
      background: rgba(255,255,255,.25) !important;
    }
    #videowrap .video-js .vjs-load-progress{
      background: rgba(255,255,255,.35) !important;
      border-radius: 999px !important;
    }
    #videowrap .video-js .vjs-play-progress{
      background: #ffffff !important;
      border-radius: 999px !important;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08) inset;
    }
    #videowrap .video-js .vjs-slider-handle{
      width: 20px !important; height: 20px !important;
      border-radius: 50% !important;
      top: -7px !important; /* center on the 6px track */
      background: #ffffff !important;
      border: 0 !important;
      box-shadow: 0 2px 6px rgba(0,0,0,.35);
    }

    /* ====== VERTICAL VOLUME on RIGHT ====== */
    /* We emulate a vertical slider by rotating the horizontal bar. */
    #videowrap .video-js .vjs-volume-panel{
      position: absolute !important;
      right: 24px; bottom: 78px; /* above the control bar */
      width: 30px !important; height: 180px !important;
      transform: rotate(-90deg);
      transform-origin: bottom right;
      background: transparent !important;
    }
    #videowrap .video-js .vjs-volume-panel .vjs-volume-control.vjs-volume-horizontal{
      width: 160px !important; height: 6px !important;
      background: rgba(255,255,255,.25) !important;
      border-radius: 999px !important;
    }
    #videowrap .video-js .vjs-volume-panel .vjs-volume-bar{
      height: 6px !important;
      border-radius: 999px !important;
    }
    #videowrap .video-js .vjs-volume-level{
      background: #ffffff !important;
      border-radius: 999px !important;
    }
    #videowrap .video-js .vjs-volume-bar .vjs-volume-handle{
      width: 20px !important; height: 20px !important;
      border-radius: 50% !important;
      top: -7px !important;
      background: #ffffff !important;
      box-shadow: 0 2px 6px rgba(0,0,0,.35);
    }

    /* ====== HIDE CLUTTER ====== */
    #videowrap .video-js .vjs-remaining-time,
    #videowrap .video-js .vjs-current-time,
    #videowrap .video-js .vjs-time-divider,
    #videowrap .video-js .vjs-duration,
    #videowrap .video-js .vjs-fullscreen-control,
    #videowrap .video-js .vjs-picture-in-picture-control,
    #videowrap .video-js .vjs-progress-control .vjs-time-tooltip { display: none !important; }

    /* Make all icons white by default */
    #videowrap .video-js .vjs-control .vjs-icon-placeholder::before{ color:#fff !important; }
  `;

  function applyPlayerTheme() {
    if (document.getElementById("btfw-video-theme")) return;
    const style = document.createElement("style");
    style.id = "btfw-video-theme";
    style.type = "text/css";
    style.appendChild(document.createTextNode(videoPlayerThemeCSS));
    document.head.appendChild(style);
    console.log("[feature:player] Video.js theme applied");
  }

  function hasVideoJS() {
    return !!document.querySelector("#videowrap .video-js");
  }

  let mo;
  function watch() {
    const target = document.getElementById("videowrap");
    if (!target) return;
    if (mo) mo.disconnect();
    mo = new MutationObserver(() => { if (hasVideoJS()) applyPlayerTheme(); });
    mo.observe(target, { childList: true, subtree: true });
  }

  function boot() {
    if (hasVideoJS()) applyPlayerTheme();
    watch();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));

  return { name: "feature:player", apply: applyPlayerTheme };
});
