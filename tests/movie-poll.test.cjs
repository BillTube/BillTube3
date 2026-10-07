const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the actual module in a browser stub, exposing internals only in this
// test copy. Sampling internals stay private in production; no live channel is needed.
const source = fs.readFileSync(path.join(__dirname, '../modules/feature-poll-overlay.js'), 'utf8')
  .replace('name: "feature:poll-overlay",', `
    sampleMovies, eligiblePlaylistMovies, playlistMovieMetadata,
    readMovieHistory, saveMovieHistory, recordMovieWinner, recordMoviePlayback, rememberMovieNominations,
    syncMovieHistoryControl, removeMovieHistoryControl, wireSocketEvents, rerollRandomMovies, closeRandomPollBuilder, startAutomaticPoll,
    launchAutomaticPoll, trackAutomaticPoll, finishAutomaticPoll,
    openRandomPollBuilder, syncAutoCreditsPollControl, saveAutoCreditsSettings, loadPollPreferences,
    evaluateAutoCreditsPoll, updateAutoCreditsMedia, applyRandomMoviePollIntegration,
    getAutoCreditsSettings: () => { loadPollPreferences(); return { ...autoCreditsSettings }; },
    name: "feature:poll-overlay",`);

function movieRow(uid, title, id = String(uid)) {
  return {
    className: `queue_entry pluid-${uid}`,
    media: { type: 'fi', id },
    querySelector: () => ({ textContent: title }),
    nextElementSibling: null
  };
}

async function harness(rows, storage = new Map(), failStorage = false, showControls = false) {
  let modulePromise;
  const emitted = [];
  let active = rows[0];
  rows.forEach((row, index) => { row.nextElementSibling = rows[index + 1] || null; });
  const elements = new Map();
  let builder = null;
  let deferredClose = false;
  const frames = [], timers = [], socketListeners = {};
  function element(tag) {
    const node = {
      children: [], listeners: {}, attributes: {}, textContent: '', tag, open: false,
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; },
      showModal() { this.open = true; },
      close() { this.open = false; if (deferredClose) timers.push(() => this.listeners.close?.()); else this.listeners.close?.(); },
      getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 500 }),
      addEventListener(event, callback) { this.listeners[event] = callback; },
      appendChild(child) { this.children.push(child); child.isConnected = true; if (child.id) elements.set(child.id, child); if (child.tag === 'section') builder = child; },
      append(...children) { children.forEach((child) => this.appendChild(child)); },
      insertBefore(child) { this.appendChild(child); if (child.tag === 'section') builder = child; },
      replaceChildren() { this.children = []; },
      remove() { if (elements.get(this.id) === this) elements.delete(this.id); if (builder === this) builder = null; },
      querySelector(selector) { return this.parts?.[selector] || null; },
      querySelectorAll(selector) {
        if (selector === '[data-setting]') return [];
        return tag === 'section' ? [this.parts['#btfw-random-poll-count'], this.parts['.btfw-random-poll-reroll']] : [];
      },
      set innerHTML(value) {
        this.value = value;
        this.children = [];
        if (tag === 'button') this.parts = { span: element('span') };
        if (tag === 'dialog') this.parts = {
          '.btfw-history-close': element('button'), '.btfw-history-clear': element('button'),
          '.btfw-history-list': element('ol'), '.btfw-history-empty': element('p')
        };
        if (tag === 'section') this.parts = Object.fromEntries([
          '.btfw-random-poll-close', '.btfw-random-poll-cancel', '.btfw-random-poll-reroll',
          '.btfw-random-poll-start', '#btfw-random-poll-count', '#btfw-random-poll-minutes',
          '.btfw-random-poll-list', '.btfw-random-poll-warning', '.btfw-random-poll-eligible', '.btfw-random-poll-pool',
          '.btfw-poll-auto-enabled', '.btfw-poll-bustin-mode'
        ].map((selector) => [selector, element('div')]));
        if (tag === 'section' && value.includes('Enable auto credits polls')) {
          delete this.parts['.btfw-random-poll-list'];
          delete this.parts['.btfw-random-poll-reroll'];
        }
      }
    };
    return node;
  }
  const controls = showControls ? element('div') : null;
  if (showControls) {
    const wrap = element('div');
    wrap.parts = { '.poll-controls': controls };
    elements.set('pollwrap', wrap);
  }
  const document = {
    readyState: 'loading', body: Object.assign(element('body'), { dataset: {} }),
    addEventListener() {}, getElementById: (id) => elements.get(id) || null,
    createElement: element,
    querySelector(selector) {
      if (selector === '#pollwrap .poll-controls') return controls;
      if (selector === '#pollwrap .btfw-random-poll-builder') return builder;
      if (selector === '#pollwrap .poll-menu, #pollwrap .btfw-random-poll-builder') return builder;
      if (selector === '.btfw-random-poll-start') return builder?.parts[selector] || null;
      return selector.startsWith('#queue >') && selector.includes('queue_active') ? active : null;
    },
    querySelectorAll: (selector) => selector === '#queue > .queue_entry' ? rows : []
  };
  const window = {
    BTFW_CONFIG: { integrations: { randomMoviePoll: { enabled: true } } },
    CHANNEL: { name: 'TestChannel' }, CLIENT: { rank: 3 },
    hasPermission: () => true,
    jQuery: (row) => ({ data: (key) => key === 'uid' ? row?.uid : row?.media }),
    requestAnimationFrame: (callback) => frames.push(callback),
    setInterval: () => 1, clearInterval() {},
    socket: { emit: (...args) => emitted.push(args), on: (event, callback) => { socketListeners[event] = callback; } }
  };
  const context = {
    window, document, console: { log() {}, warn() {} }, location: { pathname: '/r/TestChannel' },
    setTimeout: (callback) => timers.push(callback), performance: { now: () => 1000 },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem(key, value) { if (failStorage) throw Error('Storage blocked'); storage.set(key, value); },
      removeItem: (key) => storage.delete(key)
    },
    BTFW: { init: async () => ({}), define: (_, __, factory) => { modulePromise = factory(); } }
  };
  vm.runInNewContext(source, context);
  return {
    api: await modulePromise, emitted, storage, elements, socketListeners, window,
    getBuilder: () => builder,
    deferDialogClose() { deferredClose = true; },
    setActive(row) { active = row; },
    async flushSelection() { frames.splice(0).forEach((callback) => callback()); timers.splice(0).forEach((callback) => callback()); await Promise.resolve(); }
  };
}

