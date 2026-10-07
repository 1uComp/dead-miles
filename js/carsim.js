'use strict';
/* Реалистичная машина: трансмиссия, шины, аэродинамика и повреждения.
   Трансмиссия по «Car Physics for Games» (M. Monster): момент на колесе = момент двигателя по кривой
   × передаточное число × главная пара × КПД; обороты считаются обратно от скорости колёс.
   Шины: сцепление максимально при малом проскальзывании и падает при пробуксовке/блокировке (форма кривой Пасейки).
   Повреждения по идее soft-body (BeamNG): необратимые вмятины корпуса, детали на «креплениях» с порогом прочности,
   бьющиеся стёкла и фары, повреждение мотора и подвески. */

const RPM_PER_RADS = 60 / (2 * Math.PI);

// нормированная кривая момента двигателя: пик около 60% отсечки, к отсечке спадает
function torqueCurve(x) {
  if (x > 1.03) return 0;
  const k = 1 - ((x - 0.6) / 0.6) ** 2;
  return clamp(0.58 + 0.42 * k, 0.45, 1);
}

// сцепление шины от коэффициента проскальзывания: линейный рост, пик ~10%, спад к полному юзу (форма «магической формулы» Пасейки)
function tireGrip(s) {
  const a = Math.abs(s);
  if (a < 0.1) return 1 + 0.05 * (a / 0.1);
  return 1.05 - 0.23 * Math.min(1, (a - 0.1) / 0.5);
}

function makeDrivetrain(def, st, up) {
  const drives = def.wheels.filter(w => w.drive);
  const r = drives.reduce((s, w) => s + w.r, 0) / drives.length;
  const style = def.look ? def.look.style : 'hatch';
  const redline = def.redline || (style === 'truck' ? 4600 : style === 'muscle' ? 6800 : style === 'pickup' ? 5600 : 6500);
  const idle = style === 'truck' ? 650 : style === 'muscle' ? 900 : 800;
  const fd = 3.7, eff = 0.88, n = 5;
  const spread = style === 'truck' ? 2.9 : style === 'muscle' ? 2.4 : style === 'pickup' ? 2.7 : 2.6;
  // высшая передача: на отсечке — максимальная скорость машины
  const topRatio = (redline / RPM_PER_RADS) / (st.topSpeed / r) / fd;
  const ratios = [];
  for (let i = 0; i < n; i++) ratios.push(topRatio * Math.pow(spread, (n - 1 - i) / (n - 1)));
  const massTotal = def.mass + def.wheels.reduce((s, w) => s + w.m, 0);
  // пиковый момент мотора: на первой передаче машина тянет так же, как в паспорте, на высших — мощность почти постоянна
  const wheelT1 = st.torque * st.lowGear * (def.launchK || 1.75);
  const Tpk = wheelT1 / (ratios[0] * fd * eff);
  const gb = up.gearbox || 0;
  return {
    r, redline, idle, fd, eff, ratios, revRatio: ratios[0] * 1.25, Tpk, massTotal,
    gear: 1, reverse: false, rpm: idle, shiftT: 0, cut: false, misfire: 0, misfireT: 0, tcsCut: 1,
    shiftTime: clamp(0.26 - 0.04 * gb, 0.1, 0.26),
    clutchRpm: style === 'truck' ? 1500 : style === 'muscle' ? 3200 : 2300,
    // тормоза сильнее сцепления задней оси: при нагрузке на нос без ABS зад уходит в юз
    brakeTorque: massTotal * 12.5 * r, brakeBias: 0.62,
    abs: !def.rust && style !== 'muscle', tcs: !def.rust && style !== 'muscle',
    CdA: ({ hatch: 0.72, pickup: 1.05, muscle: 0.62, truck: 1.9 }[style] || 0.8) * (def.military ? 1.2 : 1),
    Crr: def.offroad ? 0.018 : 0.013
  };
}

/* ------------------------------ деформация кузова ------------------------------ */

