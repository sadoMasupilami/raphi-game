// Zeichnet die Spielwelt auf das Canvas
import { ELEMENTS, WEAPONS } from './data.js';
import { ARENA } from './game.js';
import { input } from './input.js';
import { drawSprite, dotSprite, playerSprite, pickupSprite, weaponSprite, hexToRgba } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camX = 0;
    this.camY = 0;
    this.shakeOn = true;
    this.resize();
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.zoom = Math.max(0.6, Math.min(1.6, Math.min(this.w, this.h) / 480));
    this.viewW = this.w / this.zoom;
    this.viewH = this.h / this.zoom;
  }

  updateCamera(game, snap = false) {
    const p = game.player;
    const m = 50;
    let tx;
    let ty;
    if (this.viewW >= ARENA.w + m * 2) tx = (ARENA.w - this.viewW) / 2;
    else tx = Math.max(-m, Math.min(ARENA.w - this.viewW + m, p.x - this.viewW / 2));
    if (this.viewH >= ARENA.h + m * 2) ty = (ARENA.h - this.viewH) / 2;
    else ty = Math.max(-m, Math.min(ARENA.h - this.viewH + m, p.y - this.viewH / 2));
    if (snap) { this.camX = tx; this.camY = ty; return; }
    this.camX += (tx - this.camX) * 0.18;
    this.camY += (ty - this.camY) * 0.18;
  }

  draw(game) {
    const ctx = this.ctx;
    const z = this.zoom * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#04050c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!game) return;

    let sx = 0;
    let sy = 0;
    if (this.shakeOn && game.shake > 0) {
      sx = (Math.random() - 0.5) * game.shake * 2;
      sy = (Math.random() - 0.5) * game.shake * 2;
    }
    const cx = this.camX + sx;
    const cy = this.camY + sy;
    ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z);

    this.drawArena(ctx, cx, cy);
    this.drawMarkers(ctx, game);
    this.drawZones(ctx, game);
    this.drawPickups(ctx, game);
    this.drawVortices(ctx, game);
    this.drawEnemies(ctx, game);
    this.drawPlayer(ctx, game);

    ctx.globalCompositeOperation = 'lighter';
    this.drawEnemyBullets(ctx, game);
    this.drawProjectiles(ctx, game);
    this.drawEffects(ctx, game);
    ctx.globalCompositeOperation = 'source-over';
    this.drawTexts(ctx, game);

    // Bildschirm-Koordinaten
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawPointers(ctx, game);
    this.drawVignette(ctx, game);
    if (game.state === 'play') this.drawJoystick(ctx);
  }

  // Animierter Hintergrund fürs Menü
  drawBackdrop(t) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04050c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const z = this.zoom * this.dpr;
    const cx = 300 + Math.sin(t * 0.1) * 200;
    const cy = 300 + t * 25 % 600;
    ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    this.drawArena(ctx, cx, cy);
  }

  drawArena(ctx, cx, cy) {
    const x0 = Math.max(0, cx);
    const y0 = Math.max(0, cy);
    const x1 = Math.min(ARENA.w, cx + this.viewW);
    const y1 = Math.min(ARENA.h, cy + this.viewH);
    ctx.fillStyle = '#070a18';
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
    const step = 60;
    ctx.strokeStyle = 'rgba(60,140,255,0.09)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    // Akzentlinien
    ctx.strokeStyle = 'rgba(255,60,200,0.07)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / 300) * 300; x <= x1; x += 300) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.ceil(y0 / 300) * 300; y <= y1; y += 300) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    // Rand
    ctx.strokeStyle = 'rgba(0,240,255,0.18)';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
  }

  drawMarkers(ctx, game) {
    const t = game.time;
    for (const m of game.markers) {
      const k = 1 - m.t / m.max;
      const s = m.boss ? 40 : 9;
      const a = 0.4 + 0.5 * Math.abs(Math.sin(t * 12 + m.x));
      ctx.strokeStyle = `rgba(255,40,90,${a})`;
      ctx.lineWidth = m.boss ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(m.x - s, m.y - s); ctx.lineTo(m.x + s, m.y + s);
      ctx.moveTo(m.x + s, m.y - s); ctx.lineTo(m.x - s, m.y + s);
      ctx.stroke();
      if (m.boss) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 60 * (1 - k) + 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawPickups(ctx, game) {
    const chip = pickupSprite('chip');
    const heal = pickupSprite('heal');
    const crate = pickupSprite('crate');
    for (const k of game.pickups) {
      const sp = k.kind === 'chip' ? chip : k.kind === 'heal' ? heal : crate;
      const bob = Math.sin(game.time * 5 + k.x) * 1.5;
      drawSprite(ctx, sp, k.x, k.y + bob, k.kind === 'chip' ? game.time * 2 : 0, k.kind === 'chip' ? 0.8 + Math.min(0.6, k.value * 0.08) : 1);
    }
  }

  // Napalm-Flächen, verzögerte Explosionen, Teleport-Ziele, Laser-Visiere
  drawZones(ctx, game) {
    for (const z of game.zones) {
      const k = Math.min(1, z.t / 0.4);
      const flick = 0.85 + Math.random() * 0.15;
      ctx.fillStyle = `rgba(255,90,20,${0.22 * k * flick})`;
      ctx.strokeStyle = `rgba(255,140,40,${0.7 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const h of game.hazards) {
      const k = 1 - h.t / h.max;
      ctx.fillStyle = `rgba(255,70,30,${0.1 + 0.2 * k})`;
      ctx.strokeStyle = 'rgba(255,110,40,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const e of game.enemies) {
      if (e.blinkTo) {
        const b = e.blinkTo;
        const k = 1 - b.t / b.max;
        ctx.strokeStyle = `rgba(255,61,187,${0.4 + 0.5 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, e.r + 14 * (1 - k), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.laserState === 'charge' || e.laserState === 'fire') {
        const L = e.def.laser;
        const ex = e.x + Math.cos(e.laserAng) * L.len;
        const ey = e.y + Math.sin(e.laserAng) * L.len;
        ctx.lineCap = 'round';
        if (e.laserState === 'charge') {
          const locked = e.laserT <= 0.3;
          ctx.strokeStyle = locked ? `rgba(255,40,40,${0.5 + 0.4 * Math.abs(Math.sin(game.time * 30))})` : 'rgba(255,40,40,0.35)';
          ctx.lineWidth = locked ? 3 : 1.5;
        } else {
          ctx.strokeStyle = 'rgba(255,60,60,0.9)';
          ctx.lineWidth = 14;
        }
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (e.laserState === 'fire') {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    }
  }

  drawVortices(ctx, game) {
    for (const v of game.vortices) {
      const a = Math.min(1, v.t / 0.3);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,0,20,0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d58cff';
      for (let i = 0; i < 4; i++) {
        const rot = -game.time * 6 + (i * Math.PI) / 2;
        ctx.lineWidth = 3 - i * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30 + i * 22, rot, rot + 1.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawEnemies(ctx, game) {
    const vx0 = this.camX - 80;
    const vy0 = this.camY - 80;
    const vx1 = this.camX + this.viewW + 80;
    const vy1 = this.camY + this.viewH + 80;
    for (const e of game.enemies) {
      if (e.dead || e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
      const rot = e.def.shape === 'tri' || e.def.shape === 'spike' ? Math.atan2(game.player.y - e.y, game.player.x - e.x) : e.rot * 0.5;
      const sc = e.spawnT > 0 ? 1 - e.spawnT / 0.25 * 0.6 : 1;
      drawSprite(ctx, e.flash > 0 ? e.white : e.sprite, e.x, e.y, rot, sc);
      if (e.shieldHp > 0) {
        const f = e.shieldHp / e.shieldMax;
        ctx.strokeStyle = `rgba(110,180,255,${0.3 + 0.6 * f})`;
        ctx.fillStyle = `rgba(60,140,255,${0.12 * f})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (e.frozen > 0) {
        ctx.fillStyle = 'rgba(120,230,255,0.35)';
        ctx.strokeStyle = '#bff6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (e.slowT > 0) {
        ctx.strokeStyle = 'rgba(95,227,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.voidStacks > 0) {
        ctx.strokeStyle = 'rgba(180,92,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 6, game.time * 3, game.time * 3 + Math.min(6.2, e.voidStacks * 0.6));
        ctx.stroke();
      }
      if (e.shock > 0 && Math.random() < 0.5) {
        ctx.strokeStyle = '#ffe94a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const a = Math.random() * 6.28;
        ctx.moveTo(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
        ctx.lineTo(e.x + Math.cos(a + 0.4) * (e.r + 8), e.y + Math.sin(a + 0.4) * (e.r + 8));
        ctx.stroke();
      }
      // Element-Markierung (zeigt, welches Element eine Reaktion auslösen kann)
      if (e.mark && e.markT > 0) {
        ctx.fillStyle = ELEMENTS[e.mark].color;
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r - 7, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.fuse >= 0) {
        // Explosionsradius anzeigen, damit man rechtzeitig ausweichen kann
        const R = e.def.explode.radius;
        const k = 1 - e.fuse / e.def.explode.fuse;
        ctx.fillStyle = `rgba(255,60,40,${0.12 + 0.18 * k})`;
        ctx.strokeStyle = 'rgba(255,80,40,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,0,0.9)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, R * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Boss-Sprint ankündigen
      if (e.def.boss && e.phase === 'dash' && e.phaseT > 0) {
        ctx.strokeStyle = `rgba(255,40,90,${0.25 + 0.35 * Math.abs(Math.sin(game.time * 20))})`;
        ctx.lineWidth = e.r * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.dashX * 420, e.y + e.dashY * 420);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      if (e.elite && !e.def.boss) {
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - w / 2, e.y + e.r + 6, w, 4);
        ctx.fillStyle = '#ff3d6a';
        ctx.fillRect(e.x - w / 2, e.y + e.r + 6, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    if (game.state === 'over' && p.hp <= 0) return;
    // Waffen
    for (const w of game.weapons) {
      const d = WEAPONS[w.id];
      const spr = weaponSprite(w.id, ELEMENTS[d.elem].color);
      if (d.kind === 'orbit') {
        for (const sh of w.shards || []) drawSprite(ctx, spr, sh.x, sh.y, sh.a + Math.PI / 2, 0.8 + w.tier * 0.08);
        continue;
      }
      drawSprite(ctx, spr, w.x, w.y, w.angle, 0.9 + w.tier * 0.08);
    }
    const blink = p.iframes > 0 && game.state === 'play' && Math.floor(game.time * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    drawSprite(ctx, playerSprite(game.char.color), p.x, p.y);
    ctx.globalAlpha = 1;
    if (game.stats.shield > 0 && p.shieldT <= 0) {
      ctx.strokeStyle = 'rgba(125,249,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Sammelradius (dezent)
    ctx.strokeStyle = 'rgba(80,255,200,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, game.magnetR, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawEnemyBullets(ctx, game) {
    for (const b of game.ebullets) drawSprite(ctx, dotSprite(b.color, 5), b.x, b.y);
  }

  drawProjectiles(ctx, game) {
    for (const pr of game.projectiles) {
      switch (pr.kind) {
        case 'bullet':
          drawSprite(ctx, dotSprite(pr.color, 4), pr.x, pr.y);
          drawSprite(ctx, dotSprite(pr.color, 3), pr.x - pr.vx * 0.015, pr.y - pr.vy * 0.015, 0, 0.8);
          break;
        case 'flame': {
          const k = pr.life / pr.max;
          ctx.globalAlpha = Math.max(0, k);
          drawSprite(ctx, dotSprite(k > 0.5 ? '#ffb347' : '#ff4d1a', 6), pr.x, pr.y, 0, pr.r / 8);
          ctx.globalAlpha = 1;
          break;
        }
        case 'mortar':
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(pr.color, 0.35);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pr.tx, pr.ty, pr.aoe, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          drawSprite(ctx, dotSprite(pr.color, 6), pr.x, pr.y - (pr.z || 0));
          break;
        case 'homing':
          drawSprite(ctx, dotSprite(pr.color, 3), pr.x, pr.y);
          drawSprite(ctx, dotSprite(pr.color, 2), pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03, 0, 0.7);
          break;
        case 'orb':
          drawSprite(ctx, dotSprite(pr.color, 9), pr.x, pr.y, 0, 1 + Math.sin(game.time * 20) * 0.1);
          break;
        case 'boomerang':
          drawSprite(ctx, dotSprite(pr.color, 5), pr.x, pr.y);
          drawSprite(ctx, weaponSprite('gravBumerang', pr.color), pr.x, pr.y, pr.spin, 1.1);
          break;
        default:
          break;
      }
    }
  }

  drawEffects(ctx, game) {
    for (const a of game.arcs) {
      const k = a.life / a.max;
      ctx.strokeStyle = hexToRgba(a.color, 0.7 * k);
      ctx.lineWidth = 16 * k + 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * 0.75, a.a - a.span / 2, a.a + a.span / 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * 0.9, a.a - a.span / 2, a.a + a.span / 2);
      ctx.stroke();
    }
    for (const b of game.beams) {
      const k = b.life / b.max;
      ctx.strokeStyle = hexToRgba(b.color, 0.6 * k);
      ctx.lineWidth = b.width * k + 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = Math.max(1, b.width * 0.25 * k);
      ctx.stroke();
    }
    for (const b of game.bolts) {
      const k = b.life / b.max;
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? `rgba(255,255,255,${k})` : hexToRgba(b.color, 0.8 * k);
        ctx.lineWidth = pass ? 1.2 : b.width * 2.2;
        ctx.beginPath();
        for (let i = 0; i < b.pts.length - 1; i++) {
          const [x1, y1] = b.pts[i];
          const [x2, y2] = b.pts[i + 1];
          if (i === 0) ctx.moveTo(x1, y1);
          const segs = 4;
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const j = s === segs ? 0 : 9;
            ctx.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * j, y1 + (y2 - y1) * t + (Math.random() - 0.5) * j);
          }
        }
        ctx.stroke();
      }
    }
    for (const r of game.rings) {
      const k = r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - k * k);
      ctx.strokeStyle = hexToRgba(r.color, 0.85 * k);
      ctx.lineWidth = r.width * k + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(r.color, 0.12 * k);
      ctx.fill();
    }
    for (const q of game.particles) {
      const k = q.life / q.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = q.color;
      const s = q.size * (0.5 + k * 0.5);
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    for (const t of game.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `800 ${t.size}px Orbitron, system-ui, sans-serif`;
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // Pfeile am Bildschirmrand für wichtige Dinge außerhalb der Sicht
  drawPointers(ctx, game) {
    const b = game.boss;
    if (b && !b.dead) this.drawPointer(ctx, b.x, b.y, '#ff3d6a', 1.3);
    let n = 0;
    for (const e of game.enemies) {
      if (!e.elite || e.dead || e.def.boss) continue;
      this.drawPointer(ctx, e.x, e.y, '#ff7a9a', 0.9);
      if (++n > 6) break;
    }
    for (const k of game.pickups) if (k.kind === 'crate') this.drawPointer(ctx, k.x, k.y, '#ffd740', 0.8);
  }

  drawPointer(ctx, wx, wy, color, size) {
    const bx = (wx - this.camX) * this.zoom;
    const by = (wy - this.camY) * this.zoom;
    const m = 10;
    if (bx > -m && bx < this.w + m && by > -m && by < this.h + m) return;
    const ang = Math.atan2(by - this.h / 2, bx - this.w / 2);
    const px = Math.max(24, Math.min(this.w - 24, bx));
    const py = Math.max(90, Math.min(this.h - 24, by));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.scale(size, size);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawVignette(ctx, game) {
    const p = game.player;
    const frac = p.hp / game.stats.maxHp;
    if (frac > 0.35 || game.state === 'over') return;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 6);
    const a = (0.35 - frac) * 1.4 * (0.6 + 0.4 * pulse);
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${Math.min(0.55, a)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawJoystick(ctx) {
    const j = input.joy;
    if (!j.active) return;
    const R = input.JOY_RADIUS;
    let dx = j.kx - j.ox;
    let dy = j.ky - j.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    ctx.fillStyle = 'rgba(0,240,255,0.07)';
    ctx.strokeStyle = 'rgba(0,240,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.35)';
    ctx.strokeStyle = 'rgba(180,250,255,0.9)';
    ctx.beginPath();
    ctx.arc(j.ox + dx, j.oy + dy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
