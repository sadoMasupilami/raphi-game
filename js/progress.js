// Fortschritt über mehrere Runden: Erfolge, Freischaltungen, Logbuch, Gesamtstatistik
import { REACTIONS, CHARACTERS } from './data.js';

export const ACHIEVEMENTS = [
  { id: 'firstWave', icon: '🌱', name: 'Erste Schritte', desc: 'Überlebe die erste Welle.' },
  { id: 'guardian', icon: '🛡️', name: 'Wächter-Bezwinger', desc: 'Besiege den WÄCHTER in Welle 10.', unlocks: 'kai' },
  { id: 'melee10', icon: '⚔️', name: 'Klingentanz', desc: 'Überlebe Welle 10 mit VEX oder BROCK.', unlocks: 'ronin' },
  { id: 'allReactions', icon: '🧪', name: 'Elementar-Meister', desc: 'Entdecke alle 6 Reaktionen.', unlocks: 'prisma' },
  { id: 'mother', icon: '🐛', name: 'Kammerjäger', desc: 'Besiege die SCHWARM-MUTTER.' },
  { id: 'titan', icon: '🗿', name: 'Titanenfall', desc: 'Besiege den LASER-TITAN.' },
  { id: 'kills500', icon: '🔥', name: 'Maschinenschredder', desc: 'Besiege 500 Gegner in einer einzigen Runde.', unlocks: 'zero' },
  { id: 'runs10', icon: '🔁', name: 'Stammgast', desc: 'Spiele 10 Runden.', unlocks: 'glitch' },
  { id: 'bossrush', icon: '💀', name: 'Boss-Bezwinger', desc: 'Schaffe den Boss-Rush.' },
  { id: 'timeattack', icon: '⏱️', name: 'Sprinter', desc: 'Besiege im Zeitangriff 400 Gegner.' },
  { id: 'daily', icon: '📅', name: 'Tagesform', desc: 'Schaffe Welle 10 in einer täglichen Herausforderung.' },
  { id: 'win', icon: '🏆', name: 'Retter der Stadt', desc: 'Besiege den OMEGA-KERN.' },
  { id: 'winHard', icon: '👑', name: 'Legende', desc: 'Gewinne auf Schwer.' },
  { id: 'tier4', icon: '⚒️', name: 'Meisterschmied', desc: 'Schmiede eine Waffe der Stufe IV.' },
  { id: 'fullHouse', icon: '🔫', name: 'Waffenarsenal', desc: 'Trage 6 Waffen gleichzeitig.', unlocks: 'hydra' },
  { id: 'reactions100', icon: '⚡', name: 'Kettenreaktion', desc: 'Löse 100 Reaktionen in einer Runde aus.' },
  { id: 'rich', icon: '💰', name: 'Krösus', desc: 'Besitze 500 Credits auf einmal.' },
  { id: 'kills1000', icon: '💀', name: 'Maschinenbrecher', desc: 'Besiege insgesamt 1000 Gegner.' },
  { id: 'endless25', icon: '♾️', name: 'Unaufhaltsam', desc: 'Erreiche Welle 25 im Endlos-Modus.' },
  { id: 'allChars', icon: '👥', name: 'Crew komplett', desc: 'Spiele mit allen 10 Charakteren.' },
];

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Vorlagen für tägliche Missionen (r(n) = Zufallszahl 0..n-1, für alle am selben Tag gleich)
const MISSION_TYPES = [
  { type: 'kills', make: (r) => { const n = [150, 250, 400][r(3)]; return { target: n, text: `Besiege ${n} Gegner`, reward: Math.round(n / 16) }; } },
  { type: 'reaction', make: (r) => { const keys = Object.keys(REACTIONS); const k = keys[r(keys.length)]; const n = [10, 20, 30][r(3)]; return { param: k, target: n, text: `Löse ${n}× ${REACTIONS[k].name} aus`, reward: 12 + n / 2 }; } },
  { type: 'wave', make: (r) => { const n = [6, 8, 10, 12][r(4)]; return { target: n, text: `Erreiche Welle ${n} (Kampagne)`, reward: n * 2 }; } },
  { type: 'char', make: (r, chars) => { const c = chars[r(chars.length)]; return { param: c.id, target: 1, text: `Schaffe 3 Wellen mit ${c.name}`, reward: 14 }; } },
  { type: 'ult', make: (r) => { const n = [3, 5, 8][r(3)]; return { target: n, text: `Setze ${n}× deine Ultimate ein`, reward: 8 + n * 2 }; } },
  { type: 'boss', make: () => ({ target: 1, text: 'Besiege einen Boss', reward: 20 }) },
  { type: 'items', make: (r) => { const n = [6, 10][r(2)]; return { target: n, text: `Sammle ${n} Items`, reward: 8 + n }; } },
  { type: 'evolve', make: () => ({ target: 1, text: 'Schmiede eine legendäre Waffe', reward: 30 }) },
];

