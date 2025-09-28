/* BTFW — feature:poll-overlay (reuse native CyTube poll UI over video) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const CSS_ID = "btfw-poll-overlay-styles";
  const STATE_KEY = "btfw:poll-overlay:docked";
  const ACTIVE_SELECTORS = [
    ".poll-votes",
    ".poll-results",
    ".poll-entry",
    ".poll-item",
    ".poll-option",
    ".poll-options",
    ".poll-table",
    ".poll-answers",
    ".poll-progress",
    ".poll-current",
    ".poll-display",
    ".progress",
    "[data-poll-option]",
    "button[data-option]",
    "button[id^=vote][data-option]",
    "button.poll-btn",
    "input[type=radio][name^=poll]",
    "input[type=checkbox][name^=poll]"
  ];
  const INACTIVE_TEXT = /no (active|current)?\s*poll/i;

  const STYLE = `
    #btfw-poll-overlay {
      position: absolute;
      inset: 0;
      z-index: 1650;
      display: none;
      pointer-events: none;
    }

    #btfw-poll-overlay.btfw-visible {
      display: block;
    }

    #btfw-poll-overlay .btfw-poll-overlay__inner {
      position: absolute;
      top: 50%;
      right: clamp(12px, 4vw, 32px);
      transform: translateY(-50%);
      width: min(520px, calc(100% - clamp(32px, 10vw, 112px)));
      max-width: min(520px, calc(100% - clamp(32px, 10vw, 112px)));
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    #btfw-poll-overlay .btfw-poll-overlay__toggle {
      position: absolute;
      top: 50%;
      margin-top: -17px;
      right: clamp(8px, 3vw, 20px);
      width: 34px;
      height: 34px;
      border-radius: 17px;
      border: 0;
      padding: 0;
      display: grid;
      place-items: center;
      background: rgba(17, 17, 26, 0.65);
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      pointer-events: auto;
      transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
    }

    #btfw-poll-overlay .btfw-poll-overlay__toggle::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }

    #btfw-poll-overlay-launcher {
      position: absolute;
      top: 50%;
      right: clamp(12px, 4vw, 32px);
      transform: translateY(-50%);
      z-index: 1645;
      display: none;
      pointer-events: auto;
    }

    #btfw-poll-overlay-launcher.btfw-visible {
      display: inline-flex;
    }

    #btfw-poll-overlay-launcher .btfw-poll-overlay__launcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 0;
      background: rgba(17, 17, 26, 0.72);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    #btfw-poll-overlay-launcher .btfw-poll-overlay__launcher-btn:hover {
      background: rgba(109, 77, 246, 0.9);
      transform: translateY(-1px);
    }

    #btfw-poll-overlay-launcher .btfw-poll-overlay__launcher-btn:focus-visible {
      outline: 2px solid var(--btfw-color-accent, #6d4df6);
      outline-offset: 2px;
    }

    #btfw-poll-overlay .btfw-poll-overlay__toggle:hover {
      background: rgba(109, 77, 246, 0.9);
      transform: translateY(-1px);
    }

    #btfw-poll-overlay .btfw-poll-overlay__toggle:focus-visible {
      outline: 2px solid var(--btfw-color-accent, #6d4df6);
      outline-offset: 2px;
    }

    #pollwrap.btfw-poll-overlay__panel {
      margin: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: clamp(16px, 4vw, 22px);
      background: color-mix(in srgb, var(--btfw-color-surface) 18%, transparent 82%);
      backdrop-filter: saturate(140%) blur(14px);
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 48%, transparent 52%);
      box-shadow: 0 28px 56px rgba(0, 0, 0, 0.45);
      color: var(--btfw-color-text);
      max-height: calc(100% - clamp(36px, 12vw, 128px));
      overflow-y: auto;
    }

    #pollwrap.btfw-poll-overlay__panel .poll-menu {
      background: transparent;
      border: 0;
      box-shadow: none;
      padding: 0;
    }

    #pollwrap.btfw-poll-overlay__panel .poll-controls {
      margin-top: 8px;
      justify-content: flex-end;
      gap: 8px;
    }

    #pollwrap.btfw-poll-overlay__panel .poll-controls .button {
      margin-left: 0;
    }

    .btfw-poll-overlay-placeholder {
      display: none;
      padding: 18px;
      border-radius: 14px;
      border: 1px dashed color-mix(in srgb, var(--btfw-color-accent) 32%, transparent 68%);
      background: color-mix(in srgb, var(--btfw-color-panel) 92%, transparent 8%);
      color: var(--btfw-color-text);
    }

    .btfw-poll-overlay-placeholder:not([hidden]) {
      display: block;
    }

    .btfw-poll-overlay-placeholder__inner {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btfw-poll-overlay-placeholder__title {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: color-mix(in srgb, var(--btfw-color-text) 90%, transparent 10%);
    }

    .btfw-poll-overlay-placeholder__btn {
      align-self: flex-start;
    }

    @media (max-width: 768px) {
      #btfw-poll-overlay .btfw-poll-overlay__inner {
        top: clamp(8px, 4vw, 20px);
        right: clamp(8px, 4vw, 20px);
        left: clamp(8px, 4vw, 20px);
        transform: none;
        width: auto;
        max-width: none;
      }

      #btfw-poll-overlay .btfw-poll-overlay__toggle {
        top: clamp(8px, 4vw, 20px);
        right: clamp(8px, 4vw, 20px);
        margin-top: 0;
      }

      #btfw-poll-overlay-launcher {
        top: clamp(8px, 4vw, 20px);
        right: clamp(8px, 4vw, 20px);
        transform: none;
      }

      #pollwrap.btfw-poll-overlay__panel {
        padding: clamp(14px, 4vw, 20px);
        max-height: calc(100% - clamp(44px, 18vw, 156px));
      }
    }
  `;

  const scheduleFrame = (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function")
    ? window.requestAnimationFrame.bind(window)
    : (cb => setTimeout(cb, 16));

  let overlayHost = null;
  let overlayInner = null;
  let overlayToggle = null;
  let placeholder = null;
  let placeholderToggle = null;
  let overlayLauncher = null;
  let pollWrap = null;
  let originalParent = null;
  let originalNextSibling = null;
  let pollObserver = null;
  let maintainTimer = null;
  let overlayEnabled = loadInitialOverlayState();
  let pollActiveState = null;
  let socketWired = false;

  function loadInitialOverlayState() {
    try {
      const stored = localStorage.getItem(STATE_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch (_) {}
    return true;
  }

  function resolveAdminConfig() {
    const sources = [
      () => window.BTFW_THEME_ADMIN,
      () => window.BTFW_THEME,
      () => window.BTFW_THEME_CONFIG,
      () => window.BTFW_THEME_SETTINGS,
      () => window.BTFW_THEME_STATE,
      () => window.BTFW_THEME_DATA
    ];

    for (const getSource of sources) {
      try {
        const config = getSource();
        if (config && typeof config === "object") {
          return config;
        }
      } catch (_) {
        // ignore
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

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function markRoot() {
    const root = document.documentElement;
    if (root && !root.classList.contains("btfw-poll-overlay-enabled")) {
      root.classList.add("btfw-poll-overlay-enabled");
    }
  }

  function ensureOverlayHost() {
    if (overlayHost && overlayInner) return overlayHost;


    const videoWrap = document.getElementById("videowrap");
    if (!videoWrap) return null;

    overlayHost = document.createElement("div");
    overlayHost.id = "btfw-poll-overlay";
    overlayHost.className = "btfw-poll-overlay";
    overlayHost.setAttribute("aria-hidden", "true");

    const inner = document.createElement("div");
    inner.className = "btfw-poll-overlay__inner";
    inner.setAttribute("role", "region");
    inner.setAttribute("aria-live", "polite");
    inner.setAttribute("aria-label", "Current poll");
    overlayHost.appendChild(inner);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btfw-poll-overlay__toggle";
    toggle.setAttribute("aria-label", "Move poll back to sidebar");
    toggle.innerHTML = "&times;";
    toggle.addEventListener("click", () => setOverlayEnabled(false));
    overlayHost.appendChild(toggle);

    overlayInner = inner;
    overlayToggle = toggle;
    videoWrap.appendChild(overlayHost);

    ensureLauncher();

    return overlayHost;
  }

  function ensureLauncher() {
    if (overlayLauncher) return overlayLauncher;

    const videoWrap = document.getElementById("videowrap");
    if (!videoWrap) return null;

    const launcher = document.createElement("div");
    launcher.id = "btfw-poll-overlay-launcher";
    launcher.setAttribute("aria-hidden", "true");
    launcher.hidden = true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btfw-poll-overlay__launcher-btn";
    button.setAttribute("aria-label", "Show poll over video");
    button.innerHTML = "<span class=\"btfw-poll-overlay__launcher-text\">Show poll overlay</span>";
    button.addEventListener("click", () => setOverlayEnabled(true));

    launcher.appendChild(button);
    videoWrap.appendChild(launcher);

    overlayLauncher = launcher;

    return overlayLauncher;
  }

  function ensurePlaceholder() {
    if (placeholder) return placeholder;
    if (!originalParent) return null;

    placeholder = document.createElement("div");
    placeholder.id = "btfw-poll-overlay-placeholder";
    placeholder.className = "btfw-poll-overlay-placeholder";
    placeholder.setAttribute("hidden", "hidden");
    placeholder.innerHTML = `
      <div class="btfw-poll-overlay-placeholder__inner">
        <span class="btfw-poll-overlay-placeholder__title">Poll overlay</span>
        <p class="btfw-poll-overlay-placeholder__text">
          Active polls can appear over the video. You can bring the poll back here at any time.
        </p>
        <button type="button" class="btn btn-sm btn-default btfw-poll-overlay-placeholder__btn">Show poll over video</button>
      </div>
    `;
    placeholderToggle = placeholder.querySelector(".btfw-poll-overlay-placeholder__btn");
    if (placeholderToggle) {
      placeholderToggle.addEventListener("click", () => setOverlayEnabled(true));

    }
    wrap.classList.add("btfw-poll-overlay__panel");
    startPollObserver();
    startMaintainLoop();
    syncVisibility();
    return true;
  }

    if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
      originalParent.insertBefore(placeholder, originalNextSibling);
    } else {
      originalParent.appendChild(placeholder);
    }

    return placeholder;
  }

  function rememberOriginalLocation(wrap) {
    if (originalParent) return;
    if (!wrap || !wrap.parentElement) return;
    originalParent = wrap.parentElement;
    originalNextSibling = wrap.nextSibling;
  }

  function adoptPollWrap() {
    if (!overlayEnabled) return false;
    const wrap = pollWrap || document.getElementById("pollwrap");
    if (!wrap) return false;
    pollWrap = wrap;

    rememberOriginalLocation(wrap);
    ensureOverlayHost();
    ensurePlaceholder();
    if (!overlayInner) return false;

    if (placeholder) placeholder.setAttribute("hidden", "hidden");

    if (wrap.parentElement !== overlayInner) {
      overlayInner.appendChild(wrap);
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

  function restorePollWrap() {
    stopMaintainLoop();
    if (pollObserver) {
      pollObserver.disconnect();
      pollObserver = null;
    }
    const wrap = pollWrap || document.getElementById("pollwrap");
    if (!wrap) return false;
    pollWrap = wrap;
    wrap.classList.remove("btfw-poll-overlay__panel");
    try {
      delete wrap.dataset.btfwPollOverlay;
    } catch (_) {
      wrap.removeAttribute("data-btfw-poll-overlay");
    }

    if (originalParent) {
      if (placeholder && placeholder.parentElement !== originalParent) {
        if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
          originalParent.insertBefore(placeholder, originalNextSibling);
        } else {
          originalParent.appendChild(placeholder);
        }
      }

      const target = placeholder && placeholder.parentElement === originalParent
        ? placeholder
        : (originalNextSibling && originalNextSibling.parentElement === originalParent
          ? originalNextSibling
          : null);

      if (target) {
        originalParent.insertBefore(wrap, target);
      } else {
        originalParent.appendChild(wrap);
      }
    }

    if (placeholder) {
      placeholder.removeAttribute("hidden");
    }

    if (overlayHost) {
      overlayHost.classList.remove("btfw-visible");
      overlayHost.setAttribute("aria-hidden", "true");
    }

    if (pollWrap) {
      startPollObserver();
    }

    return true;
  }

  function setOverlayEnabled(enabled) {
    const value = !!enabled;
    if (value === overlayEnabled) return;
    overlayEnabled = value;
    try {
      localStorage.setItem(STATE_KEY, value ? "1" : "0");
    } catch (_) {}

    if (overlayEnabled && getCurrentActiveState()) adoptPollWrap();
    else restorePollWrap();

    updateControls();
    scheduleFrame(syncVisibility);
  }

  function updateControls() {
    if (overlayToggle) {
      overlayToggle.setAttribute("aria-pressed", overlayEnabled ? "true" : "false");
      overlayToggle.setAttribute("title", overlayEnabled ? "Move poll back to sidebar" : "Show poll over video");
      overlayToggle.hidden = !overlayEnabled;
    }
    if (placeholder) {
      if (overlayEnabled) placeholder.setAttribute("hidden", "hidden");
      else placeholder.removeAttribute("hidden");
    }
    ensureLauncher();
    if (overlayLauncher) {
      const active = getCurrentActiveState();
      const visible = !overlayEnabled && active;
      overlayLauncher.classList.toggle("btfw-visible", visible);
      overlayLauncher.hidden = !visible;
      overlayLauncher.setAttribute("aria-hidden", visible ? "false" : "true");
    }
  }

  function detectActiveFromDOM() {
    if (!pollWrap) return false;
    for (const selector of ACTIVE_SELECTORS) {
      if (pollWrap.querySelector(selector)) return true;

    }
  }

    const text = (pollWrap.textContent || "").trim();
    if (!text) return false;
    if (INACTIVE_TEXT.test(text)) return false;
    return true;
  }

  function setPollActiveState(active) {
    const value = !!active;
    if (pollActiveState === value) return;
    pollActiveState = value;

    if (value) {
      if (overlayEnabled) {
        const adopted = adoptPollWrap();
        if (!adopted) {
          scheduleFrame(() => {
            if (overlayEnabled && getCurrentActiveState()) adoptPollWrap();
          });
        }
      } else {
        restorePollWrap();
      }
    } else {
      restorePollWrap();
    }

    updateControls();
    scheduleFrame(syncVisibility);
  }

  function getCurrentActiveState() {
    if (pollActiveState != null) return pollActiveState;
    return detectActiveFromDOM();
  }

  function syncVisibility() {
    if (!overlayHost) return;

    const active = overlayEnabled && pollWrap && getCurrentActiveState();
    const visible = !!active;
    overlayHost.classList.toggle("btfw-visible", visible);
    overlayHost.setAttribute("aria-hidden", visible ? "false" : "true");
    document.documentElement.classList.toggle("btfw-poll-overlay-active", visible);

  }

  function startPollObserver() {
    if (!pollWrap) return;
    if (pollObserver) pollObserver.disconnect();
    pollObserver = new MutationObserver(() => {
      const active = detectActiveFromDOM();
      if (pollActiveState == null || pollActiveState !== active) {
        setPollActiveState(active);
      } else {
        scheduleFrame(syncVisibility);
      }
    });
    pollObserver.observe(pollWrap, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  function startMaintainLoop() {
    if (maintainTimer || !overlayEnabled || !getCurrentActiveState()) return;
    const tick = () => {
      maintainTimer = null;
      if (!overlayEnabled || !getCurrentActiveState()) return;
      if (pollWrap && overlayInner && pollWrap.parentElement !== overlayInner) {
        overlayInner.appendChild(pollWrap);
        pollWrap.classList.add("btfw-poll-overlay__panel");
        startPollObserver();
      }
      syncVisibility();
      maintainTimer = window.setTimeout(tick, 1500);
    };
    maintainTimer = window.setTimeout(tick, 1500);
  }

  function stopMaintainLoop() {
    if (maintainTimer) {
      window.clearTimeout(maintainTimer);
      maintainTimer = null;
    }
  }

  function waitForSocket(attempt = 0) {
    if (window.socket && typeof window.socket.on === "function") {
      return Promise.resolve(window.socket);
    }
    if (attempt > 40) return Promise.resolve(null);
    return new Promise(resolve => {
      setTimeout(() => resolve(waitForSocket(attempt + 1)), 150);
    });
  }

  function wireSocket(socket) {
    if (!socket || socketWired) return;
    const markActive = () => setPollActiveState(true);
    const markInactive = () => setPollActiveState(false);

    ["newPoll", "updatePoll", "pollUpdate", "startPoll"].forEach(evt => {
      if (typeof socket.on === "function") socket.on(evt, markActive);
    });
    ["closePoll", "clearPoll", "deletePoll"].forEach(evt => {
      if (typeof socket.on === "function") socket.on(evt, markInactive);
    });

    socketWired = true;
  }

  function attemptBootstrap() {
    const wrap = document.getElementById("pollwrap");
    if (!wrap) return false;
    pollWrap = wrap;
    rememberOriginalLocation(wrap);
    ensurePlaceholder();
    const active = detectActiveFromDOM();
    pollActiveState = active;
    if (overlayEnabled && active) adoptPollWrap();
    else restorePollWrap();
    updateControls();
    scheduleFrame(syncVisibility);
    return true;
  }

  function observeUntilReady() {
    if (attemptBootstrap()) return;
    const target = document.body || document.documentElement;
    if (!target) return;
    const observer = new MutationObserver(() => {
      if (attemptBootstrap()) observer.disconnect();
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  function init() {
    if (!featureEnabled()) {
      return;
    }
    injectCSS();
    markRoot();
    observeUntilReady();
    waitForSocket().then(socket => {
      if (socket) wireSocket(socket);
      scheduleFrame(syncVisibility);
    });
  }

  init();

  return {
    name: "feature:poll-overlay",
    enableOverlay: () => setOverlayEnabled(true),
    disableOverlay: () => setOverlayEnabled(false),
    sync: syncVisibility
  };
});
