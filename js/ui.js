// Views, rendering and interaction.
(() => {
  const app = document.getElementById('app');
  const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
  const flagUrl = c => `flags/${c.code}.svg`;
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const CAT_LABEL = Game.CAT_LABEL;

  let play = null; // in-progress game

  function mount(node) { app.replaceChildren(node); window.scrollTo(0, 0); }

  // In-game replacement for confirm()/alert(). Resolves true for the main button, false otherwise.
  function dialog({ title, text, yes = 'OK', no = null, danger = false }) {
    return new Promise(resolve => {
      const back = el(`<div class="modal-back dialog-back"><div class="modal dialog" role="alertdialog" aria-label="${esc(title)}">
        <h2 style="margin-top:0;font-size:24px">${esc(title)}</h2>
        <p class="dialog-text">${esc(text)}</p>
        <div class="center" style="margin-top:8px">
          ${no ? `<button class="btn" id="d-no">${esc(no)}</button>` : ''}
          <button class="btn ${danger ? 'danger' : 'solid'}" id="d-yes">${esc(yes)}</button>
        </div>
      </div></div>`);
      const done = v => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', onKey, true);
      back.querySelector('#d-yes').onclick = () => done(true);
      const n = back.querySelector('#d-no'); if (n) n.onclick = () => done(false);
      document.body.appendChild(back);
      back.querySelector('#d-yes').focus();
    });
  }
  const leaveDialog = () => dialog({ title: 'Leave this game?', text: 'Your progress in this game will be lost.', yes: 'Leave game', no: 'Keep playing', danger: true });

  /* ---------- autocomplete ---------- */
  function autocomplete(input, getOptions, showAll) {
    const list = document.createElement('ul');
    list.className = 'ac-list';
    input.parentNode.appendChild(list);
    let hl = -1;
    const items = () => [...list.children];
    const hide = () => { list.style.display = 'none'; hl = -1; };
    const choose = v => { input.value = v; hide(); input.dispatchEvent(new Event('change')); };
    function render() {
      const q = Game.norm(input.value);
      const opts = getOptions().filter(o => !q || Game.norm(o).includes(q)).slice(0, showAll ? 300 : 8);
      list.replaceChildren(...opts.map(o => { const li = document.createElement('li'); li.textContent = o; return li; }));
      list.style.display = opts.length ? 'block' : 'none';
      hl = -1;
    }
    const mark = () => items().forEach((li, i) => { li.classList.toggle('hl', i === hl); if (i === hl) li.scrollIntoView({ block: 'nearest' }); });
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => setTimeout(hide, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { hl = Math.min(items().length - 1, hl + 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter' && hl >= 0) { choose(items()[hl].textContent); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    });
    list.addEventListener('pointerdown', e => { e.preventDefault(); if (e.target.tagName === 'LI') choose(e.target.textContent); });
  }

  /* ---------- menu ---------- */
  function menu() {
    const s = Store.settings();
    const node = el(`<section class="panel">
      <h1>Guess the Country</h1>
      <p class="sub">Name, capital, flag, then rank it by population, GDP per capita and land area.</p>
      <div class="daily-card">
        <div class="daily-top"><span class="daily-title">Daily challenge</span><span class="streak" id="dstreak"></span></div>
        <div class="center" style="margin:10px 0 0"><button class="btn solid" id="daily"></button></div>
        <div class="daily-note" id="dnote"></div>
      </div>
      <h2>Classic game: how many questions?</h2>
      <div class="len-picker">${[10, 20, 30].map(n => `<button data-n="${n}" class="${n === s.length ? 'on' : ''}">${n}<small>questions</small></button>`).join('')}</div>
      <div class="center"><button class="btn solid" id="start">Start game</button></div>
      <div class="center">
        <button class="btn" data-go="leaderboard">Leaderboard</button>
        <button class="btn" data-go="stats">Stats</button>
        <button class="btn" data-go="settings">Settings</button>
      </div>
    </section>`);
    node.querySelectorAll('.len-picker button').forEach(b => b.onclick = () => {
      node.querySelectorAll('.len-picker button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      Store.saveSettings({ length: +b.dataset.n });
    });
    node.querySelector('#start').onclick = () => startGame(Store.settings().length);
    node.querySelectorAll('[data-go]').forEach(b => b.onclick = () => views[b.dataset.go]());
    const dBtn = node.querySelector('#daily'), dNote = node.querySelector('#dnote'), dStreak = node.querySelector('#dstreak');
    const clock = ms => [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60].map(n => String(n).padStart(2, '0')).join(':');
    let tickTimer = null;
    function drawDaily() {
      if (!node.isConnected) { clearInterval(tickTimer); return; }
      const st = Store.dailyStatus();
      dStreak.textContent = st.streak ? `🔥 ${st.streak} day streak` : 'No streak yet';
      if (st.playedToday) {
        const ms = Store.msUntilMidnight();
        dBtn.disabled = true; dBtn.textContent = 'Done for today';
        dNote.textContent = `Next daily in ${clock(ms)}`;
        if (ms < 1100) setTimeout(menu, 1200);
      } else {
        dBtn.disabled = false; dBtn.textContent = st.streak ? "Play today's country" : 'Play daily challenge';
        dNote.textContent = st.streak ? 'Play before midnight to keep your streak alive' : 'One country a day, a new one at midnight';
      }
    }
    dBtn.onclick = startDaily;
    mount(node);
    drawDaily();
    tickTimer = setInterval(drawDaily, 1000);
  }

  /* ---------- fun facts ---------- */
  const FACT_LABEL = { h: 'History', g: 'Geography', c: 'Culture', m: 'Modern times', i: 'India connection', x: 'Did you know?' };

  // All five facts for the country, browsed with the arrow buttons.
  function showFact(stage, country) {
    const list = (typeof FACTS !== 'undefined' && FACTS[country.code]) || [];
    if (!list.length) return;
    let i = 0;
    const aside = el(`<aside class="fact-panel">
      <div class="fact-head"><img src="${flagUrl(country)}" alt=""><div><div class="fact-kicker">Fun facts</div><div class="fact-country">${esc(country.name)}</div></div></div>
      <div class="fact-tag"></div>
      <p class="fact-text"></p>
      <div class="fact-nav">
        <button class="fact-arrow" id="fprev" aria-label="Previous fact">&#8249;</button>
        <div class="fact-dots"></div>
        <button class="fact-arrow" id="fnext" aria-label="Next fact">&#8250;</button>
      </div>
    </aside>`);
    const tag = aside.querySelector('.fact-tag'), text = aside.querySelector('.fact-text'), dots = aside.querySelector('.fact-dots');
    dots.replaceChildren(...list.map((_, k) => { const d = document.createElement('i'); d.onclick = () => { i = k; draw(); }; return d; }));
    function draw() {
      tag.textContent = FACT_LABEL[list[i][0]];
      tag.className = 'fact-tag fact-' + list[i][0];
      text.textContent = list[i][1];
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    }
    aside.querySelector('#fprev').onclick = () => { i = (i + list.length - 1) % list.length; draw(); };
    aside.querySelector('#fnext').onclick = () => { i = (i + 1) % list.length; draw(); };
    draw();
    stage.appendChild(aside);
    stage.classList.add('has-fact');
    if (window.innerWidth < 1100) aside.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- game ---------- */
  function startGame(length) {
    play = { length, deck: Game.newDeck(), n: 0, score: 0, max: 0, questions: [] };
    nextQuestion();
  }

  function startDaily() {
    if (Store.dailyStatus().playedToday) return;
    const round = Game.dailyRound(Store.dayKey());
    play = { length: 1, daily: true, deck: [round.target], n: 1, score: 0, max: 0, questions: [], round };
    renderRound();
  }

  function nextQuestion() {
    const settings = Store.settings();
    const clues = settings.clues.length ? settings.clues : ['name'];
    play.round = Game.newRound(play.deck[play.n], clues);
    play.n++;
    renderRound();
  }

  function clueBlock(r) {
    const t = r.target;
    if (r.clue === 'name') return `<div class="label">The country is</div><div class="big">${esc(t.name)}</div>`;
    if (r.clue === 'capital') return `<div class="label">The capital is</div><div class="big">${esc(t.capital)}</div>`;
    return `<div class="label">Whose flag is this?</div><img class="flag-big plain" src="${flagUrl(t)}" alt="Flag">`;
  }

  // What the draggable tile shows: the clue itself, so it never leaks the answer.
  function targetTileHtml(r) {
    if (r.clue === 'flag') return `<img src="${flagUrl(r.target)}" alt="?"><div class="t-val"></div>`;
    return `<div class="t-name">${esc(r.clue === 'name' ? r.target.name : r.target.capital)}</div><div class="t-val"></div>`;
  }

  function renderRound() {
    const r = play.round, t = r.target;
    const stage = el('<div class="stage"></div>');
    const node = el(`<section class="panel">
      <div class="progress"><span>Question <b>${play.n}</b> / ${play.length}</span><span>Score <b id="score">${play.score}</b></span></div>
      <div class="bar"><i style="width:${((play.n - 1) / play.length) * 100}%"></i></div>
      <div class="clue">${clueBlock(r)}</div>
      <hr class="divider">
      <div id="parts"></div>
      <h2 style="font-size:26px">Sort the state</h2>
      <p class="hint">Drag the highlighted tile (or use ← →) to where it belongs, least to greatest.</p>
      <div id="ranks"></div>
      <div class="center" id="actions"><button class="btn solid" id="submit">Check answers</button></div>
    </section>`);
    const parts = node.querySelector('#parts');
    const checks = {}; // part -> () => boolean

    if (r.asked.includes('name') || r.asked.includes('capital')) {
      const card = el('<div class="card"></div>');
      for (const part of ['name', 'capital']) {
        if (!r.asked.includes(part)) continue;
        const f = el(`<div class="field"><label>${part === 'name' ? 'Name' : 'Capital'}:</label><input autocomplete="off" spellcheck="false" placeholder="${part === 'name' ? 'Type a country…' : 'Pick a capital…'}"><div class="fb"></div></div>`);
        const input = f.querySelector('input');
        card.appendChild(f);
        autocomplete(input, part === 'name' ? Game.names : Game.capitals, part === 'capital');
        checks[part] = () => {
          const ok = Game.checkText(r, part, input.value);
          input.classList.add(ok ? 'ok' : 'bad');
          input.readOnly = true;
          const fb = f.querySelector('.fb');
          fb.className = 'fb ' + (ok ? 'ok' : 'bad');
          fb.textContent = ok ? 'Correct!' : `Not quite, it's ${part === 'name' ? t.name : t.capital}`;
          return ok;
        };
      }
      parts.appendChild(card);
    }

    if (r.asked.includes('flag')) {
      const card = el(`<div class="card"><h3>Guess the flag!</h3><div class="flag-grid"></div><div class="fb" style="margin-top:8px"></div></div>`);
      const grid = card.querySelector('.flag-grid');
      let picked = null;
      r.flags.forEach(c => {
        const o = el(`<div class="flag-opt" role="button" tabindex="0" data-code="${c.code}"><img src="${flagUrl(c)}" alt=""></div>`);
        const pick = () => {
          if (grid.classList.contains('locked')) return;
          picked = c.code;
          grid.querySelectorAll('.flag-opt').forEach(x => x.classList.toggle('sel', x === o));
        };
        o.onclick = pick;
        o.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { pick(); e.preventDefault(); } };
        grid.appendChild(o);
      });
      checks.flag = () => {
        const ok = picked === t.code;
        grid.classList.add('locked');
        grid.querySelectorAll('.flag-opt').forEach(x => {
          x.classList.remove('sel');
          x.dataset.name = byCode[x.dataset.code].name; // shown on hover once answers are checked
          x.title = x.dataset.name;
          if (x.dataset.code === t.code) x.classList.add('ok');
          else if (x.dataset.code === picked) x.classList.add('bad');
        });
        const fb = card.querySelector('.fb');
        fb.className = 'fb ' + (ok ? 'ok' : 'bad');
        fb.textContent = ok ? 'Correct!' : `Not quite, it's ${t.name}`;
        return ok;
      };
      parts.appendChild(card);
    }

    if (r.asked.includes('continent')) {
      const card = el(`<div class="card"><h3>Which continent?</h3><div class="choice-grid"></div><div class="fb" style="margin-top:8px"></div></div>`);
      const grid = card.querySelector('.choice-grid');
      let picked = null;
      Game.CONTINENTS.forEach(name => {
        const b = el(`<button class="choice" type="button">${name}</button>`);
        b.onclick = () => { picked = name; grid.querySelectorAll('.choice').forEach(x => x.classList.toggle('sel', x === b)); };
        grid.appendChild(b);
      });
      checks.continent = () => {
        const ok = t.continents.includes(picked);
        grid.querySelectorAll('.choice').forEach(x => {
          x.disabled = true; x.classList.remove('sel');
          if (t.continents.includes(x.textContent)) x.classList.add('ok');
          else if (x.textContent === picked) x.classList.add('bad');
        });
        const fb = card.querySelector('.fb');
        fb.className = 'fb ' + (ok ? 'ok' : 'bad');
        fb.textContent = ok ? (t.continents.length > 1 ? `Correct! (${t.continents.join(' / ')})` : 'Correct!') : `Not quite, it's ${t.continents.join(' / ')}`;
        return ok;
      };
      parts.appendChild(card);
    }

    const ranks = node.querySelector('#ranks');
    for (const key of ['population', 'gdp', 'area']) {
      const spec = Game.RANKS[key], rk = r.ranks[key];
      const card = el(`<div class="card rank-card"><h3>${spec.label}</h3><div class="rank-row"></div><div class="ends"><span class="e-l">Least</span><span class="e-g">Greatest</span></div></div>`);
      const row = card.querySelector('.rank-row');
      const fixed = rk.others.map((c, i) => {
        const tile = el(`<div class="tile"><div class="t-name">${esc(c.name)}</div><div class="t-val">${spec.fmt(c[key])}</div></div>`);
        tile.style.order = i * 2;
        row.appendChild(tile);
        return tile;
      });
      const tile = el(`<div class="tile target" tabindex="0">${targetTileHtml(r)}</div>`);
      row.appendChild(tile);
      let idx = rk.start, locked = false;
      const place = i => { idx = Math.max(0, Math.min(4, i)); tile.style.order = idx * 2 - 1; };
      place(idx);
      let dragging = false;
      tile.addEventListener('pointerdown', e => { if (locked) return; dragging = true; tile.classList.add('dragging'); tile.setPointerCapture(e.pointerId); e.preventDefault(); });
      tile.addEventListener('pointermove', e => {
        if (!dragging) return;
        const vertical = getComputedStyle(row).flexDirection === 'column'; // phones list the tiles top to bottom
        place(fixed.filter(f => { const b = f.getBoundingClientRect(); return vertical ? e.clientY > b.top + b.height / 2 : e.clientX > b.left + b.width / 2; }).length);
      });
      const stop = () => { dragging = false; tile.classList.remove('dragging'); };
      tile.addEventListener('pointerup', stop);
      tile.addEventListener('pointercancel', stop);
      tile.addEventListener('keydown', e => {
        if (locked) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { place(idx - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { place(idx + 1); e.preventDefault(); }
      });
      checks[key] = () => {
        locked = true;
        tile.classList.add('locked');
        const ok = idx === rk.correct;
        tile.classList.add(ok ? 'ok' : 'bad');
        tile.querySelector('.t-val').textContent = spec.fmt(t[key]);
        if (!ok) {
          const reveal = el('<div class="rank-row reveal"></div>');
          const ordered = [...rk.others];
          ordered.splice(rk.correct, 0, t);
          ordered.forEach(c => {
            const isT = c === t;
            const inner = isT && r.clue === 'flag' ? `<img src="${flagUrl(t)}" alt=""><div class="t-val">${spec.fmt(c[key])}</div>`
              : `<div class="t-name">${esc(c.name)}</div><div class="t-val">${spec.fmt(c[key])}</div>`;
            reveal.appendChild(el(`<div class="tile${isT ? ' answer' : ''}">${inner}</div>`));
          });
          row.after(reveal);
        }
        return ok;
      };
      ranks.appendChild(card);
    }

    node.querySelector('#submit').onclick = () => {
      const result = {};
      let pts = 0;
      for (const part of r.asked) { result[part] = !!checks[part](); if (result[part]) pts++; }
      play.score += pts;
      play.max += r.asked.length;
      Sound.play(pts === r.asked.length ? 'good' : pts >= r.asked.length / 2 ? 'ok' : 'bad');
      play.questions.push({ code: t.code, region: t.region, clue: r.clue, parts: result });
      node.querySelector('#score').textContent = play.score;
      showFact(stage, t);
      const last = play.n >= play.length;
      const actions = node.querySelector('#actions');
      actions.replaceChildren(el(`<div style="width:100%;text-align:center"><div class="sub" style="margin:0">This question: <b style="color:var(--yellow)">${pts} / ${r.asked.length}</b>. It was <b>${esc(t.name)}</b> (${esc(t.capital)})</div></div>`),
        el(`<button class="btn solid" id="next">${last ? 'Finish game' : 'Next question'}</button>`));
      actions.querySelector('#next').onclick = last ? (play.daily ? dailyResults : results) : nextQuestion;
      actions.querySelector('#next').focus({ preventScroll: true });
    };
    stage.appendChild(node);
    mount(stage);
  }

  /* ---------- daily results ---------- */
  function dailyResults() {
    Sound.play('finish');
    const rec = Store.recordDaily(play.score, play.max, play.round.target.code);
    const node = el(`<section class="panel">
      <h1>Daily complete</h1>
      <div class="big-score">${play.score} / ${play.max}</div>
      <p class="sub">🔥 ${rec.streak} day streak (best ${rec.best})</p>
      <p class="sub muted" id="nextin"></p>
      <div class="center"><button class="btn solid" id="board">Daily scoreboard</button><button class="btn" id="home">Menu</button></div>
    </section>`);
    const nextin = node.querySelector('#nextin');
    const tick = () => {
      if (!node.isConnected) return clearInterval(t);
      const ms = Store.msUntilMidnight();
      nextin.textContent = 'Next daily in ' + [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60].map(n => String(n).padStart(2, '0')).join(':');
    };
    const t = setInterval(tick, 1000); tick();
    node.querySelector('#board').onclick = () => { play = null; leaderboard('daily'); };
    node.querySelector('#home').onclick = () => { play = null; menu(); };
    mount(node);
  }

  /* ---------- results ---------- */
  function results() {
    Sound.play('finish');
    const max = play.max;
    const pct = Stats.pct(play.score, max);
    const node = el(`<section class="panel">
      <h1>Game over</h1>
      <div class="big-score">${play.score} / ${max}</div>
      <p class="sub">${pct}% correct over ${play.length} questions</p>
      <p class="sub">Enter your initials for the leaderboard</p>
      <input class="initials" id="ini" maxlength="3" value="${esc(Store.settings().lastPlayer)}" placeholder="AAA" autocomplete="off">
      <div class="center">
        <button class="btn solid" id="save">Save score</button>
        <button class="btn" id="skip">Don't save</button>
      </div>
    </section>`);
    const ini = node.querySelector('#ini');
    ini.oninput = () => { ini.value = ini.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    node.querySelector('#save').onclick = () => {
      const player = (ini.value || '').toUpperCase().padEnd(3, '_').slice(0, 3);
      if (ini.value.length === 0) { ini.focus(); return; }
      Store.addGame({ id: Date.now(), ts: Date.now(), player, length: play.length, score: play.score, max, questions: play.questions });
      Store.saveSettings({ lastPlayer: ini.value });
      leaderboard(play.length);
      play = null;
    };
    node.querySelector('#skip').onclick = () => { play = null; menu(); };
    mount(node);
    ini.focus();
  }

  /* ---------- leaderboard ---------- */
  function dailyBoard() {
    const st = Store.dailyStatus();
    const node = el(`<section class="panel">
      <h1>Leaderboard</h1>
      <div class="tabs">${[10, 20, 30].map(n => `<button data-n="${n}">${n} questions</button>`).join('')}<button data-n="daily" class="on">Daily</button></div>
      <div class="stat-tiles">
        <div class="stat-tile">Current streak<b>${st.streak}</b></div>
        <div class="stat-tile">Best streak<b>${st.best}</b></div>
        <div class="stat-tile">Days played<b>${st.played}</b></div>
      </div>
      ${st.results.length ? `<table><thead><tr><th>Date</th><th>Country</th><th class="num">Score</th></tr></thead><tbody>
        ${st.results.slice().reverse().slice(0, 30).map(r => `<tr><td>${esc(r.date)}</td><td>${esc((byCode[r.code] || {}).name || '')}</td><td class="num">${r.score}/${r.max}</td></tr>`).join('')}
      </tbody></table>` : '<p class="sub">No daily challenges played yet.</p>'}
      <div class="center"><button class="btn" id="home">Menu</button></div>
    </section>`);
    node.querySelectorAll('.tabs button').forEach(b => b.onclick = () => leaderboard(b.dataset.n === 'daily' ? 'daily' : +b.dataset.n));
    node.querySelector('#home').onclick = menu;
    mount(node);
  }

  function leaderboard(length) {
    if (length === 'daily') return dailyBoard();
    const len = [10, 20, 30].includes(length) ? length : Store.settings().length;
    const games = Store.games();
    const top = Stats.leaderboard(games, len);
    const newest = games.length ? Math.max(...games.map(g => g.id)) : 0;
    const node = el(`<section class="panel">
      <h1>Leaderboard</h1>
      <div class="tabs">${[10, 20, 30].map(n => `<button data-n="${n}" class="${n === len ? 'on' : ''}">${n} questions</button>`).join('')}<button data-n="daily">Daily</button></div>
      ${top.length ? `<table><thead><tr><th>#</th><th>Player</th><th class="num">Score</th><th class="num">%</th><th>Date</th></tr></thead><tbody>
        ${top.map((g, i) => `<tr class="${g.id === newest ? 'me' : ''}"><td>${i + 1}</td><td>${esc(g.player)}</td><td class="num">${g.score}/${g.max}</td><td class="num">${Stats.pct(g.score, g.max)}</td><td>${new Date(g.ts).toLocaleDateString()}</td></tr>`).join('')}
      </tbody></table>` : '<p class="sub">No games yet for this length.</p>'}
      <div class="center"><button class="btn solid" id="again">Play again</button><button class="btn" id="home">Menu</button></div>
    </section>`);
    node.querySelectorAll('.tabs button').forEach(b => b.onclick = () => leaderboard(b.dataset.n === 'daily' ? 'daily' : +b.dataset.n));
    node.querySelector('#again').onclick = () => startGame(Store.settings().length);
    node.querySelector('#home').onclick = menu;
    mount(node);
  }

  /* ---------- stats ---------- */
  function trendSvg(values) {
    if (values.length < 2) return '<p class="sub muted">Play at least two games to see a trend.</p>';
    const W = 600, H = 200, p = 24;
    const x = i => p + (i * (W - 2 * p)) / (values.length - 1);
    const y = v => H - p - (v / 100) * (H - 2 * p);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${[0, 50, 100].map(v => `<line x1="${p}" x2="${W - p}" y1="${y(v)}" y2="${y(v)}" stroke="#4a5262" stroke-dasharray="4 4"/><text x="2" y="${y(v) + 4}" fill="#fdf3c8" font-size="12">${v}%</text>`).join('')}
      <polyline fill="none" stroke="#f6d982" stroke-width="3" points="${pts}"/>
      ${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#6fc77d"/>`).join('')}
    </svg>`;
  }
  const bars = (rows, label, best) => rows.map((r, i) => `<div class="hbar ${best && i === 0 ? 'best' : ''}"><span>${label(r)}</span><div class="track"><i style="width:${r.pct}%"></i></div><span>${r.pct}%</span></div>`).join('') || '<p class="muted">No data yet.</p>';

  function stats(player = '') {
    const all = Store.games();
    const games = player ? all.filter(g => g.player === player) : all;
    const s = Stats.compute(games);
    const players = Stats.players(all);
    const node = el(`<section class="panel">
      <h1>Stats</h1>
      <div class="center" style="margin:0 0 16px"><select id="who"><option value="">All players</option>${players.map(p => `<option ${p === player ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
      ${games.length ? `
      <div class="stat-tiles">
        <div class="stat-tile">Games<b>${s.games}</b></div>
        <div class="stat-tile">Accuracy<b>${s.accuracy}%</b></div>
        <div class="stat-tile">Best score<b>${s.bestScore}</b></div>
        <div class="stat-tile">Best category<b style="font-size:22px">${s.cats.length ? CAT_LABEL[s.cats[0].key] : '-'}</b></div>
      </div>
      <div class="card"><h3>Accuracy by question type</h3>${bars(s.cats, r => CAT_LABEL[r.key], true)}</div>
      <div class="card"><h3>Accuracy by region</h3>${bars(s.regions, r => r.key, true)}</div>
      <div class="two-col">
        <div class="card"><h3>Easiest countries</h3>${bars(s.easiest, r => esc(r.name))}</div>
        <div class="card"><h3>Hardest countries</h3>${bars(s.hardest, r => esc(r.name))}</div>
      </div>
      <div class="card"><h3>Score trend (last ${s.trend.length})</h3>${trendSvg(s.trend)}</div>
      <div class="card"><h3>History</h3><table><thead><tr><th>Date</th><th>Player</th><th class="num">Qs</th><th class="num">Score</th><th class="num">%</th></tr></thead><tbody>
        ${games.slice().sort((a, b) => b.ts - a.ts).slice(0, 15).map(g => `<tr><td>${new Date(g.ts).toLocaleString()}</td><td>${esc(g.player)}</td><td class="num">${g.length}</td><td class="num">${g.score}/${g.max}</td><td class="num">${Stats.pct(g.score, g.max)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="sub">No games played yet.</p>'}
      <div class="center"><button class="btn" id="home">Menu</button></div>
    </section>`);
    node.querySelector('#who').onchange = e => stats(e.target.value);
    node.querySelector('#home').onclick = menu;
    mount(node);
  }

  /* ---------- settings (modal, usable mid-game) ---------- */
  function settings() {
    if (document.querySelector('.modal-back')) return;
    const s = Store.settings();
    const toggle = (id, label, on) => `<label class="switch-row"><span>${label}</span><input type="checkbox" class="switch" id="${id}" ${on ? 'checked' : ''}></label>`;
    const back = el(`<div class="modal-back"><div class="modal" role="dialog" aria-label="Settings">
      <h2 style="margin-top:0">Settings</h2>
      ${toggle('t-sound', 'Sound effects', s.sound)}
      ${toggle('t-music', 'Music', s.music)}
      <hr>
      <h3 style="font-size:18px">Clues that can start a question</h3>
      ${['name', 'capital', 'flag'].map(k => `<label class="switch-row" style="font-size:22px"><span>${CAT_LABEL[k]}</span><input type="checkbox" class="switch clue" value="${k}" ${s.clues.includes(k) ? 'checked' : ''}></label>`).join('')}
      <hr>
      <div class="center" style="margin-top:0">
        <button class="btn small" id="exp">Export</button>
        <button class="btn small" id="imp">Import</button>
        <button class="btn small danger" id="clr">Clear history</button>
        <input type="file" id="file" accept="application/json" hidden>
      </div>
      <div class="center">
        ${play ? '<button class="btn danger" id="abort">Abort game</button>' : ''}
        <button class="btn solid" id="close">${play ? 'Resume' : 'Close'}</button>
      </div>
    </div></div>`);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
    back.querySelector('#t-sound').onchange = e => { Store.saveSettings({ sound: e.target.checked }); Sound.play('click'); };
    back.querySelector('#t-music').onchange = e => { Store.saveSettings({ music: e.target.checked }); Sound.sync(); };
    back.querySelectorAll('.clue').forEach(cb => cb.onchange = () => {
      const clues = [...back.querySelectorAll('.clue:checked')].map(x => x.value);
      if (!clues.length) { cb.checked = true; return; }
      Store.saveSettings({ clues });
    });
    back.querySelector('#exp').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
      a.download = 'guess-the-country-backup.json';
      a.click();
    };
    back.querySelector('#imp').onclick = () => back.querySelector('#file').click();
    back.querySelector('#file').onchange = async e => {
      try { Store.importJSON(await e.target.files[0].text()); dialog({ title: 'Imported', text: 'Your backup was loaded.' }); } catch (err) { dialog({ title: 'Import failed', text: err.message }); }
    };
    back.querySelector('#clr').onclick = async () => {
      if (await dialog({ title: 'Clear history?', text: 'This deletes all saved games, scores and daily streaks on this device.', yes: 'Delete', no: 'Cancel', danger: true })) {
        Store.clear(); dialog({ title: 'History cleared', text: 'All saved scores were removed.' });
      }
    };
    back.querySelector('#close').onclick = close;
    const abort = back.querySelector('#abort');
    if (abort) abort.onclick = async () => {
      if (await dialog({ title: 'Abort this game?', text: 'You will go back to the main menu and lose your progress in this game.', yes: 'Abort game', no: 'Keep playing', danger: true })) { play = null; close(); menu(); }
    };
    document.body.appendChild(back);
  }

  const views = { menu, leaderboard, stats, settings };

  document.getElementById('brand').onclick = async e => {
    e.preventDefault();
    if (play && !(await leaveDialog())) return;
    play = null;
    menu();
  };
  document.getElementById('gear').onclick = settings;

  menu();
})();
