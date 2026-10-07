'use strict';
/* Задники.
   Небо: рэлеевский градиент (у зенита цвет гуще, к горизонту белёсая дымка), ореол Ми вокруг солнца,
   на закате — пояс Венеры и тень Земли напротив солнца, живые сумеречные лучи, дизеринг против полос.
   Облака: тёмное плоское основание, освещённые макушки, серебряная кайма со стороны солнца
   (прямое рассеяние Ми), тонкие края просвечивают; три яруса идут с разной скоростью.
   Слои параллакса: воздушная перспектива, туман в низинах, размытие самого дальнего плана,
   тени облаков, ползущие по земле, ветер, качающий деревья, отражение берега в воде.
   Поверх — живность и техника (backdrop_life.js). */

// периодический шум: период ровно W пикселей, слой бесшовно повторяется
function periodicNoise(seed, cells) {
  const r = mulberry32(seed), v = new Float32Array(cells);
  for (let i = 0; i < cells; i++) v[i] = r() * 2 - 1;
  return u => {
    u = ((u % cells) + cells) % cells;
    const i = Math.floor(u), f = u - i, a = v[i], b = v[(i + 1) % cells];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}
// фрактальный шум; ridged — острые гребни, как у эрозионных хребтов
function periodicFbm(seed, W, cells, oct, ridged) {
  const ns = [];
  for (let o = 0; o < oct; o++) ns.push(periodicNoise(seed + o * 101, cells << o));
  return x => {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      let n = ns[o](x / W * (cells << o));
      if (ridged) n = 1 - Math.abs(n) * 2;
      s += n * amp; norm += amp; amp *= 0.5;
    }
    return s / norm;
  };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
// объект у шва тайла рисуется дважды
function wrapDraw(W, x, w, fn) { fn(x); if (x + w > W) fn(x - W); if (x < 0) fn(x + W); }

// мелкий шум для дизеринга градиентов и зерна кадра
let BD_NOISE = null;
function noiseTile() {
  if (BD_NOISE) return BD_NOISE;
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  const img = g.createImageData(128, 128), d = img.data;
  const r = mulberry32(31337);
  for (let i = 0; i < d.length; i += 4) {
    const v = r() < 0.5 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 26;
  }
  g.putImageData(img, 0, 0);
  BD_NOISE = c;
  return c;
}

class Backdrop {
  constructor(def, sky, theme) {
    this.def = def; this.sky = sky; this.theme = theme;
    this.night = sky.dark > 0.3;
    this.fog = def.sky === 'fog';
    this.fire = def.sky === 'fire';
    this.storm = def.sky === 'storm' || def.weather === 'storm';
    this.dusk = sky === SKIES.dusk || sky === SKIES.dawn;
    this.sea = !!theme.sea || def.type === 'sea';
    this.horizon = this.sea ? 0.5 : 0.56;
    this.haze = this.fog ? '#c3cacb' : this.fire ? '#8a3a20' : mix(sky.bot, sky.mid, 0.3);
    this.hazeK = this.fog ? 0.9 : this.storm ? 0.55 : this.night ? 0.45 : 0.6;
    // свет: днём резкий солнечный, в сумерки мягкий тёплый, в пожаре снизу от огня, ночью лунный
    this.sunK = this.fog ? 0.15 : this.fire ? 0.5 : this.night ? 0.2 : this.storm ? 0.1 : this.dusk ? 0.55 : 0.8;
    this.sunCol = this.fire ? '#ff8a3c' : this.night ? '#9fb2d0' : sky.sun;
    const spec = BACKDROPS[def.theme] || BACKDROPS.suburbs;
    this.sunX = spec.sunX !== undefined ? spec.sunX : 0.72;   // где стоит светило в кадре
    const seed = def.seed;
    // ветер: ровный поток плюс порывы; им живут дым, кроны, флаги, пыль
    const wN = periodicNoise(seed + 991, 32);
    this.windBase = spec.wind !== undefined ? spec.wind : (this.storm ? 1.5 : 0.55);
    this.wind = t => this.windBase * (0.75 + 0.45 * wN(t * 0.35) + 0.25 * Math.sin(t * 0.21 + seed));
    this.layers = spec.layers.map((L, i) => {
      const C = this.colors(L.col, L.d);
      const cv = mkCanvas(LAYER_W, LAYER_H);
      cv._baseColor = C.floor;
      const paint = BD_PAINT[L.paint];
      const r = mulberry32(seed * 7 + i * 131);
      if (paint) paint(cv.getContext('2d'), LAYER_W, LAYER_H, r, C, L.o || {}, this);
      if (L.marks) bdMarks(cv.getContext('2d'), LAYER_W, LAYER_H, r, C, L.marks, this);
      // самый дальний план слегка размыт — глубина резкости
      if (L.d < 0.16 && !this.fog) {
        const b = mkCanvas(LAYER_W, LAYER_H), bg = b.getContext('2d');
        bg.filter = 'blur(1.6px)'; bg.drawImage(cv, 0, 0);
        b._baseColor = cv._baseColor;
        return { canvas: b, par: L.par, yPar: L.yPar || L.par * 0.4, anchor: L.anchor, d: L.d, sway: L.sway || 0 };
      }
      return { canvas: cv, par: L.par, yPar: L.yPar || L.par * 0.4, anchor: L.anchor, d: L.d, sway: L.sway || 0 };
    });
    this.clouds = [
      { cv: this._buildClouds(seed + 5, 'cirrus'), par: 0.004, drift: 1.0, y: 0 },
      { cv: this._buildClouds(seed + 11, 'far'), par: 0.008, drift: 2.2, y: 0 },
      { cv: this._buildClouds(seed + 23, 'near'), par: 0.022, drift: 6.0, y: 0 }
    ];
    this.life = new BackdropLife(spec.life || [], this, seed + 77);
    this.skyC = null;
  }

  // цвета слоя с воздушной перспективой: d = 0 (горизонт) … 1 (рядом)
  colors(col, d) {
    const air = this.hazeK * Math.pow(1 - d, 1.7);
    let body = mix(col, this.haze, air);
    // ближние планы уходят в силуэт: так строится тональная глубина кадра
    if (d > 0.62) body = mix(body, this.night ? '#05070c' : mix(this.sky.top, '#0d1116', 0.45), (d - 0.62) * 0.75);
    if (this.night) body = mix(body, '#03050a', 0.12 + 0.34 * d);
    if (this.fire) body = mix(body, '#180a06', 0.1 + 0.32 * d);
    const contrast = 0.3 + 0.7 * d;
    const lit = mix(body, this.sunCol, this.sunK * 0.45 * contrast);
    const dark = mix(body, this.night ? '#000000' : mix(this.sky.top, '#000000', 0.55), 0.3 * contrast + 0.08);
    return {
      body, lit, dark, d, contrast, haze: this.haze, floor: mix(body, this.haze, 0.12 * (1 - d)),
      snow: mix(this.night ? '#8c98ab' : '#eef3f8', this.haze, air * 0.8), snowShade: mix(this.night ? '#4d5870' : '#a9b9cf', this.haze, air * 0.8),
      win: this.night ? '#ffcf7a' : null, fire: '#ff8a3a', night: this.night, dusk: this.dusk, fog: this.fog
    };
  }

  /* ----------------------------- небо ----------------------------- */
  _buildSky(W, H, dpr) {
    const c = mkCanvas(W, H), g = c.getContext('2d'), s = this.sky;
    const hy = H * this.horizon, hk = hy / H;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, s.top);
    gr.addColorStop(hk * 0.5, mix(s.top, s.mid, 0.55));
    gr.addColorStop(hk * 0.88, s.mid);
    gr.addColorStop(hk, s.bot);
    gr.addColorStop(1, mix(s.bot, s.mid, 0.35));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // дымка у горизонта: путь луча длиннее, свет рассеивается сильнее
    const hz = g.createLinearGradient(0, hy - H * 0.25, 0, hy + H * 0.04);
    hz.addColorStop(0, rgba(this.haze, 0));
    hz.addColorStop(0.85, rgba(mix(this.haze, '#ffffff', this.night ? 0 : 0.3), this.night ? 0.1 : 0.4));
    hz.addColorStop(1, rgba(this.haze, 0.15));
    g.fillStyle = hz; g.fillRect(0, 0, W, H);
    const r = mulberry32(this.def.seed + 5);
    this.stars = [];
    if (this.night && !this.storm) this._starfield(g, W, H, hy, dpr, r);
    const sx = W * this.sunX, sy = H * s.sunY;
    if (this.dusk) this._venusBelt(g, W, H, hy, sx);
    if (this.dusk || this.fire) {
      // тёплая полоса вдоль горизонта, ярче всего под солнцем
      g.save(); g.translate(sx, hy); g.scale(1, 0.28);
      const band = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.8);
      band.addColorStop(0, rgba(s.sun, 0.55)); band.addColorStop(0.4, rgba(s.sun, 0.18)); band.addColorStop(1, rgba(s.sun, 0));
      g.fillStyle = band; g.fillRect(-W * 1.5, -H * 4, W * 3, H * 8); g.restore();
    }
    if (!s.noSun) {
      if (!s.moon) this._sun(g, W, H, sx, sy, dpr);
      else this._moon(g, sx, sy, dpr, r);
    }
    // дизеринг: без него плавные градиенты идут полосами
    const nt = noiseTile();
    g.save(); g.globalAlpha = this.night ? 0.12 : 0.2;
    const p = g.createPattern(nt, 'repeat');
    g.fillStyle = p; g.fillRect(0, 0, W, H);
    g.restore();
    return c;
  }

  // пояс Венеры: розовая полоса и синяя тень Земли на противосолнечной стороне
  _venusBelt(g, W, H, hy, sx) {
    const anti = sx > W / 2 ? 0 : W;
    g.save();
    const fade = g.createLinearGradient(anti, 0, sx, 0);
    const belt = mkCanvas(W, H), bg = belt.getContext('2d');
    const v = bg.createLinearGradient(0, hy - H * 0.2, 0, hy + 2);
    v.addColorStop(0, 'rgba(226,150,170,0)');
    v.addColorStop(0.45, 'rgba(230,160,180,0.3)');
    v.addColorStop(0.72, 'rgba(150,120,175,0.22)');
    v.addColorStop(1, 'rgba(70,90,150,0.3)');
    bg.fillStyle = v; bg.fillRect(0, hy - H * 0.2, W, H * 0.2 + 2);
    bg.globalCompositeOperation = 'destination-in';
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = fade; bg.fillRect(0, 0, W, H);
    g.drawImage(belt, 0, 0);
    g.restore();
  }

  _sun(g, W, H, sx, sy, dpr) {
    const s = this.sky;
    // ореол Ми: у диска плотный, дальше мягкий, у горизонта растянут
    g.save(); g.translate(sx, sy); g.scale(1.35, 1);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, H * 0.62);
    const a = this.dusk ? 0.6 : this.storm ? 0.2 : 0.5;
    halo.addColorStop(0, rgba(mix('#ffffff', s.sun, 0.35), a * 0.95));
    halo.addColorStop(0.04, rgba(s.sun, a * 0.7));
    halo.addColorStop(0.13, rgba(s.sun, a * 0.3));
    halo.addColorStop(0.4, rgba(s.sun, a * 0.08));
    halo.addColorStop(1, rgba(s.sun, 0));
    g.fillStyle = halo; g.fillRect(-W, -H, W * 2, H * 2); g.restore();
    const R = 32 * dpr;
    // диск с потемнением к краю
    const disc = g.createRadialGradient(sx, sy, 0, sx, sy, R);
    disc.addColorStop(0, '#ffffff'); disc.addColorStop(0.55, mix('#ffffff', s.sun, 0.35));
    disc.addColorStop(0.88, s.sun); disc.addColorStop(1, mix(s.sun, this.haze, 0.35));
    g.fillStyle = disc; g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.fill();
    // короткие блики-лучи от диска
    if (!this.storm && !this.fog) {
      g.save(); g.translate(sx, sy); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI / 2 + 0.15, L = R * (i % 2 ? 2.2 : 3.4);
        const gr = g.createLinearGradient(0, 0, Math.cos(ang) * L, Math.sin(ang) * L);
        gr.addColorStop(0, rgba(s.sun, 0.1)); gr.addColorStop(1, rgba(s.sun, 0));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(Math.cos(ang - 0.03) * R * 0.6, Math.sin(ang - 0.03) * R * 0.6);
        g.lineTo(Math.cos(ang) * L, Math.sin(ang) * L);
        g.lineTo(Math.cos(ang + 0.03) * R * 0.6, Math.sin(ang + 0.03) * R * 0.6);
        g.closePath(); g.fill();
      }
      g.restore();
    }
  }

  _starfield(g, W, H, hy, dpr, r) {
    const n = Math.floor(W * H / 1800);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * hy, m = Math.pow(r(), 3);
      const fade = clamp(1 - y / hy, 0, 1) * 0.8 + 0.2;
      g.fillStyle = `rgba(${220 + r() * 35},${225 + r() * 30},255,${(0.25 + m * 0.75) * fade})`;
      const sz = (0.5 + m * 1.4) * dpr;
      g.fillRect(x, y, sz, sz);
      if (m > 0.55 && this.stars.length < 60) this.stars.push({ x, y, s: sz * 1.3, tw: r() * 6 });
    }
    // Млечный Путь: полоса слабых звёзд с тёмными пылевыми прожилками
    const ax = W * 0.05, ay = hy * 0.95, bx = W * 0.62, by = -H * 0.1;
    const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let i = 0; i < 28; i++) {
      const t = i / 27, px = ax + (bx - ax) * t, py = ay + (by - ay) * t, rr = H * (0.07 + r() * 0.05);
      const gl = g.createRadialGradient(px, py, 0, px, py, rr);
      gl.addColorStop(0, 'rgba(190,200,235,0.09)'); gl.addColorStop(1, 'rgba(190,200,235,0)');
      g.fillStyle = gl; g.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < n * 1.2; i++) {
      const t = r(), off = (r() + r() + r() - 1.5) * H * 0.08;
      const px = ax + (bx - ax) * t + nx * off, py = ay + (by - ay) * t + ny * off;
      g.fillStyle = `rgba(230,235,255,${0.15 + r() * 0.4})`;
      g.fillRect(px, py, 0.7 * dpr, 0.7 * dpr);
    }
    for (let i = 0; i < 16; i++) {
      const t = 0.1 + r() * 0.8, off = (r() - 0.5) * H * 0.04;
      const px = ax + (bx - ax) * t + nx * off, py = ay + (by - ay) * t + ny * off, rr = H * (0.015 + r() * 0.03);
      g.save(); g.translate(px, py); g.rotate(Math.atan2(by - ay, bx - ax)); g.scale(2.5, 0.6);
      const dl = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      dl.addColorStop(0, rgba(this.sky.top, 0.55)); dl.addColorStop(1, rgba(this.sky.top, 0));
      g.fillStyle = dl; g.fillRect(-rr, -rr, rr * 2, rr * 2); g.restore();
    }
  }

  _moon(g, x, y, dpr, r) {
    const R = 26 * dpr;
    const halo = g.createRadialGradient(x, y, R, x, y, R * 9);
    halo.addColorStop(0, 'rgba(200,215,240,0.3)'); halo.addColorStop(0.25, 'rgba(190,205,235,0.12)'); halo.addColorStop(1, 'rgba(200,215,240,0)');
    g.fillStyle = halo; g.fillRect(x - R * 9, y - R * 9, R * 18, R * 18);
    const d = g.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
    d.addColorStop(0, '#fbfcff'); d.addColorStop(0.8, '#dfe5ef'); d.addColorStop(1, '#b9c2d2');
    g.fillStyle = d; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(120,130,150,0.35)';
    for (const [mx, my, mr] of [[-0.3, -0.25, 0.32], [0.15, -0.35, 0.22], [0.25, 0.1, 0.28], [-0.1, 0.3, 0.18], [-0.45, 0.15, 0.14]]) {
      g.beginPath(); g.ellipse(x + mx * R, y + my * R, mr * R, mr * R * 0.8, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x + R * 0.1, y + R * 0.62, R * 0.06, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // живые сумеречные лучи: дышат и медленно поворачиваются
  _godRays(ctx, R, t) {
    if (this.fog || (this.night && !this.sky.moon) || this.sky.noSun) return;
    const W = R.W, H = R.H, sx = W * this.sunX, sy = H * this.sky.sunY;
    const down = sy < H * this.horizon;
    const base = down ? Math.PI / 2 : -Math.PI / 2;
    const strength = (this.dusk ? 0.055 : this.storm ? 0.02 : 0.03) * (this.night ? 0.5 : 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const ph = i * 2.37 + this.def.seed * 0.013;
      const a = base + (i - 3.5) * 0.17 + Math.sin(t * 0.045 + ph) * 0.09;
      const w = 0.012 + 0.022 * (0.5 + 0.5 * Math.sin(t * 0.09 + ph));
      const L = H * 1.5;
      const al = strength * (0.45 + 0.55 * Math.sin(t * 0.06 + ph * 1.3) ** 2);
      const gr = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      gr.addColorStop(0, rgba(this.sky.sun, al));
      gr.addColorStop(0.45, rgba(this.sky.sun, al * 0.45));
      gr.addColorStop(1, rgba(this.sky.sun, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - w) * L, sy + Math.sin(a - w) * L);
      ctx.lineTo(sx + Math.cos(a + w) * L, sy + Math.sin(a + w) * L);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ----------------------------- облака ----------------------------- */
  _cloudPalette() {
    const s = this.sky;
    if (this.fire) return { base: '#231210', lit: '#c0582a', rim: '#ffb070', below: true, a: 0.95 };
    if (this.storm) return { base: '#171d22', lit: '#4b5560', rim: '#8e9aa6', a: 0.95 };
    if (this.fog) return { base: '#a9b1b2', lit: '#e4e8e8', rim: '#ffffff', a: 0.55 };
    if (this.night) return { base: '#0f1622', lit: '#4d5870', rim: '#94a3bd', a: 0.85 };
    if (this.dusk) return { base: mix(s.top, '#3a2a40', 0.28), lit: mix(s.sun, '#ffe0c0', 0.3), rim: '#ffd9a8', below: s.sunY > this.horizon, a: 0.95 };
    return { base: mix('#93a4b6', s.mid, 0.28), lit: '#ffffff', rim: '#ffffff', a: 0.95 };
  }

  _buildClouds(seed, kind) {
    const W = LAYER_W, Hc = 560, c = mkCanvas(W, Hc), g = c.getContext('2d'), r = mulberry32(seed);
    const P = this._cloudPalette();
    const heavy = this.storm || this.def.weather === 'rain' || this.fire;
    if (kind === 'cirrus') {
      if (heavy || this.fog || this.night) return c;
      g.save(); g.filter = 'blur(4px)';
      for (let i = 0; i < 10; i++) {
        const x = r() * W, y = 24 + r() * 130, L = 240 + r() * 460, tilt = (r() - 0.5) * 0.12;
        for (let k = 0; k < 5; k++) {
          const yy = y + k * 8 + r() * 5;
          g.strokeStyle = rgba(P.lit, 0.09 + r() * 0.09); g.lineWidth = 2 + r() * 5; g.lineCap = 'round';
          wrapDraw(W, x, L, xx => {
            g.beginPath(); g.moveTo(xx, yy);
            g.quadraticCurveTo(xx + L * 0.45, yy - 22 + L * tilt, xx + L, yy + 12);
            g.stroke();
          });
        }
      }
      g.restore();
      return c;
    }
    const far = kind === 'far';
    let n = far ? (heavy ? 14 : 9) : (heavy ? 10 : this.fog ? 4 : 7);
    if (this.night) n = Math.round(n * 0.7);
    for (let i = 0; i < n; i++) {
      const small = r() < 0.35;
      const w = (far ? 220 + r() * 380 : 240 + r() * 400) * (small ? 0.45 : 1);
      const h = (far ? 14 + r() * 18 : 44 + r() * 64) * (small ? 0.55 : 1);
      const y = far ? 330 + r() * 130 : heavy ? 30 + r() * 230 : 40 + r() * 230;
      paintCloud(g, W, r() * W, y, w, h * (heavy ? 1.25 : 1), r, P, far ? 0.55 : 0.9, this.sunX);
    }
    if (heavy && !far) {
      const deck = g.createLinearGradient(0, 0, 0, 320);
      deck.addColorStop(0, rgba(P.base, 0.68)); deck.addColorStop(0.65, rgba(P.base, 0.26)); deck.addColorStop(1, rgba(P.base, 0));
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = deck; g.fillRect(0, 0, W, 320); g.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  /* ----------------------------- отрисовка ----------------------------- */
  drawSky(ctx, R, t, pcx) {
    if (!this.skyC || this.skyC.width !== R.W || this.skyC.height !== R.H) this.skyC = this._buildSky(R.W, R.H, R.dpr);
    ctx.drawImage(this.skyC, 0, 0);
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + s.tw * 0.2) + s.tw));
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    this._godRays(ctx, R, t);
    this.life.update(R, t, pcx);
    this.life.draw(ctx, R, t, 'sky');
    const k = R.H / 900, cw = LAYER_W * k;
    const w = this.wind(t);
    for (const C of this.clouds) {
      const off = ((pcx * R.BASE * C.par + t * C.drift * w * R.dpr) % cw + cw) % cw;
      const dy = Math.sin(t * 0.05 + C.par * 100) * 4 * R.dpr;
      for (let x = -off; x < R.W; x += cw) ctx.drawImage(C.cv, Math.floor(x), dy, Math.ceil(cw) + 1, C.cv.height * k);
    }
    if (R.flash > 0.01) {
      // молния бьёт за облаками: подсвечивает их изнутри
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(R.flash * 1.6, 0, 0.85);
      const near = this.clouds[2];
      const off2 = ((pcx * R.BASE * near.par + t * near.drift * w * R.dpr) % cw + cw) % cw;
      for (let x = -off2; x < R.W; x += cw) ctx.drawImage(near.cv, Math.floor(x), 0, Math.ceil(cw) + 1, near.cv.height * k);
      const gg = ctx.createLinearGradient(0, 0, 0, R.H * this.horizon);
      gg.addColorStop(0, `rgba(190,205,235,${0.25 * R.flash})`); gg.addColorStop(1, 'rgba(190,205,235,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, R.W, R.H * this.horizon);
      ctx.restore();
    }
    this.life.draw(ctx, R, t, 'cloud');
  }

  drawLayers(ctx, R, pcx, pcy, t, water) {
    const H = R.H, k = H / 900, B = R.BASE;
    const wind = this.wind(t);
    this.layers.forEach((L, li) => {
      const lw = LAYER_W * k, lh = LAYER_H * k;
      const off = ((pcx * B * L.par) % lw + lw) % lw;
      const dy = clamp((pcy - 2) * B * L.yPar, -H * 0.18, H * 0.18);
      const base = Math.round(H * L.anchor + dy);
      L.off = off; L.base = base; L.k = k;
      if (water && li === 0) this._farSea(ctx, R, base, t);
      for (let x = -off; x < R.W; x += lw) {
        if (L.sway && R.quality >= 1) this._drawSwayed(ctx, L, Math.floor(x), base - lh, Math.ceil(lw) + 1, lh, t, wind);
        else ctx.drawImage(L.canvas, Math.floor(x), base - lh, Math.ceil(lw) + 1, lh);
      }
      if (base < H) { ctx.fillStyle = L.canvas._baseColor; ctx.fillRect(0, base - 1, R.W, H - base + 1); }
      this.life.draw(ctx, R, t, 'layer', li, L);
      // прослойка тумана между планами: воздух между хребтами видно
      if (li < this.layers.length - 1 && !this.night) {
        const nx = this.layers[li + 1];
        const top = base - lh * 0.35, bot = base + 4;
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, rgba(this.haze, 0));
        g.addColorStop(1, rgba(this.haze, (this.fog ? 0.5 : 0.22) * (1 - L.d)));
        ctx.fillStyle = g; ctx.fillRect(0, top, R.W, bot - top);
      }
    });
    this._cloudShadows(ctx, R, t, pcx);
    this._rainCurtains(ctx, R, t, pcx);
    if (water) this._seaReflection(ctx, R, t);
    this.life.draw(ctx, R, t, 'front');
  }

  // крона гнётся под ветром: слой рисуется полосами, верх сдвигается сильнее
  _drawSwayed(ctx, L, x, y, w, h, t, wind) {
    const N = 9, sh = h / N;
    for (let i = 0; i < N; i++) {
      const sy = i * sh;
      const up = 1 - i / N;                               // сверху ветка ходит сильнее
      const dx = Math.sin(t * 1.25 + i * 0.35 + x * 0.004) * L.sway * wind * up * up * L.k;
      ctx.drawImage(L.canvas, 0, sy / h * LAYER_H, LAYER_W, Math.ceil(LAYER_H / N) + 1,
        x + dx, y + sy, w, sh + 1);
    }
  }

  // тени облаков ползут по земле
  _cloudShadows(ctx, R, t, pcx) {
    if (this.fog || this.night || this.storm) return;
    const H = R.H, hy = H * this.horizon;
    const w = this.wind(t);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hy - H * 0.06, R.W, H); ctx.clip();
    for (let i = 0; i < 4; i++) {
      const span = R.W * (0.5 + i * 0.22);
      const x = ((pcx * R.BASE * 0.02 * 0 + t * (6 + i * 3) * w * R.dpr + i * 900) % (R.W + span * 2)) - span;
      const y = hy + H * (0.02 + i * 0.05);
      const g = ctx.createRadialGradient(x, y, 0, x, y, span * 0.6);
      g.addColorStop(0, `rgba(20,28,45,${0.1 - i * 0.012})`); g.addColorStop(1, 'rgba(20,28,45,0)');
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.32); ctx.translate(-x, -y);
      ctx.fillRect(x - span * 0.6, y - span * 0.6, span * 1.2, span * 1.2);
      ctx.restore();
    }
    ctx.restore();
  }

  // стены дождя вдали: полупрозрачные полосы, бредущие над горизонтом
  _rainCurtains(ctx, R, t, pcx) {
    const w = this.def.weather;
    if (w !== 'rain' && w !== 'storm') return;
    const H = R.H, hy = H * this.horizon;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hy - H * 0.3, R.W, H * 0.45); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const span = R.W * (0.28 + i * 0.1);
      const x = ((t * (10 + i * 7) * R.dpr + i * 830) % (R.W + span * 2)) - span;
      const g = ctx.createLinearGradient(x - span / 2, 0, x + span / 2, 0);
      const a = 0.06 + 0.03 * Math.sin(t * 0.3 + i);
      g.addColorStop(0, rgba(this.haze, 0));
      g.addColorStop(0.5, rgba(mix(this.haze, '#ffffff', this.night ? 0 : 0.2), a));
      g.addColorStop(1, rgba(this.haze, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - span / 2, hy - H * 0.3, span, H * 0.45);
    }
    ctx.restore();
  }

  // дальнее море: к горизонту светлее, солнечная дорожка дрожит на волне
  _farSea(ctx, R, base, t) {
    const H = R.H, W = R.W;
    const g = ctx.createLinearGradient(0, base, 0, H);
    const deep = this.night ? '#06111b' : this.fire ? '#1d0f0c' : mix('#1f4a61', this.sky.mid, 0.2);
    g.addColorStop(0, mix(this.sky.bot, deep, 0.45)); g.addColorStop(0.25, deep); g.addColorStop(1, shade(deep, -0.4));
    ctx.fillStyle = g; ctx.fillRect(0, base - 2, W, H - base + 2);
    // зыбь: тёмные гребни идут к берегу
    const swell = this.storm ? 1 : 0.45;
    for (let i = 0; i < 3; i++) {
      const yy = base + (4 + i * 7) * R.dpr;
      ctx.fillStyle = rgba(this.night ? '#060f18' : shade(deep, -0.25), 0.35);
      ctx.beginPath(); ctx.moveTo(0, yy + 6 * R.dpr);
      for (let x = 0; x <= W; x += 24) {
        ctx.lineTo(x, yy + Math.sin(x * 0.012 + t * (0.7 + i * 0.3)) * 2.2 * swell * R.dpr);
      }
      ctx.lineTo(W, yy + 8 * R.dpr); ctx.closePath(); ctx.fill();
    }
    const sx = W * this.sunX, glint = this.sky.moon ? '#dfe8ff' : this.sky.sun;
    const strong = this.sky.noSun ? 0.05 : this.night ? 0.35 : this.dusk ? 0.7 : 0.45;
    for (let i = 0; i < 40; i++) {
      const yy = base + (i * i * 0.35 + 2) * R.dpr;
      if (yy > H) break;
      const wob = Math.sin(t * 1.7 + i * 1.3) * 12 * R.dpr, spread = (20 + i * 5) * R.dpr;
      ctx.fillStyle = rgba(glint, strong * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.3 + i))) * (1 - i / 40));
      ctx.fillRect(sx - spread / 2 + wob, yy, spread * (0.4 + 0.6 * Math.abs(Math.sin(i * 7.1 + t))), 1.4 * R.dpr);
      ctx.fillStyle = rgba('#ffffff', 0.05);
      ctx.fillRect((i * 373 + t * 18 * (1 + i * 0.05)) % W, yy, (30 + i * 3) * R.dpr, R.dpr);
    }
  }

  // отражение берега в воде: перевёрнутые планы, размытые рябью
  _seaReflection(ctx, R, t) {
    const H = R.H, k = R.H / 900, lw = LAYER_W * k, lh = LAYER_H * k;
    const hz = this.layers[0].base;
    if (hz >= H) return;
    ctx.save();
    const depth = Math.min(H - hz, H * 0.15);
    ctx.beginPath(); ctx.rect(0, hz, R.W, depth); ctx.clip();
    ctx.globalAlpha = this.fog ? 0.07 : this.night ? 0.1 : 0.15;
    // отражение рисуется полосами: каждая смещена волной, картинка «плывёт»
    const N = R.quality >= 1 ? 14 : 5, sh = depth / N;
    for (let i = 0; i < N; i++) {
      const yy = hz + i * sh;
      const wob = Math.sin(t * 1.6 + i * 0.8) * (1.5 + i * 0.7) * R.dpr;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, yy, R.W, sh + 1); ctx.clip();
      ctx.translate(wob, hz * 2); ctx.scale(1, -1);
      for (const L of this.layers) {
        for (let x = -L.off; x < R.W; x += lw) ctx.drawImage(L.canvas, Math.floor(x), L.base - lh, Math.ceil(lw) + 1, lh);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(this.night ? '#0a1a26' : mix('#2a5a74', this.sky.bot, 0.3), 0.45);
    for (let i = 0; i < 30; i++) {
      const yy = hz + i * (depth / 26) + Math.sin(t * 1.2 + i * 0.6) * 1.2 * R.dpr;
      ctx.fillRect(0, yy, R.W, 1.2 * R.dpr);
    }
    ctx.restore();
  }

  // светящееся поверх ночного затемнения: огни, фары, пламя
  drawGlow(ctx, R, t) {
    ctx.globalCompositeOperation = 'lighter';
    this.life.draw(ctx, R, t, 'glow');
    ctx.globalCompositeOperation = 'source-over';
  }
  lightHoles(hole, R) { this.life.lightHoles(hole, R); }
}

