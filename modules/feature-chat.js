/* BTFW — feature:chat (chat bars, userlist popover, username colors, robust Theme Settings opener) */
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/,'') : "");

  /* ---------------- Userlist POPUP (replaces old overlay/hover-close behavior) ---------------- */
  function buildUserlistPopover(){
    if ($("#btfw-userlist-pop")) return;

    // Backdrop (same class family used by your emote popover CSS)
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

    // Move the real #userlist into the popover body (we reuse CyTube's list UI)
    const ul = document.getElementById("userlist");
    if (ul) {
      ul.classList.add("btfw-userlist-overlay"); // keep existing skinning hooks
      const body = pop.querySelector(".btfw-popbody");
      body.appendChild(ul);
    }

    // Close only on explicit actions (no hover/mouseleave auto-close)
    const close = () => { back.style.display = "none"; pop.style.display = "none"; };
    back.addEventListener("click", close);
    pop.querySelector(".btfw-popclose").addEventListener("click", close);
    document.addEventListener("keydown", (ev)=>{ if (ev.key === "Escape") close(); }, true);

    // Reposition helper – anchor to chat bottom-right so it behaves like the emote popover
    function position(){
      const cw  = $("#chatwrap");
      const bar = cw && cw.querySelector(".btfw-chat-bottombar");
      const pop = $("#btfw-userlist-pop");
      if (!cw || !bar || !pop) return;

      const cwRect  = cw.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();

      // Align to chat’s right edge, sit just above the bottom bar
      const right  = Math.max(8, window.innerWidth  - cwRect.right + 8);
      const bottom = Math.max(8, window.innerHeight - barRect.top + 8);

      pop.style.right  = right + "px";
      pop.style.bottom = bottom + "px";
      // Width/height are governed by your .btfw-popover CSS; don’t let content push it around
      pop.style.maxHeight = "min(480px, 70vh)";
      pop.style.width     = "min(560px, 92vw)";
    }
    // Keep it in the correct place
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    // Expose for opener
    document._btfw_userlist_position = position;

    // Opener toggler used by the chat buttons
    document._btfw_userlist_open = function openUserlist(){
      back.style.display = "block";
      pop.style.display  = "block";
      position();
    };
    document._btfw_userlist_close = close;
  }

  /* ---------------- Chat bars & actions (unchanged layout) ---------------- */
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    // Top bar + slot (feature:nowplaying will mount #currenttitle here)
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = '<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>';
      cw.prepend(top);
    }
    if (!top.querySelector("#btfw-nowplaying-slot")) {
      const slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.appendChild(slot);
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

    // Move native Emotes down (keep native handlers)
    const emotebtn = $("#emotelistbtn, #emotelist");
    if (emotebtn && emotebtn.parentElement !== actions) {
      emotebtn.className = "button is-dark is-small btfw-chatbtn";
      actions.appendChild(emotebtn);
    }

    // Our buttons (idempotent)
    if (!$("#btfw-gif-btn")) {
      const b = document.createElement("button");
      b.id = "btfw-gif-btn"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<span class="gif-badge">GIF</span>';
      actions.appendChild(b);
    }
    if (!$("#btfw-users-toggle")) {
      const b = document.createElement("button");
      b.id = "btfw-users-toggle"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<i class="fa fa-users"></i>';
      actions.appendChild(b);
    }
    if (!$("#btfw-theme-btn-chat")) {
      const b = document.createElement("button");
      b.id = "btfw-theme-btn-chat"; b.className = "button is-dark is-small btfw-chatbtn";
      b.innerHTML = '<i class="fa fa-sliders"></i>';
      actions.appendChild(b);
    }

    // Buffer & controls layout
    const msg = $("#messagebuffer"); if (msg) msg.classList.add("btfw-messagebuffer");
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom) {
      controls.classList.add("btfw-controls-row");
      bottom.after(controls);
    }
  }

  /* ---------------- Move #usercount into bottom bar right, remove #chatheader ---------------- */
  function ensureUsercountInBar(){
    const cw  = $("#chatwrap");
    if (!cw) return;
    const bar = cw.querySelector(".btfw-chat-bottombar");
    if (!bar) return;

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

  /* ---------------- Observe chat DOM to self-heal ---------------- */
  function observeChatDom(){
    const cw = $("#chatwrap"); if (!cw || cw._btfw_chat_obs) return;
    cw._btfw_chat_obs = true;

    new MutationObserver(()=>ensureBars()).observe(cw,{childList:true,subtree:true});

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
      const gif   = t.closest && t.closest("#btfw-gif-btn");
      const theme = t.closest && (t.closest("#btfw-theme-btn-chat") || t.closest("#btfw-theme-btn-nav"));
      const users = t.closest && t.closest("#btfw-users-toggle");

      if (gif)   { e.preventDefault(); document.dispatchEvent(new Event("btfw:openGifs")); return; }
      if (theme) { e.preventDefault(); openThemeSettings(); return; }
      if (users) { e.preventDefault(); if (document._btfw_userlist_open) document._btfw_userlist_open(); return; }
    }, true);
  }

  /* ---------------- Boot ---------------- */
  function boot(){
    ensureBars();
    ensureUsercountInBar();
    buildUserlistPopover();
    observeChatDom();
    wireDelegatedClicks();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat" };
});
