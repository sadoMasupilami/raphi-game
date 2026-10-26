// Soundtrack: Sequencer und Synthesizer komplett in WebAudio (keine Audiodateien)
// Songs: Menü, Shop, vier Kampf-Stufen (alle 5 Wellen härter), Zwischenboss und Endboss

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const m = (name) => {
  const r = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return 12 * (Number(r[2]) + 1) + NOTE[r[1]];
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Melodie-Notation: "Note:Start:Länge" in 16teln, z. B. "A4:0:4 D5:4:4"
function mel(bars) {
  return bars.map((bar) => {
    const map = new Map();
    for (const tok of bar.trim().split(/\s+/)) {
      if (!tok) continue;
      const [n, s, l] = tok.split(':');
      map.set(Number(s), [m(n), Number(l)]);
    }
    return map;
  });
}
// Akkord: Bass-Ton + Akkordtöne (für Pad/Arpeggio)
const chord = (bass, tones) => ({ bass: m(bass), tones: tones.map(m) });

// ===================== Instrumente =====================
export class Synth {
  constructor(ctx, out) {
    this.ctx = ctx;
    const c = ctx;
    // Mischpult
    this.mix = c.createGain();
    this.mix.gain.value = 0.9;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.mix.connect(this.filter).connect(this.comp).connect(out);

    this.dry = c.createGain();
    this.dry.connect(this.mix);
    // Sidechain-Bus: Bass & Pads "pumpen" mit der Kickdrum
    this.side = c.createGain();
    this.side.connect(this.mix);

    // Echo (punktierte Achtel)
    this.delay = c.createDelay(2);
    this.delayFb = c.createGain();
    this.delayFb.gain.value = 0.38;
    const dlp = c.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2800;
    this.delay.connect(dlp).connect(this.delayFb).connect(this.delay);
    const dOut = c.createGain();
    dOut.gain.value = 0.55;
    this.delay.connect(dOut).connect(this.mix);
    this.delaySend = c.createGain();
    this.delaySend.connect(this.delay);

    // Hall
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4);
    const rOut = c.createGain();
    rOut.gain.value = 0.42;
    this.reverb.connect(rOut).connect(this.mix);
    this.reverbSend = c.createGain();
    this.reverbSend.connect(this.reverb);

    // Verzerrung für den Boss-Bass
    this.dist = c.createWaveShaper();
    this.dist.curve = this.makeCurve(28);
    this.dist.oversample = '2x';
    const distOut = c.createGain();
    distOut.gain.value = 0.45;
    this.dist.connect(distOut).connect(this.side);

    // Rauschen
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  makeImpulse(sec) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  makeCurve(k) {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  setDelayTime(sec) { this.delay.delayTime.setTargetAtTime(sec, this.ctx.currentTime, 0.05); }

  send(node, delayAmt, reverbAmt) {
    if (delayAmt) {
      const g = this.ctx.createGain();
      g.gain.value = delayAmt;
      node.connect(g).connect(this.delaySend);
    }
    if (reverbAmt) {
      const g = this.ctx.createGain();
      g.gain.value = reverbAmt;
      node.connect(g).connect(this.reverbSend);
    }
  }

  env(param, t, attack, peak, release, end) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.setValueAtTime(peak, Math.max(t + attack, end - release));
    param.exponentialRampToValueAtTime(0.0001, end);
  }

  osc(type, freq, t, end, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  noiseSrc(t, end) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(end + 0.05);
    return s;
  }

  noiseHit(t, dur, vol, type, freq, q = 1, dest = this.dry) {
    const c = this.ctx;
    const s = this.noiseSrc(t, t + dur);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    return g;
  }

  duck(t, depth = 0.22, time = 0.22) {
    const g = this.side.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(depth, t);
    g.linearRampToValueAtTime(1, t + time);
  }

  // ---------- Drums ----------
  kick(t, v = 1, punch = 1) {
    const c = this.ctx;
    const o = this.osc('sine', 170 * punch, t, t + 0.45);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 1.1, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.dry);
    // Klick + "Knock", damit die Kick auch auf Handy-Lautsprechern durchkommt
    this.noiseHit(t, 0.015, 0.35 * v, 'bandpass', 2600, 1.2);
    const k = this.osc('triangle', 230, t, t + 0.06);
    k.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    const kg = c.createGain();
    kg.gain.setValueAtTime(0.35 * v, t);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    k.connect(kg).connect(this.dry);
    this.duck(t);
  }

  snare(t, v = 1) {
    const c = this.ctx;
    const g = this.noiseHit(t, 0.22, 0.55 * v, 'bandpass', 1900, 0.7);
    this.send(g, 0, 0.35);
    const o = this.osc('triangle', 210, t, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    const og = c.createGain();
    og.gain.setValueAtTime(0.45 * v, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(og).connect(this.dry);
  }

  clap(t, v = 1) {
    for (let i = 0; i < 3; i++) {
      const g = this.noiseHit(t + i * 0.011, i === 2 ? 0.16 : 0.02, 0.35 * v, 'bandpass', 1300, 1.2);
      if (i === 2) this.send(g, 0, 0.4);
    }
  }

  rim(t, v = 1) {
    const c = this.ctx;
    const o = this.osc('square', 820, t, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.12 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(this.dry);
    this.send(g, 0, 0.3);
  }

  hat(t, open = false, v = 1) {
    this.noiseHit(t, open ? 0.3 : 0.045, 0.22 * v, 'highpass', open ? 6500 : 8000, 0.8);
  }

  crash(t, v = 1) {
    const g = this.noiseHit(t, 1.8, 0.22 * v, 'highpass', 4200, 0.5);
    this.send(g, 0, 0.5);
  }

  tom(t, f, v = 1) {
    const c = this.ctx;
    const o = this.osc('sine', f, t, t + 0.3);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0.6 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.dry);
    this.send(g, 0, 0.3);
  }

  riser(t, dur, v = 1) {
    const c = this.ctx;
    const s = this.noiseSrc(t, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * v, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.dry);
    this.send(g, 0.3, 0.3);
  }

  // ---------- Melodische Instrumente ----------
  bass(t, midi, dur, cutoff = 1500, v = 1, distorted = false) {
    const c = this.ctx;
    const end = t + dur;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 7;
    f.frequency.setValueAtTime(cutoff * 2.4, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.35), end);
    const g = c.createGain();
    this.env(g.gain, t, 0.004, 0.32 * v, 0.03, end);
    for (const det of [-8, 8]) this.osc('sawtooth', hz(midi), t, end, det).connect(f);
    f.connect(g);
    const sub = this.osc('sine', hz(midi - 12), t, end);
    const sg = c.createGain();
    this.env(sg.gain, t, 0.004, 0.2 * v, 0.03, end);
    sub.connect(sg).connect(this.side);
    g.connect(distorted ? this.dist : this.side);
  }

  pad(t, notes, dur, v = 1, bright = 1400) {
    const c = this.ctx;
    const end = t + dur;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(bright * 0.6, t);
    f.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(bright * 0.7, end);
    const g = c.createGain();
    this.env(g.gain, t, Math.min(0.35, dur * 0.3), 0.07 * v, Math.min(0.5, dur * 0.3), end);
    for (const n of notes) {
      for (const det of [-11, 11]) this.osc('sawtooth', hz(n), t, end, det).connect(f);
    }
    f.connect(g).connect(this.side);
    this.send(g, 0, 0.6);
  }

  pluck(t, midi, dur, v = 1, type = 'square') {
    const c = this.ctx;
    const end = t + Math.max(dur, 0.12);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.16);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    this.osc(type, hz(midi), t, end).connect(f);
    f.connect(g).connect(this.dry);
    this.send(g, 0.45, 0.2);
  }

  lead(t, midi, dur, v = 1, bright = 3400) {
    const c = this.ctx;
    const end = t + dur;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(bright * 1.4, t);
    f.frequency.exponentialRampToValueAtTime(bright, t + 0.12);
    const g = c.createGain();
    this.env(g.gain, t, 0.008, 0.1 * v, Math.min(0.08, dur * 0.3), end);
    const o1 = this.osc('sawtooth', hz(midi), t, end, -6);
    const o2 = this.osc('square', hz(midi), t, end, 7);
    // Vibrato setzt nach kurzer Zeit ein
    const lfo = this.osc('sine', 5.6, t, end);
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(dur > 0.25 ? 18 : 0, t + Math.min(dur, 0.3));
    lfo.connect(lg);
    lg.connect(o1.detune);
    lg.connect(o2.detune);
    const g2 = c.createGain();
    g2.gain.value = 0.55;
    o1.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(this.dry);
    this.send(g, 0.35, 0.3);
  }

  alarm(t, midi, dur, v = 1) {
    const c = this.ctx;
    const end = t + dur;
    const o = this.osc('square', hz(midi), t, end);
    o.frequency.exponentialRampToValueAtTime(hz(midi + 12), end);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    const g = c.createGain();
    this.env(g.gain, t, 0.01, 0.06 * v, 0.05, end);
    o.connect(f).connect(g).connect(this.dry);
    this.send(g, 0.4, 0.3);
  }

  keys(t, notes, dur, v = 1) {
    const c = this.ctx;
    const end = t + dur;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    // Tremolo wie beim E-Piano
    const trem = c.createGain();
    trem.gain.value = 0.85;
    const lfo = this.osc('sine', 4.5, t, end);
    const lg = c.createGain();
    lg.gain.value = 0.15;
    lfo.connect(lg).connect(trem.gain);
    for (const n of notes) {
      this.osc('sine', hz(n), t, end).connect(trem);
      const o2 = this.osc('triangle', hz(n + 12), t, end);
      const g2 = c.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(trem);
    }
    trem.connect(g).connect(this.dry);
    this.send(g, 0.25, 0.4);
  }

  vibe(t, midi, dur, v = 1) {
    const c = this.ctx;
    const end = t + dur;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.4);
    this.osc('sine', hz(midi), t, end + 0.4).connect(g);
    const o2 = this.osc('sine', hz(midi) * 4, t, end + 0.2);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o2.connect(g2).connect(g);
    g.connect(this.dry);
    this.send(g, 0.3, 0.45);
  }
  // ---------- Zusätzliche Instrumente für die späteren Wellen ----------
  // Kurzer, gegateter Akkord-Stab
  stab(t, notes, dur, v = 1, cutoff = 2600) {
    const c = this.ctx;
    const end = t + dur;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(cutoff * 1.6, t);
    f.frequency.exponentialRampToValueAtTime(cutoff * 0.5, end);
    const g = c.createGain();
    this.env(g.gain, t, 0.003, 0.05 * v, 0.02, end);
    for (const n of notes) {
      for (const det of [-9, 9]) this.osc('sawtooth', hz(n), t, end, det).connect(f);
    }
    f.connect(g).connect(this.side);
    this.send(g, 0.35, 0.25);
  }

  // Fetter Supersaw-Lead (fünf verstimmte Sägezähne)
  supersaw(t, midi, dur, v = 1, bright = 4200) {
    const c = this.ctx;
    const end = t + dur;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1;
    f.frequency.setValueAtTime(bright * 1.3, t);
    f.frequency.exponentialRampToValueAtTime(bright, t + 0.1);
    const g = c.createGain();
    this.env(g.gain, t, 0.01, 0.055 * v, Math.min(0.1, dur * 0.3), end);
    for (const det of [-26, -12, 0, 12, 26]) this.osc('sawtooth', hz(midi), t, end, det).connect(f);
    const sub = this.osc('square', hz(midi - 12), t, end);
    const sg = c.createGain();
    sg.gain.value = 0.35;
    sub.connect(sg).connect(f);
    f.connect(g).connect(this.dry);
    this.send(g, 0.3, 0.35);
  }

  // Industrieller Metall-Schlag
  metal(t, v = 1) {
    const g1 = this.noiseHit(t, 0.35, 0.3 * v, 'bandpass', 720, 9);
    const g2 = this.noiseHit(t, 0.25, 0.22 * v, 'bandpass', 1650, 11);
    this.send(g1, 0.2, 0.5);
    this.send(g2, 0, 0.4);
  }

  // Aufsteigende Sirene für Breakdowns
  siren(t, midi, dur, v = 1) {
    const c = this.ctx;
    const end = t + dur;
    const o = this.osc('sawtooth', hz(midi), t, end);
    o.frequency.exponentialRampToValueAtTime(hz(midi + 12), t + dur * 0.5);
    o.frequency.exponentialRampToValueAtTime(hz(midi), end);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 1.5;
    const g = c.createGain();
    this.env(g.gain, t, 0.05, 0.07 * v, 0.1, end);
    o.connect(f).connect(g).connect(this.dry);
    this.send(g, 0.4, 0.4);
  }
}

