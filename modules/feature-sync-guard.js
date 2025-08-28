
BTFW.define("feature:syncGuard", [], async () => {
  let last = { t: 0, serverCT: 0, paused: false };
  function onMediaUpdate(data){
    if (!data || typeof data.currentTime !== "number") return;
    last = { t: performance.now(), serverCT: data.currentTime, paused: !!data.paused };
  }
  function getPlayerTime(){
    try { if (window.PLAYER && typeof PLAYER.getTime === "function") return PLAYER.getTime(); const v=document.querySelector("video"); if (v) return v.currentTime||0; } catch(e){} return 0;
  }
  function seekTo(sec){
    try { if (window.PLAYER && typeof PLAYER.seek === "function") { PLAYER.seek(sec); return true; } if (window.PLAYER && typeof PLAYER.jumpTo === "function") { PLAYER.jumpTo(sec); return true; } const v=document.querySelector("video"); if (v) { v.currentTime=sec; return true; } } catch(e){} return false;
  }
  function setPaused(p){
    try { if (window.PLAYER && typeof PLAYER.pause === "function" && typeof PLAYER.play === "function") { if (p) PLAYER.pause(); else PLAYER.play(); return true; } const v=document.querySelector("video"); if (v) { if (p) v.pause(); else v.play(); return true; } } catch(e){} return false;
  }
  function tick(){
    if (!last.t) return;
    const dt = (performance.now() - last.t) / 1000;
    const expect = last.serverCT + (last.paused ? 0 : dt);
    const now = getPlayerTime();
    const drift = now - expect;
    if (Math.abs(drift) > 1.5) seekTo(expect);
    const isPaused = (()=>{ try { if (window.PLAYER && typeof PLAYER.isPaused === "function") return !!PLAYER.isPaused(); const v=document.querySelector("video"); return v ? v.paused : false; } catch(e){ return false; } })();
    if (isPaused !== last.paused) setPaused(last.paused);
  }
  if (window.socket && socket.on) {
    socket.on("mediaUpdate", onMediaUpdate);
    socket.on("changeMedia", ()=>{ last.t=0; });
  }
  setInterval(tick, 1500);
  return { name:"feature:syncGuard" };
});
