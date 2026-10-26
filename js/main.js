// Einstieg: Menüs, HUD, Shop, Level-Up und Spielschleife
import {
  ELEMENTS, ELEMENT_ORDER, REACTIONS, WEAPONS, ITEMS, CHARACTERS, DIFFICULTIES, STAT_DEFS, SPECIAL_DEFS,
  BASE_STATS, WAVE_MODS, TIER_COLORS, TIER_NAMES, MAX_WAVE, SHOP_EVERY, MAX_WEAPONS, BOLT_SHOCK_TIME,
} from './data.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { weaponIconURL } from './sprites.js';

const $ = (s) => document.querySelector(s);
const STORE_KEY = 'neonnexus.v1';
// Wird beim Deployment durch die Commit-ID ersetzt (lokal: 'dev')
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || 'dev';

// ================= Speicher =================
const store = loadStore();
function loadStore() {
  const def = {
    settings: { sfx: true, music: true, vibrate: true, dmgMode: 'all', shake: true, fullscreen: true, dashSide: 'right' },
    highscores: {},
    lastChar: 'vex',
    lastDiff: 'normal',
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return def;
    const data = JSON.parse(raw);
    const settings = { ...def.settings, ...(data.settings || {}) };
    // Alte Einstellung (an/aus) übernehmen
    if (data.settings && data.settings.dmgNumbers === false && !data.settings.dmgMode) settings.dmgMode = 'off';
    delete settings.dmgNumbers;
    return { ...def, ...data, settings };
  } catch (_) {
    return def;
  }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) { /* privat-Modus */ }
}

// ================= Setup =================
const canvas = $('#game');
const renderer = new Renderer(canvas);
input.attach(canvas);
audio.sfx = store.settings.sfx;
audio.music = store.settings.music;
renderer.shakeOn = store.settings.shake;

let game = null;
let selectedChar = store.lastChar;
let selectedDiff = store.lastDiff;
let wakeLock = null;

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 200));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game && game.state === 'play') pauseGame();
    audio.suspend();
  } else {
    audio.resume();
    checkForUpdate();
  }
});
// Doppeltipp-Zoom und Kontextmenü verhindern
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Jeder Button-Klick: Audio aktivieren + Klick-Sound
document.addEventListener('click', (e) => {
  audio.init();
  if (e.target.closest('button')) audio.play('click');
}, true);

// ================= Screens =================
const SCREENS = ['menu', 'select', 'levelup', 'wave', 'shop', 'weapon', 'pause', 'stats', 'settings', 'howto', 'over'];
function show(name) {
  for (const s of SCREENS) $(`#screen-${s}`).classList.toggle('hidden', s !== name);
}
function openOverlay(name) { $(`#screen-${name}`).classList.remove('hidden'); }
function closeOverlay(name) { $(`#screen-${name}`).classList.add('hidden'); }
function hideAll() { for (const s of SCREENS) $(`#screen-${s}`).classList.add('hidden'); }

function toast(text, color = '#00f0ff') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--tc', color);
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function vibrate(ms) {
  if (store.settings.vibrate && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (_) { /* nicht unterstützt */ }
  }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (_) { /* egal */ }
}