// ===================== Songs =====================
const has = (p, s) => p[s] === 'x';

// --- KAMPF: "Overdrive" – D-Moll, 138 BPM ---
const BATTLE = {
  name: 'Overdrive',
  bpm: 138,
  form: [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['drop', 8]],
  loopFrom: 1,
  chords: [
    chord('D2', ['D4', 'F4', 'A4', 'D5']),
    chord('Bb1', ['D4', 'F4', 'Bb4', 'D5']),
    chord('F2', ['C4', 'F4', 'A4', 'C5']),
    chord('C2', ['C4', 'E4', 'G4', 'C5']),
  ],
  leadB: mel([
    'A4:0:4 D5:4:4 E5:8:2 F5:10:6',
    'F5:0:2 E5:2:2 D5:4:4 F5:8:4 D5:12:4',
    'C5:0:4 F5:4:4 A5:8:6 G5:14:2',
    'G5:0:6 E5:6:2 C5:8:4 E5:12:4',
    'A4:0:4 D5:4:4 E5:8:2 F5:10:4 G5:14:2',
    'A5:0:6 G5:6:2 F5:8:4 D5:12:4',
    'C6:0:4 A5:4:4 F5:8:4 A5:12:4',
    'G5:0:8 E5:8:4 C5:12:4',
  ]),
  leadDrop: mel([
    'D6:0:2 C6:2:2 A5:4:2 D6:6:2 F6:8:4 E6:12:2 D6:14:2',
    'D6:0:2 C6:2:2 Bb5:4:2 D6:6:2 F6:8:6 D6:14:2',
    'C6:0:2 A5:2:2 F5:4:2 A5:6:2 C6:8:4 F6:12:4',
    'E6:0:4 D6:4:2 C6:6:2 G5:8:4 C6:12:2 E6:14:2',
    'D6:0:2 C6:2:2 A5:4:2 D6:6:2 F6:8:4 E6:12:2 D6:14:2',
    'D6:0:2 C6:2:2 Bb5:4:2 D6:6:2 F6:8:4 G6:12:4',
    'A6:0:4 G6:4:2 F6:6:2 C6:8:4 F6:12:4',
    'G6:0:4 F6:4:2 E6:6:2 C6:8:8',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x } = e;
    const playing = sec !== 'break';
    // Drums
    if (playing && s % 4 === 0) S.kick(t);
    if ((sec === 'A' || sec === 'B' || sec === 'drop') && (s === 4 || s === 12)) { S.snare(t, 0.9); S.clap(t, 0.8); }
    if (sec === 'intro' && lb === 3 && s >= 8 && s % 2 === 0) S.snare(t, 0.3 + (s - 8) * 0.08);
    if (playing) {
      if (s % 4 === 2) S.hat(t, sec === 'drop' && s === 14, 0.9);
      else if ((sec === 'drop' || x > 0.5) && s % 2 === 1) S.hat(t, false, 0.45);
      else if (sec !== 'intro' && s % 4 === 0) S.hat(t, false, 0.35);
    }
    if (sec === 'break' && lb === 3) S.snare(t, 0.15 + (s / 16) * 0.75);
    if (sec === 'break' && lb === 2 && s === 0) S.riser(t, sd * 32);
    if (s === 0 && lb === 0 && (sec === 'A' || sec === 'drop')) S.crash(t);
    if (sec === 'B' && lb === 7 && s >= 12) S.tom(t, [190, 160, 130, 110][s - 12], 0.8);
    // Bass: pumpende 16tel mit Oktavsprung
    if (playing) {
      const n = ch.bass + (s % 4 === 2 ? 12 : 0);
      const cut = sec === 'intro' ? 380 + lb * 220 : sec === 'drop' ? 2200 : 1500;
      S.bass(t, n, sd * 0.85, cut, s % 4 === 0 ? 1 : 0.8);
    } else if (s === 0) {
      S.bass(t, ch.bass, sd * 15.5, 300, 0.45);
    }
    // Pads
    if (s === 0 && (sec === 'B' || sec === 'drop' || sec === 'break')) {
      S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, sec === 'break' ? 1.4 : 0.8, sec === 'drop' ? 2200 : 1500);
    }
    // Arpeggio
    if (sec !== 'intro' && (sec !== 'A' || lb >= 2 || x > 0.3)) {
      const seq = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];
      S.pluck(t, ch.tones[seq[s]] + (sec === 'drop' ? 12 : 0), sd * 0.8, sec === 'break' ? 1.1 : 0.7);
    }
    // Lead
    const L = sec === 'B' ? this.leadB : sec === 'drop' ? this.leadDrop : null;
    if (L) {
      const ev = L[lb % L.length].get(s);
      if (ev) S.lead(t, ev[0], ev[1] * sd * 0.95, sec === 'drop' ? 1.1 : 0.9);
    }
  },
};