export function defaultProgress() {
  return {
    achievements: {},
    seen: { weapons: {}, reactions: {}, enemies: {}, items: {} },
    totals: { runs: 0, kills: 0, wins: 0, reactions: 0, playTime: 0, bosses: 0, shards: 0 },
    best: { kills: 0, wave: 0, score: 0 },
    weaponWaves: {},
    dmgByElem: {},
    history: [],
    played: {},
  };
}

export function normalizeProgress(p) {
  const d = defaultProgress();
  if (!p) return d;
  return {
    achievements: { ...(p.achievements || {}) },
    seen: { ...d.seen, ...(p.seen || {}) },
    totals: { ...d.totals, ...(p.totals || {}) },
    best: { ...d.best, ...(p.best || {}) },
    weaponWaves: { ...(p.weaponWaves || {}) },
    dmgByElem: { ...(p.dmgByElem || {}) },
    history: Array.isArray(p.history) ? p.history.slice(-15) : [],
    played: { ...(p.played || {}) },
  };
}

export function isUnlocked(progress, charId) {
  const ach = ACHIEVEMENTS.find((a) => a.unlocks === charId);
  return !ach || !!progress.achievements[ach.id];
}

// Verbindet das Spiel mit dem gespeicherten Fortschritt
export class Progress {
  constructor(store, save, notify) {
    this.store = store;
    this.save = save;
    this.notify = notify;
    this.dirty = false;
  }

  get p() { return this.store.progress; }

  // ---------- Tägliche Missionen ----------
  missions() {
    const key = todayKey();
    const st = this.store;
    if (!st.missions || st.missions.date !== key) {
      const rng = mulberry32(Number(key.replace(/-/g, '')) * 7 + 3);
      const r = (n) => Math.floor(rng() * n);
      const chars = CHARACTERS.filter((c) => isUnlocked(this.p, c.id));
      const types = MISSION_TYPES.slice();
      const list = [];
      while (list.length < 3 && types.length) {
        const t = types.splice(r(types.length), 1)[0];
        list.push({ type: t.type, progress: 0, done: false, ...t.make(r, chars) });
      }
      st.missions = { date: key, list };
      this.save();
    }
    return st.missions.list;
  }

  mission(type, amount = 1, param = null, absolute = false) {
    for (const m of this.missions()) {
      if (m.done || m.type !== type || (m.param && m.param !== param)) continue;
      m.progress = absolute ? Math.max(m.progress, amount) : m.progress + amount;
      if (m.progress >= m.target) {
        m.progress = m.target;
        m.done = true;
        this.addShards(Math.round(m.reward));
        this.notify(`🎯 Mission erfüllt: ${m.text} (+${Math.round(m.reward)} 💠)`, '#50ffc8');
      }
      this.dirty = true;
    }
  }

  addShards(n) {
    this.store.meta = this.store.meta || { shards: 0, levels: {} };
    this.store.meta.shards += n;
    this.p.totals.shards += n;
    this.save();
  }

  // Kern-Splitter für eine Runde
  shardsFor(game, win) {
    if (game.mode === 'time') return Math.floor(game.kills / 25) + game.wave;
    if (game.mode === 'bossrush') return game.bossesKilled * 12 + (win ? 30 : 0);
    return game.wave * 2 + Math.floor(game.kills / 40) + game.bossesKilled * 6 + (win ? 20 : 0);
  }

