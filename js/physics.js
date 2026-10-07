'use strict';
/* =====================================================================
   DEAD MILES — собственный 2D физический движок
   Твёрдые тела (круги, выпуклые многоугольники), SAT + клиппинг,
   последовательные импульсы с тёплым стартом, split-impulse коррекция,
   шарнирные и колёсные соединения (подвеска + мотор),
   коллизии с картой высот, плавучесть на волнах, рейкаст.
   Система координат: метры, ось Y вверх.
   ===================================================================== */

const CAT = {
  GROUND: 1, CHASSIS: 2, WHEEL: 4, ZOMBIE: 8, RAGDOLL: 16,
  PROP: 32, DEBRIS: 64, STATIC: 128, RIDER: 256,
  ALL: 0xffff
};

const PHYS = {
  gravity: -15,
  slop: 0.006,
  beta: 0.22,
  velIters: 9,
  posIters: 3,
  restThreshold: 1.2,
  maxTerrainDepth: 1.4
};

let _bodyId = 1;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) { return a + (b - a) * t; }

class Body {
  constructor(o) {
    this.id = _bodyId++;
    this.x = o.x || 0; this.y = o.y || 0; this.a = o.angle || 0;
    this.vx = o.vx || 0; this.vy = o.vy || 0; this.w = o.w || 0;
    this.px = this.x; this.py = this.y; this.pa = this.a;
    this.fx = 0; this.fy = 0; this.t = 0;
    this.pvx = 0; this.pvy = 0; this.pw = 0;
    this.friction = o.friction !== undefined ? o.friction : 0.5;
    this.restitution = o.restitution !== undefined ? o.restitution : 0.05;
    this.cat = o.cat || CAT.PROP;
    this.mask = o.mask !== undefined ? o.mask : CAT.ALL;
    this.group = o.group || 0;
    this.isStatic = !!o.isStatic;
    this.linDamp = o.linDamp !== undefined ? o.linDamp : 0.02;
    this.angDamp = o.angDamp !== undefined ? o.angDamp : 0.08;
    this.gravityScale = o.gravityScale !== undefined ? o.gravityScale : 1;
    this.buoyancy = o.buoyancy !== undefined ? o.buoyancy : 0;
    this.waterDragF = o.waterDragF !== undefined ? o.waterDragF : 1.2;
    this.waterDragN = o.waterDragN !== undefined ? o.waterDragN : 1.2;
    this.waterAngDrag = o.waterAngDrag !== undefined ? o.waterAngDrag : 1.5;
    this.sampleDepth = o.sampleDepth || 0.3;
    this.fixedRotation = !!o.fixedRotation;
    this.data = o.data || null;
    this.removed = false;
    this.contactCount = 0;
    this.groundContact = false;
    this.maxImpulse = 0; this.maxImpulseOther = null;
    this.submerged = 0;
    this.cos = Math.cos(this.a); this.sin = Math.sin(this.a);
    this.aabb = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    // формы
    this.shapes = o.shapes.map(s => {
      if (s.type === 'circle') return { type: 0, r: s.r, lx: s.x || 0, ly: s.y || 0, wx: 0, wy: 0 };
      let verts = s.verts.map(v => ({ x: v[0], y: v[1] }));
      let area = 0;
      for (let i = 0; i < verts.length; i++) {
        const p = verts[i], q = verts[(i + 1) % verts.length];
        area += p.x * q.y - q.x * p.y;
      }
      if (area < 0) verts.reverse();
      return { type: 1, verts, normals: [], wv: verts.map(() => ({ x: 0, y: 0 })), wn: verts.map(() => ({ x: 0, y: 0 })) };
    });
    this.com = { x: 0, y: 0 };
    this._computeMass(o);
    this.samples = o.samples ? o.samples.map(p => ({ x: p[0] - this.com.x, y: p[1] - this.com.y })) : this._defaultSamples();
    if (o.x !== undefined) {
      // позиция задана для исходного (дизайнерского) начала координат
      const c = Math.cos(this.a), s = Math.sin(this.a);
      this.x = (o.x || 0) + c * this.com.x - s * this.com.y;
      this.y = (o.y || 0) + s * this.com.x + c * this.com.y;
      this.px = this.x; this.py = this.y;
    }
    this.updateShapes();
  }

