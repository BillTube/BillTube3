# BillTube3

A modern, self-contained theme framework for [CyTube](https://github.com/calzoneman/sync) channels. BillTube3 turns a stock CyTube channel into a polished watch-party experience — dark UI, movie metadata, emote pickers, mobile support, and a full no-code admin dashboard — using **nothing but Channel JS**. No server access, no database, no build step.

Built and maintained by [BillTube](https://github.com/BillTube). Live on [cytu.be](https://cytu.be).

---

## Quick start

You need a CyTube channel where you are an **admin** (rank 3+).

1. Open your channel → **Channel Settings → Edit → Channel JavaScript**.
2. Paste the loader:

```js
/* BillTube3 one-shot loader for CyTube Channel JS */
(function (W, D) {
  // --- configurable bits ---
  var OWNER = "BillTube";
  var REPO  = "BillTube3";
  var REF   = "main";        // branch to run: "main" (stable) or "experiment"
  var FILE  = "billtube-fw.js";
  var VERSION  = "main-1";   // any string; bump it to nudge caches after a push
  var DEV_NOCACHE = false;   // true only while developing the theme itself
  // --------------------------

  if (W.BTFW && W.BTFW.init) { console.debug("[BTFW] already present; skip"); return; }
  if (D.querySelector('script[data-btfw-loader]')) { console.debug("[BTFW] loader tag exists; skip"); return; }
  if (D.getElementById("btfw-grid")) { console.debug("[BTFW] layout present; skip"); return; }

  var stamp = DEV_NOCACHE ? ("&t=" + Date.now()) : "";

  function inject(src, attr) {
    var s = D.createElement("script");
    s.src = src;
    s.async = false;
    s.defer = false;
    s.dataset.btfwLoader = "1";
    if (attr) Object.keys(attr).forEach(function (k) { s.setAttribute(k, attr[k]); });
    D.head.appendChild(s);
    return s;
  }

  function fallback() {
    inject("https://rawcdn.githack.com/" + OWNER + "/" + REPO + "/" + REF + "/" + FILE + "?" + Date.now(),
           { "data-btfw-fallback": "1" });
  }

  // Resolve the branch ref to a commit SHA so the framework loads from an
  // atomic commit-pinned URL. jsdelivr's @branch alias is occasionally
  // stuck on an old SHA for hours; commit URLs never have that problem.
  fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/branches/" + REF, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var sha = j && j.commit && j.commit.sha;
      var ref = sha || REF;  // fall back to branch if API fails
      var url = "https://cdn.jsdelivr.net/gh/" + OWNER + "/" + REPO + "@" + ref + "/" + FILE +
                "?v=" + encodeURIComponent(VERSION) + stamp;
      var tag = inject(url);
      tag.onerror = fallback;
      console.debug("[BTFW] loading @" + ref.slice(0, 7));
    })
    .catch(function () {
      // GitHub unreachable — try the branch alias once, then fallback
      var url = "https://cdn.jsdelivr.net/gh/" + OWNER + "/" + REPO + "@" + REF + "/" + FILE +
                "?v=" + encodeURIComponent(VERSION) + stamp;
      var tag = inject(url);
      tag.onerror = fallback;
    });
})(window, document);
```

3. Save, reload the channel. The theme boots for every viewer.
4. Open **Channel Settings → Theme** (a new tab the theme adds) to configure everything else from the dashboard — no further code editing needed.
5. In the toolkit, watch the **BillTube chat filters** status strip at the top: if it says an update is needed, open the Chat Filters tab, click **Import Required BillTube Chat Filters**, then CyTube's own **Import filter list**. The filters power rich chat content (spoilers, colors, emote packs, movie cards).

> The loader resolves the branch to a **commit SHA** before injecting anything, and the framework does the same for every stylesheet and module it loads — so all ~58 files ship atomically from one commit, updates arrive the moment a push lands (no stale CDN edges), and if jsDelivr itself has a bad day the loader falls back to a second CDN automatically.

---

## Features

### Player & video
- **Video overlay controls** — fullscreen, theater mode, subtitles, and more on hover (desktop) or tap (touch).
- **Theater mode** and **picture-in-picture**.
- **Audio enhancer** — volume boost plus loudness normalization with Gentle / Balanced / Aggressive compressor presets (HTML5 sources).
- **Auto-subtitles** — fetches subtitles for the playing movie via Wyzie / SubDL (bring your own key) or a keyless Stremio-addon proxy fallback; **local subtitle file** loading too.
- **Chromecast** support (billcast).
- Full-bleed, aspect-correct video on phones with safe-area (notch) handling.

### Chat
- **Emote picker** — channel emotes, an animated-emoji tab (Google Noto), recents, and marketplace packs, with search.
- **Emote marketplace** — channel owners add packs from **7TV, BetterTTV, FrankerFaceZ, and emoji.gg**; they appear as extra picker tabs for everyone.
- **Inline emote autocomplete** — type `:na` and complete any emote with image previews (Tab/Enter/arrow keys), Discord-style.
- **GIF picker** — Giphy and Klipy search with favorites.
- **Rich chat filters** — spoiler tags, chat colors, text styling, emote-pack tokens, TMDB movie cards; the toolkit shows a live status strip telling admins when the channel's imported filter list is out of date.
- Avatars, timestamps, per-user ignore list, username colors, mention notifications with **notification sounds**.
- **Userlist overlay** instead of a fixed column.

### Movies & metadata (TMDB)
- **Movie info card** — hover (desktop) or tap (mobile) the now-playing title for poster, overview, and a rating ring. Mobile presents it as a compact bottom sheet.
- **Movie polls** — CyTube polls upgraded with TMDB poster cards and hover details.
- **Ratings** — a star-voting window opens in the chat header during the final 15 minutes of a movie; votes are stored via a Cloudflare Worker endpoint and surface in a leaderboard.
- **Movie Catalogue** — publishes the playlist as a searchable, filterable poster wall (fullscreen browser for viewers).
- **`!summary`** chat command posts a TMDB movie card into chat.

### Mobile
- The below-video stack (Playlist, MOTD, Polls, custom widgets) collapses into a **tab bar + slide-up bottom sheets**, keeping the main page video + chat.
- Twitch-sized touch targets, tap-to-toggle video overlay, stable scrolling (no URL-bar resize jitter), event-countdown and rating surfaces adapted to small screens.

### Channel Theme Toolkit (the admin dashboard)
Everything lives in **Channel Settings → Theme**, a sidebar-navigated dashboard:

| Section | What it does |
| --- | --- |
| **Featured Content & Resources** | Featured-channels slider feed, extra CSS/JS resources, and up to 10 additional BillTube modules by URL. |
| **Event Countdown** | Channel-wide countdown banner in the chat header — set a title and local time; every viewer sees it converted to *their* timezone, flipping to LIVE at start. |
| **Integrations** | API keys for TMDB, Klipy, Wyzie, SubDL and the ratings endpoint. ⚠️ Keys pasted here are written into public Channel JS and visible to any viewer — use free-tier keys you don't mind exposing. |
| **Playlist Catalogue** | Publish the playlist as a public TMDB movie list. |
| **Emote Marketplace** | Add/remove/rename emote packs (7TV / BTTV / FFZ / emoji.gg). |
| **Palette & Tint** | Curated palette presets (plus themed and editor-inspired ones), per-swatch fine-tuning, and an optional **Hero Patterns backdrop** — 38 tiled SVG patterns drawn in your background + accent colors, with live preview tiles and intensity control. |
| **Typography** | Font presets or a custom family, applied everywhere. |
| **Branding** | Navbar title, favicon, and poster overrides. |
| **Developer** | Cache-busting dev mode for iterating on the theme. |
| **Backup & Restore** | One-click JSON export of the entire configuration and an import that auto-upgrades older backups to the current config shape. Nothing publishes until you press Apply. |

The toolkit writes two clearly-marked managed blocks into Channel JS and Channel CSS. Your own code outside those blocks is never touched.

### Chat commands
`!help` `!now` `!summary [title]` `!skip` `!next` `!bump` `!add <url>` `!time` `!dice` `!roll` `!pick a,b,c` `!ask <question>` `!sm` (random channel emote) `!trivia` (rank ≥ 2) `!leaderboard`

### Under the hood
- **Zero build step** — plain scripts loaded at runtime from jsDelivr; the loader resolves the branch to a commit SHA so all ~50 modules and 8 stylesheets always ship atomically.
- **Design-token system** — every color, radius, shadow, motion curve, and z-index comes from CSS custom properties derived from the channel palette, so owner customizations propagate everywhere (including scrollbars, glows, and background patterns).
- **Fault-tolerant boot** — optional features settle individually; one broken module is reported in the console and in `btfw:ready`'s `detail.failed` instead of taking the theme down.
- **No frameworks of its own** — the former Bulma/Bootswatch layers were replaced with a native ~200-line UI layer. (Legacy escape hatch: set `window.BTFW_LOAD_BULMA = true` in Channel JS before the loader if a third-party module still needs Bulma.)
- Respects `prefers-reduced-motion` throughout.

---

## Branches & updates

| Branch | Purpose |
| --- | --- |
| `main` | Stable. Point production channels here. |
| `experiment` | Where changes land first and get tested live. Expect motion. |

Because module URLs are commit-pinned at boot, a page reload after a push is all a channel needs to update. The Developer section's cache-bust mode forces fresh fetches on every load while you iterate.

## Repository layout

```
billtube-fw.js    # the loader: CSS preloads, module registry, staged boot
css/              # tokens.css (design tokens) · ui.css (native UI layer) ·
                  # base / navbar / chat / overlays / player / mobile
modules/          # ~50 feature modules (feature-*.js) + shared utils (util-*.js)
```

Each module is a `BTFW.define("feature:name", [deps], factory)` bundle; the loader boots core → layout → features and exposes `window.BTFW`.

## Requirements & notes

- A modern evergreen browser (the theme relies on `color-mix()`, container queries, and friends).
- TMDB-powered features (movie info, polls, catalogue, `!summary`) need a free [TMDB API key](https://www.themoviedb.org/settings/api) in Integrations.
- The theme only reads/writes the channel page it runs on — no external storage beyond the optional ratings Worker endpoint you configure.

## Credits

- Background patterns by [Hero Patterns](https://heropatterns.com/) (Steve Schoger, CC BY 4.0)
- Animated emoji by [Noto Emoji](https://googlefonts.github.io/noto-emoji-animation/) (Google, Apache-2.0)
- [Font Awesome](https://fontawesome.com/) icons · [video.js](https://videojs.com/) player · [anime.js](https://animejs.com/) motion
- Emote packs served by [7TV](https://7tv.app/), [BetterTTV](https://betterttv.com/), [FrankerFaceZ](https://www.frankerfacez.com/), and [emoji.gg](https://emoji.gg/)
- Movie data from [TMDB](https://www.themoviedb.org/) (this product uses the TMDB API but is not endorsed or certified by TMDB)

---

*BillTube3 is the successor to [BillTube2](https://github.com/BillTube/BillTube2).*
