/**
 * Animated Movie Cards Poll Enhancement Module
 * Enhances existing poll options with movie card design and TMDB data
 * Compatible with BillTube Framework v3.4f
 */

(function() {
  'use strict';

  const CONFIG = {
    debug: false
  };

  // Use the channel TMDB key from Theme Settings (never a hardcoded key).
  function getTmdbKey() {
    try {
      const cfg = window.BTFW_CONFIG || {}, admin = window.BTFW_THEME_ADMIN || {};
      const key = value => typeof value === 'string' ? value.trim() : '';
      let stored = '';
      try { stored = key(localStorage.getItem('btfw:tmdb:key')); } catch (_) {}
      // Match the hover card's supported settings and legacy key sources.
      return key(admin.integrations?.tmdb?.apiKey) || key(cfg.integrations?.tmdb?.apiKey)
        || key(cfg.tmdb?.apiKey) || key(cfg.tmdbKey) || stored
        || key(window.TMDB_API_KEY) || key(window.BTFW_TMDB_KEY) || key(window.tmdb_key)
        || key(document.body?.dataset?.tmdbKey);
    } catch (_) { return ''; }
  }

  // Optional feature — controlled by the admin-only "Movie poll" toggle in
  // Theme Settings. Read at channel-init: when off, the module loads but never
  // activates (no CSS, no TMDB fetches, no poll watcher). Checks the runtime
  // config first, then the channel-JS config (BTFW_THEME_ADMIN) which is set
  // earliest, so the gate is reliable regardless of module init order.
  function isEnabled() {
    try {
      var c = window.BTFW_CONFIG || {};
      if (c.moviePoll && typeof c.moviePoll.enabled === "boolean") return c.moviePoll.enabled;
      var t = window.BTFW_THEME_ADMIN || {};
      if (t.moviePoll && typeof t.moviePoll.enabled === "boolean") return t.moviePoll.enabled;
      return false;
    } catch (e) { return false; }
  }

  let moduleState = {
    isFetching: false,
    socketEventsWired: false,
    initialized: false
  };

  function log(message, ...args) {
    if (CONFIG.debug) {
      console.log(`[animated-movie-cards] ${message}`, ...args);
    }
  }

  function waitForBTFWAndDefine() {
    if (window.BTFW && window.BTFW.define) {
      defineModule();
      
      setTimeout(() => {
        if (window.BTFW && window.BTFW.init) {
          window.BTFW.init("feature:movie-poll").catch(err => {
            log('Init error:', err);
          });
        }
      }, 500);
    } else {
      setTimeout(waitForBTFWAndDefine, 100);
    }
  }

  function defineModule() {
    window.BTFW.define("feature:movie-poll", [], async function({ BASE }) {

      function injectCSS() {
        if (document.getElementById('animated-movie-cards-styles')) return;

        const style = document.createElement('style');
        style.id = 'animated-movie-cards-styles';
        style.textContent = `
          #btfw-poll-video-overlay {
            container-type: size;
          }

          #btfw-poll-video-overlay .btfw-poll-video-content {
            top: clamp(8px, 3cqh, 20px) !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            width: auto !important;
            max-width: min(1100px, calc(100% - 16px)) !important;
            max-height: calc(100cqh - 16px) !important;
            min-height: 0 !important;
            padding: clamp(12px, 2.5cqh, 20px) !important;
            overflow: hidden !important;
            backdrop-filter: saturate(130%) blur(1px) !important;
          }

          #btfw-poll-video-overlay .btfw-poll-video-header {
            flex: 0 0 auto;
            margin-bottom: 4px !important;
          }

          #btfw-poll-video-overlay .btfw-poll-options-grid {
            display: flex !important;
            flex-direction: row !important;
            flex: 1 1 auto !important;
            gap: clamp(8px, 1.5cqw, 16px) !important;
            align-items: center !important;
            min-height: 0 !important;
            margin: clamp(6px, 1.5cqh, 12px) 0 !important;
            padding: 6px 4px 10px !important;
            justify-content: center !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            overscroll-behavior-x: contain;
            scroll-snap-type: x proximity;
            scrollbar-gutter: stable;
          }

          /* Up to six movies stay in the cinematic poster strip. Larger polls
             switch to a compact grid so every option remains visible without
             the clipped first/last cards caused by horizontal centering. */
          #btfw-poll-video-overlay .btfw-poll-options-grid.btfw-poll-options-grid--wrapped {
            display: grid !important;
            grid-template-columns: repeat(var(--btfw-poll-columns, 4), minmax(0, 150px)) !important;
            grid-auto-flow: row !important;
            align-content: center !important;
            justify-content: center !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            scrollbar-gutter: stable;
          }

          /* Enhanced Movie Card styling */
          #btfw-poll-video-overlay .btfw-poll-option-row {
            position: relative !important;
            box-sizing: border-box !important;
            flex: 1 0 clamp(104px, 16cqw, 150px) !important;
            width: auto !important;
            min-width: clamp(104px, 16cqw, 150px) !important;
            max-width: 220px !important;
            height: auto !important;
            max-height: max(120px, calc(100cqh - 155px)) !important;
            aspect-ratio: 2 / 3;
            background: #000 !important;
            overflow: hidden !important;
            box-shadow: 0 5px 10px rgba(0,0,0,0.5) !important;
            border-radius: 15px !important;
            cursor: pointer !important;
            transition: transform 0.3s ease !important;
            display: block !important;
            padding: 0 !important;
            border: none !important;
            scroll-snap-align: center;
          }

          #btfw-poll-video-overlay .btfw-poll-options-grid--wrapped .btfw-poll-option-row {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 150px !important;
            justify-self: center;
          }

          #btfw-poll-video-overlay .btfw-poll-footer {
            flex: 0 0 auto;
            margin-top: 4px !important;
            padding-top: 8px !important;
          }

          .btfw-poll-option-row:hover {
            transform: scale(1.02) !important;
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-accent, #4ade80) 55%, transparent 45%),
                        0 10px 24px rgba(0,0,0,.55) !important;
          }

          /* Voted card — a strong accent ring makes the current choice obvious at a glance. */
          .btfw-poll-option-row:has(.btfw-poll-option-btn.active) {
            box-shadow: 0 0 0 3px var(--btfw-color-accent, #4ade80),
                        0 10px 26px rgba(0,0,0,.6) !important;
          }

          .movie-poster-container {
            position: relative;
            overflow: hidden;
            height: 100%;
          }

          .movie-poster-container:before {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(0deg, #000 50%, transparent);
            transform: translateY(100%);
            transition: transform var(--btfw-motion-slow, 320ms) var(--btfw-ease-out, ease-out);
            z-index: 1;
          }

          .btfw-poll-option-row:hover .movie-poster-container:before {
            transform: translateY(0);
          }

          .movie-poster-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: filter var(--btfw-motion-slow, 320ms) ease,
                        transform var(--btfw-motion-slow, 320ms) var(--btfw-ease-out, ease-out);
          }

          .btfw-poll-option-row:hover .movie-poster-container img {
            filter: blur(5px);
            transform: translateY(-50px);
          }

          .movie-details {
            position: absolute;
            padding: 20px;
            width: 100%;
            height: 76%;
            bottom: 0;
            left: 0;
            box-sizing: border-box;
            transform: translateY(110%);
            transition: transform var(--btfw-motion-slow, 320ms) var(--btfw-ease-out, ease-out);
            z-index: 2;
            overflow-y: auto;
          }

          .btfw-poll-option-row:hover .movie-details {
            transform: translateY(0);
          }

          .btfw-poll-option-text {
            color: #fff !important;
            margin: 0 0 5px 0 !important;
            padding: 0 !important;
            font-size: 18px !important;
            line-height: 1.2 !important;
            font-weight: bold !important;
            text-align: left !important;
          }

          .movie-director {
            font-size: 12px !important;
            color: #ffa500 !important;
            font-weight: normal !important;
            display: block !important;
            margin-top: 3px !important;
          }

          .movie-rating {
            position: relative;
            padding: 8px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .stars {
            display: flex;
            gap: 2px;
          }

          .star {
            color: #ffd700;
            font-size: 14px;
          }

          .star.filled::before {
            content: "★";
          }

          .star.empty::before {
            content: "☆";
          }

          .rating-text {
            color: #fff;
            font-size: 12px;
            margin-left: 5px;
          }

          .movie-genres {
            position: relative;
            margin: 8px 0;
          }

          .genre-tag {
            padding: 3px 8px;
            margin-right: 5px;
            margin-bottom: 3px;
            color: #fff;
            display: inline-block;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
          }

          .genre-tag.action { background: #e74c3c; }
          .genre-tag.adventure { background: #f39c12; }
          .genre-tag.animation { background: #9b59b6; }
          .genre-tag.comedy { background: #2ecc71; }
          .genre-tag.crime { background: #34495e; }
          .genre-tag.documentary { background: #16a085; }
          .genre-tag.drama { background: #8e44ad; }
          .genre-tag.family { background: #3498db; }
          .genre-tag.fantasy { background: #9b59b6; }
          .genre-tag.history { background: #95a5a6; }
          .genre-tag.horror { background: #c0392b; }
          .genre-tag.music { background: #e67e22; }
          .genre-tag.mystery { background: #2c3e50; }
          .genre-tag.romance { background: #e91e63; }
          .genre-tag.science-fiction { background: #3f51b5; }
          .genre-tag.thriller { background: #795548; }
          .genre-tag.war { background: #607d8b; }
          .genre-tag.western { background: #ff9800; }

          .movie-overview {
            color: #fff;
            margin: 10px 0;
          }

          .movie-overview p {
            margin: 0;
            font-size: 12px;
            line-height: 1.4;
            opacity: 0.9;
          }

          .movie-cast {
            position: relative;
            margin-top: 15px;
          }

          .movie-cast h4 {
            margin: 0 0 8px 0;
            padding: 0;
            font-size: 14px;
            color: #ffd700;
          }

          .cast-list {
            margin: 0;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .cast-member {
            list-style: none;
            width: 30px;
            height: 30px;
            background: #fff;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid #fff;
            position: relative;
          }

          .cast-member img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .cast-member .no-image {
            width: 100%;
            height: 100%;
            background: #666;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #fff;
          }

          .btfw-poll-option-btn {
            position: absolute !important;
            bottom: 15px !important;
            right: 15px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            min-width: 46px !important;
            background: color-mix(in srgb, var(--btfw-color-accent, #4ade80) 86%, #000 14%) !important;
            color: var(--btfw-color-on-accent, #08131f) !important;
            border: 1px solid color-mix(in srgb, var(--btfw-color-accent, #4ade80) 55%, #fff 45%) !important;
            border-radius: 999px !important;
            padding: 7px 12px !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            transition: transform .16s ease, background .2s ease, box-shadow .2s ease !important;
            z-index: 20 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,.4) !important;
          }

          /* Vote affordance: a chevron drawn from borders (no icon font) turns the count
             pill into an obvious upvote control; it morphs into a checkmark once voted. */
          .btfw-poll-option-btn::before {
            content: "" !important;
            width: 6px !important;
            height: 6px !important;
            border-top: 2.5px solid currentColor !important;
            border-left: 2.5px solid currentColor !important;
            border-right: 0 !important;
            border-bottom: 0 !important;
            transform: rotate(45deg) !important;
            margin-top: 2px !important;
            flex: 0 0 auto !important;
            transition: transform .16s ease !important;
          }

          .btfw-poll-option-btn:hover {
            background: var(--btfw-color-accent, #4ade80) !important;
            transform: translateY(-2px) scale(1.04) !important;
            box-shadow: 0 7px 18px rgba(0,0,0,.5) !important;
          }

          .btfw-poll-option-btn:hover::before {
            transform: rotate(45deg) translate(1px, 1px) !important;
          }

          .btfw-poll-option-btn.active {
            background: var(--btfw-color-accent, #4ade80) !important;
            color: var(--btfw-color-on-accent, #08131f) !important;
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-accent, #4ade80) 45%, #fff 55%),
                        0 4px 14px rgba(0,0,0,.45) !important;
          }

          /* Voted → the chevron becomes a checkmark. */
          .btfw-poll-option-btn.active::before {
            width: 5px !important;
            height: 9px !important;
            border-top: 0 !important;
            border-left: 0 !important;
            border-right: 2.5px solid currentColor !important;
            border-bottom: 2.5px solid currentColor !important;
            transform: rotate(45deg) !important;
            margin-top: -2px !important;
          }

          .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid var(--btfw-color-accent, #4ade80);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            z-index: 10;
          }

          @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }

          .error-placeholder {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #2c3e50, #34495e);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 14px;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
          }

          /* Compact players keep the vote control visible and trade long card
             details for a usable poster strip. */
          @container (max-height: 400px) {
            #btfw-poll-video-overlay .btfw-poll-video-content {
              padding: 10px !important;
            }

            #btfw-poll-video-overlay .btfw-poll-options-grid {
              justify-content: flex-start !important;
              margin: 4px 0 !important;
              padding-block: 3px 6px !important;
            }

            #btfw-poll-video-overlay .btfw-poll-option-row {
              flex: 0 0 clamp(72px, 28cqh, 128px) !important;
              width: clamp(72px, 28cqh, 128px) !important;
              min-width: clamp(72px, 28cqh, 128px) !important;
              max-width: clamp(72px, 28cqh, 128px) !important;
              max-height: none !important;
            }

            #btfw-poll-video-overlay .btfw-poll-options-grid--wrapped .btfw-poll-option-row {
              width: 100% !important;
              min-width: 0 !important;
              max-width: clamp(60px, 24cqh, 96px) !important;
            }

            #btfw-poll-video-overlay .movie-details {
              height: 88% !important;
              padding: 12px !important;
            }

            #btfw-poll-video-overlay .movie-overview,
            #btfw-poll-video-overlay .movie-cast {
              display: none !important;
            }
          }

          @container (max-width: 520px) and (min-height: 401px) {
            #btfw-poll-video-overlay .btfw-poll-options-grid {
              justify-content: flex-start !important;
            }

            #btfw-poll-video-overlay .btfw-poll-option-row {
              flex-basis: clamp(108px, 38cqw, 150px) !important;
              min-width: clamp(108px, 38cqw, 150px) !important;
            }

            #btfw-poll-video-overlay .btfw-poll-options-grid--wrapped .btfw-poll-option-row {
              width: 100% !important;
              min-width: 0 !important;
            }
          }
        `;

        document.head.appendChild(style);
      }

      // Follow the hover card's focused title search. Release labels belong to
      // the file, not the movie name; keep subtitles and sequel numbers intact.
      const editionLabel = String.raw`(?:director['’]?s?\s+cut|(?:extended|unrated|uncut|theatrical|special|anniversary|collector['’]?s?)(?:\s+(?:cut|edition|version))?|remaster(?:ed)?|restored)`;
      const technicalLabel = String.raw`(?:\d{3,4}p|[48]k|uhd|hdr10?\+?|blu[ .-]?ray|brrip|bdrip|web[ .-]?(?:dl|rip)|hdtv|dvd(?:rip)?|[xh][ .-]?26[45]|hevc)`;
      const releaseLabels = new RegExp(`\\b(?:${editionLabel}|${technicalLabel})\\b`, 'gi');
      const trailingLabel = new RegExp(`(?:^|[\\s._:|–—-]+)(?:${editionLabel}|${technicalLabel})$`, 'i');

      function cleanMovieTitle(value) {
        let title = String(value || '').normalize('NFKC')
          .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, '')
          .replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (whole, paren, bracket) => {
            const label = (paren ?? bracket).replace(releaseLabels, '').replace(/[\s._+|–—-]+/g, '');
            return label ? whole : ' ';
          }).trim();
        // Single-word labels are removed only at the end or inside metadata
        // brackets: "Uncut Gems" is a real title, "Alien Uncut" is a file label.
        let previous;
        do {
          previous = title;
          title = title.replace(/[\s._:|–—-]+$/, '').replace(trailingLabel, '').trim();
        } while (title !== previous);
        return title.replace(/\s+/g, ' ').trim();
      }

      function extractYearAndTitle(value) {
        const originalTitle = String(value || '');
        let title = originalTitle.normalize('NFKC')
          .replace(/^\s*(?:currently|now)\s*playing\s*[:\-]\s*/i, '').trim();
        const maxYear = new Date().getFullYear() + 2;
        // Tagged release years can appear before edition/quality labels.
        const tagged = Array.from(title.matchAll(/[([]\s*((?:18|19|20)\d{2})\s*[)\]]/g))
          .find(match => /[\p{L}\p{N}]/u.test(title.slice(0, match.index)) && Number(match[1]) <= maxYear);
        let year = null;
        if (tagged) {
          year = Number(tagged[1]);
          title = title.slice(0, tagged.index) + ' ' + title.slice(tagged.index + tagged[0].length);
        } else {
          // Preserve numeric titles (1917, 1984) and title numbers (2049).
          const bare = Array.from(title.matchAll(/(?:18|19|20)\d{2}/g)).reverse().find(match => {
            const before = title.slice(0, match.index), after = title.slice(match.index + 4);
            return /[\p{L}\p{N}]/u.test(before) && !/\d$/.test(before) && !/^\d/.test(after)
              && Number(match[0]) <= maxYear && !cleanMovieTitle(after);
          });
          if (bare) {
            year = Number(bare[0]);
            title = title.slice(0, bare.index);
          }
        }
        return { title: cleanMovieTitle(title) || title.trim(), year, originalTitle };
      }

      function normalizeTitle(title) {
        return String(title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ')
          .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      }

      const compactTitle = value => normalizeTitle(value).replace(/^(?:the|a|an)\s+/, '').replace(/ /g, '');
      const sequelNumbers = value => normalizeTitle(value).split(' ').filter(word => /^\d+$|^(?:ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(word)).join(' ');

      function titleSimilarity(left, right) {
        // At most 160 x 160 cells per comparison, with one row of storage.
        // This runs only when the response has no exact normalized title.
        if (left.length > 160 || right.length > 160 || Math.min(left.length, right.length) < 6) return 0;
        const row = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let i = 1; i <= left.length; i++) {
          let diagonal = row[0];
          row[0] = i;
          for (let j = 1; j <= right.length; j++) {
            const above = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
            diagonal = above;
          }
        }
        return 1 - row[right.length] / Math.max(left.length, right.length);
      }

      function findBestMatch(title, results, year, allowGuess = false) {
        const wanted = normalizeTitle(title);
        if (!wanted || !Array.isArray(results)) return null;
        const compact = value => value.replace(/ /g, '');
        const withoutArticle = value => value.replace(/^(?:the|a|an)\s+/, '');
        const eligible = results.slice(0, 20).filter(movie => Number.isSafeInteger(movie?.id) && movie.id > 0
          && (!year || Number(String(movie.release_date || '').slice(0, 4)) === Number(year)));
        let best = null, bestScore = 0;
        for (const movie of eligible) {
          let score = 0;
          for (const name of [movie.title, movie.original_title]) {
            const candidate = normalizeTitle(name);
            if (candidate && compact(candidate) === compact(wanted)) score = Math.max(score, 2);
            else if (candidate && compact(withoutArticle(candidate)) === compact(withoutArticle(wanted))) score = Math.max(score, 1);
          }
          if (score > bestScore) { best = movie; bestScore = score; }
        }
        if (best || !allowGuess) return best;
        // Like the hover card, choose from the focused response rather than
        // issuing speculative title variations. Protect short names and sequels.
        const wantedCompact = compactTitle(title), numbers = sequelNumbers(title);
        bestScore = year ? 0.78 : 0.88;
        for (const movie of eligible) {
          for (const name of [movie.title, movie.original_title]) {
            if (typeof name !== 'string' || sequelNumbers(name) !== numbers) continue;
            let score = titleSimilarity(wantedCompact, compactTitle(name));
            // A shortened title such as "Halloween 5 (1989)" can identify a
            // longer canonical title, provided its base and year both agree.
            if (year && !title.includes(':') && name.includes(':') && compactTitle(name.split(':')[0]) === wantedCompact) score = Math.max(score, 0.92);
            // Preserve TMDB relevance order when two guesses score equally.
            if (score > bestScore) { best = movie; bestScore = score; }
          }
        }
        return best;
      }

      // Cache API responses in memory only. Coalesce duplicate requests and
      // bound memory and traffic; this cache never writes credentials to storage.
      const responseCache = new Map(), pendingRequests = new Map(), requestQueue = [];
      const MAX_CACHED_RESPONSES = 100, REQUEST_TIMEOUT_MS = 6000, MAX_CONCURRENT_REQUESTS = 4;
      let activeRequests = 0, blockedKey = '', blockedUntil = 0;
      function drainRequests() {
        while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length) {
          activeRequests++;
          requestQueue.shift()();
        }
      }
      async function requestTMDB(path, params = {}) {
        const apiKey = getTmdbKey();
        if (!apiKey) return null;
        const url = `https://api.themoviedb.org/3/${path}?${new URLSearchParams({ api_key: apiKey, ...params })}`;
        const cached = responseCache.get(url);
        if (cached?.expires > Date.now()) return cached.data;
        responseCache.delete(url);
        if (pendingRequests.has(url)) return pendingRequests.get(url);
        if (blockedKey === apiKey && blockedUntil > Date.now()) return null;
        const pending = (async () => {
          await new Promise(resolve => { requestQueue.push(resolve); drainRequests(); });
          let timeout;
          try {
            // A queued option must also honor a rate limit seen by another card.
            if (blockedKey === apiKey && blockedUntil > Date.now()) return null;
            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
              if ([401, 403, 429].includes(response.status)) {
                const retryAfter = response.headers?.get('Retry-After');
                const retryMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
                blockedKey = apiKey;
                blockedUntil = Date.now() + (response.status === 429 ? Math.min(300000, Math.max(1000, retryMs || 30000)) : 60000);
              }
              return null;
            }
            const data = await response.json();
            const valid = path === 'search/movie'
              ? Array.isArray(data?.results)
              : Number.isSafeInteger(data?.id) && data.id > 0 && path === `movie/${data.id}` && typeof data.title === 'string';
            if (!valid) return null;
            if (responseCache.size >= MAX_CACHED_RESPONSES) responseCache.delete(responseCache.keys().next().value);
            const ttl = path === 'search/movie' && !data.results.length ? 60000 : 15 * 60000;
            responseCache.set(url, { data, expires: Date.now() + ttl });
            return data;
          } catch (error) {
            log('Movie request failed:', error);
            return null;
          } finally {
            clearTimeout(timeout);
            activeRequests--;
            drainRequests();
          }
        })();
        pendingRequests.set(url, pending);
        try { return await pending; }
        finally { pendingRequests.delete(url); }
      }

      async function searchMovieOnTMDB(title, year) {
        const parsed = extractYearAndTitle(title);
        const query = parsed.title;
        const targetYear = year || parsed.year;
        if (!getTmdbKey() || !query) return null;
        // Prefer an exact match, then a reasonable guess in the same response.
        // Only an empty/unusable response needs the single yearless fallback.
        const filters = targetYear ? [targetYear, null] : [null];
        for (const filter of filters) {
          const data = await requestTMDB('search/movie', { query, ...(filter ? { year: filter } : {}) });
          if (!data) return null;
          const match = findBestMatch(query, data.results, targetYear, true);
          if (match) return match.id;
        }
        return null;
      }

      async function fetchMovieDetails(movieId) {
        if (!Number.isSafeInteger(movieId) || movieId <= 0) return null;
        const data = await requestTMDB(`movie/${movieId}`, { append_to_response: 'credits' });
        if (!data) return null;
        const crew = Array.isArray(data.credits?.crew) ? data.credits.crew : [];
        const director = crew.find(person => person?.job === 'Director' && typeof person.name === 'string');
        const cast = (Array.isArray(data.credits?.cast) ? data.credits.cast : [])
          .filter(actor => actor && typeof actor.name === 'string').slice(0, 6);
        const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
        return {
          poster: typeof data.poster_path === 'string' && data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
          title: data.title,
          year: /^\d{4}-/.test(data.release_date || '') ? data.release_date.slice(0, 4) : 'Unknown',
          director: director ? director.name : 'Unknown Director',
          rating: Math.min(10, positive(data.vote_average)),
          votes: positive(data.vote_count),
          runtime: positive(data.runtime),
          collection: positive(data.belongs_to_collection?.id),
          overview: typeof data.overview === 'string' && data.overview ? data.overview : 'No overview available.',
          genres: (Array.isArray(data.genres) ? data.genres : []).filter(genre => genre && typeof genre.name === 'string'),
          cast: cast.map(actor => ({
            name: actor.name,
            character: typeof actor.character === 'string' ? actor.character : '',
            profilePath: typeof actor.profile_path === 'string' && actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
          }))
        };
      }

      function createStarsRating(rating) {
        const starsContainer = document.createElement('div');
        starsContainer.className = 'stars';
        
        const starCount = Math.round(rating / 2);
        
        for (let i = 1; i <= 5; i++) {
          const star = document.createElement('span');
          star.className = `star ${i <= starCount ? 'filled' : 'empty'}`;
          starsContainer.appendChild(star);
        }
        
        return starsContainer;
      }

      function createGenreTags(genres) {
        const container = document.createElement('div');
        container.className = 'movie-genres';
        
        genres.slice(0, 3).forEach(genre => {
          const tag = document.createElement('span');
          tag.className = `genre-tag ${genre.name.toLowerCase().replace(/[^a-z]/g, '-')}`;
          tag.textContent = genre.name;
          container.appendChild(tag);
        });
        
        return container;
      }

      function createCastList(cast) {
        const container = document.createElement('div');
        container.className = 'movie-cast';
        
        const title = document.createElement('h4');
        title.textContent = 'Cast';
        container.appendChild(title);
        
        const castList = document.createElement('ul');
        castList.className = 'cast-list';
        
        cast.forEach(actor => {
          const listItem = document.createElement('li');
          listItem.className = 'cast-member';
          listItem.title = `${actor.name} as ${actor.character}`;
          
          if (actor.profilePath) {
            const img = document.createElement('img');
            img.src = actor.profilePath;
            img.alt = actor.name;
            listItem.appendChild(img);
          } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'no-image';
            placeholder.textContent = actor.name.charAt(0);
            listItem.appendChild(placeholder);
          }
          
          castList.appendChild(listItem);
        });
        
        container.appendChild(castList);
        return container;
      }

      async function enhancePollOptions() {
        if (moduleState.isFetching) return;

        const pollOverlay = document.querySelector('#btfw-poll-video-overlay.btfw-poll-active');
        if (!pollOverlay) return;

        const optionsGrid = pollOverlay.querySelector('.btfw-poll-options-grid');
        if (!optionsGrid) return;

        const optionRows = optionsGrid.querySelectorAll('.btfw-poll-option-row');
        if (!optionRows.length) return;

        moduleState.isFetching = true;

        try {
          for (let i = 0; i < optionRows.length; i++) {
            const optionRow = optionRows[i];
            const textSpan = optionRow.querySelector('.btfw-poll-option-text');
            const voteBtn = optionRow.querySelector('.btfw-poll-option-btn');
            
            if (!textSpan || !voteBtn) continue;

            const movieTitle = textSpan.textContent.trim();
            if (!movieTitle) continue;

            // Claim this row synchronously. The poster render below runs in a deferred
            // setTimeout, and isFetching is cleared in finally() *before* those land — so a
            // second trigger (the observer fires for both the class change AND the child
            // insert, plus the socket newPoll and the checkExistingPolls re-runs) would pass
            // the now-stale isFetching/existingPosters guards and enhance the same row again.
            // A DOM claim outlives the async work, so re-entry is a no-op. Rows are rebuilt
            // per poll, so the marker is naturally fresh for each new poll.
            if (optionRow.dataset.btfwMpEnhanced === "1") continue;
            optionRow.dataset.btfwMpEnhanced = "1";

            // Whole poster acts as the vote button — click anywhere on the card to vote.
            // The pill keeps its own handler, so we ignore clicks that land on it.
            if (!optionRow.dataset.btfwVoteBound) {
              optionRow.dataset.btfwVoteBound = "1";
              optionRow.setAttribute("title", "Click to vote");
              optionRow.addEventListener("click", function (ev) {
                if (ev.target.closest(".btfw-poll-option-btn")) return;
                const vb = optionRow.querySelector(".btfw-poll-option-btn");
                if (vb) vb.click();
              });
            }

            log(`Processing: "${movieTitle}"`);

            // Add loading spinner
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-spinner';
            optionRow.appendChild(loadingDiv);

            const isCurrentRow = () => optionRow.isConnected && optionsGrid.contains(optionRow)
              && pollOverlay.classList.contains('btfw-poll-active');
            // Start all cards promptly; requestTMDB bounds network concurrency.
            setTimeout(async () => {
              try {
                if (!isCurrentRow()) return;
                const movieId = await searchMovieOnTMDB(movieTitle);
                if (!isCurrentRow()) return;

                if (movieId) {
                  const movieData = await fetchMovieDetails(movieId);
                  if (!isCurrentRow()) return;
                  
                  if (movieData) {
                    // Reuse the details already fetched for posters. Poll selection
                    // never needs to make hundreds of lookups at launch time.
                    document.dispatchEvent(new CustomEvent('btfw:movieMetadata', {
                      detail: { title: movieTitle, metadata: movieData }
                    }));
                    // Create poster container
                    const posterContainer = document.createElement('div');
                    posterContainer.className = 'movie-poster-container';
                    
                    if (movieData.poster) {
                      const posterImg = document.createElement('img');
                      posterImg.src = movieData.poster;
                      posterImg.alt = movieData.title;
                      posterContainer.appendChild(posterImg);
                    } else {
                      posterContainer.innerHTML = '<div class="error-placeholder">No Poster Available</div>';
                    }

                    // Create details section
                    const detailsDiv = document.createElement('div');
                    detailsDiv.className = 'movie-details';
                    
                    // Update title and add director (TMDB fields are untrusted —
                    // keep them out of innerHTML)
                    textSpan.textContent = `${movieData.title} (${movieData.year})`;
                    const directorSpan = document.createElement('span');
                    directorSpan.className = 'movie-director';
                    directorSpan.textContent = `Directed by ${movieData.director}`;
                    textSpan.appendChild(directorSpan);
                    detailsDiv.appendChild(textSpan);
                    
                    // Rating
                    const ratingDiv = document.createElement('div');
                    ratingDiv.className = 'movie-rating';
                    ratingDiv.appendChild(createStarsRating(movieData.rating));
                    
                    const ratingText = document.createElement('span');
                    ratingText.className = 'rating-text';
                    ratingText.textContent = `${movieData.rating.toFixed(1)}/10`;
                    ratingDiv.appendChild(ratingText);
                    detailsDiv.appendChild(ratingDiv);
                    
                    // Genres
                    if (movieData.genres.length > 0) {
                      detailsDiv.appendChild(createGenreTags(movieData.genres));
                    }
                    
                    // Overview
                    const overviewDiv = document.createElement('div');
                    overviewDiv.className = 'movie-overview';
                    const overviewText = document.createElement('p');
                    overviewText.textContent = movieData.overview.length > 150 
                      ? movieData.overview.substring(0, 150) + '...' 
                      : movieData.overview;
                    overviewDiv.appendChild(overviewText);
                    detailsDiv.appendChild(overviewDiv);
                    
                    // Cast
                    if (movieData.cast.length > 0) {
                      detailsDiv.appendChild(createCastList(movieData.cast));
                    }
                    
                    // Add everything to the card
                    optionRow.appendChild(posterContainer);
                    optionRow.appendChild(detailsDiv);
                    
                    // Keep vote button on the main card (outside the sliding details)
                    // Don't move it to detailsDiv - let it stay at card level
                    
                  } else {
                    throw new Error('No movie data found');
                  }
                } else {
                  throw new Error('Movie not found');
                }
                
              } catch (error) {
                log(`Error processing ${movieTitle}:`, error);
                if (!isCurrentRow()) return;
                
                if (loadingDiv.parentNode) {
                  loadingDiv.remove();
                }

                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-placeholder';
                errorDiv.textContent = `Error loading ${movieTitle}`;
                optionRow.appendChild(errorDiv);
              } finally {
                loadingDiv.remove();
              }
            }, 0);
          }

          log('Poll enhancement complete!');

        } finally {
          moduleState.isFetching = false;
        }
      }

      function startPollWatcher() {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const target = mutation.target;
              if (target.id === 'btfw-poll-video-overlay' && target.classList.contains('btfw-poll-active')) {
                log('Poll overlay activated');
                setTimeout(enhancePollOptions, 800);
              }
            }
            
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  if (node.classList && (node.classList.contains('btfw-poll-video-content') || 
                      node.querySelector && node.querySelector('.btfw-poll-video-content'))) {
                    log('Poll content added');
                    setTimeout(enhancePollOptions, 800);
                  }
                }
              });
            }
          });
        });

        const overlay = document.getElementById('btfw-poll-video-overlay');
        if (overlay) {
          observer.observe(overlay, { 
            attributes: true, 
            childList: true, 
            subtree: true 
          });
        }

        const videowrap = document.getElementById('videowrap');
        if (videowrap) {
          observer.observe(videowrap, { 
            childList: true, 
            subtree: true 
          });
        }

        return observer;
      }

      function wireSocketEvents() {
        if (moduleState.socketEventsWired || !window.socket) return;
        
        try {
          window.socket.on("newPoll", () => {
            log('New poll detected via socket');
            setTimeout(enhancePollOptions, 1200);
          });

          moduleState.socketEventsWired = true;
          log('Socket events wired');
        } catch (error) {
          log('Failed to wire socket events:', error);
        }
      }

      async function initialize() {
        if (moduleState.initialized) return;
        if (!isEnabled()) { log('Movie poll disabled — not activating'); return; }
        // Claim before the async socket-wait below. initialize() is async and only set
        // initialized=true at the very end, so a second call during the wait could slip
        // through and stack a second MutationObserver. Set it up front.
        moduleState.initialized = true;

        log('Initializing Movie poll module...');

        injectCSS();

        let socketAttempts = 0;
        while (!window.socket && socketAttempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          socketAttempts++;
        }
        
        if (window.socket) {
          log('Socket found after', socketAttempts, 'attempts');
        } else {
          log('Socket not found after 5 seconds, continuing anyway');
        }
        
        wireSocketEvents();
        startPollWatcher();
        
        const checkExistingPolls = () => {
          const activeOverlay = document.querySelector('#btfw-poll-video-overlay.btfw-poll-active');
          if (activeOverlay) {
            log('Found existing active poll overlay');
            const optionsGrid = activeOverlay.querySelector('.btfw-poll-options-grid');
            const optionRows = optionsGrid ? optionsGrid.querySelectorAll('.btfw-poll-option-row') : [];
            log(`Poll has ${optionRows.length} options`);
            enhancePollOptions();
          } else {
            log('No active poll overlay found during initialization');
          }
        };
        
        checkExistingPolls();
        setTimeout(checkExistingPolls, 500);
        setTimeout(checkExistingPolls, 1500);
        setTimeout(checkExistingPolls, 3000);

        log('Module initialized successfully');
      }

      setTimeout(initialize, 100);

      return {
        name: "feature:movie-poll",
        enhance: enhancePollOptions,
        initialize: initialize
      };
    });

    log('Module defined successfully');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForBTFWAndDefine);
  } else {
    waitForBTFWAndDefine();
  }

})();
