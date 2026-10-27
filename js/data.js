// Spieldaten: Elemente, Reaktionen, Waffen, Items, Charaktere, Gegner, Schwierigkeit

export const ELEMENTS = {
  fire: { name: 'Feuer', color: '#ff6a2a', icon: '🔥', desc: 'Setzt Gegner in Brand (Schaden über Zeit).' },
  ice: { name: 'Eis', color: '#5fe3ff', icon: '❄️', desc: 'Verlangsamt Gegner. Genug Kälte friert sie ein.' },
  bolt: { name: 'Blitz', color: '#ffe94a', icon: '⚡', desc: 'Geschockte Gegner nehmen mehr Schaden. Blitze springen weiter.' },
  void: { name: 'Void', color: '#b45cff', icon: '🌀', desc: 'Nano-Korrosion stapelt sich und frisst Gegner auf.' },
};
export const ELEMENT_ORDER = ['fire', 'ice', 'bolt', 'void'];

export const reactionKey = (a, b) =>
  ELEMENT_ORDER.indexOf(a) < ELEMENT_ORDER.indexOf(b) ? `${a}+${b}` : `${b}+${a}`;

export const REACTIONS = {
  'fire+ice': { name: 'DAMPFEXPLOSION', color: '#e8f6ff', desc: 'Explosion, die alle Gegner in der Nähe trifft.' },
  'fire+bolt': { name: 'ÜBERLADUNG', color: '#ffb340', desc: 'Große Explosion, die Gegner wegschleudert.' },
  'fire+void': { name: 'FLÄCHENBRAND', color: '#ff4fa0', desc: 'Brand und Korrosion springen auf Gegner in der Nähe über.' },
  'ice+bolt': { name: 'SUPRALEITER', color: '#9dfcff', desc: 'Kettenblitz, der alle Getroffenen einfriert.' },
  'ice+void': { name: 'ZERSPLITTERN', color: '#c9b8ff', desc: 'Riesiger Einzelschaden, zusätzlich % der Max-HP.' },
  'bolt+void': { name: 'SINGULARITÄT', color: '#d58cff', desc: 'Ein Mini-Schwarzloch saugt Gegner an und zermalmt sie.' },
};

export const TIER_COLORS = ['#cfd8e3', '#4da3ff', '#c86bff', '#ff4d5e'];
export const TIER_NAMES = ['Stufe I', 'Stufe II', 'Stufe III', 'Stufe IV'];
export const TIER_PRICE = [1, 2, 3.8, 7];

