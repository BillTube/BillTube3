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
          <input id="btfw-pl-filter" class="input is-small" type="text" placeholder="Filter playlist…  (press / )">
        </p>
        <p class="control">
          <button id="btfw-pl-favtoggle" class="button is-small" type="button" title="Show favorites only" aria-pressed="false"><i class="fa fa-star"></i></button>
        </p>
        <p class="control">
          <button id="btfw-pl-help" class="button is-small" type="button" title="Filter tips" aria-expanded="false"><i class="fa fa-circle-question"></i></button>
        </p>
        <p class="control">
          <button id="btfw-pl-clear" class="button is-small" title="Clear filter"><i class="fa fa-times"></i></button>
        </p>
        <p class="control">
          <button id="btfw-pl-scroll" class="button is-small" title="Scroll to current"><i class="fa fa-location-arrow"></i></button>
        </p>
      </div>
      <span id="btfw-pl-matchinfo" class="btfw-pl-matchinfo" aria-live="polite"></span>
      <div id="btfw-pl-help-pop" class="btfw-pl-help-pop" hidden>
        <div class="btfw-pl-help-title">Filter tips</div>
        <ul>
          <li><code>horror</code> — words match the title</li>
          <li><code>type:</code><span>yt · drive · file · vimeo · twitch</span></li>
          <li><code>user:</code><span>name — who added it</span></li>
          <li><code>&gt;1h</code> <code>&lt;30m</code> — by duration</li>
          <li><code>temp</code> — temporary items only</li>
        </ul>
        <div class="btfw-pl-help-eg">e.g. <code>type:yt &gt;10m space</code></div>
      </div>
    `;
    // Put it at the top of the header container
    header.insertBefore(bar, header.firstChild);

    wireFilter();
    wireScrollToCurrent();
    bindFilterKeys();
    wireFilterHelp();
    wireFavToggle();
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

  /* ---------- uid -> adder map (for the user: filter) ----------
     Queue rows don't carry the adder in the DOM, but the socket "playlist"
     payload does (each item has {uid, queueby, ...}). Build a lazy map keyed
     by uid (the pluid-N class) so `user:name` can filter. */
  const adderByUid = Object.create(null);
  function ingestPlaylist(items){
    if (!Array.isArray(items)) return;
    items.forEach(it => { if (it && it.uid != null) adderByUid[it.uid] = String(it.queueby || "").toLowerCase(); });
  }
  function wireAdderMap(){
    const s = window.socket;
    if (!s || s._btfwAdderWired) return;
    s._btfwAdderWired = true;
    try {
      s.on("playlist", ingestPlaylist);
      s.on("queue", (d) => { if (d && d.item) ingestPlaylist([d.item]); });
      s.emit("requestPlaylist"); // populate for the items already loaded
    } catch (_) {}
  }
  function uidOf(li){
    const m = (li.className || "").match(/pluid-(\d+)/);
    return m ? m[1] : null;
  }

  /* ---------- Filter logic (client-side, with operators) ----------
     Plain words match the title. Operators (AND-combined):
       type:yt|drive|file|vimeo|twitch|dm|sc   source
       user:name                                who added it
       >1h  <30m  >90m  <1:30                    duration
       temp                                      temporary items only          */
  function parseTimeText(txt){
    const p = String(txt || "").trim().split(":").map(n => parseInt(n, 10));
    if (p.some(isNaN) || !p.length) return null;
    return p.reduce((acc, n) => acc * 60 + n, 0); // h:m:s or m:s
  }
  function parseDuration(s){
    s = String(s || "").trim().toLowerCase();
    if (s.includes(":")) return parseTimeText(s);
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hours?|m|min|minutes?|s|sec|seconds?)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]); const unit = m[2] || "m";
    if (/^h/.test(unit)) return Math.round(n * 3600);
    if (/^s/.test(unit)) return Math.round(n);
    return Math.round(n * 60); // default minutes
  }
  function normalizeType(t){
    t = String(t || "").trim().toLowerCase();
    const map = { youtube:"yt", yt:"yt", drive:"drive", gdrive:"drive", googledrive:"drive",
      file:"file", files:"file", raw:"file", vimeo:"vimeo", twitch:"twitch",
      dailymotion:"dm", dm:"dm", soundcloud:"sc", sc:"sc", niconico:"nico", nico:"nico" };
    return map[t] || t;
  }
  function parseQuery(raw){
    const q = { text: [], type: null, user: null, dur: null, temp: false };
    (raw || "").trim().split(/\s+/).filter(Boolean).forEach(tok => {
      let m;
      if ((m = tok.match(/^type:(.+)$/i)))      q.type = normalizeType(m[1]);
      else if ((m = tok.match(/^user:(.+)$/i))) q.user = m[1].toLowerCase();
      else if (/^(temp|temporary)$/i.test(tok) || /^is:temp$/i.test(tok)) q.temp = true;
      else if ((m = tok.match(/^([<>])(.+)$/))) {
        const sec = parseDuration(m[2]);
        if (sec != null) q.dur = { op: m[1], sec }; else q.text.push(tok.toLowerCase());
      } else q.text.push(tok.toLowerCase());
    });
    return q;
  }
  function rowMatches(li, q){
    const a = li.querySelector("a.qe_title");
    const title = (a ? a.textContent : "").toLowerCase();
    if (q.text.length && !q.text.every(t => title.includes(t))) return false;
    if (q.type && detectMediaType(a && a.getAttribute("href")).key !== q.type) return false;
    if (q.temp && !li.classList.contains("queue_temp")) return false;
    if (q.user != null) {
      const u = adderByUid[uidOf(li)] || "";
      if (!u.includes(q.user)) return false;
    }
    if (q.dur) {
      const sec = parseTimeText(li.querySelector(".qe_time") && li.querySelector(".qe_time").textContent);
      if (sec == null) return false;
      if (q.dur.op === ">" && !(sec > q.dur.sec)) return false;
      if (q.dur.op === "<" && !(sec < q.dur.sec)) return false;
    }
    return true;
  }
  let lastQ = "";
  function applyFilter(q){
    const queue = $("#queue");
    if (!queue) return;
    const term = (q || "").trim();
    const parsed = parseQuery(q);
    const active = !!term || favoritesOnly;
    let visible = 0;
    const entries = $$("#queue > .queue_entry");
    entries.forEach(li => {
      let ok = term ? rowMatches(li, parsed) : true;
      if (ok && favoritesOnly) ok = isFavRow(li);
      li.style.display = ok ? "" : "none";
      if (ok) visible++;
    });
    updateCount(visible);
    updateMatchInfo(active, visible, entries.length);
  }

  /* Show "X of Y" (or "No matches") next to the filter while a filter or the
     favorites-only toggle is active. */
  function updateMatchInfo(active, matches, total){
    const el = $("#btfw-pl-matchinfo");
    if (!el) return;
    if (!active) {
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

  /* "?" button toggles the filter-syntax popover. */
  function wireFilterHelp(){
    const btn = $("#btfw-pl-help");
    const pop = $("#btfw-pl-help-pop");
    if (!btn || !pop) return;
    const close = () => { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); document.removeEventListener("click", onDoc, true); };
    const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (pop.hidden) {
        pop.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        setTimeout(() => document.addEventListener("click", onDoc, true), 0);
      } else close();
    });
  }

  /* ---------- Add a URL to the queue (reuses CyTube's own add flow) ---------- */
  function queueUrl(url, atEnd){
    url = String(url || "").trim();
    if (!url) return false;
    // Validate it's a recognizable media link before doing anything.
    let ok = true;
    if (typeof window.parseMediaLink === "function") {
      const d = window.parseMediaLink(url);
      ok = !!(d && d.type && d.id);
    }
    if (!ok) return false;
    const input = document.getElementById("mediaurl");
    const btn = document.getElementById(atEnd ? "queue_end" : "queue_next");
    if (input && btn) {
      input.value = url;
      btn.click();           // CyTube parses + emits + clears the field
      return true;
    }
    // Fallback: emit directly.
    try {
      const d = window.parseMediaLink(url);
      if (d && d.type && d.id && window.socket) {
        window.socket.emit("queue", { id: d.id, type: d.type, pos: atEnd ? "end" : "next", temp: false });
        return true;
      }
    } catch (_) {}
    return false;
  }
  function looksLikeUrl(s){
    s = String(s || "").trim();
    if (!/^https?:\/\//i.test(s) && !/^[\w.-]+\.[a-z]{2,}\//i.test(s)) return false;
    if (typeof window.parseMediaLink === "function") {
      const d = window.parseMediaLink(s);
      return !!(d && d.type && d.id);
    }
    return /^https?:\/\//i.test(s);
  }

  /* ---------- Drag-and-drop a link onto the playlist to queue it ---------- */
  function wireDropToQueue(){
    const zone = $("#queue") ? $("#queue").parentElement : null;
    const queue = $("#queue");
    const target = zone || queue;
    if (!target || target._btfwDropWired) return;
    target._btfwDropWired = true;

    const show = (on) => { (queue || target).classList.toggle("btfw-pl-dropping", !!on); };
    target.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      // Only react to link/text drags.
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.some(t => /uri-list|text\/plain|text\/uri/i.test(t))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      show(true);
    });
    target.addEventListener("dragleave", (e) => {
      if (e.target === target || !target.contains(e.relatedTarget)) show(false);
    });
    target.addEventListener("drop", (e) => {
      show(false);
      if (!e.dataTransfer) return;
      const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "";
      const url = raw.split(/\s+/).find(looksLikeUrl) || raw.trim();
      if (!looksLikeUrl(url)) return;
      e.preventDefault();
      if (queueUrl(url, true)) toast("Added to playlist", "success");
      else toast("That link isn't a recognized media URL", "error");
    });
  }

  /* ---------- Smart paste: paste a media URL (not in a field) -> offer to add ---------- */
  function showAddPrompt(url){
    const bar = $("#btfw-plbar");
    if (!bar) return;
    let p = $("#btfw-pl-addprompt");
    if (!p) {
      p = document.createElement("div");
      p.id = "btfw-pl-addprompt";
      p.className = "btfw-pl-addprompt";
      bar.appendChild(p);
    }
    p.innerHTML = `
      <span class="btfw-pl-addprompt__label"><i class="fa fa-link"></i> Add pasted link?</span>
      <span class="btfw-pl-addprompt__url"></span>
      <button type="button" class="button is-small is-primary" data-act="end">Add</button>
      <button type="button" class="button is-small" data-act="next">Play next</button>
      <button type="button" class="button is-small btfw-pl-addprompt__x" data-act="dismiss">&times;</button>`;
    p.querySelector(".btfw-pl-addprompt__url").textContent = url.length > 60 ? url.slice(0, 57) + "…" : url;
    p.classList.add("is-visible");
    const done = () => { p.classList.remove("is-visible"); clearTimeout(p._t); };
    p.querySelectorAll("button").forEach(b => b.onclick = () => {
      const act = b.getAttribute("data-act");
      if (act === "end" || act === "next") {
        if (queueUrl(url, act === "end")) toast(act === "end" ? "Added to playlist" : "Queued to play next", "success");
        else toast("Couldn't add that link", "error");
      }
      done();
    });
    clearTimeout(p._t);
    p._t = setTimeout(done, 12000); // auto-dismiss
  }
  function wireSmartPaste(){
    if (document._btfwPlPaste) return;
    document._btfwPlPaste = true;
    document.addEventListener("paste", (e) => {
      const t = e.target;
      const tag = (t && t.tagName || "").toUpperCase();
      // Ignore pastes into real input fields (incl. our filter / chat / mediaurl).
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
      const url = text.split(/\s+/).find(looksLikeUrl);
      if (url) showAddPrompt(url);
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

  /* ---------- Media-type badge per row ----------
     A tiny source icon (YouTube / Vimeo / Drive / file / …) so each row's
     origin is obvious at a glance. PERFORMANCE: badges are added lazily via an
     IntersectionObserver scoped to #queue — only rows actually scrolled into
     view get one, each is processed once (cached on a data flag), then the row
     is unobserved. Nothing runs for the hundreds of off-screen items, so this
     never touches initial load or scroll cost. */
  function detectMediaType(href){
    let host = "";
    try { host = new URL(href || "", location.href).hostname.toLowerCase(); } catch (_) {}
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return { key:"yt",     icon:"fa-brands fa-youtube",       label:"YouTube" };
    if (/(^|\.)vimeo\.com$/.test(host))                    return { key:"vimeo",  icon:"fa-brands fa-vimeo",         label:"Vimeo" };
    if (/(^|\.)twitch\.tv$/.test(host))                    return { key:"twitch", icon:"fa-brands fa-twitch",        label:"Twitch" };
    if (/(^|\.)dailymotion\.com$|(^|\.)dai\.ly$/.test(host)) return { key:"dm",   icon:"fa-brands fa-dailymotion",   label:"Dailymotion" };
    if (/(^|\.)soundcloud\.com$/.test(host))               return { key:"sc",     icon:"fa-brands fa-soundcloud",    label:"SoundCloud" };
    if (/(^|\.)nicovideo\.jp$/.test(host))                 return { key:"nico",   icon:"fa-solid fa-tv",             label:"Niconico" };
    // The Drive index worker proxies Google Drive files for this channel.
    if (/drive\.google\.com$/.test(host) || /\.workers\.dev$/.test(host)) return { key:"drive", icon:"fa-brands fa-google-drive", label:"Google Drive" };
    return { key:"file", icon:"fa-solid fa-film", label:"File" };
  }
  function ensureBadge(li){
    if (!li || li.dataset.btfwBadged) return;
    li.dataset.btfwBadged = "1";
    const a = li.querySelector("a.qe_title");
    if (!a) return;
    const href = a.getAttribute("href");
    const t = detectMediaType(href);
    const badge = document.createElement("span");
    badge.className = "btfw-pl-badge btfw-pl-badge--" + t.key;
    badge.title = t.label;
    badge.setAttribute("aria-label", t.label);
    badge.innerHTML = `<i class="${t.icon}" aria-hidden="true"></i>`;
    li.insertBefore(badge, li.firstChild);
    // Favorite star (leftmost) — reflects the saved set.
    const star = document.createElement("span");
    star.className = "btfw-pl-star" + (favorites.has(favKeyOf(href, a.textContent)) ? " is-fav" : "");
    star.title = "Favorite";
    star.setAttribute("role", "button");
    star.setAttribute("aria-label", "Toggle favorite");
    star.innerHTML = `<i class="fa fa-star" aria-hidden="true"></i>`;
    li.insertBefore(star, li.firstChild);
  }
  let badgeObserver = null;
  function ensureBadgeObserver(){
    const queue = document.getElementById("queue");
    if (!queue) return;
    if (!badgeObserver) {
      badgeObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          ensureBadge(e.target);
          badgeObserver.unobserve(e.target); // one-shot per row
        });
      }, { root: queue, rootMargin: "320px 0px", threshold: 0 });
    }
    // Observe any rows that don't have a badge yet (cheap; IO handles the rest).
    queue.querySelectorAll(".queue_entry:not([data-btfw-badged])").forEach(li => badgeObserver.observe(li));
  }

  /* ---------- Favorites ----------
     Star items and filter to favorites only. Keyed by a STABLE media identity
     (video id / Drive file id / host+path) rather than the row uid or signed
     URL, so favorites survive reloads and re-signed worker links. */
  const FAV_KEY = "btfw:pl:favorites";
  let favoritesOnly = false;
  let favorites = (function(){ try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch(_) { return new Set(); } })();
  function saveFavorites(){ try { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); } catch(_){} }
  function favKeyOf(href, title){
    try {
      const u = new URL(href || "", location.href);
      const host = u.hostname.toLowerCase();
      if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "yt:" + (u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop() || "");
      if (/\.workers\.dev$/.test(host)) { const f = u.searchParams.get("file"); if (f) return "wk:" + f; }
      return host + u.pathname; // ignore query (carries expiry/mac for signed links)
    } catch(_) {}
    return "t:" + String(title || "").trim().toLowerCase();
  }
  function favKeyOfRow(li){ const a = li.querySelector("a.qe_title"); return a ? favKeyOf(a.getAttribute("href"), a.textContent) : null; }
  function isFavRow(li){ const k = favKeyOfRow(li); return k ? favorites.has(k) : false; }
  function curFilterValue(){ const i = $("#btfw-pl-filter"); return (i && i.value) || ""; }
  function wireFavStars(){
    const queue = $("#queue");
    if (!queue || queue._btfwFavDelegated) return;
    queue._btfwFavDelegated = true;
    queue.addEventListener("click", (e) => {
      const star = e.target.closest && e.target.closest(".btfw-pl-star");
      if (!star) return;
      e.preventDefault(); e.stopPropagation();
      const li = star.closest(".queue_entry");
      const k = li && favKeyOfRow(li);
      if (!k) return;
      if (favorites.has(k)) { favorites.delete(k); star.classList.remove("is-fav"); }
      else { favorites.add(k); star.classList.add("is-fav"); }
      saveFavorites();
      if (favoritesOnly) applyFilter(curFilterValue()); // drop it from view if unstarred
    }, true);
  }
  function wireFavToggle(){
    const btn = $("#btfw-pl-favtoggle");
    if (!btn || btn._btfwWired) return;
    btn._btfwWired = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      favoritesOnly = !favoritesOnly;
      btn.classList.toggle("is-active", favoritesOnly);
      btn.setAttribute("aria-pressed", favoritesOnly ? "true" : "false");
      applyFilter(curFilterValue());
    });
  }

  /* ---------- "Starts in ~Xh Ym" hover tooltip ----------
     A single shared, body-level tooltip computed on hover only (nothing added
     per row). Sums durations from the currently-playing item up to the hovered
     one (subtracting elapsed time of the current item when the player exposes
     it). Hover is user-paced, so the O(n) walk is cheap and never on a frame. */
  function fmtDur(sec){
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${sec}s`;
  }
  function startsInFor(li){
    const queue = document.getElementById("queue");
    if (!queue) return null;
    const rows = Array.from(queue.querySelectorAll(".queue_entry"));
    const active = queue.querySelector(".queue_active");
    if (!active) return null;
    const ai = rows.indexOf(active), ti = rows.indexOf(li);
    if (ai < 0 || ti < 0) return null;
    if (ti === ai) return "Playing now";
    if (ti < ai) return null; // already played (no loop assumption)
    const qt = el => parseTimeText(el && el.querySelector(".qe_time") && el.querySelector(".qe_time").textContent) || 0;
    let elapsed = 0;
    try { if (window.PLAYER && typeof PLAYER.getTime === "function") elapsed = PLAYER.getTime() || 0; } catch(_){}
    let sec = Math.max(0, qt(active) - elapsed);
    for (let i = ai + 1; i < ti; i++) sec += qt(rows[i]);
    return "Starts in ~" + fmtDur(sec);
  }
  function wireStartsInTip(){
    const queue = $("#queue");
    if (!queue || queue._btfwTipWired) return;
    queue._btfwTipWired = true;
    let tip = document.getElementById("btfw-pl-tip");
    if (!tip) { tip = document.createElement("div"); tip.id = "btfw-pl-tip"; tip.className = "btfw-pl-tip"; document.body.appendChild(tip); }
    const hide = () => { tip.classList.remove("is-visible"); tip._row = null; };
    queue.addEventListener("mouseover", (e) => {
      const li = e.target.closest && e.target.closest(".queue_entry");
      if (!li || !queue.contains(li)) { hide(); return; }
      if (tip._row === li && tip.classList.contains("is-visible")) return;
      const txt = startsInFor(li);
      if (!txt) { hide(); return; }
      tip._row = li;
      tip.textContent = txt;
      const r = li.getBoundingClientRect();
      tip.style.left = Math.round(r.right - 12) + "px";
      tip.style.top  = Math.round(r.top - 8) + "px";
      tip.classList.add("is-visible");
    });
    queue.addEventListener("mouseleave", hide);
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
          ensureBadgeObserver();    // observe any newly-added rows for badges
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
    ensureBadgeObserver();
    wireAdderMap();      // socket-driven; only fires on playlist events
    wireDropToQueue();   // drag a link onto the playlist to add it
    wireSmartPaste();    // paste a media URL (outside a field) -> "Add this?"
    wireFavStars();      // delegated star-toggle clicks
    wireStartsInTip();   // hover tooltip: when an item will play

    // Set up optimized observers instead of the old ones
    setupOptimizedObservers();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
