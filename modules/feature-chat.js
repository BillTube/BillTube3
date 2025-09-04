/* BTFW — feature:chat (chat bars, userlist popover, username colors, robust Theme Settings opener)
   Debugging: set localStorage 'btfw:debug:chat' to '1' to enable console logs.
*/
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/,'') : "");

  let DEBUG = false;
  try {
    const v = localStorage.getItem("btfw:debug:chat");
    if (v !== null) DEBUG = v === "1";
  } catch(e){}
  const log  = (...a)=>{ if (DEBUG) console.debug("[BTFW chat]", ...a); };
  const warn = (...a)=>{ console.warn("[BTFW chat]", ...a); };

  /* ---------------- Userlist POPUP (mini modal like emote popover) ---------------- */
  function adoptUserlistIntoPopover(){
    const popBody = $("#btfw-userlist-pop .btfw-popbody");
    const ul = $("#userlist");
    if (!popBody) { log("adoptUserlistIntoPopover: no .btfw-popbody yet"); return; }
    if (!ul) { warn("adoptUserlistIntoPopover: #userlist not found"); return; }
    if (ul.parentElement !== popBody) {
      log("Adopting #userlist into popover body");
      ul.classList.add("btfw-userlist-overlay");
      popBody.appendChild(ul);
    } else {
      log("Userlist already inside popover");
    }
  }

  function buildUserlistPopover(){
    if ($("#btfw-userlist-pop")) { log("Popover already built"); return; }
    log("Building userlist popover/backdrop");

    // Backdrop
    const back = document.createElement("div");
    back.id = "btfw-userlist-backdrop";
    back.className = "btfw-popbackdrop";
    back.style.display = "none";
    document.body.appendChild(back);

    // Panel
    const pop = document.createElement("div");
    pop.id = "btfw-userlist-pop";
    pop.className = "btfw-popover btfw-userlist-pop";
    pop.style.display = "none";
    pop.innerHTML = `
      <div class="btfw-pophead">
        <span>Users</span>
        <button class="btfw-popclose" aria-label="Close">&times;</button>
      </div>
      <div class="btfw-popbody"></div>
    `;
    document.body.appendChild(pop);

    // Move #userlist in if present now
    adoptUserlistIntoPopover();

    // Close only via explicit actions (no hover-close)
    const close = () => {
      log("Close userlist popover");
      back.style.display = "none"; pop.style.display = "none";
	  const ul = $("#userlist");
	  if (ul) ul.classList.remove("btfw-userlist-overlay--open");
    };
    back.addEventListener("click", close);
    pop.querySelector(".btfw-popclose").addEventListener("click", close);
    document.addEventListener("keydown", (ev)=>{ if (ev.key === "Escape") close(); }, true);

    // Position near chat bottom bar (same anchor as emote popover)
    function position(){
      const cw  = $("#chatwrap");
      const bar = cw && cw.querySelector(".btfw-chat-bottombar");
      if (!cw || !bar) { log("position(): missing chatwrap or bottombar"); return; }

      const cwRect  = cw.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();

      const right  = Math.max(8, window.innerWidth  - cwRect.right + 8);
      const bottom = Math.max(8, window.innerHeight - barRect.top + 8);

      pop.style.right  = right + "px";
      pop.style.bottom = bottom + "px";
      pop.style.maxHeight = "min(480px, 70vh)";
      pop.style.width     = "min(560px, 92vw)";
    }
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);

    // Safe open/close available to other code
    document._btfw_userlist_open  = function(){
      log("Open userlist popover (safe)");
      adoptUserlistIntoPopover();
	  const ul = $("#userlist");
	  if (ul) ul.classList.add("btfw-userlist-overlay--open");
      back.style.display = "block";
      pop.style.display  = "block";
      position();
    };
    document._btfw_userlist_close = close;
    document._btfw_userlist_position = position;

    log("Userlist popover built");
  }

  // Safe opener used by the Users button
  function openUserlistSafe(){
    if (!$("#btfw-userlist-pop")) {
      log("Users button: popover missing, building now");
      buildUserlistPopover();
    }
    if (typeof document._btfw_userlist_open === "function") {
      document._btfw_userlist_open();
    } else {
      warn("Users button: _btfw_userlist_open missing after build");
    }
  }

  /* ---------------- Chat bars & actions ---------------- */
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) { warn("ensureBars: #chatwrap not found"); return; }
    cw.classList.add("btfw-chatwrap");
    log("ensureBars: start");

    // Top bar + slot (feature:nowplaying will move #currenttitle here)
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = '<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>';
      cw.prepend(top);
      log("ensureBars: created .btfw-chat-topbar");
    }
    if (!top.querySelector("#btfw-nowplaying-slot")) {
      const slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
      log("ensureBars: ensured #btfw-nowplaying-slot");
    }

    // Bottom bar + actions
    let bottom = cw.querySelector(".btfw-chat-bottombar");
    if (!bottom) {
      bottom = document.createElement("div");
      bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = '<div class="btfw-chat-actions" id="btfw-chat-actions"></div>';
      cw.appendChild(bottom);
      log("ensureBars: created .btfw-chat-bottombar");
    }
    const actions = bottom.querySelector("#btfw-chat-actions");

    // Move native Emotes down (keep native handlers)
    const emotebtn = $("#emotelistbtn, #emotelist");
    if (emotebtn && emotebtn.parentElement !== actions) {
      emotebtn.className = "button is-dark is-small btfw-chatbtn";
      actions.appendChild(emotebtn);
      log("ensureBars: moved native emote button");
    }

    // Our buttons (idempotent)
    if (!$("#btfw-gif-btn")) {
      const b = document.createElement("button");
      b.id = "btfw-gif-btn"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<span class="gif-badge">GIF</span>';
      actions.appendChild(b);
      log("ensureBars: added #btfw-gif-btn");
    }
    if (!$("#btfw-users-toggle")) {
      const b = document.createElement("button");
      b.id = "btfw-users-toggle"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<i class="fa fa-users"></i>';
      actions.appendChild(b);
      log("ensureBars: added #btfw-users-toggle");
    }
    if (!$("#btfw-theme-btn-chat")) {
      const b = document.createElement("button");
      b.id = "btfw-theme-btn-chat"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<i class="fa fa-sliders"></i>';
      actions.appendChild(b);
      log("ensureBars: added #btfw-theme-btn-chat");
    }

    // Buffer & controls layout
    const msg = $("#messagebuffer");
    if (msg && !msg.classList.contains("btfw-messagebuffer")) {
      msg.classList.add("btfw-messagebuffer");
      log("ensureBars: flagged #messagebuffer");
    }
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom) {
      controls.classList.add("btfw-controls-row");
      bottom.after(controls);
      log("ensureBars: positioned chat controls after bottom bar");
    }

    log("ensureBars: done");
  }

  /* ---------------- Move #usercount to bottom bar right; remove #chatheader ---------------- */
  function ensureUsercountInBar(){
    const cw  = $("#chatwrap"); if (!cw) return;
    const bar = cw.querySelector(".btfw-chat-bottombar"); if (!bar) return;

    let right = bar.querySelector(".btfw-chat-right");
    if (!right) {
      right = document.createElement("div");
      right.className = "btfw-chat-right";
      bar.appendChild(right);
      log("ensureUsercountInBar: created .btfw-chat-right");
    }

    let uc = $("#usercount");
    if (!uc) {
      uc = Object.assign(document.createElement("div"), { id:"usercount" });
      log("ensureUsercountInBar: created #usercount");
    }
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
    if (ch) { ch.remove(); log("ensureUsercountInBar: removed #chatheader"); }

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
    log("updateUsercount:", count);
  }
  function wireUsercountUpdatesOnce(){
    if (document._btfw_uc_wired) return;
    document._btfw_uc_wired = true;
    log("wireUsercountUpdatesOnce: wiring");

    const ul = $("#userlist");
    if (ul) new MutationObserver(()=>updateUsercount()).observe(ul, {childList:true, subtree:true});

    if (window.socket && typeof window.socket.on === "function") {
      try {
        socket.on("addUser",      ()=>updateUsercount());
        socket.on("userLeave",    ()=>updateUsercount());
        socket.on("rank",         ()=>updateUsercount());
        socket.on("setUserCount", (n)=>updateUsercount(n));
        socket.on("userlist",     ()=>updateUsercount());
      } catch(e){ warn("wireUsercountUpdatesOnce: socket wiring error", e); }
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

  /* ---------------- Observe chat DOM to self-heal ---------------- */
  function observeChatDom(){
    const cw = $("#chatwrap"); if (!cw || cw._btfw_chat_obs) return;
    cw._btfw_chat_obs = true;
    log("observeChatDom: start observing chat DOM");

    new MutationObserver((muts)=>{
      // Keep it light; log only when DEBUG
      if (DEBUG) log("chat DOM mutations:", muts.length);
      ensureBars();
      // If CyTube replaces userlist, adopt it back into the popover
      adoptUserlistIntoPopover();
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
      warn("Theme Settings lazy-load failed:", e && e.message || e);
    } finally {
      _tsLoading = false;
    }
  }

  /* ---------------- Delegated clicks ---------------- */
  function wireDelegatedClicks(){
    if (window._btfwChatClicksWired) return;
    window._btfwChatClicksWired = true;
    log("wireDelegatedClicks: wiring");

    document.addEventListener("click", function(e){
      const t = e.target;
      const gif   = t.closest && t.closest("#btfw-gif-btn");
      const theme = t.closest && (t.closest("#btfw-theme-btn-chat") || t.closest("#btfw-theme-btn-nav"));
      const users = t.closest && t.closest("#btfw-users-toggle");

      if (gif)   { e.preventDefault(); log("click: GIF button"); document.dispatchEvent(new Event("btfw:openGifs")); return; }
      if (theme) { e.preventDefault(); log("click: Theme button"); openThemeSettings(); return; }
      if (users) { e.preventDefault(); log("click: Users button"); openUserlistSafe(); return; }
    }, true);
  }

  /* ---------------- Boot ---------------- */
  function boot(){
    log("boot()");
    ensureBars();
    ensureUsercountInBar();
    buildUserlistPopover();   // define popover and opener
    observeChatDom();
    wireDelegatedClicks();
    log("boot: done");
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat" };
});
