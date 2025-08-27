
BTFW.define("feature:chat", ["feature:layout"], async ({ require }) => {
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  function ensureBars(){
    const cw = qs("#chatwrap"); if(!cw) return;
    cw.classList.add("btfw-chatwrap");

    // --- TOP: title only
    let top = qs(".btfw-chat-topbar", cw);
    if(!top){
      top = document.createElement("div"); top.className = "btfw-chat-topbar";
      top.innerHTML = `<div class="btfw-chat-title" id="btfw-chat-title">Now Playing</div>`;
      cw.prepend(top);
    } else {
      const strayActions = top.querySelector(".btfw-chat-actions");
      if (strayActions){
        const bottomActions = qs("#btfw-chat-actions") || ensureBottomActions(cw);
        Array.from(strayActions.children).forEach(ch => bottomActions.appendChild(ch));
        strayActions.remove();
      }
    }

    // --- BOTTOM: all buttons live here
    ensureBottomActions(cw);

    const msg = qs("#messagebuffer"); if (msg){ msg.classList.add("btfw-messagebuffer"); }
  }

  function ensureBottomActions(cw){
    let bottom = qs(".btfw-chat-bottombar", cw);
    if(!bottom){
      bottom = document.createElement("div"); bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
      cw.appendChild(bottom);
    }
    const bar = bottom.querySelector("#btfw-chat-actions");

    // Move native emotelist button into bottom bar
    const emotebtn = qs("#emotelistbtn") || qs("#chatwrap .emotelistbtn");
    if (emotebtn && emotebtn.parentElement !== bar){
      emotebtn.className = "btfw-chatbtn";
      bar.appendChild(emotebtn);
    }

    // Users overlay
    if (!qs("#btfw-users-toggle", bar)){
      const b = document.createElement("button");
      b.id="btfw-users-toggle"; b.className="btfw-chatbtn"; b.title="Users"; b.innerHTML=`<i class="fa fa-users"></i>`;
      b.onclick = toggleUserOverlay; bar.appendChild(b);
    }

    // GIFs
    if (!qs("#btfw-gif-btn", bar)){
      const b = document.createElement("button");
      b.id="btfw-gif-btn"; b.className="btfw-chatbtn"; b.title="GIFs"; b.innerHTML=`<span class="gif-badge">GIF</span>`;
      b.onclick = function(){ if (window.BTFW_Gifs && BTFW_Gifs.open) BTFW_Gifs.open(); else document.dispatchEvent(new Event("btfw:openGifs")); };
      bar.appendChild(b);
    }

    // Theme settings
    if (!qs("#btfw-theme-btn-chat", bar)){
      const b = document.createElement("button");
      b.id="btfw-theme-btn-chat"; b.className="btfw-chatbtn"; b.title="Theme settings"; b.innerHTML=`<i class="fa fa-sliders"></i>`;
      b.onclick = () => document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      bar.appendChild(b);
    }

    const controls = qs("#chatcontrols,#chat-controls") || (qs("#chatline") && qs("#chatline").parentElement);
    if (controls && controls.nextElementSibling !== bottom.nextElementSibling){
      controls.classList.add("btfw-controls-row");
      bottom.after(controls);
    }
    return bar;
  }

  function prepareUserlistOverlay(){
    const ul = qs("#userlist"); if(!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.remove("btfw-userlist-overlay--open"); // hidden by default
  }
  function toggleUserOverlay(){
    const ul = qs("#userlist"); if(!ul) return;
    if (!ul.classList.contains("btfw-userlist-overlay")) prepareUserlistOverlay();
    ul.classList.toggle("btfw-userlist-overlay--open");
  }

  // Title
  function getCurrentTitle(){
    const el = qs("#currenttitle") || qs("#plmeta .title") || qs("#videowrap .title");
    return el ? (el.textContent||"").trim() : ((window.CHANNEL&&CHANNEL.media&&CHANNEL.media.title)||"");
  }
  function setTitle(){ const t=qs("#btfw-chat-title"); if(t) t.textContent = getCurrentTitle() || "Now Playing"; }

  // Username colors
  function stringToColour(str){ for(var i=0,hash=0;i<str.length;hash=str.charCodeAt(i++)+((hash<<5)-hash)); for(var i=0,colour="#";i<3;colour+=("00"+((hash>>i++*8)&0xFF).toString(16)).slice(-2)); return colour; }
  function colorize(el){
    if(!el) return;
    const u = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if(!u) return;
    const name = (u.textContent||"").replace(":","").trim();
    if (!name) return;
    u.style.color = stringToColour(name);
    u.dataset.btfwColored = "1";
  }
  function observeColors(){
    const buf = qs("#messagebuffer"); if(!buf || buf._btfw_colors) return; buf._btfw_colors = true;
    new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{ if(n.nodeType===1) colorize(n); }))).observe(buf,{childList:true});
    qsa("#messagebuffer .username,.nick,.name").forEach(colorize);
  }

  function boot(){ ensureBars(); prepareUserlistOverlay(); setTitle(); observeColors(); }
  document.addEventListener("btfw:layoutReady", boot);
  (window.socket&&window.socket.on)&&window.socket.on("changeMedia", setTitle);
  setInterval(setTitle, 2500);
  return { name:"feature:chat" };
});
