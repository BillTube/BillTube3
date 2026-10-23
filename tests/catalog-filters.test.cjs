const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function harness() {
  let pending;
  const source = fs.readFileSync(path.join(__dirname, '../modules/feature-playlist-catalog.js'), 'utf8')
    .replace('return { name:"feature:playlistCatalog", open:openModal, sync };', 'return { state, filteredItems, needsFullList, render };');
  vm.runInNewContext(source, {
    window: {}, document: { querySelector: () => null, addEventListener() {}, documentElement: {} },
    MutationObserver: class { observe() {} },
    BTFW: { init: async () => ({}), define: (_, __, factory) => { pending = factory(); } }
  });
  const api = await pending;
  Object.assign(api.state, {
    queryEl: { value: '' }, decadeEl: { value: '' }, ratingEl: { value: '' },
    sortEl: { value: 'order' }, directionEl: { value: 'asc' }
  });
  return api;
}
const item = (id, date, rating, extra = {}) => ({ id, title: 'Movie ' + id, release_date: date, vote_average: rating, ...extra });
const ids = api => Array.from(api.filteredItems(), row => row.id);

test('decade filters include the entire decade and exclude adjacent years and missing dates', async () => {
  const api = await harness();
  api.state.items = [item(1, '1979-12-31', 9), item(2, '1980-01-01', 8), item(3, '1989-12-31', 7), item(4, '1990-01-01', 6), item(5, '', 9), item(6, 'unknown', 9)];
  api.state.decadeEl.value = '1980';
  assert.deepEqual(ids(api), [2, 3]);
  api.state.decadeEl.value = '';
  assert.equal(ids(api).length, 6);
});

test('minimum rating uses the TMDB ten-point scale inclusively and excludes invalid scores', async () => {
  const api = await harness();
  api.state.items = [item(1, '1980', 5.99), item(2, '1980', 6), item(3, '1980', '8.2'), item(4, '1980', null), item(5, '1980', undefined), item(6, '1980', Infinity), item(7, '1980', 11)];
  api.state.ratingEl.value = '6'; assert.deepEqual(ids(api), [2, 3]);
  api.state.ratingEl.value = '8'; assert.deepEqual(ids(api), [3]);
  api.state.ratingEl.value = ''; assert.equal(ids(api).length, 7);
});

test('decade and rating combine with search and sorting without changing source order', async () => {
  const api = await harness();
  api.state.items = [item(1, '1980-01-01', 6, { title: 'Alien Alpha' }), item(2, '1989-01-01', 8, { title: 'Alien Beta' }), item(3, '1981-01-01', 9, { title: 'Other' }), item(4, '1990-01-01', 9, { title: 'Alien Gamma' })];
  api.state.decadeEl.value = '1980'; api.state.ratingEl.value = '6'; api.state.queryEl.value = 'alien';
  api.state.sortEl.value = 'rating'; api.state.directionEl.value = 'desc';
  assert.deepEqual(ids(api), [2, 1]);
  assert.deepEqual(api.state.items.map(row => row.id), [1, 2, 3, 4]);
});

test('a decade or rating selection requests full-list results and clearing both restores default pagination', async () => {
  const api = await harness();
  assert.equal(api.needsFullList(), false);
  api.state.decadeEl.value = '1980'; assert.equal(api.needsFullList(), true);
  api.state.decadeEl.value = ''; api.state.ratingEl.value = '4'; assert.equal(api.needsFullList(), true);
  api.state.ratingEl.value = ''; assert.equal(api.needsFullList(), false);
});

test('loading keeps one centered indicator across page renders, and failure replaces it with retry', async () => {
  const api = await harness();
  let html = '', writes = 0;
  const attributes = {};
  api.state.modal = { querySelector: () => null };
  api.state.listEl = {
    classList: { toggle() {} }, setAttribute: (key, value) => { attributes[key] = value; },
    querySelector: () => html.includes('data-role="loading"') ? {} : null,
    get innerHTML() { return html; }, set innerHTML(value) { html = value; writes++; }
  };
  api.state.decadeEl.value = '1980';
  api.render(); api.render();
  assert.equal(writes, 1); assert.equal(attributes['aria-busy'], 'true');
  assert.match(html, /role="status"/); assert.doesNotMatch(html, /Loading the full catalog/);
  api.state.loadFailed = true; api.render();
  assert.equal(attributes['aria-busy'], 'false'); assert.match(html, /retry-page/);
});
