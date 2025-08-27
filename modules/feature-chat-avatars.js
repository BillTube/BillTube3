
BTFW.define("feature:chatAvatars", ["feature:chat"], async ({ require }) => {
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
    const colors=["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22","#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad","#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad","#f69785","#9ba37e","#b49255","#a94136"];
    const letters = unicodeSlice(name||"?",0,2).toUpperCase();
    const ci = (letters.codePointAt(0)||0) % colors.length;
    const bg = colors[ci];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="6" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" font-family="Inter,system-ui,Arial" font-weight="600" font-size="${Math.floor(size*0.5)}">${letters}</text></svg>`;
    return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
  }
  function getProfileFromUserlist(username){
    const li = Array.from(document.querySelectorAll("#userlist .userlist_item")).find(el=>el.dataset.name===username||el.textContent.trim()===username);
    const img = li && li.querySelector("img"); if (img) return img.src;
    const profile = li && li.dataset.profile && JSON.parse(li.dataset.profile); return profile&&profile.image||null;
  }
  function inject(node){
    if(!node||node._btfw_avatar) return;
    const u=node.querySelector(".username"); if(!u) return;
    const name=u.textContent.replace(":","").trim(); if(!name) return;
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