function tryFullscreen() {
  if (!store.settings.fullscreen) return;
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

// ================= Hilfsfunktionen für Texte =================
const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const signed = (v, pct) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}${pct ? '%' : ''}`;

function statLine(key, val) {
  const def = STAT_DEFS.find((d) => d.key === key);
  let good = val > 0;
  if (key === 'freezeStacks') good = val < 0;
  const cls = good ? 'pos' : 'neg';
  if (def) return `<span class="${cls}">${signed(val, def.pct)} ${def.name}</span>`;
  if (SPECIAL_DEFS[key]) return `<span class="${cls}">${SPECIAL_DEFS[key](val)}</span>`;
  return '';
}

function itemDesc(id) {
  const it = ITEMS[id];
  return Object.entries(it.stats).map(([k, v]) => statLine(k, v)).join('<br>');
}

function elemTag(elem) {
  const e = ELEMENTS[elem];
  return `<span class="elem-tag" style="--ec:${e.color}">${e.icon} ${e.name}</span>`;
}

function weaponInfo(id, tier, g = game) {
  const d = WEAPONS[id];
  const w = { id, tier };
  const lines = [];
  const dmg = g ? g.weaponDamage(w) : d.dmg[tier];
  const flatName = d.type === 'melee' ? 'Nahkampf' : 'Fernkampf';
  lines.push(`Schaden: <b>${fmt(dmg)}</b> <small>(${d.dmg[tier]} + ${Math.round(d.scale * 100)}% ${flatName})</small>`);
  lines.push(`Abklingzeit: <b>${fmt(g ? g.weaponCooldown(w) : d.cd[tier])} s</b>`);
  lines.push(`Reichweite: <b>${Math.round(g ? g.weaponRange(w) : d.range)}</b>`);
  const em = g ? g.elemMult() : 1;
  if (d.burn) lines.push(`🔥 Brand: <b>${fmt(d.burn[tier] * em * (1 + (g ? g.stats.burnMult : 0) / 100))}</b>/s`);
  if (d.chill) lines.push(`❄️ Kälte: <b>${d.chill[tier]}</b> pro Treffer (Einfrieren bei ${g ? g.stats.freezeStacks : 5})`);
  if (d.elem === 'bolt') lines.push(`⚡ Schock: +${Math.round(20)}% Schaden für ${BOLT_SHOCK_TIME} s`);
  if (d.chain) lines.push(`Sprünge: <b>${d.chain[tier] + (g ? g.stats.chainBonus : 0)}</b>`);
  if (d.voidStacks) lines.push(`🌀 Korrosion: <b>${d.voidStacks[tier]}</b> Stapel pro Treffer`);
  if (d.pierce) lines.push(`Durchschlag: <b>${d.pierce[tier]}</b>`);
  if (d.aoe) lines.push(`Fläche: <b>${d.aoe[tier]}</b>`);
  if (d.count) lines.push(`Anzahl: <b>${d.count[tier]}</b>`);
  if (d.dur) lines.push(`Brenndauer: <b>${d.dur} s</b>`);
  return lines;
}

function weaponShortDesc(id, tier) {
  const d = WEAPONS[id];
  const info = weaponInfo(id, tier);
  return `${elemTag(d.elem)}<small>${d.type === 'melee' ? 'Nahkampf' : 'Fernkampf'}</small><br>${info.slice(0, 2).join(' · ')}<br><small>${d.desc}</small>`;
}

function weaponShopDesc(id, tier) {
  const d = WEAPONS[id];
  const w = { id, tier };
  return `${elemTag(d.elem)}<small>${d.type === 'melee' ? 'Nahkampf' : 'Fernkampf'}</small><br>`
    + `💥 ${fmt(game.weaponDamage(w))} · ⏱ ${fmt(game.weaponCooldown(w))} s<br><small>${d.desc}</small>`;
}

// ================= Menü =================
function renderHighscores() {
  const rows = Object.entries(DIFFICULTIES).map(([k, d]) => {
    const h = store.highscores[k];
    return `<div><b>${d.name.toUpperCase()}</b> &nbsp; ${h ? `Welle ${h.wave}${h.win ? ' 🏆' : ''} · ${h.score.toLocaleString('de-DE')} Punkte` : '—'}</div>`;
  });
  $('#highscores').innerHTML = `<div style="margin-bottom:4px">REKORDE</div>${rows.join('')}`;
}

function showMenu() {
  game = null;
  if (updatePending) { applyUpdate(); return; }
  $('#hud').classList.add('hidden');
  renderHighscores();
  show('menu');
}

$('#btn-play').onclick = () => {
  audio.init();
  renderSelect();
  show('select');
};
$('#btn-howto').onclick = () => { renderHowto(); openOverlay('howto'); };
$('#btn-howto-back').onclick = () => closeOverlay('howto');
$('#btn-settings').onclick = () => { renderSettings(); openOverlay('settings'); };
$('#btn-settings-back').onclick = () => closeOverlay('settings');
$('#btn-select-back').onclick = () => showMenu();

function renderSelect() {
  $('#char-grid').innerHTML = CHARACTERS.map((c) => {
    const wd = WEAPONS[c.weapon];
    const perks = c.perks.map((p) => `<li class="${p.startsWith('−') || p.startsWith('⚠') ? 'neg' : 'pos'}">${p}</li>`).join('');
    return `<div class="char-card ${c.id === selectedChar ? 'selected' : ''}" data-id="${c.id}" style="--c:${c.color}">
      <div class="char-avatar"></div>
      <div class="char-name">${c.name}</div>
      <div class="char-title">${c.title}</div>
      <div class="char-weapon"><img src="${weaponIconURL(c.weapon, ELEMENTS[wd.elem].color)}" alt="">${wd.name}</div>
      <ul class="char-perks">${perks}</ul>
    </div>`;
  }).join('');
  $('#char-grid').querySelectorAll('.char-card').forEach((el) => {
    el.onclick = () => {
      selectedChar = el.dataset.id;
      audio.play('click');
      renderSelect();
    };
  });
  $('#diff-row').innerHTML = Object.entries(DIFFICULTIES).map(([k, d]) =>
    `<button class="btn diff-btn ${k === selectedDiff ? 'selected' : ''}" data-id="${k}">${d.name.toUpperCase()}<small>${d.desc}</small></button>`).join('');
  $('#diff-row').querySelectorAll('.diff-btn').forEach((el) => {
    el.onclick = () => { selectedDiff = el.dataset.id; renderSelect(); };
  });
}

$('#btn-start').onclick = () => {
  store.lastChar = selectedChar;
  store.lastDiff = selectedDiff;
  saveStore();
  tryFullscreen();
  startGame();
};

// ================= Spiel starten =================
const hooks = {
  levelUp: () => showLevelUp(() => resumePlay()),
  waveEnd: () => afterWave(),
  gameOver: (win) => showGameOver(win),
  toast,
  boss: (e) => {
    $('#boss-bar').classList.toggle('hidden', !e);
    if (e) $('#boss-name').textContent = e.def.name;
  },
  vibrate,
};

function startGame() {
  game = new Game(selectedChar, selectedDiff, hooks);
  game.dmgMode = store.settings.dmgMode;
  hideAll();
  $('#hud').classList.remove('hidden');
  $('#boss-bar').classList.add('hidden');
  game.startWave();
  renderer.updateCamera(game, true);
  requestWakeLock();
}

function resumePlay() {
  hideAll();
  if (!game) return;
  game.state = 'play';
  game.player.iframes = Math.max(game.player.iframes, 0.8);
  input.reset();
}

function pauseGame() {
  if (!game || game.state !== 'play') return;
  game.state = 'paused';
  show('pause');
}

$('#btn-pause').onclick = () => pauseGame();
$('#btn-dash').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.init();
  if (game && game.dash()) vibrate(12);
});
$('#btn-resume').onclick = () => resumePlay();
$('#btn-pause-stats').onclick = () => { renderStats(); openOverlay('stats'); };
$('#btn-pause-settings').onclick = () => { renderSettings(); openOverlay('settings'); };
$('#btn-quit').onclick = () => {
  if (!game) return;
  game.state = 'over';
  showGameOver(false, true);
};
$('#btn-stats-back').onclick = () => closeOverlay('stats');
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && game) {
    e.preventDefault();
    game.dash();
  }
  if ((e.key === 'Escape' || e.key === 'p') && game) {
    if (game.state === 'play') pauseGame();
    else if (game.state === 'paused') resumePlay();
  }
});

// ================= Level-Up =================
function showLevelUp(onDone) {
  show('levelup');
  let cards = game.levelCards();
  const render = () => {
    $('#levelup-sub').textContent = game.pendingLevels > 1
      ? `Wähle ein Upgrade (noch ${game.pendingLevels})`
      : 'Wähle ein Upgrade';
    $('#levelup-cards').innerHTML = cards.map((c, i) => {
      const tc = TIER_COLORS[c.tier];
      if (c.type === 'stat') {
        const def = STAT_DEFS.find((d) => d.key === c.key);
        return `<button class="card" data-i="${i}" style="--tc:${tc}">
          <div class="card-icon">${def.icon}</div>
          <div class="card-body"><div class="card-title">${def.name}</div><div class="card-tier">${TIER_NAMES[c.tier]}</div>
          <div class="card-desc">${statLine(c.key, c.val)}</div></div></button>`;
      }
      const d = WEAPONS[c.id];
      const merge = game.weapons.length >= MAX_WEAPONS;
      return `<button class="card" data-i="${i}" style="--tc:${tc}">
        <div class="card-icon"><img src="${weaponIconURL(c.id, ELEMENTS[d.elem].color)}" alt=""></div>
        <div class="card-body"><div class="card-title">${d.name}</div><div class="card-tier">NEUE WAFFE · ${TIER_NAMES[c.tier]}${merge ? ' · verschmilzt' : ''}</div>
        <div class="card-desc">${weaponShortDesc(c.id, c.tier)}</div></div></button>`;
    }).join('');
    $('#levelup-cards').querySelectorAll('.card').forEach((el) => {
      el.onclick = () => {
        const c = cards[+el.dataset.i];
        game.applyCard(c);
        game.finishLevelUp();
        audio.play('buy');
        if (game.pendingLevels > 0) {
          cards = game.levelCards();
          render();
        } else {
          onDone();
        }
      };
    });
    const cost = game.levelRerollCost();
    const btn = $('#btn-level-reroll');
    btn.textContent = `🎲 NEU WÜRFELN (${cost})`;
    btn.disabled = game.credits < cost;
    btn.onclick = () => {
      if (game.credits < cost) return;
      game.credits -= cost;
      cards = game.levelCards();
      render();
    };
  };
  render();
}

// ================= Wellenende =================
function shopAfterWave(w) {
  return w % SHOP_EVERY === 0 || w === MAX_WAVE - 1 || w >= MAX_WAVE;
}

function afterWave() {
  if (!game) return;
  if (game.pendingLevels > 0) {
    showLevelUp(() => afterWave());
    return;
  }
  const info = game.lastWaveInfo || { collected: 0, harvest: 0 };
  if (game.crateItems && game.crateItems.length) {
    for (const id of game.crateItems) toast(`${ITEMS[id].icon} ${ITEMS[id].name} erhalten!`, '#ffd740');
    game.crateItems = [];
  }
  if (shopAfterWave(game.wave)) {
    game.openShop();
    renderShop(info);
    show('shop');
  } else {
    $('#wave-done-title').textContent = `WELLE ${game.wave} GESCHAFFT`;
    $('#wave-summary').innerHTML = `
      Eingesammelt: <span class="big-num">${Math.round(info.collected)}</span> Credits<br>
      Ernte: <span class="big-num">+${info.harvest}</span><br>
      ${info.interest ? `Zinsen: <span class="big-num">+${info.interest}</span><br>` : ''}
      Guthaben: <span class="big-num">${game.credits}</span>`;
    const left = SHOP_EVERY - (game.wave % SHOP_EVERY);
    $('#wave-next-shop').textContent = game.wave + 1 === MAX_WAVE
      ? '⚠ Als Nächstes: der Endboss!'
      : `Schwarzmarkt öffnet in ${left} Welle${left === 1 ? '' : 'n'}.`;
    show('wave');
  }
}

$('#btn-wave-next').onclick = () => nextWave();
$('#btn-wave-stats').onclick = () => { renderStats(); openOverlay('stats'); };
$('#btn-shop-next').onclick = () => nextWave();
$('#btn-shop-stats').onclick = () => { renderStats(); openOverlay('stats'); };

function nextWave() {
  hideAll();
  game.startWave();
  renderer.updateCamera(game, true);
  if (game.wave === MAX_WAVE) toast('FINALE WELLE: Zerstöre den OMEGA-KERN!', '#ff3d6a');
  else toast(`WELLE ${game.wave}`, '#00f0ff');
}

// ================= Shop =================
function renderShop(info) {
  const g = game;
  $('#shop-credits').textContent = g.credits;
  if (info) {
    $('#shop-sub').textContent = `Welle ${g.wave} geschafft · +${Math.round(info.collected)} Credits · Ernte +${info.harvest}${info.interest ? ` · Zinsen +${info.interest}` : ''}`;
  }
  $('#shop-offers').innerHTML = g.shopOffers.map((o, i) => {
    if (!o) return `<div class="offer empty">VERKAUFT</div>`;
    const tier = o.type === 'weapon' ? o.tier : ITEMS[o.id].tier;
    const tc = TIER_COLORS[tier];
    let icon;
    let title;
    let desc;
    if (o.type === 'weapon') {
      const d = WEAPONS[o.id];
      icon = `<img src="${weaponIconURL(o.id, ELEMENTS[d.elem].color)}" alt="">`;
      title = d.name;
      desc = weaponShopDesc(o.id, o.tier);
    } else {
      const it = ITEMS[o.id];
      icon = it.icon;
      title = it.name;
      desc = itemDesc(o.id);
    }
    const can = g.credits >= o.price;
    return `<div class="offer ${o.locked ? 'locked' : ''}" style="--tc:${tc}">
      <div class="offer-head"><div class="card-icon">${icon}</div>
        <div class="card-body"><div class="card-title">${title}</div>
        <div class="card-tier">${o.type === 'weapon' ? 'WAFFE' : 'ITEM'} · ${TIER_NAMES[tier]}</div></div></div>
      <div class="card-desc">${desc}</div>
      <div class="offer-bottom">
        <button class="btn lock ${o.locked ? 'on' : ''}" data-lock="${i}" aria-label="Sperren">${o.locked ? '🔒' : '🔓'}</button>
        <button class="btn primary buy ${can ? '' : 'cant'}" data-buy="${i}">KAUFEN ${o.price}</button>
      </div></div>`;
  }).join('');
  $('#shop-offers').querySelectorAll('[data-buy]').forEach((el) => {
    el.onclick = () => {
      const i = +el.dataset.buy;
      const res = g.buy(i);
      if (res === 'money') { audio.play('error'); toast('Nicht genug Credits', '#ff3d6a'); return; }
      if (res === 'slots') { audio.play('error'); toast('Alle 6 Waffenplätze belegt – verkaufe oder verschmelze eine Waffe', '#ff3d6a'); return; }
      if (res === 'type') { audio.play('error'); toast(`${g.char.name} kann nur ${g.char.onlyType === 'melee' ? 'Nahkampf' : 'Fernkampf'}waffen tragen`, '#ff3d6a'); return; }
      if (res === 'max') { audio.play('error'); toast('Dieses Item kannst du nur einmal haben', '#ff3d6a'); return; }
      if (res === 'merged') toast('Waffe verschmolzen! ⬆', '#ffe94a');
      audio.play('buy');
      renderShop();
    };
  });
  $('#shop-offers').querySelectorAll('[data-lock]').forEach((el) => {
    el.onclick = () => {
      const o = g.shopOffers[+el.dataset.lock];
      if (o) o.locked = !o.locked;
      renderShop();
    };
  });
  const rc = g.rerollCost();
  const rb = $('#btn-reroll');
  rb.textContent = `🎲 NEU (${rc})`;
  rb.disabled = g.credits < rc;
  rb.onclick = () => {
    if (g.reroll()) renderShop();
    else audio.play('error');
  };
  renderInventory();
}

function renderInventory() {
  const g = game;
  $('#weapon-count').textContent = `${g.weapons.length}/${MAX_WEAPONS}`;
  let html = '';
  for (let i = 0; i < MAX_WEAPONS; i++) {
    const w = g.weapons[i];
    if (!w) { html += `<div class="slot empty"></div>`; continue; }
    const d = WEAPONS[w.id];
    const canMerge = g.mergeTarget(i) >= 0;
    html += `<button class="slot" data-w="${i}" style="--tc:${TIER_COLORS[w.tier]}">
      <img src="${weaponIconURL(w.id, ELEMENTS[d.elem].color)}" alt="${d.name}">
      <span class="count">${['I', 'II', 'III', 'IV'][w.tier]}</span>
      ${canMerge ? '<span class="merge-dot">+</span>' : ''}</button>`;
  }
  $('#inv-weapons').innerHTML = html;
  $('#inv-weapons').querySelectorAll('[data-w]').forEach((el) => {
    el.onclick = () => showWeaponDetail(+el.dataset.w);
  });
  const counts = {};
  for (const id of g.items) counts[id] = (counts[id] || 0) + 1;
  const ids = Object.keys(counts);
  $('#inv-items').innerHTML = ids.length
    ? ids.map((id) => `<button class="slot" data-item="${id}" style="--tc:${TIER_COLORS[ITEMS[id].tier]}">${ITEMS[id].icon}${counts[id] > 1 ? `<span class="count">${counts[id]}</span>` : ''}</button>`).join('')
    : '<p class="hint" style="grid-column:1/-1">Noch keine Items.</p>';
  $('#inv-items').querySelectorAll('[data-item]').forEach((el) => {
    el.onclick = () => {
      const it = ITEMS[el.dataset.item];
      toast(`${it.icon} ${it.name}: ${itemDesc(el.dataset.item).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`, TIER_COLORS[it.tier]);
    };
  });
}

function showWeaponDetail(i) {
  const g = game;
  const w = g.weapons[i];
  const d = WEAPONS[w.id];
  const canMerge = g.mergeTarget(i) >= 0;
  const canSell = g.weapons.length > 1;
  $('#weapon-detail').innerHTML = `
    <div class="weapon-detail-head">
      <img src="${weaponIconURL(w.id, ELEMENTS[d.elem].color)}" alt="">
      <div><div class="card-title" style="--tc:${TIER_COLORS[w.tier]};color:${TIER_COLORS[w.tier]}">${d.name}</div>
      <div class="card-tier">${TIER_NAMES[w.tier]} · ${d.type === 'melee' ? 'Nahkampf' : 'Fernkampf'}</div>${elemTag(d.elem)}</div>
    </div>
    <p class="sub" style="text-align:left">${d.desc}</p>
    <div class="detail-stats">${weaponInfo(w.id, w.tier).join('<br>')}</div>
    <div class="menu-buttons">
      ${w.tier < 3 ? `<button class="btn primary" id="wd-merge" ${canMerge ? '' : 'disabled'}>⬆ VERSCHMELZEN ${canMerge ? '' : '(2× gleiche Stufe nötig)'}</button>` : '<p class="sub">Maximale Stufe erreicht</p>'}
      <button class="btn danger" id="wd-sell" ${canSell ? '' : 'disabled'}>VERKAUFEN · +${g.sellPrice(i)}</button>
      <button class="btn" id="wd-back">ZURÜCK</button>
    </div>`;
  openOverlay('weapon');
  const merge = $('#wd-merge');
  if (merge) merge.onclick = () => {
    if (g.mergeWeapon(i)) {
      audio.play('levelup');
      toast(`${d.name} → ${TIER_NAMES[w.tier]}!`, TIER_COLORS[w.tier]);
    }
    closeOverlay('weapon');
    renderShop();
  };
  $('#wd-sell').onclick = () => {
    if (g.sellWeapon(i)) audio.play('buy');
    closeOverlay('weapon');
    renderShop();
  };
  $('#wd-back').onclick = () => closeOverlay('weapon');
}

// ================= Werte =================
function renderStats() {
  const g = game;
  if (!g) return;
  const s = g.stats;
  let html = STAT_DEFS.map((d) => {
    const v = s[d.key];
    const base = BASE_STATS[d.key];
    const cls = v > base ? 'pos' : v < base ? 'neg' : '';
    return `<div class="stat-row"><span>${d.icon} ${d.name}</span><span class="v ${cls}">${fmt(v)}${d.pct ? '%' : ''}</span></div>`;
  }).join('');
  const extras = [];
  for (const k of Object.keys(SPECIAL_DEFS)) {
    const diff = s[k] - BASE_STATS[k];
    if (diff) extras.push(SPECIAL_DEFS[k](diff));
  }
  if (extras.length) html += `<div style="margin-top:8px">${extras.map((e) => `<div class="stat-extra">★ ${e}</div>`).join('')}</div>`;
  html += `<h3>WAFFEN</h3>${g.weapons.map((w) => {
    const d = WEAPONS[w.id];
    return `<div class="stat-row"><span style="color:${ELEMENTS[d.elem].color}">${ELEMENTS[d.elem].icon} ${d.name}</span><span class="v" style="color:${TIER_COLORS[w.tier]}">${['I', 'II', 'III', 'IV'][w.tier]}</span></div>`;
  }).join('')}`;
  html += `<div class="stat-row"><span>Schadensreduktion (Rüstung)</span><span class="v">${Math.round((1 - g.armorFactor()) * 100)}%</span></div>`;
  $('#stats-list').innerHTML = html;
}

// ================= Einstellungen =================
function renderSettings() {
  // [Schlüssel, Name, Auswahl (optional)]
  const opts = [
    ['sfx', 'Soundeffekte'],
    ['music', 'Musik'],
    ['vibrate', 'Vibration'],
    ['dmgMode', 'Schadenszahlen', [['all', 'Alle'], ['crit', 'Nur Krits'], ['off', 'Aus']]],
    ['dashSide', 'Dash-Knopf', [['right', 'Rechts'], ['left', 'Links']]],
    ['shake', 'Bildschirm-Wackeln'],
    ['fullscreen', 'Vollbild beim Start'],
  ];
  const optMap = Object.fromEntries(opts.map((o) => [o[0], o]));
  $('#settings-list').innerHTML = opts.map(([k, label, choices]) => {
    if (choices) {
      const cur = choices.find((c) => c[0] === store.settings[k]) || choices[0];
      return `<button class="toggle choice" data-k="${k}"><span>${label}</span><span class="val">${cur[1]} ›</span></button>`;
    }
    return `<button class="toggle ${store.settings[k] ? 'on' : ''}" data-k="${k}"><span>${label}</span><span class="sw"></span></button>`;
  }).join('');
  $('#settings-list').querySelectorAll('.toggle').forEach((el) => {
    el.onclick = () => {
      const k = el.dataset.k;
      const choices = optMap[k][2];
      if (choices) {
        const i = choices.findIndex((c) => c[0] === store.settings[k]);
        store.settings[k] = choices[(i + 1) % choices.length][0];
      } else {
        store.settings[k] = !store.settings[k];
      }
      saveStore();
      applySettings();
      renderSettings();
    };
  });
}

function applySettings() {
  audio.setSfx(store.settings.sfx);
  audio.setMusic(store.settings.music);
  renderer.shakeOn = store.settings.shake;
  if (game) game.dmgMode = store.settings.dmgMode;
  $('#btn-dash').classList.toggle('left', store.settings.dashSide === 'left');
}

// ================= Anleitung =================
function renderHowto() {
  const elems = ELEMENT_ORDER.map((k) => {
    const e = ELEMENTS[k];
    return `<div class="elem-box" style="--ec:${e.color}"><b>${e.icon} ${e.name.toUpperCase()}</b><br>${e.desc}</div>`;
  }).join('');
  const reacts = Object.entries(REACTIONS).map(([key, r]) => {
    const [a, b] = key.split('+');
    return `<div class="react"><span class="combo">${ELEMENTS[a].icon}+${ELEMENTS[b].icon}</span><span><b style="color:${r.color}">${r.name}</b> – ${r.desc}</span></div>`;
  }).join('');
  $('#howto').innerHTML = `
    <p>🕹️ <b>Steuerung:</b> Leg den Daumen irgendwo auf den Bildschirm und zieh – so läufst du. Deine Waffen zielen und feuern <b>automatisch</b>. Am PC: WASD oder Pfeiltasten.</p>
    <p>💨 <b>Dash:</b> Tippe auf <b>DASH</b> (am PC: Leertaste) für einen kurzen Sprint, bei dem du unverwundbar bist. Perfekt, um durch Gegnerhorden zu entkommen!</p>
    <p>⏱️ <b>Ziel:</b> Überlebe 20 Wellen. In Welle 10 wartet der <b>WÄCHTER</b>, in Welle 20 der <b>OMEGA-KERN</b>.</p>
    <p>💠 <b>Daten-Chips</b> von besiegten Gegnern geben Erfahrung (Level-Ups) und Credits. Kapseln <b>?</b> enthalten Items, grüne Kreuze heilen.</p>
    <p>🛒 Alle ${SHOP_EVERY} Wellen öffnet der <b>Schwarzmarkt</b>. Zwei gleiche Waffen gleicher Stufe kannst du zu einer stärkeren <b>verschmelzen</b> (bis Stufe IV). Mit 🔒 behältst du ein Angebot für später.</p>
    <p>❤️ Zu Beginn jeder Welle wirst du vollständig geheilt.</p>
    <h3>ELEMENTE</h3>
    <div class="elem-grid">${elems}</div>
    <h3>REAKTIONEN</h3>
    <p>Trifft ein Element einen Gegner, der schon ein <b>anderes</b> Element trägt (farbiger Punkt über dem Gegner), entsteht eine Reaktion. Kombiniere Waffen verschiedener Elemente!</p>
    ${reacts}`;
}

// ================= Spielende =================
function showGameOver(win, quit = false) {
  if (!game) return;
  const g = game;
  if (win && !g.endless) g.score += 10000;
  const key = g.diffId;
  const prev = store.highscores[key];
  const reached = g.wave;
  let record = false;
  if (!prev || g.score > prev.score) {
    store.highscores[key] = { wave: reached, score: g.score, win: win || g.victory || (prev && prev.win) || false, char: g.char.id };
    record = true;
    saveStore();
  } else if ((win || g.victory) && !prev.win) {
    prev.win = true;
    saveStore();
  }
  audio.play(win ? 'win' : 'gameover');
  $('#over-title').textContent = win ? 'SIEG! 🏆' : quit ? 'MISSION ABGEBROCHEN' : 'SYSTEM ZERSTÖRT';
  $('#over-title').classList.toggle('glow-yellow', !!win);
  $('#over-summary').innerHTML = `
    ${win ? 'Der OMEGA-KERN ist zerstört. Die Stadt ist gerettet!<br>' : ''}
    ${g.char.name} · ${DIFFICULTIES[key].name}<br>
    Welle: <span class="big-num">${reached}</span> &nbsp; Level: <span class="big-num">${g.level}</span><br>
    Besiegt: <span class="big-num">${g.kills}</span><br>
    Punkte: <span class="big-num">${g.score.toLocaleString('de-DE')}</span><br>
    ${record ? '<span class="new-record">★ NEUER REKORD ★</span>' : `Rekord: ${store.highscores[key].score.toLocaleString('de-DE')}`}`;
  $('#btn-endless').classList.toggle('hidden', !win);
  $('#hud').classList.add('hidden');
  show('over');
}

$('#btn-again').onclick = () => {
  if (updatePending) { applyUpdate(); return; }
  tryFullscreen();
  startGame();
};
$('#btn-menu').onclick = () => showMenu();
$('#btn-endless').onclick = () => {
  if (!game) return;
  game.endless = true;
  game.state = 'intermission';
  $('#hud').classList.remove('hidden');
  game.openShop();
  renderShop({ collected: 0, harvest: 0 });
  $('#shop-sub').textContent = 'Endlos-Modus: Wie lange hältst du durch?';
  show('shop');
};

// ================= Updates =================
// GitHub Pages cached Dateien bis zu 10 Minuten. Deshalb fragen wir version.json
// am Cache vorbei ab und laden bei einer neuen Version mit neuer URL neu.
let updatePending = null;

async function checkForUpdate() {
  if (APP_VERSION === 'dev' || updatePending) return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    if (!version || version === APP_VERSION) return;
    updatePending = version;
    if (!game || game.state === 'over') {
      if (!game) applyUpdate();
    } else {
      toast('⬆ Neue Version verfügbar – wird nach der Runde geladen', '#ffe94a');
    }
  } catch (_) { /* offline o. ä. */ }
}

function applyUpdate() {
  const v = updatePending;
  try {
    // Endlosschleife verhindern, falls doch noch eine alte Seite ausgeliefert wird
    if (sessionStorage.getItem('neonnexus.reloadedFor') === v) return;
    sessionStorage.setItem('neonnexus.reloadedFor', v);
  } catch (_) { /* egal */ }
  const url = new URL(location.href);
  url.searchParams.set('v', v);
  location.replace(url.toString());
}

$('#version').textContent = `Version ${APP_VERSION}`;
setInterval(checkForUpdate, 60000);
checkForUpdate();

// ================= HUD =================
const hudCache = {};
function setText(id, val) {
  if (hudCache[id] === val) return;
  hudCache[id] = val;
  document.getElementById(id).textContent = val;
}
function setScale(id, frac) {
  const v = Math.max(0, Math.min(1, frac)).toFixed(3);
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  document.getElementById(id).style.transform = `scaleX(${v})`;
}

function updateHUD() {
  const g = game;
  const p = g.player;
  setScale('hp-fill', p.hp / g.stats.maxHp);
  setText('hp-text', `${Math.ceil(p.hp)} / ${g.stats.maxHp}`);
  setScale('xp-fill', g.xp / g.xpNeeded());
  setText('xp-text', `LV ${g.level}`);
  setText('credits', String(g.credits));
  setText('wave-label', g.endless && g.wave > MAX_WAVE ? `ENDLOS ${g.wave}` : `WELLE ${g.wave}/${MAX_WAVE}`);
  let timer;
  if (g.waveTime === Infinity || (g.bossAlive && g.waveTime <= 0)) timer = 'BOSS';
  else timer = String(Math.max(0, Math.ceil(g.waveTime)));
  setText('wave-timer', timer);
  setText('wave-mod', g.mod ? `${WAVE_MODS[g.mod].icon} ${WAVE_MODS[g.mod].name}` : '');
  const urgent = timer !== 'BOSS' && g.waveTime <= 5;
  if (hudCache.urgent !== urgent) {
    hudCache.urgent = urgent;
    $('#wave-timer').classList.toggle('urgent', urgent);
  }
  if (g.boss) setScale('boss-fill', g.boss.hp / g.boss.maxHp);
  const cd = Math.max(0, g.player.dashCd / g.dashCooldown).toFixed(2);
  if (hudCache.dash !== cd) {
    hudCache.dash = cd;
    const btn = document.getElementById('btn-dash');
    btn.style.setProperty('--cd', cd);
    btn.classList.toggle('ready', cd === '0.00');
  }
}

// ================= Schleife =================
let last = performance.now();
let menuT = 0;
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  if (game) {
    if (game.state === 'play') game.update(dt);
    else if (game.state === 'over' || game.state === 'intermission') game.updateIdle(dt);
    renderer.updateCamera(game);
    renderer.draw(game);
    updateHUD();
  } else {
    menuT += dt;
    renderer.drawBackdrop(menuT);
  }
  requestAnimationFrame(frame);
}

applySettings();
showMenu();
requestAnimationFrame(frame);

// Für Tests/Debugging in der Konsole
window.neonNexus = { get game() { return game; } };
