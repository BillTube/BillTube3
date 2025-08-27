BTFW.define("feature:chat", ["core"], async function({ require }){
  const core = require("core");

  function getCurrentTitle(){
    // Prefer CyTube socket payload (via core event), otherwise DOM fallbacks
    const el = document.querySelector("#currenttitle") ||
               document.querySelector("#plmeta .title") ||
               document.querySelector("#plmeta") ||
               document.querySelector("#videowrap .title");
    return el ? (el.textContent||"").trim() : "";
  }

  function setTitle(text){
    const t = document.getElementById("btfw-ctitle");
    if (t) t.textContent = text || getCurrentTitle() || "Now Playing";
  }

  function setMyAvatar(){
    const img = document.getElementById("btfw-me-avatar");
    if (!img) return;
    const me = (window.CLIENT && window.CLIENT.name) || "";
    if (!me) return;
    if (window.BTFW_avatars && window.BTFW_avatars.resolve){
      img.src = window.BTFW_avatars.resolve(me);
      img.alt = me;
      img.title = me;
    }
  }

  function wireFooterButtons(){
    const btn = document.getElementById("btfw-btn-emotes");
    if (!btn) return;
    btn.addEventListener("click", function(){
      // Try to trigger CyTube's native emotelist if present
      const trigger = document.getElementById("emotelistbtn") ||
                      document.querySelector("[data-toggle='emotelist'], #emotelist");
      if (trigger) {
        trigger.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      } else if (window.BTFW_overlays) {
        window.BTFW_overlays.openDrawer({ title: "Emotes", side: "right",
          content: "<div style='padding:12px'>Hook your emote provider here.</div>"});
      }
    });
  }

  function wireTopButtons(){
    const users = document.getElementById("btfw-btn-users");
    const gifs  = document.getElementById("btfw-btn-gifs");
    if (users) users.addEventListener("click", ()=> window.BTFW_userlist && BTFW_userlist.toggle && BTFW_userlist.toggle());
    if (gifs && window.BTFW_overlays){
      gifs.addEventListener("click", ()=> BTFW_overlays.openDrawer({title:"GIFs", side:"right",
        content:"<div style='padding:12px'>Giphy/Tenor UI goes here</div>"}));
    }
  }

  function ensureBars(){
    const cw = document.getElementById("chatwrap");
    if (!cw) return;

    // TOP: banner with current title + actions + my avatar
    let top = cw.querySelector(".btfw-chat-topbar");
    if (!top){
      top = document.createElement("div");
      top.className = "btfw-chat-topbar";
      top.innerHTML = `
        <div class="btfw-chat-banner">
          <div class="btfw-ctitle" id="btfw-ctitle">Now Playing</div>
          <div class="btfw-chat-actions">
            <button id="btfw-btn-users" class="btfw-iconbtn btfw-ic-users" title="Users"></button>
            <button id="btfw-btn-gifs"  class="btfw-iconbtn btfw-ic-gif"   title="GIFs"></button>
            <img id="btfw-me-avatar" class="btfw-me-avatar" alt="">
          </div>
        </div>`;
      cw.insertBefore(top, cw.firstChild);
    }

    // BOTTOM: emote button (mote list)
    let bottom = cw.querySelector(".btfw-chat-bottombar");
    if (!bottom){
      bottom = document.createElement("div");
      bottom.className = "btfw-chat-bottombar";
      bottom.innerHTML = `
        <div class="btfw-chat-bottom-actions">
          <button id="btfw-btn-emotes" class="btfw-iconbtn btfw-ic-emotes" title="Emote list"></button>
        </div>`;
      cw.appendChild(bottom);
    }
  }

  function boot(){
    ensureBars();
    wireTopButtons();
    wireFooterButtons();
    setTitle();
    setMyAvatar();

    // Keep title in sync with CyTube media changes
    core.on("changeMedia", function(p){
      setTitle(p && p.title || "");
      // a tiny delay in case DOM label updates after event
      setTimeout(()=>setTitle(), 50);
    });

    // Retry avatar once in case CLIENT.name wasn't ready
    let tries = 0;
    const iv = setInterval(function(){
      tries++;
      setMyAvatar();
      if (tries > 10 || (document.getElementById("btfw-me-avatar")||{}).src) clearInterval(iv);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {};
});
