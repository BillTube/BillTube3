
BTFW.define("feature:playlistSearch",["core","bridge"],async function(){
  function debounce(f,ms){var t=null;return function(){clearTimeout(t);var a=arguments;t=setTimeout(function(){f.apply(null,a);},ms);}}
  function boot(){
    var container=document.getElementById("queuecontainer"); var queue=document.getElementById("queue");
    if(!queue){ return; }
    if(!container){ container=document.createElement("div"); container.id="queuecontainer"; container.className="section"; queue.parentNode.insertBefore(container,queue); container.appendChild(queue); }
    if(!container.querySelector(".btfw-pl-search")){
      var wrap=document.createElement("div"); wrap.className="btfw-pl-search-wrap"; wrap.innerHTML="<input type='text' class='btfw-pl-search' placeholder='Search playlist'>"; container.insertBefore(wrap,container.firstChild);
      var input=wrap.querySelector("input"); input.addEventListener("keyup",debounce(function(){ var term=input.value.trim().toLowerCase(); var items=queue.children; for(var i=0;i<items.length;i++){ var it=items[i]; var match=it.textContent.toLowerCase().indexOf(term)>=0; it.style.display=match?"":"none"; } },150));
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
  return {};
});
