// BillTube — move the live CyTube #currenttitle into the chat top bar (no duplication)
BTFW.define("feature:nowplaying", ["feature:chat"], async ({}) => {
  function slot() {
    const top = document.querySelector("#chatwrap .btfw-chat-topbar");
    if (!top) return null;
    let slot = top.querySelector("#btfw-nowplaying-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "btfw-nowplaying-slot";
      slot.className = "btfw-chat-title";
      top.innerHTML = ""; // the chat module created a title, we replace it with the real node
      top.appendChild(slot);
    }
    return slot;
  }

  function adoptIfPresent() {
    const s = slot(); if (!s) return;
    // Prefer canonical #currenttitle if present anywhere
    let src = document.getElementById("currenttitle")
           || document.querySelector("#plmeta .title")
           || null;
    if (src && s.contains(src)) return; // already adopted
    if (src) {
      s.innerHTML = ""; s.appendChild(src); return;
    }
    // Fallback: show text but keep updated
    const title = (window.CHANNEL && CHANNEL.media && CHANNEL.media.title) || "Now Playing";
    if (!s.firstChild || s.firstChild.nodeType !== 3) {
      s.textContent = title;
    }
  }

  function observeForNewTitle() {
    if (document._btfw_nowplaying_obs) return;
    document._btfw_nowplaying_obs = true;
    new MutationObserver(() => adoptIfPresent()).observe(document.body, { childList: true, subtree: true });
  }

  function boot(){ adoptIfPresent(); observeForNewTitle(); }
  document.addEventListener("btfw:layoutReady", boot);
  (window.socket && window.socket.on) && window.socket.on("changeMedia", adoptIfPresent);
  setInterval(adoptIfPresent, 3000); // in case upstream swaps nodes

  return { name: "feature:nowplaying" };
});