  _computeMass(o) {
    const density = o.density || 1;
    let mass = 0, cx = 0, cy = 0, I = 0;
    for (const s of this.shapes) {
      if (s.type === 0) {
        const m = density * Math.PI * s.r * s.r;
        mass += m; cx += m * s.lx; cy += m * s.ly;
        I += m * (0.5 * s.r * s.r + s.lx * s.lx + s.ly * s.ly);
      } else {
        const v = s.verts, n = v.length;
        const sx = v[0].x, sy = v[0].y;
        let area = 0, ccx = 0, ccy = 0, ii = 0;
        for (let i = 0; i < n; i++) {
          const e1x = v[i].x - sx, e1y = v[i].y - sy;
          const j = (i + 1) % n;
          const e2x = v[j].x - sx, e2y = v[j].y - sy;
          const D = e1x * e2y - e1y * e2x;
          const tri = 0.5 * D;
          area += tri;
          ccx += tri * (e1x + e2x) / 3; ccy += tri * (e1y + e2y) / 3;
          const intx2 = e1x * e1x + e2x * e1x + e2x * e2x;
          const inty2 = e1y * e1y + e2y * e1y + e2y * e2y;
          ii += (0.25 / 3) * D * (intx2 + inty2);
        }
        const m = density * area;
        const lcx = ccx / area, lcy = ccy / area;
        const wcx = lcx + sx, wcy = lcy + sy;
        let Io = density * ii + m * ((wcx * wcx + wcy * wcy) - (lcx * lcx + lcy * lcy));
        mass += m; cx += m * wcx; cy += m * wcy; I += Io;
        // нормали
        s.normals = [];
        for (let i = 0; i < n; i++) {
          const p = v[i], q = v[(i + 1) % n];
          let nx = q.y - p.y, ny = -(q.x - p.x);
          const l = Math.hypot(nx, ny) || 1;
          s.normals.push({ x: nx / l, y: ny / l });
        }
      }
    }
    cx /= mass; cy /= mass;
    I -= mass * (cx * cx + cy * cy);
    if (o.com) {
      const nx = o.com[0], ny = o.com[1];
      I += mass * ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy));
      cx = nx; cy = ny;
    }
    if (o.mass) { const k = o.mass / mass; I *= k; mass = o.mass; }
    if (o.inertiaScale) I *= o.inertiaScale;
    if (o.inertia) I = o.inertia;
    this.com.x = cx; this.com.y = cy;
    for (const s of this.shapes) {
      if (s.type === 0) { s.lx -= cx; s.ly -= cy; }
      else for (const p of s.verts) { p.x -= cx; p.y -= cy; }
    }
    this.mass = mass; this.I = I;
    if (this.isStatic) { this.invMass = 0; this.invI = 0; }
    else { this.invMass = 1 / mass; this.invI = this.fixedRotation ? 0 : 1 / I; }
    this.radius = 0;
    for (const s of this.shapes) {
      if (s.type === 0) this.radius = Math.max(this.radius, Math.hypot(s.lx, s.ly) + s.r);
      else for (const p of s.verts) this.radius = Math.max(this.radius, Math.hypot(p.x, p.y));
    }
  }

  _defaultSamples() {
    const out = [{ x: 0, y: 0 }];
    for (const s of this.shapes) {
      if (s.type === 0) {
        out.push({ x: s.lx, y: s.ly - s.r * 0.7 }, { x: s.lx - s.r * 0.7, y: s.ly }, { x: s.lx + s.r * 0.7, y: s.ly }, { x: s.lx, y: s.ly + s.r * 0.7 });
      } else for (const p of s.verts) out.push({ x: p.x * 0.8, y: p.y * 0.8 });
    }
    return out;
  }

  // точка из дизайнерских координат -> мировые
  worldPoint(dx, dy) {
    const lx = dx - this.com.x, ly = dy - this.com.y;
    return { x: this.x + this.cos * lx - this.sin * ly, y: this.y + this.sin * lx + this.cos * ly };
  }
  localToWorld(lx, ly) {
    return { x: this.x + this.cos * lx - this.sin * ly, y: this.y + this.sin * lx + this.cos * ly };
  }
  worldToLocal(wx, wy) {
    const dx = wx - this.x, dy = wy - this.y;
    return { x: this.cos * dx + this.sin * dy, y: -this.sin * dx + this.cos * dy };
  }
  velocityAt(wx, wy) {
    return { x: this.vx - this.w * (wy - this.y), y: this.vy + this.w * (wx - this.x) };
  }
  applyForce(fx, fy, wx, wy) {
    this.fx += fx; this.fy += fy;
    if (wx !== undefined) this.t += (wx - this.x) * fy - (wy - this.y) * fx;
  }
  applyImpulse(ix, iy, wx, wy) {
    if (this.isStatic) return;
    this.vx += ix * this.invMass; this.vy += iy * this.invMass;
    if (wx !== undefined) this.w += this.invI * ((wx - this.x) * iy - (wy - this.y) * ix);
  }
  savePrev() { this.px = this.x; this.py = this.y; this.pa = this.a; }
  ix(alpha) { return this.px + (this.x - this.px) * alpha; }
  iy(alpha) { return this.py + (this.y - this.py) * alpha; }
  ia(alpha) { return this.pa + (this.a - this.pa) * alpha; }

  updateShapes() {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    this.cos = c; this.sin = s;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sh of this.shapes) {
      if (sh.type === 0) {
        sh.wx = this.x + c * sh.lx - s * sh.ly;
        sh.wy = this.y + s * sh.lx + c * sh.ly;
        if (sh.wx - sh.r < minX) minX = sh.wx - sh.r;
        if (sh.wx + sh.r > maxX) maxX = sh.wx + sh.r;
        if (sh.wy - sh.r < minY) minY = sh.wy - sh.r;
        if (sh.wy + sh.r > maxY) maxY = sh.wy + sh.r;
      } else {
        const v = sh.verts, n = v.length;
        for (let i = 0; i < n; i++) {
          const w = sh.wv[i];
          w.x = this.x + c * v[i].x - s * v[i].y;
          w.y = this.y + s * v[i].x + c * v[i].y;
          const nn = sh.normals[i], wn = sh.wn[i];
          wn.x = c * nn.x - s * nn.y; wn.y = s * nn.x + c * nn.y;
          if (w.x < minX) minX = w.x; if (w.x > maxX) maxX = w.x;
          if (w.y < minY) minY = w.y; if (w.y > maxY) maxY = w.y;
        }
      }
    }
    const m = 0.02;
    this.aabb.minX = minX - m; this.aabb.minY = minY - m;
    this.aabb.maxX = maxX + m; this.aabb.maxY = maxY + m;
  }
}

/* ------------------------------ Соединения ------------------------------ */

class RevoluteJoint {
  constructor(a, b, wx, wy, o = {}) {
    this.a = a; this.b = b;
    const la = a.worldToLocal(wx, wy), lb = b.worldToLocal(wx, wy);
    this.lax = la.x; this.lay = la.y; this.lbx = lb.x; this.lby = lb.y;
    this.refAngle = b.a - a.a;
    this.lower = o.lower; this.upper = o.upper;
    this.hasLimit = o.lower !== undefined;
    this.breakImpulse = o.breakImpulse || 0;
    this.jx = 0; this.jy = 0; this.jl = 0; this.ju = 0;
    this.motorSpeed = 0; this.maxMotorTorque = o.maxMotorTorque || 0; this.jm = 0;
    this.softness = o.softness || 0;
    this.broken = false;
    this.data = o.data || null;
  }
  preStep(h) {
    const a = this.a, b = this.b;
    this.rax = a.cos * this.lax - a.sin * this.lay; this.ray = a.sin * this.lax + a.cos * this.lay;
    this.rbx = b.cos * this.lbx - b.sin * this.lby; this.rby = b.sin * this.lbx + b.cos * this.lby;
    const mA = a.invMass, mB = b.invMass, iA = a.invI, iB = b.invI;
    const k11 = mA + mB + iA * this.ray * this.ray + iB * this.rby * this.rby + this.softness;
    const k12 = -iA * this.rax * this.ray - iB * this.rbx * this.rby;
    const k22 = mA + mB + iA * this.rax * this.rax + iB * this.rbx * this.rbx + this.softness;
    let det = k11 * k22 - k12 * k12;
    det = det !== 0 ? 1 / det : 0;
    this.m11 = det * k22; this.m12 = -det * k12; this.m22 = det * k11;
    const cx = b.x + this.rbx - a.x - this.rax, cy = b.y + this.rby - a.y - this.ray;
    this.bx = -PHYS.beta / h * cx; this.by = -PHYS.beta / h * cy;
    this.angMass = iA + iB > 0 ? 1 / (iA + iB) : 0;
    this.angle = b.a - a.a - this.refAngle;
    // тёплый старт
    const px = this.jx, py = this.jy, L = this.jl + this.ju + this.jm;
    a.vx -= mA * px; a.vy -= mA * py; a.w -= iA * (this.rax * py - this.ray * px + L);
    b.vx += mB * px; b.vy += mB * py; b.w += iB * (this.rbx * py - this.rby * px + L);
  }
  solve(h) {
    const a = this.a, b = this.b;
    const mA = a.invMass, mB = b.invMass, iA = a.invI, iB = b.invI;
    if (this.maxMotorTorque > 0) {
      const cdot = b.w - a.w - this.motorSpeed;
      let imp = -this.angMass * cdot;
      const old = this.jm, maxI = this.maxMotorTorque * h;
      this.jm = clamp(old + imp, -maxI, maxI); imp = this.jm - old;
      a.w -= iA * imp; b.w += iB * imp;
    }
    if (this.hasLimit && this.angMass > 0) {
      const inv = 1 / h;
      {
        const C = this.angle - this.lower;
        const bias = C > 0 ? C * inv : PHYS.beta * C * inv;
        const cdot = b.w - a.w;
        let imp = -this.angMass * (cdot + bias);
        const nw = Math.max(this.jl + imp, 0); imp = nw - this.jl; this.jl = nw;
        a.w -= iA * imp; b.w += iB * imp;
      }
      {
        const C = this.upper - this.angle;
        const bias = C > 0 ? C * inv : PHYS.beta * C * inv;
        const cdot = a.w - b.w;
        let imp = -this.angMass * (cdot + bias);
        const nw = Math.max(-this.ju + imp, 0); imp = nw + this.ju; this.ju = -nw;
        a.w += iA * imp; b.w -= iB * imp;
      }
    }
    const dvx = b.vx - b.w * this.rby - a.vx + a.w * this.ray;
    const dvy = b.vy + b.w * this.rbx - a.vy - a.w * this.rax;
    const cx = -dvx + this.bx - this.softness * this.jx, cy = -dvy + this.by - this.softness * this.jy;
    const ix = this.m11 * cx + this.m12 * cy;
    const iy = this.m12 * cx + this.m22 * cy;
    this.jx += ix; this.jy += iy;
    a.vx -= mA * ix; a.vy -= mA * iy; a.w -= iA * (this.rax * iy - this.ray * ix);
    b.vx += mB * ix; b.vy += mB * iy; b.w += iB * (this.rbx * iy - this.rby * ix);
  }
}

