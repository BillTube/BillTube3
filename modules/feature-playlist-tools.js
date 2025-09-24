/* BTFW — feature:playlist-tools (merged helpers: search, scroll-to-current, poll add) */
BTFW.define("feature:playlist-tools", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  /* ---------- Title helpers ---------- */
  function bestDomCurrentTitle(){
    const el = $("#currenttitle");
    const raw = el && el.textContent ? el.textContent.trim() : "";
    return raw ? raw.replace(/^now\s*playing:\s*/i, "") : "";
  }
  function bestActiveEntryTitle(){
    const a = $('#queue .queue_active .qe_title a, #queue .queue_active .qe_title, #queue .queue_active a');
    return (a && a.textContent) ? a.textContent.trim() : "";
  }
  function bestPlayerTitle(){
    return (window.PLAYER && window.PLAYER.media && window.PLAYER.media.title)
      ? String(window.PLAYER.media.title) : "";
  }
  function getCurrentTitle(){
    return bestDomCurrentTitle() || bestActiveEntryTitle() || bestPlayerTitle() || "";
  }

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
        <p class="control">
          <button id="btfw-pl-poll" class="button is-small is-link" title="Add current title to Poll">
            <i class="fa fa-bar-chart"></i> Poll+
          </button>
        </p>
      </div>
      <span id="btfw-pl-count" class="is-size-7" style="opacity:.75;"></span>
    `;
    // Put it at the top of the header container
    header.insertBefore(bar, header.firstChild);

    wireFilter();
    wireScrollToCurrent();
    wireAddToPoll();
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

  /* ---------- Add current title to Poll ---------- */
  function wireAddToPoll(){
    const btn = $("#btfw-pl-poll");
    if (!btn) return;
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      const title = getCurrentTitle();
      if (!title) { toast("No current title detected"); return; }

      // 1) Try adding to an existing poll (server/permission dependent)
      try {
        if (window.socket?.emit) {
          // Many CyTube servers accept { option: "<text>" }
          window.socket.emit("addPollOption", { option: title });
          toast("Sent: add option to poll");
          return;
        }
      } catch(e){ console.warn("[playlist-tools] addPollOption failed", e); }

      // 2) Fallback: create a new poll with this one option
      try {
        if (window.socket?.emit) {
          // BillTube2-compatible payload variant
          window.socket.emit("newPoll", {
            title: "Vote",
            opts: [title],
            obscured: false,
            timeout: 0,
            multi: false
          });
          toast("New poll created with current title");
          return;
        }
      } catch(e){ console.warn("[playlist-tools] newPoll failed", e); }

      // 3) Last resort: copy to clipboard and guide the user
      if (copy(title)) {
        toast("Title copied — open Poll and paste as an option");
      } else {
        toast(`Current title: ${title}`);
      }
    });
  }

  /* ---------- Utils ---------- */
  function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
  function copy(text){
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch(_) { return false; }
  }
  function toast(msg){
    try {
      if (window.makeAlert) { makeAlert("Playlist", msg).insertBefore("#motdrow"); return; }
    } catch(_){}
    console.log("[playlist-tools]", msg);
  }

  /* ---------- Boot & observe ---------- */
  function boot(){
    injectToolbar();

    // Re-ensure toolbar when playlist re-renders
    const container = $("#queuecontainer") || $("#playlistwrap") || document.body;
    if (container && !container._btfw_pl_obs) {
      container._btfw_pl_obs = true;
      new MutationObserver(()=> injectToolbar()).observe(container, { childList:true, subtree:true });
    }

    // Keep count roughly up-to-date as entries change
    const queue = $("#queue");
    if (queue && !queue._btfw_pl_count_obs) {
      queue._btfw_pl_count_obs = true;
      new MutationObserver(()=> updateCount()).observe(queue, { childList:true, subtree:true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("btfw:layoutReady", boot);

  return { name:"feature:playlist-tools" };
});
