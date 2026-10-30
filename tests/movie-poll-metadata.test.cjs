const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the shipped module with its timers disabled; expose lookup internals only
// in this test copy so no live channel or API credentials are needed.
const source = fs.readFileSync(path.join(__dirname, '../modules/feature-movie-poll.js'), 'utf8')
  .replace('name: "feature:movie-poll",', 'extractYearAndTitle, searchMovieOnTMDB, fetchMovieDetails, findBestMatch, name: "feature:movie-poll",');
async function harness(respond = () => ({ results: [] }), key = 'test-key', document = { readyState: 'complete' }) {
  let pending;
  const requests = [], timers = new Map();
  let clock = Date.now(), timerId = 0;
  class TestDate extends Date { static now() { return clock; } }
  function setTimer(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; }
  const window = { BTFW_CONFIG: { tmdb: { apiKey: key } } };
  window.BTFW = { define: (_, __, factory) => { pending = factory({}); } };
  vm.runInNewContext(source, {
    window, document, setTimeout: setTimer, clearTimeout: id => timers.delete(id), console,
    URLSearchParams, AbortController, Date: TestDate, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    fetch: async (url, options) => {
      requests.push(new URL(url));
      const result = await respond(requests.at(-1), requests.length, options);
      return { ok: true, json: async () => result, ...result?.response };
    }
  });
  return { api: await pending, requests, window, timers,
    advanceClock(ms) { clock += ms; },
    async runTimers(delay) {
      const due = [...timers].filter(([, timer]) => timer.delay === delay);
      for (const [id, timer] of due) { timers.delete(id); await timer.callback(); }
    }
  };
}
const movie = (id, title, year = 1979, original_title) => ({ id, title, original_title, release_date: `${year}-05-25` });

test('poll queries strip edition and quality labels before or after release years', async () => {
  for (const input of [
    "Alien - Director's Cut (1979)", 'Alien (1979) Directors Cut',
    'Alien (1979) Director’s Cut [1080p BluRay x264]', 'Alien [Uncut] (1979)',
    'Alien (Unrated Edition) (1979)', 'Alien Extended Edition 1979 [4K]',
    'Alien 1979 Uncut', 'Alien1979', 'Alien (1979) Theatrical Cut',
    'Currently Playing: Alien (1979) Remastered', 'Now Playing - Alien (1979) Restored'
  ]) {
    const { api, requests } = await harness(() => ({ results: [movie(1, 'Alien')] }));
    assert.equal(await api.searchMovieOnTMDB(input), 1, input);
    assert.equal(requests.length, 1, input);
    assert.equal(requests[0].searchParams.get('query'), 'Alien', input);
    assert.equal(requests[0].searchParams.get('year'), '1979', input);
  }
});

test('numeric titles, subtitles and meaningful title words survive cleanup', async () => {
  const { api } = await harness();
  for (const [input, title, year] of [
    ['1917', '1917', null], ['1984', '1984', null],
    ['1917 (2019)', '1917', 2019], ['Blade Runner 2049', 'Blade Runner 2049', null],
    ['Blade Runner 2049 (2017)', 'Blade Runner 2049', 2017],
    ['2001: A Space Odyssey (1968)', '2001: A Space Odyssey', 1968],
    ['Uncut Gems (2019)', 'Uncut Gems', 2019], ['Unrated (2009)', 'Unrated', 2009],
    ['Star Wars: Episode II (2002)', 'Star Wars: Episode II', 2002],
    ['The Thing (1982)', 'The Thing', 1982]
  ]) {
    const parsed = api.extractYearAndTitle(input);
    assert.equal(parsed.title, title, input);
    assert.equal(parsed.year, year, input);
  }
});

test('full normalized titles beat loose article matches and API result order', async () => {
  const { api } = await harness(() => ({ results: [movie(2, 'Thing', 1982), movie(3, 'The Thing', 1982)] }));
  assert.equal(await api.searchMovieOnTMDB('The Thing (1982)'), 3);
});