  unlock(id) {
    if (this.p.achievements[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.p.achievements[id] = Date.now();
    this.notify(`${a.icon} Erfolg: ${a.name}`, '#ffd740');
    if (a.unlocks) {
      const c = CHARACTERS.find((x) => x.id === a.unlocks);
      if (c) setTimeout(() => this.notify(`🔓 Neuer Charakter: ${c.name}`, c.color), 900);
    }
    this.save();
  }

  // Ereignisse aus dem Spiel
  event(game, type, data) {
    const seen = this.p.seen;
    switch (type) {
      case 'kill':
        this.killBuf = (this.killBuf || 0) + 1;
        if (this.killBuf >= 10) { this.mission('kills', this.killBuf); this.killBuf = 0; }
        break;
      case 'ult':
        this.mission('ult');
        break;
      case 'evolve':
        this.mission('evolve');
        break;
      case 'reaction':
        this.mission('reaction', 1, data);
        seen.reactions[data] = (seen.reactions[data] || 0) + 1;
        this.p.totals.reactions++;
        this.dirty = true;
        if (Object.keys(REACTIONS).every((k) => seen.reactions[k])) this.unlock('allReactions');
        if (game.reactionCount >= 100) this.unlock('reactions100');
        break;
      case 'enemy':
        if (!seen.enemies[data]) { seen.enemies[data] = true; this.dirty = true; }
        break;
      case 'item':
        this.mission('items');
        if (!seen.items[data]) { seen.items[data] = true; this.dirty = true; }
        break;
      case 'weapon':
        if (!seen.weapons[data.id]) { seen.weapons[data.id] = true; this.dirty = true; }
        if (data.tier >= 3) this.unlock('tier4');
        if (game.weapons.length >= 6) this.unlock('fullHouse');
        break;
      case 'boss':
        this.mission('boss');
        this.p.totals.bosses++;
        if (data === 'guardian') this.unlock('guardian');
        if (data === 'mother') this.unlock('mother');
        if (data === 'titan') this.unlock('titan');
        if (data === 'omega') {
          this.unlock('win');
          if (game.diffId === 'schwer') this.unlock('winHard');
        }
        break;
      default:
        break;
    }
  }

  waveEnd(game) {
    if (game.wave >= 1) this.unlock('firstWave');
    if (game.mode === 'campaign') this.mission('wave', game.wave, null, true);
    if (game.wave >= 3 || game.mode === 'bossrush') this.mission('char', 1, game.char.id);
    if (this.killBuf) { this.mission('kills', this.killBuf); this.killBuf = 0; }
    if (game.wave >= 10 && (game.char.id === 'vex' || game.char.id === 'brock')) this.unlock('melee10');
    if (game.endless && game.wave >= 25) this.unlock('endless25');
    if (game.kills >= 500) this.unlock('kills500');
    if (game.mode === 'daily' && game.wave >= 10) this.unlock('daily');
    this.checkCredits(game);
    this.flush();
  }

  checkCredits(game) {
    if (game.credits >= 500) this.unlock('rich');
  }

  runEnd(game, win) {
    const t = this.p.totals;
    const P = this.p;
    if (this.killBuf) { this.mission('kills', this.killBuf); this.killBuf = 0; }
    // Kern-Splitter (bei Endlos-Fortsetzung nur den Zuwachs)
    const shards = this.shardsFor(game, win);
    const gain = Math.max(0, shards - (game.shardsGiven || 0));
    game.shardsGiven = shards;
    game.lastShardGain = gain;
    if (gain) this.addShards(gain);
    // Statistik
    t.playTime += game.time - (game.recordedTime || 0);
    game.recordedTime = game.time;
    P.best.kills = Math.max(P.best.kills, game.kills);
    P.best.score = Math.max(P.best.score, game.score);
    if (game.mode !== 'time') P.best.wave = Math.max(P.best.wave, game.wave);
    for (const [k, v] of Object.entries(game.dmgByElem || {})) {
      const prev = (game.recordedDmg || {})[k] || 0;
      P.dmgByElem[k] = (P.dmgByElem[k] || 0) + (v - prev);
    }
    game.recordedDmg = { ...(game.dmgByElem || {}) };
    for (const [k, v] of Object.entries(game.weaponWaves || {})) {
      const prev = (game.recordedWW || {})[k] || 0;
      P.weaponWaves[k] = (P.weaponWaves[k] || 0) + (v - prev);
    }
    game.recordedWW = { ...(game.weaponWaves || {}) };
    const entry = { date: todayKey(), char: game.char.id, mode: game.mode, diff: game.diffId, wave: game.wave, kills: game.kills, score: game.score, win: !!win };
    if (game.runRecorded && P.history.length) P.history[P.history.length - 1] = entry;
    else P.history.push(entry);
    if (P.history.length > 15) P.history.shift();
    // Nach einem Sieg kann im Endlos-Modus weitergespielt werden – nicht doppelt zählen
    if (!game.runRecorded) {
      game.runRecorded = true;
      game.recordedKills = 0;
      t.runs++;
    }
    t.kills += game.kills - game.recordedKills;
    game.recordedKills = game.kills;
    if (win) t.wins++;
    this.p.played[game.char.id] = true;
    if (t.kills >= 1000) this.unlock('kills1000');
    if (t.runs >= 10) this.unlock('runs10');
    if (game.kills >= 500) this.unlock('kills500');
    if (game.mode === 'bossrush' && win) this.unlock('bossrush');
    if (game.mode === 'time' && game.kills >= 400) this.unlock('timeattack');
    if (CHARACTERS.every((c) => this.p.played[c.id])) this.unlock('allChars');
    this.save();
  }

  flush() {
    if (this.dirty) { this.dirty = false; this.save(); }
  }
}
