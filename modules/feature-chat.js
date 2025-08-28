BTFW.define("feature:chat", ["feature:layout"], async ({ require }) => {
  const qs = (s, r=document) => r.querySelector(s);

  function ensureBars(){
    const cw = qs("#chatwrap"); if (!cw) return;
    cw.classList.add("btfw-chatwrap");

// Inside ensureBars(), top bar:
if (!top) {
  top = document.createElement("div"); top.className = "btfw-chat-topbar";
  top.innerHTML = `<div class="btfw-chat-title" id="btfw-nowplaying-slot"></div>`;
  cw.prepend(top);
}

    // BOTTOM BAR: all controls
    let bottom = qs(".btfw-chat-bottombar", cw);
    if (!bottom) {
      bottom = document.createElement("div"); bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `<div class="btfw-chat-actions" id="btfw-chat-actions"></div>`;
      cw.appendChild(bottom);
    } else {
      bottom.classList.remove("is-hidden");
    }
    const bar = bottom.querySelector("#btfw-chat-actions");

    // Emotes
    const emotebtn = qs("#emotelistbtn");
    if (emotebtn && emotebtn.parentElement !== bar){ emotebtn.className = "btfw-chatbtn"; bar.appendChild(emotebtn); }

    // Users overlay toggle
    if (!qs("#btfw-users-toggle", bar)){
      const b = document.createElement("button");
      b.id="btfw-users-toggle"; b.className="btfw-chatbtn"; b.title="Users";
      b.innerHTML=`<i class="fa fa-users"></i>`;
      b.onclick = toggleUserOverlay; bar.appendChild(b);
    }

    // GIFs
    if (!qs("#btfw-gif-btn", bar)){
      const b = document.createElement("button");
      b.id="btfw-gif-btn"; b.className="btfw-chatbtn"; b.title="GIFs";
      b.innerHTML=`<i class="fa-solid fa-gif"></i>`;
      b.onclick = () => document.dispatchEvent(new Event("btfw:openGifs"));
      bar.appendChild(b);
    }

    // Theme settings
    if (!qs("#btfw-theme-btn-chat", bar)){
      const b = document.createElement("button");
      b.id="btfw-theme-btn-chat"; b.className="btfw-chatbtn"; b.title="Theme settings";
      b.innerHTML=`<i class="fa fa-sliders"></i>`;
      b.onclick = () => document.dispatchEvent(new CustomEvent("btfw:openThemeSettings"));
      bar.appendChild(b);
    }

    // Place the native controls just under the bottom bar
    const controls = qs("#chatcontrols,#chat-controls") || (qs("#chatline") && qs("#chatline").parentElement);
    if (controls && controls.previousElementSibling !== bottom){
      controls.classList.add("btfw-controls-row");
      bottom.after(controls);
    }

    // Make sure the message area flexes
    const buf = qs("#messagebuffer");
    if (buf) buf.classList.add("btfw-messagebuffer");
  }

  function toggleUserOverlay(){
    const ul = document.getElementById("userlist"); if (!ul) return;
    ul.classList.add("btfw-userlist-overlay");
    ul.classList.toggle("btfw-userlist-overlay--open");
  }

  function getCurrentTitle(){
    const el = document.querySelector("#currenttitle") ||
               document.querySelector("#plmeta .title") ||
               document.querySelector("#videowrap .title");
    return el ? (el.textContent||"").trim() : ((window.CHANNEL&&CHANNEL.media&&CHANNEL.media.title)||"");
  }
  function setTitle(){
    const t=document.getElementById("btfw-chat-title");
    if (t) t.textContent = getCurrentTitle() || "Now Playing";
  }

  // Username colors (stable)
  function stringToColour(str){ for(let i=0,hash=0;i<str.length;hash=str.charCodeAt(i++)+((hash<<5)-hash)); let c="#"; for(let i=0;i<3;i++) c+=("00"+((hash>>i*8)&0xFF).toString(16)).slice(-2); return c; }
  function colorize(el){
    const u = el.matches?.(".username,.nick,.name") ? el : el.querySelector?.(".username,.nick,.name");
    if (!u) return;
    const name = (u.textContent||"").replace(":","").trim();
    if (!name) return;
    u.style.color = stringToColour(name);
  }
  function observeColors(){
    const buf = document.getElementById("messagebuffer"); if(!buf || buf._btfw_colors) return; buf._btfw_colors = true;
    new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType===1) colorize(n); }))).observe(buf,{childList:true});
    Array.from(buf.querySelectorAll(".username,.nick,.name")).forEach(colorize);
  }

  /** Keep bars present even if DOM hot-swaps */
  function ensureLoop(){
    ensureBars(); setTitle();
    // if someone removes them, put them back
    const cw = qs("#chatwrap");
    if (!cw) return;
    if (!qs(".btfw-chat-topbar", cw) || !qs(".btfw-chat-bottombar", cw)) ensureBars();
  }

  function boot(){
    ensureBars(); setTitle(); observeColors();
    // Re-run on mutations inside chatwrap
    const cw = qs("#chatwrap");
    if (cw && !cw._btfw_bar_guard){
      cw._btfw_bar_guard = true;
      new MutationObserver(() => ensureLoop()).observe(cw, { childList:true, subtree:true });
    }
  }

  document.addEventListener("btfw:layoutReady", boot);
  (window.socket&&window.socket.on)&&window.socket.on("changeMedia", setTitle);
  // belt-and-suspenders refresh
  setInterval(ensureLoop, 2500);

  return { name:"feature:chat" };
});
