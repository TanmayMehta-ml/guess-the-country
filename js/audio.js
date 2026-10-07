// Synthesised sound effects + mellow generative background music (Web Audio, no asset files).
const Sound = (() => {
  let ctx, master, sfxBus, musicBus, delay, timer, nextBar = 0, chordIdx = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const state = () => Store.settings();

  // Slow, gentle progression (all notes stay inside C major pentatonic-friendly territory).
  const CHORDS = [
    [48, 55, 59, 64], // Cmaj7
    [45, 55, 60, 64], // Am7
    [41, 57, 60, 64], // Fmaj7
    [43, 55, 59, 62], // G
  ];
  const MELODY = [72, 74, 76, 79, 81, 84]; // C D E G A C
  const BAR = 8; // seconds per chord

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // soft echo to give the music some air
    delay = ctx.createDelay(1); delay.delayTime.value = 0.55;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicBus);
    return true;
  }

  function tone(freq, t, dur, { type = 'sine', gain = 0.2, attack = 0.005, bus = sfxBus, send = 0, filter = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    o.connect(g);
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; g.connect(f); out = f; }
    out.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(delay); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---------- sound effects ---------- */
  const sfx = {
    click() { const t = ctx.currentTime; tone(660, t, 0.09, { type: 'triangle', gain: 0.25 }); tone(990, t + 0.015, 0.07, { gain: 0.08 }); },
    pick() { const t = ctx.currentTime; tone(520, t, 0.1, { type: 'triangle', gain: 0.22 }); },
    good() { const t = ctx.currentTime; [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.09, 0.45, { type: 'triangle', gain: 0.22 })); },
    ok() { const t = ctx.currentTime; [440, 554.37].forEach((f, i) => tone(f, t + i * 0.1, 0.4, { type: 'triangle', gain: 0.2 })); },
    bad() { const t = ctx.currentTime; [330, 262].forEach((f, i) => tone(f, t + i * 0.14, 0.45, { type: 'sine', gain: 0.25 })); },
    finish() { const t = ctx.currentTime; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.13, 0.7, { type: 'triangle', gain: 0.22 })); },
  };

  /* ---------- music ---------- */
  function scheduleBar(t) {
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    chord.forEach((n, i) => tone(midi(n), t + i * 0.12, BAR + 2.5, { type: i === 0 ? 'sine' : 'triangle', gain: i === 0 ? 0.16 : 0.07, attack: 2.2, bus: musicBus, filter: 900, send: 0.15 }));
    // a few sparse, soft bell-like notes
    const count = 3 + Math.floor(Math.random() * 3);
    let when = t + 0.8;
    for (let i = 0; i < count; i++) {
      when += 0.9 + Math.random() * 1.6;
      const n = MELODY[Math.floor(Math.random() * MELODY.length)];
      tone(midi(n), when, 3, { gain: 0.07, attack: 0.04, bus: musicBus, send: 0.6, filter: 2400 });
    }
  }

  function tick() {
    if (!ctx) return;
    while (nextBar < ctx.currentTime + 3) { scheduleBar(Math.max(nextBar, ctx.currentTime + 0.05)); nextBar = Math.max(nextBar, ctx.currentTime) + BAR; }
  }

  function startMusic() {
    if (!ensure() || timer) return;
    nextBar = ctx.currentTime + 0.1;
    tick();
    timer = setInterval(tick, 1000);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3);
  }
  function stopMusic() {
    if (timer) { clearInterval(timer); timer = null; }
    if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  }

  function play(name) {
    if (!state().sound || !ensure()) return;
    sfx[name]();
  }

  // Browsers need a user gesture before audio can start, so music begins on the first interaction.
  function sync() {
    if (state().music) startMusic(); else stopMusic();
  }
  document.addEventListener('pointerdown', () => { if (state().music && !timer) sync(); }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (ctx) (document.hidden ? ctx.suspend() : ctx.resume()); });

  // Click sounds for every interactive element.
  const SELECTORS = '.btn, button, .flag-opt, .choice, .ac-list li, .tile.target, .icon-btn, .brand';
  document.addEventListener('pointerdown', e => {
    const hit = e.target.closest && e.target.closest(SELECTORS);
    if (!hit) return;
    play(hit.matches('.flag-opt, .choice, .tile.target') ? 'pick' : 'click');
  }, { capture: true });

  return { play, sync };
})();
