'use strict';
/* Объекты уровня: ящики, бочки, покрышки, обломки машин, трамплины, мосты, контейнеры, мины, бонусы */

class Prop {
  constructor(game, kind, body, o = {}) {
    this.game = game; this.kind = kind; this.body = body; this.o = o;
    this.dead = false;
    if (body) body.data = { kind: 'prop', prop: this };
    this.seed = Math.floor(Math.random() * 1000);
    this.spawnX = body ? body.x : o.x;
    this.crushDist = 0; // если предмет протолкали дальше — он сминается
  }
  // смять тяжёлый предмет, который протолкали слишком далеко (чтобы не образовывались пробки)
  crush() {
    const G = this.game;
    const bodies = this.body ? [this.body] : (this.bodies || []);
    for (const b of bodies) {
      if (b.removed) continue;
      G.particles.sparks(b.x, b.y, 0, 1, 14);
      G.particles.splinters(b.x, b.y, b.vx, b.vy + 3, 14, this.kind === 'logs' ? '#8a5a2b' : '#4a4d52');
      G.particles.dust(b.x, b.y - 0.3, b.vx, 1, 5, G.dustColor);
      for (let i = 0; i < 2; i++) {
        const pb = G.world.add(new Body({
          x: b.x + (Math.random() - 0.5) * 1.5, y: b.y + 0.3, angle: Math.random() * 3,
          shapes: [{ type: 'poly', verts: boxVerts(1.4, 0.12) }], mass: 6, friction: 0.7, cat: CAT.DEBRIS,
          mask: CAT.GROUND | CAT.STATIC
        }));
        pb.vx = b.vx + (Math.random() - 0.5) * 5; pb.vy = 3 + Math.random() * 4; pb.w = (Math.random() - 0.5) * 16;
        G.debris.push({ body: pb, color: this.kind === 'logs' ? '#7a5a3a' : '#5a5e62', w: 1.4, h: 0.12, life: 5 });
      }
    }
    AUDIO.metal(0.9); AUDIO.crateBreak();
    this.remove();
  }
  get x() { return this.body ? this.body.x : this.o.x; }
  update(h) { }
  remove() {
    if (this.body) this.game.world.remove(this.body);
    if (this.bodies) this.bodies.forEach(b => this.game.world.remove(b));
    if (this.joints) this.joints.forEach(j => this.game.world.removeJoint(j));
    this.dead = true;
  }
  render(ctx, alpha) { }
}

function boxVerts(w, h) { return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }

