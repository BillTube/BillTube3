BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  const SPLIT_KEY = "btfw:grid:leftPx";
  const CHAT_SIDE_KEY = "btfw:layout:chatSide";
  const MOBILE_STACK_ID = "btfw-mobile-stack";
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
    const videoSegment = stored
      ? `minmax(${VIDEO_MIN_PX}px, ${stored}px)`
      : `minmax(${VIDEO_MIN_PX}px, 1fr)`;
    const chatSegment = "minmax(var(--btfw-chat-min, 320px), 1fr)";
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

  function ensureMobileStackShell(){
    let shell = document.getElementById(MOBILE_STACK_ID);
    if (!shell) {
      shell = document.createElement("div");
      shell.id = MOBILE_STACK_ID;
      shell.className = "btfw-mobile-stack";
      shell.innerHTML = `
        <div class="btfw-mobile-stack__panel" role="dialog" aria-modal="true" aria-labelledby="btfw-mobile-stack-title">
          <div class="btfw-mobile-stack__header">
            <span class="btfw-mobile-stack__title" id="btfw-mobile-stack-title">Modules</span>
            <button type="button" class="btfw-mobile-stack__close" aria-label="Close modules">&times;</button>
          </div>
          <div class="btfw-mobile-stack__body"></div>
        </div>
      `;
      document.body.appendChild(shell);

      shell.addEventListener("click", (ev) => {
        if (ev.target === shell) setMobileStackOpen(false);
      });
      const closeBtn = shell.querySelector(".btfw-mobile-stack__close");
      if (closeBtn) closeBtn.addEventListener("click", () => setMobileStackOpen(false));

      if (!document._btfwMobileStackEsc) {
        document._btfwMobileStackEsc = true;
        document.addEventListener("keydown", (ev) => {
          if (ev.key === "Escape") setMobileStackOpen(false);
        });
      }
    }
    return shell;
  }

  function isMobileStackOpen(){
    const shell = document.getElementById(MOBILE_STACK_ID);
    return !!(shell && shell.classList.contains("btfw-mobile-stack--open"));
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

  function setMobileStackOpen(open){
    const shell = ensureMobileStackShell();
    const allow = !!open && isVertical;
    if (allow) moveStackToOverlay();
    else restoreStackFromOverlay();

    shell.classList.toggle("btfw-mobile-stack--open", allow);
    if (document.body) {
      document.body.classList.toggle("btfw-mobile-stack-open", allow);
    }
    const toggle = document.getElementById("btfw-mobile-modules-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", allow ? "true" : "false");
  }

  function moveStackToOverlay(){
    if (!isVertical) return;
    const stack = document.getElementById("btfw-stack");
    if (!stack) return;
    const shell = ensureMobileStackShell();
    const body = shell.querySelector(".btfw-mobile-stack__body");
    if (body && stack.parentElement !== body) {
      stack.classList.remove("btfw-stack--in-chat");
      body.appendChild(stack);
    }
  }

  function restoreStackFromOverlay(){
    placeStackInLayout();
  }

  function wireMobileToggle(){
    const toggle = document.getElementById("btfw-mobile-modules-toggle");
    if (!toggle || toggle === mobileToggleEl) return;
    mobileToggleEl = toggle;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!isVertical) {
        toggle.blur();
        return;
      }
      setMobileStackOpen(!isMobileStackOpen());
    });
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

      if (shouldVertical) {
        if (isMobileStackOpen()) moveStackToOverlay();
        else restoreStackFromOverlay();
      } else {
        setMobileStackOpen(false);
        restoreStackFromOverlay();
      }
      refreshVideoSizing();
      setTimeout(() => {
        refreshVideoSizing();
        try {
          window.dispatchEvent(new Event("resize"));
        } catch (_) {}
      }, 60);
      document.dispatchEvent(new CustomEvent("btfw:layout:orientation", { detail: { vertical: shouldVertical } }));
    } else {
      if (shouldVertical) {
        if (isMobileStackOpen()) moveStackToOverlay();
        else restoreStackFromOverlay();
      } else {
        restoreStackFromOverlay();
      }
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
    const vh=document.getElementById("videowrap-header"); 
    if(!vh) return; 
    const ct=vh.querySelector("#currenttitle"); 
    const top=document.querySelector("#chatwrap .btfw-chat-topbar"); 
    if(ct&&top){ 
      let slot=top.querySelector("#btfw-nowplaying-slot"); 
      if(!slot){ 
        slot=document.createElement("div"); 
        slot.id="btfw-nowplaying-slot"; 
        slot.className="btfw-chat-title"; 
        top.innerHTML=""; 
        top.appendChild(slot);
      } 
      slot.appendChild(ct);
    } 
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

    const leftpadWatch = document.getElementById("btfw-leftpad");
    if (leftpadWatch && !leftpadWatch._btfwStackWatch) {
      const obs = new MutationObserver(() => {
        if (isVertical) {
          if (isMobileStackOpen()) moveStackToOverlay();
          else placeStackInLayout();
        }
      });
      obs.observe(leftpadWatch, { childList: true });
      leftpadWatch._btfwStackWatch = obs;
    }

    const chatWatch = document.getElementById("btfw-chatcol");
    if (chatWatch && !chatWatch._btfwStackWatch) {
      const obs = new MutationObserver(() => {
        if (isVertical && !isMobileStackOpen()) placeStackInLayout();
      });
      obs.observe(chatWatch, { childList: true });
      chatWatch._btfwStackWatch = obs;
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
    if (isVertical) {
      if (isMobileStackOpen()) moveStackToOverlay();
      else restoreStackFromOverlay();
    }
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

