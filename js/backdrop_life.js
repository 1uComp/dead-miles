'use strict';
/* Живой задник: вдалеке пролетает кукурузник, кружит воронья стая, идёт вертолёт, тянет дым пожар,
   вращается луч маяка, крутится ветряк. Два вида объектов:
   free — летят/плывут через экран и появляются по таймеру;
   prop — привязаны к точке слоя (труба, мачта, маяк) и повторяются вместе с тайлом. */

const LIFE_FREE = {}, LIFE_PROP = {};

class BackdropLife {
  constructor(specs, B, seed) {
    this.B = B; this.r = mulberry32(seed);
    this.free = []; this.props = [];
    for (const s of specs) {
      if (LIFE_PROP[s.k]) this.props.push({ s, pos: [] });
      else if (LIFE_FREE[s.k]) this.free.push({ s, cd: this.r() * (s.every || 20), list: [] });
    }
    this.prevPcx = null; this.prevT = 0; this.pcx = 0;
  }

  update(R, t, pcx) {
    const dt = clamp(t - this.prevT, 0, 0.1); this.prevT = t;
    const dcam = this.prevPcx === null ? 0 : pcx - this.prevPcx;
    this.prevPcx = pcx; this.pcx = pcx;
    const pad = 700 * R.dpr;
    for (const sp of this.free) {
      sp.cd -= dt;
      if (sp.cd <= 0) {
        sp.cd = (sp.s.every || 25) * (0.5 + this.r());
        if (sp.list.length < (sp.s.max || 2)) sp.list.push(this._spawn(sp.s, R));
      }
      for (const a of sp.list) {
        a.t += dt;
        a.x += a.vx * dt * R.dpr - dcam * R.BASE * a.par;
        a.y += a.vy * dt * R.dpr;
        const K = LIFE_FREE[sp.s.k];
        if (K.update) K.update(a, dt, t, R, this.B);
      }
      sp.list = sp.list.filter(a => a.x > -pad && a.x < R.W + pad);
    }
  }

  _spawn(s, R) {
    const r = this.r, dir = s.dir || (r() < 0.5 ? 1 : -1);
    const hy = R.H * this.B.horizon;
    const a = {
      x: dir > 0 ? -400 * R.dpr : R.W + 400 * R.dpr,
      y: (s.y0 !== undefined ? s.y0 : 0.12) * R.H + r() * (s.yv !== undefined ? s.yv : 0.3) * hy,
      vx: dir * (s.sp || 60) * (0.7 + r() * 0.6), vy: 0, dir, t: r() * 10,
      par: s.par !== undefined ? s.par : 0.02, sc: (s.sc || 1) * (0.75 + r() * 0.5), seed: r() * 100, r
    };
    a.ember = !!s.ember; a.fall = s.fall || 0;
    const K = LIFE_FREE[s.k];
    if (K.spawn) K.spawn(a, R, this.B, r, s);
    return a;
  }

  draw(ctx, R, t, where, li, L) {
    if (where === 'glow') {
      for (const p of this.props) { const K = LIFE_PROP[p.s.k]; if (K.glow) for (const [X, Y, k] of p.pos) K.glow(ctx, X, Y, k, t, R, this.B, p.s); }
      for (const sp of this.free) { const K = LIFE_FREE[sp.s.k]; if (K.glow) for (const a of sp.list) K.glow(ctx, a, t, R, this.B); }
      return;
    }
    for (const p of this.props) {
      if ((p.s.where || 'layer') !== where) continue;
      if (where === 'layer' && p.s.layer !== li) continue;
      this._drawProp(ctx, R, t, p, L);
    }
    for (const sp of this.free) {
      if ((sp.s.where || 'front') !== where) continue;
      if (where === 'layer' && sp.s.layer !== li) continue;
      const K = LIFE_FREE[sp.s.k];
      for (const a of sp.list) K.draw(ctx, a, t, R, this.B);
    }
  }

  _drawProp(ctx, R, t, p, L) {
    const k = R.H / 900, lw = LAYER_W * k;
    const off = L ? L.off : ((this.pcx * R.BASE * (p.s.par || 0.01)) % lw + lw) % lw;
    const base = L ? L.base : R.H * this.B.horizon;
    const Y = base - (p.s.y || 0) * k;
    p.pos.length = 0;
    let x = -off + p.s.x * k;
    while (x > -lw) x -= lw;
    for (; x < R.W + lw * 0.5; x += lw) {
      if (x < -420 * k || x > R.W + 420 * k) continue;
      p.pos.push([x, Y, k]);
      LIFE_PROP[p.s.k].draw(ctx, x, Y, k, t, R, this.B, p.s);
    }
  }

  lightHoles(hole, R) {
    for (const p of this.props) { const K = LIFE_PROP[p.s.k]; if (K.light) for (const [X, Y, k] of p.pos) K.light(hole, X, Y, k, R); }
    for (const sp of this.free) { const K = LIFE_FREE[sp.s.k]; if (K.light) for (const a of sp.list) K.light(hole, a, R); }
  }
}

/* ------------------------------ птицы ------------------------------ */

/* Птица сбоку-снизу: два крыла — переднее и заднее — расходятся из корпуса, мах вниз резкий
   (рабочий ход), вверх мягкий и с поджатым крылом; у вороны кончики маховых расходятся «пальцами».
   Такой силуэт читается даже в 6 пикселей. */
