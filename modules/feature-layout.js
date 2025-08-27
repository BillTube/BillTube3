BTFW.define("feature:layout", ["core"], async ({ require }) => {
  // This is our master function to build the entire UI.
  function buildAndDeployLayout() {
    const wrap = document.getElementById("wrap");
    if (!wrap || document.getElementById("btfw-grid")) return; // Abort if already built

    console.log("[BTFW] Building layout...");

    // --- 1. Create Core Structure ---
    const grid = document.createElement("div");
    grid.id = "btfw-grid";
    const leftPad = document.createElement("div");
    leftPad.id = "btfw-leftpad";
    const chatCol = document.createElement("aside");
    chatCol.id = "btfw-chatcol";

    // --- 2. Find and Move CyTube's Content ---
    const videoWrap = document.getElementById("videowrap");
    const playlistRow = document.getElementById("playlistrow");
    const chatWrap = document.getElementById("chatwrap");
    
    if (!videoWrap || !chatWrap) {
        console.error("[BTFW] Core CyTube elements not found. Aborting layout build.");
        return;
    }

    leftPad.appendChild(videoWrap);
    if (playlistRow) leftPad.appendChild(playlistRow);
    chatCol.appendChild(chatWrap);

    // --- 3. Deploy the New Grid ---
    grid.appendChild(leftPad);
    grid.appendChild(chatCol);
    wrap.innerHTML = ''; // Clear original content
    wrap.appendChild(grid);

    // --- 4. Style and Structure the Chat Column ---
    chatWrap.className = 'btfw-chatwrap';
    const messageBuffer = document.getElementById("messagebuffer");
    if (messageBuffer) messageBuffer.className = 'btfw-messagebuffer';
    
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

    // Move existing buttons and add our own
    const emoteBtn = document.getElementById("emotelistbtn");
    if (emoteBtn) actionsContainer.appendChild(emoteBtn);

    const usersBtn = document.createElement('button');
    usersBtn.id = 'btfw-users-toggle';
    usersBtn.className = 'btfw-chatbtn';
    usersBtn.title = 'Users';
    usersBtn.innerHTML = '<i class="fa fa-users"></i>';
    actionsContainer.appendChild(usersBtn);
    // (Add click listeners for other buttons here later)
    
    // --- 5. Build the Streamer Info Panel ---
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

    console.log("[BTFW] Layout deployed successfully.");
    document.dispatchEvent(new Event("btfw:layoutReady"));
  }

  // --- Robust Initializer ---
  const init = () => {
    if (document.getElementById("videowrap") && document.getElementById("chatwrap")) {
      buildAndDeployLayout();
    } else {
      // If elements aren't ready, wait and try again
      setTimeout(init, 250);
    }
  };
  init();

  return { name: "feature:layout" };
});