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

  /* width tweak: chatwrap-aware when requested */
  let targetWidth;
  if (opts && opts.widthFromChatwrap && cwRect && cwRect.width) {
    const minW = (opts.minWidthPx ?? 320);
    const maxW = (opts.maxWidthPx ?? Math.min(720, cwRect.width));
    targetWidth = Math.max(minW, Math.min(cwRect.width - (margin * 2), maxW)); // keep small side margins
  } else {
    // previous behavior (non-destructive default)
    targetWidth = Math.min(widthPx, Math.round(window.innerWidth * (widthVw / 100)));
  }
  el.style.width = targetWidth + "px";

  el.style.maxHeight = `min(${maxHpx}px, ${maxHvh}vh)`;
  el.style.zIndex    = el.style.zIndex || "6002"; // keep above chat, below navbar modals
}
/* expose so other modules can use it */
window.BTFW_positionPopoverAboveChatBar = positionAboveChatBar;

/* Reposition any open pop-ins on resize/scroll/layout changes */
function repositionOpenPopins(){
  const map = new Map([
    ['#btfw-userlist-pop', {}],
    ['#btfw-emote-pop',   { widthFromChatwrap: true, minWidthPx: 360, maxWidthPx: 720, maxHpx: 480, maxHvh: 70 }],
    ['#btfw-emotes-pop',  { widthFromChatwrap: true, minWidthPx: 360, maxWidthPx: 720, maxHpx: 480, maxHvh: 70 }],
    ['#btfw-chattools-pop', { widthFromChatwrap: true, minWidthPx: 360, maxWidthPx: 640, maxHpx: 360, maxHvh: 60 }],
  ]);
  for (const [sel, opts] of map){
    const el = document.querySelector(sel);
    if (el && el.style.display !== 'none') positionAboveChatBar(el, opts);
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
  const legacyGif = document.getElementById("btfw-gif-open");
  if (legacyGif && legacyGif.parentElement === actions) legacyGif.remove();
  const legacyTools = document.getElementById("btfw-ct-open");
  if (legacyTools && legacyTools.parentElement === actions) legacyTools.remove();

  // ensure consistent ordering etc...
}

/* -------------- THE REST OF THIS FILE IS YOUR ORIGINAL CONTENT -------------- */
/* (No other logic was changed below this point.) */

  /* ---------------- Usercount in bar ---------------- */
  function ensureUsercountInBar(){
    const bar = document.querySelector("#chatwrap .btfw-chat-bottombar");
    if (!bar) return;
    const meta = bar.querySelector(".btfw-chat-meta");
    if (!meta) return;

    let badge = document.getElementById("btfw-usercount");
    if (!badge){
      badge = document.createElement("span");
      badge.id = "btfw-usercount";
      badge.className = "tag is-dark";
      meta.appendChild(badge);
    }

    const ul = document.getElementById("userlist");
    const n  = ul ? ul.querySelectorAll("li").length : 0;
    badge.textContent = n ? `${n}` : "";
  }

  function ensureUserlistPopover(){
    const cw = document.querySelector("#chatwrap");
    if (!cw) return;

    let pop = document.getElementById("btfw-userlist-pop");
    if (!pop){
      pop = document.createElement("div");
      pop.id = "btfw-userlist-pop";
      pop.className = "btfw-popover";
      pop.style.display = "none";
      pop.innerHTML = `
        <div class="btfw-pophead">
          <span>Users</span>
          <button class="btfw-popclose" title="Close">×</button>
        </div>
        <div class="btfw-popbody"></div>
      `;
      cw.appendChild(pop);
      adoptUserlistIntoPopover();
    }
  }

  function ensureUserlistToggle(){
    const actions = actionsNode(); if (!actions) return;
    let btn = document.getElementById("btfw-users-toggle");
    if (!btn){
      btn = document.createElement("button");
      btn.id = "btfw-users-toggle";
      btn.className = "button is-dark is-small btfw-chatbtn";
      btn.innerHTML = '<span class="mdi mdi-account-multiple"></span>';
      actions.prepend(btn);
    }

    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();

      const pop = document.getElementById("btfw-userlist-pop");
      if (!pop) return;

      const isOpen = pop.style.display !== "none";
      if (isOpen){
        pop.style.display = "none";
      } else {
        pop.style.display = "block";
        positionAboveChatBar(pop, {});
      }
    }, {capture:true});
  }

  function ensureUserlistClose(){
    document.addEventListener("click", (e)=>{
      const pop = document.getElementById("btfw-userlist-pop");
      if (!pop || pop.style.display === "none") return;

      if (e.target.closest(".btfw-popclose")){
        e.preventDefault();
        pop.style.display = "none";
        return;
      }
      if (!e.target.closest("#btfw-userlist-pop") &&
          !e.target.closest("#btfw-users-toggle")){
        pop.style.display = "none";
      }
    }, true);
  }

  function observeChatDom(){
    const ul = document.getElementById("userlist");
    if (!ul) return;
    const obs = new MutationObserver(()=> ensureUsercountInBar());
    obs.observe(ul, {childList:true, subtree:true});
  }

  function wireDelegatedClicks(){
    document.addEventListener("click", (e)=>{
      if (e.target.closest && e.target.closest("#btfw-open-theme")){
        e.preventDefault();
        const pane = document.getElementById("btfw-theme-pane");
        if (pane) pane.classList.add("is-active");
      }
    }, true);
  }

  function watchForStrayButtons(){
    normalizeChatActionButtons();
    adoptUserlistIntoPopover();
  }

  function boot(){
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
