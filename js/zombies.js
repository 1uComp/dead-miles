'use strict';
/* Зомби (живые, с процедурной анимацией) и рэгдоллы (тела после удара) */

const ZOMBIE_TYPES = {
  walker: { name: 'Бродяга', speed: 0.9, mass: 75, w: 0.48, h: 1.78, hp: 1, reward: 10, skin: ['#8ea37c', '#9aa88a', '#7f9573', '#a3a98f'], scale: 1 },
  runner: { name: 'Бегун', speed: 4.3, mass: 62, w: 0.44, h: 1.72, hp: 1, reward: 15, skin: ['#9bb08a', '#8c9f7e'], scale: 0.95, lean: 0.35 },
  fatty: { name: 'Толстяк', speed: 0.6, mass: 190, w: 0.95, h: 1.9, hp: 4, reward: 25, skin: ['#8a9a70', '#a0a878'], scale: 1.05, fat: true },
  soldier: { name: 'Солдат', speed: 1.2, mass: 100, w: 0.52, h: 1.82, hp: 3, reward: 30, skin: ['#86997a'], scale: 1, helmet: true, killMul: 1.35 },
  bloater: { name: 'Пузырь', speed: 0.5, mass: 130, w: 0.85, h: 1.85, hp: 1, reward: 35, skin: ['#8fae5a', '#9db35e'], scale: 1, bloat: true },
  swimmer: { name: 'Утопленник', speed: 1.3, mass: 70, w: 0.48, h: 1.7, hp: 1, reward: 15, skin: ['#7c9a93', '#88a6a0'], scale: 1, swim: true },
  brute: { name: 'Громила', speed: 1.6, mass: 480, w: 1.3, h: 3.1, hp: 12, reward: 150, skin: ['#6f8563'], scale: 1.7, fat: false, brute: true, killMul: 2.2 }
};
const SHIRTS = ['#5b4a3a', '#3c4f63', '#6e2f2f', '#4a5a3a', '#7a6a4f', '#303030', '#8a7d6b', '#5a3d5c', '#2f5c5a', '#9a8f7a'];
const PANTS = ['#2e3440', '#3b3228', '#454545', '#28323c', '#4d4033', '#1f2a36'];

class Zombie {
  constructor(game, type, x, y, o = {}) {
    this.game = game;
    this.type = type;
    this.t = ZOMBIE_TYPES[type];
    const T = this.t;
    const rng = Math.random;
    this.skin = T.skin[Math.floor(rng() * T.skin.length)];
    this.shirt = o.shirt || SHIRTS[Math.floor(rng() * SHIRTS.length)];
    this.pants = PANTS[Math.floor(rng() * PANTS.length)];
    this.hp = T.hp;
    this.alive = true;
    this.phase = rng() * 10;
    this.dir = rng() < 0.5 ? -1 : 1;
    this.state = 'idle';
    this.idleTimer = rng() * 3;
    this.speedMul = 0.8 + rng() * 0.45;
    this.hurtT = 0;
    this.groanT = 2 + rng() * 8;
    this.hairStyle = Math.floor(rng() * 4);
    this.torn = rng() < 0.5;
    const w = T.w, h = T.h;
    this.body = game.world.add(new Body({
      x, y, shapes: [{ type: 'poly', verts: [[-w / 2, 0.05], [w / 2, 0.05], [w / 2, h], [-w / 2, h]] }],
      mass: T.mass, friction: 0.7, restitution: 0.0, fixedRotation: true,
      cat: CAT.ZOMBIE, mask: CAT.GROUND | CAT.CHASSIS | CAT.WHEEL | CAT.STATIC | CAT.PROP,
      buoyancy: T.swim ? 1.35 : 0.9, sampleDepth: 0.5, waterDragF: 2, waterDragN: 2,
      linDamp: 0.05, data: { kind: 'zombie', zombie: this }
    }));
    if (T.swim) this.body.samples = [{ x: 0, y: 0.1 }, { x: 0, y: 0.4 }, { x: 0, y: -0.2 }, { x: 0, y: -0.6 }];
    this.grab = 0;
  }