test('accents, punctuation, joined words and original titles can identify the movie', async () => {
  for (const [query, result] of [
    ['Amelie (2001)', movie(1, 'Amélie', 2001)],
    ['A Nightmare on Elmstreet (1984)', movie(2, 'A Nightmare on Elm Street', 1984)],
    ['Sen to Chihiro no kamikakushi (2001)', movie(3, 'Spirited Away', 2001, 'Sen to Chihiro no kamikakushi')],
    ['Schindlers List (1993)', movie(4, 'Schindler’s List', 1993)],
    ['The Terminator (1984)', movie(5, 'Terminator', 1984)]
  ]) {
    const { api } = await harness(() => ({ results: [result] }));
    assert.equal(await api.searchMovieOnTMDB(query), result.id, query);
  }
});

test('sequels, partial words and different subtitles never become the chosen movie', async () => {
  for (const [query, result] of [
    ['Alien (1979)', movie(1, 'Aliens')],
    ['Alien (1979)', movie(2, 'Alien 2')],
    ['It (2017)', movie(3, 'It Follows', 2017)],
    ['Halloween II (1981)', movie(4, 'Halloween', 1981)],
    ['A Nightmare on Elm Street 2: Freddys Revenge (1985)', movie(5, 'A Nightmare on Elm Street 3: Dream Warriors', 1985)],
    ['Star Wars: Episode II (2002)', movie(6, 'Star Wars: Episode III', 2002)]
  ]) {
    const { api, requests } = await harness(() => ({ results: [result] }));
    assert.equal(await api.searchMovieOnTMDB(query), null, query);
    const searches = requests.filter(url => url.pathname === '/3/search/movie');
    assert.equal(searches.length, 2, query);
    assert.ok(requests.length <= 3, query);
    assert.equal(searches[0].searchParams.get('query'), searches[1].searchParams.get('query'), query);
  }
});

test('the single yearless fallback still rejects distant remakes', async () => {
  const { api, requests } = await harness((url, count) => ({ results: count === 1 ? [] : [movie(1, 'The Thing', 2011), movie(2, 'The Thing', 1982)] }));
  assert.equal(await api.searchMovieOnTMDB('The Thing (1982)'), 2);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('year'), '1982');
  assert.equal(requests[1].searchParams.has('year'), false);
  const wrong = await harness(() => ({ results: [movie(1, 'The Thing', 2011)] }));
  assert.equal(await wrong.api.searchMovieOnTMDB('The Thing (1982)'), null);
  assert.equal(wrong.requests.length, 2);
});

test('unmatched searches stay bounded, and network/auth/rate-limit failures stop immediately', async () => {
  for (const [input, count] of [['Unknown Movie (1979)', 2], ['Unknown Movie', 1]]) {
    const { api, requests } = await harness();
    assert.equal(await api.searchMovieOnTMDB(input), null);
    assert.equal(requests.length, count);
  }
  for (const respond of [
    () => { throw new Error('network fetch failed'); },
    () => ({ response: { ok: false, status: 401 } }),
    () => ({ response: { ok: false, status: 429 } })
  ]) {
    const { api, requests } = await harness(respond);
    assert.equal(await api.searchMovieOnTMDB('Alien (1979)'), null);
    assert.equal(requests.length, 1);
  }
  const missing = await harness(undefined, '');
  assert.equal(await missing.api.searchMovieOnTMDB('Alien (1979)'), null);
  assert.equal(missing.requests.length, 0);
});

