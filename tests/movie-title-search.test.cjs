const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const titleSource = fs.readFileSync(path.join(__dirname, '../modules/util-movie-title.js'), 'utf8');
async function titles() {
  let pending;
  vm.runInNewContext(titleSource, { BTFW: { define: (_, __, factory) => { pending = factory(); } } });
  return pending;
}
const movie = (title, uid = 1) => ({ title, uid, key: title.toLowerCase(), mediaKey: 'fi:' + uid });

test('spacing, punctuation, Unicode and common trailing release labels preserve movie identity', async () => {
  const api = await titles();
  for (const title of ['Terror Train (1980)', 'TerrorTrain1980', 'TERROR.TRAIN.1980', 'Terror   Train 1980 [1080p]', 'Terror Train (1980) REMASTERED']) {
    assert.equal(api.identity(title), 'terrortrain:1980', title);
  }
  assert.equal(api.identity('Amélie (2001)'), api.identity('Amelie 2001'));
  assert.equal(api.identity('１９１７ (２０１９)'), '1917:2019');
  assert.equal(api.identity('1917'), '');
  assert.equal(api.identity('Blade Runner 2049'), '');
  assert.equal(api.identity('Blade Runner 2049 (2017)'), 'bladerunner2049:2017');
  assert.equal(api.identity('Class of 1999 1990'), 'classof1999:1990');
});

test('smart matching accepts added words with the correct year and uses the exact playlist entry', async () => {
  const api = await titles();
  const pool = [movie("Terror Train - Director's Cut (1980) [1080p]", 12), movie('Terror Train (2022)', 13)];
  const index = api.createIndex(pool);
  assert.equal(index.find('Terror Train 1980').uid, 12);
  assert.equal(index.find('TerrorTrain1980').title, pool[0].title);
  assert.equal(index.find('Terror Train 1981'), null);
  assert.equal(api.createIndex([movie('Terror Uncut Train (1980)')]).find('Terror Train 1980').uid, 1);
  assert.equal(api.createIndex([movie('It Extended Edition (2017)')]).find('It 2017').uid, 1);
  assert.equal(api.createIndex([movie('It Follows (2017)')]).find('It 2017'), null);
});

test('exact names win over extended labels and multiple plausible alternatives remain ambiguous', async () => {
  const api = await titles();
  const extended = movie('Terror Train Extended Edition 1980', 1), alternate = movie('Terror Train Uncut 1980', 2), exact = movie('Terror Train (1980)', 3);
  assert.equal(api.createIndex([extended, alternate]).find('Terror Train 1980'), null);
  assert.equal(api.createIndex([extended, exact, alternate]).find('Terror Train 1980').uid, 3);
});

test('a similar partial word, new sequel number, chapter or different release year is never substituted', async () => {
  const api = await titles();
  for (const title of ['Aliens (1979)', 'Alien 2 (1979)', 'Alien II (1979)', 'Alien Part One (1979)', 'Alien (1986)']) {
    assert.equal(api.createIndex([movie(title)]).find('Alien 1979'), null, title);
  }
});

test('parsed names and indexes are reused, while a new playlist snapshot builds a fresh index', async () => {
  const api = await titles(), pool = [movie('Terror Train (1980)')];
  assert.equal(api.parse('Terror Train (1980)'), api.parse('Terror Train (1980)'));
  assert.equal(api.createIndex(pool), api.createIndex(pool));
  assert.notEqual(api.createIndex(pool), api.createIndex([...pool]));
  for (let i = 0; i < 2500; i++) api.parse('Cache entry ' + i + ' (2000)');
  assert.equal(api.identity('Terror Train (1980)'), 'terrortrain:1980');
});

async function searchHarness() {
  const helper = await titles();
  const source = fs.readFileSync(path.join(__dirname, '../modules/feature-playlist-tools.js'), 'utf8')
    .replace('return { name:"feature:playlist-tools" };', 'return { parseQuery, rowMatches, applyFilter };');
  let pending;
  vm.runInNewContext(source, {
    BTFW: { init: async () => helper, define: (_, __, factory) => { pending = factory(); } },
    window: {}, document: { readyState: 'loading', addEventListener() {} },
    URL, location: { pathname: '/r/TestChannel', href: 'https://cytu.be/r/TestChannel' }, localStorage: { getItem: () => null }, console
  });
  return pending;
}
function row(title) {
  const anchor = { textContent: title, getAttribute: () => 'https://youtu.be/example' };
  return { anchor, className: 'queue_entry pluid-1 queue_temp', classList: { contains: name => name === 'queue_temp' },
    querySelector: selector => selector === 'a.qe_title' ? anchor : { textContent: '01:30:00' } };
}

test('playlist filtering tolerates joined/extra spaces, punctuation, accents and metadata', async () => {
  const api = await searchHarness();
  for (const query of ['TerrorTrain', 'terror    train', 'Terror.Train (1980)', 'terrortrain1980', '1980 terror train']) {
    assert.equal(api.rowMatches(row('Terror Train 1980 [1080p]'), api.parseQuery(query)), true, query);
  }
  assert.equal(api.rowMatches(row('Amélie 2001'), api.parseQuery('amelie')), true);
  assert.equal(api.rowMatches(row('Terror Train 1980'), api.parseQuery('terrortrain1981')), false);
});

test('search normalization retains type, duration and temporary filters and notices renamed rows', async () => {
  const api = await searchHarness(), item = row('Terror Train 1980');
  assert.equal(api.rowMatches(item, api.parseQuery('type:yt >1h <2h temp TerrorTrain')), true);
  assert.equal(api.rowMatches(item, api.parseQuery('type:vimeo TerrorTrain')), false);
  assert.equal(api.rowMatches(item, api.parseQuery('>2h TerrorTrain')), false);
  item.anchor.textContent = 'Nightwish 1989';
  assert.equal(api.rowMatches(item, api.parseQuery('TerrorTrain')), false);
  assert.equal(api.rowMatches(item, api.parseQuery('nightwish1989')), true);
});
