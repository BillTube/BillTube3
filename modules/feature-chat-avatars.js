
BTFW.define("feature:chatAvatars", ["feature:chat"], async ({}) => {
  function unicodeCharAt(str, index) {
    const first = str.charCodeAt(index);
    if (first >= 0xD800 && first <= 0xDBFF && str.length > index + 1) {
      const second = str.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) return str.substring(index, index + 2);
    }
    return str[index];
  }
  function unicodeSlice(str, start, end) {
    let out="", si=0, ui=0;
    while (si < str.length) {
      const ch = unicodeCharAt(str, si);
      if (ui >= start && ui < end) out += ch;
      si += ch.length; ui++;
    }
    return out;
  }
  function svgAvatar(name, size=28){
    const colors=["#7C6CFF","#5F8AFF","#FF6FD8","#FF9F6E","#2ECC71","#27AE60","#3498DB","#2980B9","#E74C3C","#C0392B","#9B59B6","#8E44AD","#34495E","#2C3E50"];
    const letters = unicodeSlice(name||"?",0,2).toUpperCase();
    const ci = (letters.codePointAt(0)||0) % colors.length;
    const bg = colors[ci];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="8" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" font-family="Inter,system-ui,Arial" font-weight="700" font-size="${Math.floor(size*0.52)}">${letters}</text></svg>`;
    return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
  }
  function getProfileFromUserlist(username){
    const li = Array.from(document.querySelectorAll("#userlist .userlist_item, #userlist li")).find(el=>el.dataset?.name===username||el.textContent.trim()===username);
    const img = li && li.querySelector("img"); if (img) return img.src;
    try { const profile = li && li.dataset && li.dataset.profile && JSON.parse(li.dataset.profile); return profile&&profile.image||null; } catch(e){}
    return null;
  }
  function inject(node){
    if(!node||node._btfw_avatar) return;
    if (node.nodeType !== 1) return;
    const u = node.querySelector(".username,.nick,.name"); if(!u) return;
    const name=(u.textContent||"").replace(":","").trim(); if(!name) return;
    if(node.querySelector(".btfw-chat-avatar")) return;
    const img=document.createElement("img"); img.className="btfw-chat-avatar"; img.width=28; img.height=28;
    img.src = getProfileFromUserlist(name) || svgAvatar(name,28);
    u.parentElement && u.parentElement.insertBefore(img, u);
    node._btfw_avatar=true;
  }
  function observe(){
    const buf=document.getElementById("messagebuffer"); if(!buf||buf._btfw_avatar_observed) return; buf._btfw_avatar_observed=true;
    new MutationObserver(m=>m.forEach(r=>r.addedNodes&&r.addedNodes.forEach(inject))).observe(buf,{childList:true});
    Array.from(buf.children).forEach(inject);
  }
  document.addEventListener("btfw:layoutReady", observe); setTimeout(observe, 1200);
  return { name:"feature:chatAvatars" };
});
