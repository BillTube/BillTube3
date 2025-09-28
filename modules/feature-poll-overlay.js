/* BTFW — feature:poll-overlay (rehome the native CyTube poll UI over the video) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const CSS_ID = "btfw-poll-overlay-css";
  const LS_KEY = "btfw:poll-overlay:preferred";
  const ROOT_FLOAT_CLASS = "btfw-poll-overlay-active";
  const PLACEHOLDER_ID = "btfw-poll-overlay-placeholder";
  const OVERLAY_ID = "btfw-poll-overlay";
  const LAUNCHER_ID = "btfw-poll-overlay-launcher";

  const ACTIVE_SELECTORS = [
    ".poll-menu",
    ".poll-answers",
    ".poll-entry",
    ".poll-options",
    ".poll-votes",
    ".poll-results",
    "button[data-option]",
    "input[type=radio][name^=poll]",
    "input[type=checkbox][name^=poll]"
  ];

  const INACTIVE_TEXT = /there is no active poll|no current poll|no poll active/i;

  const raf = (fn) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(fn);
    }
    return setTimeout(fn, 16);
  };

  const ADMIN_SOURCES = [
    () => window.BTFW_THEME_ADMIN,
    () => window.BTFW_THEME,
    () => window.BTFW_THEME_CONFIG,
    () => window.BTFW_THEME_SETTINGS,
    () => window.BTFW_THEME_STATE,
    () => window.BTFW_THEME_DATA
  ];

  let pollWrap = null;
  let originalParent = null;
  let originalNextSibling = null;
  let overlayHost = null;
  let overlayInner = null;
  let overlayClose = null;
  let launcher = null;
  let placeholder = null;
  let placeholderButton = null;
  let pollObserver = null;
  let videoMountObserver = null;
  let overlayPreferred = readPreference();
  let pollActive = false;


  if (!featureEnabled()) {
    console.info("[poll-overlay] Disabled via channel configuration.");
    return {
      name: "feature:poll-overlay",
      show: () => {},
      hide: () => {},
      sync: () => {}
    };
  }

  const root = document.documentElement;
  if (root && !root.classList.contains("btfw-poll-overlay-enabled")) {
    root.classList.add("btfw-poll-overlay-enabled");
  }

  function resolveAdminConfig() {
    for (const getSource of ADMIN_SOURCES) {
      try {
        const cfg = getSource();
        if (cfg && typeof cfg === "object") {
          return cfg;
        }
      } catch (_) {
      }
    }
    return null;
  }

  function featureEnabled() {
    const config = resolveAdminConfig();
    if (config && typeof config === "object") {
      const features = config.features;
      if (features && typeof features === "object") {
        const flag = features.videoOverlayPoll;
        if (typeof flag === "boolean") return flag;
        if (typeof flag === "string") return flag !== "0" && flag.toLowerCase() !== "false";
        if (typeof flag === "number") return flag !== 0;
      }
    }
    return true;
  }

  function readPreference() {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch (_) {}
    return true;
  }

  function writePreference(value) {
    try {
      localStorage.setItem(LS_KEY, value ? "1" : "0");
    } catch (_) {}
  }


  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = `
      :root.${ROOT_FLOAT_CLASS} {
        --btfw-poll-overlay-shadow: 0 28px 64px rgba(6, 8, 20, 0.55);
        --btfw-poll-overlay-bg: color-mix(in srgb, var(--btfw-color-surface, #1c1f2a) 82%, transparent 18%);
        --btfw-poll-overlay-border: color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 52%, transparent 48%);
      }

      #${OVERLAY_ID} {
        position: absolute;
        inset: 0;
        pointer-events: none;
        display: none;
        z-index: 1600;
      }

      #${OVERLAY_ID}.btfw-visible {
        display: block;
      }

      #${OVERLAY_ID} .btfw-poll-overlay__card {
        position: absolute;
        top: 50%;
        right: clamp(12px, 4vw, 40px);
        transform: translateY(-50%);
        width: min(520px, calc(100% - clamp(48px, 12vw, 180px)));
        max-height: calc(100% - clamp(60px, 18vh, 220px));
        overflow-y: auto;
        padding: clamp(16px, 4vw, 22px);
        border-radius: 18px;
        background: var(--btfw-poll-overlay-bg, rgba(16, 18, 26, 0.82));
        backdrop-filter: saturate(135%) blur(14px);
        border: 1px solid var(--btfw-poll-overlay-border, rgba(109, 77, 246, 0.6));
        box-shadow: var(--btfw-poll-overlay-shadow, 0 28px 64px rgba(6, 8, 20, 0.55));
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--btfw-color-text, #f7f8ff);
        pointer-events: auto;
      }

      #${OVERLAY_ID} .btfw-poll-overlay__close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 0;
        background: rgba(10, 12, 20, 0.6);
        color: inherit;
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 18px;
        transition: background 0.2s ease, transform 0.2s ease;
      }

      #${OVERLAY_ID} .btfw-poll-overlay__close:hover {
        background: rgba(109, 77, 246, 0.85);
        transform: translateY(-1px);
      }

      #${OVERLAY_ID} .btfw-poll-overlay__close:focus-visible {
        outline: 2px solid var(--btfw-color-accent, #6d4df6);
        outline-offset: 2px;
      }

      #pollwrap.btfw-poll-overlay__panel {
        margin: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        width: 100%;
      }

      #pollwrap.btfw-poll-overlay__panel .poll-menu {
        background: transparent;
        border: 0;
        box-shadow: none;
      }

      #pollwrap.btfw-poll-overlay__panel .poll-menu .btn {
        margin-left: 0;
      }

      #${LAUNCHER_ID} {
        position: absolute;
        top: 50%;
        right: clamp(12px, 4vw, 40px);
        transform: translateY(-50%);
        z-index: 1595;
        display: none;
        pointer-events: auto;
      }

      #${LAUNCHER_ID}.btfw-visible {
        display: inline-flex;
      }

      #${LAUNCHER_ID} .btfw-poll-launcher__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 0;
        background: rgba(16, 18, 26, 0.74);
        color: #fff;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease;
      }

      #${LAUNCHER_ID} .btfw-poll-launcher__btn:hover {
        background: rgba(109, 77, 246, 0.9);
        transform: translateY(-1px);
      }

      #${LAUNCHER_ID} .btfw-poll-launcher__btn:focus-visible {
        outline: 2px solid var(--btfw-color-accent, #6d4df6);
        outline-offset: 2px;
      }

      #${PLACEHOLDER_ID} {
        display: none;
        padding: 16px;
        border-radius: 14px;
        border: 1px dashed color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 42%, transparent 58%);
        background: color-mix(in srgb, var(--btfw-color-panel, #202333) 90%, transparent 10%);
        color: var(--btfw-color-text, #e8eafd);
      }

      #${PLACEHOLDER_ID}.btfw-visible {
        display: block;
      }

      #${PLACEHOLDER_ID} .btfw-poll-placeholder__title {
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        margin-bottom: 6px;
      }

      #${PLACEHOLDER_ID} .btfw-poll-placeholder__text {
        margin-bottom: 10px;
        font-size: 0.85rem;
        opacity: 0.85;
      }

      #${PLACEHOLDER_ID} .btfw-poll-placeholder__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      @media (max-width: 768px) {
        #${OVERLAY_ID} .btfw-poll-overlay__card {
          top: clamp(8px, 6vw, 20px);
          right: clamp(8px, 5vw, 16px);
          left: clamp(8px, 5vw, 16px);
          transform: none;
          width: auto;
          max-height: calc(100% - clamp(96px, 22vh, 240px));
        }

        #${LAUNCHER_ID} {
          top: auto;
          bottom: clamp(12px, 6vw, 30px);
          transform: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function rememberOriginal() {
    if (!pollWrap || originalParent) return;
    if (!pollWrap.parentElement) return;
    originalParent = pollWrap.parentElement;
    originalNextSibling = pollWrap.nextSibling;
  }

  function ensurePlaceholder() {
    if (placeholder) return placeholder;
    placeholder = document.createElement("div");
    placeholder.id = PLACEHOLDER_ID;
    placeholder.className = "well well-sm btfw-poll-placeholder";
    placeholder.innerHTML = `
      <div class="btfw-poll-placeholder__title">Poll overlay</div>
      <p class="btfw-poll-placeholder__text">The active poll is floating over the video.</p>
      <button type="button" class="btn btn-sm btn-default btfw-poll-placeholder__btn">Return poll to sidebar</button>
    `;
    placeholderButton = placeholder.querySelector(".btfw-poll-placeholder__btn");
    if (placeholderButton) {
      placeholderButton.addEventListener("click", () => setOverlayPreferred(false));
    }
    return placeholder;
  }

  function placePlaceholder() {
    if (!placeholder || !originalParent) return;
    if (placeholder.parentElement === originalParent) return;
    const anchor = originalNextSibling && originalNextSibling.parentElement === originalParent
      ? originalNextSibling
      : null;
    if (anchor) {
      originalParent.insertBefore(placeholder, anchor);
    } else {
      originalParent.appendChild(placeholder);
    }
  }

  function ensureOverlayElements() {
    if (!overlayHost) {
      overlayHost = document.createElement("div");
      overlayHost.id = OVERLAY_ID;
      overlayHost.setAttribute("role", "region");
      overlayHost.setAttribute("aria-label", "Poll overlay");

      overlayInner = document.createElement("div");
      overlayInner.className = "btfw-poll-overlay__card";
      overlayHost.appendChild(overlayInner);

      overlayClose = document.createElement("button");
      overlayClose.type = "button";
      overlayClose.className = "btfw-poll-overlay__close";
      overlayClose.setAttribute("aria-label", "Return poll to sidebar");
      overlayClose.innerHTML = "<span aria-hidden=\"true\">&times;</span>";
      overlayClose.addEventListener("click", () => setOverlayPreferred(false));
      overlayHost.appendChild(overlayClose);
    }

    if (!launcher) {
      launcher = document.createElement("div");
      launcher.id = LAUNCHER_ID;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btfw-poll-launcher__btn";
      btn.innerHTML = "<span aria-hidden=\"true\">📊</span><span>Show poll overlay</span>";
      btn.addEventListener("click", () => setOverlayPreferred(true));
      launcher.appendChild(btn);
    }
    wrap.classList.add("btfw-poll-overlay__panel");
    try {
      wrap.dataset.btfwPollOverlay = "video";
    } catch (_) {}
    startPollObserver();
    startMaintainLoop();
    syncVisibility();
    return true;
  }

  function attachOverlayToVideo() {
    const videoWrap = document.querySelector("#videowrap, #mainvideowrap, .video-wrap");
    if (!videoWrap) {
      if (!videoMountObserver && typeof MutationObserver !== "undefined") {
        videoMountObserver = new MutationObserver(() => {
          const found = document.querySelector("#videowrap, #mainvideowrap, .video-wrap");
          if (!found) return;
          if (videoMountObserver) {
            videoMountObserver.disconnect();
            videoMountObserver = null;
          }
          attachOverlayToVideo();
        });
        const target = document.body || document.documentElement;
        if (target) {
          videoMountObserver.observe(target, { childList: true, subtree: true });
        }
      }
      return false;
    }

    if (videoMountObserver) {
      videoMountObserver.disconnect();
      videoMountObserver = null;
    }
    ensureOverlayElements();
    if (overlayHost && overlayHost.parentElement !== videoWrap) {
      videoWrap.appendChild(overlayHost);
    }
    if (launcher && launcher.parentElement !== videoWrap) {
      videoWrap.appendChild(launcher);
    }
    return true;
  }

  function adoptPollToOverlay() {
    if (!pollWrap) return;
    attachOverlayToVideo();
    ensurePlaceholder();
    placePlaceholder();
    rememberOriginal();

    if (overlayInner && pollWrap.parentElement !== overlayInner) {
      overlayInner.appendChild(pollWrap);
    }

    pollWrap.classList.add("btfw-poll-overlay__panel");
    pollWrap.setAttribute("data-btfw-poll-overlay", "video");
    if (placeholder) {
      placeholder.classList.add("btfw-visible");
      placeholder.setAttribute("data-btfw-poll-overlay", "placeholder");
    }

    if (overlayHost) overlayHost.classList.add("btfw-visible");
    document.documentElement.classList.add(ROOT_FLOAT_CLASS);
  }

  function restorePollToSidebar() {
    if (!pollWrap || !originalParent) return;

    pollWrap.classList.remove("btfw-poll-overlay__panel");
    pollWrap.removeAttribute("data-btfw-poll-overlay");

    const anchor = placeholder && placeholder.parentElement === originalParent ? placeholder : originalNextSibling;
    if (anchor && anchor.parentElement === originalParent) {
      originalParent.insertBefore(pollWrap, anchor);
    } else {
      originalParent.appendChild(pollWrap);
    }

    if (placeholder) {
      placeholder.classList.remove("btfw-visible");
      placeholder.removeAttribute("data-btfw-poll-overlay");
    }

    if (overlayHost) {
      overlayHost.classList.remove("btfw-visible");

    }
  }

    document.documentElement.classList.remove(ROOT_FLOAT_CLASS);
  }

  function updateLauncherVisibility(show) {
    attachOverlayToVideo();
    if (!launcher) return;
    launcher.classList.toggle("btfw-visible", !!show);
  }

  function pollHasActiveContent() {
    if (!pollWrap) return false;
    if (!pollWrap.isConnected) return false;
    if (ACTIVE_SELECTORS.some(sel => pollWrap.querySelector(sel))) return true;
    const text = (pollWrap.textContent || "").trim();
    if (!text) return false;
    return !INACTIVE_TEXT.test(text);
  }

  function setOverlayPreferred(value) {
    const next = !!value;
    if (overlayPreferred === next) {
      syncOverlay();
      return;
    }
    overlayPreferred = next;
    writePreference(next);
    syncOverlay();
  }

  function syncOverlay(force) {
    if (!pollWrap) return;

    rememberOriginal();
    const active = pollHasActiveContent();
    if (active !== pollActive) {
      pollActive = active;
      force = true;
    }

    const shouldFloat = overlayPreferred && pollActive;

    if (shouldFloat) {
      adoptPollToOverlay();
      updateLauncherVisibility(false);
    } else {
      restorePollToSidebar();
      updateLauncherVisibility(pollActive && !overlayPreferred);
    }

    if (!pollActive) {
      updateLauncherVisibility(false);
      if (placeholder) placeholder.classList.remove("btfw-visible");
    }
  }

  function observePollChanges() {
    if (!pollWrap) return;
    if (pollObserver) pollObserver.disconnect();
    pollObserver = new MutationObserver(() => syncOverlay(false));
    pollObserver.observe(pollWrap, { childList: true, subtree: true, characterData: true });
  }

  function waitForPollWrap() {
    const existing = document.getElementById("pollwrap");
    if (existing) {
      pollWrap = existing;
      rememberOriginal();
      ensurePlaceholder();
      observePollChanges();
      raf(() => syncOverlay(true));
      return;

    }
    if (attempt > 40) return Promise.resolve(null);
    return new Promise(resolve => {
      setTimeout(() => resolve(waitForSocket(attempt + 1)), 150);
    });
  }

    const observer = new MutationObserver(() => {
      const found = document.getElementById("pollwrap");
      if (!found) return;
      observer.disconnect();
      pollWrap = found;
      rememberOriginal();
      ensurePlaceholder();
      observePollChanges();
      raf(() => syncOverlay(true));
    });

    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function waitForSocket(attempt = 0) {
    if (window.socket && typeof window.socket.on === "function") {
      return Promise.resolve(window.socket);
    }
    if (attempt > 60) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      setTimeout(() => {
        waitForSocket(attempt + 1).then(resolve);
      }, 500);

    });
    observer.observe(target, { childList: true, subtree: true });
  }

  function wireSocket() {
    waitForSocket().then(socket => {
      if (!socket) return;
      const markActive = () => raf(() => syncOverlay(true));
      const markInactive = () => raf(() => syncOverlay(true));
      ["newPoll", "updatePoll", "setPoll"].forEach(evt => {
        socket.on(evt, markActive);
      });
      ["closePoll", "clearPoll", "deletePoll"].forEach(evt => {
        socket.on(evt, markInactive);
      });
    });
  }

  function init() {
    injectCSS();
    attachOverlayToVideo();
    waitForPollWrap();
    wireSocket();
  }


  init();

  return {
    name: "feature:poll-overlay",
    show: () => setOverlayPreferred(true),
    hide: () => setOverlayPreferred(false),
    sync: () => syncOverlay(true)

  };
});
