/* Shared, bounded title normalization for playlist search and poll suggestions. */
BTFW.define("util:movieTitle", [], async () => {
  const MAX_CACHE = 2000;
  const folds = new Map(), parsed = new Map(), indexes = new WeakMap();
  const maxYear = new Date().getFullYear() + 2;
  function remember(cache, key, value) {
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, value); return value;
  }
  function fold(value) {
    const raw = String(value || "");
    if (folds.has(raw)) return folds.get(raw);
    return remember(folds, raw, raw.normalize("NFKC").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  }
  const compact = value => fold(value).replace(/ /g, "");
  function parse(value) {
    const raw = String(value || "");
    if (parsed.has(raw)) return parsed.get(raw);
    const text = raw.normalize("NFKC").trim();
    const candidates = Array.from(text.matchAll(/(?:18|19|20)\d{2}/g)).filter(match => {
      const before = text.slice(0, match.index), after = text.slice(match.index + 4);
      return match.index > 0 && Number(match[0]) <= maxYear && !/\d$/.test(before) && !/^\d/.test(after)
        && /[\p{L}\p{N}]/u.test(before);
    });
    // Tagged years are stronger than numbers in the title or in a remaster label.
    const tagged = candidates.find(match => /[([]\s*$/.test(text.slice(0, match.index)) && /^\s*[)\]]/.test(text.slice(match.index + 4)));
    const year = tagged || candidates.at(-1);
    if (!year) return remember(parsed, raw, null);
    const title = fold(text.slice(0, year.index));
    const key = title.replace(/ /g, "") + ":" + year[0];
    return remember(parsed, raw, title ? Object.freeze({ title, words: Object.freeze(title.split(" ")), year: year[0], key }) : null);
  }
  const identity = value => parse(value)?.key || "";
  function extendedMatch(query, candidate) {
    if (query.year !== candidate.year) return false;
    if (query.key === candidate.key) return true;
    const name = query.title.replace(/ /g, "");
    // Consume whole words in title order, permitting inserted labels and joined
    // spaces. Never substitute Alien/Aliens or skip a sequel/chapter number.
    const memo = new Map();
    function match(at, offset) {
      if (at === candidate.words.length) return offset === name.length;
      const key = at + ":" + offset;
      if (memo.has(key)) return memo.get(key);
      const word = candidate.words[at];
      const extra = !/^\d+$|^[ivxlcdm]+$|^(?:part|chapter|episode|vol|volume)$/.test(word)
        && (name.length >= 4 || /^(?:extended|edition|director|directors|s|cut|uncut|theatrical|remastered|remaster|restored|unrated|version|special|anniversary|hd|uhd|bluray|blu|ray|1080p|720p|2160p|4k)$/.test(word));
      const found = (name.startsWith(word, offset) && match(at + 1, offset + word.length)) || (extra && match(at + 1, offset));
      memo.set(key, found); return found;
    }
    return match(0, 0);
  }
  function createIndex(pool) {
    if (indexes.has(pool)) return indexes.get(pool);
    const exact = new Map(), years = new Map(), matches = new Map();
    const seen = new Set();
    for (const movie of pool) {
      const info = parse(movie.title);
      if (!info) continue;
      const unique = movie.mediaKey || movie.key || movie.title;
      if (seen.has(unique)) continue;
      seen.add(unique);
      const item = { movie, info };
      if (!exact.has(info.key)) exact.set(info.key, []);
      exact.get(info.key).push(item);
      if (!years.has(info.year)) years.set(info.year, []);
      years.get(info.year).push(item);
    }
    function candidates(title) {
      const query = parse(title);
      if (!query) return [];
      if (!matches.has(query.key)) {
        const items = exact.get(query.key) || (years.get(query.year) || []).filter(item => extendedMatch(query, item.info));
        remember(matches, query.key, items.map(item => item.movie));
      }
      return matches.get(query.key);
    }
    const index = { candidates, find(title) { const found = candidates(title); return found.length === 1 ? found[0] : null; } };
    indexes.set(pool, index); return index;
  }
  return { fold, compact, parse, identity, createIndex };
});
