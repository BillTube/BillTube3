/* BTFW — feature:poll-overlay (rehome the native CyTube poll UI over the video) */
BTFW.define("feature:poll-overlay", [], async () => {
  "use strict";

  const CSS_ID = "btfw-poll-overlay-css";
  const LS_KEY = "btfw:poll-overlay:preferred";
  const ROOT_FLOAT_CLASS = "btfw-poll-overlay-active";
  const OVERLAY_ID = "btfw-poll-overlay";
  const HISTORY_ID = "btfw-poll-history";
  const HISTORY_LIST_CLASS = "btfw-poll-history__list";

  const ACTIVE_SELECTORS = [
    "button[data-option]",
    "input[type=radio][name^=poll]",
    "input[type=checkbox][name^=poll]",
    ".poll-option",
    ".poll-options li",
    ".poll-answers li",
    ".poll-results",
    ".poll-chart"
  ];

  const POLL_CARD_SELECTORS = [
    ".well.active",
    ".poll-active",
    ".poll-current",
    ".poll-card",
    ".pollbox.active",
    ".poll",
    ".poll-panel"
  ];

  const INACTIVE_TEXT = /there is no active poll|there are no active polls|no current poll|no poll active|no polls? running|no poll running|no poll open|poll closed|the poll has closed/i;

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
  let pollObserver = null;
  let videoMountObserver = null;
  let overlayPreferred = readPreference();
  let pollActive = false;
  let stackHost = null;
  let historySection = null;
  let historyList = null;
  let clearHistoryButton = null;
  let currentPollSignature = null;
  let lastArchivedSignature = null;
  let socketWired = false;
  let activePollCard = null;
  let pollCardOriginalParent = null;
  let pollCardOriginalNextSibling = null;


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

      .btfw-poll-overlay__panel {
        margin: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        width: 100%;
      }

      .btfw-poll-overlay__panel .poll-menu {
        background: transparent;
        border: 0;
        box-shadow: none;
      }

      .btfw-poll-overlay__panel .poll-menu .btn {
        margin-left: 0;
      }

      #${HISTORY_ID} {
        margin-top: 16px;
        padding: 16px;
        border-radius: 16px;
        background: color-mix(in srgb, var(--btfw-color-panel, #202333) 88%, transparent 12%);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 32%, transparent 68%);
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      #${HISTORY_ID}[hidden] {
        display: none;
      }

      #${HISTORY_ID} .btfw-poll-history__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      #${HISTORY_ID} .btfw-poll-history__title {
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      #${HISTORY_ID} .btfw-poll-history__clear {
        border: 0;
        border-radius: 999px;
        background: color-mix(in srgb, var(--btfw-color-surface, #1c1f2a) 82%, transparent 18%);
        color: var(--btfw-color-text, #f1f2fb);
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 6px 12px;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease;
      }

      #${HISTORY_ID} .btfw-poll-history__clear:hover {
        background: color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 36%, transparent 64%);
        transform: translateY(-1px);
      }

      #${HISTORY_ID} .${HISTORY_LIST_CLASS} {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      #${HISTORY_ID} .btfw-poll-history__entry {
        background: color-mix(in srgb, var(--btfw-color-surface, #1c1f2a) 86%, transparent 14%);
        border: 1px solid color-mix(in srgb, var(--btfw-color-border, rgba(109, 77, 246, 0.6)) 40%, transparent 60%);
        border-radius: 14px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      #${HISTORY_ID} .btfw-poll-history__entry-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      #${HISTORY_ID} .btfw-poll-history__entry-title {
        font-size: 0.95rem;
        font-weight: 600;
      }

      #${HISTORY_ID} .btfw-poll-history__entry-meta {
        font-size: 0.78rem;
        opacity: 0.7;
      }

      #${HISTORY_ID} .btfw-poll-history__options {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      #${HISTORY_ID} .btfw-poll-history__option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--btfw-color-panel, #202333) 82%, transparent 18%);
      }

      #${HISTORY_ID} .btfw-poll-history__option-label {
        flex: 1;
      }

      #${HISTORY_ID} .btfw-poll-history__option-count {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }

      #${HISTORY_ID} .btfw-poll-history__option--winner {
        background: color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 28%, transparent 72%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 46%, transparent 54%);
      }

      #${HISTORY_ID} .btfw-poll-history__option--winner .btfw-poll-history__option-label {
        font-weight: 600;
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

  function ensureStackHosts() {
    const stackBody = document.querySelector(`#btfw-stack .btfw-stack-item[data-bind="poll-group"] .btfw-stack-item__body`);
    if (stackBody) {
      stackHost = stackBody;
      if (!historySection) {
        historySection = document.createElement("section");
        historySection.id = HISTORY_ID;
        historySection.className = "btfw-poll-history";
        historySection.setAttribute("hidden", "hidden");
        historySection.setAttribute("aria-hidden", "true");
        historySection.innerHTML = `
          <header class="btfw-poll-history__header">
            <span class="btfw-poll-history__title">Poll history</span>
            <button type="button" class="btfw-poll-history__clear">Clear</button>
          </header>
          <div class="${HISTORY_LIST_CLASS}" role="list"></div>
        `;
        historyList = historySection.querySelector(`.${HISTORY_LIST_CLASS}`);
        clearHistoryButton = historySection.querySelector(".btfw-poll-history__clear");
        if (clearHistoryButton && !clearHistoryButton._btfwBound) {
          clearHistoryButton.addEventListener("click", () => {
            clearHistoryEntries();
            clearHistoryButton.blur();
          });
          clearHistoryButton._btfwBound = true;
        }
      } else {
        historyList = historySection.querySelector(`.${HISTORY_LIST_CLASS}`);
        clearHistoryButton = historySection.querySelector(".btfw-poll-history__clear");
        if (clearHistoryButton && !clearHistoryButton._btfwBound) {
          clearHistoryButton.addEventListener("click", () => {
            clearHistoryEntries();
            clearHistoryButton.blur();
          });
          clearHistoryButton._btfwBound = true;
        }
      }

      if (historySection.parentElement !== stackBody) {
        stackBody.appendChild(historySection);
      }
      syncHistoryVisibility();
    } else {
      stackHost = null;
    }
    return stackHost;
  }

  function syncHistoryVisibility() {
    if (!historySection) return;
    const hasItems = !!(historyList && historyList.children.length);
    if (hasItems) {
      historySection.removeAttribute("hidden");
      historySection.setAttribute("aria-hidden", "false");
    } else {
      historySection.setAttribute("hidden", "hidden");
      historySection.setAttribute("aria-hidden", "true");
    }
  }

  function clearHistoryEntries() {
    if (!historyList) return;
    while (historyList.firstChild) {
      historyList.removeChild(historyList.firstChild);
    }
    lastArchivedSignature = null;
    syncHistoryVisibility();
  }

  function appendHistoryEntry(entry, signature) {
    if (!entry) return;
    ensureStackHosts();
    if (!historyList) return;
    entry.classList.add("btfw-poll-history__entry");
    if (signature) {
      entry.dataset.signature = signature;
    }
    historyList.insertBefore(entry, historyList.firstChild);
    syncHistoryVisibility();
  }

  function normalisePollOption(option, index, counts) {
    if (option == null) {
      return { text: `Option ${index + 1}`, count: typeof counts?.[index] === "number" ? counts[index] : 0 };
    }
    if (typeof option === "string" || typeof option === "number") {
      return {
        text: String(option),
        count: typeof counts?.[index] === "number" ? counts[index] : 0
      };
    }
    if (typeof option === "object") {
      const text = option.option || option.title || option.text || option.name || option.label || `Option ${index + 1}`;
      const count = typeof option.count === "number"
        ? option.count
        : typeof option.votes === "number"
          ? option.votes
          : typeof option.voteCount === "number"
            ? option.voteCount
            : typeof counts?.[index] === "number"
              ? counts[index]
              : 0;
      return { text: String(text), count };
    }
    return {
      text: `Option ${index + 1}`,
      count: typeof counts?.[index] === "number" ? counts[index] : 0
    };
  }

  function normalisePollData(raw) {
    if (!raw) return null;
    const poll = raw.poll ? normalisePollData(raw.poll) : raw;
    if (poll && poll !== raw && poll.signature) return poll;

    const title = poll && poll.title ? String(poll.title) : "Poll";
    const optionsSource = Array.isArray(poll?.options)
      ? poll.options
      : Array.isArray(poll?.opts)
        ? poll.opts
        : Array.isArray(poll?.answers)
          ? poll.answers
          : [];
    const counts = Array.isArray(poll?.counts)
      ? poll.counts
      : Array.isArray(poll?.votes)
        ? poll.votes
        : null;

    const options = optionsSource.map((opt, idx) => normalisePollOption(opt, idx, counts));
    const total = options.reduce((sum, opt) => sum + (typeof opt.count === "number" ? opt.count : 0), 0);

    const idValue = poll && (poll.id ?? poll.key ?? poll.uuid ?? poll.guid ?? poll.ts ?? poll.timestamp);
    const id = idValue != null ? String(idValue) : null;
    const signatureCore = `${title}::${options.map(opt => `${opt.text}|${opt.count ?? 0}`).join("::")}`;
    const signature = id ? `id:${id}` : `${signatureCore}::${Date.now()}`;

    return { title, options, total, signature, id, normalised: true };
  }

  function createHistoryEntryFromData(data) {
    if (!data) return null;
    const { title, options, total } = data;
    const entry = document.createElement("article");

    const header = document.createElement("header");
    header.className = "btfw-poll-history__entry-header";

    const titleEl = document.createElement("span");
    titleEl.className = "btfw-poll-history__entry-title";
    titleEl.textContent = title || "Poll";
    header.appendChild(titleEl);

    const meta = document.createElement("span");
    meta.className = "btfw-poll-history__entry-meta";
    meta.textContent = new Date().toLocaleString();
    header.appendChild(meta);

    entry.appendChild(header);

    if (Array.isArray(options) && options.length) {
      const list = document.createElement("ol");
      list.className = "btfw-poll-history__options";
      let bestCount = -Infinity;
      options.forEach(opt => {
        const count = typeof opt.count === "number" ? opt.count : 0;
        if (count > bestCount) bestCount = count;
      });

      options.forEach(opt => {
        const item = document.createElement("li");
        item.className = "btfw-poll-history__option";
        const count = typeof opt.count === "number" ? opt.count : 0;
        if (count === bestCount && bestCount > 0) {
          item.classList.add("btfw-poll-history__option--winner");
        }

        const label = document.createElement("span");
        label.className = "btfw-poll-history__option-label";
        label.textContent = opt.text || "Option";
        item.appendChild(label);

        const countEl = document.createElement("span");
        countEl.className = "btfw-poll-history__option-count";
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        countEl.textContent = `${count}${total > 0 ? ` (${pct}%)` : ""}`;
        item.appendChild(countEl);

        list.appendChild(item);
      });
      entry.appendChild(list);
    }

    return entry;
  }

  function extractDomPollData() {
    const card = resolveActivePollCard();
    const rootNode = card || pollWrap;
    if (!rootNode) return null;
    if (!card) {
      const hasActiveHint = ACTIVE_SELECTORS.some(sel => rootNode.matches(sel) || rootNode.querySelector(sel));
      if (!hasActiveHint) return null;
    }
    const titleEl = rootNode.querySelector(".poll-title, .poll-question, h3, legend, header strong");
    const title = titleEl && titleEl.textContent ? titleEl.textContent.trim() : "Poll";
    const optionNodes = rootNode.querySelectorAll(".poll-option, .poll-entry, .poll-row, .poll-answers li, .poll-options li, .option");
    const options = [];
    optionNodes.forEach(node => {
      if (!node || !node.textContent) return;
      const textEl = node.querySelector(".poll-option-label, label, .poll-answer, .poll-option-text");
      let countEl = node.querySelector(".poll-votes, .poll-option-count, .count, .votes, button");
      let text = textEl && textEl.textContent ? textEl.textContent.trim() : node.textContent.trim();
      if ((!textEl || !text) && node.matches(".option")) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("button, input").forEach(el => el.remove());
        const fallback = clone.textContent ? clone.textContent.trim() : "";
        if (fallback) {
          text = fallback;
        }
        if (!countEl) {
          countEl = node.querySelector("button, input");
        }
      }
      let count = 0;
      if (countEl && countEl.textContent) {
        const match = countEl.textContent.match(/(\d+)/);
        if (match) {
          count = parseInt(match[1], 10) || 0;
        }
      }
      options.push({ text, count });
    });
    if (!options.length) return { title, options: [], total: 0, signature: currentPollSignature || `${title}::${Date.now()}`, normalised: true };
    const total = options.reduce((sum, opt) => sum + (typeof opt.count === "number" ? opt.count : 0), 0);
    const signature = currentPollSignature || `${title}::${options.map(opt => `${opt.text}|${opt.count ?? 0}`).join("::")}::${Date.now()}`;
    return { title, options, total, signature, normalised: true };
  }

  function archivePollFromDom() {
    const data = extractDomPollData();
    if (!data) return;
    if (data.signature && data.signature === lastArchivedSignature) return;
    const entry = createHistoryEntryFromData(data);
    appendHistoryEntry(entry, data.signature);
    lastArchivedSignature = data.signature;
  }

  function archivePollData(raw) {
    const data = raw && raw.normalised ? raw : normalisePollData(raw);
    if (!data) return;
    if (data.signature && data.signature === lastArchivedSignature) return;
    if (data.signature) {
      currentPollSignature = data.signature;
    }
    const entry = createHistoryEntryFromData(data);
    appendHistoryEntry(entry, data.signature);
    lastArchivedSignature = data.signature;
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
      overlayClose.setAttribute("aria-label", "Hide poll overlay");
      overlayClose.innerHTML = "<span aria-hidden=\"true\">&times;</span>";
      overlayClose.addEventListener("click", () => setOverlayPreferred(false));
      overlayHost.appendChild(overlayClose);
    }
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
    return true;
  }

  function adoptPollToOverlay() {
    const card = resolveActivePollCard();
    if (!card) return;

    attachOverlayToVideo();
    ensureStackHosts();

    if (overlayInner && card.parentElement !== overlayInner) {
      overlayInner.appendChild(card);
    }

    card.classList.add("btfw-poll-overlay__panel");
    card.setAttribute("data-btfw-poll-overlay", "video");

    if (overlayHost) overlayHost.classList.add("btfw-visible");
    document.documentElement.classList.add(ROOT_FLOAT_CLASS);
  }

  function parkPollInStack() {
    const card = resolveActivePollCard();
    ensureStackHosts();

    const preferredParent = pollCardOriginalParent && pollCardOriginalParent.isConnected
      ? pollCardOriginalParent
      : pollWrap;

    if (card && preferredParent) {
      const anchor = pollCardOriginalNextSibling && pollCardOriginalNextSibling.parentElement === preferredParent
        ? pollCardOriginalNextSibling
        : null;
      if (card.parentElement !== preferredParent) {

        if (anchor) {
          preferredParent.insertBefore(card, anchor);
        } else {
          preferredParent.appendChild(card);
        }
      }
      card.classList.remove("btfw-poll-overlay__panel");
      card.setAttribute("data-btfw-poll-overlay", "stack");
    }

    if (overlayInner && overlayInner.firstChild && overlayInner.firstChild !== card) {
      overlayInner.removeChild(overlayInner.firstChild);
    }

    if (overlayHost) {
      overlayHost.classList.remove("btfw-visible");
    }

    document.documentElement.classList.remove(ROOT_FLOAT_CLASS);
  }

  function pollHasActiveContent() {
    const card = resolveActivePollCard();
    if (!card) return false;
    if (!card.isConnected) return false;
    const text = (card.textContent || "").trim();
    if (text && INACTIVE_TEXT.test(text)) return false;

    if (ACTIVE_SELECTORS.some(sel => card.matches(sel) || card.querySelector(sel))) return true;


    const domData = extractDomPollData();
    if (domData && Array.isArray(domData.options) && domData.options.length > 0) {
      return true;
    }

    return false;
  }

  function isValidPollCard(node) {
    if (!node || typeof node.querySelector !== "function") return false;
    if (node === overlayHost || node === overlayInner) return false;
    const text = (node.textContent || "").trim();
    if (!text || INACTIVE_TEXT.test(text)) return false;
    if (ACTIVE_SELECTORS.some(sel => node.matches(sel) || node.querySelector(sel))) return true;
    return !!node.querySelector(".option, .poll-option, button[data-option]");
  }

  function resolveActivePollCard() {
    if (activePollCard && activePollCard.isConnected && isValidPollCard(activePollCard)) {
      return activePollCard;
    }

    const searchRoots = [];
    if (overlayInner) searchRoots.push(overlayInner);
    if (pollWrap) searchRoots.push(pollWrap);

    for (const root of searchRoots) {
      if (!root) continue;
      for (const selector of POLL_CARD_SELECTORS) {
        const candidate = root.querySelector(selector);
        if (candidate && isValidPollCard(candidate)) {
          activePollCard = candidate;
          if (!pollCardOriginalParent && candidate.parentElement) {
            pollCardOriginalParent = candidate.parentElement;
            pollCardOriginalNextSibling = candidate.nextSibling;
          }
          return activePollCard;
        }
      }
    }

    activePollCard = null;
    pollCardOriginalParent = null;
    pollCardOriginalNextSibling = null;
    return null;

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

  function syncOverlay() {
    if (!pollWrap) return;

    ensureStackHosts();
    rememberOriginal();
    const wasActive = pollActive;
    const active = pollHasActiveContent();
    pollActive = active;

    if (pollActive) {
      const domData = extractDomPollData();
      if (domData && domData.signature) {
        currentPollSignature = domData.signature;
      }
    }

    const shouldFloat = overlayPreferred && pollActive;
    if (shouldFloat) {
      adoptPollToOverlay();
    } else {
      parkPollInStack();
    }

    if (!pollActive && wasActive) {
      archivePollFromDom();
      currentPollSignature = null;
    } else if (!pollActive && !wasActive) {
      const domData = extractDomPollData();
      if (domData && Array.isArray(domData.options) && domData.options.length) {
        currentPollSignature = domData.signature;
        archivePollData(domData);
        currentPollSignature = null;
      }
    }
  }

  function observePollChanges() {
    if (!pollWrap) return;
    if (pollObserver) pollObserver.disconnect();
    pollObserver = new MutationObserver(() => syncOverlay());
    pollObserver.observe(pollWrap, { childList: true, subtree: true, characterData: true });
  }

  function handlePollWrapFound(element) {
    pollWrap = element;
    rememberOriginal();
    ensureStackHosts();
    observePollChanges();
    raf(() => syncOverlay());
  }

  function waitForPollWrap() {
    const existing = document.getElementById("pollwrap");
    if (existing) {
      handlePollWrapFound(existing);
      return;
    }

    if (typeof MutationObserver === "undefined") return;

    const target = document.body || document.documentElement;
    if (!target) return;

    const observer = new MutationObserver(() => {
      const found = document.getElementById("pollwrap");
      if (!found) return;
      observer.disconnect();
      handlePollWrapFound(found);
    });

    observer.observe(target, { childList: true, subtree: true });
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
  }

  function handleSocketPollActive(data) {
    raf(() => {
      const info = normalisePollData(data);
      if (info) {
        currentPollSignature = info.signature;
      }
      pollActive = true;
      syncOverlay();
    });
  }

  function handleSocketPollClosed(data) {
    raf(() => {
      const info = normalisePollData(data);
      if (info) {
        currentPollSignature = info.signature;
        archivePollData(info);
      } else {
        archivePollData(data);
      }
      pollActive = false;
      syncOverlay();
    });
  }

  function wireSocket() {
    if (socketWired) return;
    waitForSocket().then(socket => {
      if (!socket || socketWired) return;
      socketWired = true;
      ["newPoll", "updatePoll", "setPoll", "openPoll"].forEach(evt => {
        socket.on(evt, handleSocketPollActive);
      });
      ["closePoll", "clearPoll", "deletePoll"].forEach(evt => {
        socket.on(evt, handleSocketPollClosed);
      });
    });
  }

  function init() {
    injectCSS();
    attachOverlayToVideo();
    ensureStackHosts();
    waitForPollWrap();
    wireSocket();
  }


  init();

  return {
    name: "feature:poll-overlay",
    show: () => setOverlayPreferred(true),
    hide: () => setOverlayPreferred(false),
    sync: () => syncOverlay()
  };
});
