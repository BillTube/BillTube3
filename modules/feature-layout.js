BTFW.define("feature:layout", ["core"], async ({ require }) => {

  // This function creates the new, modern layout.
  // It will wait until the necessary CyTube elements exist before running.
  function buildModernLayout() {
    const wrap = document.getElementById("wrap");
    // Stop if the layout has already been built or if CyTube isn't ready
    if (document.getElementById("btfw-grid") || !document.getElementById("videowrap") || !document.getElementById("chatwrap")) {
      return;
    }

    console.log("[BTFW] CyTube is ready. Building modern layout...");

    // 1. --- CREATE THE MAIN GRID STRUCTURE ---
    const grid = document.createElement("div");
    grid.id = "btfw-grid";
    grid.className = "btfw-grid";

    const leftPad = document.createElement("div");
    leftPad.id = "btfw-leftpad";

    const chatCol = document.createElement("aside");
    chatCol.id = "btfw-chatcol";

    // 2. --- MOVE CYTUBE ELEMENTS INTO OUR NEW GRID ---
    const videoWrap = document.getElementById("videowrap");
    const playlistRow = document.getElementById("playlistrow"); // We will hide this for now
    const chatWrap = document.getElementById("chatwrap");

    // Move video player and the (soon to be hidden) playlist to the left column
    if (videoWrap) leftPad.appendChild(videoWrap);
    if (playlistRow) {
      leftPad.appendChild(playlistRow);
      playlistRow.style.display = 'none'; // Hide default playlist to make room for our new info panel later
    }
    
    // Move the entire original chat container into our new right column
    if (chatWrap) chatCol.appendChild(chatWrap);

    // Assemble the grid
    grid.appendChild(leftPad);
    grid.appendChild(chatCol);
    
    // Clear the original container and insert our new grid
    wrap.innerHTML = '';
    wrap.appendChild(grid);
    
    // 3. --- REBUILD THE CHAT INTERFACE ---
    // This is the logic you described: title top, buttons bottom.
    chatWrap.classList.add("btfw-chatwrap");
    
    // Create Top Bar (for video title)
    const topBar = document.createElement("div");
    topBar.className = "btfw-chat-topbar";
    topBar.innerHTML = `<div class="btfw-chat-title" id="btfw-chat-title">Now Playing</div>`;
    chatWrap.prepend(topBar);

    // Create Bottom Bar (for buttons)
    const bottomBar = document.createElement("div");
    bottomBar.className = "btfw-chat-bottombar";
    bottomBar.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
    
    const controlsRow = document.getElementById("chat-controls"); // Find CyTube's chat input area
    if(controlsRow) {
      controlsRow.before(bottomBar); // Place our button bar right above the chat input
      controlsRow.classList.add("btfw-controls-row");
    } else {
      chatWrap.appendChild(bottomBar); // Fallback
    }

    // Move original buttons into our new bottom bar
    const actionsContainer = document.getElementById("btfw-chat-actions");
    const emoteBtn = document.getElementById("emotelistbtn");
    if (emoteBtn) actionsContainer.appendChild(emoteBtn);

    // Re-create our custom buttons
    actionsContainer.innerHTML += `
      <button id="btfw-users-toggle" class="btfw-chatbtn" title="Users"><i class="fa fa-users"></i></button>
      <button id="btfw-gif-btn" class="btfw-chatbtn" title="GIFs"><span class="gif-badge">GIF</span></button>
      <button id="btfw-theme-btn-chat" class="btfw-chatbtn" title="Theme settings"><i class="fa fa-sliders"></i></button>
    `;

    // Make sure message buffer fills the remaining space
    const messageBuffer = document.getElementById("messagebuffer");
    if(messageBuffer) messageBuffer.classList.add("btfw-messagebuffer");

    // Dispatch event to notify other modules that the layout is ready
    document.dispatchEvent(new Event("btfw:layoutReady"));
    console.log("[BTFW] Modern layout built successfully.");
  }

  // --- Robust Initialization ---
  // We will repeatedly check for CyTube's elements. Once they exist, we build the layout and stop checking.
  const initInterval = setInterval(() => {
    if (document.getElementById("videowrap") && document.getElementById("chatwrap")) {
      clearInterval(initInterval); // Stop the timer
      buildModernLayout();       // Run our layout builder
    }
  }, 250); // Check every 250ms

  return { name: "feature:layout" };
});