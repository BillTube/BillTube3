
BTFW.define("feature:gifs", ["feature:chat"], async ({ require }) => {
  const GIPHY_KEY = "bb2006d9d3454578be1a99cfad65913d";
  const TENOR_KEY = "5WPAZ4EXST2V";

  function ensureModal(){
    if (document.getElementById("btfw-gif-modal")) return;
    const m=document.createElement("div"); m.id="btfw-gif-modal"; m.className="btfw-modal hidden";
    m.innerHTML=`
      <div class="btfw-modal__backdrop"></div>
      <div class="btfw-modal__card">
        <div class="btfw-modal__header">
          <div class="tabs">
            <button class="tab active" data-tab="giphy">Giphy</button>
            <button class="tab" data-tab="tenor">Tenor</button>
          </div>
          <button class="btfw-close" title="Close">&times;</button>
        </div>
        <div class="btfw-modal__toolbar" style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08)">
          <input id="btfw-gif-q" placeholder="Search GIFs…" style="flex:1 1 auto;min-width:0">
          <button id="btfw-gif-search" class="btfw-ghost">Search</button>
          <button id="btfw-gif-trending" class="btfw-ghost">Trending</button>
        </div>
        <div class="btfw-modal__body">
          <div class="pane" data-pane="giphy"></div>
          <div class="pane hidden" data-pane="tenor"></div>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector(".btfw-close").onclick=hide;
    m.querySelector(".btfw-modal__backdrop").onclick=hide;
    m.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
    m.querySelector("#btfw-gif-search").onclick=()=>perform(false);
    m.querySelector("#btfw-gif-trending").onclick=()=>perform(true);
  }
  function switchTab(tab){
    document.querySelectorAll("#btfw-gif-modal .tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    document.querySelectorAll("#btfw-gif-modal .pane").forEach(p=>p.classList.toggle("hidden", p.dataset.pane!==tab));
  }
  function show(){ ensureModal(); document.getElementById("btfw-gif-modal").classList.remove("hidden"); }
  function hide(){ const m=document.getElementById("btfw-gif-modal"); if(m) m.classList.add("hidden"); }
  function trimGif(u){ return (u||"").split("?")[0]; }
  function insertText(text){
    if (window.insertText) return window.insertText(text);
    const line=document.getElementById("chatline"); if(!line) return;
    const start=line.selectionStart||line.value.length; const end=line.selectionEnd||line.value.length;
    line.value = line.value.slice(0,start) + text + line.value.slice(end);
    line.focus(); line.setSelectionRange(start+text.length, start+text.length);
  }
  async function perform(trending){
    ensureModal();
    const q=document.getElementById("btfw-gif-q").value.trim();
    const active=document.querySelector("#btfw-gif-modal .tab.active").dataset.tab;
    const pane=document.querySelector(`#btfw-gif-modal .pane[data-pane="${active}"]`);
    pane.innerHTML="<div class='btfw-grid-9'>Loading…</div>";
    try{
      if(active==="giphy"){
        const base="https://api.giphy.com/v1/gifs/";
        const ep= trending? "trending?limit=50" : ("search?q="+encodeURIComponent(q||"funny")+"&limit=50");
        const res=await fetch(base+ep+"&api_key="+GIPHY_KEY, {mode:"cors"});
        const data=await res.json();
        const list=(data.data||[]).map(d=>trimGif(d.images?.downsized?.url||d.images?.original?.url));
        render(list, pane);
      }else{
        const base="https://api.tenor.com/v1/";
        const url= trending? (base+"trending?key="+TENOR_KEY+"&limit=50") : (base+"search?key="+TENOR_KEY+"&q="+encodeURIComponent(q||"funny")+"&limit=50");
        const res=await fetch(url, {mode:"cors"});
        const data=await res.json();
        const list=(data.results||[]).map(r=>trimGif(r.media?.[0]?.gif?.url));
        render(list, pane);
      }
    }catch(e){
      console.error("GIF fetch failed", e);
      pane.innerHTML="<div style='padding:12px'>Failed to load GIFs. Check network console for details.</div>";
    }
  }
  function render(urls, pane){
    const g=document.createElement("div"); g.className="btfw-grid-9";
    (urls||[]).filter(Boolean).slice(0,50).forEach(u=>{
      const b=document.createElement("button"); b.className="btfw-gif-item"; b.innerHTML=`<img loading="lazy" src="${u}">`;
      b.onclick=()=>{ insertText(u+" "); hide(); };
      g.appendChild(b);
    });
    pane.innerHTML=""; pane.appendChild(g);
  }
  document.addEventListener("btfw:openGifs", show);
  window.BTFW_Gifs = { open: show };
  return { name:"feature:gifs" };
});
