BTFW.define("feature:chat", ["feature:layout"], async ({ require }) => {
  function updateTitle() {
    const titleText = (window.CHANNEL && CHANNEL.media && CHANNEL.media.title) || "Now Playing";
    const chatTitle = document.getElementById("btfw-chat-title");
    const siTitle = document.getElementById("btfw-si-title");
    if (chatTitle && chatTitle.innerText !== titleText) chatTitle.innerText = titleText;
    if (siTitle && siTitle.innerText !== titleText) siTitle.innerText = titleText;
  }

  function handleLayoutReady() {
    console.log("[BTFW Chat] Layout is ready. Starting periodic updates.");
    // Use socket event for instant updates
    if (window.socket && window.socket.on) {
      socket.on("changeMedia", updateTitle);
    }
    // Also poll every few seconds as a fallback
    setInterval(updateTitle, 2500);
    updateTitle(); // Run once immediately
  }

  // Wait for the layout to be built before starting our work
  document.addEventListener("btfw:layoutReady", handleLayoutReady, { once: true });

  return { name: "feature:chat" };
});