function drawBirdShape(ctx, s, ph, col, o = {}) {
  const warp = ph + 0.4 * Math.sin(ph);
  const fl = Math.sin(warp);                              // +1 крылья внизу, -1 вверху
  const A = 0.92 * (-fl) + 0.18;                          // угол крыла от горизонтали (лёгкий развал)
  const fold = fl < 0 ? 0.84 : 1;
  const span = s * (o.span || 1.7) * fold;
  const fingers = o.fingers !== false;
  const wing = (dirX, sc, alpha, dA) => {
    const L = span * sc, AA = A + (dA || 0);
    // крыло тянется вверх-в сторону: по горизонтали короче, по вертикали длиннее — узкая «галка»
    const tx = dirX * L * Math.cos(AA) * 0.72, ty = -L * Math.sin(AA) * 1.25;
    const camber = (fl > 0 ? 1 : -1) * L * 0.18;          // прогиб паруса по ходу маха
    const mx = tx * 0.5 - Math.sin(AA) * camber * 0.3;
    const my = ty * 0.5 + camber * 0.35;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(dirX * s * 0.22, -s * 0.08);
    ctx.quadraticCurveTo(mx + dirX * s * 0.12, my - s * 0.06, tx, ty);
    if (fingers) {
      const ux = -Math.cos(AA) * dirX, uy = Math.sin(AA);  // от кончика к телу
      for (let f = 0; f < 3; f++) {
        const k = (f + 1) / 4;
        ctx.lineTo(tx + ux * L * 0.1 * k + uy * s * 0.02, ty + uy * L * 0.1 * k + s * 0.05 * k);
        ctx.lineTo(tx + ux * L * 0.18 * k, ty + uy * L * 0.18 * k + s * 0.12 * k);
      }
    } else ctx.lineTo(tx - dirX * L * 0.05, ty + s * 0.12);
    ctx.quadraticCurveTo(mx - dirX * s * 0.06, my + s * 0.2, dirX * s * 0.04, s * 0.09);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  wing(-1, 0.96, 0.6, -0.14);                             // дальнее (заднее) крыло глуше и ниже
  // корпус
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(s * 0.36, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.14, -s * 0.17, -s * 0.1, -s * 0.13);
  ctx.quadraticCurveTo(-s * 0.24, -s * 0.09, -s * 0.3, 0.0);
  ctx.quadraticCurveTo(-s * 0.18, s * 0.14, 0, s * 0.15);
  ctx.quadraticCurveTo(s * 0.2, s * 0.12, s * 0.36, -s * 0.02);
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.4, -s * 0.1, s * 0.13, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  if (o.beak) { ctx.beginPath(); ctx.moveTo(s * 0.64, -s * 0.1); ctx.lineTo(s * 0.88, -s * 0.05); ctx.lineTo(s * 0.64, -s * 0.01); ctx.fill(); }
  const fan = o.fan || 0.3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, -s * 0.02);
  ctx.lineTo(-s * (0.56 + fan * 0.45), -s * fan * 0.5);
  ctx.lineTo(-s * (0.62 + fan * 0.3), s * 0.02);
  ctx.lineTo(-s * (0.56 + fan * 0.45), s * fan * 0.55);
  ctx.closePath(); ctx.fill();
  wing(1, 1, 1, 0.1);                                     // ближнее (переднее) крыло поверх
}

// одна птица с поворотом по курсу и креном в развороте
function drawFlyer(ctx, x, y, s, ph, col, dir, bank, pitch, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(pitch || 0);
  ctx.scale(1, Math.max(0.25, Math.cos(bank || 0)));   // крен: силуэт сжимается по вертикали
  drawBirdShape(ctx, s, ph, col, o);
  ctx.restore();
}

LIFE_FREE.crow = {
  spawn(a, R, B, r) {
    a.flap = r() * 6; a.glide = 0; a.bank = 0; a.pitch = 0;
    a.n = 1 + Math.floor(r() * 3); a.mates = [];
    for (let i = 1; i < a.n; i++) a.mates.push({ dx: (r() - 0.5) * 150, dy: (r() - 0.5) * 70, ph: r() * 6, vx: 0, vy: 0 });
    a.circling = r() < 0.25; a.cx = 0; a.ct = r() * 6;
  },
  update(a, dt, t, R, B) {
    a.glide -= dt;
    if (a.glide < -1.4) a.glide = 0.4 + Math.random() * 1.1;
    const flapping = a.glide <= 0;
    a.flap += dt * (flapping ? 11 : 1.5);
    if (a.circling) {
      // кружит на восходящем потоке
      a.ct += dt * 0.7;
      a.vx = Math.cos(a.ct) * 45 * a.dir;
      a.vy = Math.sin(a.ct * 1.0) * 16;
      a.bank = Math.sin(a.ct) * 0.7;
      a.dir = a.vx >= 0 ? 1 : -1;
    } else {
      a.vy = Math.sin(a.t * 0.7) * 7 + Math.sin(a.t * 1.7) * 3;
      a.bank = Math.sin(a.t * 0.7) * 0.25;
    }
    a.pitch = clamp(-a.vy * 0.004, -0.25, 0.25) * a.dir;
    // спутники держат строй, слегка рыская
    for (const m of a.mates) {
      m.vx += (-m.dx * 0.6 + Math.sin(t * 0.9 + m.ph) * 30) * dt;
      m.vy += (-m.dy * 0.5 + Math.cos(t * 1.1 + m.ph) * 20) * dt;
      m.vx *= 0.92; m.vy *= 0.92;
      m.dx += m.vx * dt; m.dy += m.vy * dt;
    }
  },
  draw(ctx, a, t, R, B) {
    const s = 10 * a.sc * R.dpr, col = rgba(B.night ? '#080a10' : mix('#0d0f14', B.haze, 0.12), 0.94);
    drawFlyer(ctx, a.x, a.y, s, a.flap, col, a.dir, a.bank, a.pitch, { span: 1.15, fingers: true, beak: true, fan: 0.3 });
    for (const m of a.mates) {
      drawFlyer(ctx, a.x + m.dx * a.sc * R.dpr * 0.45, a.y + m.dy * a.sc * R.dpr * 0.45, s * 0.85,
        a.flap + m.ph, col, a.dir, a.bank * 0.7, a.pitch, { span: 1.1, fingers: true, beak: true });
    }
  }
};

