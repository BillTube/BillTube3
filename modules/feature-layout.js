BTFW.define("feature:layout", ["feature:styleCore","feature:bulma"], async ({}) => {
  const SPLIT_KEY = "btfw:grid:leftPx";
  const CHAT_SIDE_KEY = "btfw:layout:chatSide";
  const MOBILE_STACK_ID = "btfw-mobile-stack";
  const VIDEO_MIN_PX = 520;
  const DEFAULT_VIDEO_TARGET = 680;
  const CHAT_MIN_PX = 360;
  const WIDTH_BUFFER = 120;

  let videoColumnPx = null;
  let chatSidePref = "right";
  let isVertical = false;
  let mobileToggleEl = null;

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

    const videoSegment = videoColumnPx
      ? `${Math.max(videoColumnPx, VIDEO_MIN_PX)}px`
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
    const target = Math.max(videoColumnPx || DEFAULT_VIDEO_TARGET, VIDEO_MIN_PX);
    return target + CHAT_MIN_PX + WIDTH_BUFFER;
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

  function setMobileStackOpen(open){
    const shell = ensureMobileStackShell();
    const allow = !!open && isVertical;
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
      body.appendChild(stack);
    }
  }

  function restoreStackFromOverlay(){
    const stack = document.getElementById("btfw-stack");
    if (!stack) return;
    const left = document.getElementById("btfw-leftpad");
    if (!left) return;
    if (stack.parentElement === left) return;
    const video = document.getElementById("videowrap");
    if (video && video.parentElement === left) {
      if (video.nextSibling) {
        left.insertBefore(stack, video.nextSibling);
      } else {
        left.appendChild(stack);
      }
    } else {
      left.appendChild(stack);
    }
  }

  function wireMobileToggle(){
    const toggle = document.getElementById("btfw-mobile-modules-toggle");
    if (!toggle || toggle === mobileToggleEl) return;
    mobileToggleEl = toggle;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!isVertical) return;
      const shell = ensureMobileStackShell();
      const open = !shell.classList.contains("btfw-mobile-stack--open");
      if (open) moveStackToOverlay();
      setMobileStackOpen(open);
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
        moveStackToOverlay();
      } else {
        setMobileStackOpen(false);
        restoreStackFromOverlay();
      }
    } else if (!shouldVertical) {
      restoreStackFromOverlay();
    } else {
      moveStackToOverlay();
    }

    applyColumnTemplate();
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
      chatcol.style.top = `calc(${newTop} + var(--btfw-gap))`;
      chatcol.style.height = `calc(100vh - ${newTop} - var(--btfw-gap) * 2)`;
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
      
      if(v && !left.contains(v)) left.appendChild(v); 
      if(q && !left.contains(q)) left.appendChild(q); 
      if(c && !right.contains(c)) right.appendChild(c);
    }

    const leftpadWatch = document.getElementById("btfw-leftpad");
    if (leftpadWatch && !leftpadWatch._btfwStackWatch) {
      const obs = new MutationObserver(() => {
        if (isVertical) moveStackToOverlay();
      });
      obs.observe(leftpadWatch, { childList: true });
      leftpadWatch._btfwStackWatch = obs;
    }

    ["videowrap","playlistrow","playlistwrap","queuecontainer","queue","plmeta","chatwrap"].forEach(id=>stripDeep(document.getElementById(id)));
    moveCurrent();
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
    if (isVertical) moveStackToOverlay();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {name:"feature:layout"};
});