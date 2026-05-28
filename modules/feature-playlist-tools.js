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
      <span id="btfw-pl-matchinfo" class="btfw-pl-matchinfo" aria-live="polite"></span>
    `;
    // Put it at the top of the header container
    header.insertBefore(bar, header.firstChild);

    wireFilter();
    wireScrollToCurrent();
    bindFilterKeys();
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

    const entries = $$("#queue > .queue_entry");
    entries.forEach(li => {
      const text = (li.textContent || "").toLowerCase();
      const ok = term ? text.includes(term) : true;
      li.style.display = ok ? "" : "none";
      if (ok) visible++;
    });
    updateCount(visible);
    updateMatchInfo(term, visible, entries.length);
  }

  /* Show "X of Y" (or "No matches") next to the filter while it's active. */
  function updateMatchInfo(term, matches, total){
    const el = $("#btfw-pl-matchinfo");
    if (!el) return;
    if (!term) {
      el.textContent = "";
      el.classList.remove("is-visible", "is-empty");
      return;
    }
    el.classList.add("is-visible");
    if (!matches) {
      el.textContent = "No matches";
      el.classList.add("is-empty");
    } else {
      el.textContent = `${matches} of ${total}`;
      el.classList.remove("is-empty");
    }
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
    // Esc clears the filter while it's focused.
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        input.value = "";
        lastQ = "";
        applyFilter("");
        input.blur();
      }
    });
    clear.addEventListener("click", (e)=>{
      e.preventDefault();
      input.value = "";
      lastQ = "";
      applyFilter("");
      input.focus();
    });
  }

  /* Press "/" anywhere (outside a text field) to jump to the playlist filter. */
  function bindFilterKeys(){
    if (document._btfwPlFilterKeys) return;
    document._btfwPlFilterKeys = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const tag = (t && t.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      const input = $("#btfw-pl-filter");
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
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

  /* ---------- Faster drag auto-scroll ----------
     CyTube leaves jQuery UI's sortable on its defaults (scrollSpeed 20,
     scrollSensitivity 20), which crawls when you drag an item across a long
     queue. Widen the trigger zone and roughly double the speed so dragging
     from the bottom of a few-hundred-item list to the top is bearable. */
  function tuneSortableScroll(){
    const jq = window.jQuery || window.$;
    const $q = jq && jq("#queue");
    if (!$q || !$q.length || !$q.data("uiSortable")) return false;
    $q.sortable("option", {
      scroll: true,
      scrollSensitivity: 70,
      scrollSpeed: 45
    });
    return true;
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

  /* ---------- Glyphicon -> FontAwesome swap ----------
     CyTube's playlist buttons ship with Bootstrap 3 Glyphicons whose font
     metrics don't sit at the optical center of our pill buttons (~1px
     baseline offset) and look out-of-set against the rest of the UI which
     uses FontAwesome 6. Replace each known glyph with its FA equivalent
     at runtime so the icons render uniformly. */
  const GLYPH_TO_FA = {
    "showsearch":          "fa-magnifying-glass",
    "showcustomembed":     "fa-code",
    "showplaylistmanager": "fa-list",
    "clearplaylist":       "fa-trash",
    "shuffleplaylist":     "fa-shuffle",
    // qlockbtn is handled separately (relocated to the footer + state-aware
    // lock icon) — see ensureLockButton() below.
    "getplaylist":         "fa-link",
    "showmediaurl":        "fa-link"
  };
  function swapGlyphiconsToFA(){
    for (const [btnId, faClass] of Object.entries(GLYPH_TO_FA)) {
      const btn = document.getElementById(btnId);
      if (!btn) continue;
      const glyph = btn.querySelector(".glyphicon");
      if (!glyph) continue;
      const next = document.createElement("i");
      next.className = "fa " + faClass;
      glyph.replaceWith(next);
    }
  }

  /* ---------- Playlist lock button: move to the footer + lock icon ----------
     CyTube's #qlockbtn ships with a Glyphicon check and gets swept into the
     top toolbar, where its purpose is unclear. Relocate it to the playlist
     footer (#plmeta, far right) and give it a state-aware lock icon: an open
     lock when the playlist is unlocked, a closed lock when locked. CyTube
     toggles the button's title ("Playlist Locked"/"Playlist Unlocked") and
     btn-danger/btn-success class, so we mirror that into the icon. */
  function lockIsLocked(btn){
    const title = (btn.getAttribute("title") || "").toLowerCase();
    if (title.includes("unlock")) return false;
    if (title.includes("lock"))   return true;
    return btn.classList.contains("btn-danger"); // fallback
  }
  function syncLockIcon(btn){
    if (!btn) return;
    let icon = btn.querySelector("i.fa, .glyphicon");
    if (!icon) { icon = document.createElement("i"); btn.prepend(icon); }
    icon.className = "fa " + (lockIsLocked(btn) ? "fa-lock" : "fa-lock-open");
  }
  function ensureLockButton(){
    const btn  = document.getElementById("qlockbtn");
    const meta = document.getElementById("plmeta");
    if (!btn || !meta) return;
    btn.classList.add("btfw-pllock");
    if (btn.parentElement !== meta) meta.appendChild(btn);
    syncLockIcon(btn);
    // Keep the icon in sync when CyTube flips the lock state (it rewrites the
    // button's title/class, which also re-creates the inner glyph).
    if (!btn._btfwLockObs) {
      btn._btfwLockObs = new MutationObserver(() => syncLockIcon(btn));
      btn._btfwLockObs.observe(btn, { attributes: true, attributeFilter: ["title", "class"], childList: true });
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
    swapGlyphiconsToFA();
    ensureLockButton();
    // feature:stack sweeps the native controls into the toolbar; relocate the
    // lock button into the footer just after, and retry in case stack runs late.
    [0, 200, 600, 1200].forEach(t => setTimeout(ensureLockButton, t));
    // The sortable is created once CyTube populates the queue — retry until it
    // exists, then stop.
    [0, 500, 1500, 3000].forEach(t => setTimeout(tuneSortableScroll, t));

    // Set up optimized observers instead of the old ones
    setupOptimizedObservers();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
