// ============================================================
//  UÇ BEYLERİ — ses (hiç ses dosyası yok; her şey Web Audio ile üretilir)
//  Efektler: dokunma, inşaat, bitiş, eğitim, sefer borusu, kervan, zafer, yenilgi, alarm, mesaj.
//  Müzik: Hicaz makamında saz (Karplus-Strong telli çalgı), ney benzeri üfleme, dem sesi ve def.
// ============================================================
const Sfx = (() => {
'use strict';
const K = { fx: 'ub-sfx', mu: 'ub-music' };
const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
let fxOn = get(K.fx, true), muOn = get(K.mu, true);
let ac = null, master = null, fxBus = null, muBus = null, verb = null;

function init() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ac = new AC();
  master = ac.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 4; master.connect(ac.destination);
  fxBus = ac.createGain(); fxBus.gain.value = .55; fxBus.connect(master);
  muBus = ac.createGain(); muBus.gain.value = 0; muBus.connect(master);
  // küçük oda yankısı
  const len = ac.sampleRate * 1.6, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb = ac.createConvolver(); verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = .22; verb.connect(vg); vg.connect(master);
  return ac;
}
// ilk dokunuşta sesi aç (tarayıcı kuralı)
function unlock() { if (!init()) return; if (ac.state === 'suspended') ac.resume(); if (muOn) startMusic(); }
['pointerdown', 'keydown'].forEach(e => addEventListener(e, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

// ---------- yapı taşları ----------
function env(g, t, a, peak, dec, sus = 0) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(.0001, sus || .0001), t + a + dec); }
function tone(freq, t, dur, { type = 'sine', vol = .3, a = .005, bus = fxBus, glide = 0, wet = .3 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  env(g, t, a, vol, dur); o.connect(g); g.connect(bus); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  o.start(t); o.stop(t + a + dur + .05);
}
let noiseBuf = null;
function noise(t, dur, { vol = .3, f = 1200, q = 1, type = 'bandpass', bus = fxBus, a = .002, wet = .15 } = {}) {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, a, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(bus); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  s.start(t, Math.random() * .5); s.stop(t + a + dur + .05);
}
// telli çalgı (Karplus-Strong): saz / bağlama tınısı
const plucks = new Map();
function pluckBuf(freq, bright = .5) {
  const key = Math.round(freq * 10) + ':' + bright; if (plucks.has(key)) return plucks.get(key);
  const sr = ac.sampleRate, n = Math.round(sr * 1.6), N = Math.max(2, Math.round(sr / freq)), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0), line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = (Math.random() * 2 - 1) * (1 - bright * .5) + (i < N / 2 ? bright : -bright) * .5;
  let p = 0;
  for (let i = 0; i < n; i++) { const a = line[p], b = line[(p + 1) % N]; d[i] = a; line[p] = (a + b) * .5 * .996; p = (p + 1) % N; }
  plucks.set(key, buf); if (plucks.size > 80) plucks.delete(plucks.keys().next().value);
  return buf;
}
function pluck(freq, t, { vol = .35, bus = fxBus, bright = .5, wet = .35 } = {}) {
  const s = ac.createBufferSource(), g = ac.createGain(), hp = ac.createBiquadFilter();
  s.buffer = pluckBuf(freq, bright); hp.type = 'highpass'; hp.frequency.value = 90; g.gain.value = vol;
  s.connect(hp); hp.connect(g); g.connect(bus); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  s.start(t);
}
function drum(t, { vol = .5, f = 90, bus = fxBus } = {}) {   // def / davul
  tone(f, t, .28, { vol, glide: .55, bus, wet: .2 });
  noise(t, .06, { vol: vol * .35, f: 1800, q: .8, bus });
}
function horn(freqs, t, step, { vol = .22 } = {}) {   // boru / nefir
  freqs.forEach((f, i) => {
    const s = t + i * step, o = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.004; fl.type = 'lowpass'; fl.frequency.setValueAtTime(600, s); fl.frequency.linearRampToValueAtTime(2200, s + .08);
    g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + .05); g.gain.setValueAtTime(vol, s + step * .8); g.gain.exponentialRampToValueAtTime(.0001, s + step * 1.1);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(fxBus); const w = ac.createGain(); w.gain.value = .35; g.connect(w); w.connect(verb);
    o.start(s); o2.start(s); o.stop(s + step * 1.2); o2.stop(s + step * 1.2);
  });
}
const N = n => 293.66 * Math.pow(2, n / 12);   // Re (D4) tabanlı yarım ton

