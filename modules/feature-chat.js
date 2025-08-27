
BTFW.define("feature:chat", ["feature:layout"], async ({ require }) => {
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  function ensureBars(){
    const cw = qs("#chatwrap"); if(!cw) return;
    cw.classList.add("btfw-chatwrap");

    if(!qs(".btfw-chat-topbar", cw)){
      const top = document.createElement("div"); top.className = "btfw-chat-topbar";
      top.innerHTML = `<div class="btfw-chat-title" id="btfw-chat-title">Now Playing</div>`;
      cw.prepend(top);
    }
    if(!qs(".btfw-chat-bottombar", cw)){
      const bottom = document.createElement("div"); bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
      cw.appendChild(bottom);
    }
    const msg = qs("#messagebuffer"); if(msg){ msg.classList.add("btfw-messagebuffer"); }

    // Move native emotelist button into bottom bar if present
    const emotebtn = qs("#emotelistbtn"); if(emotebtn){ emotebtn.className = "btfw-chatbtn"; qs("#btfw-chat-actions").appendChild(emotebtn); }

    // Users overlay toggle (button in bottom bar)
    if(!qs("#btfw-users-toggle")){
      const b=document.createElement("button"); b.id="btfw-users-toggle"; b.className="btfw-chatbtn"; b.title="Users"; b.innerHTML=`<i class="fa fa-users"></i>`;
      b.onclick = toggleUserOverlay; qs("#btfw-chat-actions").appendChild(b);
    }

    // GIFs button
    if(!qs("#btfw-gif-btn")){
      const b=document.createElement("button"); b.id="btfw-gif-btn"; b.className="btfw-chatbtn"; b.title="GIFs"; b.innerHTML=`<span class="gif-badge">GIF</span>`;
      b.onclick = () => document.dispatchEvent(new Event("btfw:openGifs"));
      qs("#btfw-chat-actions").appendChild(b);
    }

    // Theme settings
    if(!qs("#btfw-theme-btn-chat")){
      const b=document.createElement("button"); b.id="btfw-theme-btn-chat"; b.className="btfw-chatbtn"; b.title="Theme settings"; b.innerHTML=`<i class="fa fa-sliders"></i>`;
      b.onclick = () => document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      qs("#btfw-chat-actions").appendChild(b);
    }

    // Make chat controls row follow after bars
    const controls = qs("#chatcontrols,#chat-controls") || (qs("#chatline") && qs("#chatline").parentElement);
    if(controls){ controls.classList.add("btfw-controls-row"); qs(".btfw-chat-bottombar")?.after(controls); }
  }

  function toggleUserOverlay(){
    const ul = qs("#userlist"); if(!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.toggle("btfw-userlist-overlay--open");
  }

  function getCurrentTitle(){
    const el = qs("#currenttitle") || qs("#plmeta .title") || qs("#videowrap .title");
    return el ? (el.textContent||"").trim() : ((window.CHANNEL&&CHANNEL.media&&CHANNEL.media.title)||"");
  }
  function setTitle(){ const t=qs("#btfw-chat-title"); if(t) t.textContent = getCurrentTitle() || "Now Playing"; }

  // Username colors (ported)
  function stringToColour(str){ for(var i=0,hash=0;i<str.length;hash=str.charCodeAt(i++)+((hash<<5)-hash)); for(var i=0,colour="#";i<3;colour+=("00"+((hash>>i++*8)&0xFF).toString(16)).slice(-2)); return colour; }
  function applyUsernameColor(node){ const u=node.querySelector&&node.querySelector(".username"); if(!u) return; const name=u.textContent.replace(":","").trim(); u.style.color=stringToColour(name); }

  function observeChat(){
    const buf=qs("#messagebuffer"); if(!buf||buf._btfw_observed) return; buf._btfw_observed=true;
    new MutationObserver(m=>m.forEach(r=>r.addedNodes&&r.addedNodes.forEach(applyUsernameColor))).observe(buf,{childList:true});
    qsa("#messagebuffer .username").forEach(el=>applyUsernameColor(el.parentElement||el));
  }

  function boot(){ ensureBars(); setTitle(); observeChat(); }
  document.addEventListener("btfw:layoutReady", boot);
  (window.socket&&window.socket.on)&&window.socket.on("changeMedia", setTitle);
  setInterval(setTitle, 2500);

  return { name:"feature:chat" };
});