class WheelJoint {
  // a = шасси, b = колесо; ось подвески в локальных координатах шасси
  constructor(a, b, wx, wy, o = {}) {
    this.a = a; this.b = b;
    const la = a.worldToLocal(wx, wy);
    this.lax = la.x; this.lay = la.y;
    const ax = o.axisX !== undefined ? o.axisX : 0, ay = o.axisY !== undefined ? o.axisY : 1;
    const l = Math.hypot(ax, ay);
    this.axx = ax / l; this.axy = ay / l;
    this.stiffness = o.stiffness || 20000;
    this.damping = o.damping || 1000;
    this.lower = o.lower !== undefined ? o.lower : -0.3;
    this.upper = o.upper !== undefined ? o.upper : 0.2;
    this.maxMotorTorque = 0; this.motorSpeed = 0; this.enableMotor = false;
    this.jPerp = 0; this.jSpring = 0; this.jLower = 0; this.jUpper = 0; this.jMotor = 0;
    this.translation = 0;
  }
  preStep(h) {
    const a = this.a, b = this.b;
    const mA = a.invMass, mB = b.invMass, iA = a.invI, iB = b.invI;
    const rax = a.cos * this.lax - a.sin * this.lay, ray = a.sin * this.lax + a.cos * this.lay;
    const dx = b.x - a.x - rax, dy = b.y - a.y - ray;
    const axx = a.cos * this.axx - a.sin * this.axy, axy = a.sin * this.axx + a.cos * this.axy;
    const pyx = -axy, pyy = axx;
    this.axX = axx; this.axY = axy; this.pyX = pyx; this.pyY = pyy;
    const drx = dx + rax, dry = dy + ray;
    this.sAy = drx * pyy - dry * pyx;
    this.sAx = drx * axy - dry * axx;
    const mPerp = mA + mB + iA * this.sAy * this.sAy;
    this.perpMass = mPerp > 0 ? 1 / mPerp : 0;
    const invMassX = mA + mB + iA * this.sAx * this.sAx;
    this.axialMassRigid = invMassX > 0 ? 1 / invMassX : 0;
    this.translation = dx * axx + dy * axy;
    this.perpC = dx * pyx + dy * pyy;
    // пружина (мягкое ограничение)
    const k = this.stiffness, c = this.damping;
    let gamma = h * (c + h * k);
    gamma = gamma > 0 ? 1 / gamma : 0;
    this.gamma = gamma;
    this.springBias = this.translation * h * k * gamma;
    this.springMass = invMassX + gamma > 0 ? 1 / (invMassX + gamma) : 0;
    this.motorMass = iA + iB > 0 ? 1 / (iA + iB) : 0;
    this.h = h;
    // тёплый старт
    const axialImp = this.jSpring + this.jLower - this.jUpper;
    const Px = this.jPerp * pyx + axialImp * axx, Py = this.jPerp * pyy + axialImp * axy;
    const LA = this.jPerp * this.sAy + axialImp * this.sAx + this.jMotor;
    const LB = this.jMotor;
    a.vx -= mA * Px; a.vy -= mA * Py; a.w -= iA * LA;
    b.vx += mB * Px; b.vy += mB * Py; b.w += iB * LB;
  }
  _applyAxial(imp) {
    const a = this.a, b = this.b;
    const Px = imp * this.axX, Py = imp * this.axY;
    a.vx -= a.invMass * Px; a.vy -= a.invMass * Py; a.w -= a.invI * imp * this.sAx;
    b.vx += b.invMass * Px; b.vy += b.invMass * Py;
  }
  _axialCdot() {
    const a = this.a, b = this.b;
    return this.axX * (b.vx - a.vx) + this.axY * (b.vy - a.vy) - this.sAx * a.w;
  }
  solve(h) {
    const a = this.a, b = this.b;
    // пружина
    {
      const cdot = this._axialCdot();
      const imp = -this.springMass * (cdot + this.springBias + this.gamma * this.jSpring);
      this.jSpring += imp;
      this._applyAxial(imp);
    }
    // мотор
    if (this.enableMotor) {
      const cdot = b.w - a.w - this.motorSpeed;
      let imp = -this.motorMass * cdot;
      const old = this.jMotor, maxI = this.maxMotorTorque * h;
      this.jMotor = clamp(old + imp, -maxI, maxI);
      imp = this.jMotor - old;
      a.w -= a.invI * imp; b.w += b.invI * imp;
    } else this.jMotor = 0;
    // пределы хода подвески
    {
      const C = this.translation - this.lower;
      const bias = C > 0 ? C / h : PHYS.beta * C / h;
      const cdot = this._axialCdot();
      let imp = -this.axialMassRigid * (cdot + bias);
      const nw = Math.max(this.jLower + imp, 0); imp = nw - this.jLower; this.jLower = nw;
      this._applyAxial(imp);
    }
    {
      const C = this.upper - this.translation;
      const bias = C > 0 ? C / h : PHYS.beta * C / h;
      const cdot = -this._axialCdot();
      let imp = -this.axialMassRigid * (cdot + bias);
      const nw = Math.max(this.jUpper + imp, 0); imp = nw - this.jUpper; this.jUpper = nw;
      this._applyAxial(-imp);
    }
    // точка-на-прямой
    {
      const cdot = this.pyX * (b.vx - a.vx) + this.pyY * (b.vy - a.vy) - this.sAy * a.w;
      const imp = -this.perpMass * (cdot + PHYS.beta / h * this.perpC);
      this.jPerp += imp;
      const Px = imp * this.pyX, Py = imp * this.pyY;
      a.vx -= a.invMass * Px; a.vy -= a.invMass * Py; a.w -= a.invI * imp * this.sAy;
      b.vx += b.invMass * Px; b.vy += b.invMass * Py;
    }
  }
}

/* ------------------------------ Узкая фаза ------------------------------ */

