BTFW.define("feature:chatAvatars", ["core"], async function({ require }){
  const core = require("core");

  // Palette + utilities
  const COLORS = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22","#d35400",
                  "#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad","#0080a5",
                  "#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad","#f69785",
                  "#9ba37e","#b49255","#a94136"];

  function initials(name){
    const t = String(name||"").trim();
    if (!t) return "?";
    const parts = t.split(/\s+/);
    return ( (parts[0][0]||"") + (parts[1]?.[0]||"") ).toUpperCase();
  }

  function svgDataURI(text, size){
    const seed = text.charCodeAt(0) || 0;
    const color = COLORS[ seed % COLORS.length ];
    const s = size || 32;
    const svg = (
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'">'+
      '<rect width="100%" height="100%" rx="'+Math.round(s*0.25)+'" fill="'+color+'"/>'+
      '<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Inter,system-ui,Helvetica,Arial"'+
      ' font-weight="700" font-size="'+Math.round(s*0.45)+'" fill="#fff">'+
      text.toUpperCase()+'</text></svg>'
    );
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  // Persistent custom map (optional)
  const MAP_KEY = "btfw.avatars";
  function mapLoad(){ try{ return JSON.parse(localStorage.getItem(MAP_KEY)||"{}"); }catch(e){ return {}; } }
  function mapSave(obj){ try{ localStorage.setItem(MAP_KEY, JSON.stringify(obj||{})); }catch(e){} }

  function fromMap(name){
    const map = mapLoad();
    return map[name];
  }

  function fromDOMUserlist(name){
    // Best effort: try to grab an <img> near their name in #userlist (if some plugin already sets it)
    const lis = Array.from(document.querySelectorAll("#userlist li, #userlist .userlist_item"));
    const li = lis.find(el => (el.textContent||"").trim().toLowerCase().startsWith(String(name||"").toLowerCase()));
    const img = li && li.querySelector("img");
    return (img && img.src) || null;
  }

  function resolve(name, size){
    // 1) explicit global map
    if (window.BTFW_AVATARS && window.BTFW_AVATARS[name]) return window.BTFW_AVATARS[name];
    // 2) localStorage map
    const m = fromMap(name); if (m) return m;
    // 3) try DOM/userlist
    const d = fromDOMUserlist(name); if (d) return d;
    // 4) fallback to generated initials
    return svgDataURI(initials(name), size||32);
  }

  function ensureForNode(node){
    if(!document.body.classList.contains("btfw-chat-avatars")) return;
    if(!node || node.nodeType !== 1) return;
    if(node.querySelector(".btfw-avatar")) return;

    const u = node.querySelector(".username");
    if(!u) return;
    const name = (u.textContent||"").replace(":","").trim();
    if(!name) return;

    const img = document.createElement("img");
    img.className = "btfw-avatar";
    img.alt = name;
    img.src = resolve(name, 22);
    node.insertBefore(img, node.firstChild);
  }

  function scan(){
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    Array.prototype.forEach.call(buf.children, ensureForNode);
  }

  function boot(){
    scan();
    const buf = document.getElementById("messagebuffer");
    if (!buf) return;
    const mo = new MutationObserver(muts => muts.forEach(m => m.addedNodes && m.addedNodes.forEach(ensureForNode)));
    mo.observe(buf, { childList:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  core.on("settings:changed", kv => { if (kv.key === "chat.avatars") scan(); });

  // expose resolver for header avatar
  window.BTFW_avatars = {
    resolve,
    set(name, url){ const map = mapLoad(); map[name]=url; mapSave(map); },
    clear(name){ const map = mapLoad(); delete map[name]; mapSave(map); },
    _svg: svgDataURI
  };

  return {};
});