// ---------- efektler ----------
const FX = {
  tap: t => tone(1400, t, .035, { vol: .06, type: 'triangle', wet: 0 }),
  build: t => { for (let i = 0; i < 3; i++) { noise(t + i * .16, .07, { vol: .32, f: 2400, q: 3 }); tone(520 - i * 30, t + i * .16, .06, { vol: .12, type: 'square', wet: .1 }); } },
  done: t => { pluck(N(12), t, { vol: .3, bright: .7 }); pluck(N(19), t + .09, { vol: .28, bright: .7 }); tone(N(24), t + .18, .8, { vol: .08 }); },
  train: t => { drum(t, { vol: .35, f: 110 }); noise(t + .12, .12, { vol: .25, f: 3800, q: 6 }); tone(1900, t + .12, .25, { vol: .05, type: 'triangle' }); },
  attack: t => { horn([N(-5), N(0), N(0)], t, .22); drum(t + .66, { vol: .45 }); drum(t + .86, { vol: .45 }); },
  march: t => { drum(t, { vol: .35, f: 120 }); drum(t + .2, { vol: .3, f: 120 }); horn([N(0), N(7)], t + .1, .2, { vol: .14 }); },
  spy: t => { noise(t, .35, { vol: .14, f: 900, q: .7, type: 'lowpass' }); pluck(N(13), t + .05, { vol: .18, bright: .2 }); },
  coin: t => { for (let i = 0; i < 4; i++) { tone(2600 + i * 300, t + i * .06, .18, { vol: .08, type: 'triangle' }); tone(3900 + i * 250, t + i * .06, .12, { vol: .04 }); } },
  research: t => { [0, 4, 7, 12].forEach((n, i) => pluck(N(n + 7), t + i * .07, { vol: .2, bright: .6 })); },
  good: t => { [0, 4, 7].forEach((n, i) => pluck(N(n), t + i * .1, { vol: .28, bright: .6 })); tone(N(12), t + .3, 1, { vol: .08 }); },
  win: t => { horn([N(0), N(4), N(7), N(12)], t, .16, { vol: .18 }); drum(t + .64, { vol: .5 }); },
  bad: t => { [5, 1, -2].forEach((n, i) => pluck(N(n), t + i * .14, { vol: .26, bright: .35 })); drum(t + .42, { vol: .35, f: 70 }); },
  alarm: t => { horn([N(-5), N(-4), N(-5), N(-4)], t, .18, { vol: .2 }); drum(t, { vol: .5, f: 70 }); drum(t + .36, { vol: .5, f: 70 }); },
  chat: t => { pluck(N(19), t, { vol: .14, bright: .8, wet: .2 }); pluck(N(24), t + .07, { vol: .11, bright: .8, wet: .2 }); },
  err: t => tone(160, t, .18, { vol: .12, type: 'square', wet: 0 }),
};
let lastFx = {};
function play(name) {
  if (!fxOn || !FX[name]) return;
  if (!init() || ac.state !== 'running') return;
  const now = performance.now(); if (now - (lastFx[name] || 0) < 120) return; lastFx[name] = now;
  try { FX[name](ac.currentTime + .01); } catch (e) {}
}

