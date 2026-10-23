const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../modules/feature-channel-theme-admin.js'), 'utf8')
  .replace('return { name: "feature:channelThemeAdmin" };', 'return { normalizeConfig, buildConfigBlock, parseConfig, applyRuntimePlaylistCatalog, collectConfig, renderPanel };');

async function harness() {
  let pending;
  const events = [], window = { BTFW_CONFIG: {}, CLIENT: { rank: 3 }, addEventListener() {} };
  const document = {
    readyState: 'loading', addEventListener() {},
    getElementById: () => ({}), // skip unrelated admin CSS injection in the focused renderer test
    dispatchEvent(event) { events.push(event); }
  };
  vm.runInNewContext(source, {
    window, document, console,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    BTFW: { init: async () => ({}), define: (_, __, factory) => { pending = factory(); } }
  });
  return { api: await pending, window, events };
}

test('older configs default suggestions off and the new setting survives saved-config round trips', async () => {
  const { api } = await harness();
  assert.equal(api.normalizeConfig({}).playlistCatalog.pollSuggestionsEnabled, false);
  assert.equal(api.normalizeConfig({ playlistCatalog: null }).playlistCatalog.pollSuggestionsEnabled, false);
  assert.equal(api.normalizeConfig({ playlistCatalog: { pollSuggestionsEnabled: 'true' } }).playlistCatalog.pollSuggestionsEnabled, false);
  for (const enabled of [true, false]) {
    const cfg = { playlistCatalog: { enabled: true, tmdbListUrl: 'https://www.themoviedb.org/list/123', pollSuggestionsEnabled: enabled } };
    const restored = api.parseConfig(api.buildConfigBlock(cfg));
    assert.equal(restored.playlistCatalog.pollSuggestionsEnabled, enabled);
    assert.equal(restored.playlistCatalog.tmdbListUrl, cfg.playlistCatalog.tmdbListUrl);
  }
});

test('runtime publication includes the suggestion setting in the shared catalogue configuration event', async () => {
  const { api, window, events } = await harness();
  api.applyRuntimePlaylistCatalog({ playlistCatalog: { enabled: true, pollSuggestionsEnabled: true } });
  assert.equal(window.BTFW_CONFIG.playlistCatalog.pollSuggestionsEnabled, true);
  assert.equal(events.at(-1).type, 'btfw:playlistCatalogChanged');
  assert.equal(events.at(-1).detail.pollSuggestionsEnabled, true);
});

test('the admin field belongs to Playlist Catalogue and collection saves its checked value', async () => {
  const { api } = await harness();
  const panel = { innerHTML: '' };
  api.renderPanel(panel);
  const section = panel.innerHTML.match(/<details class="section" data-section="playlistCatalogue">([\s\S]*?)<\/details>/)[1];
  assert.match(section, /id="btfw-poll-suggestions-enabled" data-btfw-bind="playlistCatalog.pollSuggestionsEnabled"/);
  const input = { dataset: { btfwBind: 'playlistCatalog.pollSuggestionsEnabled' }, type: 'checkbox', checked: true };
  const form = { querySelector: () => null, querySelectorAll: selector => selector === '[data-btfw-bind]' ? [input] : [] };
  assert.equal(api.collectConfig(form, {}).playlistCatalog.pollSuggestionsEnabled, true);
  input.checked = false;
  assert.equal(api.collectConfig(form, { playlistCatalog: { pollSuggestionsEnabled: true } }).playlistCatalog.pollSuggestionsEnabled, false);
});