// стая: правила боидов — держаться вместе, не сталкиваться, лететь как сосед
LIFE_FREE.flock = {
  spawn(a, R, B, r) {
    a.n = 7 + Math.floor(r() * 9);
    a.b = [];
    for (let i = 0; i < a.n; i++) a.b.push({ x: (r() - 0.5) * 260, y: (r() - 0.5) * 90, vx: 0, vy: 0, ph: r() * 6 });
    a.flap = 0;
  },
  update(a, dt, t) {
    a.flap += dt * 8;
    a.vy = Math.sin(a.t * 0.35) * 4;
    const B = a.b;
    for (let i = 0; i < B.length; i++) {
      const p = B[i];
      let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, n = 0;
      for (let j = 0; j < B.length; j++) {
        if (i === j) continue;
        const q = B[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 > 40000) continue;
        cx += q.x; cy += q.y; ax += q.vx; ay += q.vy; n++;
        if (d2 < 900) { sx -= dx / (d2 + 1) * 900; sy -= dy / (d2 + 1) * 900; }
      }
      if (n) {
        cx = cx / n - p.x; cy = cy / n - p.y; ax = ax / n - p.vx; ay = ay / n - p.vy;
        p.vx += (cx * 0.6 + ax * 0.5 + sx * 2.2) * dt;
        p.vy += (cy * 0.5 + ay * 0.5 + sy * 2.2) * dt;
      }
      // клин: тянет к строю чуть позади и сбоку от вожака
      const slot = i === 0 ? [0, 0] : [-Math.ceil(i / 2) * 26, (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 13];
      p.vx += (slot[0] - p.x) * 0.5 * dt; p.vy += (slot[1] - p.y) * 0.5 * dt;
      p.vx += Math.sin(t * 0.8 + p.ph) * 18 * dt; p.vy += Math.cos(t * 1.1 + p.ph) * 12 * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw(ctx, a, t, R, B) {
    const s = 5.5 * a.sc * R.dpr, col = rgba(mix('#12151c', B.haze, 0.28), 0.88);
    ctx.save(); ctx.translate(a.x, a.y);
    for (let i = 0; i < a.b.length; i++) {
      const p = a.b[i];
      drawFlyer(ctx, p.x * a.sc * R.dpr * 0.5, p.y * a.sc * R.dpr * 0.5, s, a.flap + p.ph, col, a.dir,
        clamp(p.vy * 0.004, -0.5, 0.5), clamp(p.vy * 0.002, -0.2, 0.2) * a.dir, { span: 1.05, fingers: false });
    }
    ctx.restore();
  }
};

// чайки: парят на восходящем потоке, редкие взмахи, чёрные концы крыльев
LIFE_FREE.gull = {
  spawn(a, R, B, r) { a.flap = r() * 6; a.glide = 1.6; a.bank = 0; },
  update(a, dt, t) {
    a.glide -= dt; if (a.glide < -0.6) a.glide = 1.5 + Math.random() * 2.5;
    a.flap += dt * (a.glide > 0 ? 0.9 : 8);
    a.vy = Math.sin(a.t * 0.5) * 12 + Math.sin(a.t * 1.3) * 4;
    a.bank = Math.sin(a.t * 0.5) * 0.45;
    a.pitch = clamp(-a.vy * 0.005, -0.3, 0.3) * a.dir;
  },
  draw(ctx, a, t, R, B) {
    const s = 13 * a.sc * R.dpr;
    const body = rgba(B.night ? '#9aa6b8' : '#f4f7f8', 0.96);
    drawFlyer(ctx, a.x, a.y, s, a.flap, body, a.dir, a.bank, a.pitch, { span: 1.35, fingers: false, beak: true, fan: 0.22 });
    // тёмные концы крыльев
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.dir, 1); ctx.rotate(a.pitch || 0);
    ctx.scale(1, Math.max(0.25, Math.cos(a.bank)));
    const warp = a.flap + 0.45 * Math.sin(a.flap), fl = Math.sin(warp), span = s * 1.35 * (fl > 0 ? 1 : 0.78);
    ctx.strokeStyle = rgba('#2c3239', 0.85); ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-span * 0.72, -fl * span * 1.02 + s * 0.06);
    ctx.lineTo(-span * 0.98, -fl * span * 1.06 + s * 0.14);
    ctx.stroke();
    ctx.restore();
  }
};

// летучие мыши: рваная траектория, перепончатые крылья
LIFE_FREE.bat = {
  spawn(a, R, B, r) { a.n = 3 + Math.floor(r() * 5); a.off = []; for (let i = 0; i < a.n; i++) a.off.push([r() * 6, 40 + r() * 90, r() * 6]); },
  update(a, dt) { a.flap = (a.flap || 0) + dt * 17; },
  draw(ctx, a, t, R, B) {
    const s = 6 * a.sc * R.dpr;
    ctx.fillStyle = 'rgba(8,8,12,0.85)';
    for (const [ph, rad, sp] of a.off) {
      const x = a.x + Math.cos(a.t * 1.7 + ph) * rad * R.dpr * 0.5, y = a.y + Math.sin(a.t * 2.3 + sp) * rad * R.dpr * 0.35;
      const w = Math.abs(Math.sin(a.flap + ph));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - s, y - s * w, x - s * 1.6, y + s * 0.2);
      ctx.quadraticCurveTo(x - s * 0.7, y + s * 0.25, x, y + s * 0.15);
      ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.25, x + s * 1.6, y + s * 0.2);
      ctx.quadraticCurveTo(x + s, y - s * w, x, y); ctx.fill();
    }
  }
};

