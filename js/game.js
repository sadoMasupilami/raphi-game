// Spiellogik: Spieler, Waffen, Gegner, Elemente, Reaktionen, Wellen, Shop
import {
  ELEMENTS, ELEMENT_ORDER, REACTIONS, reactionKey, WEAPONS, ITEMS, CHARACTERS, ENEMIES, DIFFICULTIES,
  BASE_STATS, UPGRADES, TIER_PRICE, BOLT_SHOCK_TIME, SHOCK_BONUS,
  MAX_WAVE, MINIBOSS_WAVE, MAX_WEAPONS, waveDuration, WAVE_MODS, MOD_WAVES, EVOLUTIONS, ULTS,
} from './data.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { enemySprite, whiteSprite } from './sprites.js';

export const ARENA = { w: 1500, h: 1500 };
const CELL = 64;
const MAX_ENEMIES = 170;
const MAX_PARTICLES = 380;
const MAX_TEXTS = 36;
const PLAYER_BASE_SPEED = 210;
const DASH_SPEED = 820;
const DASH_TIME = 0.17;

const PRISM_D = {}; // Standardwerte für Elemente aus der Prisma-Linse
// Unsichtbare "Waffe" für Geschosse der Ultimate-Fähigkeiten
const ULT_W = { tier: 3 };
const ULT_VOID_D = { elem: 'void', voidStacks: [3, 3, 3, 3], knock: 10 };
const ULT_BOLT_D = { elem: 'bolt', knock: 5 };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class Game {
  constructor(charId, diffId, hooks) {
    this.char = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    this.diffId = diffId;
    this.diff = DIFFICULTIES[diffId] || DIFFICULTIES.normal;
    this.hooks = hooks;

    this.state = 'intermission';
    this.wave = 0;
    this.waveTime = 0;
    this.time = 0;
    this.kills = 0;
    this.score = 0;
    this.credits = 0;
    this.xp = 0;
    this.level = 0;
    this.pendingLevels = 0;
    this.endless = false;
    this.victory = false;
    this.dmgMode = 'all'; // 'all' | 'crit' | 'off'
    this.shake = 0;
    this.uid = 1;
    this.reactionCount = 0;

    this.bonus = {};
    this.items = [];
    this.weapons = [];
    this.shopOffers = [];
    this.rerolls = 0;

    this.player = {
      x: ARENA.w / 2, y: ARENA.h / 2, r: 14, hp: 1, iframes: 0, shieldT: 0, regenAcc: 0, vx: 0, vy: 0, lsBudget: 10,
      dashT: 0, dashCd: 0, dashX: 0, dashY: -1, faceX: 0, faceY: -1,
    };
    this.enemies = [];
    this.projectiles = [];
    this.ebullets = [];
    this.pickups = [];
    this.markers = [];
    this.vortices = [];
    this.zones = [];
    this.hazards = [];
    this.mod = null;
    this.killStreak = 0;
    this.pulseT = 8;
    this.particles = [];
    this.corpses = [];
    this.lowFx = false;
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.beams = [];
    this.arcs = [];
    this.boss = null;
    // Ultimate & Spektakel
    this.ult = { charge: 0, active: null };
    this.slowT = 0;
    this.slowScale = 1;
    this.cam = { x: 0, y: 0, zoom: 1, t: 0 };
    this.flashFx = null;
    this.glitchT = 0;
    this.lights = [];
    this.lastFlash = 0;

    this.gridCols = Math.ceil(ARENA.w / CELL) + 1;
    this.gridRows = Math.ceil(ARENA.h / CELL) + 1;
    this.grid = Array.from({ length: this.gridCols * this.gridRows }, () => []);
    this._q = [];

    this.addWeapon(this.char.weapon, 0);
    for (const id of this.char.extraWeapons || []) this.addWeapon(id, 0);
    this.recalc();
    this.player.hp = this.stats.maxHp;
  }

  // Ereignis an Fortschritt/Tutorial melden
  emit(type, data) {
    if (this.hooks.event) this.hooks.event(type, data, this);
  }

  // ================= Werte =================
  recalc() {
    const s = { ...BASE_STATS };
    const add = (obj) => { for (const k in obj) s[k] = (s[k] || 0) + obj[k]; };
    add(this.char.stats);
    add(this.bonus);
    for (const id of this.items) add(ITEMS[id].stats);
    s.maxHp = Math.max(1, Math.round(s.maxHp));
    s.freezeStacks = Math.max(2, s.freezeStacks);
    this.stats = s;
    if (this.player.hp > s.maxHp) this.player.hp = s.maxHp;
  }

  get moveSpeed() { return PLAYER_BASE_SPEED * Math.max(0.35, 1 + this.stats.speed / 100); }
  get cdMult() { return 1 / Math.max(0.3, 1 + this.stats.atkSpd / 100); }
  get dashCooldown() { return Math.max(0.6, 2.2 * (1 - (this.stats.dashCdr || 0) / 100)); }
  get magnetR() { return 75 * Math.max(0.5, 1 + this.stats.magnet / 100); }
  armorFactor() {
    const a = this.stats.armor;
    return a >= 0 ? 15 / (15 + a) : (15 - a) / 15;
  }

  get raging() { return !!this.char.rage && this.player.hp < this.stats.maxHp * 0.5; }

  weaponDamage(w) {
    const d = WEAPONS[w.id];
    const flat = d.type === 'melee' ? this.stats.melee : this.stats.ranged;
    return Math.max(1, d.dmg[w.tier] + flat * d.scale) * Math.max(0.1, 1 + this.stats.dmg / 100);
  }

  // Darf der Charakter diese Waffe tragen?
  allowedWeapon(id) {
    return !this.char.onlyType || WEAPONS[id].type === this.char.onlyType;
  }
  weaponRange(w) {
    const d = WEAPONS[w.id];
    return Math.max(40, d.range + (d.type === 'melee' ? this.stats.range * 0.5 : this.stats.range));
  }
  weaponCooldown(w) {
    const rage = this.ult.active && this.ult.active.type === 'rage' ? 0.5 : 1;
    return WEAPONS[w.id].cd[w.tier] * this.cdMult * (this.raging ? 1 / 1.3 : 1) * rage;
  }
  elemMult() { return Math.max(0.1, 1 + this.stats.elem / 100); }

  xpNeeded() { return (this.level + 3) * (this.level + 3); }

  // ================= Waffen & Items =================
  addWeapon(id, tier) {
    this.weapons.push({ uid: this.uid++, id, tier, cd: 0.3 + Math.random() * 0.3, angle: -Math.PI / 2, x: 0, y: 0, anim: null });
    this.emit('weapon', { id, tier });
  }

  canTakeWeapon(id, tier) {
    if (!this.allowedWeapon(id)) return false;
    if (this.weapons.length < MAX_WEAPONS) return true;
    return tier < 3 && this.weapons.some((w) => w.id === id && w.tier === tier);
  }

  takeWeapon(id, tier) {
    if (!this.allowedWeapon(id)) return false;
    if (this.weapons.length < MAX_WEAPONS) {
      this.addWeapon(id, tier);
      return 'added';
    }
    const idx = this.weapons.findIndex((w) => w.id === id && w.tier === tier);
    if (idx >= 0 && tier < 3) {
      this.weapons[idx].tier = tier + 1;
      this.emit('weapon', { id, tier: tier + 1 });
      return 'merged';
    }
    return false;
  }

  mergeTarget(index) {
    const w = this.weapons[index];
    if (!w || w.tier >= 3) return -1;
    return this.weapons.findIndex((o, i) => i !== index && o.id === w.id && o.tier === w.tier);
  }

  mergeWeapon(index) {
    const other = this.mergeTarget(index);
    if (other < 0) return false;
    this.weapons[index].tier++;
    this.emit('weapon', { id: this.weapons[index].id, tier: this.weapons[index].tier });
    this.weapons.splice(other, 1);
    return true;
  }

  priceScale() { return 1 + (this.wave - 1) * 0.11; }
  weaponPrice(id, tier) { return Math.round(WEAPONS[id].price * TIER_PRICE[tier] * this.priceScale()); }
  itemPrice(id) { return Math.round(ITEMS[id].price * this.priceScale()); }
  sellPrice(index) {
    const w = this.weapons[index];
    if (WEAPONS[w.id].evo) return Math.round(WEAPONS[w.id].price * 2 * this.priceScale());
    return Math.max(1, Math.round(this.weaponPrice(w.id, w.tier) * 0.4));
  }
  sellWeapon(index) {
    if (this.weapons.length <= 1) return false;
    this.credits += this.sellPrice(index);
    this.weapons.splice(index, 1);
    return true;
  }

  itemCount(id) { return this.items.filter((i) => i === id).length; }
  addItem(id) {
    this.items.push(id);
    this.emit('item', id);
    const hpBefore = this.stats.maxHp;
    this.recalc();
    if (this.stats.maxHp > hpBefore) this.player.hp += this.stats.maxHp - hpBefore;
  }

  // Seltenheit würfeln (0..3), abhängig von Fortschritt und Glück
  rollTier(progress) {
    const luck = 1 + Math.max(-0.5, this.stats.luck / 100);
    const t4 = clamp((progress - 9) * 0.018, 0, 0.12) * luck;
    const t3 = clamp((progress - 4) * 0.03, 0, 0.3) * luck;
    const t2 = clamp((progress - 1) * 0.06, 0, 0.55) * luck;
    const r = Math.random();
    if (r < t4) return 3;
    if (r < t4 + t3) return 2;
    if (r < t4 + t3 + t2) return 1;
    return 0;
  }

  randomItem(tier) {
    let pool = Object.keys(ITEMS).filter((id) => ITEMS[id].tier === tier && !(ITEMS[id].max && this.itemCount(id) >= ITEMS[id].max));
    if (!pool.length) pool = Object.keys(ITEMS).filter((id) => !(ITEMS[id].max && this.itemCount(id) >= ITEMS[id].max));
    return pick(pool);
  }

  randomWeaponId() {
    const owned = this.weapons.filter((w) => !WEAPONS[w.id].evo);
    if (owned.length && Math.random() < 0.35) return pick(owned).id;
    return pick(Object.keys(WEAPONS).filter((id) => this.allowedWeapon(id) && !WEAPONS[id].evo));
  }

  // ================= Evolution =================
  // Stufe-IV-Waffe + passendes Item = legendäre Waffe
  availableEvolutions() {
    const out = [];
    this.weapons.forEach((w, index) => {
      if (w.tier !== 3) return;
      const evo = EVOLUTIONS.find((v) => v.weapon === w.id && this.items.includes(v.item));
      if (evo) out.push({ index, evo });
    });
    return out;
  }

  evolve(index, into) {
    const w = this.weapons[index];
    if (!w) return;
    w.id = into;
    w.anim = null;
    w.shards = null;
    w.hitT = null;
    this.emit('weapon', { id: into, tier: 3 });
    this.emit('evolve', into);
  }

  // ================= Level-Up =================
  levelCards() {
    const cards = [];
    const keys = UPGRADES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    for (const u of keys) {
      const tier = this.rollTier(this.level * 0.9);
      cards.push({ type: 'stat', key: u.key, tier, val: u.vals[tier] });
    }
    if (Math.random() < 0.28) {
      const id = this.randomWeaponId();
      const tier = Math.min(2, this.rollTier(this.level * 0.7));
      if (this.canTakeWeapon(id, tier)) cards[2] = { type: 'weapon', id, tier };
    }
    return cards;
  }

  applyCard(card) {
    if (card.type === 'stat') {
      this.bonus[card.key] = (this.bonus[card.key] || 0) + card.val;
      const before = this.stats.maxHp;
      this.recalc();
      if (this.stats.maxHp > before) this.player.hp += this.stats.maxHp - before;
    } else if (card.type === 'weapon') {
      this.takeWeapon(card.id, card.tier);
    }
  }

  finishLevelUp() {
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    // +1 Max-HP pro Level
    this.bonus.maxHp = (this.bonus.maxHp || 0) + 1;
    this.recalc();
    this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1);
  }

  levelRerollCost() { return 2 + this.wave; }

  addXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level++;
      this.pendingLevels++;
    }
  }

  // ================= Shop =================
  makeOffer() {
    if (Math.random() < 0.45) {
      const id = this.randomWeaponId();
      const tier = this.rollTier(this.wave);
      return { type: 'weapon', id, tier, price: this.weaponPrice(id, tier) };
    }
    // Passende Evolutions-Items tauchen häufiger auf, wenn man die Waffe schon hochgestuft hat
    const evoItems = EVOLUTIONS.filter((v) => !this.items.includes(v.item)
      && this.weapons.some((w) => w.id === v.weapon && w.tier >= 2)).map((v) => v.item);
    const id = evoItems.length && Math.random() < 0.25 ? pick(evoItems) : this.randomItem(this.rollTier(this.wave));
    return { type: 'item', id, price: this.itemPrice(id) };
  }

  rollShop(keepLocked = true) {
    const kept = keepLocked ? this.shopOffers.filter((o) => o && o.locked) : [];
    this.shopOffers = [];
    for (let i = 0; i < 4; i++) {
      const lockedOne = kept.shift();
      this.shopOffers.push(lockedOne || this.makeOffer());
    }
  }

  openShop() {
    this.rerolls = 0;
    // Preise der gesperrten Angebote an die aktuelle Welle anpassen
    for (const o of this.shopOffers) {
      if (!o || !o.locked) continue;
      o.price = o.type === 'weapon' ? this.weaponPrice(o.id, o.tier) : this.itemPrice(o.id);
    }
    this.rollShop(true);
  }

  rerollCost() {
    const base = Math.max(1, Math.floor(this.wave * 0.75));
    return base + this.rerolls * Math.ceil(base / 2);
  }

  reroll() {
    const c = this.rerollCost();
    if (this.credits < c) return false;
    this.credits -= c;
    this.rerolls++;
    this.rollShop(true);
    return true;
  }

  buy(i) {
    const o = this.shopOffers[i];
    if (!o) return 'none';
    if (this.credits < o.price) return 'money';
    if (o.type === 'weapon') {
      if (!this.allowedWeapon(o.id)) return 'type';
      const res = this.takeWeapon(o.id, o.tier);
      if (!res) return 'slots';
      this.credits -= o.price;
      this.shopOffers[i] = null;
      return res;
    }
    const it = ITEMS[o.id];
    if (it.max && this.itemCount(o.id) >= it.max) return 'max';
    this.credits -= o.price;
    this.addItem(o.id);
    this.shopOffers[i] = null;
    return 'item';
  }

  // ================= Wellen =================
  startWave() {
    this.wave++;
    this.waveTime = waveDuration(this.wave);
    if (this.endless && this.wave > MAX_WAVE) this.waveTime = 55;
    this.spawnAcc = 1.5;
    this.player.x = ARENA.w / 2;
    this.player.y = ARENA.h / 2;
    this.player.hp = this.stats.maxHp;
    this.player.iframes = 1;
    this.player.shieldT = 0;
    this.player.dashT = 0;
    this.player.dashCd = 0;
    this.player.lastStandUsed = false;
    this.zones.length = 0;
    this.hazards.length = 0;
    this.mod = null;
    const isBossWave = this.wave === MINIBOSS_WAVE || this.wave === MAX_WAVE || (this.wave > MAX_WAVE && this.wave % 5 === 0);
    if (!isBossWave && (MOD_WAVES.includes(this.wave) || (this.wave > MAX_WAVE && this.wave % 3 === 0))) {
      this.mod = pick(Object.keys(WAVE_MODS));
      const M = WAVE_MODS[this.mod];
      this.hooks.toast(`${M.icon} ${M.name}: ${M.desc}`, M.color);
    }
    this.state = 'play';
    this.boss = null;
    this.bossAlive = false;
    input.reset();
    audio.play('wave');
    if (this.wave === MINIBOSS_WAVE || (this.endless && this.wave > MAX_WAVE && this.wave % 5 === 0)) {
      this.queueBoss('guardian');
    } else if (this.wave === MAX_WAVE) {
      this.queueBoss('omega');
    }
    if (this.wave === 15) {
      for (let i = 0; i < 2; i++) this.queueSpawn('tank', true);
    }
  }

  queueBoss(type) {
    this.bossAlive = true;
    const a = Math.random() * Math.PI * 2;
    const x = clamp(this.player.x + Math.cos(a) * 380, 120, ARENA.w - 120);
    const y = clamp(this.player.y + Math.sin(a) * 380, 120, ARENA.h - 120);
    this.markers.push({ x, y, t: 2.2, max: 2.2, type, elite: false, boss: true });
    audio.play('bossWarn');
    this.hooks.toast(`⚠ ${ENEMIES[type].name} NÄHERT SICH`, '#ff3d6a');
  }

  queueSpawn(type, elite = false, near = null) {
    let x;
    let y;
    for (let tries = 0; tries < 12; tries++) {
      if (near) {
        x = near.x + rand(-40, 40);
        y = near.y + rand(-40, 40);
      } else {
        x = rand(40, ARENA.w - 40);
        y = rand(40, ARENA.h - 40);
      }
      x = clamp(x, 30, ARENA.w - 30);
      y = clamp(y, 30, ARENA.h - 30);
      const d = Math.hypot(x - this.player.x, y - this.player.y);
      if (d > 190) break;
    }
    this.markers.push({ x, y, t: 0.9, max: 0.9, type, elite });
  }

  spawnRate() {
    let r = (1.2 + this.wave * 0.25) * this.diff.spawn;
    if (this.wave === MAX_WAVE) r *= 0.45;
    if (this.wave > MAX_WAVE) r *= 1 + (this.wave - MAX_WAVE) * 0.06;
    if (this.mod === 'schwarm') r *= 1.8;
    return r;
  }

  pickEnemyType() {
    const pool = [];
    let total = 0;
    for (const k in ENEMIES) {
      const d = ENEMIES[k];
      if (!d.weight || d.from > this.wave) continue;
      if (d.laser && this.enemies.filter((e) => e.def.laser).length >= 4) continue;
      // Neuere Typen werden mit der Zeit häufiger
      const w = d.weight * (1 + Math.min(1.5, (this.wave - d.from) * 0.08));
      pool.push([k, w]);
      total += w;
    }
    let r = Math.random() * total;
    for (const [k, w] of pool) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'drone';
  }

  updateSpawning(dt) {
    this.spawnAcc += this.spawnRate() * dt;
    while (this.spawnAcc >= 1) {
      const groupSize = Math.min(Math.floor(this.spawnAcc), 1 + ((Math.random() * (2 + this.wave / 5)) | 0));
      this.spawnAcc -= groupSize;
      if (this.enemies.length + this.markers.length >= MAX_ENEMIES) continue;
      const type = this.pickEnemyType();
      let anchor = null;
      for (let i = 0; i < groupSize; i++) {
        const eliteChance = this.mod === 'elitejagd' ? 0.07 : this.wave >= 12 ? 0.012 * (this.wave / 12) : 0;
        const elite = Math.random() < eliteChance;
        this.queueSpawn(type, elite, anchor);
        anchor = this.markers[this.markers.length - 1];
      }
    }
  }

  createEnemy(type, x, y, elite = false) {
    const def = ENEMIES[type];
    const w = this.wave;
    let hpMul;
    if (def.fixedHp) {
      hpMul = this.diff.hp * (w > MAX_WAVE ? 1 + (w - MAX_WAVE) * 0.35 : 1);
      if (type === 'guardian' && w > MAX_WAVE) hpMul *= 3;
    } else {
      hpMul = (1 + (w - 1) * 0.22 + (w - 1) * (w - 1) * 0.022 + Math.max(0, w - MAX_WAVE) * 0.8) * this.diff.hp;
    }
    const dmgMul = (1 + (w - 1) * 0.08 + (w - 1) * (w - 1) * 0.003) * this.diff.dmg;
    const em = elite ? 6 : 1;
    let speedMul = 1;
    let xpMul = 1;
    if (!def.boss) {
      if (this.mod === 'turbo') speedMul = 1.3;
      else if (this.mod === 'panzer') { hpMul *= 1.5; xpMul = 1.5; }
      else if (this.mod === 'schwarm') hpMul *= 0.6;
    }
    const e = {
      id: this.uid++, type, def, elite, x, y,
      r: def.r * (elite ? 1.5 : 1),
      hp: def.hp * hpMul * em, maxHp: def.hp * hpMul * em,
      speed: def.speed * (1 + Math.min(0.25, (w - 1) * 0.012)) * (elite ? 0.85 : 1) * speedMul,
      dmg: def.dmg * dmgMul * (elite ? 1.5 : 1),
      xp: Math.round(def.xp * em * xpMul),
      kx: 0, ky: 0, flash: 0, dead: false,
      burnDps: 0, burnT: 0, chill: 0, slowT: 0, frozen: 0, shock: 0,
      voidStacks: 0, voidT: 0, voidPow: 0, dotAcc: 0,
      mark: null, markT: 0, reactCd: 0,
      shootT: def.shoot ? rand(0.5, def.shoot.cd) : 0,
      fuse: -1, phase: 'chase', phaseT: 2.5, aiT: 0, dashX: 0, dashY: 0, spin: 0,
      sprite: enemySprite(type, def, elite), white: whiteSprite(type, def, elite),
      rot: Math.random() * Math.PI * 2,
      spawnT: 0.25,
      shieldHp: 0, shieldMax: 0, shieldIdle: 0,
      blinkT: def.blink ? rand(1, def.blink.cd) : 0, blinkTo: null,
      laserT: def.laser ? rand(1, def.laser.cd) : 0, laserState: 'idle', laserAng: 0,
      healT: def.heal ? rand(1, def.heal.cd) : 0,
    };
    if (def.shield) e.shieldHp = e.shieldMax = e.maxHp * def.shield;
    if (def.boss) {
      this.boss = e;
      this.hooks.boss(e);
      this.focusCam(x, y, 1.3, 1.7);
      this.slowmo(1.5, 0.25);
      this.screenFlash('#ff2255', 0.3);
      this.shake = Math.max(this.shake, 10);
    }
    this.enemies.push(e);
    this.emit('enemy', type);
    return e;
  }

  endWave() {
    this.state = 'intermission';
    // Restliche Daten-Chips einsammeln
    let collected = 0;
    for (const p of this.pickups) {
      if (p.kind === 'chip') collected += p.value;
      else if (p.kind === 'crate') this.openCrate(false);
    }
    this.pickups.length = 0;
    for (const e of this.enemies) this.burst(e.x, e.y, e.def.color, 6, 160);
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.ebullets.length = 0;
    this.markers.length = 0;
    this.vortices.length = 0;
    const harvest = Math.max(0, Math.round(this.stats.harvest));
    this.credits += collected + harvest;
    let interest = 0;
    if (this.stats.interest > 0) {
      interest = Math.min(Math.round(this.stats.interest * 3), Math.floor(this.credits * this.stats.interest / 100));
      this.credits += interest;
    }
    this.zones.length = 0;
    this.hazards.length = 0;
    this.addXp(collected + harvest);
    this.score += this.wave * 100;
    this.boss = null;
    this.hooks.boss(null);
    this.lastWaveInfo = { collected, harvest, interest };
    this.hooks.waveEnd();
  }

  // ================= Update =================
  update(dt) {
    if (this.state !== 'play') return;
    // Kamera- und Bildschirmeffekte laufen in Echtzeit, Zeitlupe verlangsamt das Spiel
    this.realtimeFx(dt);
    if (this.slowT > 0) {
      this.slowT -= dt;
      dt *= this.slowScale;
    }
    this.time += dt;
    const p = this.player;
    const s = this.stats;

    // Wellen-Timer
    if (this.waveTime !== Infinity) {
      this.waveTime -= dt;
      if (this.waveTime <= 0) {
        if (this.bossAlive && this.boss) this.hooks.toast(`${this.boss.def.name} IST ENTKOMMEN`, '#ff3d6a');
        this.endWave();
        return;
      }
    }

    // Spieler-Bewegung
    input.update();
    const sp = this.moveSpeed;
    if (input.x || input.y) {
      const l = Math.hypot(input.x, input.y);
      p.faceX = input.x / l;
      p.faceY = input.y / l;
    }
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashX * DASH_SPEED;
      p.vy = p.dashY * DASH_SPEED;
      this.particle(p.x + rand(-6, 6), p.y + rand(-6, 6), -p.vx * 0.1, -p.vy * 0.1, 0.3, this.char.color, 4);
    } else {
      p.vx = input.x * sp;
      p.vy = input.y * sp;
    }
    p.x = clamp(p.x + p.vx * dt, p.r, ARENA.w - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, ARENA.h - p.r);
    if (p.dashT > 0 && s.dashDmg > 0) this.dashHits(p);
    if (!this.lowFx && p.dashT <= 0 && (p.vx || p.vy) && Math.random() < 0.35) {
      this.particle(p.x - p.faceX * 12 + rand(-3, 3), p.y - p.faceY * 12 + rand(-3, 3), -p.faceX * 60, -p.faceY * 60, 0.25, this.char.color, 2.5);
    }
    if (s.magnetPulse > 0) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) {
        this.pulseT = 8;
        for (const k of this.pickups) if (k.kind === 'chip') k.magnet = true;
        this.rings.push({ x: p.x, y: p.y, r0: 20, r1: 260, life: 0.5, max: 0.5, color: '#50ffc8', width: 4 });
      }
    }
    if (p.iframes > 0) p.iframes -= dt;
    if (p.shieldT > 0) p.shieldT -= dt;
    p.lsBudget = Math.min(12, p.lsBudget + dt * 12);
    if (s.regen > 0 && p.hp < s.maxHp) {
      p.regenAcc += s.regen * 0.2 * dt;
      if (p.regenAcc >= 1) {
        const h = Math.floor(p.regenAcc);
        p.regenAcc -= h;
        p.hp = Math.min(s.maxHp, p.hp + h);
      }
    }

    this.buildGrid();
    if (!(this.wave === MAX_WAVE && !this.bossAlive)) this.updateSpawning(dt);
    this.updateMarkers(dt);
    this.updateWeapons(dt);
    this.updateUlt(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateEnemyBullets(dt);
    this.updateVortices(dt);
    this.updateZones(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);

    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.pendingLevels > 0 && this.state === 'play') {
      this.state = 'levelup';
      audio.play('levelup');
      this.hooks.levelUp();
    }
  }

  buildGrid() {
    for (const cell of this.grid) cell.length = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cx = (e.x / CELL) | 0;
      const cy = (e.y / CELL) | 0;
      this.grid[cx + cy * this.gridCols].push(e);
    }
  }

  // Gegner im Radius (berücksichtigt Gegner-Radius).
  // shared=true nutzt einen wiederverwendeten Puffer – nur wenn währenddessen kein weiterer query-Aufruf passiert.
  query(x, y, r, shared = false) {
    const out = shared ? this._q : [];
    out.length = 0;
    const ext = r + 60;
    const c0 = Math.max(0, ((x - ext) / CELL) | 0);
    const c1 = Math.min(this.gridCols - 1, ((x + ext) / CELL) | 0);
    const r0 = Math.max(0, ((y - ext) / CELL) | 0);
    const r1 = Math.min(this.gridRows - 1, ((y + ext) / CELL) | 0);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const cell = this.grid[cx + cy * this.gridCols];
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e.dead) continue;
          const rr = r + e.r;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy < rr * rr) out.push(e);
        }
      }
    }
    return out;
  }

  nearestEnemy(x, y, range, exclude = null) {
    let best = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || (exclude && exclude.has(e.id))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      const rr = range + e.r;
      if (d < rr * rr && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateMarkers(dt) {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.markers.splice(i, 1);
        this.createEnemy(m.type, m.x, m.y, m.elite);
      }
    }
  }

  // ================= Waffen =================
  updateWeapons(dt) {
    const p = this.player;
    const n = this.weapons.length;
    for (let i = 0; i < n; i++) {
      const w = this.weapons[i];
      const d = WEAPONS[w.id];
      if (d.kind === 'orbit') { this.updateOrbit(w, d, dt); continue; }
      const slotA = (i / n) * Math.PI * 2 - Math.PI / 2 + this.time * 0.15;
      let sx = p.x + Math.cos(slotA) * 26;
      let sy = p.y + Math.sin(slotA) * 26;
      if (d.kind === 'drone') {
        // Drohne kreist weiter außen um den Spieler
        const a = this.time * 1.4 + w.uid * 2.1;
        sx = p.x + Math.cos(a) * 62;
        sy = p.y + Math.sin(a) * 62 * 0.8;
      }
      const range = this.weaponRange(w);
      w.cd -= dt;

      if (w.anim) {
        this.updateMeleeAnim(w, d, dt, sx, sy);
        continue;
      }
      w.x = sx;
      w.y = sy;
      const target = this.nearestEnemy(d.type === 'melee' ? p.x : sx, d.type === 'melee' ? p.y : sy, range);
      if (target) {
        const ta = Math.atan2(target.y - sy, target.x - sx);
        w.angle = lerpAngle(w.angle, ta, Math.min(1, dt * 14));
        if (w.cd <= 0) {
          w.cd = this.weaponCooldown(w);
          this.fire(w, d, target, sx, sy, range);
        }
      } else {
        w.angle = lerpAngle(w.angle, slotA, Math.min(1, dt * 4));
      }
    }
  }

  updateOrbit(w, d, dt) {
    const p = this.player;
    const cnt = d.count[w.tier];
    const R = Math.min(150, this.weaponRange(w));
    w.spin = (w.spin || 0) + dt * 3.4;
    w.shards = w.shards || [];
    w.shards.length = cnt;
    if (!w.hitT || w.hitT.size > 400) w.hitT = new Map();
    const dmg = this.weaponDamage(w);
    const cd = this.weaponCooldown(w);
    for (let k = 0; k < cnt; k++) {
      const a = w.spin + (k / cnt) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R;
      const y = p.y + Math.sin(a) * R;
      w.shards[k] = { x, y, a };
      for (const e of this.query(x, y, 10)) {
        if ((w.hitT.get(e.id) || 0) > this.time) continue;
        w.hitT.set(e.id, this.time + cd);
        this.hit(e, dmg, w, d, p.x, p.y);
      }
    }
    w.x = p.x;
    w.y = p.y;
  }

  fire(w, d, target, sx, sy, range) {
    const dmg = this.weaponDamage(w);
    const color = ELEMENTS[d.elem].color;
    const ang = Math.atan2(target.y - sy, target.x - sx);
    const t = w.tier;
    switch (d.kind) {
      case 'bullet':
        this.projectiles.push({
          kind: 'bullet', x: sx, y: sy, vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed,
          r: 5, dmg, w, d, color, pierce: d.pierce[t], life: range / d.speed + 0.05, hit: new Set(),
        });
        audio.play('shoot');
        break;
      case 'flame': {
        for (let k = 0; k < 2; k++) {
          const a = ang + rand(-0.2, 0.2);
          const spd = d.speed * rand(0.85, 1.1);
          this.projectiles.push({
            kind: 'flame', x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            r: 6, dmg, w, d, color, pierce: d.pierce[t], life: range / spd, max: range / spd, hit: new Set(),
          });
        }
        audio.play('flame');
        break;
      }
      case 'drone': {
        const jumps = d.chain[t] + this.stats.chainBonus;
        this.chainLightning(target, sx, sy, jumps, 110, (e, idx) => this.hit(e, dmg * Math.pow(0.85, idx), w, d, sx, sy), color);
        audio.play('zap');
        break;
      }
      case 'boomerang':
        this.projectiles.push({
          kind: 'boomerang', x: sx, y: sy, vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed, speed: d.speed,
          r: 11, dmg, w, d, color, pierce: 9999, life: 4, out: true, dist: 0, range, spin: 0, hit: new Set(),
        });
        audio.play('swing');
        break;
      case 'puddle':
      case 'mortar': {
        const tx = target.x + rand(-10, 10);
        const ty = target.y + rand(-10, 10);
        this.projectiles.push({ kind: 'mortar', x: sx, y: sy, sx, sy, tx, ty, t: 0, dur: 0.55, r: 6, dmg, w, d, color, aoe: d.aoe[t] });
        audio.play('shoot');
        break;
      }
      case 'chain': {
        const jumps = d.chain[t] + this.stats.chainBonus;
        this.chainLightning(target, sx, sy, jumps, 135, (e, idx) => this.hit(e, dmg * Math.pow(0.9, idx), w, d, sx, sy), color);
        audio.play('zap');
        break;
      }
      case 'beam': {
        const ex = sx + Math.cos(ang) * range;
        const ey = sy + Math.sin(ang) * range;
        const half = d.width / 2;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (distToSeg(e.x, e.y, sx, sy, ex, ey) < half + e.r) this.hit(e, dmg, w, d, sx, sy);
        }
        this.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, life: 0.22, max: 0.22, color, width: d.width });
        this.shake = Math.max(this.shake, 3);
        audio.play('rail');
        break;
      }
      case 'homing': {
        const cnt = d.count[t];
        for (let k = 0; k < cnt; k++) {
          const a = ang + (k - (cnt - 1) / 2) * 0.5 + rand(-0.15, 0.15);
          this.projectiles.push({
            kind: 'homing', x: sx, y: sy, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed,
            r: 4, dmg, w, d, color, pierce: 0, life: 2.4, target, hit: new Set(),
          });
        }
        audio.play('shoot');
        break;
      }
      case 'orb':
        this.projectiles.push({
          kind: 'orb', x: sx, y: sy, vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed,
          r: 9, dmg, w, d, color, aoe: d.aoe[t], life: range / d.speed + 0.1, hit: new Set(),
        });
        audio.play('shoot');
        break;
      case 'sweep':
      case 'thrust':
      case 'slam': {
        const dur = Math.min(d.kind === 'slam' ? 0.42 : 0.26, this.weaponCooldown(w) * 0.85);
        const p = this.player;
        let tx = target.x;
        let ty = target.y;
        const dd = Math.hypot(tx - p.x, ty - p.y);
        if (dd > range) { tx = p.x + ((tx - p.x) / dd) * range; ty = p.y + ((ty - p.y) / dd) * range; }
        w.anim = { kind: d.kind, t: 0, dur, ang: Math.atan2(target.y - p.y, target.x - p.x), tx, ty, done: false, dmg, range };
        if (d.kind === 'sweep') {
          this.meleeSweep(w, d, w.anim);
          audio.play('swing');
        } else if (d.kind === 'thrust') {
          audio.play('swing');
        }
        break;
      }
      default:
        break;
    }
  }

  meleeSweep(w, d, a) {
    const p = this.player;
    const reach = a.range;
    const half = d.arc / 2;
    for (const e of this.query(p.x, p.y, reach)) {
      let da = Math.atan2(e.y - p.y, e.x - p.x) - a.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (Math.abs(da) <= half || dist < e.r + 18) this.hit(e, a.dmg, w, d, p.x, p.y);
    }
    this.arcs.push({ x: p.x, y: p.y, r: reach, a: a.ang, span: d.arc, life: 0.2, max: 0.2, color: ELEMENTS[d.elem].color });
  }

  updateMeleeAnim(w, d, dt, sx, sy) {
    const a = w.anim;
    const p = this.player;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    if (a.kind === 'sweep') {
      const ang = a.ang - d.arc / 2 + d.arc * easeOut(k);
      w.angle = ang;
      w.x = p.x + Math.cos(ang) * a.range * 0.62;
      w.y = p.y + Math.sin(ang) * a.range * 0.62;
    } else if (a.kind === 'thrust') {
      const ext = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;
      const dirX = Math.cos(a.ang);
      const dirY = Math.sin(a.ang);
      w.angle = a.ang;
      w.x = sx + dirX * (a.range - 22) * ext;
      w.y = sy + dirY * (a.range - 22) * ext;
      if (!a.done && k >= 0.45) {
        a.done = true;
        const ex = p.x + dirX * a.range;
        const ey = p.y + dirY * a.range;
        const half = d.width / 2;
        const hitList = [];
        for (const e of this.query((p.x + ex) / 2, (p.y + ey) / 2, a.range / 2 + half)) {
          if (distToSeg(e.x, e.y, p.x, p.y, ex, ey) < half + e.r) hitList.push(e);
        }
        const color = ELEMENTS[d.elem].color;
        for (const e of hitList) {
          this.hit(e, a.dmg, w, d, p.x, p.y);
          const jumps = d.chain[w.tier] + this.stats.chainBonus;
          if (jumps > 0 && !e.dead) {
            this.chainLightning(e, e.x, e.y, jumps, 110, (t2, idx) => { if (idx > 0) this.hit(t2, a.dmg * 0.5, w, d, e.x, e.y); }, color);
          }
        }
        this.beams.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, life: 0.12, max: 0.12, color, width: d.width * 0.6 });
      }
    } else if (a.kind === 'slam') {
      const out = k < 0.45 ? easeOut(k / 0.45) : 1 - (k - 0.45) / 0.55;
      w.angle = a.ang + (k < 0.45 ? -1.2 + 1.2 * (k / 0.45) : 0);
      w.x = sx + (a.tx - sx) * out;
      w.y = sy + (a.ty - sy) * out;
      if (!a.done && k >= 0.45) {
        a.done = true;
        const r = d.aoe[w.tier];
        for (const e of this.query(a.tx, a.ty, r)) this.hit(e, a.dmg, w, d, a.tx, a.ty);
        const color = ELEMENTS[d.elem].color;
        this.rings.push({ x: a.tx, y: a.ty, r0: 8, r1: r, life: 0.3, max: 0.3, color, width: 5 });
        this.burst(a.tx, a.ty, color, 10, 180);
        this.shake = Math.max(this.shake, 4);
        audio.play('slam');
      }
    }
    if (a.t >= a.dur) w.anim = null;
  }

  chainLightning(first, sx, sy, jumps, jumpRange, onHit, color) {
    const visited = new Set();
    const pts = [[sx, sy]];
    let cur = first;
    let idx = 0;
    while (cur && idx <= jumps) {
      visited.add(cur.id);
      pts.push([cur.x, cur.y]);
      const next = idx < jumps ? this.nearestEnemy(cur.x, cur.y, jumpRange, visited) : null;
      onHit(cur, idx);
      cur = next;
      idx++;
    }
    this.bolts.push({ pts, life: 0.16, max: 0.16, color, width: 2.5 });
  }

  // ================= Dash =================
  dash() {
    const p = this.player;
    if (this.state !== 'play' || p.dashCd > 0 || p.dashT > 0) return false;
    p.dashX = p.faceX;
    p.dashY = p.faceY;
    p.dashT = DASH_TIME;
    p.dashHit = new Set();
    p.dashCd = this.dashCooldown;
    p.iframes = Math.max(p.iframes, DASH_TIME + 0.15);
    this.rings.push({ x: p.x, y: p.y, r0: 10, r1: 34, life: 0.25, max: 0.25, color: this.char.color, width: 4 });
    audio.play('dash');
    return true;
  }

  dashHits(p) {
    const dmg = (8 + this.wave * 2.5) * Math.max(0.1, 1 + this.stats.dmg / 100) * this.stats.dashDmg;
    for (const e of this.query(p.x, p.y, p.r + 6)) {
      if (p.dashHit.has(e.id)) continue;
      p.dashHit.add(e.id);
      this.damage(e, dmg, this.char.color, true);
    }
  }

  // ================= Zonen (Napalm) & Gefahren =================
  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.4;
        for (const e of this.query(z.x, z.y, z.r)) this.hit(e, z.dmg, z.w, z.d);
        if (Math.random() < 0.8) this.particle(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.7, 0, -40, 0.5, '#ff7a2a', 4);
      }
      if (z.t <= 0) this.zones.splice(i, 1);
    }
  }

  // Verzögerte Explosionen (Modifikator EXPLOSIV)
  updateHazards(dt) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt;
      if (h.t <= 0) {
        if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r) this.hurtPlayer(h.dmg);
        this.rings.push({ x: h.x, y: h.y, r0: 6, r1: h.r, life: 0.25, max: 0.25, color: '#ff6a2a', width: 5 });
        this.burst(h.x, h.y, '#ff6a2a', 8, 180);
        this.hazards.splice(i, 1);
      }
    }
  }

  // ================= Projektile =================
  updateProjectiles(dt) {
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i];
      let remove = false;
      if (pr.kind === 'mortar') {
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.dur);
        pr.x = pr.sx + (pr.tx - pr.sx) * k;
        pr.y = pr.sy + (pr.ty - pr.sy) * k;
        pr.z = Math.sin(k * Math.PI) * 60;
        if (k >= 1) {
          if (pr.d.kind === 'puddle') {
            this.zones.push({ x: pr.tx, y: pr.ty, r: pr.aoe, t: pr.d.dur, max: pr.d.dur, tick: 0, dmg: pr.dmg, w: pr.w, d: pr.d });
            this.rings.push({ x: pr.tx, y: pr.ty, r0: 6, r1: pr.aoe, life: 0.25, max: 0.25, color: pr.color, width: 4 });
            audio.play('flame');
          } else {
            this.explode(pr.tx, pr.ty, pr.aoe, pr.dmg, pr.w, pr.d, pr.color);
          }
          remove = true;
        }
      } else {
        if (pr.kind === 'homing') {
          if (!pr.target || pr.target.dead) pr.target = this.nearestEnemy(pr.x, pr.y, 350);
          if (pr.target) {
            const ta = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
            const ca = Math.atan2(pr.vy, pr.vx);
            const na = lerpAngle(ca, ta, Math.min(1, dt * 7));
            const spd = Math.hypot(pr.vx, pr.vy);
            pr.vx = Math.cos(na) * spd;
            pr.vy = Math.sin(na) * spd;
          }
        }
        if (pr.kind === 'boomerang') {
          pr.spin += dt * 14;
          if (pr.out) {
            pr.dist += pr.speed * dt;
            if (pr.dist >= pr.range) { pr.out = false; pr.hit.clear(); }
          } else {
            const pl = this.player;
            const bx = pl.x - pr.x;
            const by = pl.y - pr.y;
            const bd = Math.hypot(bx, by) || 1;
            pr.vx = (bx / bd) * pr.speed * 1.15;
            pr.vy = (by / bd) * pr.speed * 1.15;
            if (bd < 20) pr.life = 0;
          }
        }
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.life -= dt;
        if (pr.kind === 'flame') pr.r = 6 + (1 - pr.life / pr.max) * 12;
        if (pr.x < -20 || pr.y < -20 || pr.x > ARENA.w + 20 || pr.y > ARENA.h + 20) pr.life = 0;

        const hits = this.query(pr.x, pr.y, pr.r);
        for (let h = 0; h < hits.length; h++) {
          const e = hits[h];
          if (pr.hit.has(e.id)) continue;
          pr.hit.add(e.id);
          if (pr.kind === 'orb') {
            this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.w, pr.d, pr.color);
            remove = true;
            break;
          }
          this.hit(e, pr.dmg, pr.w, pr.d, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05);
          if (pr.d.blast) this.explode(pr.x, pr.y, pr.d.blast, pr.dmg * 0.6, pr.w, pr.d, pr.color);
          if (pr.kind === 'bullet' || pr.kind === 'homing') this.burst(pr.x, pr.y, pr.color, 3, 120);
          pr.pierce--;
          if (pr.pierce < 0) { remove = true; break; }
        }
        if (pr.life <= 0) {
          if (pr.kind === 'orb' && !remove) this.explode(pr.x, pr.y, pr.aoe, pr.dmg, pr.w, pr.d, pr.color);
          remove = true;
        }
      }
      if (remove) list.splice(i, 1);
    }
  }

  explode(x, y, r, dmg, w, d, color) {
    for (const e of this.query(x, y, r)) this.hit(e, dmg, w, d, x, y);
    this.rings.push({ x, y, r0: 6, r1: r, life: 0.28, max: 0.28, color, width: 4 });
    this.light(x, y, r * 1.8, color, 0.25);
    this.burst(x, y, color, 10, 200);
    audio.play('boom');
  }

  // ================= Schaden & Elemente =================
  hit(e, base, w, d, fromX, fromY) {
    if (e.dead) return;
    let dmg = base;
    let crit = false;
    if (Math.random() * 100 < this.stats.crit) { dmg *= 2; crit = true; }
    if (e.shock > 0) dmg *= 1 + SHOCK_BONUS;
    if (this.raging) dmg *= 1.2;
    const rage = this.ult.active && this.ult.active.type === 'rage';
    if (rage) dmg *= 1.5;
    if ((d.drain || rage) && this.player.lsBudget >= 1 && this.player.hp < this.stats.maxHp) {
      this.player.lsBudget -= 1;
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 1);
    }
    // Blitz zerstört Schilde doppelt so schnell
    if (e.shieldHp > 0 && d.elem === 'bolt') dmg *= 2;
    this.damage(e, dmg, crit ? '#fff27a' : '#ffffff', crit);
    if (e.dead) { this.lifesteal(); return; }
    this.applyElement(e, d.elem, w.tier, dmg, d);
    if (crit && this.stats.prism > 0 && !e.dead) {
      const others = ELEMENT_ORDER.filter((el) => el !== d.elem);
      this.applyElement(e, pick(others), w.tier, dmg, PRISM_D);
    }
    if (d.knock && !e.def.boss && e.def.speed > 0 && fromX !== undefined) {
      const dx = e.x - fromX;
      const dy = e.y - fromY;
      const len = Math.hypot(dx, dy) || 1;
      const kb = d.knock * (e.elite ? 0.3 : 1) * 4;
      e.kx += (dx / len) * kb;
      e.ky += (dy / len) * kb;
    }
    this.lifesteal();
    audio.play('hit');
  }

  lifesteal() {
    const s = this.stats;
    const p = this.player;
    if (s.lifesteal <= 0 || p.hp >= s.maxHp || p.lsBudget < 1) return;
    if (Math.random() * 100 < s.lifesteal) {
      p.lsBudget -= 1;
      p.hp = Math.min(s.maxHp, p.hp + 1);
    }
  }

  damage(e, amount, color = '#fff', big = false) {
    if (e.dead) return;
    if (e.shieldHp > 0) {
      const ab = Math.min(e.shieldHp, amount);
      e.shieldHp -= ab;
      amount -= ab;
      e.shieldIdle = 3.5;
      if (e.shieldHp <= 0) {
        this.burst(e.x, e.y, '#3d8bff', 10, 160);
        this.rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 18, life: 0.25, max: 0.25, color: '#7db8ff', width: 3 });
      }
      if (amount <= 0) return;
    }
    e.hp -= amount;
    e.flash = 0.07;
    if (this.dmgMode === 'all' || (big && this.dmgMode === 'crit')) {
      this.addText(e.x + rand(-6, 6), e.y - e.r - 4, Math.max(1, Math.round(amount)), color, big ? 17 : 13);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  applyElement(e, elem, tier, hitDmg, d) {
    const s = this.stats;
    const em = this.elemMult();
    const isBoss = e.def.boss;
    if (elem === 'fire') {
      const dps = (d.burn ? d.burn[tier] : 3) * em * (1 + s.burnMult / 100);
      e.burnDps = Math.max(e.burnDps, dps);
      e.burnT = 2.6;
    } else if (elem === 'ice') {
      e.chill += d.chill ? d.chill[tier] : 1;
      e.slowT = 2.3;
      if (e.chill >= s.freezeStacks) {
        e.chill = 0;
        if (!isBoss) e.frozen = Math.max(e.frozen, 1.2 + tier * 0.15);
      }
    } else if (elem === 'bolt') {
      e.shock = BOLT_SHOCK_TIME;
    } else if (elem === 'void') {
      const st = d.voidStacks ? d.voidStacks[tier] : 1;
      e.voidStacks = Math.min(s.voidMax, e.voidStacks + st);
      e.voidT = 4;
      e.voidPow = Math.max(e.voidPow, (0.9 + tier * 0.55 + this.wave * 0.08) * em * (1 + s.voidMult / 100));
    }
    // Reaktion prüfen
    if (e.mark && e.mark !== elem && e.markT > 0 && e.reactCd <= 0) {
      const other = e.mark;
      e.mark = null;
      e.markT = 0;
      e.reactCd = e.def.boss ? 1.2 : 0.5;
      this.reaction(e, other, elem, hitDmg);
    } else if (e.reactCd <= 0) {
      e.mark = elem;
      e.markT = 3;
    }
  }

  reaction(e, a, b, hitDmg) {
    const key = reactionKey(a, b);
    const R = REACTIONS[key];
    const s = this.stats;
    const rd = (hitDmg * 0.9 + 4 + this.wave * 1.6) * this.elemMult() * (1 + s.reactionMult / 100);
    const x = e.x;
    const y = e.y;
    // Reaktionsnamen nicht zu oft anzeigen, sonst wird es unlesbar
    this.reactTextT = this.reactTextT || {};
    if (!(this.reactTextT[key] > this.time)) {
      this.reactTextT[key] = this.time + 0.6;
      this.addText(x, y - e.r - 18, R.name, R.color, 14, 0.9);
    }
    audio.play('reaction');
    this.light(x, y, 160, R.color, 0.3);
    if ((key === 'fire+bolt' || key === 'bolt+void') && this.time - this.lastFlash > 0.4) {
      this.lastFlash = this.time;
      this.screenFlash(R.color, 0.12);
    }
    this.reactionCount++;
    this.emit('reaction', key);
    switch (key) {
      case 'fire+ice': {
        for (const t of this.query(x, y, 85)) this.damage(t, rd * 1.4, R.color);
        this.rings.push({ x, y, r0: 10, r1: 85, life: 0.4, max: 0.4, color: R.color, width: 8 });
        this.burst(x, y, '#ffffff', 16, 140);
        break;
      }
      case 'fire+bolt': {
        for (const t of this.query(x, y, 105)) {
          if (!t.def.boss) {
            const dx = t.x - x;
            const dy = t.y - y;
            const len = Math.hypot(dx, dy) || 1;
            t.kx += (dx / len) * 520;
            t.ky += (dy / len) * 520;
          }
          this.damage(t, rd * 1.8, R.color);
        }
        this.rings.push({ x, y, r0: 10, r1: 105, life: 0.35, max: 0.35, color: R.color, width: 10 });
        this.burst(x, y, '#ffb340', 22, 260);
        this.shake = Math.max(this.shake, 6);
        audio.play('boom');
        break;
      }
      case 'fire+void': {
        const burn = Math.max(e.burnDps, 4 * this.elemMult());
        for (const t of this.query(x, y, 125)) {
          t.burnDps = Math.max(t.burnDps, burn);
          t.burnT = 3;
          t.voidStacks = Math.min(s.voidMax, t.voidStacks + 3);
          t.voidT = 4;
          t.voidPow = Math.max(t.voidPow, e.voidPow || 1.5);
          this.damage(t, rd * 0.6, R.color);
        }
        this.rings.push({ x, y, r0: 10, r1: 125, life: 0.45, max: 0.45, color: R.color, width: 6 });
        this.burst(x, y, '#ff4fa0', 18, 180);
        break;
      }
      case 'ice+bolt': {
        this.chainLightning(e, x, y, 5, 175, (t) => {
          this.damage(t, rd * 1.2, R.color);
          if (!t.dead && !t.def.boss) t.frozen = Math.max(t.frozen, 1);
        }, R.color);
        break;
      }
      case 'ice+void': {
        const extra = e.maxHp * (e.def.boss ? 0.02 : 0.1);
        this.damage(e, rd * 2.5 + extra, R.color, true);
        this.burst(x, y, '#c9b8ff', 20, 220);
        this.rings.push({ x, y, r0: 4, r1: 45, life: 0.25, max: 0.25, color: R.color, width: 5 });
        break;
      }
      case 'bolt+void': {
        if (this.vortices.length >= 4) this.vortices.shift();
        this.vortices.push({ x, y, t: 1.6, max: 1.6, r: 135, tick: 0, dmg: rd * 0.35 });
        break;
      }
      default: break;
    }
  }

  updateVortices(dt) {
    for (let i = this.vortices.length - 1; i >= 0; i--) {
      const v = this.vortices[i];
      v.t -= dt;
      v.tick -= dt;
      const doTick = v.tick <= 0;
      if (doTick) v.tick = 0.25;
      for (const e of this.query(v.x, v.y, v.r)) {
        if (!e.def.boss) {
          const dx = v.x - e.x;
          const dy = v.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const pull = 260 * Math.min(1, len / 30);
          e.x += (dx / len) * pull * dt;
          e.y += (dy / len) * pull * dt;
        }
        if (doTick) this.damage(e, v.dmg, REACTIONS['bolt+void'].color);
      }
      if (v.t <= 0) this.vortices.splice(i, 1);
    }
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.score += Math.max(1, e.xp) * 10;
    this.burst(e.x, e.y, e.def.color, e.def.boss ? 60 : 9, e.def.boss ? 400 : 170);
    if (!this.lowFx && this.corpses.length < 40) this.corpses.push({ sprite: e.sprite, x: e.x, y: e.y, rot: e.rot * 0.5, life: 0.22, max: 0.22 });
    audio.play('kill');
    this.chargeUlt(e.def.boss ? 40 : e.elite ? 15 : 2 + Math.min(6, e.xp));
    if (this.stats.detonator > 0 && ++this.killStreak % 8 === 0) {
      const dd = (12 + this.wave * 4) * Math.max(0.1, 1 + this.stats.dmg / 100) * this.stats.detonator;
      this.rings.push({ x: e.x, y: e.y, r0: 8, r1: 85, life: 0.3, max: 0.3, color: '#ff9a3d', width: 6 });
      this.burst(e.x, e.y, '#ff9a3d', 12, 220);
      audio.play('boom');
      for (const t of this.query(e.x, e.y, 85)) this.damage(t, dd, '#ff9a3d');
    }
    if (this.mod === 'explosiv' && !e.def.boss && this.hazards.length < 40) {
      this.hazards.push({ x: e.x, y: e.y, t: 0.7, max: 0.7, r: 48, dmg: e.dmg * 0.7 });
    }
    // Beute
    if (e.xp > 0) {
      const chunks = Math.min(6, Math.ceil(e.xp / 2));
      const per = Math.floor(e.xp / chunks);
      let rest = e.xp - per * chunks;
      for (let i = 0; i < chunks; i++) this.dropPickup(e.x, e.y, 'chip', per + (rest-- > 0 ? 1 : 0));
    }
    const luck = 1 + Math.max(-0.5, this.stats.luck / 100);
    if (!e.def.boss && Math.random() < 0.018 * luck) this.dropPickup(e.x, e.y, 'heal', 0);
    if (e.elite || (!e.def.boss && Math.random() < 0.006 * luck)) this.dropPickup(e.x, e.y, 'crate', 0);
    if (e.def.split) {
      for (let i = 0; i < 3; i++) {
        const m = this.createEnemy(e.def.split, e.x + rand(-12, 12), e.y + rand(-12, 12));
        m.kx = rand(-200, 200);
        m.ky = rand(-200, 200);
      }
    }
    if (e.def.boss) {
      this.bossAlive = false;
      this.boss = null;
      this.hooks.boss(null);
      this.shake = 14;
      audio.play('boom');
      // Großes Finale: Zeitlupe, Zoom, Blitz
      this.slowmo(1.6, 0.2);
      this.focusCam(e.x, e.y, 1.35, 1.8);
      this.screenFlash('#ffffff', 0.75);
      this.light(e.x, e.y, 500, e.def.color, 1.2);
      for (let i = 0; i < 4; i++) this.rings.push({ x: e.x, y: e.y, r0: 10 + i * 20, r1: 260 + i * 90, life: 0.6 + i * 0.2, max: 0.6 + i * 0.2, color: i % 2 ? '#ffffff' : e.def.color, width: 10 });
      for (let i = 0; i < 3; i++) this.dropPickup(e.x, e.y, 'crate', 0);
      this.score += e.type === 'omega' ? 5000 : 1500;
      this.emit('boss', e.type);
      if (e.type === 'omega' && !this.endless) {
        // Sieg!
        for (const o of this.enemies) if (!o.dead) { o.dead = true; this.burst(o.x, o.y, o.def.color, 6, 160); }
        this.victory = true;
        this.state = 'over';
        setTimeout(() => this.hooks.gameOver(true), 1200);
      }
    }
  }

  dropPickup(x, y, kind, value) {
    if (kind === 'chip' && this.pickups.length > 260) {
      // Zu viele Chips: Wert auf einen vorhandenen addieren
      const other = this.pickups[(Math.random() * this.pickups.length) | 0];
      if (other.kind === 'chip') { other.value += value; return; }
    }
    const a = Math.random() * Math.PI * 2;
    const sp = rand(40, 140);
    this.pickups.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, value, magnet: false, t: 0 });
  }

  openCrate(announce = true) {
    const id = this.randomItem(this.rollTier(this.wave + 2));
    this.addItem(id);
    if (announce) this.hooks.toast(`${ITEMS[id].icon} ${ITEMS[id].name} erhalten!`, '#ffd740');
    else this.crateItems = (this.crateItems || []).concat(id);
  }

  updatePickups(dt) {
    const p = this.player;
    const mr = this.magnetR;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      const damp = Math.exp(-dt * 5);
      if (!k.magnet) { k.vx *= damp; k.vy *= damp; }
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < mr || k.magnet) {
        k.magnet = true;
        const spd = 380 + k.t * 200;
        k.vx = (dx / (d || 1)) * spd;
        k.vy = (dy / (d || 1)) * spd;
      }
      if (d < p.r + 8) {
        this.pickups.splice(i, 1);
        if (k.kind === 'chip') {
          this.credits += k.value;
          this.addXp(k.value);
          audio.play('pickup');
        } else if (k.kind === 'heal') {
          const h = Math.max(4, Math.round(this.stats.maxHp * 0.12));
          p.hp = Math.min(this.stats.maxHp, p.hp + h);
          this.addText(p.x, p.y - 24, `+${h}`, '#4dff7a', 15);
          audio.play('heal');
        } else if (k.kind === 'crate') {
          this.openCrate(true);
          audio.play('buy');
        }
      }
    }
    // Credits aus Chips sind ganze Zahlen; Bruchteile über xp
  }

  // ================= Gegner =================
  updateEnemies(dt) {
    const p = this.player;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnT > 0) e.spawnT -= dt;
      if (e.shieldMax > 0) {
        if (e.shieldIdle > 0) e.shieldIdle -= dt;
        else if (e.shieldHp < e.shieldMax) e.shieldHp = Math.min(e.shieldMax, e.shieldHp + e.shieldMax * 0.25 * dt);
      }
      if (e.markT > 0) e.markT -= dt;
      if (e.reactCd > 0) e.reactCd -= dt;
      if (e.shock > 0) e.shock -= dt;
      if (e.slowT > 0) e.slowT -= dt; else e.chill = 0;
      if (e.frozen > 0) e.frozen -= dt;
      // Schaden über Zeit
      if (e.burnT > 0 || e.voidT > 0) {
        e.dotAcc += dt;
        if (e.dotAcc >= 0.5) {
          e.dotAcc -= 0.5;
          let dmg = 0;
          let col = '#ff8a3d';
          if (e.burnT > 0) dmg += e.burnDps * 0.5;
          if (e.voidT > 0 && e.voidStacks > 0) {
            const vd = e.voidStacks * e.voidPow * 0.5;
            if (vd > dmg) col = '#c07bff';
            dmg += vd;
          }
          if (dmg > 0) this.damage(e, dmg, col);
          if (e.dead) continue;
          if (e.burnT > 0 && Math.random() < 0.6) this.particle(e.x + rand(-e.r, e.r) * 0.5, e.y, rand(-10, 10), rand(-60, -30), 0.45, '#ff7a2a', 3);
        }
        e.burnT -= dt;
        e.voidT -= dt;
        if (e.burnT <= 0) e.burnDps = 0;
        if (e.voidT <= 0) { e.voidStacks = 0; e.voidPow = 0; }
      }

      // Rückstoß
      if (e.kx || e.ky) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        const kd = Math.exp(-dt * 9);
        e.kx *= kd;
        e.ky *= kd;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) e.kx = e.ky = 0;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.frozen <= 0) {
        const slow = e.slowT > 0 ? (e.def.boss ? 0.8 : 0.55) : 1;
        const spd = e.speed * slow;
        if (e.def.boss) {
          this.updateBoss(e, dt, nx, ny, dist, spd);
        } else if (e.def.laser) {
          this.updateTurret(e, dt, dx, dy, dist);
        } else if (e.def.heal) {
          const H = e.def.heal;
          const mv = dist > H.dist + 20 ? 1 : dist < H.dist - 30 ? -0.8 : 0;
          e.x += (nx * mv + ny * 0.3) * spd * dt;
          e.y += (ny * mv - nx * 0.3) * spd * dt;
          e.healT -= dt;
          if (e.healT <= 0) {
            e.healT = H.cd;
            let healed = false;
            for (const o of this.query(e.x, e.y, H.radius)) {
              if (o === e || o.hp >= o.maxHp) continue;
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.def.boss ? 0.015 : H.amount));
              healed = true;
            }
            if (healed) this.rings.push({ x: e.x, y: e.y, r0: 10, r1: H.radius, life: 0.4, max: 0.4, color: '#d4ff6b', width: 3 });
          }
        } else if (e.def.blink) {
          const B = e.def.blink;
          if (e.blinkTo) {
            e.blinkTo.t -= dt;
            if (e.blinkTo.t <= 0) {
              this.burst(e.x, e.y, e.def.color, 8, 140);
              e.x = e.blinkTo.x;
              e.y = e.blinkTo.y;
              e.blinkTo = null;
              e.spawnT = 0.15;
              this.burst(e.x, e.y, e.def.color, 8, 140);
            }
          } else {
            e.x += nx * spd * dt;
            e.y += ny * spd * dt;
            e.blinkT -= dt;
            if (e.blinkT <= 0 && dist > 140) {
              e.blinkT = B.cd * rand(0.8, 1.2);
              const a = Math.random() * Math.PI * 2;
              const r = rand(80, 120);
              e.blinkTo = { x: clamp(p.x + Math.cos(a) * r, 20, ARENA.w - 20), y: clamp(p.y + Math.sin(a) * r, 20, ARENA.h - 20), t: B.warn, max: B.warn };
            }
          }
        } else if (e.def.shoot) {
          const keep = e.def.shoot.dist;
          let mv = dist > keep + 20 ? 1 : dist < keep - 30 ? -0.7 : 0;
          e.x += (nx * mv - ny * 0.35) * spd * dt;
          e.y += (ny * mv + nx * 0.35) * spd * dt;
          e.shootT -= dt;
          if (e.shootT <= 0 && dist < keep + 160) {
            e.shootT = e.def.shoot.cd * rand(0.85, 1.15);
            this.enemyShot(e.x, e.y, Math.atan2(dy, dx), e.def.shoot.speed, e.dmg, e.def.color);
          }
        } else if (e.def.explode) {
          if (e.fuse < 0) {
            e.x += nx * spd * dt;
            e.y += ny * spd * dt;
            if (dist < 55) e.fuse = e.def.explode.fuse;
          } else {
            e.fuse -= dt;
            e.flash = (e.fuse * 10) % 1 < 0.5 ? 0.05 : 0;
            if (e.fuse <= 0) {
              const R = e.def.explode.radius;
              if (dist < R + p.r) this.hurtPlayer(e.dmg);
              this.rings.push({ x: e.x, y: e.y, r0: 6, r1: R, life: 0.3, max: 0.3, color: '#ffcc00', width: 6 });
              this.burst(e.x, e.y, '#ffcc00', 14, 220);
              audio.play('boom');
              e.dead = true;
              continue;
            }
          }
        } else {
          e.x += nx * spd * dt;
          e.y += ny * spd * dt;
        }
        e.rot += dt * (e.def.boss ? 0.6 : 1.5);
      }

      // Abstand zu anderen Gegnern
      const neigh = this.query(e.x, e.y, e.r, true);
      for (let n = 0; n < neigh.length; n++) {
        const o = neigh[n];
        if (o === e) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const od = Math.hypot(ox, oy) || 0.01;
        const overlap = e.r + o.r - od;
        if (overlap > 0) {
          const push = e.def.boss ? 0 : (o.def.boss ? 1 : 0.5);
          e.x += (ox / od) * overlap * push;
          e.y += (oy / od) * overlap * push;
        }
      }
      e.x = clamp(e.x, e.r, ARENA.w - e.r);
      e.y = clamp(e.y, e.r, ARENA.h - e.r);

      // Kontaktschaden
      if (e.frozen <= 0 && e.fuse < 0 && e.spawnT <= 0 && dist < e.r + p.r - 2) this.hurtPlayer(e.dmg, e);
    }
  }

  updateTurret(e, dt, dx, dy, dist) {
    const L = e.def.laser;
    const p = this.player;
    e.laserT -= dt;
    if (e.laserState === 'idle') {
      if (e.laserT <= 0 && dist < 650) { e.laserState = 'charge'; e.laserT = L.charge; }
    } else if (e.laserState === 'charge') {
      // Zielt mit, bis kurz vor dem Schuss – dann ist die Richtung fest
      if (e.laserT > 0.3) e.laserAng = Math.atan2(dy, dx);
      if (e.laserT <= 0) {
        e.laserState = 'fire';
        e.laserT = L.fire;
        e.laserHit = false;
        audio.play('rail');
      }
    } else if (e.laserState === 'fire') {
      if (!e.laserHit) {
        const ex = e.x + Math.cos(e.laserAng) * L.len;
        const ey = e.y + Math.sin(e.laserAng) * L.len;
        if (distToSeg(p.x, p.y, e.x, e.y, ex, ey) < p.r + 7) { e.laserHit = true; this.hurtPlayer(e.dmg); }
      }
      if (e.laserT <= 0) { e.laserState = 'idle'; e.laserT = L.cd * rand(0.85, 1.15); }
    }
  }

  updateBoss(e, dt, nx, ny, dist, spd) {
    const p = this.player;
    const enraged = e.hp < e.maxHp * 0.5;
    const omega = e.type === 'omega';
    e.phaseT -= dt;
    e.aiT -= dt;
    switch (e.phase) {
      case 'chase':
        e.x += nx * spd * (enraged ? 1.2 : 1) * dt;
        e.y += ny * spd * (enraged ? 1.2 : 1) * dt;
        if (e.phaseT <= 0) {
          const opts = omega ? ['ring', 'spiral', 'dash', 'summon'] : ['ring', 'dash'];
          e.phase = pick(opts);
          e.phaseT = e.phase === 'spiral' ? 3 : e.phase === 'dash' ? 0.7 : e.phase === 'summon' ? 0.8 : 1.4;
          e.aiT = 0;
          e.count = 0;
          if (e.phase === 'dash') { e.dashX = nx; e.dashY = ny; }
        }
        break;
      case 'ring':
        if (e.aiT <= 0) {
          e.aiT = enraged ? 0.45 : 0.6;
          const n = omega ? (enraged ? 22 : 18) : (enraged ? 16 : 12);
          const off = Math.random() * Math.PI;
          for (let i = 0; i < n; i++) this.enemyShot(e.x, e.y, off + (i / n) * Math.PI * 2, 170, e.dmg * 0.6, e.def.color);
        }
        if (e.phaseT <= 0) this.bossChase(e, enraged);
        break;
      case 'spiral':
        e.spin += dt * 3.2;
        if (e.aiT <= 0) {
          e.aiT = enraged ? 0.07 : 0.1;
          const arms = enraged ? 4 : 3;
          for (let i = 0; i < arms; i++) this.enemyShot(e.x, e.y, e.spin + (i / arms) * Math.PI * 2, 180, e.dmg * 0.5, '#ff7ad0');
        }
        if (e.phaseT <= 0) this.bossChase(e, enraged);
        break;
      case 'dash':
        // Anlauf (zittern), dann sprinten
        if (e.phaseT > 0) {
          e.dashX = nx;
          e.dashY = ny;
          e.flash = (e.phaseT * 12) % 1 < 0.5 ? 0.05 : 0;
        } else {
          e.x += e.dashX * 560 * dt;
          e.y += e.dashY * 560 * dt;
          if (e.phaseT < -0.55 || e.x <= e.r + 1 || e.y <= e.r + 1 || e.x >= ARENA.w - e.r - 1 || e.y >= ARENA.h - e.r - 1) {
            if (omega && enraged) for (let i = 0; i < 10; i++) this.enemyShot(e.x, e.y, (i / 10) * Math.PI * 2, 150, e.dmg * 0.5, e.def.color);
            this.bossChase(e, enraged);
          }
        }
        break;
      case 'summon':
        if (e.phaseT <= 0) {
          const n = enraged ? 8 : 5;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            this.markers.push({ x: clamp(e.x + Math.cos(a) * 90, 30, ARENA.w - 30), y: clamp(e.y + Math.sin(a) * 90, 30, ARENA.h - 30), t: 0.6, max: 0.6, type: i % 2 ? 'runner' : 'drone', elite: false });
          }
          this.bossChase(e, enraged);
        }
        break;
      default:
        this.bossChase(e, enraged);
    }
    void p;
  }

  bossChase(e, enraged) {
    e.phase = 'chase';
    e.phaseT = enraged ? rand(1.2, 1.8) : rand(2, 2.8);
  }

  enemyShot(x, y, ang, speed, dmg, color) {
    if (this.ebullets.length > 300) return;
    this.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 6, dmg, life: 5, color });
    audio.play('enemyShot');
  }

  updateEnemyBullets(dt) {
    const p = this.player;
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy < (b.r + p.r - 3) ** 2) {
        this.hurtPlayer(b.dmg);
        this.ebullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || b.x < -10 || b.y < -10 || b.x > ARENA.w + 10 || b.y > ARENA.h + 10) this.ebullets.splice(i, 1);
    }
  }

  hurtPlayer(amount, src = null) {
    const p = this.player;
    if (p.iframes > 0 || this.state !== 'play') return;
    const s = this.stats;
    if (Math.random() * 100 < Math.min(60, s.dodge)) {
      p.iframes = 0.2;
      this.addText(p.x, p.y - 26, 'AUSGEWICHEN', '#9ad8ff', 12);
      return;
    }
    if (s.shield > 0 && p.shieldT <= 0) {
      p.shieldT = 7;
      p.iframes = 0.4;
      this.addText(p.x, p.y - 26, 'GEBLOCKT', '#7df9ff', 13);
      this.rings.push({ x: p.x, y: p.y, r0: 16, r1: 40, life: 0.3, max: 0.3, color: '#7df9ff', width: 4 });
      audio.play('shield');
      return;
    }
    const dmg = Math.max(1, Math.round(amount * this.armorFactor()));
    if (src && s.thorns > 0 && !src.dead) this.damage(src, (amount * 1.5 + this.wave) * s.thorns, '#a8ff60');
    if (p.hp - dmg <= 0 && s.lastStand > 0 && !p.lastStandUsed) {
      p.lastStandUsed = true;
      p.hp = 1;
      p.iframes = 2;
      this.addText(p.x, p.y - 26, 'NOTFALL-PROTOKOLL!', '#ff4060', 14, 1.2);
      this.rings.push({ x: p.x, y: p.y, r0: 10, r1: 70, life: 0.5, max: 0.5, color: '#ff4060', width: 6 });
      audio.play('shield');
      return;
    }
    p.hp -= dmg;
    p.iframes = 0.45;
    this.glitchT = 0.22;
    this.addText(p.x, p.y - 26, `-${dmg}`, '#ff4060', 16);
    this.shake = Math.max(this.shake, 6);
    this.hooks.vibrate(35);
    audio.play('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      this.burst(p.x, p.y, this.char.color, 40, 300);
      audio.play('gameover');
      setTimeout(() => this.hooks.gameOver(false), 900);
    }
  }

  // ================= Ultimate =================
  get ultReady() { return this.ult.charge >= 100 && !this.ult.active; }

  chargeUlt(v) {
    if (this.ult.active) return;
    const before = this.ult.charge;
    this.ult.charge = Math.min(100, this.ult.charge + v);
    if (before < 100 && this.ult.charge >= 100) {
      audio.play('ultReady');
      this.emit('ultReady');
    }
  }

  ultDmg(base, perWave) {
    return (base + perWave * this.wave) * Math.max(0.2, 1 + this.stats.dmg / 100) * (1 + this.stats.elem / 200);
  }

  useUlt() {
    if (this.state !== 'play' || !this.ultReady) return false;
    const p = this.player;
    const id = this.char.id;
    const U = ULTS[id] || ULTS.vex;
    this.ult.charge = 0;
    this.buildGrid();
    this.addText(p.x, p.y - 44, U.name, this.char.color, 20, 1.3);
    this.screenFlash(this.char.color, 0.45);
    this.light(p.x, p.y, 420, this.char.color, 0.6);
    this.shake = Math.max(this.shake, 9);
    this.focusCam(p.x, p.y, 1.12, 0.6);
    audio.play('ult');
    this.emit('ult', id);
    const start = (type, dur, extra = {}) => { this.ult.active = { type, t: dur, max: dur, tick: 0, spin: 0, ...extra }; };
    switch (id) {
      case 'nyx': {
        // Blitze aus dem Himmel auf die nächsten 30 Gegner
        const dmg = this.ultDmg(45, 12);
        const near = this.enemies.filter((e) => !e.dead)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 30);
        for (const e of near) {
          this.bolts.push({ pts: [[e.x + rand(-30, 30), e.y - 320], [e.x + rand(-25, 25), e.y - 160], [e.x, e.y]], life: 0.35, max: 0.35, color: '#ffe94a', width: 4 });
          this.damage(e, dmg, '#ffe94a', true);
          if (!e.dead) {
            e.shock = 4;
            if (!e.def.boss) e.frozen = Math.max(e.frozen, 1.8);
          }
        }
        audio.play('zap');
        break;
      }
      case 'brock': start('quake', 1.3, { waves: 0 }); break;
      case 'echo': start('shadow', 6); break;
      case 'ronin':
        start('rage', 6);
        p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.maxHp * 0.4);
        break;
      case 'kai': start('drones', 8, { drones: [] }); break;
      case 'prisma': {
        const dmg = this.ultDmg(30, 8);
        const cols = ['#ff6a2a', '#5fe3ff', '#ffe94a', '#b45cff'];
        cols.forEach((c, i) => this.rings.push({ x: p.x, y: p.y, r0: 20, r1: 330 - i * 25, life: 0.5 + i * 0.1, max: 0.5 + i * 0.1, color: c, width: 9 }));
        for (const e of this.query(p.x, p.y, 330)) {
          this.damage(e, dmg, '#ffffff', true);
          for (const el of ELEMENT_ORDER) {
            if (e.dead) break;
            e.reactCd = 0;
            this.applyElement(e, el, 3, dmg, PRISM_D);
          }
        }
        break;
      }
      default:
        start('blades', 4);
        p.iframes = Math.max(p.iframes, 0.6);
    }
    return true;
  }

  updateUlt(dt) {
    const u = this.ult.active;
    if (!u) return;
    const p = this.player;
    u.t -= dt;
    u.tick -= dt;
    u.spin += dt;
    switch (u.type) {
      case 'blades':
        if (u.tick <= 0) {
          u.tick = 0.15;
          for (const e of this.query(p.x, p.y, 160)) {
            this.damage(e, this.ultDmg(9, 3), '#ff8a5a');
            if (!e.dead) { e.burnDps = Math.max(e.burnDps, this.ultDmg(6, 1.5)); e.burnT = 2.5; }
          }
        }
        break;
      case 'quake': {
        const times = [0, 0.4, 0.8];
        while (u.waves < 3 && u.max - u.t >= times[u.waves]) {
          const r = 190 + u.waves * 70;
          for (const e of this.query(p.x, p.y, r)) {
            this.damage(e, this.ultDmg(28, 8), '#9df3ff', true);
            if (e.dead) continue;
            if (!e.def.boss) e.frozen = Math.max(e.frozen, 2);
            e.slowT = 3;
          }
          this.rings.push({ x: p.x, y: p.y, r0: 20, r1: r, life: 0.45, max: 0.45, color: '#9df3ff', width: 12 });
          this.burst(p.x, p.y, '#bff6ff', 20, r * 2);
          this.shake = Math.max(this.shake, 10);
          audio.play('slam');
          u.waves++;
        }
        break;
      }
      case 'shadow':
        if (u.tick <= 0) {
          u.tick = 0.12;
          const near = this.query(p.x, p.y, 450);
          const target = near.length ? pick(near) : null;
          if (target) {
            const a = Math.atan2(target.y - p.y, target.x - p.x) + rand(-0.6, 0.6);
            this.projectiles.push({
              kind: 'homing', x: p.x, y: p.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460,
              r: 6, dmg: this.ultDmg(12, 3.5), w: ULT_W, d: ULT_VOID_D, color: '#b45cff', pierce: 1, life: 2, target, hit: new Set(),
            });
          }
        }
        break;
      case 'drones': {
        u.drones.length = 6;
        for (let k = 0; k < 6; k++) {
          const a = u.spin * 2 + (k / 6) * Math.PI * 2;
          u.drones[k] = { x: p.x + Math.cos(a) * 95, y: p.y + Math.sin(a) * 95, a };
        }
        if (u.tick <= 0) {
          u.tick = 0.35;
          for (const dr of u.drones) {
            const t = this.nearestEnemy(dr.x, dr.y, 260);
            if (t) this.chainLightning(t, dr.x, dr.y, 1, 120, (e) => this.hit(e, this.ultDmg(8, 2.5), ULT_W, ULT_BOLT_D, dr.x, dr.y), '#7dffef');
          }
          audio.play('zap');
        }
        break;
      }
      default:
        break;
    }
    if (u.t <= 0) this.ult.active = null;
  }

  // ================= Spektakel =================
  slowmo(t, scale) {
    if (this.lowFx && scale < 0.5) scale = 0.5;
    this.slowT = Math.max(this.slowT, t);
    this.slowScale = scale;
  }

  focusCam(x, y, zoom, t) {
    this.cam.x = x;
    this.cam.y = y;
    this.cam.zoom = zoom;
    this.cam.t = t;
  }

  screenFlash(color, a) {
    if (!this.flashFx || this.flashFx.a < a) this.flashFx = { color, a };
  }

  light(x, y, r, color, life) {
    if (this.lowFx || this.lights.length > 24) return;
    this.lights.push({ x, y, r, color, life, max: life });
  }

  // ================= Effekte =================
  particle(x, y, vx, vy, life, color, size) {
    if (this.particles.length >= (this.lowFx ? 120 : MAX_PARTICLES)) return;
    this.particles.push({ x, y, vx, vy, life, max: life, color, size });
  }

  burst(x, y, color, n, speed) {
    if (this.lowFx) n = Math.ceil(n * 0.35);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.55), color, rand(2, 4));
    }
  }

  addText(x, y, txt, color, size = 13, life = 0.6) {
    if (this.texts.length >= MAX_TEXTS) {
      if (typeof txt === 'number') return;
      this.texts.shift();
    }
    this.texts.push({ x, y, txt, color, size, life, max: life });
  }

  updateEffects(dt) {
    const decay = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].life -= dt;
        if (arr[i].life <= 0) arr.splice(i, 1);
      }
    };
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.92;
      q.vy *= 0.92;
    }
    for (const t of this.texts) t.y -= 40 * dt;
    decay(this.particles);
    decay(this.texts);
    decay(this.rings);
    decay(this.bolts);
    decay(this.beams);
    decay(this.arcs);
    decay(this.corpses);
    decay(this.lights);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

  }

  // Effekte auch in Pausen ausklingen lassen
  realtimeFx(dt) {
    if (this.cam.t > 0) this.cam.t -= dt;
    if (this.glitchT > 0) this.glitchT -= dt;
    if (this.flashFx) {
      this.flashFx.a -= dt * 1.8;
      if (this.flashFx.a <= 0) this.flashFx = null;
    }
  }

  updateIdle(dt) {
    this.realtimeFx(dt);
    if (this.slowT > 0) this.slowT -= dt;
    this.updateEffects(dt * (this.slowT > 0 ? 0.35 : 1));
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
