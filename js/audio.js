/* =========================================================
   audio.js — WebAudio 効果音
   Everything is synthesised: no sample files, no assets.
   Roars are per-kaiju so each boss is audible before it is visible.
   ========================================================= */
'use strict';

const Audio = (() => {
  let AC = null, master = null;

  function unlock() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      AC = new Ctor();
      master = AC.createGain();
      master.gain.value = 0.85;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
  }

  function ready() { return !!AC && AC.state === 'running'; }

  /* plain oscillator with optional pitch slide */
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ready()) return;
    const t = AC.currentTime + (delay || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol || 0.06), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* filtered noise burst — impacts, splashes, steam */
  function noise(dur, vol, cutoff, delay, q, type) {
    if (!ready()) return;
    const t = AC.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(AC.sampleRate * dur));
    const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter();
    f.type = type || 'lowpass'; f.frequency.value = cutoff || 900; f.Q.value = q || 1;
    const g = AC.createGain(); g.gain.value = vol || 0.18;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  /* a two-formant growl: saw sweep + noise, the kaiju signature */
  function growl(f0, f1, dur, vol, grit) {
    if (!ready()) return;
    tone(f0, dur, 'sawtooth', vol, f1);
    tone(f0 * 1.5, dur * 0.85, 'square', vol * 0.35, f1 * 1.4);
    if (grit !== false) noise(dur * 0.8, vol * 0.5, f0 * 12, 0, 3, 'bandpass');
  }

  /* per-kaiju roar profiles, keyed by monster id */
  const ROAR = {
    godzilla:      [78, 46, 0.85, 0.11],
    anguirus:      [130, 70, 0.55, 0.09],
    ebirah:        [210, 120, 0.34, 0.07],
    rodan:         [330, 180, 0.40, 0.08],
    mothra:        [420, 260, 0.60, 0.06],
    gigan:         [160, 240, 0.42, 0.09],
    hedorah:       [95, 60, 0.95, 0.08],
    ghidorah:      [110, 150, 0.80, 0.10],
    biollante:     [140, 90, 0.75, 0.09],
    spacegodzilla: [70, 130, 1.00, 0.11],
    destoroyah:    [90, 200, 0.70, 0.12],
  };

  const SFX = {
    unlock: () => tone(660, 0.06, 'triangle', 0.04),
    move:   () => tone(520, 0.04, 'square', 0.025),
    select: () => { tone(700, 0.07, 'square', 0.05); tone(1050, 0.09, 'square', 0.04, undefined, 0.06); },
    punch:  () => { noise(0.10, 0.15, 1200); tone(240, 0.06, 'square', 0.05, 120); },
    kick:   () => { noise(0.18, 0.22, 700);  tone(150, 0.11, 'sawtooth', 0.06, 70); },
    stomp:  () => { noise(0.30, 0.26, 320);  tone(60, 0.32, 'sine', 0.10, 34); },
    hit:    () => noise(0.14, 0.20, 1500),
    bigHit: () => { noise(0.28, 0.30, 900); tone(90, 0.24, 'sawtooth', 0.07, 40); },
    block:  () => { tone(1400, 0.05, 'square', 0.04); noise(0.07, 0.10, 3000, 0, 2, 'highpass'); },
    jump:   () => tone(420, 0.13, 'triangle', 0.05, 780),
    land:   () => noise(0.16, 0.16, 420),
    charge: () => tone(180, 0.34, 'sawtooth', 0.05, 620),
    beam:   () => { tone(880, 0.42, 'sawtooth', 0.07, 200); tone(1320, 0.42, 'square', 0.03, 320); },
    redray: () => { tone(620, 0.46, 'sawtooth', 0.08, 150); tone(930, 0.46, 'square', 0.04, 240); },
    fireray:() => { noise(0.55, 0.16, 700); tone(420, 0.55, 'sawtooth', 0.09, 120); },
    pulse:  () => { noise(0.5, 0.28, 1600); tone(240, 0.5, 'sawtooth', 0.09, 900); },
    laser:  () => { tone(1500, 0.22, 'square', 0.05, 420); noise(0.12, 0.08, 4200, 0, 2, 'highpass'); },
    saw:    () => { noise(0.30, 0.13, 2600, 0, 6, 'bandpass'); tone(90, 0.30, 'sawtooth', 0.05, 140); },
    disc:   () => tone(1100, 0.16, 'triangle', 0.04, 700),
    crystal:() => { tone(1800, 0.18, 'triangle', 0.05, 900); tone(2400, 0.12, 'sine', 0.03, 1600, 0.04); },
    splash: () => noise(0.34, 0.20, 1800, 0, 1, 'lowpass'),
    acid:   () => { noise(0.4, 0.12, 900, 0, 4, 'bandpass'); tone(300, 0.3, 'sawtooth', 0.04, 90); },
    silk:   () => noise(0.24, 0.09, 2600, 0, 5, 'bandpass'),
    grab:   () => { tone(120, 0.22, 'sawtooth', 0.07, 60); noise(0.2, 0.12, 500); },
    throw:  () => tone(200, 0.3, 'sawtooth', 0.07, 700),
    boom:   () => { noise(0.6, 0.32, 420); tone(70, 0.8, 'sawtooth', 0.09, 28); },
    warn:   () => tone(1500, 0.09, 'square', 0.05),
    phase:  () => { tone(300, 0.5, 'sawtooth', 0.07, 900); noise(0.5, 0.12, 1200); },
    win:    () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, undefined, i * 0.16)),
    lose:   () => [440, 392, 330, 220].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.07, undefined, i * 0.23)),
    roarOf(id) {
      const p = ROAR[id] || ROAR.godzilla;
      growl(p[0], p[1], p[2], p[3]);
    },
  };

  return { unlock, ready, tone, noise, SFX, ROAR };
})();
