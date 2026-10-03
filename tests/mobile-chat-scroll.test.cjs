const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../modules/util-chat-scroll.js'), 'utf8');

async function harness({ mobile = true, paused = false } = {}) {
  const frames = [], mutations = [], resizes = [];
  const events = new Map();
  const query = { matches: mobile, addEventListener: (_, fn) => { query.change = fn; } };
  let factory, calls = 0;
  class Buffer {
    constructor() {
      this.scrollHeight = 1000;
      this.clientHeight = 300;
      this.scrollTop = paused ? 200 : 700;
      this.events = new Map();
    }
    addEventListener(name, fn) { this.events.set(name, fn); }
    removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); }
    fire(name, event = {}) { this.events.get(name)?.(event); }
  }
  const buffer = new Buffer();
  const window = {
    SCROLLCHAT: !paused, IGNORE_SCROLL_EVENT: true,
    matchMedia: () => query,
    scrollChat() { calls++; buffer.scrollTop = buffer.scrollHeight - buffer.clientHeight; }
  };
  const document = {
    getElementById: () => buffer,
    addEventListener: (name, fn) => events.set(name, fn)
  };
  vm.runInNewContext(source, {
    BTFW: { define: (_, deps, fn) => { factory = fn; } }, window, document,
    requestAnimationFrame: fn => frames.push(fn),
    MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} disconnect() {} },
    ResizeObserver: class { constructor(fn) { resizes.push(fn); } observe() {} disconnect() {} }
  });
  const api = await factory();
  api.bind();
  return {
    api, buffer, window, query, frames, mutations, resizes, Buffer,
    calls: () => calls,
    flush() { while (frames.length) frames.shift()(); },
    jump() { events.get('click')({ target: { closest: () => ({}) } }); }
  };
}

test('new messages follow the bottom without duplicate work on repeated binds', async () => {
  const h = await harness();
  h.api.bind(); h.api.bind();
  assert.equal(h.mutations.length, 1);
  h.flush();
  h.buffer.scrollHeight += 80;
  h.mutations[0](); h.mutations[0](); h.resizes[0]();
  assert.equal(h.frames.length, 1);
  h.flush();
  assert.equal(h.buffer.scrollTop, 780);
  assert.equal(h.calls(), 2);
});

test('upward wheel cancels queued follow and blocks native resize/image scrolling', async () => {
  const h = await harness();
  h.buffer.fire('wheel', { deltaY: -60 });
  h.buffer.scrollTop = 540;
  h.flush();
  h.window.scrollChat();
  h.mutations[0](); h.resizes[0](); h.flush();
  assert.equal(h.buffer.scrollTop, 540);
  assert.equal(h.calls(), 0);
  assert.equal(h.window.SCROLLCHAT, false);
  assert.equal(h.window.IGNORE_SCROLL_EVENT, false);
});

test('touch intent pauses before scrolling and a tall last message cannot resume follow', async () => {
  const h = await harness();
  h.flush();
  h.buffer.fire('touchstart', { touches: [{ clientY: 200 }] });
  h.buffer.fire('touchmove', { touches: [{ clientY: 240 }] });
  h.window.scrollChat();
  assert.equal(h.calls(), 1);
  h.buffer.scrollTop = 500;
  // Emulate CyTube's last-message-height threshold claiming we're caught up.
  h.window.SCROLLCHAT = true;
  h.buffer.fire('scroll');
  assert.equal(h.window.SCROLLCHAT, false);
  h.window.scrollChat();
  assert.equal(h.buffer.scrollTop, 500);
});

test('jump to latest and manually reaching the bottom resume follow', async () => {
  const h = await harness({ paused: true });
  h.flush(); h.window.scrollChat();
  assert.equal(h.calls(), 0);
  h.jump(); h.flush();
  assert.equal(h.buffer.scrollTop, 700);
  h.buffer.fire('keydown', { key: 'PageUp' });
  h.buffer.scrollTop = 400; h.buffer.fire('scroll');
  h.buffer.scrollTop = 700; h.buffer.fire('scroll');
  h.buffer.scrollHeight += 50;
  h.mutations[0](); h.flush();
  assert.equal(h.buffer.scrollTop, 750);
});

test('desktop native scroll and flags remain unchanged', async () => {
  const h = await harness({ mobile: false, paused: true });
  h.buffer.fire('wheel', { deltaY: -60 });
  h.buffer.fire('keydown', { key: 'Home' });
  h.buffer.fire('scroll');
  h.mutations[0](); h.resizes[0](); h.flush();
  assert.equal(h.window.SCROLLCHAT, false);
  assert.equal(h.window.IGNORE_SCROLL_EVENT, true);
  assert.equal(h.calls(), 0);
  h.window.scrollChat();
  assert.equal(h.calls(), 1);
  assert.equal(h.buffer.scrollTop, 700);
});

test('switching from paused desktop to phone preserves reading mode', async () => {
  const h = await harness({ mobile: false, paused: true });
  h.query.matches = true; h.query.change(); h.flush();
  h.window.scrollChat();
  assert.equal(h.buffer.scrollTop, 200);
  assert.equal(h.calls(), 0);
});

test('replacing the chat buffer detaches old gesture listeners', async () => {
  const h = await harness();
  const replacement = new h.Buffer();
  h.api.bind(replacement);
  assert.equal(h.buffer.events.size, 0);
  assert.ok(replacement.events.has('wheel'));
});
