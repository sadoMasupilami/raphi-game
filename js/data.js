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
    dmg: [11, 17, 26, 40], cd: [0.8, 0.74, 0.68, 0.6], range: 95, scale: 1, arc: 1.9,
    burn: [3, 5, 8, 13], knock: 90,
    desc: 'Schwingt eine glühende Klinge im weiten Bogen.',
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
    dmg: [17, 26, 39, 58], cd: [1.4, 1.3, 1.18, 1.05], range: 115, scale: 1.2, aoe: [52, 58, 66, 76],
    chill: [2, 2, 3, 3], knock: 120,
    desc: 'Zertrümmert den Boden und kühlt alle Gegner ringsum.',
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
    dmg: [9, 14, 21, 32], cd: [0.62, 0.56, 0.5, 0.44], range: 135, scale: 1, width: 22,
    chain: [1, 1, 2, 2], knock: 60,
    desc: 'Schnelle Stöße. Der Strom springt auf Gegner in der Nähe über.',
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
    dmg: [14, 21, 32, 48], cd: [1.1, 1.0, 0.9, 0.8], range: 115, scale: 1.1, arc: 2.7,
    voidStacks: [2, 2, 3, 3], knock: 70,
    desc: 'Riesiger Sensenschwung, der viele Gegner auf einmal trifft.',
  },
};

// Status-Effekte der Element-Waffen ohne eigenen Wert
export const BOLT_SHOCK_TIME = 2.2;   // Sekunden geschockt
export const SHOCK_BONUS = 0.2;       // +20 % Schaden auf geschockte Gegner

// Werte des Spielers
export const BASE_STATS = {
  maxHp: 25, regen: 0, lifesteal: 0, dmg: 0, melee: 0, ranged: 0, elem: 0,
  atkSpd: 0, crit: 5, range: 0, armor: 0, dodge: 0, speed: 0, luck: 0, harvest: 0, magnet: 0,
  // Spezialwerte
  burnMult: 0, freezeStacks: 5, chainBonus: 0, voidMax: 8, voidMult: 0, reactionMult: 0, shield: 0,
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
  quantenherz: { name: 'Quantenherz', icon: '💠', tier: 3, price: 105, stats: { maxHp: 25, regen: 4 } },
  gottChip: { name: 'Gottmodus-Chip', icon: '👑', tier: 3, price: 115, stats: { dmg: 22, atkSpd: 12 } },
  singKern: { name: 'Singularitäts-Kern', icon: '🕳️', tier: 3, price: 115, stats: { elem: 35, chainBonus: 1, reactionMult: 30 } },
  exoskelett: { name: 'Exo-Skelett', icon: '🤖', tier: 3, price: 100, stats: { armor: 5, melee: 4, ranged: 4 } },
};

export const CHARACTERS = [
  {
    id: 'vex', name: 'VEX', title: 'Cyborg-Klingenmeister', color: '#ff5a3c', weapon: 'plasmaKlinge',
    stats: { melee: 3, lifesteal: 4, armor: 1, ranged: -2 },
    perks: ['+3 Nahkampfschaden', '+4% Lebensraub', '+1 Rüstung', '−2 Fernkampfschaden'],
  },
  {
    id: 'nyx', name: 'NYX', title: 'Netzhackerin', color: '#ffe94a', weapon: 'teslaSpule',
    stats: { elem: 25, chainBonus: 1, maxHp: -5 },
    perks: ['+25% Elementarschaden', '+1 Blitzsprung', '−5 Max. HP'],
  },
  {
    id: 'brock', name: 'BROCK', title: 'Mech-Pilot', color: '#5fe3ff', weapon: 'kryoHammer',
    stats: { maxHp: 15, armor: 3, speed: -8 },
    perks: ['+15 Max. HP', '+3 Rüstung', '−8% Tempo'],
  },
  {
    id: 'echo', name: 'ECHO', title: 'Schatten-Android', color: '#b45cff', weapon: 'nanoSchwarm',
    stats: { speed: 12, dodge: 10, harvest: 5, magnet: 30 },
    perks: ['+12% Tempo', '+10% Ausweichen', '+5 Ernte', '+30% Sammelradius'],
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
  mini: { name: 'Splitter', hp: 6, speed: 135, dmg: 4, r: 8, xp: 0, color: '#7dff5a', shape: 'tri', from: 99, weight: 0 },
  guardian: { name: 'WÄCHTER', hp: 3200, speed: 62, dmg: 14, r: 40, xp: 30, color: '#ff3d9a', shape: 'boss1', boss: true, fixedHp: true },
  omega: { name: 'OMEGA-KERN', hp: 26000, speed: 58, dmg: 20, r: 56, xp: 0, color: '#ff2244', shape: 'boss2', boss: true, fixedHp: true },
};

export const DIFFICULTIES = {
  leicht: { name: 'Leicht', hp: 0.6, dmg: 0.5, spawn: 0.75, desc: 'Entspannt spielen' },
  normal: { name: 'Normal', hp: 1, dmg: 1, spawn: 1, desc: 'Die echte Erfahrung' },
  schwer: { name: 'Schwer', hp: 1.2, dmg: 1.25, spawn: 1.2, desc: 'Nur für Profis' },
};

export const MAX_WAVE = 20;
export const MINIBOSS_WAVE = 10;
export const SHOP_EVERY = 2;      // Shop nach jeder 2. Welle
export const MAX_WEAPONS = 6;
export const waveDuration = (w) => (w === MAX_WAVE ? Infinity : Math.min(55, 20 + (w - 1) * 1.6));
