
/*! BillTube Framework — v3.4f */
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

function preload(href){
  return new Promise(function(resolve){
    var l = document.createElement("link");
    l.rel = "preload";
    l.as  = "style";
    l.href = qparam(href, "v="+encodeURIComponent(BTFW_VERSION));
    l.onload = function(){ l.rel = "stylesheet"; resolve(true); };
    l.onerror = function(){ l.rel = "stylesheet"; resolve(false); };
    document.head.appendChild(l);
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

  Promise.all([
    preload(BASE+"/css/tokens.css"),
    preload(BASE+"/css/base.css"),
    preload(BASE+"/css/navbar.css"),
    preload(BASE+"/css/chat.css"),
    preload(BASE+"/css/overlays.css"),
    preload(BASE+"/css/player.css"),
    preload(BASE+"/css/mobile.css")
  ]).then(function(){
    var mods=[
      "modules/feature-style-core.js",
      "modules/feature-bulma-layer.js",
      "modules/feature-layout.js",
	  "modules/feature-player.js",
      "modules/feature-stack.js",
      "modules/feature-chat.js",
	  "modules/feature-chat-tools.js",
	  "modules/feature-emotes.js",
	  "modules/feature-emoji-compat.js",
      "modules/feature-chat-avatars.js",
	  "modules/feature-navbar.js",
      "modules/feature-nowplaying.js",
      "modules/feature-gifs.js",
      "modules/feature-video-overlay.js",
      "modules/feature-pip.js",
      "modules/feature-sync-guard.js",
      "modules/feature-theme-settings.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>load(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
    return Promise.all([
      BTFW.init("feature:styleCore"),
      BTFW.init("feature:bulma-layer"),
      BTFW.init("feature:layout"),
	  BTFW.init("feature:player"),
      BTFW.init("feature:stack"),
      BTFW.init("feature:chat"),
	  BTFW.init("feature:chat-tools"),
	  BTFW.init("feature:emotes"),
	  BTFW.init("feature:emoji-compat"),
      BTFW.init("feature:chat-avatars"),
	  BTFW.init("feature:navbar"),
      BTFW.init("feature:nowplaying"),
      BTFW.init("feature:gifs"),
      BTFW.init("feature:videoOverlay"),
      BTFW.init("feature:pip"),
      BTFW.init("feature:syncGuard"),
	  BTFW.init("feature:themeSettings")
    ]);
  }).then(function(){ console.log("[BTFW v3.4f] Ready."); })
  .catch(function(e){ console.error("[BTFW v3.4f] boot failed:", e&&e.message||e); });
})();
