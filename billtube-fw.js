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

  var BootOverlay=(function(){
    var overlay=null;
    var styleEl=null;
    var muteInterval=null;
    var suppressedVideos=new Map();

    function cleanupVideoRefs(){
      for (const [video] of suppressedVideos) {
        if (!(video instanceof HTMLVideoElement) || !video.isConnected) {
          suppressedVideos.delete(video);
        }
      }
    }

    function suppressVideoAudio(){
      cleanupVideoRefs();
      var videos=document.querySelectorAll('video');
      videos.forEach(function(video){
        if (!(video instanceof HTMLVideoElement)) return;
        if (!suppressedVideos.has(video)) {
          var state={
            muted: video.muted,
            volume: (typeof video.volume === 'number') ? video.volume : null
          };
          suppressedVideos.set(video, state);
        }
        try { video.muted = true; }
        catch(_){}
      });
    }

    function startAudioSuppression(){
      suppressVideoAudio();
      if (muteInterval) return;
      muteInterval = setInterval(suppressVideoAudio, 250);
      document.documentElement && document.documentElement.classList.add('btfw-loading-muted');
    }

    function stopAudioSuppression(){
      if (muteInterval) {
        clearInterval(muteInterval);
        muteInterval = null;
      }
      for (const [video, state] of suppressedVideos.entries()) {
        if (!(video instanceof HTMLVideoElement)) {
          suppressedVideos.delete(video);
          continue;
        }
        try {
          if (!state.muted) {
            video.muted = false;
            if (typeof state.volume === 'number') video.volume = state.volume;
          }
        } catch(_){}
        suppressedVideos.delete(video);
      }
      document.documentElement && document.documentElement.classList.remove('btfw-loading-muted');
    }

    function ensureStyles(){
      if (styleEl) return;
      styleEl=document.createElement('style');
      styleEl.id='btfw-boot-overlay-style';
      styleEl.textContent="\n        #btfw-boot-overlay{\n          position:fixed;\n          inset:0;\n          background:radial-gradient(circle at 20% 20%, rgba(41,52,89,0.28), rgba(5,6,13,0.92));\n          backdrop-filter:blur(6px);\n          display:flex;\n          align-items:center;\n          justify-content:center;\n          z-index:10000;\n          opacity:1;\n          transition:opacity 220ms ease, visibility 220ms ease;\n          visibility:visible;\n        }\n        #btfw-boot-overlay[data-state=hidden]{\n          opacity:0;\n          visibility:hidden;\n        }\n        .btfw-boot-overlay__card{\n          display:flex;\n          flex-direction:column;\n          align-items:center;\n          gap:1rem;\n          padding:2.5rem 3rem;\n          border-radius:18px;\n          background:rgba(9,12,23,0.82);\n          box-shadow:0 18px 48px rgba(3,8,20,0.45);\n          color:#f5f7ff;\n          text-align:center;\n          min-width:260px;\n          font-family:'Inter','Segoe UI',sans-serif;\n        }\n        .btfw-boot-overlay__ring{\n          width:58px;\n          height:58px;\n          border-radius:50%;\n          border:4px solid rgba(255,255,255,0.18);\n          border-top-color:#6d4df6;\n          animation:btfw-boot-spin 1s linear infinite;\n        }\n        .btfw-boot-overlay__label{\n          font-size:0.95rem;\n          letter-spacing:0.02em;\n          opacity:0.88;\n        }\n        .btfw-boot-overlay__label strong{\n          display:block;\n          font-size:1.05rem;\n          letter-spacing:0.03em;\n          margin-bottom:0.35rem;\n        }\n        .btfw-boot-overlay__error{\n          display:none;\n          font-size:0.85rem;\n          color:#ffb4c1;\n        }\n        #btfw-boot-overlay[data-state=error] .btfw-boot-overlay__error{\n          display:block;\n        }\n        #btfw-boot-overlay[data-state=error] .btfw-boot-overlay__ring{\n          border-color:rgba(255,180,193,0.3);\n          border-top-color:#ff5678;\n          animation:none;\n        }\n        @keyframes btfw-boot-spin{\n          from{transform:rotate(0deg);}\n          to{transform:rotate(360deg);}\n        }\n      ";
      document.head.appendChild(styleEl);
    }

    function attach(){
      if (overlay) return overlay;
      ensureStyles();
      overlay=document.createElement('div');
      overlay.id='btfw-boot-overlay';
      overlay.setAttribute('role','status');
      overlay.setAttribute('aria-live','polite');
      overlay.innerHTML="\n        <div class=\"btfw-boot-overlay__card\">\n          <div class=\"btfw-boot-overlay__ring\"></div>\n          <p class=\"btfw-boot-overlay__label\">\n            <strong>BillTube theme</strong>\n            Preparing the channel experience…\n          </p>\n          <p class=\"btfw-boot-overlay__error\"></p>\n        </div>\n      ";
      var mount=function(){
        if (!overlay || overlay.isConnected) return;
        var host=document.body||document.documentElement;
        host.appendChild(overlay);
      };
      if (document.body) mount();
      else document.addEventListener('DOMContentLoaded', mount, { once:true });
      return overlay;
    }

    function show(){ attach(); startAudioSuppression(); }

    function hide(){
      stopAudioSuppression();
      if (!overlay) return;
      overlay.setAttribute('data-state','hidden');
      setTimeout(function(){ if(overlay){ overlay.remove(); overlay=null; } if(styleEl){ styleEl.remove(); styleEl=null; } }, 260);
    }

    function fail(message){
      var ov=attach();
      ov.setAttribute('data-state','error');
      var label=ov.querySelector('.btfw-boot-overlay__label');
      if (label) label.innerHTML='<strong>BillTube theme</strong>Something went wrong loading the experience.';
      var err=ov.querySelector('.btfw-boot-overlay__error');
      if (err) err.textContent=message||'Please refresh to retry.';
      setTimeout(function(){ hide(); }, 4000);
    }

    return { show, hide, fail };
  })();

  BootOverlay.show();

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
      "modules/util-motion.js",
      "modules/feature-style-core.js",
      "modules/feature-bulma-layer.js",
      "modules/feature-layout.js",
      "modules/feature-channels.js",
      "modules/feature-footer.js",
      "modules/feature-player.js",
      "modules/feature-stack.js",
      "modules/feature-chat.js",
      "modules/feature-chat-tools.js",
      "modules/feature-chat-filters.js",
      "modules/feature-navbar.js",
      "modules/feature-modal-skin.js",
      "modules/feature-nowplaying.js",
      "modules/feature-movie-info.js",
      "modules/feature-chat-username-colors.js",
      "modules/feature-emotes.js",
      "modules/feature-chat-media.js",
      "modules/feature-emoji-compat.js",
      "modules/feature-chat-avatars.js",
      "modules/feature-chat-timestamps.js",
      "modules/feature-chat-ignore.js",
      "modules/feature-gifs.js",
      "modules/feature-video-overlay.js",
      "modules/feature-poll-overlay.js",
      "modules/feature-pip.js",
      "modules/feature-notify.js",
      "modules/feature-notification-sounds.js",
      "modules/feature-sync-guard.js",
      "modules/feature-chat-commands.js",
      "modules/feature-playlist-performance.js",
      "modules/feature-playlist-tools.js",
      "modules/feature-local-subs.js",
      "modules/feature-emoji-loader.js",
      "modules/feature-billcast.js",
      "modules/feature-motd-editor.js",
      "modules/feature-video-enhancements.js",
      "modules/feature-channel-theme-admin.js",
      "modules/feature-theme-settings.js",
      "modules/feature-ratings.js"
    ];
    return mods.reduce((p,f)=>p.then(()=>load(BASE+"/"+f)), Promise.resolve());
  }).then(function(){
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
    var inits = [
      BTFW.init("feature:channels"),
      BTFW.init("feature:footer"),
      BTFW.init("feature:player"),
      BTFW.init("feature:stack"),
      BTFW.init("feature:chat"),
      BTFW.init("feature:chat-tools"),
      BTFW.init("feature:chat-filters"),
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
      BTFW.init("feature:movie-info"),
      BTFW.init("feature:gifs"),
      BTFW.init("feature:videoOverlay"),
      BTFW.init("feature:poll-overlay"),
      BTFW.init("feature:pip"),
      BTFW.init("feature:notify"),
      BTFW.init("feature:notification-sounds"),
      BTFW.init("feature:syncGuard"),
      BTFW.init("feature:chat-commands"),
      BTFW.init("feature:playlistPerformance"),
      BTFW.init("feature:playlist-tools"),
      BTFW.init("feature:local-subs"),
      BTFW.init("feature:emoji-loader"),
      BTFW.init("feature:billcast"),
      BTFW.init("feature:motd-editor"),
      BTFW.init("feature:videoEnhancements"),
      BTFW.init("feature:footer"),
      BTFW.init("feature:channelThemeAdmin"),
      BTFW.init("feature:themeSettings"),
      BTFW.init("feature:ratings")
    ];
    return Promise.all(inits);
  }).then(function(){
    console.log("[BTFW v3.4f] Ready.");
    // Dispatch a final ready event
    document.dispatchEvent(new CustomEvent('btfw:ready', {
      detail: { version: '3.4f', timestamp: Date.now() }
    }));
    BootOverlay.hide();
  })
  .catch(function(e){
    console.error("[BTFW v3.4f] boot failed:", e&&e.message||e);
    BootOverlay.fail((e&&e.message)||'Unknown error');
  });

})();