test('all 700+ upcoming entries are eligible regardless of visibility or distance from current', async () => {
  const rows = Array.from({ length: 751 }, (_, i) => movieRow(i, `Movie ${i} (1995)`));
  const { api } = await harness(rows);
  assert.equal(api.eligiblePlaylistMovies().length, 750);
  assert.equal(api.eligiblePlaylistMovies().at(-1).uid, 750);
});

test('canonical media titles and UIDs remain selectable when row decorations are missing', async () => {
  const future = movieRow(2, '');
  future.className = 'queue_entry';
  future.uid = 2;
  future.media.title = 'Alien1979';
  const { api } = await harness([movieRow(1, 'Current (2000)'), future]);
  const [movie] = api.eligiblePlaylistMovies();
  assert.equal(movie.uid, 2);
  assert.equal(movie.title, 'Alien1979');
  assert.equal(movie.decade, 1970);
  assert.equal(api.playlistMovieMetadata(future, 'Serial 119790').decade, null);
  assert.equal(api.playlistMovieMetadata(future, '2001 A Space Odyssey (1968)').decade, 1960);
});

test('diagnostics account for every upcoming row and show fresh movies by decade', async () => {
  const rows = [movieRow(1, 'Past (1970)'), movieRow(2, 'Current (1980)'),
    movieRow(3, 'Past (1970)'), movieRow(4, 'Current (1980)'),
    movieRow(5, 'Fresh (1990)'), movieRow(6, 'Fresh (1990)'), movieRow(7, ''),
    movieRow(8, 'Wildcard')];
  const h = await harness(rows);
  h.setActive(rows[1]);
  h.api.rememberMovieNominations([h.api.eligiblePlaylistMovies()[0]]);
  const stats = h.api.getMovieSelectionDiagnostics();
  assert.equal(stats.total, 8);
  assert.equal(stats.reportedTotal, 8);
  assert.equal(stats.upcoming, 6);
  assert.equal(stats.eligible, 2);
  assert.equal(stats.fresh, 1);
  assert.deepEqual({ ...stats.excluded }, { missingIdentity: 1, history: 1, duplicates: 1, current: 1, interlude: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(stats.decades)), [
    { decade: 1990, eligible: 1, fresh: 0 }, { decade: null, eligible: 1, fresh: 1 }
  ]);
});

test('an incomplete mounted playlist never silently narrows random selections', async () => {
  const rows = [movieRow(1, 'Current'), movieRow(2, 'A (1970)'), movieRow(3, 'B (1980)')];
  const h = await harness(rows, new Map(), false, true);
  const count = { textContent: '396 items' };
  h.elements.set('plcount', count);
  assert.equal(h.api.getMovieSelectionDiagnostics().status, 'loading');
  assert.equal(h.api.eligiblePlaylistMovies().length, 0);
  h.api.openRandomMoviePoll();
  await h.flushSelection();
  assert.match(h.getBuilder().querySelector('.btfw-random-poll-eligible').textContent, /3 of 396/);
  assert.equal(h.getBuilder().querySelector('.btfw-random-poll-start').disabled, true);
  count.textContent = '3 items';
  const pending = h.api.rerollRandomMovies();
  await h.flushSelection();
  await pending;
  assert.equal(h.api.getMovieSelectionDiagnostics().status, 'ready');
  assert.equal(h.api.eligiblePlaylistMovies().length, 2);
  assert.equal(h.getBuilder().querySelector('.btfw-random-poll-start').disabled, false);
});

