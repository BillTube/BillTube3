/* BTFW — feature:chat (chat bars, userlist popover, username colors, theme settings opener) */
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/,'') : "");
  
/* --- Shared pop-in positioning helper (exports a global for other modules) --- */
function positionAboveChatBar(el, opts){
  if (!el) return;
  const cw  = document.querySelector("#chatwrap");
  const bar = cw && cw.querySelector(".btfw-chat-bottombar");
  if (!cw || !bar) return;

  const {
    margin = 8,
    widthPx = 560,  // desired width cap
    widthVw = 92,   // fallback cap in vw
    maxHpx = 480,   // desired max height cap
    maxHvh = 70     // fallback cap in vh
  } = (opts || {});

  const cwRect  = cw.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();

  // Make it a fixed overlay and tuck it into the chat’s right edge
  el.style.position  = "fixed";
  el.style.right     = Math.max(margin, window.innerWidth  - cwRect.right + margin) + "px";
  el.style.bottom    = Math.max(margin, window.innerHeight - barRect.top   + margin) + "px";
  el.style.width     = `min(${widthPx}px, ${widthVw}vw)`;
  el.style.maxHeight = `min(${maxHpx}px, ${maxHvh}vh)`;
  el.style.zIndex    = el.style.zIndex || "6002"; // keep above chat, below navbar modals
}
/* expose so other modules can use it */
window.BTFW_positionPopoverAboveChatBar = positionAboveChatBar;

/* Reposition any open pop-ins on resize/scroll/layout changes */
/* Reposition any open pop-ins on resize/scroll/layout changes */
function repositionOpenPopins(){
  const helper = (el, opts) => window.BTFW_positionPopoverAboveChatBar && window.BTFW_positionPopoverAboveChatBar(el, opts);

  // Emotes (visible when NOT .hidden)
  const em = document.getElementById("btfw-emotes-pop");
  if (em && !em.classList.contains("hidden")) {
    helper(em, { widthPx: 560, widthVw: 92, maxHpx: 480, maxHvh: 70 });
  }

  // Chat Tools (modal active -> position its card)
  const ctCard = document.querySelector("#btfw-ct-modal.is-active .btfw-ct-card");
  if (ctCard) {
    helper(ctCard, { widthPx: 420, widthVw: 92, maxHpx: 360, maxHvh: 60 });
  }

  // Userlist (uses display toggling)
  const ul = document.getElementById("btfw-userlist-pop");
  if (ul && ul.style.display !== "none") {
    helper(ul);
  }
}
window.addEventListener("resize", repositionOpenPopins);
window.addEventListener("scroll", repositionOpenPopins, true);
document.addEventListener("btfw:layoutReady", ()=> setTimeout(repositionOpenPopins, 0));


  /* ---------------- Userlist popover (same pattern as Emote popover) ---------------- */
  function adoptUserlistIntoPopover(){
    const body = $("#btfw-userlist-pop .btfw-popbody");
    const ul   = $("#userlist");
    if (!body || !ul) return;
    if (ul.parentElement !== body) {
      ul.classList.add("btfw-userlist-overlay");
      body.appendChild(ul);
    }
  }
function actionsNode(){
  const bar = document.querySelector("#chatwrap .btfw-chat-bottombar");
  return bar && bar.querySelector("#btfw-chat-actions");
}

