
/* core.js — event bus, scheduler, utilities */
BTFW.define("core", [], async function(ctx){
  var listeners = Object.create(null);
  function on(ev, fn){ (listeners[ev]||(listeners[ev]=[])).push(fn); return () => off(ev, fn); }
  function off(ev, fn){ var a=listeners[ev]||[]; var i=a.indexOf(fn); if(i>=0) a.splice(i,1); }
  function emit(ev, detail){ (listeners[ev]||[]).slice().forEach(fn=>{ try{ fn(detail); }catch(e){ console.error(e); } }); }
  function postTask(cb, priority){ if(window.scheduler && window.scheduler.postTask){ return scheduler.postTask(cb, {priority: priority||"user-visible"}); } return Promise.resolve().then(cb); }

  var $ = function(sel, root){ return (root||document).querySelector(sel); };
  var $$ = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };

  try {
    if (location.protocol !== "https:" && location.host.match(/cytu\.be$/)) {
      location.replace("https:" + location.href.substring(location.protocol.length));
    }
  } catch(e){}

  var api = { on, off, emit, postTask, $, $$, boot };

  function boot(){
    try{
      if (window.socket && typeof window.socket.on === "function") {
        ["changeMedia", "usercount", "chatMsg", "queue"].forEach(function(ev){
          window.socket.on(ev, function(payload){ emit(ev, payload); });
        });
      }
      document.addEventListener("changeMedia", function(e){ emit("changeMedia", e.detail || null); });
    } catch(e){ console.warn("[BTFW] socket bridge issue", e); }
  }

  return api;
});
