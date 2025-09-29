BTFW.define("feature:videoOverlay", ["feature:ambient"], async () => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const CONTROL_SELECTORS = [
    "#mediarefresh",
    "#voteskip",
    "#fullscreenbtn"
  ];

  const LS = { localSubs: "btfw:video:localsubs" };
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
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.45) 0%,
          rgba(0, 0, 0, 0.35) 12%,
          rgba(0, 0, 0, 0.18) 32%,
          rgba(0, 0, 0, 0.08) 55%,
          transparent 75%
        );
      }

      #btfw-video-overlay.btfw-vo-visible {
        opacity: 1;
      }

      #btfw-video-overlay .btfw-vo-bar{
        position:absolute;
        top:12px;
        left:12px;
        right:12px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        pointer-events:none;
        gap:12px;
        background:transparent;
      }

      #btfw-video-overlay .btfw-vo-section{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        pointer-events:auto;
      }

      #btfw-video-overlay .btfw-vo-section--left{
        justify-content:flex-start;
      }

      #btfw-video-overlay .btfw-vo-section--right{
        margin-left:auto;
        justify-content:flex-end;
      }

      #btfw-video-overlay .btfw-vo-btn{
        display:inline-grid; place-items:center; min-width:44px; height:44px; padding:0;
        border:0; border-radius:22px; background:rgba(0, 0, 0, 0.4); color:#fff; cursor:pointer;
        font:14px/1 system-ui,Segoe UI,Arial;
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #btfw-video-overlay .btfw-vo-btn:hover{
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
      }

      #btfw-video-overlay .btfw-vo-btn:active {
        transform: translateY(0);
      }

      #btfw-video-overlay .btfw-vo-btn i {
        transition: transform 0.2s ease;
      }

      #btfw-video-overlay .btfw-vo-btn:hover i {
        transform: scale(1.1);
      }

      #btfw-video-overlay .btfw-vo-adopted{
        all: unset; display:inline-grid; place-items:center; min-width:44px; height:44px;
        padding:0; border-radius:22px; background:rgba(0, 0, 0, 0.4); color:#fff; cursor:pointer;
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 14px;
      }

      #btfw-video-overlay .btfw-vo-adopted:hover {
        background: rgba(109, 77, 246, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(109, 77, 246, 0.3);
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
          left: 8px;
          right: 8px;
          gap: 8px;
        }

        #btfw-video-overlay .btfw-vo-section{
          gap: 6px;
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

  const LEFT_ALIGN_IDS = new Set(["btfw-vo-cast", "btfw-vo-cast-fallback", "castbutton", "fallbackbutton"]);


  function getBarSections(bar) {
    if (!bar) return null;
    if (bar._btfwSections) return bar._btfwSections;

    let left = bar.querySelector(".btfw-vo-section--left");
    let right = bar.querySelector(".btfw-vo-section--right");

    if (!left) {
      left = document.createElement("div");
      left.className = "btfw-vo-section btfw-vo-section--left";
      left.dataset.align = "left";
      bar.appendChild(left);
    }

    if (!right) {
      right = document.createElement("div");
      right.className = "btfw-vo-section btfw-vo-section--right";
      right.dataset.align = "right";
      bar.appendChild(right);
    }

    const sections = { left, right };
    bar._btfwSections = sections;

    const initialChildren = Array.from(bar.children).filter(
      (child) => child !== left && child !== right
    );
    if (initialChildren.length) {
      initialChildren.forEach((child) => routeNodeToSection(bar, child));
    }

    if (!bar._btfwObserver) {
      const observer = new MutationObserver((mutations) => {
        if (bar._btfwRouting) return;
        for (let m = 0; m < mutations.length; m++) {
          const mutation = mutations[m];
          if (!mutation || !mutation.addedNodes) continue;
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            routeNodeToSection(bar, mutation.addedNodes[i]);
          }
        }

      });
      observer.observe(bar, { childList: true });
      bar._btfwObserver = observer;
    }

    return sections;
  }

  function determineAlignment(node) {
    if (!node || !(node instanceof HTMLElement)) return "right";
    const explicit = (node.dataset && node.dataset.btfwVoAlign) || node.getAttribute("data-btfw-vo-align");
    if (explicit && /^(left|right)$/i.test(explicit)) {
      return explicit.toLowerCase();
    }
    const id = (node.id || "").toLowerCase();
    return LEFT_ALIGN_IDS.has(id) ? "left" : "right";
  }

  function placeNodeInBar(bar, node, align = null, { prepend = false } = {}) {
    if (!bar || !node) return;
    const sections = getBarSections(bar);
    if (!sections) return;
    const targetAlign = (align || determineAlignment(node)) === "left" ? "left" : "right";
    const target = targetAlign === "left" ? sections.left : sections.right;
    bar._btfwRouting = true;
    try {
      if (prepend) {
        target.insertBefore(node, target.firstChild || null);
      } else {
        target.appendChild(node);
      }
      node.setAttribute("data-btfw-vo-align", targetAlign);
    } finally {
      bar._btfwRouting = false;
    }
  }

  function routeNodeToSection(bar, node) {
    if (!node || !(node instanceof HTMLElement)) return;
    if (node.classList && node.classList.contains("btfw-vo-section")) return;
    placeNodeInBar(bar, node);
  }

  function ensureOverlay() {
    const wrap = $("#videowrap");
    if (!wrap) return null;

    let overlay = $("#btfw-video-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "btfw-video-overlay";
    }
    if (overlay.parentElement !== wrap) wrap.appendChild(overlay);

    let bar = overlay.querySelector("#btfw-vo-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "btfw-vo-bar";
      bar.id = "btfw-vo-bar";
      overlay.appendChild(bar);
    }

    getBarSections(bar);

    setupHoverEffects(wrap, overlay);
    ensureLocalSubsButton(bar);
    ensureCustomButtons(bar);
    adoptNativeControls(bar);

    return overlay;
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

  function ensureCustomButtons(bar) {
    const customButtons = [];

    if (!document.querySelector("#fullscreenbtn")) {
      customButtons.push({ id: "btfw-fullscreen", icon: "fas fa-expand", tooltip: "Fullscreen", action: toggleFullscreen, align: "right" });
    }

    customButtons.push(
      { id: "btfw-ambient", icon: "fas fa-sun", tooltip: "Ambient Mode", action: toggleAmbient, align: "right" },
      { id: "btfw-airplay", icon: "fas fa-cast", tooltip: "AirPlay", action: enableAirplay, align: "right" }
    );

    customButtons.forEach((btnConfig) => {
      let btn = bar.querySelector(`#${btnConfig.id}`);
      if (!btn) {
        btn = document.createElement("button");
        btn.id = btnConfig.id;
        btn.className = "btfw-vo-btn";
        btn.innerHTML = `<i class="${btnConfig.icon}"></i>`;
        btn.title = btnConfig.tooltip;
        btn.addEventListener("click", btnConfig.action);
      }
      placeNodeInBar(bar, btn, btnConfig.align);
    });

    syncAmbientButton();
    updateAirplayButtonVisibility();
  }

  function adoptNativeControls(bar) {
    CONTROL_SELECTORS.forEach((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;

      if (el.dataset.btfwOverlay === "1") {
        placeNodeInBar(bar, el);
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
          });
        };
      }

      placeNodeInBar(bar, el);
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

  function handleMediaRefresh(triggerOriginal) {
    const now = Date.now();

    if (now < refreshCooldownUntil) {
      const remainingSeconds = Math.ceil((refreshCooldownUntil - now) / 1000);
      showNotification(`Refresh on cooldown for ${remainingSeconds}s`, "warning");
      return false;
    }

    refreshClickCount++;

    if (refreshClickCount >= 10) {
      refreshCooldownUntil = now + 30000;
      refreshClickCount = 0;
      showNotification("Refresh limit reached. 30s cooldown active.", "error");
      return false;
    }

    setTimeout(() => {
      if (refreshClickCount > 0) refreshClickCount--;
    }, 10000);

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

    showNotification(handled ? "Media refreshed" : "Unable to refresh media", handled ? "success" : "error");
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

  function ensureLocalSubsButton(bar) {
    let btn = bar.querySelector("#btfw-vo-subs");
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
    }
    placeNodeInBar(bar, btn, "right", { prepend: true });
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
