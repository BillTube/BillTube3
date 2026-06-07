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
     Right-click menu on chat usernames / avatars → Ignore user
     Single delegated contextmenu listener; covers existing AND future
     messages with no per-row wiring. The username is derived from the
     row's chat-msg-<name> class (works on grouped continuation rows too).
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

  let umenu = null, umenuName = "", uDismissBound = false;

  function ensureUserMenu() {
    if (umenu) return umenu;
    umenu = document.createElement("div");
    umenu.id = "btfw-user-menu";
    umenu.className = "btfw-ctxmenu btfw-user-menu";
    umenu.setAttribute("role", "menu");
    umenu.hidden = true;
    umenu.innerHTML = `
      <div class="btfw-ctxmenu-title"></div>
      <button type="button" class="btfw-ctxmenu-item" data-act="ignore" role="menuitem">
        <i class="fa fa-user-slash" aria-hidden="true"></i><span class="btfw-ctxmenu-label">Ignore user</span>
      </button>`;
    document.body.appendChild(umenu);
    umenu.addEventListener("click", onUserMenuClick);
    umenu.addEventListener("contextmenu", (e) => e.preventDefault());
    return umenu;
  }

  function syncUserMenu(name) {
    const ignored = has(name);
    umenu.querySelector(".btfw-ctxmenu-title").textContent = name;
    const item = umenu.querySelector('[data-act="ignore"]');
    item.querySelector(".btfw-ctxmenu-label").textContent = ignored ? "Unignore user" : "Ignore user";
    item.querySelector("i").className = ignored ? "fa fa-user-check" : "fa fa-user-slash";
    item.classList.toggle("is-active", ignored);
  }

  function showUserMenu(x, y, name) {
    ensureUserMenu();
    umenuName = name;
    syncUserMenu(name);
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
    if (name && btn.dataset.act === "ignore") toggle(name);
    hideUserMenu();
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
    e.preventDefault();
    e.stopPropagation();
    showUserMenu(e.clientX, e.clientY, name);
  }

  function wireChatUserMenu() {
    if (document._btfwUserMenuWired) return;
    document._btfwUserMenuWired = true;
    document.addEventListener("contextmenu", onChatUserContextMenu, true);
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
