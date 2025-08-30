
BTFW.define("feature:chat-avatars", ["feature:chat"], async ({}) => {
  const $q  = (s, r=document) => r.querySelector(s);
  const $$q = (s, r=document) => Array.from(r.querySelectorAll(s));
  const jQ  = window.jQuery || window.$;    // CyTube uses jQuery; we’ll use it here.

  const LS_MODE = "btfw:avatars:mode";      // "off" | "small" | "big"
  const DEFAULT_MODE = "small";

  /* ---------- Initials SVG (same palette) ---------- */
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

  /* ---------- Resolve avatar via userlist jQuery data (old theme method) ---------- */
  function findUserlistItem(nick){
    if (!jQ) return null;
    const $items = jQ("#userlist .userlist_item");
    if (!$items.length) return null;
    const $hit = $items.filter(function(){
      const $li = jQ(this);
      const d   = $li.data() || {};
      const dn  = d.name || d.nick || d.username || $li.attr("data-name");
      return dn === nick;
    }).first();
    return $hit.length ? $hit : null;
  }

  function resolveAvatarURL(nick){
    // 1) jQuery data from userlist (profile.image)
    const $li = findUserlistItem(nick);
    if ($li){
      const d = $li.data && $li.data();
      if (d && d.profile && d.profile.image) return d.profile.image;
      if (d && d.image) return d.image;
      const $img = $li.find("img");      // 2) any <img> in userlist entry
      if ($img && $img.length && $img[0].src && !$img[0].src.startsWith("data:")) return $img[0].src;
    }

    // 3) explicit fallback file like the old theme (uses global DROPBOX if present)
    if (typeof window.DROPBOX === "string" && window.DROPBOX) {
      return window.DROPBOX.replace(/\/?$/, "/") + "xor4ykvsgrzys3d/noavatar.png";
    }

    // 4) no URL -> caller will generate initials SVG
    return "";
  }

  /* ---------- Modes ---------- */
  function getMode(){
    try { return localStorage.getItem(LS_MODE) || DEFAULT_MODE; } catch(e){ return DEFAULT_MODE; }
  }
  function setMode(mode){
    try { localStorage.setItem(LS_MODE, mode); } catch(e){}
    applyModeClass(mode);
    $$q("#messagebuffer .chat-msg").forEach(decorateMessage);
  }
  function applyModeClass(mode){
    const wrap = $q("#chatwrap"); if (!wrap) return;
    wrap.classList.remove("btfw-avatars-off","btfw-avatars-small","btfw-avatars-big");
    wrap.classList.add("btfw-avatars-"+mode);
  }

  /* ---------- Message decoration ---------- */
  function usernameOf(msg){
    const u = msg.querySelector(".username,.nick,.name");
    return u ? (u.textContent || "").trim() : "";
  }

  function prevUserMsg(node){
    let p = node.previousElementSibling;
    while (p){ if (p.classList?.contains("chat-msg")) return p; p = p.previousElementSibling; }
    return null;
  }

  function decorateMessage(msg){
    if (!msg || msg._btfw_avatar_done || !msg.classList?.contains("chat-msg")) return;
    msg._btfw_avatar_done = true;

    const mode = getMode(); if (mode === "off") return;
    if (msg.classList.contains("server-msg") || msg.classList.contains("cm")) return;

    const nick = usernameOf(msg); if (!nick) return;

    // Consecutive collapse
    const prev = prevUserMsg(msg);
    if (prev && usernameOf(prev) === nick) msg.classList.add("btfw-consecutive");

    if (msg.querySelector(".btfw-chat-avatar")) return;

    const size = (mode === "big") ? 40 : 28;
    let url = resolveAvatarURL(nick);
    if (!url) url = initialsDataURL(nick, size, Math.round(size/3));

    const u = msg.querySelector(".username,.nick,.name");
    if (!u) return;

    const img = document.createElement("img");
    img.className = "btfw-chat-avatar";
    img.src = url; img.width = size; img.height = size; img.alt = nick;

    u.parentNode.insertBefore(img, u);
    msg.classList.add("btfw-has-avatar");
  }

  /* ---------- Observe buffer + userlist (refresh when profiles change) ---------- */
  function observeBuffer(){
    const buf = $q("#messagebuffer");
    if (!buf || buf._btfw_avatar_obs) return;
    buf._btfw_avatar_obs = true;

    $$q("#messagebuffer .chat-msg").forEach(decorateMessage);
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList.contains("chat-msg")) decorateMessage(n);
    }))).observe(buf, {childList:true});
  }

  function observeUserlist(){
    if (!jQ) return;
    const el = $q("#userlist"); if (!el || el._btfw_ul_obs) return;
    el._btfw_ul_obs = true;

    // When userlist re-renders or data changes, re-decorate new messages (future ones pick it up)
    new MutationObserver(() => {
      // No need to scrub existing; new messages will resolve URL again
    }).observe(el, {childList:true, subtree:true});
  }

  /* ---------- Add current user's avatar to navbar (old theme parity) ---------- */
  function injectNavbarAvatar(){
    if (!jQ) return;
    const name = (window.CLIENT && CLIENT.name) || "";
    if (!name) return;

    const $navbarNav =
      jQ(".navbar .nav.navbar-nav").first().length     ? jQ(".navbar .nav.navbar-nav").first() :
      jQ("#nav-collapsible ul.nav").first().length     ? jQ("#nav-collapsible ul.nav").first() :
      jQ("ul.navbar-nav").first();

    if (!$navbarNav || !$navbarNav.length) return;
    if ($navbarNav.find("#useravatar").length) return; // already added

    let img = resolveAvatarURL(name);
    if (!img) {
      // if no URL and no DROPBOX, use initials SVG so something shows
      const data = initialsDataURL(name, 24, 6);
      img = data;
    }

    const html = `
      <li class="centered">
        <a href="/account/profile" target="_blank">
          <img id="useravatar" src="${img}" title="${name}" alt="User Avatar" />
        </a>
      </li>`;
    $navbarNav.append(html);
  }

  /* ---------- Boot ---------- */
  function boot(){
    applyModeClass(getMode());
    observeBuffer();
    observeUserlist();
    injectNavbarAvatar();
  }

  document.addEventListener("btfw:layoutReady", () => setTimeout(boot, 0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:chat-avatars", setMode };
});

/* Compatibility alias so init("feature:chatAvatars") also works */
BTFW.define("feature:chatAvatars", ["feature:chat-avatars"], async () => ({ name: "feature:chatAvatars" }));
