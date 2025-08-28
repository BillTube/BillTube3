BTFW.define("feature:player", ["core"], async () => {

  // This is the CSS from the CodePen, translated to target Video.js classes.
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

    /* Removing default background gradients */
    .video-js .vjs-control-bar,
    .video-js .vjs-big-play-button,
    .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
      background-color: transparent !important;
      background: none !important;
    }

    /* Big Play Button in the center */
    .vjs-big-play-button {
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
    .vjs-big-play-button .vjs-icon-placeholder::before {
      font-size: 80px !important;
      line-height: 150px !important;
    }

    /* General icon styling */
    .video-js .vjs-control {
      width: 30px;
    }

    /* Progress bar / Seek bar */
    .video-js .vjs-progress-control {
      position: absolute !important;
      left: 60px !important;
      right: 200px !important; /* Make space for time and volume */
      top: 50% !important;
      transform: translateY(-50%);
      height: 5px !important;
    }
    .video-js .vjs-progress-holder {
      height: 100% !important;
      border-radius: 20px !important;
      margin: 0 !important;
    }
    .video-js .vjs-play-progress, .video-js .vjs-load-progress {
      border-radius: 20px !important;
    }
    .video-js .vjs-slider-handle {
      width: 20px !important;
      height: 20px !important;
      border-radius: 50% !important;
      top: -7.5px !important; /* Center the handle on the bar */
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

    /* Volume control (vertical) */
    .video-js .vjs-volume-panel {
      width: 30px !important;
      position: absolute !important;
      right: 15px;
      top: -120px; /* Position above the control bar */
      transform: rotate(-90deg);
      transform-origin: bottom right;
    }
    .video-js .vjs-volume-panel .vjs-volume-control.vjs-volume-horizontal {
      width: 150px !important; /* Set width for the rotated bar */
      height: 5px !important;
    }
    .vjs-volume-bar.vjs-slider-horizontal {
      margin: 2px 0 !important;
    }

    /* Hiding elements we don't need from the custom theme */
    .video-js .vjs-remaining-time,
    .video-js .vjs-fullscreen-control,
    .video-js .vjs-picture-in-picture-control {
      display: none !important;
    }
  `;

  // This function injects our CSS into the page head.
  function applyPlayerTheme() {
    // Check if our style block already exists
    if (document.getElementById('btfw-video-theme')) {
      return;
    }
    console.log("[BTFW Player] Applying custom video player theme.");
    
    const style = document.createElement('style');
    style.id = 'btfw-video-theme';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(videoPlayerThemeCSS));
    
    document.head.appendChild(style);
  }

  // --- Main Execution ---

  // Create a MutationObserver to watch for when the video player is added to the page.
  // This is robust and works even when CyTube changes media.
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        // Check if the added node is the video player or contains it
        const playerElement = document.querySelector('.video-js');
        if (playerElement) {
          applyPlayerTheme();
          // Optional: once we've found it and applied the theme, we might not need to observe anymore.
          // observer.disconnect();
        }
      }
    }
  });

  // Start observing the part of the page where the video player appears.
  const targetNode = document.getElementById('videowrap');
  if (targetNode) {
    observer.observe(targetNode, { childList: true, subtree: true });
  } else {
    // Fallback if videowrap isn't there yet
    document.addEventListener("DOMContentLoaded", () => {
        const targetNode = document.getElementById('videowrap');
        if (targetNode) {
            observer.observe(targetNode, { childList: true, subtree: true });
        }
    });
  }

  // Also try to apply it once on load, just in case the player is already there.
  if (document.querySelector('.video-js')) {
    applyPlayerTheme();
  }

  return { name: "feature:player" };
});