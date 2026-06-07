/* BTFW — feature:emotes-admin
   Modernises CyTube's Channel Settings → Emotes manager (#cs-emotes), which is
   otherwise a bare striped table that shows raw image URLs as text.

   What it does (a re-skin/re-layout over CyTube's own controls, so add / delete /
   search / sort / paginate keep working unchanged):
     • 2-column layout: the emote list on the left, an always-on preview box on
       the right that shows the hovered/selected emote large (image + name).
     • Each row becomes [thumbnail] [name] ···· [ghost delete icon on the right].
       The raw URL text is dropped from rows.
     • The preview box's image URL is EDITABLE — change it and Save to update the
       emote in place (socket "updateEmote", the same upsert CyTube's Create uses).
       While the field is focused the preview locks so hovering rows won't clobber
       your edit.
     • Themed search field (with icon), sort toggle, and a clean centered
       pagination strip (CyTube's was stretched edge-to-edge and misaligned).
     • A MutationObserver re-applies thumbnails whenever CyTube re-renders the
       table (search / sort / page change / after an edit).

   Admin-only + lazy: nothing runs until the Emotes pane is actually visible.
*/
BTFW.define("feature:emotes-admin", [], async () => {

  /* ---------------- styles ---------------- */
  function injectCSS(){
    if (document.getElementById("btfw-emotes-css")) return;
    const SEARCH_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23838b9e' stroke-width='2' stroke-linecap='round' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E";
    const st = document.createElement("style");
    st.id = "btfw-emotes-css";
    st.textContent = `
      #cs-emotes > h4 { font-size:1.15rem; font-weight:700; margin:0 0 14px; }
      #cs-emotes .form-horizontal { background:color-mix(in srgb,var(--btfw-color-panel,#161922) 68%,transparent); border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 55%,transparent); border-radius:14px; padding:14px 16px; margin:0 0 16px; }
      #cs-emotes .form-horizontal .form-group { margin:0 0 10px; display:flex; align-items:center; gap:12px; }
      #cs-emotes .form-horizontal .form-group:last-child { margin-bottom:0; }
      #cs-emotes .form-horizontal .control-label { flex:0 0 92px; text-align:right; padding:0; font-weight:600; font-size:.85rem; }
      #cs-emotes .form-horizontal .col-sm-8 { flex:1; width:auto; padding:0; }
      #cs-emotes .form-horizontal .col-sm-offset-4 { margin:0; }

      .btfw-emotes-main { display:grid; grid-template-columns: minmax(0,1fr) 300px; gap:16px; align-items:start; }
      @media (max-width:900px){ .btfw-emotes-main { grid-template-columns:1fr; } }

      .btfw-emotes-toolbar { display:flex; align-items:center; gap:10px; margin:0 0 12px; }
      .btfw-emotes-toolbar .form-group { margin:0; flex:1; }
      .btfw-emotes-toolbar .emotelist-search { width:100%; height:40px; border-radius:11px; padding:0 12px 0 38px; background:color-mix(in srgb,var(--btfw-color-panel,#161922) 86%,transparent) url("${SEARCH_ICON}") no-repeat 13px center; border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 60%,transparent); color:var(--btfw-color-text); font-size:.9rem; }
      .btfw-emotes-toolbar .emotelist-search:focus { border-color:var(--btfw-color-accent,#7aa2f7); outline:none; }
      .btfw-emotes-toolbar .checkbox { margin:0; flex:0 0 auto; }
      .btfw-emotes-toolbar .checkbox label { display:inline-flex; align-items:center; gap:9px; height:40px; padding:0 15px; border-radius:11px; background:color-mix(in srgb,var(--btfw-color-panel,#161922) 86%,transparent); border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 60%,transparent); font-size:.84rem; font-weight:600; white-space:nowrap; cursor:pointer; }
      .btfw-emotes-toolbar .checkbox input, .emotelist-alphabetical { position:static !important; margin:0 !important; width:15px; height:15px; accent-color:var(--btfw-color-accent,#7aa2f7); }

      .emotelist-table { width:100%; background:transparent !important; border-collapse:separate; border-spacing:0; margin:0; }
      .emotelist-table thead { display:none; }
      .emotelist-table tbody tr { display:flex; align-items:center; gap:12px; padding:7px 10px; background:transparent !important; border-radius:10px; }
      .emotelist-table tbody tr:hover { background:color-mix(in srgb,var(--btfw-color-accent,#7aa2f7) 11%,transparent) !important; }
      .emotelist-table tbody td { border:0 !important; padding:0 !important; background:transparent !important; }
      .emotelist-table tbody td:nth-child(1){ order:3; margin-left:auto; }
      .emotelist-table tbody td:nth-child(2){ order:2; }
      .emotelist-table tbody td:nth-child(3){ order:1; }
      .emotelist-table td.btfw-emote-imgcell { display:flex; align-items:center; }
      .emotelist-table img.btfw-emote-thumb { width:36px; height:36px; object-fit:contain; border-radius:7px; background:rgba(255,255,255,.05); }
      .btfw-emote-url { display:none !important; }
      .emotelist-table .btfw-emote-name { font-weight:600; font-size:.9rem; color:var(--btfw-color-text); }
      .emotelist-table td .btn-danger, .emotelist-table td button.is-danger { background:transparent !important; border:0 !important; box-shadow:none !important; color:#838b9e !important; opacity:.4; padding:6px 9px !important; border-radius:9px !important; transition:opacity .12s ease, color .12s ease, background .12s ease; }
      .emotelist-table tbody tr:hover td .btn-danger, .emotelist-table tbody tr:hover td button.is-danger { opacity:.85; }
      .emotelist-table td .btn-danger:hover, .emotelist-table td button.is-danger:hover { color:#f7768e !important; background:color-mix(in srgb,#f7768e 16%,transparent) !important; opacity:1; }

      .emotelist-paginator-container { margin:14px 0 0; }
      .emotelist-paginator-container ul.pagination { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; padding:0; margin:0; }
      .emotelist-paginator-container ul.pagination > li { margin:0; float:none; }
      .emotelist-paginator-container ul.pagination > li > a { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:34px; padding:0 11px; border-radius:9px !important; border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 60%,transparent); background:color-mix(in srgb,var(--btfw-color-panel,#161922) 78%,transparent); color:var(--btfw-color-text); font-size:.84rem; font-weight:600; float:none; margin:0; }
      .emotelist-paginator-container ul.pagination > li.active > a { background:var(--btfw-color-accent,#7aa2f7); color:var(--btfw-color-on-accent,#fff); border-color:transparent; }
      .emotelist-paginator-container ul.pagination > li.disabled > a { opacity:.35; }

      .btfw-emote-preview { position:sticky; top:0; background:color-mix(in srgb,var(--btfw-color-panel,#161922) 70%,transparent); border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 55%,transparent); border-radius:16px; padding:18px; text-align:center; }
      .btfw-emote-preview__stage { display:flex; align-items:center; justify-content:center; min-height:170px; background:repeating-conic-gradient(#0d0f16 0% 25%, #12151f 0% 50%) 50% / 22px 22px; border-radius:12px; margin-bottom:14px; overflow:hidden; padding:10px; }
      .btfw-emote-preview__stage img { max-width:100%; max-height:200px; }
      .btfw-emote-preview__name { font-weight:700; font-size:1rem; color:var(--btfw-color-text); }
      .btfw-emote-preview__hint { color:#838b9e; font-size:.82rem; }
      .btfw-emote-preview__label { display:block; text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.05em; color:#838b9e; margin:13px 0 5px; }
      .btfw-emote-preview__editrow { display:flex; gap:6px; }
      .btfw-emote-preview__url { flex:1; min-width:0; height:34px; border-radius:9px; padding:0 10px; background:color-mix(in srgb,var(--btfw-color-bg,#0b0e16) 55%,transparent); border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 60%,transparent); color:var(--btfw-color-text); font-size:.74rem; font-family:monospace; }
      .btfw-emote-preview__url:focus { border-color:var(--btfw-color-accent,#7aa2f7); outline:none; }
      .btfw-emote-preview__save { flex:0 0 auto; height:34px; padding:0 14px; border:0; border-radius:9px; background:var(--btfw-color-accent,#7aa2f7); color:var(--btfw-color-on-accent,#fff); font-weight:600; font-size:.8rem; text-shadow:rgba(0,0,0,.3) 1px 1px 1px; cursor:pointer; }
      .btfw-emote-preview__save:hover { filter:brightness(1.08); }
      .btfw-emote-preview__msg { min-height:15px; margin-top:7px; font-size:.74rem; color:#9ece6a; text-align:left; }
      .btfw-emote-preview__msg.is-err { color:#f7768e; }

      #cs-emotes-export, #cs-emotes-import { -webkit-appearance:none; appearance:none; border-radius:10px; padding:7px 16px; font-weight:600; font-size:.84rem; background:color-mix(in srgb,var(--btfw-color-panel,#161922) 80%,transparent); border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 60%,transparent); color:var(--btfw-color-text); margin:16px 8px 0 0; cursor:pointer; }
      #cs-emotes-export:hover, #cs-emotes-import:hover { background:color-mix(in srgb,var(--btfw-color-panel,#161922) 94%,white 5%); }
      #cs-emotes-exporttext { margin-top:10px; border-radius:10px; }
    `;
    document.head.appendChild(st);
  }

  /* ---------------- layout ---------------- */
  function build(pane){
    const table = pane.querySelector("table.emotelist-table");
    if (!table) return false;
    const existing = pane.querySelector(".btfw-emotes-main");
    if (existing && existing.contains(table)) { enhanceRows(table, pane); return true; }
    if (existing) existing.remove();

    const addForm = pane.querySelector("form.form-horizontal");
    const searchForm = pane.querySelector("form.form-inline");
    const pag = pane.querySelector(".emotelist-paginator-container");

    const main = document.createElement("div"); main.className = "btfw-emotes-main";
    const listcol = document.createElement("div"); listcol.className = "btfw-emotes-listcol";
    const toolbar = document.createElement("div"); toolbar.className = "btfw-emotes-toolbar";
    if (searchForm) { Array.from(searchForm.children).forEach(ch => toolbar.appendChild(ch)); searchForm.remove(); }
    listcol.appendChild(toolbar);
    listcol.appendChild(table);
    if (pag) listcol.appendChild(pag);

    const preview = document.createElement("div"); preview.className = "btfw-emote-preview";
    preview.innerHTML =
      '<div class="btfw-emote-preview__stage"><span class="btfw-emote-preview__hint">Hover an emote to preview</span></div>' +
      '<div class="btfw-emote-preview__name">—</div>' +
      '<label class="btfw-emote-preview__label">Image URL</label>' +
      '<div class="btfw-emote-preview__editrow">' +
        '<input class="btfw-emote-preview__url" type="text" spellcheck="false" autocomplete="off" placeholder="https://…">' +
        '<button type="button" class="btfw-emote-preview__save">Save</button>' +
      '</div>' +
      '<div class="btfw-emote-preview__msg"></div>';

    main.appendChild(listcol);
    main.appendChild(preview);
    if (addForm && addForm.nextSibling) pane.insertBefore(main, addForm.nextSibling);
    else pane.appendChild(main);

    wirePreview(table, preview);
    enhanceRows(table, pane);
    return true;
  }

  /* ---------------- rows → thumbnail + name ---------------- */
  function enhanceRows(table, pane){
    table.querySelectorAll("tbody tr").forEach(tr => {
      const tds = tr.children;
      if (tds.length < 3) return;
      const nameCell = tds[1], imgCell = tds[2];
      const name = (nameCell.textContent || "").trim();
      if (imgCell.dataset.btfwDone) { tr.dataset.name = name; nameCell.classList.add("btfw-emote-name"); return; }
      const url = (imgCell.textContent || "").trim();
      if (!url) return;
      imgCell.dataset.btfwDone = "1";
      imgCell.classList.add("btfw-emote-imgcell");
      imgCell.textContent = "";
      const img = document.createElement("img");
      img.className = "btfw-emote-thumb"; img.loading = "lazy"; img.src = url; img.alt = name;
      imgCell.appendChild(img);
      nameCell.classList.add("btfw-emote-name");
      tr.dataset.url = url; tr.dataset.name = name;
    });
    const preview = pane.querySelector(".btfw-emote-preview");
    if (preview && !preview._btfwTouched && !preview._btfwLocked) {
      const first = table.querySelector("tbody tr[data-url]");
      if (first) setPreview(preview, first.dataset.name, first.dataset.url);
    }
  }

  function setPreview(preview, name, url, force){
    if (!preview || !url) return;
    if (preview._btfwLocked && !force) return;
    const stage = preview.querySelector(".btfw-emote-preview__stage");
    stage.innerHTML = '<img alt="">';
    stage.querySelector("img").src = url;
    preview.querySelector(".btfw-emote-preview__name").textContent = name || "";
    preview.querySelector(".btfw-emote-preview__url").value = url || "";
    const msg = preview.querySelector(".btfw-emote-preview__msg"); if (msg) { msg.textContent = ""; msg.classList.remove("is-err"); }
    preview._btfwName = name; preview._btfwUrl = url;
  }

  function wirePreview(table, preview){
    if (!table._btfwHover) {
      table._btfwHover = true;
      const handler = e => {
        const tr = e.target.closest("tbody tr");
        if (tr && tr.dataset.url) { preview._btfwTouched = true; setPreview(preview, tr.dataset.name, tr.dataset.url); }
      };
      table.addEventListener("mouseover", handler);
      table.addEventListener("click", handler);
      const tb = table.querySelector("tbody");
      if (tb && !table._btfwObs) {
        const pane = table.closest("#cs-emotes");
        const mo = new MutationObserver(() => enhanceRows(table, pane));
        mo.observe(tb, { childList: true });
        table._btfwObs = mo;
      }
    }
    if (!preview._btfwEditWired) {
      preview._btfwEditWired = true;
      const input = preview.querySelector(".btfw-emote-preview__url");
      const saveBtn = preview.querySelector(".btfw-emote-preview__save");
      const msg = preview.querySelector(".btfw-emote-preview__msg");
      const flash = (text, err) => { if (!msg) return; msg.textContent = text; msg.classList.toggle("is-err", !!err); clearTimeout(msg._t); msg._t = setTimeout(() => { msg.textContent = ""; msg.classList.remove("is-err"); }, 2400); };
      const doSave = () => {
        const name = preview._btfwName;
        const url = (input.value || "").trim();
        if (!name) { flash("Pick an emote first", true); return; }
        if (!url) { flash("Enter a URL", true); return; }
        if (url === preview._btfwUrl) { flash("No changes"); return; }
        try { window.socket.emit("updateEmote", { name, image: url }); }
        catch (e) { flash("Save failed", true); return; }
        preview._btfwUrl = url;
        const img = preview.querySelector(".btfw-emote-preview__stage img"); if (img) img.src = url;
        flash("Saved ✓");
      };
      // lock the preview while the field is focused so hovering rows can't clobber the edit
      input.addEventListener("focus", () => { preview._btfwLocked = true; });
      input.addEventListener("blur", () => { setTimeout(() => { preview._btfwLocked = false; }, 150); });
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); doSave(); }
        else if (e.key === "Escape") { input.value = preview._btfwUrl || ""; input.blur(); }
      });
      saveBtn.addEventListener("click", doSave);
    }
  }

  /* ---------------- lazy init wiring ---------------- */
  function paneVisible(){
    const pane = document.getElementById("cs-emotes");
    return !!(pane && pane.offsetParent !== null);
  }
  function maybeInit(){
    if (!paneVisible()) return;
    injectCSS();
    build(document.getElementById("cs-emotes"));
  }
  function attach(){
    const modal = document.getElementById("channeloptions");
    if (modal && !modal._btfwEmotesObs) {
      let deb = null;
      const mo = new MutationObserver(() => {
        if (deb) return;
        deb = setTimeout(() => { deb = null; maybeInit(); }, 120);
      });
      mo.observe(modal, { subtree: true, attributes: true, attributeFilter: ["class","style"] });
      modal._btfwEmotesObs = mo;
      modal.addEventListener("click", () => setTimeout(maybeInit, 60), true);
    }
    return !!modal;
  }
  let tries = 0;
  (function tryAttach(){
    const ok = attach();
    maybeInit();
    if (!ok && tries++ < 60) setTimeout(tryAttach, 500);
  })();

  return {};
});
