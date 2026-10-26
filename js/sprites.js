// Vorgerenderte Neon-Sprites (Glow wird einmal berechnet, nicht pro Frame)

const SR = 2; // Auflösungsfaktor der Sprites
const cache = new Map();

function makeSprite(key, size, draw) {
  if (cache.has(key)) return cache.get(key);
  const pad = 14;
  const c = document.createElement('canvas');
  const px = Math.ceil((size + pad * 2) * SR);
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.scale(SR, SR);
  g.translate(size / 2 + pad, size / 2 + pad);
  draw(g);
  const sprite = { img: c, half: size / 2 + pad };
  cache.set(key, sprite);
  return sprite;
}

export function drawSprite(ctx, sprite, x, y, rot = 0, scale = 1) {
  const h = sprite.half * scale;
  if (rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(sprite.img, -h, -h, h * 2, h * 2);
    ctx.restore();
  } else {
    ctx.drawImage(sprite.img, x - h, y - h, h * 2, h * 2);
  }
}

function poly(g, n, r, rot = 0) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function neon(g, color, width = 2.5, blur = 10) {
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.strokeStyle = color;
  g.lineWidth = width;
}

export function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Gegner ----------
function enemyPath(g, shape, r) {
  switch (shape) {
    case 'diamond': poly(g, 4, r, 0); break;
    case 'tri': poly(g, 3, r, 0); break;
    case 'square': poly(g, 4, r, Math.PI / 4); break;
    case 'hex': poly(g, 6, r, 0); break;
    case 'pent': poly(g, 5, r, -Math.PI / 2); break;
    case 'spike': {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? r * 0.6 : r;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      break;
    }
    case 'oct': poly(g, 8, r, Math.PI / 8); break;
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      break;
    }
    case 'turret':
      g.beginPath();
      g.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      g.moveTo(r * 0.55, 0);
      g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      break;
    case 'cross': {
      const a = r * 0.38;
      g.beginPath();
      g.moveTo(-a, -r); g.lineTo(a, -r); g.lineTo(a, -a); g.lineTo(r, -a); g.lineTo(r, a); g.lineTo(a, a);
      g.lineTo(a, r); g.lineTo(-a, r); g.lineTo(-a, a); g.lineTo(-r, a); g.lineTo(-r, -a); g.lineTo(-a, -a);
      g.closePath();
      break;
    }
    case 'boss1': poly(g, 8, r, Math.PI / 8); break;
    case 'boss2': poly(g, 12, r, 0); break;
    default: g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
  }
}

export function enemySprite(type, def, elite = false) {
  const r = def.r * (elite ? 1.5 : 1);
  return makeSprite(`e:${type}:${elite}`, r * 2, (g) => {
    const color = def.color;
    enemyPath(g, def.shape, r);
    g.fillStyle = hexToRgba(color, 0.22);
    g.fill();
    neon(g, color, elite ? 3.5 : 2.5, 12);
    g.stroke();
    g.shadowBlur = 0;
    // Inneres Detail
    if (def.boss) {
      enemyPath(g, def.shape, r * 0.65);
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    } else {
      // "Auge"
      g.beginPath();
      g.arc(0, 0, Math.max(2.5, r * 0.28), 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
    }
    if (elite) {
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      enemyPath(g, def.shape, r * 1.18);
      g.stroke();
    }
  });
}

export function whiteSprite(type, def, elite = false) {
  const r = def.r * (elite ? 1.5 : 1);
  return makeSprite(`w:${type}:${elite}`, r * 2, (g) => {
    enemyPath(g, def.shape, r);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();
  });
}

// ---------- Spieler ----------
export function playerSprite(color) {
  return makeSprite(`p:${color}`, 34, (g) => {
    // Körper
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fillStyle = hexToRgba(color, 0.25);
    g.fill();
    neon(g, color, 3, 14);
    g.stroke();
    // Visier
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(-7, -3);
    g.lineTo(7, -3);
    g.lineTo(5, 3);
    g.lineTo(-5, 3);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
  });
}

// ---------- Glow-Punkte für Projektile/Partikel ----------
export function dotSprite(color, r) {
  return makeSprite(`d:${color}:${r}`, r * 2, (g) => {
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r + 8);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.25, color);
    grd.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r + 8, 0, Math.PI * 2);
    g.fill();
  });
}

export function pickupSprite(kind) {
  return makeSprite(`k:${kind}`, 16, (g) => {
    if (kind === 'chip') {
      poly(g, 4, 6, 0);
      g.fillStyle = 'rgba(80,255,200,0.35)';
      g.fill();
      neon(g, '#50ffc8', 2, 8);
      g.stroke();
    } else if (kind === 'heal') {
      neon(g, '#4dff7a', 3, 10);
      g.beginPath();
      g.moveTo(-6, 0); g.lineTo(6, 0);
      g.moveTo(0, -6); g.lineTo(0, 6);
      g.stroke();
    } else if (kind === 'crate') {
      poly(g, 6, 9, 0);
      g.fillStyle = 'rgba(255,215,64,0.3)';
      g.fill();
      neon(g, '#ffd740', 2.5, 12);
      g.stroke();
      g.fillStyle = '#ffd740';
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 0, 1);
    }
  });
}

