
BTFW.define("feature:player",["core","bridge"],async function(){
  var {on}=BTFW.require?BTFW.require("core"):window.BTFW_core;
  function pad(n){n=Math.floor(n);return n<10?("0"+n):String(n);}
  function togglePoster(){try{var p=document.querySelector(".vjs-poster");if(!p)return;var t=(window.PLAYER&&window.PLAYER.mediaType)||null; if(t==="yt")p.classList.add("hidden");else p.classList.remove("hidden");}catch(e){}}
  function update(){var bar=document.getElementById("progbar");var tt=document.getElementById("ss7time");var vjs;try{vjs=window.videojs&&window.videojs("ytapiplayer");}catch(e){}var c=0,d=0;if(vjs&&typeof vjs.duration==="function"){c=vjs.currentTime()||0;d=vjs.duration()||0;} if(bar&&d){bar.style.width=Math.min(100,Math.max(0,Math.round(100*c/d)))+"%";} if(tt){var s=Math.round(c),sec=s%60,min=Math.floor(s/60)%60,hr=Math.floor(s/3600);var t=(d>3598)?(pad(hr)+":"+pad(min)+":"+pad(sec)):(hr===0?(pad(min)+":"+pad(sec)):(pad(hr)+":"+pad(min)+":"+pad(sec))); tt.textContent=(d===0&&tt.textContent==="--:--")?"Live":t;}}
  function hook(){var vjs;try{vjs=window.videojs&&window.videojs("ytapiplayer");}catch(e){} if(!vjs||!vjs.on)return; vjs.off("loadedmetadata",togglePoster);vjs.off("loadeddata",togglePoster);vjs.off("play",togglePoster);vjs.off("pause",togglePoster);vjs.off("timeupdate",update); vjs.on("loadedmetadata",togglePoster);vjs.on("loadeddata",togglePoster);vjs.on("play",togglePoster);vjs.on("pause",togglePoster);vjs.on("timeupdate",update); update();togglePoster();}
  on&&on("changeMedia",hook); if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook); else hook();
  return {hook};
});