function findMaxSeparation(p1, p2) {
  let best = -Infinity, bi = 0;
  const n1 = p1.wv.length, n2 = p2.wv.length;
  for (let i = 0; i < n1; i++) {
    const n = p1.wn[i], v = p1.wv[i];
    let si = Infinity;
    for (let j = 0; j < n2; j++) {
      const w = p2.wv[j];
      const s = n.x * (w.x - v.x) + n.y * (w.y - v.y);
      if (s < si) si = s;
    }
    if (si > best) { best = si; bi = i; }
  }
  return [best, bi];
}

function clipSegment(v0, v1, nx, ny, offset) {
  const out = [];
  const d0 = nx * v0.x + ny * v0.y - offset;
  const d1 = nx * v1.x + ny * v1.y - offset;
  if (d0 <= 0) out.push({ x: v0.x, y: v0.y, id: v0.id });
  if (d1 <= 0) out.push({ x: v1.x, y: v1.y, id: v1.id });
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    out.push({ x: v0.x + t * (v1.x - v0.x), y: v0.y + t * (v1.y - v0.y), id: d0 > 0 ? v0.id : v1.id + 50 });
  }
  return out;
}

function collidePolys(A, B, out) {
  const [sepA, edgeA] = findMaxSeparation(A, B);
  if (sepA > 0) return false;
  const [sepB, edgeB] = findMaxSeparation(B, A);
  if (sepB > 0) return false;
  let p1, p2, e1, flip;
  if (sepB > sepA + 0.001) { p1 = B; p2 = A; e1 = edgeB; flip = true; }
  else { p1 = A; p2 = B; e1 = edgeA; flip = false; }
  const n1 = p1.wn[e1];
  let i2 = 0, minDot = Infinity;
  for (let i = 0; i < p2.wn.length; i++) {
    const d = n1.x * p2.wn[i].x + n1.y * p2.wn[i].y;
    if (d < minDot) { minDot = d; i2 = i; }
  }
  const i3 = (i2 + 1) % p2.wv.length;
  const inc0 = { x: p2.wv[i2].x, y: p2.wv[i2].y, id: i2 };
  const inc1 = { x: p2.wv[i3].x, y: p2.wv[i3].y, id: i3 };
  const v11 = p1.wv[e1], v12 = p1.wv[(e1 + 1) % p1.wv.length];
  let tx = v12.x - v11.x, ty = v12.y - v11.y;
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const so1 = -(tx * v11.x + ty * v11.y);
  const so2 = tx * v12.x + ty * v12.y;
  let c = clipSegment(inc0, inc1, -tx, -ty, so1);
  if (c.length < 2) return false;
  c = clipSegment(c[0], c[1], tx, ty, so2);
  if (c.length < 2) return false;
  const nx = ty, ny = -tx;
  const front = nx * v11.x + ny * v11.y;
  out.nx = flip ? -nx : nx; out.ny = flip ? -ny : ny;
  out.count = 0;
  for (const p of c) {
    const sep = nx * p.x + ny * p.y - front;
    if (sep <= 0.002) {
      out.pts[out.count++] = { x: p.x - nx * sep * 0.5, y: p.y - ny * sep * 0.5, depth: -sep, id: e1 * 1000 + p.id * 10 + (flip ? 1 : 0) };
    }
  }
  return out.count > 0;
}

function collidePolyCircle(P, C, out) {
  // нормаль от многоугольника к кругу
  const cx = C.wx, cy = C.wy, r = C.r;
  let sep = -Infinity, ni = 0;
  const n = P.wv.length;
  for (let i = 0; i < n; i++) {
    const s = P.wn[i].x * (cx - P.wv[i].x) + P.wn[i].y * (cy - P.wv[i].y);
    if (s > r) return false;
    if (s > sep) { sep = s; ni = i; }
  }
  const v1 = P.wv[ni], v2 = P.wv[(ni + 1) % n];
  let nx, ny, depth;
  if (sep < 1e-6) {
    nx = P.wn[ni].x; ny = P.wn[ni].y; depth = r - sep;
  } else {
    const u1 = (cx - v1.x) * (v2.x - v1.x) + (cy - v1.y) * (v2.y - v1.y);
    const u2 = (cx - v2.x) * (v1.x - v2.x) + (cy - v2.y) * (v1.y - v2.y);
    if (u1 <= 0) {
      const d = Math.hypot(cx - v1.x, cy - v1.y);
      if (d > r) return false;
      nx = (cx - v1.x) / (d || 1); ny = (cy - v1.y) / (d || 1); depth = r - d;
    } else if (u2 <= 0) {
      const d = Math.hypot(cx - v2.x, cy - v2.y);
      if (d > r) return false;
      nx = (cx - v2.x) / (d || 1); ny = (cy - v2.y) / (d || 1); depth = r - d;
    } else {
      nx = P.wn[ni].x; ny = P.wn[ni].y; depth = r - sep;
    }
  }
  out.nx = nx; out.ny = ny; out.count = 1;
  out.pts[0] = { x: cx - nx * (r - depth * 0.5), y: cy - ny * (r - depth * 0.5), depth, id: 7 };
  return true;
}

function collideCircles(A, B, out) {
  const dx = B.wx - A.wx, dy = B.wy - A.wy;
  const rr = A.r + B.r;
  const d2 = dx * dx + dy * dy;
  if (d2 > rr * rr) return false;
  const d = Math.sqrt(d2) || 1e-6;
  const nx = dx / d, ny = dy / d, depth = rr - d;
  out.nx = nx; out.ny = ny; out.count = 1;
  out.pts[0] = { x: A.wx + nx * (A.r - depth * 0.5), y: A.wy + ny * (A.r - depth * 0.5), depth, id: 3 };
  return true;
}

/* ------------------------------ Мир ------------------------------ */

class World {
  constructor() {
    this.bodies = [];
    this.joints = [];
    this.terrain = null;
    this.water = null;
    this.contacts = [];
    this.cache = new Map();
    this.time = 0;
    this.ground = new Body({ shapes: [{ type: 'circle', r: 0.01 }], isStatic: true, cat: CAT.GROUND });
    this.ground.id = 0;
    this.preSolve = null;
    this._tmp = { nx: 0, ny: 0, count: 0, pts: [] };
  }
  add(b) { this.bodies.push(b); return b; }
  remove(b) { if (b) b.removed = true; }
  addJoint(j) { this.joints.push(j); return j; }
  removeJoint(j) { if (j) j.broken = true; }

  step(h) {
    this.time += h;
    const g = PHYS.gravity;
    const bodies = this.bodies;
    // очистка удалённых
    let w = 0;
    for (let i = 0; i < bodies.length; i++) if (!bodies[i].removed) bodies[w++] = bodies[i];
    bodies.length = w;
    let jw = 0;
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      if (!j.broken && !j.a.removed && !j.b.removed) this.joints[jw++] = j;
    }
    this.joints.length = jw;