// ---------- Waffen ----------
// Zeichnet die Waffe in lokalen Koordinaten, zeigt nach rechts (+x)
export function drawWeaponShape(g, id, color) {
  neon(g, color, 2.2, 8);
  g.fillStyle = hexToRgba(color, 0.3);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  switch (id) {
    case 'plasmaBlaster':
      g.rect(-6, -4, 12, 8);
      g.moveTo(6, -2); g.lineTo(14, -2); g.lineTo(14, 2); g.lineTo(6, 2);
      g.moveTo(-3, 4); g.lineTo(-5, 9);
      break;
    case 'flammenwerfer':
      g.arc(-5, 0, 5, 0, Math.PI * 2);
      g.moveTo(0, -3); g.lineTo(10, -3); g.lineTo(15, -6); g.lineTo(15, 6); g.lineTo(10, 3); g.lineTo(0, 3);
      break;
    case 'kryoGewehr':
      g.moveTo(-10, -2); g.lineTo(16, -2); g.lineTo(16, 1); g.lineTo(-10, 2); g.closePath();
      g.moveTo(-4, 2); g.lineTo(-6, 7);
      g.moveTo(2, -2); g.lineTo(4, -6); g.lineTo(9, -6); g.lineTo(9, -2);
      break;
    case 'frostMoerser':
      g.rect(-7, -6, 16, 12);
      g.moveTo(9, -4); g.lineTo(13, -4); g.lineTo(13, 4); g.lineTo(9, 4);
      break;
    case 'teslaSpule':
      g.moveTo(-8, 0); g.lineTo(4, 0);
      for (let i = 0; i < 3; i++) { g.moveTo(-4 + i * 4 + 3, 0); g.arc(-4 + i * 4, 0, 3, 0, Math.PI * 2); }
      g.moveTo(14, 0); g.arc(10, 0, 4, 0, Math.PI * 2);
      break;
    case 'railgun':
      g.moveTo(-10, -4); g.lineTo(17, -4);
      g.moveTo(-10, 4); g.lineTo(17, 4);
      g.moveTo(-10, -4); g.lineTo(-10, 4);
      g.moveTo(-2, -4); g.lineTo(-2, 4);
      break;
    case 'nanoSchwarm':
      poly(g, 6, 8, 0);
      g.moveTo(11, 0); g.arc(9, 0, 2, 0, Math.PI * 2);
      break;
    case 'voidWerfer':
      g.arc(0, 0, 7, 0, Math.PI * 2);
      g.moveTo(7, 0); g.lineTo(14, 0);
      g.moveTo(3, 0); g.arc(0, 0, 3, 0, Math.PI * 2);
      break;
    case 'plasmaKlinge':
      g.moveTo(-8, -2); g.lineTo(-8, 2);
      g.moveTo(-12, 0); g.lineTo(-4, 0);
      g.moveTo(-4, -3); g.lineTo(18, 0); g.lineTo(-4, 3); g.closePath();
      break;
    case 'kryoHammer':
      g.moveTo(-10, 0); g.lineTo(8, 0);
      g.rect(6, -8, 9, 16);
      break;
    case 'stromlanze':
      g.moveTo(-14, 0); g.lineTo(10, 0);
      g.moveTo(10, -4); g.lineTo(19, 0); g.lineTo(10, 4); g.closePath();
      g.moveTo(2, -3); g.lineTo(5, 0); g.lineTo(2, 3);
      break;
    case 'voidSense':
      g.moveTo(-12, 0); g.lineTo(8, 0);
      g.moveTo(8, 0); g.quadraticCurveTo(14, -14, 2, -16); g.quadraticCurveTo(10, -9, 6, 0);
      break;
    case 'napalmWerfer':
      g.rect(-8, -5, 10, 10);
      g.moveTo(2, -3); g.lineTo(14, -4); g.lineTo(14, 4); g.lineTo(2, 3);
      g.moveTo(-3, -5); g.lineTo(-3, -9); g.lineTo(3, -9);
      break;
    case 'frostSplitter':
      poly(g, 4, 9, 0);
      g.moveTo(4, 0); poly(g, 4, 4, 0);
      break;
    case 'blitzDrohne':
      g.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      g.moveTo(-12, -7); g.lineTo(-4, -3);
      g.moveTo(12, -7); g.lineTo(4, -3);
      g.moveTo(-12, 7); g.lineTo(-4, 3);
      g.moveTo(12, 7); g.lineTo(4, 3);
      break;
    case 'gravBumerang':
      g.moveTo(-12, 8); g.quadraticCurveTo(0, -16, 12, 8); g.quadraticCurveTo(0, -6, -12, 8);
      break;
    default:
      g.arc(0, 0, 6, 0, Math.PI * 2);
  }
  g.fill();
  g.stroke();
}

export function weaponSprite(id, color) {
  return makeSprite(`wp:${id}:${color}`, 40, (g) => drawWeaponShape(g, id, color));
}

const iconCache = new Map();
export function weaponIconURL(id, color) {
  const key = `${id}:${color}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.translate(48, 48);
  g.scale(2.4, 2.4);
  g.rotate(-Math.PI / 6);
  drawWeaponShape(g, id, color);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