/* Move our action buttons into the correct spot, remove legacy duplicates */
function normalizeChatActionButtons() {
  const actions = actionsNode(); if (!actions) return;

  // remove legacy/duplicate
  const legacyGif = document.getElementById("btfw-gif-btn");
  if (legacyGif) legacyGif.remove();

  // native emotelist stays hidden; we drive it programmatically as fallback
  const nativeEmoteBtn = document.querySelector("#emotelistbtn, #emotelist");
  if (nativeEmoteBtn) nativeEmoteBtn.style.display = "none";

  // ensure our buttons exist (create if missing)
  if (!document.getElementById("btfw-btn-emotes")) {
    const b = document.createElement("button");
    b.id = "btfw-btn-emotes";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.title = "Emotes / Emoji";
    b.innerHTML = '<i class="fa fa-smile"></i>';
    actions.appendChild(b);
  }
  if (!document.getElementById("btfw-btn-gif")) {
    const b = document.createElement("button");
    b.id = "btfw-btn-gif";
    b.className = "button is-dark is-small btfw-chatbtn";
    b.title = "GIFs";
    b.innerHTML = '<span class="gif-badge">GIF</span>';
    actions.appendChild(b);
  }

  // if some other module created them elsewhere, adopt them
  ["btfw-btn-emotes", "btfw-btn-gif", "btfw-chatcmds-btn", "btfw-users-toggle"].forEach(id=>{
    const el = document.getElementById(id);
    if (el && el.parentElement !== actions) actions.appendChild(el);
  });
}

