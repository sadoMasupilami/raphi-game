// Fortschritt über mehrere Runden: Erfolge, Freischaltungen, Logbuch, Gesamtstatistik
import { REACTIONS, CHARACTERS } from './data.js';

export const ACHIEVEMENTS = [
  { id: 'firstWave', icon: '🌱', name: 'Erste Schritte', desc: 'Überlebe die erste Welle.' },
  { id: 'guardian', icon: '🛡️', name: 'Wächter-Bezwinger', desc: 'Besiege den WÄCHTER in Welle 10.', unlocks: 'kai' },
  { id: 'melee10', icon: '⚔️', name: 'Klingentanz', desc: 'Überlebe Welle 10 mit VEX oder BROCK.', unlocks: 'ronin' },
  { id: 'allReactions', icon: '🧪', name: 'Elementar-Meister', desc: 'Entdecke alle 6 Reaktionen.', unlocks: 'prisma' },
  { id: 'win', icon: '🏆', name: 'Retter der Stadt', desc: 'Besiege den OMEGA-KERN.' },
  { id: 'winHard', icon: '👑', name: 'Legende', desc: 'Gewinne auf Schwer.' },
  { id: 'tier4', icon: '⚒️', name: 'Meisterschmied', desc: 'Schmiede eine Waffe der Stufe IV.' },
  { id: 'fullHouse', icon: '🔫', name: 'Waffenarsenal', desc: 'Trage 6 Waffen gleichzeitig.' },
  { id: 'reactions100', icon: '⚡', name: 'Kettenreaktion', desc: 'Löse 100 Reaktionen in einer Runde aus.' },
  { id: 'rich', icon: '💰', name: 'Krösus', desc: 'Besitze 500 Credits auf einmal.' },
  { id: 'kills1000', icon: '💀', name: 'Maschinenbrecher', desc: 'Besiege insgesamt 1000 Gegner.' },
  { id: 'endless25', icon: '♾️', name: 'Unaufhaltsam', desc: 'Erreiche Welle 25 im Endlos-Modus.' },
  { id: 'allChars', icon: '👥', name: 'Crew komplett', desc: 'Spiele mit allen 7 Charakteren.' },
];

export function defaultProgress() {
  return {
    achievements: {},
    seen: { weapons: {}, reactions: {}, enemies: {}, items: {} },
    totals: { runs: 0, kills: 0, wins: 0, reactions: 0 },
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
      case 'reaction':
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
        if (!seen.items[data]) { seen.items[data] = true; this.dirty = true; }
        break;
      case 'weapon':
        if (!seen.weapons[data.id]) { seen.weapons[data.id] = true; this.dirty = true; }
        if (data.tier >= 3) this.unlock('tier4');
        if (game.weapons.length >= 6) this.unlock('fullHouse');
        break;
      case 'boss':
        if (data === 'guardian') this.unlock('guardian');
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
    if (game.wave >= 10 && (game.char.id === 'vex' || game.char.id === 'brock')) this.unlock('melee10');
    if (game.endless && game.wave >= 25) this.unlock('endless25');
    this.checkCredits(game);
    this.flush();
  }

  checkCredits(game) {
    if (game.credits >= 500) this.unlock('rich');
  }

  runEnd(game, win) {
    const t = this.p.totals;
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
    if (CHARACTERS.every((c) => this.p.played[c.id])) this.unlock('allChars');
    this.save();
  }

  flush() {
    if (this.dirty) { this.dirty = false; this.save(); }
  }
}
