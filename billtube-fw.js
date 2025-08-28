
/*! BTFW loader — v3.4b */
(function(){
  var current=(document.currentScript&&document.currentScript.src)||function(){var s=document.getElementsByTagName('script');return s[s.length-1].src||"";}();
  var BASE=current.replace(/\/[^\/]*$/, "");
  window.BTFW = window.BTFW || { define:function(n,d,f){ (this._r=this._r||{})[n]={deps:d||[],factory:f}; }, init:async function(n){ const R=this._r||{}; const m=R[n]; if(!m) throw new Error("Module not found: "+n); if(m.i) return m.i; for(const dep of m.deps||[]) await this.init(dep); return m.i=await m.factory(this);} , BASE:BASE };

  function preload(h){return new Promise(function(r){var l=document.createElement("link");l.rel="preload";l.as="style";l.href=h;l.onload=function(){l.rel="stylesheet";r();};l.onerror=function(){l.rel="stylesheet";r();};document.head.appendChild(l);});}
  function load(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.async=false;s.defer=false;s.onload=res;s.onerror=function(){rej(new Error("Failed to load "+src));};document.head.appendChild(s);});}
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
      "modules/feature-stack.js",
      "modules/feature-chat.js",
      "modules/feature-chat-avatars.js",
      "modules/feature-nowplaying.js",
      "modules/feature-gifs.js",
      "modules/feature-video-overlay.js",
      "modules/feature-pip.js",
      "modules/feature-sync-guard.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>load(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
    return Promise.all([
      BTFW.init("feature:styleCore"),
      BTFW.init("feature:bulma"),
      BTFW.init("feature:layout"),
      BTFW.init("feature:stack"),
      BTFW.init("feature:chat"),
      BTFW.init("feature:chatAvatars"),
      BTFW.init("feature:nowplaying"),
      BTFW.init("feature:gifs"),
      BTFW.init("feature:videoOverlay"),
      BTFW.init("feature:pip"),
      BTFW.init("feature:syncGuard")
    ]);
  }).then(function(){ console.log("[BTFW v3.4b] Ready."); })
  .catch(function(e){ console.error("[BTFW v3.4b] boot failed:", e&&e.message||e); });
})();