// обёртка контекста: все точки рисунка кузова проходят через поле вмятин
class DeformCtx {
  constructor(ctx, dmg) {
    this.c = ctx; this.dmg = dmg;
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.px = 0; this.py = 0; this.hasPt = false;
  }
  get fillStyle() { return this.c.fillStyle; } set fillStyle(v) { this.c.fillStyle = v; }
  get strokeStyle() { return this.c.strokeStyle; } set strokeStyle(v) { this.c.strokeStyle = v; }
  get lineWidth() { return this.c.lineWidth; } set lineWidth(v) { this.c.lineWidth = v; }
  get lineCap() { return this.c.lineCap; } set lineCap(v) { this.c.lineCap = v; }
  get lineJoin() { return this.c.lineJoin; } set lineJoin(v) { this.c.lineJoin = v; }
  get globalAlpha() { return this.c.globalAlpha; } set globalAlpha(v) { this.c.globalAlpha = v; }
  get globalCompositeOperation() { return this.c.globalCompositeOperation; } set globalCompositeOperation(v) { this.c.globalCompositeOperation = v; }
  get filter() { return this.c.filter; } set filter(v) { this.c.filter = v; }
  get font() { return this.c.font; } set font(v) { this.c.font = v; }

  _map(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _tp(x, y) { const p = this._map(x, y); return this.dmg.displace(p[0], p[1]); }
  save() { this.stack.push(this.m.slice()); this.c.save(); }
  restore() { this.m = this.stack.pop() || [1, 0, 0, 1, 0, 0]; this.c.restore(); }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a), m = this.m;
    const a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c;
  }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  beginPath() { this.c.beginPath(); this.hasPt = false; }
  closePath() { this.c.closePath(); }
  moveTo(x, y, target) {
    const t = target || this.c;
    const p = this._tp(x, y); t.moveTo(p[0], p[1]);
    this.px = x; this.py = y; this.hasPt = true;
  }
  lineTo(x, y, target) {
    const t = target || this.c;
    if (!this.hasPt) return this.moveTo(x, y, target);
    // длинные отрезки дробим, чтобы прямые кромки тоже прогибались во вмятинах
    const L = Math.hypot(x - this.px, y - this.py);
    const n = Math.min(10, Math.max(1, Math.ceil(L / 0.22)));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const p = this._tp(this.px + (x - this.px) * k, this.py + (y - this.py) * k);
      t.lineTo(p[0], p[1]);
    }
    this.px = x; this.py = y;
  }
  quadraticCurveTo(cx, cy, x, y, target) {
    if (!this.hasPt) this.moveTo(cx, cy, target);
    const x0 = this.px, y0 = this.py;
    const t = target || this.c;
    for (let i = 1; i <= 6; i++) {
      const k = i / 6, u = 1 - k;
      const qx = u * u * x0 + 2 * u * k * cx + k * k * x, qy = u * u * y0 + 2 * u * k * cy + k * k * y;
      const p = this._tp(qx, qy); t.lineTo(p[0], p[1]);
    }
    this.px = x; this.py = y;
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const x0 = this.px, y0 = this.py;
    for (let i = 1; i <= 8; i++) {
      const k = i / 8, u = 1 - k;
      const qx = u * u * u * x0 + 3 * u * u * k * c1x + 3 * u * k * k * c2x + k * k * k * x;
      const qy = u * u * u * y0 + 3 * u * u * k * c1y + 3 * u * k * k * c2y + k * k * k * y;
      const p = this._tp(qx, qy); this.c.lineTo(p[0], p[1]);
    }
    this.px = x; this.py = y;
  }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    let sweep = a1 - a0;
    if (ccw) { if (sweep > 0) sweep -= Math.PI * 2; } else if (sweep < 0) sweep += Math.PI * 2;
    const n = Math.max(8, Math.ceil(Math.abs(sweep) * Math.max(rx, ry) * 30));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + sweep * i / n;
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const lx = x + ex * cr - ey * sr, ly = y + ex * sr + ey * cr;
      const p = this._tp(lx, ly);
      if (i === 0 && !this.hasPt) this.c.moveTo(p[0], p[1]); else this.c.lineTo(p[0], p[1]);
      this.px = lx; this.py = ly; this.hasPt = true;
    }
  }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  _rectPath(x, y, w, h) {
    const p = new Path2D(), save = [this.px, this.py, this.hasPt];
    this.hasPt = false;
    this.moveTo(x, y, p); this.lineTo(x + w, y, p); this.lineTo(x + w, y + h, p); this.lineTo(x, y + h, p); p.closePath();
    [this.px, this.py, this.hasPt] = save;
    return p;
  }
  fillRect(x, y, w, h) { this.c.fill(this._rectPath(x, y, w, h)); }
  strokeRect(x, y, w, h) { this.c.stroke(this._rectPath(x, y, w, h)); }
  fill() { this.c.fill(); }
  stroke() { this.c.stroke(); }
  clip() { this.c.clip(); }
  setLineDash(d) { this.c.setLineDash(d); }
  createLinearGradient(x0, y0, x1, y1) { const a = this._map(x0, y0), b = this._map(x1, y1); return this.c.createLinearGradient(a[0], a[1], b[0], b[1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { const a = this._map(x0, y0), b = this._map(x1, y1); return this.c.createRadialGradient(a[0], a[1], r0, b[0], b[1], r1); }
}

/* ------------------------------ модель повреждений ------------------------------ */

class CarDamage {
  constructor(vehicle) {
    this.v = vehicle;
    const def = vehicle.def, up = vehicle.up;
    this.p = def.look;
    this.dents = [];
    this.lost = new Set();
    this.cracks = [];
    this.glass = 0;               // 0 целое, 1 трещины, 2 выбито
    this.zone = { front: 0, rear: 0, roof: 0, under: 0, side: 0 };
    this.engine = 0;              // 0…1 — повреждение двигателя
    this.armorK = (1 + 0.3 * (up.armor || 0)) * (def.armored ? 1.9 : 1);
    this.hasPlow = (up.armor || 0) >= 3 || !!def.armored;
    this.plates = (up.armor || 0) >= 2 || def.armored ? (def.armored ? 6 : 3) : 0;
    this.smokeT = 0;
    this.lastHit = new Map();
    this.suspBend = vehicle.wheels.map(() => 0);
    // контур корпуса для «прилипания» точки удара
    this.outline = [];
    for (const h of def.hull) for (let i = 0; i < h.length; i++) this.outline.push([h[i], h[(i + 1) % h.length]]);
  }
  get active() { return this.dents.length > 0; }
  // мотор теряет до 40% мощности
  get powerFactor() { return 1 - 0.4 * clamp(this.engine, 0, 1); }
  get total() { const z = this.zone; return clamp((z.front + z.rear + z.roof + z.side + z.under) / 3.2 + this.engine * 0.3, 0, 1); }

  wrap(ctx) {
    if (!this._dctx) this._dctx = new DeformCtx(ctx, this);
    const d = this._dctx; d.c = ctx; d.m = [1, 0, 0, 1, 0, 0]; d.stack.length = 0; d.hasPt = false;
    return d;
  }

  displace(x, y) {
    let dx = 0, dy = 0;
    for (const d of this.dents) {
      const ex = x - d.x, ey = y - d.y;
      const q = (ex * ex + ey * ey) / (d.r * d.r);
      if (q > 5) continue;
      const w = Math.exp(-q);
      dx += d.nx * d.depth * w; dy += d.ny * d.depth * w;
    }
    return [x + dx, y + dy];
  }

  _nearestOnHull(x, y) {
    let best = null, bd = Infinity;
    for (const [a, b] of this.outline) {
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const t = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const px = a[0] + ex * t, py = a[1] + ey * t;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd) { bd = d; best = [px, py]; }
    }
    return best;
  }

  /* Удар по кузову из решателя контактов. dv — скачок скорости кузова (импульс / масса).
     Энергия деформации растёт как квадрат скорости сверх упругого порога: мелкие толчки не мнут металл. */
  collide(wx, wy, nx, ny, dv, other, terrain) {
    const T0 = 3.2;
    if (dv <= T0) return;
    const now = this.v.game.world.time, key = other ? other.id : -1;
    const last = this.lastHit.get(key);
    let prev = 0;
    // удар растянут на несколько шагов — считаем только прирост
    if (last && now - last.t < 0.15) { if (dv <= last.dv) return; prev = last.dv; }
    this.lastHit.set(key, { t: now, dv });
    const E = x => Math.max(0, x - T0) ** 2;
    const e = (E(dv) - E(prev)) * 0.0042 * (terrain ? 0.8 : 1) / this.armorK;
    this.apply(wx, wy, nx, ny, e, {});
  }

  // сбитый зомби: вмятина от тела на капоте/бампере, мотор почти не страдает
  zombieHit(wx, wy, nx, ny, rel, mass, id) {
    const now = this.v.game.world.time, key = 'z' + id, last = this.lastHit.get(key);
    if (last && now - last.t < 0.25) return;
    this.lastHit.set(key, { t: now, dv: rel });
    const e = Math.min(0.07, (rel / 12) ** 2 * (mass / 80) * 0.009 / this.armorK);
    this.apply(wx, wy, nx, ny, e, { soft: true });
  }

  // взрыв рядом: ударная волна вминает ближайшую к нему сторону
  blast(x, y, k) {
    const c = this.v.chassis;
    const loc = c.worldToLocal(x, y);
    const hp = this._nearestOnHull(loc.x + c.com.x, loc.y + c.com.y);
    const wp = c.worldPoint(hp[0], hp[1]);
    let dx = wp.x - x, dy = wp.y - y;
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    this.apply(wp.x, wp.y, dx, dy, 0.28 * k / this.armorK, { blast: true });
    this.soot = Math.min(1, (this.soot || 0) + 0.3 * k);
  }

  apply(wx, wy, nx, ny, e, o) {
    if (!(e > 0.003)) return;
    const v = this.v, c = v.chassis, G = v.game, p = this.p;
    // в координаты рисунка машины
    const loc = c.worldToLocal(wx, wy);
    let lx = loc.x + c.com.x, ly = loc.y + c.com.y;
    const lnx = c.cos * nx + c.sin * ny, lny = -c.sin * nx + c.cos * ny;
    [lx, ly] = this._nearestOnHull(lx, ly);
    let zone = 'side';
    if (lny < -0.55 && ly > p.belt) zone = 'roof';
    else if (lny > 0.55 && ly < p.belt) zone = 'under';
    else if (lx > p.front - 0.95) zone = 'front';
    else if (lx < p.rear + 0.85) zone = 'rear';
    else if (ly > p.roof - 0.3) zone = 'roof';
    // таран принимает удар на себя
    const plow = zone === 'front' && this.hasPlow && !this.lost.has('plow');
    const eZ = e * (plow ? 0.45 : 1);
    if (plow) this.zone.plow = (this.zone.plow || 0) + e * 0.55;
    this.zone[zone] = clamp(this.zone[zone] + eZ, 0, 1.5);
    const engK = { front: 0.55, under: 0.2, roof: 0.04, side: 0.06, rear: 0.03 }[zone] * (o.soft ? 0.25 : 1);
    this.engine = clamp(this.engine + eZ * engK, 0, 1);
    // вмятина: глубина и ширина растут с энергией, соседние вмятины сливаются
    const depth = Math.min(0.28, eZ * (o.soft ? 0.35 : 0.5) + 0.012), rad = clamp(0.22 + eZ * (o.blast ? 1.2 : 0.6), 0.22, 0.8);
    this._dent(lx, ly, lnx, lny, depth, rad);
    // лобовой удар: капот складывается «домиком» вверх
    if (zone === 'front' && eZ > 0.1 && p.style !== 'truck') {
      this._dent(p.front - 0.85, p.belt + p.hood, 0, 1, Math.min(0.12, eZ * 0.15), 0.3);
    }
    // эффекты
    if (!o.soft) {
      G.particles.sparks(wx, wy, -nx, -ny, Math.min(18, 3 + e * 50));
      if (e > 0.015) AUDIO.metal(Math.min(1, 0.3 + e * 3));
      if (e > 0.07) {
        AUDIO.noiseBurst({ dur: 0.4, vol: Math.min(0.55, e * 1.4), type: 'lowpass', freq: 1100, freqEnd: 110, brown: true });
        for (let i = 0; i < 3; i++) AUDIO.noiseBurst({ dur: 0.06, vol: Math.min(0.25, e), type: 'bandpass', freq: 1800 + Math.random() * 2500, q: 5, delay: 0.02 + i * 0.05 });
        G.shake(Math.min(0.5, e * 0.9));
      }
    }
    this._checkParts(zone, lx, ly, lnx, lny, e);
  }

  _dent(x, y, nx, ny, depth, r) {
    for (const d of this.dents) {
      if (Math.hypot(d.x - x, d.y - y) < 0.3) {
        const k = depth / (d.depth + depth);
        d.nx = lerp(d.nx, nx, k); d.ny = lerp(d.ny, ny, k);
        const l = Math.hypot(d.nx, d.ny) || 1; d.nx /= l; d.ny /= l;
        // металл мнётся всё тяжелее: глубина растёт с насыщением
        d.depth = Math.min(0.42, d.depth + depth * (1 - d.depth / 0.5));
        d.r = Math.min(0.85, Math.max(d.r, r));
        return;
      }
    }
    this.dents.push({ x, y, nx, ny, depth, r, seed: Math.floor(Math.random() * 1e6) });
    if (this.dents.length > 18) {
      // самая мелкая вмятина уступает место
      let mi = 0; for (let i = 1; i < this.dents.length; i++) if (this.dents[i].depth < this.dents[mi].depth) mi = i;
      this.dents.splice(mi, 1);
    }
  }

  _checkParts(zone, lx, ly, lnx, lny, e) {
    const z = this.zone, v = this.v, def = v.def, up = v.up;
    const L = (k) => this.lost.has(k);
    if (zone === 'front') {
      if (z.front > 0.16 && !L('headL')) this._detach('headL', this.p.front - 0.06, this.p.belt - 0.12);
      if (z.front > 0.42 && this.glass < 1) this._glass(1, lx, ly);
      if (z.front > 0.36 && !L('bumperF')) this._detach('bumperF', this.p.front - 0.1, this.p.bottom + 0.07);
      if (this.hasPlow && (z.plow || 0) > 0.5 && !L('plow')) this._detach('plow', this.p.front + 0.25, this.p.bottom + 0.3);
      if (z.front > 0.95 && this.glass < 2) this._glass(2, lx, ly);
    } else if (zone === 'rear') {
      if (z.rear > 0.18 && !L('tailL')) this._detach('tailL', this.p.rear, this.p.belt - 0.18);
      if (z.rear > 0.38 && !L('bumperR')) this._detach('bumperR', this.p.rear + 0.05, this.p.bottom + 0.07);
      if (up.boost && z.rear > 0.75 && !L('rocket')) this._detach('rocket', this.p.rear + 0.65, this.p.belt + 0.25);
    } else if (zone === 'roof') {
      if (z.roof > 0.2 && this.glass < 1) this._glass(1, lx, ly);
      if (z.roof > 0.5 && this.glass < 2) this._glass(2, lx, ly);
      if (up.fuel && z.roof > 0.6 && !L('cans')) this._detach('cans', (this.p.rr + this.p.rf) * 0.5, this.p.roof + 0.15);
      if (up.gun && z.roof > 0.85 && !L('turret')) this._detach('turret', (this.p.rr + this.p.rf) * 0.5, this.p.roof + 0.3);
    } else if (zone === 'side') {
      for (let i = 0; i < this.plates; i++) if (z.side > 0.3 + i * 0.25 && !L('plate' + i)) { this._detach('plate' + i, lerp(this.p.rear + 0.25, this.p.front - 0.9, i / Math.max(1, this.plates - 1)), this.p.bottom + 0.3); break; }
      if (z.side > 0.55 && this.glass < 2) this._glass(2, lx, ly);
      if (z.side > 0.9 && !L('door') && this.p.style !== 'truck') this._detach('door', this.p.cr + 0.7, this.p.belt - 0.1);
    } else if (zone === 'under') {
      if (z.under > 0.45 && !L('exhaust')) this._detach('exhaust', this.p.rear + 0.1, this.p.bottom + 0.05);
    }
  }

  _glass(level, lx, ly) {
    const v = this.v, G = v.game, c = v.chassis, p = this.p;
    if (level <= this.glass) return;
    this.glass = level;
    const gx = clamp(lx, p.cr + 0.2, p.cf - 0.1), gy = clamp(ly, p.belt + p.hood + 0.2, p.roof - 0.15);
    this.cracks.push({ x: gx, y: gy, seed: Math.floor(Math.random() * 1e6) });
    const wp = c.worldPoint(gx, gy);
    if (level === 2) {
      for (let i = 0; i < 26 * G.particles.quality; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
        G.particles.add({ type: 'chunk', rect: true, x: wp.x, y: wp.y, vx: c.vx * 0.8 + Math.cos(a) * s, vy: c.vy * 0.5 + Math.abs(Math.sin(a)) * s, g: -15, life: 1.6, size: 0.03 + Math.random() * 0.05, vr: (Math.random() - 0.5) * 30, color: 'rgba(190,225,240,0.85)', collide: true, bounce: 0.25, fade: 0.5 });
      }
      for (let i = 0; i < 5; i++) AUDIO.noiseBurst({ dur: 0.08 + Math.random() * 0.15, vol: 0.12, type: 'highpass', freq: 3500 + Math.random() * 3000, delay: i * 0.03 });
    } else {
      AUDIO.noiseBurst({ dur: 0.12, vol: 0.1, type: 'highpass', freq: 4500 });
    }
  }

  _detach(part, lx, ly) {
    const v = this.v, G = v.game, c = v.chassis, st = v.st;
    this.lost.add(part);
    const wp = c.worldPoint(lx, ly);
    const vel = c.velocityAt(wp.x, wp.y);
    // параметры отлетающей детали: размер, цвет
    const spec = {
      bumperF: [0.36, 0.16, '#2a2b2e', 18], bumperR: [0.34, 0.16, '#2a2b2e', 16],
      plow: [0.7, 0.55, '#4b4e52', 60], door: [0.95, 0.5, v.def.color, 30], rocket: [0.95, 0.3, '#9a9a9a', 25],
      cans: [0.34, 0.28, '#b3261e', 12], turret: [0.6, 0.3, '#23272a', 40], exhaust: [0.5, 0.07, '#555', 6]
    }[part] || (part.startsWith('plate') ? [0.6, 0.42, '#6d7074', 20] : null);
    if (spec) {
      const [w, h, color, mass] = spec;
      const b = G.world.add(new Body({
        x: wp.x, y: wp.y, angle: c.a, shapes: [{ type: 'poly', verts: boxVerts(w, h) }],
        mass, friction: 0.6, restitution: 0.2, cat: CAT.DEBRIS, mask: CAT.GROUND | CAT.STATIC, buoyancy: 0.8
      }));
      b.vx = vel.x + (Math.random() - 0.5) * 4; b.vy = vel.y + 2 + Math.random() * 4; b.w = (Math.random() - 0.5) * 12;
      G.debris.push({ body: b, color, w, h, life: 14 });
    }
    if (part === 'headL' || part === 'tailL') {
      const col = part === 'headL' ? 'rgba(255,250,220,0.9)' : 'rgba(220,40,30,0.9)';
      for (let i = 0; i < 10 * G.particles.quality; i++) {
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
        G.particles.add({ type: 'chunk', rect: true, x: wp.x, y: wp.y, vx: vel.x + Math.cos(a) * s, vy: vel.y + Math.abs(Math.sin(a)) * s, g: -15, life: 1.2, size: 0.025, vr: 20, color: col, collide: true, bounce: 0.2 });
      }
      AUDIO.noiseBurst({ dur: 0.1, vol: 0.12, type: 'highpass', freq: 5000 });
    } else AUDIO.metal(0.9);
    // функциональные последствия
    if (part === 'plow') { st.plow = Math.max(0.1, st.plow - 0.3); st.killSpeed *= 1.25; this.hasPlow = false; }
    if (part === 'bumperF') st.killSpeed *= 1.06;
    if (part === 'turret') { st.gun = 0; v.ammo = 0; }
    if (part === 'rocket') { v.boost = 0; v.boostMax = 0; }
    if (part === 'door') st.killSpeed *= 1.05;
    G.particles.text(wp.x, wp.y + 1.2, ({ bumperF: 'бампер!', bumperR: 'бампер!', plow: 'таран сорван!', door: 'дверь!', turret: 'пулемёт сорван!', rocket: 'ракета сорвана!', headL: 'фара!' }[part]) || '', '#ffb070', 0.8);
  }

  // подвеска: жёсткий удар в отбойник гнёт рычаги — колесо уходит вверх и назад, машина проседает на эту ось
  suspensionHit(i, dv) {
    const v = this.v, j = v.joints[i];
    const T0 = 9;
    if (!j || dv < T0) return;
    const bend = Math.min(0.1 - this.suspBend[i], (dv - T0) * 0.006 / this.armorK);
    if (bend <= 0.004) return;
    this.suspBend[i] += bend;
    const front = v.wheels[i].def.x > 0;
    j.lay += bend;
    j.lax += (front ? -1 : 1) * bend * 0.5;
    this.zone.under = clamp(this.zone.under + bend * 2, 0, 1.5);
    const w = v.wheels[i];
    v.game.particles.sparks(w.x, w.y, 0, 1, 8);
    AUDIO.metal(Math.min(1, 0.4 + bend * 8));
    AUDIO.noiseBurst({ dur: 0.25, vol: 0.25, type: 'lowpass', freq: 700, freqEnd: 120, brown: true });
  }

  // дым и огонь из-под капота, перебои зажигания
  tick(h) {
    const v = this.v, G = v.game, c = v.chassis, p = this.p, P = G.particles;
    const eng = this.engine;
    if (this.lastHit.size > 30) { const now = G.world.time; for (const [k, l] of this.lastHit) if (now - l.t > 0.5) this.lastHit.delete(k); }
    if (eng > 0.28 && v.fuel > 0) {
      this.smokeT -= h;
      if (this.smokeT <= 0) {
        this.smokeT = lerp(0.18, 0.04, clamp((eng - 0.28) / 0.6, 0, 1));
        const hp = c.worldPoint(p.front - 0.7, p.belt + p.hood + 0.05);
        const dark = eng > 0.6 ? 0.85 : 0.2;
        P.smoke(hp.x, hp.y, c.vx * 0.3, 1.2, 1, dark, 0.5 + eng * 0.6);
      }
      if (eng > 0.85 && Math.random() < 0.6 * P.quality) {
        const hp = c.worldPoint(p.front - 0.8 + Math.random() * 0.5, p.belt + p.hood + 0.05);
        P.fire(hp.x, hp.y, c.vx * 0.5, 0.5, 1, 0.6);
        if (Math.random() < 0.15) P.lights.push({ x: hp.x, y: hp.y, r: 4, age: 0, life: 0.1, color: 'rgba(255,140,50,' });
      }
    }
  }

  // стекло: паутина трещин от точки удара; выбитое — остатки осколков по краям рамы
  drawGlassDamage(ctx, windowPath) {
    if (!this.glass) return;
    ctx.save();
    windowPath();
    ctx.clip();
    if (this.glass === 2) {
      ctx.strokeStyle = 'rgba(160,200,220,0.4)'; ctx.lineWidth = 0.1;
      windowPath(); ctx.stroke();
      ctx.fillStyle = 'rgba(175,210,228,0.35)';
      for (const cr of this.cracks) {
        const rng = mulberry32(cr.seed + 7);
        for (let k = 0; k < 9; k++) {
          const x = lerp(this.p.cr, this.p.cf, rng()), y = lerp(this.p.belt + this.p.hood + 0.1, this.p.roof, rng() < 0.5 ? 0 : 1);
          ctx.beginPath(); ctx.moveTo(x - 0.08, y); ctx.lineTo(x + 0.02 + rng() * 0.1, y + (y > this.p.roof - 0.2 ? -1 : 1) * (0.08 + rng() * 0.16)); ctx.lineTo(x + 0.1, y); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.strokeStyle = this.glass === 2 ? 'rgba(200,230,245,0.45)' : 'rgba(235,242,250,0.75)';
    ctx.lineWidth = 0.013;
    for (const cr of this.cracks) {
      const rng = mulberry32(cr.seed);
      const rays = this.glass === 2 ? 3 : 7;
      for (let k = 0; k < rays; k++) {
        let a = (k / rays) * Math.PI * 2 + rng() * 0.5, x = cr.x, y = cr.y;
        ctx.beginPath(); ctx.moveTo(x, y);
        const len = this.glass === 2 ? 0.12 : 0.22;
        for (let s = 0; s < 5; s++) { a += (rng() - 0.5) * 0.7; x += Math.cos(a) * len * (0.5 + rng()); y += Math.sin(a) * len * (0.5 + rng()); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (this.glass === 1) {
        for (const rr of [0.06, 0.14, 0.24]) {
          ctx.beginPath();
          for (let k = 0; k <= 7; k++) { const a = k / 7 * Math.PI * 2; const q = rr * (0.8 + rng() * 0.4); if (k) ctx.lineTo(cr.x + Math.cos(a) * q, cr.y + Math.sin(a) * q); else ctx.moveTo(cr.x + q, cr.y); }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  drawScuffs(ctx) {
    // содранная краска и копоть в местах вмятин
    for (const d of this.dents) {
      const rng = mulberry32(d.seed);
      ctx.strokeStyle = `rgba(210,205,195,${0.25 + Math.min(0.4, d.depth)})`;
      ctx.lineWidth = 0.014;
      for (let k = 0; k < 3 + Math.floor(d.depth * 20); k++) {
        const ox = d.x + (rng() - 0.5) * d.r * 1.4, oy = d.y + (rng() - 0.5) * d.r * 1.0;
        const a = (rng() - 0.5) * 0.8;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * d.r * 0.6, oy + Math.sin(a) * d.r * 0.2); ctx.stroke();
      }
      // вогнутость: тень со стороны удара, блик на противоположном краю
      const a = Math.min(0.3, d.depth * 1.1);
      const g = ctx.createRadialGradient(d.x - d.nx * d.r * 0.2, d.y - d.ny * d.r * 0.2, 0, d.x, d.y, d.r * 0.8);
      g.addColorStop(0, `rgba(10,8,6,${a})`); g.addColorStop(0.55, `rgba(10,8,6,${a * 0.45})`); g.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.8, 0, Math.PI * 2); ctx.fill();
      const ha = Math.atan2(d.ny, d.nx);
      ctx.strokeStyle = `rgba(255,240,220,${Math.min(0.28, d.depth)})`; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.45, ha - 0.9, ha + 0.9); ctx.stroke();
    }
    // копоть на капоте от горящего мотора и от взрывов
    const soot = Math.max(this.engine > 0.5 ? (this.engine - 0.5) * 0.9 : 0, (this.soot || 0) * 0.5);
    if (soot > 0) {
      const g = ctx.createLinearGradient(this.p.front - 1.8, 0, this.p.front, 0);
      g.addColorStop(0, 'rgba(15,12,10,0)'); g.addColorStop(0.5, `rgba(15,12,10,${soot})`); g.addColorStop(1, `rgba(15,12,10,${soot * 0.7})`);
      ctx.fillStyle = g;
      ctx.fillRect(this.p.front - 1.8, this.p.bottom, 1.9, this.p.belt + this.p.hood - this.p.bottom + 0.15);
    }
  }
}