    // интегрирование скоростей
    for (const b of bodies) {
      b.contactCount = 0; b.groundContact = false; b.maxImpulse = 0; b.maxImpulseOther = null;
      if (b.isStatic) continue;
      if (this.water && b.hydro) this._hydro(b);
      else if (this.water && b.buoyancy > 0) this._buoyancy(b);
      else b.submerged = 0;
      b.vx += h * b.fx * b.invMass;
      b.vy += h * (g * b.gravityScale + b.fy * b.invMass);
      b.w += h * b.t * b.invI;
      const ld = 1 / (1 + h * b.linDamp), ad = 1 / (1 + h * b.angDamp);
      b.vx *= ld; b.vy *= ld; b.w *= ad;
      if (b.fixedRotation) b.w = 0;
      b.fx = 0; b.fy = 0; b.t = 0;
      // защита от взрывных скоростей
      const sp = b.vx * b.vx + b.vy * b.vy;
      if (sp > 10000) { const k = 100 / Math.sqrt(sp); b.vx *= k; b.vy *= k; }
      // предохранитель от взрывного вращения; колёсам нужно больше (заднее колесо байка на полной скорости ~110 рад/с)
      const wMax = b.radius < 1.2 ? 260 : 60;
      if (b.w > wMax) b.w = wMax; else if (b.w < -wMax) b.w = -wMax;
    }
    for (const b of bodies) b.updateShapes();

    // генерация контактов
    this.contacts.length = 0;
    this._broadphase();
    if (this.terrain) this._terrainContacts();

    // pre-solve
    const newCache = new Map();
    const inv = 1 / h;
    const active = [];
    for (const c of this.contacts) {
      const a = c.a, b = c.b;
      if (this.preSolve && this.preSolve(c) === false) continue;
      active.push(c);
      const key = c.key;
      const old = this.cache.get(key);
      for (let i = 0; i < c.count; i++) {
        const p = c.pts[i];
        p.rax = p.x - a.x; p.ray = p.y - a.y;
        p.rbx = p.x - b.x; p.rby = p.y - b.y;
        const rnA = p.rax * c.ny - p.ray * c.nx;
        const rnB = p.rbx * c.ny - p.rby * c.nx;
        const kN = a.invMass + b.invMass + a.invI * rnA * rnA + b.invI * rnB * rnB;
        p.mN = kN > 0 ? 1 / kN : 0;
        const tx = c.ny, ty = -c.nx;
        const rtA = p.rax * ty - p.ray * tx;
        const rtB = p.rbx * ty - p.rby * tx;
        const kT = a.invMass + b.invMass + a.invI * rtA * rtA + b.invI * rtB * rtB;
        p.mT = kT > 0 ? 1 / kT : 0;
        const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
        const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
        const vn = dvx * c.nx + dvy * c.ny;
        p.vBias = vn < -PHYS.restThreshold ? -c.restitution * vn : 0;
        p.pBias = PHYS.beta * inv * Math.max(0, p.depth - PHYS.slop);
        p.jn = 0; p.jt = 0; p.jp = 0;
        if (old) {
          for (const op of old) if (op.id === p.id) { p.jn = op.jn * 0.9; p.jt = op.jt * 0.9; break; }
        }
        if (i === 0) c.relVn = vn;
        // тёплый старт
        const Px = p.jn * c.nx + p.jt * tx, Py = p.jn * c.ny + p.jt * ty;
        a.vx -= a.invMass * Px; a.vy -= a.invMass * Py; a.w -= a.invI * (p.rax * Py - p.ray * Px);
        b.vx += b.invMass * Px; b.vy += b.invMass * Py; b.w += b.invI * (p.rbx * Py - p.rby * Px);
      }
      a.contactCount++; b.contactCount++;
      if (a === this.ground) b.groundContact = true;
    }
    for (const j of this.joints) j.preStep(h);

    // скорости
    for (let it = 0; it < PHYS.velIters; it++) {
      for (const j of this.joints) j.solve(h);
      for (const c of active) this._solveContact(c);
    }
    // сохранить импульсы для тёплого старта и событий
    for (const c of active) {
      const arr = [];
      let maxJ = 0;
      for (let i = 0; i < c.count; i++) { const p = c.pts[i]; arr.push({ id: p.id, jn: p.jn, jt: p.jt }); maxJ += p.jn; }
      newCache.set(c.key, arr);
      c.impulse = maxJ;
      if (maxJ > c.a.maxImpulse) { c.a.maxImpulse = maxJ; c.a.maxImpulseOther = c.b; }
      if (maxJ > c.b.maxImpulse) { c.b.maxImpulse = maxJ; c.b.maxImpulseOther = c.a; }
    }
    this.cache = newCache;
    // разрыв соединений
    for (const j of this.joints) {
      if (j.breakImpulse > 0) {
        const jj = Math.hypot(j.jx, j.jy);
        if (jj > j.breakImpulse) { j.broken = true; if (j.onBreak) j.onBreak(j); }
      }
    }
    // псевдоскорости (коррекция позиций)
    for (let it = 0; it < PHYS.posIters; it++) for (const c of active) this._solvePosition(c);