  update(h) {
    if (!this.alive) return;
    const G = this.game, b = this.body, T = this.t;
    const v = G.vehicle;
    this.hurtT = Math.max(0, this.hurtT - h);
    let dx = v ? v.x - b.x : 999;
    let adx = Math.abs(dx);
    if (v && adx < (T.runner ? 45 : 32) && Math.abs(v.y - b.y) < 20) this.state = 'chase';
    else if (this.state === 'chase' && adx > 50) this.state = 'idle';
    // живой человек рядом интереснее машины: мертвецы идут на анархистов
    let prey = null;
    if (G.raiders && G.raiders.length) {
      let bd = Math.min(12, adx);
      for (const r of G.raiders) {
        if (!r.alive) continue;
        const rd = Math.abs(r.body.x - b.x);
        if (rd < bd && Math.abs(r.body.y - b.y) < 3) { bd = rd; prey = r; }
      }
      if (prey) { dx = prey.body.x - b.x; adx = Math.abs(dx); this.state = 'chase'; if (adx < 0.9) prey.bite(h, this); }
    }

    const grounded = b.contactCount > 0 || (T.swim && b.submerged > 0.1);
    let targetV = 0;
    if (this.state === 'chase') {
      this.dir = dx > 0 ? 1 : -1;
      targetV = this.dir * T.speed * this.speedMul;
      if (adx < 0.6) targetV *= 0.2;
      this.groanT -= h;
      if (this.groanT < 0 && adx < 25) { this.groanT = 3 + Math.random() * 6; AUDIO.groan(clamp(-dx / 20, -1, 1)); }
    } else {
      this.idleTimer -= h;
      if (this.idleTimer < 0) { this.idleTimer = 2 + Math.random() * 4; this.wander = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); if (this.wander) this.dir = this.wander; }
      targetV = (this.wander || 0) * T.speed * 0.4;
    }
    if (grounded && b.contactCount >= 0) {
      const dv = targetV - b.vx;
      const acc = T.swim ? 3 : 10;
      b.vx += clamp(dv, -acc * h, acc * h);
      // перелезание через препятствия
      if (this.state === 'chase' && Math.abs(b.vx) < 0.2 && b.contactCount > 1 && !T.swim && Math.random() < 0.02) b.vy = 4.5;
    }
    this.phase += Math.abs(b.vx) * h * (T.runner ? 3.2 : 4.2) + h * 0.5;
    if (b.y < G.world.terrain.heightAt(b.x) - 6) this.remove();
    // зацеп за машину
    if (v && b.maxImpulseOther && b.maxImpulseOther.data && (b.maxImpulseOther.data.kind === 'vehicle' || b.maxImpulseOther.data.kind === 'wheel')) {
      this.grab = 0.4;
    }
    if (this.grab > 0 && v) {
      this.grab -= h;
      const c = v.chassis;
      const slow = T.mass * 1.8 * (1 - v.st.plow * 0.6);
      c.fx -= Math.sign(c.vx) * slow;
    }
  }

  hit(dmg, dirx, diry, force, cause) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtT = 0.15;
    this.game.particles.blood(this.body.x, this.body.y + 0.4, dirx * 4, diry * 4, 8);
    if (this.hp <= 0) this.kill(this.body.vx + dirx * (force || 8), this.body.vy + diry * (force || 8) + 2, cause || 'bullet');
    else { this.body.vx += dirx * 1.5; }
  }

  kill(vx, vy, cause) {
    if (!this.alive) return;
    this.alive = false;
    const G = this.game, b = this.body, T = this.t;
    G.world.remove(b);
    const cx = b.x, cy = b.y;
    const sc = T.scale;
    const speed = Math.hypot(vx, vy);
    if (T.bloat) {
      G.explode(cx, cy + 0.2, 1.0, 'bloater');
      G.particles.blood(cx, cy, vx, vy, 60, '#4f6b1f');
      G.particles.gore(cx, cy, vx, vy, this.skin);
    } else {
      const rag = new Ragdoll(G, cx, cy - T.h * 0.5 + 1.05 * sc, (Math.random() - 0.5) * 0.4, vx, vy, {
        skin: this.skin, shirt: this.shirt, pants: this.pants, scale: sc, fat: T.fat, helmet: T.helmet ? '#4a5438' : null,
        spin: -Math.sign(vx) * Math.min(12, speed * 0.6), brute: T.brute, hair: this.hairStyle,
        person: this.raider ? raiderLook(this) : zombieLook(this)
      });
      G.ragdolls.push(rag);
      G.particles.blood(cx, cy, vx, vy, Math.min(45, 12 + speed * 2));
      if (speed > 16 && Math.random() < 0.5) G.particles.gore(cx, cy, vx, vy, this.skin);
    }
    AUDIO.splat(clamp(speed / 20, 0.3, 1), clamp((cx - G.camX) / 20, -1, 1));
    G.onZombieKilled(this, cause);
  }

  remove() {
    if (this.alive) { this.alive = false; this.game.world.remove(this.body); }
    this.dead = true;
  }

  render(ctx, alpha) {
    if (!this.alive) return;
    const b = this.body, T = this.t;
    const x = b.ix(alpha), y = b.iy(alpha) - T.h / 2 - 0.02 + (T.swim ? -0.0 : 0);
    ctx.save();
    ctx.translate(x, y);
    const sc = T.scale;
    ctx.scale(this.dir * sc, sc);
    if (T.swim && b.submerged > 0.1) drawSwimmer(ctx, this, this.game.world.time);
    else drawZombieFigure(ctx, this, this.phase, this.state === 'chase', T);
    ctx.restore();
  }
}

