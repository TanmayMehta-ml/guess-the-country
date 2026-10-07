// localStorage wrapper: games history + settings, with JSON export/import.
const Store = (() => {
  const GAMES = 'gtc_games_v1';
  const SETTINGS = 'gtc_settings_v1';
  const FACTS_SEEN = 'gtc_facts_seen_v1';
  const DAILY = 'gtc_daily_v1';
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const defaults = { clues: ['name', 'flag'], length: 10, v: 2, lastPlayer: '', sound: true, music: true };

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  const write = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ }
  };

  return {
    games: () => read(GAMES, []),
    addGame(game) { const g = this.games(); g.push(game); write(GAMES, g); },
    settings() {
      const saved = read(SETTINGS, {});
      if (saved.v !== 2) { delete saved.clues; saved.v = 2; write(SETTINGS, saved); } // one-time reset to the new default clues
      return Object.assign({}, defaults, saved);
    },
    saveSettings(s) { write(SETTINGS, Object.assign(this.settings(), s)); },
    dayKey,
    msUntilMidnight() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n; },
    // Daily challenge: {last, streak, best, results:[{date, score, max, code}]}
    daily: () => read(DAILY, { last: '', streak: 0, best: 0, results: [] }),
    dailyStatus() {
      const d = this.daily();
      const alive = d.last === dayKey() || d.last === yesterdayKey(); // streak is lost once a whole day is missed
      return { playedToday: d.last === dayKey(), streak: alive ? d.streak : 0, best: d.best, played: d.results.length, results: d.results };
    },
    recordDaily(score, max, code) {
      const d = this.daily();
      if (d.last === dayKey()) return d;
      d.streak = d.last === yesterdayKey() ? d.streak + 1 : 1;
      d.best = Math.max(d.best, d.streak);
      d.last = dayKey();
      d.results = d.results.concat({ date: d.last, score, max, code }).slice(-365);
      write(DAILY, d);
      return d;
    },
    // Fun facts already shown per country: { code: [indexes] }
    factsSeen: () => read(FACTS_SEEN, {}),
    markFactSeen(code, idx) {
      const all = this.factsSeen();
      all[code] = (all[code] || []).concat(idx);
      write(FACTS_SEEN, all);
    },
    resetFacts(code) { const all = this.factsSeen(); delete all[code]; write(FACTS_SEEN, all); },
    exportJSON: () => JSON.stringify({ games: read(GAMES, []), settings: read(SETTINGS, {}), daily: read(DAILY, null) }, null, 1),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.games)) throw new Error('No games array found');
      write(GAMES, data.games);
      if (data.settings) write(SETTINGS, data.settings);
      if (data.daily) write(DAILY, data.daily);
    },
    clear() { try { localStorage.removeItem(GAMES); localStorage.removeItem(DAILY); } catch (e) { /* ignore */ } },
  };
})();
