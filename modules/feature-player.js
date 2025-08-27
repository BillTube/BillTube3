
/* feature-player.js — player integrations: poster toggle + progress/time without polling */
BTFW.define("feature:player", ["core","bridge"], async function(ctx){
  var { on, emit } = BTFW.require("core");
  var { ids } = BTFW.require("bridge");

  function pad(n){ n = Math.floor(n); return n<10?("0"+n):String(n); }

  function togglePoster(){
    try{
      var poster = document.querySelector(".vjs-poster");
      if (!poster) return;
      var type = (window.PLAYER && window.PLAYER.mediaType) || null;
      if (type === "yt") poster.classList.add("hidden");
      else poster.classList.remove("hidden");
    }catch(e){}
  }

  function updateProgress(){
    var bar = document.getElementById("progbar");
    var tt  = document.getElementById("ss7time");
    var vjs;
    try { vjs = window.videojs && window.videojs("ytapiplayer"); } catch(e){}
    var current=0, duration=0;
    if (vjs && typeof vjs.duration === "function") {
      current = vjs.currentTime() || 0;
      duration = vjs.duration() || 0;
    } else {
      current = (window._timeVIDEBLU && window._timeVIDEBLU.raw) || 0;
      duration = (window.currentmedia && window.currentmedia.seconds) || 0;
    }
    if (bar && duration) {
      bar.style.width = Math.min(100, Math.max(0, Math.round(100*current/duration))) + "%";
    }
    if (tt) {
      var s = Math.round(current), sec=s%60, min=Math.floor(s/60)%60, hr=Math.floor(s/3600);
      var t = (duration>3598) ? (pad(hr)+":"+pad(min)+":"+pad(sec))
            : (hr===0 ? (pad(min)+":"+pad(sec)) : (pad(hr)+":"+pad(min)+":"+pad(sec)));
      tt.textContent = (duration===0 && tt.textContent==="--:--") ? "Live" : t;
    }
  }

  function hook(){
    var vjs;
    try { vjs = window.videojs && window.videojs("ytapiplayer"); } catch(e){}
    if (!vjs || !vjs.on) return;
    vjs.off("loadedmetadata", togglePoster);
    vjs.off("loadeddata", togglePoster);
    vjs.off("play", togglePoster);
    vjs.off("pause", togglePoster);
    vjs.off("timeupdate", updateProgress);
    vjs.on("loadedmetadata", togglePoster);
    vjs.on("loadeddata", togglePoster);
    vjs.on("play", togglePoster);
    vjs.on("pause", togglePoster);
    vjs.on("timeupdate", updateProgress);
    updateProgress();
    togglePoster();
  }

  on("changeMedia", hook);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();

  return { hook };
});
