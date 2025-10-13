/* BTFW — feature:motd-editor
   Replaces the default MOTD edit with a Bulma modal + Quill editor (lazy-loaded).
   Saves via socket.emit("setMotd", { motd: "<html>" }) with graceful fallback.
*/
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

  function buildModal(){
    let m = $("#btfw-motd-modal");
    if (m) return m;
    m = document.createElement("div");
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
    const m = buildModal();
    // lazy load quill
    try { await loadOnce(QUILL_CSS, "stylesheet"); await loadOnce(QUILL_JS, "script"); } catch(e){ console.warn("[motd-editor] quill load failed", e); }
    const host = $("#btfw-motd-editor", m);
    if (!host) return;

    // initial content is current MOTD HTML (server-rendered)
    const motdEl = $("#motd") || $("#motdwrap");
    const initialHTML = motdEl ? motdEl.innerHTML : "";
    if (!quill && window.Quill) {
      quill = new Quill(host, {
        theme: "snow",
        modules: { toolbar: [ ["bold","italic","underline","strike"], ["link","blockquote","code-block"], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'header': [1,2,3,false] }], [{ 'align': [] }], ["clean"] ] }
      });
    }
    if (quill) {
      quill.root.innerHTML = initialHTML;
    } else {
      // fallback: contenteditable (if CDN blocked)
      host.innerHTML = `<div id="btfw-motd-fallback" contenteditable="true" class="box" style="height:100%; overflow:auto;">${initialHTML}</div>`;
    }

    $("#btfw-motd-save", m).onclick = ()=>{
      const html = quill ? quill.root.innerHTML : $("#btfw-motd-fallback")?.innerHTML || "";
      try {
        if (window.socket?.emit) socket.emit("setMotd", { motd: html });
      } catch(e){ console.warn("[motd-editor] setMotd emit failed", e); }
      // Optimistic update
      const motd = $("#motd");
      if (motd) motd.innerHTML = html;
      else {
        const wrap = $("#motdwrap");
        if (wrap) wrap.innerHTML = html;
      }
      m.classList.remove("is-active");
    };

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

  return { name:"feature:motd-editor" };
});
