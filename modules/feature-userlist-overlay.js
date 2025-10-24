
BTFW.define("feature:userlistOverlay",["core","bridge"],async function(){
  var {ids}=BTFW.require("bridge");
  var isOpen=false, panel=null, stash=null;
  function ensurePanel(){
    if(panel && panel.parentNode) return panel;
    var chatCol = document.getElementById("btfw-chatcol") || document.body;
    panel = document.createElement("div"); panel.className="btfw-chat-overlay"; panel.style.display="none";
    panel.innerHTML = "<div class='btfw-chat-overlay-head'><span>Connected Users</span><button class='btfw-close'>&times;</button></div><div class='btfw-chat-overlay-body'></div>";
    panel.querySelector(".btfw-close").addEventListener("click", toggle);
    chatCol.appendChild(panel);
    return panel;
  }
  function open(){
    var map=ids();
    var p=ensurePanel();
    var body = p.querySelector(".btfw-chat-overlay-body");
    if (map.userList) {
      map.userList.style.display="";
      stash = map.userList.parentNode;
      body.appendChild(map.userList);
    } else {
      body.textContent = "No user list found.";
    }
    p.style.display="block"; isOpen=true;
  }
  function close(){
    var map=ids();
    if (map.userList && stash) {
      stash.appendChild(map.userList);
      map.userList.style.display="none";
      stash=null;
    }
    if(panel) panel.style.display="none"; isOpen=false;
  }
  function toggle(){ isOpen?close():open(); }
  var ul = ids().userList; if (ul) ul.style.display="none";
  window.BTFW_userlist = { open, close, toggle };
  return { open, close, toggle };
});