// --- BOSS (Welle 10): "Alarmstufe Rot" – E-Moll harmonisch, 150 BPM ---
const BOSS = {
  name: 'Alarmstufe Rot',
  bpm: 150,
  form: [['intro', 4], ['A', 8], ['B', 8], ['break', 4]],
  loopFrom: 1,
  chords: [
    chord('E2', ['E4', 'G4', 'B4', 'E5']),
    chord('C2', ['E4', 'G4', 'C5', 'E5']),
    chord('A1', ['E4', 'A4', 'C5', 'E5']),
    chord('B1', ['D#4', 'F#4', 'B4', 'D#5']),
  ],
  kickA: 'x..x..x...x.x...',
  bassA: 'x.xx.xx.x.xx.x.x',
  lead: mel([
    'E5:0:3 G5:3:3 B5:6:2 A5:8:3 G5:11:3 F#5:14:2',
    'G5:0:3 E5:3:3 C5:6:2 E5:8:8',
    'A5:0:3 C6:3:3 E6:6:2 D6:8:3 C6:11:3 B5:14:2',
    'D#6:0:4 B5:4:4 F#5:8:4 D#5:12:4',
    'E6:0:2 D6:2:2 B5:4:2 G5:6:2 E5:8:2 G5:10:2 B5:12:4',
    'C6:0:3 B5:3:3 G5:6:2 E5:8:8',
    'A5:0:2 B5:2:2 C6:4:2 E6:6:2 A6:8:4 G6:12:2 E6:14:2',
    'F#6:0:4 D#6:4:4 B5:8:4 F#6:12:4',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x } = e;
    if (sec === 'intro') {
      if (s % 4 === 0) S.kick(t, 0.9);
      if (s === 0 || s === 8) S.alarm(t, 64, sd * 7, 1);
      if (lb >= 2 && s % 2 === 0) S.hat(t, false, 0.6);
      if (lb === 3) S.snare(t, 0.2 + (s / 16) * 0.8);
      if (s === 0) S.bass(t, ch.bass, sd * 15, 260, 1, true);
      return;
    }
    if (sec === 'break') {
      if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 1.3, 900);
      if (s === 0 || s === 8) S.alarm(t, ch.bass + 24, sd * 7, 0.9);
      if (lb === 2 && s === 0) S.riser(t, sd * 32, 1.2);
      if (lb === 3 && s >= 8) S.tom(t, 220 - (s - 8) * 15, 0.9);
      if (lb >= 2 && s % 4 === 0) S.kick(t, 0.7);
      return;
    }
    // A und B: hart und treibend
    const fourFloor = sec === 'B' || x > 0.6;
    if (fourFloor ? s % 4 === 0 : has(this.kickA, s)) S.kick(t, 1, 1.1);
    if (s === 4 || s === 12) { S.snare(t, 1); S.clap(t, 0.6); }
    if (sec === 'B' && lb % 4 === 3 && (s === 14 || s === 15)) S.snare(t, 0.6);
    S.hat(t, s === 6 || s === 14, s % 2 === 0 ? 0.8 : 0.45);
    if (s === 0 && lb === 0) S.crash(t, 1.1);
    if (has(this.bassA, s)) S.bass(t, ch.bass + (s === 10 || s === 15 ? 12 : 0), sd * 0.9, 900, 1, true);
    if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 0.6, 1100);
    if (sec === 'A' && s % 2 === 0) {
      const seq = [0, 2, 1, 3, 0, 2, 1, 3];
      S.pluck(t, ch.tones[seq[(s / 2) % 8]] + 12, sd * 1.5, 0.55, 'sawtooth');
    }
    if (sec === 'B') {
      const ev = this.lead[lb % 8].get(s);
      if (ev) S.lead(t, ev[0], ev[1] * sd * 0.95, 1.1, 2600);
    }
  },
};