class Crate extends Prop {
  constructor(game, x, y, size = 1, o = {}) {
    const b = game.world.add(new Body({ x, y: y + size / 2, shapes: [{ type: 'poly', verts: boxVerts(size, size) }], mass: 25 * size * size, friction: 0.6, cat: CAT.PROP, buoyancy: 1.8, sampleDepth: size * 0.5, angDamp: 0.2 }));
    super(game, 'crate', b, o);
    this.size = size;
    this.strength = 2600 * size;
    this.metal = !!o.metal;
    if (this.metal) { b.mass *= 2; b.invMass /= 2; b.I *= 2; b.invI /= 2; this.strength = 1e9; this.crushDist = 12; }
  }
  update(h) {
    if (this.body.maxImpulse * 120 > this.strength) this.breakApart();
  }
  breakApart() {
    const G = this.game, b = this.body;
    this.remove();
    G.particles.splinters(b.x, b.y, b.vx, b.vy, 18);
    G.particles.dust(b.x, b.y, b.vx, b.vy, 5, 'rgba(140,110,70,');
    AUDIO.crateBreak(clamp((b.x - G.camX) / 20, -1, 1));
    const s = this.size;
    for (let i = 0; i < 4; i++) {
      const pb = G.world.add(new Body({
        x: b.x + (Math.random() - 0.5) * s * 0.6, y: b.y + (Math.random() - 0.5) * s * 0.6, angle: Math.random() * 3,
        shapes: [{ type: 'poly', verts: boxVerts(s * 0.9, 0.1) }], mass: 3, friction: 0.6, cat: CAT.DEBRIS,
        mask: CAT.GROUND | CAT.STATIC, buoyancy: 2, sampleDepth: 0.05
      }));
      pb.vx = b.vx + (Math.random() - 0.5) * 6; pb.vy = b.vy + Math.random() * 5; pb.w = (Math.random() - 0.5) * 20;
      G.debris.push({ body: pb, color: '#9a6a36', w: s * 0.9, h: 0.1, life: 6 });
    }
    // лут
    if (this.o.loot === 'fuel' || (this.o.loot !== 'none' && Math.random() < 0.12)) G.addPickup(b.x, b.y + 0.5, 'fuel');
    else if (Math.random() < 0.25) G.addPickup(b.x, b.y + 0.5, 'cash');
    G.onPropSmashed && G.onPropSmashed(this);
  }
  render(ctx, alpha) {
    const b = this.body, s = this.size;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha));
    if (this.metal) {
      const g = ctx.createLinearGradient(0, s / 2, 0, -s / 2);
      g.addColorStop(0, '#7d8a8f'); g.addColorStop(1, '#4b5559');
      ctx.fillStyle = g; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = '#353d40'; ctx.lineWidth = 0.05; ctx.strokeRect(-s / 2 + 0.05, -s / 2 + 0.05, s - 0.1, s - 0.1);
      ctx.fillStyle = '#e1b12c'; ctx.fillRect(-s * 0.3, -0.06, s * 0.6, 0.12);
    } else {
      const g = ctx.createLinearGradient(-s / 2, s / 2, s / 2, -s / 2);
      g.addColorStop(0, '#c08a4a'); g.addColorStop(1, '#8a5a2b');
      ctx.fillStyle = g; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = '#5e3b19'; ctx.lineWidth = 0.06;
      ctx.strokeRect(-s / 2 + 0.03, -s / 2 + 0.03, s - 0.06, s - 0.06);
      ctx.beginPath(); ctx.moveTo(-s / 2 + 0.05, -s / 2 + 0.05); ctx.lineTo(s / 2 - 0.05, s / 2 - 0.05); ctx.stroke();
      ctx.strokeStyle = 'rgba(60,35,15,0.4)'; ctx.lineWidth = 0.015;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2 + i * s / 4); ctx.lineTo(s / 2, -s / 2 + i * s / 4); ctx.stroke(); }
    }
    ctx.restore();
  }
}

class Barrel extends Prop {
  constructor(game, x, y, explosive = false) {
    const b = game.world.add(new Body({ x, y: y + 0.45, shapes: [{ type: 'poly', verts: [[-0.3, -0.45], [0.3, -0.45], [0.33, 0], [0.3, 0.45], [-0.3, 0.45], [-0.33, 0]] }], mass: explosive ? 60 : 40, friction: 0.5, cat: CAT.PROP, buoyancy: 2.2, sampleDepth: 0.4 }));
    super(game, 'barrel', b);
    this.explosive = explosive;
    this.fuse = -1;
  }
  update(h) {
    if (this.explosive) {
      if (this.fuse < 0 && this.body.maxImpulse * 120 > 4200) this.fuse = 0.05 + Math.random() * 0.1;
      if (this.fuse >= 0) {
        this.fuse -= h;
        if (Math.random() < 0.5) this.game.particles.fire(this.body.x, this.body.y + 0.5, 0, 0, 1, 0.5);
        if (this.fuse < 0) { this.remove(); this.game.explode(this.body.x, this.body.y, 1.2, 'barrel'); }
      }
    }
  }
  ignite() { if (this.explosive && this.fuse < 0) this.fuse = 0.15; }
  render(ctx, alpha) {
    const b = this.body;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha));
    const col = this.explosive ? '#b52418' : '#3d6b4a';
    const g = ctx.createLinearGradient(-0.33, 0, 0.33, 0);
    g.addColorStop(0, shade(col, -0.45)); g.addColorStop(0.35, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.35));
    ctx.fillStyle = g;
    roundRect(ctx, -0.32, -0.45, 0.64, 0.9, 0.06); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-0.32, -0.2, 0.64, 0.04); ctx.fillRect(-0.32, 0.18, 0.64, 0.04);
    if (this.explosive) {
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.moveTo(0, 0.12); ctx.lineTo(0.12, -0.08); ctx.lineTo(-0.12, -0.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-0.015, -0.04, 0.03, 0.08);
    }
    ctx.restore();
  }
}