// Waffen: Werte pro Stufe [I, II, III, IV]
export const WEAPONS = {
  // ---------- FEUER ----------
  plasmaBlaster: {
    name: 'Plasma-Blaster', elem: 'fire', type: 'ranged', kind: 'bullet', price: 18,
    dmg: [7, 11, 17, 26], cd: [0.85, 0.75, 0.66, 0.56], range: 360, scale: 1, speed: 720,
    pierce: [0, 0, 1, 1], burn: [3, 5, 8, 13], knock: 40,
    desc: 'Feuert Plasmakugeln, die Gegner in Brand setzen.',
  },
  flammenwerfer: {
    name: 'Flammenwerfer', elem: 'fire', type: 'ranged', kind: 'flame', price: 22,
    dmg: [2, 3, 5, 8], cd: [0.2, 0.18, 0.16, 0.14], range: 170, scale: 0.4, speed: 420,
    pierce: [2, 3, 3, 4], burn: [4, 7, 11, 17], knock: 5,
    desc: 'Kurze Reichweite, aber ein Dauerstrahl aus Flammen.',
  },
  plasmaKlinge: {
    name: 'Plasma-Klinge', elem: 'fire', type: 'melee', kind: 'sweep', price: 18,
    dmg: [13, 20, 30, 46], cd: [0.8, 0.74, 0.68, 0.6], range: 105, scale: 1, arc: 1.9,
    burn: [3, 5, 8, 13], knock: 90,
    desc: 'Schwingt eine glühende Klinge im weiten Bogen.',
  },
  napalmWerfer: {
    name: 'Napalm-Werfer', elem: 'fire', type: 'ranged', kind: 'puddle', price: 26,
    dmg: [5, 8, 12, 18], cd: [2.2, 2.0, 1.8, 1.6], range: 320, scale: 0.5, aoe: [50, 58, 66, 76],
    burn: [4, 6, 9, 14], knock: 0, dur: 3,
    desc: 'Wirft Napalm, das den Boden in Brand setzt.',
  },
  // ---------- EIS ----------
  kryoGewehr: {
    name: 'Kryo-Gewehr', elem: 'ice', type: 'ranged', kind: 'bullet', price: 20,
    dmg: [10, 15, 23, 35], cd: [1.05, 0.95, 0.85, 0.75], range: 430, scale: 1, speed: 950,
    pierce: [1, 2, 2, 3], chill: [1, 1, 2, 2], knock: 30,
    desc: 'Eissplitter durchschlagen mehrere Gegner und kühlen sie ab.',
  },
  frostMoerser: {
    name: 'Frost-Mörser', elem: 'ice', type: 'ranged', kind: 'mortar', price: 26,
    dmg: [12, 18, 27, 41], cd: [1.8, 1.65, 1.5, 1.3], range: 340, scale: 0.8, aoe: [55, 62, 70, 80],
    chill: [2, 2, 3, 3], knock: 60,
    desc: 'Feuert Frostgranaten, die in einem Bereich explodieren.',
  },
  kryoHammer: {
    name: 'Kryo-Hammer', elem: 'ice', type: 'melee', kind: 'slam', price: 22,
    dmg: [20, 30, 45, 68], cd: [1.35, 1.25, 1.12, 1.0], range: 125, scale: 1.2, aoe: [52, 58, 66, 76],
    chill: [2, 2, 3, 3], knock: 120,
    desc: 'Zertrümmert den Boden und kühlt alle Gegner ringsum.',
  },
  frostSplitter: {
    name: 'Frost-Splitter', elem: 'ice', type: 'melee', kind: 'orbit', price: 24,
    dmg: [6, 9, 14, 21], cd: [0.5, 0.45, 0.4, 0.35], range: 68, scale: 0.7, count: [2, 3, 3, 4],
    chill: [1, 1, 2, 2], knock: 30,
    desc: 'Eissplitter kreisen um dich und treffen alles, was ihnen zu nahe kommt.',
  },
  // ---------- BLITZ ----------
  teslaSpule: {
    name: 'Tesla-Spule', elem: 'bolt', type: 'ranged', kind: 'chain', price: 20,
    dmg: [7, 11, 16, 24], cd: [1.0, 0.9, 0.8, 0.7], range: 290, scale: 0.8, chain: [2, 3, 4, 5],
    knock: 10,
    desc: 'Blitze springen von Gegner zu Gegner.',
  },
  railgun: {
    name: 'Railgun', elem: 'bolt', type: 'ranged', kind: 'beam', price: 28,
    dmg: [24, 38, 58, 88], cd: [2.1, 1.9, 1.7, 1.45], range: 560, scale: 1.5, width: 12,
    knock: 70,
    desc: 'Ein Hochenergie-Strahl, der alles in einer Linie durchschlägt.',
  },
  stromlanze: {
    name: 'Stromlanze', elem: 'bolt', type: 'melee', kind: 'thrust', price: 18,
    dmg: [11, 17, 25, 38], cd: [0.6, 0.54, 0.48, 0.42], range: 145, scale: 1, width: 22,
    chain: [1, 1, 2, 2], knock: 60,
    desc: 'Schnelle Stöße. Der Strom springt auf Gegner in der Nähe über.',
  },
  blitzDrohne: {
    name: 'Blitz-Drohne', elem: 'bolt', type: 'ranged', kind: 'drone', price: 24,
    dmg: [6, 9, 13, 20], cd: [0.7, 0.62, 0.55, 0.48], range: 230, scale: 0.6, chain: [0, 1, 1, 2],
    knock: 5,
    desc: 'Eine Kampfdrohne fliegt um dich herum und schießt Blitze.',
  },
  // ---------- VOID ----------
  nanoSchwarm: {
    name: 'Nano-Schwarm', elem: 'void', type: 'ranged', kind: 'homing', price: 22,
    dmg: [5, 8, 12, 18], cd: [1.15, 1.05, 0.95, 0.85], range: 400, scale: 0.6, speed: 380,
    count: [2, 2, 3, 4], voidStacks: [1, 1, 2, 2], knock: 15,
    desc: 'Sucht-Nanobots, die Gegner automatisch verfolgen.',
  },
  voidWerfer: {
    name: 'Void-Werfer', elem: 'void', type: 'ranged', kind: 'orb', price: 25,
    dmg: [13, 20, 30, 45], cd: [1.6, 1.5, 1.38, 1.2], range: 330, scale: 1, speed: 260, aoe: [65, 72, 80, 92],
    voidStacks: [2, 2, 3, 4], knock: 40,
    desc: 'Langsame Void-Kugel, die beim Aufprall explodiert.',
  },
  voidSense: {
    name: 'Void-Sense', elem: 'void', type: 'melee', kind: 'sweep', price: 24,
    dmg: [16, 25, 37, 56], cd: [1.05, 0.95, 0.86, 0.76], range: 125, scale: 1.1, arc: 2.7,
    voidStacks: [2, 2, 3, 3], knock: 70,
    desc: 'Riesiger Sensenschwung, der viele Gegner auf einmal trifft.',
  },
  gravBumerang: {
    name: 'Gravitations-Bumerang', elem: 'void', type: 'ranged', kind: 'boomerang', price: 24,
    dmg: [9, 14, 21, 32], cd: [1.4, 1.3, 1.2, 1.05], range: 260, scale: 0.9, speed: 430,
    voidStacks: [1, 2, 2, 3], knock: 20,
    desc: 'Fliegt hinaus, kommt zurück und trifft dabei alles doppelt.',
  },
};