// --- MENÜ: "Neon-Skyline" – A-Moll, 100 BPM ---
const MENU = {
  name: 'Neon-Skyline',
  bpm: 100,
  form: [['A', 8], ['B', 8]],
  loopFrom: 0,
  chords: [
    chord('A1', ['A3', 'C4', 'E4', 'A4']),
    chord('F1', ['A3', 'C4', 'F4', 'A4']),
    chord('C2', ['G3', 'C4', 'E4', 'G4']),
    chord('G1', ['G3', 'B3', 'D4', 'G4']),
  ],
  lead: mel([
    'E5:0:6 A5:6:2 B5:8:4 C6:12:4',
    'A5:0:8 G5:8:4 F5:12:4',
    'E5:0:6 G5:6:2 C6:8:4 B5:12:4',
    'B5:0:8 A5:8:4 G5:12:4',
    'E5:0:6 A5:6:2 B5:8:4 C6:12:4',
    'D6:0:6 C6:6:2 A5:8:8',
    'G5:0:6 C6:6:2 E6:8:4 D6:12:4',
    'B5:0:12',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd } = e;
    if (s === 0 || s === 8 || (s === 10 && lb % 2 === 1)) S.kick(t, 0.85);
    if (s === 4 || s === 12) S.snare(t, 0.55);
    if (s % 2 === 0) S.hat(t, s === 14 && lb % 4 === 3, 0.4);
    if (s === 0 && lb === 0) S.crash(t, 0.7);
    if (s % 2 === 0) S.bass(t, ch.bass + 12 + (s % 4 === 2 ? 12 : 0), sd * 1.7, 900, 0.8);
    if (s === 0) S.pad(t, ch.tones.slice(0, 3), sd * 16, 1, 1800);
    if (s % 2 === 0) {
      const seq = [0, 1, 2, 3, 2, 1, 2, 3];
      S.pluck(t, ch.tones[seq[(s / 2) % 8]] + 12, sd * 1.6, 0.6, 'triangle');
    }
    if (sec === 'B') {
      const ev = this.lead[lb % 8].get(s);
      if (ev) S.lead(t, ev[0], ev[1] * sd * 0.95, 0.8, 2600);
    }
  },
};

// --- SHOP: "Schwarzmarkt" – Groove in C, 92 BPM mit Swing ---
const SHOP = {
  name: 'Schwarzmarkt',
  bpm: 92,
  swing: 0.18,
  form: [['A', 8]],
  loopFrom: 0,
  chords: [
    { bass: m('D2'), walk: ['D2', 'F2', 'A2', 'C3'].map(m), keys: ['F4', 'A4', 'C5', 'E5'].map(m) },
    { bass: m('G1'), walk: ['G1', 'B1', 'D2', 'F2'].map(m), keys: ['F4', 'A4', 'B4', 'E5'].map(m) },
    { bass: m('C2'), walk: ['C2', 'E2', 'G2', 'B2'].map(m), keys: ['E4', 'G4', 'B4', 'D5'].map(m) },
    { bass: m('A1'), walk: ['A1', 'C#2', 'E2', 'G2'].map(m), keys: ['C#4', 'G4', 'A4', 'E5'].map(m) },
  ],
  vibes: mel([
    '',
    '',
    '',
    '',
    'F5:0:2 A5:2:2 C6:4:4 E6:8:4 D6:12:4',
    'B5:0:4 A5:4:2 G5:6:2 E5:8:8',
    'E5:0:2 G5:2:2 B5:4:4 D6:8:2 C6:10:6',
    'C#6:0:4 A5:4:4 G5:8:4 E5:12:4',
  ]),
  step(e) {
    const { S, lb, s, t, ch, sd } = e;
    if (s === 0 || s === 10 || (s === 7 && lb % 2 === 1)) S.kick(t, 0.7);
    if (s === 4 || s === 12) S.rim(t, 1);
    if (s % 2 === 0) S.hat(t, s === 6, s % 4 === 0 ? 0.35 : 0.5);
    if (s % 4 === 0) S.bass(t, ch.walk[s / 4], sd * 3.6, 700, 0.9);
    if (s === 0) S.keys(t, ch.keys, sd * 6, 1);
    if (s === 10) S.keys(t, ch.keys, sd * 3, 0.7);
    const ev = this.vibes[lb % 8].get(s);
    if (ev) S.vibe(t, ev[0], ev[1] * sd, 1);
  },
};

