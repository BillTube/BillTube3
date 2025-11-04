/* BTFW — feature:chat-avatars (PERFORMANCE OPTIMIZED)
   - Injects avatar before .username in each chat message
   - Source order: profile image from userlist data() → CyTube avatar (if available) → colored initials SVG fallback
   - Compacts consecutive messages from same user (no repeated avatar; reduced top margin)
   - Respects --btfw-avatar-size (set by avatars-bridge or your avatar settings)
   
   PERFORMANCE ENHANCEMENTS:
   - Caches generated SVG data URLs to avoid redundant base64 encoding
   - Uses loading="lazy" and decoding="async" for better LCP
   - Adds content-visibility for off-screen rendering optimization
*/
BTFW.define("feature:chat-avatars", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const AVATAR_KEY = "btfw:chat:avatars";
  const AVATAR_URL_CACHE_KEY = `${AVATAR_KEY}:urls:v1`;
  const AVATAR_URL_CACHE_LIMIT = 200;

  // ⚡ PERFORMANCE: Cache for generated SVG data URLs
  const avatarCache = new Map();
  const MAX_CACHE_SIZE = 200; // Limit cache to prevent memory bloat
  const avatarUrlStore = loadAvatarUrlCache();
  let avatarUrlCachePersistTimer = null;
  let avatarUrlCacheDirty = false;

  function loadMode(){
    try {
      const stored = localStorage.getItem(AVATAR_KEY);
      if (stored === "off" || stored === "big" || stored === "small") return stored;
    } catch(_) {}
    return "big";
  }

  function saveMode(mode){
    try { localStorage.setItem(AVATAR_KEY, mode); } catch(_){}
  }

  let currentMode = loadMode();

  function cacheKey(name){
    return (name || "").trim().toLowerCase();
  }

  function loadAvatarUrlCache(){
    try {
      const raw = localStorage.getItem(AVATAR_URL_CACHE_KEY);
      if (!raw) return new Map();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Map();
      const map = new Map();
      parsed.forEach(entry => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        const [key, info] = entry;
        if (typeof key !== "string" || !info || typeof info.url !== "string" || !info.url) return;
        map.set(key, { url: info.url, ts: info.ts || 0 });
      });
      return map;
    } catch(_) {
      return new Map();
    }
  }

  function scheduleAvatarUrlCachePersist(){
    if (!avatarUrlCacheDirty) avatarUrlCacheDirty = true;
    if (avatarUrlCachePersistTimer) return;
    avatarUrlCachePersistTimer = setTimeout(() => {
      avatarUrlCachePersistTimer = null;
      if (!avatarUrlCacheDirty) return;
      avatarUrlCacheDirty = false;
      try {
        const payload = JSON.stringify(Array.from(avatarUrlStore.entries()));
        localStorage.setItem(AVATAR_URL_CACHE_KEY, payload);
      } catch(_) {}
    }, 250);
  }

  function trimAvatarUrlCache(){
    while (avatarUrlStore.size > AVATAR_URL_CACHE_LIMIT) {
      const firstKey = avatarUrlStore.keys().next().value;
      if (!firstKey) break;
      avatarUrlStore.delete(firstKey);
    }
  }

  function setCachedAvatarUrl(name, url){
    const key = cacheKey(name);
    if (!key || !url) return;
    const existing = avatarUrlStore.get(key);
    if (existing && existing.url === url) {
      existing.ts = Date.now();
      avatarUrlStore.delete(key);
      avatarUrlStore.set(key, existing);
    } else {
      avatarUrlStore.delete(key);
      avatarUrlStore.set(key, { url, ts: Date.now() });
      trimAvatarUrlCache();
    }
    scheduleAvatarUrlCachePersist();
  }

  function getCachedAvatarUrlByKey(key){
    if (!key) return "";
    const entry = avatarUrlStore.get(key);
    return entry && entry.url || "";
  }

  function removeCachedAvatarUrlByKey(key, url){
    if (!key) return;
    const entry = avatarUrlStore.get(key);
    if (entry && (!url || entry.url === url)) {
      avatarUrlStore.delete(key);
      scheduleAvatarUrlCachePersist();
    }
  }

  // Try BillTube2-style: jQuery data('profile').image from userlist
  function getProfileImgFromUserlist(name){
    try {
      const li = findUserlistItem(name);
      if (!li || !window.jQuery) return "";
      const $li = window.jQuery(li);
      const prof = $li.data && $li.data("profile");
      const img = prof && prof.image;
      return img || "";
    } catch(_) { return ""; }
  }

  function findUserlistItem(name){
    if (!name) return null;
    const byData = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (byData) return byData;
    const items = document.querySelectorAll("#userlist li, #userlist .userlist_item, #userlist .user");
    for (const el of items) {
      const t = (el.textContent || "").trim();
      if (t && t.replace(/\s+/g,"").toLowerCase().startsWith(name.toLowerCase())) return el;
    }
    return null;
  }

  // Fallback: CyTube avatar on profile (if DOM exposes it)
  function getCyTubeAvatarMaybe(name){
    // Not always accessible; keep placeholder for future hook-ins
    return "";
  }

  // ⚡ PERFORMANCE: Cache-enabled SVG generation
  function initialsDataURL(name, sizePx){
    const cacheKey = `${name}-${sizePx}`;
    
    // Check cache first
    if (avatarCache.has(cacheKey)) {
      return avatarCache.get(cacheKey);
    }

    // Generate SVG
    const colors = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22","#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad","#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad","#f69785","#9ba37e","#b49255","#a94136"];
    const c = (name||"?").trim();
    const first = (c.codePointAt(0)||63) % colors.length;
    const bg = colors[first];
    const letters = c.slice(0,2).toUpperCase();
    const sz = sizePx || 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="${Math.round(sz*0.5)}" font-weight="600">${letters}</text></svg>`;
    const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    
    // Cache the result (with size limit)
    if (avatarCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry (first key)
      const firstKey = avatarCache.keys().next().value;
      avatarCache.delete(firstKey);
    }
    avatarCache.set(cacheKey, dataUrl);
    
    return dataUrl;
  }

  function handleAvatarError(evt){
    const img = evt && evt.currentTarget;
    if (!img || img.dataset.avatarFallback === "svg") return;

    const key = img.dataset.avatarKey || "";
    const failedUrl = img.dataset.avatarUrl || "";
    const size = parseInt(img.dataset.avatarSize || "", 10) || 24;
    const label = img.dataset.avatarLabel || img.alt || "";

    if (key) removeCachedAvatarUrlByKey(key, failedUrl);

    const fallback = initialsDataURL(label, size);
    img.dataset.avatarFallback = "svg";
    img.dataset.avatarUrl = "";
    img.src = fallback;
  }

  function applyAvatarSource(img, src, { key, label, size, type }){
    if (!img || !src) return;
    const normalizedType = type === "svg" ? "svg" : "url";
    if (key) img.dataset.avatarKey = key;
    if (label) {
      img.dataset.avatarLabel = label;
      img.alt = label;
    }
    if (size !== undefined && size !== null && !Number.isNaN(size)) {
      img.dataset.avatarSize = `${size}`;
    }
    img.dataset.avatarFallback = normalizedType;
    img.dataset.avatarUrl = normalizedType === "url" ? src : "";
    img.src = src;
  }

  function updateExistingAvatars(name, newUrl, size){
    const key = cacheKey(name);
    if (!key || !newUrl) return;
    const imgs = document.querySelectorAll("#messagebuffer .btfw-chat-avatar[data-avatar-key]");
    imgs.forEach(img => {
      if (img.dataset.avatarKey === key) {
        applyAvatarSource(img, newUrl, {
          key,
          label: img.dataset.avatarLabel || name,
          size: size || parseInt(img.dataset.avatarSize || "", 10) || 24,
          type: "url"
        });
      }
    });
  }

  function ensureAvatar(msgEl){
    if (currentMode === "off") return;
    // find username
    const uEl = msgEl.querySelector(".username");
    if (!uEl) return;
    const raw = (uEl.textContent || "").trim();
    const name = raw.replace(/:\s*$/,"");
    if (!name) return;

    const px = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--btfw-avatar-size").trim() || "24px", 10) || 24;

    // Already has our avatar? ensure it has metadata + handlers
    const existingImg = msgEl.querySelector(".btfw-chat-avatar");
    if (existingImg) {
      const key = cacheKey(name);
      const currentSrc = existingImg.getAttribute("src") || "";
      const isSvg = currentSrc.startsWith("data:image/svg+xml");
      applyAvatarSource(existingImg, currentSrc || initialsDataURL(name, px), {
        key,
        label: name,
        size: px,
        type: isSvg ? "svg" : "url"
      });
      if (!isSvg && currentSrc) {
        setCachedAvatarUrl(name, currentSrc);
      }
      if (!existingImg._btfwAvatarErrorBound) {
        existingImg.addEventListener("error", handleAvatarError);
        existingImg._btfwAvatarErrorBound = true;
      }
      return;
    }

    // pick image
    const key = cacheKey(name);
    const cachedUrl = getCachedAvatarUrlByKey(key);
    const liveUrl = getProfileImgFromUserlist(name) || getCyTubeAvatarMaybe(name);
    let chosenSrc = liveUrl || cachedUrl;
    let sourceType = "url";

    if (liveUrl) {
      if (cachedUrl !== liveUrl) {
        setCachedAvatarUrl(name, liveUrl);
        updateExistingAvatars(name, liveUrl, px);
      } else {
        setCachedAvatarUrl(name, liveUrl);
      }
    } else if (cachedUrl) {
      // Use cached URL when user isn't active
      chosenSrc = cachedUrl;
      setCachedAvatarUrl(name, cachedUrl);
    }

    if (!chosenSrc) {
      chosenSrc = initialsDataURL(name, px);
      sourceType = "svg";
    }

    const img = document.createElement("img");
    img.className = "btfw-chat-avatar";
    applyAvatarSource(img, chosenSrc, {
      key,
      label: name,
      size: px,
      type: sourceType
    });

    // ⚡ PERFORMANCE: Native browser optimizations
    // Note: No explicit width/height set - CSS variables handle sizing dynamically
    img.loading = "lazy";     // Defer loading of off-screen images
    img.decoding = "async";   // Don't block rendering while decoding

    if (!img._btfwAvatarErrorBound) {
      img.addEventListener("error", handleAvatarError);
      img._btfwAvatarErrorBound = true;
    }

    // insert before username
    const wrap = document.createElement("span");
    wrap.className = "btfw-chat-avatarwrap";
    wrap.appendChild(img);
    // Insert avatarwrap right before username element
    uEl.parentNode.insertBefore(wrap, uEl);
    msgEl.classList.add("btfw-has-avatar");
  }

  // Consecutive message compaction: if same user as previous message, hide avatar and reduce gap
  let lastSender = null;
  function compactIfConsecutive(msgEl){
    if (!msgEl) return;

    const uEl = msgEl.querySelector(".username");
    const avatar = msgEl.querySelector(".btfw-chat-avatarwrap");
    const classes = Array.from(msgEl.classList || []);
    const isChatMessage = classes.some(cls => cls === "chat-msg" || cls.startsWith("chat-msg-")) || !!avatar;

    // Ignore non-chat/system messages (join/leave notices, server logs, etc.).
    // They shouldn't affect compaction state for the next real chat line.
    if (!isChatMessage) return;

    if (!uEl) {
      lastSender = null;
      return;
    }

    const name = (uEl.textContent || "").trim().replace(/:\s*$/,"");
    if (!name || !avatar) {
      lastSender = null;
      return;
    }

    const consecutive = currentMode !== "off" && lastSender && lastSender === name;
    msgEl.classList.toggle("btfw-compact", consecutive);
    avatar.style.display = consecutive ? "none" : "";

    lastSender = name;
  }

  function processNode(node){
    if (!node) return;
    // Chat messages are typically divs in #messagebuffer; be generous:
    const msgs = (node.matches && node.matches("#messagebuffer > div")) ? [node]
               : (node.querySelectorAll ? node.querySelectorAll("#messagebuffer > div") : []);
    msgs.forEach(m => { ensureAvatar(m); compactIfConsecutive(m); });
  }

  function reflowAll(){
    if (currentMode === "off") {
      removeAllAvatars();
      return;
    }
    lastSender = null;
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    const msgs = Array.from(buf.children || []);
    msgs.forEach(m => { ensureAvatar(m); compactIfConsecutive(m); });
  }

  function removeAllAvatars(){
    lastSender = null;
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    buf.querySelectorAll(".btfw-chat-avatarwrap").forEach(el => el.remove());
    buf.querySelectorAll(".btfw-has-avatar").forEach(el => el.classList.remove("btfw-has-avatar", "btfw-compact"));
  }

  function applyMode(mode){
    const chatwrap = document.getElementById("chatwrap");
    if (chatwrap) {
      chatwrap.classList.remove("btfw-avatars-off", "btfw-avatars-small", "btfw-avatars-big");
      chatwrap.classList.add(`btfw-avatars-${mode}`);
    }

    const size = mode === "big" ? 40 : mode === "off" ? 0 : 28;
    document.documentElement.style.setProperty("--btfw-avatar-size", `${size}px`);

    const indent = size > 0 ? 16 + size + 4 : 0;
    document.documentElement.style.setProperty("--btfw-message-padding-left", `${indent}px`);

    if (size > 0) {
      // Note: We don't set width/height attributes anymore, CSS handles it dynamically
      document.querySelectorAll("#messagebuffer .btfw-chat-avatar").forEach(img => {
        // Just ensure the loading attributes are present
        if (!img.hasAttribute("loading")) img.loading = "lazy";
        if (!img.hasAttribute("decoding")) img.decoding = "async";
      });
    }
  }

  function setMode(mode){
    const normalized = (mode === "off" || mode === "big") ? mode : "small";
    currentMode = normalized;
    applyMode(normalized);
    if (normalized === "off") {
      removeAllAvatars();
    } else {
      reflowAll();
    }
    saveMode(normalized);
  }

  function getMode(){
    return currentMode;
  }

  function boot(){
    applyMode(currentMode);
    reflowAll();
    const buf = document.getElementById("messagebuffer");
    if (buf && !buf._btfwAvMO){
      const pending = new Set();
      let mutationTimeout;
      const flushPending = () => {
        mutationTimeout = null;
        pending.forEach(node => {
          if (node && node.nodeType === 1 && node.isConnected) {
            processNode(node);
          }
        });
        pending.clear();
      };
      const mo = new MutationObserver(muts=>{
        let queued = false;
        for (const m of muts) {
          if (m.type==="childList" && m.addedNodes) {
            m.addedNodes.forEach(n => {
              if (n && n.nodeType===1) {
                pending.add(n);
                queued = true;
              }
            });
          }
        }
        if (queued) {
          clearTimeout(mutationTimeout);
          mutationTimeout = setTimeout(flushPending, 50);
        }
      });
      mo.observe(buf, { childList:true, subtree:false });
      buf._btfwAvMO = mo;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name:"feature:chat-avatars",
    reflow: reflowAll,
    setMode,
    getMode,
    // ⚡ PERFORMANCE: Expose cache stats for debugging
    getCacheStats: () => ({
      svgCacheSize: avatarCache.size,
      svgCacheMaxSize: MAX_CACHE_SIZE,
      urlCacheSize: avatarUrlStore.size,
      urlCacheLimit: AVATAR_URL_CACHE_LIMIT
    })
  };
});