test('four available decades can force a scarce decade to repeat despite a large pool', async () => {
  const rows = [movieRow(0, 'Current'), movieRow(1, 'Only seventies (1979)'),
    ...Array.from({ length: 300 }, (_, i) => movieRow(i + 2, `Movie ${i} (${1980 + (i % 3) * 10})`))];
  const { api } = await harness(rows);
  for (let i = 0; i < 5; i++) {
    const movies = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
    assert.equal(new Set(movies.map((movie) => movie.decade)).size, 4);
    assert.ok(movies.some((movie) => movie.title === 'Only seventies (1979)'));
    api.rememberMovieNominations(movies);
  }
  const stats = api.getMovieSelectionDiagnostics();
  assert.equal(stats.eligible, 301);
  assert.ok(stats.fresh > 270);
  assert.equal(stats.decades[0].fresh, 0);
});

test('playlist order excludes everything above current, without a limit on upcoming rows', async () => {
  const rows = Array.from({ length: 1101 }, (_, i) => movieRow(i, `Movie ${i} (1995)`));
  const { api, setActive } = await harness(rows);
  setActive(rows[300]);
  const eligible = api.eligiblePlaylistMovies();
  assert.equal(eligible.length, 800);
  assert.equal(eligible[0].uid, 301);
  assert.equal(eligible.at(-1).uid, 1100);
  for (let i = 0; i < 10; i++) {
    assert.ok(api.sampleMovies(eligible, 5).every((movie) => movie.uid > 300));
  }
});

test('upcoming means DOM order, even when queue UIDs are out of numerical order', async () => {
  const rows = [movieRow(1, 'Played'), movieRow(900, 'Current'), movieRow(2, 'Upcoming'), movieRow(3, 'Last')];
  const { api, setActive } = await harness(rows);
  setActive(rows[1]);
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['Upcoming', 'Last']);
});

test('playlist-derived exclusions work with empty history and remain after clearing history', async () => {
  const rows = [movieRow(0, 'Played before browser opened'), movieRow(1, 'Current'), movieRow(2, 'Upcoming')];
  const { api, setActive } = await harness(rows);
  setActive(rows[1]);
  assert.equal(api.readMovieHistory().played.length, 0);
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['Upcoming']);
  api.saveMovieHistory({ winners: [], played: [], recentPolls: [] });
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['Upcoming']);
});

test('duplicate titles and renamed media below current cannot reintroduce movies above it', async () => {
  const rows = [movieRow(0, 'Played A', 'a'), movieRow(1, 'Played B', 'b'), movieRow(2, 'Current'),
    movieRow(3, 'Played A HD', 'a'), movieRow(4, 'Played B', 'different'), movieRow(5, 'Upcoming')];
  const { api, setActive } = await harness(rows);
  setActive(rows[2]);
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['Upcoming']);
});

test('no current entry or no upcoming entries never falls back to earlier movies', async () => {
  const rows = [movieRow(0, 'A'), movieRow(1, 'B'), movieRow(2, 'C')];
  const { api, setActive } = await harness(rows);
  for (const current of [null, movieRow(999, 'Not in the queue'), rows[2]]) {
    setActive(current);
    assert.equal(api.eligiblePlaylistMovies().length, 0);
    assert.equal(api.sampleMovies(api.eligiblePlaylistMovies(), 5).length, 0);
  }
  const empty = await harness([]);
  assert.equal(empty.api.eligiblePlaylistMovies().length, 0);
});

test('playlist advancement and reordering recompute upcoming eligibility on each selection', async () => {
  const rows = ['Current', 'A', 'B', 'C', 'D'].map((title, uid) => movieRow(uid, title));
  const { api, setActive } = await harness(rows);
  setActive(rows[2]);
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['C', 'D']);
  const d = rows.pop(); rows.unshift(d);
  assert.deepEqual(Array.from(api.eligiblePlaylistMovies(), (movie) => movie.title), ['C']);
});

test('manual and credits launches reject a draft that moved above current before starting', async () => {
  for (const quiet of [false, true]) {
    const rows = ['Current', 'A', 'B', 'C', 'D', 'E'].map((title, uid) => movieRow(uid, title));
    const { api, setActive, emitted } = await harness(rows);
    const draft = api.eligiblePlaylistMovies();
    setActive(rows[3]);
    assert.equal(api.launchAutomaticPoll({ movies: draft, quiet }), false);
    assert.equal(emitted.length, 0);
    assert.equal(api.launchAutomaticPoll({ movies: api.eligiblePlaylistMovies(), quiet }), true);
  }
});

test('actual builder and ten rerolls only nominate upcoming movies across four decades', async () => {
  const rows = [...Array.from({ length: 300 }, (_, i) => movieRow(i, `Past ${i} (${1930 + i % 10 * 10})`)),
    movieRow(300, 'Current'), ...Array.from({ length: 800 }, (_, i) => movieRow(i + 301, `Future ${i} (${1930 + i % 10 * 10})`))];
  const h = await harness(rows, new Map(), false, true);
  h.setActive(rows[300]);
  h.api.openRandomMoviePoll();
  await h.flushSelection();
  for (let i = 0; i < 11; i++) {
    const list = h.getBuilder().querySelector('.btfw-random-poll-list');
    const titles = list.children.map((item) => item.children[1].textContent);
    assert.equal(titles.length, 5);
    assert.ok(titles.every((title) => title.startsWith('Future ')));
    assert.ok(new Set(titles.map((title) => Math.floor(Number(title.match(/\((\d{4})\)/)[1]) / 10))).size >= 4);
    if (i < 10) {
      const pending = h.api.rerollRandomMovies();
      await h.flushSelection(); await pending;
    }
  }
  assert.ok(h.getBuilder().querySelector('.btfw-random-poll-eligible').textContent.includes('800 eligible movies below the current movie'));
});