// ---------- müzik: Hicaz makamında sakin bir uç boyu havası ----------
// Hicaz dizisi (Re): Re Mi♭ Fa# Sol La Si♭ Do Re
const HICAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];
let mu = { on: false, next: 0, bar: 0, deg: 4, timer: 0 };
function startMusic() {
  if (!init() || mu.on) return;
  mu.on = true; mu.next = ac.currentTime + .3; mu.bar = 0;
  muBus.gain.cancelScheduledValues(ac.currentTime); muBus.gain.setValueAtTime(muBus.gain.value, ac.currentTime); muBus.gain.linearRampToValueAtTime(.3, ac.currentTime + 3);
  drone(ac.currentTime + .1);
  mu.timer = setInterval(schedule, 250);
}
function stopMusic() {
  if (!ac || !mu.on) return; mu.on = false; clearInterval(mu.timer);
  muBus.gain.cancelScheduledValues(ac.currentTime); muBus.gain.setValueAtTime(muBus.gain.value, ac.currentTime); muBus.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
  if (mu.drone) { const d = mu.drone; setTimeout(() => d.forEach(o => { try { o.stop(); } catch (e) {} }), 1500); mu.drone = null; }
}
function drone(t) {   // dem: Re ve La, yumuşak
  const out = ac.createGain(); out.gain.value = .07; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 520; fl.connect(out); out.connect(muBus);
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .07; lg.gain.value = 180; lfo.connect(lg); lg.connect(fl.frequency);
  const os = [N(-12), N(-12) * 1.003, N(-5)].map((f, i) => { const o = ac.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = i === 2 ? .5 : .35; o.connect(g); g.connect(fl); o.start(t); return o; });
  lfo.start(t); os.push(lfo); mu.drone = os;
}
function ney(freq, t, dur) {   // ney: nefesli, titreşimli
  const o = ac.createOscillator(), g = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
  o.type = 'sine'; o.frequency.value = freq; vib.frequency.value = 5; vg.gain.value = freq * .008; vib.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.09, t + .25); g.gain.setValueAtTime(.09, t + dur * .7); g.gain.linearRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(muBus); const w = ac.createGain(); w.gain.value = .6; g.connect(w); w.connect(verb);
  o.start(t); vib.start(t); o.stop(t + dur + .1); vib.stop(t + dur + .1);
  noise(t, dur * .8, { vol: .012, f: freq * 2, q: 2, bus: muBus, a: .2, wet: .3 });
}
function schedule() {
  if (!mu.on || !ac || ac.state !== 'running') return;
  const beat = .42;   // yaklaşık 70 vuruş/dk, ağır aksak hissi
  while (mu.next < ac.currentTime + 1.2) {
    const t = mu.next, bar = mu.bar++, phrase = Math.floor(bar / 4) % 4;
    // def: düm . tek . düm tek
    drum(t, { vol: .16, f: 85, bus: muBus }); drum(t + beat * 2, { vol: .07, f: 170, bus: muBus }); drum(t + beat * 3, { vol: .12, f: 85, bus: muBus }); drum(t + beat * 3.5, { vol: .06, f: 170, bus: muBus });
    if (phrase === 3 && bar % 4 === 0) { ney(N(HICAZ[4 + Math.floor(Math.random() * 3)]), t, beat * 7.5); }
    else {
      // saz: dizide küçük adımlarla gezinen ezgi, cümle sonunda karara (Re) iner
      const steps = bar % 4 === 3 ? [0, 1, 2] : [0, .5, 1, 2, 2.5, 3];
      for (const s of steps) {
        if (Math.random() < .15) continue;
        const cad = bar % 4 === 3 && s === 2;
        mu.deg = cad ? 0 : Math.max(0, Math.min(HICAZ.length - 1, mu.deg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        pluck(N(HICAZ[mu.deg]), t + s * beat, { vol: cad ? .2 : .14, bus: muBus, bright: .45, wet: .4 });
        if (cad) pluck(N(HICAZ[mu.deg] - 12), t + s * beat, { vol: .12, bus: muBus, bright: .3, wet: .4 });
      }
    }
    mu.next += beat * 4;
  }
}

return {
  play,
  get fx() { return fxOn; }, get music() { return muOn; },
  setFx(v) { fxOn = !!v; put(K.fx, fxOn); if (fxOn) { unlock(); play('tap'); } },
  setMusic(v) { muOn = !!v; put(K.mu, muOn); if (muOn) { unlock(); startMusic(); } else stopMusic(); },
};
})();