// ---------- Legendäre Evolutionen (Stufe-IV-Waffe + passendes Item) ----------
const x4 = (v) => [v, v, v, v];
const EVO_WEAPONS = {
  sonnenklinge: {
    name: 'Sonnenklinge', elem: 'fire', type: 'melee', kind: 'sweep', price: 80, evo: true,
    dmg: x4(70), cd: x4(0.55), range: 145, scale: 1.3, arc: Math.PI * 2, burn: x4(24), knock: 110,
    desc: 'Ein glühender Rundumschlag, der alles in Brand setzt.',
  },
  sonnenKanone: {
    name: 'Sonnen-Kanone', elem: 'fire', type: 'ranged', kind: 'bullet', price: 80, evo: true,
    dmg: x4(38), cd: x4(0.45), range: 420, scale: 1.2, speed: 820, pierce: x4(2), burn: x4(18), blast: 60, knock: 60,
    desc: 'Plasmageschosse, die beim Aufprall explodieren.',
  },
  gletscherbrecher: {
    name: 'Gletscherbrecher', elem: 'ice', type: 'melee', kind: 'slam', price: 80, evo: true,
    dmg: x4(105), cd: x4(0.95), range: 150, scale: 1.5, aoe: x4(135), chill: x4(5), knock: 160,
    desc: 'Riesige Eisschockwelle, die fast alles sofort einfriert.',
  },
  nullpunkt: {
    name: 'Nullpunkt-Gewehr', elem: 'ice', type: 'ranged', kind: 'bullet', price: 80, evo: true,
    dmg: x4(62), cd: x4(0.55), range: 560, scale: 1.3, speed: 1400, pierce: x4(8), chill: x4(3), knock: 40,
    desc: 'Absolute Kälte, die durch ganze Horden schlägt.',
  },
  gewittersturm: {
    name: 'Gewittersturm', elem: 'bolt', type: 'ranged', kind: 'chain', price: 80, evo: true,
    dmg: x4(36), cd: x4(0.5), range: 360, scale: 1, chain: x4(12), knock: 20,
    desc: 'Blitze springen auf bis zu 13 Gegner gleichzeitig.',
  },
  ionenLanze: {
    name: 'Ionen-Lanze', elem: 'bolt', type: 'ranged', kind: 'beam', price: 80, evo: true,
    dmg: x4(150), cd: x4(1.05), range: 720, scale: 2, width: 34, knock: 90,
    desc: 'Ein armdicker Energiestrahl quer über die Arena.',
  },
  seuchenSchwarm: {
    name: 'Seuchen-Schwarm', elem: 'void', type: 'ranged', kind: 'homing', price: 80, evo: true,
    dmg: x4(26), cd: x4(0.7), range: 460, scale: 0.9, speed: 430, count: x4(7), voidStacks: x4(4), knock: 20,
    desc: 'Ein ganzer Schwarm Nanobots, der Gegner zerfrisst.',
  },
  seelenernte: {
    name: 'Seelenernte', elem: 'void', type: 'melee', kind: 'sweep', price: 80, evo: true,
    dmg: x4(85), cd: x4(0.7), range: 150, scale: 1.4, arc: 3.8, voidStacks: x4(4), drain: true, knock: 90,
    desc: 'Riesige Sense, jeder Treffer heilt dich.',
  },
};
Object.assign(WEAPONS, EVO_WEAPONS);

