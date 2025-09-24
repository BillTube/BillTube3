BTFW.define("feature:videoOverlay", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);

  let overlayTimeout = null;
  let refreshClickCount = 0;
  let refreshCooldownUntil = 0;
  let isAmbientActive = false;
  let ambientScript = null;

  function createOverlay() {
    const videowrap = $("#videowrap");
    if (!videowrap) return null;

    let overlay = videowrap.querySelector("#btfw-video-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "btfw-video-overlay";
    overlay.className = "btfw-video-overlay";
    overlay.style.opacity = "0";

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "btfw-vo-controls";

    const buttons = [
      { id: "btfw-fullscreen", icon: "expand", tooltip: "Fullscreen", action: toggleFullscreen },
      { id: "btfw-voteskip", icon: "forward", tooltip: "Vote Skip", action: handleVoteSkip },
      { id: "btfw-refresh", icon: "refresh", tooltip: "Refresh Media", action: handleMediaRefresh },
      { id: "btfw-ambient", icon: "sun", tooltip: "Ambient Mode", action: toggleAmbient },
      { id: "btfw-airplay", icon: "cast", tooltip: "AirPlay", action: enableAirplay }
    ];

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.id = btn.id;
      button.className = "btfw-vo-btn";
      button.innerHTML = `<i class="fas fa-${btn.icon}"></i>`;
      button.title = btn.tooltip;
      button.addEventListener("click", btn.action);
      controlsContainer.appendChild(button);
    });

    overlay.appendChild(controlsContainer);
    videowrap.appendChild(overlay);

    setupOverlayEvents(videowrap, overlay);
    return overlay;
  }

  function setupOverlayEvents(videowrap, overlay) {
    let hideTimer = null;

    function showOverlay() {
      clearTimeout(hideTimer);
      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
    }

    function hideOverlay() {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (overlay.style.opacity === "0") {
          overlay.style.pointerEvents = "none";
        }
      }, 300);
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideOverlay, 3000);
    }

    videowrap.addEventListener("mouseenter", showOverlay);
    videowrap.addEventListener("mousemove", () => {
      showOverlay();
      scheduleHide();
    });

    videowrap.addEventListener("mouseleave", hideOverlay);

    overlay.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showOverlay();
    });

    overlay.addEventListener("mouseleave", scheduleHide);
  }

  function toggleFullscreen() {
    const videowrap = $("#videowrap");
    if (!videowrap) return;

    const video = videowrap.querySelector("video, iframe");
    if (!video) return;

    if (!document.fullscreenElement) {
      if (videowrap.requestFullscreen) {
        videowrap.requestFullscreen();
      } else if (videowrap.webkitRequestFullscreen) {
        videowrap.webkitRequestFullscreen();
      } else if (videowrap.mozRequestFullScreen) {
        videowrap.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  }

  function handleVoteSkip() {
    const voteSkipBtn = $("#voteskip");
    if (voteSkipBtn && !voteSkipBtn.disabled) {
      voteSkipBtn.click();
    } else {
      try {
        if (window.socket) {
          socket.emit("voteskip");
        }
      } catch (e) {
        console.warn("[video-overlay] Vote skip failed:", e);
      }
    }
  }

  function handleMediaRefresh() {
    const now = Date.now();
    
    if (now < refreshCooldownUntil) {
      const remainingSeconds = Math.ceil((refreshCooldownUntil - now) / 1000);
      showNotification(`Refresh on cooldown for ${remainingSeconds}s`, "warning");
      return;
    }

    refreshClickCount++;
    
    if (refreshClickCount >= 10) {
      refreshCooldownUntil = now + 30000;
      refreshClickCount = 0;
      showNotification("Refresh limit reached. 30s cooldown active.", "error");
      return;
    }

    setTimeout(() => {
      if (refreshClickCount > 0) refreshClickCount--;
    }, 10000);

    const refreshBtn = $("#mediarefresh");
    if (refreshBtn && !refreshBtn.disabled) {
      refreshBtn.click();
    } else {
      try {
        if (window.socket) {
          socket.emit("playerReady");
        }
      } catch (e) {
        console.warn("[video-overlay] Media refresh failed:", e);
      }
    }
    
    showNotification("Media refreshed", "success");
  }

  async function toggleAmbient() {
    if (!ambientScript) {
      try {
        showNotification("Loading ambient mode...", "info");
        await loadAmbientScript();
      } catch (e) {
        showNotification("Failed to load ambient mode", "error");
        return;
      }
    }

    isAmbientActive = !isAmbientActive;
    
    try {
      if (window.toggleAmbient) {
        window.toggleAmbient();
      } else if (window.ambientToggle) {
        window.ambientToggle();
      }
    } catch (e) {
      console.warn("[video-overlay] Ambient toggle failed:", e);
    }

    const btn = $("#btfw-ambient");
    if (btn) {
      btn.style.background = isAmbientActive 
        ? "rgba(109, 77, 246, 0.8)" 
        : "rgba(0, 0, 0, 0.4)";
    }

    showNotification(isAmbientActive ? "Ambient mode enabled" : "Ambient mode disabled", "info");
  }

  function loadAmbientScript() {
    return new Promise((resolve, reject) => {
      if (ambientScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://billtube.github.io/BillTube2/BillTube_Ambient.js';
      script.onload = () => {
        ambientScript = script;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ambient script'));
      document.head.appendChild(script);
    });
  }

  function enableAirplay() {
    const video = document.querySelector("#ytapiplayer video, #ytapiplayer");
    if (video) {
      video.setAttribute("airplay", "allow");
      video.setAttribute("x-webkit-airplay", "allow");
      
      if (video.webkitShowPlaybackTargetPicker) {
        video.webkitShowPlaybackTargetPicker();
      }
      
      showNotification("AirPlay enabled", "success");
    } else {
      showNotification("AirPlay not available", "warning");
    }
  }

  function showNotification(message, type = "info") {
    let notification = document.getElementById("btfw-notification");
    
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "btfw-notification";
      notification.className = "btfw-notification";
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `btfw-notification btfw-notification--${type} btfw-notification--show`;

    clearTimeout(notification._hideTimer);
    notification._hideTimer = setTimeout(() => {
      notification.classList.remove("btfw-notification--show");
    }, 3000);
  }

  function injectCSS() {
    if (document.getElementById("btfw-video-overlay-css")) return;

    const style = document.createElement("style");
    style.id = "btfw-video-overlay-css";
    style.textContent = `
      .btfw-video-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        pointer-events: none;
        transition: opacity 0.3s ease;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.3) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0, 0, 0, 0.3) 100%
        );
      }

      .btfw-vo-controls {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
        pointer-events: auto;
      }

      .btfw-vo-btn {
        width: 44px;
        height: 44px;
        border-radius: 22px;
        border: none;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px) saturate(120%);
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .btfw-vo-btn:hover {
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
      }

      .btfw-vo-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .btfw-vo-btn i {
        transition: transform 0.2s ease;
      }

      .btfw-vo-btn:hover i {
        transform: scale(1.1);
      }

      #btfw-ambient.active {
        background: rgba(109, 77, 246, 0.8);
      }

      .btfw-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        max-width: 300px;
      }

      .btfw-notification--show {
        transform: translateX(0);
        opacity: 1;
      }

      .btfw-notification--success {
        background: rgba(34, 197, 94, 0.9);
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .btfw-notification--error {
        background: rgba(239, 68, 68, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .btfw-notification--warning {
        background: rgba(245, 158, 11, 0.9);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .btfw-notification--info {
        background: rgba(59, 130, 246, 0.9);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      @media (max-width: 768px) {
        .btfw-vo-controls {
          top: 8px;
          right: 8px;
          gap: 6px;
        }
        
        .btfw-vo-btn {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          font-size: 14px;
        }
        
        .btfw-notification {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .btfw-vo-btn.loading {
        animation: pulse 1s infinite;
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectCSS();
    
    const checkVideoWrap = () => {
      const videowrap = $("#videowrap");
      if (videowrap) {
        createOverlay();
        
        if (window.socket) {
          socket.on("changeMedia", () => {
            setTimeout(() => {
              const video = document.querySelector("#ytapiplayer video");
              if (video) {
                video.setAttribute("airplay", "allow");
                video.setAttribute("x-webkit-airplay", "allow");
              }
            }, 1000);
          });
        }
      } else {
        setTimeout(checkVideoWrap, 500);
      }
    };

    checkVideoWrap();
  }

  document.addEventListener("btfw:layoutReady", boot);
  if (document.readyState !== "loading") {
    setTimeout(boot, 100);
  }

  return {
    name: "feature:videoOverlay",
    createOverlay,
    toggleFullscreen,
    toggleAmbient,
    enableAirplay
  };
});