    // интегрирование позиций
    for (const b of bodies) {
      if (b.isStatic) continue;
      b.x += h * (b.vx + b.pvx);
      b.y += h * (b.vy + b.pvy);
      b.a += h * (b.w + b.pw);
      b.pvx = 0; b.pvy = 0; b.pw = 0;
    }
    this.activeContacts = active;
  }

  _solveContact(c) {
    const a = c.a, b = c.b, nx = c.nx, ny = c.ny, tx = ny, ty = -nx;
    const mA = a.invMass, mB = b.invMass, iA = a.invI, iB = b.invI;
    for (let i = 0; i < c.count; i++) {
      const p = c.pts[i];
      // трение
      let dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
      let dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
      const vt = dvx * tx + dvy * ty;
      let jt = -p.mT * vt;
      const maxF = c.friction * p.jn;
      const ojt = p.jt;
      p.jt = clamp(ojt + jt, -maxF, maxF);
      jt = p.jt - ojt;
      let Px = jt * tx, Py = jt * ty;
      a.vx -= mA * Px; a.vy -= mA * Py; a.w -= iA * (p.rax * Py - p.ray * Px);
      b.vx += mB * Px; b.vy += mB * Py; b.w += iB * (p.rbx * Py - p.rby * Px);
      // нормаль
      dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
      dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
      const vn = dvx * nx + dvy * ny;
      let jn = -p.mN * (vn - p.vBias);
      const ojn = p.jn;
      p.jn = Math.max(ojn + jn, 0);
      jn = p.jn - ojn;
      Px = jn * nx; Py = jn * ny;
      a.vx -= mA * Px; a.vy -= mA * Py; a.w -= iA * (p.rax * Py - p.ray * Px);
      b.vx += mB * Px; b.vy += mB * Py; b.w += iB * (p.rbx * Py - p.rby * Px);
    }
  }
  _solvePosition(c) {
    const a = c.a, b = c.b, nx = c.nx, ny = c.ny;
    const mA = a.invMass, mB = b.invMass, iA = a.invI, iB = b.invI;
    for (let i = 0; i < c.count; i++) {
      const p = c.pts[i];
      if (p.pBias <= 0) continue;
      const dvx = b.pvx - b.pw * p.rby - a.pvx + a.pw * p.ray;
      const dvy = b.pvy + b.pw * p.rbx - a.pvy - a.pw * p.rax;
      const vn = dvx * nx + dvy * ny;
      let j = p.mN * (p.pBias - vn);
      const oj = p.jp;
      p.jp = Math.max(oj + j, 0);
      j = p.jp - oj;
      const Px = j * nx, Py = j * ny;
      a.pvx -= mA * Px; a.pvy -= mA * Py; a.pw -= iA * (p.rax * Py - p.ray * Px);
      b.pvx += mB * Px; b.pvy += mB * Py; b.pw += iB * (p.rbx * Py - p.rby * Px);
    }
  }

  _broadphase() {
    const list = this.bodies;
    // сортировка вставками (массив почти отсортирован от кадра к кадру)
    for (let i = 1; i < list.length; i++) {
      const b = list[i], k = b.aabb.minX;
      let j = i - 1;
      while (j >= 0 && list[j].aabb.minX > k) { list[j + 1] = list[j]; j--; }
      list[j + 1] = b;
    }
    for (let i = 0; i < list.length; i++) {
      const A = list[i], aa = A.aabb;
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j], bb = B.aabb;
        if (bb.minX > aa.maxX) break;
        if (A.isStatic && B.isStatic) continue;
        if (bb.minY > aa.maxY || bb.maxY < aa.minY) continue;
        if (!(A.mask & B.cat) || !(B.mask & A.cat)) continue;
        if (A.group !== 0 && A.group === B.group) continue;
        this._narrow(A, B);
      }
    }
  }

  _narrow(A, B) {
    const out = this._tmp;
    for (let si = 0; si < A.shapes.length; si++) {
      const sa = A.shapes[si];
      for (let sj = 0; sj < B.shapes.length; sj++) {
        const sb = B.shapes[sj];
        out.pts = []; out.count = 0;
        let hit = false, flip = false;
        if (sa.type === 1 && sb.type === 1) hit = collidePolys(sa, sb, out);
        else if (sa.type === 1 && sb.type === 0) hit = collidePolyCircle(sa, sb, out);
        else if (sa.type === 0 && sb.type === 1) { hit = collidePolyCircle(sb, sa, out); flip = true; }
        else hit = collideCircles(sa, sb, out);
        if (!hit) continue;
        let nx = out.nx, ny = out.ny;
        if (flip) { nx = -nx; ny = -ny; }
        this.contacts.push({
          a: A, b: B, nx, ny, count: out.count, pts: out.pts,
          friction: Math.sqrt(A.friction * B.friction),
          restitution: Math.max(A.restitution, B.restitution),
          key: A.id * 4194304 + B.id + (si * 16 + sj) * 1e13,
          impulse: 0, relVn: 0
        });
      }
    }
  }

  _terrainContacts() {
    const T = this.terrain, G = this.ground;
    for (const b of this.bodies) {
      if (b.isStatic || !(b.mask & CAT.GROUND)) continue;
      const bb = b.aabb;
      if (bb.maxX < T.x0 || bb.minX > T.xEnd) continue;
      if (bb.minY > T.maxHeight(bb.minX, bb.maxX)) continue;
      for (let si = 0; si < b.shapes.length; si++) {
        const s = b.shapes[si];
        const pts = [];
        let nx = 0, ny = 1;
        if (s.type === 0) this._circleTerrain(s, pts);
        else this._polyTerrain(s, pts);
        if (!pts.length) continue;
        // группируем по нормали: каждая точка — собственный контакт (нормали разные)
        pts.sort((p, q) => q.depth - p.depth);
        const n = Math.min(pts.length, s.type === 0 ? 2 : 4);
        for (let k = 0; k < n; k++) {
          const p = pts[k];
          this.contacts.push({
            a: G, b, nx: p.nx, ny: p.ny, count: 1,
            pts: [{ x: p.x, y: p.y, depth: p.depth, id: p.id }],
            friction: Math.sqrt(T.frictionAt(p.x) * b.friction),
            restitution: b.restitution * 0.5,
            key: b.id + (si + 1) * 1e13 + (p.id + 1) * 1e7 + 0.5,
            impulse: 0, relVn: 0, terrain: true
          });
        }
      }
    }
  }

  _circleTerrain(s, out) {
    const T = this.terrain, cx = s.wx, cy = s.wy, r = s.r;
    const i0 = Math.max(0, Math.floor((cx - r - T.x0) / T.dx));
    const i1 = Math.min(T.n - 2, Math.floor((cx + r - T.x0) / T.dx));
    for (let i = i0; i <= i1; i++) {
      const x1 = T.x0 + i * T.dx, y1 = T.h[i], x2 = x1 + T.dx, y2 = T.h[i + 1];
      const ex = x2 - x1, ey = y2 - y1;
      const len2 = ex * ex + ey * ey;
      const t = ((cx - x1) * ex + (cy - y1) * ey) / len2;
      if (t <= 0 || t >= 1) continue;
      const qx = x1 + t * ex, qy = y1 + t * ey;
      const len = Math.sqrt(len2);
      const snx = -ey / len, sny = ex / len;
      const side = (cx - x1) * snx + (cy - y1) * sny;
      if (side >= 0) {
        if (side < r) out.push({ x: qx, y: qy, nx: snx, ny: sny, depth: r - side, id: i });
      } else if (-side < PHYS.maxTerrainDepth + r) {
        out.push({ x: qx, y: qy, nx: snx, ny: sny, depth: r - side, id: i });
      }
    }
    // вершины
    const k0 = Math.max(1, Math.floor((cx - r - T.x0) / T.dx));
    const k1 = Math.min(T.n - 2, Math.ceil((cx + r - T.x0) / T.dx));
    for (let k = k0; k <= k1; k++) {
      const vx = T.x0 + k * T.dx, vy = T.h[k];
      const dx = cx - vx, dy = cy - vy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const pxv = vx - T.dx, pyv = T.h[k - 1];
      const nxv = vx + T.dx, nyv = T.h[k + 1];
      const tPrev = ((cx - pxv) * (vx - pxv) + (cy - pyv) * (vy - pyv));
      const tNext = ((cx - vx) * (nxv - vx) + (cy - vy) * (nyv - vy));
      if (tPrev < ((vx - pxv) ** 2 + (vy - pyv) ** 2) || tNext > 0) continue;
      const d = Math.sqrt(d2) || 1e-6;
      out.push({ x: vx, y: vy, nx: dx / d, ny: dy / d, depth: r - d, id: 100000 + k });
    }
  }

  _polyTerrain(s, out) {
    const T = this.terrain;
    const n = s.wv.length;
    for (let i = 0; i < n; i++) {
      const v = s.wv[i];
      if (v.x < T.x0 || v.x > T.xEnd) continue;
      const seg = Math.min(T.n - 2, Math.max(0, Math.floor((v.x - T.x0) / T.dx)));
      const x1 = T.x0 + seg * T.dx, y1 = T.h[seg], y2 = T.h[seg + 1];
      const gy = y1 + (y2 - y1) * (v.x - x1) / T.dx;
      if (v.y >= gy) continue;
      const ex = T.dx, ey = y2 - y1, len = Math.hypot(ex, ey);
      const nx = -ey / len, ny = ex / len;
      const depth = (gy - v.y) * ny;
      if (depth > PHYS.maxTerrainDepth) continue;
      out.push({ x: v.x, y: v.y + depth * ny * 0.5, nx, ny, depth, id: i });
    }
    // выпуклые вершины рельефа внутри многоугольника
    const bb = { minX: Infinity, maxX: -Infinity };
    for (const v of s.wv) { if (v.x < bb.minX) bb.minX = v.x; if (v.x > bb.maxX) bb.maxX = v.x; }
    const k0 = Math.max(1, Math.ceil((bb.minX - T.x0) / T.dx));
    const k1 = Math.min(T.n - 2, Math.floor((bb.maxX - T.x0) / T.dx));
    for (let k = k0; k <= k1; k++) {
      const hy = T.h[k];
      if (hy <= (T.h[k - 1] + T.h[k + 1]) * 0.5 + 0.02) continue;
      const hx = T.x0 + k * T.dx;
      let maxD = -Infinity, mi = -1;
      let inside = true;
      for (let i = 0; i < n; i++) {
        const d = s.wn[i].x * (hx - s.wv[i].x) + s.wn[i].y * (hy - s.wv[i].y);
        if (d > 0) { inside = false; break; }
        if (d > maxD) { maxD = d; mi = i; }
      }
      if (!inside) continue;
      const nx = -s.wn[mi].x, ny = -s.wn[mi].y;
      if (ny < 0.2) continue;
      if (-maxD > PHYS.maxTerrainDepth) continue;
      out.push({ x: hx, y: hy, nx, ny, depth: -maxD, id: 200000 + k });
    }
  }

  _buoyancy(b) {
    const W = this.water;
    const smp = b.samples, n = smp.length, c = b.cos, s = b.sin;
    let sub = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      const p = smp[i];
      const wx = b.x + c * p.x - s * p.y, wy = b.y + s * p.x + c * p.y;
      const d = W.height(wx, this.time) - wy;
      if (d > 0) {
        const f = Math.min(1, d / b.sampleDepth);
        sub += f; sx += wx * f; sy += wy * f;
      }
    }
    b.submerged = sub / n;
    if (sub <= 0) return;
    const frac = sub / n;
    const px = sx / sub, py = sy / sub;
    const F = -PHYS.gravity * b.mass * b.buoyancy * frac * b.gravityScale;
    b.fy += F;
    b.t += (px - b.x) * F;
    // сопротивление воды
    const vpx = b.vx - b.w * (py - b.y), vpy = b.vy + b.w * (px - b.x);
    const fx = c, fy = s, nxx = -s, nyy = c;
    const vf = vpx * fx + vpy * fy, vn = vpx * nxx + vpy * nyy;
    const k = b.mass * frac;
    const dfx = -(b.waterDragF * vf * fx + b.waterDragN * vn * nxx) * k;
    const dfy = -(b.waterDragF * vf * fy + b.waterDragN * vn * nyy) * k;
    b.fx += dfx; b.fy += dfy;
    b.t += (px - b.x) * dfy - (py - b.y) * dfx;
    b.t -= b.w * b.I * b.waterAngDrag * frac;
  }

  /* Гидродинамика корпуса лодки (по мотивам модели J. Kerner, «Water interaction model for boats in video games»):
     1) выталкивающая сила по реально погружённой площади корпуса (многоугольник обрезается линией воды);
     2) сопротивление давления на каждое погружённое ребро: зависит от угла между скоростью и нормалью —
        скользящая по воде грань почти не тормозит, грань «в лоб» тормозит сильно;
        грань, выходящая из воды, даёт лишь слабое подсасывание;
     3) вязкое трение вдоль корпуса;
     4) смягчение удара о воду: ограничение торможения за шаг, чтобы лодка не «стопорилась». */
  _hydro(b) {
    const W = this.water, t = this.time, H = b.hydro;
    const c = Math.cos(b.a), s = Math.sin(b.a);
    const V = H.verts, n = V.length;
    const px = H._px || (H._px = new Float64Array(n)), py = H._py || (H._py = new Float64Array(n)), d = H._d || (H._d = new Float64Array(n));
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < n; i++) {
      px[i] = b.x + c * V[i][0] - s * V[i][1];
      py[i] = b.y + s * V[i][0] + c * V[i][1];
      if (px[i] < minX) minX = px[i];
      if (px[i] > maxX) maxX = px[i];
    }
    // поверхность под корпусом приближаем прямой (волна намного длиннее лодки)
    const hA = W.height(minX, t), hB = W.height(maxX, t);
    const span = Math.max(1e-3, maxX - minX);
    const vA = (W.height(minX, t + 0.03) - hA) / 0.03, vB = (W.height(maxX, t + 0.03) - hB) / 0.03;
    const surfAt = (x) => hA + (hB - hA) * (x - minX) / span;
    const wvyAt = (x) => vA + (vB - vA) * (x - minX) / span;
    let any = false;
    for (let i = 0; i < n; i++) { d[i] = surfAt(px[i]) - py[i]; if (d[i] > 0) any = true; }
    if (!any) { b.submerged = 0; return; }
    // погружённый многоугольник: площадь и центр
    let A = 0, cx = 0, cy = 0;
    let fx0 = 0, fy0 = 0, first = true, lx = 0, ly = 0;
    const addPt = (x, y) => {
      if (first) { fx0 = x; fy0 = y; first = false; }
      else { const cr = lx * y - x * ly; A += cr; cx += (lx + x) * cr; cy += (ly + y) * cr; }
      lx = x; ly = y;
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (d[i] > 0) addPt(px[i], py[i]);
      if ((d[i] > 0) !== (d[j] > 0)) {
        const k = d[i] / (d[i] - d[j]);
        addPt(px[i] + (px[j] - px[i]) * k, py[i] + (py[j] - py[i]) * k);
      }
    }
    if (!first) { const cr = lx * fy0 - fx0 * ly; A += cr; cx += (lx + fx0) * cr; cy += (ly + fy0) * cr; }
    A *= 0.5;
    if (A < 1e-4) { b.submerged = 0; return; }
    cx /= (6 * A); cy /= (6 * A);
    const frac = Math.min(1, A / H.area);
    b.submerged = frac;
    // 1) плавучесть
    const Fb = H.rho * -PHYS.gravity * A * b.gravityScale;
    b.fy += Fb;
    b.t += (cx - b.x) * Fb;

    // 2–3) давление и трение по рёбрам
    let Fx = 0, Fy = 0, T = 0;
    const k = H.k;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (d[i] <= 0 && d[j] <= 0) continue;
      let ax = px[i], ay = py[i], bx = px[j], by = py[j];
      if (d[i] <= 0) { const q = d[i] / (d[i] - d[j]); ax = px[i] + (px[j] - px[i]) * q; ay = py[i] + (py[j] - py[i]) * q; }
      if (d[j] <= 0) { const q = d[i] / (d[i] - d[j]); bx = px[i] + (px[j] - px[i]) * q; by = py[i] + (py[j] - py[i]) * q; }
      const ex = bx - ax, ey = by - ay;
      const L = Math.hypot(ex, ey);
      if (L < 1e-3) continue;
      const tx = ex / L, ty = ey / L;
      const nx = ty, ny = -tx; // внешняя нормаль (многоугольник против часовой)
      const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5;
      const vx = b.vx - b.w * (my - b.y);
      const vy = b.vy + b.w * (mx - b.x) - wvyAt(mx);
      const sp = Math.hypot(vx, vy);
      if (sp < 1e-3) continue;
      const cosT = (vx * nx + vy * ny) / sp;
      let fn;
      if (cosT > 0) fn = -k * (H.cp1 * sp + H.cp2 * sp * sp) * Math.pow(cosT, H.fp) * L;       // грань входит в воду
      else fn = k * (H.cs1 * sp + H.cs2 * sp * sp) * Math.pow(-cosT, H.fs) * L;                  // грань выходит — подсасывание
      const vt = vx * tx + vy * ty;
      const ft = -k * H.cf * vt * Math.abs(vt) * L;
      const gx = fn * nx + ft * tx, gy = fn * ny + ft * ty;
      Fx += gx; Fy += gy;
      T += (mx - b.x) * gy - (my - b.y) * gx;
    }
    // 4) смягчение удара: торможение против движения ограничено, остальное (подъёмная сила) сохраняется
    const spd = Math.hypot(b.vx, b.vy);
    if (spd > 0.5) {
      const ux = b.vx / spd, uy = b.vy / spd;
      const along = (Fx * ux + Fy * uy) / b.mass;          // < 0 — торможение
      if (along < -H.maxDecel) {
        const excess = (-H.maxDecel - along) * b.mass;     // > 0
        const kk = 1 - excess / (-along * b.mass);
        Fx += excess * ux; Fy += excess * uy;
        T *= kk;
      }
    }
    const accel = Math.hypot(Fx, Fy) / b.mass;
    if (accel > H.maxAcc) { const kk = H.maxAcc / accel; Fx *= kk; Fy *= kk; T *= kk; }
    b.fx += Fx; b.fy += Fy; b.t += T;
    H.lastFx = Fx; H.lastFy = Fy;
    // вращательное демпфирование водой
    b.t -= b.w * b.I * H.angDamp * frac;
  }

  // рейкаст: возвращает ближайшее попадание
  rayCast(x1, y1, x2, y2, mask, ignoreGroup) {
    let best = null, bestT = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    for (const b of this.bodies) {
      if (b.removed || !(b.cat & mask)) continue;
      if (ignoreGroup && b.group === ignoreGroup) continue;
      const bb = b.aabb;
      if (bb.maxX < minX || bb.minX > maxX || bb.maxY < minY || bb.minY > maxY) continue;
      for (const s of b.shapes) {
        let t = null, nx = 0, ny = 0;
        if (s.type === 0) {
          const fx = x1 - s.wx, fy = y1 - s.wy;
          const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - s.r * s.r;
          const disc = B * B - 4 * A * C;
          if (disc >= 0) {
            const tt = (-B - Math.sqrt(disc)) / (2 * A);
            if (tt >= 0 && tt < bestT) { t = tt; nx = (x1 + dx * tt - s.wx) / s.r; ny = (y1 + dy * tt - s.wy) / s.r; }
          }
        } else {
          let lower = 0, upper = bestT, idx = -1;
          const n = s.wv.length;
          let ok = true;
          for (let i = 0; i < n; i++) {
            const num = s.wn[i].x * (s.wv[i].x - x1) + s.wn[i].y * (s.wv[i].y - y1);
            const den = s.wn[i].x * dx + s.wn[i].y * dy;
            if (den === 0) { if (num < 0) { ok = false; break; } }
            else if (den < 0 && num < lower * den) { lower = num / den; idx = i; }
            else if (den > 0 && num < upper * den) { upper = num / den; }
            if (upper < lower) { ok = false; break; }
          }
          if (ok && idx >= 0 && lower < bestT) { t = lower; nx = s.wn[idx].x; ny = s.wn[idx].y; }
        }
        if (t !== null && t < bestT) { bestT = t; best = { body: b, x: x1 + dx * t, y: y1 + dy * t, nx, ny, t }; }
      }
    }
    if (this.terrain && (mask & CAT.GROUND)) {
      const T = this.terrain;
      const steps = Math.ceil(Math.hypot(dx, dy) * bestT / (T.dx * 0.5));
      let prevAbove = y1 >= T.heightAt(x1);
      for (let i = 1; i <= steps; i++) {
        const tt = bestT * i / steps;
        const px = x1 + dx * tt, py = y1 + dy * tt;
        const above = py >= T.heightAt(px);
        if (prevAbove && !above) {
          const n = T.normalAt(px);
          best = { body: this.ground, x: px, y: T.heightAt(px), nx: n.x, ny: n.y, t: tt };
          break;
        }
        prevAbove = above;
      }
    }
    return best;
  }

  queryRadius(x, y, r, mask) {
    const out = [];
    for (const b of this.bodies) {
      if (b.removed || b.isStatic || !(b.cat & mask)) continue;
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < (r + b.radius) * (r + b.radius)) out.push(b);
    }
    return out;
  }
}

