const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the actual module in a browser stub, exposing internals only in this
// test copy. No production API or dependency on a live CyTube channel is needed.
const source = fs.readFileSync(path.join(__dirname, '../modules/feature-poll-overlay.js'), 'utf8')
  .replace('name: "feature:poll-overlay",', `
    sampleMovies, eligiblePlaylistMovies, playlistMovieMetadata,
    readMovieHistory, saveMovieHistory, recordMovieWinner, syncMovieHistoryControl, removeMovieHistoryControl,
    launchAutomaticPoll, trackAutomaticPoll, finishAutomaticPoll,
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
  const active = rows[0];
  active.nextElementSibling = rows[1];
  const elements = new Map();
  function element(tag) {
    const node = {
      children: [], listeners: {}, attributes: {}, textContent: '', tag, open: false,
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; },
      showModal() { this.open = true; },
      close() { this.open = false; this.listeners.close?.(); },
      getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 500 }),
      addEventListener(event, callback) { this.listeners[event] = callback; },
      appendChild(child) { this.children.push(child); child.isConnected = true; if (child.id) elements.set(child.id, child); },
      replaceChildren() { this.children = []; },
      remove() { elements.delete(this.id); },
      querySelector(selector) { return this.parts?.[selector] || null; },
      set innerHTML(value) {
        this.value = value;
        if (tag === 'button') this.parts = { span: element('span') };
        if (tag === 'dialog') this.parts = {
          '.btfw-history-close': element('button'), '.btfw-history-clear': element('button'),
          '.btfw-history-list': element('ol'), '.btfw-history-empty': element('p')
        };
      }
    };
    return node;
  }
  const controls = showControls ? element('div') : null;
  const document = {
    readyState: 'loading', body: Object.assign(element('body'), { dataset: {} }),
    addEventListener() {}, getElementById: (id) => elements.get(id) || null,
    createElement: element,
    querySelector(selector) {
      if (selector === '#pollwrap .poll-controls') return controls;
      return selector.startsWith('#queue >') && selector.includes('queue_active') ? active : null;
    },
    querySelectorAll: (selector) => selector === '#queue > .queue_entry' ? rows : []
  };
  const window = {
    BTFW_CONFIG: { integrations: { randomMoviePoll: { enabled: true } } },
    CHANNEL: { name: 'TestChannel' }, CLIENT: { rank: 3 },
    hasPermission: () => true,
    jQuery: (row) => ({ data: () => row.media }),
    socket: { emit: (...args) => emitted.push(args) }
  };
  const context = {
    window, document, console: { log() {} }, location: { pathname: '/r/TestChannel' },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem(key, value) { if (failStorage) throw Error('Storage blocked'); storage.set(key, value); }
    },
    BTFW: { init: async () => ({}), define: (_, __, factory) => { modulePromise = factory(); } }
  };
  vm.runInNewContext(source, context);
  return { api: await modulePromise, emitted, storage, elements };
}

test('all 700+ entries are eligible regardless of visibility or queue position', async () => {
  const rows = Array.from({ length: 751 }, (_, i) => movieRow(i, `Movie ${i} (1995)`));
  const { api } = await harness(rows);
  assert.equal(api.eligiblePlaylistMovies().length, 750);
  assert.equal(api.eligiblePlaylistMovies().at(-1).uid, 750);
});

test('five choices represent all requested decades, without duplicates', async () => {
  const rows = [movieRow(0, 'Current'), ...Array.from({ length: 700 }, (_, i) => movieRow(i + 1, `Film ${i} (${1981 + i % 5 * 10})`))];
  const { api } = await harness(rows);
  for (let i = 0; i < 100; i++) {
    const selected = api.sampleMovies(api.eligiblePlaylistMovies(), 5);
    assert.equal(new Set(selected.map((movie) => movie.decade)).size, 5);
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