export const EVOLUTIONS = [
  { weapon: 'plasmaKlinge', item: 'brennstoff', into: 'sonnenklinge' },
  { weapon: 'plasmaBlaster', item: 'overclock', into: 'sonnenKanone' },
  { weapon: 'kryoHammer', item: 'kryoKond', into: 'gletscherbrecher' },
  { weapon: 'kryoGewehr', item: 'zielChip', into: 'nullpunkt' },
  { weapon: 'teslaSpule', item: 'teslaVerst', into: 'gewittersturm' },
  { weapon: 'railgun', item: 'optik', into: 'ionenLanze' },
  { weapon: 'nanoSchwarm', item: 'voidReso', into: 'seuchenSchwarm' },
  { weapon: 'voidSense', item: 'vampir', into: 'seelenernte' },
];
export const EVO_COLOR = '#ffd740';

// ---------- Ultimate-Fähigkeiten (laden sich durch Kills auf) ----------
export const ULTS = {
  vex: { name: 'KLINGENSTURM', icon: '🌪️', desc: '4 s lang kreisen glühende Klingen um dich und zerfetzen alles.' },
  nyx: { name: 'EMP-SCHLAG', icon: '⚡', desc: 'Ein Blitz trifft bis zu 30 Gegner und lähmt sie.' },
  brock: { name: 'ERDBEBEN', icon: '🌋', desc: 'Drei Eis-Schockwellen frieren alles ringsum ein.' },
  echo: { name: 'SCHATTENSCHWARM', icon: '🌑', desc: '6 s lang feuerst du unentwegt Void-Geschosse.' },
  ronin: { name: 'BLUTRAUSCH', icon: '🩸', desc: '6 s doppeltes Angriffstempo, +50% Schaden, sofort 40% Heilung.' },
  kai: { name: 'DROHNENSCHWARM', icon: '🛸', desc: '8 s lang kämpfen 6 Extra-Drohnen für dich.' },
  prisma: { name: 'PRISMA-NOVA', icon: '🌈', desc: 'Alle 4 Elemente treffen gleichzeitig alles in der Nähe.' },
};

// Status-Effekte der Element-Waffen ohne eigenen Wert
export const BOLT_SHOCK_TIME = 2.2;   // Sekunden geschockt
export const SHOCK_BONUS = 0.2;       // +20 % Schaden auf geschockte Gegner

// Werte des Spielers
export const BASE_STATS = {
  dashCdr: 0,
  maxHp: 25, regen: 0, lifesteal: 0, dmg: 0, melee: 0, ranged: 0, elem: 0,
  atkSpd: 0, crit: 5, range: 0, armor: 0, dodge: 0, speed: 0, luck: 0, harvest: 0, magnet: 0,
  // Spezialwerte
  burnMult: 0, freezeStacks: 5, chainBonus: 0, voidMax: 8, voidMult: 0, reactionMult: 0, shield: 0,
  detonator: 0, prism: 0, lastStand: 0, interest: 0, dashDmg: 0, magnetPulse: 0, thorns: 0,
};

export const STAT_DEFS = [
  { key: 'maxHp', name: 'Max. HP', icon: '❤️' },
  { key: 'regen', name: 'HP-Regeneration', icon: '➕' },
  { key: 'lifesteal', name: 'Lebensraub', icon: '🩸', pct: true },
  { key: 'dmg', name: 'Schaden', icon: '💥', pct: true },
  { key: 'melee', name: 'Nahkampfschaden', icon: '🗡️' },
  { key: 'ranged', name: 'Fernkampfschaden', icon: '🎯' },
  { key: 'elem', name: 'Elementarschaden', icon: '✨', pct: true },
  { key: 'atkSpd', name: 'Angriffstempo', icon: '⏩', pct: true },
  { key: 'crit', name: 'Krit-Chance', icon: '🎲', pct: true },
  { key: 'range', name: 'Reichweite', icon: '📡' },
  { key: 'armor', name: 'Rüstung', icon: '🛡️' },
  { key: 'dodge', name: 'Ausweichen', icon: '💨', pct: true },
  { key: 'speed', name: 'Tempo', icon: '👟', pct: true },
  { key: 'luck', name: 'Glück', icon: '🍀' },
  { key: 'harvest', name: 'Ernte', icon: '💾' },
];

