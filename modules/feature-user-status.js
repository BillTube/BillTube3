/* BTFW — feature:user-status
   Presence rings around chat avatars: online / away / offline.

   Status model (from CyTube):
     online  = user is in #userlist and not AFK
     away    = user is in #userlist and AFK (meta.afk)
     offline = user is not in the userlist (left / never present)

   Designed to cost essentially nothing:
     • Driven by CyTube's own socket events (userlist / addUser / userLeave /
       setAFK / setUserMeta) — passive listeners that fire only on the (rare)
       status changes. No polling, no timers, no animation loops.
     • All DOM writes are batched into requestIdleCallback, so they run in the
       background and never block rendering, scrolling or input.
     • A single childList observer on #messagebuffer just *collects* freshly
       added avatars; the actual tagging happens later, while idle.

   Userlist avatars are handled in pure CSS (CyTube toggles .userlist_afk), so
   there is no JS cost there at all.
*/
BTFW.define("feature:user-status", [], async () => {
  const present = new Map(); // lowercased name -> afk(boolean). Absent = offline.
  const lower = (s) => (s || "").toLowerCase();

  function statusOf(name) {
    const n = lower(name);
    if (!present.has(n)) return "offline";
    return present.get(n) ? "away" : "online";
  }

  /* ---------- background scheduler (never blocks) ---------- */
  const ric = window.requestIdleCallback || function (cb) {
    return setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: false }), 200);
  };
  let scheduled = false;
  let sweepDirty = false;            // a status changed → re-tag all avatars
  const pendingAvatars = new Set();  // freshly added avatars to tag

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    ric(flush, { timeout: 2000 });
  }

  function flush() {
    scheduled = false;
    if (pendingAvatars.size) {
      pendingAvatars.forEach((av) => { if (av.isConnected) applyToAvatar(av); });
      pendingAvatars.clear();
    }
    if (sweepDirty) {
      sweepDirty = false;
      const buf = document.getElementById("messagebuffer");
      if (buf) buf.querySelectorAll(".btfw-chat-avatar").forEach(applyToAvatar);
    }
  }

  function markDirty() { sweepDirty = true; schedule(); }

  /* ---------- avatar tagging ---------- */
  function avatarName(av) {
    // Chat avatars carry data-avatar-key="<name>"; fall back to the row class.
    let n = av.getAttribute("data-avatar-key");
    if (!n) {
      const row = av.closest('[class*="chat-msg-"]');
      if (row) {
        const m = (row.className || "").match(/(?:^|\s)chat-msg-([^\s]+)/);
        n = m ? m[1] : "";
      }
    }
    return lower(n);
  }

  function applyToAvatar(av) {
    if (!av) return;
    const wrap = av.closest(".btfw-chat-avatarwrap") || av;
    const st = statusOf(avatarName(av));
    if (wrap.getAttribute("data-btfw-status") !== st) wrap.setAttribute("data-btfw-status", st);
  }

  /* ---------- seed from the current userlist (initial list may have already fired) ---------- */
  function seedFromUserlist() {
    present.clear();
    const items = document.querySelectorAll("#userlist .userlist_item");
    items.forEach((it) => {
      const $it = window.jQuery ? window.jQuery(it) : null;
      const name = $it ? ($it.data("name") || "") : "";
      if (!name) return;
      const afk = it.classList.contains("userlist_afk") || !!($it && ($it.data("meta") || {}).afk);
      present.set(lower(name), !!afk);
    });
    markDirty();
  }

  /* ---------- socket wiring (the only "live" driver) ---------- */
  function wireSocket() {
    const s = window.socket;
    if (!s || typeof s.on !== "function") return false;
    if (s._btfwStatusWired) return true;
    s._btfwStatusWired = true;

    s.on("userlist", (list) => {
      if (!Array.isArray(list)) return;
      present.clear();
      list.forEach((u) => { if (u && u.name) present.set(lower(u.name), !!(u.meta && u.meta.afk)); });
      markDirty();
    });
    s.on("addUser", (u) => {
      if (!u || !u.name) return;
      present.set(lower(u.name), !!(u.meta && u.meta.afk));
      markDirty();
    });
    s.on("userLeave", (d) => {
      if (!d || !d.name) return;
      present.delete(lower(d.name));
      markDirty();
    });
    s.on("setAFK", (d) => {
      if (!d || !d.name) return;
      if (present.has(lower(d.name))) present.set(lower(d.name), !!d.afk);
      markDirty();
    });
    s.on("setUserMeta", (d) => {
      if (!d || !d.name || !d.meta) return;
      if (present.has(lower(d.name))) present.set(lower(d.name), !!d.meta.afk);
      markDirty();
    });
    return true;
  }

  /* ---------- collect freshly added chat avatars (tag them later, while idle) ---------- */
  function wireObserver() {
    const buf = document.getElementById("messagebuffer");
    if (!buf || buf._btfwStatusMO) return;
    const mo = new MutationObserver((muts) => {
      let added = false;
      for (const m of muts) {
        if (m.type !== "childList" || !m.addedNodes) continue;
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(".btfw-chat-avatar")) { pendingAvatars.add(node); added = true; }
          else if (node.querySelectorAll) {
            const avs = node.querySelectorAll(".btfw-chat-avatar");
            if (avs.length) { avs.forEach((a) => pendingAvatars.add(a)); added = true; }
          }
        }
      }
      if (added) schedule();
    });
    mo.observe(buf, { childList: true, subtree: false });
    buf._btfwStatusMO = mo;
  }

  function boot() {
    // socket may seed faster/more accurately than the DOM; wire it first.
    wireSocket();
    seedFromUserlist();
    wireObserver();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name: "feature:user-status", statusOf, refresh: markDirty };
});