test('five choices represent at least four decades, without duplicates', async () => {
  const rows = [movieRow(0, 'Current'), ...Array.from({ length: 700 }, (_, i) => movieRow(i + 1, `Film ${i} (${1981 + i % 5 * 10})`))];
  const { api } = await harness(rows);
  for (let i = 0; i < 100; i++) {
    const selected = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
    assert.ok(new Set(selected.map((movie) => movie.decade)).size >= 4);
    assert.equal(new Set(selected.map((movie) => movie.key)).size, 5);
  }
});

test('missing decades and unknown years fill from remaining eligible movies', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A (1990)'), movieRow(2, 'B'), movieRow(3, 'C (1970)')]);
  assert.equal(api.sampleMovies(api.eligiblePlaylistMovies(), 5).length, 3);
  assert.equal(api.playlistMovieMetadata(null, '2001: A Space Odyssey (1968)').decade, 1960);
  assert.equal(api.playlistMovieMetadata(null, 'No year').decade, null);
});

test('winner exclusion persists after reload, survives changed queue UIDs, and can be cleared', async () => {
  const rows = [movieRow(0, 'Current'), movieRow(1, 'A (1990)'), movieRow(2, 'B (2000)')];
  const first = await harness(rows);
  first.api.recordMovieWinner(first.api.eligiblePlaylistMovies()[0]);
  const reloaded = await harness([movieRow(0, 'Current'), movieRow(55, 'A (1990)', '1'), rows[2]], first.storage);
  assert.equal(reloaded.api.eligiblePlaylistMovies().length, 1);
  reloaded.api.saveMovieHistory({ winners: [], recentPolls: [] });
  assert.equal(reloaded.api.eligiblePlaylistMovies().length, 2);
});

test('duplicate media is excluded even with a different title', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A', 'same'), movieRow(2, 'A HD', 'same'), movieRow(3, 'B')]);
  assert.equal(api.eligiblePlaylistMovies().length, 2);
  api.recordMovieWinner(api.eligiblePlaylistMovies()[0]);
  assert.equal(api.eligiblePlaylistMovies().length, 1);
});

test('recent nominations are avoided when fresh movies from the same decades exist', async () => {
  const rows = [movieRow(0, 'Current'), ...Array.from({ length: 20 }, (_, i) => movieRow(i + 1, `Film ${i} (${1980 + i % 5 * 10})`))];
  const { api } = await harness(rows);
  const initial = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
  api.saveMovieHistory({ winners: [], recentPolls: [initial.map((movie) => movie.key)] });
  const next = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
  assert.ok(next.every((movie) => !initial.some((old) => old.key === movie.key)));
});

test('real poll lifecycle queues and records the winner exactly once', async () => {
  const { api, emitted } = await harness([movieRow(0, 'Current'), movieRow(1, 'A (1990)'), movieRow(2, 'B (2000)')]);
  const movies = api.eligiblePlaylistMovies();
  assert.equal(api.launchAutomaticPoll({ movies, quiet: true, durationSeconds: 90 }), true);
  const request = emitted[0][1];
  api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [1, 3] });
  api.finishAutomaticPoll();
  api.finishAutomaticPoll();
  assert.equal(api.readMovieHistory().winners.length, 1);
  assert.equal(api.readMovieHistory().winners[0].title, 'B (2000)');
  assert.equal(emitted.filter(([event]) => event === 'moveMedia').length, 1);
  assert.equal(api.eligiblePlaylistMovies().length, 1);
});

test('storage failure preserves winner exclusion for the current session', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')], new Map(), true);
  api.recordMovieWinner(api.eligiblePlaylistMovies()[0]);
  assert.equal(api.eligiblePlaylistMovies().length, 1);
});

test('stale draft cannot reintroduce a winner recorded by another tab', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')]);
  const movies = api.eligiblePlaylistMovies();
  api.recordMovieWinner(movies[0]);
  assert.equal(api.launchAutomaticPoll({ movies, quiet: true }), false);
});

test('history control displays winners and its clear button restores eligibility', async () => {
  const { api, elements } = await harness([movieRow(0, 'Current'), movieRow(1, '<Movie> (1990)'), movieRow(2, 'B')], new Map(), false, true);
  api.syncMovieHistoryControl();
  api.recordMovieWinner(api.eligiblePlaylistMovies()[0]);
  const control = elements.get('btfw-movie-poll-history');
  const dialog = elements.get('btfw-movie-history-dialog');
  assert.equal(control.tag, 'button');
  assert.equal(control.attributes['aria-haspopup'], 'dialog');
  assert.equal(control.querySelector('span').textContent, 'Movie history (1)');
  assert.equal(dialog.querySelector('.btfw-history-list').children[0].textContent, '<Movie> (1990)');
  assert.equal(dialog.open, false);
  control.listeners.click();
  assert.equal(dialog.open, true);
  dialog.querySelector('.btfw-history-clear').listeners.click();
  assert.equal(control.querySelector('span').textContent, 'Movie history (0)');
  assert.equal(dialog.querySelector('.btfw-history-empty').hidden, false);
  assert.equal(dialog.querySelector('.btfw-history-clear').disabled, true);
  assert.equal(dialog.querySelector('.btfw-history-close').focused, true);
  assert.equal(dialog.open, true);
  assert.equal(api.eligiblePlaylistMovies().length, 2);
});

