/* BillTube Framework — feature:video-overlay
   Ensures overlay chrome exists and wires basic actions. */
BTFW.define("feature:videoOverlay", ["feature:layout"], async ({}) => {
  const $ = (s, r=document) => r.querySelector(s);

  function ensureOverlay() {
    const vw = $("#videowrap"); if (!vw) return null;
    let ov = $(".btfw-video-overlay", vw);
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "btfw-video-overlay";
      ov.innerHTML = `<div class="btfw-vo-right"></div>`;
      vw.appendChild(ov);
    }
    let right = $(".btfw-vo-right", ov);
    if (!$("#btfw-vo-refresh", right)) {
      right.insertAdjacentHTML("beforeend",
        `<button id="btfw-vo-refresh" class="btfw-vo-btn" title="Refresh media">↻</button>`);
    }
    if (!$("#btfw-vo-skip", right)) {
      right.insertAdjacentHTML("beforeend",
        `<button id="btfw-vo-skip" class="btfw-vo-btn" title="Vote skip">⏭</button>`);
    }
    if (!$("#btfw-vo-full", right)) {
      right.insertAdjacentHTML("beforeend",
        `<button id="btfw-vo-full" class="btfw-vo-btn" title="Fullscreen">⛶</button>`);
    }
    return ov;
  }

  function toFullscreen(){
    const el = $("#videowrap");
    if (!document.fullscreenElement) { el?.requestFullscreen?.(); }
    else { document.exitFullscreen?.(); }
  }
  function voteSkip(){
    if (window.socket && window.socket.emit) window.socket.emit("voteskip");
  }
  function mediaRefresh(){
    // safest is to send the chat command used on your server:
    if (window.socket && window.socket.emit) window.socket.emit("chatMsg", { msg: "/mediarefresh" });
  }

  function wireClicks() {
    document.addEventListener("click", (e)=>{
      if (e.target.id === "btfw-vo-refresh") { e.preventDefault(); mediaRefresh(); }
      if (e.target.id === "btfw-vo-skip")    { e.preventDefault(); voteSkip(); }
      if (e.target.id === "btfw-vo-full")    { e.preventDefault(); toFullscreen(); }
    }, true);
  }

  // Observe #videowrap so overlay re-appears after media swaps
  let mo;
  function watch() {
    const vw = $("#videowrap"); if (!vw) return;
    ensureOverlay();
    if (mo) mo.disconnect();
    mo = new MutationObserver(()=>ensureOverlay());
    mo.observe(vw, {childList:true, subtree:true});
  }

  function boot(){ ensureOverlay(); wireClicks(); watch(); }
  document.addEventListener("btfw:layoutReady", ()=>setTimeout(boot,0));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  return { name: "feature:videoOverlay" };
});