/* ------------------------------ Рельеф ------------------------------ */

class Terrain {
  constructor(x0, length, dx) {
    this.x0 = x0; this.dx = dx;
    this.n = Math.ceil(length / dx) + 1;
    this.h = new Float32Array(this.n);
    this.xEnd = x0 + (this.n - 1) * dx;
    this.friction = 0.9;
    this.surface = new Uint8Array(this.n); // тип поверхности для отрисовки
    this._maxBlock = null;
  }
  index(x) { return Math.floor((x - this.x0) / this.dx); }
  // зоны с особым сцеплением (лёд, песок)
  frictionAt(x) {
    if (this.zones) for (const z of this.zones) if (x >= z[0] && x <= z[1]) return z[2];
    return this.friction;
  }
  heightAt(x) {
    let f = (x - this.x0) / this.dx;
    if (f <= 0) return this.h[0];
    if (f >= this.n - 1) return this.h[this.n - 1];
    const i = Math.floor(f); f -= i;
    return this.h[i] + (this.h[i + 1] - this.h[i]) * f;
  }
  normalAt(x) {
    const i = clamp(Math.floor((x - this.x0) / this.dx), 0, this.n - 2);
    const ey = this.h[i + 1] - this.h[i], ex = this.dx;
    const l = Math.hypot(ex, ey);
    return { x: -ey / l, y: ex / l };
  }
  finalize() {
    // блоки максимумов для быстрого отсечения
    const B = 16;
    const nb = Math.ceil(this.n / B);
    this._maxBlock = new Float32Array(nb);
    this._minBlock = new Float32Array(nb);
    for (let b = 0; b < nb; b++) {
      let m = -Infinity, mn = Infinity;
      for (let i = b * B; i < Math.min(this.n, b * B + B + 1); i++) { if (this.h[i] > m) m = this.h[i]; if (this.h[i] < mn) mn = this.h[i]; }
      this._maxBlock[b] = m; this._minBlock[b] = mn;
    }
    this._B = B;
  }
  maxHeight(x1, x2) {
    const i1 = clamp(this.index(x1), 0, this.n - 1), i2 = clamp(this.index(x2) + 1, 0, this.n - 1);
    let m = -Infinity;
    const B = this._B;
    for (let b = Math.floor(i1 / B); b <= Math.floor(i2 / B); b++) if (this._maxBlock[b] > m) m = this._maxBlock[b];
    return m;
  }
}
