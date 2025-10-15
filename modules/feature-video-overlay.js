BTFW.define("feature:videoOverlay", ["feature:ambient"], async () => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const CONTROL_SELECTORS = [
    "#mediarefresh",
    "#voteskip",
    "#fullscreenbtn"
  ];

  const LS = { localSubs: "btfw:video:localsubs" };
  const DEFAULT_OWNER_RANK = 5; // Cytube owners default to rank 5 when CHANNEL perms are unavailable
  const PERMISSION_KEYS = {
    owner: ["chanowner", "owner", "founder", "admin", "administrator"]
  };

  function getClient() {
    try {
      return window.CLIENT || window.client || null;
    } catch (_) {
      return null;
    }
  }

  function getChannel() {
    try {
      return window.CHANNEL || window.channel || null;
    } catch (_) {
      return null;
    }
  }

  function getChannelPermissions() {
    const channel = getChannel();
    if (channel && typeof channel.perms === "object" && channel.perms) {
      return channel.perms;
    }
    try {
      return window.CHANNEL_PERMS || window.channelPermissions || {};
    } catch (_) {
      return {};
    }
  }

  function getPermissionThreshold(keys = []) {
    const perms = getChannelPermissions();
    for (const key of keys) {
      const value = perms?.[key];
      if (typeof value === "number") return value;
    }
    return undefined;
  }

  function getOwnerRankThreshold() {
    const ownerRank = getPermissionThreshold(PERMISSION_KEYS.owner);
    return typeof ownerRank === "number" ? ownerRank : DEFAULT_OWNER_RANK;
  }

  function hasOwnerPermission(client) {
    if (!client) return false;
    try {
      if (typeof client.hasPermission === "function" && client.hasPermission("chanowner")) {
        return true;
      }
    } catch (_) {}
    try {
      if (typeof window.hasPermission === "function" && window.hasPermission("chanowner")) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isChannelOwner() {
    const client = getClient();
    if (!client) return false;
    const rank = Number(client.rank);
    if (!Number.isFinite(rank)) return false;

    if (rank >= getOwnerRankThreshold()) return true;

    if (hasOwnerPermission(client)) return true;

    return false;
  }

  function shouldShowAmbientButton() {
    return isChannelOwner();
  }
  const localSubsEnabled = () => {
    try {
      return localStorage.getItem(LS.localSubs) !== "0";
    } catch (_) {
      return true;
    }
  };
  const setLocalSubs = (value) => {
    try {
      localStorage.setItem(LS.localSubs, value ? "1" : "0");
    } catch (_) {}
    document.dispatchEvent(
      new CustomEvent("btfw:video:localsubs:changed", { detail: { enabled: !!value } })
    );
  };

  let refreshClickCount = 0;
  let refreshCooldownUntil = 0;
  let lastRefreshTimestamp = 0;

  const USER_REFRESH_INTERVAL = 2000;
  const AUTO_REFRESH_BASE_INTERVAL = 8000;
  const AUTO_REFRESH_MAX_INTERVAL = 45000;
  const AUTO_IDLE_RESET_INTERVAL = 120000;

  let autoRefreshInterval = AUTO_REFRESH_BASE_INTERVAL;
  let ambientModulePromise = null;
  let airplayListenerAttached = false;
  let trackedAirplayVideo = null;

  function ensureCSS() {
    if ($("#btfw-vo-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-vo-css";
    st.textContent = `
      #btfw-video-overlay{
        position:absolute;
        inset:0;
        pointer-events:none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.15) 12%, rgba(0, 0, 0, 0) 32%, rgba(0, 0, 0, 0) 55%, transparent 75%);
      }

      #btfw-video-overlay.btfw-vo-visible {
        opacity: 1;
      }

      #btfw-video-overlay .btfw-vo-bar{
        position:absolute; right:12px; top:12px; left:12px; display:flex; gap:8px; pointer-events:auto;
        background:transparent;
      }

      #btfw-video-overlay .btfw-vo-section {
        display:flex;
        align-items:center;
        gap:8px;
        pointer-events:auto;
      }

      #btfw-video-overlay .btfw-vo-section--right {
        margin-left:auto;
      }

      #btfw-video-overlay .btfw-vo-btn,
      #btfw-video-overlay .btfw-vo-adopted{
        all: unset;
        box-sizing: border-box;
        display:inline-grid;
        place-items:center;
        min-width:44px;
        height:44px;
        padding:0;
        border-radius:22px;
        border:0;
        background:rgba(0, 0, 0, 0.42);
        color:#fff;
        cursor:pointer;
        font:600 14px/1.05 "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        letter-spacing: 0.01em;
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration:none;
      }

      #btfw-video-overlay .btfw-vo-btn i,
      #btfw-video-overlay .btfw-vo-adopted i {
        transition: transform 0.2s ease;
        font-size: 16px;
      }

      #btfw-video-overlay .btfw-vo-btn:hover,
      #btfw-video-overlay .btfw-vo-adopted:hover{
        background: rgba(109, 77, 246, 0.82);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.36);
      }

      #btfw-video-overlay .btfw-vo-btn:hover i,
      #btfw-video-overlay .btfw-vo-adopted:hover i {
        transform: scale(1.08);
      }

      #btfw-video-overlay .btfw-vo-btn:active,
      #btfw-video-overlay .btfw-vo-adopted:active {
        transform: translateY(0);
      }

      #btfw-video-overlay .btfw-vo-btn:focus-visible,
      #btfw-video-overlay .btfw-vo-adopted:focus-visible {
        outline: 2px solid rgba(109, 77, 246, 0.95);
        outline-offset: 2px;
      }

      #btfw-ambient.active {
        background: rgba(109, 77, 246, 0.8);
      }

      .btfw-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        max-width: 300px;
      }

      .btfw-notification--show {
        transform: translateX(0);
        opacity: 1;
      }

      .btfw-notification--success {
        background: rgba(34, 197, 94, 0.9);
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .btfw-notification--error {
        background: rgba(239, 68, 68, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .btfw-notification--warning {
        background: rgba(245, 158, 11, 0.9);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .btfw-notification--info {
        background: rgba(59, 130, 246, 0.9);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      #btfw-mini-toast{position:fixed;right:12px;bottom:12px;background:#111a;color:#fff;padding:8px 12px;border-radius:8px;font:12px/1.2 system-ui,Segoe UI,Arial;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s}

      @media (max-width: 768px) {
        #btfw-video-overlay .btfw-vo-bar {
          top: 8px;
          right: 8px;
          left: 8px;
          gap: 6px;
        }

        #btfw-video-overlay .btfw-vo-section {
          gap: 6px;
          flex-wrap: wrap;
        }

        #btfw-video-overlay .btfw-vo-btn,
        #btfw-video-overlay .btfw-vo-adopted {
          min-width: 40px;
          height: 40px;
          border-radius: 20px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function ensureOverlay() {
    const wrap = $("#videowrap");
    if (!wrap) return null;

    let overlay = $("#btfw-video-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "btfw-video-overlay";
    }
    overlay.classList.add("btfw-video-overlay");
    if (overlay.parentElement !== wrap) wrap.appendChild(overlay);

    let bar = overlay.querySelector("#btfw-vo-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "btfw-vo-bar";
      bar.id = "btfw-vo-bar";
      overlay.appendChild(bar);
    }

    const sections = ensureOverlaySections(overlay, bar);

    setupHoverEffects(wrap, overlay);
    ensureLocalSubsButton(sections.left);
    ensureCustomButtons(sections);
    adoptNativeControls(sections);
    restyleOverlayButtons(overlay);

    return overlay;
  }

  function restyleOverlayButtons(overlay) {
    if (!overlay) return;
    overlay
      .querySelectorAll("button")
      .forEach((btn) => {
        if (!btn.classList.contains("btfw-vo-btn")) {
          btn.classList.add("btfw-vo-btn");
        }
      });
  }

  function ensureOverlaySections(overlay, bar) {
    const leftId = "btfw-vo-left";
    const rightId = "btfw-vo-right";

    let left = bar.querySelector(`#${leftId}`);
    if (!left) {
      left = document.createElement("div");
      left.id = leftId;
      left.className = "btfw-vo-section btfw-vo-section--left";
      bar.insertBefore(left, bar.firstChild);
    }

    let right = bar.querySelector(`#${rightId}`);
    if (!right) {
      right = document.createElement("div");
      right.id = rightId;
      right.className = "btfw-vo-section btfw-vo-section--right";
      bar.appendChild(right);
    }

    Array.from(bar.children).forEach((child) => {
      if (child === left || child === right) return;
      right.appendChild(child);
    });

    overlay.dataset.leftSection = `#${leftId}`;
    overlay.dataset.rightSection = `#${rightId}`;
    bar.dataset.leftSection = `#${leftId}`;
    bar.dataset.rightSection = `#${rightId}`;

    return { left, right };
  }

  function ensureAmbientModule() {
    if (ambientModulePromise) return ambientModulePromise;
    if (!window.BTFW || typeof BTFW.init !== "function") {
      return Promise.reject(new Error("Ambient module unavailable"));
    }
    ambientModulePromise = BTFW.init("feature:ambient").catch((err) => {
      ambientModulePromise = null;
      throw err;
    });
    return ambientModulePromise;
  }

  function updateAmbientButton(active) {
    const btn = $("#btfw-ambient");
    if (!btn) return;
    btn.classList.toggle("active", !!active);
  }

  function syncAmbientButton() {
    const btn = $("#btfw-ambient");
    if (!btn) return;
    ensureAmbientModule()
      .then((ambient) => {
        updateAmbientButton(ambient.isActive());
      })
      .catch(() => {});
  }

  document.addEventListener("btfw:ambient:state", (event) => {
    updateAmbientButton(event?.detail?.active);
  });

  function getAirplayCandidate() {
    return document.querySelector("#ytapiplayer video, video");
  }

  function hasAirplaySupport(video = getAirplayCandidate()) {
    if (!video) return false;
    return (
      typeof window.WebKitPlaybackTargetAvailabilityEvent !== "undefined" ||
      typeof video.webkitShowPlaybackTargetPicker === "function"
    );
  }

  function unbindAirplayAvailability() {
    if (!trackedAirplayVideo) return;
    const handler = trackedAirplayVideo._btfwAirplayHandler;
    if (handler) {
      try {
        trackedAirplayVideo.removeEventListener("webkitplaybacktargetavailabilitychanged", handler);
      } catch (_) {}
      delete trackedAirplayVideo._btfwAirplayHandler;
    }
    trackedAirplayVideo = null;
  }

  function bindAirplayAvailability(video) {
    if (!video || typeof video.addEventListener !== "function") {
      unbindAirplayAvailability();
      return;
    }
    if (trackedAirplayVideo === video) return;

    unbindAirplayAvailability();

    const handler = (event) => {
      const available = !event || event.availability === "available";
      const btn = $("#btfw-airplay");
      if (!btn) return;
      btn.style.display = available ? "" : "none";
    };

    try {
      video.addEventListener("webkitplaybacktargetavailabilitychanged", handler);
      video._btfwAirplayHandler = handler;
      trackedAirplayVideo = video;
    } catch (_) {}
  }

  function updateAirplayButtonVisibility() {
    const btn = $("#btfw-airplay");
    if (!btn) return;
    const video = getAirplayCandidate();
    const supported = hasAirplaySupport(video);
    if (!supported) {
      btn.style.display = "none";
      unbindAirplayAvailability();
      return;
    }
    btn.style.display = "";
    bindAirplayAvailability(video);
  }

  function setupHoverEffects(videowrap, overlay) {
    if (overlay._hoverSetup) return;
    overlay._hoverSetup = true;

    let hideTimer = null;

    function showOverlay() {
      clearTimeout(hideTimer);
      overlay.classList.add("btfw-vo-visible");
      overlay.style.pointerEvents = "none";
    }

    function hideOverlay() {
      overlay.classList.remove("btfw-vo-visible");
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideOverlay, 3000);
    }

    videowrap.addEventListener("mouseenter", showOverlay);
    videowrap.addEventListener("mousemove", () => {
      showOverlay();
      scheduleHide();
    });

    videowrap.addEventListener("mouseleave", hideOverlay);

    overlay.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      showOverlay();
    });

    overlay.addEventListener("mouseleave", scheduleHide);
  }

  function ensureCustomButtons(sections) {
    if (!sections?.right || !sections?.left) return;
    const customButtons = [];

    if (!document.querySelector("#fullscreenbtn")) {
      customButtons.push({ id: "btfw-fullscreen", icon: "fas fa-expand", tooltip: "Fullscreen", action: toggleFullscreen, section: "right" });
    }

    if (shouldShowAmbientButton()) {
      customButtons.push({
        id: "btfw-ambient",
        icon: "fas fa-sun",
        tooltip: "Ambient Mode",
        action: toggleAmbient,
        section: "left"
      });
    } else {
      const ambientButton = document.querySelector("#btfw-ambient");
      if (ambientButton?.parentElement) {
        ambientButton.parentElement.removeChild(ambientButton);
      }
    }

    customButtons.push({
      id: "btfw-airplay",
      icon: "fas fa-cast",
      tooltip: "AirPlay",
      action: enableAirplay,
      section: "right"
    });

    customButtons.forEach((btnConfig) => {
      let btn = document.querySelector(`#${btnConfig.id}`);
      const target = btnConfig.section === "left" ? sections.left : sections.right;
      if (!btn) {
        btn = document.createElement("button");
        btn.id = btnConfig.id;
        btn.className = "btfw-vo-btn";
        btn.innerHTML = `<i class="${btnConfig.icon}"></i>`;
        btn.title = btnConfig.tooltip;
        btn.addEventListener("click", btnConfig.action);
        (target || sections.right).appendChild(btn);
      } else if (target && btn.parentElement !== target) {
        target.appendChild(btn);
      }
    });

    syncAmbientButton();
    updateAirplayButtonVisibility();
  }

  function adoptNativeControls(sections) {
    const targetSection = sections?.right;
    if (!targetSection) return;
    CONTROL_SELECTORS.forEach((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;

      if (el.dataset.btfwOverlay === "1") {
        if (el.parentElement !== targetSection) targetSection.appendChild(el);
        return;
      }

      const placeholder = document.createElement("span");
      placeholder.hidden = true;
      placeholder.setAttribute("data-btfw-ph", selector);
      try {
        el.insertAdjacentElement("afterend", placeholder);
      } catch (_) {}

      el.classList.add("btfw-vo-adopted");
      el.dataset.btfwOverlay = "1";

      if (el.id === "mediarefresh") {
        const original = el.onclick;
        el.onclick = (event) => {
          event.preventDefault();
          const isUserAction = !!(event && event.isTrusted);
          handleMediaRefresh(() => {
            if (typeof original === "function") {
              try {
                original.call(el, event);
                return true;
              } catch (err) {
                console.warn("[video-overlay] native refresh handler failed:", err);
              }
            }
            return false;
          }, { isUserAction });
        };
      }

      targetSection.appendChild(el);
    });
  }

  function emitNativeRefresh() {
    try {
      if (window.socket) {
        socket.emit("playerReady");
        return true;
      }
    } catch (e) {
      console.warn("[video-overlay] Media refresh failed:", e);
    }
    return false;
  }

  function handleMediaRefresh(triggerOriginal, options = {}) {
    const { isUserAction = false } = options;
    const now = Date.now();

    if (lastRefreshTimestamp && now - lastRefreshTimestamp > AUTO_IDLE_RESET_INTERVAL) {
      autoRefreshInterval = AUTO_REFRESH_BASE_INTERVAL;
      refreshClickCount = 0;
    }

    if (now < refreshCooldownUntil) {
      const remainingSeconds = Math.ceil((refreshCooldownUntil - now) / 1000);
      showNotification(
        isUserAction
          ? `Refresh available in ${remainingSeconds}s`
          : `Auto refresh paused. Next attempt in ${remainingSeconds}s`,
        "warning"
      );
      return false;
    }

    const minInterval = isUserAction ? USER_REFRESH_INTERVAL : autoRefreshInterval;
    if (lastRefreshTimestamp && now - lastRefreshTimestamp < minInterval) {
      const waitMs = minInterval - (now - lastRefreshTimestamp);
      const waitSeconds = Math.ceil(waitMs / 1000);
      refreshCooldownUntil = now + waitMs;
      showNotification(
        isUserAction
          ? `Refresh available in ${waitSeconds}s`
          : `Auto refresh paused. Next attempt in ${waitSeconds}s`,
        "warning"
      );
      return false;
    }

    refreshClickCount++;

    if (refreshClickCount >= 10) {
      refreshCooldownUntil = now + 30000;
      refreshClickCount = 0;
      showNotification("Refresh limit reached. 30s cooldown active.", "error");
      return false;
    }

    const decayMs = isUserAction
      ? 6000
      : Math.max(12000, autoRefreshInterval + 2000);
    setTimeout(() => {
      if (refreshClickCount > 0) refreshClickCount--;
    }, decayMs);

    let handled = false;
    if (typeof triggerOriginal === "function") {
      try {
        handled = triggerOriginal() === true;
      } catch (err) {
        console.warn("[video-overlay] Refresh handler error:", err);
      }
    }

    if (!handled) {
      handled = emitNativeRefresh();
    }

    lastRefreshTimestamp = Date.now();

    if (isUserAction) {
      autoRefreshInterval = AUTO_REFRESH_BASE_INTERVAL;
    } else {
      const multiplier = handled ? 1.25 : 1.5;
      autoRefreshInterval = Math.min(
        AUTO_REFRESH_MAX_INTERVAL,
        Math.max(AUTO_REFRESH_BASE_INTERVAL, Math.round(autoRefreshInterval * multiplier))
      );
    }

    const nextWindow = isUserAction ? USER_REFRESH_INTERVAL : autoRefreshInterval;
    refreshCooldownUntil = Math.max(refreshCooldownUntil, lastRefreshTimestamp + nextWindow);

    if (!isUserAction && handled) {
      showNotification(
        `Auto refresh sent. Next attempt in ${Math.ceil(autoRefreshInterval / 1000)}s`,
        "info"
      );
    } else {
      showNotification(
        handled ? "Media refreshed" : "Unable to refresh media",
        handled ? "success" : "error"
      );
    }

    return handled;
  }

  function toggleFullscreen() {
    const videowrap = $("#videowrap");
    if (!videowrap) return;

    if (!document.fullscreenElement) {
      if (videowrap.requestFullscreen) {
        videowrap.requestFullscreen();
      } else if (videowrap.webkitRequestFullscreen) {
        videowrap.webkitRequestFullscreen();
      } else if (videowrap.mozRequestFullScreen) {
        videowrap.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  }

  async function toggleAmbient() {
    try {
      const ambient = await ensureAmbientModule();
      const enabling = !ambient.isActive();
      const active = await ambient.toggle();

      if (active) {
        try {
          ambient.refresh();
        } catch (_) {}
      }

      updateAmbientButton(active);

      if (active) {
        showNotification("Ambient mode enabled", "info");
      } else if (enabling) {
        showNotification("Unable to enable ambient mode", "error");
      } else {
        showNotification("Ambient mode disabled", "info");
      }
    } catch (e) {
      console.warn("[video-overlay] Ambient toggle failed:", e);
      showNotification("Failed to toggle ambient mode", "error");
    }
  }

  function applyAirplayAttributes(video, showPicker = true) {
    if (!video || !hasAirplaySupport(video)) return false;
    video.setAttribute("airplay", "allow");
    video.setAttribute("x-webkit-airplay", "allow");
    if (showPicker && typeof video.webkitShowPlaybackTargetPicker === "function") {
      try {
        video.webkitShowPlaybackTargetPicker();
      } catch (err) {
        console.warn("[video-overlay] AirPlay picker failed:", err);
      }
    }
    updateAirplayButtonVisibility();
    return true;
  }

  function attachAirplayListener() {
    if (airplayListenerAttached || !window.socket) return;
    airplayListenerAttached = true;
    try {
      socket.on("changeMedia", () => {
        setTimeout(() => {
          const video = getAirplayCandidate();
          if (video) {
            applyAirplayAttributes(video, false);
            bindAirplayAvailability(video);
          }
          updateAirplayButtonVisibility();
        }, 1000);
      });
    } catch (err) {
      console.warn("[video-overlay] Failed to attach AirPlay listener:", err);
    }
  }

  function enableAirplay() {
    const video = getAirplayCandidate();
    if (!hasAirplaySupport(video)) {
      updateAirplayButtonVisibility();
      showNotification("AirPlay not available", "warning");
      return false;
    }
    if (applyAirplayAttributes(video)) {
      showNotification("AirPlay enabled", "success");
      attachAirplayListener();
      return true;
    }
    showNotification("AirPlay not available", "warning");
    return false;
  }

  function showNotification(message, type = "info") {
    let notification = document.getElementById("btfw-notification");

    if (!notification) {
      notification = document.createElement("div");
      notification.id = "btfw-notification";
      notification.className = "btfw-notification";
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `btfw-notification btfw-notification--${type} btfw-notification--show`;

    clearTimeout(notification._hideTimer);
    notification._hideTimer = setTimeout(() => {
      notification.classList.remove("btfw-notification--show");
    }, 3000);
  }

  function getHTML5Video() {
    return $("video");
  }

  function srtToVtt(text) {
    let s = (text || "").replace(/\r\n/g, "\n").trim() + "\n";
    s = s.replace(/^\d+\s*$\n/gm, "");
    s = s.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g, "$1 --> $2");
    return "WEBVTT\n\n" + s;
  }

  async function pickLocalSubs() {
    const video = getHTML5Video();
    if (!video) {
      toast("Local subs only for HTML5 sources.");
      return;
    }

    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".vtt,.srt,text/vtt,text/plain";
    inp.style.display = "none";
    document.body.appendChild(inp);

    const done = new Promise((resolve) => {
      inp.addEventListener(
        "change",
        async () => {
          const f = inp.files && inp.files[0];
          document.body.removeChild(inp);
          if (!f) return resolve(false);
          try {
            const txt = await f.text();
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            const vtt = ext === "srt" ? srtToVtt(txt) : txt.startsWith("WEBVTT") ? txt : "WEBVTT\n\n" + txt;
            const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
            attachTrack(video, url, f.name.replace(/\.[^.]+$/, "") || "Local");
            toast("Subtitles loaded.");
            resolve(true);
          } catch (e) {
            console.error(e);
            toast("Failed to load subtitles.");
            resolve(false);
          }
        },
        { once: true }
      );
    });

    inp.click();
    await done;
  }

  function attachTrack(video, url, label) {
    $("track[data-btfw=\"1\"]", video)?.remove();
    const tr = document.createElement("track");
    tr.kind = "subtitles";
    tr.label = label || "Local";
    tr.srclang = "en";
    tr.src = url;
    tr.default = true;
    tr.setAttribute("data-btfw", "1");
    video.appendChild(tr);
    try {
      for (const t of video.textTracks) t.mode = t.label === tr.label ? "showing" : "disabled";
    } catch (_) {}
  }

  function toast(msg) {
    let t = $("#btfw-mini-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "btfw-mini-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._hid);
    t._hid = setTimeout(() => (t.style.opacity = "0"), 1400);
  }

  function ensureLocalSubsButton(section) {
    if (!section) return;
    let btn = document.querySelector("#btfw-vo-subs");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btfw-vo-subs";
      btn.className = "btfw-vo-btn";
      btn.title = "Load local subtitles (.vtt/.srt)";
      btn.innerHTML = `<i class="fa fa-closed-captioning"></i>`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        pickLocalSubs();
      });
      section.insertBefore(btn, section.firstChild || null);
    }
    btn.style.display = localSubsEnabled() ? "" : "none";
  }

  function boot() {
    ensureCSS();
    ensureOverlay();

    const targets = [
      $("#videowrap"),
      $("#rightcontrols"),
      $("#leftcontrols"),
      document.body
    ].filter(Boolean);
    const mo = new MutationObserver(() => ensureOverlay());
    targets.forEach((target) => mo.observe(target, { childList: true, subtree: true }));

    document.addEventListener("btfw:video:localsubs:changed", () => ensureOverlay());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name: "feature:videoOverlay",
    setLocalSubsEnabled: setLocalSubs,
    toggleFullscreen,
    toggleAmbient,
    enableAirplay
  };
});
