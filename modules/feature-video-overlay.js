
BTFW.define("feature:videoOverlay", ["feature:layout"], async ({}) => {
  function ensureOverlay() {
    const vw = document.getElementById("videowrap");
    if (!vw) return;
    let o = vw.querySelector(".btfw-video-overlay");
    if (!o) {
      o = document.createElement("div");
      o.className = "btfw-video-overlay";
      o.innerHTML = `
        <div class="btfw-vo-right">
          <button class="btfw-vo-btn button is-dark is-small" id="btfw-vo-refresh" title="Refresh video"><i class="fa fa-rotate-right"></i></button>
          <button class="btfw-vo-btn button is-dark is-small" id="btfw-vo-voteskip" title="Vote Skip"><i class="fa fa-forward"></i></button>
        </div>`;
      vw.appendChild(o);
      o.querySelector("#btfw-vo-refresh").onclick = refreshPlayer;
      o.querySelector("#btfw-vo-voteskip").onclick = voteSkip;
    }
  }
  function voteSkip() {
    try { if (window.socket && socket.emit) { socket.emit("voteskip"); return; } } catch(e){}
    const line = document.getElementById("chatline");
    if (line) { line.value = "/voteskip"; line.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", code:"Enter", bubbles:true})); }
  }
  function refreshPlayer() {
    const btn = document.getElementById("mediarefresh") || document.querySelector("[data-action='mediarefresh']");
    if (btn) { btn.click(); return; }
    try {
      if (window.PLAYER && typeof PLAYER.load === "function" && window.CHANNEL && CHANNEL.media) { PLAYER.load(CHANNEL.media); return; }
      if (window.PLAYER && typeof PLAYER.pause === "function" && typeof PLAYER.play === "function") { PLAYER.pause(); setTimeout(()=>PLAYER.play(), 50); return; }
    } catch(e){}
    const ifr = document.querySelector("#ytapiplayer iframe, #player iframe, .embed-responsive iframe");
    if (ifr && ifr.src) { const src = ifr.src; ifr.src = src; }
  }
  function boot(){ ensureOverlay(); }
  document.addEventListener("btfw:layoutReady", boot);
  setTimeout(boot, 1500);
  return { name:"feature:videoOverlay" };
});
