/* BTFW — feature:chat-ignore
   - Saved mute list (localStorage)
   - Adds "Mute/Unmute" action on userlist entries
   - Hides future (and optionally past) messages from muted users
*/
BTFW.define("feature:chat-ignore", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const LS = "btfw:chat:ignore"; // JSON array of names (case-insensitive store)

  function loadSet(){
    try {
      const raw = localStorage.getItem(LS);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(arr.map(v=>String(v).toLowerCase()));
    } catch(_) { return new Set(); }
  }
  function saveSet(set){
    try { localStorage.setItem(LS, JSON.stringify(Array.from(set))); } catch(_){}
  }

  let IG = loadSet();

  function has(name){ return IG.has((name||"").toLowerCase()); }
  function add(name){ if (!name) return; IG.add(name.toLowerCase()); saveSet(IG); markUserlist(name,true); }
  function remove(name){ if (!name) return; IG.delete(name.toLowerCase()); saveSet(IG); markUserlist(name,false); }
  function toggle(name){ has(name) ? remove(name) : add(name); }

  function userFromMsg(el){
    const u = el.querySelector(".username");
    if (!u) return "";
    return (u.textContent||"").trim().replace(/:\s*$/,"");
  }

  function processNewMessage(el){
    const name = userFromMsg(el);
    if (name && has(name)) {
      el.style.display = "none";
    }
  }

  function rescanBuffer(){
    const buf = $("#messagebuffer"); if (!buf) return;
    Array.from(buf.children).forEach(processNewMessage);
  }

  function markUserlist(name, muted){
    const li = document.querySelector(`#userlist li[data-name="${CSS.escape(name)}"]`) || null;
    (li||{}).classList?.toggle("btfw-muted", !!muted);
  }

  function wireUserlistActions(){
    const ul = $("#userlist"); if (!ul || ul._btfwIgnoreWired) return;
    ul._btfwIgnoreWired = true;

    const decorate = (root)=>{
      const items = root.querySelectorAll("li");
      items.forEach(li=>{
        if (li._btfwMuteChip) return;
        li._btfwMuteChip = true;
        const name = li.getAttribute("data-name") || (li.textContent||"").trim();
        if (!name) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "btfw-mute-chip";
        chip.textContent = has(name) ? "Unmute" : "Mute";
        chip.addEventListener("click", (e)=>{
          e.preventDefault(); e.stopPropagation();
          toggle(name);
          chip.textContent = has(name) ? "Unmute" : "Mute";
          rescanBuffer();
        });
        li.appendChild(chip);
        li.classList.toggle("btfw-muted", has(name));
      });
    };

    decorate(ul);

    const mo = new MutationObserver(muts=>{
      muts.forEach(m=>{
        if (m.addedNodes) m.addedNodes.forEach(n=>{ if (n.nodeType===1) decorate(n); });
      });
    });
    mo.observe(ul, { childList:true, subtree:true });
  }

  function boot(){
    rescanBuffer();
    const buf = $("#messagebuffer");
    if (buf && !buf._btfwIgnoreMO){
      const mo = new MutationObserver(muts=>{
        muts.forEach(m=>{
          if (m.addedNodes) m.addedNodes.forEach(n=>{ if (n.nodeType===1) processNewMessage(n); });
        });
      });
      mo.observe(buf, { childList:true, subtree:false });
      buf._btfwIgnoreMO = mo;
    }
    wireUserlistActions();
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    name:"feature:chat-ignore",
    has, add, remove, toggle,
    list: ()=>Array.from(IG)
  };
});
