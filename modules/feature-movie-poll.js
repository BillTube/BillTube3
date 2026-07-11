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
      var c = window.BTFW_CONFIG || {};
      return (c.integrations && c.integrations.tmdb && c.integrations.tmdb.apiKey) || c.tmdbKey || (c.tmdb && c.tmdb.apiKey) || "";
    } catch (e) { return ""; }
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
          .btfw-poll-video-content {
            max-width: 100% !important;
            min-height: 500px !important;
            backdrop-filter: saturate(130%) blur(1px) !important;
          }

          .btfw-poll-options-grid {
            display: flex !important;
            flex-direction: row !important;
            gap: 30px !important;
            align-items: flex-start !important;
            margin: 20px 0 !important;
            justify-content: space-evenly;
            flex-wrap: nowrap;
            padding: 20px;
          }

          /* Enhanced Movie Card styling */
          .btfw-poll-option-row {
            position: relative !important;
            width: 300px !important;
            height: 450px !important;
            background: #000 !important;
            overflow: hidden !important;
            box-shadow: 0 5px 10px rgba(0,0,0,0.5) !important;
            border-radius: 15px !important;
            cursor: pointer !important;
            transition: transform 0.3s ease !important;
            display: block !important;
            padding: 0 !important;
            border: none !important;
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

          /* Responsive adjustments */
          @media (max-width: 768px) {
            .btfw-poll-options-grid {
              gap: 20px !important;
              padding: 10px !important;
            }
            
            .btfw-poll-option-row {
              width: 250px !important;
              height: 375px !important;
            }
          }
        `;

        document.head.appendChild(style);
      }

      function normalizeTitle(title) {
        return title.toLowerCase()
                    .replace(/[^\w\s]/g, ' ')  // Remove all punctuation
                    .replace(/\s+/g, ' ')      // Multiple spaces to single
                    .replace(/\b(the|a|an)\b/g, '') // Remove articles
                    .trim();
      }

      function createSearchVariations(title) {
        const variations = [];
        const { title: cleanTitle, year } = extractYearAndTitle(title);
        
        // Handle known problematic titles first
        const titleMappings = {
          'nightmare elmstreet': 'nightmare elm street',
          'elmstreet': 'elm street',
          'lord rings': 'lord of the rings',
          'star wars episode': 'star wars',
          'harry potter': 'harry potter'
        };
        
        let mappedTitle = cleanTitle.toLowerCase();
        Object.keys(titleMappings).forEach(key => {
          if (mappedTitle.includes(key)) {
            mappedTitle = mappedTitle.replace(key, titleMappings[key]);
          }
        });
        
        // Original title
        variations.push(cleanTitle);
        
        // Mapped title if different
        if (mappedTitle !== cleanTitle.toLowerCase()) {
          variations.push(mappedTitle);
        }
        
        // Remove common words and punctuation
        const normalized = cleanTitle.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\b(the|a|an|and|of|in|on|at|to|for|with|by)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        variations.push(normalized);
        
        // Replace numbers with words and vice versa
        const numberWords = {
          '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
          '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
          'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
          'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
        };
        
        let numberVariation = cleanTitle.toLowerCase();
        Object.keys(numberWords).forEach(key => {
          numberVariation = numberVariation.replace(new RegExp(`\\b${key}\\b`, 'g'), numberWords[key]);
        });
        if (numberVariation !== cleanTitle.toLowerCase()) {
          variations.push(numberVariation);
        }
        
        // Remove subtitle after colon
        if (cleanTitle.includes(':')) {
          variations.push(cleanTitle.split(':')[0].trim());
        }
        
        // Try without year if it's in the title
        if (year) {
          variations.push(cleanTitle.replace(year.toString(), '').trim());
        }
        
        // For "nightmare elm street", add specific variations
        if (mappedTitle.includes('nightmare') && mappedTitle.includes('elm')) {
          variations.push('nightmare on elm street 3');
          variations.push('nightmare elm street dream warriors');
          variations.push('nightmare on elm street dream warriors');
        }
        
        return [...new Set(variations)]; // Remove duplicates
      }

      function calculateSimilarity(str1, str2) {
        const s1 = normalizeTitle(str1);
        const s2 = normalizeTitle(str2);
        
        // Simple similarity based on common words
        const words1 = s1.split(' ').filter(w => w.length > 2);
        const words2 = s2.split(' ').filter(w => w.length > 2);
        
        const commonWords = words1.filter(word => 
          words2.some(w2 => w2.includes(word) || word.includes(w2))
        );
        
        return commonWords.length / Math.max(words1.length, words2.length);
      }

      function findBestMatch(searchTitle, results, targetYear = null) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const movie of results) {
          const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null;
          
          // Calculate similarity score
          let score = calculateSimilarity(searchTitle, movie.title);
          
          // Boost score if year matches
          if (targetYear && movieYear && Math.abs(targetYear - movieYear) <= 1) {
            score += 0.3;
          }
          
          // Boost score for exact year match
          if (targetYear && movieYear && targetYear === movieYear) {
            score += 0.5;
          }
          
          if (score > bestScore && score > 0.3) { // Minimum threshold
            bestScore = score;
            bestMatch = movie;
          }
        }
        
        return bestMatch;
      }

      function extractYearAndTitle(title) {
        const yearParenMatch = title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
        if (yearParenMatch) {
          return {
            title: yearParenMatch[1].trim(),
            year: parseInt(yearParenMatch[2]),
            originalTitle: title
          };
        }
        
        const yearPlainMatch = title.match(/^(.+?)\s+(\d{4})\s*$/);
        if (yearPlainMatch) {
          return {
            title: yearPlainMatch[1].trim(),
            year: parseInt(yearPlainMatch[2]),
            originalTitle: title
          };
        }
        
        return {
          title: title.trim(),
          year: null,
          originalTitle: title
        };
      }

      function isExactTitleMatch(searchTitle, resultTitle, targetYear = null, resultYear = null) {
        const normalizedSearch = normalizeTitle(searchTitle);
        const normalizedResult = normalizeTitle(resultTitle);
        
        const titleMatch = normalizedSearch === normalizedResult || 
                          normalizedResult === normalizedSearch ||
                          normalizedResult.replace(/^(the|a|an)\s+/, '') === normalizedSearch.replace(/^(the|a|an)\s+/, '');
        
        if (!titleMatch) return false;
        
        if (targetYear && resultYear) {
          return Math.abs(targetYear - resultYear) <= 1;
        }
        
        return true;
      }

      async function searchMovieOnTMDB(title, year) {
        const variations = createSearchVariations(title);
        log(`Searching for "${title}" with variations:`, variations);
        
        // Try each variation
        for (const variation of variations) {
          let apiUrl = `https://api.themoviedb.org/3/search/movie?api_key=${getTmdbKey()}&query=${encodeURIComponent(variation)}`;
          
          if (year) {
            apiUrl += `&primary_release_year=${year}`;
          }

          try {
            log(`Trying API call: ${apiUrl}`);
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
              log(`API response not OK: ${response.status} ${response.statusText}`);
              continue;
            }
            
            const data = await response.json();
            log(`API response for "${variation}":`, data);
            
            if (data.results && data.results.length > 0) {
              log(`Found ${data.results.length} results for "${variation}"`);
              
              // First try exact matching
              for (const movie of data.results) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null;
                
                if (isExactTitleMatch(variation, movie.title, year, movieYear)) {
                  log(`Exact match found: "${movie.title}" (${movieYear})`);
                  return movie.id;
                }
              }
              
              // If no exact match, find best similarity match
              const bestMatch = findBestMatch(title, data.results, year);
              if (bestMatch) {
                log(`Best similarity match: "${bestMatch.title}" (${bestMatch.release_date?.substring(0, 4)})`);
                return bestMatch.id;
              }
            } else {
              log(`No results found for "${variation}"`);
            }
          } catch (error) {
            log(`Search error for "${variation}":`, error);
            
            // Check if it's a network/CORS issue and try without proxy
            if (error.message.includes('fetch') || error.message.includes('network')) {
              try {
                const directUrl = `https://api.themoviedb.org/3/search/movie?api_key=${getTmdbKey()}&query=${encodeURIComponent(variation)}`;
                log(`Trying direct API call: ${directUrl}`);
                const directResponse = await fetch(directUrl);
                const directData = await directResponse.json();
                
                if (directData.results && directData.results.length > 0) {
                  const bestMatch = findBestMatch(title, directData.results, year);
                  if (bestMatch) {
                    log(`Direct API success: "${bestMatch.title}"`);
                    return bestMatch.id;
                  }
                }
              } catch (directError) {
                log(`Direct API also failed:`, directError);
              }
            }
          }
        }
        
        // Final fallback: search without year constraint
        if (year) {
          log(`Trying fallback search without year for: "${title}"`);
          for (const variation of variations.slice(0, 2)) { // Try only first 2 variations to avoid too many requests
            const apiUrl = `https://api.themoviedb.org/3/search/movie?api_key=${getTmdbKey()}&query=${encodeURIComponent(variation)}`;
            
            try {
              const response = await fetch(apiUrl);
              if (!response.ok) continue;
              
              const data = await response.json();
              
              if (data.results && data.results.length > 0) {
                const bestMatch = findBestMatch(title, data.results);
                if (bestMatch) {
                  log(`Fallback match found: "${bestMatch.title}" (${bestMatch.release_date?.substring(0, 4)})`);
                  return bestMatch.id;
                }
              }
            } catch (error) {
              log(`Fallback search error for "${variation}":`, error);
            }
          }
        }
        
        log(`No matches found for: "${title}" after trying all variations and fallbacks`);
        return null;
      }

      async function fetchMovieDetails(movieId) {
        const apiUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${getTmdbKey()}&append_to_response=credits`;
        
        try {
          const response = await fetch(apiUrl);
          const data = await response.json();
          
          const director = data.credits?.crew?.find(person => person.job === 'Director');
          const cast = data.credits?.cast?.slice(0, 6) || [];
          
          return {
            poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
            title: data.title,
            year: data.release_date ? data.release_date.substring(0, 4) : 'Unknown',
            director: director ? director.name : 'Unknown Director',
            rating: data.vote_average || 0,
            overview: data.overview || 'No overview available.',
            genres: data.genres || [],
            cast: cast.map(actor => ({
              name: actor.name,
              character: actor.character,
              profilePath: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
            }))
          };
        } catch (error) {
          log('Movie details error:', error);
          return null;
        }
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

        // Check if already enhanced
        const existingPosters = optionsGrid.querySelectorAll('.movie-poster-container');
        if (existingPosters.length > 0) return;

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

            // Process movie in background
            setTimeout(async () => {
              try {
                const { title: cleanTitle, year } = extractYearAndTitle(movieTitle);
                const movieId = await searchMovieOnTMDB(cleanTitle, year);
                
                if (loadingDiv.parentNode) {
                  loadingDiv.remove();
                }

                if (movieId) {
                  const movieData = await fetchMovieDetails(movieId);
                  
                  if (movieData) {
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
                
                if (loadingDiv.parentNode) {
                  loadingDiv.remove();
                }

                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-placeholder';
                errorDiv.textContent = `Error loading ${movieTitle}`;
                optionRow.appendChild(errorDiv);
              }
            }, i * 200);
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