const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../modules/util-chat-media-visibility.js'), 'utf8');

async function harness({ observer = true } = {}) {
  let factory;
  const io = [], mo = [], microtasks = [], documentEvents = new Map();
  class Image {
    constructor(src = 'https://media.example/emote.gif', { loaded = true, picture = false, srcset = '' } = {}) {
      this.nodeType = 1; this.dataset = {}; this.attrs = new Map([['src', src]]);
      if (srcset) this.attrs.set('srcset', srcset);
      this.complete = loaded; this.naturalWidth = loaded ? 300 : 0; this.naturalHeight = loaded ? 150 : 0;
      this.isConnected = true; this.picture = picture;
    }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    setAttribute(name, value) { this.attrs.set(name, value); }
    removeAttribute(name) { this.attrs.delete(name); }
    matches() { return true; }
    closest() { return this.picture ? {} : null; }
    querySelectorAll() { return []; }
  }
  class Buffer {
    constructor(images = []) { this.nodeType = 1; this.images = images; this.events = new Map(); }
    matches() { return false; }
    querySelectorAll() { return this.images; }
    contains(img) { return this.images.includes(img); }
    addEventListener(name, fn) { this.events.set(name, fn); }
    removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); }
  }
  const first = new Image(), buffer = new Buffer([first]);
  const document = { hidden: false, getElementById: () => buffer, addEventListener: (name, fn) => documentEvents.set(name, fn) };
  const context = {
    BTFW: { define: (_, deps, fn) => { factory = fn; } }, document,
    queueMicrotask: fn => microtasks.push(fn),
    MutationObserver: class {
      constructor(fn) { this.callback = fn; mo.push(this); }
      observe() {} disconnect() { this.disconnected = true; }
    }
  };
  if (observer) context.IntersectionObserver = class {
    constructor(fn, options) { this.callback = fn; this.options = options; this.targets = new Set(); io.push(this); }
    observe(img) { this.targets.add(img); }
    unobserve(img) { this.targets.delete(img); }
    disconnect() { this.targets.clear(); }
  };
  vm.runInNewContext(source, context);
  const api = await factory(); api.bind();
  return {
    api, buffer, first, document, io, mo, Image, Buffer,
    intersect(img, near) { io.at(-1).callback([{ target: img, isIntersecting: near }]); },
    flush() { while (microtasks.length) microtasks.shift()(); },
    load(img) {
      let stopped = false;
      buffer.events.get('load')({ target: img, stopImmediatePropagation() { stopped = true; } });
      return stopped;
    },
    add(img) { buffer.images.push(img); mo.at(-1).callback([{ addedNodes: [img], removedNodes: [] }]); },
    remove(img, connected = false) {
      buffer.images = buffer.images.filter(node => node !== img); img.isConnected = connected;
      mo.at(-1).callback([{ addedNodes: [], removedNodes: [img] }]);
    },
    hide(hidden) { document.hidden = hidden; documentEvents.get('visibilitychange')(); }
  };
}

test('uses one observer rooted at the chat buffer with 600px overscan', async () => {
  const h = await harness(); h.api.bind(); h.api.bind();
  assert.equal(h.io.length, 1); assert.equal(h.mo.length, 1);
  assert.equal(h.io[0].options.root, h.buffer);
  assert.equal(h.io[0].options.rootMargin, '600px 0px');
  assert.equal(h.first.loading, 'lazy'); assert.equal(h.first.decoding, 'async');
});

test('offscreen animated media is replaced by a placeholder with the actual intrinsic size', async () => {
  const h = await harness(), original = h.first.getAttribute('src');
  h.intersect(h.first, false);
  assert.equal(h.first.dataset.btfwMediaSrc, original);
  const svg = decodeURIComponent(h.first.getAttribute('src'));
  assert.match(svg, /width="300" height="150"/);
  assert.equal(h.api.getSource(h.first), original);
  assert.equal(h.first.getAttribute('width'), null, 'CSS sizing remains responsive');
  h.intersect(h.first, true);
  assert.equal(h.first.getAttribute('src'), original);
  assert.equal(h.first.dataset.btfwMediaSrc, undefined);
  assert.equal(h.first.loading, 'eager');
});

test('unknown image dimensions never collapse into a placeholder before the first real load', async () => {
  const h = await harness(), img = new h.Image('https://media.example/new.gif', { loaded: false });
  h.add(img); h.intersect(img, false);
  assert.equal(img.getAttribute('src'), 'https://media.example/new.gif');
  img.complete = true; img.naturalWidth = 400; img.naturalHeight = 240;
  assert.equal(h.load(img), false, 'first load reaches normal image listeners');
  h.flush();
  assert.match(decodeURIComponent(img.getAttribute('src')), /width="400" height="240"/);
});

test('placeholder and restored-image load events cannot run native history compensation', async () => {
  const h = await harness();
  assert.equal(h.load(h.first), false); h.flush();
  h.intersect(h.first, false);
  assert.equal(h.load(h.first), true, 'placeholder load is suppressed'); h.flush();
  h.intersect(h.first, true);
  assert.equal(h.load(h.first), true, 'restoration load is suppressed'); h.flush();
  assert.equal(h.load(h.first), false, 'later independent load events are normal');
});

test('GIF autoplay changes update the saved source without awakening offscreen media', async () => {
  const h = await harness(); h.intersect(h.first, false);
  const placeholder = h.first.getAttribute('src');
  h.api.setSource(h.first, 'https://media.example/still.gif');
  assert.equal(h.first.getAttribute('src'), placeholder);
  assert.equal(h.api.getSource(h.first), 'https://media.example/still.gif');
  h.intersect(h.first, true);
  assert.equal(h.first.getAttribute('src'), 'https://media.example/still.gif');
});

