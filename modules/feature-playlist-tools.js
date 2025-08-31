BTFW.define("feature:playlist-tools", [], async () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function getCurrentTitle(){
    const a = $("#queue .queue_active a");
    return a?.textContent?.trim() || $("#currenttitle")?.textContent?.trim() || "";
  }

  function injectSearch(){
    if ($("#btfw-pl-search")) return;
    const header = $("#playlistwrap") || $("#queue")?.parentElement || $("#queue")?.closest(".well") || $("#btfw-leftpad");
    if (!header) return;

    const box = document.createElement("div");
    box.id = "btfw-pl-search";
    box.className = "btfw-plbar";
    box.innerHTML = `
      <div class="field has-addons" style="margin:8px 8px 4px;">
        <p class="control is-expanded">
          <input id="btfw-pl-filter" class="input is-small" type="text" placeholder="Filter playlist…">
        </p>
        <p class="control">
          <button id="btfw-pl-clear" class="button is-small"><i class="fa fa-times"></i></button>
        </p>
        <p class="control">
          <button id="btfw-pl-poll" class="button is-small is-link"><i class="fa fa-bar-chart"></i> Poll+</button>
        </p>
      </div>`;
    header.insertBefore(box, header.firstChild);

    const input = $("#btfw-pl-filter");
    const clear = $("#btfw-pl-clear");
    const poll  = $("#btfw-pl-poll");

    function applyFilter(){
      const q = input.value.trim().toLowerCase();
      $$("#queue .queue_entry").forEach(li=>{
        const t = (li.textContent || "").toLowerCase();
        li.style.display = t.includes(q) ? "" : "none";
      });
    }
    input.addEventListener("input", applyFilter);
    clear.addEventListener("click", (e)=>{ e.preventDefault(); input.value=""; applyFilter(); input.focus(); });

    poll.addEventListener("click", async (e)=>{
      e.preventDefault();
      const title = getCurrentTitle();
      if (!title) return alert("No current title.");
      try {
        // Try adding to existing poll first
        if (window.socket?.emit) {
          socket.emit("addPollOption", { option: title });
          console.log("[playlist-tools] addPollOption sent");
          return;
        }
      } catch(_) {}
      try {
        // Fallback: create a new poll with 1 option
        if (window.socket?.emit) {
          socket.emit("newPoll", { title: "Vote", opts: [title], obscured: false, timeout: 0 });
          console.log("[playlist-tools] newPoll sent");
        }
      } catch(e){ console.warn("[playlist-tools] poll emit failed", e); }
    });
  }

  function boot(){
    injectSearch();
    const mo = new MutationObserver(()=> injectSearch());
    mo.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return { name:"feature:playlist-tools" };
});
