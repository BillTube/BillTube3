/* BTFW — feature:chat (bars + userlist overlay + robust openers + username colors + now playing) */
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------- Userlist overlay ----------
  function ensureUserlistOverlayClosed() {
    const ul = $("#userlist"); if (!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.remove("btfw-userlist-overlay--open");
    ul.setAttribute("aria-hidden","true");
  }
  function toggleUsers(){
    const ul = $("#userlist"); if (!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    const open = ul.classList.toggle("btfw-userlist-overlay--open");
    ul.setAttribute("aria-hidden", open ? "false" : "true");
  }
  function wireUserlistGlobalClosers(){
    if (document._btfwUserlistClosers) return;
    document._btfwUserlistClosers = true;
    document.addEventListener("click", (ev)=>{
      const ul = $("#userlist"); if (!ul) return;
      if (!ul.classList.contains("btfw-userlist-overlay--open")) return;
      const btn = $("#btfw-users-toggle");
      if (ul.contains(ev.target) || (btn && btn.contains(ev.target))) return;
      ul.classList.remove("btfw-userlist-overlay--open");
      ul.setAttribute("aria-hidden","true");
    }, true);
    document.addEventListener("keydown", (ev)=>{
      if (ev.key !== "Escape") return;
      const ul = $("#userlist"); if (!ul) return;
      ul.classList.remove("btfw-userlist-overlay--open");
      ul.setAttribute("aria-hidden","true");
    }, true);
  }

  // ---------- Chat bars & actions ----------
  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    // Top bar (Now Playing slot)
    let top = $(".btfw-chat-topbar", cw);
    if (!top) {
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = '<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>';
      cw.prepend(top);
    }

    // Bottom bar (Actions)
    let bottom = $(".btfw-chat-bottombar", cw);
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

    // Userlist overlay default CLOSED (v3.3 behavior)
    ensureUserlistOverlayClosed();
  }

  // ---------- Username colors (deterministic hash) ----------
  function colorizeUser(el){
    const n = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!n) return;
    const t = (n.textContent||"").replace(":","").trim(); if(!t) return;
    let hash=0; for(let i=0;i<t.length;i++) hash=t.charCodeAt(i)+((hash<<5)-hash);
    let c="#"; for(let i=0;i<3;i++) c+=("00"+((hash>>(i*8))&0xff).toString(16)).slice(-2);
    n.style.color=c;
  }

  // ---------- Now Playing (robust: socket + DOM + fallback poll) ----------
  function setNowPlayingText(txt){
    const slot = $("#btfw-nowplaying-slot");
    if (slot) slot.textContent = txt || "";
  }
  function readCurrentTitle(){
    // 1) DOM
    const el = $("#currenttitle");
    const raw = el && el.textContent ? el.textContent.trim() : "";
    if (raw) return raw.replace(/^now\s*playing:\s*/i, "");
    // 2) Player
    if (window.PLAYER && window.PLAYER.media && window.PLAYER.media.title) {
      return String(window.PLAYER.media.title);
    }
    return "";
  }
  function syncNowPlaying(){ setNowPlayingText(readCurrentTitle()); }
  function wireNowPlaying(){
    // observe #currenttitle if present
    const ct = $("#currenttitle");
    if (ct && !ct._btfw_np_obs){
      ct._btfw_np_obs = new MutationObserver(syncNowPlaying);
      ct._btfw_np_obs.observe(ct, { childList:true, characterData:true, subtree:true });
    }
    // listen to CyTube socket events if available
    if (window.socket && !window._btfw_np_socket){
      window._btfw_np_socket = true;
      try {
        window.socket.on("changeMedia", data => setNowPlayingText((data && data.title) ? String(data.title) : readCurrentTitle()));
        window.socket.on("setCurrent",   data => setNowPlayingText((data && data.title) ? String(data.title) : readCurrentTitle()));
        window.socket.on("mediaUpdate",  ()=> syncNowPlaying());
      } catch(_) {}
    }
    // fallback poll (cheap)
    if (!document._btfw_np_poll){
      document._btfw_np_poll = setInterval(syncNowPlaying, 2000);
    }
    // initial paint
    syncNowPlaying();
  }

  // ---------- Theme Settings opener (always works) ----------
  function openThemeSettings(){
    // prefer module's open()
    try {
      const mod = BTFW.require("feature:themeSettings");
      if (mod && typeof mod.open === "function") { mod.open(); return; }
    } catch(_) {}
    // generic bridge event + fallback to existing modal if it's already mounted
    document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
    const m = $("#btfw-theme-modal");
    if (m) m.classList.add("is-active");
  }

  // ---------- Observe chat DOM to self-heal ----------
  function observeChatDom(){
    const cw = $("#chatwrap"); if (!cw || cw._btfw_chat_obs) return;
    cw._btfw_chat_obs = true;
    // Rebuild bars/buttons if CyTube re-renders
    new MutationObserver(()=>ensureBars()).observe(cw,{childList:true,subtree:true});
    // Colorize usernames for newly added messages
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
      // first pass
      Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorizeUser);
    }
  }

  // ---------- Delegated click handlers (survive re-renders) ----------
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
      if (users) { e.preventDefault(); toggleUsers(); return; }
    }, true);
  }

  // ---------- Boot ----------
  function boot(){
    wireUserlistGlobalClosers();
    ensureBars();
    observeChatDom();
    wireDelegatedClicks();
    wireNowPlaying();     // <— keep the title synced no matter where it comes from
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat", toggleUsers };
});
