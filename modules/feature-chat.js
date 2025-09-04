/* BTFW — feature:chat (chat bars, userlist overlay, username colors, robust Theme Settings opener) */
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const BASE = (window.BTFW && BTFW.BASE ? BTFW.BASE.replace(/\/+$/,'') : "");

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
// --- Move #usercount into chat bottom bar (right-aligned) and delete #chatheader ---
function ensureUsercountInBar(){
  const cw  = document.getElementById("chatwrap");
  if (!cw) return;
  const bar = cw.querySelector(".btfw-chat-bottombar");
  if (!bar) return;

  // right slot
  let right = bar.querySelector(".btfw-chat-right");
  if (!right) {
    right = document.createElement("div");
    right.className = "btfw-chat-right";
    bar.appendChild(right);
  }

  // adopt or create #usercount
  let uc = document.getElementById("usercount");
  if (!uc) {
    uc = document.createElement("div");
    uc.id = "usercount";
  }
  uc.classList.add("btfw-usercount");
  // normalize its content to icon + number only
  if (!uc.querySelector(".btfw-usercount-num")) {
    uc.innerHTML = `<i class="fa fa-users" aria-hidden="true"></i>
                    <span class="btfw-usercount-num">0</span>`;
  } else {
    // if it already had other text, strip it down to number
    const num = uc.textContent.match(/\d+/);
    uc.innerHTML = `<i class="fa fa-users" aria-hidden="true"></i>
                    <span class="btfw-usercount-num">${num ? num[0] : "0"}</span>`;
  }
  right.appendChild(uc);

  // remove the old chatheader (per request)
  const ch = document.getElementById("chatheader");
  if (ch) ch.remove();

  // keep it updated
  updateUsercount();
  wireUsercountUpdatesOnce();
}

function updateUsercount(explicit){
  // explicit value supplied by socket? (if your server emits one)
  let count = (typeof explicit === "number") ? explicit : 0;

  if (!count) {
    // fallback: count the userlist items
    const ul = document.getElementById("userlist");
    if (ul) {
      // Try several selectors; CyTube themes can vary
      let els = ul.querySelectorAll("li");
      if (!els.length) els = ul.querySelectorAll(".userlist_item, .nick, .user");
      count = els.length || 0;
    }
    // last-resort: parse any digits already inside usercount
    if (!count) {
      const uc = document.getElementById("usercount");
      const m  = uc && uc.textContent && uc.textContent.match(/\d+/);
      if (m) count = parseInt(m[0], 10) || 0;
    }
  }

  const numEl = document.querySelector("#usercount .btfw-usercount-num");
  if (numEl) numEl.textContent = String(count);
}

function wireUsercountUpdatesOnce(){
  if (document._btfw_uc_wired) return;
  document._btfw_uc_wired = true;

  // Mutation watch on userlist (covers joins/leaves/UI refreshes)
  const ul = document.getElementById("userlist");
  if (ul) new MutationObserver(()=>updateUsercount()).observe(ul, {childList:true, subtree:true});

  // Socket hooks if available (names vary by deployment, wire broadly & harmlessly)
  if (window.socket && typeof window.socket.on === "function") {
    try {
      socket.on("addUser",      ()=>updateUsercount());
      socket.on("userLeave",    ()=>updateUsercount());
      socket.on("rank",         ()=>updateUsercount());
      socket.on("setUserCount", (n)=>updateUsercount(n)); // if your server emits this
      socket.on("userlist",     ()=>updateUsercount());
    } catch(_) {}
  }

  // Also recalibrate on resize (mobile panes collapse/expand)
  window.addEventListener("resize", ()=>updateUsercount());
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

  /* ---------------- Theme Settings opener (event + lazy-load + fallback) ---------------- */
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
    // 1) Ask the proper module to open (your TS module listens for this event)
    document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));

    // 2) If the modal is already present, just show it
    let modal = document.getElementById("btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }

    // 3) Give the listener a tick to create it
    await new Promise(r => setTimeout(r, 40));
    modal = document.getElementById("btfw-theme-modal");
    if (modal) { modal.classList.add("is-active"); return; }

    // 4) Lazy load the module if it's not there yet
    if (_tsLoading) return;
    _tsLoading = true;
    try {
      const url = BASE ? `${BASE}/modules/feature-theme-settings.js` : "/modules/feature-theme-settings.js";
      await loadScript(url);
      // Let it register, then open again
      document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      await new Promise(r => setTimeout(r, 40));
      modal = document.getElementById("btfw-theme-modal");
      if (modal) modal.classList.add("is-active");
    } catch(e){
      console.warn("[chat] Theme Settings lazy-load failed:", e.message||e);
    } finally {
      _tsLoading = false;
    }
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
	ensureUsercountInBar(); 
    observeChatDom();
    wireDelegatedClicks();
  }

  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:chat", toggleUsers };
});
