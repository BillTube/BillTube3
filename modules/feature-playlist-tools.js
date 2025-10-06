/* BTFW — feature:playlist-tools (merged helpers: search, scroll-to-current, poll add) */
BTFW.define("feature:playlist-tools", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  /* ---------- Toolbar injection ---------- */
  function injectToolbar(){
    if ($("#btfw-plbar")) return; // already added

    // Try to anchor near the playlist controls
    const header = $("#playlistwrap")
               || $("#ploptions")
               || $("#queue")?.parentElement
               || $("#queue")?.closest(".well")
               || $("#btfw-leftpad");
    if (!header) return;

    const bar = document.createElement("div");
    bar.id = "btfw-plbar";
    bar.className = "btfw-plbar";

    bar.innerHTML = `
      <div class="field has-addons" style="margin:0;">
        <p class="control is-expanded">
          <input id="btfw-pl-filter" class="input is-small" type="text" placeholder="Filter playlist…">
        </p>
        <p class="control">
          <button id="btfw-pl-clear" class="button is-small" title="Clear filter"><i class="fa fa-times"></i></button>
        </p>
        <p class="control">
          <button id="btfw-pl-scroll" class="button is-small" title="Scroll to current"><i class="fa fa-location-arrow"></i></button>
        </p>
      </div>
      <span id="btfw-pl-count" class="is-size-7" style="opacity:.75;"></span>
    `;
    // Put it at the top of the header container
    header.insertBefore(bar, header.firstChild);

    wireFilter();
    wireScrollToCurrent();
    updateCount(); // initial count
  }

  /* ---------- Copy titles toggle + helpers ---------- */
  let copyTitlesEnabled = false;
  let copyTitlesToggle = null;

  function ensureCopyTitlesToggle(){
    const bar = $("#btfw-plbar");
    if (!bar) return;

    let actions = bar.querySelector(".btfw-plbar__actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "btfw-plbar__actions";
      bar.appendChild(actions);
    }

    if (copyTitlesToggle && copyTitlesToggle.isConnected) {
      updateCopyTitlesToggleAppearance();
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btfw-pl-copytoggle";
    btn.className = "button is-dark is-small btfw-plbar__action-btn";
    btn.textContent = "Copy titles";
    btn.setAttribute("aria-pressed", copyTitlesEnabled ? "true" : "false");
    btn.addEventListener("click", () => {
      copyTitlesEnabled = !copyTitlesEnabled;
      updateCopyTitlesToggleAppearance();
      ensureCopyTitleButtons();
      toast(copyTitlesEnabled ? "Copy buttons enabled" : "Copy buttons disabled", "info");
    });

    actions.appendChild(btn);
    copyTitlesToggle = btn;
    updateCopyTitlesToggleAppearance();
  }

  function updateCopyTitlesToggleAppearance(){
    if (!copyTitlesToggle) return;
    copyTitlesToggle.setAttribute("aria-pressed", copyTitlesEnabled ? "true" : "false");
    copyTitlesToggle.classList.toggle("is-success", copyTitlesEnabled);
    copyTitlesToggle.classList.toggle("is-dark", !copyTitlesEnabled);
    copyTitlesToggle.classList.toggle("is-outlined", copyTitlesEnabled);
  }

  function ensureCopyTitleButtons(){
    const entries = $$("#queue > .queue_entry");
    if (!entries.length) return;

    entries.forEach(li => {
      const group = li.querySelector(".btn-group");
      if (!group) return;
      const existing = group.querySelector(".btfw-qbtn-copytitle");
      if (copyTitlesEnabled) {
        if (existing) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-xs btn-default qbtn-copytitle btfw-qbtn-copytitle";
        btn.setAttribute("title", "Copy title and URL");
        btn.innerHTML = `<span class="glyphicon glyphicon-copy"></span>Copy`;
        group.appendChild(btn);
      } else if (existing) {
        existing.remove();
      }
    });
  }

  async function copyTitleForEntry(entry){
    if (!entry) return false;
    const titleAnchor = entry.querySelector(".qe_title") || entry.querySelector("a");
    if (!titleAnchor) return false;
    const rawTitle = (titleAnchor.textContent || "").trim();
    const href = titleAnchor.getAttribute("href") || "";
    if (!rawTitle || !href) return false;

    const formattedTitle = formatTitleForCopy(rawTitle);
    const payload = formattedTitle ? `${href} ${formattedTitle}` : href;
    const ok = await copyToClipboard(payload);
    if (ok) toast(`Copied \"${formattedTitle}\"`, "success");
    else toast("Unable to copy to clipboard", "warn");
    return ok;
  }

  function formatTitleForCopy(raw){
    if (!raw) return "";
    let text = String(raw).trim();
    if (!text) return "";

    const yearMatch = text.match(/\b(19|20)\d{2}\b(?!.*\b(19|20)\d{2}\b)/);
    let year = "";
    if (yearMatch) {
      year = yearMatch[0];
      const idx = yearMatch.index ?? text.indexOf(year);
      if (idx > -1) {
        text = `${text.slice(0, idx)} ${text.slice(idx + year.length)}`;
      }
    }

    text = text.replace(/\s+/g, " ").trim();

    const titled = text.replace(/\b([A-Za-z][^\s]*)/g, (word) => {
      if (word.toUpperCase() === word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

    return year ? `${titled}${titled ? " " : ""}(${year})` : titled;
  }

  async function copyToClipboard(text){
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch(_){}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch(_){}

    return false;
  }

  function wireCopyTitleButtons(){
    const queue = $("#queue");
    if (!queue || queue._btfwCopyTitleDelegated) return;
    queue._btfwCopyTitleDelegated = true;
    queue.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.(".btfw-qbtn-copytitle");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const entry = btn.closest(".queue_entry");
      copyTitleForEntry(entry);
    }, true);
  }

  /* ---------- Filter logic (client-side) ---------- */
  let lastQ = "";
  function applyFilter(q){
    const queue = $("#queue");
    if (!queue) return;
    let visible = 0;
    const term = (q || "").trim().toLowerCase();

    $$("#queue > .queue_entry").forEach(li => {
      const text = (li.textContent || "").toLowerCase();
      const ok = term ? text.includes(term) : true;
      li.style.display = ok ? "" : "none";
      if (ok) visible++;
    });
    updateCount(visible);
  }
  
  function wireFilter(){
    const input = $("#btfw-pl-filter");
    const clear = $("#btfw-pl-clear");
    if (!input) return;

    const debounced = debounce(() => {
      const q = input.value || "";
      if (q === lastQ) return;
      lastQ = q;
      applyFilter(q);
    }, 120);

    input.addEventListener("input", debounced);
    clear.addEventListener("click", (e)=>{
      e.preventDefault();
      input.value = "";
      lastQ = "";
      applyFilter("");
      input.focus();
    });
  }
  
  function updateCount(known){
    const count = $("#btfw-pl-count");
    const queue = $("#queue");
    if (!count || !queue) return;
    const n = (known != null) ? known :
      $$("#queue > .queue_entry").filter(li => li.style.display !== "none").length;
    count.textContent = n ? `${n} item${n===1?"":"s"}` : "";
  }

  /* ---------- Scroll to current ---------- */
  function wireScrollToCurrent(){
    const btn = $("#btfw-pl-scroll");
    const queue = $("#queue");
    if (!btn || !queue) return;
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      const active = $("#queue .queue_active");
      if (!active) return;
      const r = active.getBoundingClientRect();
      const qR = queue.getBoundingClientRect();
      // Center-ish the active item in view
      queue.scrollTop += (r.top - qR.top) - (qR.height * 0.3);
    });
  }

  /* ---------- OPTIMIZED: Playlist entry → Poll option helper ---------- */
  function ensureQueuePollButtons() {
    // Only process visible items to avoid adding buttons to hundreds of hidden items
    const visibleItems = Array.from(document.querySelectorAll('#queue > .queue_entry'))
      .filter(li => {
        // Check if item is visible
        const style = window.getComputedStyle(li);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .slice(0, 50); // Only process first 50 visible items for performance
    
    visibleItems.forEach(li => {
      if (!li) return;
      const group = li.querySelector(".btn-group");
      if (!group) return;
      if (group.querySelector(".btfw-qbtn-pollcopy")) return; // Already has button
      
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-xs btn-default qbtn-pollcopy btfw-qbtn-pollcopy";
      btn.setAttribute("title", "Add this title to the poll");
      // Use simple text instead of icon for better performance
      btn.textContent = "Poll";
      
      const queueNext = group.querySelector(".qbtn-next");
      if (queueNext && queueNext.nextSibling) {
        group.insertBefore(btn, queueNext.nextSibling);
      } else if (queueNext) {
        group.appendChild(btn);
      } else {
        group.appendChild(btn);
      }
    });
  }

  function findOpenPollInputs(){
    const wrap = document.getElementById("pollwrap");
    if (!wrap || !wrap.isConnected) return null;
    const menu = wrap.querySelector(".poll-menu");
    if (!menu) return null;
    const wrapStyle = window.getComputedStyle(wrap);
    const menuStyle = window.getComputedStyle(menu);
    const hidden = value => value === "none" || value === "hidden" || value === "0";
    if (hidden(wrapStyle.display) || hidden(menuStyle.display) || hidden(wrapStyle.visibility) || hidden(menuStyle.visibility)) return null;
    if (Number.parseFloat(wrapStyle.opacity) === 0 || Number.parseFloat(menuStyle.opacity) === 0) return null;
    const inputs = $$(".poll-menu-option", menu).filter(input => input instanceof HTMLInputElement);
    if (!inputs.length) return null;
    return inputs;
  }

  function wireQueuePollCopy(){
    const queue = $("#queue");
    if (!queue || queue._btfwPollCopyDelegated) return;
    queue._btfwPollCopyDelegated = true;
    queue.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.(".btfw-qbtn-pollcopy");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const entry = btn.closest(".queue_entry");
      if (!entry) return;
      const titleEl = entry.querySelector(".qe_title") || entry.querySelector("a");
      const title = titleEl ? (titleEl.textContent || "").trim() : "";
      if (!title) { toast("No title found for this entry", "warn"); return; }

      const pollInputs = findOpenPollInputs();
      if (!pollInputs) { toast("No poll is open", "warn"); return; }
      const targetInput = pollInputs.find(input => !(input.value || "").trim());
      if (!targetInput) { toast("No empty poll option available", "warn"); return; }

      targetInput.value = title;
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      toast("Successfully added to poll options", "success");
    }, true);
  }

  /* ---------- Add-from-URL title sanitiser ---------- */
  const scrubTokens = ["720p", "brrip", "x264", "yify", "mp4"];
  const scrubPattern = new RegExp(`\\b(?:${scrubTokens.join("|")})\\b`, "gi");
  const titleInputSelectors = ["#addfromurl-title-val", "#mediaurl-title", ".media-title-input"];

  function sanitiseTitleInput(value){
    if (!value) return "";

    let title = String(value);

    // Replace dot groups with spaces so words separate naturally
    title = title.replace(/\.+/g, " ");

    // Remove known metadata tokens (case-insensitive)
    scrubPattern.lastIndex = 0;
    title = title.replace(scrubPattern, " ");

    // Surround years with parentheses if not already wrapped
    title = title.replace(/\b(19|20)\d{2}\b/g, (match, _prefix, offset, src) => {
      const before = src[offset - 1];
      const after = src[offset + match.length];
      if (before === "(" && after === ")") return match;
      return `(${match})`;
    });

    // Collapse whitespace and trim edges
    return title.replace(/\s+/g, " ").trim();
  }

  let titleFilterObserver = null;
  function ensureAddFromUrlTitleFilter(){
    let anyBound = false;
    titleInputSelectors
      .flatMap(sel => Array.from(document.querySelectorAll(sel)))
      .forEach(input => {
        if (!(input instanceof HTMLInputElement)) return;
        if (input._btfwTitleFilterBound) { anyBound = true; return; }

        const apply = () => {
          const raw = input.value || "";
          const cleaned = sanitiseTitleInput(raw);
          if (cleaned === raw) return;

          const start = input.selectionStart;
          const end = input.selectionEnd;

          input.value = cleaned;

          if (typeof start === "number" && typeof end === "number") {
            const delta = cleaned.length - raw.length;
            const newStart = Math.max(0, start + delta);
            const newEnd = Math.max(0, end + delta);
            try { input.setSelectionRange(newStart, newEnd); } catch(_){}
          }
        };

        input.addEventListener("input", apply);
        input.addEventListener("change", apply);
        input.addEventListener("paste", () => requestAnimationFrame(apply));
        input._btfwTitleFilterBound = true;

        // Normalise any pre-filled value immediately
        apply();
        anyBound = true;
      });

    if (!titleFilterObserver) {
      const target = document.getElementById("addfromurl") || document.body;
      titleFilterObserver = new MutationObserver(() => ensureAddFromUrlTitleFilter());
      titleFilterObserver.observe(target, { childList: true, subtree: true });
    }

    return anyBound;
  }

  const tempCheckboxKey = "btfw:addfromurl:addTemp";
  let addTempObserver = null;
  function ensureAddTempPreference(){
    const checkbox = document.querySelector("#addfromurl input.add-temp");
    if (!(checkbox instanceof HTMLInputElement)) {
      if (!addTempObserver) {
        const target = document.getElementById("addfromurl") || document.body;
        addTempObserver = new MutationObserver(() => ensureAddTempPreference());
        addTempObserver.observe(target, { childList: true, subtree: true });
      }
      return false;
    }
    if (checkbox._btfwTempPersistBound) return true;

    try {
      const stored = localStorage.getItem(tempCheckboxKey);
      if (stored != null) checkbox.checked = stored === "true";
    } catch(_){}

    checkbox.addEventListener("change", () => {
      try { localStorage.setItem(tempCheckboxKey, checkbox.checked ? "true" : "false"); }
      catch(_){}
    });

    checkbox._btfwTempPersistBound = true;

    return true;
  }

  /* ---------- Utils ---------- */
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  
  function toast(msg, kind="info"){
    const text = (msg == null) ? "" : String(msg).trim();
    if (!text) return;
    try {
      const notify = window.BTFW_notify;
      if (notify && typeof notify.notify === "function") {
        const type = (kind && typeof notify[kind] === "function") ? kind : "info";
        const fn = (type === "info") ? notify.info : notify[type];
        const icons = { info: "📝", success: "✅", warn: "⚠️", error: "⚠️" };
        fn({
          title: "Playlist",
          html: `<span>${escapeHtml(text)}</span>`,
          icon: icons[type] || icons.info,
          timeout: type === "success" ? 4200 : 5200
        });
        return;
      }
    } catch(_){}
    try {
      if (window.makeAlert) { makeAlert("Playlist", text).insertBefore("#motdrow"); return; }
    } catch(_){}
    console.log("[playlist-tools]", text);
  }
  
  function escapeHtml(str){
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  /* ---------- OPTIMIZED MutationObserver Setup ---------- */
  function setupOptimizedObservers() {
    // Container observer (debounced)
    const container = $("#queuecontainer") || $("#playlistwrap") || document.body;
    if (container && !container._btfw_pl_obs_optimized) {
      container._btfw_pl_obs_optimized = true;
      
      let observerTimeout;
      const debouncedCallback = () => {
        clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
          injectToolbar();
          ensureCopyTitlesToggle();
          ensureQueuePollButtons();
          ensureCopyTitleButtons();
          ensureAddFromUrlTitleFilter();
          ensureAddTempPreference();
        }, 100); // Wait 100ms after last mutation
      };
      
      new MutationObserver(debouncedCallback).observe(container, { 
        childList: true, 
        subtree: true 
      });
    }
    
    // Queue observer for count updates (also debounced)
    const queue = $("#queue");
    if (queue && !queue._btfw_pl_count_obs_optimized) {
      queue._btfw_pl_count_obs_optimized = true;
      
      let queueTimeout;
      const debouncedQueueCallback = () => {
        clearTimeout(queueTimeout);
        queueTimeout = setTimeout(() => {
          updateCount();
          ensureQueuePollButtons(); // Re-add buttons to new visible items
          ensureCopyTitleButtons();
        }, 100);
      };

      new MutationObserver(debouncedQueueCallback).observe(queue, { 
        childList: true, 
        subtree: false // Don't need subtree for direct children
      });
    }
  }

  /* ---------- Boot & observe ---------- */
  function boot(){
    injectToolbar();
    ensureCopyTitlesToggle();
    ensureQueuePollButtons();
    ensureCopyTitleButtons();
    wireCopyTitleButtons();
    wireQueuePollCopy();
    ensureAddFromUrlTitleFilter();
    ensureAddTempPreference();
    
    // Set up optimized observers instead of the old ones
    setupOptimizedObservers();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
