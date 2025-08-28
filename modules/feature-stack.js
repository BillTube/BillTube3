
BTFW.define("feature:stack", ["feature:layout"], async ({}) => {
  const SKEY="btfw-stack-order";
  const DEFAULT_SELECTORS=[
    "#btfw-channels",
    "#mainpage", "#mainpane", "#main", "#motdrow", "#motd", "#announcements", "#pollwrap",
    "#playlistrow", "#playlistwrap", "#queuecontainer", "#queue"
  ];

  function ensureStack(){
    const left=document.getElementById("btfw-leftpad"); if(!left) return null;
    let stack=document.getElementById("btfw-stack");
    if(!stack){ stack=document.createElement("div"); stack.id="btfw-stack"; stack.className="btfw-stack";
      const v=document.getElementById("videowrap"); if(v&&v.nextSibling) v.parentNode.insertBefore(stack, v.nextSibling); else left.appendChild(stack);
      const hdr=document.createElement("div"); hdr.className="btfw-stack-header"; hdr.innerHTML='<div class="btfw-stack-title">Page Modules</div>'; stack.appendChild(hdr);
      const list=document.createElement("div"); list.className="btfw-stack-list"; stack.appendChild(list);
      const footer=document.createElement("div"); footer.id="btfw-stack-footer"; footer.className="btfw-stack-footer"; stack.appendChild(footer);
    }
    return { list: stack.querySelector(".btfw-stack-list"), footer: stack.querySelector("#btfw-stack-footer") };
  }

  function normalizeId(el){ if(!el) return null; if(!el.id) el.id="stackitem-"+Math.random().toString(36).slice(2,7); return el.id; }
  function titleOf(el){ return el.getAttribute("data-title")||el.getAttribute("title")||el.id; }
  function itemFor(el){
    const w=document.createElement("section"); w.className="btfw-stack-item"; w.dataset.bind=normalizeId(el);
    w.innerHTML='<header class="btfw-stack-item__header"><span class="btfw-stack-item__title">'+titleOf(el)+'</span><span class="btfw-stack-arrows"><button class="btfw-arrow btfw-up">↑</button><button class="btfw-arrow btfw-down">↓</button></span></header><div class="btfw-stack-item__body"></div>';
    w.querySelector(".btfw-stack-item__body").appendChild(el);
    w.querySelector(".btfw-up").onclick=function(){ const p=w.parentElement; const prev=w.previousElementSibling; if(prev) p.insertBefore(w, prev); save(p); };
    w.querySelector(".btfw-down").onclick=function(){ const p=w.parentElement; const next=w.nextElementSibling; if(next) p.insertBefore(next, w); else p.appendChild(w); save(p); };
    return w;
  }
  function save(list){ try{ localStorage.setItem(SKEY, JSON.stringify(Array.from(list.children).map(n=>n.dataset.bind))); }catch(e){} }
  function load(){ try{ return JSON.parse(localStorage.getItem(SKEY)||"[]"); }catch(e){ return []; } }
  function attachFooter(footer){ const real=document.getElementById("footer")||document.querySelector("footer"); if(real && !footer.contains(real)){ real.classList.add("btfw-footer"); footer.appendChild(real); } }

  function populate(refs){
    const list=refs.list, footer=refs.footer;
    const found=[]; DEFAULT_SELECTORS.forEach(sel=>{ const el=document.querySelector(sel); if(el && !list.contains(el)) found.push(el); });
    const byId=new Map(found.map(el=>[normalizeId(el), el]));
    let order=load();
    if(!order.length){ order=Array.from(byId.keys()); }
    order.forEach(id=>{ const el=byId.get(id); if(!el) return; let item=Array.from(list.children).find(n=>n.dataset.bind===id); if(!item){ item=itemFor(el); list.appendChild(item);} byId.delete(id); });
    Array.from(byId.values()).forEach(el=>list.appendChild(itemFor(el)));
    save(list); attachFooter(footer);
  }

  function boot(){
    const refs=ensureStack(); if(!refs) return;
    populate(refs);
    // Watch for late DOM
    const obs=new MutationObserver(()=>populate(refs)); obs.observe(document.body,{childList:true,subtree:true});
    // Also retry a few times for late widgets
    let n=0; const iv=setInterval(()=>{ populate(refs); if(++n>8) clearInterval(iv); }, 700);
  }
  document.addEventListener("btfw:layoutReady", boot);
  setTimeout(boot, 1200);
  return {name:"feature:stack"};
});
