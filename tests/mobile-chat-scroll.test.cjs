const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../modules/util-chat-scroll.js'), 'utf8');

async function harness({ mobile = true, paused = false, native = true } = {}) {
  const frames = [], mutations = [], resizes = [], resizeTargets = new Set();
  const events = new Map();
  const query = { matches: mobile };
  let factory, calls = 0, time = 1000, indicator = null;
  class Buffer {
    constructor() {
      this.scrollHeight = 1000;
      this.clientHeight = 300;
      this.scrollTop = paused ? 200 : 700;
      this.children = [];
      this.events = new Map();
    }
    addEventListener(name, fn, options) {
      this.events.set(options === true || options?.capture ? `${name}:capture` : name, fn);
    }
    removeEventListener(name, fn, options) {
      const key = options === true || options?.capture ? `${name}:capture` : name;
      if (this.events.get(key) === fn) this.events.delete(key);
    }
    fire(name, event = {}) {
      this.events.get(`${name}:capture`)?.(event);
      // The native bubble listener consumes the flag before our bubble listener.
      if (name === 'scroll') window.IGNORE_SCROLL_EVENT = false;
      this.events.get(name)?.(event);
    }
  }
  const buffer = new Buffer();
  let current = buffer;
  const window = { SCROLLCHAT: !paused, IGNORE_SCROLL_EVENT: true, matchMedia: () => query };
  if (native) window.scrollChat = function () {
    calls++;
    current.scrollTop = current.scrollHeight - current.clientHeight;
    window.IGNORE_SCROLL_EVENT = true;
    indicator = null;
  };
  const document = {
    getElementById: id => id === 'messagebuffer' ? current : indicator,
    addEventListener: (name, fn) => events.set(name, fn)
  };
  vm.runInNewContext(source, {
    BTFW: { define: (_, deps, fn) => { factory = fn; } }, window, document,
    Date: { now: () => time }, requestAnimationFrame: fn => frames.push(fn),
    MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} disconnect() {} },
    ResizeObserver: class {
      constructor(fn) { resizes.push(fn); }
      observe(row) { resizeTargets.add(row); }
      unobserve(row) { resizeTargets.delete(row); }
      disconnect() { resizeTargets.clear(); }
    }
  });
  const api = await factory();
  api.bind();
  return {
    api, buffer, window, query, frames, mutations, resizes, Buffer, resizeTargets,
    calls: () => calls,
    advance(ms) { time += ms; },
    flush() { while (frames.length) frames.shift()(); },
    message(height = 80) {
      const row = { nodeType: 1 };
      current.children.push(row);
      current.scrollHeight += height;
      mutations.at(-1)([{ target: current, addedNodes: [row] }]);
      return row;
    },
    decorate() { mutations.at(-1)([{ target: { nodeType: 1 }, addedNodes: [{ nodeType: 1 }] }]); },
    remove(row) {
      current.children = current.children.filter(node => node !== row);
      mutations.at(-1)([{ target: current, addedNodes: [] }]);
    },
    replace(replacement) { current = replacement; api.bind(replacement); },
    jump() { indicator = {}; events.get('click')({ target: { closest: () => indicator } }); }
  };
}