class TireStack extends Prop {
  constructor(game, x, y) {
    const b = game.world.add(new Body({ x, y: y + 0.38, shapes: [{ type: 'circle', r: 0.38 }], mass: 18, friction: 0.9, restitution: 0.45, cat: CAT.PROP, buoyancy: 1.5, angDamp: 0.3 }));
    super(game, 'tire', b);
  }
  render(ctx, alpha) {
    const b = this.body;
    drawWheel(ctx, b.ix(alpha), b.iy(alpha), b.ia(alpha), 0.38, { rim: '#333', offroad: true, rimScale: 0.45 });
  }
}

class Wreck extends Prop {
  constructor(game, x, y, o = {}) {
    const w = o.w || 3.8, h = o.h || 1.1;
    const b = game.world.add(new Body({
      x, y: y + h / 2 + 0.05, angle: o.angle || 0,
      shapes: [{ type: 'poly', verts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - 0.2, h / 2 - 0.3], [-w / 2 + 0.3, h / 2 - 0.25]] }, { type: 'poly', verts: [[-w * 0.3, h / 2 - 0.3], [w * 0.2, h / 2 - 0.3], [w * 0.05, h / 2 + 0.3], [-w * 0.22, h / 2 + 0.3]] }],
      mass: o.mass || 520, friction: 0.75, cat: CAT.PROP, buoyancy: 0.4, angDamp: 0.3
    }));
    super(game, 'wreck', b, o);
    this.w = w; this.h = h;
    this.color = o.color || ['#6b7078', '#7a3b2e', '#3e5566', '#8c7a4a', '#4a4a4a', '#556b4a'][Math.floor(Math.random() * 6)];
    this.burning = o.burning !== undefined ? o.burning : Math.random() < 0.3;
    this.crushDist = 14;
  }
  update(h) {
    if (this.burning && Math.random() < 0.35 * this.game.particles.quality) {
      const b = this.body;
      this.game.particles.fire(b.x + (Math.random() - 0.5) * this.w * 0.4, b.y + this.h * 0.4, b.vx, 0, 1, 0.8);
      if (Math.random() < 0.3) this.game.particles.smoke(b.x, b.y + this.h, 0.3, 1, 1, 0.8, 1.2);
    }
  }
  render(ctx, alpha) {
    const b = this.body, w = this.w, h = this.h;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha)); ctx.translate(-b.com.x, -b.com.y);
    const col = this.burning ? shade(this.color, -0.55) : shade(this.color, -0.2);
    ctx.fillStyle = col;
    polyPath(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - 0.2, h / 2 - 0.3], [w * 0.05, h / 2 + 0.3], [-w * 0.22, h / 2 + 0.3], [-w * 0.3, h / 2 - 0.3], [-w / 2 + 0.3, h / 2 - 0.25]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.04; ctx.stroke();
    ctx.fillStyle = '#151a1e';
    polyPath(ctx, [[-w * 0.26, h / 2 - 0.25], [w * 0.16, h / 2 - 0.25], [w * 0.03, h / 2 + 0.22], [-w * 0.19, h / 2 + 0.22]]); ctx.fill();
    ctx.fillStyle = 'rgba(60,30,10,0.5)';
    ctx.beginPath(); ctx.ellipse(w * 0.15, -0.1, 0.4, 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-w * 0.3, -h / 2, 0.36, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.3, -h / 2, 0.36, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-w * 0.3, -h / 2 + 0.02, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

class Barrier extends Prop {
  constructor(game, x, y, o = {}) {
    const b = game.world.add(new Body({ x, y: y + 0.45, shapes: [{ type: 'poly', verts: [[-0.9, -0.45], [0.9, -0.45], [0.35, 0.45], [-0.35, 0.45]] }], mass: o.light ? 60 : 350, friction: 0.7, cat: CAT.PROP, buoyancy: 0.3 }));
    super(game, 'barrier', b, o);
    this.color = o.light ? '#d8d8d8' : '#a9a49a';
    this.crushDist = 10;
  }
  render(ctx, alpha) {
    const b = this.body;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha)); ctx.translate(-b.com.x, -b.com.y);
    const g = ctx.createLinearGradient(0, 0.45, 0, -0.45);
    g.addColorStop(0, shade(this.color, 0.15)); g.addColorStop(1, shade(this.color, -0.3));
    ctx.fillStyle = g;
    polyPath(ctx, [[-0.9, -0.45], [0.9, -0.45], [0.35, 0.45], [-0.35, 0.45]]); ctx.fill();
    ctx.fillStyle = this.o.light ? '#c62828' : 'rgba(0,0,0,0.15)';
    ctx.fillRect(-0.6, -0.1, 1.2, 0.12);
    ctx.restore();
  }
}