// --- WELLE 5–9: "Hyperdrive" – E-Moll, 146 BPM ---
const HYPER = {
  name: 'Hyperdrive',
  bpm: 146,
  form: [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['drop', 8]],
  loopFrom: 1,
  chords: [
    chord('E2', ['E4', 'G4', 'B4', 'E5']),
    chord('C2', ['E4', 'G4', 'C5', 'E5']),
    chord('G1', ['D4', 'G4', 'B4', 'D5']),
    chord('D2', ['D4', 'F#4', 'A4', 'D5']),
  ],
  bassPat: 'x.xxx.xxx.xxx.xx',
  leadB: mel([
    'E5:0:3 G5:3:3 B5:6:4 A5:10:2 G5:12:4',
    'E5:0:4 G5:4:2 C6:6:6 B5:12:4',
    'D5:0:3 G5:3:3 B5:6:4 D6:10:6',
    'F#5:0:4 A5:4:4 D6:8:4 C6:12:2 B5:14:2',
    'E5:0:3 G5:3:3 B5:6:4 E6:10:6',
    'E6:0:4 D6:4:2 C6:6:6 G5:12:4',
    'B5:0:3 D6:3:3 G6:6:4 F#6:10:2 E6:12:4',
    'F#6:0:8 D6:8:4 A5:12:4',
  ]),
  leadDrop: mel([
    'E6:0:2 B5:2:2 G5:4:2 B5:6:2 E6:8:2 F#6:10:2 G6:12:4',
    'G6:0:2 E6:2:2 C6:4:2 E6:6:2 G6:8:4 E6:12:4',
    'D6:0:2 B5:2:2 G5:4:2 B5:6:2 D6:8:2 E6:10:2 F#6:12:4',
    'F#6:0:4 E6:4:2 D6:6:2 A5:8:4 D6:12:4',
    'E6:0:2 B5:2:2 G5:4:2 B5:6:2 E6:8:2 F#6:10:2 G6:12:4',
    'A6:0:2 G6:2:2 E6:4:2 C6:6:2 E6:8:4 G6:12:4',
    'B6:0:4 A6:4:2 G6:6:2 D6:8:4 G6:12:4',
    'F#6:0:4 G6:4:4 A6:8:8',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x } = e;
    const playing = sec !== 'break';
    if (playing && (s % 4 === 0 || (s === 14 && lb % 4 === 3))) S.kick(t, 1, 1.05);
    if (sec !== 'intro' && playing && (s === 4 || s === 12)) { S.snare(t, 1); S.clap(t, 0.8); }
    if (sec === 'intro' && lb >= 2 && s % 4 === 2) S.clap(t, 0.5);
    if (playing) S.hat(t, sec === 'drop' && s % 4 === 2, s % 4 === 2 ? 0.9 : s % 2 === 1 ? 0.35 + x * 0.3 : 0.5);
    if (sec === 'break' && lb >= 2) S.snare(t, lb === 2 ? (s % 4 === 0 ? 0.4 : 0) : 0.2 + (s / 16) * 0.8);
    if (sec === 'break' && lb === 2 && s === 0) S.riser(t, sd * 32, 1.1);
    if (s === 0 && lb % 4 === 0 && (sec === 'A' || sec === 'drop')) S.crash(t);
    // Bass
    if (playing && has(this.bassPat, s)) {
      const cut = sec === 'intro' ? 400 + lb * 300 : sec === 'drop' ? 2600 : 1700;
      S.bass(t, ch.bass + (s % 4 === 3 ? 12 : 0), sd * 0.85, cut, 0.95);
    } else if (!playing && s === 0) S.bass(t, ch.bass, sd * 15.5, 280, 0.45);
    // Stabs auf den Offbeats
    if ((sec === 'A' || sec === 'drop') && s % 4 === 2) S.stab(t, ch.tones.slice(0, 3), sd * 0.9, sec === 'drop' ? 1.2 : 0.9);
    if (s === 0 && (sec === 'B' || sec === 'break' || sec === 'drop')) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, sec === 'break' ? 1.4 : 0.7, 1800);
    // Arpeggio über zwei Oktaven
    if (sec === 'B' || sec === 'break' || sec === 'drop' || (sec === 'A' && lb >= 4)) {
      const seq = [0, 1, 2, 3, 4, 3, 2, 1];
      const i = seq[s % 8];
      const n = i === 4 ? ch.tones[1] + 12 : ch.tones[i];
      S.pluck(t, n + 12, sd * 0.7, sec === 'break' ? 1 : 0.6);
    }
    const L = sec === 'B' ? this.leadB : sec === 'drop' ? this.leadDrop : null;
    if (L) {
      const ev = L[lb % 8].get(s);
      if (ev) {
        if (sec === 'drop') S.supersaw(t, ev[0], ev[1] * sd * 0.95, 1);
        else S.lead(t, ev[0], ev[1] * sd * 0.95, 1);
      }
    }
  },
};

