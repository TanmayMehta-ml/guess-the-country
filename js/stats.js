// Aggregations over saved games. A game = {id, ts, player, length, score, max, questions:[{code, region, clue, parts:{cat:bool}}]}
const Stats = (() => {
  const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

  function players(games) { return [...new Set(games.map(g => g.player))].sort(); }

  function compute(games) {
    const cat = {}, region = {}, country = {};
    let right = 0, total = 0;
    for (const g of games) {
      for (const q of g.questions) {
        const r = (region[q.region] = region[q.region] || { right: 0, total: 0 });
        const c = (country[q.code] = country[q.code] || { right: 0, total: 0 });
        for (const [part, ok] of Object.entries(q.parts)) {
          const a = (cat[part] = cat[part] || { right: 0, total: 0 });
          a.total++; r.total++; c.total++; total++;
          if (ok) { a.right++; r.right++; c.right++; right++; }
        }
      }
    }
    const rate = o => Object.entries(o).map(([k, v]) => ({ key: k, pct: pct(v.right, v.total), total: v.total }));
    const countries = rate(country).filter(c => c.total >= 3 && byCode[c.key]).map(c => ({ ...c, name: byCode[c.key].name }));
    const catRates = rate(cat).sort((a, b) => b.pct - a.pct);
    return {
      games: games.length,
      accuracy: pct(right, total),
      bestScore: games.reduce((m, g) => Math.max(m, g.score), 0),
      cats: catRates,
      regions: rate(region).sort((a, b) => b.pct - a.pct),
      easiest: countries.slice().sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, 5),
      hardest: countries.slice().sort((a, b) => a.pct - b.pct || b.total - a.total).slice(0, 5),
      trend: games.slice().sort((a, b) => a.ts - b.ts).slice(-30).map(g => pct(g.score, g.max)),
    };
  }

  function leaderboard(games, length) {
    return games.filter(g => g.length === length)
      .sort((a, b) => b.score / b.max - a.score / a.max || b.ts - a.ts)
      .slice(0, 10);
  }

  return { compute, leaderboard, players, pct };
})();