export const SPECIAL_DEFS = {
  magnet: (v) => `+${v}% Sammelradius`,
  burnMult: (v) => `+${v}% Brandschaden`,
  freezeStacks: (v) => `Einfrieren braucht ${-v} Kälte weniger`,
  chainBonus: (v) => `+${v} Blitzsprung`,
  voidMax: (v) => `+${v} max. Korrosions-Stapel`,
  voidMult: (v) => `+${v}% Korrosionsschaden`,
  reactionMult: (v) => `+${v}% Reaktionsschaden`,
  shield: () => `Energieschild blockt alle 7 s einen Treffer`,
  dashCdr: (v) => `−${v}% Dash-Abklingzeit`,
  dashDmg: () => `Dash verletzt Gegner, durch die du fliegst`,
  detonator: (v) => `Jeder 8. Kill löst eine Explosion aus${v > 1 ? ` (×${v} Schaden)` : ''}`,
  prism: () => `Krits wenden zusätzlich ein zufälliges Element an`,
  lastStand: () => `Überlebe einmal pro Welle einen tödlichen Treffer`,
  interest: (v) => `${v}% Zinsen auf Credits am Wellenende`,
  magnetPulse: () => `Alle 8 s werden alle Chips angezogen`,
  thorns: (v) => `Dornen: Angreifer erleiden ${v}× Rückschaden`,
};

// Level-Up-Werte pro Stufe
export const UPGRADES = [
  { key: 'maxHp', vals: [3, 6, 9, 12] },
  { key: 'regen', vals: [1, 2, 3, 4] },
  { key: 'lifesteal', vals: [1, 2, 3, 4] },
  { key: 'dmg', vals: [5, 8, 12, 16] },
  { key: 'melee', vals: [1, 2, 3, 4] },
  { key: 'ranged', vals: [1, 2, 3, 4] },
  { key: 'elem', vals: [6, 10, 15, 20] },
  { key: 'atkSpd', vals: [5, 10, 15, 20] },
  { key: 'crit', vals: [3, 5, 7, 9] },
  { key: 'range', vals: [15, 30, 45, 60] },
  { key: 'armor', vals: [1, 2, 3, 4] },
  { key: 'dodge', vals: [3, 6, 9, 12] },
  { key: 'speed', vals: [3, 6, 9, 12] },
  { key: 'luck', vals: [5, 10, 15, 20] },
  { key: 'harvest', vals: [3, 5, 8, 10] },
];

// Items (tier = 0..3)
export const ITEMS = {
  nanoPanzer: { name: 'Nano-Panzerung', icon: '🛡️', tier: 0, price: 22, stats: { armor: 2 } },
  repBots: { name: 'Reparatur-Nanobots', icon: '🔧', tier: 0, price: 22, stats: { regen: 2 } },
  huelle: { name: 'Verstärkte Hülle', icon: '❤️', tier: 0, price: 18, stats: { maxHp: 7 } },
  servos: { name: 'Turbo-Servos', icon: '👟', tier: 0, price: 20, stats: { speed: 8 } },
  zielChip: { name: 'Zielsucher-Chip', icon: '🎯', tier: 0, price: 22, stats: { crit: 5 } },
  stimulans: { name: 'Kampf-Stimulans', icon: '💉', tier: 0, price: 22, stats: { atkSpd: 9, maxHp: -2 } },
  kraftVerst: { name: 'Kraftverstärker', icon: '🦾', tier: 0, price: 20, stats: { melee: 2 } },
  optik: { name: 'Präzisionsoptik', icon: '🔭', tier: 0, price: 20, stats: { ranged: 2 } },
  datenMagnet: { name: 'Datenmagnet', icon: '🧲', tier: 0, price: 14, stats: { magnet: 40 } },
  gluecksModul: { name: 'Glücksmodul', icon: '🍀', tier: 0, price: 18, stats: { luck: 12 } },
  creditMiner: { name: 'Credit-Miner', icon: '💾', tier: 0, price: 22, stats: { harvest: 6 } },
  plasmaKern: { name: 'Plasmakern', icon: '✨', tier: 1, price: 40, stats: { elem: 15 } },
  holoTarnung: { name: 'Holo-Tarnung', icon: '👻', tier: 1, price: 40, stats: { dodge: 7 } },
  vampir: { name: 'Vampir-Implantat', icon: '🩸', tier: 1, price: 42, stats: { lifesteal: 5 } },
  teleskop: { name: 'Teleskop-Arme', icon: '📡', tier: 1, price: 38, stats: { range: 40 } },
  overclock: { name: 'Overclock', icon: '🔥', tier: 1, price: 45, stats: { dmg: 15, armor: -2 } },
  titan: { name: 'Titan-Skelett', icon: '🦴', tier: 1, price: 42, stats: { maxHp: 18, speed: -4 } },
  brennstoff: { name: 'Brennstoffzelle', icon: '🔥', tier: 2, price: 60, stats: { burnMult: 60, elem: 5 } },
  kryoKond: { name: 'Kryo-Kondensator', icon: '❄️', tier: 2, price: 60, stats: { freezeStacks: -2, elem: 5 }, max: 1 },
  teslaVerst: { name: 'Tesla-Verstärker', icon: '⚡', tier: 2, price: 62, stats: { chainBonus: 1, elem: 5 } },
  voidReso: { name: 'Void-Resonator', icon: '🌀', tier: 2, price: 60, stats: { voidMax: 5, voidMult: 40 } },
  katalysator: { name: 'Reaktor-Katalysator', icon: '⚗️', tier: 2, price: 65, stats: { reactionMult: 60 } },
  schild: { name: 'Schildgenerator', icon: '🔰', tier: 2, price: 70, stats: { shield: 1 }, max: 1 },
  phasenDash: { name: 'Phasen-Dash', icon: '💨', tier: 1, price: 38, stats: { dashCdr: 25, dashDmg: 1 } },
  magnetPuls: { name: 'Magnetfeld-Puls', icon: '🌐', tier: 1, price: 30, stats: { magnetPulse: 1 }, max: 1 },
  dornen: { name: 'Dornen-Panzer', icon: '🌵', tier: 1, price: 40, stats: { thorns: 1, armor: 1 } },
  zins: { name: 'Zins-Algorithmus', icon: '📈', tier: 1, price: 40, stats: { interest: 10 }, max: 3 },
  detonator: { name: 'Detonator-Chip', icon: '💣', tier: 2, price: 60, stats: { detonator: 1 } },
  prisma: { name: 'Prisma-Linse', icon: '🔮', tier: 2, price: 65, stats: { prism: 1, crit: 5 }, max: 1 },
  notfall: { name: 'Notfall-Protokoll', icon: '🚑', tier: 2, price: 55, stats: { lastStand: 1 }, max: 1 },
  quantenherz: { name: 'Quantenherz', icon: '💠', tier: 3, price: 105, stats: { maxHp: 25, regen: 4 } },
  gottChip: { name: 'Gottmodus-Chip', icon: '👑', tier: 3, price: 115, stats: { dmg: 22, atkSpd: 12 } },
  singKern: { name: 'Singularitäts-Kern', icon: '🕳️', tier: 3, price: 115, stats: { elem: 35, chainBonus: 1, reactionMult: 30 } },
  exoskelett: { name: 'Exo-Skelett', icon: '🤖', tier: 3, price: 100, stats: { armor: 5, melee: 4, ranged: 4 } },
};

