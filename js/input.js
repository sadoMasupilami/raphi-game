// Eingabe: schwebender Touch-Joystick + Tastatur (WASD / Pfeiltasten)

const JOY_RADIUS = 56;

export const input = {
  x: 0,
  y: 0,
  padX: 0,
  padY: 0,
  joy: { active: false, id: null, ox: 0, oy: 0, kx: 0, ky: 0 },
  keys: new Set(),

  attach(el) {
    el.addEventListener('pointerdown', (e) => {
      if (this.joy.active) return;
      e.preventDefault();
      this.joy.active = true;
      this.joy.id = e.pointerId;
      this.joy.ox = this.joy.kx = e.clientX;
      this.joy.oy = this.joy.ky = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignorieren */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      e.preventDefault();
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) {
        // Joystick wandert mit, wenn der Finger weiter zieht
        const over = d - JOY_RADIUS;
        this.joy.ox += (dx / d) * over;
        this.joy.oy += (dy / d) * over;
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
      }
      this.joy.kx = e.clientX;
      this.joy.ky = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false;
      this.joy.id = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);

    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.joy.active = false; });
  },

  reset() {
    this.joy.active = false;
    this.joy.id = null;
    this.keys.clear();
    this.x = this.y = 0;
  },

  update() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (this.joy.active) {
      const dx = this.joy.kx - this.joy.ox;
      const dy = this.joy.ky - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const m = Math.min(1, d / JOY_RADIUS);
        x = (dx / d) * m;
        y = (dy / d) * m;
      }
    }
    if (!x && !y && (this.padX || this.padY)) {
      x = this.padX;
      y = this.padY;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.x = x;
    this.y = y;
  },

  JOY_RADIUS,
};
