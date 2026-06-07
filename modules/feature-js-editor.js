/* BTFW — feature:js-editor
   Turns the Channel JS and Channel CSS editors (#cs-jstext / #cs-csstext, plain
   <textarea>s) into syntax-highlighted code editors (CodeMirror 5, dark theme
   matched to the BillTube UI) with a live problem checker.

   • Syntax highlighting + line numbers + active-line + bracket matching.
   • Live problems: gutter markers/underlines at the exact spot, plus a slim
     status line under the editor ("✓ No problems" / "⚠ 2 errors · first at line N").
   • Save gate: when you hit "Save JS"/"Save CSS" with real errors, we intercept
     and show a themed confirm listing each error + line ("Save anyway" /
     "Go back & fix"). Warnings are shown but never block the save.

   Checkers:
     JS  → JSHint (errors + key warnings: undefined vars, '=' vs '==',
           unreachable code; missing semicolons are not nagged).
     CSS → css-tree (a modern, tolerant parser): real syntax errors, and it
           understands modern CSS (color-mix, backdrop-filter, &-nesting) so it
           doesn't false-flag them. It DOES catch SCSS-isms like `//` comments,
           which are invalid CSS and silently break the next declaration.

   CodeMirror + the checkers are lazy-loaded from jsDelivr only when one of the
   editors actually becomes visible (admins only); the global save listener is
   installed only once an editor mounts — regular viewers pay ~nothing. The
   underlying <textarea> stays in sync (cm.save()), so CyTube's own save path is
   unchanged.
*/
BTFW.define("feature:js-editor", [], async () => {
  const CM = "https://cdn.jsdelivr.net/npm/codemirror@5.65.16";
  const JSHINT_SRC = "https://cdn.jsdelivr.net/npm/jshint@2.13.6/dist/jshint.min.js";
  const CSSTREE_SRC = "https://cdn.jsdelivr.net/npm/css-tree@2.3.1/dist/csstree.js";

  let libsPromise = null, saveHookInstalled = false;

  // JSHint config — "errors + key warnings", low noise.
  const JSHINT_OPTS = {
    esversion: 11, browser: true, devel: true, jquery: true,
    undef: true,   // undefined variables (typos)
    asi: true,     // tolerate missing semicolons (no nag)
    eqnull: true   // allow == null
  };
  const JSHINT_GLOBALS = {
    socket:false, CLIENT:false, CHANNEL:false, Callbacks:false, PLAYER:false,
    USEROPTS:false, Rank:false, CHANNELOPTS:false, IGNORED:false, LASTCHAT:false,
    addChatMessage:false, formatTime:false, makeAlert:false, initPm:false,
    hasPermission:false, findUserlistItem:false, calcUserBreakdown:false,
    $:false, jQuery:false, _:false, io:false, BTFW:false, Mousetrap:false, NProgress:false
  };

  /* ---------------- checkers ---------------- */
  function runJSHint(code){
    const errors = [], warnings = [];
    if (!window.JSHINT) return { errors, warnings };
    try { window.JSHINT(code, JSHINT_OPTS, JSHINT_GLOBALS); }
    catch(e){ return { errors, warnings }; }
    (window.JSHINT.errors || []).forEach(err => {
      if (!err || !err.reason) return;
      const c = err.code || "";
      if (c.charAt(0) === "I") return; // skip "info"
      const it = { line: err.line||1, ch: err.character||1, reason: err.reason, code: c };
      (c.charAt(0) === "W" ? warnings : errors).push(it);
    });
    return { errors, warnings };
  }
  function runCSSLint(code){
    const errors = [], warnings = [];
    if (!window.csstree) return { errors, warnings };
    const seen = new Set();
    const add = (line, col, msg) => {
      const m = String(msg || "Syntax error").replace(/\s+/g, " ").trim();
      const key = (line||1) + ":" + (col||1) + ":" + m;
      if (seen.has(key)) return; seen.add(key);
      errors.push({ line: line||1, ch: col||1, reason: m, code: "" });
    };
    try {
      window.csstree.parse(code, {
        positions: true,
        onParseError(e){ add(e.line, e.column, e.rawMessage || e.message); }
      });
    } catch(e){ add(e.line, e.column, e.rawMessage || e.message); }
    return { errors, warnings };
  }

  // Editor registry — one entry per CyTube code textarea.
  const EDITORS = [
    { key:"js",  taId:"cs-jstext",  saveId:"cs-jssubmit",  mode:"javascript", lang:"JavaScript", run:runJSHint,  cm:null, statusEl:null, allowSaveOnce:false, statusTimer:null },
    { key:"css", taId:"cs-csstext", saveId:"cs-csssubmit", mode:"css",        lang:"CSS",        run:runCSSLint, cm:null, statusEl:null, allowSaveOnce:false, statusTimer:null }
  ];
  const editorBySaveId = id => EDITORS.find(e => e.saveId === id);

  /* ---------------- lib loading ---------------- */
  function injectCss(href){
    return new Promise(res=>{
      if (document.querySelector(`link[data-btfw-cm="${href}"]`)) return res();
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = href; l.setAttribute("data-btfw-cm", href);
      l.onload = ()=>res(); l.onerror = ()=>res();
      document.head.appendChild(l);
    });
  }
  function injectJs(src){
    return new Promise((res,rej)=>{
      if (document.querySelector(`script[data-btfw-cm="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src; s.async = false; s.setAttribute("data-btfw-cm", src);
      s.onload = ()=>res(); s.onerror = ()=>rej(new Error("load fail "+src));
      document.head.appendChild(s);
    });
  }
  function ensureLibs(){
    const ready = window.CodeMirror && window.CodeMirror.modes &&
      window.CodeMirror.modes.javascript && window.CodeMirror.modes.css &&
      window.JSHINT && window.csstree;
    if (ready) { injectSkin(); registerLinters(); return Promise.resolve(); }
    if (libsPromise) return libsPromise;
    libsPromise = (async () => {
      await injectCss(`${CM}/lib/codemirror.css`);
      await injectCss(`${CM}/addon/lint/lint.css`);
      await injectJs(`${CM}/lib/codemirror.min.js`);
      await Promise.all([
        injectJs(`${CM}/mode/javascript/javascript.min.js`),
        injectJs(`${CM}/mode/css/css.min.js`)
      ]);
      await Promise.all([
        injectJs(`${CM}/addon/lint/lint.min.js`),
        injectJs(`${CM}/addon/edit/matchbrackets.min.js`),
        injectJs(`${CM}/addon/edit/closebrackets.min.js`),
        injectJs(`${CM}/addon/selection/active-line.min.js`),
        injectJs(JSHINT_SRC),
        injectJs(CSSTREE_SRC)
      ]);
      injectSkin();
      registerLinters();
    })();
    return libsPromise;
  }

  /* ---------------- lint helpers (gutter markers) ---------------- */
  function toAnnotations(res){
    const out = [];
    const P = (it, sev) => out.push({
      from: window.CodeMirror.Pos(Math.max(0, it.line-1), Math.max(0, it.ch-1)),
      to:   window.CodeMirror.Pos(Math.max(0, it.line-1), Math.max(0, it.ch)),
      message: it.reason + (it.code ? ` (${it.code})` : ""),
      severity: sev
    });
    res.errors.forEach(e => P(e, "error"));
    res.warnings.forEach(w => P(w, "warning"));
    return out;
  }
  function registerLinters(){
    if (!window.CodeMirror) return;
    if (!window.CodeMirror._btfwLintJS && window.JSHINT) {
      window.CodeMirror.registerHelper("lint", "javascript", t => toAnnotations(runJSHint(t)));
      window.CodeMirror._btfwLintJS = true;
    }
    if (!window.CodeMirror._btfwLintCSS && window.csstree) {
      window.CodeMirror.registerHelper("lint", "css", t => toAnnotations(runCSSLint(t)));
      window.CodeMirror._btfwLintCSS = true;
    }
  }

  /* ---------------- skin (editor + status + confirm dialog) ---------------- */
  function injectSkin(){
    if (document.getElementById("btfw-js-editor-css")) return;
    const st = document.createElement("style");
    st.id = "btfw-js-editor-css";
    st.textContent = `
      .btfw-ide{border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 80%,transparent);border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.28);margin:0 0 8px;}
      .btfw-ide .CodeMirror{height:clamp(260px,56vh,700px);font-family:"JetBrains Mono","SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;line-height:1.6;}
      .cm-s-btfw-ide.CodeMirror{background:#0f1117;color:#cdd3e0;}
      .cm-s-btfw-ide .CodeMirror-gutters{background:#0b0d13;border-right:1px solid rgba(255,255,255,.06);}
      .cm-s-btfw-ide .CodeMirror-linenumber{color:#454c5e;}
      .cm-s-btfw-ide .CodeMirror-cursor{border-left:2px solid var(--btfw-color-accent,#7aa2f7);}
      .cm-s-btfw-ide .CodeMirror-activeline-background{background:rgba(122,162,247,.07);}
      .cm-s-btfw-ide .CodeMirror-selected{background:rgba(122,162,247,.20)!important;}
      .cm-s-btfw-ide .CodeMirror-matchingbracket{color:#fff!important;background:rgba(130,170,255,.30);}
      .cm-s-btfw-ide .cm-comment{color:#5c6478;font-style:italic;}
      .cm-s-btfw-ide .cm-keyword{color:#c792ea;}
      .cm-s-btfw-ide .cm-atom{color:#f78c6c;}
      .cm-s-btfw-ide .cm-number{color:#ff9e64;}
      .cm-s-btfw-ide .cm-def{color:#82aaff;}
      .cm-s-btfw-ide .cm-variable{color:#cdd3e0;}
      .cm-s-btfw-ide .cm-variable-2{color:#82aaff;}
      .cm-s-btfw-ide .cm-variable-3,.cm-s-btfw-ide .cm-type{color:#ffcb6b;}
      .cm-s-btfw-ide .cm-property{color:#82aaff;}
      .cm-s-btfw-ide .cm-operator{color:#89ddff;}
      .cm-s-btfw-ide .cm-string,.cm-s-btfw-ide .cm-string-2{color:#c3e88d;}
      .cm-s-btfw-ide .cm-meta,.cm-s-btfw-ide .cm-builtin{color:#ffcb6b;}
      /* CSS-specific tokens */
      .cm-s-btfw-ide .cm-qualifier{color:#ffcb6b;}
      .cm-s-btfw-ide .cm-tag{color:#f07178;}
      .cm-s-btfw-ide .cm-hr{color:#5c6478;}
      .cm-s-btfw-ide .cm-important{color:#f78c6c;font-weight:600;}
      .btfw-ide__status{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;font:12px/1.4 "JetBrains Mono",Consolas,monospace;background:#0b0d13;border-top:1px solid rgba(255,255,255,.06);color:#838b9e;}
      .btfw-ide__lint.ok{color:#9ece6a;} .btfw-ide__lint.warn{color:#e0af68;} .btfw-ide__lint.err{color:#f7768e;}
      .btfw-ide-confirm{position:fixed;inset:0;z-index:6200;display:flex;align-items:center;justify-content:center;background:rgba(6,8,14,.55);backdrop-filter:blur(3px);}
      .btfw-ide-confirm__card{width:min(540px,92vw);background:color-mix(in srgb,var(--btfw-color-surface,#161922) 97%,transparent);border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 85%,transparent);border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.5);padding:22px;color:var(--btfw-color-text,#e6e9f2);}
      .btfw-ide-confirm__head{display:flex;align-items:center;gap:10px;font-size:1.06rem;font-weight:700;color:#f7768e;}
      .btfw-ide-confirm__sub{margin:8px 0 6px;color:color-mix(in srgb,var(--btfw-color-text,#e6e9f2) 72%,transparent);font-size:.9rem;}
      .btfw-ide-confirm__list{list-style:none;margin:8px 0 16px;padding:0;max-height:220px;overflow:auto;border:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 65%,transparent);border-radius:12px;}
      .btfw-ide-confirm__list li{padding:9px 12px;font:12.5px/1.5 "JetBrains Mono",Consolas,monospace;border-bottom:1px solid color-mix(in srgb,var(--btfw-border,#2a2f3a) 38%,transparent);cursor:pointer;}
      .btfw-ide-confirm__list li:last-child{border-bottom:0;}
      .btfw-ide-confirm__list li:hover{background:color-mix(in srgb,var(--btfw-color-accent,#7aa2f7) 13%,transparent);}
      .btfw-ide-confirm__list b{color:#e0af68;}
      .btfw-ide-confirm__btns{display:flex;justify-content:flex-end;gap:10px;}
      .btfw-ide-confirm__btns button{appearance:none;border:0;border-radius:10px;padding:9px 18px;font-weight:600;font-size:.88rem;cursor:pointer;}
      .btfw-ide-confirm__cancel{background:var(--btfw-color-accent,#7aa2f7);color:var(--btfw-color-on-accent,#fff);text-shadow:rgba(0,0,0,.3) 1px 1px 1px;}
      .btfw-ide-confirm__save{background:color-mix(in srgb,#f7768e 16%,transparent);color:#f7768e;border:1px solid color-mix(in srgb,#f7768e 42%,transparent);}
    `;
    document.head.appendChild(st);
  }

  /* ---------------- editor ---------------- */
  function paneVisible(ed){
    const ta = document.getElementById(ed.taId);
    return !!(ta && ta.offsetParent !== null);
  }
  function initEditor(ed){
    const ta = document.getElementById(ed.taId);
    if (!ta) return;
    if (ed.cm) {
      if (ed.cm.getTextArea && document.body.contains(ed.cm.getTextArea())) { ed.cm.refresh(); return; }
      ed.cm = null; ed.statusEl = null; // stale (modal recreated the textarea)
    }
    registerLinters();
    ed.cm = window.CodeMirror.fromTextArea(ta, {
      mode: ed.mode, theme: "btfw-ide",
      lineNumbers: true, indentUnit: 2, tabSize: 2, smartIndent: true, lineWrapping: false,
      matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true,
      gutters: ["CodeMirror-lint-markers"], lint: true
    });
    ed.cm.setSize("100%", null);

    const wrap = ed.cm.getWrapperElement();
    const ide = document.createElement("div");
    ide.className = "btfw-ide";
    wrap.parentNode.insertBefore(ide, wrap);
    ide.appendChild(wrap);

    ed.statusEl = document.createElement("div");
    ed.statusEl.className = "btfw-ide__status";
    ed.statusEl.innerHTML = '<span class="btfw-ide__pos">Ln 1, Col 1</span><span class="btfw-ide__lint ok">✓ No problems</span>';
    ide.appendChild(ed.statusEl);

    ed.cm.on("change", () => { ed.cm.save(); scheduleStatus(ed); });
    ed.cm.on("cursorActivity", () => updatePos(ed));
    installSaveHook();
    setTimeout(() => { ed.cm.refresh(); updateStatus(ed); updatePos(ed); }, 40);
  }
  function updatePos(ed){
    if (!ed.cm || !ed.statusEl) return;
    const c = ed.cm.getCursor();
    const p = ed.statusEl.querySelector(".btfw-ide__pos");
    if (p) p.textContent = `Ln ${c.line+1}, Col ${c.ch+1}`;
  }
  function updateStatus(ed){
    if (!ed.cm || !ed.statusEl) return;
    const { errors, warnings } = ed.run(ed.cm.getValue());
    const el = ed.statusEl.querySelector(".btfw-ide__lint");
    if (!el) return;
    if (!errors.length && !warnings.length) {
      el.className = "btfw-ide__lint ok";
      el.textContent = "✓ No problems";
    } else {
      const parts = [];
      if (errors.length) parts.push(errors.length + " error" + (errors.length>1?"s":""));
      if (warnings.length) parts.push(warnings.length + " warning" + (warnings.length>1?"s":""));
      el.className = "btfw-ide__lint " + (errors.length ? "err" : "warn");
      const f = errors[0] || warnings[0];
      el.textContent = "⚠ " + parts.join(", ") + " · first at line " + f.line;
    }
  }
  function scheduleStatus(ed){ clearTimeout(ed.statusTimer); ed.statusTimer = setTimeout(() => updateStatus(ed), 350); }

  /* ---------------- save confirm dialog ---------------- */
  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function closeConfirm(){ const e = document.getElementById("btfw-ide-confirm"); if (e) e.remove(); }
  function showSaveConfirm(ed, errors, warnings, onConfirm){
    closeConfirm();
    const ov = document.createElement("div");
    ov.className = "btfw-ide-confirm"; ov.id = "btfw-ide-confirm";
    const items = errors.slice(0,10).map(e =>
      `<li data-ln="${e.line}" data-ch="${e.ch||1}"><b>Line ${e.line}:</b> ${esc(e.reason)}${e.code?` <span style="opacity:.55">(${e.code})</span>`:""}</li>`
    ).join("");
    const more = errors.length>10 ? `<li style="cursor:default;opacity:.7">…and ${errors.length-10} more</li>` : "";
    const warnNote = warnings.length ? `<p class="btfw-ide-confirm__sub">Plus ${warnings.length} warning${warnings.length>1?"s":""} (non-blocking).</p>` : "";
    ov.innerHTML = `<div class="btfw-ide-confirm__card">
      <div class="btfw-ide-confirm__head">⚠ ${errors.length} ${ed.lang} error${errors.length>1?"s":""} found</div>
      <p class="btfw-ide-confirm__sub">This code may not run correctly. Click an issue to jump to it.</p>
      <ul class="btfw-ide-confirm__list">${items}${more}</ul>${warnNote}
      <div class="btfw-ide-confirm__btns">
        <button class="btfw-ide-confirm__save">Save anyway</button>
        <button class="btfw-ide-confirm__cancel">Go back &amp; fix</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) closeConfirm(); });
    ov.querySelectorAll(".btfw-ide-confirm__list li[data-ln]").forEach(li => li.onclick = () => {
      closeConfirm();
      if (ed.cm) { ed.cm.focus(); ed.cm.setCursor(+li.dataset.ln - 1, (+li.dataset.ch || 1) - 1); }
    });
    ov.querySelector(".btfw-ide-confirm__cancel").onclick = () => {
      closeConfirm();
      if (ed.cm && errors[0]) { ed.cm.focus(); ed.cm.setCursor(errors[0].line - 1, (errors[0].ch || 1) - 1); }
    };
    ov.querySelector(".btfw-ide-confirm__save").onclick = () => { closeConfirm(); if (onConfirm) onConfirm(); };
  }

  /* ---------------- save gate (capture phase, runs before CyTube's handler) ----------------
     Installed lazily the first time an editor mounts, so viewers who never open
     a code editor never carry a global click listener. */
  function installSaveHook(){
    if (saveHookInstalled) return;
    saveHookInstalled = true;
    document.addEventListener("click", function(e){
      const btn = e.target && e.target.closest && e.target.closest("#cs-jssubmit, #cs-csssubmit");
      if (!btn) return;
      const ed = editorBySaveId(btn.id);
      if (!ed || !ed.cm) return;
      ed.cm.save(); // make sure the textarea has the latest content for CyTube
      if (ed.allowSaveOnce) { ed.allowSaveOnce = false; return; } // already confirmed → let it through
      const { errors, warnings } = ed.run(ed.cm.getValue());
      if (!errors.length) return; // no real errors → let CyTube save (warnings don't block)
      e.preventDefault();
      e.stopImmediatePropagation();
      showSaveConfirm(ed, errors, warnings, () => { ed.allowSaveOnce = true; btn.click(); });
    }, true);
  }

  /* ---------------- lazy init wiring ---------------- */
  function maybeInit(){
    const visible = EDITORS.filter(paneVisible);
    if (!visible.length) return;
    ensureLibs().then(() => visible.forEach(initEditor)).catch(err => console.warn("[js-editor] lib load failed", err));
  }
  function attach(){
    const modal = document.getElementById("channeloptions");
    if (modal && !modal._btfwJsObs) {
      let deb = null;
      const mo = new MutationObserver(() => {
        if (deb) return;
        deb = setTimeout(() => { deb = null; maybeInit(); }, 120);
      });
      // Only watch class/style flips (tab show/hide) — not every childList mutation —
      // so typing in the editor doesn't churn the observer.
      mo.observe(modal, { subtree: true, attributes: true, attributeFilter: ["class","style"] });
      modal._btfwJsObs = mo;
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
