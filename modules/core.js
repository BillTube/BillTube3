
BTFW.define("core",[],async function(){
  var L=Object.create(null);
  function on(e,f){(L[e]||(L[e]=[])).push(f);return()=>off(e,f);}
  function off(e,f){var a=L[e]||[];var i=a.indexOf(f);if(i>=0)a.splice(i,1);}
  function emit(e,d){(L[e]||[]).slice().forEach(fn=>{try{fn(d);}catch(err){console.error(err);}});}
  function $(s,r){return (r||document).querySelector(s);} function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function load(k,def){try{var v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}}
  function boot(){ try{ if(window.socket&&window.socket.on){["changeMedia","usercount","chatMsg","queue"].forEach(function(ev){window.socket.on(ev,function(p){emit(ev,p);});});} document.addEventListener("changeMedia",function(e){emit("changeMedia",e.detail||null);}); }catch(e){} }
  return {on,off,emit,$,$$,save,load,boot};
});
