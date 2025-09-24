BTFW.define("feature:ambient", [], async () => {
  const STORAGE_KEY = "btfw:ambient:enabled";
  const DEFAULT_COLOR = { r: 60, g: 72, b: 110 };

  const $ = (selector, root = document) => root.querySelector(selector);

  let active = false;
  let wrap = null;
  let ambientRoot = null;
  let monitorTimer = null;
  let currentVideo = null;
  let samplingCanvas = null;
  let samplingCtx = null;
  let samplingBlocked = false;
  let lastSampleTime = 0;
  let storedColor = { ...DEFAULT_COLOR };
  let waitForWrapPromise = null;
  let socketListenerAttached = false;

  function ensureCSS() {
    if (document.getElementById("btfw-ambient-css")) return;

    const st = document.createElement("style");
    st.id = "btfw-ambient-css";
    st.textContent = `
      #videowrap.btfw-ambient-ready {
        position: relative;
        overflow: visible;
        --ambient-rgb: ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b};
      }

      #btfw-ambient-wrap {
        position: absolute;
        inset: -8%;
        pointer-events: none;
        z-index: 0;
        opacity: 0;
        transform: scale(0.98);
        transition: opacity 0.45s ease, transform 0.45s ease;
      }

      #videowrap.btfw-ambient-enabled #btfw-ambient-wrap {
        opacity: 1;
        transform: scale(1);
      }

      #btfw-ambient-wrap .btfw-ambient-glow {
        position: absolute;
        inset: -25%;
        background: radial-gradient(
          circle at 50% 50%,
          rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.65) 0%,
          rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.25) 55%,
          transparent 100%
        );
        filter: blur(90px);
        transform: scale(1.15);
        opacity: 0;
        transition: opacity 0.6s ease, transform 0.6s ease;
      }

      #videowrap.btfw-ambient-enabled #btfw-ambient-wrap .btfw-ambient-glow {
        opacity: 1;
        transform: scale(1);
      }

      #btfw-ambient-wrap .btfw-ambient-gradient {
        position: absolute;
        inset: -12% -12% -4% -12%;
        background: linear-gradient(
          to bottom,
          rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.4) 0%,
          rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.24) 28%,
          rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.08) 65%,
          transparent 100%
        );
        opacity: 0;
        transition: opacity 0.6s ease;
      }

      #videowrap.btfw-ambient-enabled #btfw-ambient-wrap .btfw-ambient-gradient {
        opacity: 1;
      }

      #btfw-ambient-wrap .btfw-ambient-vignette {
        position: absolute;
        inset: -16%;
        background: radial-gradient(
          circle at 50% 65%,
          rgba(0, 0, 0, 0.15) 0%,
          rgba(0, 0, 0, 0.45) 70%,
          rgba(0, 0, 0, 0.8) 100%
        );
        opacity: 0;
        transition: opacity 0.6s ease;
      }

      #videowrap.btfw-ambient-enabled #btfw-ambient-wrap .btfw-ambient-vignette {
        opacity: 0.35;
      }

      #videowrap.btfw-ambient-ready #ytapiplayer,
      #videowrap.btfw-ambient-ready .video-js,
      #videowrap.btfw-ambient-ready iframe {
        position: relative;
        z-index: 1;
      }

      #videowrap.btfw-ambient-enabled #ytapiplayer,
      #videowrap.btfw-ambient-enabled .video-js,
      #videowrap.btfw-ambient-enabled iframe {
        box-shadow: 0 32px 90px rgba(var(--ambient-rgb, ${DEFAULT_COLOR.r}, ${DEFAULT_COLOR.g}, ${DEFAULT_COLOR.b}), 0.35);
        border-radius: 16px;
        overflow: hidden;
      }

      @media (max-width: 768px) {
        #btfw-ambient-wrap {
          inset: -14%;
        }
        #btfw-ambient-wrap .btfw-ambient-glow {
          filter: blur(70px);
        }
        #videowrap.btfw-ambient-enabled #btfw-ambient-wrap .btfw-ambient-vignette {
          opacity: 0.25;
        }
        #videowrap.btfw-ambient-enabled #ytapiplayer,
        #videowrap.btfw-ambient-enabled .video-js,
        #videowrap.btfw-ambient-enabled iframe {
          border-radius: 12px;
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

  function ensureAmbientRoot() {
    wrap = $("#videowrap");
    if (!wrap) return null;

    ensureCSS();
    wrap.classList.add("btfw-ambient-ready");

    ambientRoot = wrap.querySelector("#btfw-ambient-wrap");
    if (!ambientRoot) {
      ambientRoot = document.createElement("div");
      ambientRoot.id = "btfw-ambient-wrap";
      ambientRoot.innerHTML = `
        <div class="btfw-ambient-glow"></div>
        <div class="btfw-ambient-gradient"></div>
        <div class="btfw-ambient-vignette"></div>
      `;
      wrap.insertBefore(ambientRoot, wrap.firstChild || null);
    }

    applyColor(storedColor);
    return ambientRoot;
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

  function applyColor(color) {
    storedColor = {
      r: Math.max(0, Math.min(255, Math.round(color.r))),
      g: Math.max(0, Math.min(255, Math.round(color.g))),
      b: Math.max(0, Math.min(255, Math.round(color.b)))
    };
    const rgb = `${storedColor.r}, ${storedColor.g}, ${storedColor.b}`;
    if (wrap) wrap.style.setProperty("--ambient-rgb", rgb);
    if (ambientRoot) ambientRoot.style.setProperty("--ambient-rgb", rgb);
  }

  function findVideoElement() {
    return $("#ytapiplayer video") || $("#videowrap video") || document.querySelector("video");
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
    currentVideo = null;
  }

  function sampleVideoFrame(video) {
    if (!video || samplingBlocked) return;
    if (video.readyState < 2) return;

    const now = performance.now();
    if (now - lastSampleTime < 350) return;
    lastSampleTime = now;

    try {
      if (!samplingCanvas) {
        samplingCanvas = document.createElement("canvas");
        samplingCanvas.width = samplingCanvas.height = 32;
        samplingCtx = samplingCanvas.getContext("2d");
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

      if (!count) return;

      applyColor({ r: r / count, g: g / count, b: b / count });
    } catch (err) {
      samplingBlocked = true;
      console.warn("[ambient] Sampling disabled:", err && err.message ? err.message : err);
      applyColor(DEFAULT_COLOR);
    }
  }

  function attachVideo(video) {
    if (currentVideo === video) return;

    detachVideoListeners();
    currentVideo = video && video.tagName === "VIDEO" ? video : null;

    if (!currentVideo) {
      applyColor(DEFAULT_COLOR);
      return;
    }

    const handler = () => sampleVideoFrame(currentVideo);
    currentVideo._btfwAmbientHandler = handler;
    ["timeupdate", "loadeddata", "play", "seeked"].forEach((evt) => {
      try {
        currentVideo.addEventListener(evt, handler);
      } catch (_) {}
    });

    handler();
  }

  function startMonitoring() {
    if (monitorTimer) return;

    monitorTimer = window.setInterval(() => {
      if (!active) return;
      const wrapNow = $("#videowrap");
      if (wrapNow && wrapNow !== wrap) {
        wrap = wrapNow;
        ensureAmbientRoot();
      }
      attachVideo(findVideoElement());
    }, 1000);

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

    wrap = wrapEl;
    ensureAmbientRoot();
    wrap.classList.add("btfw-ambient-enabled");
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
