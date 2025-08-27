
BTFW.define("bridge",["core"],async function(){function $(s,r){return (r||document).querySelector(s);}
  function ids(){return{
    nav: $("nav.navbar")||document.querySelector("#nav-collapsible")?.closest("nav"),
    player: $("#ytapiplayer"),
    videowrap: $("#videowrap"),
    chatwrap: $("#chatwrap"),
    messageBuffer: $("#messagebuffer"),
    userList: $("#userlist"),
    userCount: $("#usercount"),
    queue: $("#queue"),
    plmeta: $("#plmeta"),
    ploptions: $("#ploptions"),
    mainpage: $("#mainpage"),
    rightpane: $("#rightpane"),
    pollwrap: $("#pollwrap")
  };}
  return {ids};
});
