BTFW.define("feature:ambient", [], async () => {
  const STORAGE_KEY = "btfw:ambient:enabled";
  const DEFAULT_COLOR = { r: 60, g: 72, b: 110 };

  const $ = (selector, root = document) => root.querySelector(selector);

  const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const clampColor = (color) => ({
    r: clampChannel(color.r),
    g: clampChannel(color.g),
    b: clampChannel(color.b)
  });
  const mixWithWhite = (color, amount) => clampColor({
    r: color.r + (255 - color.r) * amount,
    g: color.g + (255 - color.g) * amount,
    b: color.b + (255 - color.b) * amount
  });
  const mixWithBlack = (color, amount) => clampColor({
    r: color.r * (1 - amount),
    g: color.g * (1 - amount),
    b: color.b * (1 - amount)
  });
  const formatColor = (color) => `${color.r}, ${color.g}, ${color.b}`;

  let active = false;
  let wrap = null;
  let monitorTimer = null;
  let currentVideo = null;
  let samplingCanvas = null;
  let samplingCtx = null;
  let samplingBlocked = false;
  let samplingCooldownUntil = 0;
  let lastSampleTime = 0;
  let storedColor = { ...DEFAULT_COLOR };
  let waitForWrapPromise = null;
  let socketListenerAttached = false;
  let frameLoopHandle = null;
  let frameLoopMode = null;
  let corsFailedForVideo = new WeakSet(); // Track which videos failed CORS

  const debug = (...args) => console.log('[ambient]', ...args);

  function ensureCSS() {
    if (document.getElementById("btfw-ambient-css")) return;

    const st = document.createElement("style");
    st.id = "btfw-ambient-css";
    st.textContent = `
      #videowrap.btfw-ambient-ready {
        position: relative;
        isolation: isolate;
        overflow: visible;

        --ambient-rgb: ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b};
        --ambient-rgb-soft: ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b};
        --ambient-rgb-highlight: ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b};
        --ambient-rgb-deep: ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b};
      }

      #videowrap.btfw-ambient-ready::before {
        content: "";
        position: absolute;
        inset: clamp(-18%, -8vw, -12%);
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        transform: scale(0.9);
        border-radius: clamp(26px, 8vw, 38px);
        background:
          radial-gradient(circle at 20% 18%, rgba(var(--ambient-rgb-highlight), 0.58) 0%, transparent 56%),
          radial-gradient(circle at 78% 22%, rgba(var(--ambient-rgb-soft), 0.48) 0%, transparent 58%),
          radial-gradient(circle at 46% 82%, rgba(var(--ambient-rgb-deep), 0.56) 0%, transparent 74%),
          radial-gradient(circle at 50% 50%, rgba(var(--ambient-rgb), 0.38) 0%, transparent 88%);
        filter: blur(82px) saturate(128%) brightness(1.05);
        transition: opacity 0.5s ease, transform 0.6s ease;
      }

      #videowrap.btfw-ambient-enabled::before {
        opacity: 1;
        transform: scale(1);
      }

      #videowrap.btfw-ambient-enabled #ytapiplayer,
      #videowrap.btfw-ambient-enabled .video-js,
      #videowrap.btfw-ambient-enabled iframe,
      #videowrap.btfw-ambient-enabled video {
        border-radius: clamp(16px, 3vw, 24px);
        box-shadow:
          0 34px 94px rgba(var(--ambient-rgb-soft), 0.42),
          0 18px 40px rgba(var(--ambient-rgb-deep), 0.28);
        overflow: hidden;
        background: rgba(var(--ambient-rgb-deep), 0.22);
        transition: box-shadow 0.45s ease;
      }

      #videowrap.btfw-ambient-enabled .video-js {
        background: transparent;
      }

      @media (max-width: 768px) {
        #videowrap.btfw-ambient-ready::before {
          inset: clamp(-22%, -12vw, -16%);
          filter: blur(64px) saturate(132%) brightness(1.08);
        }

        #videowrap.btfw-ambient-enabled #ytapiplayer,
        #videowrap.btfw-ambient-enabled .video-js,
        #videowrap.btfw-ambient-enabled iframe,
        #videowrap.btfw-ambient-enabled video {
          border-radius: clamp(12px, 4vw, 18px);
          box-shadow:
            0 24px 68px rgba(var(--ambient-rgb-soft), 0.38),
            0 12px 32px rgba(var(--ambient-rgb-deep), 0.2);
        }
      }
    `;
    document.head.appendChild(st);
    debug('CSS injected');
  }

  function waitForWrap(timeout = 5000) {
    if (waitForWrapPromise) return waitForWrapPromise;

    const immediate = $("#videowrap");
    if (immediate) {
      debug('Found #videowrap immediately');
      return Promise.resolve(immediate);
    }

    debug('Waiting for #videowrap...');
    waitForWrapPromise = new Promise((resolve) => {
      if (!document.body) {
        debug('No document.body yet');
        resolve(null);
        return;
      }

      const deadline = Date.now() + timeout;
      const observer = new MutationObserver(() => {
        const found = $("#videowrap");
        if (found) {
          debug('Found #videowrap via observer');
          observer.disconnect();
          waitForWrapPromise = null;
          resolve(found);
        } else if (Date.now() > deadline) {
          debug('Timeout waiting for #videowrap');
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
    if (!nextWrap) {
      debug('No #videowrap found');
      return null;
    }

    ensureCSS();

    if (wrap && wrap !== nextWrap) {
      wrap.classList.remove("btfw-ambient-enabled", "btfw-ambient-ready");
    }

    wrap = nextWrap;
    const legacy = wrap.querySelector && wrap.querySelector("#btfw-ambient-wrap");
    if (legacy) {
      try {
        legacy.remove();
      } catch (_) {
        legacy.parentNode && legacy.parentNode.removeChild(legacy);
      }
    }
    wrap.classList.add("btfw-ambient-ready");
    if (active) {
      wrap.classList.add("btfw-ambient-enabled");
    }
    updateWrapColor();

    debug('Ambient root prepared', { active, wrap });
    return wrap;
  }

  function getStoredPreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) === "1";
      debug('Stored preference:', stored);
      return stored;
    } catch (_) {
      return false;
    }
  }

  function setStoredPreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
      debug('Stored preference updated:', value);
    } catch (_) {}
  }

  function applyColor(color) {
    storedColor = clampColor(color);
    updateWrapColor();
    debug('Color applied:', storedColor);
  }

  function updateWrapColor() {
    if (!wrap) return;
    const base = clampColor(storedColor);
    const soft = mixWithWhite(base, 0.28);
    const highlight = mixWithWhite(base, 0.52);
    const deep = mixWithBlack(base, 0.42);

    wrap.style.setProperty("--ambient-rgb", formatColor(base));
    wrap.style.setProperty("--ambient-rgb-soft", formatColor(soft));
    wrap.style.setProperty("--ambient-rgb-highlight", formatColor(highlight));
    wrap.style.setProperty("--ambient-rgb-deep", formatColor(deep));
  }

  function findVideoElement() {
    const video = $("#ytapiplayer video") || $("#videowrap video") || document.querySelector("video");
    if (video) {
      debug('Found video element:', video.src || video.currentSrc || 'no src');
    } else {
      debug('No video element found');
    }
    return video;
  }

  function stopSamplingLoop() {
    if (!frameLoopHandle) return;

    if (frameLoopMode === "video" && currentVideo && typeof currentVideo.cancelVideoFrameCallback === "function") {
      try {
        currentVideo.cancelVideoFrameCallback(frameLoopHandle);
      } catch (_) {}
    } else if (frameLoopMode === "raf") {
      try {
        cancelAnimationFrame(frameLoopHandle);
      } catch (_) {}
    }

    frameLoopHandle = null;
    frameLoopMode = null;
    debug('Sampling loop stopped');
  }

  function detachVideoListeners() {
    if (!currentVideo) return;
    const handler = currentVideo._btfwAmbientHandler;
    if (handler) {
      ["timeupdate", "loadeddata", "play", "seeked", "ended", "emptied"].forEach((evt) => {
        try {
          currentVideo.removeEventListener(evt, handler);
        } catch (_) {}
      });
      delete currentVideo._btfwAmbientHandler;
    }
    stopSamplingLoop();
    debug('Video listeners detached');
    currentVideo = null;
  }

  function sampleVideoFrame(video) {
    if (!video) return;
    
    // Skip if we know this video has CORS issues
    if (corsFailedForVideo.has(video)) {
      return;
    }
    
    if (samplingBlocked && performance.now() < samplingCooldownUntil) return;
    samplingBlocked = false;
    if (video.readyState < 2) {
      debug('Video not ready, readyState:', video.readyState);
      return;
    }

    const now = performance.now();
    if (now - lastSampleTime < 120) return;
    lastSampleTime = now;

    try {
      if (!samplingCanvas) {
        samplingCanvas = document.createElement("canvas");
        samplingCanvas.width = samplingCanvas.height = 32;
        samplingCtx = samplingCanvas.getContext("2d", { willReadFrequently: true });
        debug('Sampling canvas created');
      }

      samplingCtx.drawImage(video, 0, 0, samplingCanvas.width, samplingCanvas.height);
      const { data } = samplingCtx.getImageData(0, 0, samplingCanvas.width, samplingCanvas.height);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 8) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      if (!count) {
        debug('No valid pixels sampled');
        return;
      }

      applyColor({ r: r / count, g: g / count, b: b / count });
    } catch (err) {
      // Check if it's a CORS error
      if (err.message && err.message.includes('cross-origin')) {
        debug('CORS blocked - video from external domain without proper headers');
        debug('Falling back to static ambient color');
        corsFailedForVideo.add(video);
        stopSamplingLoop(); // Stop trying to sample this video
      } else {
        samplingBlocked = true;
        samplingCooldownUntil = performance.now() + 5000;
        debug('Sampling error:', err.message);
      }
      applyColor(DEFAULT_COLOR);
    }
  }

  function attachVideo(video) {
    if (currentVideo === video) return;

    detachVideoListeners();
    currentVideo = video && video.tagName === "VIDEO" ? video : null;

    if (!currentVideo) {
      debug('No video to attach');
      applyColor(DEFAULT_COLOR);
      return;
    }

    debug('Attaching to video');
    samplingBlocked = false;
    samplingCooldownUntil = 0;
    
    // Only try setting crossOrigin if it's not already set
    try {
      if ("crossOrigin" in currentVideo && !currentVideo.crossOrigin) {
        currentVideo.crossOrigin = "anonymous";
        debug('Set crossOrigin=anonymous (may not work if video already loaded)');
      }
    } catch (err) {
      debug('Could not set crossOrigin:', err.message);
    }

    const handler = () => sampleVideoFrame(currentVideo);
    currentVideo._btfwAmbientHandler = handler;
    ["timeupdate", "loadeddata", "play", "seeked"].forEach((evt) => {
      try {
        currentVideo.addEventListener(evt, handler);
      } catch (_) {}
    });

    handler();
    startSamplingLoop();
  }

  function startSamplingLoop() {
    stopSamplingLoop();
    if (!currentVideo) return;

    const useVideoFrame =
      typeof currentVideo.requestVideoFrameCallback === "function" &&
      typeof currentVideo.cancelVideoFrameCallback === "function";

    debug('Starting sampling loop, mode:', useVideoFrame ? 'video frame callback' : 'requestAnimationFrame');

    const scheduleNext = () => {
      if (!currentVideo || corsFailedForVideo.has(currentVideo)) return;

      if (useVideoFrame) {
        try {
          frameLoopMode = "video";
          frameLoopHandle = currentVideo.requestVideoFrameCallback(() => {
            frameLoopHandle = null;
            sampleVideoFrame(currentVideo);
            scheduleNext();
          });
          return;
        } catch (_) {
          frameLoopHandle = null;
          frameLoopMode = null;
        }
      }

      frameLoopMode = "raf";
      frameLoopHandle = requestAnimationFrame(() => {
        frameLoopHandle = null;
        sampleVideoFrame(currentVideo);
        scheduleNext();
      });
    };

    scheduleNext();
  }

  function startMonitoring() {
    if (monitorTimer) return;

    debug('Starting monitoring');
    monitorTimer = window.setInterval(() => {
      if (!active) return;
      const wrapNow = $("#videowrap");

      if (!wrapNow) {
        if (wrap && !wrap.isConnected) {
          wrap.classList.remove("btfw-ambient-enabled", "btfw-ambient-ready");
          wrap = null;
        }
      } else if (wrapNow !== wrap || !wrap || !wrap.classList.contains("btfw-ambient-ready")) {
        ensureAmbientRoot(wrapNow);
      }

      attachVideo(findVideoElement());
    }, 1000);

    wireSocketListener();
  }

  function stopMonitoring() {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
      debug('Monitoring stopped');
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
          debug('Media changed via socket');
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

    debug('Enabling ambient mode');
    ensureCSS();
    const wrapEl = $("#videowrap") || (await waitForWrap());
    if (!wrapEl) {
      console.warn("[ambient] Unable to locate #videowrap for ambient mode.");
      return false;
    }

    const ensuredWrap = ensureAmbientRoot(wrapEl);
    if (ensuredWrap) {
      ensuredWrap.classList.add("btfw-ambient-enabled");
      updateWrapColor();
    }
    active = true;

    setStoredPreference(true);
    startMonitoring();
    attachVideo(findVideoElement());
    dispatchState();
    debug('Ambient mode enabled');
    return true;
  }

  async function disable() {
    if (!active) return true;

    debug('Disabling ambient mode');
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
    debug('Refreshing');
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
    debug('Booting ambient feature');
    ensureCSS();
    if (getStoredPreference()) {
      debug('Auto-enabling from stored preference');
      enable();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

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