class Sandbags extends Prop {
  constructor(game, x, y) {
    const b = game.world.add(new Body({ x, y: y + 0.35, shapes: [{ type: 'poly', verts: [[-0.8, -0.35], [0.8, -0.35], [0.6, 0.35], [-0.6, 0.35]] }], mass: 240, friction: 0.9, cat: CAT.PROP, buoyancy: 0.2 }));
    super(game, 'sandbags', b);
    this.crushDist = 10;
  }
  render(ctx, alpha) {
    const b = this.body;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha)); ctx.translate(-b.com.x, -b.com.y);
    const bags = [[-0.45, -0.18], [0.0, -0.18], [0.45, -0.18], [-0.22, 0.16], [0.22, 0.16]];
    for (const [bx, by] of bags) {
      const g = ctx.createRadialGradient(bx - 0.05, by + 0.05, 0.02, bx, by, 0.3);
      g.addColorStop(0, '#b9a67c'); g.addColorStop(1, '#6e6146');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(bx, by, 0.26, 0.17, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// статическая рампа / платформа
class StaticBlock extends Prop {
  constructor(game, verts, o = {}) {
    const b = game.world.add(new Body({ x: 0, y: 0, shapes: [{ type: 'poly', verts }], isStatic: true, friction: o.friction || 0.8, cat: CAT.STATIC }));
    super(game, 'static', b, o);
    this.verts = verts;
    this.style = o.style || 'wood';
    this.minX = Math.min(...verts.map(v => v[0])); this.maxX = Math.max(...verts.map(v => v[0]));
  }
  get x() { return this.maxX; }
  render(ctx) {
    const v = this.verts;
    polyPath(ctx, v);
    const minY = Math.min(...v.map(p => p[1])), maxY = Math.max(...v.map(p => p[1]));
    if (this.style === 'wood') {
      const g = ctx.createLinearGradient(0, maxY, 0, minY);
      g.addColorStop(0, '#a47444'); g.addColorStop(1, '#5c3d20');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(40,25,10,0.5)'; ctx.lineWidth = 0.05;
      for (let x = this.minX; x < this.maxX; x += 0.5) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x + 0.3, maxY); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#3b2612'; ctx.lineWidth = 0.08; ctx.stroke();
    } else if (this.style === 'concrete') {
      const g = ctx.createLinearGradient(0, maxY, 0, minY);
      g.addColorStop(0, '#b5b1a8'); g.addColorStop(1, '#6f6b63');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#4f4c46'; ctx.lineWidth = 0.06; ctx.stroke();
    } else if (this.style === 'metal') {
      const g = ctx.createLinearGradient(0, maxY, 0, minY);
      g.addColorStop(0, '#8e989c'); g.addColorStop(1, '#4a5256');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.04;
      for (let x = this.minX; x < this.maxX; x += 0.35) { ctx.beginPath(); ctx.moveTo(x, maxY); ctx.lineTo(x - 0.2, minY); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#2f3538'; ctx.lineWidth = 0.06; ctx.stroke();
    } else if (this.style === 'rust') {
      const g = ctx.createLinearGradient(0, maxY, 0, minY);
      g.addColorStop(0, '#7b4a2e'); g.addColorStop(1, '#3a2418');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.06; ctx.stroke();
    } else if (this.style === 'rock') {
      const g = ctx.createLinearGradient(0, maxY, 0, minY);
      g.addColorStop(0, '#8b8377'); g.addColorStop(1, '#4b463f');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#3a362f'; ctx.lineWidth = 0.05; ctx.stroke();
    }
    // опоры
    if (this.o.legs) {
      // опоры доходят ровно до земли (или до дна)
      ctx.fillStyle = this.style === 'wood' ? '#4a3018' : '#555';
      const T = this.game.world.terrain;
      for (const lx of this.o.legs) {
        const topY = this.o.legTop !== undefined ? this.o.legTop : minY;
        const gy = T.heightAt(lx);
        if (topY > gy) ctx.fillRect(lx - 0.12, gy - 0.3, 0.24, topY - gy + 0.3);
      }
    }
  }
}

// подвесной мост из досок на шарнирах
class Bridge extends Prop {
  constructor(game, x1, y1, x2, y2, o = {}) {
    super(game, 'bridge', null, o);
    const W = game.world;
    this.bodies = []; this.joints = [];
    this.x1 = x1; this.x2 = x2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(3, Math.round(len / (o.plank || 1.0)));
    const pl = len / n;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    this.anchorA = W.add(new Body({ x: x1, y: y1, shapes: [{ type: 'circle', r: 0.1 }], isStatic: true, cat: CAT.STATIC, mask: 0 }));
    this.anchorB = W.add(new Body({ x: x2, y: y2, shapes: [{ type: 'circle', r: 0.1 }], isStatic: true, cat: CAT.STATIC, mask: 0 }));
    this.bodies.push(this.anchorA, this.anchorB);
    let prev = this.anchorA;
    this.planks = [];
    const grp = 90000 + Math.floor(Math.random() * 9000);
    for (let i = 0; i < n; i++) {
      const cx = x1 + Math.cos(ang) * (i + 0.5) * pl, cy = y1 + Math.sin(ang) * (i + 0.5) * pl;
      // доска со скошенными верхними углами: колесо не бьётся о торцы на скорости
      const hw = pl * 0.5, ch = 0.06;
      const plankVerts = [[-hw, -0.11], [hw, -0.11], [hw, 0.11 - ch], [hw - ch, 0.11], [-hw + ch, 0.11], [-hw, 0.11 - ch]];
      const b = W.add(new Body({ x: cx, y: cy, angle: ang, shapes: [{ type: 'poly', verts: plankVerts }], mass: o.mass || 45, friction: 0.9, cat: CAT.PROP, group: grp,
        // доски не сталкиваются с землёй и опорами: крайние лежат на кромке обрыва и иначе выталкиваются, раскачивая мост
        mask: CAT.ALL & ~CAT.GROUND & ~CAT.STATIC, buoyancy: 1.5, angDamp: 3, linDamp: 1.2 }));
      b.restX = cx; b.restY = cy; b.restA = ang;
      b.data = { kind: 'prop', prop: this };
      this.bodies.push(b); this.planks.push(b);
      const jx = x1 + Math.cos(ang) * i * pl, jy = y1 + Math.sin(ang) * i * pl;
      const j = W.addJoint(new RevoluteJoint(prev, b, jx, jy, { breakImpulse: o.breakImpulse || 0, softness: 0.00002 }));
      this.joints.push(j);
      j.onBreak = () => { AUDIO.crateBreak(); game.particles.splinters(jx, jy, 0, 0, 10); };
      prev = b;
    }
    const j = W.addJoint(new RevoluteJoint(prev, this.anchorB, x2, y2, { breakImpulse: o.breakImpulse || 0, softness: 0.00002 }));
    this.joints.push(j);
    this.style = o.style || 'rope';
  }
  get x() { return this.x2; }
  update(h) {
    // доски пружинят к исходному положению: мост прогибается под весом, но не раскачивается сам
    const omega = 2 * Math.PI * 2.2, zeta = 1.0;
    for (const p of this.planks) {
      if (p.removed) continue;
      const k = p.mass * omega * omega, c = 2 * p.mass * zeta * omega;
      // компенсация собственного веса доски: в покое мост лежит ровно вровень с краями
      p.fy += p.mass * -PHYS.gravity;
      p.fx += -k * (p.x - p.restX) - c * p.vx;
      p.fy += -k * (p.y - p.restY) - c * p.vy;
      let da = p.a - p.restA;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.t += -p.I * omega * omega * da - 2 * p.I * zeta * omega * p.w;
      // полностью успокоить, если на мосту никого нет
      if (p.contactCount === 0 && Math.abs(p.x - p.restX) + Math.abs(p.y - p.restY) < 0.004 && Math.abs(p.vx) + Math.abs(p.vy) < 0.05) {
        p.vx *= 0.5; p.vy *= 0.5; p.w *= 0.5;
      }
    }
  }
  render(ctx, alpha) {
    // канаты
    if (this.style === 'rope') {
      ctx.strokeStyle = '#6b5436'; ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(this.anchorA.x, this.anchorA.y + 0.9);
      for (const p of this.planks) if (!p.removed) ctx.lineTo(p.ix(alpha), p.iy(alpha) + 0.9);
      ctx.lineTo(this.anchorB.x, this.anchorB.y + 0.9);
      ctx.stroke();
    }
    for (const p of this.planks) {
      if (p.removed) continue;
      ctx.save(); ctx.translate(p.ix(alpha), p.iy(alpha)); ctx.rotate(p.ia(alpha));
      const v = p.shapes[0].verts;
      const w = v[1].x - v[0].x;
      ctx.fillStyle = this.style === 'metal' ? '#6f777b' : '#8d6236';
      ctx.fillRect(-w / 2, -0.11, w, 0.22);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2, -0.11, w, 0.05);
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-w / 2 + 0.1, 0, 0.03, 0, Math.PI * 2); ctx.arc(w / 2 - 0.1, 0, 0.03, 0, Math.PI * 2); ctx.fill();
      if (this.style === 'rope') { ctx.strokeStyle = '#6b5436'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, 0.1); ctx.lineTo(0, 0.9); ctx.stroke(); }
      ctx.restore();
    }
    // столбы
    ctx.fillStyle = '#4a3018';
    for (const a of [this.anchorA, this.anchorB]) { ctx.fillRect(a.x - 0.12, a.y - 3, 0.24, 4.3); }
  }
}

