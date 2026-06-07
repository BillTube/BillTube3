/* BTFW — feature:chat-ignore (OPTIMIZED)
   - Saved mute list (localStorage)
   - Adds "Mute/Unmute" action on userlist entries
   - Hides messages from muted users using socket events + WeakSet tracking
*/
BTFW.define("feature:chat-ignore", [], async () => {
  const $ = (s, r = document) => r.querySelector(s);
  const LS = "btfw:chat:ignore";

  // Cache for processed messages to avoid reprocessing
  const processedMessages = new WeakSet();
  let ignoredUsers = new Set();

  // Load ignored users from localStorage
  function loadIgnoredUsers() {
    try {
      const raw = localStorage.getItem(LS);
      const arr = raw ? JSON.parse(raw) : [];
      ignoredUsers = new Set(arr.map(v => String(v).toLowerCase()));
      return ignoredUsers;
    } catch (_) {
      ignoredUsers = new Set();
      return ignoredUsers;
    }
  }

  // Save ignored users to localStorage
  function saveIgnoredUsers() {
    try {
      localStorage.setItem(LS, JSON.stringify(Array.from(ignoredUsers)));
    } catch (_) {}
  }

  // Initialize
  loadIgnoredUsers();

  // Public API
  function has(name) {
    return ignoredUsers.has((name || "").toLowerCase());
  }

  function add(name) {
    if (!name) return;
    const lower = name.toLowerCase();
    if (ignoredUsers.has(lower)) return; // Already ignored

    ignoredUsers.add(lower);
    saveIgnoredUsers();
    markUserInList(name, true);
    hideExistingMessages(name); // Hide existing messages from this user
  }

  function remove(name) {
    if (!name) return;
    const lower = name.toLowerCase();
    if (!ignoredUsers.has(lower)) return; // Not ignored

    ignoredUsers.delete(lower);
    saveIgnoredUsers();
    markUserInList(name, false);
    showExistingMessages(name); // Show messages from this user again
  }

  function toggle(name) {
    has(name) ? remove(name) : add(name);
  }

  // Extract username from a message row (cached). CyTube tags EVERY message
  // row — including grouped continuation rows that have no visible .username —
  // with a `chat-msg-<name>` class, so read that first and fall back to the
  // visible username span only when the class is missing.
  const usernameCache = new WeakMap();
  function nameFromRowClass(el) {
    const cls = el && el.className ? String(el.className) : "";
    const m = cls.match(/(?:^|\s)chat-msg-([^\s]+)/);
    return m ? m[1] : "";
  }
  function getUserFromMessage(el) {
    if (usernameCache.has(el)) return usernameCache.get(el);

    let name = nameFromRowClass(el);
    if (!name) {
      const u = el.querySelector(".username");
      if (u) name = (u.textContent || "").trim().replace(/:\s*$/, "");
    }
    usernameCache.set(el, name || "");
    return name || "";
  }

  // Apply / clear the ignored visual on a row. Discord-style: the message
  // stays in place but is blurred out (peek on hover) rather than removed.
  function applyIgnored(el, ignored) {
    el.classList.toggle("btfw-ignored", ignored);
    if (ignored) el.setAttribute("data-btfw-ignored", "true");
    else el.removeAttribute("data-btfw-ignored");
  }

  // Process single message (optimized)
  function processMessage(el) {
    if (processedMessages.has(el)) return; // Already processed

    const name = getUserFromMessage(el);
    if (name && has(name)) {
      applyIgnored(el, true);
    }

    processedMessages.add(el);
  }

  // Blur existing messages from a specific user (retroactive)
  function hideExistingMessages(username) {
    const buf = $("#messagebuffer");
    if (!buf) return;

    const lower = username.toLowerCase();
    for (const el of buf.children) {
      if (el.nodeType !== 1) continue;
      const msgUser = getUserFromMessage(el);
      if (msgUser.toLowerCase() === lower) {
        applyIgnored(el, true);
      }
    }
  }

  // Reveal previously-blurred messages from a specific user
  function showExistingMessages(username) {
    const buf = $("#messagebuffer");
    if (!buf) return;

    const lower = username.toLowerCase();
    for (const el of buf.children) {
      if (el.nodeType !== 1) continue;
      if (el.getAttribute("data-btfw-ignored")) {
        const msgUser = getUserFromMessage(el);
        if (msgUser.toLowerCase() === lower) {
          applyIgnored(el, false);
        }
      }
    }
  }

  // Mark user in userlist as muted/unmuted
  function markUserInList(name, muted) {
    const li = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`);
    if (li) {
      li.classList.toggle("btfw-muted", muted);

      // Update mute button text if it exists
      const chip = li.querySelector(".btfw-mute-chip");
      if (chip) {
        chip.textContent = muted ? "Unmute" : "Mute";
      }
    }
  }

  // Process all existing messages (one-time scan)
  function processExistingMessages() {
    const buf = $("#messagebuffer");
    if (!buf) return;

    // Iterate each message and ensure ignore state is applied
    for (const el of buf.children) {
      if (el.nodeType === 1) {
        processMessage(el);
      }
    }
  }

  // Socket-based message handling (most efficient)
  function wireSocketEvents() {
    const socket = window.socket;
    if (!socket || typeof socket.on !== "function") return false;

    socket.on("chatMsg", (data) => {
      // Process the new message after a minimal delay to ensure DOM is ready
      setTimeout(() => {
        const buf = $("#messagebuffer");
        if (!buf) return;

        // Get the last message (most recent)
        const lastMsg = buf.lastElementChild;
        if (lastMsg && !processedMessages.has(lastMsg)) {
          processMessage(lastMsg);
        }
      }, 10);
    });

    return true;
  }

  // Reliable DOM observer — processes every appended row exactly once
  // (deduped via WeakSet). This is the primary mechanism; the socket handler
  // alone can miss rows when several arrive in the same tick.
  function wireMessageObserver() {
    const buf = $("#messagebuffer");
    if (!buf || buf._btfwIgnoreMO) return;

    // Only observe direct children, not subtree
    const mo = new MutationObserver(mutations => {
      for (const mut of mutations) {
        if (mut.type === "childList" && mut.addedNodes) {
          for (const node of mut.addedNodes) {
            if (node.nodeType === 1) {
              processMessage(node);
            }
          }
        }
      }
    });

    mo.observe(buf, { childList: true, subtree: false }); // subtree:false for performance
    buf._btfwIgnoreMO = mo;
  }

  // Optimized userlist decoration
  function decorateUserlist() {
    const ul = $("#userlist");
    if (!ul || ul._btfwIgnoreWired) return;
    ul._btfwIgnoreWired = true;

    // Batch process existing items
    const items = ul.querySelectorAll("li");

    items.forEach(li => {
      if (li._btfwMuteChip) return;
      decorateUserItem(li);
    });

    // Minimal observer for new userlist items only
    const mo = new MutationObserver(mutations => {
      for (const mut of mutations) {
        if (mut.type === "childList" && mut.addedNodes) {
          for (const node of mut.addedNodes) {
            if (node.nodeType === 1 && node.tagName === "LI") {
              decorateUserItem(node);
            }
          }
        }
      }
    });

    mo.observe(ul, { childList: true, subtree: false });
  }

  // Decorate individual user item
  function decorateUserItem(li) {
    if (li._btfwMuteChip) return;
    li._btfwMuteChip = true;

    const name = li.getAttribute("data-name") || (li.textContent || "").trim();
    if (!name) return;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "btfw-mute-chip";
    chip.textContent = has(name) ? "Unmute" : "Mute";

    // Use event delegation pattern for better performance
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(name);
      chip.textContent = has(name) ? "Unmute" : "Mute";
    });

    li.appendChild(chip);
    li.classList.toggle("btfw-muted", has(name));
  }

  /* ============================================================
     Right-click menu on chat usernames / avatars.
       • Ignore / Unignore (ours)
       • Private message + CyTube's native moderation actions
         (leader, kick, mute/shadow-mute, ban) — each gated by
         hasPermission() and login/presence so users never see an
         action they cannot perform.
     Single delegated contextmenu listener; covers existing AND future
     messages. The username is derived from the row's chat-msg-<name>
     class (works on grouped continuation rows too).
     ============================================================ */
  const USER_TARGET_SEL = "#messagebuffer .username, #messagebuffer img.btfw-chat-avatar";

  function nameFromTarget(t) {
    if (!t) return "";
    const row = t.closest('[class*="chat-msg-"]');
    if (row) {
      const n = nameFromRowClass(row);
      if (n) return n;
    }
    const span = (t.classList && t.classList.contains("username")) ? t : (t.closest ? t.closest(".username") : null);
    if (span) return (span.textContent || "").trim().replace(/:\s*$/, "");
    return "";
  }

  /* ---- CyTube native action bridges (page globals) ---- */
  function myName() { try { return (window.CLIENT && window.CLIENT.name) || ""; } catch (_) { return ""; } }
  function isLoggedIn() { try { return !!(window.CLIENT && window.CLIENT.logged_in); } catch (_) { return false; } }
  function sameName(a, b) { return (a || "").toLowerCase() === (b || "").toLowerCase(); }
  function can(perm) { try { return typeof window.hasPermission === "function" && !!window.hasPermission(perm); } catch (_) { return false; } }
  function chatCmd(msg) { try { if (window.socket) window.socket.emit("chatMsg", { msg, meta: {} }); } catch (_) {} }

  // CyTube's own findUserlistItem matches children[1], but our theme inserts an
  // avatar + spacer span ahead of the name, so look the entry up by its
  // jQuery data("name") instead (which stays correct).
  function findUserEntry(name) {
    if (!window.jQuery) return null;
    const lower = (name || "").toLowerCase();
    const items = document.querySelectorAll("#userlist .userlist_item");
    for (const it of items) {
      const $it = window.jQuery(it);
      if ((((($it.data("name")) || "") + "").toLowerCase()) === lower) return $it;
    }
    return null;
  }

  function userContext(name) {
    const $e = findUserEntry(name);
    const present = !!($e && $e.length);
    const meta = present ? ($e.data("meta") || {}) : {};
    return {
      self: sameName(name, myName()),
      present,
      loggedIn: isLoggedIn(),
      leader: present ? !!$e.data("leader") : false,
      muted: !!(meta.muted || meta.smuted),
      ignored: has(name)
    };
  }

  // Build the action model for a name, honoring login state, presence and
  // per-permission gating so users never see actions they can't perform.
  function buildUserMenuModel(name) {
    const c = userContext(name);
    const main = [], mod = [];
    if (!c.self) {
      if (c.loggedIn && c.present) main.push({ act: "pm", icon: "fa fa-comment", label: "Private message" });
      main.push({ act: "ignore", icon: c.ignored ? "fa fa-user-check" : "fa fa-user-slash", label: c.ignored ? "Unignore user" : "Ignore user", active: c.ignored });

      if (c.present && can("leaderctl")) mod.push({ act: "leader", icon: "fa fa-star", label: c.leader ? "Remove leader" : "Give leader" });
      if (c.present && can("kick")) mod.push({ act: "kick", icon: "fa fa-right-from-bracket", label: "Kick", danger: true });
      if (c.present && can("mute")) {
        if (c.muted) mod.push({ act: "unmute", icon: "fa fa-volume-high", label: "Unmute" });
        else {
          mod.push({ act: "mute", icon: "fa fa-volume-xmark", label: "Mute" });
          mod.push({ act: "smute", icon: "fa fa-volume-off", label: "Shadow mute" });
        }
      }
      if (can("ban")) {
        mod.push({ act: "nameban", icon: "fa fa-gavel", label: "Name ban", danger: true });
        mod.push({ act: "ipban", icon: "fa fa-ban", label: "IP ban", danger: true });
      }
    }
    return { name, main, mod, hasAny: (main.length + mod.length) > 0 };
  }

  let umenu = null, umenuName = "", uDismissBound = false;

  function ensureUserMenu() {
    if (umenu) return umenu;
    umenu = document.createElement("div");
    umenu.id = "btfw-user-menu";
    umenu.className = "btfw-ctxmenu btfw-user-menu";
    umenu.setAttribute("role", "menu");
    umenu.hidden = true;
    umenu.innerHTML = `<div class="btfw-ctxmenu-title"></div><div class="btfw-ctxmenu-body"></div>`;
    document.body.appendChild(umenu);
    umenu.addEventListener("click", onUserMenuClick);
    umenu.addEventListener("contextmenu", (e) => e.preventDefault());
    return umenu;
  }

  function renderUserMenu(model) {
    umenu.querySelector(".btfw-ctxmenu-title").textContent = model.name;
    const body = umenu.querySelector(".btfw-ctxmenu-body");
    body.innerHTML = "";
    const addItem = (it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btfw-ctxmenu-item" + (it.active ? " is-active" : "") + (it.danger ? " is-danger" : "");
      b.dataset.act = it.act;
      b.setAttribute("role", "menuitem");
      const i = document.createElement("i"); i.className = it.icon; i.setAttribute("aria-hidden", "true");
      const s = document.createElement("span"); s.className = "btfw-ctxmenu-label"; s.textContent = it.label;
      b.appendChild(i); b.appendChild(s);
      body.appendChild(b);
    };
    model.main.forEach(addItem);
    if (model.mod.length) {
      const sep = document.createElement("div"); sep.className = "btfw-ctxmenu-sep"; body.appendChild(sep);
      model.mod.forEach(addItem);
    }
  }

  function showUserMenu(x, y, name, model) {
    ensureUserMenu();
    umenuName = name;
    renderUserMenu(model);
    umenu.hidden = false;
    umenu.style.left = "0px";
    umenu.style.top = "0px";
    umenu.style.visibility = "hidden";
    umenu.classList.add("is-open");
    const r = umenu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let L = x, T = y;
    if (L + r.width + 8 > vw) L = Math.max(8, vw - r.width - 8);
    if (T + r.height + 8 > vh) T = Math.max(8, vh - r.height - 8);
    if (L < 8) L = 8;
    if (T < 8) T = 8;
    umenu.style.left = L + "px";
    umenu.style.top = T + "px";
    umenu.style.visibility = "";
    bindUserMenuDismiss();
  }

  function hideUserMenu() {
    if (!umenu) return;
    umenu.classList.remove("is-open");
    umenu.hidden = true;
    umenuName = "";
    unbindUserMenuDismiss();
  }

  function onUserMenuClick(e) {
    const btn = e.target.closest(".btfw-ctxmenu-item");
    if (!btn) return;
    e.preventDefault();
    const name = umenuName;
    const act = btn.dataset.act;
    hideUserMenu(); // close before any blocking prompt()
    if (name) runUserAction(act, name);
  }

  function runUserAction(act, name) {
    switch (act) {
      case "pm":
        try { if (window.initPm) window.initPm(name).find(".panel-heading").click(); } catch (_) {}
        break;
      case "ignore":
        toggle(name);
        break;
      case "leader": {
        // re-read live leader state so the toggle is always correct
        const $e = findUserEntry(name);
        const lead = !!($e && $e.data("leader"));
        try { if (window.socket) window.socket.emit("assignLeader", { name: lead ? "" : name }); } catch (_) {}
        break;
      }
      case "kick": {
        const reason = prompt("Enter kick reason (optional)");
        if (reason === null) return;
        chatCmd("/kick " + name + " " + reason);
        break;
      }
      case "mute":   chatCmd("/mute " + name); break;
      case "smute":  chatCmd("/smute " + name); break;
      case "unmute": chatCmd("/unmute " + name); break;
      case "nameban": {
        const reason = prompt("Enter ban reason (optional)");
        if (reason === null) return;
        chatCmd("/ban " + name + " " + reason);
        break;
      }
      case "ipban": {
        const reason = prompt("Enter ban reason (optional)");
        if (reason === null) return;
        chatCmd("/ipban " + name + " " + reason);
        break;
      }
    }
  }

  function onUserMenuDocDown(e) { if (umenu && !umenu.contains(e.target)) hideUserMenu(); }
  function onUserMenuKey(e) { if (e.key === "Escape") hideUserMenu(); }
  function onUserMenuReflow() { hideUserMenu(); }

  function bindUserMenuDismiss() {
    if (uDismissBound) return;
    uDismissBound = true;
    document.addEventListener("mousedown", onUserMenuDocDown, true);
    document.addEventListener("keydown", onUserMenuKey, true);
    window.addEventListener("resize", onUserMenuReflow, true);
    window.addEventListener("scroll", onUserMenuReflow, true);
    const buf = $("#messagebuffer");
    if (buf) buf.addEventListener("scroll", onUserMenuReflow, true);
  }
  function unbindUserMenuDismiss() {
    if (!uDismissBound) return;
    uDismissBound = false;
    document.removeEventListener("mousedown", onUserMenuDocDown, true);
    document.removeEventListener("keydown", onUserMenuKey, true);
    window.removeEventListener("resize", onUserMenuReflow, true);
    window.removeEventListener("scroll", onUserMenuReflow, true);
    const buf = $("#messagebuffer");
    if (buf) buf.removeEventListener("scroll", onUserMenuReflow, true);
  }

  function onChatUserContextMenu(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const hit = t.closest(USER_TARGET_SEL);
    if (!hit) return;
    const name = nameFromTarget(hit);
    if (!name) return;
    const model = buildUserMenuModel(name);
    if (!model.hasAny) return; // nothing to offer (e.g. yourself) → leave native menu
    e.preventDefault();
    e.stopPropagation();
    showUserMenu(e.clientX, e.clientY, name, model);
  }

  function wireChatUserMenu() {
    if (document._btfwUserMenuWired) return;
    document._btfwUserMenuWired = true;
    document.addEventListener("contextmenu", onChatUserContextMenu, true);
  }

  /* ---- Userlist: replace CyTube's native .user-dropdown with our menu ----
     CyTube binds its dropdown to each entry's click + contextmenu, and the
     chat "click a name" proxy dispatches a synthetic contextmenu onto the same
     entry — so intercepting userlist entries here covers both. Our menu is
     position:fixed on <body>, so unlike the native dropdown it is never clipped
     by the userlist panel. */
  function nameFromUserlistEntry(entry) {
    if (!entry) return "";
    if (window.jQuery) {
      const n = window.jQuery(entry).data("name");
      if (n) return String(n);
    }
    const span = entry.querySelector("span[class^='userlist_']") || entry.querySelector(".nick");
    return span ? (span.textContent || "").trim() : "";
  }

  function onUserlistEntryMenu(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(".btfw-ctxmenu")) return;        // clicks inside our own menu
    const entry = t.closest("#userlist .userlist_item");
    if (!entry) return;
    const name = nameFromUserlistEntry(entry);
    if (!name) return;
    // Always suppress CyTube's native dropdown for userlist entries.
    e.preventDefault();
    e.stopImmediatePropagation();
    const model = buildUserMenuModel(name);
    if (!model.hasAny) { hideUserMenu(); return; }  // e.g. yourself → no menu
    showUserMenu(e.clientX || 0, e.clientY || 0, name, model);
  }

  function wireUserlistMenu() {
    if (document._btfwUserlistMenuWired) return;
    document._btfwUserlistMenuWired = true;
    document.addEventListener("click", onUserlistEntryMenu, true);
    document.addEventListener("contextmenu", onUserlistEntryMenu, true);
  }

  // Main initialization
  function boot() {
    // Observer is the reliable path; socket handler is an extra fast trigger
    // (both deduped via the processed WeakSet).
    wireMessageObserver();
    wireSocketEvents();

    processExistingMessages();
    decorateUserlist();
    wireChatUserMenu();
    wireUserlistMenu();
  }

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Public API
  return {
    name: "feature:chat-ignore",
    has,
    add,
    remove,
    toggle,
    list: () => Array.from(ignoredUsers)
  };
});
