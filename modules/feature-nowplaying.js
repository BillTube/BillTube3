
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
  function adoptIfPresent() {
    const s = slot(); if (!s) return;
    let src = document.getElementById("currenttitle") || document.querySelector("#plmeta .title") || null;
    if (src && s.contains(src)) return;
    if (src) { s.innerHTML=""; s.appendChild(src); return; }
    const title = (window.CHANNEL && CHANNEL.media && CHANNEL.media.title) || "Now Playing";
    if (!s.firstChild || s.firstChild.nodeType !== 3) s.textContent = title;
  }
  function observeForNewTitle() {
    if (document._btfw_nowplaying_obs) return;
    document._btfw_nowplaying_obs = true;
    new MutationObserver(() => adoptIfPresent()).observe(document.body, { childList: true, subtree: true });
  }
  function boot(){ adoptIfPresent(); observeForNewTitle(); }
  document.addEventListener("btfw:layoutReady", boot);
  (window.socket && window.socket.on) && window.socket.on("changeMedia", adoptIfPresent);
  setInterval(adoptIfPresent, 3000);
  return { name: "feature:nowplaying" };
});