// кучевое облако: плоское тёмное основание, освещённая макушка, серебряная кайма со стороны солнца,
// рваные края и отдельные клочья — силуэт не должен быть «ватным шариком»
function paintCloud(g, W, x, y, w, h, r, P, alpha, sunX) {
  const pad = h * 1.6, tw = w + pad * 2, th = h * 3.0;
  const tmp = mkCanvas(tw, th), q = tmp.getContext('2d');
  const baseY = th * 0.7;
  const toSun = x / W < sunX ? 1 : -1;
  // силуэт: цепочка пузырей с профилем «купол», плюс мелкие пузыри по краям
  const blobs = [];
  const n = 10 + Math.floor(w / 34);
  for (let i = 0; i < n; i++) {
    const u = (i + r() * 0.8) / n, bx = pad + u * w;
    const tri = Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.7);
    const rr = h * (0.16 + 0.5 * tri) * (0.55 + r() * 0.75);
    const by = baseY - rr * (0.3 + r() * 0.55) * (0.5 + tri * 0.9) - h * 0.1 * tri;
    blobs.push([bx, by, rr]);
  }
  q.fillStyle = P.base;
  for (const [bx, by, rr] of blobs) { q.beginPath(); q.arc(bx, by, rr, 0, Math.PI * 2); q.fill(); }
  // плоское основание
  q.globalCompositeOperation = 'destination-out';
  const cut = q.createLinearGradient(0, baseY - h * 0.08, 0, baseY + h * 0.22);
  cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
  q.fillStyle = cut; q.fillRect(0, baseY - h * 0.08, tw, th);
  // рваные края: выедаем куски мягкими пятнами
  for (let i = 0; i < 12; i++) {
    const [bx, by, rr] = blobs[Math.floor(r() * blobs.length)];
    const a = r() * Math.PI * 2, d = rr * (0.7 + r() * 0.6);
    const ex = bx + Math.cos(a) * d, ey = by + Math.sin(a) * d * 0.7, er = rr * (0.3 + r() * 0.6);
    const eg = q.createRadialGradient(ex, ey, 0, ex, ey, er);
    eg.addColorStop(0, 'rgba(0,0,0,0.9)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = eg; q.fillRect(ex - er, ey - er, er * 2, er * 2);
  }
  q.globalCompositeOperation = 'source-atop';
  // светотень: макушка на свету, низ в тени (или наоборот на закате)
  const top = baseY - h * 1.5;
  const v = q.createLinearGradient(0, top, 0, baseY);
  if (P.below) { v.addColorStop(0, rgba(P.base, 0)); v.addColorStop(0.75, rgba(P.lit, 0.25)); v.addColorStop(1, rgba(P.lit, 0.85)); }
  else { v.addColorStop(0, rgba(P.lit, 0.9)); v.addColorStop(0.5, rgba(mix(P.lit, P.base, 0.5), 0.5)); v.addColorStop(1, rgba(P.base, 0)); }
  q.fillStyle = v; q.fillRect(0, 0, tw, th);
  for (const [bx, by, rr] of blobs) {
    const hy2 = P.below ? by + rr * 0.5 : by - rr * 0.45, hx = bx + toSun * rr * 0.35;
    const hl = q.createRadialGradient(hx, hy2, 0, hx, hy2, rr * 1.05);
    hl.addColorStop(0, rgba(P.lit, P.below ? 0.32 : 0.5)); hl.addColorStop(1, rgba(P.lit, 0));
    q.fillStyle = hl; q.beginPath(); q.arc(bx, by, rr, 0, Math.PI * 2); q.fill();
  }
  q.globalCompositeOperation = 'source-over';
  // серебряная кайма со стороны солнца
  const rim = mkCanvas(tw, th), rg = rim.getContext('2d');
  rg.fillStyle = P.rim || P.lit;
  for (const [bx, by, rr] of blobs) { rg.beginPath(); rg.arc(bx, by, rr, 0, Math.PI * 2); rg.fill(); }
  rg.globalCompositeOperation = 'destination-out';
  for (const [bx, by, rr] of blobs) { rg.beginPath(); rg.arc(bx - toSun * rr * 0.12, by + rr * 0.1, rr * 0.96, 0, Math.PI * 2); rg.fill(); }
  q.save(); q.globalCompositeOperation = 'source-atop'; q.globalAlpha = 0.8; q.filter = 'blur(1.2px)';
  q.drawImage(rim, 0, 0); q.restore();
  // клочья рядом с облаком
  q.globalCompositeOperation = 'destination-over';
  q.fillStyle = rgba(P.base, 0.5);
  for (let i = 0; i < 4; i++) {
    const wx = pad + r() * w, wy = baseY - h * (0.1 + r() * 0.9), wr = h * (0.08 + r() * 0.14);
    const wg = q.createRadialGradient(wx, wy, 0, wx, wy, wr * 2.2);
    wg.addColorStop(0, rgba(P.lit, 0.3)); wg.addColorStop(1, rgba(P.lit, 0));
    q.fillStyle = wg; q.fillRect(wx - wr * 2, wy - wr * 2, wr * 4, wr * 4);
  }
  q.globalCompositeOperation = 'source-over';
  g.save();
  g.globalAlpha = P.a * alpha * (0.75 + r() * 0.3);
  g.filter = alpha < 0.7 ? 'blur(3px)' : 'blur(2px)';
  wrapDraw(W, x - pad, tw, xx => g.drawImage(tmp, xx, y - baseY));
  g.restore();
}
