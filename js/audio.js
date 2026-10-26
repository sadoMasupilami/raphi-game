// Synthetisierte Soundeffekte über WebAudio (keine Audiodateien nötig), Musik siehe music.js
import { music } from './music.js';

const MUSIC_VOL = 0.55;

let ctx = null;
let master = null;
let sfxGain = null;
let musicGain = null;
let noiseBuf = null;
const last = {};

export const audio = {
  sfx: true,
  music: true,

  init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = this.sfx ? 0.5 : 0;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = this.music ? MUSIC_VOL : 0;
    musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    music.enabled = this.music;
    music.init(ctx, musicGain);
  },

  setSfx(on) {
    this.sfx = on;
    if (sfxGain) sfxGain.gain.value = on ? 0.5 : 0;
  },
  setMusic(on) {
    this.music = on;
    music.enabled = on;
    if (musicGain) musicGain.gain.value = on ? MUSIC_VOL : 0;
  },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

  play(name) {
    if (!ctx || !this.sfx || ctx.state !== 'running') return;
    const s = SOUNDS[name];
    if (!s) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < s.gap) return;
    last[name] = now;
    s.fn(now);
  },
};

function tone(t, { type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.2, attack = 0.005 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(t, { dur = 0.2, vol = 0.3, freq = 1200, q = 1, type = 'lowpass' }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SOUNDS = {
  shoot: { gap: 0.06, fn: (t) => tone(t, { type: 'square', f0: 880, f1: 320, dur: 0.07, vol: 0.05 }) },
  flame: { gap: 0.12, fn: (t) => noise(t, { dur: 0.12, vol: 0.06, freq: 2500, type: 'bandpass', q: 0.7 }) },
  zap: { gap: 0.08, fn: (t) => { tone(t, { type: 'sawtooth', f0: 1800, f1: 400, dur: 0.09, vol: 0.06 }); } },
  rail: { gap: 0.1, fn: (t) => { tone(t, { type: 'sawtooth', f0: 2400, f1: 120, dur: 0.3, vol: 0.09 }); } },
  swing: { gap: 0.07, fn: (t) => noise(t, { dur: 0.1, vol: 0.08, freq: 3000, type: 'highpass', q: 0.5 }) },
  slam: { gap: 0.1, fn: (t) => { tone(t, { type: 'sine', f0: 160, f1: 40, dur: 0.25, vol: 0.25 }); noise(t, { dur: 0.2, vol: 0.12, freq: 800 }); } },
  dash: { gap: 0.1, fn: (t) => { noise(t, { dur: 0.18, vol: 0.12, freq: 4000, type: 'bandpass', q: 0.8 }); tone(t, { type: 'sine', f0: 300, f1: 900, dur: 0.12, vol: 0.06 }); } },
  hit: { gap: 0.04, fn: (t) => tone(t, { type: 'triangle', f0: 300, f1: 120, dur: 0.05, vol: 0.06 }) },
  kill: { gap: 0.05, fn: (t) => noise(t, { dur: 0.12, vol: 0.08, freq: 1800 }) },
  boom: { gap: 0.08, fn: (t) => { noise(t, { dur: 0.4, vol: 0.3, freq: 900 }); tone(t, { type: 'sine', f0: 120, f1: 35, dur: 0.35, vol: 0.25 }); } },
  reaction: { gap: 0.1, fn: (t) => { tone(t, { type: 'sawtooth', f0: 220, f1: 880, dur: 0.18, vol: 0.08 }); tone(t + 0.04, { type: 'square', f0: 660, f1: 1320, dur: 0.12, vol: 0.05 }); } },
  pickup: { gap: 0.045, fn: (t) => tone(t, { type: 'sine', f0: 1200 + Math.random() * 300, f1: 1900, dur: 0.06, vol: 0.05 }) },
  heal: { gap: 0.2, fn: (t) => { tone(t, { type: 'sine', f0: 500, f1: 1000, dur: 0.2, vol: 0.12 }); } },
  hurt: { gap: 0.15, fn: (t) => { tone(t, { type: 'square', f0: 200, f1: 60, dur: 0.2, vol: 0.15 }); noise(t, { dur: 0.15, vol: 0.12, freq: 600 }); } },
  shield: { gap: 0.2, fn: (t) => tone(t, { type: 'triangle', f0: 1400, f1: 700, dur: 0.2, vol: 0.12 }) },
  levelup: { gap: 0.3, fn: (t) => { [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.07, { type: 'square', f0: f, dur: 0.12, vol: 0.08 })); } },
  buy: { gap: 0.1, fn: (t) => { tone(t, { type: 'square', f0: 880, dur: 0.06, vol: 0.07 }); tone(t + 0.06, { type: 'square', f0: 1320, dur: 0.08, vol: 0.07 }); } },
  click: { gap: 0.05, fn: (t) => tone(t, { type: 'square', f0: 660, dur: 0.04, vol: 0.05 }) },
  error: { gap: 0.15, fn: (t) => tone(t, { type: 'square', f0: 160, f1: 120, dur: 0.15, vol: 0.08 }) },
  wave: { gap: 0.5, fn: (t) => { [392, 523, 659].forEach((f, i) => tone(t + i * 0.1, { type: 'sawtooth', f0: f, dur: 0.18, vol: 0.06 })); } },
  bossWarn: { gap: 1, fn: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.35, { type: 'sawtooth', f0: 110, f1: 90, dur: 0.3, vol: 0.18 }); } },
  enemyShot: { gap: 0.1, fn: (t) => tone(t, { type: 'triangle', f0: 500, f1: 250, dur: 0.08, vol: 0.04 }) },
  gameover: { gap: 1, fn: (t) => { [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.18, { type: 'square', f0: f, dur: 0.25, vol: 0.1 })); } },
  win: { gap: 1, fn: (t) => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(t + i * 0.12, { type: 'square', f0: f, dur: 0.2, vol: 0.09 })); } },
};
