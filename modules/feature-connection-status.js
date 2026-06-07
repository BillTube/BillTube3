/* BTFW — feature:connection-status
   Graceful disconnect / reconnect handling.

   Two problems this fixes:
   1) Duplicate messages on reconnect. When socket.io reconnects, the server
      re-sends the recent chat buffer. CyTube's own guard in addChatMessage is
      `if (data.time < LASTCHAT.time) return;` — it uses `<`, so the last
      message (whose time *equals* LASTCHAT.time) slips through and is shown
      twice. We wrap addChatMessage with an exact (time|user|msg) signature
      check so any exact resend is dropped.
   2) The inline "Disconnected from server." / "Connected" chat lines are
      noisy. We remove them and instead show a small status pill in the
      bottom-right of the chat:
        • disconnect → "Reconnecting…" (stays until reconnected)
        • reconnect  → "Connected" (green), auto-hides after ~7s
      The initial page-load connect is ignored (no pill on first load).
*/
BTFW.define("feature:connection-status", [], async () => {

  /* ---------- 0) re-sync toast suppression window ----------
     CyTube replays the current media / poll / rating window whenever it
     (re)joins the channel — on the initial page load AND after a reconnect.
     Those replays make "Now playing", "Poll started" and "Movie rating has
     started" toasts fire when nothing actually changed. We open a short
     suppression window on load and after each reconnect; feature-notify and
     feature-ratings check BTFW_stateToastsSuppressed() before toasting. */
  const INIT_SETTLE_MS = 6000;
  const RECONNECT_SETTLE_MS = 6000;
  let suppressUntil = Date.now() + INIT_SETTLE_MS;
  function suppressStateToasts(ms) {
    const until = Date.now() + ms;
    if (until > suppressUntil) suppressUntil = until;
  }
  window.BTFW_stateToastsSuppressed = function () { return Date.now() < suppressUntil; };

  /* ---------- 1) dedupe exact re-sent messages ---------- */
  function wrapAddChatMessage() {
    const orig = window.addChatMessage;
    if (typeof orig !== "function" || orig._btfwDedup) return;

    const seen = new Set();
    const order = [];
    const MAX = 500;
    const sigOf = (d) => (d && d.time || 0) + "|" + (d && d.username || "") + "|" + (d && d.msg || "");

    const wrapped = function (data) {
      try {
        // Only dedupe real chat messages (have username + msg). Exact resends
        // (same server time, author and text) are dropped.
        if (data && data.username !== undefined && data.msg !== undefined) {
          const sig = sigOf(data);
          if (seen.has(sig)) return;
          seen.add(sig);
          order.push(sig);
          if (order.length > MAX) seen.delete(order.shift());
        }
      } catch (_) {}
      return orig.apply(this, arguments);
    };
    wrapped._btfwDedup = true;
    window.addChatMessage = wrapped;
  }

  /* ---------- 2) status pill ---------- */
  let pill = null, hideTimer = null, resetTimer = null, wasDisconnected = false;

  function ensurePill() {
    if (pill && pill.isConnected) return pill;
    const host = document.getElementById("chatwrap") || document.body;
    pill = document.createElement("div");
    pill.id = "btfw-conn-pill";
    pill.className = "btfw-conn-pill";
    pill.setAttribute("role", "status");
    pill.innerHTML = `<span class="btfw-conn-dot" aria-hidden="true"></span><span class="btfw-conn-text"></span>`;
    host.appendChild(pill);
    return pill;
  }

  function clearTimers() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  }

  function showPill(state, text) {
    ensurePill();
    clearTimers();
    pill.querySelector(".btfw-conn-text").textContent = text;
    pill.className = "btfw-conn-pill is-" + state;
    void pill.offsetWidth; // force reflow so the entrance transition replays
    pill.classList.add("is-open");
  }

  function autoHide(ms) {
    clearTimers();
    hideTimer = setTimeout(() => {
      if (pill) pill.classList.remove("is-open");
      resetTimer = setTimeout(() => { if (pill) pill.className = "btfw-conn-pill"; }, 320);
    }, ms);
  }

  /* ---------- 3) remove CyTube's inline connect/disconnect lines ---------- */
  function purgeInlineServerMsgs() {
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    buf.querySelectorAll(".server-msg-disconnect, .server-msg-reconnect").forEach((el) => el.remove());
  }

  /* ---------- 4) socket wiring ---------- */
  function wireSocket() {
    const s = window.socket;
    if (!s || typeof s.on !== "function" || s._btfwConnStatus) return false;
    s._btfwConnStatus = true;

    // CyTube's own connect/disconnect handlers run first (added at its init),
    // so by the time ours runs the inline line already exists → remove it.
    s.on("disconnect", () => {
      wasDisconnected = true;
      showPill("reconnecting", "Reconnecting…");
      purgeInlineServerMsgs();
    });

    s.on("connect", () => {
      purgeInlineServerMsgs();
      if (wasDisconnected) {
        wasDisconnected = false;
        suppressStateToasts(RECONNECT_SETTLE_MS); // CyTube is about to replay state
        showPill("connected", "Connected");
        autoHide(7000);
      }
    });

    return true;
  }

  function boot() {
    wrapAddChatMessage();
    wireSocket();
    purgeInlineServerMsgs(); // sweep any that already exist
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:connection-status" };
});