test('history modal closes and restores focus, and ignores clicks and drags from inside', async () => {
  const { api, elements } = await harness([movieRow(0, 'Current'), movieRow(1, 'A')], new Map(), false, true);
  api.syncMovieHistoryControl();
  const control = elements.get('btfw-movie-poll-history');
  const dialog = elements.get('btfw-movie-history-dialog');
  control.listeners.click();
  dialog.querySelector('.btfw-history-close').listeners.click();
  assert.equal(dialog.open, false);
  assert.equal(control.focused, true);
  control.listeners.click();
  dialog.listeners.pointerdown({ target: dialog, clientX: 150, clientY: 150 });
  dialog.listeners.click({ target: dialog, clientX: 50, clientY: 50 });
  assert.equal(dialog.open, true);
  dialog.listeners.pointerdown({ target: dialog, clientX: 50, clientY: 50 });
  dialog.listeners.click({ target: dialog, clientX: 50, clientY: 50 });
  assert.equal(dialog.open, false);
  control.listeners.click();
  api.removeMovieHistoryControl();
  assert.equal(dialog.open, false);
  assert.equal(elements.has('btfw-movie-history-dialog'), false);
  assert.equal(elements.has('btfw-movie-poll-history'), false);
});

test('duplicates of the currently playing movie are excluded', async () => {
  const { api } = await harness([movieRow(0, 'Current', 'same'), movieRow(1, 'Current HD', 'same'), movieRow(2, 'Current', 'different'), movieRow(3, 'B')]);
  assert.equal(api.eligiblePlaylistMovies().length, 1);
});

test('no-vote and tied polls record exactly one randomly chosen winner', async () => {
  for (const counts of [[0, 0], [2, 2]]) {
    const { api, emitted } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')]);
    api.launchAutomaticPoll({ movies: api.eligiblePlaylistMovies(), quiet: true });
    const request = emitted[0][1];
    api.trackAutomaticPoll({ title: request.title, options: request.opts, counts });
    api.finishAutomaticPoll();
    assert.equal(api.readMovieHistory().winners.length, 1);
    assert.equal(api.eligiblePlaylistMovies().length, 1);
  }
});

test('800 movies support twenty remembered selections without repeats', async () => {
  const rows = [movieRow(0, 'Current'), ...Array.from({ length: 800 }, (_, i) => movieRow(i + 1, `Film ${i} (${1930 + i % 10 * 10})`))];
  const { api } = await harness(rows);
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const selected = api.sampleMovies(api.eligiblePlaylistMovies(), 10);
    assert.equal(selected.length, 10);
    assert.ok(new Set(selected.map((movie) => movie.decade)).size >= 4);
    selected.forEach((movie) => { assert.ok(!seen.has(movie.key)); seen.add(movie.key); });
    api.rememberMovieNominations(selected);
  }
  assert.equal(api.readMovieHistory().recentPolls.length, 20);
});

test('exhausted small decade is skipped when four fresh decades exist', async () => {
  const rows = [movieRow(0, 'Current'), movieRow(1, 'Only old movie (1980)'),
    ...Array.from({ length: 80 }, (_, i) => movieRow(i + 2, `Film ${i} (${1990 + i % 4 * 10})`))];
  const { api } = await harness(rows);
  const old = api.eligiblePlaylistMovies()[0];
  api.rememberMovieNominations([old]);
  for (let i = 0; i < 10; i++) {
    const selected = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
    assert.ok(selected.every((movie) => movie.key !== old.key));
    assert.ok(new Set(selected.map((movie) => movie.decade)).size >= 4);
  }
});

test('four decade slots leave wildcards available to movies without years', async () => {
  const { api } = await harness([movieRow(0, 'Current'), ...[1930, 1950, 1970, 1990].map((year, i) => movieRow(i + 1, `Film (${year})`)), movieRow(5, 'Unknown year')]);
  const selected = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
  assert.equal(selected.length, 5);
  assert.ok(selected.slice(0, 4).every((movie) => movie.decade != null));
  assert.equal(selected[4].title, 'Unknown year');
});

test('an exhausted pool repeats oldest nominations first and fills small polls', async () => {
  const { api } = await harness([movieRow(0, 'Current'), ...['A', 'B', 'C', 'D', 'E', 'F'].map((title, i) => movieRow(i + 1, title))]);
  const movies = api.eligiblePlaylistMovies();
  api.rememberMovieNominations(movies.slice(0, 3));
  api.rememberMovieNominations(movies.slice(3));
  const selected = api.sampleMovies(movies, 3);
  assert.equal(selected.length, 3);
  assert.ok(selected.every((movie) => ['A', 'B', 'C'].includes(movie.title)));
  assert.equal(api.sampleMovies(movies, 10).length, 6);
});

