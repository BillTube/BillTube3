
BTFW.define("feature:nowplaying", ["feature:chat"], async ({}) => {
  function adopt(){ const top=document.querySelector("#chatwrap .btfw-chat-topbar"); if(!top) return; let slot=top.querySelector("#btfw-nowplaying-slot"); if(!slot){ slot=document.createElement("div"); slot.id="btfw-nowplaying-slot"; slot.className="btfw-chat-title"; top.appendChild(slot); } const ct=document.getElementById("currenttitle"); if(ct && !slot.contains(ct)){ slot.innerHTML=""; slot.appendChild(ct); } else if(!ct && window.CHANNEL && CHANNEL.media && CHANNEL.media.title){ slot.textContent=CHANNEL.media.title; } }
  document.addEventListener("btfw:layoutReady", adopt); if(window.socket && socket.on){ socket.on("changeMedia", adopt); } setInterval(adopt,2500);
  return {name:"feature:nowplaying"};
});