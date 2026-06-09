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

  // Base palette for the generative avatar (the flat colour underneath the pattern).
  const AVATAR_COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22","#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad","#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad","#f69785","#9ba37e","#b49255","#a94136"];

  // Deterministic 8-digit (1–9, no zeros) hash of a name. Same input → same output
  // on every client, so a user's generated avatar is always in sync for everyone.
  function avatarHash8(name){
    let h = 0;
    const s = (name || "?");
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return ("11111111" + Math.abs(h)).slice(-8).replace(/0/g, "1");
  }

  // First letters of the first two words, else first two letters of the name
  // (skipping leading punctuation so e.g. "z-z-z" → "ZZ" rather than "Z-").
  function avatarInitials(name){
    const c = (name || "?").trim();
    if (!c) return "?";
    const words = c.split(/\s+/).filter(Boolean);
    const pick = s => { const m = s.match(/[A-Za-z0-9]/); return m ? m[0] : s.charAt(0); };
    if (words.length >= 2) return (pick(words[0]) + pick(words[1])).toUpperCase();
    const clean = c.replace(/[^A-Za-z0-9]/g, "");
    return (clean.slice(0, 2) || c.slice(0, 2)).toUpperCase();
  }

  function escXml(s){ return String(s).replace(/[&<>]/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[m])); }

  // ⚡ PERFORMANCE: Cache-enabled generative SVG avatar.
  // Draws a symmetric "kaleidoscope" of translucent rectangles (derived from the
  // name hash) over a base colour, then centred initials. Pure SVG so it's crisp
  // at any DPI and cheap to rasterise; the result is cached, so each user's avatar
  // is generated at most once per size. Deterministic on the name → always in sync.
  function initialsDataURL(name, sizePx){
    const sz = sizePx || 24;
    const ck = `${name}-${sz}`;
    if (avatarCache.has(ck)) return avatarCache.get(ck);

    const h = avatarHash8(name);
    const base = AVATAR_COLORS[((name || "?").trim().codePointAt(0) || 63) % AVATAR_COLORS.length];
    const sym = (parseInt(h[7], 10) % 2) + 2; // 2- or 3-fold rotational symmetry

    let shapes = "";
    for (let j = 0; j < 8; j++) {
      const dj = parseInt(h[j], 10) || 1;
      const r = (parseInt(h[j], 10) * 100) % 255;
      const g = (parseInt(h[(j + 3) % 8], 10) * 100) % 255;
      const b = (parseInt(h[(j + 6) % 8], 10) * 100) % 255;
      const a = (0.12 + (dj / 9) * 0.26).toFixed(2);
      let c1 = (dj * dj) % 16;
      let c2 = (dj * parseInt(h[7], 10)) % 16;
      let c3 = (dj * parseInt(h[0], 10)) % 32;
      let c4 = (dj * parseInt(h[0], 10)) % 32;
      if (c1 + c2 < 32) { c1 = -2 * c1; c2 = -2 * c2; c3 = 2 * c3; c4 = 2 * c4; }
      if (c3 < 3 || c4 < 3) continue;
      for (let k = 0; k < 2 * sym; k++) {
        const ang = (45 + (180 / sym) * k).toFixed(1);
        shapes += `<rect x="${c1}" y="${c2}" width="${c3}" height="${c4}" fill="rgba(${r},${g},${b},${a})" transform="translate(32 32) rotate(${ang})"/>`;
      }
    }

    const fs = 26;
    const ty = (32 + fs * 0.34).toFixed(1); // baseline offset → visually centred caps
    const letters = escXml(avatarInitials(name));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 64 64">`
      + `<rect width="64" height="64" fill="${base}"/>`
      + `<g>${shapes}</g>`
      + `<text x="32" y="${ty}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${fs}" font-weight="700" fill="#fff" style="paint-order:stroke" stroke="rgba(0,0,0,.30)" stroke-width="2.4">${letters}</text>`
      + `</svg>`;
    const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));

    if (avatarCache.size >= MAX_CACHE_SIZE) {
      avatarCache.delete(avatarCache.keys().next().value);
    }
    avatarCache.set(ck, dataUrl);
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

    // Avatar sits at left:8 (down from 16); 4px gap to text → padding-left
    // = 8 + size + 4. Keeps the chat tighter on the left without crowding
    // the avatar against the column edge.
    const indent = size > 0 ? 8 + size + 4 : 0;
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

  /* ---------------- Userlist avatars ----------------
     Same source order as chat (profile image from the item's jQuery data ->
     cached URL -> colored initials SVG). Always shown (independent of the
     chat avatar on/off mode) since the userlist is its own UI. Cheap enough
     for hundreds of users: cached SVGs/URLs + a debounced observer. */
  const UL_AVATAR_PX = 28;

  function userlistItemName(item){
    if (!item) return "";
    const span = item.querySelector(
      "span.userlist_owner, span.userlist_op, span.userlist_admin, span.userlist_siteadmin, span.userlist_guest, span.userlist_user"
    ) || Array.from(item.querySelectorAll("span")).find(s => (s.textContent || "").trim());
    return span ? (span.textContent || "").trim() : "";
  }

  function userlistItemProfileImg(item){
    try {
      if (!window.jQuery) return "";
      const prof = window.jQuery(item).data && window.jQuery(item).data("profile");
      return (prof && prof.image) || "";
    } catch(_) { return ""; }
  }

  function ensureUserlistAvatar(item){
    if (!item || item.querySelector(".btfw-ul-avatar")) return;
    const name = userlistItemName(item);
    if (!name) return;

    const key = cacheKey(name);
    const liveUrl = userlistItemProfileImg(item);
    const cachedUrl = getCachedAvatarUrlByKey(key);
    let src = liveUrl || cachedUrl;
    let type = "url";
    if (src) {
      setCachedAvatarUrl(name, src);
    } else {
      src = initialsDataURL(name, UL_AVATAR_PX);
      type = "svg";
    }

    const img = document.createElement("img");
    img.className = "btfw-ul-avatar";
    applyAvatarSource(img, src, { key, label: name, size: UL_AVATAR_PX, type });
    img.loading = "lazy";
    img.decoding = "async";
    if (!img._btfwAvatarErrorBound) {
      img.addEventListener("error", handleAvatarError);
      img._btfwAvatarErrorBound = true;
    }
    // Append (not prepend) so the avatar never becomes children[0]/[1]. CyTube's
    // findUserlistItem() matches the username via the hard-coded second child
    // (child.children[1]); prepending the avatar shifted the name to children[2],
    // so the finder returned null for everyone and userLeave could never remove a
    // user (stale names on leave, duplicates on rejoin). CSS order:-1 keeps the
    // avatar visually first in the (flex) userlist row.
    item.appendChild(img);
  }

  function reflowUserlist(){
    const ul = document.getElementById("userlist");
    if (!ul) return;
    ul.querySelectorAll(".userlist_item, li").forEach(ensureUserlistAvatar);
  }

  function watchUserlist(){
    const ul = document.getElementById("userlist");
    if (!ul || ul._btfwUlAvMO) return;
    let t = null;
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(reflowUserlist, 60);
    });
    mo.observe(ul, { childList: true, subtree: false });
    ul._btfwUlAvMO = mo;
    reflowUserlist();
  }

  /* ---------------- Profile-box hover popup: keep it on-screen ----------------
     CyTube shows .profile-box.linewrap on userlist hover and positions it with
     inline left/top off the hovered row. With the userlist docked (or in the
     popover) it can run off-screen, and an overflow/transform ancestor can clip
     it. Re-parent it to <body> so its position:fixed is always viewport-relative
     and nothing can clip it, then clamp it inside the viewport. (CSS styles the
     box; this only fixes placement.) CyTube removes the box by reference, so the
     re-parent is safe — it still disappears on mouse-out. */
  function clampProfileBoxNow(box){
    box = box || document.querySelector(".profile-box.linewrap");
    if (!box) return;
    if (box.parentElement !== document.body) document.body.appendChild(box);
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const m = 8;
    let left = r.left, top = r.top;
    if (left + r.width > window.innerWidth - m) left = window.innerWidth - r.width - m;
    if (top + r.height > window.innerHeight - m) top = window.innerHeight - r.height - m;
    if (left < m) left = m;
    if (top < m) top = m;
    // Idempotent: only writes when the position actually needs to move, so my own
    // style write can't retrigger the observer into a loop.
    if (Math.round(left) !== Math.round(r.left)) box.style.left = Math.round(left) + "px";
    if (Math.round(top)  !== Math.round(r.top))  box.style.top  = Math.round(top) + "px";
  }
  function placeProfileBox(){
    const box = document.querySelector(".profile-box.linewrap");
    if (!box) return;
    // CyTube can position the box AFTER our one-shot clamp, leaving it off-screen.
    // Watch the box's style so every (re)position is re-clamped; combined with the
    // idempotent clamp above this can't loop and never lags CyTube.
    if (!box.__btfwClampObs && window.MutationObserver) {
      box.__btfwClampObs = true;
      new MutationObserver(() => clampProfileBoxNow(box))
        .observe(box, { attributes: true, attributeFilter: ["style"] });
    }
    clampProfileBoxNow(box);
  }
  function wireProfileBoxClamp(){
    if (window.__btfwProfileBoxClamp) return;
    window.__btfwProfileBoxClamp = true;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    const place = () => { raf(() => raf(placeProfileBox)); setTimeout(placeProfileBox, 50); };
    document.addEventListener("mouseover", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("#userlist .userlist_item")) place();
    }, true);
    window.addEventListener("resize", () => clampProfileBoxNow());
  }

  function boot(){
    applyMode(currentMode);
    reflowAll();
    watchUserlist();
    wireProfileBoxClamp();
    // The userlist may mount after us; retry briefly + on key lifecycle events.
    let tries = 0;
    const ulTimer = setInterval(() => {
      if (document.getElementById("userlist")) { watchUserlist(); }
      if (document.getElementById("userlist") || tries++ > 20) clearInterval(ulTimer);
    }, 500);
    document.addEventListener("btfw:layoutReady", () => watchUserlist());
    document.addEventListener("btfw:ready", () => watchUserlist());
    // Re-apply avatars after the userlist is moved (e.g. dock <-> popover).
    document.addEventListener("btfw:userlist:reflow", () => { watchUserlist(); reflowUserlist(); });
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
    reflowUserlist,
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
