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

  // Extract username from message element (cached result)
  const usernameCache = new WeakMap();
  function getUserFromMessage(el) {
    if (usernameCache.has(el)) return usernameCache.get(el);

    const u = el.querySelector(".username");
    if (!u) {
      usernameCache.set(el, "");
      return "";
    }

    const name = (u.textContent || "").trim().replace(/:\s*$/, "");
    usernameCache.set(el, name);
    return name;
  }

  // Process single message (optimized)
  function processMessage(el) {
    if (processedMessages.has(el)) return; // Already processed

    const name = getUserFromMessage(el);
    if (name && has(name)) {
      el.style.display = "none";
      el.setAttribute("data-btfw-ignored", "true");
    }

    processedMessages.add(el);
  }

  // Hide existing messages from a specific user
  function hideExistingMessages(username) {
    const buf = $("#messagebuffer");
    if (!buf) return;

    const lower = username.toLowerCase();
    for (const el of buf.children) {
      if (el.nodeType !== 1) continue;
      const msgUser = getUserFromMessage(el);
      if (msgUser.toLowerCase() === lower) {
        el.style.display = "none";
        el.setAttribute("data-btfw-ignored", "true");
      }
    }
  }

  // Show existing messages from a specific user
  function showExistingMessages(username) {
    const buf = $("#messagebuffer");
    if (!buf) return;

    const lower = username.toLowerCase();
    for (const el of buf.children) {
      if (el.nodeType !== 1) continue;
      if (el.getAttribute("data-btfw-ignored")) {
        const msgUser = getUserFromMessage(el);
        if (msgUser.toLowerCase() === lower) {
          el.style.display = "";
          el.removeAttribute("data-btfw-ignored");
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

  // Fallback: minimal DOM observer for when socket isn't available
  function wireDOMFallback() {
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

  // Main initialization
  function boot() {
    // Try socket first (most efficient), fallback to DOM observer
    if (!wireSocketEvents()) {
      wireDOMFallback();
    }

    processExistingMessages();
    decorateUserlist();
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
