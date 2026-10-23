const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/util-poll-suggestions.js'), 'utf8');

async function harness(storage = new Map(), options = {}) {
  let pending, time = Date.UTC(2026, 9, 23, 12), id = 0;
  const handlers = {}, emitted = [], notices = [], timers = [], elements = new Map(), events = {};
  function element(tag) {
    const node = {
      tag, children: [], parts: {}, listeners: {}, open: false, textContent: '',
      appendChild(child) { this.children.push(child); child.isConnected = true; if (child.id) elements.set(child.id, child); },
      replaceChildren() { this.children = []; },
      setAttribute(name, value) { this[name] = value; },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      querySelector(selector) { return this.parts[selector] || null; },
      showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); }, focus() {},
      remove() { elements.delete(this.id); },
      set innerHTML(value) {
        this.value = value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        if (tag === 'dialog') this.parts = Object.fromEntries(['ol', '[data-empty]', '[data-close]', '[data-clear]'].map(key => [key, element('div')]));
      }
    };
    return node;
  }
  const controls = element('div');
  const document = {
    head: element('head'), body: element('body'), createElement: element,
    querySelector: selector => selector === '#pollwrap .poll-controls' ? controls : null,
    querySelectorAll: () => [], getElementById: key => elements.get(key),
    addEventListener(name, callback) { (events[name] ||= []).push(callback); },
    dispatchEvent(event) { events[event.type]?.forEach(fn => fn(event)); }
  };
  const window = {
    CHANNEL: { name: 'TestChannel', css: 'body { color: red; }\n/* BTFW_POLL_SUGGESTIONS:1 */' },
    CLIENT: { name: 'Alice', rank: 3, logged_in: true, guest: false },
    BTFW_CONFIG: { integrations: { randomMoviePoll: { enabled: true } } },
    hasPermission: () => true,
    BTFW_notify: Object.fromEntries(['info', 'success', 'warn'].map(kind => [kind, data => notices.push({ kind, ...data })])),
    setInterval: () => ++id, setTimeout: (callback, delay) => { timers.push({ callback, delay }); return ++id; },
    socket: { connected: true, on(event, fn) { (handlers[event] ||= []).push(fn); }, emit: (...args) => emitted.push(args) }
  };
  const context = {
    window, document, location: { pathname: '/r/TestChannel' },
    CustomEvent: class { constructor(type) { this.type = type; } },
    Date: class extends Date { static now() { return time; } },
    localStorage: {
      getItem: key => storage.get(key),
      setItem(key, value) { if (options.failStorage) throw Error('Blocked'); storage.set(key, value); }
    },
    BTFW: { define: (_, __, factory) => { pending = factory(); } }
  };
  vm.runInNewContext(source, context);
  const api = await pending;
  const fire = (event, data) => handlers[event]?.forEach(fn => fn(data));
  fire('userlist', [{ name: 'Alice', rank: 3 }, { name: 'Bob', rank: 1 }, { name: 'Guest', rank: 0 }, { name: 'Mod', rank: 2 }]);
  const chat = (user, title, at = ++time) => fire('chatMsg', { username: user, msg: '&lt;PS:' + title + '&gt;', time: at });
  return { api, window, storage, emitted, fire, chat, elements, notices, document, controls, timers, now: () => time, advance(ms) { time += ms; } };
}
const movie = (title, uid = 1, mediaKey = '') => ({ title, key: title.toLowerCase(), uid, mediaKey });

test('year-aware matching handles parenthesized/trailing/attached years, punctuation and numeric titles', async () => {
  const { api } = await harness();
  assert.equal(api.identity('WALL-E (2008)'), api.identity('Wall E 2008'));
  assert.equal(api.identity('Alien1979'), api.identity('Alien (1979)'));
  assert.equal(api.identity('1917 (2019)'), '1917:2019');
  assert.equal(api.identity('Blade Runner 2049 (2017)'), 'bladerunner2049:2017');
  assert.equal(api.identity('1917'), '');
  assert.notEqual(api.identity('The Thing 1982'), api.identity('The Thing 2011'));
});

test('server user identity enforces one entry per registered username, case-insensitively', async () => {
  const h = await harness();
  h.chat('Guest', 'Alien 1979'); h.chat('Unknown', 'Alien 1979');
  h.chat('Alice', 'Alien 1979'); h.chat('ALICE', 'Aliens 1986');
  h.chat('Bob', 'Alien (1979)'); h.chat('Bob', 'Aliens 1986');
  assert.deepEqual(Array.from(h.api.getQueue(), x => x.title), ['Alien 1979', 'Aliens 1986']);
});

test('guest, anonymous and logged-out clients cannot emit nominations; direct repeated clicks are throttled', async () => {
  const h = await harness();
  for (const change of [{ guest: true }, { logged_in: false }, { name: '' }]) {
    const original = { ...h.window.CLIENT }; Object.assign(h.window.CLIENT, change);
    assert.equal(h.api.nominate('Alien 1979'), false); Object.assign(h.window.CLIENT, original);
  }
  assert.equal(h.emitted.length, 0);
  assert.equal(h.api.nominate('Alien 1979'), true);
  assert.equal(h.api.nominate('Aliens 1986'), false);
  assert.equal(h.emitted[0][1].msg, '<PS:Alien 1979>');
  h.chat('Alice', 'Alien 1979'); h.advance(6000);
  assert.equal(h.api.available(), false);
});

