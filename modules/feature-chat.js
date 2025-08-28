
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const qs = (s, r=document) => r.querySelector(s);
  function ensureBars(){
    const cw = qs("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");
    let top = qs(".btfw-chat-topbar", cw);
    if (!top) {
      top = document.createElement("div"); top.className = "btfw-chat-topbar";
      top.innerHTML = `<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>
                       <div class="btfw-chat-actions btfw-chat-actions--top"></div>`;
      cw.prepend(top);
    }
    let bottom = qs(".btfw-chat-bottombar", cw);
    if (!bottom) {
      bottom = document.createElement("div"); bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
      cw.appendChild(bottom);
    }
    const bar = bottom.querySelector("#btfw-chat-actions");
    const topActions = top.querySelector(".btfw-chat-actions--top");

    // Buttons on bottom bar
    const emotebtn = qs("#emotelistbtn"); if (emotebtn && emotebtn.parentElement !== bar){ emotebtn.className="button is-dark is-small btfw-chatbtn"; bar.appendChild(emotebtn); }
    if (!qs("#btfw-gif-btn", bar)){
      const b=document.createElement("button"); b.id="btfw-gif-btn"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<span class="gif-badge">GIF</span>`; b.onclick=()=>document.dispatchEvent(new Event("btfw:openGifs")); bar.appendChild(b);
    }
    if (!qs("#btfw-users-toggle", bar)){
      const b=document.createElement("button"); b.id="btfw-users-toggle"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<i class="fa fa-users"></i>`; b.onclick=toggleUserOverlay; bar.appendChild(b);
    }
    if (!qs("#btfw-theme-btn-chat", bar)){
      const b=document.createElement("button"); b.id="btfw-theme-btn-chat"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<i class="fa fa-sliders"></i>`; b.onclick=()=>document.dispatchEvent(new CustomEvent("btfw:openThemeSettings")); bar.appendChild(b);
    }

    // Make sure message buffer and controls are in place
    const msg = qs("#messagebuffer"); if (msg){ msg.classList.add("btfw-messagebuffer"); }
    const controls = qs("#chatcontrols,#chat-controls") || (qs("#chatline") && qs("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom){ controls.classList.add("btfw-controls-row"); bottom.after(controls); }
  }
  function toggleUserOverlay(){
    const ul = document.getElementById("userlist"); if (!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.toggle("btfw-userlist-overlay--open");
  }
  // Username colors
  function stringToColour(str){ for(let i=0,hash=0;i<str.length;hash=str.charCodeAt(i++)+((hash<<5)-hash)); let c="#"; for(let i=0;i<3;i++) c+=("00"+((hash>>i*8)&0xFF).toString(16)).slice(-2); return c; }
  function colorize(el){
    const u = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!u) return; const name=(u.textContent||"").replace(":","").trim(); if(!name) return; u.style.color=stringToColour(name);
  }
  function observeColors(){
    const buf=document.getElementById("messagebuffer"); if(!buf||buf._btfw_colors) return; buf._btfw_colors=true;
    new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{ if(n.nodeType===1) colorize(n); }))).observe(buf,{childList:true}); Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorize);
  }
  function boot(){ ensureBars(); observeColors(); }
  document.addEventListener("btfw:layoutReady", boot); setTimeout(boot, 1000);
  return { name:"feature:chat" };
});