export const CHARACTERS = [
  {
    id: 'vex', name: 'VEX', title: 'Cyborg-Klingenmeister', color: '#ff5a3c', weapon: 'plasmaKlinge',
    stats: { melee: 3, lifesteal: 6, armor: 2, ranged: -2 },
    perks: ['+3 Nahkampfschaden', '+6% Lebensraub', '+2 Rüstung', '−2 Fernkampfschaden'],
  },
  {
    id: 'nyx', name: 'NYX', title: 'Netzhackerin', color: '#ffe94a', weapon: 'teslaSpule',
    stats: { elem: 25, chainBonus: 1, maxHp: -5 },
    perks: ['+25% Elementarschaden', '+1 Blitzsprung', '−5 Max. HP'],
  },
  {
    id: 'brock', name: 'BROCK', title: 'Mech-Pilot', color: '#5fe3ff', weapon: 'kryoHammer',
    stats: { maxHp: 15, armor: 3, melee: 2, speed: -6 },
    perks: ['+15 Max. HP', '+3 Rüstung', '+2 Nahkampfschaden', '−6% Tempo'],
  },
  {
    id: 'echo', name: 'ECHO', title: 'Schatten-Android', color: '#b45cff', weapon: 'nanoSchwarm',
    stats: { speed: 12, dodge: 10, harvest: 5, magnet: 30 },
    perks: ['+12% Tempo', '+10% Ausweichen', '+5 Ernte', '+30% Sammelradius'],
  },
  {
    id: 'ronin', name: 'RONIN', title: 'Berserker', color: '#ff2b6a', weapon: 'stromlanze',
    stats: { melee: 5, dmg: 15, maxHp: 5 }, onlyType: 'melee', rage: true,
    perks: ['+5 Nahkampfschaden', '+15% Schaden', 'Wut: unter 50% HP +30% Angriffstempo', '⚠ Nur Nahkampfwaffen'],
  },
  {
    id: 'kai', name: 'KAI', title: 'Drohnen-Ingenieur', color: '#7dffef', weapon: 'blitzDrohne', extraWeapons: ['blitzDrohne'],
    stats: { ranged: 3, range: 30, speed: 5 }, onlyType: 'ranged',
    perks: ['Startet mit 2 Blitz-Drohnen', '+3 Fernkampfschaden', '+30 Reichweite', '⚠ Nur Fernkampfwaffen'],
  },
  {
    id: 'prisma', name: 'PRISMA', title: 'Elementaristin', color: '#ffffff', weapon: 'plasmaBlaster', extraWeapons: ['kryoGewehr'],
    stats: { reactionMult: 75, elem: 15, dmg: -15 },
    perks: ['Startet mit Feuer- und Eiswaffe', '+75% Reaktionsschaden', '+15% Elementarschaden', '−15% Schaden'],
  },
];