test('only the selected movie ID is used to load full poster and cast details', async () => {
  const { api, requests } = await harness(url => url.pathname.includes('/search/')
    ? { results: [movie(11, 'Alien 2'), movie(42, 'Alien')] }
    : { ...movie(42, 'Alien'), poster_path: '/alien.jpg', vote_average: 8.5, runtime: 117,
        credits: { crew: [{ job: 'Director', name: 'Ridley Scott' }], cast: [{ name: 'Sigourney Weaver', character: 'Ripley' }] } });
  const id = await api.searchMovieOnTMDB("Alien Director's Cut (1979)");
  const details = await api.fetchMovieDetails(id);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].pathname, '/3/movie/42');
  assert.equal(details.poster, 'https://image.tmdb.org/t/p/w500/alien.jpg');
  assert.equal(details.director, 'Ridley Scott');
  assert.equal(details.cast[0].name, 'Sigourney Weaver');
  assert.equal(details.year, '1979');
  for (const data of [{ status_message: 'Not found' }, { response: { ok: false, status: 404 } }]) {
    const failed = await harness(() => data);
    assert.equal(await failed.api.fetchMovieDetails(42), null);
  }
});


test('closest-match guesses stay bounded after checking aliases and nearby years', async () => {
  for (const [query, result] of [
    ['Haloween (1978)', movie(1, 'Halloween', 1978)],
    ['The Shawshank Redemtion (1994)', movie(2, 'The Shawshank Redemption', 1994)],
    ['Nightmare on Elm Street (1984)', movie(3, 'A Nightmare on Elm Street', 1984)],
    ['Halloween 5 (1989)', movie(4, 'Halloween 5: The Revenge of Michael Myers', 1989)],
    ['Haloween', movie(5, 'Halloween', 1978)]
  ]) {
    const { api, requests } = await harness(() => ({ results: [result] }));
    assert.equal(await api.searchMovieOnTMDB(query), result.id, query);
    assert.ok(requests.filter(url => url.pathname === '/3/search/movie').length <= 2, query);
    assert.ok(requests.length <= 3, query);
  }
});

test('exact titles win over guesses; the closest guess wins over API ordering', async () => {
  const { api } = await harness(() => ({ results: [movie(1, 'The Shawshank Redemtion', 1994), movie(2, 'The Shawshank Redemption', 1994)] }));
  assert.equal(await api.searchMovieOnTMDB('The Shawshank Redemption (1994)'), 2);
  const guess = await harness(() => ({ results: [movie(1, 'Halloween Night', 1978), movie(2, 'Halloween', 1978)] }));
  assert.equal(await guess.api.searchMovieOnTMDB('Haloween (1978)'), 2);
});

test('guesses reject unrelated titles, missing dates, and conflicting sequel numbers', async () => {
  for (const [query, result] of [
    ['Haloween (1978)', movie(1, 'Halloween', 2007)],
    ['Haloween (1978)', { id: 2, title: 'Halloween' }],
    ['Halloween 2 (1981)', movie(3, 'Halloween 3', 1981)],
    ['Alien', movie(4, 'Aliens')],
    ['The Thing (1982)', movie(5, 'Something Else', 1982)],
    ['Completely Unknown Film (1982)', movie(6, 'The Thing', 1982)]
  ]) {
    const { api } = await harness(() => ({ results: [result] }));
    assert.equal(await api.searchMovieOnTMDB(query), null, query);
  }
});

test('concurrent duplicate titles and repeated polls share search and detail requests', async () => {
  let releaseSearch;
  const searchGate = new Promise(resolve => { releaseSearch = resolve; });
  const h = await harness(async url => {
    if (url.pathname.includes('/search/')) { await searchGate; return { results: [movie(42, 'Alien')] }; }
    return { ...movie(42, 'Alien'), poster_path: '/alien.jpg' };
  });
  const first = h.api.searchMovieOnTMDB("Alien Director's Cut (1979)");
  const second = h.api.searchMovieOnTMDB('Alien (1979) Uncut');
  await Promise.resolve();
  assert.equal(h.requests.length, 1);
  releaseSearch();
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
  const details = await Promise.all([h.api.fetchMovieDetails(42), h.api.fetchMovieDetails(42)]);
  assert.equal(details[0].poster, details[1].poster);
  assert.equal(h.requests.length, 2);
  assert.equal(await h.api.searchMovieOnTMDB('Alien (1979)'), 42);
  await h.api.fetchMovieDetails(42);
  assert.equal(h.requests.length, 2, 'warm polls should issue no network requests');
  h.advanceClock(15 * 60000 + 1);
  await h.api.searchMovieOnTMDB('Alien (1979)');
  await h.api.fetchMovieDetails(42);
  assert.equal(h.requests.length, 4, 'expired entries refresh');
});

