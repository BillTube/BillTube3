/* Shared chat nominations for the existing movie poll builders. No playlist is exposed. */
BTFW.define("util:pollSuggestions", [], async () => {
  "use strict";
  const LIMIT = 100;
  const storageKey = "btfw:poll-suggestions:v1:" + String(window.CHANNEL?.name || location.pathname).toLowerCase();
  const decoder = document.createElement("textarea");
  const users = new Map();
  let state = { queue: [], used: [], boundary: 0, seen: [], polls: [], media: "", active: false };
  let socketRef = null, pendingSend = 0, readPool = () => [];
  const catalogConfig = () => (window.BTFW_THEME_ADMIN || window.BTFW?.channelTheme || window.BTFW_CONFIG || {}).playlistCatalog;
  let enabled = catalogConfig()?.pollSuggestionsEnabled === true;
  const username = value => typeof value === "string" && /^[\w-]{1,20}$/.test(value) ? value.toLowerCase() : "";
  const permission = key => { try { return !!window.hasPermission?.(key); } catch (_) { return false; } };
  const canManage = () => Number(window.CLIENT?.rank) >= 2 && permission("pollctl") && permission("playlistmove");
  const integrated = () => Boolean(window.BTFW_CONFIG?.integrations?.randomMoviePoll?.enabled || document.body?.dataset?.btfwRandomMoviePollEnabled === "1");
  function decode(value) { decoder.innerHTML = String(value || ""); return decoder.value; }
  // Keep the year as part of identity: remakes and numeric movie names must stay distinct.
  function identity(value) {
    const text = String(value || "").normalize("NFKC").trim();
    const match = text.match(/^(.+?)\s*[([]?((?:18|19|20)\d{2})[)\]]?\s*$/);
    if (!match || Number(match[2]) > new Date().getFullYear() + 2) return "";
    const title = match[1].normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return title ? title + ":" + match[2] : "";
  }
  function validEntry(entry) {
    return entry && username(entry.user) && typeof entry.title === "string" && entry.title.length <= 180
      && entry.key === identity(entry.title) && entry.key && Number.isFinite(entry.at) && entry.at > 0;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && Array.isArray(saved.queue)) {
      const seenUsers = new Set(), seenMovies = new Set();
      state.queue = saved.queue.filter(validEntry).filter(entry => {
        if (seenUsers.has(entry.user) || seenMovies.has(entry.key)) return false;
        seenUsers.add(entry.user); seenMovies.add(entry.key); return true;
      }).slice(0, LIMIT);
      state.used = Array.isArray(saved.used) ? saved.used.filter(username).slice(-LIMIT) : [];
      state.boundary = Math.max(0, Number(saved.boundary) || 0);
      state.seen = Array.isArray(saved.seen) ? saved.seen.filter(x => typeof x === "string").slice(-300) : [];
      state.polls = Array.isArray(saved.polls) ? saved.polls.filter(x => typeof x === "string").slice(-20) : [];
      state.media = typeof saved.media === "string" ? saved.media : "";
      state.active = saved.active === true;
    }
  } catch (_) {}
  function notify(message, kind = "info") {
    const safe = String(message).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    window.BTFW_notify?.[kind]?.({ title: "Poll suggestions", html: "<span>" + safe + "</span>", timeout: 5200 });
  }
  let storageWarned = false;
  function changed() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { if (!storageWarned) { storageWarned = true; notify("Suggestions cannot be saved in this browser. Keep this tab open.", "warn"); } }
    document.dispatchEvent(new CustomEvent("btfw:pollSuggestionsChanged"));
    renderControl();
  }
  function userData(name) {
    const key = username(name);
    if (users.has(key)) return users.get(key);
    try {
      const row = window.findUserlistItem?.(key);
      if (row) return { rank: row.data("rank"), meta: row.data("meta") };
      for (const el of document.querySelectorAll("#userlist .userlist_item")) {
        const data = (window.jQuery || window.$)?.(el)?.data();
        if (username(data?.name) === key) return data;
      }
    } catch (_) {}
    return null;
  }
  function available() {
    const name = username(window.CLIENT?.name);
    return integrated() && enabled && !!name && window.CLIENT?.logged_in === true && window.CLIENT?.guest !== true
      && !state.used.includes(name) && !state.queue.some(entry => entry.user === name) && state.queue.length < LIMIT
      && Date.now() >= pendingSend && window.socket?.connected !== false;
  }
  function statusMessage() {
    const name = username(window.CLIENT?.name);
    if (!name || !window.CLIENT?.logged_in || window.CLIENT?.guest) return "Sign in to a registered CyTube account to suggest a movie.";
    if (state.queue.some(entry => entry.user === name)) return "Your suggestion is queued. Pending suggestions carry over until they enter a poll.";
    if (state.used.includes(name)) return "Your suggestion entered this poll. You can suggest again after the poll ends or the movie changes.";
    if (state.queue.length >= LIMIT) return "The suggestions queue is full. Please wait for a poll to make room.";
    return "Suggest one movie per round. Up to six suggestions enter each movie poll; extra suggestions carry over.";
  }
  function nominate(title) {
    if (!available()) { notify("Sign in to CyTube to suggest one movie per round. Pending suggestions carry over.", "warn"); return false; }
    title = String(title || "").replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim();
    const key = identity(title);
    if (!key || title.length > 180 || state.queue.some(entry => entry.key === key)) { notify("This movie is already suggested, or its title/year is unavailable.", "warn"); return false; }
    pendingSend = Date.now() + 5000;
    window.setTimeout(() => document.dispatchEvent(new CustomEvent("btfw:pollSuggestionsChanged")), 5000);
    try { window.socket.emit("chatMsg", { msg: "<PS:" + title + ">" }); }
    catch (_) { pendingSend = 0; notify("Could not send the suggestion. Try again.", "warn"); return false; }
    return true;
  }
  function onChat(data) {
    if (!data || data.meta?.shadow || data.meta?.addClass === "server-whisper") return;
    const text = decode(data.msg).trim();
    if (text.length > 200 || !text.startsWith("<PS")) return;
    const name = username(data.username), user = userData(name), at = Number(data.time);
    // Usernames, timestamps and ranks come from CyTube, never the command payload.
    if (!name || !(Number(user?.rank) >= 1) || user?.meta?.muted || user?.meta?.smuted
      || !Number.isFinite(at) || at <= state.boundary || at > Date.now() + 30000) return;
    const eventId = name + ":" + at + ":" + text;
    if (state.seen.includes(eventId)) return;
    const clearRank = Math.max(2, Number(window.CHANNEL?.perms?.pollctl) || 2, Number(window.CHANNEL?.perms?.playlistmove) || 2);
    if (text === "<PS-CLEAR>" && Number(user.rank) >= clearRank) {
      state.queue = []; state.used = []; state.boundary = at; state.seen = []; changed(); return;
    }
    if (!enabled || !integrated()) return;
    const match = text.match(/^<PS:([^<>\r\n]{1,180})>$/), key = identity(match?.[1]);
    if (!key || state.used.includes(name) || state.queue.some(entry => entry.user === name || entry.key === key) || state.queue.length >= LIMIT) return;
    state.seen.push(eventId); state.seen = state.seen.slice(-300);
    state.queue.push({ user: name, title: match[1].trim(), key, at });
    state.queue.sort((a, b) => a.at - b.at || a.user.localeCompare(b.user));
    if (name === username(window.CLIENT?.name)) { pendingSend = 0; notify("Movie suggested for an upcoming poll.", "success"); }
    changed();
  }
  // Resolve strictly against eligible upcoming rows. Ambiguous matches stay pending.
  function resolve(pool) {
    if (!enabled || !integrated()) return [];
    const index = new Map();
    for (const movie of pool) {
      const key = identity(movie.title);
      if (!key) continue;
      if (!index.has(key)) index.set(key, movie);
      else if (index.get(key)?.key !== movie.key) index.set(key, null);
    }
    const seen = new Set();
    return state.queue.map(entry => ({ entry, movie: index.get(entry.key) })).filter(item => {
      if (!item.movie) return false;
      const key = item.movie.mediaKey || item.movie.key;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 6);
  }
  function mix(pool, random, count) {
    if (!enabled || !integrated()) return random;
    const nominations = resolve(pool).map(item => item.movie);
    const result = [...nominations];
    const nominatedKeys = new Set(nominations.map(movie => identity(movie.title)));
    const overflow = new Set(state.queue.filter(entry => !nominatedKeys.has(entry.key)).map(entry => entry.key));
    const keys = new Set(result.map(movie => movie.key)), media = new Set(result.map(movie => movie.mediaKey).filter(Boolean));
    const target = Math.min(10, Math.max(Number(count) || random.length, nominations.length));
    for (const movie of random) {
      if (result.length >= target) break;
      if (overflow.has(identity(movie.title)) || keys.has(movie.key) || (movie.mediaKey && media.has(movie.mediaKey))) continue;
      result.push(movie); keys.add(movie.key); if (movie.mediaKey) media.add(movie.mediaKey);
    }
    // Random selections may overlap nominations. Fill any resulting gaps from the same eligible pool.
    const remaining = pool.filter(movie => !overflow.has(identity(movie.title)) && !keys.has(movie.key) && (!movie.mediaKey || !media.has(movie.mediaKey)));
    while (result.length < target && remaining.length) {
      const movie = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      if (keys.has(movie.key) || (movie.mediaKey && media.has(movie.mediaKey))) continue;
      result.push(movie); keys.add(movie.key); if (movie.mediaKey) media.add(movie.mediaKey);
    }
    return result;
  }
  function observePoll(poll) {
    const title = decode(poll?.title);
    if (!/^What should we watch next\? · \d+ (?:min|sec|minutes?|seconds?)$/.test(title) || !Array.isArray(poll.options)) return;
    const id = String(poll.timestamp || "") + ":" + title + ":" + poll.options.join("|");
    if (state.polls.includes(id)) return;
    const keys = new Set(poll.options.map(option => identity(decode(option))).filter(Boolean));
    state.used = [...new Set([...state.used, ...state.queue.filter(entry => keys.has(entry.key)).map(entry => entry.user)])].slice(-LIMIT);
    state.queue = state.queue.filter(entry => !keys.has(entry.key));
    state.polls.push(id); state.polls = state.polls.slice(-20); state.active = true;
    changed();
  }
  function endRound(at = Date.now()) {
    state.used = []; state.active = false; state.boundary = Math.max(state.boundary, at); changed();
  }
  function mediaChanged(media) {
    if (!media || typeof media !== "object" || !media.type || media.id == null) return;
    const key = media.type + ":" + media.id;
    if (state.media === key) return;
    if (state.media) endRound();
    const playing = identity(media.title);
    if (playing) state.queue = state.queue.filter(entry => entry.key !== playing);
    state.media = key; changed();
  }
  function syncConfiguration(catalog = catalogConfig()) {
    const next = catalog?.pollSuggestionsEnabled === true;
    if (next === enabled) return;
    enabled = next;
    document.dispatchEvent(new CustomEvent("btfw:pollSuggestionsChanged"));
    renderControl();
  }
  function observeChannelConfiguration(data) {
    if (typeof data?.js !== "string") return;
    const start = data.js.indexOf("// ==BTFW_THEME_ADMIN_START==");
    const end = data.js.indexOf("// ==BTFW_THEME_ADMIN_END==", start);
    if (start < 0 || end < start) { syncConfiguration({}); return; }
    const block = data.js.slice(start + "// ==BTFW_THEME_ADMIN_START==".length, end).trim();
    const assignment = block.match(/^window\.BTFW_THEME_ADMIN\s*=\s*([\s\S]*);$/);
    if (!assignment) return;
    try { syncConfiguration(JSON.parse(assignment[1])?.playlistCatalog || {}); } catch (_) {}
  }
  function renderControl() {
    const controls = document.querySelector("#pollwrap .poll-controls");
    let button = document.getElementById("btfw-poll-suggestions");
    if (!integrated() || !canManage()) {
      button?.remove(); const dialog = document.getElementById("btfw-suggestions-dialog"); if (dialog?.open) dialog.close(); dialog?.remove(); return;
    }
    if (!controls) return;
    if (!button) {
      button = document.createElement("button"); button.id = "btfw-poll-suggestions";
      button.type = "button"; button.className = "btn btn-sm btn-default button is-small";
      button.setAttribute("aria-haspopup", "dialog"); button.addEventListener("click", openDialog); controls.appendChild(button);
    }
    const label = "Suggestions (" + state.queue.length + ")";
    if (button.textContent !== label) button.textContent = label;
    const dialog = document.getElementById("btfw-suggestions-dialog");
    if (dialog?.open) fillDialog(dialog);
  }
  function fillDialog(dialog) {
    const list = dialog.querySelector("ol"); list.replaceChildren();
    const pool = readPool();
    const next = new Set(resolve(pool).map(item => item.entry.key));
    const eligible = new Set(pool.map(movie => identity(movie.title)));
    for (const entry of state.queue) {
      const status = next.has(entry.key) ? "next poll" : eligible.has(entry.key) ? "later poll" : "waiting for an eligible playlist match";
      const li = document.createElement("li"); li.textContent = entry.title + " — " + entry.user + " (" + status + ")"; list.appendChild(li);
    }
    dialog.querySelector("[data-empty]").hidden = state.queue.length > 0;
  }
  function openDialog() {
    if (!canManage()) return;
    let dialog = document.getElementById("btfw-suggestions-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog"); dialog.id = "btfw-suggestions-dialog";
      dialog.className = "btfw-suggestions-dialog"; dialog.setAttribute("aria-labelledby", "btfw-suggestions-heading");
      dialog.innerHTML = '<h3 id="btfw-suggestions-heading">Poll suggestions</h3><p>Up to six matching upcoming movies enter each movie poll. Extra suggestions carry over. Unavailable or ambiguous titles stay pending.</p><p data-empty>No suggestions yet.</p><ol></ol><div><button type="button" data-clear>Clear suggestions for everyone</button> <button type="button" data-close>Close</button></div>';
      dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => document.getElementById("btfw-poll-suggestions")?.focus());
      dialog.querySelector("[data-clear]").addEventListener("click", () => {
        if (canManage() && window.socket?.connected !== false) window.socket?.emit("chatMsg", { msg: "<PS-CLEAR>" });
      });
      document.body.appendChild(dialog);
    }
    fillDialog(dialog); if (!dialog.open) dialog.showModal();
  }
  function wire() {
    const socket = window.socket;
    if (!socket?.on || socket === socketRef) return;
    socketRef = socket;
    socket.on("chatMsg", onChat);
    socket.on("userlist", list => { users.clear(); if (Array.isArray(list)) list.forEach(user => users.set(username(user.name), user)); renderControl(); });
    socket.on("addUser", user => { users.set(username(user.name), user); });
    socket.on("setUserRank", user => { const key = username(user.name); users.set(key, { ...users.get(key), ...user }); renderControl(); });
    socket.on("setUserMeta", user => { const key = username(user.name); if (users.has(key)) users.set(key, { ...users.get(key), meta: user.meta }); });
    socket.on("userLeave", user => users.delete(username(user?.name || user)));
    socket.on("channelCSSJS", observeChannelConfiguration);
    socket.on("newPoll", observePoll);
    socket.on("closePoll", () => { if (state.active) endRound(); });
    socket.on("setCurrent", () => {
      const row = document.querySelector("#queue > .queue_active");
      try { mediaChanged((window.jQuery || window.$)?.(row)?.data("media")); } catch (_) {}
    });
    socket.on("changeMedia", mediaChanged);
    socket.on("connect", () => { users.clear(); pendingSend = 0; });
    socket.on("login", () => document.dispatchEvent(new CustomEvent("btfw:pollSuggestionsChanged")));
    socket.on("rank", renderControl);
  }
  wire();
  window.setInterval(() => { wire(); renderControl(); }, 2000);
  document.addEventListener("btfw:channelIntegrationsChanged", renderControl);
  document.addEventListener("btfw:playlistCatalogChanged", event => syncConfiguration(event.detail || catalogConfig()));
  const api = { reconcilePoll: active => { if (!active && state.active && window.socket?.connected !== false) endRound(); }, setPoolReader: callback => { readPool = callback; }, enabled: () => enabled && integrated(), canManage, available, statusMessage, nominate, mix, resolve, observePoll,
    onChat, mediaChanged, endRound, identity, getQueue: () => state.queue.map(entry => ({ ...entry })), renderControl };
  return api;
});
