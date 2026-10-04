const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../modules/util-mobile-viewport.js'), 'utf8');

async function harness(mobile = true) {
  let factory;
  const classes = new Set(), properties = new Map();
  const mq = { matches: mobile };
  const vv = { height: 780, scale: 1, offsetTop: 0, addEventListener() {} };
  const window = { innerWidth: 390, innerHeight: 844, visualViewport: vv, matchMedia: () => mq, addEventListener() {} };
  const document = {
    body: { classList: { toggle(c, enabled) { enabled ? classes.add(c) : classes.delete(c); }, remove(...cs) { cs.forEach(c => classes.delete(c)); } } },
    documentElement: { style: { setProperty(k, v) { properties.set(k, v); } } },
    activeElement: { matches: () => false }, addEventListener() {}
  };
  vm.runInNewContext(source, { BTFW: { define: (_, deps, fn) => { factory = fn; } }, window, document, setTimeout() {} });
  const api = await factory();
  return { api, window, vv, document, classes, properties, mq, focus() { document.activeElement.matches = () => true; api.sync(); } };
}

test('Safari keyboard compacts portrait while following its visible height and offset', async () => {
  const h = await harness(); h.focus();
  h.vv.height = 360; h.vv.offsetTop = 48; h.api.sync();
  assert.ok(h.classes.has('btfw-phone-keyboard'));
  assert.ok(!h.classes.has('btfw-phone-landscape'));
  assert.equal(h.properties.get('--btfw-phone-height'), '360px');
  assert.equal(h.properties.get('--btfw-phone-top'), '48px');
  h.vv.height = 780; h.vv.offsetTop = 0; h.api.sync();
  assert.ok(!h.classes.has('btfw-phone-keyboard'));
});

test('a keyboard resizing both viewports does not turn portrait into landscape', async () => {
  const h = await harness(); h.focus();
  h.window.innerHeight = h.vv.height = 350; h.api.sync();
  assert.ok(h.classes.has('btfw-phone-keyboard'));
  assert.ok(!h.classes.has('btfw-phone-landscape'));
});

test('pinch zoom alone is not treated as a keyboard', async () => {
  const h = await harness(); h.focus();
  h.vv.scale = 2; h.vv.height = 390; h.api.sync();
  assert.ok(!h.classes.has('btfw-phone-keyboard'));
  assert.equal(h.vv.scale, 2);
});

test('rotation selects landscape and desktop removes only mobile state', async () => {
  const h = await harness();
  h.window.innerWidth = 844; h.window.innerHeight = h.vv.height = 390; h.api.sync();
  assert.ok(h.classes.has('btfw-phone-landscape'));
  h.mq.matches = false; h.api.sync();
  assert.equal(h.classes.size, 0);
  const desktop = await harness(false);
  assert.equal(desktop.properties.size, 0);
});