// плавучий контейнер / бревно / буй / мина
class Floater extends Prop {
  constructor(game, x, y, type) {
    let shapes, mass, buoy, dragF = 1.5;
    if (type === 'container') { shapes = [{ type: 'poly', verts: boxVerts(4.5, 1.8) }]; mass = 900; buoy = 1.6; }
    else if (type === 'log') { shapes = [{ type: 'poly', verts: [[-1.6, -0.2], [1.6, -0.2], [1.7, 0], [1.6, 0.2], [-1.6, 0.2], [-1.7, 0]] }]; mass = 90; buoy = 1.7; }
    else if (type === 'mine') { shapes = [{ type: 'circle', r: 0.5 }]; mass = 80; buoy = 2.2; }
    else if (type === 'buoy') { shapes = [{ type: 'poly', verts: [[-0.5, -0.6], [0.5, -0.6], [0.3, 0.8], [-0.3, 0.8]] }]; mass = 70; buoy = 2.0; }
    else if (type === 'raft') { shapes = [{ type: 'poly', verts: boxVerts(3.2, 0.35) }]; mass = 160; buoy = 2.6; }
    const b = game.world.add(new Body({ x, y, shapes, mass, friction: 0.6, cat: CAT.PROP, buoyancy: buoy, sampleDepth: 0.4, waterDragF: dragF, waterDragN: 2.5, waterAngDrag: 2 }));
    super(game, type, b);
    this.type = type;
    this.armed = type === 'mine';
    this.blink = Math.random() * 3;
  }
  update(h) {
    this.blink += h;
    if (this.armed) {
      const v = this.game.vehicle;
      if (v && Math.hypot(v.x - this.body.x, v.y - this.body.y) < 2.6) {
        this.armed = false; this.remove(); this.game.explode(this.body.x, this.body.y, 1.6, 'mine');
      } else if (this.body.maxImpulse * 120 > 3000) {
        this.armed = false; this.remove(); this.game.explode(this.body.x, this.body.y, 1.6, 'mine');
      }
    }
  }
  render(ctx, alpha) {
    const b = this.body;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha)); ctx.translate(-b.com.x, -b.com.y);
    if (this.type === 'container') {
      const col = ['#a33b27', '#2f6b8f', '#c9922a', '#3f7a45'][this.seed % 4];
      const g = ctx.createLinearGradient(0, 0.9, 0, -0.9);
      g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.4));
      ctx.fillStyle = g; ctx.fillRect(-2.25, -0.9, 4.5, 1.8);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.05;
      for (let x = -2.1; x < 2.25; x += 0.25) { ctx.beginPath(); ctx.moveTo(x, -0.85); ctx.lineTo(x, 0.85); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.08; ctx.strokeRect(-2.25, -0.9, 4.5, 1.8);
    } else if (this.type === 'log') {
      ctx.fillStyle = '#6b4a2a';
      polyPath(ctx, [[-1.6, -0.2], [1.6, -0.2], [1.7, 0], [1.6, 0.2], [-1.6, 0.2], [-1.7, 0]]); ctx.fill();
      ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.ellipse(1.65, 0, 0.06, 0.19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-1.4, 0.05); ctx.lineTo(1.2, 0.08); ctx.stroke();
    } else if (this.type === 'mine') {
      ctx.fillStyle = '#2d3033';
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.fillRect(0.4, -0.05, 0.22, 0.1); ctx.restore(); }
      const g = ctx.createRadialGradient(-0.15, 0.15, 0.05, 0, 0, 0.5);
      g.addColorStop(0, '#6a6f73'); g.addColorStop(1, '#24272a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Math.sin(this.blink * 6) > 0 ? '#ff3b2f' : '#551410';
      ctx.beginPath(); ctx.arc(0, 0.35, 0.08, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'buoy') {
      ctx.fillStyle = '#d63a22';
      polyPath(ctx, [[-0.5, -0.6], [0.5, -0.6], [0.3, 0.8], [-0.3, 0.8]]); ctx.fill();
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-0.42, -0.1, 0.84, 0.25);
      ctx.fillStyle = '#333'; ctx.fillRect(-0.05, 0.8, 0.1, 0.6);
      ctx.fillStyle = Math.sin(this.blink * 3) > 0.3 ? '#ffe680' : '#665c33';
      ctx.beginPath(); ctx.arc(0, 1.45, 0.12, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'raft') {
      ctx.fillStyle = '#8d6236';
      for (let i = 0; i < 6; i++) { ctx.fillRect(-1.6 + i * 0.54, -0.17, 0.5, 0.34); }
      ctx.fillStyle = '#e07b22'; ctx.fillRect(-1.6, -0.25, 3.2, 0.1);
    }
    ctx.restore();
  }
}

