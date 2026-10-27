// Controller-Unterstützung (Gamepad API): Steuerung im Spiel und Navigation in Menüs
import { input } from './input.js';

const DEAD = 0.25;
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export const gamepad = {
  connected: false,
  prev: [],
  focusEl: null,
  repeatT: 0,
  lastDir: null,

  // h: { playing(), dash(), ult(), pause(), toast(text) }
  poll(dt, h) {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const gp = pads.find((p) => p && p.connected);
    if (!gp) {
      if (this.connected) { this.connected = false; input.padX = input.padY = 0; }
      return;
    }
    if (!this.connected) {
      this.connected = true;
      h.toast('🎮 Controller verbunden: Stick = laufen · A = Dash · X = Ultimate · Start = Pause');
    }
    const pressed = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const just = (i) => pressed(i) && !this.prev[i];

    let x = Math.abs(gp.axes[0] || 0) > DEAD ? gp.axes[0] : 0;
    let y = Math.abs(gp.axes[1] || 0) > DEAD ? gp.axes[1] : 0;
    if (pressed(B.LEFT)) x = -1;
    if (pressed(B.RIGHT)) x = 1;
    if (pressed(B.UP)) y = -1;
    if (pressed(B.DOWN)) y = 1;

    if (h.playing()) {
      input.padX = x;
      input.padY = y;
      this.clearFocus();
      if (just(B.A) || just(B.RB) || just(B.LB)) h.dash();
      if (just(B.X) || just(B.Y) || just(B.RT) || just(B.LT)) h.ult();
      if (just(B.START)) h.pause();
    } else {
      input.padX = input.padY = 0;
      this.navigate(dt, x, y);
      if (just(B.A) && this.focusEl) this.focusEl.click();
      if (just(B.B)) this.back();
      if (just(B.START)) this.primary();
    }
    this.prev = gp.buttons.map((b) => b.pressed);
  },

  // ---------- Menü-Navigation ----------
  topScreen() {
    const vis = Array.from(document.querySelectorAll('.screen:not(.hidden)'));
    if (!vis.length) return null;
    const ov = vis.filter((s) => s.classList.contains('overlay'));
    return ov.length ? ov[ov.length - 1] : vis[vis.length - 1];
  },

  focusables(root) {
    return Array.from(root.querySelectorAll('button, .char-card:not(.locked)'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
  },

  setFocus(el) {
    if (this.focusEl) this.focusEl.classList.remove('pad-focus');
    this.focusEl = el;
    if (el) {
      el.classList.add('pad-focus');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },

  clearFocus() { this.setFocus(null); },

  navigate(dt, x, y) {
    const root = this.topScreen();
    if (!root) return;
    const list = this.focusables(root);
    if (!list.length) return;
    if (!this.focusEl || !list.includes(this.focusEl)) this.setFocus(list.find((el) => el.classList.contains('primary')) || list[0]);
    const dir = Math.abs(x) > 0.5 || Math.abs(y) > 0.5 ? (Math.abs(x) > Math.abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)]) : null;
    if (!dir) { this.lastDir = null; this.repeatT = 0; return; }
    const same = this.lastDir && this.lastDir[0] === dir[0] && this.lastDir[1] === dir[1];
    this.repeatT -= dt;
    if (same && this.repeatT > 0) return;
    this.repeatT = same ? 0.14 : 0.35;
    this.lastDir = dir;
    const r0 = this.focusEl.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    // Erst Ziele im Richtungskegel suchen, sonst irgendein Ziel in dieser Richtung
    const findBest = (cone) => {
      let best = null;
      let bestScore = Infinity;
      for (const el of list) {
        if (el === this.focusEl) continue;
        const r = el.getBoundingClientRect();
        const dx = r.left + r.width / 2 - cx;
        const dy = r.top + r.height / 2 - cy;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 4) continue;
        const perp = Math.abs(dx * dir[1] - dy * dir[0]);
        if (cone && perp > along * 1.2) continue;
        const score = along + perp * 2.2;
        if (score < bestScore) { bestScore = score; best = el; }
      }
      return best;
    };
    const best = findBest(true) || findBest(false);
    if (best) this.setFocus(best);
  },

  // Start-Taste: Hauptknopf des Bildschirms (Start, Weiter, Nächste Welle …)
  primary() {
    const root = this.topScreen();
    if (!root) return;
    const btns = Array.from(root.querySelectorAll('button.primary')).filter((b) => b.offsetParent !== null && !b.disabled);
    const btn = btns.find((b) => /START|WEITER|WELLE|LOS|EVOLV|NOCHMAL|SPIELEN/.test(b.textContent)) || btns[0];
    if (btn) btn.click();
  },

  // B-Taste: Zurück / Weiter
  back() {
    const root = this.topScreen();
    if (!root) return;
    const btn = Array.from(root.querySelectorAll('button')).find((b) => b.offsetParent !== null
      && (/back|resume|skip/i.test(b.id) || /ZURÜCK|WEITER$/.test(b.textContent.trim())));
    if (btn) btn.click();
  },
};
