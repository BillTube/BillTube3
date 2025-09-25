/*! BillTube Framework â€" v3.4f */
(function(){
  var scripts=document.getElementsByTagName('script');
  var BASE=(document.currentScript&&document.currentScript.src)||scripts[scripts.length-1].src; BASE=BASE.replace(/\/[^\/]*$/, "");

  var Registry=Object.create(null);
  function define(name,deps,factory){ Registry[name]={deps:deps||[],factory:factory,instance:null}; }
  async function init(name){
    var m=Registry[name]; if(!m) throw new Error("Module not found: "+name);
    if(m.instance) return m.instance;
    for(var i=0;i<m.deps.length;i++){ await init(m.deps[i]); }
    m.instance = await m.factory({define, init, BASE});
    return m.instance;
  }
  window.BTFW = { define, init, BASE };

function qparam(u, kv){ return u + (u.indexOf('?')>=0?'&':'?') + kv; }

var BTFW_VERSION = (function(){
  var m = /[?&]v=([^&]+)/.exec(location.search);
  return (m && m[1]) || ('dev-' + Date.now());
})();

var SUPPORTS_PRELOAD = (function(){
  try {
    return document.createElement("link").relList.supports("preload");
  } catch (e) {
    return false;
  }
})();

function preload(href){
  return new Promise(function(resolve){
    var l = document.createElement("link");
    var url = qparam(href, "v="+encodeURIComponent(BTFW_VERSION));

    if (SUPPORTS_PRELOAD) {
      l.rel = "preload";
      l.as  = "style";
      l.onload = function(){
        l.rel = "stylesheet";
        l.removeAttribute("onload");
        resolve(true);
      };
      l.onerror = function(){
        l.rel = "stylesheet";
        resolve(false);
      };
    } else {
      l.rel = "stylesheet";
      l.onload = function(){ resolve(true); };
      l.onerror = function(){ resolve(false); };
    }

    l.href = url;
    document.head.appendChild(l);

    if (!SUPPORTS_PRELOAD) {
      resolve(true);
    }
  });
}

function load(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement("script");
    s.async = true; s.defer = true;
    s.src = qparam(src, "v="+encodeURIComponent(BTFW_VERSION)) + "&t=" + Date.now();
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error("Failed to load "+src)); };
    document.head.appendChild(s);
  });
}

  // Preload CSS in proper order for layout stability
  Promise.all([
    preload(BASE+"/css/tokens.css"),
    preload(BASE+"/css/base.css"),
    preload(BASE+"/css/navbar.css"),
    preload(BASE+"/css/chat.css"),
    preload(BASE+"/css/overlays.css"),
    preload(BASE+"/css/player.css"),
    preload(BASE+"/css/mobile.css")
  ]).then(function(){
    // Load modules in dependency order - core first, then layout-dependent modules
    var mods=[
      "modules/feature-style-core.js",
      "modules/feature-bulma-layer.js",
      "modules/feature-layout.js",
      "modules/feature-channels.js",
      "modules/feature-footer-forms.js",
      "modules/feature-player.js",
      "modules/feature-stack.js",
      "modules/feature-chat.js",
      "modules/feature-chat-tools.js",
      "modules/feature-navbar.js",
      "modules/feature-modal-skin.js",
      "modules/feature-nowplaying.js",
      "modules/feature-chat-username-colors.js",
      "modules/feature-emotes.js",
      "modules/feature-chat-media.js",
      "modules/feature-emoji-compat.js",
      "modules/feature-chat-avatars.js",
      "modules/feature-chat-timestamps.js",
      "modules/feature-chat-ignore.js",
      "modules/feature-gifs.js",
      "modules/feature-ambient.js",
      "modules/feature-video-overlay.js",
      "modules/feature-pip.js",
      "modules/feature-notify.js",
      "modules/feature-sync-guard.js",
      "modules/feature-chat-commands.js",
      "modules/feature-playlist-tools.js",
      "modules/feature-local-subs.js",
      "modules/feature-emoji-loader.js",
      "modules/feature-billcast.js",
      "modules/feature-motd-editor.js",
      "modules/feature-video-enhancements.js",
      "modules/feature-chat-scroll.js",
      "modules/feature-footer-branding.js",
      "modules/feature-channel-theme-admin.js",
      "modules/feature-theme-settings.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>load(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
    // Initialize core modules first, then layout-dependent ones
    return BTFW.init([
      "feature:style-core",
      "feature:bulma-layer", 
      "feature:layout"
    ]);
  }).then(function(){
    // Initialize UI and interaction modules
    return BTFW.init([
      "feature:channels",
      "feature:footer-forms",
      "feature:player", 
      "feature:stack",
      "feature:chat",
      "feature:chat-tools",
      "feature:navbar",
      "feature:modal-skin",
      "feature:nowplaying"
    ]);
  }).then(function(){
    // Initialize enhancement modules
    return BTFW.init([
      "feature:chat-username-colors",
      "feature:emotes",
      "feature:chat-media", 
      "feature:emoji-compat",
      "feature:chat-avatars",
      "feature:chat-timestamps",
      "feature:chat-ignore",
      "feature:gifs",
      "feature:ambient",
      "feature:video-overlay",
      "feature:pip",
      "feature:notify",
      "feature:sync-guard",
      "feature:chat-commands",
      "feature:playlist-tools",
      "feature:local-subs",
      "feature:emoji-loader",
      "feature:billcast",
      "feature:motd-editor",
      "feature:video-enhancements",
      "feature:chat-scroll",
      "feature:footer-branding",
      "feature:channel-theme-admin",
      "feature:theme-settings"
    ]);
  }).then(function(){
    // Framework fully loaded
    console.log("[BTFW] Framework loaded successfully");
    document.documentElement.setAttribute("data-btfw-ready", "true");
  }).catch(function(err){
    console.error("[BTFW] Framework initialization failed:", err);
  });

})();