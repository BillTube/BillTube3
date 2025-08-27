// modules/feature-gifs.js
BTFW.define("feature:gifs", ["feature:chat"], async ({ require }) => {
  const GIPHY_KEY = "bb2006d9d3454578be1a99cfad65913d";  // from BillTube2 :contentReference[oaicite:7]{index=7}
  const TENOR_KEY = "5WPAZ4EXST2V";                        // from BillTube2 :contentReference[oaicite:8]{index=8}

  function ensureModal() {
    if (document.querySelector("#btfw-gif-modal")) return;
    const modal = document.createElement("div");
    modal.id = "btfw-gif-modal";
    modal.className = "btfw-modal hidden";
    modal.innerHTML = `
      <div class="btfw-modal__backdrop"></div>
      <div class="btfw-modal__card">
        <div class="btfw-modal__header">
          <div class="tabs">
            <button class="tab active" data-tab="giphy">Giphy</button>
            <button class="tab" data-tab="tenor">Tenor</button>
          </div>
          <button class="btfw-close">&times;</button>
        </div>
        <div class="btfw-modal__toolbar">
          <input id="btfw-gif-q" type="text" placeholder="Search GIFs…">
          <button id="btfw-gif-search" class="btfw-ghost">Search</button>
          <button id="btfw-gif-trending" class="btfw-ghost">Trending</button>
        </div>
        <div class="btfw-modal__body">
          <div class="pane" data-pane="giphy"></div>
          <div class="pane hidden" data-pane="tenor"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector(".btfw-close").onclick = hide;
    modal.querySelector(".btfw-modal__backdrop").onclick = hide;
    modal.querySelectorAll(".tab").forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));
    modal.querySelector("#btfw-gif-search").onclick = () => perform(false);
    modal.querySelector("#btfw-gif-trending").onclick = () => perform(true);
    modal.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  }

  function switchTab(tab) {
    document.querySelectorAll("#btfw-gif-modal .tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("#btfw-gif-modal .pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== tab));
  }

  function show() { ensureModal(); document.querySelector("#btfw-gif-modal").classList.remove("hidden"); }
  function hide() { const m = document.querySelector("#btfw-gif-modal"); if (m) m.classList.add("hidden"); }
  function trimGifUrl(u){ return (u||"").split("?")[0]; } // same helper as BillTube2

  async function perform(trending) {
    const q = document.getElementById("btfw-gif-q").value.trim();
    const active = document.querySelector("#btfw-gif-modal .tab.active").dataset.tab;
    const pane   = document.querySelector(`#btfw-gif-modal .pane[data-pane="${active}"]`);
    pane.innerHTML = `<div class="btfw-grid-9">Loading…</div>`;

    try {
      if (active === "giphy") {
        const base = `https://api.giphy.com/v1/gifs/`;
        let endpoint = trending ? `trending?limit=50` : `search?q=${encodeURIComponent(q)}&limit=50`;
        const res = await fetch(`${base}${endpoint}&api_key=${GIPHY_KEY}`);
        const data = await res.json();
        const arr = data.data || [];
        render(arr.map(d => trimGifUrl(d.images?.downsized?.url || d.images?.original?.url)), pane);
      } else {
        const base = `https://api.tenor.com/v1/`;
        if (trending) {
          const res = await fetch(`${base}trending?key=${TENOR_KEY}&limit=50`);
          const data = await res.json();
          render((data.results || []).map(r => trimGifUrl(r.media?.[0]?.gif?.url)), pane);
        } else {
          const res = await fetch(`${base}search?key=${TENOR_KEY}&q=${encodeURIComponent(q)}&limit=50`);
          const data = await res.json();
          render((data.results || []).map(r => trimGifUrl(r.media?.[0]?.gif?.url)), pane);
        }
      }
    } catch (e) {
      pane.innerHTML = `<div class="btfw-grid-9">Failed to load GIFs.</div>`;
      console.error(e);
    }
  }

  function render(urls, pane) {
    const g = document.createElement("div");
    g.className = "btfw-grid-9";
    urls.filter(Boolean).slice(0, 50).forEach(u => {
      const item = document.createElement("button");
      item.className = "btfw-gif-item";
      item.innerHTML = `<img loading="lazy" src="${u}">`;
      item.onclick = () => { insertText(`${u} `); hide(); }; // CyTube helper
      g.appendChild(item);
    });
    pane.innerHTML = ""; pane.appendChild(g);
  }

  document.addEventListener("btfw:openGifs", show);
  return { name: "feature:gifs" };
});
