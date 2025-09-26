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

  /* ---------- Playlist entry → Poll option helper ---------- */
  function ensureQueuePollButtons(){
    $$("#queue > .queue_entry").forEach(li => {
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
      if (!title) { toast("No title found for this entry"); return; }

      const pollInputs = findOpenPollInputs();
      if (!pollInputs) { toast("No poll is open"); return; }
      const targetInput = pollInputs.find(input => !(input.value || "").trim());
      if (!targetInput) { toast("No empty poll option available"); return; }

      targetInput.value = title;
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      toast("Successfully added to poll options");
    }, true);
  }

  /* ---------- Utils ---------- */
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function toast(msg){
    try {
      if (window.makeAlert) { makeAlert("Playlist", msg).insertBefore("#motdrow"); return; }
    } catch(_){}
    console.log("[playlist-tools]", msg);
  }

  /* ---------- Boot & observe ---------- */
  function boot(){
    injectToolbar();
    ensureQueuePollButtons();
    wireQueuePollCopy();

    // Re-ensure toolbar when playlist re-renders
    const container = $("#queuecontainer") || $("#playlistwrap") || document.body;
    if (container && !container._btfw_pl_obs) {
      container._btfw_pl_obs = true;
      new MutationObserver(()=> { injectToolbar(); ensureQueuePollButtons(); }).observe(container, { childList:true, subtree:true });
    }

    // Keep count roughly up-to-date as entries change
    const queue = $("#queue");
    if (queue && !queue._btfw_pl_count_obs) {
      queue._btfw_pl_count_obs = true;
      new MutationObserver(()=> { updateCount(); ensureQueuePollButtons(); }).observe(queue, { childList:true, subtree:true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
