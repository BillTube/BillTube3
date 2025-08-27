
/*! BillTube3 hardened loader — no GitHub/version fetch, strict same-origin */
(function(){
  var src = (document.currentScript && document.currentScript.src) || (function(){
    var s=document.getElementsByTagName('script'); return s[s.length-1].src;
  })();
  if (!src) { console.error("[BTFW] Cannot determine current script src"); return; }
  var clean = src.split("#")[0].split("?")[0];
  var BASE = clean.replace(/\/[^\/]*$/, "");

  var PREFIX = ""; // e.g. "btfw/" if billtube-fw.js lives at /btfw/billtube-fw.js
  function P(rel){ return BASE + "/" + (PREFIX ? PREFIX.replace(/\/?$/,'/') : "") + rel; }

  function preloadCSS(href){
    return new Promise(function(resolve){
      var l = document.createElement("link");
      l.rel = "preload"; l.as = "style"; l.href = href;
      l.onload = function(){ l.rel = "stylesheet"; resolve(true); };
      l.onerror = function(){ console.warn("[BTFW] CSS failed, keeping tag anyway:", href); l.rel = "stylesheet"; resolve(false); };
      document.head.appendChild(l);
    });
  }

  function loadScript(url){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = url; s.async = false; s.defer = false;
      s.onload = function(){ resolve(true); };
      s.onerror = function(){ reject(new Error("Script 404/blocked: " + url)); };
      document.head.appendChild(s);
    });
  }

  (function(){
    var Registry = {};
    function define(name, deps, factory){ Registry[name]={deps:deps||[], factory:factory, instance:null}; }
    function require(name){ return (Registry[name]||{}).instance; }
    async function init(name){
      var m = Registry[name]; if(!m) throw new Error("Module not found: "+name);
      if (m.instance) return m.instance;
      for (var i=0;i<m.deps.length;i++){ await init(m.deps[i]); }
      m.instance = await m.factory({define, require, init, BASE: BASE});
      return m.instance;
    }
    window.BTFW = { define, require, init, BASE: BASE };
  })();

  Promise.all([
    preloadCSS(P("css/tokens.css")),
    preloadCSS(P("css/base.css")),
    preloadCSS(P("css/player.css")),
    preloadCSS(P("css/mobile.css"))
  ]).then(function(){
    var files = [
      "modules/core.js",
      "modules/bridge-cytube.js",
      "modules/feature-layout.js",
      "modules/feature-player.js",
      "modules/feature-chat.js",
      "modules/feature-playlist-search.js"
    ];
    (files.reduce(function(p, f){
      return p.then(function(){ return loadScript(P(f)); });
    }, Promise.resolve()))
    .then(function(){
      return BTFW.init("core").then(function(core){
        core.boot();
        return Promise.all([
          BTFW.init("feature:layout"),
          BTFW.init("feature:player"),
          BTFW.init("feature:chat"),
          BTFW.init("feature:playlistSearch")
        ]);
      });
    })
    .then(function(){ console.log("[BTFW] Ready."); })
    .catch(function(err){
      console.error("[BTFW] Boot failed:", err);
      console.info("[BTFW] Check that these URLs exist (open them in your browser):");
      console.info(P("modules/core.js"));
      console.info(P("modules/bridge-cytube.js"));
      console.info(P("modules/feature-layout.js"));
      console.info(P("modules/feature-player.js"));
      console.info(P("modules/feature-chat.js"));
      console.info(P("modules/feature-playlist-search.js"));
    });
  });
})();
