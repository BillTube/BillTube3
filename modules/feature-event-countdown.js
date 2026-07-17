/* BTFW — feature:event-countdown — channel-wide event countdown banner.
   The owner sets a title + start time in the Channel Theme Toolkit; the
   values live in window.BTFW_THEME_ADMIN (Channel JS), so every viewer gets
   the same event. The start time is stored as a UTC epoch (startsAtMs) and
   rendered in each viewer's own locale/timezone. Shows "LIVE" for six hours
   after start, then removes itself. */
BTFW.define("feature:event-countdown", [], async () => {
  const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
  const STYLE_ID = "btfw-event-countdown-css";

  let el = null;
  let timer = null;
  let syncTimer = null;
  let lastKey = "";

  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #btfw-event-countdown {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 8px 0 2px;
        padding: 7px 12px;
        border-radius: var(--btfw-radius-sm, 10px);
        border: 1px solid color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 40%, transparent 60%);
        background: color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 12%, var(--btfw-color-panel, #171d27) 88%);
        color: var(--btfw-color-text, #e8eff4);
        font-size: 0.8rem;
      }
      /* Inside the chat topbar the banner is a slim full-width grid row (the
         same pattern as the ratings widget), so it stays in flow above the
         messages and coexists with the other topbar rows. */
      #chatwrap .btfw-chat-topbar #btfw-event-countdown {
        grid-column: 1 / -1;
        width: 100%;
        margin: 0;
      }
      #btfw-event-countdown .btfw-event__dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--btfw-color-accent, #6d4df6);
        flex: 0 0 auto;
      }
      #btfw-event-countdown.is-live .btfw-event__dot {
        background: var(--btfw-color-error, #ff6f96);
        animation: btfwEventPulse 1.2s ease-in-out infinite;
      }
      @keyframes btfwEventPulse { 50% { opacity: 0.35; } }
      #btfw-event-countdown .btfw-event__title {
        flex: 1 1 auto;
        min-width: 0;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #btfw-event-countdown .btfw-event__time {
        flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: color-mix(in srgb, var(--btfw-color-accent, #6d4df6) 70%, var(--btfw-color-text, #fff) 30%);
      }
      #btfw-event-countdown.is-live .btfw-event__time {
        color: var(--btfw-color-error, #ff6f96);
        text-transform: uppercase;
      }
      @media (prefers-reduced-motion: reduce) {
        #btfw-event-countdown.is-live .btfw-event__dot { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function readEvent(){
    const ev = window.BTFW_THEME_ADMIN && window.BTFW_THEME_ADMIN.event;
    if (!ev || typeof ev !== "object" || !ev.enabled) return null;
    const startsAtMs = Number(ev.startsAtMs) || 0;
    if (!startsAtMs) return null;
    return { title: String(ev.title || "").trim() || "Upcoming event", startsAtMs };
  }

  function pad(n){ return String(n).padStart(2, "0"); }

  function formatRemaining(ms){
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function localizedStart(ms){
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(ms));
    } catch (_) {
      return new Date(ms).toLocaleString();
    }
  }

  function ensureEl(ev){
    if (el && document.body.contains(el)) return el;
    injectStyles();
    el = document.createElement("div");
    el.id = "btfw-event-countdown";
    el.innerHTML = `
      <span class="btfw-event__dot" aria-hidden="true"></span>
      <span class="btfw-event__title"></span>
      <span class="btfw-event__time" role="timer"></span>`;
    // Preferred home: a slim row inside the chat topbar, right under the
    // now-playing title — always on screen while watching, on desktop and
    // mobile alike. Falls back to the below-video slot if chat isn't up.
    const topbar = document.querySelector("#chatwrap .btfw-chat-topbar");
    const video = document.querySelector("#videowrap");
    const tabbar = document.querySelector("#btfw-mobile-tabbar");
    if (topbar) {
      topbar.appendChild(el);
    } else if (tabbar && tabbar.parentElement) {
      tabbar.parentElement.insertBefore(el, tabbar.nextSibling);
    } else if (video && video.parentElement) {
      video.parentElement.insertBefore(el, video.nextSibling);
    } else {
      return null;
    }
    return el;
  }

  function teardown(){
    if (timer) { clearInterval(timer); timer = null; }
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    if (el) { el.remove(); el = null; }
  }

  function tick(){
    const ev = readEvent();
    if (!ev) { teardown(); return; }
    const node = ensureEl(ev);
    if (!node) return;
    node.querySelector(".btfw-event__title").textContent = ev.title;
    node.title = `Starts ${localizedStart(ev.startsAtMs)} (your local time)`;
    const delta = ev.startsAtMs - Date.now();
    const timeEl = node.querySelector(".btfw-event__time");
    if (delta > 0) {
      node.classList.remove("is-live");
      timeEl.textContent = formatRemaining(delta);
    } else if (-delta <= LIVE_WINDOW_MS) {
      node.classList.add("is-live");
      timeEl.textContent = "LIVE";
    } else {
      teardown();
    }
  }

  function sync(){
    const ev = readEvent();
    const key = ev ? `${ev.title}|${ev.startsAtMs}` : "";
    if (key !== lastKey) {
      lastKey = key;
      teardown();
    }
    if (!ev) return;
    tick();
    if (!timer) timer = setInterval(tick, 1000);
  }

  function boot(){
    sync();
    // The admin can change the event without a page reload (Apply updates the
    // runtime config); a cheap re-sync poll picks that up for the admin, and
    // is a no-op for everyone else.
    syncTimer = setInterval(sync, 15000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:event-countdown" };
});
