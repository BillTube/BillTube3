BTFW.define("feature:driveLibrary", ["feature:playlist-tools"], async ({}) => {
  const STORAGE_KEY = "btfw:drive-library";
  const DEFAULT_ENDPOINT = "https://cytube.billtube.workers.dev";
  const VIDEO_RE = /^(video\/|application\/(?:x-mpegURL|vnd\.apple\.mpegurl))/i;
  let state = { endpoint: DEFAULT_ENDPOINT, token: "", drive: 0 };

  function loadState(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.endpoint = String(saved.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
      state.token = String(saved.token || "");
      state.drive = Math.max(0, Number(saved.drive) || 0);
    } catch (_) {}
  }

  function saveState(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[ch]);
  }

  function formatSize(bytes){
    let value = Number(bytes) || 0;
    if (!value) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
  }

  function normalizeMovieTitle(filename){
    let value = String(filename || "Drive movie");
    try { value = decodeURIComponent(value); } catch (_) {}
    value = value.split(/[?#]/)[0].split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,5}$/i, "");
    value = value.replace(/[._]+/g, " ").replace(/[\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    const yearMatch = value.match(/(?:^|\s|\()(19\d{2}|20\d{2})(?=\s|\)|$)/);
    const year = yearMatch ? yearMatch[1] : "";
    if (yearMatch) value = value.slice(0, yearMatch.index).trim();
    value = value
      .replace(/\b(?:2160p|1080p|720p|480p|bluray|blu-ray|brrip|webrip|web-dl|hdrip|dvdrip|remux|x26[45]|h\.?26[45]|hevc|avc|yify|rarbg|aac(?:\d\.\d)?|dts|proper|repack)\b.*$/i, "")
      .replace(/[-–—]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (value && (value === value.toUpperCase() || value === value.toLowerCase())) {
      value = value.toLowerCase().replace(/(^|[\s:'-])([a-z])/g, (_all, lead, letter) => lead + letter.toUpperCase());
    }
    return `${value || "Drive movie"}${year ? ` (${year})` : ""}`;
  }

  function movieKey(value){
    const normalized = normalizeMovieTitle(value).toLowerCase();
    const year = normalized.match(/\((19\d{2}|20\d{2})\)/)?.[1] || "";
    return `${normalized.replace(/\((19\d{2}|20\d{2})\)/, "").replace(/[^a-z0-9]+/g, "").trim()}|${year}`;
  }

  function playlistKeys(){
    return new Set(Array.from(document.querySelectorAll("#queue .queue_entry")).map(entry => {
      const title = entry.querySelector(".qe_title")?.textContent || entry.textContent || "";
      return movieKey(title);
    }).filter(Boolean));
  }

  function notify(message, variant){
    const notices = window.BTFW_notify;
    const method = variant === "error" ? "error" : variant === "success" ? "success" : "info";
    if (notices && typeof notices[method] === "function") {
      notices[method]({ title: "Drive library", message });
      return;
    }
    console[variant === "error" ? "error" : "log"]("[Drive library]", message);
  }

  async function api(payload){
    const response = await fetch(`${state.endpoint}/__btfw_library`, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify({ drive: state.drive, ...payload })
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const workerUpgrade = response.status === 400 && data?.error === "Unknown action";
      const error = new Error(workerUpgrade ? "The Drive Worker needs the latest library bridge before this feature can be used." : (data?.error || (response.status === 401 ? "Connect this browser with a library access token." : `Library request failed (${response.status}).`)));
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  function absoluteLink(link){
    try { return new URL(String(link || ""), `${state.endpoint}/`).href; }
    catch (_) { return ""; }
  }

  function queue(file, atEnd){
    const url = absoluteLink(file.link);
    if (!url) return false;
    const title = normalizeMovieTitle(file.name);
    const input = document.getElementById("mediaurl");
    const button = document.getElementById(atEnd ? "queue_end" : "queue_next");
    if (input && button) {
      input.value = url;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // CyTube creates #addfromurl-title-val from its keyup handler only after
      // it recognizes a raw-file URL. Trigger that path before filling title.
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
      const titleInput = document.querySelector("#addfromurl-title-val, #mediaurl-title, .media-title-input");
      if (titleInput) {
        titleInput.value = title;
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
        titleInput.dispatchEvent(new CustomEvent("btfw:title-autofilled", { bubbles: true }));
      }
      button.click();
      return true;
    }
    try {
      if (!window.socket) return false;
      window.socket.emit("queue", { id: url, type: "fi", pos: atEnd ? "end" : "next", temp: false, title });
      return true;
    } catch (_) { return false; }
  }

  function createRoot(){
    let root = document.getElementById("btfw-drive-library");
    if (root) return root;
    root = document.createElement("div");
    root.id = "btfw-drive-library";
    root.className = "btfw-drive-library";
    root.innerHTML = `
      <form class="btfw-drive-library__search" role="search" autocomplete="off">
        <label class="sr-only" for="btfw-drive-query">Search Drive movies</label>
        <input id="btfw-drive-query" class="input" name="btfw_movie_search" type="search" placeholder="Search movies in Drive…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="button is-primary" type="submit"><i class="fa fa-search" aria-hidden="true"></i><span>Search</span></button>
        <button class="button" type="button" data-action="recent"><i class="fa fa-clock-o" aria-hidden="true"></i><span>Recent 20</span></button>
        <button class="button" type="button" data-action="browse"><i class="fa fa-film" aria-hidden="true"></i><span>Browse all</span></button>
        <button class="button btfw-drive-library__settings-toggle" type="button" aria-expanded="false" aria-controls="btfw-drive-library-settings" title="Library connection"><i class="fa fa-cog" aria-hidden="true"></i></button>
      </form>
      <div id="btfw-drive-library-settings" class="btfw-drive-library__settings" hidden>
        <label>Worker URL<input class="input" data-field="endpoint" name="btfw_worker_url" type="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <label>Access token<input class="input" data-field="token" name="btfw_library_access_token" type="password" autocomplete="new-password" data-1p-ignore data-bwignore="true" data-lpignore="true" placeholder="Stored only in this browser"></label>
        <label>Movie drive<select class="input" data-field="drive"><option value="0">Drive 1</option></select></label>
        <button class="button" data-action="save" type="button">Save connection</button>
      </div>
      <p class="btfw-drive-library__status" role="status" aria-live="polite">Search your private movie library without leaving CyTube.</p>
      <div class="btfw-drive-library__results"></div>`;
    (document.getElementById("addfromurl")?.parentElement || document.body).appendChild(root);
    return root;
  }

  function renderInto(results, files){
    const playable = (files || []).filter(file => VIDEO_RE.test(file.mimeType || "") || /\.(?:mp4|m4v|webm|mkv|mov|m3u8)$/i.test(file.name || ""));
    if (!playable.length) {
      results.innerHTML = '<p class="btfw-drive-library__empty">No playable movies found.</p>';
      return;
    }
    const queued = playlistKeys();
    results.innerHTML = playable.map((file, index) => {
      const title = normalizeMovieTitle(file.name);
      const imported = queued.has(movieKey(title));
      return `
      <article class="btfw-drive-library__item${imported ? " is-imported" : ""}" data-index="${index}">
        <div class="btfw-drive-library__meta">
          <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
          <span class="btfw-drive-library__normalized">${escapeHtml(title)}</span>
          <span>${escapeHtml(formatSize(file.size))}${file.createdTime || file.modifiedTime ? ` · ${escapeHtml(new Date(file.createdTime || file.modifiedTime).toLocaleDateString())}` : ""}</span>
        </div>
        <div class="btfw-drive-library__actions">
          ${imported ? '<span class="btfw-drive-library__imported"><i class="fa fa-check" aria-hidden="true"></i> In playlist</span>' : `
            <button class="button is-small" type="button" data-queue="next">Play next</button>
            <button class="button is-small" type="button" data-queue="end">Add to end</button>`}
        </div>
      </article>`;
    }).join("");
    results._btfwFiles = playable;
  }

  function render(root, files){ renderInto(root.querySelector(".btfw-drive-library__results"), files); }

  function createModal(){
    let modal = document.getElementById("btfw-drive-library-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "btfw-drive-library-modal";
    modal.className = "btfw-drive-library-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="btfw-drive-library-modal__backdrop" data-close></div>
      <section class="btfw-drive-library-modal__panel" role="dialog" aria-modal="true" aria-labelledby="btfw-drive-modal-title">
        <header><div><h3 id="btfw-drive-modal-title">All movies</h3><p class="btfw-drive-library-modal__status" role="status"></p></div><button class="button" type="button" data-close aria-label="Close">×</button></header>
        <input class="input btfw-drive-library-modal__filter" type="search" placeholder="Filter loaded movies…" autocomplete="off">
        <div class="btfw-drive-library__results"></div>
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  async function loadDrives(select, setStatus){
    if (!state.token) return;
    try {
      const data = await api({ action: "drives" });
      const drives = Array.isArray(data.drives) ? data.drives : [];
      if (!drives.length) throw new Error("No configured drives were returned.");
      select.innerHTML = drives.map(drive => `<option value="${Number(drive.index)}">${escapeHtml(drive.name)}</option>`).join("");
      if (!drives.some(drive => Number(drive.index) === state.drive)) state.drive = Number(drives[0].index) || 0;
      select.value = String(state.drive);
    } catch (error) { setStatus(error.message, "error"); }
  }

  function wire(root){
    if (root._btfwWired) return;
    const form = root.querySelector("form");
    const settings = root.querySelector(".btfw-drive-library__settings");
    const status = root.querySelector(".btfw-drive-library__status");
    const toggle = root.querySelector(".btfw-drive-library__settings-toggle");
    const driveSelect = settings.querySelector('[data-field="drive"]');
    let currentFiles = [];
    const setStatus = (message, variant) => { status.textContent = message; status.dataset.variant = variant || "idle"; };
    const syncFields = () => {
      settings.querySelector('[data-field="endpoint"]').value = state.endpoint;
      settings.querySelector('[data-field="token"]').value = state.token;
      driveSelect.value = String(state.drive);
      loadDrives(driveSelect, setStatus);
    };
    toggle.addEventListener("click", () => {
      const open = settings.hidden;
      settings.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) syncFields();
    });
    settings.querySelector('[data-action="save"]').addEventListener("click", () => {
      state.endpoint = String(settings.querySelector('[data-field="endpoint"]').value || DEFAULT_ENDPOINT).trim().replace(/\/$/, "");
      state.token = String(settings.querySelector('[data-field="token"]').value || "").trim();
      state.drive = Math.max(0, Number(driveSelect.value) || 0);
      saveState();
      settings.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      setStatus("Connection saved in this browser. Search to test it.", "success");
      loadDrives(driveSelect, setStatus);
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const query = root.querySelector("#btfw-drive-query").value.trim();
      if (!query) return;
      if (!state.token) {
        settings.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        setStatus("Add the Worker access token before searching.", "error");
        return;
      }
      setStatus(`Searching for “${query}”…`, "pending");
      try {
        const data = await api({ action: "search", query, pageIndex: 0 });
        const files = data.files || data.data?.files || [];
        currentFiles = files;
        render(root, currentFiles);
        setStatus(`${files.length} result${files.length === 1 ? "" : "s"} returned.`, "success");
      } catch (error) { setStatus(error.message, "error"); }
    });
    root.querySelector('[data-action="recent"]').addEventListener("click", async () => {
      if (!state.token) {
        settings.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        setStatus("Add the Worker access token before loading recent movies.", "error");
        return;
      }
      setStatus("Loading the 20 most recent additions…", "pending");
      try {
        const data = await api({ action: "recent", limit: 20 });
        currentFiles = data.files || [];
        render(root, currentFiles);
        setStatus(`${currentFiles.length} recent movie${currentFiles.length === 1 ? "" : "s"}.`, "success");
      } catch (error) { setStatus(error.message, "error"); }
    });
    root.querySelector('[data-action="browse"]').addEventListener("click", async () => {
      if (!state.token) {
        settings.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        setStatus("Add the Worker access token before browsing movies.", "error");
        return;
      }
      const modal = createModal();
      const modalResults = modal.querySelector(".btfw-drive-library__results");
      const modalStatus = modal.querySelector(".btfw-drive-library-modal__status");
      const filter = modal.querySelector(".btfw-drive-library-modal__filter");
      modal.querySelector("#btfw-drive-modal-title").textContent = `All movies · ${driveSelect.selectedOptions[0]?.textContent || `Drive ${state.drive + 1}`}`;
      let allFiles = [];
      let cancelled = false;
      const paint = () => {
        const term = filter.value.trim().toLowerCase();
        renderInto(modalResults, term ? allFiles.filter(file => `${file.name} ${normalizeMovieTitle(file.name)}`.toLowerCase().includes(term)) : allFiles);
      };
      const close = () => { cancelled = true; modal.hidden = true; document.body.classList.remove("btfw-drive-modal-open"); };
      modal.querySelectorAll("[data-close]").forEach(button => button.onclick = close);
      filter.oninput = paint;
      modal.hidden = false;
      document.body.classList.add("btfw-drive-modal-open");
      filter.value = "";
      modalResults.innerHTML = "";
      modalStatus.textContent = "Loading movies…";
      modalResults.onclick = event => {
        const button = event.target.closest("[data-queue]");
        const item = button?.closest("[data-index]");
        const file = button && item ? event.currentTarget._btfwFiles?.[Number(item.dataset.index)] : null;
        if (!file) return;
        if (!queue(file, button.dataset.queue === "end")) return notify("Could not add that movie to the playlist.", "error");
        notify(`${file.name} added to the playlist.`, "success");
        setTimeout(paint, 250);
      };
      try {
        let pageToken = null;
        let pageIndex = 0;
        do {
          const data = await api({ action: "all", pageToken, pageIndex });
          allFiles.push(...(data.files || []));
          pageToken = data.nextPageToken || null;
          pageIndex++;
          modalStatus.textContent = `Loaded ${allFiles.length} movie${allFiles.length === 1 ? "" : "s"}${pageToken ? "…" : "."}`;
          paint();
        } while (pageToken && !cancelled);
      } catch (error) { modalStatus.textContent = error.message; }
    });
    root.querySelector(".btfw-drive-library__results").addEventListener("click", event => {
      const button = event.target.closest("[data-queue]");
      const item = button?.closest("[data-index]");
      if (!button || !item) return;
      const file = event.currentTarget._btfwFiles?.[Number(item.dataset.index)];
      if (!file || !queue(file, button.dataset.queue === "end")) {
        notify("Could not add that movie to the playlist.", "error");
        return;
      }
      notify(`${file.name} added to the playlist.`, "success");
      setTimeout(() => render(root, currentFiles), 250);
    });
    const queueElement = document.getElementById("queue");
    if (queueElement) {
      new MutationObserver(() => { if (currentFiles.length) render(root, currentFiles); })
        .observe(queueElement, { childList: true, subtree: true });
    }
    root._btfwWired = true;
    if (state.token) loadDrives(driveSelect, setStatus);
  }

  loadState();
  const root = createRoot();
  wire(root);
  window.BTFW_DriveLibrary = { search: query => api({ action: "search", query }), recent: () => api({ action: "recent", limit: 20 }), queue, normalizeMovieTitle };
  return { name: "feature:driveLibrary" };
});