test('played movies persist across reload and exclude renamed media, independently of poll winners', async () => {
  const first = await harness([movieRow(0, 'Current'), movieRow(1, 'Manually played'), movieRow(2, 'Fresh')]);
  first.api.wireSocketEvents();
  first.socketListeners.changeMedia({ type: 'fi', id: '1', title: 'Manually played' });
  assert.equal(first.api.readMovieHistory().played.length, 1);
  assert.equal(first.api.readMovieHistory().winners.length, 0);
  first.setActive(movieRow(1, 'Manually played'));
  first.socketListeners.setCurrent(1);
  assert.equal(first.api.readMovieHistory().played.length, 1);
  const reloaded = await harness([movieRow(0, 'Current'), movieRow(9, 'Manually played HD', '1'), movieRow(2, 'Fresh')], first.storage);
  assert.equal(reloaded.api.eligiblePlaylistMovies().length, 1);
  assert.equal(reloaded.api.eligiblePlaylistMovies()[0].title, 'Fresh');
});

test('playback history keeps the latest fifty distinct movies and allows older playback again', async () => {
  const { api } = await harness([movieRow(0, 'Current'), ...Array.from({ length: 55 }, (_, i) => movieRow(i + 1, `Film ${i}`))]);
  for (let i = 0; i < 55; i++) api.recordMoviePlayback({ type: 'fi', id: String(i + 1), title: `Film ${i}` });
  assert.equal(api.readMovieHistory().played.length, 50);
  assert.equal(api.eligiblePlaylistMovies().length, 5);
  api.recordMoviePlayback({ type: 'fi', id: '6', title: 'Film 5' });
  assert.equal(api.readMovieHistory().played.length, 50);
  assert.equal(api.readMovieHistory().played.at(-1).title, 'Film 5');
});

test('remembered media identity prevents renamed nominations from immediately repeating', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')]);
  api.rememberMovieNominations([{ key: 'a', title: 'A', mediaKey: 'fi:1' }]);
  const selected = api.sampleMovies([{ key: 'a hd', title: 'A HD', mediaKey: 'fi:1', decade: null }, { key: 'b', title: 'B', mediaKey: 'fi:2', decade: null }], 1);
  assert.equal(selected[0].title, 'B');
});

test('actual builder shows busy feedback, blocks overlapping starts, and remembers each reroll', async () => {
  const h = await harness([movieRow(0, 'Current'), ...Array.from({ length: 800 }, (_, i) => movieRow(i + 1, `Film ${i} (${1930 + i % 10 * 10})`))], new Map(), false, true);
  h.api.openRandomMoviePoll();
  const builder = h.getBuilder();
  assert.equal(builder.attributes['aria-busy'], 'true');
  assert.ok(builder.querySelector('.btfw-random-poll-reroll').value.includes('fa-spinner'));
  assert.equal(h.api.startAutomaticPoll(), false);
  await h.api.rerollRandomMovies(); // overlapping request is ignored
  await h.flushSelection();
  assert.equal(builder.attributes['aria-busy'], 'false');
  assert.equal(builder.querySelector('.btfw-random-poll-list').children.length, 5);
  const seen = new Set(h.api.readMovieHistory().recentPolls.flat());
  const previousList = builder.querySelector('.btfw-random-poll-list').children;
  for (let i = 0; i < 10; i++) {
    const pending = h.api.rerollRandomMovies();
    if (i === 0) assert.equal(builder.querySelector('.btfw-random-poll-list').children, previousList);
    await h.flushSelection();
    await pending;
    const keys = h.api.readMovieHistory().recentPolls.at(-1);
    keys.forEach((key) => { assert.ok(!seen.has(key)); seen.add(key); });
  }
  assert.equal(h.api.readMovieHistory().recentPolls.length, 11);
  assert.equal(builder.querySelector('.btfw-random-poll-start').disabled, false);
  assert.equal(builder.querySelector('.btfw-random-poll-list').children.length, 5);
  assert.equal(h.api.startAutomaticPoll(), true);
  const request = h.emitted.find(([event]) => event === 'newPoll')[1];
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [0, 0, 0, 0, 0] });
  assert.equal(h.api.readMovieHistory().recentPolls.length, 11);
});

test('closing a pending reroll prevents stale selections from consuming history', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')], new Map(), false, true);
  h.api.openRandomMoviePoll();
  h.api.closeRandomPollBuilder();
  await h.flushSelection();
  assert.equal(h.api.readMovieHistory().recentPolls.length, 0);
  assert.equal(h.getBuilder(), null);
});

test('old nomination history expires after twenty selections', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')]);
  for (let i = 0; i < 21; i++) api.rememberMovieNominations([{ key: `nomination-${i}`, title: `Film ${i}` }]);
  assert.equal(api.readMovieHistory().recentPolls.length, 20);
  assert.ok(!api.readMovieHistory().recentPolls.flat().includes('nomination-0'));
});

test('small pools never relax played-movie exclusions and storage failure retains playback', async () => {
  const { api } = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')], new Map(), true);
  api.recordMoviePlayback({ type: 'fi', id: '1', title: 'A' });
  api.recordMoviePlayback({ type: 'fi', id: '2', title: 'B' });
  assert.equal(api.eligiblePlaylistMovies().length, 0);
  assert.equal(api.sampleMovies(api.eligiblePlaylistMovies(), 5).length, 0);
});