/* ------------------------------ техника ------------------------------ */

// Ан-2 «кукурузник»: биплан с расчалками, диск винта, лёгкая болтанка
LIFE_FREE.biplane = {
  spawn(a, R, B, r) { a.roll = 0; a.smoke = []; a.puff = 0; },
  update(a, dt, t) { a.vy = Math.sin(a.t * 0.55) * 7; a.roll = Math.sin(a.t * 0.55 + 1) * 0.05; },
  draw(ctx, a, t, R, B) {
    const s = 3.4 * a.sc * R.dpr;
    const body = B.night ? '#20242c' : mix('#3c4a58', B.haze, 0.3 * (1 - a.sc * 0.4));
    const lit = mix(body, B.sunCol, B.sunK * 0.35);
    ctx.save(); ctx.translate(a.x, a.y + Math.sin(a.t * 2.1) * R.dpr); ctx.rotate(a.roll * a.dir); ctx.scale(a.dir * s, s);
    // фюзеляж
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-9, 0.2); ctx.quadraticCurveTo(-4, -1.9, 4.4, -1.5);
    ctx.quadraticCurveTo(7.4, -1.3, 7.8, 0); ctx.quadraticCurveTo(7.4, 1.4, 3.6, 1.6);
    ctx.quadraticCurveTo(-3, 1.8, -9, 0.9); ctx.closePath(); ctx.fill();
    // киль и стабилизатор
    ctx.beginPath(); ctx.moveTo(-9, 0.4); ctx.lineTo(-10.6, -3.4); ctx.lineTo(-7.6, -3.2); ctx.lineTo(-6.4, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(-11, -0.4, 4.6, 0.55);
    // нижнее и верхнее крыло
    ctx.fillStyle = mix(body, '#000000', 0.15);
    ctx.fillRect(-2.6, 1.2, 11.5, 0.7);
    ctx.fillStyle = lit;
    ctx.fillRect(-3.4, -4.1, 13.5, 0.85);
    // стойки и расчалки
    ctx.strokeStyle = rgba(body, 0.9); ctx.lineWidth = 0.28;
    for (const dx of [-2.2, 6.4]) { ctx.beginPath(); ctx.moveTo(dx, -3.3); ctx.lineTo(dx + 0.6, 1.3); ctx.stroke(); }
    ctx.lineWidth = 0.14;
    ctx.beginPath(); ctx.moveTo(-2.2, -3.2); ctx.lineTo(7, 1.3); ctx.moveTo(6.4, -3.2); ctx.lineTo(-1.6, 1.3); ctx.stroke();
    // остекление кабины
    ctx.fillStyle = rgba(B.night ? '#26313f' : '#9fc4da', 0.85);
    ctx.beginPath(); ctx.moveTo(3.4, -1.3); ctx.lineTo(6.6, -1.1); ctx.lineTo(6.8, -0.2); ctx.lineTo(3.4, -0.3); ctx.closePath(); ctx.fill();
    // шасси
    ctx.strokeStyle = body; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(2.4, 1.6); ctx.lineTo(1.6, 3.1); ctx.moveTo(4.6, 1.6); ctx.lineTo(2.2, 3.1); ctx.stroke();
    ctx.fillStyle = '#17191d'; ctx.beginPath(); ctx.ellipse(1.8, 3.3, 0.75, 0.75, 0, 0, Math.PI * 2); ctx.fill();
    // диск винта
    ctx.fillStyle = rgba('#dfe6ec', 0.16);
    ctx.beginPath(); ctx.ellipse(8.1, -0.1, 0.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba('#e8eef2', 0.3); ctx.lineWidth = 0.2;
    const pa = t * 40;
    ctx.beginPath(); ctx.moveTo(8.1, -0.1); ctx.lineTo(8.1 + Math.cos(pa) * 0.4, -0.1 + Math.sin(pa) * 3.3); ctx.stroke();
    ctx.restore();
  }
};

// Ми-8: несущий винт размывается в диск, ночью — посадочная фара
LIFE_FREE.heli = {
  update(a, dt) { a.vy = Math.sin(a.t * 0.8) * 5; },
  draw(ctx, a, t, R, B) {
    const s = 3 * a.sc * R.dpr;
    const body = B.night ? '#1c2129' : mix('#3f4a3c', B.haze, 0.25);
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.dir * 0.05); ctx.scale(a.dir * s, s);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(6.6, -0.4); ctx.quadraticCurveTo(7.6, 0.6, 5.4, 1.6); ctx.lineTo(-2, 1.7);
    ctx.quadraticCurveTo(-4.4, 1.5, -5, 0.6); ctx.lineTo(-12.5, 0.2); ctx.lineTo(-12.5, -0.5);
    ctx.lineTo(-5, -1); ctx.quadraticCurveTo(-3, -2.4, 1.6, -2.5); ctx.quadraticCurveTo(5.4, -2.4, 6.6, -0.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12.4, -0.4); ctx.lineTo(-14, -3.4); ctx.lineTo(-11.4, -3.2); ctx.lineTo(-10.8, -0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(B.night ? '#2a3542' : '#9fc4da', 0.8);
    ctx.beginPath(); ctx.moveTo(3.4, -2); ctx.quadraticCurveTo(6.4, -1.8, 6.4, -0.5); ctx.lineTo(3.4, -0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(1.2, -2.5); ctx.lineTo(1.2, -3.6); ctx.stroke();
    // диск несущего винта
    ctx.fillStyle = rgba('#cfd8e0', 0.12);
    ctx.beginPath(); ctx.ellipse(1.2, -3.8, 11, 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba('#e6edf2', 0.35); ctx.lineWidth = 0.22;
    for (let i = 0; i < 5; i++) { const ang = t * 26 + i * 1.25; ctx.beginPath(); ctx.moveTo(1.2, -3.8); ctx.lineTo(1.2 + Math.cos(ang) * 10.5, -3.8 + Math.sin(ang) * 0.45); ctx.stroke(); }
    // рулевой винт
    ctx.fillStyle = rgba('#cfd8e0', 0.14);
    ctx.beginPath(); ctx.ellipse(-13.4, -1.4, 0.45, 2.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c1332a'; ctx.fillRect(-0.4, 1.4, 0.5, 0.4);
    ctx.restore();
  },
  glow(ctx, a, t, R, B) {
    if (!B.night) return;
    const blink = Math.sin(t * 7) > 0.4 ? 1 : 0.15;
    for (const [dx, dy, col, al] of [[-13 * a.dir, -2, '#ff3b30', blink], [10 * a.dir, 2, '#fff4d0', 0.8]]) {
      const x = a.x + dx * 3 * a.sc * R.dpr, y = a.y + dy * 3 * a.sc * R.dpr, rr = (col === '#ff3b30' ? 10 : 26) * a.sc * R.dpr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba(col, 0.55 * al)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
};

// высотный самолёт с инверсионным следом
LIFE_FREE.jet = {
  spawn(a) { a.trail = []; },
  update(a, dt, t, R) {
    a.trailT = (a.trailT || 0) + dt;
    if (a.trailT > 0.12) { a.trailT = 0; a.trail.push({ x: a.x, y: a.y, age: 0 }); }
    for (const p of a.trail) { p.age += dt; p.x -= a.vx * 0 * dt; }
    a.trail = a.trail.filter(p => p.age < 26);
  },
  draw(ctx, a, t, R, B) {
    const s = 2 * a.sc * R.dpr;
    ctx.lineCap = 'round';
    for (let i = 1; i < a.trail.length; i++) {
      const p = a.trail[i], q = a.trail[i - 1];
      const al = clamp(1 - p.age / 26, 0, 1) * 0.5;
      ctx.strokeStyle = rgba(B.night ? '#8a94a8' : '#ffffff', al * 0.8);
      ctx.lineWidth = (1.4 + p.age * 0.25) * R.dpr;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.dir * s, s);
    ctx.fillStyle = rgba(B.night ? '#2a3140' : mix('#4a5563', B.haze, 0.45), 0.9);
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, 0.7); ctx.lineTo(-4, -0.1); ctx.lineTo(-3, -0.7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(-2.5, 2.6); ctx.lineTo(-1, 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(-2.5, -2.6); ctx.lineTo(-1, -0.1); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
};

// судно вдали: идёт по горизонту, тянет дым
LIFE_FREE.ship = {
  draw(ctx, a, t, R, B) {
    const s = 1.6 * a.sc * R.dpr;
    const col = B.night ? '#10161d' : mix('#2c3843', B.haze, 0.5);
    ctx.save(); ctx.translate(a.x, a.y + Math.sin(a.t * 0.6) * R.dpr); ctx.rotate(Math.sin(a.t * 0.5) * 0.012); ctx.scale(a.dir * s, s);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(30, 7); ctx.lineTo(-28, 7); ctx.closePath(); ctx.fill();
    ctx.fillRect(-6, -11, 16, 11);
    ctx.fillRect(-2, -18, 5, 7);
    ctx.fillStyle = rgba(col, 0.8); ctx.fillRect(18, -6, 3, 6); ctx.fillRect(-24, -5, 2.5, 5);
    ctx.restore();
    // бурун и кильватерный след
    const bow = a.x + a.dir * 34 * s, stern = a.x - a.dir * 30 * s;
    ctx.fillStyle = rgba('#ffffff', B.night ? 0.16 : 0.3);
    ctx.beginPath(); ctx.ellipse(bow, a.y + 6 * s, 12 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 10; i++) {
      const u = i / 10;
      const wx = stern - a.dir * u * 150 * s, wy = a.y + 6 * s + u * 2 * R.dpr;
      ctx.fillStyle = rgba('#ffffff', (B.night ? 0.1 : 0.2) * (1 - u));
      ctx.fillRect(wx - 8 * s, wy + Math.sin(t * 1.4 + i) * 0.6 * R.dpr, 16 * s, 1.6 * R.dpr);
    }
    // дымок из трубы
    for (let i = 0; i < 6; i++) {
      const age = (t * 0.6 + i * 0.7) % 4.2;
      const px = a.x + (0.5 - a.dir * 8 - age * 9) * s * a.dir, py = a.y - 20 * s - age * 7 * R.dpr;
      const rr = (3 + age * 5) * s * R.dpr * 0.6;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, rgba(B.night ? '#2a2f38' : '#6b7280', 0.3 * (1 - age / 4.2))); g.addColorStop(1, rgba('#6b7280', 0));
      ctx.fillStyle = g; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
  }
};

// перекати-поле у обочины
LIFE_FREE.tumbleweed = {
  spawn(a, R, B, r) { a.spin = 0; a.bounce = 0; a.twigs = []; for (let i = 0; i < 9; i++) a.twigs.push([r() * 6.3, 0.4 + r() * 0.6]); },
  update(a, dt) { a.spin += dt * a.vx * 0.05; a.bounce += dt * 6; a.vy = 0; },
  draw(ctx, a, t, R, B) {
    const s = 11 * a.sc * R.dpr, y = a.y - Math.abs(Math.sin(a.bounce)) * 14 * R.dpr;
    ctx.save(); ctx.translate(a.x, y); ctx.rotate(a.spin);
    ctx.strokeStyle = rgba(mix('#8a7043', B.haze, 0.3), 0.85); ctx.lineWidth = 1.2 * R.dpr;
    for (const [ang, len] of a.twigs) {
      ctx.beginPath(); ctx.moveTo(-Math.cos(ang) * s * len, -Math.sin(ang) * s * len);
      ctx.quadraticCurveTo(Math.cos(ang + 1) * s * 0.3, Math.sin(ang + 1) * s * 0.3, Math.cos(ang) * s * len, Math.sin(ang) * s * len);
      ctx.stroke();
    }
    ctx.restore();
  }
};

/* ------------------------------ привязанное к слою ------------------------------ */

// столб дыма: клубы поднимаются и сносятся ветром
LIFE_PROP.plume = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const n = s.n || 12, h = (s.h || 260) * k, wind = (s.wind || 26) * k, col = s.col || (B.night ? '#2a2d35' : '#6a6f78');
    for (let i = 0; i < n; i++) {
      const age = ((t * (s.sp || 0.18) + i / n) % 1);
      const rise = age * h;
      const px = X + wind * age * age + Math.sin(age * 4 + i) * 8 * k;
      const py = Y - rise;
      const rr = (10 + age * (s.r || 46)) * k;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      const a = (s.a || 0.5) * (1 - age) * (0.5 + 0.5 * Math.sin(i * 2.7));
      g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
  }
};

// пламя: факел НПЗ или пожар в здании
LIFE_PROP.flame = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const h = (s.h || 60) * k, w = (s.w || 22) * k;
    const fl = 0.75 + 0.25 * Math.sin(t * 9 + X) + 0.12 * Math.sin(t * 23 + X * 0.3);
    ctx.save(); ctx.translate(X, Y);
    const g = ctx.createLinearGradient(0, 0, w * 0.4, -h * fl);
    g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.4, 'rgba(255,150,40,0.8)'); g.addColorStop(1, 'rgba(180,50,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w * 0.4, 0);
    ctx.quadraticCurveTo(-w * 0.55, -h * 0.5 * fl, w * 0.1, -h * fl);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.45 * fl, w * 0.45, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  glow(ctx, X, Y, k, t, R, B, s) {
    const rr = (s.h || 60) * k * 2.4, fl = 0.7 + 0.3 * Math.sin(t * 9 + X);
    const g = ctx.createRadialGradient(X, Y - (s.h || 60) * k * 0.4, 0, X, Y - (s.h || 60) * k * 0.4, rr);
    g.addColorStop(0, `rgba(255,150,60,${0.32 * fl})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(X - rr, Y - rr * 1.5, rr * 2, rr * 2);
  },
  light(hole, X, Y, k, R) { hole(X, Y - 20 * k, 90 * k, 0.55); }
};

// мигающий авиационный огонь на мачте
LIFE_PROP.beacon = {
  draw() { },
  glow(ctx, X, Y, k, t, R, B, s) {
    const per = s.per || 2.2, ph = (t % per) / per;
    const on = ph < 0.12 ? 1 : ph < 0.2 ? (0.2 - ph) / 0.08 : 0;
    if (on <= 0) return;
    const rr = 16 * k * (0.6 + on);
    const col = s.col || '#ff3b30';
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, rr);
    g.addColorStop(0, rgba(col, 0.9 * on)); g.addColorStop(0.3, rgba(col, 0.35 * on)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
  }
};

// вращающийся луч маяка
LIFE_PROP.lighthouse = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const per = s.per || 6, a = (t % per) / per * Math.PI * 2;
    const beam = Math.cos(a);
    if (beam <= 0.1) return;
    const len = (s.len || 700) * k, wid = 0.1 + 0.16 * (1 - beam);
    ctx.save(); ctx.translate(X, Y); ctx.globalCompositeOperation = 'lighter';
    const dir = Math.sin(a) > 0 ? 1 : -1;
    const g = ctx.createLinearGradient(0, 0, dir * len, -len * 0.12);
    g.addColorStop(0, `rgba(255,244,200,${0.3 * beam})`); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(dir * len, -len * wid); ctx.lineTo(dir * len, len * wid * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  glow(ctx, X, Y, k, t, R, B, s) {
    const per = s.per || 6, beam = Math.cos((t % per) / per * Math.PI * 2);
    const rr = 30 * k * (0.5 + Math.max(0, beam));
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, rr);
    g.addColorStop(0, `rgba(255,246,210,${0.5 * (0.3 + Math.max(0, beam) * 0.7)})`); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
  },
  light(hole, X, Y, k) { hole(X, Y, 70 * k, 0.5); }
};

// лопасти ветряка
LIFE_PROP.windmill = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const rr = (s.r || 34) * k, n = s.n || 14;
    const sp = (s.sp || 0.5) * (1 + 0.25 * Math.sin(t * 0.3));
    ctx.save(); ctx.translate(X, Y); ctx.rotate(t * sp);
    ctx.fillStyle = rgba(mix('#2b2f36', B.haze, B.night ? 0.05 : 0.35), 0.9);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr * 0.16, Math.sin(a) * rr * 0.16);
      ctx.lineTo(Math.cos(a + 0.2) * rr, Math.sin(a + 0.2) * rr);
      ctx.lineTo(Math.cos(a + 0.36) * rr, Math.sin(a + 0.36) * rr); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
};

// прожектор: медленно шарит по небу
LIFE_PROP.searchlight = {
  draw(ctx, X, Y, k, t, R, B, s) {
    if (!B.night && !B.storm) return;
    const a = -Math.PI / 2 + Math.sin(t * (s.sp || 0.25) + X) * (s.sweep || 0.6);
    const len = (s.len || 900) * k, w = 0.035;
    ctx.save(); ctx.translate(X, Y); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, 'rgba(220,235,255,0.22)'); g.addColorStop(1, 'rgba(200,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
    ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
};

// поток воды из водосброса плотины
LIFE_PROP.spill = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const w = (s.w || 80) * k, h = (s.h || 380) * k;
    ctx.save();
    ctx.beginPath(); ctx.rect(X - w / 2, Y, w, h); ctx.clip();
    ctx.fillStyle = rgba(B.night ? '#9fb4c4' : '#e9f2f7', 0.12);
    for (let i = 0; i < 14; i++) {
      const ph = (t * 1.6 + i * 0.37) % 1;
      ctx.fillRect(X - w / 2 + (i * 37 % w), Y + ph * h - h * 0.3, 3 * k, h * 0.35);
    }
    ctx.restore();
    const rr = w * 1.1, my = Y + h;
    const g = ctx.createRadialGradient(X, my, 0, X, my, rr);
    const a = 0.3 + 0.08 * Math.sin(t * 2 + X);
    g.addColorStop(0, rgba(B.night ? '#8fa6b8' : '#f2f7fa', a)); g.addColorStop(1, rgba('#e9f2f7', 0));
    ctx.fillStyle = g; ctx.fillRect(X - rr, my - rr, rr * 2, rr * 2);
  }
};


/* ------------------------------ атмосфера и мелочи ------------------------------ */

// лопасти ветрогенератора
LIFE_PROP.turbine = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const rr = (s.r || 90) * k, w = B.wind(t);
    const col = rgba(mix(B.night ? '#20262e' : '#cfd8dd', B.haze, B.night ? 0.3 : 0.55), 0.85);
    ctx.save(); ctx.translate(X, Y); ctx.rotate(t * (s.sp || 0.5) * w);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, -rr * 0.05); ctx.quadraticCurveTo(rr * 0.5, -rr * 0.07, rr, -rr * 0.012);
      ctx.lineTo(rr, rr * 0.012); ctx.quadraticCurveTo(rr * 0.5, rr * 0.05, 0, rr * 0.05); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, rr * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
};

// флаг или тряпка на мачте: полощется по ветру
LIFE_PROP.flag = {
  draw(ctx, X, Y, k, t, R, B, s) {
    const w = (s.w || 46) * k, h = (s.h || 26) * k, wind = clamp(B.wind(t), 0.2, 2.2);
    const dir = s.dir || -1;
    ctx.save(); ctx.translate(X, Y);
    ctx.strokeStyle = rgba(mix('#2a2e33', B.haze, 0.2), 0.9); ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h * 2.4); ctx.stroke();
    const top = -h * 2.3;
    ctx.fillStyle = rgba(s.col || '#9c3b2e', 0.9);
    ctx.beginPath();
    ctx.moveTo(0, top);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      ctx.lineTo(dir * u * w * wind * 0.8, top + Math.sin(t * 6 * wind + u * 5) * h * 0.25 * u);
    }
    for (let i = 8; i >= 0; i--) {
      const u = i / 8;
      ctx.lineTo(dir * u * w * wind * 0.8, top + h * 0.75 + Math.sin(t * 6 * wind + u * 5 + 0.6) * h * 0.3 * u);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
};

// толпа мертвецов бредёт вдалеке по дороге
LIFE_FREE.horde = {
  spawn(a, R, B, r) {
    a.n = 10 + Math.floor(r() * 14); a.p = [];
    for (let i = 0; i < a.n; i++) a.p.push({ x: r() * 260, y: (r() - 0.5) * 10, ph: r() * 6, sp: 0.8 + r() * 0.5, lean: (r() - 0.5) * 0.3 });
  },
  update(a, dt) { a.ph = (a.ph || 0) + dt; },
  draw(ctx, a, t, R, B) {
    const s = 9 * a.sc * R.dpr;
    const col = rgba(B.night ? '#0b0e14' : mix('#171a20', B.haze, 0.35), 0.85);
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.dir, 1);
    for (const p of a.p) {
      const ph = t * p.sp * 2.4 + p.ph;
      const x = p.x * a.sc * R.dpr * 0.4, y = p.y * a.sc * R.dpr + Math.abs(Math.sin(ph)) * s * 0.08;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.lean * 0.4 + Math.sin(ph * 0.5) * 0.04);
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.16, -s * 0.95, s * 0.32, s * 0.62);                 // корпус
      ctx.beginPath(); ctx.arc(0, -s * 1.02, s * 0.15, 0, Math.PI * 2); ctx.fill();
      const sw = Math.sin(ph) * s * 0.22;
      ctx.lineWidth = s * 0.11; ctx.strokeStyle = col; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.36); ctx.lineTo(sw, 0); ctx.moveTo(0, -s * 0.36); ctx.lineTo(-sw, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.8); ctx.lineTo(s * 0.26, -s * 0.72 + Math.sin(ph + 1) * s * 0.06); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
};

// пыль, пепел или пух в воздухе у камеры
LIFE_FREE.motes = {
  spawn(a, R, B, r) {
    a.n = 26 + Math.floor(r() * 16); a.p = [];
    for (let i = 0; i < a.n; i++) a.p.push({ x: r() * R.W, y: r() * R.H * 0.8, r: 0.6 + r() * 2.2, ph: r() * 6, sp: 0.3 + r() * 0.9 });
    a.x = R.W / 2; a.vx = 0;
  },
  update(a, dt, t, R, B) {
    const w = B.wind(t);
    for (const p of a.p) {
      p.x -= (14 + p.sp * 26) * w * dt * R.dpr;
      p.y += Math.sin(t * p.sp + p.ph) * 8 * dt * R.dpr + (a.fall || 0) * dt * R.dpr;
      if (p.x < -20) { p.x = R.W + 20; p.y = Math.random() * R.H * 0.8; }
      if (p.y > R.H) p.y = -10;
    }
    a.x = R.W / 2;
  },
  draw(ctx, a, t, R, B) {
    const em = a.ember;
    for (const p of a.p) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + p.sp) + p.ph));
      ctx.fillStyle = em ? `rgba(255,${120 + Math.floor(tw * 90)},60,${0.5 * tw})` : rgba(B.night ? '#9fb0c8' : '#ffffff', 0.18 * tw);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * R.dpr, 0, Math.PI * 2); ctx.fill();
    }
  },
  glow(ctx, a, t, R, B) {
    if (!a.ember) return;
    for (const p of a.p) {
      const rr = p.r * 6 * R.dpr, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + p.sp) + p.ph));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, `rgba(255,140,60,${0.22 * tw})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
  }
};

// светлячки в ночном лесу
LIFE_FREE.firefly = {
  spawn(a, R, B, r) {
    a.n = 14 + Math.floor(r() * 10); a.p = [];
    for (let i = 0; i < a.n; i++) a.p.push({ x: r() * R.W, y: R.H * (0.45 + r() * 0.3), ph: r() * 6, sp: 0.4 + r() * 0.8, on: r() });
  },
  update(a, dt, t, R) {
    for (const p of a.p) {
      p.x += Math.sin(t * p.sp + p.ph) * 14 * dt * R.dpr;
      p.y += Math.cos(t * p.sp * 0.7 + p.ph) * 10 * dt * R.dpr;
      p.on = 0.5 + 0.5 * Math.sin(t * (1.2 + p.sp) + p.ph * 3);
    }
  },
  draw() { },
  glow(ctx, a, t, R) {
    for (const p of a.p) {
      const k = Math.pow(clamp(p.on, 0, 1), 3), rr = 9 * R.dpr;
      if (k < 0.05) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, `rgba(190,255,120,${0.5 * k})`); g.addColorStop(1, 'rgba(160,255,90,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
  }
};