test('negative caching expires quickly and transient failures do not poison the cache', async () => {
  let available = false;
  const h = await harness(() => ({ results: available ? [movie(1, 'Unknown Movie')] : [] }));
  assert.equal(await h.api.searchMovieOnTMDB('Unknown Movie'), null);
  available = true;
  assert.equal(await h.api.searchMovieOnTMDB('Unknown Movie'), null);
  assert.equal(h.requests.length, 1);
  h.advanceClock(60001);
  assert.equal(await h.api.searchMovieOnTMDB('Unknown Movie'), 1);
  assert.equal(h.requests.length, 2);
  let fail = true;
  const transient = await harness(() => { if (fail) throw new Error('offline'); return { results: [movie(1, 'Alien')] }; });
  assert.equal(await transient.api.searchMovieOnTMDB('Alien'), null);
  fail = false;
  assert.equal(await transient.api.searchMovieOnTMDB('Alien'), 1);
  assert.equal(transient.requests.length, 2);
});

test('changing the configured API key bypasses prior cached results and auth cooldown', async () => {
  const h = await harness(() => ({ response: { ok: false, status: 401 } }));
  await h.api.searchMovieOnTMDB('Alien');
  await h.api.searchMovieOnTMDB('Halloween');
  assert.equal(h.requests.length, 1);
  h.window.BTFW_CONFIG.tmdb.apiKey = 'replacement-key';
  await h.api.searchMovieOnTMDB('Alien');
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].searchParams.get('api_key'), 'replacement-key');
});

test('request concurrency is capped at four and a rate limit stops queued work', async () => {
  let active = 0, peak = 0;
  const releases = [];
  const h = await harness(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => releases.push(resolve));
    active--;
    return { response: { ok: false, status: 429, headers: { get: () => '2' } } };
  });
  const pending = Array.from({ length: 10 }, (_, index) => h.api.searchMovieOnTMDB(`Movie ${index}`));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.requests.length, 4);
  for (const release of releases) release();
  assert.ok((await Promise.all(pending)).every(value => value === null));
  assert.equal(peak, 4);
  assert.equal(h.requests.length, 4, 'queued cards must honor Retry-After without making requests');
  await h.api.searchMovieOnTMDB('Another Movie');
  assert.equal(h.requests.length, 4);
  h.advanceClock(2001);
  const retry = h.api.searchMovieOnTMDB('Another Movie');
  await Promise.resolve(); await Promise.resolve();
  releases.at(-1)();
  await retry;
  assert.equal(h.requests.length, 5);
});

