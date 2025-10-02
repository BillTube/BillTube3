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
      /* Don't touch videowrap itself - let CyTube control it */
      
      /* Ambient glow container - positioned outside videowrap flow */
      #videowrap .btfw-ambient-glow {
        position: fixed;
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.6s ease;
      }

      #videowrap.btfw-ambient-enabled .btfw-ambient-glow {
        opacity: 1;
      }

      /* Cloned video for glow effect */
      #videowrap .btfw-ambient-glow video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(80px) saturate(250%) brightness(1.6) contrast(1.2);
        opacity: 0.9;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        #videowrap .btfw-ambient-glow video {
          filter: blur(60px) saturate(220%) brightness(1.5) contrast(1.15);
          opacity: 0.85;
        }
      }

      /* No transform animations */
      @keyframes btfw-ambient-fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
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

    // Find the actual video element to get its position
    const videoElement = findVideoElement();
    if (!videoElement) return;

    // Create glow container using fixed positioning
    glowContainer = document.createElement("div");
    glowContainer.className = "btfw-ambient-glow";
    glowContainer.setAttribute("aria-hidden", "true");
    glowContainer.style.pointerEvents = "none";

    // Create cloned video for glow effect
    glowVideo = document.createElement("video");
    glowVideo.muted = true;
    glowVideo.playsInline = true;
    glowVideo.loop = true;
    glowVideo.preload = "auto";
    glowVideo.style.pointerEvents = "none";
    glowVideo.setAttribute("aria-hidden", "true");
    glowVideo.controls = false;
    glowVideo.disablePictureInPicture = true;

    glowContainer.appendChild(glowVideo);
    
    // Append to body to avoid interfering with videowrap layout
    document.body.appendChild(glowContainer);
    
    // Position the glow to match the video
    updateGlowPosition();
  }

  function updateGlowPosition() {
    if (!glowContainer || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const padding = 50; // Extra space for glow to extend

    glowContainer.style.top = `${rect.top - padding}px`;
    glowContainer.style.left = `${rect.left - padding}px`;
    glowContainer.style.width = `${rect.width + padding * 2}px`;
    glowContainer.style.height = `${rect.height + padding * 2}px`;
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

      // Update glow position on scroll/resize
      updateGlowPosition();
    }, 1000);

    // Update position on scroll and resize
    window.addEventListener('scroll', updateGlowPosition, { passive: true });
    window.addEventListener('resize', updateGlowPosition, { passive: true });

    wireSocketListener();
  }

  function stopMonitoring() {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
    window.removeEventListener('scroll', updateGlowPosition);
    window.removeEventListener('resize', updateGlowPosition);
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
