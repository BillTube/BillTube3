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
      /* Only apply styles when ambient is actually active */
      
      /* Ambient glow background layer - behind everything in videowrap */
      .btfw-ambient-glow-bg {
        position: fixed;
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.6s ease;
        will-change: opacity;
      }

      .btfw-ambient-glow-bg.btfw-ambient-active {
        opacity: 1;
      }

      /* Cloned video for glow effect */
      .btfw-ambient-glow-bg video {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(1.15);
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: blur(clamp(60px, 8vw, 90px)) saturate(220%) brightness(1.5) contrast(1.15);
        opacity: 0.85;
      }

      /* Reduce background opacity when ambient is active to let glow shine through */
      body.btfw-ambient-active #main,
      body.btfw-ambient-active #chatwrap,
      body.btfw-ambient-active #videowrap,
      body.btfw-ambient-active .panel,
      body.btfw-ambient-active #userlist,
      body.btfw-ambient-active #messagebuffer,
      body.btfw-ambient-active #chatline {
        background-color: color-mix(in srgb, var(--btfw-theme-bg) 50%, transparent) !important;
      }

      body.btfw-ambient-active #chatwrap,
      body.btfw-ambient-active #userlist {
        background-color: color-mix(in srgb, var(--btfw-theme-surface) 50%, transparent) !important;
      }

      body.btfw-ambient-active .panel-heading,
      body.btfw-ambient-active .panel-body {
        background-color: color-mix(in srgb, var(--btfw-theme-panel) 50%, transparent) !important;
      }

      /* Isolation only when ready */
      #videowrap.btfw-ambient-ready {
        isolation: isolate;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .btfw-ambient-glow-bg video {
          transform: translate(-50%, -50%) scale(1.2);
          filter: blur(clamp(50px, 10vw, 70px)) saturate(200%) brightness(1.4) contrast(1.1);
          opacity: 0.8;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function removeCSS() {
    const st = document.getElementById("btfw-ambient-css");
    if (st && st.parentNode) {
      st.parentNode.removeChild(st);
    }
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

    if (wrap && wrap !== nextWrap) {
      wrap.classList.remove("btfw-ambient-ready");
      wrap = null;
    }

    wrap = nextWrap;
    // Only add ready class when actually enabling
    if (active) {
      wrap.classList.add("btfw-ambient-ready");
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
    // Remove from DOM completely
    const existingGlow = document.querySelector(".btfw-ambient-glow-bg");
    if (existingGlow && existingGlow.parentNode) {
      existingGlow.parentNode.removeChild(existingGlow);
    }
    glowContainer = null;
    glowVideo = null;
  }

  function createGlowElements() {
    // Always clean up first to prevent duplicates
    cleanupGlowElements();

    if (!wrap) return;

    const videoElement = findVideoElement();
    if (!videoElement) return;

    // Create glow container
    glowContainer = document.createElement("div");
    glowContainer.className = "btfw-ambient-glow-bg";
    glowContainer.setAttribute("aria-hidden", "true");

    // Create cloned video for glow effect
    glowVideo = document.createElement("video");
    glowVideo.muted = true;
    glowVideo.playsInline = true;
    glowVideo.loop = true;
    glowVideo.preload = "auto";
    glowVideo.setAttribute("aria-hidden", "true");
    glowVideo.controls = false;
    glowVideo.disablePictureInPicture = true;

    glowContainer.appendChild(glowVideo);
    document.body.appendChild(glowContainer);
    
    // Position and activate
    updateGlowPosition();
    if (active) {
      glowContainer.classList.add("btfw-ambient-active");
    }
  }

  function updateGlowPosition() {
    if (!glowContainer || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const padding = 80; // Extra space for glow to extend

    glowContainer.style.top = `${rect.top - padding}px`;
    glowContainer.style.left = `${rect.left - padding}px`;
    glowContainer.style.width = `${rect.width + padding * 2}px`;
    glowContainer.style.height = `${rect.height + padding * 2}px`;
  }

  function syncVideos() {
    if (!currentVideo || !glowVideo) return;

    try {
      const src = currentVideo.src || currentVideo.currentSrc;
      if (src && glowVideo.src !== src) {
        glowVideo.src = src;
      }

      const timeDiff = Math.abs(currentVideo.currentTime - glowVideo.currentTime);
      if (timeDiff > 0.3) {
        glowVideo.currentTime = currentVideo.currentTime;
      }

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
      return;
    }

    // Create glow elements if they don't exist
    if (!glowContainer) {
      createGlowElements();
    }

    syncHandler = () => syncVideos();

    const events = ["loadeddata", "play", "pause", "seeked", "timeupdate"];
    events.forEach((evt) => {
      try {
        currentVideo.addEventListener(evt, syncHandler);
      } catch (_) {}
    });

    syncVideos();
  }

  function startMonitoring() {
    if (monitorTimer) return;

    monitorTimer = window.setInterval(() => {
      if (!active) return;

      const wrapNow = $("#videowrap");

      if (!wrapNow) {
        if (wrap && !wrap.isConnected) {
          wrap.classList.remove("btfw-ambient-ready");
          wrap = null;
        }
      } else if (wrapNow !== wrap || !wrap || !wrap.classList.contains("btfw-ambient-ready")) {
        ensureAmbientRoot(wrapNow);
      }

      const videoEl = findVideoElement();
      if (videoEl !== currentVideo) {
        attachVideo(videoEl);
      }

      updateGlowPosition();
    }, 500);

    // Update position on scroll and resize
    const throttledUpdate = () => {
      if (active) updateGlowPosition();
    };
    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate, { passive: true });

    wireSocketListener();
  }

  function stopMonitoring() {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
    detachVideoListeners();
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

    ensureAmbientRoot(wrapEl);
    active = true;
    setStoredPreference(true);
    
    // Add ambient class to body for background transparency
    document.body.classList.add("btfw-ambient-active");
    
    // Create glow and activate it
    const videoEl = findVideoElement();
    if (videoEl) {
      createGlowElements();
      attachVideo(videoEl);
    }
    
    startMonitoring();
    dispatchState();
    
    return true;
  }

  async function disable() {
    if (!active) return true;

    active = false;
    setStoredPreference(false);

    // Remove ambient class from body
    document.body.classList.remove("btfw-ambient-active");

    if (wrap) {
      wrap.classList.remove("btfw-ambient-ready");
    }
    
    // Remove glow immediately
    if (glowContainer) {
      glowContainer.classList.remove("btfw-ambient-active");
      // Wait for fade out animation then remove
      setTimeout(() => {
        cleanupGlowElements();
      }, 600);
    }
    
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
    createGlowElements();
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
    // Don't inject CSS or do anything until feature is actually enabled
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
