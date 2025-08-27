
/*! BillTube Framework (BTFW) compat loader — patched mods list (v2.5) */
(function(){
  var current=(document.currentScript&&document.currentScript.src)||function(){var s=document.getElementsByTagName('script');return s[s.length-1].src||"";}();
  var BASE=current.replace(/\/[^\/]*$/, "");

  var Registry=Object.create(null);
  function define(name,deps,factory){ Registry[name]={deps:deps||[],factory:factory,instance:null}; }
  function require(name){ var m=Registry[name]; return m?m.instance:undefined; }
  async function init(name){
    var m=Registry[name]; if(!m) throw new Error("Module not found: "+name);
    if(m.instance) return m.instance;
    for(var i=0;i<m.deps.length;i++){ await init(m.deps[i]); }
    m.instance = await m.factory({define, require, init, BASE});
    return m.instance;
  }
  window.BTFW = { define, require, init, BASE };

  function preloadCSS(href){
    return new Promise(function(resolve){
      var l=document.createElement("link"); l.rel="preload"; l.as="style"; l.href=href;
      l.onload=function(){ l.rel="stylesheet"; resolve(true); };
      l.onerror=function(){ l.rel="stylesheet"; resolve(false); };
      document.head.appendChild(l);
    });
  }
  function loadScript(src){
    return new Promise(function(resolve,reject){
      var s=document.createElement("script"); s.src=src; s.async=false; s.defer=false;
      s.onload=function(){ resolve(); };
      s.onerror=function(){ reject(new Error("Failed to load "+src)); };
      document.head.appendChild(s);
    });
  }

  Promise.all([
    preloadCSS(BASE+"/css/tokens.css"),
    preloadCSS(BASE+"/css/base.css"),
    preloadCSS(BASE+"/css/player.css"),
    preloadCSS(BASE+"/css/mobile.css"),
    preloadCSS(BASE+"/css/overlays.css"),
    preloadCSS(BASE+"/css/chat.css")
  ]).then(function(){
    var mods=[
      "modules/core.js",
      "modules/bridge-cytube.js",
      "modules/feature-layout.js",
      "modules/feature-player.js",
      "modules/feature-chat.js",
      "modules/feature-playlist-search.js",
      "modules/feature-resize.js",
      "modules/feature-overlays.js",
      "modules/feature-ui.js",
      "modules/feature-theme-settings.js",
      "modules/feature-userlist-overlay.js",
      "modules/feature-chat-avatars.js",
      "modules/feature-channels.js",
      "modules/feature-gifs.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>loadScript(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
    return BTFW.init("core").then(function(core){
      if(core&&core.boot) core.boot();
      return Promise.all([
        BTFW.init("feature:layout"),
        BTFW.init("feature:player"),
        BTFW.init("feature:chat"),
        BTFW.init("feature:playlistSearch"),
        BTFW.init("feature:resize"),
        BTFW.init("feature:overlays"),
        BTFW.init("feature:ui"),
        BTFW.init("feature:themeSettings"),
        BTFW.init("feature:userlistOverlay"),
        BTFW.init("feature:chatAvatars"),
        BTFW.init("feature:channels"),
        BTFW.init("feature:gifs")
      ]);
    });
  }).then(function(){ console.log("[BTFW v2.5] Ready."); })
    .catch(function(e){ console.error("[BTFW v2.5] boot failed:", e&&e.message||e); });
})();
