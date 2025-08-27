BTFW.define("feature:layout", ["core"], async ({ require }) => {
  function removeVideoHeaderOnce(){
    var vh = document.getElementById("videowrap-header");
    if (vh && vh.parentNode) vh.parentNode.removeChild(vh);
  }
  function watchVideoHeader(){
    var v = document.getElementById("videowrap");
    if (!v) return;
    removeVideoHeaderOnce();
    var mo = new MutationObserver(function(m){
      m.forEach(function(r){
        if (r.addedNodes) r.addedNodes.forEach(function(n){
          if (!n) return;
          if (n.id === "videowrap-header" || (n.querySelector && n.querySelector("#videowrap-header"))) {
            removeVideoHeaderOnce();
          }
        });
      });
    });
    mo.observe(v, { childList: true, subtree: true });
  }

  // --- BTFW CHANGE START ---
  // New function to create the info panel below the video
  function ensureStreamerInfoPanel() {
    var leftPad = document.getElementById("btfw-leftpad");
    var videoWrap = document.getElementById("videowrap");
    if (!leftPad || !videoWrap || document.getElementById("btfw-streamer-info")) return;

    // Hide the original playlist/queue element
    var queue = document.getElementById("playlistrow") || document.getElementById("playlistwrap") || document.getElementById("queuecontainer");
    if (queue) queue.style.display = "none";

    var panel = document.createElement("div");
    panel.id = "btfw-streamer-info";

    // --- Data fetching (placeholders for now)
    var streamerName = (window.CHANNEL && CHANNEL.name) ? CHANNEL.name : "Streamer";
    var videoTitle = document.getElementById("currenttitle")?.textContent || "No media playing";
    var userCount = document.getElementById("usercount")?.textContent || "0";
    var motd = document.getElementById("motd")?.innerHTML || "Welcome to the channel! Enjoy your stay.";

    panel.innerHTML = `
      <div class="btfw-si-top">
        <div class="btfw-si-avatar"></div>
        <div class="btfw-si-main">
          <div class="btfw-si-streamer">${streamerName}</div>
          <div class="btfw-si-title">${videoTitle}</div>
          <div class="btfw-si-tags">
            <span class="btfw-si-tag">Movie</span>
            <span class="btfw-si-tag">Watch Party</span>
          </div>
        </div>
        <div class="btfw-si-actions">
          <button class="btfw-ghost"><i class="fa fa-gift"></i> Gift a Sub</button>
          <button class="btfw-ghost"><i class="fa fa-star"></i> Subscribe</button>
        </div>
      </div>
      <div class="btfw-si-bottom">
        <h4>About ${streamerName}</h4>
        <p>${motd}</p>
        <div class="btfw-si-socials">
          <a href="#"><i class="fa fa-facebook"></i> Facebook</a>
          <a href="#"><i class="fa fa-twitter"></i> Twitter</a>
          <a href="#"><i class="fa fa-instagram"></i> Instagram</a>
          <a href="#"><i class="fa fa-youtube"></i> YouTube</a>
        </div>
      </div>
    `;

    // Insert the new panel after the video wrap
    videoWrap.after(panel);

    // Re-check title periodically
    setInterval(() => {
        const titleEl = panel.querySelector('.btfw-si-title');
        const newTitle = document.getElementById("currenttitle")?.textContent || "No media playing";
        if (titleEl && titleEl.textContent !== newTitle) {
            titleEl.textContent = newTitle;
        }
    }, 2000);
  }
  // --- BTFW CHANGE END ---


  function ensureShell(){
    var wrap = document.getElementById("wrap") || document.body;

    removeVideoHeaderOnce();
    watchVideoHeader();

    var topnav = document.querySelector("#nav-collapsible") || document.querySelector(".navbar") || document;
    if (!document.getElementById("btfw-theme-settings-btn")){
      var btn = document.createElement("button");
      btn.id = "btfw-theme-settings-btn";
      btn.className = "btfw-topbtn";
      btn.title = "Theme settings";
      btn.innerHTML = "<i class=\"fa fa-sliders\"></i>";
      btn.addEventListener("click", function(){ document.dispatchEvent(new CustomEvent("btfw:openThemeSettings")); });
      (document.querySelector("#userdropdown")?.parentElement || topnav).appendChild(btn);
    }

    if (!document.getElementById("btfw-grid")){
      var grid = document.createElement("div"); grid.id = "btfw-grid"; grid.className = "btfw-grid";

      var leftSidebar = document.createElement("nav");
      leftSidebar.id = "btfw-left-sidebar";
      leftSidebar.className = "btfw-left-sidebar";
      leftSidebar.innerHTML = `<button class="btfw-sidebar-btn" title="Home"><i class="fa fa-home"></i></button>`;

      var left = document.getElementById("btfw-leftpad") || document.createElement("div"); left.id = "btfw-leftpad"; left.className = "btfw-leftpad";
      var right = document.getElementById("btfw-chatcol") || document.createElement("aside"); right.id = "btfw-chatcol"; right.className = "btfw-chatcol";
      var video = document.getElementById("videowrap");
      var chat  = document.getElementById("chatwrap");
      var queue = document.getElementById("playlistrow") || document.getElementById("playlistwrap") || document.getElementById("queuecontainer");
      if (video && !left.contains(video)) left.appendChild(video);
      if (queue && !left.contains(queue)) left.appendChild(queue);
      if (chat && !right.contains(chat)) right.appendChild(chat);
      
      grid.appendChild(leftSidebar);
      grid.appendChild(left);
      grid.appendChild(right);
      wrap.prepend(grid);

      // --- BTFW CHANGE START ---
      // Call the new function after the shell is built
      ensureStreamerInfoPanel();
      // --- BTFW CHANGE END ---
    }
  }

  function ready(){ document.dispatchEvent(new Event("btfw:layoutReady")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ ensureShell(); ready(); });
  else { ensureShell(); ready(); }

  return { name: "feature:layout" };
});