test('six-second timeouts abort stalled fetches and release their request slots', async () => {
  const h = await harness((url, count, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  const pending = Array.from({ length: 5 }, (_, index) => h.api.searchMovieOnTMDB(`Movie ${index}`));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.requests.length, 4);
  await h.runTimers(6000);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(h.requests.length, 5, 'timeout must free slots for queued cards');
  await h.runTimers(6000);
  assert.ok((await Promise.all(pending)).every(value => value === null));
  assert.equal([...h.timers.values()].filter(timer => timer.delay === 6000).length, 0);
});

test('malformed payloads cannot crash rendering or cause a mismatched details response to be used', async () => {
  for (const data of [null, {}, { results: {} }, { results: [null, {}, { id: 'bad', title: 'Alien' }] }]) {
    const h = await harness(() => data);
    assert.equal(await h.api.searchMovieOnTMDB('Alien'), null);
  }
  const mismatch = await harness(() => movie(99, 'Other Film'));
  assert.equal(await mismatch.api.fetchMovieDetails(42), null);
  const h = await harness(() => ({ ...movie(42, 'Alien'), vote_average: '8.5', runtime: 'NaN', overview: {},
    genres: [null, {}, { id: 1, name: 'Horror' }], credits: { cast: [null, {}, { name: 'Actor', character: null }], crew: {} } }));
  const details = await h.api.fetchMovieDetails(42);
  assert.equal(details.rating.toFixed(1), '8.5');
  assert.equal(details.runtime, 0);
  assert.equal(details.overview, 'No overview available.');
  assert.equal(details.genres.length, 1);
  assert.equal(details.cast.length, 1);
  assert.equal(details.cast[0].character, '');
});

test('the session response cache is bounded', async () => {
  const h = await harness(() => ({ results: [] }));
  for (let i = 0; i < 105; i++) await h.api.searchMovieOnTMDB(`Unknown Film ${i}`);
  assert.equal(h.requests.length, 105);
  await h.api.searchMovieOnTMDB('Unknown Film 104');
  assert.equal(h.requests.length, 105);
  await h.api.searchMovieOnTMDB('Unknown Film 0');
  assert.equal(h.requests.length, 106, 'oldest response must have been evicted');
});


function pollDocument(titles = ['Alien (1979)']) {
  function element(tag) {
    let text = '';
    const node = {
      tag, className: '', dataset: {}, children: [], parentNode: null, listeners: {}, attributes: {},
      get isConnected() { return !!this._connected || !!this.parentNode?.isConnected; },
      get textContent() { return text + this.children.map(child => child.textContent).join(''); },
      set textContent(value) { text = String(value); this.children.forEach(child => { child.parentNode = null; }); this.children = []; },
      appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
      contains(child) { return child === this || this.children.some(item => item.contains(child)); },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelectorAll(selector) {
        const found = [];
        for (const child of this.children) {
          if (child.classList.contains(selector.slice(1))) found.push(child);
          found.push(...child.querySelectorAll(selector));
        }
        return found;
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      closest(selector) { return this.classList.contains(selector.slice(1)) ? this : this.parentNode?.closest(selector) || null; },
      click() { this.clicks = (this.clicks || 0) + 1; }
    };
    node.classList = {
      contains(name) { return node.className.split(' ').includes(name); },
      add(name) { if (!this.contains(name)) node.className += ' ' + name; },
      remove(name) { node.className = node.className.split(' ').filter(item => item !== name).join(' '); }
    };
    return node;
  }
  const overlay = element('div'), grid = element('div'), events = [];
  overlay._connected = true;
  overlay.className = 'btfw-poll-active';
  grid.className = 'btfw-poll-options-grid';
  overlay.appendChild(grid);
  function addRow(title) {
    const row = element('div'), text = element('span'), vote = element('button');
    row.className = 'btfw-poll-option-row';
    text.className = 'btfw-poll-option-text'; text.textContent = title;
    vote.className = 'btfw-poll-option-btn'; vote.textContent = '0';
    row.appendChild(vote); row.appendChild(text); grid.appendChild(row);
    return { row, text, vote };
  }
  const rows = titles.map(addRow);
  return { overlay, grid, events, rows, addRow, document: {
    readyState: 'complete', createElement: element,
    querySelector: () => overlay.classList.contains('btfw-poll-active') ? overlay : null,
    dispatchEvent(event) { events.push(event); }
  } };
}
const flushMicrotasks = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const fullMovie = (id = 42) => ({ ...movie(id, 'Alien'), poster_path: '/alien.jpg', vote_average: 8.5, genres: [], credits: { cast: [] } });

test('real card enhancement is idempotent, preserves voting and shares warm cached lookups', async () => {
  const dom = pollDocument();
  const h = await harness(url => url.pathname.includes('/search/') ? { results: [movie(42, 'Alien')] } : fullMovie(), 'test-key', dom.document);
  await h.api.enhance(); await h.api.enhance();
  assert.equal(dom.rows[0].row.querySelectorAll('.loading-spinner').length, 1);
  await h.runTimers(0);
  const { row, text, vote } = dom.rows[0];
  assert.equal(row.querySelectorAll('.movie-poster-container').length, 1);
  assert.equal(row.querySelectorAll('.movie-details').length, 1);
  assert.equal(row.querySelectorAll('.loading-spinner').length, 0);
  assert.equal(text.textContent, 'Alien (1979)Directed by Unknown Director');
  assert.equal(vote.parentNode, row);
  row.listeners.click({ target: row.querySelector('.movie-poster-container') });
  assert.equal(vote.clicks, 1);
  row.listeners.click({ target: vote });
  assert.equal(vote.clicks, 1, 'a click on the native vote button must not vote twice');
  assert.equal(dom.events[0].type, 'btfw:movieMetadata');
  assert.equal(dom.events[0].detail.title, 'Alien (1979)');
  const added = dom.addRow("Alien Director's Cut (1979)");
  await h.api.enhance(); await h.runTimers(0);
  assert.equal(added.row.querySelectorAll('.movie-poster-container').length, 1, 'an existing poster must not block a new row');
  assert.equal(h.requests.length, 2, 'both cards should use one shared search and details response');
});

test('cards detached before scheduled work do not make requests', async () => {
  const dom = pollDocument();
  const h = await harness(() => ({ results: [movie(42, 'Alien')] }), 'test-key', dom.document);
  await h.api.enhance();
  dom.rows[0].row.remove();
  await h.runTimers(0);
  assert.equal(h.requests.length, 0);
  assert.equal(dom.events.length, 0);
  assert.equal(dom.rows[0].row.querySelectorAll('.loading-spinner').length, 0);
});

test('closing the poll during search stops details fetching and discards late results', async () => {
  const dom = pollDocument();
  let release;
  const h = await harness(() => new Promise(resolve => { release = resolve; }), 'test-key', dom.document);
  await h.api.enhance();
  const rendering = h.runTimers(0);
  await flushMicrotasks();
  assert.equal(h.requests.length, 1);
  dom.overlay.classList.remove('btfw-poll-active');
  release({ results: [movie(42, 'Alien')] });
  await rendering;
  assert.equal(h.requests.length, 1);
  assert.equal(dom.events.length, 0);
  assert.equal(dom.rows[0].row.querySelectorAll('.movie-poster-container').length, 0);
  assert.equal(dom.rows[0].row.querySelectorAll('.loading-spinner').length, 0);
});

test('a replacement poll ignores old details and can still render new cards', async () => {
  const dom = pollDocument();
  let releaseDetails;
  const h = await harness(url => url.pathname.includes('/search/') ? { results: [movie(42, 'Alien')] }
    : new Promise(resolve => { releaseDetails = resolve; }), 'test-key', dom.document);
  await h.api.enhance();
  const rendering = h.runTimers(0);
  await flushMicrotasks();
  assert.equal(h.requests.length, 2);
  dom.rows[0].row.remove();
  const replacement = dom.addRow('Alien (1979)');
  await h.api.enhance();
  releaseDetails(fullMovie());
  await rendering;
  assert.equal(dom.events.length, 0);
  assert.equal(dom.rows[0].row.querySelectorAll('.movie-poster-container').length, 0);
  await h.runTimers(0);
  assert.equal(replacement.row.querySelectorAll('.movie-poster-container').length, 1);
  assert.equal(dom.events.length, 1);
  assert.equal(h.requests.length, 2);
});

test('failed metadata removes the spinner and leaves the original poll title and vote control usable', async () => {
  const dom = pollDocument();
  const h = await harness(() => ({ response: { ok: false, status: 503 } }), 'test-key', dom.document);
  await h.api.enhance(); await h.runTimers(0);
  const { row, text, vote } = dom.rows[0];
  assert.equal(text.textContent, 'Alien (1979)');
  assert.equal(vote.parentNode, row);
  assert.equal(row.querySelectorAll('.loading-spinner').length, 0);
  assert.equal(row.querySelectorAll('.error-placeholder').length, 1);
  row.listeners.click({ target: row });
  assert.equal(vote.clicks, 1);
});

test('poll accepts the same configured, admin, global and DOM API key sources as the hover card', async () => {
  for (const configure of [
    h => { h.window.BTFW_THEME_ADMIN = { integrations: { tmdb: { apiKey: ' supported-key ' } } }; },
    h => { h.window.BTFW_CONFIG.integrations = { tmdb: { apiKey: ' supported-key ' } }; },
    h => { h.window.BTFW_CONFIG.tmdbKey = ' supported-key '; },
    h => { h.window.TMDB_API_KEY = ' supported-key '; },
    h => { h.window.BTFW_TMDB_KEY = ' supported-key '; },
    h => { h.window.tmdb_key = ' supported-key '; },
    (h, document) => { document.body = { dataset: { tmdbKey: ' supported-key ' } }; }
  ]) {
    const document = { readyState: 'complete' };
    const h = await harness(() => ({ results: [movie(42, 'Alien')] }), '', document);
    configure(h, document);
    assert.equal(await h.api.searchMovieOnTMDB('Alien (1979)'), 42);
    assert.equal(h.requests[0].searchParams.get('api_key'), 'supported-key');
  }
});


const reportedMovies = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/poll-tmdb-reported-titles.json'), 'utf8'));
for (const regression of reportedMovies.cases) {
  test(`live-response regression: ${regression.input} selects the correct movie and poster`, async () => {
    const h = await harness(url => url.pathname === '/3/search/movie'
      ? { results: regression.results }
      : reportedMovies.details[url.pathname.split('/').at(-1)] || { response: { ok: false, status: 404 } });
    const id = await h.api.searchMovieOnTMDB(regression.input);
    assert.equal(id, regression.expectedId);
    const details = await h.api.fetchMovieDetails(id);
    const expected = reportedMovies.details[String(regression.expectedId)];
    assert.equal(expected.original_language, 'en', 'the intended record must be an English-language film');
    assert.ok(details.genres.some(genre => genre.id === 27), 'the selected film must include the Horror genre');
    assert.equal(details.title, expected.title);
    assert.equal(details.poster, `https://image.tmdb.org/t/p/w500${expected.poster_path}`);
    assert.equal(details.director, expected.credits.crew[0].name);
    assert.equal(h.requests.filter(url => url.pathname === '/3/search/movie').length, 1);
    assert.ok(h.requests.length <= 3, 'ordinary alias/year cases must not cause a search storm');
    const coldCount = h.requests.length;
    assert.equal(await h.api.searchMovieOnTMDB(regression.input), regression.expectedId);
    await h.api.fetchMovieDetails(regression.expectedId);
    assert.equal(h.requests.length, coldCount, 'aliases, release dates and displayed details share the session cache');
  });
}

test('the requested year wins over previous/following years when titles are equally strong', async () => {
  const h = await harness();
  const results = [movie(1, 'Example Movie', 1982), movie(2, 'Example Movie', 1984), movie(3, 'Example Movie', 1983)];
  assert.equal(h.api.findBestMatch('Example Movie', results, 1983).id, 3);
  assert.equal(h.api.findBestMatch('Example Movie', results.slice(0, 2), 1983).id, 1);
  assert.equal(h.api.findBestMatch('Example Movie', [movie(4, 'Example Movie', 1981)], 1983), null);
});

test('an exact title one year away outranks a loose guess in the supplied year', async () => {
  const h = await harness();
  const results = [movie(1, 'The Nest of Wasps', 1987), movie(2, 'The Nest', 1988)];
  assert.equal(h.api.findBestMatch('The Nest', results, 1987, true).id, 2);
});

test('the yearless fallback checks both adjacent years before making a title guess', async () => {
  for (const adjacent of [1986, 1988]) {
    const h = await harness(url => url.pathname === '/3/search/movie'
      ? { results: url.searchParams.has('year') ? [] : [movie(1, 'The Nest', 2020), movie(2, 'The Nest', adjacent)] }
      : { response: { ok: false, status: 404 } });
    assert.equal(await h.api.searchMovieOnTMDB('The Nest 1987'), 2);
    assert.equal(h.requests.length, 2);
  }
});

test('a confirmed regional year fixes Mortuary without preferring a different same-named movie', async () => {
  const h = await harness();
  const american = reportedMovies.details['44859'], indian = reportedMovies.details['1264828'];
  assert.equal(h.api.findBestMatch('Mortuary', [american, indian], 1983).id, 44859);
  assert.equal(h.api.findBestMatch('Mortuary', [indian, american], 1983).id, 44859, 'API ordering must not select the unrelated Malayalam film');
  const oldRerelease = { ...movie(3, 'Mortuary', 1970), release_dates: american.release_dates };
  assert.equal(h.api.findBestMatch('Mortuary', [oldRerelease], 1983), null);
});

test('verified alternative names work without guessing unrelated canonical titles', async () => {
  const h = await harness(url => url.pathname === '/3/search/movie'
    ? { results: [movie(85184, 'Nightmares', 1980)] }
    : reportedMovies.details['85184']);
  assert.equal(await h.api.searchMovieOnTMDB('Stage Fright'), 85184);
  assert.equal(h.requests.length, 2);
  assert.equal(h.api.findBestMatch('Different Film', [reportedMovies.details['85184']], 1980, true), null);
});

test('alias inspection is bounded to three candidates even when a search returns many similar-year films', async () => {
  const h = await harness(url => url.pathname === '/3/search/movie'
    ? { results: Array.from({ length: 20 }, (_, index) => movie(index + 1, `Unrelated Film ${index}`, 1980)) }
    : { response: { ok: false, status: 404 } });
  assert.equal(await h.api.searchMovieOnTMDB('Stage Fright 1980'), null);
  assert.equal(h.requests.filter(url => url.pathname === '/3/search/movie').length, 2);
  assert.equal(h.requests.filter(url => url.pathname !== '/3/search/movie').length, 3);
});


test('all five reported titles render their intended posters and details without error placeholders', async () => {
  const dom = pollDocument(reportedMovies.cases.map(item => item.input));
  const h = await harness(url => url.pathname === '/3/search/movie'
    ? { results: reportedMovies.cases.find(item => item.query === url.searchParams.get('query'))?.results || [] }
    : reportedMovies.details[url.pathname.split('/').at(-1)] || { response: { ok: false, status: 404 } }, 'test-key', dom.document);
  await h.api.enhance();
  await h.runTimers(0);
  for (let i = 0; i < dom.rows.length; i++) {
    const { row } = dom.rows[i], regression = reportedMovies.cases[i];
    const details = reportedMovies.details[String(regression.expectedId)];
    assert.equal(row.querySelectorAll('.error-placeholder').length, 0, regression.input);
    assert.equal(row.querySelectorAll('.loading-spinner').length, 0, regression.input);
    assert.equal(row.querySelectorAll('.movie-poster-container').length, 1, regression.input);
    assert.equal(row.querySelector('.movie-poster-container').children[0].src, `https://image.tmdb.org/t/p/w500${details.poster_path}`, regression.input);
    assert.ok(dom.rows[i].text.textContent.startsWith(details.title), regression.input);
  }
  assert.equal(dom.events.length, 5);
  assert.ok(h.requests.filter(url => url.pathname === '/3/search/movie').length <= 5);
  assert.ok(h.requests.length <= 11, 'five cards should share alias/details work and need only one extra ambiguity check');
});


test('reported English-horror expectations do not restrict other languages or genres', async () => {
  const frenchComedy = { ...movie(42, 'Amélie', 2001), original_language: 'fr',
    genres: [{ id: 35, name: 'Comedy' }], poster_path: '/amelie.jpg' };
  const h = await harness(url => url.pathname === '/3/search/movie' ? { results: [frenchComedy] } : frenchComedy);
  assert.equal(await h.api.searchMovieOnTMDB('Amelie 2001'), 42);
  const details = await h.api.fetchMovieDetails(42);
  assert.equal(details.title, 'Amélie');
  assert.equal(details.genres[0].name, 'Comedy');
  assert.equal(details.poster, 'https://image.tmdb.org/t/p/w500/amelie.jpg');
});