// --- WELLE 11–14: "Blackout" – C-Moll harmonisch, 152 BPM ---
const BLACKOUT = {
  name: 'Blackout',
  bpm: 152,
  form: [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['drop', 8]],
  loopFrom: 1,
  chords: [
    chord('C2', ['C4', 'Eb4', 'G4', 'C5']),
    chord('Ab1', ['C4', 'Eb4', 'Ab4', 'C5']),
    chord('F1', ['C4', 'F4', 'Ab4', 'C5']),
    chord('G1', ['B3', 'D4', 'G4', 'B4']),
  ],
  bassPat: 'x.x.x.xxx.x.x.xx',
  leadB: mel([
    'G5:0:4 C6:4:4 D6:8:2 Eb6:10:6',
    'C6:0:4 Eb6:4:4 Ab6:8:4 G6:12:4',
    'F6:0:3 Eb6:3:3 C6:6:2 Ab5:8:4 C6:12:4',
    'B5:0:4 D6:4:4 G6:8:4 F6:12:2 D6:14:2',
    'G5:0:4 C6:4:4 D6:8:2 Eb6:10:6',
    'G6:0:4 F6:4:2 Eb6:6:2 C6:8:4 Eb6:12:4',
    'Ab6:0:4 G6:4:2 F6:6:2 C6:8:4 F6:12:4',
    'G6:0:8 B5:8:4 D6:12:4',
  ]),
  leadDrop: mel([
    'C6:0:2 G5:2:2 C6:4:2 Eb6:6:2 G6:8:2 Eb6:10:2 C6:12:2 G5:14:2',
    'Ab5:0:2 C6:2:2 Eb6:4:2 Ab6:6:2 G6:8:4 Eb6:12:4',
    'F6:0:2 C6:2:2 Ab5:4:2 C6:6:2 F6:8:2 G6:10:2 Ab6:12:4',
    'G6:0:2 D6:2:2 B5:4:2 D6:6:2 G6:8:4 B6:12:4',
    'C6:0:2 G5:2:2 C6:4:2 Eb6:6:2 G6:8:2 Eb6:10:2 C6:12:2 G5:14:2',
    'Ab5:0:2 C6:2:2 Eb6:4:2 Ab6:6:2 G6:8:4 Eb6:12:4',
    'F6:0:2 C6:2:2 Ab5:4:2 C6:6:2 F6:8:2 G6:10:2 Ab6:12:4',
    'C7:0:4 B6:4:4 G6:8:8',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x } = e;
    const playing = sec !== 'break';
    if (sec === 'intro') {
      if (s % 4 === 0) S.kick(t, 0.9, 1.15);
      if (s === 0 && lb % 2 === 0) S.metal(t, 1);
      if (s === 0) S.bass(t, ch.bass, sd * 15, 300 + lb * 150, 0.8, true);
      if (lb === 3 && s >= 8) S.snare(t, 0.3 + (s - 8) * 0.09);
      if (s % 2 === 0 && lb >= 2) S.hat(t, false, 0.6);
      return;
    }
    if (playing && s % 4 === 0) S.kick(t, 1, 1.15);
    if (playing && (s === 4 || s === 12)) { S.snare(t, 1.1); S.clap(t, 0.9); }
    if (sec === 'drop' && (s === 7 || s === 15)) S.snare(t, 0.35);
    if (playing) S.hat(t, sec === 'drop' && s % 4 === 2, s % 2 === 0 ? 0.8 : 0.4 + x * 0.3);
    if (playing && s === 0 && lb % 2 === 0) S.metal(t, 0.8);
    if (s === 0 && lb % 4 === 0 && playing) S.crash(t, 1.1);
    if (sec === 'break') {
      if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 1.4, 1000);
      if (lb === 1 && s === 0) S.siren(t, ch.bass + 36, sd * 32, 1);
      if (lb === 2 && s === 0) S.riser(t, sd * 32, 1.2);
      if (lb === 3) S.snare(t, 0.2 + (s / 16) * 0.9);
      if (s === 0) S.bass(t, ch.bass, sd * 15.5, 250, 0.5, true);
      return;
    }
    if (has(this.bassPat, s)) S.bass(t, ch.bass + (s === 6 || s === 14 ? 12 : 0), sd * 0.9, sec === 'drop' ? 1400 : 1000, 1, true);
    if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 0.6, 1100);
    if (sec === 'A' ? s % 2 === 0 : true) {
      const seq = [0, 2, 1, 3, 0, 2, 1, 3, 2, 0, 3, 1, 2, 0, 3, 1];
      S.pluck(t, ch.tones[seq[s]] + 12, sd * (sec === 'A' ? 1.5 : 0.7), 0.6, 'sawtooth');
    }
    if (sec === 'drop' && s % 8 === 6) S.stab(t, ch.tones.slice(0, 3), sd * 1.5, 1.2, 2000);
    const L = sec === 'B' ? this.leadB : sec === 'drop' ? this.leadDrop : null;
    if (L) {
      const ev = L[lb % 8].get(s);
      if (ev) {
        if (sec === 'drop') S.supersaw(t, ev[0], ev[1] * sd * 0.95, 1.1, 3600);
        else S.lead(t, ev[0], ev[1] * sd * 0.95, 1.1, 2800);
      }
    }
  },
};

