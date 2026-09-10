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
      const error = new Error(data?.error || (response.status === 401 ? "Connect this browser with a library access token." : `Library request failed (${response.status}).`));
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
      <form class="btfw-drive-library__search" role="search">
        <label class="sr-only" for="btfw-drive-query">Search Drive movies</label>
        <input id="btfw-drive-query" class="input" type="search" placeholder="Search movies in Drive…" autocomplete="off">
        <button class="button is-primary" type="submit"><i class="fa fa-search" aria-hidden="true"></i><span>Search</span></button>
        <button class="button" type="button" data-action="recent"><i class="fa fa-clock-o" aria-hidden="true"></i><span>Recent 20</span></button>
        <button class="button btfw-drive-library__settings-toggle" type="button" aria-expanded="false" title="Library connection"><i class="fa fa-cog" aria-hidden="true"></i></button>
      </form>
      <div class="btfw-drive-library__settings" hidden>
        <label>Worker URL<input class="input" data-field="endpoint" type="url"></label>
        <label>Access token<input class="input" data-field="token" type="password" autocomplete="off" placeholder="Stored only in this browser"></label>
        <label>Drive number<input class="input" data-field="drive" type="number" min="0" step="1"></label>
        <button class="button" data-action="save" type="button">Save connection</button>
      </div>
      <p class="btfw-drive-library__status" role="status" aria-live="polite">Search your private movie library without leaving CyTube.</p>
      <div class="btfw-drive-library__results"></div>`;
    (document.getElementById("addfromurl")?.parentElement || document.body).appendChild(root);
    return root;
  }

  function render(root, files){
    const results = root.querySelector(".btfw-drive-library__results");
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

  function wire(root){
    if (root._btfwWired) return;
    const form = root.querySelector("form");
    const settings = root.querySelector(".btfw-drive-library__settings");
    const status = root.querySelector(".btfw-drive-library__status");
    const toggle = root.querySelector(".btfw-drive-library__settings-toggle");
    let currentFiles = [];
    const setStatus = (message, variant) => { status.textContent = message; status.dataset.variant = variant || "idle"; };
    const syncFields = () => {
      settings.querySelector('[data-field="endpoint"]').value = state.endpoint;
      settings.querySelector('[data-field="token"]').value = state.token;
      settings.querySelector('[data-field="drive"]').value = String(state.drive);
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
      state.drive = Math.max(0, Number(settings.querySelector('[data-field="drive"]').value) || 0);
      saveState();
      settings.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      setStatus("Connection saved in this browser. Search to test it.", "success");
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
  }

  loadState();
  const root = createRoot();
  wire(root);
  window.BTFW_DriveLibrary = { search: query => api({ action: "search", query }), recent: () => api({ action: "recent", limit: 20 }), queue, normalizeMovieTitle };
  return { name: "feature:driveLibrary" };
});
