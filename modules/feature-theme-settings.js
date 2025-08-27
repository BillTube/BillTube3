
BTFW.define("feature:themeSettings",["core","feature:overlays"],async function(){
  var {getSetting,setSetting}=BTFW.require("core");
  function open(tab){
    var wrap = BTFW_overlays.openModal({content: "<div class='btfw-settings'></div>"});
    var root = wrap.body.querySelector(".btfw-settings");
    root.innerHTML = [
      "<h2>BillTube Theme Settings</h2>",
      "<label><input type='checkbox' id='opt-avatars'/> Show chat avatars</label>",
      "<label><input type='checkbox' id='opt-compact'/> Compact chat</label>",
      "<label><input type='checkbox' id='opt-timestamps'/> Show timestamps</label>",
      "<div class='row'>",
      "<button id='opt-left' class='btfw-btn'>Chat on Left</button>",
      "<button id='opt-right' class='btfw-btn'>Chat on Right</button>",
      "<button id='opt-reset' class='btfw-btn'>Reset Layout</button>",
      "</div>"
    ].join("");
    var avatars = root.querySelector("#opt-avatars");
    var compact = root.querySelector("#opt-compact");
    var stamps  = root.querySelector("#opt-timestamps");
    avatars.checked = !!getSetting("chat.avatars", true);
    compact.checked = !!getSetting("chat.compact", false);
    stamps.checked  = !!getSetting("chat.timestamps", true);
    avatars.addEventListener("change", function(){ setSetting("chat.avatars", !!this.checked); document.body.classList.toggle("btfw-chat-avatars", !!this.checked); });
    compact.addEventListener("change", function(){ setSetting("chat.compact", !!this.checked); document.body.classList.toggle("btfw-chat-compact", !!this.checked); });
    stamps.addEventListener("change", function(){ setSetting("chat.timestamps", !!this.checked); document.body.classList.toggle("btfw-chat-stamps", !!this.checked); });
    root.querySelector("#opt-left").addEventListener("click", function(){ localStorage.setItem("btfw.chat.side", JSON.stringify("left")); document.body.classList.add("btfw-chat-left"); });
    root.querySelector("#opt-right").addEventListener("click", function(){ localStorage.setItem("btfw.chat.side", JSON.stringify("right")); document.body.classList.remove("btfw-chat-left"); });
    root.querySelector("#opt-reset").addEventListener("click", function(){ localStorage.removeItem("btfw.chat.width"); localStorage.removeItem("btfw.chat.side"); localStorage.removeItem("btfw.video.ar"); location.reload(); });
  }
  window.BTFW_themeSettings = { open };
  if (getSetting("chat.avatars", true)) document.body.classList.add("btfw-chat-avatars");
  if (getSetting("chat.compact", false)) document.body.classList.add("btfw-chat-compact");
  if (getSetting("chat.timestamps", true)) document.body.classList.add("btfw-chat-stamps");
  return { open };
});
