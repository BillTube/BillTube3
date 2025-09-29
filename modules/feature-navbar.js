
BTFW.define("feature:navbar", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);

  const MOBILE_BREAKPOINT = 768;
  let navToggleButton = null;
  let mobileNavActive = false;
  let mobileNavHandlersBound = false;

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

  function styleThemeButton(btn){
    if (!btn) return;
    btn.id = "btfw-theme-btn-nav";
    btn.classList.add("btfw-nav-pill");
    btn.classList.remove("button","is-dark","is-small","btn","btn-default","is-primary");
    if (btn.tagName === "BUTTON" && !btn.hasAttribute("type")) {
      btn.type = "button";
    }
    if (!btn.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", "Theme settings");
    }
  }

  function ensureThemeButtonHook(){
    // If your nav already injects the Theme button elsewhere, we do nothing.
    // This only assigns an ID to an existing Theme button if missing.
    const existing = document.getElementById("btfw-theme-btn-nav");
    if (existing) { styleThemeButton(existing); return; }

    // Try to reuse a theme button in nav, or create a minimal one
    const navUL = findNavList();
    if (!navUL) return;

    // Look for any button with sliders icon in nav
    let btn = navUL.querySelector(".fa-sliders, .fa-sliders-h, .fa-sliders-simple, .fa-sliders-h::before");
    if (btn) {
      const a = btn.closest("a,button");
      if (a) {
        styleThemeButton(a);
        return;
      }
    }

    // As a last resort, add a small Theme button
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.innerHTML = `
      <span class="btfw-nav-pill__icon" aria-hidden="true"><i class="fa fa-sliders"></i></span>
      <span class="btfw-nav-pill__label">Theme</span>
    `;
    a.href = "javascript:void(0)";
    styleThemeButton(a);
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

  function refresh(){
    pruneNavLinks();
    renderAvatar();
    setupMobileNav();
  }

  function ensureMobileToggle(){
    const host = document.getElementById("btfw-navhost");
    if (!host) return null;
    if (!navToggleButton) {
      navToggleButton = document.createElement("button");
      navToggleButton.id = "btfw-nav-toggle";
      navToggleButton.type = "button";
      navToggleButton.className = "btfw-nav-toggle";
      navToggleButton.setAttribute("aria-expanded", "false");
      navToggleButton.setAttribute("aria-label", "Open navigation");
      navToggleButton.innerHTML = `
        <span class="btfw-nav-toggle__bars" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <span class="btfw-nav-toggle__label">Menu</span>
      `;
      navToggleButton.addEventListener("click", () => {
        const hostEl = document.getElementById("btfw-navhost");
        if (!hostEl) return;
        const isOpen = hostEl.getAttribute("data-mobile-open") === "true";
        const next = !isOpen;
        hostEl.setAttribute("data-mobile-open", next ? "true" : "false");
        syncToggleState();
      });
    }
    if (navToggleButton.parentElement !== host) {
      host.insertBefore(navToggleButton, host.firstChild);
    }
    return navToggleButton;
  }

  function syncToggleState(){
    const host = document.getElementById("btfw-navhost");
    if (!host || !navToggleButton) return;
    const isOpen = host.getAttribute("data-mobile-open") === "true";
    
    // ✅ FIX: Only update attributes if they changed
    const currentExpanded = navToggleButton.getAttribute("aria-expanded");
    if (currentExpanded !== (isOpen ? "true" : "false")) {
      navToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
    
    const currentLabel = navToggleButton.getAttribute("aria-label");
    const newLabel = isOpen ? "Close navigation" : "Open navigation";
    if (currentLabel !== newLabel) {
      navToggleButton.setAttribute("aria-label", newLabel);
    }
    
    navToggleButton.classList.toggle("btfw-nav-toggle--open", isOpen);
    
    const label = navToggleButton.querySelector(".btfw-nav-toggle__label");
    if (label) {
      const newText = isOpen ? "Close" : "Menu";
      // ✅ FIX: ONLY UPDATE IF CHANGED
      if (label.textContent !== newText) {
        label.textContent = newText;
      }
    }
  }

  function updateMobileNavState(){
    const host = document.getElementById("btfw-navhost");
    if (!host) return;
    ensureMobileToggle();
    const shouldEnable = window.innerWidth <= MOBILE_BREAKPOINT;
    host.classList.toggle("btfw-navhost--mobile", shouldEnable);
    if (shouldEnable) {
      if (!mobileNavActive) {
        host.setAttribute("data-mobile-open", "false");
        mobileNavActive = true;
      }
    } else {
      host.setAttribute("data-mobile-open", "true");
      mobileNavActive = false;
    }
    syncToggleState();
  }

  function setupMobileNav(){
    const host = document.getElementById("btfw-navhost");
    if (!host) return;
    ensureMobileToggle();
    updateMobileNavState();
    if (mobileNavHandlersBound) return;
    mobileNavHandlersBound = true;
    window.addEventListener("resize", () => updateMobileNavState());
    host.addEventListener("click", (ev) => {
      if (window.innerWidth > MOBILE_BREAKPOINT) return;
      if (!host) return;
      const target = ev.target.closest?.('#btfw-navhost a, #btfw-navhost button');
      if (!target || target === navToggleButton) return;
      host.setAttribute("data-mobile-open", "false");
      syncToggleState();
    }, true);
  }

  // ---------- Boot ----------
  function boot(){
    // Keep existing nav look; only ensure Theme button hook and avatar item.
    ensureThemeButtonHook();
    pruneNavLinks();
    renderAvatar();
    setupMobileNav();

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
      if (navUL) { ensureThemeButtonHook(); pruneNavLinks(); renderAvatar(); setupMobileNav(); }
      if (tries > 10 || navUL) clearInterval(t);
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:navbar", refresh };
});

