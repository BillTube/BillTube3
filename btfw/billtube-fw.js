
/*! BillTube Framework (BTFW) for CyTube — core loader */
(function(){
  var current = document.currentScript && document.currentScript.src || (function(){
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length-1].src || "";
  })();
  var BASE = current.replace(/\/[^\/]*$/, "");

  var Registry = {};
  function define(name, deps, factory){ Registry[name]={deps:deps||[], factory:factory, instance:null}; }
  function require(name){ return Registry[name] && Registry[name].instance; }
  async function init(name){
    var m = Registry[name];
    if(!m) throw new Error("Module not found: "+name);
    if(m.instance) return m.instance;
    for(var i=0;i<m.deps.length;i++){ await init(m.deps[i]); }
    m.instance = await m.factory({define, require, init, BASE});
    return m.instance;
  }

  function preloadCSS(href){
    return new Promise(function(resolve){
      var l = document.createElement("link");
      l.rel="preload"; l.as="style"; l.href=href;
      l.onload=function(){ l.rel="stylesheet"; resolve(true); };
      l.onerror=function(){ l.rel="stylesheet"; resolve(false); };
      document.head.appendChild(l);
    });
  }
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s=document.createElement("script");
      s.src=src; s.async=true; s.defer=true; s.onload=function(){ resolve(); };
      s.onerror=function(e){ reject(new Error("Failed to load "+src)); };
      document.head.appendChild(s);
    });
  }

  window.BTFW = { define, require, init, BASE };

  var cssBase   = BASE + "/css/base.css";
  var cssTokens = BASE + "/css/tokens.css";
  var cssPlayer = BASE + "/css/player.css";
  var cssMobile = BASE + "/css/mobile.css";
  Promise.all([preloadCSS(cssTokens), preloadCSS(cssBase), preloadCSS(cssPlayer), preloadCSS(cssMobile)])
    .then(function(){
      var mods = [
        "modules/core.js",
        "modules/bridge-cytube.js",
        "modules/feature-layout.js",
        "modules/feature-player.js",
        "modules/feature-chat.js",
        "modules/feature-playlist-search.js"
      ];
      (mods.reduce(function(p, file){
        return p.then(function(){ return loadScript(BASE + "/" + file); });
      }, Promise.resolve())).then(function(){
        BTFW.init("core").then(function(core){
          core.boot();
          BTFW.init("feature:layout");
          BTFW.init("feature:player");
          BTFW.init("feature:chat");
          BTFW.init("feature:playlistSearch");
          console.log("[BTFW] Ready.");
        }).catch(function(e){ console.error("[BTFW] boot error", e); });
      });
    });
})();