for (const mobile of [true, false]) {
  const mode = mobile ? 'phone' : 'desktop';
  test(`${mode}: new messages and native/media requests are batched, repeated binds do no work`, async () => {
    const h = await harness({ mobile });
    h.api.bind(); h.api.bind(); h.flush();
    assert.equal(h.calls(), 0, 'already at bottom, no redundant native write');
    assert.equal(h.mutations.length, 1);
    h.message(); h.message();
    h.window.scrollChat(); h.window.scrollChat(); h.resizes[0]();
    assert.equal(h.frames.length, 1);
    h.flush();
    assert.equal(h.buffer.scrollTop, 860);
    assert.equal(h.calls(), 1);
    h.buffer.fire('scroll');
    assert.equal(h.window.SCROLLCHAT, true);
  });

  test(`${mode}: upward wheel cancels pending follow and blocks all requests for 25 seconds`, async () => {
    const h = await harness({ mobile });
    h.message();
    h.buffer.fire('wheel', { deltaY: -60 });
    h.buffer.scrollTop = 540; h.buffer.fire('scroll');
    h.flush(); h.window.scrollChat(); h.message(); h.resizes[0](); h.flush();
    assert.equal(h.buffer.scrollTop, 540);
    assert.equal(h.calls(), 0);
    assert.equal(h.window.SCROLLCHAT, false);
    assert.equal(h.window.IGNORE_SCROLL_EVENT, false);
    h.advance(24999); h.message(); h.flush();
    assert.equal(h.buffer.scrollTop, 540);
    h.advance(1); h.message(); h.flush();
    assert.equal(h.buffer.scrollTop, h.buffer.scrollHeight - h.buffer.clientHeight);
    assert.equal(h.window.SCROLLCHAT, true);
  });

  test(`${mode}: expiry alone, resizing, media loading, and row decoration never resume`, async () => {
    const h = await harness({ mobile });
    h.buffer.fire('wheel', { deltaY: -1 });
    h.buffer.scrollTop = 400; h.buffer.fire('scroll');
    h.advance(26000);
    h.window.scrollChat(); h.resizes[0](); h.decorate();
    h.buffer.fire('load'); h.buffer.fire('loadedmetadata'); h.api.scheduleFollow();
    h.api.bind(); h.flush();
    assert.equal(h.buffer.scrollTop, 400);
    assert.equal(h.calls(), 0);
    assert.equal(h.window.SCROLLCHAT, false);
    h.message(); h.flush();
    assert.equal(h.calls(), 1);
  });

  test(`${mode}: each upward gesture restarts the pause`, async () => {
    const h = await harness({ mobile });
    h.buffer.fire('wheel', { deltaY: -1 });
    h.advance(24000); h.buffer.fire('wheel', { deltaY: -1 });
    h.advance(1000); h.message(); h.flush();
    assert.equal(h.calls(), 0);
    h.advance(24000); h.message(); h.flush();
    assert.equal(h.calls(), 1);
  });

  test(`${mode}: manually returning to bottom ends the pause immediately`, async () => {
    const h = await harness({ mobile });
    h.buffer.fire('keydown', { key: 'PageUp' });
    h.buffer.scrollTop = 400; h.buffer.fire('scroll');
    h.buffer.scrollTop = 700; h.buffer.fire('scroll');
    h.message(); h.flush();
    assert.equal(h.buffer.scrollTop, 780);
    assert.equal(h.calls(), 1);
    assert.equal(h.window.SCROLLCHAT, true);
    h.message(); h.flush();
    assert.equal(h.buffer.scrollTop, 860);
  });

  test(`${mode}: replacing an old row with an equal-height message cannot pause follow`, async () => {
    const h = await harness({ mobile });
    h.flush();
    // A full buffer trims its first row as a new row arrives. Browser scroll
    // anchoring moves scrollTop up, although the total height hasn't changed.
    h.message(0);
    h.buffer.scrollTop = 620;
    h.buffer.fire('scroll');
    assert.equal(h.window.SCROLLCHAT, true);
    h.flush();
    assert.equal(h.buffer.scrollTop, 700);
    h.message(); h.flush();
    assert.equal(h.buffer.scrollTop, 780);
  });

  test(`${mode}: scrolling partway through a tall last message stays paused`, async () => {
    const h = await harness({ mobile });
    h.flush();
    h.buffer.fire('wheel', { deltaY: -1 });
    h.buffer.scrollTop = 400; h.buffer.fire('scroll');
    h.buffer.fire('wheel', { deltaY: 1 });
    h.buffer.scrollTop = 660; h.window.SCROLLCHAT = true; h.buffer.fire('scroll');
    h.message(); h.flush();
    assert.equal(h.window.SCROLLCHAT, false);
    assert.equal(h.buffer.scrollTop, 660);
  });

  test(`${mode}: downward wheel, touch, and End at bottom resume even without movement`, async () => {
    for (const input of ['wheel', 'touch', 'key']) {
      const h = await harness({ mobile });
      h.flush();
      h.buffer.fire('wheel', { deltaY: -1 });
      if (input === 'wheel') h.buffer.fire('wheel', { deltaY: 1 });
      if (input === 'touch') {
        h.buffer.fire('touchstart', { touches: [{ clientY: 200 }] });
        h.buffer.fire('touchmove', { touches: [{ clientY: 180 }] });
      }
      if (input === 'key') h.buffer.fire('keydown', { key: 'End' });
      h.message(); h.flush();
      assert.equal(h.window.SCROLLCHAT, true, input);
      assert.equal(h.buffer.scrollTop, 780, input);
    }
  });

  test(`${mode}: native scroll compensation landing at bottom cannot end the pause`, async () => {
    const h = await harness({ mobile });
    h.flush();
    h.buffer.fire('wheel', { deltaY: -1 });
    h.buffer.scrollTop = 500; h.buffer.fire('scroll');
    h.window.IGNORE_SCROLL_EVENT = true;
    h.buffer.scrollTop = 700; h.buffer.fire('scroll');
    h.message(); h.flush();
    assert.equal(h.window.SCROLLCHAT, false);
    assert.equal(h.calls(), 0);
  });

  test(`${mode}: pending layout changes don't mask a later scrollbar gesture`, async () => {
    const h = await harness({ mobile });
    h.flush();
    h.buffer.fire('wheel', { deltaY: -1 });
    h.buffer.scrollTop = 500; h.buffer.fire('scroll');
    h.decorate(); h.flush();
    h.advance(24000);
    h.buffer.scrollTop = 480; h.buffer.fire('scroll');
    h.advance(1000); h.message(); h.flush();
    assert.equal(h.window.SCROLLCHAT, false);
    h.advance(24000); h.message(); h.flush();
    assert.equal(h.window.SCROLLCHAT, true);
  });

  test(`${mode}: a scrollbar gesture clears a stale native ignore flag`, async () => {
    const h = await harness({ mobile });
    h.flush();
    h.buffer.fire('wheel', { deltaY: -1 });
    h.buffer.scrollTop = 0; h.buffer.fire('scroll');
    h.window.IGNORE_SCROLL_EVENT = true;
    h.buffer.fire('pointerdown', { target: h.buffer });
    h.buffer.scrollTop = 700; h.buffer.fire('scroll');
    h.message(); h.flush();
    assert.equal(h.window.SCROLLCHAT, true);
    assert.equal(h.buffer.scrollTop, 780);
  });
}

