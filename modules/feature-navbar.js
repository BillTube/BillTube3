/* BTFW — feature:navbar
   Responsibilities:
   - Keep navbar on top (no layout changes here)
   - Ensure Theme button hook remains (#btfw-theme-btn-nav)
   - Inject current user avatar at the right side of the navbar
     * Source priority: userlist data('profile').image → USEROPTS.avatar → initials fallback
     * Guest fallback: initials button linking to /login
   - Auto-refresh on userlist changes and login/logout/profile events
*/

BTFW.define("feature:navbar", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);

  // ---------- Helpers ----------
  function getUserName(){
    try { return (window.CLIENT && CLIENT.name) ? CLIENT.name : ""; }
    catch(_) { return ""; }
  }

  function findUserlistItem(name){
    if (!name) return null;
    // Most stable: data-name
    const byData = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (byData) return byData;
    // Fallback: scan text
    const items = document.querySelectorAll("#userlist li, #userlist .userlist_item, #userlist .user");
    for (const el of items) {
      const t = (el.textContent || "").trim();
      if (t && t.replace(/\s+/g,"").toLowerCase().startsWith(name.toLowerCase())) return el;
    }
    return null;
  }

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

  function getCyTubeAvatar(){
    try {
      // Many installs expose USEROPTS.avatar; harmless if absent
      return (window.USEROPTS && USEROPTS.avatar) ? USEROPTS.avatar : "";
    } catch(_) { return ""; }
  }

  function initialsDataURL(name, sizePx){
    const colors = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22",
                    "#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad",
                    "#0080a5","#34495e","#2c3e50"];
    const seed = (name||"?").codePointAt(0) || 63;
    const bg = colors[seed % colors.length];
    const letters = (name||"?").trim().slice(0,2).toUpperCase() || "?";
    const sz = sizePx || 28;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}">
      <rect width="100%" height="100%" rx="${Math.round(sz*0.2)}" fill="${bg}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            fill="#fff" font-family="Inter,Arial,sans-serif" font-weight="600"
            font-size="${Math.round(sz*0.5)}">${letters}</text>
    </svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  function findNavList(){
    // Prefer the list that contains the Theme button (keeps avatar to the right of it)
    const themeBtn = document.getElementById("btfw-theme-btn-nav");
    if (themeBtn) {
      const ul = themeBtn.closest("ul");
      if (ul) return ul;
    }
    // Common fallbacks (Bootstrap/Bulma)
    return document.querySelector(".navbar .nav.navbar-nav")
        || document.querySelector(".navbar-nav")
        || document.querySelector(".navbar .navbar-end ul")
        || document.querySelector(".btfw-navbar ul")
        || document.querySelector(".navbar ul");
  }

  function ensureThemeButtonHook(){
    // If your nav already injects the Theme button elsewhere, we do nothing.
    // This only assigns an ID to an existing Theme button if missing.
    const existing = document.getElementById("btfw-theme-btn-nav");
    if (existing) return;

    // Try to reuse a theme button in nav, or create a minimal one
    const navUL = findNavList();
    if (!navUL) return;

    // Look for any button with sliders icon in nav
    let btn = navUL.querySelector(".fa-sliders, .fa-sliders-h, .fa-sliders-simple, .fa-sliders-h::before");
    if (btn) {
      const a = btn.closest("a,button");
      if (a) {
        a.id = "btfw-theme-btn-nav";
        a.classList.add("button","is-dark","is-small");
        return;
      }
    }

    // As a last resort, add a small Theme button
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.id = "btfw-theme-btn-nav";
    a.className = "button is-dark is-small";
    a.innerHTML = `<i class="fa fa-sliders"></i> Theme`;
    a.href = "javascript:void(0)";
    li.appendChild(a);
    navUL.appendChild(li);

    // Let theme settings wire the click via its own ensureOpeners()
  }

  function buildAvatarElement(name){
    const size = 28;
    let src = name ? (getProfileImgFromUserlist(name) || getCyTubeAvatar() || "") : "";
    if (!src) src = initialsDataURL(name || "Guest", size);

    const a = document.createElement("a");
    a.href   = name ? "/account/profile" : "/login";
    a.target = "_blank";
    a.className = "btfw-nav-avatar-link";
    a.title = name ? name : "Sign in";

    const img = document.createElement("img");
    img.id = "btfw-useravatar";
    img.className = "btfw-nav-avatar";
    img.src = src;
    img.alt = name || "guest";
    img.width = size; img.height = size;

    a.appendChild(img);
    return a;
  }

  function renderAvatar(){
    const navUL = findNavList();
    if (!navUL) return;

    let li = document.getElementById("btfw-nav-avatar-item");
    if (!li) {
      li = document.createElement("li");
      li.id = "btfw-nav-avatar-item";
      li.className = "btfw-nav-avatar-item";
      navUL.appendChild(li);
    } else {
      li.innerHTML = "";
    }

    li.appendChild(buildAvatarElement(getUserName()));
  }

  function pruneNavLinks(){
    const navUL = findNavList();
    if (!navUL) return;
    Array.from(navUL.querySelectorAll("li")).forEach(li => {
      const link = li.querySelector("a");
      if (!link) return;
      const label = (link.textContent || "").trim().toLowerCase();
      const href = (link.getAttribute("href") || "").trim();
      const isHome = label === "home" || href === "/";
      const isLayout = label === "layout" || /layout/i.test(link.dataset?.target || "");
      if (isHome || isLayout) {
        li.remove();
      }
    });
  }

  function refresh(){ pruneNavLinks(); renderAvatar(); }

  // ---------- Boot ----------
  function boot(){
    // Keep existing nav look; only ensure Theme button hook and avatar item.
    ensureThemeButtonHook();
    pruneNavLinks();
    renderAvatar();

    // Refresh when userlist changes (profile image may load later)
    const userlist = $("#userlist");
    if (userlist && !userlist._btfwNavMO){
      const mo = new MutationObserver(()=> refresh());
      mo.observe(userlist, { childList:true, subtree:true });
      userlist._btfwNavMO = mo;
    }

    // Refresh on likely auth/profile events if available
    try {
      if (window.socket && socket.on) {
        socket.on("login", refresh);
        socket.on("logout", refresh);
        socket.on("setProfile", refresh);
        socket.on("userlist", refresh);
      }
    } catch(_) {}

    // Also retry a couple times during early boot in case nav mounts late
    let tries = 0;
    const t = setInterval(()=>{
      tries++;
      const navUL = findNavList();
      if (navUL) { ensureThemeButtonHook(); pruneNavLinks(); renderAvatar(); }
      if (tries > 10 || navUL) clearInterval(t);
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:navbar", refresh };
});
