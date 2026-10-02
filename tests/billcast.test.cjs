const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the real sender with browser/Cast stubs. Only the test copy exposes internals.
const source = fs.readFileSync(path.join(__dirname, '../modules/feature-billcaster.js'), 'utf8')
  .replace('  /* --------------------------------- Boot', `
  window.testApi = { sessionStateChanged, syncPlaybackTime, initializePlayer };
  /* --------------------------------- Boot`);

function harness({ existing = false, deferredLoad = false, failLoad = false, loadedState = null } = {}) {
  const playerEvents = new Map();
  const socketEvents = new Map();
  const loads = [], seeks = [], controls = [], timers = [], intervals = [];
  let now = 100000, src = 'https://example.com/movie.mp4', localTime = 1200;
  let ready = 4, localPaused = false, resolveLoad;
  const roomPlayer = { mediaType: 'fi', mediaId: 'movie' };
  const socket = { connected: true, on: (name, fn) => socketEvents.set(name, fn) };
  const media = {
    sessionId: 'session', media: { contentId: src }, currentTime: 1200, playerState: 'PLAYING',
    getEstimatedTime() { return this.currentTime; },
    getStatus() { assert.fail('Sender must not poll Cast status on room updates'); },
    seek(request, success) { seeks.push(request.currentTime); this.currentTime = request.currentTime; success(); },
    play(request, success) { assert.equal(request, null); controls.push('play'); this.playerState = 'PLAYING'; success(); },
    pause(request, success) { assert.equal(request, null); controls.push('pause'); this.playerState = 'PAUSED'; success(); }
  };
  let currentMedia = existing ? media : null;
  const session = {
    getSessionId: () => 'session', getMediaSession: () => currentMedia,
    loadMedia(request) {
      loads.push(request);
      if (failLoad) return Promise.reject('NETWORK_ERROR');
      const finish = () => {
        currentMedia = media;
        media.media = request.media;
        media.currentTime = request.currentTime;
        media.playerState = loadedState || (request.autoplay ? 'PLAYING' : 'PAUSED');
      };
      if (deferredLoad) return new Promise(resolve => { resolveLoad = () => { finish(); resolve(); }; });
      finish();
      return Promise.resolve();
    }
  };
  const localPlayer = {
    on(name, fn) { const list = playerEvents.get(name) || []; list.push(fn); playerEvents.set(name, list); },
    off(name, fn) { playerEvents.set(name, (playerEvents.get(name) || []).filter(x => x !== fn)); },
    currentTime: () => localTime, paused: () => localPaused, readyState: () => ready
  };
  const document = { body: {}, head: { appendChild() {} }, createElement: () => ({}) };
  function $(selector) {
    const element = {
      length: 1,
      ready(fn) { fn(); },
      attr(name) { return name === 'src' ? src : element; },
      text: () => 'Movie',
      on() { return element; }, css() { return element; }, appendTo() { return element; },
      addClass() { return element; }, prepend() { return element; }, append() { return element; },
      remove() { return element; }, hide() { return element; }, show() { return element; }
    };
    return element;
  }
  const states = { SESSION_STARTED: 'started', SESSION_RESUMED: 'resumed', SESSION_ENDED: 'ended' };
  const context = {
    window: { PLAYER: roomPlayer, socket }, socket, document, $, videojs: () => localPlayer,
    Date: { now: () => now }, console: { log() {}, warn() {}, error() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {},
    chrome: { cast: { media: {
      PlayerState: { PLAYING: 'PLAYING', PAUSED: 'PAUSED', IDLE: 'IDLE', BUFFERING: 'BUFFERING' }, IdleReason: { ERROR: 'ERROR' },
      SeekRequest: function () {}, MediaInfo: function (id) { this.contentId = id; },
      GenericMediaMetadata: function () {}, LoadRequest: function (info) { this.media = info; }
    } } },
    cast: { framework: { SessionState: states, CastContext: { getInstance: () => ({ getCurrentSession: () => session }) } } }
  };
  vm.runInNewContext(source, context);
  return {
    loads, seeks, controls, media, roomPlayer, socket, playerEvents, intervals,
    api: context.window.testApi,
    start: state => context.window.testApi.sessionStateChanged({ sessionState: state || 'started' }),
    event: name => { for (const fn of [...(playerEvents.get(name) || [])]) fn(); },
    room: (name, data) => socketEvents.get(name)(data),
    flush: () => { while (timers.length) timers.shift()(); },
    advance: seconds => { now += seconds * 1000; },
    local: time => { localTime = time; }, setSource: value => { src = value; },
    ready: value => { ready = value; },
    paused: value => { localPaused = value; },
    tick: () => { for (const interval of intervals) interval.fn(); },
    resolveLoad: () => resolveLoad()
  };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('initial cast starts at the current movie position', async () => {
  const h = harness(); h.start(); await settle();
  assert.equal(h.loads.length, 1);
  assert.equal(h.loads[0].currentTime, 1200);
});

test('local source reload never reloads the receiver at zero', async () => {
  const h = harness(); h.start(); await settle();
  h.event('loadstart'); h.local(0); h.ready(0); h.event('loadeddata'); await settle();
  assert.equal(h.loads.length, 1);
  assert.deepEqual(h.seeks, []);
});

test('room clock overrides a local player that temporarily resets to zero', () => {
  const h = harness({ existing: true }); h.start();
  h.local(0); h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.event('seeked'); h.event('pause');
  assert.deepEqual(h.seeks, []);
  assert.deepEqual(h.controls, []);
});

test('same-movie reconnect snapshot keeps the loaded receiver and recovers sync', () => {
  const h = harness({ existing: true }); h.start();
  h.socket.connected = false; h.room('disconnect'); h.local(0); h.event('seeked');
  h.socket.connected = true; h.room('connect'); h.api.syncPlaybackTime();
  assert.deepEqual(h.seeks, []);
  h.room('changeMedia', { type: 'fi', id: 'movie', currentTime: 1300, paused: false }); h.flush();
  assert.equal(h.loads.length, 0);
  assert.equal(h.seeks.at(-1), 1300);
});

test('resumed session adopts existing movie instead of loading it again', () => {
  const h = harness({ existing: true }); h.start('resumed');
  assert.equal(h.loads.length, 0);
});

test('connection recovery uses Cast estimated time without status polling', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1400, paused: false });
  assert.equal(h.seeks.at(-1), 1400);
});

