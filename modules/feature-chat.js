
BTFW.define("feature:chat", ["feature:layout"], async ({}) => {
  const $ = (s, r=document) => r.querySelector(s);

  function ensureBars(){
    const cw = $("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

    let top = $(".btfw-chat-topbar", cw);
    if (!top) {
      top = document.createElement("div"); top.className = "btfw-chat-topbar";
      top.innerHTML = `<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>`;
      cw.prepend(top);
    }

    let bottom = $(".btfw-chat-bottombar", cw);
    if (!bottom) {
      bottom = document.createElement("div"); bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
      cw.appendChild(bottom);
    }
    const bar = bottom.querySelector("#btfw-chat-actions");

    // Move/ensure buttons
    const emotebtn = $("#emotelistbtn, #emotelist");
    if (emotebtn && emotebtn.parentElement !== bar){ emotebtn.className = "button is-dark is-small btfw-chatbtn"; bar.appendChild(emotebtn); }
    if (!$("#btfw-gif-btn", bar)){
      const b=document.createElement("button"); b.id="btfw-gif-btn"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<span class="gif-badge">GIF</span>`; b.onclick=()=>document.dispatchEvent(new Event("btfw:openGifs")); bar.appendChild(b);
    }
    if (!$("#btfw-users-toggle", bar)){
      const b=document.createElement("button"); b.id="btfw-users-toggle"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<i class="fa fa-users"></i>`; b.onclick=toggleUsers; bar.appendChild(b);
    }
    if (!$("#btfw-theme-btn-chat", bar)){
      const b=document.createElement("button"); b.id="btfw-theme-btn-chat"; b.className="button is-dark is-small btfw-chatbtn"; b.innerHTML=`<i class="fa fa-sliders"></i>`; b.onclick=()=>document.dispatchEvent(new CustomEvent("btfw:openThemeSettings")); bar.appendChild(b);
    }

    // Buffer/controls
    const msg = $("#messagebuffer"); if (msg){ msg.classList.add("btfw-messagebuffer"); }
    const controls = $("#chatcontrols,#chat-controls") || ($("#chatline") && $("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom){ controls.classList.add("btfw-controls-row"); bottom.after(controls); }
  }

  function toggleUsers(){
    const ul = document.getElementById("userlist"); if (!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.toggle("btfw-userlist-overlay--open");
  }

  function usernameColor(el){
    const n = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!n) return; const t=(n.textContent||"").replace(":","").trim(); if(!t) return;
    let hash = 0;
    for (let i=0;i<t.length;i++) hash = t.charCodeAt(i) + ((hash<<5) - hash);
    let c = "#";
    for (let i=0;i<3;i++) c += ("00"+((hash>> (i*8)) & 0xff).toString(16)).slice(-2);
    n.style.color = c;
  }

  function observe(){
    const cw=$("#chatwrap"); if(!cw || cw._btfw_chat_obs) return; cw._btfw_chat_obs=true;
    new MutationObserver(()=>ensureBars()).observe(cw,{childList:true,subtree:true});
    const buf=document.getElementById("messagebuffer");
    if (buf && !buf._btfw_color_obs){
      buf._btfw_color_obs=true;
      new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{ if(n.nodeType===1) usernameColor(n); }))).observe(buf,{childList:true});
      Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(usernameColor);
    }
  }

  function boot(){ ensureBars(); observe(); }
  document.addEventListener("btfw:layoutReady", boot);
  setTimeout(boot, 1200);
  return {name:"feature:chat"};
});