// бонус: канистра или деньги
class Pickup extends Prop {
  constructor(game, x, y, type) {
    super(game, 'pickup', null, { x, y });
    this.type = type; this.px = x; this.py = y; this.t = Math.random() * 5;
    this.taken = false;
  }
  get x() { return this.px; }
  update(h) {
    this.t += h;
    const v = this.game.vehicle;
    if (!v || this.taken) return;
    // лодки: бонус качается на воде
    if (this.game.world.water) this.py = this.game.world.water.height(this.px, this.game.world.time) + 0.8;
    const d = Math.hypot(v.x - this.px, v.y - this.py);
    if (d < 2.4) {
      this.taken = true; this.dead = true;
      this.game.onPickup(this);
    }
  }
  render(ctx) {
    const y = this.py + Math.sin(this.t * 3) * 0.12;
    ctx.save(); ctx.translate(this.px, y); ctx.rotate(Math.sin(this.t * 2) * 0.1);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.1);
    g.addColorStop(0, this.type === 'fuel' ? 'rgba(255,140,60,0.5)' : 'rgba(120,255,120,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (this.type === 'fuel') drawJerrycan(ctx, 0, -0.35, 0.7);
    else {
      ctx.fillStyle = '#3f8f3a'; roundRect(ctx, -0.45, -0.25, 0.9, 0.5, 0.06); ctx.fill();
      ctx.fillStyle = '#8fd67a'; ctx.fillRect(-0.4, -0.2, 0.8, 0.4);
      ctx.fillStyle = '#2e6b2a'; ctx.beginPath(); ctx.arc(0, 0, 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9c65a'; ctx.fillRect(-0.08, -0.25, 0.16, 0.5);
    }
    ctx.restore();
  }
}
