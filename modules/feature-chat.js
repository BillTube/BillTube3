// modules/feature-chat.js
BTFW.define("feature:chat", ["feature:layout"], async ({ require }) => {
  // Wait for layout
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function ensureBars() {
    const chatwrap = qs("#chatwrap");
    if (!chatwrap) return;

    chatwrap.classList.add("btfw-chatwrap");

    // Top bar for media title only
    if (!qs(".btfw-chat-topbar", chatwrap)) {
      const top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = `
        <div class="btfw-chat-title" id="btfw-chat-title">Loading title…</div>
        <div class="btfw-chat-userbtn">
          <button id="btfw-users-toggle" class="btfw-ghost"><i class="fa fa-users"></i></button>
        </div>`;
      chatwrap.prepend(top);
    }

    // Bottom bar for ALL controls (emotes, gifs, settings, send)
    if (!qs(".btfw-chat-bottombar", chatwrap)) {
      const bottom = document.createElement("div");
      bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `
        <div class="btfw-chat-actions" id="btfw-chat-actions">
          <!-- buttons injected here -->
        </div>`;
      chatwrap.append(bottom);
    }

    // Make message buffer grow properly
    const msg = qs("#messagebuffer");
    if (msg) msg.classList.add("btfw-messagebuffer");

    // Move existing CyTube bits to correct places
    const emotebtn = qs("#emotelistbtn");
    if (emotebtn) {
      emotebtn.classList.add("btfw-chatbtn");
      qs("#btfw-chat-actions").appendChild(emotebtn);
    }

    // Add GIFs button (handled by feature:gifs)
    if (!qs("#btfw-gif-btn")) {
      const gif = document.createElement("button");
      gif.id = "btfw-gif-btn";
      gif.className = "btfw-chatbtn";
      gif.title = "GIFs (Giphy/Tenor)";
      gif.innerHTML = `<i class="fa-solid fa-gif"></i>`;
      gif.onclick = () => document.dispatchEvent(new Event("btfw:openGifs"));
      qs("#btfw-chat-actions").appendChild(gif);
    }

    // Add Theme settings button on the chat as well
    if (!qs("#btfw-theme-btn-chat")) {
      const th = document.createElement("button");
      th.id = "btfw-theme-btn-chat";
      th.className = "btfw-chatbtn";
      th.title = "Theme settings";
      th.innerHTML = `<i class="fa fa-sliders"></i>`;
      th.onclick = () => document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      qs("#btfw-chat-actions").appendChild(th);
    }

    // Add Users toggle (overlay)
    const usersToggle = qs("#btfw-users-toggle");
    if (usersToggle && !usersToggle.dataset.bound) {
      usersToggle.dataset.bound = "1";
      on(usersToggle, "click", toggleUserOverlay);
    }

    // Ensure chatline stays full width below actions
    const controls = qs("#chatcontrols,#chat-controls") || qs("#chatline").parentElement;
    if (controls) {
      controls.classList.add("btfw-controls-row");
      qs(".btfw-chat-bottombar")?.after(controls);
    }
  }

  // User list overlay logic
  function toggleUserOverlay() {
    const userlist = qs("#userlist");
    if (!userlist) return;
    userlist.classList.toggle("btfw-userlist-overlay--open");
  }
  function prepareUserlistOverlay() {
    const userlist = qs("#userlist");
    if (!userlist) return;
    userlist.classList.add("btfw-userlist-overlay");
    // default hidden
    userlist.classList.remove("btfw-userlist-overlay--open");
  }

  // Title in top bar; source it from CyTube
  function getCurrentTitle() {
    const fromHeader = qs("#currenttitle")?.textContent?.trim();
    if (fromHeader) return fromHeader;
    // fallback on channel data if present
    try { return (window.CHANNEL && window.CHANNEL.media && window.CHANNEL.media.title) || ""; } catch(e){ return ""; }
  }
  function updateTitle() {
    const el = qs("#btfw-chat-title");
    if (el) el.textContent = getCurrentTitle() || "Now Playing";
  }

  // Username colors (same algorithm as BillTube2)
  function stringToColour(str) { // :contentReference[oaicite:4]{index=4}
    for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));
    for (var i = 0, colour = "#"; i < 3; colour += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));
    return colour;
  }
  function applyUsernameColor(node) {
    const u = node.querySelector && node.querySelector(".username");
    if (!u) return;
    const name = u.textContent.replace(":", "").trim();
    u.style.color = stringToColour(name);
  }
  function observeChat() {
    const buf = qs("#messagebuffer");
    if (!buf || buf._btfw_observed) return;
    buf._btfw_observed = true;
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(applyUsernameColor))).observe(buf, { childList: true });
    // initial pass
    qsa("#messagebuffer .username").forEach(el => applyUsernameColor(el.parentElement || el));
  }

  // Initialisation
  const once = () => {
    ensureBars();
    prepareUserlistOverlay();
    observeChat();
    updateTitle();
  };

  document.addEventListener("btfw:layoutReady", once);
  // Also refresh title on media changes
  (window.socket && window.socket.on) && window.socket.on("changeMedia", updateTitle);
  document.addEventListener("ytVideoIdSet", updateTitle); // just in case
  setInterval(updateTitle, 2500);

  return { name: "feature:chat" };
});