// --- WELLE 15–19: "Overclock" – Fis-Moll, 160 BPM, mit Tonart-Rückung im zweiten Drop ---
const OVERCLOCK = {
  name: 'Overclock',
  bpm: 160,
  form: [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['drop', 8], ['drop2', 8]],
  loopFrom: 1,
  transpose: (sec) => (sec === 'drop2' ? 1 : 0),
  chords: [
    chord('F#1', ['F#4', 'A4', 'C#5', 'F#5']),
    chord('D2', ['F#4', 'A4', 'D5', 'F#5']),
    chord('E2', ['E4', 'G#4', 'B4', 'E5']),
    chord('C#2', ['F4', 'G#4', 'C#5', 'F5']),
  ],
  leadB: mel([
    'C#6:0:4 F#6:4:4 E6:8:2 C#6:10:2 A5:12:4',
    'D6:0:4 F#6:4:4 A6:8:4 F#6:12:4',
    'E6:0:4 G#6:4:4 B6:8:4 G#6:12:2 E6:14:2',
    'F6:0:6 G#6:6:2 C#7:8:8',
    'C#6:0:4 F#6:4:4 E6:8:2 C#6:10:2 A5:12:4',
    'D6:0:2 E6:2:2 F#6:4:4 A6:8:4 D7:12:4',
    'B6:0:4 G#6:4:2 E6:6:2 B5:8:4 E6:12:4',
    'F6:0:4 G#6:4:4 C#7:8:8',
  ]),
  leadDrop: mel([
    'F#6:0:2 C#6:2:2 A5:4:2 C#6:6:2 F#6:8:2 A6:10:2 G#6:12:2 F#6:14:2',
    'F#6:0:2 D6:2:2 A5:4:2 D6:6:2 F#6:8:2 A6:10:2 D7:12:4',
    'E6:0:2 B5:2:2 G#5:4:2 B5:6:2 E6:8:2 G#6:10:2 B6:12:4',
    'C#7:0:4 B6:4:2 G#6:6:2 F6:8:4 G#6:12:4',
    'F#6:0:2 C#6:2:2 A5:4:2 C#6:6:2 F#6:8:2 A6:10:2 G#6:12:2 F#6:14:2',
    'F#6:0:2 D6:2:2 A5:4:2 D6:6:2 F#6:8:2 A6:10:2 D7:12:4',
    'E6:0:2 B5:2:2 G#5:4:2 B5:6:2 E6:8:2 G#6:10:2 B6:12:4',
    'C#7:0:8 F6:8:4 G#6:12:4',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x, tr } = e;
    const drop = sec === 'drop' || sec === 'drop2';
    const playing = sec !== 'break';
    if (playing && (s % 4 === 0 || (drop && lb % 2 === 1 && (s === 14 || s === 15)))) S.kick(t, 1, 1.1);
    if (sec !== 'intro' && playing && (s === 4 || s === 12)) { S.snare(t, 1); S.clap(t, 0.9); }
    if (sec === 'intro' && lb >= 1 && s % 2 === 0) S.snare(t, lb === 3 ? 0.2 + (s / 16) * 0.8 : 0);
    if (sec === 'B' && lb % 4 === 3 && s >= 12) S.snare(t, 0.5 + (s - 12) * 0.12);
    if (playing) S.hat(t, drop && s % 4 === 2, s % 2 === 0 ? 0.85 : 0.5 + x * 0.3);
    if (playing && s === 0 && (lb % 4 === 0 || (drop && lb % 2 === 0))) S.crash(t, 1);
    if (sec === 'break') {
      if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 1.4, 2000);
      if (lb === 0 && s === 0) S.siren(t, ch.bass + 36, sd * 32, 1.1);
      if (lb === 2 && s === 0) S.riser(t, sd * 32, 1.3);
      if (lb >= 2) S.snare(t, lb === 2 ? (s % 2 === 0 ? 0.35 : 0) : 0.25 + (s / 16) * 0.85);
      if (lb === 3 && s >= 12) S.tom(t, 240 - (s - 12) * 30, 1);
      if (s === 0) S.bass(t, ch.bass, sd * 15.5, 300, 0.45);
      const seq = [0, 1, 2, 3, 2, 1, 2, 3];
      S.pluck(t, ch.tones[seq[s % 8]] + 12, sd * 0.7, 1);
      return;
    }
    // Rasende 16tel-Bässe mit Oktavsprung auf jeder zweiten Note
    const cut = sec === 'intro' ? 500 + lb * 350 : drop ? 2800 : 1900;
    S.bass(t, ch.bass + (s % 2 === 1 ? 12 : 0), sd * 0.8, cut, s % 4 === 0 ? 1 : 0.8);
    if ((sec === 'A' || drop) && s % 4 === 2) S.stab(t, ch.tones.slice(0, 3), sd * 0.9, drop ? 1.3 : 1);
    if (s === 0 && (sec === 'B' || drop)) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 0.7, 2000);
    if (sec !== 'intro') {
      const seq = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3];
      const i = seq[s];
      const n = i >= 4 ? ch.tones[i - 3] + 12 : ch.tones[i];
      S.pluck(t, n + 12, sd * 0.6, drop ? 0.55 : 0.7);
    }
    const L = sec === 'B' ? this.leadB : drop ? this.leadDrop : null;
    if (L) {
      const ev = L[lb % 8].get(s);
      if (ev) {
        if (drop) S.supersaw(t, ev[0] + tr, ev[1] * sd * 0.95, 1.15, 4600);
        else S.lead(t, ev[0] + tr, ev[1] * sd * 0.95, 1.05);
      }
    }
  },
};

