/*! BillTube Framework (BTFW) for CyTube — core loader (compat) */
(function(){
  // Find our base URL (folder that contains this script)
  var current = (document.currentScript && document.currentScript.src) || (function(){
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1].src || "";
  })();
  var BASE = current.replace(/\/[^\/]*$/, "");

  // --- tiny module system ----------------------------------------------------
  var Registry = Object.create(null); // name -> { deps:[], factory:fn, instance:any }

  function define(name, deps, factory){
    Registry[name] = { deps: deps || [], factory: factory, instance: null };
  }

  // Synchronous require:
  //  - returns the instance if already initialized
  //  - returns undefined if not yet initialized (back-compat with older theme code)
  function require(name){
    var m = Registry[name];
    return m ? m.instance : undefined;
  }

  async function init(name){
    var m = Registry[name];
    if (!m) throw new Error("Module not found: " + name);
    if (m.instance) return m.instance;

    // Initialize dependencies first (in order)
    for (var i = 0; i < m.deps.length; i++){
      await init(m.deps[i]);
    }

    // Call factory (provide module helpers + BASE)
    m.instance = await m.factory({ define: define, require: require, init: init, BASE: BASE });
    return m.instance;
  }

  // Expose API
  window.BTFW = { define: define, require: require, init: init, BASE: BASE };

  // --- helpers ---------------------------------------------------------------
  function preloadCSS(href){
    return new Promise(function(resolve){
      var l = document.createElement("link");
      l.rel = "preload";
      l.as  = "style";
      l.href = href;
      l.onload  = function(){ l.rel = "stylesheet"; resolve(true); };
      l.onerror = function(){ l.rel = "stylesheet"; resolve(false); };
      document.head.appendChild(l);
    });
  }

  // Keep execution order deterministic for modules
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src   = src;
      s.async = false;
      s.defer = false;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  // --- bootstrap -------------------------------------------------------------
  // Preload core CSS (non-blocking; switches to stylesheet onload)
  Promise.all([
    preloadCSS(BASE + "/css/tokens.css"),
    preloadCSS(BASE + "/css/base.css"),
    preloadCSS(BASE + "/css/player.css"),
    preloadCSS(BASE + "/css/mobile.css"),
    preloadCSS(BASE + "/css/overlays.css"),
    preloadCSS(BASE + "/css/chat.css")
  ])
  .then(function(){
    // Load feature modules in strict order
    var mods = [
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
      "modules/feature-channels.js"
    ];
    return mods.reduce(function(p, file){
      return p.then(function(){ return loadScript(BASE + "/" + file); });
    }, Promise.resolve());
  })
  .then(function(){
    // Init core first (so BTFW.require("core") is ready during feature init)
    return BTFW.init("core").then(function(core){
      if (core && typeof core.boot === "function") core.boot();
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
        BTFW.init("feature:channels")
      ]);
    });
  })
  .then(function(){
    console.log("[BTFW compat] Ready.");
  })
  .catch(function(e){
    console.error("[BTFW compat] boot failed:", e && e.message || e);
  });
})();