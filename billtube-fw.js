/*! BillTube Framework – v3.4f */
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
      "modules/feature-channel-theme-admin.js",
      "modules/feature-theme-settings.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>load(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
    // Initialize core modules first, then layout-dependent ones
    return Promise.all([
      BTFW.init("feature:styleCore"),
      BTFW.init("feature:bulma-layer")
    ]);
  }).then(function(){
    // Initialize layout early
    return BTFW.init("feature:layout");
  }).then(function(){
    // Wait a bit for layout to settle
    return new Promise(resolve => setTimeout(resolve, 100));
  }).then(function(){
    // Initialize all remaining modules
    return Promise.all([
      BTFW.init("feature:channels"),  // Initialize channels early
      BTFW.init("feature:footerForms"),
      BTFW.init("feature:player"),
      BTFW.init("feature:stack"),
      BTFW.init("feature:chat"),
      BTFW.init("feature:chat-tools"),
      BTFW.init("feature:chat-username-colors"),
      BTFW.init("feature:emotes"),
      BTFW.init("feature:chatMedia"),
      BTFW.init("feature:emoji-compat"),
      BTFW.init("feature:chat-avatars"),
      BTFW.init("feature:chat-timestamps"),
      BTFW.init("feature:chat-ignore"),
      BTFW.init("feature:navbar"),
      BTFW.init("feature:modal-skin"),
      BTFW.init("feature:nowplaying"),
      BTFW.init("feature:gifs"),
      BTFW.init("feature:ambient"),
      BTFW.init("feature:videoOverlay"),
      BTFW.init("feature:pip"),
      BTFW.init("feature:notify"),
      BTFW.init("feature:syncGuard"),
      BTFW.init("feature:chat-commands"),
      BTFW.init("feature:playlist-tools"),
      BTFW.init("feature:local-subs"),
      BTFW.init("feature:emoji-loader"),
      BTFW.init("feature:billcast"),
      BTFW.init("feature:motd-editor"),
      BTFW.init("feature:channelThemeAdmin"),
      BTFW.init("feature:themeSettings")
    ]);
  }).then(function(){ 
    console.log("[BTFW v3.4f] Ready.");
    // Dispatch a final ready event
    document.dispatchEvent(new CustomEvent('btfw:ready', { 
      detail: { version: '3.4f', timestamp: Date.now() } 
    }));
  })
  .catch(function(e){ 
    console.error("[BTFW v3.4f] boot failed:", e&&e.message||e); 
  });
})();