// --- WELLE 20: "Kernschmelze" – Endboss, H-Moll phrygisch, 172 BPM ---
const FINAL = {
  name: 'Kernschmelze',
  bpm: 172,
  form: [['intro', 4], ['half', 8], ['B', 8], ['break', 4], ['drop', 8]],
  loopFrom: 1,
  chords: [
    chord('B1', ['B3', 'D4', 'F#4', 'B4']),
    chord('G1', ['B3', 'D4', 'G4', 'B4']),
    chord('C2', ['C4', 'E4', 'G4', 'C5']),
    chord('F#1', ['A#3', 'C#4', 'F#4', 'A#4']),
  ],
  lead: mel([
    'F#5:0:4 B5:4:4 C6:8:4 B5:12:2 A#5:14:2',
    'B5:0:4 D6:4:4 G6:8:4 F#6:12:4',
    'E6:0:4 C6:4:4 G5:8:4 C6:12:4',
    'C#6:0:4 A#5:4:4 F#5:8:4 A#5:12:4',
    'B5:0:2 D6:2:2 F#6:4:4 B6:8:4 A#6:12:4',
    'G6:0:4 F#6:4:2 D6:6:2 B5:8:4 D6:12:4',
    'C7:0:4 B6:4:2 G6:6:2 E6:8:4 C6:12:4',
    'C#7:0:8 A#6:8:4 F#6:12:4',
  ]),
  step(e) {
    const { S, sec, lb, s, t, ch, sd, x } = e;
    if (sec === 'intro') {
      // Herzschlag + Alarm
      if (s === 0 || s === 3) S.kick(t, s === 0 ? 0.9 : 0.6, 0.8);
      if (s === 0 && lb % 2 === 0) S.alarm(t, ch.bass + 36, sd * 14, 1.2);
      if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 1.2, 900);
      if (s === 0) S.metal(t, 1.1);
      if (lb === 3) S.snare(t, 0.2 + (s / 16) * 0.9);
      return;
    }
    if (sec === 'break') {
      if (s === 0) S.pad(t, ch.tones.slice(0, 3), sd * 16, 1.5, 1500);
      if (s === 0 && lb === 0) S.siren(t, ch.bass + 36, sd * 32, 1.2);
      if (s === 0 && lb === 2) S.riser(t, sd * 32, 1.5);
      if (lb >= 2) S.snare(t, lb === 2 ? (s % 2 === 0 ? 0.4 : 0) : 0.3 + (s / 16) * 0.9);
      if (lb >= 1 && s % 4 === 0) S.kick(t, 0.5 + lb * 0.15, 0.9);
      const ev = this.lead[(lb + 4) % 8].get(s);
      if (ev) S.lead(t, ev[0], ev[1] * sd * 0.95, 0.9, 2200);
      return;
    }
    if (sec === 'half') {
      // Halbes Tempo: riesig und schwer
      if (s === 0 || s === 10 || (s === 14 && lb % 2 === 1)) S.kick(t, 1.1, 1.2);
      if (s === 8) { S.snare(t, 1.2); S.clap(t, 1); S.metal(t, 0.6); }
      if (s % 2 === 0) S.hat(t, s === 6 || s === 14, 0.6 + x * 0.3);
      if (s === 0 && lb % 4 === 0) S.crash(t, 1.2);
      if (s === 0 || s === 3 || s === 6 || s === 10 || s === 12) S.bass(t, ch.bass + (s === 6 ? 12 : 0), sd * (s === 12 ? 3.5 : 2.5), 900, 1.1, true);
      if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 0.8, 1200);
      if (s % 2 === 0) {
        const seq = [0, 1, 2, 3, 2, 1, 2, 3];
        S.pluck(t, ch.tones[seq[(s / 2) % 8]] + 12, sd * 1.4, 0.6, 'sawtooth');
      }
      return;
    }
    // B und Drop: volle Geschwindigkeit, alles was geht
    const drop = sec === 'drop';
    if (s % 4 === 0 || (drop && (s === 14 || s === 15))) S.kick(t, 1.1, 1.2);
    if (s === 4 || s === 12) { S.snare(t, 1.2); S.clap(t, 1); }
    if (drop && (s === 7 || s === 10 || s === 15)) S.snare(t, 0.4);
    S.hat(t, s % 4 === 2, s % 2 === 0 ? 0.9 : 0.55);
    if (s === 0 && (lb % 4 === 0 || drop)) S.crash(t, 1.2);
    if (s === 0 && lb % 2 === 1) S.metal(t, 0.7);
    S.bass(t, ch.bass + (s % 4 === 2 ? 12 : 0), sd * 0.85, drop ? 1600 : 1200, 1, true);
    if (s % 4 === 2) S.stab(t, ch.tones.slice(0, 3), sd * 0.9, 1.3, 2400);
    if (s === 0) S.pad(t, ch.tones.slice(0, 3).map((n) => n - 12), sd * 16, 0.8, 1800);
    const seq = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2];
    S.pluck(t, ch.tones[seq[s]] + 24, sd * 0.6, 0.55);
    const ev = this.lead[lb % 8].get(s);
    if (ev) S.supersaw(t, ev[0] + (drop ? 12 : 0), ev[1] * sd * 0.95, drop ? 1.2 : 1.05, drop ? 4800 : 3800);
  },
};

export const SONGS = {
  battle: BATTLE, hyper: HYPER, blackout: BLACKOUT, overclock: OVERCLOCK,
  boss: BOSS, final: FINAL, menu: MENU, shop: SHOP,
};

// ===================== Sequencer =====================
export const music = {
  ctx: null,
  S: null,
  song: null,
  pending: null,
  nextTime: 0,
  step: 0,
  bar: 0,
  intensity: 0,
  muffled: false,
  enabled: true,

  init(ctx, out) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.S = new Synth(ctx, out);
    this.nextTime = ctx.currentTime + 0.1;
    setInterval(() => this.tick(), 25);
  },

  // Song wechseln: passiert auf dem nächsten Schlag, damit es musikalisch klingt
  play(name) {
    const target = name === 'none' ? null : SONGS[name] || null;
    if (target === this.song && !this.pending) return;
    if (this.pending && this.pending.song === target) return;
    this.pending = { song: target };
    if (!this.song) this.applyPending();
  },

  applyPending() {
    this.song = this.pending.song;
    this.pending = null;
    this.step = 0;
    this.bar = 0;
    if (this.song && this.S) {
      this.S.setDelayTime((60 / this.song.bpm) * 0.75);
      if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    }
  },

  setMuffled(on) {
    if (on === this.muffled || !this.S) { this.muffled = on; return; }
    this.muffled = on;
    this.S.filter.frequency.setTargetAtTime(on ? 650 : 20000, this.ctx.currentTime, 0.12);
  },

  setIntensity(x) { this.intensity = x; },

  section() {
    const song = this.song;
    let b = this.bar;
    const total = song.form.reduce((a, f) => a + f[1], 0);
    if (b >= total) {
      const loopStart = song.form.slice(0, song.loopFrom).reduce((a, f) => a + f[1], 0);
      b = loopStart + ((b - loopStart) % (total - loopStart));
    }
    for (const [name, len] of song.form) {
      if (b < len) return [name, b];
      b -= len;
    }
    return [song.form[0][0], 0];
  },

  tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.pending && this.step % 4 === 0) this.applyPending();
      if (!this.song) { this.nextTime = ctx.currentTime + 0.1; return; }
      const song = this.song;
      const sd = 60 / song.bpm / 4;
      const swing = song.swing && this.step % 2 === 1 ? sd * song.swing : 0;
      if (this.enabled) {
        const [sec, lb] = this.section();
        let ch = song.chords[this.bar % song.chords.length];
        const tr = song.transpose ? song.transpose(sec) : 0;
        if (tr) ch = { ...ch, bass: ch.bass + tr, tones: ch.tones.map((n) => n + tr) };
        try {
          song.step({ S: this.S, sec, lb, s: this.step, t: this.nextTime + swing, ch, sd, x: this.intensity, tr });
        } catch (_) { /* ein fehlerhafter Ton darf die Musik nicht stoppen */ }
      }
      this.nextTime += sd;
      this.step++;
      if (this.step >= 16) { this.step = 0; this.bar++; }
    }
  },
};