test('stale drafts require rerolling instead of silently losing decade variety', async () => {
  const { api } = await harness([movieRow(0, 'Current'), ...[1930, 1950, 1970, 1990, 2010].map((year, i) => movieRow(i + 1, `Film (${year})`))]);
  const movies = api.eligiblePlaylistMovies();
  api.recordMoviePlayback({ type: 'fi', id: '1', title: 'Film (1930)' });
  assert.equal(api.launchAutomaticPoll({ movies, quiet: true }), false);
});

test('auto credits opens shared settings without nominating movies, and saves count, time and toggles', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')], new Map(), false, true);
  h.api.syncAutoCreditsPollControl();
  const trigger = h.elements.get('btfw-auto-credits-poll-control');
  assert.equal(trigger.tag, 'button');
  assert.equal(trigger.parts.span.textContent, 'Auto credits polls · Off');
  trigger.listeners.click();
  const builder = h.getBuilder();
  assert.equal(h.elements.get('btfw-poll-settings-dialog').open, true);
  assert.equal(builder.querySelector('.btfw-random-poll-list'), null);
  assert.equal(builder.querySelector('.btfw-random-poll-reroll'), null);
  assert.equal(h.api.readMovieHistory().recentPolls.length, 0);
  builder.querySelector('#btfw-random-poll-count').listeners.change({ target: { value: '8' } });
  builder.querySelector('#btfw-random-poll-minutes').listeners.change({ target: { value: '180' } });
  builder.querySelector('.btfw-poll-auto-enabled').listeners.change({ target: { checked: true } });
  builder.querySelector('.btfw-poll-bustin-mode').listeners.change({ target: { checked: true } });
  builder.querySelector('.btfw-random-poll-start').listeners.click();
  assert.equal(h.getBuilder(), null);
  assert.deepEqual({ ...h.api.getAutoCreditsSettings() }, { enabled: true, count: 8, durationSeconds: 180, bustinMode: true });
  const reloaded = await harness([movieRow(0, 'Current'), movieRow(1, 'A')], h.storage);
  assert.deepEqual({ ...reloaded.api.getAutoCreditsSettings() }, { ...h.api.getAutoCreditsSettings() });
  reloaded.api.saveAutoCreditsSettings({ ...reloaded.api.getAutoCreditsSettings(), enabled: false });
  const disabled = await harness([movieRow(0, 'Current')], h.storage);
  assert.equal(disabled.api.getAutoCreditsSettings().enabled, false);
});

test('cancelling auto settings discards unsaved edits and never queues Bustin', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'Bustin'), movieRow(2, 'A')], new Map(), false, true);
  h.api.openAutoCreditsPoll();
  h.getBuilder().querySelector('.btfw-poll-auto-enabled').listeners.change({ target: { checked: true } });
  h.getBuilder().querySelector('.btfw-poll-bustin-mode').listeners.change({ target: { checked: true } });
  h.api.closeRandomPollBuilder();
  assert.equal(h.api.getAutoCreditsSettings().enabled, false);
  assert.equal(h.api.getAutoCreditsSettings().bustinMode, false);
  assert.equal(h.emitted.length, 0);
});

test('invalid auto preferences are bounded and disabling the integration preserves the saved choice', async () => {
  const h = await harness([movieRow(0, 'Current')]);
  h.api.saveAutoCreditsSettings({ enabled: true, count: 999, durationSeconds: -10, bustinMode: true });
  assert.equal(h.api.getAutoCreditsSettings().count, 10);
  assert.equal(h.api.getAutoCreditsSettings().durationSeconds, 30);
  h.api.applyRandomMoviePollIntegration(false);
  const reloaded = await harness([movieRow(0, 'Current')], h.storage);
  assert.equal(reloaded.api.getAutoCreditsSettings().enabled, true);
});

test('credits trigger uses saved count and voting time and starts earlier for a longer poll', async () => {
  const rows = [movieRow(0, 'Current'), ...Array.from({ length: 12 }, (_, i) => movieRow(i + 2, `Film ${i} (2000)`)), movieRow(1, 'Bustin')];
  const h = await harness(rows);
  h.api.saveAutoCreditsSettings({ enabled: true, count: 8, durationSeconds: 300, bustinMode: true });
  h.api.updateAutoCreditsMedia({ type: 'fi', id: '0', seconds: 3600, currentTime: 3250, paused: false }, true);
  await h.api.evaluateAutoCreditsPoll();
  assert.equal(h.emitted.length, 0);
  h.api.updateAutoCreditsMedia({ type: 'fi', id: '0', seconds: 3600, currentTime: 3290, paused: false });
  const pending = h.api.evaluateAutoCreditsPoll();
  await h.flushSelection();
  await pending;
  const request = h.emitted.find(([event]) => event === 'newPoll')[1];
  assert.equal(request.opts.length, 8);
  assert.equal(request.timeout, 280); // 310 seconds left minus the 30-second buffer.
  assert.ok(!request.opts.includes('Bustin'));
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: new Array(8).fill(0) });
  assert.deepEqual(JSON.parse(JSON.stringify(h.emitted.find(([event]) => event === 'moveMedia')[1])), { from: 1, after: 0 });
});