test('touch intent and continued upward momentum renew the pause', async () => {
  const h = await harness();
  h.buffer.fire('touchstart', { touches: [{ clientY: 200 }] });
  h.buffer.fire('touchmove', { touches: [{ clientY: 240 }] });
  h.buffer.scrollTop = 500; h.buffer.fire('scroll');
  h.advance(10000);
  h.buffer.scrollTop = 480; h.buffer.fire('scroll');
  h.buffer.fire('touchend');
  // Native CyTube can claim a tall last message counts as caught up.
  h.window.SCROLLCHAT = true; h.buffer.fire('scroll');
  assert.equal(h.window.SCROLLCHAT, false);
  h.advance(15000); h.message(); h.flush();
  assert.equal(h.calls(), 0);
  h.advance(10000); h.message(); h.flush();
  assert.equal(h.calls(), 1);
});

test('scrollbar dragging pauses even without wheel/touch/key intent', async () => {
  const h = await harness({ mobile: false });
  h.flush(); h.resizes[0]();
  h.buffer.scrollTop = 420;
  h.resizes[0](); // Same-size row notifications must not swallow the gesture.
  h.buffer.fire('scroll'); h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 420);
  assert.equal(h.window.SCROLLCHAT, false);
  h.advance(25000); h.message(); h.flush();
  assert.equal(h.calls(), 1);
});

test('resizing, buffer trimming, and layout movement do not falsely pause follow', async () => {
  const h = await harness();
  h.flush();
  h.buffer.scrollHeight = 900; h.buffer.scrollTop = 600; h.buffer.fire('scroll');
  assert.equal(h.window.SCROLLCHAT, true);
  h.buffer.clientHeight = 400; h.resizes[0](); h.buffer.fire('scroll'); h.flush();
  assert.equal(h.buffer.scrollTop, 500);
  h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 580);
});

