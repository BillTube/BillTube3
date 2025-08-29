/* BillTube Framework — feature:chat-avatars
   - Avatars next to chat messages
   - Sizes: off | small | big (persisted)
   - Consecutive messages: collapse avatar on following lines
   - Fallback: initials SVG when user has no CyTube avatar
   - Settings UI: integrates into Theme Settings if present; otherwise adds a tiny dropdown in the chat bottom bar.
*/
BTFW.define("feature:chat-avatars", ["feature:chat"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_KEY = "btfw:avatars:mode";          // "off" | "small" | "big"
  const DEFAULT_MODE = "small";

  /* -------------------- Initials SVG fallback (BillTube2 style) -------------------- */
  const COLORS = ["#1abc9c", "#16a085", "#f1c40f", "#f39c12", "#2ecc71", "#27ae60", "#e67e22",
                  "#d35400", "#3498db", "#2980b9", "#e74c3c", "#c0392b", "#9b59b6", "#8e44ad",
                  "#0080a5", "#34495e", "#2c3e50", "#87724b", "#7300a7", "#ec87bf", "#d870ad",
                  "#f69785", "#9ba37e", "#b49255", "#a94136"];

  function initialsDataURL(name, size, radius=8){
    name = (name || "?").trim();
    const glyph = (name.split(/\s+/).map(s => s[0]).join("").slice(0,2) || "?").toUpperCase();
    const seed = glyph.charCodeAt(0) + (glyph.charCodeAt(1)||0);
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

  /* -------------------- Avatar source resolution -------------------- */
  function getCytubeAvatarURL(nick){
    // Try to read from userlist (if CyTube renders avatars there)
    const li = $(`#userlist .userlist_item[data-name="${CSS.escape(nick)}"]`) ||
               $$("#userlist .userlist_item").find(li => (li.dataset && li.dataset.name === nick));
    if (li){
      const img = $("img", li);
      if (img && img.src && !img.src.startsWith("data:")) return img.src;
    }
    // Optional: local override support, e.g. from previous theme
    try {
      const map = JSON.parse(localStorage.getItem("btfw:avatar:map")||"{}");
      if (map[nick]) return map[nick];
    } catch(e){}
    return "";
  }

  /* -------------------- Mode persistence -------------------- */
  function getMode(){
    try { return localStorage.getItem(LS_KEY) || DEFAULT_MODE; } catch(e){ return DEFAULT_MODE; }
  }
  function setMode(mode){
    try { localStorage.setItem(LS_KEY, mode); } catch(e){}
    applyModeClass(mode);
    // reflow existing messages
    $$(`#messagebuffer .chat-msg`).forEach(decorateMessage);
  }
  function applyModeClass(mode){
    const wrap = $("#chatwrap"); if (!wrap) return;
    wrap.classList.remove("btfw-avatars-off","btfw-avatars-small","btfw-avatars-big");
    wrap.classList.add("btfw-avatars-"+mode);
  }

  /* -------------------- Decorate messages -------------------- */
  function usernameOf(msg){
    // CyTube usually renders .username span
    const u = $(".username,.nick,.name", msg);
    return u ? (u.textContent || "").trim() : "";
  }

  function decorateMessage(msg){
    if (!msg || msg._btfw_avatar_done) return;
    msg._btfw_avatar_done = true;
    if (!msg.classList.contains("chat-msg")) return;

    const mode = getMode();
    if (mode === "off") return;

    const nick = usernameOf(msg);
    if (!nick) return;

    // Skip server status / system messages if flagged
    if (msg.classList.contains("server-msg") || msg.classList.contains("cm")) return;

    // Check consecutive (previous non-system msg with same user)
    const prev = findPrevUserMessage(msg);
    if (prev && usernameOf(prev) === nick) {
      msg.classList.add("btfw-consecutive");
    }

    // If avatar already exists, bail
    if ($(".btfw-chat-avatar", msg)) return;

    // Resolve URL or fallback initials
    const size = (mode === "big") ? 40 : 28;
    const url = getCytubeAvatarURL(nick) || initialsDataURL(nick, size, size/3);

    // Insert image before username
    const u = $(".username,.nick,.name", msg);
    if (!u) return;

    const img = document.createElement("img");
    img.className = "btfw-chat-avatar";
    img.src = url;
    img.width = img.height = size;
    img.alt = nick;

    u.parentNode.insertBefore(img, u);
    msg.classList.add("btfw-has-avatar");
  }

  function findPrevUserMessage(node){
    let p = node.previousElementSibling;
    while (p){
      if (p.classList && p.classList.contains("chat-msg")) return p;
      p = p.previousElementSibling;
    }
    return null;
  }

  /* -------------------- Observe buffer for new messages -------------------- */
  function observeBuffer(){
    const buf = $("#messagebuffer");
    if (!buf || buf._btfw_avatar_obs) return;
    buf._btfw_avatar_obs = true;
    // Decorate existing first
    $$("#messagebuffer .chat-msg").forEach(decorateMessage);

    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList.contains("chat-msg")) decorateMessage(n);
    }))).observe(buf, {childList:true});
  }

  /* -------------------- Settings UI -------------------- */
  function injectIntoThemeSettings(){
    // If your theme settings modal exposes a body content div, use it
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

    // set current
    const mode = getMode();
    $$('input[name="btfw-avatars-mode"]', sec).forEach(i => {
      i.checked = (i.value === mode);
      i.addEventListener("change", () => setMode(i.value));
    });
    return true;
  }

  function ensureFallbackQuickControl(){
    // If Theme Settings modal not present, add a tiny dropdown into chat actions
    if (injectIntoThemeSettings()) return; // already injected

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

  /* -------------------- Boot -------------------- */
  function boot(){
    applyModeClass(getMode());
    observeBuffer();
    // Try to hook into Theme Settings each time it opens
    injectIntoThemeSettings();
    ensureFallbackQuickControl();
  }

  // Re-run when layout is rebuilt or settings open
  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));
  document.addEventListener("btfw:themeSettings:open", () => setTimeout(injectIntoThemeSettings, 0));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:chat-avatars", setMode };
});