test('malformed, oversized, shadowed, muted, unknown and future commands do not change the queue', async () => {
  const h = await harness();
  const msg = data => h.fire('chatMsg', { username: 'Alice', time: h.now(), ...data });
  msg({ msg: '<PS:Alien 1979> extra' }); msg({ msg: '<PS:<img src=x> 1979>' });
  msg({ msg: '<PS:' + 'x'.repeat(190) + ' 1979>' }); msg({ msg: '<PS:Alien>' });
  msg({ msg: '<PS:Alien 1979>', meta: { shadow: true } });
  msg({ msg: '<PS:Alien 1979>', time: h.now() + 60000 });
  h.fire('setUserMeta', { name: 'Alice', meta: { muted: true } }); msg({ msg: '<PS:Alien 1979>' });
  assert.equal(h.api.getQueue().length, 0);
});

test('exact eligible playlist titles and UIDs feed existing selection, with at most six nominations', async () => {
  const h = await harness();
  for (let i = 0; i < 9; i++) { h.fire('addUser', { name: 'User' + i, rank: 1 }); h.chat('User' + i, 'Movie ' + i + ' 2004'); }
  const pool = Array.from({ length: 12 }, (_, i) => movie('Movie ' + i + ' (2004)', i));
  const mixed = h.api.mix(pool, pool.slice(0, 10), 10);
  assert.equal(mixed.length, 9); // six nominations + the only three un-nominated random movies
  assert.deepEqual(Array.from(mixed.slice(0, 6), x => x.uid), [0, 1, 2, 3, 4, 5]);
  assert.ok(mixed.every(x => ![6, 7, 8].includes(x.uid)));
  assert.equal(h.api.mix(pool, pool.slice(10), 2).length, 6);
  assert.equal(h.api.getQueue().length, 9); // previews and failed launches do not consume anything
});

test('ambiguity and unavailable titles stay pending and matching never falls back to a different remake', async () => {
  const h = await harness(); h.chat('Alice', 'The Thing 1982');
  assert.equal(h.api.resolve([movie('The Thing (2011)')]).length, 0);
  assert.equal(h.api.resolve([movie('The Thing (1982)'), movie('The.Thing 1982', 2)]).length, 0);
  assert.equal(h.api.resolve([movie('The Thing (1982)', 42)])[0].movie.uid, 42);
  assert.equal(h.api.getQueue().length, 1);
});

test('confirmed movie polls consume only included suggestions on all clients, retain overflow, and allow the next round', async () => {
  const a = await harness(), b = await harness();
  for (const h of [a, b]) { h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986'); }
  const poll = { title: 'What should we watch next? · 2 min', timestamp: '123', options: ['Alien (1979)', 'Random (2000)'] };
  for (const h of [a, b]) {
    h.fire('newPoll', poll); h.fire('newPoll', poll);
    assert.deepEqual(Array.from(h.api.getQueue(), x => x.user), ['bob']);
    h.chat('Alice', 'Another 2000'); assert.equal(h.api.getQueue().length, 1);
    h.fire('closePoll'); h.advance(1); h.chat('Alice', 'Another 2000'); h.chat('Bob', 'Third 2000');
    assert.deepEqual(Array.from(h.api.getQueue(), x => x.user), ['bob', 'alice']);
  }
});

test('unrelated polls do not consume suggestions and duplicate media never appear twice', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986');
  h.fire('newPoll', { title: 'Dinner?', options: ['Alien 1979'] }); h.fire('closePoll');
  assert.equal(h.api.getQueue().length, 2);
  const pool = [movie('Alien (1979)', 1, 'fi:shared'), movie('Aliens (1986)', 2, 'fi:shared'), movie('Other (2000)', 3, 'fi:other')];
  const mixed = h.api.mix(pool, pool, 3);
  assert.equal(new Set(mixed.map(x => x.mediaKey)).size, mixed.length);
});

test('queue and consumed-user lock survive refresh; replayed messages cannot resurrect consumed nominations', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986');
  h.fire('newPoll', { title: 'What should we watch next? · 90 sec', timestamp: 1, options: ['Alien (1979)', 'Other 2000'] });
  const reloaded = await harness(h.storage);
  assert.deepEqual(Array.from(reloaded.api.getQueue(), x => x.user), ['bob']);
  reloaded.chat('Alice', 'Another 2000'); assert.equal(reloaded.api.getQueue().length, 1);
  reloaded.fire('closePoll'); reloaded.advance(10); reloaded.chat('Alice', 'Another 2000');
  assert.equal(reloaded.api.getQueue().length, 2);
});

