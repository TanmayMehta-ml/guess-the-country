// Round generation and answer checking (no DOM here).
const Game = (() => {
  const RANKS = {
    population: { label: 'Population', fmt: fmtPop },
    gdp: { label: 'GDP per capita (USD)', fmt: v => '$' + Math.round(v).toLocaleString('en-US') },
    area: { label: 'Land area (km²)', fmt: v => Math.round(v).toLocaleString('en-US') + ' km²' },
  };
  const CATEGORIES = ['name', 'capital', 'flag', 'continent', 'population', 'gdp', 'area'];
  const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  const CAT_LABEL = { name: 'Name', capital: 'Capital', flag: 'Flag', continent: 'Continent', population: 'Population', gdp: 'GDP per capita', area: 'Land area' };

  function fmtPop(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return String(v);
  }
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let rand = Math.random; // swapped for a seeded generator when building the daily round
  const rnd = n => Math.floor(rand() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);

  // Pick 4 other countries whose values are clearly separated in magnitude from each other and the target.
  function buildRanking(target, key) {
    const v = target[key];
    const pool = COUNTRIES.filter(c => c !== target && c[key] > 0);
    for (let ratio = 1.8; ratio >= 1.15; ratio -= 0.1) {
      const below = pool.filter(c => c[key] * ratio <= v);
      const above = pool.filter(c => c[key] >= v * ratio);
      for (let t = 0; t < 250; t++) {
        const p = rnd(5); // number of fixed countries below the target = correct slot index
        if (below.length < p || above.length < 4 - p) continue;
        const others = [...sample(below, p), ...sample(above, 4 - p)].sort((a, b) => a[key] - b[key]);
        let ok = true;
        for (let i = 0; i < 3; i++) if (others[i + 1][key] < others[i][key] * ratio) ok = false;
        if (ok) return { others, correct: p };
      }
    }
    const others = sample(pool, 4).sort((a, b) => a[key] - b[key]);
    return { others, correct: others.filter(c => c[key] < v).length };
  }

  // ~24 flags, biased to the target's own subregion/region so regional look-alikes can't be ruled out.
  function flagOptions(target, n = 24) {
    const others = COUNTRIES.filter(c => c !== target);
    const sub = shuffle(others.filter(c => c.subregion === target.subregion));
    const reg = shuffle(others.filter(c => c.region === target.region && c.subregion !== target.subregion));
    const rest = shuffle(others.filter(c => c.region !== target.region));
    return shuffle([target, ...[...sub, ...reg, ...rest].slice(0, n - 1)]);
  }

  function newDeck() { return shuffle(COUNTRIES); }

  function newRound(target, clues) {
    const clue = clues[rnd(clues.length)];
    const asked = ['name', 'capital', 'flag'].filter(x => x !== clue).concat(['continent', 'population', 'gdp', 'area']);
    const ranks = {};
    for (const k of ['population', 'gdp', 'area']) {
      const r = buildRanking(target, k);
      // start the draggable tile somewhere other than its correct slot
      let start = rnd(5);
      if (start === r.correct) start = (start + 1 + rnd(4)) % 5;
      ranks[k] = Object.assign(r, { start });
    }
    return { target, clue, asked, ranks, flags: flagOptions(target) };
  }

  function hashSeed(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Same country, clue and options for everyone on a given day key (YYYY-MM-DD).
  function dailyRound(dayKey) {
    const prev = rand;
    rand = mulberry32(hashSeed('gtc-' + dayKey));
    try {
      const target = COUNTRIES[rnd(COUNTRIES.length)];
      return newRound(target, ['name', 'flag', 'capital']);
    } finally { rand = prev; }
  }

  function checkText(round, part, value) {
    const t = round.target;
    if (part === 'capital') return norm(value) === norm(t.capital);
    const v = norm(value);
    return v !== '' && (v === norm(t.name) || t.alt.some(a => norm(a) === v));
  }

  const capitals = () => [...new Set(COUNTRIES.map(c => c.capital))].sort((a, b) => a.localeCompare(b));
  const names = () => COUNTRIES.map(c => c.name).sort((a, b) => a.localeCompare(b));

  return { RANKS, CATEGORIES, CONTINENTS, CAT_LABEL, norm, shuffle, newDeck, newRound, dailyRound, checkText, capitals, names, fmtPop };
})();