test('media growth between the follow write and its scroll event cannot disable follow', async () => {
  const h = await harness();
  h.message(); h.flush();
  // A newly visible/loaded row grows before the previous scroll event arrives.
  h.buffer.scrollHeight += 200;
  h.resizes[0]();
  h.buffer.fire('scroll');
  assert.equal(h.window.SCROLLCHAT, true);
  h.flush();
  assert.equal(h.buffer.scrollTop, 980);
  h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 1060);
});

test('native history compensation cannot extend the pause when trimming keeps total height unchanged', async () => {
  const h = await harness();
  h.buffer.fire('wheel', { deltaY: -1 });
  h.buffer.scrollTop = 500; h.buffer.fire('scroll');
  h.advance(24000);
  // One row arrives and an equal-height row is removed. CyTube compensates
  // scrollTop with scrollAndIgnoreEvent() to keep the visible history steady.
  h.window.IGNORE_SCROLL_EVENT = true;
  h.buffer.scrollTop = 470; h.buffer.fire('scroll');
  h.advance(1000); h.message(); h.flush();
  assert.equal(h.calls(), 1, 'cooldown is measured from user input, not buffer trimming');
});

test('late GIF/card size changes follow once, but cannot end a pause', async () => {
  const h = await harness();
  const row = h.message(); h.flush();
  assert.ok(h.resizeTargets.has(row));
  h.buffer.scrollHeight += 300; h.resizes[0](); h.buffer.fire('load'); h.flush();
  assert.equal(h.buffer.scrollTop, 1080);
  assert.equal(h.calls(), 2);
  h.buffer.fire('wheel', { deltaY: -1 }); h.buffer.scrollTop = 400;
  h.buffer.scrollHeight += 200; h.resizes[0](); h.buffer.fire('load'); h.flush();
  assert.equal(h.buffer.scrollTop, 400);
  h.remove(row);
  assert.ok(!h.resizeTargets.has(row), 'trimmed rows are unobserved');
});

test('keyboard navigation pauses, but editing a nested input does not', async () => {
  const h = await harness();
  h.buffer.fire('keydown', { key: 'ArrowUp', target: { closest: () => ({}) } });
  h.message(); h.flush();
  assert.equal(h.calls(), 1);
  h.buffer.fire('keydown', { key: ' ', shiftKey: true });
  h.message(); h.flush();
  assert.equal(h.calls(), 1);
  assert.equal(h.window.SCROLLCHAT, false);
});

test('respects a chat already paused before initialization, including viewport changes', async () => {
  const h = await harness({ mobile: false, paused: true });
  h.flush(); h.window.scrollChat(); h.advance(30000); h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 200);
  h.query.matches = true; h.api.bind(); h.resizes[0](); h.flush();
  assert.equal(h.calls(), 0);
  h.buffer.scrollTop = h.buffer.scrollHeight - h.buffer.clientHeight;
  h.buffer.fire('scroll'); h.message(); h.flush();
  assert.equal(h.calls(), 1);
});

test('replacing the buffer detaches all old listeners and preserves remaining cooldown', async () => {
  const h = await harness();
  h.buffer.fire('wheel', { deltaY: -1 }); h.advance(10000);
  const replacement = new h.Buffer(); replacement.scrollTop = 400;
  h.replace(replacement);
  assert.equal(h.buffer.events.size, 0);
  assert.ok(replacement.events.has('wheel'));
  h.message(); h.flush();
  assert.equal(replacement.scrollTop, 400);
  h.advance(15000); h.message(); h.flush();
  assert.equal(replacement.scrollTop, replacement.scrollHeight - replacement.clientHeight);
});

test('works without native scrollChat', async () => {
  const h = await harness({ native: false });
  h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 780);
  h.buffer.fire('wheel', { deltaY: -1 }); h.buffer.scrollTop = 450;
  h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 450);
  h.advance(25000); h.message(); h.flush();
  assert.equal(h.buffer.scrollTop, 940);
});
