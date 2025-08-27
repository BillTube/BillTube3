
/*! BillTube Framework (BTFW) v2 — modular loader */
(function(){
  var src = (document.currentScript && document.currentScript.src) || (function(){
    var s=document.getElementsByTagName('script'); return s[s.length-1].src;
  })();
  var clean = src.split("#")[0].split("?")[0];
  var BASE = clean.replace(/\/[^\/]*$/, "");

  function preloadCSS(href){
    return new Promise(function(resolve){
      var l=document.createElement("link"); l.rel="preload"; l.as="style"; l.href=href;
      l.onload=function(){ l.rel="stylesheet"; resolve(true); };
      l.onerror=function(){ l.rel="stylesheet"; resolve(false); };
      document.head.appendChild(l);
    });
  }
  function loadScript(url){
    return new Promise(function(resolve,reject){
      var s=document.createElement("script"); s.src=url; s.async=false; s.defer=false;
      s.onload=function(){ resolve(); }; s.onerror=function(){ reject(new Error(url)); };
      document.head.appendChild(s);
    });
  }
  (function(){ var R={};
    function define(n,d,f){ R[n]={d:d||[],f:f,i:null}; }
    async function init(n){ var m=R[n]; if(!m) throw new Error("Module not found: "+n);
      if(m.i) return m.i; for(var i=0;i<m.d.length;i++){ await init(m.d[i]); }
      m.i = await m.f({define,init,BASE}); return m.i; }
    window.BTFW={define,init,BASE};
  })();

  Promise.all([
    preloadCSS(BASE+"/css/tokens.css"),
    preloadCSS(BASE+"/css/base.css"),
    preloadCSS(BASE+"/css/player.css"),
    preloadCSS(BASE+"/css/mobile.css")
  ]).then(function(){
    var mods=[
      "modules/core.js",
      "modules/bridge-cytube.js",
      "modules/feature-layout.js",
      "modules/feature-player.js",
      "modules/feature-chat.js",
      "modules/feature-playlist-search.js",
      "modules/feature-resize.js",
      "modules/feature-ui.js"
    ];
    return mods.reduce(function(p,f){ return p.then(function(){ return loadScript(BASE+"/"+f); }); }, Promise.resolve());
  }).then(function(){
    return BTFW.init("core").then(function(core){
      core.boot();
      return Promise.all([
        BTFW.init("feature:layout"),
        BTFW.init("feature:player"),
        BTFW.init("feature:chat"),
        BTFW.init("feature:playlistSearch"),
        BTFW.init("feature:resize"),
        BTFW.init("feature:ui")
      ]);
    });
  }).then(function(){ console.log("[BTFW v2] Ready."); })
    .catch(function(e){ console.error("[BTFW v2] boot failed:", e && e.message || e); });
})();