// Gegner
export const ENEMIES = {
  drone: { name: 'Drohne', hp: 8, speed: 88, dmg: 5, r: 13, xp: 1, color: '#ff2d6f', shape: 'diamond', from: 1, weight: 10 },
  runner: { name: 'Flitzer', hp: 5, speed: 160, dmg: 4, r: 10, xp: 1, color: '#ff8c1a', shape: 'tri', from: 3, weight: 5 },
  shooter: { name: 'Schütze', hp: 14, speed: 75, dmg: 5, r: 14, xp: 2, color: '#ff4dff', shape: 'square', from: 4, weight: 3,
    shoot: { cd: 2.6, speed: 200, dist: 230 } },
  tank: { name: 'Panzer-Bot', hp: 45, speed: 48, dmg: 9, r: 22, xp: 3, color: '#ff3355', shape: 'hex', from: 5, weight: 2 },
  bomber: { name: 'Kamikaze', hp: 10, speed: 120, dmg: 13, r: 12, xp: 1, color: '#ffcc00', shape: 'spike', from: 6, weight: 3,
    explode: { radius: 70, fuse: 0.65 } },
  splitter: { name: 'Teiler', hp: 26, speed: 64, dmg: 7, r: 18, xp: 2, color: '#7dff5a', shape: 'pent', from: 8, weight: 2, split: 'mini' },
  shieldbot: { name: 'Schildträger', hp: 20, speed: 68, dmg: 6, r: 16, xp: 2, color: '#3d8bff', shape: 'oct', from: 7, weight: 2,
    shield: 0.8 },
  phaser: { name: 'Phasen-Läufer', hp: 12, speed: 90, dmg: 7, r: 12, xp: 2, color: '#ff3dbb', shape: 'star', from: 9, weight: 2,
    blink: { cd: 3.2, warn: 0.55 } },
  turret: { name: 'Laser-Turm', hp: 34, speed: 0, dmg: 11, r: 18, xp: 3, color: '#ff2222', shape: 'turret', from: 11, weight: 1.4,
    laser: { cd: 3.6, charge: 1.1, fire: 0.25, len: 900 } },
  healer: { name: 'Heiler-Drohne', hp: 18, speed: 85, dmg: 4, r: 13, xp: 3, color: '#d4ff6b', shape: 'cross', from: 12, weight: 1.2,
    heal: { cd: 2.6, radius: 150, amount: 0.15, dist: 250 } },
  mini: { name: 'Splitter', hp: 6, speed: 135, dmg: 4, r: 8, xp: 0, color: '#7dff5a', shape: 'tri', from: 99, weight: 0 },
  mother: { name: 'SCHWARM-MUTTER', hp: 1100, speed: 52, dmg: 10, r: 44, xp: 20, color: '#ff8c1a', shape: 'boss3', boss: true, fixedHp: true },
  titan: { name: 'LASER-TITAN', hp: 9500, speed: 44, dmg: 17, r: 50, xp: 40, color: '#ff2222', shape: 'boss4', boss: true, fixedHp: true },
  guardian: { name: 'WÄCHTER', hp: 3200, speed: 62, dmg: 14, r: 40, xp: 30, color: '#ff3d9a', shape: 'boss1', boss: true, fixedHp: true },
  omega: { name: 'OMEGA-KERN', hp: 26000, speed: 58, dmg: 20, r: 56, xp: 0, color: '#ff2244', shape: 'boss2', boss: true, fixedHp: true },
};

export const DIFFICULTIES = {
  leicht: { name: 'Leicht', hp: 0.6, dmg: 0.5, spawn: 0.75, desc: 'Entspannt spielen' },
  normal: { name: 'Normal', hp: 1, dmg: 1, spawn: 1, desc: 'Die echte Erfahrung' },
  schwer: { name: 'Schwer', hp: 1.2, dmg: 1.25, spawn: 1.2, desc: 'Nur für Profis' },
};

