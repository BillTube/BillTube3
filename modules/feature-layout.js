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
    const fallbackVideo = `minmax(${VIDEO_MIN_PX}px, 7fr)`;
    const fallbackChat = "minmax(var(--btfw-chat-min, 320px), 3fr)";
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

  function makeResizable() {
    const grid = document.getElementById("btfw-grid");
    const splitter = document.getElementById("btfw-vsplit");
    if (!grid || !splitter) {
      console.warn("[BTFW] Resizer elements not found.");
      return;
    }

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
    document.dispatchEvent(new CustomEvent("btfw:layoutReady"));
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

    // Watch for window resize
    window.addEventListener('resize', () => {
      setTimeout(() => {
        setTop();
        updateResponsiveLayout();
      }, 0);
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