function pollRequest(h) { return h.emitted.find(([event]) => event === 'newPoll')[1]; }
function moves(h) { return JSON.parse(JSON.stringify(h.emitted.filter(([event]) => event === 'moveMedia').map(([, move]) => move))); }

test('manual Bustin mode queues the interlude on confirmed poll opening, then places the winner after it', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B'), movieRow(3, 'Bustin')], new Map(), false, true);
  h.api.openRandomMoviePoll();
  h.getBuilder().querySelector('.btfw-poll-bustin-mode').listeners.change({ target: { checked: true } });
  await h.flushSelection();
  assert.equal(h.api.startAutomaticPoll(), true);
  assert.equal(moves(h).length, 0);
  const request = pollRequest(h);
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: request.opts.map((title) => title === 'B' ? 3 : 1) });
  assert.deepEqual(moves(h), [{ from: 3, after: 0 }]);
  h.api.finishAutomaticPoll();
  assert.deepEqual(moves(h), [{ from: 3, after: 0 }, { from: 3, after: 0 }, { from: 2, after: 3 }]);
});

test('Bustin is found above the current movie despite playback history, and restored after a queue change', async () => {
  const bustin = movieRow(3, 'Bustin'), current = movieRow(0, 'Current'), a = movieRow(1, 'A'), b = movieRow(2, 'B');
  const rows = [bustin, current, a, b];
  const h = await harness(rows);
  h.setActive(current);
  h.api.recordMoviePlayback({ type: 'fi', id: '3', title: 'Bustin' });
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  const request = pollRequest(h);
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [0, 3] });
  // Another moderator moves Bustin away before voting finishes.
  rows.splice(0, rows.length, current, a, b, bustin);
  rows.forEach((row, i) => { row.nextElementSibling = rows[i + 1] || null; });
  h.api.finishAutomaticPoll();
  assert.deepEqual(moves(h).at(-2), { from: 3, after: 0 });
  assert.deepEqual(moves(h).at(-1), { from: 2, after: 3 });
});

test('when Bustin is playing at poll closure, the winner follows it without moving the active entry', async () => {
  const current = movieRow(0, 'Current'), bustin = movieRow(3, 'Bustin'), a = movieRow(1, 'A'), b = movieRow(2, 'B');
  const h = await harness([current, bustin, a, b]);
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  const request = pollRequest(h);
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [0, 3] });
  assert.equal(moves(h).length, 0); // Bustin was already next.
  h.setActive(bustin);
  h.api.finishAutomaticPoll();
  assert.deepEqual(moves(h), [{ from: 2, after: 3 }]);
});

test('missing Bustin falls back to queuing the winner normally', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B')]);
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  const request = pollRequest(h);
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [0, 3] });
  h.api.finishAutomaticPoll();
  assert.deepEqual(moves(h), [{ from: 2, after: 0 }]);
});

test('Bustin remains an interlude and never appears among movie nominations', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'Bustin'), movieRow(2, 'A')]);
  assert.equal(h.api.eligiblePlaylistMovies().length, 1);
  assert.equal(h.api.getMovieSelectionDiagnostics().excluded.interlude, 1);
});

test('a rejected launch does not queue Bustin or record nominations', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B'), movieRow(3, 'Bustin')]);
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  h.emitted[0][2]({ error: { message: 'Poll denied' } });
  assert.equal(moves(h).length, 0);
  assert.equal(h.api.readMovieHistory().recentPolls.length, 0);
});

test('winner already next is still placed after Bustin when mode is enabled', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B'), movieRow(3, 'Bustin')]);
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  const request = pollRequest(h);
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [3, 0] });
  h.api.finishAutomaticPoll();
  assert.deepEqual(moves(h).at(-1), { from: 1, after: 3 });
});

test('losing queue permission prevents Bustin and winner moves', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A'), movieRow(2, 'B'), movieRow(3, 'Bustin')]);
  h.api.launchAutomaticPoll({ movies: h.api.eligiblePlaylistMovies(), quiet: true, bustinMode: true });
  const request = pollRequest(h);
  h.window.hasPermission = (permission) => permission !== 'playlistmove';
  h.api.trackAutomaticPoll({ title: request.title, options: request.opts, counts: [3, 0] });
  h.api.finishAutomaticPoll();
  assert.equal(moves(h).length, 0);
});

test('a delayed native close event cannot discard settings opened in a new dialog', async () => {
  const h = await harness([movieRow(0, 'Current'), movieRow(1, 'A')], new Map(), false, true);
  h.api.openAutoCreditsPoll();
  h.deferDialogClose();
  h.api.closeRandomPollBuilder();
  h.api.openAutoCreditsPoll();
  const current = h.getBuilder();
  await h.flushSelection();
  assert.equal(h.getBuilder(), current);
  assert.equal(h.elements.get('btfw-poll-settings-dialog').open, true);
  current.querySelector('#btfw-random-poll-count').listeners.change({ target: { value: '7' } });
  current.querySelector('.btfw-random-poll-start').listeners.click();
  assert.equal(h.api.getAutoCreditsSettings().count, 7);
});
