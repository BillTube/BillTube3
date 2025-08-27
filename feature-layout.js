BTFW.define("feature:layout", ["core"], async ({ require }) => {
  function buildAndDeployLayout() {
    // Abort if the layout is already built
    if (document.getElementById("btfw-grid")) return;

    const wrap = document.getElementById("wrap");
    const videoWrap = document.getElementById("videowrap");
    const chatWrap = document.getElementById("chatwrap");
    
    // Retry if CyTube's core elements aren't ready yet
    if (!wrap || !videoWrap || !chatWrap) {
        setTimeout(buildAndDeployLayout, 100);
        return;
    }
    console.log("[BTFW] Takeover initiated...");

    // --- 1. TAKEOVER THE HEADER ---
    const navbar = document.querySelector(".navbar");
    if (navbar) {
        navbar.id = "btfw-navbar";
        navbar.className = "btfw-navbar";
        // Replace the entire default header with our own simple structure
        navbar.innerHTML = `
            <div class="btfw-nav-left">
                <a class="btfw-nav-brand" href="#">CyTube</a>
                <a class="btfw-nav-link" href="#">Browse</a>
            </div>
            <div class="btfw-nav-center">
                <input type="text" class="btfw-nav-search" placeholder="Search">
            </div>
            <div class="btfw-nav-right">
                <span id="btfw-nav-username"></span>
                <a class="btfw-nav-link" href="/logout">Log out</a>
            </div>
        `;
        // Try to grab the username to display it
        const usernameEl = document.getElementById("btfw-nav-username");
        const originalUsername = document.querySelector("#userdropdown .user-dropdown-name");
        if (usernameEl && originalUsername) {
            usernameEl.textContent = `Welcome, ${originalUsername.textContent}`;
        }
    }
    
    // --- 2. AGGRESSIVE CLASS STRIPPING ---
    // Strip all pre-existing classes from CyTube's containers to prevent CSS conflicts.
    videoWrap.className = '';
    chatWrap.className = '';
    const playlistRow = document.getElementById("playlistrow");
    if (playlistRow) playlistRow.className = '';
    document.getElementById("main").className = '';
    
    // --- 3. CREATE AND DEPLOY OUR GRID ---
    const grid = document.createElement("div");
    grid.id = "btfw-grid";
    const leftPad = document.createElement("div");
    leftPad.id = "btfw-leftpad";
    const chatCol = document.createElement("aside");
    chatCol.id = "btfw-chatcol";

    leftPad.appendChild(videoWrap);
    if (playlistRow) leftPad.appendChild(playlistRow);
    chatCol.appendChild(chatWrap);

    grid.appendChild(leftPad);
    grid.appendChild(chatCol);
    wrap.innerHTML = '';
    wrap.appendChild(grid);

    // --- 4. REBUILD THE CHAT UI ---
    chatWrap.classList.add('btfw-chatwrap');
    const messageBuffer = document.getElementById("messagebuffer");
    if (messageBuffer) messageBuffer.classList.add('btfw-messagebuffer');
    
    const topBar = document.createElement("div");
    topBar.className = "btfw-chat-topbar";
    topBar.innerHTML = `<div class="btfw-chat-title" id="btfw-chat-title">Now Playing</div>`;
    chatWrap.prepend(topBar);

    const bottomBar = document.createElement("div");
    bottomBar.className = "btfw-chat-bottombar";
    const actionsContainer = document.createElement("div");
    actionsContainer.id = "btfw-chat-actions";
    actionsContainer.className = "btfw-chat-actions";
    bottomBar.appendChild(actionsContainer);
    
    const controls = document.getElementById("chat-controls");
    if (controls) controls.before(bottomBar);

    const emoteBtn = document.getElementById("emotelistbtn");
    if (emoteBtn) actionsContainer.appendChild(emoteBtn);

    const usersBtn = document.createElement('button');
    usersBtn.id = 'btfw-users-toggle';
    usersBtn.className = 'btfw-chatbtn';
    usersBtn.title = 'Users';
    usersBtn.innerHTML = '<i class="fa fa-users"></i>';
    actionsContainer.appendChild(usersBtn);

    // --- 5. REBUILD THE STREAMER INFO PANEL ---
    if (!document.getElementById("btfw-streamer-info")) {
        const streamerPanel = document.createElement("div");
        streamerPanel.id = "btfw-streamer-info";
        // ... (rest of the panel logic is the same)
        videoWrap.after(streamerPanel);
        if (playlistRow) playlistRow.style.display = 'none';
    }

    console.log("[BTFW] Takeover complete. Layout deployed.");
    document.dispatchEvent(new Event("btfw:layoutReady"));
  }
  
  buildAndDeployLayout();

  return { name: "feature:layout" };
});