BTFW.define("feature:ambient", [], async () => {
  const STORAGE_KEY = "btfw:ambient:enabled";

  const $ = (selector, root = document) => root.querySelector(selector);

  let active = false;
  let wrap = null;
  let monitorTimer = null;
  let currentVideo = null;
  let glowVideo = null;
  let glowContainer = null;
  let waitForWrapPromise = null;
  let socketListenerAttached = false;
  let syncHandler = null;

  function ensureCSS() {
    if (document.getElementById("btfw-ambient-css")) return;

    const st = document.createElement("style");
    st.id = "btfw-ambient-css";
    st.textContent = `
      #videowrap.btfw-ambient-ready {
        position: relative;
        isolation: isolate;
        overflow: visible;
      }

      /* Ambient glow container */
      #videowrap .btfw-ambient-glow {
        position: absolute;
        inset: -15%;
        z-index: -1;
        overflow: hidden;
        border-radius: clamp(26px, 8vw, 38px);
        opacity: 0;
        transform: scale(0.92);
        transition: opacity 0.6s ease, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
      }

      #videowrap.btfw-ambient-enabled .btfw-ambient-glow {
        opacity: 1;
        transform: scale(1);
      }

      /* Cloned video for glow effect */
      #videowrap .btfw-ambient-glow video {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(clamp(50px, 8vw, 80px)) saturate(180%) brightness(1.25);
        opacity: 0.75;
      }

      /* Enhanced video styling when ambient is active */
      #videowrap.btfw-ambient-enabled #ytapiplayer,
      #videowrap.btfw-ambient-enabled .video-js,
      #videowrap.btfw-ambient-enabled iframe,
      #videowrap.btfw-ambient-enabled video:not(.btfw-ambient-glow video) {
        border-radius: clamp(16px, 3vw, 24px);
        box-shadow:
          0 35px 80px rgba(0, 0, 0, 0.45),
          0 20px 40px rgba(0, 0, 0, 0.35),
          0 10px 20px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        transition: box-shadow 0.45s ease, border-radius 0.45s ease;
      }

      #videowrap.btfw-ambient-enabled .video-js {
        background: transparent;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        #videowrap .btfw-ambient-glow {
          inset: -20%;
          border-radius: clamp(20px, 10vw, 32px);
        }

        #videowrap .btfw-ambient-glow video {
          filter: blur(clamp(40px, 10vw, 60px)) saturate(160%) brightness(1.2);
          opacity: 0.7;
        }

        #videowrap.btfw-ambient-enabled #ytapiplayer,
        #videowrap.btfw-ambient-enabled .video-js,
        #videowrap.btfw-ambient-enabled iframe,
        #videowrap.btfw-ambient-enabled video:not(.btfw-ambient-glow video) {
          border-radius: clamp(12px, 4vw, 18px);
          box-shadow:
            0 25px 60px rgba(0, 0, 0, 0.4),
            0 15px 30px rgba(0, 0, 0, 0.3);
        }
      }

      /* Smooth fade-in animation */
      @keyframes btfw-ambient-fadeIn {
        from {
          opacity: 0;
          transform: scale(0.92);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(st);
  }

  function waitForWrap(timeout = 5000) {
    if (waitForWrapPromise) return waitForWrapPromise;

    const immediate = $("#videowrap");
    if (immediate) return Promise.resolve(immediate);

    waitForWrapPromise = new Promise((resolve) => {
      if (!document.body) {
        resolve(null);
        return;
      }

      const deadline = Date.now() + timeout;
      const observer = new MutationObserver(() => {
        const found = $("#videowrap");
        if (found) {
          observer.disconnect();
          waitForWrapPromise = null;
          resolve(found);
        } else if (Date.now() > deadline) {
          observer.disconnect();
          waitForWrapPromise = null;
          resolve(null);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        waitForWrapPromise = null;
        resolve($("#videowrap"));
      }, timeout);
    });

    return waitForWrapPromise;
  }

  function ensureAmbientRoot(preferredWrap = null) {
    const nextWrap = preferredWrap || $("#videowrap");
    if (!nextWrap) return null;

    ensureCSS();

    if (wrap && wrap !== nextWrap) {
      wrap.classList.remove("btfw-ambient-enabled", "btfw-ambient-ready");
      cleanupGlowElements();
    }

    wrap = nextWrap;
    wrap.classList.add("btfw-ambient-ready");
    
    if (active) {
      wrap.classList.add("btfw-ambient-enabled");
    }

    return wrap;
  }

  function getStoredPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setStoredPreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch (_) {}
  }

  function findVideoElement() {
    return $("#ytapiplayer video") || $("#videowrap video") || document.querySelector("video");
  }

  function cleanupGlowElements() {
    if (glowContainer && glowContainer.parentNode) {
      try {
        glowContainer.remove();
      } catch (_) {
        glowContainer.parentNode.removeChild(glowContainer);
      }
    }
    glowContainer = null;
    glowVideo = null;
  }

  function createGlowElements() {
    if (!wrap) return;

    // Remove existing glow elements
    cleanupGlowElements();

    // Create glow container
    glowContainer = document.createElement("div");
    glowContainer.className = "btfw-ambient-glow";

    // Create cloned video for glow effect
    glowVideo = document.createElement("video");
    glowVideo.muted = true;
    glowVideo.playsInline = true;
    glowVideo.loop = true;
    glowVideo.style.pointerEvents = "none";

    glowContainer.appendChild(glowVideo);
    
    // Insert at the beginning of videowrap
    if (wrap.firstChild) {
      wrap.insertBefore(glowContainer, wrap.firstChild);
    } else {
      wrap.appendChild(glowContainer);
    }
  }

  function syncVideos() {
    if (!currentVideo || !glowVideo) return;

    try {
      // Sync source
      const src = currentVideo.src || currentVideo.currentSrc;
      if (src && glowVideo.src !== src) {
        glowVideo.src = src;
      }

      // Sync time
      const timeDiff = Math.abs(currentVideo.currentTime - glowVideo.currentTime);
      if (timeDiff > 0.3) {
        glowVideo.currentTime = currentVideo.currentTime;
      }

      // Sync playback state
      if (!currentVideo.paused && glowVideo.paused) {
        glowVideo.play().catch(() => {});
      } else if (currentVideo.paused && !glowVideo.paused) {
        glowVideo.pause();
      }
    } catch (_) {}
  }

  function detachVideoListeners() {
    if (!currentVideo || !syncHandler) return;

    const events = ["loadeddata", "play", "pause", "seeked", "timeupdate", "ended", "emptied"];
    events.forEach((evt) => {
      try {
        currentVideo.removeEventListener(evt, syncHandler);
      } catch (_) {}
    });

    syncHandler = null;
    currentVideo = null;
  }

  function attachVideo(video) {
    if (currentVideo === video) return;

    detachVideoListeners();
    currentVideo = video && video.tagName === "VIDEO" ? video : null;

    if (!currentVideo) {
      cleanupGlowElements();
      return;
    }

    // Create glow elements if they don't exist
    if (!glowContainer) {
      createGlowElements();
    }

    // Create sync handler
    syncHandler = () => syncVideos();

    // Attach event listeners
    const events = ["loadeddata", "play", "pause", "seeked", "timeupdate"];
    events.forEach((evt) => {
      try {
        currentVideo.addEventListener(evt, syncHandler);
      } catch (_) {}
    });

    // Initial sync
    syncVideos();
  }

  function startMonitoring() {
    if (monitorTimer) return;

    monitorTimer = window.setInterval(() => {
      if (!active) return;

      const wrapNow = $("#videowrap");

      if (!wrapNow) {
        if (wrap && !wrap.isConnected) {
          wrap.classList.remove("btfw-ambient-enabled", "btfw-ambient-ready");
          cleanupGlowElements();
          wrap = null;
        }
      } else if (wrapNow !== wrap || !wrap || !wrap.classList.contains("btfw-ambient-ready")) {
        ensureAmbientRoot(wrapNow);
      }

      const videoEl = findVideoElement();
      if (videoEl !== currentVideo) {
        attachVideo(videoEl);
      }
    }, 1000);

    wireSocketListener();
  }

  function stopMonitoring() {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
    detachVideoListeners();
    cleanupGlowElements();
  }

  function wireSocketListener() {
    if (socketListenerAttached) return;
    try {
      if (window.socket && typeof socket.on === "function") {
        socketListenerAttached = true;
        socket.on("changeMedia", () => {
          if (!active) return;
          setTimeout(() => {
            ensureAmbientRoot();
            attachVideo(findVideoElement());
          }, 400);
        });
      }
    } catch (_) {}
  }

  async function enable() {
    if (active) return true;

    ensureCSS();
    const wrapEl = $("#videowrap") || (await waitForWrap());
    if (!wrapEl) {
      console.warn("[ambient] Unable to locate #videowrap for ambient mode.");
      return false;
    }

    const ensuredWrap = ensureAmbientRoot(wrapEl);
    if (ensuredWrap) {
      ensuredWrap.classList.add("btfw-ambient-enabled");
    }
    
    active = true;
    setStoredPreference(true);
    startMonitoring();
    attachVideo(findVideoElement());
    dispatchState();
    
    return true;
  }

  async function disable() {
    if (!active) return true;

    active = false;
    setStoredPreference(false);

    if (wrap) wrap.classList.remove("btfw-ambient-enabled");
    stopMonitoring();
    dispatchState();
    
    return true;
  }

  async function toggle() {
    return (await (active ? disable() : enable())) && active;
  }

  function refresh() {
    if (!active) return;
    ensureAmbientRoot();
    attachVideo(findVideoElement());
  }

  function isActive() {
    return !!active;
  }

  function isSupported() {
    return true;
  }

  function dispatchState() {
    document.dispatchEvent(
      new CustomEvent("btfw:ambient:state", { detail: { active: !!active } })
    );
  }

  function boot() {
    ensureCSS();
    if (getStoredPreference()) {
      enable();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {
    name: "feature:ambient",
    enable,
    disable,
    toggle,
    refresh,
    isActive,
    isSupported
  };
});