// Wellen-Modifikatoren: machen einzelne Wellen besonders
export const WAVE_MODS = {
  turbo: { name: 'TURBO', icon: '⚡', desc: 'Alle Gegner sind 30% schneller', color: '#ffe94a' },
  panzer: { name: 'PANZERUNG', icon: '🛡️', desc: 'Gegner haben +50% HP, lassen aber mehr Chips fallen', color: '#3d8bff' },
  schwarm: { name: 'SCHWARM', icon: '🐝', desc: 'Doppelt so viele Gegner, dafür schwächer', color: '#7dff5a' },
  explosiv: { name: 'EXPLOSIV', icon: '💥', desc: 'Besiegte Gegner explodieren kurz darauf', color: '#ff6a2a' },
  elitejagd: { name: 'ELITE-JAGD', icon: '👑', desc: 'Viele Elite-Gegner – mit Beute-Kapseln', color: '#ff3d6a' },
};
export const MOD_WAVES = [6, 9, 13, 16, 18];

// Bosse pro Welle (Endlos-Modus: alle 5 Wellen ein Boss der Reihe nach)
export const BOSS_WAVES = { 5: 'mother', 10: 'guardian', 15: 'titan', 20: 'omega' };
export const ENDLESS_BOSSES = ['mother', 'guardian', 'titan', 'omega'];
export function bossForWave(w) {
  if (BOSS_WAVES[w]) return BOSS_WAVES[w];
  if (w > 20 && w % 5 === 0) return ENDLESS_BOSSES[(w / 5 - 5) % 4];
  return null;
}

// Arenen: wechseln mit der Musik alle 5 Wellen
export const ARENAS = {
  city: {
    name: 'NEON-STADT', icon: '🌃', desc: 'Die Straßen der Megacity',
    floor: '#070a18', grid: 'rgba(60,140,255,0.09)', accent: 'rgba(255,60,200,0.07)', border: '#00f0ff', hazard: null,
  },
  lab: {
    name: 'KRYO-LABOR', icon: '🧊', desc: 'Vorsicht: rutschige Eisflächen!',
    floor: '#06121a', grid: 'rgba(120,230,255,0.1)', accent: 'rgba(200,250,255,0.08)', border: '#9df3ff', hazard: 'ice',
  },
  factory: {
    name: 'SCHROTT-FABRIK', icon: '🏭', desc: 'Förderbänder schieben dich und die Gegner herum!',
    floor: '#120c06', grid: 'rgba(255,150,40,0.08)', accent: 'rgba(255,200,60,0.07)', border: '#ffb340', hazard: 'conveyor',
  },
  reactor: {
    name: 'REAKTORKERN', icon: '☢️', desc: 'Plasma-Felder flammen auf – auch Gegner verbrennen darin!',
    floor: '#14050a', grid: 'rgba(255,40,90,0.1)', accent: 'rgba(255,120,40,0.08)', border: '#ff2255', hazard: 'lava',
  },
};
export function arenaForWave(w) {
  if (w > 20) return ['city', 'lab', 'factory', 'reactor'][Math.floor((w - 21) / 5) % 4];
  if (w < 5) return 'city';
  if (w <= 10) return 'lab';
  if (w < 15) return 'factory';
  return 'reactor';
}

// Begleiter: im Shop kaufbar, maximal 2
export const COMPANIONS = {
  sammler: { name: 'Sammel-Drohne', icon: '🛸', color: '#50ffc8', price: 32, desc: 'Fliegt herum und sammelt Daten-Chips für dich ein.' },
  heiler: { name: 'Heil-Bot', icon: '💚', color: '#4dff7a', price: 42, desc: 'Repariert dich alle 3 Sekunden ein bisschen.' },
  schild: { name: 'Schild-Satellit', icon: '🛰️', color: '#7db8ff', price: 48, desc: 'Kreist um dich und fängt feindliche Kugeln ab.' },
  geschuetz: { name: 'Geschütz-Drohne', icon: '🔫', color: '#ffb340', price: 44, desc: 'Begleitet dich und feuert auf Gegner.' },
};
export const MAX_COMPANIONS = 2;

export const MAX_WAVE = 20;
export const MINIBOSS_WAVE = 10;
export const SHOP_EVERY = 2;      // Shop nach jeder 2. Welle
export const MAX_WEAPONS = 6;
export const waveDuration = (w) => (w === MAX_WAVE ? Infinity : Math.min(55, 20 + (w - 1) * 1.6));
