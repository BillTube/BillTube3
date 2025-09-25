/*! BillTube Framework - Modern CyTube Theme System */
(function(){
  "use strict";

  const VERSION = "3.0.0";
  const BASE = (function(){
    const scripts = document.querySelectorAll("script[src*='billtube-fw']");
    const src = scripts[scripts.length-1]?.src || "";
    const match = src.match(/^(.+\/)billtube-fw(?:\.min)?\.js/);
    return match ? match[1].replace(/\/$/, "") : "";
  })();

  // Global framework object
  window.BTFW = {
    version: VERSION,
    base: BASE,
    modules: new Map(),
    dependencies: new Map(),
    ready: new Set(),
    
    define(name, deps, factory) {
      if (typeof deps === "function") {
        factory = deps;
        deps = [];
      }
      this.dependencies.set(name, { deps: deps || [], factory });
      this.tryResolve(name);
    },

    async tryResolve(name) {
      const def = this.dependencies.get(name);
      if (!def || this.modules.has(name)) return;
      
      const depModules = {};
      let allReady = true;
      
      for (const dep of def.deps) {
        if (this.modules.has(dep)) {
          depModules[dep] = this.modules.get(dep);
        } else {
          allReady = false;
          break;
        }
      }
      
      if (allReady) {
        try {
          const module = await def.factory(depModules);
          this.modules.set(name, module);
          this.ready.add(name);
          
          // Try to resolve dependent modules
          for (const [depName, depDef] of this.dependencies) {
            if (!this.modules.has(depName) && depDef.deps.includes(name)) {
              await this.tryResolve(depName);
            }
          }
        } catch (err) {
          console.error(`[BTFW] Failed to resolve module ${name}:`, err);
        }
      }
    },

    async init(moduleNames) {
      const promises = moduleNames.map(name => this.waitFor(name));
      return Promise.all(promises);
    },

    async waitFor(name) {
      if (this.modules.has(name)) return this.modules.get(name);
      
      return new Promise((resolve, reject) => {
        const check = () => {
          if (this.modules.has(name)) {
            resolve(this.modules.get(name));
          } else {
            setTimeout(check, 50);
          }
        };
        check();
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (!this.modules.has(name)) {
            reject(new Error(`Module ${name} failed to load within timeout`));
          }
        }, 30000);
      });
    }
  };

  // Utility functions
  function preload(url){
    return new Promise((resolve, reject) => {
      if (!url) { resolve(); return; }
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "style";
      link.href = url; // Use the full URL as passed, don't prepend BASE
      link.onload = resolve;
      link.onerror = () => {
        console.warn(`[BTFW] Failed to preload ${url}, continuing anyway`);
        resolve(); // Don't fail the entire init for missing CSS
      };
      document.head.appendChild(link);
    });
  }

  function load(url){
    return new Promise((resolve, reject) => {
      if (!url) { resolve(); return; }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Detect environment
  function detectEnvironment(){
    const isCytube = !!(window.CLIENT || window.socket || document.querySelector("#cytube-layout, #mainpage"));
    const hasJQuery = typeof $ !== "undefined";
    const hasVideoJS = typeof videojs !== "undefined";
    
    return {
      platform: isCytube ? "cytube" : "unknown",
      jquery: hasJQuery,
      videojs: hasVideoJS,
      mobile: window.innerWidth <= 768
    };
  }

  // Initialize framework
  function bootstrap(){
    const env = detectEnvironment();
    
    console.log(`[BTFW] Initializing v${VERSION} on ${env.platform}`);
    
    if (env.platform !== "cytube") {
      console.warn("[BTFW] Not running on CyTube, some features may not work");
    }

    // Set global theme attribute
    document.documentElement.setAttribute("data-btfw-framework", VERSION);
    
    // Load all module files in parallel (skip CSS preloading for now)
    var mods = [
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
      console.log(`[BTFW] Framework v${VERSION} fully initialized`);
      document.documentElement.setAttribute("data-btfw-ready", "true");
      
      // Dispatch ready event
      document.dispatchEvent(new CustomEvent("btfw:ready", {
        detail: { version: VERSION, modules: Array.from(BTFW.ready) }
      }));
      
      // Apply any pending configurations
      if (window.BTFW_THEME_ADMIN) {
        setTimeout(() => {
          const cfg = window.BTFW_THEME_ADMIN;
          if (cfg && typeof cfg === "object") {
            window.BTFW.channelTheme = cfg;
            console.log("[BTFW] Applied channel theme configuration");
          }
        }, 100);
      }
      
    }).catch(function(err){
      console.error("[BTFW] Framework initialization failed:", err);
      document.documentElement.setAttribute("data-btfw-error", "true");
    });
  }

  // Wait for DOM and start bootstrap
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Export for debugging
  window.BTFW_DEBUG = {
    version: VERSION,
    base: BASE,
    modules: () => Array.from(BTFW.modules.keys()),
    ready: () => Array.from(BTFW.ready),
    dependencies: () => Array.from(BTFW.dependencies.keys())
  };

})();