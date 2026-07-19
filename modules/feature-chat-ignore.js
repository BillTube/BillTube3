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

  // Ignore-list API
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
      handleModerationChatResult(data);
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

    socket.on("errorMsg", handleModerationError);
    socket.on("banlist", handleModerationBanlist);
    socket.on("userlist", data => updateModerationPresence("userlist", data));
    socket.on("addUser", data => updateModerationPresence("addUser", data));
    socket.on("userLeave", data => updateModerationPresence("userLeave", data));
    ["setPermissions", "rank", "setUserRank", "setUserMeta", "setLeader"].forEach(event => {
      socket.on(event, () => window.setTimeout(() => {
        refreshOpenUserMenu();
        if (moderationDialog && MODERATION_ACTIONS[moderationDialog.dataset.action]) updateModerationDialogAvailability(moderationDialog);
      }, 0));
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
  function chatCmd(msg) {
    try {
      if (!window.socket || typeof window.socket.emit !== "function") return false;
      window.socket.emit("chatMsg", { msg, meta: {} });
      return true;
    } catch (_) { return false; }
  }

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

  const MODERATION_ACTIONS = {
    kick: { title: "Kick user", confirm: "Send kick", command: "/kick", permission: "kick", live: true, detail: "Disconnects this user once. They may reconnect unless they are also banned." },
    nameban: { title: "Name ban user", confirm: "Send name ban", command: "/ban", permission: "ban", live: false, detail: "Prevents this username from joining, including after they disconnect." },
    ipban: { title: "IP ban user", confirm: "Send IP ban", command: "/ipban", permission: "ban", live: false, strongConfirm: true, detail: "Blocks every known IP associated with this username and may affect other people on shared connections." }
  };
  const MOD_AUDIT_LIMIT = 50;
  const MOD_COMMAND_TIMEOUT_MS = 8000;
  const MOD_COMMAND_COOLDOWN_MS = 5000;
  const KICK_RECONNECT_WINDOW_MS = 5 * 60 * 1000;
  const moderationPresence = new Set();
  const moderationCooldowns = new Map();
  const recentConfirmedKicks = new Map();
  let moderationPresenceKnown = false;
  let moderationDialog = null;
  let moderationRestoreFocus = null;
  let pendingModeration = null;
  let escalationNotice = null;

  function lowerName(value) { return String(value || "").trim().toLowerCase(); }
  function channelAuditKey() {
    const channel = (window.CHANNEL && window.CHANNEL.name) || location.pathname.split("/").filter(Boolean).pop() || "channel";
    return "btfw:moderation:audit:" + lowerName(channel);
  }
  function readModerationAudit() {
    try {
      const value = JSON.parse(localStorage.getItem(channelAuditKey()) || "[]");
      if (!Array.isArray(value)) return [];
      let changed = false;
      const entries = value.slice(0, MOD_AUDIT_LIMIT).map(entry => {
        if (entry && entry.status === "pending" && Date.now() - Number(entry.at || 0) > 30000) {
          entry.status = "unconfirmed";
          entry.result = "Page closed or reloaded before CyTube reported a result";
          entry.updatedAt = Date.now();
          changed = true;
        }
        return entry;
      });
      if (changed) localStorage.setItem(channelAuditKey(), JSON.stringify(entries));
      return entries;
    } catch (_) { return []; }
  }
  function writeModerationAudit(entries) {
    try { localStorage.setItem(channelAuditKey(), JSON.stringify(entries.slice(0, MOD_AUDIT_LIMIT))); } catch (_) {}
  }
  function addModerationAudit(action, target, reason) {
    const entries = readModerationAudit();
    const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), action, target, reason, at: Date.now(), status: "pending", result: "Awaiting CyTube response" };
    entries.unshift(entry);
    writeModerationAudit(entries);
    return entry.id;
  }
  function updateModerationAudit(id, status, result) {
    const entries = readModerationAudit();
    const entry = entries.find(item => item && item.id === id);
    if (!entry) return;
    entry.status = status;
    entry.result = String(result || "").slice(0, 300);
    entry.updatedAt = Date.now();
    writeModerationAudit(entries);
  }
  function moderationFeedback(message, error) {
    const notify = window.BTFW_notify;
    const fn = notify && (error ? notify.error : notify.success);
    try { if (typeof fn === "function") fn.call(notify, message); } catch (_) {}
  }
  function closeModerationDialog() {
    if (!moderationDialog) return;
    const dialog = moderationDialog;
    if (dialog._btfwCooldownTimer) clearTimeout(dialog._btfwCooldownTimer);
    moderationDialog = null;
    dialog.remove();
    if (moderationRestoreFocus && document.contains(moderationRestoreFocus)) try { moderationRestoreFocus.focus(); } catch (_) {}
    moderationRestoreFocus = null;
  }
  function setModerationStatus(dialog, message, error) {
    if (!dialog || !dialog.isConnected) return;
    const status = dialog.querySelector(".btfw-moderation-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", !!error);
  }
  function sanitizeReason(value) { return String(value || "").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 255); }
  function validModerationTarget(name) { return !!name && !/[\s/\x00-\x1f\x7f]/.test(name); }
  function isUserPresent(name) {
    const lower = lowerName(name);
    if (moderationPresenceKnown) return moderationPresence.has(lower);
    return !!findUserEntry(name);
  }
  function seedModerationPresence() {
    moderationPresence.clear();
    document.querySelectorAll("#userlist .userlist_item").forEach(item => {
      const name = nameFromUserlistEntry(item);
      if (name) moderationPresence.add(lowerName(name));
    });
    moderationPresenceKnown = true;
  }
  function refreshOpenUserMenu() {
    if (!umenu || umenu.hidden || !umenuName) return;
    renderUserMenu(buildUserMenuModel(umenuName));
  }
  function updateModerationPresence(event, payload) {
    if (event === "userlist") {
      moderationPresence.clear();
      if (Array.isArray(payload)) payload.forEach(user => { if (user && user.name) moderationPresence.add(lowerName(user.name)); });
      moderationPresenceKnown = true;
    } else if (payload && payload.name) {
      moderationPresenceKnown = true;
      if (event === "addUser") moderationPresence.add(lowerName(payload.name));
      else if (event === "userLeave") moderationPresence.delete(lowerName(payload.name));
    }
    refreshOpenUserMenu();
    if (moderationDialog && MODERATION_ACTIONS[moderationDialog.dataset.action]) updateModerationDialogAvailability(moderationDialog);
    if (event === "addUser" && payload && payload.name) handleKickedUserReconnect(payload.name);
  }
  function cooldownRemaining(action, name) {
    const until = moderationCooldowns.get(action + ":" + lowerName(name)) || 0;
    return Math.max(0, until - Date.now());
  }
  function updateModerationDialogAvailability(dialog) {
    if (!dialog || !dialog.isConnected) return;
    const action = dialog.dataset.action;
    const name = dialog.dataset.target;
    const config = MODERATION_ACTIONS[action];
    const submit = dialog.querySelector(".btfw-moderation-confirm");
    if (!config || !submit || dialog.dataset.submitted === "true") return;
    const context = userContext(name);
    let message = "", blocked = false;
    if (!can(config.permission)) { blocked = true; message = "You do not currently have permission for this action."; }
    else if (sameName(name, myName())) { blocked = true; message = "You cannot use this action on yourself."; }
    else if (context.present && !context.moderatable) { blocked = true; message = "This user is protected by an equal or higher rank."; }
    else if (config.live && !isUserPresent(name)) { blocked = true; message = name + " is disconnected. Nothing can be kicked."; }
    else if (pendingModeration) { blocked = true; message = "Wait for the current moderation command to finish."; }
    else {
      const remaining = cooldownRemaining(action, name);
      if (remaining > 0) { blocked = true; message = "Please wait " + Math.ceil(remaining / 1000) + "s before repeating this action."; }
    }
    if (!blocked && config.strongConfirm) {
      const verify = dialog.querySelector(".btfw-moderation-verify");
      if (!verify || String(verify.value || "").trim() !== name) { blocked = true; message = "Type the username exactly to enable IP ban."; }
    }
    submit.disabled = blocked;
    setModerationStatus(dialog, message, blocked);
  }
  function expectedModerationSuccess(pending, data) {
    if (!pending || !data || lowerName(data.username) !== "[server]") return false;
    if (!data.meta || data.meta.addClass !== "server-whisper") return false;
    const text = String(data.msg || "").replace(/<[^>]*>/g, "").trim().toLowerCase();
    const actor = lowerName(myName()), target = lowerName(pending.name);
    if (pending.act === "kick") return text === actor + " kicked " + target;
    if (pending.act === "nameban") return text === actor + " namebanned " + target;
    if (pending.act === "ipban") return text === actor + " namebanned " + target || (text.startsWith(actor + " banned ") && text.endsWith("(" + target + ")"));
    return false;
  }
  function finishModeration(status, message) {
    const pending = pendingModeration;
    if (!pending) return;
    pendingModeration = null;
    clearTimeout(pending.timer);
    if (pending.verifyTimer) clearTimeout(pending.verifyTimer);
    updateModerationAudit(pending.auditId, status, message);
    const error = status !== "confirmed";
    setModerationStatus(pending.dialog, message, error);
    moderationFeedback(message, error);
    if (pending.dialog && pending.dialog.isConnected) {
      pending.dialog.dataset.submitted = "done";
      const submit = pending.dialog.querySelector(".btfw-moderation-confirm");
      if (submit) submit.disabled = true;
      const cancel = pending.dialog.querySelector(".btfw-moderation-cancel");
      if (cancel) { cancel.disabled = false; cancel.textContent = "Close"; }
    }
    if (status === "confirmed" && pending.act === "kick") {
      recentConfirmedKicks.set(lowerName(pending.name), { name: pending.name, reason: pending.reason, at: Date.now(), auditId: pending.auditId });
    }
    window.setTimeout(() => { if (moderationDialog === pending.dialog) closeModerationDialog(); }, status === "confirmed" ? 1800 : 3500);
  }
  function handleModerationChatResult(data) {
    if (!expectedModerationSuccess(pendingModeration, data)) return;
    if (pendingModeration.act !== "ipban") {
      finishModeration("confirmed", MODERATION_ACTIONS[pendingModeration.act].title + " confirmed by CyTube.");
      return;
    }
    // /ipban may create several records asynchronously. A server whisper proves
    // activity, not completion, so verify the resulting ban list before success.
    pendingModeration.successSeen = true;
    setModerationStatus(pendingModeration.dialog, "CyTube reported ban activity. Verifying the ban list…", false);
    if (!pendingModeration.verifyTimer) {
      pendingModeration.verifyTimer = window.setTimeout(() => {
        if (pendingModeration && pendingModeration.act === "ipban") {
          try { window.socket.emit("requestBanlist"); } catch (_) {}
        }
      }, 800);
    }
  }
  function handleModerationBanlist(entries) {
    if (!pendingModeration || pendingModeration.act !== "ipban" || !Array.isArray(entries)) return;
    const matches = entries.filter(entry => entry && sameName(entry.name, pendingModeration.name));
    const hasIPRecord = matches.some(entry => entry.ip && entry.ip !== "*");
    if (hasIPRecord) finishModeration("confirmed", "IP ban confirmed in CyTube's ban list.");
  }
  function handleModerationError(data) {
    if (!pendingModeration) return;
    const message = data && data.msg ? String(data.msg).replace(/<[^>]*>/g, "").trim() : "";
    const text = message.toLowerCase();
    const target = lowerName(pendingModeration.name);
    const relevant = text.includes(target) || (pendingModeration.act === "kick"
      ? /kick|permission/.test(text)
      : /ban|permission|invalid username|channel not live/.test(text));
    if (!relevant) return;
    finishModeration("failed", "CyTube rejected the command: " + (message || "Unknown moderation error"));
  }
  function timeoutModeration() {
    if (!pendingModeration) return;
    if (pendingModeration.act === "ipban" && pendingModeration.successSeen) {
      finishModeration("unconfirmed", "CyTube reported ban activity, but no IP ban record appeared. Check the ban list before retrying.");
    } else {
      finishModeration("unconfirmed", "No CyTube confirmation arrived. Check chat or the user list before retrying.");
    }
  }
  function submitModerationAction(dialog, act, name) {
    const config = MODERATION_ACTIONS[act];
    const submit = dialog.querySelector(".btfw-moderation-confirm");
    updateModerationDialogAvailability(dialog);
    if (!config || !submit || submit.disabled) return;
    if (!validModerationTarget(name)) { setModerationStatus(dialog, "This username cannot be used in a moderation command.", true); return; }
    const input = dialog.querySelector(".btfw-moderation-reason");
    const reason = sanitizeReason(input ? input.value : "");
    const command = config.command + " " + name + (reason ? " " + reason : "");
    const auditId = addModerationAudit(act, name, reason);
    dialog.dataset.submitted = "true";
    submit.disabled = true;
    const cancel = dialog.querySelector(".btfw-moderation-cancel");
    if (cancel) cancel.disabled = true;
    setModerationStatus(dialog, "Sent. Waiting for CyTube confirmation…", false);
    if (!chatCmd(command)) {
      dialog.dataset.submitted = "false";
      if (cancel) cancel.disabled = false;
      updateModerationAudit(auditId, "failed", "Socket was unavailable; command not sent");
      updateModerationDialogAvailability(dialog);
      setModerationStatus(dialog, "Could not send the command. Check your connection and try again.", true);
      moderationFeedback("Moderation command could not be sent.", true);
      return;
    }
    moderationCooldowns.set(act + ":" + lowerName(name), Date.now() + MOD_COMMAND_COOLDOWN_MS);
    pendingModeration = { act, name, reason, auditId, dialog, sentAt: Date.now(), timer: window.setTimeout(timeoutModeration, MOD_COMMAND_TIMEOUT_MS) };
  }
  function showModerationDialog(act, name) {
    const config = MODERATION_ACTIONS[act];
    if (!config) return;
    closeModerationDialog();
    hideUserMenu();
    moderationRestoreFocus = document.activeElement;
    const dialog = document.createElement("div");
    dialog.className = "btfw-moderation-dialog";
    dialog.dataset.action = act;
    dialog.dataset.target = name;
    dialog.dataset.submitted = "false";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const verify = config.strongConfirm ? '<label class="btfw-moderation-label btfw-moderation-verify-label">Type <strong></strong> to confirm<input class="btfw-moderation-verify" type="text" autocomplete="off" spellcheck="false"></label>' : "";
    dialog.innerHTML = '<div class="btfw-moderation-card"><div class="btfw-moderation-title"></div><div class="btfw-moderation-target"></div><p class="btfw-moderation-detail"></p><label class="btfw-moderation-label">Reason <span>(optional)</span><input class="btfw-moderation-reason" type="text" maxlength="255" autocomplete="off"></label>' + verify + '<div class="btfw-moderation-status" aria-live="polite"></div><div class="btfw-moderation-actions"><button type="button" class="btfw-moderation-cancel">Cancel</button><button type="button" class="btfw-moderation-confirm"></button></div></div>';
    dialog.querySelector(".btfw-moderation-title").textContent = config.title;
    dialog.querySelector(".btfw-moderation-target").textContent = name;
    dialog.querySelector(".btfw-moderation-detail").textContent = config.detail;
    dialog.querySelector(".btfw-moderation-confirm").textContent = config.confirm;
    const verifyStrong = dialog.querySelector(".btfw-moderation-verify-label strong");
    if (verifyStrong) verifyStrong.textContent = name;
    dialog.querySelector(".btfw-moderation-cancel").addEventListener("click", closeModerationDialog);
    dialog.querySelector(".btfw-moderation-confirm").addEventListener("click", () => submitModerationAction(dialog, act, name));
    dialog.querySelectorAll("input").forEach(input => input.addEventListener("input", () => updateModerationDialogAvailability(dialog)));
    dialog.addEventListener("mousedown", event => { if (event.target === dialog && dialog.dataset.submitted !== "true") closeModerationDialog(); });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape" && dialog.dataset.submitted !== "true") { event.preventDefault(); closeModerationDialog(); }
      else if (event.key === "Enter") { event.preventDefault(); submitModerationAction(dialog, act, name); }
      else if (event.key === "Tab") {
        const focusable = Array.from(dialog.querySelectorAll("input, button:not([disabled])"));
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    moderationDialog = dialog;
    document.body.appendChild(dialog);
    updateModerationDialogAvailability(dialog);
    const cooldown = cooldownRemaining(act, name);
    if (cooldown > 0) dialog._btfwCooldownTimer = window.setTimeout(() => updateModerationDialogAvailability(dialog), cooldown + 30);
    window.requestAnimationFrame(() => { dialog.classList.add("is-open"); dialog.querySelector(".btfw-moderation-reason").focus(); });
  }
  function showModerationHistory(name) {
    closeModerationDialog();
    hideUserMenu();
    const entries = readModerationAudit().filter(item => sameName(item.target, name));
    const dialog = document.createElement("div");
    dialog.className = "btfw-moderation-dialog btfw-moderation-history";
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = '<div class="btfw-moderation-card"><div class="btfw-moderation-title">Moderation history</div><div class="btfw-moderation-target"></div><div class="btfw-moderation-history-list"></div><div class="btfw-moderation-actions"><button type="button" class="btfw-moderation-cancel">Close</button></div></div>';
    dialog.querySelector(".btfw-moderation-target").textContent = name;
    const list = dialog.querySelector(".btfw-moderation-history-list");
    if (!entries.length) list.textContent = "No moderation actions recorded on this browser.";
    entries.forEach(entry => {
      const row = document.createElement("div"); row.className = "btfw-moderation-history-row is-" + entry.status;
      const head = document.createElement("strong"); head.textContent = entry.action + " · " + new Date(entry.at).toLocaleString();
      const result = document.createElement("span"); result.textContent = entry.result || entry.status;
      row.append(head, result);
      if (entry.reason) { const reason = document.createElement("span"); reason.textContent = "Reason: " + entry.reason; row.appendChild(reason); }
      list.appendChild(row);
    });
    moderationDialog = dialog;
    dialog.querySelector(".btfw-moderation-cancel").addEventListener("click", closeModerationDialog);
    dialog.addEventListener("mousedown", event => { if (event.target === dialog) closeModerationDialog(); });
    dialog.addEventListener("keydown", event => { if (event.key === "Escape") closeModerationDialog(); });
    document.body.appendChild(dialog);
    window.requestAnimationFrame(() => { dialog.classList.add("is-open"); dialog.querySelector("button").focus(); });
  }
  function closeEscalationNotice() { if (escalationNotice) escalationNotice.remove(); escalationNotice = null; }
  function handleKickedUserReconnect(name) {
    const kick = recentConfirmedKicks.get(lowerName(name));
    if (!kick || Date.now() - kick.at > KICK_RECONNECT_WINDOW_MS || !can("ban")) return;
    recentConfirmedKicks.delete(lowerName(name));
    updateModerationAudit(kick.auditId, "reconnected", name + " reconnected after the confirmed kick");
    closeEscalationNotice();
    const notice = document.createElement("div");
    notice.className = "btfw-moderation-escalation";
    notice.innerHTML = '<div><strong></strong><span>reconnected after being kicked.</span></div><div class="btfw-moderation-escalation-actions"><button type="button" data-action="nameban">Name ban</button><button type="button" data-action="ipban">IP ban</button><button type="button" data-action="dismiss" aria-label="Dismiss">×</button></div>';
    notice.querySelector("strong").textContent = name;
    notice.addEventListener("click", event => {
      const action = event.target.closest("button") && event.target.closest("button").dataset.action;
      if (!action) return;
      closeEscalationNotice();
      if (action !== "dismiss") showModerationDialog(action, name);
    });
    escalationNotice = notice;
    document.body.appendChild(notice);
    window.setTimeout(() => { if (escalationNotice === notice) closeEscalationNotice(); }, 20000);
  }
  function userContext(name) {
    const present = isUserPresent(name);
    const $e = present ? findUserEntry(name) : null;
    const meta = $e ? ($e.data("meta") || {}) : {};
    const actorRank = Number(window.CLIENT && window.CLIENT.rank);
    const targetRank = Number($e && $e.data("rank"));
    const rankKnown = present && Number.isFinite(actorRank) && Number.isFinite(targetRank);
    return {
      self: sameName(name, myName()), present, loggedIn: isLoggedIn(),
      leader: !!($e && $e.data("leader")), muted: !!(meta.muted || meta.smuted), ignored: has(name),
      moderatable: !rankKnown || actorRank > targetRank
    };
  }

  // Recomputed when opened, on presence changes, and immediately before action.
  function buildUserMenuModel(name) {
    const c = userContext(name);
    const main = [], mod = [];
    if (c.self) {
      if (c.present && can("leaderctl")) mod.push({ act: "leader", icon: "fa fa-star", label: c.leader ? "Remove leader" : "Give leader" });
    } else {
      if (c.loggedIn && c.present) main.push({ act: "pm", icon: "fa fa-comment", label: "Private message" });
      main.push({ act: "ignore", icon: c.ignored ? "fa fa-user-check" : "fa fa-user-slash", label: c.ignored ? "Unignore user" : "Ignore user", active: c.ignored });
      if (!c.present) main.push({ act: "disconnected", icon: "fa fa-plug-circle-xmark", label: "Disconnected", disabled: true });
      else if (!c.moderatable && (can("kick") || can("mute") || can("ban"))) main.push({ act: "protected", icon: "fa fa-shield", label: "Protected rank", disabled: true });
      if (c.present && can("leaderctl")) mod.push({ act: "leader", icon: "fa fa-star", label: c.leader ? "Remove leader" : "Give leader" });
      if (c.present && c.moderatable && can("kick")) mod.push({ act: "kick", icon: "fa fa-right-from-bracket", label: "Kick", danger: true });
      if (c.present && c.moderatable && can("mute")) {
        if (c.muted) mod.push({ act: "unmute", icon: "fa fa-volume-high", label: "Unmute" });
        else {
          mod.push({ act: "mute", icon: "fa fa-volume-xmark", label: "Mute" });
          mod.push({ act: "smute", icon: "fa fa-volume-off", label: "Shadow mute" });
        }
      }
      if (can("ban") && (!c.present || c.moderatable)) {
        mod.push({ act: "nameban", icon: "fa fa-gavel", label: "Name ban", danger: true });
        mod.push({ act: "ipban", icon: "fa fa-ban", label: "IP ban", danger: true });
      }
      if (can("kick") || can("ban")) mod.push({ act: "history", icon: "fa fa-clock-rotate-left", label: "Moderation history" });
    }
    return { name, present: c.present, main, mod, hasAny: (main.length + mod.length) > 0 };
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
    umenu.querySelector(".btfw-ctxmenu-title").textContent = model.name + (model.present ? "" : " · Disconnected");
    const body = umenu.querySelector(".btfw-ctxmenu-body");
    body.innerHTML = "";
    const addItem = (it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btfw-ctxmenu-item" + (it.active ? " is-active" : "") + (it.danger ? " is-danger" : "") + (it.disabled ? " is-disabled" : "");
      b.dataset.act = it.act;
      b.setAttribute("role", "menuitem");
      b.disabled = !!it.disabled;
      if (it.disabled) b.setAttribute("aria-disabled", "true");
      const i = document.createElement("i"); i.className = it.icon; i.setAttribute("aria-hidden", "true");
      const s = document.createElement("span"); s.className = "btfw-ctxmenu-label"; s.textContent = it.label;
      b.appendChild(i); b.appendChild(s);
      body.appendChild(b);
    };
    model.main.forEach(addItem);
    if (model.mod.length) {
      if (model.main.length) {
        const sep = document.createElement("div"); sep.className = "btfw-ctxmenu-sep"; body.appendChild(sep);
      }
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
    const current = buildUserMenuModel(name);
    const item = current.main.concat(current.mod).find(candidate => candidate.act === act);
    if (!item || item.disabled) {
      renderUserMenu(current);
      moderationFeedback(name + " is disconnected or that action is no longer available.", true);
      return;
    }
    hideUserMenu();
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
      case "kick":
      case "nameban":
      case "ipban":
        showModerationDialog(act, name);
        break;
      case "history":
        showModerationHistory(name);
        break;
      case "mute":   chatCmd("/mute " + name); break;
      case "smute":  chatCmd("/smute " + name); break;
      case "unmute": chatCmd("/unmute " + name); break;
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
    const model = buildUserMenuModel(name);
    // Only replace CyTube's menu when we actually have something to show.
    // This avoids swallowing right-click for users with no applicable actions.
    if (!model.hasAny) { hideUserMenu(); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
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
    seedModerationPresence();
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
    list: () => Array.from(ignoredUsers),
    moderationHistory: () => (can("kick") || can("ban")) ? readModerationAudit().map(entry => ({ ...entry })) : []
  };
});
