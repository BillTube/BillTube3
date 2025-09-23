BTFW.define("feature:nowplaying", [], async () => {
  const $ = (s,r=document)=>r.querySelector(s);

  function stripPrefix(t){
    return String(t||"")
      .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, "")
      .trim();
  }

  function ensureSlot(){
    // chat.js usually creates this; we just sanity-check
    const cw   = $("#chatwrap"); if (!cw) return null;
    let top    = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      cw.prepend(top);
    }
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
    }
    return slot;
  }

  function findCurrentTitle() {
    // Try multiple selectors to find the current title
    const selectors = [
      "#currenttitle",
      ".currenttitle", 
      "[id*='current'][id*='title']",
      "#videowrap-header #currenttitle",
      ".queue_active .qe_title a",
      ".queue_active .qe_title"
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    
    return null;
  }

  function createCurrentTitleElement() {
    const ct = document.createElement("span");
    ct.id = "currenttitle";
    ct.className = "btfw-nowplaying";
    return ct;
  }

  function mountTitleIntoSlot(){
    const slot = ensureSlot();
    if (!slot) return;
    
    let ct = findCurrentTitle();
    
    // If we can't find #currenttitle, create it
    if (!ct) {
      ct = createCurrentTitleElement();
      console.log('[nowplaying] Created new currenttitle element');
    }
    
    // Move it to slot if it's not already there
    if (ct.parentElement !== slot) {
      slot.innerHTML = ""; // Clear slot first
      slot.appendChild(ct);
      ct.classList.add("btfw-nowplaying");
      console.log('[nowplaying] Moved currenttitle to slot');
    }
    
    // Ensure it has some content
    if (!ct.textContent) {
      const queueTitle = getQueueActiveTitle();
      if (queueTitle) {
        ct.textContent = stripPrefix(queueTitle);
        console.log('[nowplaying] Set title from queue:', queueTitle);
      } else {
        ct.textContent = "No media playing";
      }
    }
  }

  function getQueueActiveTitle(){
    const selectors = [
      "#queue .queue_active .qe_title a",
      "#queue .queue_active .qe_title",
      "#queue .queue_active a",
      ".queue_active .qe_title",
      ".queue_active a"
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }
    return "";
  }

  function getCurrentTitleFromDOM() {
    // Try to get from the moved currenttitle element first
    const ct = findCurrentTitle();
    if (ct && ct.textContent) {
      return ct.textContent.trim();
    }
    
    // Fallback to queue active
    return getQueueActiveTitle();
  }

  function setTitle(raw){
    let ct = findCurrentTitle();
    if (!ct) {
      ct = createCurrentTitleElement();
      const slot = ensureSlot();
      if (slot) {
        slot.appendChild(ct);
      }
    }
    
    const title = raw || getQueueActiveTitle() || getCurrentTitleFromDOM();
    const cleanTitle = stripPrefix(title);
    
    ct.textContent = cleanTitle || "No media playing";
    ct.title = cleanTitle || "";
    
    console.log('[nowplaying] Set title:', cleanTitle);
    
    // Also update the slot directly if title is there
    const slot = $("#btfw-nowplaying-slot");
    if (slot && slot.contains(ct)) {
      // Title is already in slot, we're good
    }
  }

  function handleMediaChange(data) {
    // Set title from event data or fallback to DOM
    const newTitle = data?.title || getQueueActiveTitle();
    setTitle(newTitle);
    
    // Ensure title element is in the right place
    setTimeout(() => {
      mountTitleIntoSlot();
    }, 50);
  }

  function boot(){
    // 1) Ensure slot exists & mount the title node
    mountTitleIntoSlot();

    // 2) Initial text (respect anything CyTube already set)
    const existing = getCurrentTitleFromDOM();
    setTitle(existing);

    // 3) Listen to CyTube socket events with better error handling
    try {
      if (window.socket && socket.on) {
        socket.on("changeMedia", handleMediaChange);
        socket.on("setCurrent", handleMediaChange);
        socket.on("mediaUpdate", () => { 
          setTitle(); 
          mountTitleIntoSlot(); 
        });
      }
    } catch(_) {
      console.warn("[nowplaying] Socket events not available");
    }

    // 4) Watch the queue; if active item changes, update text
    const q = $("#queue");
    if (q && !q._btfwNPObs){
      const mo = new MutationObserver(()=> { 
        const queueTitle = getQueueActiveTitle();
        if (queueTitle) {
          setTitle(queueTitle);
        }
        mountTitleIntoSlot(); 
      });
      mo.observe(q, { childList:true, subtree:true, attributes: true, attributeFilter: ['class'] });
      q._btfwNPObs = mo;
    }

    // 5) Watch the whole body; if CyTube re-inserts #currenttitle, remount it
    if (!document._btfwNpMoveObs){
      const obs = new MutationObserver(()=> {
        // Check if currenttitle exists but is not in our slot
        const ct = findCurrentTitle();
        const slot = $("#btfw-nowplaying-slot");
        if (ct && slot && !slot.contains(ct)) {
          mountTitleIntoSlot();
        }
      });
      obs.observe(document.body, { childList:true, subtree:true });
      document._btfwNpMoveObs = obs;
    }

    // 6) Multiple delayed passes to handle async loading
    [100, 300, 600, 1000].forEach(delay => {
      setTimeout(() => { 
        mountTitleIntoSlot(); 
        const title = getCurrentTitleFromDOM();
        if (title) setTitle(title);
      }, delay);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:nowplaying", setTitle, mountTitleIntoSlot };
});