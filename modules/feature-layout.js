BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  const SPLIT_KEY = "btfw:grid:leftPx";
  const CHAT_SIDE_KEY = "btfw:layout:chatSide";
  const NAV_HOST_ID = "btfw-navhost";
  const VIDEO_MIN_PX = 520;
  const DEFAULT_VIDEO_TARGET = 680;
  const CHAT_MIN_PX = 360;
  const WIDTH_BUFFER = 20;
  const MOBILE_THRESHOLD_MIN = 900;
  const MOBILE_THRESHOLD_MAX = 940;

  let videoColumnPx = null;
  let chatSidePref = "right";
  let isVertical = false;
  let mobileToggleEl = null;
  let layoutReadyDispatched = false;

  function refreshVideoSizing(){
    const wrap = document.getElementById("videowrap");
    if (!wrap) return;

    wrap.querySelectorAll("iframe, video").forEach(el => {
      el.style.removeProperty("height");
      el.style.removeProperty("width");
      el.style.removeProperty("maxHeight");
    });

    const vjs = wrap.querySelector(".video-js");
    if (vjs) {
      const player = vjs.player || vjs.player_ || (window.videojs && (window.videojs.players?.[vjs.id] || window.videojs(vjs.id)));
      if (player) {
        try {
          if (typeof player.trigger === "function") player.trigger("componentresize");
          if (player.tech_ && typeof player.tech_.trigger === "function") player.tech_.trigger("resize");
          if (typeof player.resize === "function") player.resize();
        } catch (_) {}
      }
    }
  }

  function getStoredChatSide(){
    try {
      const stored = localStorage.getItem(CHAT_SIDE_KEY);
      return stored === "left" ? "left" : "right";
    } catch (_) {
      return "right";
    }
  }

  function loadVideoColumnWidth(){
    try {
      const saved = parseInt(localStorage.getItem(SPLIT_KEY) || "", 10);
      if (!isNaN(saved) && saved >= VIDEO_MIN_PX) {
        videoColumnPx = saved;
      }
    } catch (_) {
      videoColumnPx = null;
    }
  }

  function applyColumnTemplate(){
    const grid = document.getElementById("btfw-grid");
    if (!grid) return;

    if (isVertical) {
      grid.style.gridTemplateColumns = "";
      grid.classList.remove("btfw-grid--chat-left", "btfw-grid--chat-right");
      return;
    }

    const stored = videoColumnPx ? Math.max(videoColumnPx, VIDEO_MIN_PX) : null;
    // Starter split for users who haven't dragged the splitter: video-dominant
    // 80/20 on wide screens. The chat minmax floor (320px) means narrower
    // screens automatically hand chat more than 20% so it stays readable, and
    // below the mobile threshold the layout switches to vertical entirely.
    const fallbackVideo = `minmax(${VIDEO_MIN_PX}px, 8fr)`;
    const fallbackChat = "minmax(var(--btfw-chat-min, 320px), 2fr)";
    const videoSegment = stored
      ? `minmax(${VIDEO_MIN_PX}px, ${stored}px)`
      : fallbackVideo;
    const chatSegment = stored
      ? "minmax(var(--btfw-chat-min, 320px), 1fr)"
      : fallbackChat;
    const template = chatSidePref === "left"
      ? `${chatSegment} var(--btfw-split-width, 8px) ${videoSegment}`
      : `${videoSegment} var(--btfw-split-width, 8px) ${chatSegment}`;

    grid.style.gridTemplateColumns = template;
    grid.classList.toggle("btfw-grid--chat-left", chatSidePref === "left");
    grid.classList.toggle("btfw-grid--chat-right", chatSidePref !== "left");
  }

  function setVideoColumnWidth(px){
    if (!Number.isFinite(px)) return;
    const width = Math.max(px, VIDEO_MIN_PX);
    videoColumnPx = width;
    try { localStorage.setItem(SPLIT_KEY, String(width)); } catch (_) {}
    applyColumnTemplate();
  }

  function computeThreshold(){
    const stored = Math.max(videoColumnPx || DEFAULT_VIDEO_TARGET, VIDEO_MIN_PX);
    const comfortable = stored + CHAT_MIN_PX + WIDTH_BUFFER;
    return Math.min(
      Math.max(comfortable, MOBILE_THRESHOLD_MIN),
      MOBILE_THRESHOLD_MAX
    );
  }

  function placeStackInLayout(){
    const stack = document.getElementById("btfw-stack");
    if (!stack) return;

    if (isVertical) {
      stack.classList.add("btfw-stack--in-chat");
      const chatcol = document.getElementById("btfw-chatcol");
      if (!chatcol) return;
      const chatwrap = document.getElementById("chatwrap");
      if (chatwrap && chatwrap.parentElement === chatcol) {
        if (chatwrap.nextSibling !== stack) {
          chatcol.insertBefore(stack, chatwrap.nextSibling);
        }
      } else if (stack.parentElement !== chatcol) {
        chatcol.appendChild(stack);
      }
    } else {
      stack.classList.remove("btfw-stack--in-chat");
      const left = document.getElementById("btfw-leftpad");
      if (!left) return;
      const video = document.getElementById("videowrap");
      if (video && video.parentElement === left) {
        if (video.nextSibling !== stack) {
          if (video.nextSibling) left.insertBefore(stack, video.nextSibling);
          else left.appendChild(stack);
        }
      } else if (stack.parentElement !== left) {
        left.appendChild(stack);
      }
    }
  }

  function wireMobileToggle(){
    const toggle = document.getElementById("btfw-mobile-modules-toggle");
    if (!toggle) return;
    if (toggle === mobileToggleEl && toggle._btfwNavWired) return;

    if (mobileToggleEl && mobileToggleEl._btfwNavStateHandler) {
      document.removeEventListener("btfw:navbar:mobileState", mobileToggleEl._btfwNavStateHandler);
    }

    mobileToggleEl = toggle;
    toggle._btfwNavWired = true;
    toggle.setAttribute("aria-haspopup", "menu");

    const applyState = (open, mobile) => {
      const navHost = document.getElementById("btfw-navhost");
      const isMobile = mobile ?? (navHost ? navHost.classList.contains("btfw-navhost--mobile") : false);
      const isOpen = !!open && isMobile;
      toggle.setAttribute("aria-expanded", isMobile && isOpen ? "true" : "false");
      const label = isMobile
        ? (isOpen ? "Close navigation menu" : "Open navigation menu")
        : "Open navigation menu";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
      toggle.classList.toggle("btfw-mobile-modules-toggle--active", isMobile && isOpen);
    };

    const handleState = (ev) => {
      applyState(ev?.detail?.open, ev?.detail?.mobile);
    };
    document.addEventListener("btfw:navbar:mobileState", handleState);
    toggle._btfwNavStateHandler = handleState;

    toggle.addEventListener("click", (ev) => {
      ev.preventDefault();
      const toggleFn = document._btfw_nav_toggleMobile;
      const setFn = document._btfw_nav_setMobileOpen;
      if (typeof toggleFn === "function") {
        toggleFn();
      } else if (typeof setFn === "function") {
        const next = !(typeof document._btfw_nav_isMobileOpen === "function" && document._btfw_nav_isMobileOpen());
        setFn(next);
      }
    });

    const initialOpen = typeof document._btfw_nav_isMobileOpen === "function"
      ? document._btfw_nav_isMobileOpen()
      : false;
    const initialMobile = document.getElementById("btfw-navhost")?.classList.contains("btfw-navhost--mobile") || false;
    applyState(initialOpen, initialMobile);
  }

  function updateResponsiveLayout(){
    const grid = document.getElementById("btfw-grid");
    if (!grid) return;

    wireMobileToggle();

    const shouldVertical = window.innerWidth < computeThreshold();
    if (shouldVertical !== isVertical) {
      isVertical = shouldVertical;
      grid.classList.toggle("btfw-grid--vertical", shouldVertical);
      if (document.body) {
        document.body.classList.toggle("btfw-mobile-stack-enabled", shouldVertical);
      }
      placeStackInLayout();
      refreshVideoSizing();
      setTimeout(() => {
        refreshVideoSizing();
        try {
          window.dispatchEvent(new Event("resize"));
        } catch (_) {}
      }, 60);
      document.dispatchEvent(new CustomEvent("btfw:layout:orientation", { detail: { vertical: shouldVertical } }));
    } else {
      placeStackInLayout();
    }

    applyColumnTemplate();
    setTop();
    if (!shouldVertical) refreshVideoSizing();
    attachVideoFitListeners();
    fitVerticalChat();
  }

  function setTop(){
    const header = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    const h = header ? header.offsetHeight : 48;
    const newTop = h + "px";

    // Update CSS custom property
    document.documentElement.style.setProperty("--btfw-top", newTop);

    // Force layout recalculation for sticky elements
    const chatcol = document.getElementById("btfw-chatcol");
    if (chatcol) {
      if (isVertical) {
        chatcol.style.top = "0px";
        chatcol.style.height = "";
      } else {
        chatcol.style.top = `calc(${newTop} + var(--btfw-gap))`;
        chatcol.style.height = `calc(100vh - ${newTop} - var(--btfw-gap) * 2)`;
      }
    }
  }

  // NOTE: We deliberately do NOT force --btfw-video-aspect to the media's
  // intrinsic ratio. Video.js (and the YouTube iframe) size their player to a
  // fixed 16:9; if the #videowrap (overflow:hidden) is forced to a different
  // ratio than the player, the player overflows and its top/bottom — including
  // the control bar — get clipped. So the wrap stays at the CSS 16:9 default,
  // matching the player exactly. Non-16:9 source content letterboxes inside
  // the player the same way it does on every major platform; that's expected
  // and, crucially, never clips the controls.

  // The HTML5 <video> is the variable-height element above the chat; bind to
  // its load/play events so the chat re-fits once the player reaches its
  // final size (boot timing was latching onto a too-early measurement and
  // sticking at the 320px minimum). Re-attaches per media via the guard flag.
  function attachVideoFitListeners(){
    const wrap = document.getElementById("videowrap");
    const v = wrap ? wrap.querySelector("video") : null;
    if (v && !v._btfwFitBound) {
      v._btfwFitBound = true;
      ["loadedmetadata", "loadeddata", "playing", "resize"].forEach(ev =>
        v.addEventListener(ev, () => fitVerticalChat()));
    }
  }

  // In vertical (mobile) mode, stretch the chat so its bottom bar (composer +
  // emoji/GIF actions) reaches the viewport bottom. The module stack sits
  // below the chat inside #btfw-chatcol, so it remains reachable by scrolling.
  function fitVerticalChat(){
    const chatwrap = document.getElementById("chatwrap");
    if (!chatwrap) return;
    if (!isVertical) {
      chatwrap.style.removeProperty("height");
      return;
    }
    // Double rAF so we measure after layout/reflow has fully committed (a
    // single frame can still catch a mid-transition position on boot).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!isVertical) { chatwrap.style.removeProperty("height"); return; }
      const top = chatwrap.getBoundingClientRect().top;
      const avail = window.innerHeight - top - 8;
      chatwrap.style.height = Math.max(Math.round(avail), 320) + "px";
    }));
  }

  // Boot/transition settle timing is unpredictable (slow CSS, cached video,
  // desktop->vertical flip), and a single fit can latch onto a pre-settle
  // measurement and stick at the 320px minimum. Re-fit a handful of times
  // over ~2s so one lands after the layout is stable.
  function scheduleChatFitSettle(){
    [0, 200, 500, 1000, 1800].forEach(d => setTimeout(fitVerticalChat, d));
  }

  function makeResizable() {
    const grid = document.getElementById("btfw-grid");
    const splitter = document.getElementById("btfw-vsplit");
    if (!grid || !splitter) {
      console.warn("[BTFW] Resizer elements not found.");
      return;
    }
    if (splitter._btfwResizableBound) return;
    splitter._btfwResizableBound = true;

    let isResizing = false;

    splitter.addEventListener("mousedown", (e) => {
      if (isVertical) return;
      isResizing = true;
      e.preventDefault();
      // Add a class to the body to prevent text selection during drag
      document.body.classList.add("btfw-resizing");

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopResize);
    });

    function handleMouseMove(e) {
      if (!isResizing || isVertical) return;

      const gridRect = grid.getBoundingClientRect();
      const splitRect = splitter.getBoundingClientRect();
      const splitWidth = splitRect.width || parseFloat(getComputedStyle(splitter).width) || 6;

      let newVideoWidth;

      if (chatSidePref === "left") {
        const pointerX = e.clientX - gridRect.left;
        const chatWidth = Math.max(pointerX - splitWidth / 2, 0);
        const available = gridRect.width - chatWidth - splitWidth;
        if (available < VIDEO_MIN_PX || chatWidth < CHAT_MIN_PX) return;
        newVideoWidth = available;
      } else {
        newVideoWidth = e.clientX - gridRect.left;
        const chatWidthCandidate = gridRect.width - newVideoWidth - splitWidth;
        if (newVideoWidth < VIDEO_MIN_PX || chatWidthCandidate < CHAT_MIN_PX) return;
      }

      if (!Number.isFinite(newVideoWidth)) return;
      setVideoColumnWidth(newVideoWidth);
    }

    function stopResize() {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove("btfw-resizing");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResize);
      updateResponsiveLayout();
    }
  }

  const BOOT=/^(col(-(xs|sm|md|lg|xl))?-(\d+|auto)|row|container(-fluid)?|pull-(left|right)|offset-\d+)$/;
  function stripDeep(root){ 
    if(!root) return; 
    (root.classList||[]).forEach(c=>{ if(BOOT.test(c)) root.classList.remove(c); }); 
    root.querySelectorAll("[class]").forEach(el=>{ 
      Array.from(el.classList).forEach(c=>{ if(BOOT.test(c)) el.classList.remove(c); }); 
    }); 
  }

  function moveCurrent(){ 
    const vh = document.getElementById("videowrap-header"); 
    
    // If videowrap-header doesn't exist, that's okay - title might be created by CyTube later
    if (!vh) {
      console.log('[layout] No videowrap-header found');
      return;
    }
    
    const ct = vh.querySelector("#currenttitle"); 
    const top = document.querySelector("#chatwrap .btfw-chat-topbar"); 
    
    if (top) { 
      let slot = top.querySelector("#btfw-nowplaying-slot"); 
      if (!slot) { 
        slot = document.createElement("div"); 
        slot.id = "btfw-nowplaying-slot"; 
        slot.className = "btfw-chat-title"; 
        top.innerHTML = ""; 
        top.appendChild(slot);
      }
      
      // If currenttitle exists, move it
      if (ct) {
        slot.appendChild(ct);
        console.log('[layout] Moved #currenttitle to slot');
      } else {
        console.log('[layout] No #currenttitle found in videowrap-header');
      }
    }
    
    // Only remove videowrap-header - the title is either moved or wasn't there
    vh.remove(); 
  }

  function ensureShell(){
    const wrap=document.getElementById("wrap")||document.body; 
    const v=document.getElementById("videowrap"); 
    const c=document.getElementById("chatwrap"); 
    const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
    
    if(!document.getElementById("btfw-grid")){
      const grid=document.createElement("div");
      grid.id="btfw-grid";

      const left=document.createElement("div");
      left.id="btfw-leftpad";

      const right=document.createElement("aside");
      right.id="btfw-chatcol";

      if(v) left.appendChild(v);
      if(q) left.appendChild(q);
      if(c) right.appendChild(c);

      const split=document.createElement("div");
      split.id="btfw-vsplit";

      ensureNavHost(grid);

      grid.appendChild(left);
      grid.appendChild(split);
      grid.appendChild(right);

      // Insert grid but keep it hidden until properly sized
      grid.style.opacity = '0';
      wrap.prepend(grid);

    } else {
      const left=document.getElementById("btfw-leftpad");
      const right=document.getElementById("btfw-chatcol");
      const v=document.getElementById("videowrap");
      const c=document.getElementById("chatwrap");
      const q=document.getElementById("playlistrow")||document.getElementById("playlistwrap")||document.getElementById("queuecontainer");
      const grid=document.getElementById("btfw-grid");

      ensureNavHost(grid);

      if(v && !left.contains(v)) left.appendChild(v);
      if(q && !left.contains(q)) left.appendChild(q);
      if(c && !right.contains(c)) right.appendChild(c);
    }

    ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta","chatwrap","controlsrow","rightcontrols"].forEach(id=>stripDeep(document.getElementById(id)));
    moveCurrent();
    placeStackInLayout();
  }
  
  function finishLayout() {
    const grid = document.getElementById("btfw-grid");
    if (grid) {
      // Add loaded class and show grid
      grid.classList.add("btfw-loaded");
      grid.style.opacity = '1';
    }
    updateResponsiveLayout();
    if (!layoutReadyDispatched) {
      layoutReadyDispatched = true;
      document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
    }
  }

  function init() {
    ensureShell();
    loadVideoColumnWidth();
    chatSidePref = getStoredChatSide();
    applyColumnTemplate();
    setTop();
    updateResponsiveLayout();

    // Set up a more robust layout finalization
    const finalizeLayout = () => {
      setTop(); // Recalculate in case navbar mounted late
      makeResizable();
      finishLayout();
    };

    // Try multiple times to handle async loading
    setTimeout(finalizeLayout, 100);
    setTimeout(finalizeLayout, 300);
    setTimeout(finalizeLayout, 600);
    
    // Also listen for window load as final fallback
    if (document.readyState === 'complete') {
      finalizeLayout();
    } else {
      window.addEventListener('load', finalizeLayout);
    }

    // Watch for navbar height changes
    const navbar = document.querySelector(".navbar, #nav-collapsible, #navbar, .navbar-fixed-top");
    if (navbar) {
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(setTop, 0);
        setTimeout(updateResponsiveLayout, 0);
      });
      resizeObserver.observe(navbar);
    }

    // Refit the vertical chat whenever the video area's size settles or
    // changes (boot, media change, desktop<->mobile transition). Without this
    // the chat fill could latch onto an early, pre-settle measurement and get
    // stuck at the 320px minimum instead of filling the viewport.
    const vwatch = document.getElementById("videowrap");
    if (vwatch && typeof ResizeObserver !== "undefined") {
      const vo = new ResizeObserver(() => fitVerticalChat());
      vo.observe(vwatch);
    }

    // Watch for window resize
    window.addEventListener('resize', () => {
      setTimeout(() => {
        setTop();
        updateResponsiveLayout();
      }, 0);
    });

    // Mobile browsers change the viewport height when the address bar shows/
    // hides, which doesn't always fire a window 'resize'. visualViewport does,
    // so refit the vertical chat on those changes to keep it pinned to the
    // bottom of the visible area.
    if (window.visualViewport) {
      const onVV = () => fitVerticalChat();
      window.visualViewport.addEventListener('resize', onVV);
      window.visualViewport.addEventListener('scroll', onVV);
    }
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { updateResponsiveLayout(); fitVerticalChat(); }, 100);
    });

    // New media may change the player height; rebind the video listeners and
    // refit the chat after it mounts.
    if (window.socket && typeof socket.on === "function") {
      try {
        socket.on("changeMedia", () => {
          setTimeout(() => { attachVideoFitListeners(); fitVerticalChat(); }, 300);
        });
      } catch (_) {}
    }
    document.addEventListener("btfw:layout:orientation", () => scheduleChatFitSettle());
    document.addEventListener("btfw:layoutReady", () => scheduleChatFitSettle());
    // Final boot signal — re-fit across a settle window so the chat lands at
    // the right height even when CSS/video load slowly.
    document.addEventListener("btfw:ready", () => {
      attachVideoFitListeners();
      scheduleChatFitSettle();
    });
  }

  document.addEventListener("btfw:layout:chatSideChanged", (ev) => {
    const side = ev && ev.detail && ev.detail.side === "left" ? "left" : "right";
    chatSidePref = side;
    applyColumnTemplate();
    updateResponsiveLayout();
  });

  document.addEventListener("btfw:chat:barsReady", () => {
    wireMobileToggle();
    placeStackInLayout();
  });

  function findNavbarElement(){
    const selectors = [
      "nav.navbar",
      ".navbar-fixed-top",
      "#navbar"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function ensureNavHost(grid){
    if (!grid) return;
    const navEl = findNavbarElement();
    if (!navEl) return;

    let host = document.getElementById(NAV_HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = NAV_HOST_ID;
      host.className = "btfw-navhost";
    }

    if (navEl.parentElement !== host) {
      host.appendChild(navEl);
    }

    if (host.parentElement !== grid) {
      grid.insertBefore(host, grid.firstChild);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {name:"feature:layout"};
});

  function findNavbarElement(){
    const selectors = [
      "nav.navbar",
      ".navbar-fixed-top",
      "#navbar"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function ensureNavHost(grid){
    if (!grid) return;
    const navEl = findNavbarElement();
    if (!navEl) return;

    let host = document.getElementById(NAV_HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = NAV_HOST_ID;
      host.className = "btfw-navhost";
    }

    if (navEl.parentElement !== host) {
      host.appendChild(navEl);
    }

    if (host.parentElement !== grid) {
      grid.insertBefore(host, grid.firstChild);
    }
  }
