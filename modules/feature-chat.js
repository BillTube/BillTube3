BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ---------------- Userlist overlay (closed by default) ---------------- */
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

  /* ---------------- Chat bars & actions (no now-playing logic here) ---------------- */
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

    // Userlist overlay default CLOSED
    ensureUserlistOverlayClosed();
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
      Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorizeUser);
    }
  }

  /* ---------------- Theme Settings opener (event + fallback, no require) ---------------- */
  function openThemeSettings(){
    // Ask the proper module to open
    document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
    // Fallback: if the modal already exists in DOM, just show it
    setTimeout(()=>{
      const m = document.getElementById("btfw-theme-modal");
      if (m) m.classList.add("is-active");
    }, 0);
  }

  /* ---------------- Delegated clicks (survive re-renders) ---------------- */
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

  /* ---------------- Boot ---------------- */
  function boot(){
    wireUserlistGlobalClosers();
    ensureBars();
    observeChatDom();
    wireDelegatedClicks();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat", toggleUsers };
});
