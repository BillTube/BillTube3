
BTFW.define("feature:motd-editor", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const QUILL_CSS = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  const QUILL_JS  = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";
  const QUILL_TOOLBAR = [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ font: [] }],
    [{ size: ["small", false, "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ script: "sub" }, { script: "super" }],
    ["blockquote", "code-block"],
    [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["link", "image", "video"],
    ["clean"]
  ];
  function promptImageURL(){
    const existing = document.getElementById("btfw-motd-image-url-prompt");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "btfw-motd-image-url-prompt";
    modal.className = "modal is-active";
    modal.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card btfw-modal">
        <header class="modal-card-head">
          <p class="modal-card-title">Insert Image</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <div class="field">
            <label class="label" for="btfw-motd-image-url-input">Image URL</label>
            <div class="control">
              <input id="btfw-motd-image-url-input" class="input" type="url" placeholder="https://example.com/image.png" />
            </div>
            <p class="help">Paste a direct link to an image that is already hosted elsewhere.</p>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-link" id="btfw-motd-image-url-insert">Insert</button>
          <button class="button" id="btfw-motd-image-url-cancel">Cancel</button>
        </footer>
      </div>`;

    const close = ()=>{
      modal.classList.remove("is-active");
      setTimeout(()=> modal.remove(), 150);
    };

    modal.querySelectorAll(".modal-background, .delete, #btfw-motd-image-url-cancel").forEach(el =>
      el.addEventListener("click", close)
    );

    document.body.appendChild(modal);

    const input = modal.querySelector("#btfw-motd-image-url-input");
    if (input) {
      input.value = "";
      requestAnimationFrame(()=> input.focus());
    }

    return new Promise(resolve => {
      const insertBtn = modal.querySelector("#btfw-motd-image-url-insert");
      const finish = (value)=>{
        resolve(value);
        close();
      };

      if (insertBtn) {
        insertBtn.addEventListener("click", ()=>{
          const url = input?.value?.trim();
          finish(url || null);
        });
      }

      if (input) {
        input.addEventListener("keydown", (ev)=>{
          if (ev.key === "Enter") {
            ev.preventDefault();
            const url = input.value.trim();
            finish(url || null);
          }
          if (ev.key === "Escape") {
            ev.preventDefault();
            finish(null);
          }
        });
      }
    });
  }

  function normaliseImageURL(url){
    if (!url) return null;
    try {
      const parsed = new URL(url, window.location.href);
      if (!/^https?:$/i.test(parsed.protocol)) return null;
      return parsed.href;
    } catch(_){
      return null;
    }
  }

  function ensureImageInteractivity(root){
    if (!root) return;
    root.querySelectorAll("img").forEach(img => {
      if (!img.getAttribute("draggable")) {
        img.setAttribute("draggable", "true");
      }
      if (!img.dataset.btfwMotdDragListener) {
        img.dataset.btfwMotdDragListener = "1";
        img.addEventListener("dragstart", ev => {
          try {
            ev.dataTransfer?.setData("text/plain", img.src || "");
          } catch(_){}
        });
      }
    });
  }

  function createQuillModules(){
    return {
      toolbar: {
        container: QUILL_TOOLBAR,
        handlers: {
          image: async function(){
            const quill = this.quill;
            const existingRange = quill.getSelection(true);
            const inputURL = await promptImageURL();
            const url = normaliseImageURL(inputURL);
            if (!url) {
              if (existingRange) quill.setSelection(existingRange.index, existingRange.length || 0);
              return;
            }

            const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
            quill.insertEmbed(range.index, "image", url, "user");
            quill.setSelection(range.index + 1, 0);
            ensureImageInteractivity(quill.root);
          }
        }
      }
    };
  }

  function attachQuillEnhancements(quill){
    if (!quill || !quill.root) return;

    const root = quill.root;
    const updateImages = ()=> ensureImageInteractivity(root);

    if (!root.dataset.btfwMotdEnhancements) {
      root.dataset.btfwMotdEnhancements = "1";

      const preventFiles = ev => {
        if (ev.dataTransfer?.files?.length) {
          ev.preventDefault();
        }
      };

      const preventPasteFiles = ev => {
        if (ev.clipboardData?.files?.length) {
          ev.preventDefault();
        }
      };

      root.addEventListener("drop", preventFiles);
      root.addEventListener("dragover", preventFiles);
      root.addEventListener("paste", preventPasteFiles);
    }

    updateImages();
    quill.on("text-change", updateImages);
  }

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

  function setQuillHTML(instance, html, { logSuccess = false, context = "[motd-editor]" } = {}){
    if (!instance) return;
    if (!html || !html.trim()) {
      instance.setText("");
      ensureImageInteractivity(instance?.root);
      return;
    }

    try {
      instance.clipboard.dangerouslyPasteHTML(html);
      if (logSuccess) console.log(`${context} Content loaded via clipboard API`);
    } catch(e){
      console.warn(`${context} Clipboard paste failed, trying delta conversion`, e);
      try {
        const delta = instance.clipboard.convert(html);
        instance.setContents(delta);
        if (logSuccess) console.log(`${context} Content loaded via delta conversion`);
      } catch(e2){
        console.error(`${context} Both methods failed`, e2);
        instance.setText(html);
      }
    }
    ensureImageInteractivity(instance?.root);
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

  let modalQuill = null;
  let csQuill = null;
  let csTextarea = null;
  let csEditorHost = null;
  let csTextareaInputHandler = null;
  let csTextareaChangeHandler = null;
  let csSyncingFromQuill = false;
  let csSyncingFromTextarea = false;
  let csTextareaValueOverridden = false;

  function teardownChannelSettingsEditor(){
    if (csQuill) {
      try { csQuill.disable(); } catch(_){}
    }

    if (csEditorHost?.parentNode) {
      csEditorHost.parentNode.removeChild(csEditorHost);
    }

    if (csTextarea) {
      if (csTextareaValueOverridden) {
        delete csTextarea.value;
        csTextareaValueOverridden = false;
      }

      if (csTextareaInputHandler) csTextarea.removeEventListener("input", csTextareaInputHandler);
      if (csTextareaChangeHandler) csTextarea.removeEventListener("change", csTextareaChangeHandler);

      if (csTextarea._btfwMotdOriginalDisplay !== undefined) {
        csTextarea.style.display = csTextarea._btfwMotdOriginalDisplay;
        delete csTextarea._btfwMotdOriginalDisplay;
      } else {
        csTextarea.style.removeProperty("display");
      }

      delete csTextarea.dataset.btfwMotdInline;
    }

    csQuill = null;
    csTextarea = null;
    csEditorHost = null;
    csTextareaInputHandler = null;
    csTextareaChangeHandler = null;
    csSyncingFromQuill = false;
    csSyncingFromTextarea = false;
  }

  async function ensureChannelSettingsEditor(){
    const textarea = $("#cs-motdtext");

    if (!textarea) {
      if (csTextarea) teardownChannelSettingsEditor();
      return;
    }

    if (csTextarea && csTextarea !== textarea) {
      teardownChannelSettingsEditor();
    }

    if (textarea.dataset.btfwMotdInline === "ready" && csQuill) {
      return;
    }

    if (textarea.dataset.btfwMotdInline === "pending") {
      return;
    }

    textarea.dataset.btfwMotdInline = "pending";

    try {
      await loadOnce(QUILL_CSS, "stylesheet");
      await loadOnce(QUILL_JS, "script");
    } catch(e){
      console.warn("[motd-editor] Channel settings Quill load failed", e);
      delete textarea.dataset.btfwMotdInline;
      return;
    }

    if (!window.Quill) {
      delete textarea.dataset.btfwMotdInline;
      return;
    }

    try {
      csTextarea = textarea;
      if (csTextarea._btfwMotdOriginalDisplay === undefined) {
        csTextarea._btfwMotdOriginalDisplay = csTextarea.style.display || "";
      }
      csTextarea.style.display = "none";

      csEditorHost = document.getElementById("btfw-cs-motd-editor");
      if (!csEditorHost) {
        csEditorHost = document.createElement("div");
        csEditorHost.id = "btfw-cs-motd-editor";
        csEditorHost.className = "btfw-motd-inline-editor";
        csTextarea.insertAdjacentElement("afterend", csEditorHost);
      }
      csEditorHost.style.minHeight = "320px";
      csEditorHost.innerHTML = "";

      csQuill = new Quill(csEditorHost, {
        theme: "snow",
        modules: createQuillModules()
      });

      attachQuillEnhancements(csQuill);

      const syncFromTextarea = ()=>{
        if (!csQuill || !csTextarea) return;
        if (csSyncingFromQuill) return;
        const html = csTextarea.value || "";
        const current = csQuill.root.innerHTML;
        if (html === current) return;
        csSyncingFromTextarea = true;
        setQuillHTML(csQuill, html);
        csSyncingFromTextarea = false;
      };

      const syncToTextarea = ()=>{
        if (!csQuill || !csTextarea) return;
        if (csSyncingFromTextarea) return;
        csSyncingFromQuill = true;
        const html = csQuill.root.innerHTML;
        if (csTextarea.value !== html) {
          csTextarea.value = html;
          const inputEvent = new Event("input", { bubbles: true });
          const changeEvent = new Event("change", { bubbles: true });
          csTextarea.dispatchEvent(inputEvent);
          csTextarea.dispatchEvent(changeEvent);
        }
        csSyncingFromQuill = false;
      };

      csQuill.on("text-change", syncToTextarea);

      csTextareaInputHandler = ()=> syncFromTextarea();
      csTextareaChangeHandler = ()=> syncFromTextarea();
      csTextarea.addEventListener("input", csTextareaInputHandler);
      csTextarea.addEventListener("change", csTextareaChangeHandler);

      if (!csTextareaValueOverridden) {
        const ownDescriptor = Object.getOwnPropertyDescriptor(csTextarea, "value");
        const proto = ownDescriptor ? null : Object.getPrototypeOf(csTextarea);
        const protoDescriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        const descriptor = ownDescriptor || protoDescriptor;
        if (descriptor && descriptor.configurable !== false) {
          const getter = descriptor.get ? descriptor.get.bind(csTextarea) : ()=> descriptor.value;
          const setter = descriptor.set ? descriptor.set.bind(csTextarea) : (v)=>{ descriptor.value = v; };
          Object.defineProperty(csTextarea, "value", {
            configurable: true,
            enumerable: descriptor.enumerable ?? true,
            get(){
              return getter();
            },
            set(v){
              setter(v);
              if (!csSyncingFromQuill) syncFromTextarea();
            }
          });
          csTextareaValueOverridden = true;
        }
      }

      setQuillHTML(csQuill, csTextarea.value || "");
      textarea.dataset.btfwMotdInline = "ready";
    } catch(err){
      console.warn("[motd-editor] Failed to initialise channel settings editor", err);
      delete textarea.dataset.btfwMotdInline;
      teardownChannelSettingsEditor();
      throw err;
    }
  }
  
  async function openEditor(){
    if (modalQuill) {
      try { modalQuill.disable(); } catch(_){}
      modalQuill = null;
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
      modalQuill = new Quill(host, {
        theme: "snow",
        modules: createQuillModules()
      });

      attachQuillEnhancements(modalQuill);

      setQuillHTML(modalQuill, initialHTML, { logSuccess: true });
      console.log('[motd-editor] Quill editor ready, content loaded');
    } else {
      host.innerHTML = `<div id="btfw-motd-fallback" contenteditable="true" class="box" style="height:100%; overflow:auto;">${initialHTML}</div>`;
    }

    const saveBtn = $("#btfw-motd-save", m);
    if (saveBtn) {
      saveBtn.onclick = ()=>{
        const html = modalQuill ? modalQuill.root.innerHTML : $("#btfw-motd-fallback")?.innerHTML || "";
        
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

  function refreshMotdUI(){
    injectButton();
    ensureChannelSettingsEditor().catch(e=> console.warn('[motd-editor] ensureChannelSettingsEditor failed', e));
  }

  function boot(){
    refreshMotdUI();
    const mo = new MutationObserver(()=> refreshMotdUI());
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:motd-editor", openEditor };
});

