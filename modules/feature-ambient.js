BTFW.define("feature:ambient", [], async () => {
  // Inspired by the open-source ambient light effect from https://github.com/NikxDa/ambient
  const STORAGE_KEY = "btfw:ambient:enabled";
  const DEFAULT_COLOR = { r: 60, g: 72, b: 110 };

  const $ = (selector, root = document) => root.querySelector(selector);

  const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const clampColor = (color) => ({
    r: clampChannel(color.r ?? DEFAULT_COLOR.r),
    g: clampChannel(color.g ?? DEFAULT_COLOR.g),
    b: clampChannel(color.b ?? DEFAULT_COLOR.b)
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

  const parseColor = (value) => {
    if (!value || typeof value !== "string") return null;
    const hex = value.trim();
    if (hex.startsWith("#")) {
      const cleaned = hex.replace(/[^0-9a-f]/gi, "");
      if (cleaned.length === 3) {
        const [r, g, b] = cleaned.split("").map((v) => parseInt(v + v, 16));
        return { r, g, b };
      }
      if (cleaned.length === 6) {
        const r = parseInt(cleaned.slice(0, 2), 16);
        const g = parseInt(cleaned.slice(2, 4), 16);
        const b = parseInt(cleaned.slice(4, 6), 16);
        return { r, g, b };
      }
      return null;
    }

    const rgbMatch = hex.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1]
        .split(",")
        .map((part) => part.trim())
        .map((part) => Number.parseFloat(part));
      if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
        return { r: parts[0], g: parts[1], b: parts[2] };
      }
    }
    return null;
  };

  let active = false;
  let wrap = null;
  let monitorTimer = null;
  let waitForWrapPromise = null;
  let socketListenerAttached = false;
  let renderer = null;

  const debug = (...args) => console.log("[ambient]", ...args);

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

      #videowrap.btfw-ambient-ready .btfw-ambient-layer {
        pointer-events: none;
      }

      .btfw-ambient-layer {
        position: absolute;
        inset: clamp(-18%, -8vw, -12%);
        border-radius: clamp(26px, 8vw, 38px);
        overflow: hidden;
        z-index: -1;
        opacity: 0;
        transform: scale(0.92);
        transition: opacity 0.5s ease, transform 0.6s ease;
        background:
          radial-gradient(circle at 20% 18%, rgba(var(--ambient-highlight, ${formatColor(
            mixWithWhite(DEFAULT_COLOR, 0.52)
          )}), 0.58) 0%, transparent 56%),
          radial-gradient(circle at 78% 22%, rgba(var(--ambient-soft, ${formatColor(
            mixWithWhite(DEFAULT_COLOR, 0.28)
          )}), 0.48) 0%, transparent 58%),
          radial-gradient(circle at 46% 82%, rgba(var(--ambient-deep, ${formatColor(
            mixWithBlack(DEFAULT_COLOR, 0.42)
          )}), 0.56) 0%, transparent 74%),
          radial-gradient(circle at 50% 50%, rgba(var(--ambient-base, ${formatColor(
            DEFAULT_COLOR
          )}), 0.38) 0%, transparent 88%);
      }

      .btfw-ambient-layer::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(10, 14, 32, 0.35);
        mix-blend-mode: screen;
      }

      .btfw-ambient-layer video {
        position: absolute;
        inset: -12% -12% -12% -12%;
        width: 124%;
        height: 124%;
        object-fit: cover;
        filter: blur(86px) saturate(140%) brightness(1.05);
        transform: scale(1.08);
      }

      #videowrap.btfw-ambient-enabled::before,
      #videowrap.btfw-ambient-enabled::after {
        content: none !important;
      }

      #videowrap.btfw-ambient-enabled .btfw-ambient-layer {
        opacity: 1;
        transform: scale(1);
      }

      #videowrap.btfw-ambient-enabled #ytapiplayer,
      #videowrap.btfw-ambient-enabled .video-js,
      #videowrap.btfw-ambient-enabled iframe,
      #videowrap.btfw-ambient-enabled video {
        border-radius: clamp(16px, 3vw, 24px);
        box-shadow:
          0 34px 94px rgba(var(--ambient-soft, ${formatColor(
            mixWithWhite(DEFAULT_COLOR, 0.28)
          )}), 0.42),
          0 18px 40px rgba(var(--ambient-deep, ${formatColor(
            mixWithBlack(DEFAULT_COLOR, 0.42)
          )}), 0.28);
        overflow: hidden;
        background: rgba(var(--ambient-deep, ${formatColor(
          mixWithBlack(DEFAULT_COLOR, 0.42)
        )}), 0.22);
        transition: box-shadow 0.45s ease;
      }

      #videowrap.btfw-ambient-enabled .video-js {
        background: transparent;
      }

      @media (max-width: 768px) {
        .btfw-ambient-layer {
          inset: clamp(-22%, -12vw, -16%);
          border-radius: clamp(18px, 6vw, 28px);
        }

        .btfw-ambient-layer video {
          filter: blur(72px) saturate(138%) brightness(1.08);
        }

        #videowrap.btfw-ambient-enabled #ytapiplayer,
        #videowrap.btfw-ambient-enabled .video-js,
        #videowrap.btfw-ambient-enabled iframe,
        #videowrap.btfw-ambient-enabled video {
          border-radius: clamp(12px, 4vw, 18px);
          box-shadow:
            0 24px 68px rgba(var(--ambient-soft, ${formatColor(
              mixWithWhite(DEFAULT_COLOR, 0.28)
            )}), 0.38),
            0 12px 32px rgba(var(--ambient-deep, ${formatColor(
              mixWithBlack(DEFAULT_COLOR, 0.42)
            )}), 0.2);
        }
      }
    `;
    document.head.appendChild(st);
    debug("CSS injected");
  }

  function waitForWrap(timeout = 5000) {
    if (waitForWrapPromise) return waitForWrapPromise;

    const immediate = $("#videowrap");
    if (immediate) {
      debug("Found #videowrap immediately");
      return Promise.resolve(immediate);
    }

    debug("Waiting for #videowrap...");
    waitForWrapPromise = new Promise((resolve) => {
      if (!document.body) {
        debug("No document.body yet");
        resolve(null);
        return;
      }

      const deadline = Date.now() + timeout;
      const observer = new MutationObserver(() => {
        const found = $("#videowrap");
        if (found) {
          debug("Found #videowrap via observer");
          observer.disconnect();
          waitForWrapPromise = null;
          resolve(found);
        } else if (Date.now() > deadline) {
          debug("Timeout waiting for #videowrap");
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
      debug("No #videowrap found");
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

    if (!renderer) {
      renderer = new AmbientRenderer();
      renderer.mount(wrap);
    } else {
      renderer.mount(wrap);
    }

    debug("Ambient root prepared", { active, wrap });
    return wrap;
  }

  function getStoredPreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) === "1";
      debug("Stored preference:", stored);
      return stored;
    } catch (_) {
      return false;
    }
  }

  function setStoredPreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
      debug("Stored preference updated:", value);
    } catch (_) {}
  }

  function findVideoElement() {
    const video = $("#ytapiplayer video") || $("#videowrap video") || document.querySelector("video");
    if (video) {
      debug("Found video element:", video.src || video.currentSrc || "no src");
    } else {
      debug("No video element found");
    }
    return video;
  }

  function startMonitoring() {
    if (monitorTimer) return;

    debug("Starting monitoring");
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

      const video = findVideoElement();
      if (renderer) renderer.attach(video);
    }, 1000);

    wireSocketListener();
  }

  function stopMonitoring() {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
      debug("Monitoring stopped");
    }
    if (renderer) renderer.detach();
  }

  function wireSocketListener() {
    if (socketListenerAttached) return;
    try {
      if (window.socket && typeof socket.on === "function") {
        socketListenerAttached = true;
        socket.on("changeMedia", () => {
          if (!active) return;
          debug("Media changed via socket");
          setTimeout(() => {
            ensureAmbientRoot();
            const video = findVideoElement();
            if (renderer) renderer.attach(video);
          }, 400);
        });
      }
    } catch (_) {}
  }

  async function enable() {
    if (active) return true;

    debug("Enabling ambient mode");
    ensureCSS();
    const wrapEl = $("#videowrap") || (await waitForWrap());
    if (!wrapEl) {
      console.warn("[ambient] Unable to locate #videowrap for ambient mode.");
      return false;
    }

    const ensuredWrap = ensureAmbientRoot(wrapEl);
    if (ensuredWrap) {
      ensuredWrap.classList.add("btfw-ambient-enabled");
      updateRendererColor(renderer, findVideoElement());
    }
    active = true;

    setStoredPreference(true);
    startMonitoring();
    if (renderer) renderer.attach(findVideoElement());
    dispatchState();
    debug("Ambient mode enabled");
    return true;
  }

  async function disable() {
    if (!active) return true;

    debug("Disabling ambient mode");
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
    debug("Refreshing");
    ensureAmbientRoot();
    updateRendererColor(renderer, findVideoElement());
    if (renderer) renderer.attach(findVideoElement());
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

  function updateRendererColor(instance, video) {
    if (!instance) return;
    const color = deriveColorFromVideo(video);
    instance.setColor(color || DEFAULT_COLOR);
  }

  function deriveColorFromVideo(video) {
    if (!video) return null;

    const dataAttr = video.getAttribute("data-ambient-color") || video.dataset?.ambientColor;
    if (dataAttr) {
      const parsed = parseColor(dataAttr);
      if (parsed) return parsed;
    }

    const cssColor = (() => {
      try {
        const styles = getComputedStyle(video);
        const bg = styles.getPropertyValue("--ambient-color") || styles.backgroundColor;
        return bg && bg.trim() ? bg : null;
      } catch (_) {
        return null;
      }
    })();

    if (cssColor) {
      const parsed = parseColor(cssColor);
      if (parsed) return parsed;
    }

    return null;
  }

  class AmbientRenderer {
    constructor() {
      this.root = document.createElement("div");
      this.root.className = "btfw-ambient-layer";
      this.mirrorVideo = document.createElement("video");
      this.mirrorVideo.setAttribute("aria-hidden", "true");
      this.mirrorVideo.setAttribute("muted", "");
      this.mirrorVideo.muted = true;
      this.mirrorVideo.playsInline = true;
      this.mirrorVideo.autoplay = true;
      this.mirrorVideo.loop = true;
      this.root.appendChild(this.mirrorVideo);

      this.source = null;
      this.color = clampColor(DEFAULT_COLOR);
      this.mounted = false;
      this.listeners = new Map();
      this.syncInterval = null;
      this.boundHandlers = null;
    }

    mount(targetWrap) {
      if (!targetWrap) return;
      if (this.root.parentNode !== targetWrap) {
        try {
          this.root.remove();
        } catch (_) {}
        targetWrap.prepend(this.root);
      }
      this.mounted = true;
      this.applyColor();
    }

    detach() {
      this.stopSync();
      this.teardownSource();
      this.mirrorVideo.pause();
      this.mirrorVideo.removeAttribute("src");
      this.mirrorVideo.innerHTML = "";
      try {
        this.mirrorVideo.load();
      } catch (_) {}
    }

    attach(video) {
      if (!this.mounted) return;
      if (this.source === video) return;

      this.stopSync();
      this.teardownSource();

      if (!video || video.tagName !== "VIDEO") {
        this.source = null;
        this.mirrorVideo.removeAttribute("src");
        this.mirrorVideo.pause();
        this.boundHandlers = null;
        this.setColor(DEFAULT_COLOR);
        return;
      }

      this.source = video;
      this.setColor(deriveColorFromVideo(video) || DEFAULT_COLOR);
      this.loadMirror(video);
      this.startSync();
    }

    loadMirror(video) {
      const src = video.currentSrc || video.src;
      const sources = Array.from(video.querySelectorAll("source"));

      if (src) {
        this.mirrorVideo.src = src;
        this.mirrorVideo.load();
      } else if (sources.length) {
        this.mirrorVideo.innerHTML = "";
        sources.forEach((source) => {
          const clone = source.cloneNode(true);
          this.mirrorVideo.appendChild(clone);
        });
        this.mirrorVideo.load();
      } else {
        this.mirrorVideo.removeAttribute("src");
      }

      this.mirrorVideo.playbackRate = video.playbackRate || 1;

      if (!this.boundHandlers) {
        const copyRate = () => {
          this.mirrorVideo.playbackRate = video.playbackRate || 1;
        };
        const copyPlay = () => {
          const play = () => this.mirrorVideo.play().catch(() => {});
          if (video.paused) {
            this.mirrorVideo.pause();
          } else {
            if (this.mirrorVideo.readyState >= 2) play();
            else this.mirrorVideo.addEventListener("loadeddata", play, { once: true });
          }
        };
        const copyPause = () => {
          if (!video.paused) return;
          this.mirrorVideo.pause();
        };
        const copySeek = () => {
          if (!Number.isFinite(video.currentTime)) return;
          const diff = Math.abs((this.mirrorVideo.currentTime || 0) - video.currentTime);
          if (diff > 0.7) {
            try {
              this.mirrorVideo.currentTime = video.currentTime;
            } catch (_) {}
          }
        };
        const onLoadedData = () => {
          copyRate();
          copySeek();
          copyPlay();
        };
        const onEmptied = () => this.attach(null);

        this.boundHandlers = { copyRate, copySeek, copyPlay };

        this.listeners.set("ratechange", copyRate);
        this.listeners.set("play", copyPlay);
        this.listeners.set("pause", copyPause);
        this.listeners.set("timeupdate", copySeek);
        this.listeners.set("seeked", copySeek);
        this.listeners.set("loadeddata", onLoadedData);
        this.listeners.set("emptied", onEmptied);

        this.listeners.forEach((handler, event) => {
          if (typeof handler !== "function") return;
          try {
            video.addEventListener(event, handler);
          } catch (_) {}
        });
      }

      if (this.boundHandlers) {
        this.boundHandlers.copyRate();
        this.boundHandlers.copySeek();
        this.boundHandlers.copyPlay();
      }
    }

    startSync() {
      if (this.syncInterval) return;
      this.syncInterval = window.setInterval(() => {
        if (!this.source) return;
        const src = this.source.currentSrc || this.source.src;
        const mirrorSrc = this.mirrorVideo.currentSrc || this.mirrorVideo.src;
        if (src && mirrorSrc && src !== mirrorSrc) {
          this.loadMirror(this.source);
        }
        const derived = deriveColorFromVideo(this.source);
        if (derived) this.setColor(derived);
        else this.applyColor();
      }, 1500);
    }

    stopSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    }

    teardownSource() {
      if (!this.source) return;
      this.listeners.forEach((handler, event) => {
        if (typeof handler !== "function") return;
        try {
          this.source.removeEventListener(event, handler);
        } catch (_) {}
      });
      this.listeners.clear();
      this.source = null;
      this.boundHandlers = null;
    }

    setColor(color) {
      this.color = clampColor(color || DEFAULT_COLOR);
      this.applyColor();
    }

    applyColor() {
      if (!this.mounted) return;
      const base = clampColor(this.color);
      const soft = mixWithWhite(base, 0.28);
      const highlight = mixWithWhite(base, 0.52);
      const deep = mixWithBlack(base, 0.42);

      this.root.style.setProperty("--ambient-base", formatColor(base));
      this.root.style.setProperty("--ambient-soft", formatColor(soft));
      this.root.style.setProperty("--ambient-highlight", formatColor(highlight));
      this.root.style.setProperty("--ambient-deep", formatColor(deep));
    }
  }

  function boot() {
    debug("Booting ambient feature");
    ensureCSS();
    if (getStoredPreference()) {
      debug("Auto-enabling from stored preference");
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
