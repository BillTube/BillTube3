
BTFW.define("feature:motd-editor", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const QUILL_CSS = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  const QUILL_JS  = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";

  function loadOnce(href, rel="stylesheet"){
    return new Promise((res,rej)=>{
      if (rel === "stylesheet" && $$(`link[href="${href}"]`).length) return res();
      if (rel === "script" && $$(`script[src="${href}"]`).length) return res();
      const el = document.createElement(rel==="script"?"script":"link");
      if (rel==="script") { el.src = href; el.async = true; el.onload = res; el.onerror = rej; }
      else { el.rel="stylesheet"; el.href = href; el.onload = res; el.onerror = rej; }
      document.head.appendChild(el);
    });
  }

  function canEditMotd(){
    try {
      if (typeof window.hasPermission === "function") {
        if (window.hasPermission("motdedit") || window.hasPermission("editMotd") || window.hasPermission("motd")) {
          return true;
        }
      }
      const client = window.CLIENT || null;
      if (client?.hasPermission) {
        if (client.hasPermission("motdedit") || client.hasPermission("editMotd") || client.hasPermission("motd")) {
          return true;
        }
      }
      if (client && typeof client.rank !== "undefined") {
        const rank = client.rank|0;
        const ranks = window.RANK || window.Ranks || {};
        const thresholds = [ranks.moderator, ranks.mod, ranks.admin, ranks.administrator];
        const needed = thresholds.find(v => typeof v === "number");
        if (typeof needed === "number") return rank >= needed;
        return rank >= 2;
      }
    } catch(_) {}
    return false;
  }

  function getMotdContent(){
    const csMotd = $("#cs-motdtext");
    if (csMotd && csMotd.value && csMotd.value.trim()) {
      console.log('[motd-editor] Content from #cs-motdtext:', csMotd.value.length);
      return csMotd.value;
    }
    
    const motdDisplay = $("#motd");
    if (motdDisplay && motdDisplay.innerHTML && motdDisplay.innerHTML.trim()) {
      console.log('[motd-editor] Content from #motd:', motdDisplay.innerHTML.length);
      return motdDisplay.innerHTML;
    }
    
    const motdWrap = $("#motdwrap");
    if (motdWrap && motdWrap.innerHTML && motdWrap.innerHTML.trim()) {
      console.log('[motd-editor] Content from #motdwrap:', motdWrap.innerHTML.length);
      return motdWrap.innerHTML;
    }
    
    console.log('[motd-editor] No MOTD content found');
    return "";
  }

  function buildModal(){
    const existing = $("#btfw-motd-modal");
    if (existing) existing.remove();
    
    const m = document.createElement("div");
    m.id = "btfw-motd-modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal">
        <header class="modal-card-head">
          <p class="modal-card-title">Edit MOTD</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div id="btfw-motd-editor" style="height:320px;"></div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-motd-save">Save</button>
          <button class="button" id="btfw-motd-cancel">Cancel</button>
        </footer>
      </div>`;
    document.body.appendChild(m);
    
    $(".modal-background", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    $(".delete", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    $("#btfw-motd-cancel", m).addEventListener("click", ()=> m.classList.remove("is-active"));
    
    return m;
  }

  let quill = null;
  
  async function openEditor(){
    if (quill) {
      try { quill.disable(); } catch(_){}
      quill = null;
    }
    
    const initialHTML = getMotdContent();
    const m = buildModal();
    
    try { 
      await loadOnce(QUILL_CSS, "stylesheet"); 
      await loadOnce(QUILL_JS, "script"); 
    } catch(e){ 
      console.warn("[motd-editor] Quill load failed", e); 
      const host = $("#btfw-motd-editor", m);
      if (host) {
        host.innerHTML = `<textarea class="textarea" style="height:100%; font-family:monospace;">${initialHTML}</textarea>`;
      }
      m.classList.add("is-active");
      return;
    }
    
    const host = $("#btfw-motd-editor", m);
    if (!host) {
      console.error('[motd-editor] Editor host not found');
      return;
    }

    if (window.Quill) {
      quill = new Quill(host, {
        theme: "snow",
        modules: { 
          toolbar: [ 
            ["bold","italic","underline","strike"], 
            ["link","blockquote","code-block"], 
            [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
            [{ 'header': [1,2,3,false] }], 
            [{ 'align': [] }], 
            ["clean"] 
          ] 
        }
      });
      
      // ✅ FIX: Use Quill's clipboard API to properly parse HTML
      if (initialHTML && initialHTML.trim()) {
        try {
          // Method 1: dangerouslyPasteHTML (keeps most formatting)
          quill.clipboard.dangerouslyPasteHTML(initialHTML);
          console.log('[motd-editor] Content loaded via clipboard API');
        } catch(e) {
          console.warn('[motd-editor] Clipboard paste failed, trying delta conversion', e);
          // Method 2: Convert to Delta format
          try {
            const delta = quill.clipboard.convert(initialHTML);
            quill.setContents(delta);
            console.log('[motd-editor] Content loaded via delta conversion');
          } catch(e2) {
            console.error('[motd-editor] Both methods failed', e2);
            // Last resort: plain text
            quill.setText(initialHTML);
          }
        }
      }
      
      console.log('[motd-editor] Quill editor ready, content loaded');
    } else {
      host.innerHTML = `<div id="btfw-motd-fallback" contenteditable="true" class="box" style="height:100%; overflow:auto;">${initialHTML}</div>`;
    }

    const saveBtn = $("#btfw-motd-save", m);
    if (saveBtn) {
      saveBtn.onclick = ()=>{
        const html = quill ? quill.root.innerHTML : $("#btfw-motd-fallback")?.innerHTML || "";
        
        console.log('[motd-editor] Saving MOTD, length:', html.length);
        
        try {
          if (window.socket?.emit) {
            socket.emit("setMotd", { motd: html });
            console.log('[motd-editor] Emitted setMotd to server');
          }
        } catch(e){ 
          console.warn("[motd-editor] setMotd emit failed", e); 
        }
        
        const motdDisplay = $("#motd"); 
        if (motdDisplay) motdDisplay.innerHTML = html;
        
        const csMotd = $("#cs-motdtext");
        if (csMotd) csMotd.value = html;
        
        m.classList.remove("is-active");
      };
    }

    m.classList.add("is-active");
  }

  function injectButton(){
    const existingBtn = document.getElementById("btfw-motd-editbtn");
    const existingRow = existingBtn ? existingBtn.closest(".btfw-motd-editrow") : null;

    if (!canEditMotd()) {
      if (existingRow) existingRow.remove();
      return;
    }

    const motdWrap = $("#motdwrap") || $("#motd")?.closest(".well") || $("#btfw-leftpad");
    const host = motdWrap?.parentNode;
    if (!motdWrap || !host) return;

    let row = existingRow;
    if (!row) {
      row = document.createElement("div");
      row.innerHTML = `<button id="btfw-motd-editbtn" class="button is-small is-link"><i class="fa fa-pencil"></i> Edit MOTD</button>`;
    }

    row.classList.add("buttons", "is-right", "btfw-motd-editrow");

    if (!row.querySelector("#btfw-motd-editbtn")) {
      const btn = document.createElement("button");
      btn.id = "btfw-motd-editbtn";
      btn.className = "button is-small is-link";
      btn.innerHTML = `<i class="fa fa-pencil"></i> Edit MOTD`;
      row.appendChild(btn);
    }

    if (row.parentNode !== host || row.previousElementSibling !== motdWrap) {
      host.insertBefore(row, motdWrap.nextSibling);
    }

    const btn = row.querySelector("#btfw-motd-editbtn");
    if (btn && !btn._btfwMotdBound) {
      btn._btfwMotdBound = true;
      btn.addEventListener("click", openEditor);
    }
  }

  function boot(){
    injectButton();
    const mo = new MutationObserver(()=> injectButton());
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:motd-editor", openEditor };
});
