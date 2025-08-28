
BTFW.define("feature:nowplaying", ["feature:chat"], async ({}) => {
  function slot() {
    const top = document.querySelector("#chatwrap .btfw-chat-topbar");
    if (!top) return null;
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.innerHTML = "";
      top.appendChild(slot);
    }
    return slot;
  }
  function adopt() {
    const s = slot(); if (!s) return;
    const src = document.getElementById("currenttitle");
    if (src && !s.contains(src)) { s.innerHTML=""; s.appendChild(src); return; }
    const title = (window.CHANNEL && CHANNEL.media && CHANNEL.media.title) || "";
    if (title && (!s.firstChild || s.textContent !== title)) s.textContent = title;
  }
  function boot(){ adopt(); }
  document.addEventListener("btfw:layoutReady", boot);
  (window.socket && window.socket.on) && window.socket.on("changeMedia", adopt);
  setInterval(adopt, 3000);
  return { name:"feature:nowplaying" };
});
