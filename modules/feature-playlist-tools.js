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

  /* ---------- Virtual scrolling ---------- */
  const virtualScroll = (() => {
    const ITEM_HEIGHT = 40;
    const BUFFER_ITEMS = 10;
    const MIN_ITEMS = 50;

    let queue = null;
    let scrollContainer = null;
    let container = null;
    let spacer = null;
    let observer = null;
    let refreshTimer = null;
    let suppressMutations = false;
    let originalQueuePosition = "";
    let allItems = [];
    let filterTerm = "";
    let visibleCount = 0;
    let active = false;
    let refreshCallback = null;
    let releaseHandle = null;

    const beginMutations = () => {
      suppressMutations = true;
      if (releaseHandle) {
        clearTimeout(releaseHandle);
        releaseHandle = null;
      }
    };

    const endMutations = () => {
      if (!suppressMutations) return;
      if (releaseHandle) clearTimeout(releaseHandle);
      releaseHandle = setTimeout(() => {
        suppressMutations = false;
        releaseHandle = null;
      }, 0);
    };

    const notify = (result) => {
      if (typeof refreshCallback !== "function") return;
      try { refreshCallback(result); }
      catch (error) { console.warn("[playlist-tools] virtual scroll callback failed", error); }
    };

    const isQueueEntry = (node) => node instanceof HTMLElement && node.classList.contains("queue_entry");

    const ensureQueue = () => {
      const el = document.getElementById("queue");
      return (el && el.isConnected) ? el : null;
    };

    const findScrollContainer = () => {
      const q = ensureQueue();
      if (!q) return null;
      let parent = q.parentElement;
      while (parent && parent !== document.body) {
        const overflow = getComputedStyle(parent).overflowY;
        if (overflow === "auto" || overflow === "scroll") return parent;
        parent = parent.parentElement;
      }
      return q.parentElement || null;
    };

    const buildItems = (nodes) => nodes.map((el) => ({
      el,
      text: (el.textContent || "").toLowerCase(),
      matches: true
    }));

    const collectCombinedEntries = () => {
      const combined = [];
      const seen = new Set();
      allItems.forEach(item => {
        if (!item || !item.el) return;
        if (seen.has(item.el)) return;
        combined.push(item.el);
        seen.add(item.el);
      });
      const live = queue ? Array.from(queue.querySelectorAll(".queue_entry")) : [];
      live.forEach(el => {
        if (!seen.has(el)) {
          combined.push(el);
          seen.add(el);
        }
      });
      return combined;
    };

    const updateMatches = () => {
      const term = filterTerm;
      const hasFilter = !!term;
      visibleCount = 0;
      allItems.forEach(item => {
        if (!item || !item.el) return;
        const matches = !hasFilter || item.text.includes(term);
        item.matches = matches;
        if (matches) visibleCount++;
      });
      if (spacer) spacer.style.height = `${visibleCount * ITEM_HEIGHT}px`;
    };

    const updateVisibleItems = () => {
      if (!active || !container || !scrollContainer) return;
      beginMutations();
      container.innerHTML = "";
      const items = allItems.filter(item => item && item.matches);
      if (!items.length) {
        endMutations();
        return;
      }

      const viewportHeight = scrollContainer.clientHeight || 0;
      const scrollTop = scrollContainer.scrollTop || 0;
      const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
      const end = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_ITEMS);

      const fragment = document.createDocumentFragment();
      for (let i = start; i < end; i++) {
        const item = items[i];
        if (!item) continue;
        const el = item.el;
        if (!el) continue;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.right = "0";
        el.style.width = "100%";
        el.style.top = `${i * ITEM_HEIGHT}px`;
        el.style.display = "";
        fragment.appendChild(el);
      }

      container.appendChild(fragment);
      endMutations();
    };

    const attachObserver = () => {
      if (!queue) return;
      if (!observer) observer = new MutationObserver((mutations) => {
        if (!active || suppressMutations) return;
        const relevant = mutations.some(mutation => {
          if (mutation.type !== "childList") return false;
          if (Array.from(mutation.addedNodes).some(isQueueEntry)) return true;
          if (Array.from(mutation.removedNodes).some(isQueueEntry)) return true;
          return false;
        });
        if (relevant) scheduleRefresh();
      });
      observer.disconnect();
      observer.observe(queue, { childList: true, subtree: true });
    };

    const detachObserver = () => {
      if (observer) observer.disconnect();
    };

    const enable = () => {
      queue = ensureQueue();
      if (!queue) return false;
      const entries = Array.from(queue.children).filter(node => node instanceof HTMLElement && node.classList.contains("queue_entry"));
      if (entries.length <= MIN_ITEMS) return false;

      allItems = buildItems(entries);
      ensureQueuePollButtons(entries);

      scrollContainer = findScrollContainer();
      if (!scrollContainer) return false;

      beginMutations();

      originalQueuePosition = queue.style.position || "";
      queue.innerHTML = "";

      spacer = document.createElement("div");
      spacer.className = "playlist-virtual-spacer";

      container = document.createElement("div");
      container.className = "playlist-virtual-viewport";
      container.style.cssText = "position:absolute;top:0;left:0;right:0;will-change:transform;";

      queue.style.position = "relative";
      queue.appendChild(spacer);
      queue.appendChild(container);

      active = true;

      updateMatches();
      updateVisibleItems();
      scrollContainer.addEventListener("scroll", updateVisibleItems, { passive: true });
      attachObserver();

      endMutations();
      return true;
    };

    const disable = () => {
      if (!active) return false;
      queue = ensureQueue();
      if (!queue) return false;

      detachObserver();
      beginMutations();

      const combined = collectCombinedEntries();
      const fragment = document.createDocumentFragment();
      combined.forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        el.style.position = "";
        el.style.left = "";
        el.style.right = "";
        el.style.width = "";
        el.style.top = "";
        fragment.appendChild(el);
      });

      queue.innerHTML = "";
      queue.appendChild(fragment);

      if (scrollContainer) scrollContainer.removeEventListener("scroll", updateVisibleItems);
      if (originalQueuePosition) queue.style.position = originalQueuePosition;
      else queue.style.removeProperty("position");

      container = null;
      spacer = null;
      scrollContainer = null;
      allItems = [];
      visibleCount = combined.length;
      active = false;

      endMutations();
      return true;
    };

    const refresh = () => {
      queue = ensureQueue();
      if (!queue) return { changed: false, virtualized: false };

      const total = active ? allItems.length : queue.querySelectorAll(".queue_entry").length;
      if (total <= MIN_ITEMS) {
        const changed = disable();
        return { changed, virtualized: false };
      }

      const changed = active ? disable() : false;
      const enabled = enable();
      if (enabled && filterTerm) applyFilter(filterTerm);
      return { changed: changed || enabled, virtualized: active };
    };

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        const result = refresh();
        notify(result);
      }, 120);
    };

    const applyFilter = (term) => {
      filterTerm = term ? term.trim().toLowerCase() : "";
      if (!active) return null;
      updateMatches();
      updateVisibleItems();
      return visibleCount;
    };

    const init = () => {
      const attempt = () => {
        const q = ensureQueue();
        if (!q) return false;
        const entries = q.querySelectorAll(".queue_entry").length;
        if (entries <= MIN_ITEMS) return false;
        const enabled = enable();
        if (enabled) notify({ changed: true, virtualized: true });
        return enabled;
      };

      if (attempt()) return;

      const timer = setInterval(() => {
        if (attempt()) clearInterval(timer);
      }, 400);
      setTimeout(() => clearInterval(timer), 10000);
    };

    return {
      init,
      refresh,
      applyFilter,
      getVisibleCount: () => (active ? visibleCount : null),
      isActive: () => active,
      isRendering: () => suppressMutations,
      setRefreshCallback(fn) {
        refreshCallback = typeof fn === "function" ? fn : null;
      }
    };
  })();

  /* ---------- Filter logic (client-side) ---------- */
  let lastQ = "";
  function applyFilter(q){
    const queue = $("#queue");
    if (!queue) return;
    const term = (q || "").trim().toLowerCase();
    const handled = virtualScroll.applyFilter(term);

    if (handled != null) {
      updateCount(handled);
      return;
    }

    let visible = 0;
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
    if (!count) return;

    let total = (typeof known === "number") ? known : null;
    if (total == null) {
      const virtualCount = virtualScroll.getVisibleCount();
      if (typeof virtualCount === "number") total = virtualCount;
    }

    if (total == null) {
      const queue = $("#queue");
      if (!queue) return;
      total = $$("#queue > .queue_entry").filter(li => li.style.display !== "none").length;
    }

    count.textContent = total ? `${total} item${total===1?"":"s"}` : "";
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

  /* ---------- Playlist entry → Poll option helper ---------- */
  function ensureQueuePollButtons(items){
    const entries = Array.isArray(items)
      ? items.filter(Boolean)
      : $$("#queue > .queue_entry");
    entries.forEach(li => {
      if (!li) return;
      const group = li.querySelector(".btn-group");
      if (!group) return;
      if (group.querySelector(".btfw-qbtn-pollcopy")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-xs btn-default qbtn-pollcopy btfw-qbtn-pollcopy";
      btn.setAttribute("title", "Add this title to the poll");
      btn.innerHTML = `<i class="fa fa-clipboard"></i> Poll Title`;

      const queueNext = group.querySelector(".qbtn-next");
      if (queueNext && queueNext.nextSibling) group.insertBefore(btn, queueNext.nextSibling);
      else if (queueNext) group.appendChild(btn);
      else group.appendChild(btn);
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
  const titleInputSelectors = ["#addfromurl-title-val", "#mediaurl-title", ".media-title-input"]; // support legacy variants

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

  /* ---------- Boot & observe ---------- */
  function syncPlaylistMetrics(result){
    const virtualCount = result && result.virtualized ? virtualScroll.getVisibleCount() : null;
    if (lastQ) {
      applyFilter(lastQ);
    } else {
      updateCount(virtualCount);
    }
  }

  function boot(){
    injectToolbar();
    ensureQueuePollButtons();
    wireQueuePollCopy();
    ensureAddFromUrlTitleFilter();
    ensureAddTempPreference();

    virtualScroll.setRefreshCallback(syncPlaylistMetrics);
    virtualScroll.init();
    updateCount();

    // Re-ensure toolbar when playlist re-renders
    const container = $("#queuecontainer") || $("#playlistwrap") || document.body;
    if (container && !container._btfw_pl_obs) {
      container._btfw_pl_obs = true;
      new MutationObserver(()=> {
        if (virtualScroll.isRendering()) return;
        injectToolbar();
        ensureQueuePollButtons();
        ensureAddFromUrlTitleFilter();
        ensureAddTempPreference();
        const result = virtualScroll.refresh();
        syncPlaylistMetrics(result);
      }).observe(container, { childList:true, subtree:true });
    }

    // Keep count roughly up-to-date as entries change
    const queue = $("#queue");
    if (queue && !queue._btfw_pl_count_obs) {
      queue._btfw_pl_count_obs = true;
      new MutationObserver(()=> {
        if (virtualScroll.isRendering()) return;
        ensureQueuePollButtons();
        ensureAddFromUrlTitleFilter();
        ensureAddTempPreference();
        const result = virtualScroll.refresh();
        syncPlaylistMetrics(result);
      }).observe(queue, { childList:true, subtree:true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
