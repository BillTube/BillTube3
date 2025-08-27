BTFW.define("feature:layout", ["core"], async ({ require }) => {
  function buildAndDeployLayout() {
    const wrap = document.getElementById("wrap");
    if (!wrap || document.getElementById("btfw-grid")) return;

    console.log("[BTFW] Building layout...");

    // --- Find CyTube's Content ---
    const videoWrap = document.getElementById("videowrap");
    const playlistRow = document.getElementById("playlistrow");
    const chatWrap = document.getElementById("chatwrap");
    
    if (!videoWrap || !chatWrap) {
        setTimeout(buildAndDeployLayout, 250); // Retry if not ready
        return;
    }

    // --- THIS IS THE CRITICAL FIX ---
    // Strip all pre-existing classes from CyTube's containers to prevent CSS conflicts.
    videoWrap.className = '';
    chatWrap.className = '';
    if (playlistRow) playlistRow.className = '';
    // --- END OF CRITICAL FIX ---

    // --- Create Core Structure ---
    const grid = document.createElement("div");
    grid.id = "btfw-grid";
    const leftPad = document.createElement("div");
    leftPad.id = "btfw-leftpad";
    const chatCol = document.createElement("aside");
    chatCol.id = "btfw-chatcol";

    // --- Move CyTube's Content ---
    leftPad.appendChild(videoWrap);
    if (playlistRow) leftPad.appendChild(playlistRow);
    chatCol.appendChild(chatWrap);

    // --- Deploy the New Grid ---
    grid.appendChild(leftPad);
    grid.appendChild(chatCol);
    wrap.innerHTML = '';
    wrap.appendChild(grid);

    // --- Style and Structure the Chat Column ---
    chatWrap.classList.add('btfw-chatwrap');
    const messageBuffer = document.getElementById("messagebuffer");
    if (messageBuffer) messageBuffer.classList.add('btfw-messagebuffer');
    
    // Top bar with title
    const topBar = document.createElement("div");
    topBar.className = "btfw-chat-topbar";
    topBar.innerHTML = `<div class="btfw-chat-title" id="btfw-chat-title">Now Playing</div>`;
    chatWrap.prepend(topBar);

    // Bottom bar for buttons
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
    
    // --- Build the Streamer Info Panel ---
    if (!document.getElementById("btfw-streamer-info")) {
        const streamerPanel = document.createElement("div");
        streamerPanel.id = "btfw-streamer-info";
        const streamerName = (window.CHANNEL && CHANNEL.name) ? CHANNEL.name : "Streamer";
        streamerPanel.innerHTML = `
          <div class="btfw-si-top">
              <div class="btfw-si-avatar"></div>
              <div class="btfw-si-main">
                  <div class="btfw-si-streamer">${streamerName}</div>
                  <div class="btfw-si-title" id="btfw-si-title">No media playing</div>
              </div>
              <div class="btfw-si-actions">
                  <button class="btfw-ghost"><i class="fa fa-gift"></i> Gift a Sub</button>
                  <button class="btfw-ghost"><i class="fa fa-star"></i> Subscribe</button>
              </div>
          </div>`;
        videoWrap.after(streamerPanel);
        if (playlistRow) playlistRow.style.display = 'none';
    }

    console.log("[BTFW] Layout deployed successfully.");
    document.dispatchEvent(new Event("btfw:layoutReady"));
  }
  
  // Initializer
  buildAndDeployLayout();

  return { name: "feature:layout" };
});