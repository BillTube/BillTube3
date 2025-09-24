/* BTFW — feature:notify (overlay toasts inside #messagebuffer, with de-dupe)
   v1.1: overlay (absolute) + single socket wire + event de-duplication.
*/
BTFW.define("feature:notify", [], async () => {
  const $  = (s, r=document) => r.querySelector(s);

  const LS_ENABLED     = "btfw:notify:enabled";   // "1"|"0"
  const MAX_VISIBLE    = 3;
  const DEFAULT_TIMEOUT= 6000;

  let enabled = true;
  try { const v = localStorage.getItem(LS_ENABLED); if (v !== null) enabled = v === "1"; } catch(e){}

  // ---- container (absolute overlay) ------------------------------------------
  function ensureStack(){
    const buf = $("#messagebuffer");
    if (!buf) return null;

    // make sure the buffer is a positioning context for our absolute overlay
    const cs = getComputedStyle(buf);
    if (cs.position === "static") buf.style.position = "relative";

    let stack = $("#btfw-notify-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "btfw-notify-stack";
      buf.appendChild(stack);
    }
    return stack;
  }

  // if CyTube re-renders chat, keep the stack around
  function observeChat(){
    const cw = $("#chatwrap");
    if (!cw || cw._btfw_notify_obs) return;
    cw._btfw_notify_obs = true;
    new MutationObserver(() => ensureStack()).observe(cw, {childList:true, subtree:true});
  }

  // ---- queue + API -----------------------------------------------------------
  const visible = [];
  const queued  = [];

  function showNextFromQueue(){
    if (queued.length && visible.length < MAX_VISIBLE) {
      const next = queued.shift();
      _mount(next);
    }
  }

  function notify(opts){
    if (!enabled) return null;
    const o = Object.assign({
      id: "n_"+Math.random().toString(36).slice(2),
      title: "",
      html: "",
      icon: "",
      kind: "info",           // info|success|warn|error
      timeout: DEFAULT_TIMEOUT,
      onClick: null,
      actions: []
    }, opts||{});
    o.el = buildCard(o);

    if (visible.length >= MAX_VISIBLE) queued.push(o);
    else _mount(o);
    return o;
  }

  function _mount(o){
    const stack = ensureStack();
    if (!stack) { queued.push(o); return; }
    visible.push(o);
    stack.appendChild(o.el);
    if (o.timeout > 0) {
      o.el.classList.add('btfw-notice--timed');
      startAutoclose(o);
    } else {
      o.el.classList.remove('btfw-notice--timed');
      const timer = o.el.querySelector('.btfw-notice-timer');
      if (timer) timer.remove();
      const progress = o.el.querySelector('.btfw-notice-progress');
      if (progress) progress.remove();
    }
  }

  function buildCard(o){
    const card = document.createElement("div");
    card.className = `btfw-notice btfw-notice--${o.kind}`;
    card.setAttribute("role","status");
    card.setAttribute("aria-live","polite");

    const shell = document.createElement("div");
    shell.className = "btfw-notice-shell";

    const iconWrap = document.createElement("div");
    iconWrap.className = "btfw-notice-iconwrap";
    if (o.icon) {
      const icon = document.createElement("span");
      icon.className = "btfw-notice-icon";
      icon.innerHTML = o.icon;
      iconWrap.appendChild(icon);
    } else {
      iconWrap.classList.add("is-empty");
    }
    shell.appendChild(iconWrap);

    const content = document.createElement("div");
    content.className = "btfw-notice-content";

    const header = document.createElement("div");
    header.className = "btfw-notice-header";
    const title = document.createElement("strong");
    title.className = "btfw-notice-title";
    title.textContent = o.title || "";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btfw-notice-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    const body = document.createElement("div");
    body.className = "btfw-notice-body";
    if (o.html) body.innerHTML = o.html;
    content.appendChild(body);

    if (o.actions && o.actions.length){
      const row = document.createElement("div");
      row.className = "btfw-notice-actions";
      o.actions.forEach(a=>{
        const b = document.createElement("button");
        b.className = "btfw-notice-cta";
        b.type = "button";
        b.textContent = a.label || "Action";
        b.addEventListener("click",(ev)=>{ ev.stopPropagation(); a.onclick && a.onclick(ev); });
        row.appendChild(b);
      });
      content.appendChild(row);
    }

    if (o.timeout > 0) {
      const timer = document.createElement("p");
      timer.className = "btfw-notice-timer";
      const label = document.createElement("span");
      label.className = "btfw-notice-timer-label";
      label.innerHTML = `This message will close in <span class="btfw-notice-timer-remaining"></span> seconds.`;
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "btfw-notice-stop";
      stop.textContent = "Click to stop.";
      timer.appendChild(label);
      timer.appendChild(stop);
      content.appendChild(timer);
    }

    shell.appendChild(content);
    card.appendChild(shell);

    const progress = document.createElement("div");
    progress.className = "btfw-notice-progress";
    const bar = document.createElement("div");
    progress.appendChild(bar);
    card.appendChild(progress);

    card.addEventListener("click", (ev)=>{
      if (ev.target.closest(".btfw-notice-close")) {
        ev.preventDefault();
        ev.stopPropagation();
        close(o);
        return;
      }
      if (typeof o.onClick === "function") o.onClick(ev);
    });
    card.addEventListener("mouseenter", ()=> pause(o));
    card.addEventListener("mouseleave", ()=> resume(o));
    return card;
  }

  // ---- timers / progress ------------------------------------------------------
  function startAutoclose(o){
    const bar = o.el.querySelector(".btfw-notice-progress > div");
    const timer = o.el.querySelector(".btfw-notice-timer");
    const label = o.el.querySelector(".btfw-notice-timer-label");
    const remainingNode = o.el.querySelector(".btfw-notice-timer-remaining");
    const stopBtn = o.el.querySelector(".btfw-notice-stop");

    const state = {
      total: Math.max(0, o.timeout),
      remaining: Math.max(0, o.timeout),
      paused: false,
      manual: false,
      lastTick: Date.now(),
      intervalId: 0,
      bar,
      label,
      timer,
      remainingNode
    };

    function render(){
      if (state.bar) {
        const pct = state.total > 0 ? Math.max(0, Math.min(1, state.remaining / state.total)) : 0;
        state.bar.style.transform = `scaleX(${pct})`;
      }
      if (state.remainingNode) {
        const secs = state.total > 0 ? Math.max(0, Math.ceil(state.remaining / 1000)) : 0;
        state.remainingNode.textContent = String(secs);
      }
    }

    render();
    state.intervalId = window.setInterval(()=>{
      if (state.manual || state.paused) {
        state.lastTick = Date.now();
        return;
      }
      const now = Date.now();
      const dt = now - state.lastTick;
      state.lastTick = now;
      state.remaining = Math.max(0, state.remaining - dt);
      render();
      if (state.remaining <= 0) {
        clearInterval(state.intervalId);
        state.intervalId = 0;
        close(o);
      }
    }, 140);

    o._state = state;

    if (stopBtn) {
      stopBtn.addEventListener("click", (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        if (state.manual) return;
        state.manual = true;
        state.paused = true;
        if (state.intervalId) {
          clearInterval(state.intervalId);
          state.intervalId = 0;
        }
        o.el.classList.add("btfw-notice--pinned");
        if (state.timer) state.timer.classList.add("is-stopped");
        if (state.label) state.label.textContent = "Timer stopped.";
        if (state.remainingNode) state.remainingNode.textContent = "0";
        stopBtn.remove();
      }, { once: true });
    }
  }
  function pause(o){ const s=o._state; if (s) { s.paused = true; s.lastTick = Date.now(); } }
  function resume(o){ const s=o._state; if (s && !s.manual) { s.paused = false; s.lastTick = Date.now(); } }

  function close(o){
    if (o._closed) return;
    o._closed = true;
    if (o._state?.intervalId) clearInterval(o._state.intervalId);
    o._state = null;
    if (o.el && o.el.parentNode) {
      o.el.classList.add("btfw-notice--leaving");
      setTimeout(()=>{ try { o.el.remove(); } catch(_){}; }, 160);
    }
    const i = visible.indexOf(o);
    if (i>=0) visible.splice(i,1);
    showNextFromQueue();
  }

  function closeAll(){ visible.slice().forEach(close); queued.length=0; }

  // convenience
  const api = {
    notify,
    info   : p => notify(Object.assign({kind:"info"},    p||{})),
    success: p => notify(Object.assign({kind:"success"}, p||{})),
    warn   : p => notify(Object.assign({kind:"warn"},    p||{})),
    error  : p => notify(Object.assign({kind:"error"},   p||{})),
    closeAll,
    setEnabled(v){ enabled=!!v; try{localStorage.setItem(LS_ENABLED,enabled?"1":"0");}catch(e){} if(!enabled) closeAll(); },
    isEnabled(){ return !!enabled; }
  };

  // ---- de-dupe (avoid many toasts for same event burst) ----------------------
  const seen = new Map(); // key -> expireAt (ms)
  function postOnce(key, ttlMs, builder){
    const now = Date.now();
    const exp = seen.get(key)||0;
    if (exp > now) return;   // still within de-dupe window
    seen.set(key, now + (ttlMs||1500));
    builder();
  }

  // ---- CyTube hooks (wired once) ---------------------------------------------
  let socketWired = false;
  function wireSocketOnce(){
    if (socketWired) return;
    if (!window.socket || typeof window.socket.on !== "function") return;
    socketWired = true;

    // Now playing: changeMedia & setCurrent often both fire → de-dupe
    try {
      socket.on("changeMedia", (d)=>{
        postOnce("np", 1500, () => {
          const t = titleFromAnywhere(d);
          api.info({ title: "Now playing", html: `<div class="np-title">${escapeHtml(t)}</div>`, icon:"▶️" });
        });
      });
      socket.on("setCurrent", (d)=>{
        postOnce("np", 1500, () => {
          const t = titleFromAnywhere(d);
          if (t) api.info({ title: "Now playing", html: `<div class="np-title">${escapeHtml(t)}</div>`, icon:"▶️" });
        });
      });
    } catch(_){}

    // New poll: de-dupe by title for a short time
    try {
      socket.on("newPoll", (p)=>{
        const title = (p && p.title) ? String(p.title) : "A new poll started";
        postOnce("poll:"+title, 2000, ()=>{
          const items = Array.isArray(p?.options) ? p.options.slice(0,4).map(x=>`<li>${escapeHtml(String(x))}</li>`).join("") : "";
          api.info({
            title: "Poll started",
            html: `<div class="poll-title">${escapeHtml(title)}</div>${items?`<ul class="poll-opts">${items}</ul>`:""}`,
            icon: "📊"
          });
        });
      });
    } catch(_){}

    // User joins: throttle per-name
    try {
      socket.on("addUser", (u)=>{
        const name = (u && (u.name || u.un)) ? (u.name || u.un) : "Someone";
        postOnce("join:"+name, 4000, ()=>{
          api.success({ title: "Joined", html: `<b>${escapeHtml(name)}</b> entered the channel`, icon:"👋", timeout: 4500 });
        });
      });
    } catch(_){}
  }

  function titleFromAnywhere(d){
    if (d?.title) return String(d.title);
    const ct = $("#currenttitle");
    if (ct && ct.textContent) return ct.textContent.replace(/^now\s*playing:\s*/i,"").trim();
    // playlist fallback
    const a = document.querySelector('#queue .queue_active .qe_title a, #queue .queue_active .qe_title');
    if (a && a.textContent) return a.textContent.trim();
    return "New media";
  }

  function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // ---- boot ------------------------------------------------------------------
  function boot(){
    ensureStack();
    observeChat();
    wireSocketOnce();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", ()=> setTimeout(boot, 50));

  // handy global for ad-hoc testing
  window.BTFW_notify = api;
  return Object.assign({ name:"feature:notify" }, api);
});