test('responsive source candidates are removed while suspended and restored intact', async () => {
  const h = await harness(), img = new h.Image('https://media.example/image.gif', { srcset: 'a.gif 1x, b.gif 2x' });
  h.add(img); h.intersect(img, false);
  assert.equal(img.getAttribute('srcset'), null);
  h.intersect(img, true);
  assert.equal(img.getAttribute('srcset'), 'a.gif 1x, b.gif 2x');
});

test('external source changes finish loading before their new URL and dimensions are suspended', async () => {
  const h = await harness();
  h.first.setAttribute('src', 'https://media.example/replacement.webp');
  h.first.complete = false;
  h.intersect(h.first, false);
  assert.equal(h.first.getAttribute('src'), 'https://media.example/replacement.webp');
  h.first.complete = true; h.first.naturalWidth = 64; h.first.naturalHeight = 32;
  assert.equal(h.load(h.first), false); h.flush();
  assert.equal(h.api.getSource(h.first), 'https://media.example/replacement.webp');
  assert.match(decodeURIComponent(h.first.getAttribute('src')), /width="64" height="32"/);
});

test('background tabs suspend all loaded media and restore only nearby media', async () => {
  const h = await harness(), far = new h.Image(); h.add(far);
  h.intersect(h.first, true); h.intersect(far, false);
  h.hide(true);
  assert.ok(h.first.dataset.btfwMediaSrc); assert.ok(far.dataset.btfwMediaSrc);
  h.hide(false);
  assert.equal(h.first.dataset.btfwMediaSrc, undefined);
  assert.ok(far.dataset.btfwMediaSrc);
});

test('trimmed images are unobserved and released, while moved images get their source back', async () => {
  const h = await harness(); h.intersect(h.first, false); h.remove(h.first);
  assert.equal(h.io[0].targets.has(h.first), false);
  h.api.setSource(h.first, 'https://media.example/released.gif');
  assert.equal(h.first.getAttribute('src'), 'https://media.example/released.gif', 'released image is no longer managed');
  const moved = new h.Image(); h.add(moved); h.intersect(moved, false); h.remove(moved, true);
  assert.equal(moved.getAttribute('src'), 'https://media.example/emote.gif');
});

test('re-adopting detached suspended media retains its original URL and can restore it', async () => {
  const h = await harness(); h.intersect(h.first, false); h.load(h.first); h.flush(); h.remove(h.first);
  h.first.isConnected = true; h.add(h.first); h.intersect(h.first, true);
  assert.equal(h.first.getAttribute('src'), 'https://media.example/emote.gif');
});

test('replacing the buffer removes old observers and capture listeners', async () => {
  const h = await harness(), image = new h.Image(), replacement = new h.Buffer([image]);
  h.api.bind(replacement);
  assert.equal(h.buffer.events.size, 0);
  assert.equal(h.io[0].targets.size, 0);
  assert.equal(h.mo[0].disconnected, true);
  assert.ok(h.io[1].targets.has(image));
});

test('re-adoption before the placeholder finishes loading preserves the original image', async () => {
  const h = await harness(); h.intersect(h.first, false); h.remove(h.first);
  h.first.complete = false; h.first.naturalWidth = 0; h.first.naturalHeight = 0;
  h.first.isConnected = true; h.add(h.first);
  h.first.complete = true; h.first.naturalWidth = 300; h.first.naturalHeight = 150;
  assert.equal(h.load(h.first), true, 'pending placeholder load still bypasses history compensation');
  h.flush();
  assert.equal(h.api.getSource(h.first), 'https://media.example/emote.gif');
  h.intersect(h.first, true);
  assert.equal(h.first.getAttribute('src'), 'https://media.example/emote.gif');
});

test('without IntersectionObserver, native lazy hints and original sources still work', async () => {
  const h = await harness({ observer: false });
  assert.equal(h.first.getAttribute('src'), 'https://media.example/emote.gif');
  assert.equal(h.first.loading, 'lazy');
  h.hide(true); assert.ok(h.first.dataset.btfwMediaSrc);
  h.hide(false); assert.equal(h.first.dataset.btfwMediaSrc, undefined);
});

test('picture-controlled images keep their source selection untouched', async () => {
  const h = await harness(), picture = new h.Image('https://media.example/picture.gif', { picture: true });
  h.add(picture);
  assert.equal(h.io[0].targets.has(picture), false);
});

test('GIF favorites read the original media URL while its image is suspended', async () => {
  const h = await harness();
  const img = new h.Image('https://media.giphy.com/media/H123/200.gif');
  img.classList = { contains: name => name === 'giphy' };
  h.add(img); h.intersect(img, false);
  const gifSource = fs.readFileSync(path.join(__dirname, '../modules/feature-gifs.js'), 'utf8');
  const parseSource = gifSource.slice(gifSource.indexOf('  function parseChatGif('), gifSource.indexOf('  function setGifHidden('));
  const context = {
    buildGiphyClassic: id => `https://media.giphy.com/media/${id}/200.gif`,
    makeFavoriteKey: item => item.id
  };
  vm.runInNewContext(parseSource, context);
  const item = context.parseChatGif(img);
  assert.equal(item.id, 'H123');
  assert.equal(item.thumb, 'https://media.giphy.com/media/H123/200.gif');
  assert.equal(item.favKey, 'H123');
});