/* Watch the whole document for late/stray button injections and normalize */
function watchForStrayButtons(){
  if (document._btfw_btn_watch) return;
  document._btfw_btn_watch = true;
  const obs = new MutationObserver(() => normalizeChatActionButtons());
  obs.observe(document.documentElement, { childList:true, subtree:true });
}

  function locateUserlistItem(name){
    if (!name) return null;
    const direct = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (direct) return direct;
    const candidates = document.querySelectorAll('#userlist li, #userlist .userlist_item, #userlist .user');
    for (const el of candidates) {
      const attr = (el.getAttribute && el.getAttribute('data-name')) || '';
      const text = attr || (el.textContent || '');
      if (!text) continue;
      if (text.trim().replace(/:\s*$/, '').toLowerCase() === name.toLowerCase()) return el;
    }
    return null;
  }

  function wireChatUsernameContextMenu(){
    const buf = document.getElementById('messagebuffer');
    if (!buf || buf._btfwNameContext) return;
    buf._btfwNameContext = true;

    buf.addEventListener('click', (ev) => {
      if (ev.button !== 0) return;
      const target = ev.target.closest('.username');
      if (!target) return;
      const raw = (target.textContent || '').trim();
      if (!raw) return;
      const name = raw.replace(/:\s*$/, '');
      if (!name) return;

      const item = locateUserlistItem(name);
      if (!item) return;

      const rect = target.getBoundingClientRect();
      const clientX = ev.clientX || rect.left + rect.width / 2;
      const clientY = ev.clientY || rect.bottom + 6;

      const menuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY
      });

      item.dispatchEvent(menuEvent);
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  function adoptNewMessageIndicator(){
    const indicator = document.getElementById('newmessages-indicator');
    const controls = document.querySelector('#chatwrap .btfw-controls-row');
    if (!indicator || !controls) return;

    indicator.classList.add('btfw-newmessages');
    indicator.style.position = '';
    indicator.style.left = '';
    indicator.style.right = '';
    indicator.style.bottom = '';
    indicator.style.top = '';

    let slot = document.querySelector('#chatwrap .btfw-newmessages-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'btfw-newmessages-slot';
      controls.parentNode?.insertBefore(slot, controls);
    }

    if (indicator.parentElement !== slot) {
      slot.appendChild(indicator);
    }
  }
  function ensureUserlistPopover(){
    if ($("#btfw-userlist-pop")) return;

    // Backdrop — same family as emote popover
    const back = document.createElement("div");
    back.id = "btfw-userlist-backdrop";
    back.className = "btfw-popover-backdrop";
    back.style.display = "none";
    back.style.zIndex = "6001";
    document.body.appendChild(back);

    // Panel
    const pop = document.createElement("div");
    pop.id = "btfw-userlist-pop";
    pop.className = "btfw-popover btfw-userlist-pop";
    pop.style.display = "none";
    pop.style.zIndex = "6002";
    pop.innerHTML = `
      <div class="btfw-pophead">
        <span>Users</span>
        <button class="btfw-popclose" aria-label="Close">&times;</button>
      </div>
      <div class="btfw-popbody"></div>
    `;
    document.body.appendChild(pop);

    adoptUserlistIntoPopover();

    const close = () => {
      back.style.display = "none";
      pop.style.display  = "none";
      const ul = $("#userlist");
      if (ul) ul.classList.remove("btfw-userlist-overlay--open");
    };

    back.addEventListener("click", close);
    pop.querySelector(".btfw-popclose").addEventListener("click", close);
    document.addEventListener("keydown", (ev)=>{ if (ev.key === "Escape") close(); }, true);

    function position(){
    positionAboveChatBar(pop);
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);

    document._btfw_userlist_isOpen = () => pop.style.display !== "none";
    document._btfw_userlist_open   = () => {
      adoptUserlistIntoPopover();
      const ul = $("#userlist");
      if (ul) ul.classList.add("btfw-userlist-overlay--open");
      back.style.display = "block";
      pop.style.display  = "block";
      positionAboveChatBar(pop);
    };
    document._btfw_userlist_close  = close;
    document._btfw_userlist_position = position;
  }

  function toggleUserlist(){
    ensureUserlistPopover();
    if (document._btfw_userlist_isOpen && document._btfw_userlist_isOpen()){
      document._btfw_userlist_close && document._btfw_userlist_close();
    } else {
      document._btfw_userlist_open && document._btfw_userlist_open();
    }
  }

  /* ---------------- Chat bars & actions ---------------- */
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    // Top bar (Now Playing slot — feature:nowplaying moves #currenttitle here)
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = `
        <div class="btfw-chat-topbar-left">
          <div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>
        </div>
        <div class="btfw-chat-topbar-actions" id="btfw-chat-topbar-actions"></div>
      `;
      cw.prepend(top);
    }

    let left = top.querySelector(".btfw-chat-topbar-left");
    if (!left) {
      left = document.createElement("div");
      left.className = "btfw-chat-topbar-left";
      top.prepend(left);
    }

    if (!left.querySelector("#btfw-nowplaying-slot")) {
      const slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      left.appendChild(slot);
    }

    let topActions = top.querySelector("#btfw-chat-topbar-actions");
    if (!topActions) {
      topActions = document.createElement("div");
      topActions.id = "btfw-chat-topbar-actions";
      topActions.className = "btfw-chat-topbar-actions";
      top.appendChild(topActions);
    }

    if (!topActions.querySelector("#btfw-mobile-modules-toggle")) {
      const btn = document.createElement("button");
      btn.id = "btfw-mobile-modules-toggle";
      btn.className = "button is-dark is-small btfw-chatbtn";
      btn.title = "Modules";
      btn.setAttribute("aria-label", "Toggle modules stack");
      btn.innerHTML = '<i class="fa fa-bars"></i>';
      topActions.appendChild(btn);
    }

    // Bottom bar + actions
    let bottom = cw.querySelector(".btfw-chat-bottombar");
    if (!bottom) {
      bottom = document.createElement("div");
      bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = '<div class="btfw-chat-actions" id="btfw-chat-actions"></div>';
      cw.appendChild(bottom);
    }
    const actions = bottom.querySelector("#btfw-chat-actions");

    // 🔹 Remove deprecated/duplicate buttons from previous versions
    const oldGif = $("#btfw-gif-btn");            if (oldGif) oldGif.remove();
    const chatTheme = $("#btfw-theme-btn-chat");  if (chatTheme) chatTheme.remove();

    // 🔹 Emotes button (ours) — lives in actions
    if (!$("#btfw-btn-emotes")) {
      const b = document.createElement("button");
      b.id = "btfw-btn-emotes";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "Emotes / Emoji";
      b.innerHTML = '<i class="fa fa-smile"></i>';
      actions.appendChild(b);
    }

    // Hide the native emotelist button if it exists (we’ll trigger it programmatically)
    const nativeEmoteBtn = $("#emotelistbtn, #emotelist");
    if (nativeEmoteBtn) nativeEmoteBtn.style.display = "none";

    // 🔹 GIF button (ours) — lives in actions
    if (!$("#btfw-btn-gif")) {
      const b = document.createElement("button");
      b.id = "btfw-btn-gif";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "GIFs";
      b.innerHTML = '<span class="gif-badge">GIF</span>';
      actions.appendChild(b);
    }

    // 🔹 Chat commands button — move into actions if it exists elsewhere
    const cmds = $("#btfw-chatcmds-btn");
    if (cmds && cmds.parentElement !== actions) {
      cmds.classList.add("button","is-dark","is-small","btfw-chatbtn");
      actions.appendChild(cmds);
    }

    // Users button (keep)
    if (!$("#btfw-users-toggle")) {
      const b = document.createElement("button");
      b.id = "btfw-users-toggle";
      b.className = "button is-dark is-small btfw-chatbtn";
      b.title = "Users";
      b.innerHTML = '<i class="fa fa-users"></i>';
      actions.appendChild(b);
    }

    // Buffer & controls layout
    const msg = $("#messagebuffer"); if (msg) msg.classList.add("btfw-messagebuffer");
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom) {
      controls.classList.add("btfw-controls-row");
      bottom.after(controls);
    }
    normalizeChatActionButtons();
    wireChatUsernameContextMenu();
    adoptNewMessageIndicator();

    document.dispatchEvent(new CustomEvent("btfw:chat:barsReady", {
      detail: {
        topbar: top,
        bottombar: bottom,
        actions: topActions
      }
    }));
  }

  /* ---------------- Usercount to bottom-right & remove #chatheader ---------------- */
  function ensureUsercountInBar(){
    const cw  = $("#chatwrap"); if (!cw) return;
    const bar = cw.querySelector(".btfw-chat-bottombar"); if (!bar) return;

    let right = bar.querySelector(".btfw-chat-right");
    if (!right) {
      right = document.createElement("div");
      right.className = "btfw-chat-right";
      bar.appendChild(right);
    }

    let uc = $("#usercount");
    if (!uc) uc = Object.assign(document.createElement("div"), { id:"usercount" });
    uc.classList.add("btfw-usercount");

    if (!uc.querySelector(".btfw-usercount-num")) {
      uc.innerHTML = `<i class="fa fa-users" aria-hidden="true"></i>
                      <span class="btfw-usercount-num">0</span>`;
    } else {
      const num = uc.textContent.match(/\d+/);
      uc.innerHTML = `<i class="fa fa-users" aria-hidden="true"></i>
                      <span class="btfw-usercount-num">${num ? num[0] : "0"}</span>`;
    }
    right.appendChild(uc);

    const ch = $("#chatheader");
    if (ch) ch.remove();

    updateUsercount();
    wireUsercountUpdatesOnce();
  }
  function updateUsercount(explicit){
    let count = (typeof explicit === "number") ? explicit : 0;
    if (!count) {
      const ul = $("#userlist");
      if (ul) {
        let els = ul.querySelectorAll("li");
        if (!els.length) els = ul.querySelectorAll(".userlist_item, .nick, .user");
        count = els.length || 0;
      }
      if (!count) {
        const uc = $("#usercount");
        const m  = uc && uc.textContent && uc.textContent.match(/\d+/);
        if (m) count = parseInt(m[0], 10) || 0;
      }
    }
    const numEl = $("#usercount .btfw-usercount-num");
    if (numEl) numEl.textContent = String(count);
  }
  function wireUsercountUpdatesOnce(){
    if (document._btfw_uc_wired) return;
    document._btfw_uc_wired = true;

    const ul = $("#userlist");
    if (ul) new MutationObserver(()=>updateUsercount()).observe(ul, {childList:true, subtree:true});

    if (window.socket && typeof window.socket.on === "function") {
      try {
        socket.on("addUser",      ()=>updateUsercount());
        socket.on("userLeave",    ()=>updateUsercount());
        socket.on("rank",         ()=>updateUsercount());
        socket.on("setUserCount", (n)=>updateUsercount(n));
        socket.on("userlist",     ()=>updateUsercount());
      } catch(_) {}
    }
    window.addEventListener("resize", ()=>updateUsercount());
  }

  /* ---------------- Deterministic username colors ---------------- */
  function colorizeUser(el){
    const n = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!n) return;
    const t = (n.textContent||"").replace(":","").trim(); if(!t) return;
    let hash=0; for(let i=0;i<t.length;i++) hash=t.charCodeAt(i)+((hash<<5)-hash);
    let c="#"; for(let i=0;i<3;i++) c+=("00"+((hash>>(i*8))&0xff).toString(16)).slice(-2);
    n.style.color=c;
  }

  /* ---------------- Observe chat DOM (re-adopt userlist if re-rendered) ---------------- */
  function observeChatDom(){
    const cw = $("#chatwrap"); if (!cw || cw._btfw_chat_obs) return;
    cw._btfw_chat_obs = true;

    new MutationObserver(()=>{
      ensureBars();
      adoptUserlistIntoPopover();
      adoptNewMessageIndicator();
    }).observe(cw,{childList:true,subtree:true});

    const buf = $("#messagebuffer");
    if (buf && !buf._btfw_color_obs){
      buf._btfw_color_obs = true;
      new MutationObserver(muts=>{
        muts.forEach(r=>{
          r.addedNodes.forEach(n=>{
            if (n.nodeType===1) colorizeUser(n);
          });
        });
      }).observe(buf,{childList:true});
      Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorizeUser);
    }
  }

  /* ---------------- Theme Settings opener (unchanged) ---------------- */
  function loadScript(src){
    return new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src = src; s.async=true; s.defer=true;
      s.onload = ()=> res(true);
      s.onerror= ()=> rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  let _tsLoading = false;
  async function openThemeSettings(){
    document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
    let modal = $("#btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }
    await new Promise(r => setTimeout(r, 40));
    modal = $("#btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }

    if (_tsLoading) return;
    _tsLoading = true;
    try {
      const url = BASE ? `${BASE}/modules/feature-theme-settings.js` : "/modules/feature-theme-settings.js";
      await loadScript(url);
      document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      await new Promise(r => setTimeout(r, 40));
      modal = $("#btfw-theme-modal");
      if (modal) modal.classList.add("is-active");
    } catch(e){
      console.warn("[chat] Theme Settings lazy-load failed:", e.message||e);
    } finally {
      _tsLoading = false;
    }
  }

  /* ---------------- Delegated clicks ---------------- */
  function wireDelegatedClicks(){
    if (window._btfwChatClicksWired) return;
    window._btfwChatClicksWired = true;

    document.addEventListener("click", function(e){
      const t = e.target;
      const gifBtn   = t.closest && t.closest("#btfw-btn-gif");
      const emoBtn   = t.closest && t.closest("#btfw-btn-emotes");
      const themeBtn = t.closest && (t.closest("#btfw-theme-btn-nav")); // chat theme button removed
      const usersBtn = t.closest && t.closest("#btfw-users-toggle");
      const cmdsBtn  = t.closest && t.closest("#btfw-chatcmds-btn");

      if (gifBtn) { e.preventDefault(); document.dispatchEvent(new Event("btfw:openGifs")); return; }

      if (emoBtn) {
        e.preventDefault();
        // Prefer our emote popover if present
        const ev = new Event("btfw:openEmotes");
        document.dispatchEvent(ev);
        // Fallback to native emotelist button if no handler created the popover
        setTimeout(()=>{
          const existing = document.querySelector(".btfw-emote-pop,.btfw-popover.btfw-emote-pop");
          if (!existing) {
            const nativeBtn = document.querySelector("#emotelistbtn, #emotelist");
            if (nativeBtn) nativeBtn.click();
          }
        }, 10);
        return;
      }

      if (themeBtn) { e.preventDefault(); openThemeSettings(); return; }

      if (usersBtn) { e.preventDefault(); toggleUserlist(); return; }

      if (cmdsBtn) {
        e.preventDefault();
        // Let chat-commands module handle it
        document.dispatchEvent(new Event("btfw:openChatCmds"));
        return;
      }
    }, true);
  }

  /* ---------------- Boot ---------------- */
  function boot(){
    ensureBars();
    ensureUsercountInBar();
    ensureUserlistPopover();
    observeChatDom();
    wireDelegatedClicks();
	watchForStrayButtons();

  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat" };
});