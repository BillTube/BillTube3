/* BTFW — feature:poll-overlay (poll creation modal + video overlay display) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const CSS_ID = "btfw-poll-overlay-styles";
  const POLL_OVERLAY_CSS = `
    /* Poll Creation Modal Overlay */
    #btfw-poll-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 3000;
      display: none;
      align-items: center;
      justify-content: center;
    }

    #btfw-poll-modal.btfw-poll-modal--open {
      display: flex;
    }

    .btfw-poll-modal-content {
      background: var(--btfw-overlay-elevated);
      border: 1px solid var(--btfw-overlay-border);
      border-radius: calc(var(--btfw-radius) + 4px);
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: var(--btfw-overlay-shadow);
      color: var(--btfw-color-text);
    }

    .btfw-poll-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .btfw-poll-modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--btfw-color-text);
      margin: 0;
    }

    .btfw-poll-modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--btfw-color-text);
      cursor: pointer;
      padding: 5px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .btfw-poll-modal-close:hover {
      opacity: 1;
    }

    .btfw-poll-form-group {
      margin-bottom: 16px;
    }

    .btfw-poll-form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 600;
      color: var(--btfw-color-text);
    }

    .btfw-poll-form-group input,
    .btfw-poll-form-group textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--btfw-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--btfw-color-panel) 86%, transparent 14%);
      color: var(--btfw-color-text);
      font-size: 14px;
    }

    .btfw-poll-form-group input:focus,
    .btfw-poll-form-group textarea:focus {
      outline: none;
      border-color: var(--btfw-color-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-accent) 20%, transparent 80%);
    }

    .btfw-poll-options {
      margin-bottom: 20px;
    }

    .btfw-poll-option {
      display: flex;
      margin-bottom: 8px;
      gap: 8px;
    }

    .btfw-poll-option input {
      flex: 1;
    }

    .btfw-poll-remove-option {
      background: var(--btfw-color-error, #e74c3c);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
    }

    .btfw-poll-add-option {
      background: var(--btfw-color-accent);
      color: var(--btfw-color-on-accent);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      margin-bottom: 16px;
    }

    .btfw-poll-form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btfw-poll-button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btfw-poll-button--primary {
      background: var(--btfw-color-accent);
      color: var(--btfw-color-on-accent);
    }

    .btfw-poll-button--secondary {
      background: color-mix(in srgb, var(--btfw-color-bg) 78%, transparent 22%);
      color: var(--btfw-color-text);
      border: 1px solid var(--btfw-border);
    }

    .btfw-poll-checkbox-group {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .btfw-poll-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btfw-poll-checkbox input[type="checkbox"] {
      width: auto;
    }

    /* Poll Display Overlay on Video */
    #btfw-poll-video-overlay {
      position: absolute;
      inset: 0;
      z-index: 1500;
      pointer-events: none;
      display: none;
    }

    #btfw-poll-video-overlay.btfw-poll-active {
      display: block;
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-surface {
      position: absolute;
      top: clamp(12px, 5vw, 36px);
      left: 0;
      right: 0;
      margin: 0 auto;
      width: min(640px, calc(100% - 24px));
      pointer-events: auto;
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-card {
      position: relative;
      padding: 4px;
      border-radius: calc(var(--btfw-radius, 12px) + 8px);
      backdrop-filter: saturate(135%) blur(8px);
      background: color-mix(in srgb, var(--btfw-overlay-bg, rgba(20,20,28,.86)) 88%, transparent 12%);
      border: 1px solid color-mix(in srgb, var(--btfw-overlay-border, rgba(255,255,255,.16)) 70%, transparent 30%);
      box-shadow: var(--btfw-overlay-shadow, 0 20px 48px rgba(0,0,0,.42));
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: none;
      background: color-mix(in srgb, var(--btfw-color-bg, rgba(15,15,22,.88)) 72%, transparent 28%);
      color: var(--btfw-color-text, #fff);
      cursor: pointer;
      opacity: 0.76;
      transition: opacity 0.16s ease, transform 0.16s ease;
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-close:hover {
      opacity: 1;
      transform: scale(1.05);
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-close:active {
      transform: scale(0.94);
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-content {
      padding: clamp(12px, 4vw, 22px);
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-content .well {
      margin: 0;
      background: color-mix(in srgb, var(--btfw-color-panel) 92%, transparent 8%);
      border-radius: calc(var(--btfw-radius, 12px) + 4px);
      border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 24%, transparent 76%);
      box-shadow: none;
    }

    #btfw-poll-video-overlay .btfw-poll-overlay-content .well .label {
      border-radius: 999px;
    }

    @media (max-width: 768px) {
      #btfw-poll-video-overlay .btfw-poll-overlay-surface {
        width: min(480px, calc(100% - 16px));
      }

      #btfw-poll-video-overlay .btfw-poll-overlay-close {
        top: 4px;
        right: 4px;
      }
    }
  `;

  const scheduleFrame = (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function")
    ? window.requestAnimationFrame.bind(window)
    : (cb => setTimeout(cb, 16));

  let pollModal = null;
  let videoOverlay = null;
  let overlayContent = null;
  let socketEventsWired = false;
  let buttonObserver = null;
  let pollDomObserver = null;
  let pollWrapTarget = null;
  let overlayDismissed = false;
  let overlayRefreshTimer = null;

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
        // ignore and continue to next candidate
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
        if (typeof flag === "boolean") {
          return flag;
        }
        if (typeof flag === "string") {
          return flag !== "0" && flag.toLowerCase() !== "false";
        }
        if (typeof flag === "number") {
          return flag !== 0;
        }
      }
    }
    return true;
  }

  if (!featureEnabled()) {
    console.info("[poll-overlay] Disabled via channel configuration.");
    return {
      name: "feature:poll-overlay",
      openModal: () => {},
      closeModal: () => {},
      showOverlay: () => {},
      hideOverlay: () => {}
    };
  }

  const root = document.documentElement;
  if (root && !root.classList.contains("btfw-poll-overlay-enabled")) {
    root.classList.add("btfw-poll-overlay-enabled");
  }
  let buttonObserverTarget = null;
  let buttonObserverBootstrap = null;

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = POLL_OVERLAY_CSS;
    document.head.appendChild(style);
  }

  function createPollModal() {
    if (pollModal) return pollModal;

    const modal = document.createElement("div");
    modal.id = "btfw-poll-modal";
    modal.innerHTML = `
      <div class="btfw-poll-modal-content">
        <div class="btfw-poll-modal-header">
          <h2 class="btfw-poll-modal-title">Create Poll</h2>
          <button class="btfw-poll-modal-close" type="button">&times;</button>
        </div>
        <form class="btfw-poll-form">
          <div class="btfw-poll-form-group">
            <label for="poll-title">Poll Title</label>
            <input type="text" id="poll-title" placeholder="Enter poll question...">
          </div>
          
          <div class="btfw-poll-form-group">
            <label>Options</label>
            <div class="btfw-poll-options">
              <div class="btfw-poll-option">
                <input type="text" placeholder="Option 1" required>
              </div>
              <div class="btfw-poll-option">
                <input type="text" placeholder="Option 2" required>
              </div>
            </div>
            <button type="button" class="btfw-poll-add-option">Add Option</button>
          </div>

          <div class="btfw-poll-checkbox-group">
            <div class="btfw-poll-checkbox">
              <input type="checkbox" id="poll-obscured">
              <label for="poll-obscured">Hidden results</label>
            </div>
            <div class="btfw-poll-checkbox">
              <input type="checkbox" id="poll-multi">
              <label for="poll-multi">Multiple choice</label>
            </div>
          </div>

          <div class="btfw-poll-form-actions">
            <button type="button" class="btfw-poll-button btfw-poll-button--secondary btfw-poll-cancel">Cancel</button>
            <button type="submit" class="btfw-poll-button btfw-poll-button--primary">Create Poll</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    pollModal = modal;

    // Wire up modal events
    const closeBtn = modal.querySelector(".btfw-poll-modal-close");
    const cancelBtn = modal.querySelector(".btfw-poll-cancel");
    const addOptionBtn = modal.querySelector(".btfw-poll-add-option");
    const form = modal.querySelector(".btfw-poll-form");
    const optionsContainer = modal.querySelector(".btfw-poll-options");

    closeBtn.addEventListener("click", closePollModal);
    cancelBtn.addEventListener("click", closePollModal);
    
    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePollModal();
    });

    addOptionBtn.addEventListener("click", () => {
      const optionCount = optionsContainer.children.length + 1;
      const optionDiv = document.createElement("div");
      optionDiv.className = "btfw-poll-option";
      optionDiv.innerHTML = `
        <input type="text" placeholder="Option ${optionCount}" required>
        <button type="button" class="btfw-poll-remove-option">Remove</button>
      `;
      
      const removeBtn = optionDiv.querySelector(".btfw-poll-remove-option");
      removeBtn.addEventListener("click", () => {
        if (optionsContainer.children.length > 2) {
          optionDiv.remove();
        }
      });

      optionsContainer.appendChild(optionDiv);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handlePollSubmit();
    });

    return modal;
  }

  function createVideoOverlay() {
    if (videoOverlay && overlayContent) return videoOverlay;

    const videowrap = document.getElementById("videowrap");
    if (!videowrap) return null;

    const overlay = document.createElement("div");
    overlay.id = "btfw-poll-video-overlay";
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="btfw-poll-overlay-surface">
        <div class="btfw-poll-overlay-card">
          <button class="btfw-poll-overlay-close" type="button" aria-label="Dismiss poll overlay">&times;</button>
          <div class="btfw-poll-overlay-content"></div>
        </div>
      </div>
    `;

    videowrap.appendChild(overlay);
    videoOverlay = overlay;
    overlayContent = overlay.querySelector(".btfw-poll-overlay-content");

    const closeBtn = overlay.querySelector(".btfw-poll-overlay-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        overlayDismissed = true;
        hideVideoOverlay();
      });
    }

    return overlay;
  }

  function openPollModal() {
    const modal = createPollModal();
    if (modal) {
      modal.classList.add("btfw-poll-modal--open");
      // Focus the title input
      setTimeout(() => {
        const titleInput = modal.querySelector("#poll-title");
        if (titleInput) titleInput.focus();
      }, 100);
    }
  }

  function closePollModal() {
    if (pollModal) {
      pollModal.classList.remove("btfw-poll-modal--open");
      // Reset form
      const form = pollModal.querySelector(".btfw-poll-form");
      if (form) form.reset();
      // Reset to 2 options
      const optionsContainer = pollModal.querySelector(".btfw-poll-options");
      if (optionsContainer) {
        optionsContainer.innerHTML = `
          <div class="btfw-poll-option">
            <input type="text" placeholder="Option 1" required>
          </div>
          <div class="btfw-poll-option">
            <input type="text" placeholder="Option 2" required>
          </div>
        `;
      }
    }
  }

  function handlePollSubmit() {
    const form = pollModal.querySelector(".btfw-poll-form");
    const titleInput = form.querySelector("#poll-title");
    const optionInputs = form.querySelectorAll(".btfw-poll-option input");
    const obscuredCheck = form.querySelector("#poll-obscured");
    const multiCheck = form.querySelector("#poll-multi");

    const title = titleInput.value.trim();
    const options = Array.from(optionInputs)
      .map(input => input.value.trim())
      .filter(opt => opt.length > 0);

    if (!title || options.length < 2) {
      alert("Please provide a title and at least 2 options");
      return;
    }

    // Send poll to server using CyTube's socket
    if (window.socket && window.socket.emit) {
      try {
        window.socket.emit("newPoll", {
          title: title,
          opts: options,
          obscured: obscuredCheck.checked,
          timeout: 0,
          multi: multiCheck.checked
        });
        
        closePollModal();
        
        // Show notification if available
        if (window.BTFW_notify) {
          window.BTFW_notify.success({ 
            title: "Poll Created", 
            html: `Poll "<strong>${title}</strong>" has been created`,
            timeout: 3000 
          });
        }
      } catch (e) {
        console.error("Failed to create poll:", e);
        alert("Failed to create poll. Please try again.");
      }
    } else {
      alert("Unable to connect to server. Please refresh and try again.");
    }
  }

  function renderOverlayFromPollwrap({ force = false } = {}) {
    const overlay = createVideoOverlay();
    if (!overlay || !overlayContent) return false;

    const pollWrap = document.getElementById("pollwrap");
    if (!pollWrap) {
      if (force) hideVideoOverlay();
      return false;
    }

    const activePoll = pollWrap.querySelector(".well.active") || pollWrap.querySelector(".well");
    if (!activePoll) {
      hideVideoOverlay();
      return false;
    }

    const clone = activePoll.cloneNode(true);
    clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));

    const originalButtons = activePoll.querySelectorAll("button");
    const cloneButtons = clone.querySelectorAll("button");

    cloneButtons.forEach((btn, index) => {
      const source = originalButtons[index];
      if (!source) return;

      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        try {
          source.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        } catch (err) {
          source.click();
        }
      });
    });

    overlayContent.innerHTML = "";
    overlayContent.appendChild(clone);
    overlay.classList.add("btfw-poll-active");
    return true;
  }

  function scheduleOverlayRefresh(options = {}) {
    const { force = false } = options;
    if (overlayDismissed && !force) return;

    if (overlayRefreshTimer) {
      clearTimeout(overlayRefreshTimer);
    }

    overlayRefreshTimer = window.setTimeout(() => {
      overlayRefreshTimer = null;
      renderOverlayFromPollwrap({ force });
    }, force ? 0 : 60);
  }

  function showVideoOverlay() {
    overlayDismissed = false;
    observePollWrap();
    scheduleOverlayRefresh({ force: true });
  }

  function hideVideoOverlay() {
    if (videoOverlay) {
      videoOverlay.classList.remove("btfw-poll-active");
      if (overlayRefreshTimer) {
        clearTimeout(overlayRefreshTimer);
        overlayRefreshTimer = null;
      }
      if (overlayContent) {
        overlayContent.innerHTML = "";
      }
    }
  }

  function updatePollResults() {
    scheduleOverlayRefresh();
  }

  function observePollWrap() {
    if (typeof MutationObserver !== "function") return;
    const pollWrap = document.getElementById("pollwrap");
    if (!pollWrap) return;

    if (pollDomObserver && pollWrapTarget === pollWrap) return;

    if (pollDomObserver) {
      try { pollDomObserver.disconnect(); } catch (_) {}
      pollDomObserver = null;
      pollWrapTarget = null;
    }

    pollDomObserver = new MutationObserver(() => {
      scheduleOverlayRefresh();
    });

    try {
      pollDomObserver.observe(pollWrap, { childList: true, subtree: true });
      pollWrapTarget = pollWrap;
    } catch (error) {
      console.warn("[poll-overlay] Failed to observe pollwrap:", error);
    }
  }

  function wireSocketEvents() {
    if (socketEventsWired || !window.socket) return;
    
    try {
      // Listen for new polls
      window.socket.on("newPoll", () => {
        showVideoOverlay();
      });

      // Listen for poll updates
      window.socket.on("updatePoll", () => {
        updatePollResults();
      });

      // Listen for poll closure
      window.socket.on("closePoll", () => {
        overlayDismissed = false;
        hideVideoOverlay();
      });

      socketEventsWired = true;
    } catch (e) {
      console.warn("[poll-overlay] Socket event wiring failed:", e);
    }
  }

  const pollButtonSelector = [
    "button[onclick*='poll']",
    "button[title*='Poll']",
    "button[title*='poll']",
    "#newpollbtn",
    ".poll-btn"
  ].join(", ");

  function markPollButtons(root = document) {
    let pollButtons;
    try {
      pollButtons = root.querySelectorAll ? root.querySelectorAll(pollButtonSelector) : [];
    } catch (e) {
      console.warn('[poll-overlay] Failed to query poll buttons:', e);
      return;
    }

    pollButtons.forEach(btn => {
      if (btn.dataset.btfwHijacked) return;
      btn.dataset.btfwHijacked = "true";

      const handleClick = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        openPollModal();
      };


      try {
        btn.addEventListener("click", handleClick, { capture: true });
      } catch (e) {
        btn.addEventListener("click", handleClick, true);
      }
    });
  }

  function disconnectButtonObserver() {
    if (buttonObserver) {
      buttonObserver.disconnect();
      buttonObserver = null;
    }
    buttonObserverTarget = null;
  }

  function observePollButtons(target) {
    const validTarget = target && (
      (typeof Node === "function" && target instanceof Node) ||
      (target && typeof target === "object" && "nodeType" in target)
    );
    if (!validTarget) return false;

    if (buttonObserver && buttonObserverTarget === target) {
      return true; // Already watching the correct container
    }

    disconnectButtonObserver();

    let debounceTimer = null;
    buttonObserver = new MutationObserver((mutations) => {

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Prefer scanning within the container that actually changed.
        const uniqueRoots = new Set();
        mutations.forEach(record => {
          record.addedNodes && record.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              uniqueRoots.add(node);
            }
          });
        });

        if (uniqueRoots.size) {
          uniqueRoots.forEach(node => {
            if (node.matches && node.matches(pollButtonSelector)) {
              markPollButtons(node.parentElement || target);
            } else {
              markPollButtons(node);
            }
          });
        } else {
          markPollButtons(target);
        }
      }, 60);
    });

    try {
      buttonObserver.observe(target, { childList: true, subtree: true });
    } catch (e) {
      console.warn('[poll-overlay] Failed to observe poll buttons:', e);
      disconnectButtonObserver();
      return false;
    }

    buttonObserverTarget = target;
    markPollButtons(target);
    if (buttonObserverBootstrap) {
      buttonObserverBootstrap.disconnect();
      buttonObserverBootstrap = null;
    }
    return true;
  }

  function ensureBootstrapObserver() {
    if (buttonObserverBootstrap || buttonObserverTarget) return;

    const body = document.body || document.documentElement;
    if (!body) {

      console.warn('[poll-overlay] Unable to observe poll buttons: no document body yet');
      return;
    }

    let scheduled = null;
    let bootstrapChecks = 0;
    const maxBootstrapChecks = 300; // ~5s worth of animation frames
    buttonObserverBootstrap = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = scheduleFrame(() => {
        scheduled = null;
        bootstrapChecks += 1;
        const actions = document.querySelector('#btfw-chat-actions');
        if (actions && observePollButtons(actions)) {
          buttonObserverBootstrap.disconnect();
          buttonObserverBootstrap = null;
        } else if (bootstrapChecks >= maxBootstrapChecks) {
          // Give up to avoid watching the whole document indefinitely.
          buttonObserverBootstrap.disconnect();
          buttonObserverBootstrap = null;
        }
      });
    });

    buttonObserverBootstrap.observe(body, { childList: true, subtree: true });
  }

  function hijackPollButtons() {
    const actions = document.querySelector('#btfw-chat-actions');

    if (actions && observePollButtons(actions)) {
      return;
    }

    // Fallback: mark anything already on the page and watch for actions container later.
    markPollButtons(document);
    ensureBootstrapObserver();

  }

  function waitForSocket() {
    return new Promise((resolve) => {
      if (window.socket && window.socket.on) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      const checkSocket = () => {
        attempts++;
        if (window.socket && window.socket.on) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkSocket, 100);
        } else {
          console.warn("[poll-overlay] Socket not available after 5 seconds");
          resolve(); // Continue anyway
        }
      };

      setTimeout(checkSocket, 100);
    });
  }

  async function boot() {
    try {
      injectCSS();
      
      // Wait for socket to be available before wiring events
      await waitForSocket();
      wireSocketEvents();

      // Set up button hijacking
      hijackPollButtons();

      // Observe poll DOM for changes and render immediately if one already exists
      observePollWrap();
      scheduleOverlayRefresh({ force: true });

    } catch (e) {
      console.error("[poll-overlay] Boot failed:", e);
    }
  }

  // Boot when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 0); // Async to avoid blocking
  }

  // Also boot on layout ready event (with delay to ensure everything is settled)
  document.addEventListener("btfw:layoutReady", () => {
    setTimeout(boot, 200);
  });

  return {
    name: "feature:poll-overlay",
    openModal: openPollModal,
    closeModal: closePollModal,
    showOverlay: showVideoOverlay,
    hideOverlay: hideVideoOverlay
  };
});
