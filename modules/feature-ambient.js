BTFW.define("feature:ambient", [], async () => {
  const CSS_ID = "btfw-ambient-css";
  const LAYER_ID = "btfw-ambient-layer";
  const HOST_CLASS = "btfw-ambient-host";
  const ACTIVE_CLASS = "btfw-ambient-active";
  const NO_VIDEO_CLASS = "btfw-ambient-no-video";
  const DEFAULT_COLOR = "rgba(109, 77, 246, 0.6)";

  let active = false;
  let layer = null;
  let sampleInterval = 0;
  let samplingBlocked = false;
  let videoObserver = null;
  let socketListenerAttached = false;
  let playerObserverSetup = false;
  let lastColor = "";

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
  if (!ctx) samplingBlocked = true;

  ensureCSS();
  watchPlayerMount();
  ensureSocketListener();

  function ensureCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = `
      #videowrap.${HOST_CLASS} {
        overflow: visible;
      }

      #${LAYER_ID} {
        --btfw-ambient-color: ${DEFAULT_COLOR};
        position: absolute;
        inset: -48px;
        border-radius: calc(var(--btfw-player-radius, 12px) + 36px);
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        transform: scale(0.98);
        transition: opacity 0.4s ease, transform 0.4s ease;
        filter: blur(60px) saturate(120%);
        mix-blend-mode: screen;
      }

      #${LAYER_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(circle at 50% 30%, var(--btfw-ambient-color) 0%, rgba(24, 20, 46, 0.85) 65%, rgba(12, 10, 20, 0) 100%);
        opacity: 0.85;
        transition: background 0.4s ease, opacity 0.4s ease;
      }

      #${LAYER_ID}::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 65%),
                    radial-gradient(circle at 80% 25%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 70%);
        opacity: 0.5;
        mix-blend-mode: screen;
      }

      #${LAYER_ID}.${ACTIVE_CLASS} {
        opacity: 1;
        transform: scale(1);
      }

      #${LAYER_ID}.${NO_VIDEO_CLASS}::before {
        opacity: 0.45;
      }

      @media (max-width: 768px) {
        #${LAYER_ID} {
          inset: -32px;
          border-radius: calc(var(--btfw-player-radius, 12px) + 24px);
          filter: blur(45px) saturate(120%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLayer() {
    const wrap = document.getElementById("videowrap");
    if (!wrap) return null;
    wrap.classList.add(HOST_CLASS);

    let ambientLayer = document.getElementById(LAYER_ID);
    if (!ambientLayer) {
      ambientLayer = document.createElement("div");
      ambientLayer.id = LAYER_ID;
      wrap.prepend(ambientLayer);
    }

    layer = ambientLayer;
    return ambientLayer;
  }

  function getVideoElement() {
    const el = document.querySelector("#ytapiplayer video, #videowrap video");
    return el instanceof HTMLVideoElement ? el : null;
  }

  function applyColor(color) {
    if (!layer || color === lastColor) return;
    lastColor = color;
    layer.style.setProperty("--btfw-ambient-color", color);
  }

  function sampleFrame() {
    if (!active || !ctx) return;
    const video = getVideoElement();
    if (!video || video.readyState < 2) {
      if (layer) layer.classList.add(NO_VIDEO_CLASS);
      return;
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0;
      let g = 0;
      let b = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      r = Math.round(r / pixels);
      g = Math.round(g / pixels);
      b = Math.round(b / pixels);
      applyColor(`rgba(${r}, ${g}, ${b}, 0.75)`);
      if (layer) layer.classList.remove(NO_VIDEO_CLASS);
    } catch (err) {
      if (!samplingBlocked) {
        console.warn("[ambient] Unable to sample video color:", err);
      }
      samplingBlocked = true;
      stopSampling();
      if (layer) layer.classList.add(NO_VIDEO_CLASS);
    }
  }

  function startSampling() {
    if (!active || samplingBlocked || sampleInterval) return;
    sampleInterval = window.setInterval(sampleFrame, 400);
    sampleFrame();
  }

  function stopSampling() {
    if (sampleInterval) {
      clearInterval(sampleInterval);
      sampleInterval = 0;
    }
  }

  function setActive(nextState) {
    if (nextState === active) return { active };

    if (nextState) {
      const ambientLayer = ensureLayer();
      if (!ambientLayer) {
        active = false;
        return { active: false, reason: "Video player not ready" };
      }
      ambientLayer.classList.add(ACTIVE_CLASS);
      ambientLayer.classList.toggle(NO_VIDEO_CLASS, !getVideoElement());
      samplingBlocked = !ctx ? true : false;
      if (!ctx) {
        console.warn("[ambient] Canvas context unavailable; using static color.");
      }
      active = true;
      lastColor = "";
      applyColor(DEFAULT_COLOR);
      if (ctx) {
        samplingBlocked = false;
        stopSampling();
        startSampling();
      }
    } else {
      active = false;
      stopSampling();
      if (layer) layer.classList.remove(ACTIVE_CLASS);
    }

    dispatchChange();
    return { active };
  }

  function refresh() {
    if (!active) return { active };
    ensureLayer();
    samplingBlocked = false;
    stopSampling();
    startSampling();
    return { active };
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent("btfw:ambient:change", { detail: { active } }));
  }

  function watchPlayerMount() {
    if (playerObserverSetup) return;
    playerObserverSetup = true;

    const observe = () => {
      if (videoObserver) return;
      const target = document.getElementById("ytapiplayer") || document.getElementById("videowrap");
      if (!target) {
        setTimeout(observe, 600);
        return;
      }
      videoObserver = new MutationObserver(() => {
        if (active) {
          samplingBlocked = false;
          refresh();
        }
      });
      videoObserver.observe(target, { childList: true, subtree: true });
    };

    observe();
  }

  function ensureSocketListener() {
    if (socketListenerAttached) return;

    const attach = () => {
      if (socketListenerAttached) return;
      if (window.socket && typeof window.socket.on === "function") {
        socketListenerAttached = true;
        socket.on("changeMedia", () => {
          setTimeout(() => refresh(), 500);
        });
      } else {
        setTimeout(attach, 1000);
      }
    };

    attach();
  }

  return {
    name: "feature:ambient",
    enable: () => setActive(true),
    disable: () => setActive(false),
    toggle: () => setActive(!active),
    refresh,
    isActive: () => active
  };
});