// поза стоящего/идущего зомби. Координаты: ступни y=0, рост ~1.78, взгляд вправо
function drawZombieFigure(ctx, z, ph, chasing, T) {
  const L = zombieLook(z);
  const runner = !!T.runner || T.speed > 3;
  const gait = T.brute ? 'stomp' : (T.fat || T.bloat) ? 'waddle' : runner ? (chasing ? 'run' : 'walk') : (chasing ? 'shamble' : 'walk');
  const moving = Math.abs(z.body.vx) > 0.15;
  const P = gaitPose(moving ? gait : (chasing ? 'shamble' : 'stand'), ph, { amp: moving ? 1 : 0.15 });
  P.mood = { jaw: chasing ? 0.45 + 0.4 * Math.abs(Math.sin(ph * 2.3)) : 0.15, hurt: z.hurtT > 0, snarl: chasing };
  drawPerson(ctx, L, P);
  if (T.bloat) {
    // гнойные пузыри на раздутом животе
    const pulse = 1 + Math.sin(ph * 3) * 0.06;
    const bx = Math.sin(P.lean) * 0.3 + 0.2, by = P.hip[1] + 0.25;
    ctx.fillStyle = '#9cc15a'; ctx.beginPath(); ctx.ellipse(bx, by, 0.26 * pulse, 0.28 * pulse, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9e07a';
    for (const [px, py, r] of [[0.1, 0.08, 0.05], [0.18, -0.08, 0.04], [-0.02, -0.12, 0.035]]) { ctx.beginPath(); ctx.arc(bx + px, by + py, r * pulse, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawZombieHead(ctx, x, y, ang, skin, hair, helmet) {
  drawPersonHead(ctx, { zombie: true, skin, hair: helmet ? 'helmet' : ['sparse', 'messy', 'bald', 'long'][(hair || 0) % 4], hairColor: ['#2b2118', '#5a4a38', '#1a1a1a', '#6b6b6b'][(hair || 0) % 4] }, x, y, ang, { jaw: 0.6 });
}

function drawSwimmer(ctx, z, t) {
  const ph = z.phase;
  const L = zombieLook(z);
  // над водой — плечи, голова и загребающие руки (кроль вразнобой)
  const P = gaitPose('stand', 0, { amp: 0 });
  P.hip = [0, 0.25]; P.lean = 0.45 + Math.sin(ph * 0.6) * 0.08;
  const shx = Math.sin(P.lean) * 0.52, shy = 0.25 + Math.cos(P.lean) * 0.52;
  const a1 = ph * 1.2;
  P.hands = { F: [shx + Math.cos(a1) * 0.5, shy + Math.sin(a1) * 0.45], B: [shx + Math.cos(a1 + Math.PI) * 0.5, shy + Math.sin(a1 + Math.PI) * 0.45] };
  P.feet = { F: [0.1, -0.4], B: [-0.2, -0.35] };
  P.mood = { jaw: 0.6, hurt: z.hurtT > 0 };
  drawPerson(ctx, L, P);
}

/* ------------------------------ Рэгдолл ------------------------------ */

let _ragGroup = 100000;

class Ragdoll {
  constructor(game, x, y, ang, vx, vy, look) {
    this.game = game;
    this.look = look;
    this.group = _ragGroup++;
    this.parts = [];
    this.joints = [];
    this.age = 0;
    this.frozen = null;
    this.restT = 0;
    const s = look.scale || 1;
    const fat = look.fat ? 1.6 : 1;
    const W = game.world;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const cat = CAT.RAGDOLL;
    const mask = CAT.GROUND | CAT.STATIC | CAT.PROP | CAT.CHASSIS;
    const massK = (look.brute ? 6 : 1) * (look.fat ? 2.2 : 1);
    const mk = (name, shape, dx, dy, mass) => {
      const wx = x + cs * dx * s - sn * dy * s, wy = y + sn * dx * s + cs * dy * s;
      let sh;
      if (shape.r) sh = [{ type: 'circle', r: shape.r * s }];
      else sh = [{ type: 'poly', verts: shape.v.map(p => [p[0] * s, p[1] * s]) }];
      const b = W.add(new Body({
        x: wx, y: wy, angle: ang, shapes: sh, mass: mass * massK, friction: 0.7, restitution: 0.1,
        cat, mask, group: this.group, angDamp: 0.8, linDamp: 0.05, buoyancy: 1.05, sampleDepth: 0.15,
        waterDragF: 3, waterDragN: 3, data: { kind: 'ragdoll', ragdoll: this, part: name }
      }));
      const spin = look.spin || 0;
      b.vx = vx - spin * (wy - y) + (Math.random() - 0.5) * 1.5;
      b.vy = vy + spin * (wx - x) + (Math.random() - 0.5) * 1.5;
      b.w = spin * 0.5;
      b.part = name;
      this.parts.push(b);
      return b;
    };
    const tw = 0.18 * fat;
    const box = (w, h0, h1) => ({ v: [[-w, h0], [w, h0], [w, h1], [-w, h1]] });
    this.torso = mk('torso', { v: [[-tw, -0.22], [tw, -0.22], [tw * 0.9, 0.42], [-tw * 0.9, 0.42]] }, 0, 0, 30);
    this.head = mk('head', { r: 0.14 }, 0.02, 0.6, 5);
    this.armB = mk('armB', box(0.055, -0.6, 0), 0, 0.36, 4);
    this.thighB = mk('thighB', box(0.075, -0.45, 0), 0, -0.18, 8);
    this.shinB = mk('shinB', box(0.065, -0.45, 0), 0, -0.63, 5);
    this.thighF = mk('thighF', box(0.075, -0.45, 0), 0, -0.18, 8);
    this.shinF = mk('shinF', box(0.065, -0.45, 0), 0, -0.63, 5);
    this.armF = mk('armF', box(0.055, -0.6, 0), 0, 0.36, 4);
    const J = (a, b, dx, dy, lo, hi, brk) => {
      const wx = x + cs * dx * s - sn * dy * s, wy = y + sn * dx * s + cs * dy * s;
      const j = new RevoluteJoint(a, b, wx, wy, { lower: lo, upper: hi, breakImpulse: brk * massK, softness: 0 });
      j.onBreak = (jj) => this.onBreak(jj);
      j.part = b.part;
      W.addJoint(j);
      this.joints.push(j);
      return j;
    };
    const brk = look.human ? 1e9 : 95;
    J(this.torso, this.head, 0, 0.44, -0.7, 0.5, brk * 0.8);
    J(this.torso, this.armB, 0, 0.36, -3, 3, brk);
    J(this.torso, this.armF, 0, 0.36, -3, 3, brk);
    J(this.torso, this.thighB, 0, -0.18, -0.6, 2.0, brk * 1.3);
    J(this.torso, this.thighF, 0, -0.18, -0.6, 2.0, brk * 1.3);
    J(this.thighB, this.shinB, 0, -0.63, -2.4, 0.05, brk * 1.3);
    J(this.thighF, this.shinF, 0, -0.63, -2.4, 0.05, brk * 1.3);
    this.torn = {};
  }

  onBreak(j) {
    const p = { x: j.b.x, y: j.b.y };
    this.torn[j.part] = true;
    this.game.particles.blood(p.x, p.y, j.b.vx, j.b.vy, 18);
    AUDIO.splat(0.4);
  }

  get x() { return this.frozen ? this.frozen.x : this.torso.x; }

  update(h) {
    if (this.frozen) return;
    this.age += h;
    let maxV = 0;
    for (const p of this.parts) maxV = Math.max(maxV, Math.abs(p.vx) + Math.abs(p.vy));
    if (maxV < 0.25) this.restT += h; else this.restT = 0;
    // кровь из оторванных частей
    if (Object.keys(this.torn).length && Math.random() < 0.3 && this.age < 3) {
      const p = this.torso;
      this.game.particles.blood(p.x, p.y + 0.3, p.vx, p.vy + 2, 1);
    }
    const T = this.game.world.terrain;
    if (this.restT > 1.5 && this.age > 2.5) this.freeze();
    else if (this.torso.y < T.heightAt(this.torso.x) - 8) this.freeze();
  }

  freeze() {
    const W = this.game.world;
    this.frozen = { x: this.torso.x, parts: this.parts.map(p => ({ part: p.part, x: p.x, y: p.y, a: p.a, com: p.com, shapes: p.shapes })) };
    for (const p of this.parts) W.remove(p);
    for (const j of this.joints) W.removeJoint(j);
  }

  remove() {
    if (!this.frozen) this.freeze();
    this.dead = true;
  }

  render(ctx, alpha) {
    const L = this.look, s = L.scale || 1, fat = L.fat ? 1.6 : 1;
    const PL = L.person;
    const skin = PL ? PL.skin : L.skin, shirt = PL ? PL.topColor : (L.shirt || L.jacket || '#444'), pants = PL ? PL.pants : (L.pants || '#2c3440');
    const get = (name) => {
      if (this.frozen) { const f = this.frozen.parts.find(p => p.part === name); return { x: f.x, y: f.y, a: f.a }; }
      const b = this[name];
      return { x: b.ix(alpha), y: b.iy(alpha), a: b.ia(alpha) };
    };
    const seg = (name, len, w, col, endCol) => {
      const p = get(name);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      // тело смещено по центру масс: сегменты от 0 до -len, центр масс в -len/2
      ctx.translate(0, len * s / 2);
      limb(ctx, 0, 0, 0, -len * s, w * s, col);
      if (endCol) { ctx.fillStyle = endCol; ctx.beginPath(); ctx.arc(0, -len * s, w * s * 0.6, 0, Math.PI * 2); ctx.fill(); }
      if (this.torn[name]) { ctx.fillStyle = '#7a0b0b'; ctx.beginPath(); ctx.arc(0, 0, w * s * 0.55, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    };
    seg('armB', 0.6, 0.12, shade(shirt, -0.35), shade(skin, -0.3));
    seg('thighB', 0.45, 0.15 * (L.fat ? 1.3 : 1), shade(pants, -0.35));
    seg('shinB', 0.45, 0.13, shade(pants, -0.35), '#1a1612');
    seg('thighF', 0.45, 0.15 * (L.fat ? 1.3 : 1), pants);
    seg('shinF', 0.45, 0.13, pants, '#2b241d');
    // торс
    {
      const p = get('torso');
      const body = this.frozen ? this.frozen.parts.find(q => q.part === 'torso') : this.torso;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.translate(-body.com.x, -body.com.y);
      const tw = 0.2 * fat * s;
      ctx.fillStyle = PL ? PL.topColor : L.human ? (L.jacket || '#3a3f47') : shirt;
      ctx.beginPath();
      ctx.moveTo(-tw, -0.24 * s); ctx.lineTo(tw, -0.24 * s); ctx.quadraticCurveTo(tw * 1.2, 0.1 * s, tw * 0.9, 0.44 * s); ctx.lineTo(-tw * 0.9, 0.44 * s); ctx.quadraticCurveTo(-tw * 1.15, 0.1 * s, -tw, -0.24 * s);
      ctx.fill();
      if (L.helmet && !L.human) { ctx.fillStyle = '#4a5438'; ctx.fillRect(-tw, -0.1 * s, tw * 2, 0.45 * s); }
      ctx.restore();
    }
    // голова
    if (!this.torn.head || true) {
      const p = get('head');
      if (PL) drawPersonHead(ctx, PL, p.x, p.y - 0.02, p.a - Math.PI / 2 + 1.57, { jaw: PL.zombie ? 0.7 : 0.2, blink: !PL.zombie });
      else if (L.human) drawHelmetHead(ctx, p.x, p.y, 0.16 * s, p.a, L.helmet || '#c33', '#223');
      else drawZombieHead(ctx, p.x, p.y - 0.02, p.a, skin, L.hair || 0, !!L.helmet);
    }
    seg('armF', 0.6, 0.12, shirt, skin);
  }
}
