
/* bridge-cytube.js — DOM/ID mapping to CyTube elements */
BTFW.define("bridge", ["core"], async function(ctx){
  var { $, $$ } = BTFW.require("core");

  function ids(){
    return {
      player:        $("#ytapiplayer"),
      playerWrap:    $("#videowrap"),
      videoWrap:     $("#videowrap"),
      chatWrap:      $("#chatwrap"),
      messageBuffer: $("#messagebuffer"),
      userList:      $("#userlist"),
      userCount:     $("#usercount"),
      playlist:      $("#queue"),
      plMeta:        $("#plmeta"),
      plOptions:     $("#ploptions"),
      currentTitle:  $("#currenttitle"),
      navCollapsible:$("#nav-collapsible"),
      rightPane:     $("#rightpane"),
      rightPaneInner:$("#rightpane-inner"),
      headRight:     $("#headright"),
      pollWrap:      $("#pollwrap"),
      mainPage:      $("#mainpage"),
      footer:        $("#footer")
    };
  }

  function ensure(el, msg){ if(!el) throw new Error("Missing DOM element: "+msg); return el; }

  return { ids, ensure };
});