test('pause and play requests use documented API arguments', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.paused(true); h.event('pause');
  h.paused(false); h.event('play');
  assert.deepEqual(h.controls, ['pause', 'play']);
});

test('stale room samples cannot seek the receiver', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false }); h.advance(31);
  h.local(0); h.api.syncPlaybackTime();
  assert.deepEqual(h.seeks, []);
});

test('new movie waits for its source then loads once at room time', async () => {
  const h = harness({ existing: true }); h.start();
  h.room('changeMedia', { type: 'fi', id: 'next', currentTime: 90, paused: true });
  h.flush(); assert.equal(h.loads.length, 0);
  h.roomPlayer.mediaId = 'next'; h.setSource('https://example.com/next.mp4');
  h.event('loadeddata'); h.event('loadeddata'); await settle();
  assert.equal(h.loads.length, 1);
  assert.equal(h.loads[0].media.contentId, 'https://example.com/next.mp4');
  assert.equal(h.loads[0].currentTime, 90);
  assert.equal(h.loads[0].autoplay, false);
});

test('repeated initialization does not multiply player listeners', () => {
  const h = harness(); h.api.initializePlayer(); h.api.initializePlayer();
  for (const handlers of h.playerEvents.values()) assert.equal(handlers.length, 1);
});

test('local events while disconnected cannot seek', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.room('disconnect'); h.local(0); h.event('seeked'); h.tick();
  assert.deepEqual(h.seeks, []);
});

test('ordinary room updates never seek, reload, pause, or play the receiver', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  for (let i = 0; i < 100; i++) h.room('mediaUpdate', { currentTime: 2000 + i, paused: i % 2 === 0 });
  assert.deepEqual(h.seeks, []);
  assert.deepEqual(h.controls, []);
  assert.equal(h.loads.length, 0);
});

test('concurrent readiness events share a single pending load', async () => {
  const h = harness({ deferredLoad: true }); h.start();
  h.event('loadeddata'); h.event('loadeddata'); h.api.syncPlaybackTime();
  assert.equal(h.loads.length, 1);
  h.resolveLoad(); await settle(); assert.equal(h.loads.length, 1);
});

test('genuine room seek to zero is still respected', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 0, paused: true });
  assert.equal(h.seeks.at(-1), 0);
});

test('resuming while local clock is zero waits for the room clock', () => {
  const h = harness({ existing: true }); h.local(0); h.start('resumed');
  assert.equal(h.loads.length, 0);
  assert.deepEqual(h.seeks, []);
  h.room('mediaUpdate', { currentTime: 1250, paused: false });
  assert.equal(h.seeks.at(-1), 1250);
});

test('receiver can resync from room while local video is still buffering', () => {
  const h = harness({ existing: true }); h.start(); h.event('loadstart'); h.ready(0);
  h.room('mediaUpdate', { currentTime: 1400, paused: false });
  assert.equal(h.seeks.at(-1), 1400);
  assert.equal(h.loads.length, 0);
});

