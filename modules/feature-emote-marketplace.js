/* BTFW — feature:emote-marketplace
   Loads channel-owner-selected emote packs (7TV / BetterTTV / emoji.gg) from
   their CDNs and exposes them to the emote modal. Nothing is downloaded — each
   emote is a CDN URL, and in chat it's inserted as a short token
   ([7tv]ID[/7tv], etc.) that the BillTube chat filters render for everyone.

   Pack config (per channel) lives in window.BTFW_CONFIG.emotePacks (set by the
   Theme Settings "Emote Marketplace" tab) with a localStorage fallback so it
   works before the admin tab exists:
     [{ provider:"7tv"|"bttv"|"egg", id:"<set/channel/category>", label, enabled }]

   Loaded packs are published on window.BTFW_EMOTE_PACKS and a
   "btfw:emotePacks:changed" event fires so the emote modal can refresh.
*/
BTFW.define("feature:emote-marketplace", [], async () => {
  const LS_CONFIG = "btfw:emotePacks:config";
  const cacheKey = (provider, id) => `btfw:emotePack:${provider}:${id}`;
  const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

  /* ---- provider adapters: fetch a pack -> [{name, image, token}] ---- */
  const PROVIDERS = {
    // 7TV emote set id (from a 7tv.app set URL). The cleanest "pack".
    "7tv": async (id) => {
      const r = await fetch(`https://7tv.io/v3/emote-sets/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error("7tv " + r.status);
      const d = await r.json();
      const out = [];
      for (const e of (d.emotes || [])) {
        if (!e || !e.id || !e.name) continue;
        out.push({ name: e.name, image: `https://cdn.7tv.app/emote/${e.id}/2x.webp`, token: `[7tv]${e.id}[/7tv]` });
      }
      return { name: d.name || "7TV set", emotes: out };
    },

    // BetterTTV: id "global" -> global emotes; otherwise a Twitch user id ->
    // that channel's channel + shared emotes.
    "bttv": async (id) => {
      const out = [];
      let setName = "BTTV";
      const push = (arr) => {
        for (const e of (arr || [])) {
          if (!e || !e.id || !e.code) continue;
          out.push({ name: e.code, image: `https://cdn.betterttv.net/emote/${e.id}/2x.webp`, token: `[bttv]${e.id}[/bttv]` });
        }
      };
      if (String(id).toLowerCase() === "global") {
        const r = await fetch("https://api.betterttv.net/3/cached/emotes/global");
        if (!r.ok) throw new Error("bttv " + r.status);
        push(await r.json());
        setName = "BTTV Global";
      } else {
        const r = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(id)}`);
        if (!r.ok) throw new Error("bttv " + r.status);
        const d = await r.json();
        push(d.channelEmotes); push(d.sharedEmotes);
        setName = d.bots ? "BTTV channel" : "BTTV channel";
      }
      return { name: setName, emotes: out };
    },

    // emoji.gg: id is a category number (see emoji.gg/api/?request=categories).
    // We fetch the full list once (cached) and filter to the category.
    "egg": async (id) => {
      const r = await fetch("https://emoji.gg/api/");
      if (!r.ok) throw new Error("egg " + r.status);
      const all = await r.json();
      const cat = parseInt(id, 10);
      const out = [];
      for (const e of (Array.isArray(all) ? all : [])) {
        if (!e || !e.image || !e.title) continue;
        if (Number.isInteger(cat) && Number(e.category) !== cat) continue;
        const file = String(e.image).split("/").pop(); // e.g. 4384_falco_stare.png
        out.push({ name: e.title, image: e.image, token: `[egg]${file}[/egg]` });
      }
      return { name: "emoji.gg #" + id, emotes: out };
    }
  };

  /* ---- config ---- */
  function getPackConfig() {
    try {
      const cfg = window.BTFW_CONFIG;
      if (cfg && Array.isArray(cfg.emotePacks)) return cfg.emotePacks;
    } catch (_) {}
    try {
      // Theme Settings persists the whole config here (Channel JS block).
      const t = window.BTFW_THEME_ADMIN;
      if (t && Array.isArray(t.emotePacks)) return t.emotePacks;
    } catch (_) {}
    try {
      const raw = localStorage.getItem(LS_CONFIG);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function setPackConfig(list) {
    try { localStorage.setItem(LS_CONFIG, JSON.stringify(list || [])); } catch (_) {}
    try { window.BTFW_CONFIG = window.BTFW_CONFIG || {}; window.BTFW_CONFIG.emotePacks = list || []; } catch (_) {}
  }

  /* ---- cache ---- */
  function readCache(provider, id) {
    try {
      const raw = localStorage.getItem(cacheKey(provider, id));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || (Date.now() - (obj.ts || 0)) > CACHE_TTL) return null;
      return obj.data;
    } catch (_) { return null; }
  }
  function writeCache(provider, id, data) {
    try { localStorage.setItem(cacheKey(provider, id), JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
  }

  async function fetchPack(provider, id) {
    const adapter = PROVIDERS[provider];
    if (!adapter) throw new Error("Unknown provider: " + provider);
    const cached = readCache(provider, id);
    if (cached) return cached;
    const data = await adapter(id);
    writeCache(provider, id, data);
    return data;
  }

  /* ---- load all configured packs and publish ---- */
  let loading = false;
  async function loadAll() {
    if (loading) return window.BTFW_EMOTE_PACKS || [];
    loading = true;
    const config = getPackConfig().filter(p => p && p.enabled !== false && p.provider && p.id);
    const results = await Promise.all(config.map(async (p) => {
      try {
        const data = await fetchPack(p.provider, String(p.id));
        return {
          key: `${p.provider}:${p.id}`,
          provider: p.provider,
          id: String(p.id),
          label: (p.label && String(p.label).trim()) || data.name || `${p.provider} ${p.id}`,
          emotes: data.emotes || []
        };
      } catch (e) {
        console.warn("[emote-marketplace] pack failed:", p, e);
        return null;
      }
    }));
    window.BTFW_EMOTE_PACKS = results.filter(Boolean);
    loading = false;
    document.dispatchEvent(new CustomEvent("btfw:emotePacks:changed", { detail: { packs: window.BTFW_EMOTE_PACKS } }));
    return window.BTFW_EMOTE_PACKS;
  }

  // Re-load when the owner edits packs (admin tab will dispatch this).
  document.addEventListener("btfw:emotePacks:configChanged", () => {
    // bust caches for removed/added handled lazily; just reload
    loadAll();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadAll);
  else loadAll();

  return {
    name: "feature:emote-marketplace",
    reload: loadAll,
    getPacks: () => window.BTFW_EMOTE_PACKS || [],
    getConfig: getPackConfig,
    setConfig: (list) => { setPackConfig(list); return loadAll(); },
    fetchPackPreview: fetchPack   // used by the admin tab to validate before saving
  };
});
