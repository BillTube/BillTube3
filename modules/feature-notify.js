
BTFW.define("feature:notify", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS_ENABLED = "btfw:notify:enabled";     // "1" | "0"
  const MAX_VISIBLE = 3;                        // max stacked toasts simultaneously
  const DEFAULT_TIMEOUT = 6000;                 // ms
  const KINDS = new Set(["info","success","warn","error"]);

  let enabled = true;
  try { const v = localStorage.getItem(LS_ENABLED); if (v !== null) enabled = v === "1"; } catch(e){}

  // --- container management ----------------------------------------------------
  function ensureStack(){
    // place as the first element of messagebuffer and keep it sticky to the top
    const buf = $("#messagebuffer");
    if (!buf) return null;

    let stack = $("#btfw-notify-stack", buf);
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "btfw-notify-stack";
      // keep markup extremely small; the CSS will handle layout
      buf.prepend(stack);
    }
    return stack;
  }

  // Re-insert the stack if CyTube re-renders the chat
  function observeChat(){
    const cw = $("#chatwrap");
    if (!cw || cw._btfw_notify_obs) return;
    cw._btfw_notify_obs = true;
    new MutationObserver(() => ensureStack()).observe(cw, {childList:true, subtree:true});
  }

  // --- toast queue -------------------------------------------------------------
  const visible = [];
  const queued  = [];

  function showNextFromQueue(){
    if (queued.length && visible.length < MAX_VISIBLE) {
      const next = queued.shift();
      _mountNotice(next);
    }
  }

  // --- Notice creation ---------------------------------------------------------
  function notify(opts){
    if (!enabled) return null;
    const o = Object.assign({
      id: "n_"+Math.random().toString(36).slice(2),
      title: "",
      html: "",
      icon: "",                 // optional HTML/emoji/icon
      kind: "info",             // "info" | "success" | "warn" | "error"
      timeout: DEFAULT_TIMEOUT, // ms; 0 = persistent
      onClick: null,            // (evt)=>{}
      actions: []               // [{label, onclick}] optional
    }, opts||{});
    if (!KINDS.has(o.kind)) o.kind = "info";

    // element (not mounted yet)
    o.el = buildCard(o);

    if (visible.length >= MAX_VISIBLE) {
      queued.push(o);
    } else {
      _mountNotice(o);
    }
    return o;
  }

  function _mountNotice(o){
    const stack = ensureStack();
    if (!stack) { queued.push(o); return; }

    visible.push(o);
    stack.appendChild(o.el);

    if (o.timeout > 0) startAutoclose(o);
  }

  function buildCard(o){
    const card = document.createElement("div");
    card.className = `btfw-notice btfw-notice--${o.kind}`;
    card.setAttribute("role","status");
    card.setAttribute("aria-live","polite");

    card.innerHTML = `
      <div class="btfw-notice-head">
        <div class="btfw-notice-titlewrap">
          ${o.icon ? `<span class="btfw-notice-icon">${o.icon}</span>` : ``}
          <strong class="btfw-notice-title"></strong>
        </div>
        <button class="btfw-notice-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="btfw-notice-body"></div>
      <div class="btfw-notice-progress"><div></div></div>
    `;
    card.querySelector(".btfw-notice-title").textContent = o.title || "";
    if (o.html) card.querySelector(".btfw-notice-body").innerHTML = o.html;

    // actions row (optional)
    if (Array.isArray(o.actions) && o.actions.length){
      const row = document.createElement("div");
      row.className = "btfw-notice-actions";
      o.actions.forEach(a=>{
        const b = document.createElement("button");
        b.className = "button is-small";
        b.textContent = a.label || "Action";
        b.addEventListener("click",(ev)=>{ ev.stopPropagation(); a.onclick && a.onclick(ev); });
        row.appendChild(b);
      });
      card.appendChild(row);
    }

    // click handlers
    card.addEventListener("click", (ev)=>{
      if (ev.target.closest(".btfw-notice-close")) { close(o); return; }
      if (typeof o.onClick === "function") o.onClick(ev);
    });

    // pause progress on hover
    card.addEventListener("mouseenter", ()=> pause(o));
    card.addEventListener("mouseleave", ()=> resume(o));

    return card;
  }

  // --- timers + progress -------------------------------------------------------
  function startAutoclose(o){
    const bar = o.el.querySelector(".btfw-notice-progress > div");
    const t0  = performance.now();
    let remaining = o.timeout;
    let rafId = 0;
    let paused = false;
    let last  = t0;

    function tick(ts){
      if (paused) { rafId = requestAnimationFrame(tick); return; }
      const dt = ts - last; last = ts;
      remaining -= dt;
      const pct = Math.max(0, Math.min(1, remaining / o.timeout));
      bar.style.transform = `scaleX(${pct})`;
      if (remaining <= 0) { close(o); return; }
      rafId = requestAnimationFrame(tick);
    }
    o._notifyState = {rafId, paused, remaining, bar};
    bar.style.transformOrigin = "left";
    bar.style.transform = "scaleX(1)";
    rafId = requestAnimationFrame(tick);
    o._notifyState.rafId = rafId;
  }

  function pause(o){
    const st = o._notifyState; if (!st || st.paused) return;
    st.paused = true;
  }
  function resume(o){
    const st = o._notifyState; if (!st || !st.paused) return;
    st.paused = false;
  }

  function close(o){
    // cancel animation
    if (o._notifyState && o._notifyState.rafId) cancelAnimationFrame(o._notifyState.rafId);
    // remove from DOM
    if (o.el && o.el.parentNode) {
      o.el.classList.add("btfw-notice--leaving");
      setTimeout(()=>{ o.el.remove(); }, 150);
    }
    // remove from visible list
    const idx = visible.indexOf(o);
    if (idx >= 0) visible.splice(idx,1);
    // show next queued
    showNextFromQueue();
  }

  function closeAll(){
    visible.slice().forEach(close);
    queued.length = 0;
  }

  // --- convenience helpers -----------------------------------------------------
  function info   (p){ return notify(Object.assign({kind:"info"}, p||{})); }
  function success(p){ return notify(Object.assign({kind:"success"}, p||{})); }
  function warn   (p){ return notify(Object.assign({kind:"warn"}, p||{})); }
  function error  (p){ return notify(Object.assign({kind:"error"}, p||{})); }

  // --- CyTube hooks ------------------------------------------------------------
  function titleFromDom(){
    const el = $("#currenttitle");
    if (!el || !el.textContent) return "";
    return el.textContent.replace(/^now\s*playing:\s*/i,"").trim();
  }

  function wireCyTube(){
    if (!window.socket || typeof window.socket.on !== "function") return;

    // Media change → "Now playing"
    try {
      socket.on("changeMedia", (d)=>{
        const t = (d && d.title) ? String(d.title) : (titleFromDom() || "New media");
        info({ title: "Now playing", html: `<div class="np-title">${escapeHtml(t)}</div>`, icon:"▶️" });
      });
      socket.on("setCurrent", (d)=>{
        const t = (d && d.title) ? String(d.title) : (titleFromDom() || "");
        if (t) info({ title: "Now playing", html: `<div class="np-title">${escapeHtml(t)}</div>`, icon:"▶️" });
      });
    } catch(_){}

    // New poll
    try {
      socket.on("newPoll", (p)=>{
        const title = p && p.title ? String(p.title) : "A new poll started";
        const items = Array.isArray(p.options) ? p.options.slice(0,4).map(x=>`<li>${escapeHtml(String(x))}</li>`).join("") : "";
        info({
          title: "Poll started",
          html: `<div class="poll-title">${escapeHtml(title)}</div>${items?`<ul class="poll-opts">${items}</ul>`:""}`,
          icon: "📊"
        });
      });
    } catch(_){}

    // User joins
    try {
      socket.on("addUser", (u)=>{
        const name = (u && (u.name || u.un)) ? (u.name || u.un) : "Someone";
        success({ title: "Joined", html: `<b>${escapeHtml(name)}</b> entered the channel`, icon:"👋", timeout: 4500 });
      });
    } catch(_){}
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // --- settings API (Theme Settings can call these) ----------------------------
  function setEnabled(v){
    enabled = !!v;
    try { localStorage.setItem(LS_ENABLED, enabled ? "1":"0"); } catch(e){}
    if (!enabled) closeAll();
  }
  function isEnabled(){ return !!enabled; }

  // --- boot --------------------------------------------------------------------
  function boot(){
    ensureStack();
    observeChat();
    wireCyTube();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));

  // Expose minimal API for other features
  const api = { notify, info, success, warn, error, closeAll, setEnabled, isEnabled };
  // Convenience global for quick testing:
  window.BTFW_notify = api;

  return Object.assign({ name:"feature:notify" }, api);
});