test('original two-minute check preserves the 20-second tolerance', () => {
  const h = harness({ existing: true }); h.start();
  assert.equal(h.intervals.length, 1);
  assert.equal(h.intervals[0].ms, 120000);
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.room('mediaUpdate', { currentTime: 1220, paused: false }); h.tick();
  assert.deepEqual(h.seeks, []);
  h.room('mediaUpdate', { currentTime: 1221, paused: false });
  assert.deepEqual(h.seeks, []); // Clock updates are passive.
  h.tick(); assert.equal(h.seeks.at(-1), 1221);
});

test('receiver network errors do not trigger an automatic reload loop', async () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.media.playerState = 'IDLE'; h.media.idleReason = 'ERROR';
  for (let i = 0; i < 100; i++) { h.room('mediaUpdate', { currentTime: 1300 + i, paused: false }); h.tick(); }
  await settle(); assert.equal(h.loads.length, 0);
});

test('a buffering receiver is left alone until recovery can seek once', () => {
  const h = harness({ existing: true }); h.start();
  h.media.playerState = 'BUFFERING';
  for (let i = 0; i < 100; i++) h.room('mediaUpdate', { currentTime: 1400, paused: false });
  assert.deepEqual(h.seeks, []); assert.equal(h.loads.length, 0);
  h.media.playerState = 'PLAYING'; h.room('mediaUpdate', { currentTime: 1400, paused: false });
  assert.deepEqual(h.seeks, [1400]);
  for (let i = 0; i < 100; i++) h.room('mediaUpdate', { currentTime: 1400 + i, paused: false });
  assert.deepEqual(h.seeks, [1400]);
});

test('late load completion cannot block loading a newly selected movie', async () => {
  const h = harness({ deferredLoad: true }); h.start();
  h.room('changeMedia', { type: 'fi', id: 'next', currentTime: 60, paused: false });
  h.roomPlayer.mediaId = 'next'; h.setSource('https://example.com/next.mp4'); h.event('loadeddata');
  h.resolveLoad(); await settle();
  assert.equal(h.loads.length, 2);
  assert.equal(h.loads[1].currentTime, 60);
  assert.equal(h.loads[1].media.contentId, 'https://example.com/next.mp4');
  h.resolveLoad(); await settle();
  assert.equal(h.loads.length, 2);
});

test('a rejected load is not retried by timing or local load events', async () => {
  const h = harness({ failLoad: true }); h.start(); await settle();
  for (let i = 0; i < 100; i++) {
    h.room('mediaUpdate', { currentTime: 1200 + i, paused: false });
    h.event('loadeddata'); h.tick();
  }
  await settle();
  assert.equal(h.loads.length, 1);
  assert.deepEqual(h.seeks, []);
});

test('successful load with stale receiver ERROR status cannot recursively reload', async () => {
  const h = harness({ loadedState: 'IDLE' }); h.media.idleReason = 'ERROR';
  h.start(); await settle();
  for (let i = 0; i < 100; i++) {
    h.room('mediaUpdate', { currentTime: 1200 + i, paused: false }); h.tick();
  }
  await settle();
  assert.equal(h.loads.length, 1);
  assert.deepEqual(h.seeks, []);
});

test('reconnect without timing waits for one fresh CyTube position', () => {
  const h = harness({ existing: true }); h.start();
  h.room('mediaUpdate', { currentTime: 1200, paused: false });
  h.socket.connected = false; h.room('disconnect'); h.local(0);
  h.socket.connected = true; h.room('connect');
  h.room('changeMedia', { type: 'fi', id: 'movie' }); h.flush();
  assert.deepEqual(h.seeks, []);
  h.room('mediaUpdate', { currentTime: 1450, paused: false });
  assert.deepEqual(h.seeks, [1450]);
  for (let i = 0; i < 100; i++) h.room('mediaUpdate', { currentTime: 1450 + i, paused: false });
  assert.deepEqual(h.seeks, [1450]);
  assert.equal(h.loads.length, 0);
});

test('newly loaded buffering movie receives no repeated load or seek requests', async () => {
  const h = harness({ loadedState: 'BUFFERING' }); h.start(); await settle();
  for (let i = 0; i < 100; i++) {
    h.room('mediaUpdate', { currentTime: 1200 + i, paused: false }); h.event('loadeddata'); h.tick();
  }
  assert.equal(h.loads.length, 1);
  assert.deepEqual(h.seeks, []);
  assert.deepEqual(h.controls, []);
});