test('movie changes reset served usernames but preserve pending overflow even across refresh', async () => {
  const h = await harness(); h.api.mediaChanged({ type: 'fi', id: 'one' });
  h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986');
  h.fire('newPoll', { title: 'What should we watch next? · 2 min', timestamp: 1, options: ['Alien (1979)', 'Other 2000'] });
  const reloaded = await harness(h.storage); reloaded.api.mediaChanged({ type: 'fi', id: 'two' });
  reloaded.advance(10); reloaded.chat('Alice', 'Another 2000');
  assert.equal(reloaded.api.getQueue().length, 2);
});

test('moderator clear is broadcast through chat and its replay boundary prevents old suggestions returning', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979');
  const old = h.now();
  h.fire('chatMsg', { username: 'Bob', time: old + 1, msg: '&lt;PS-CLEAR&gt;' });
  assert.equal(h.api.getQueue().length, 1);
  h.fire('chatMsg', { username: 'Mod', time: old + 2, msg: '&lt;PS-CLEAR&gt;' });
  assert.equal(h.api.getQueue().length, 0);
  h.chat('Alice', 'Alien 1979', old); assert.equal(h.api.getQueue().length, 0);
  h.chat('Alice', 'Alien 1979', old + 3); assert.equal(h.api.getQueue().length, 1);
});

test('admin toggle preserves CSS, waits for the server broadcast, rejects non-admins and oversized CSS', async () => {
  const h = await harness();
  h.window.CLIENT.rank = 2; assert.equal(h.api.setEnabled(false), false);
  h.window.CLIENT.rank = 3; assert.equal(h.api.setEnabled(false), true);
  const [event, payload] = h.emitted.at(-1);
  assert.equal(event, 'setChannelCSS'); assert.match(payload.css, /^body \{ color: red; \}/);
  assert.equal((payload.css.match(/BTFW_POLL_SUGGESTIONS/g) || []).length, 1);
  assert.equal(h.api.enabled(), true);
  h.fire('channelCSSJS', payload); assert.equal(h.api.enabled(), false);
  h.chat('Alice', 'Alien 1979'); assert.equal(h.api.getQueue().length, 0);
  h.fire('channelCSSJS', { css: 'x'.repeat(20000) }); assert.equal(h.api.setEnabled(true), false);
});

test('queue is bounded and blocked storage keeps nominations for the current session', async () => {
  const h = await harness(new Map(), { failStorage: true });
  for (let i = 0; i < 110; i++) { h.fire('addUser', { name: 'User' + i, rank: 1 }); h.chat('User' + i, 'Movie ' + i + ' 2000'); }
  assert.equal(h.api.getQueue().length, 100);
  assert.equal(h.notices.filter(x => x.kind === 'warn').length, 1);
});

test('suggestions dialog uses text nodes, clears through the shared protocol, and respects permissions', async () => {
  const h = await harness(); h.chat('Bob', 'Alien 1979'); h.api.renderControl();
  h.elements.get('btfw-poll-suggestions').listeners.click();
  const dialog = h.elements.get('btfw-suggestions-dialog');
  assert.equal(dialog.open, true);
  assert.equal(dialog.parts.ol.children[0].textContent, 'Alien 1979 — bob (waiting for an eligible playlist match)');
  dialog.parts['[data-clear]'].listeners.click(); assert.equal(h.emitted.at(-1)[1].msg, '<PS-CLEAR>');
  h.window.hasPermission = () => false; h.api.renderControl();
  assert.equal(h.elements.has('btfw-poll-suggestions'), false);
});


test('turning suggestions off preserves pending entries and restores unchanged random selections', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979');
  h.fire('channelCSSJS', { css: '/* BTFW_POLL_SUGGESTIONS:0 */' });
  const pool = [movie('Alien (1979)'), movie('Other (2000)', 2)];
  const random = [pool[1]];
  assert.equal(h.api.mix(pool, random, 2), random);
  assert.equal(h.api.getQueue().length, 1);
  h.fire('channelCSSJS', { css: '/* BTFW_POLL_SUGGESTIONS:1 */' });
  assert.equal(h.api.mix(pool, random, 2)[0].title, 'Alien (1979)');
});

test('refresh after a poll closed offline releases served usernames without discarding overflow', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986');
  h.fire('newPoll', { title: 'What should we watch next? · 2 min', timestamp: 1, options: ['Alien (1979)', 'Other 2000'] });
  const reloaded = await harness(h.storage); reloaded.api.reconcilePoll(false);
  reloaded.advance(1); reloaded.chat('Alice', 'New movie 2001');
  assert.equal(reloaded.api.getQueue().length, 2);
});

test('a suggested movie played outside a poll is removed automatically and custom clear permissions are respected', async () => {
  const h = await harness(); h.chat('Alice', 'Alien 1979'); h.chat('Bob', 'Aliens 1986');
  h.window.CHANNEL.perms = { pollctl: 3, playlistmove: 2 };
  h.fire('chatMsg', { username: 'Mod', time: h.now(), msg: '<PS-CLEAR>' });
  assert.equal(h.api.getQueue().length, 2);
  h.api.mediaChanged({ type: 'fi', id: 'alien', title: 'Alien (1979)' });
  assert.deepEqual(Array.from(h.api.getQueue(), x => x.user), ['bob']);
});
