/* BillTube Framework — feature:chat-avatars
   - Avatars next to chat messages
   - Sizes: off | small | big
   - Consecutive message collapse
   - Sources: cached profile URL -> userlist image -> initials SVG
   - Grabs avatar URL from CyTube profile popups/modals and caches per user
*/
BTFW.define("feature:chat-avatars", ["feature:chat"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_MODE = "btfw:avatars:mode";             // "off" | "small" | "big"
  const LS_MAP  = "btfw:avatar:map";               // {username: url}
  const DEFAULT_MODE = "small";

  /* ---------------- Initials SVG (same palette as old theme) ---------------- */
  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                  "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                  "#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad",
                  "#f69785","#9ba37e","#b49255","#a94136"];

  function initialsDataURL(name, size, radius=8){
    name = (name || "?").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const glyph = ((parts[0]?.[0]||"") + (parts[1]?.[0]||"")).toUpperCase() || (name[0]||"?").toUpperCase();
    const seed  = glyph.charCodeAt(0) + (glyph.charCodeAt(1)||0);
    const color = COLORS[ seed % COLORS.length ];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
         <rect rx="${radius}" ry="${radius}" width="${size}" height="${size}" fill="${color}"/>
         <text x="50%" y="50%" dy=".35em" text-anchor="middle"
               fill="#fff" font-family="Inter,Helvetica,Arial,sans-serif"
               font-size="${Math.floor(size*0.46)}" font-weight="600">${glyph}</text>
       </svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  /* ---------------- Local cache for profile avatars ---------------- */
  function mapGet(){
    try { return JSON.parse(localStorage.getItem(LS_MAP) || "{}"); } catch(e){ return {}; }
  }
  function mapSet(obj){
    try { localStorage.setItem(LS_MAP, JSON.stringify(obj)); } catch(e){}
  }
  function mapPut(nick, url){
    if (!nick || !url) return;
    const m = mapGet();
    if (m[nick] === url) return;
    m[nick] = url;
    mapSet(m);
  }
  function mapPick(nick){ return mapGet()[nick] || ""; }

  /* ---------------- Resolve avatar URL for a given nick ---------------- */
  function resolveFromUserlist(nick){
    const item = $(`#userlist .userlist_item[data-name="${CSS.escape(nick)}"]`) ||
                 $$("#userlist .userlist_item").find(li => (li.dataset && li.dataset.name === nick));
    if (!item) return "";
    const img = $("img", item);
    if (img && img.src && !img.src.startsWith("data:")) return img.src;
    // sometimes custom attributes are used
    const ds = item.dataset || {};
    return ds.avatar || ds.image || "";
  }

  function resolveAvatar(nick, size){
    // 1) cached profile map
    const cached = mapPick(nick);
    if (cached) return cached;

    // 2) userlist image if present
    const listURL = resolveFromUserlist(nick);
    if (listURL) return listURL;

    // 3) initials fallback
    return initialsDataURL(nick, size, Math.round(size/3));
  }

  /* ---------------- Modes ---------------- */
  function getMode(){
    try { return localStorage.getItem(LS_MODE) || DEFAULT_MODE; } catch(e){ return DEFAULT_MODE; }
  }
  function setMode(mode){
    try { localStorage.setItem(LS_MODE, mode); } catch(e){}
    applyModeClass(mode);
    // reflow existing messages
    $$(`#messagebuffer .chat-msg`).forEach(decorateMessage);
  }
  function applyModeClass(mode){
    const wrap = $("#chatwrap"); if (!wrap) return;
    wrap.classList.remove("btfw-avatars-off","btfw-avatars-small","btfw-avatars-big");
    wrap.classList.add("btfw-avatars-"+mode);
  }

  /* ---------------- Message decoration ---------------- */
  function usernameOf(msg){
    const u = $(".username,.nick,.name", msg);
    return u ? (u.textContent || "").trim() : "";
  }

  function findPrevUserMessage(node){
    let p = node.previousElementSibling;
    while (p){
      if (p.classList && p.classList.contains("chat-msg")) return p;
      p = p.previousElementSibling;
    }
    return null;
  }

  function decorateMessage(msg){
    if (!msg || msg._btfw_avatar_done) return;
    if (!msg.classList || !msg.classList.contains("chat-msg")) return;
    msg._btfw_avatar_done = true;

    const mode = getMode();
    if (mode === "off") return;

    // ignore server/system messages
    if (msg.classList.contains("server-msg") || msg.classList.contains("cm")) return;

    const nick = usernameOf(msg);
    if (!nick) return;

    // consecutive collapse
    const prev = findPrevUserMessage(msg);
    if (prev && usernameOf(prev) === nick) msg.classList.add("btfw-consecutive");

    // ensure not already present
    if ($(".btfw-chat-avatar", msg)) return;

    const size = (mode === "big") ? 40 : 28;
    const url  = resolveAvatar(nick, size);

    const userNode = $(".username,.nick,.name", msg);
    if (!userNode) return;

    const img = document.createElement("img");
    img.className = "btfw-chat-avatar";
    img.src = url; img.width = size; img.height = size; img.alt = nick;

    userNode.parentNode.insertBefore(img, userNode);
    msg.classList.add("btfw-has-avatar");
  }

  /* ---------------- Observe buffer & userlist ---------------- */
  function observeBuffer(){
    const buf = $("#messagebuffer");
    if (!buf || buf._btfw_avatar_obs) return;
    buf._btfw_avatar_obs = true;

    // decorate existing first
    $$("#messagebuffer .chat-msg").forEach(decorateMessage);

    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList.contains("chat-msg")) decorateMessage(n);
    }))).observe(buf, {childList:true});
  }

  // Watch userlist for image updates so future messages pick them up
  function observeUserlist(){
    const ul = $("#userlist"); if (!ul || ul._btfw_avatar_ul_obs) return;
    ul._btfw_avatar_ul_obs = true;

    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      const li = n.matches?.(".userlist_item") ? n : n.querySelector?.(".userlist_item");
      if (!li) return;
      const nick = li.dataset?.name || li.getAttribute?.("data-name") || "";
      const img  = $("img", li);
      if (nick && img && img.src && !img.src.startsWith("data:")) mapPut(nick, img.src);
    }))).observe(ul, {childList:true, subtree:true});
  }

  /* ---------------- Harvest avatar from profile popups/modals ----------------
     The old theme learned the real avatar when you hover/click a user to open
     their profile card/modal. We mirror that with broad selectors.
  ----------------------------------------------------------------------------*/
  function harvestFromProfile(root){
    if (!root) return;

    // Find a plausible username
    let nick = "";
    const nameEl =
      root.querySelector('[data-name]') ||
      root.querySelector('.profile-name,.profile-username,.modal-title,.user-name,.username');
    if (nameEl) nick = (nameEl.getAttribute?.("data-name") || nameEl.textContent || "").trim();

    // Find an image inside the profile UI
    const img = root.querySelector('img[src], .profile-image img, .avatar img, .user-picture img') ||
                root.querySelector('img');
    const src = img && img.getAttribute("src");

    if (nick && src && !src.startsWith("data:")) {
      mapPut(nick, src);
    }
  }

  function observeProfiles(){
    const body = document.body; if (!body || body._btfw_profile_obs) return;
    body._btfw_profile_obs = true;

    const selLikelyProfile = [
      "#profilemodal", ".profilemodal", ".profile-modal", ".user-profile-modal",
      ".popover", ".tooltip", ".modal"  // catch common hosts, we filter inside
    ].join(",");

    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.(selLikelyProfile) || n.querySelector?.(selLikelyProfile)) {
        harvestFromProfile(n.matches?.(selLikelyProfile) ? n : n.querySelector(selLikelyProfile));
      } else {
        // sometimes profile-card is injected without wrapper match
        if (n.querySelector?.(".profile-name, .profile-image, .user-picture")) harvestFromProfile(n);
      }
    }))).observe(body, {childList:true, subtree:true});
  }

  /* ---------------- Settings UI ---------------- */
  function injectIntoThemeSettings(){
    const host = $("#btfw-theme-settings-body, #btfw-theme-modal .btfw-theme-body, #btfw-theme-body");
    if (!host) return false;
    if (host.querySelector("#btfw-avatars-settings")) return true;

    const sec = document.createElement("div");
    sec.id = "btfw-avatars-settings";
    sec.className = "btfw-settings-section";
    sec.innerHTML = `
      <div class="btfw-settings-row" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="font-weight:600;opacity:.95;">Chat Avatars</div>
        <label class="radio"><input type="radio" name="btfw-avatars-mode" value="off"> Off</label>
        <label class="radio"><input type="radio" name="btfw-avatars-mode" value="small"> Small</label>
        <label class="radio"><input type="radio" name="btfw-avatars-mode" value="big"> Big</label>
      </div>
    `;
    host.appendChild(sec);

    const mode = getMode();
    $$('input[name="btfw-avatars-mode"]', sec).forEach(i => {
      i.checked = (i.value === mode);
      i.addEventListener("change", () => setMode(i.value));
    });
    return true;
  }

  function ensureFallbackQuickControl(){
    if (injectIntoThemeSettings()) return;
    const actions = $("#chatwrap .btfw-chat-bottombar #btfw-chat-actions");
    if (!actions || $("#btfw-avatars-dd")) return;

    const wrap = document.createElement("div");
    wrap.id = "btfw-avatars-dd";
    wrap.className = "btfw-avatars-dd";
    wrap.innerHTML = `
      <select class="btfw-avatars-select">
        <option value="off">Avatars: Off</option>
        <option value="small">Avatars: Small</option>
        <option value="big">Avatars: Big</option>
      </select>
    `;
    actions.appendChild(wrap);
    const sel = $(".btfw-avatars-select", wrap);
    sel.value = getMode();
    sel.addEventListener("change", () => setMode(sel.value));
  }

  /* ---------------- Boot ---------------- */
  function boot(){
    applyModeClass(getMode());
    observeBuffer();
    observeUserlist();
    observeProfiles();
    injectIntoThemeSettings();
    ensureFallbackQuickControl();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:chat-avatars", setMode };
});

/* --- Compatibility alias so either name works (loader-safe) --- */
BTFW.define("feature:chatAvatars", ["feature:chat-avatars"], async () => {
  // expose a tiny shim so init("feature:chatAvatars") doesn’t fail
  return { name: "feature:chatAvatars" };
});
