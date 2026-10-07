'use strict';
/* Новые объекты трасс: верхние ярусы, брёвна, огонь, обрушивающиеся плиты, вагон, бон, кран */

// толщина плиты и шаг опор для каждого стиля яруса
const PLATFORM_STYLE = {
  roof: { th: 0.6, leg: 9 },
  overpass: { th: 1.2, leg: 22 },
  pipe: { th: 1.4, leg: 12 },
  trailer: { th: 2.0, leg: 7 },
  saloon: { th: 0.6, leg: 7 },
  station: { th: 0.8, leg: 10 },
  log: { th: 0.8, leg: 26 },
  gantry: { th: 1.0, leg: 26 },
  bunker: { th: 1.4, leg: 14 },
  container: { th: 2.5, leg: 6 },
  crane: { th: 0.9, leg: 999 },
  dam: { th: 1.2, leg: 999 }
};

class Platform extends Prop {
  constructor(game, x1, x2, top, style, o = {}) {
    const st = PLATFORM_STYLE[style] || PLATFORM_STYLE.roof;
    const th = o.th || st.th;
    const verts = [[x1, top - th], [x2, top - th], [x2, top], [x1, top]];
    const b = game.world.add(new Body({ x: 0, y: 0, shapes: [{ type: 'poly', verts }], isStatic: true, friction: style === 'log' ? 0.75 : 0.9, cat: CAT.STATIC }));
    super(game, 'platform', b, o);
    this.x1 = x1; this.x2 = x2; this.top = top; this.th = th; this.style = style;
    this.minX = x1; this.maxX = x2;
    this.seed = Math.floor(Math.abs(x1 * 13.7)) % 997;
    this.legs = [];
    if (st.leg < 900) {
      const n = Math.max(1, Math.round((x2 - x1) / st.leg));
      for (let i = 0; i < n; i++) this.legs.push(x1 + (x2 - x1) * (i + 0.5) / n);
    }
    this.legs.push(...(o.extraLegs || []));
  }
  get x() { return this.x2; }

  _groundAt(lx) {
    const W = this.game.world;
    return W.terrain.heightAt(lx);
  }

  render(ctx) {
    const { x1, x2, top, th, style } = this;
    const bot = top - th, w = x2 - x1;
    const night = this.game.app && this.game.app.renderer && this.game.app.renderer.night;
    const dim = (c) => night ? mix(c, '#07080c', 0.4) : c;
    // опоры (позади плиты)
    for (const lx of this.legs) {
      const gy = this._groundAt(lx);
      if (gy >= bot - 0.05) continue;
      switch (style) {
        case 'overpass': case 'bunker': ctx.fillStyle = dim('#8f8b82'); ctx.fillRect(lx - 0.9, gy - 0.3, 1.8, bot - gy + 0.3); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(lx + 0.3, gy - 0.3, 0.6, bot - gy + 0.3); break;
        case 'pipe': ctx.strokeStyle = dim('#5b5f63'); ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(lx - 1.2, gy); ctx.lineTo(lx, bot); ctx.lineTo(lx + 1.2, gy); ctx.stroke(); break;
        case 'trailer': {
          // опора из сплющенных машин
          const col = ['#6b7078', '#7a3b2e', '#3e5566', '#8c7a4a'];
          let yy = gy - 0.2, k = 0;
          while (yy < bot - 0.1) { const hh = Math.min(0.75, bot - yy); ctx.fillStyle = dim(col[(k + this.seed) % 4]); ctx.fillRect(lx - 1.5, yy, 3, hh - 0.05); yy += 0.75; k++; }
          break;
        }
        case 'saloon': case 'station': case 'roof': ctx.fillStyle = dim(style === 'roof' ? '#6d5a48' : '#4a3018'); ctx.fillRect(lx - 0.15, gy - 0.3, 0.3, bot - gy + 0.3); break;
        case 'log': ctx.fillStyle = dim('#4a3a2a'); ctx.fillRect(lx - 0.35, gy - 0.3, 0.7, bot - gy + 0.3); break;
        case 'gantry': case 'container': {
          ctx.strokeStyle = dim('#59636a'); ctx.lineWidth = 0.14;
          ctx.beginPath(); ctx.moveTo(lx - 0.5, gy); ctx.lineTo(lx - 0.5, bot); ctx.moveTo(lx + 0.5, gy); ctx.lineTo(lx + 0.5, bot);
          for (let yy = gy; yy < bot - 0.8; yy += 1.4) { ctx.moveTo(lx - 0.5, yy); ctx.lineTo(lx + 0.5, yy + 1.4); }
          ctx.stroke(); break;
        }
      }
    }
    // плита
    switch (style) {
      case 'roof': {
        ctx.fillStyle = dim('#7a4a32'); ctx.fillRect(x1, bot, w, th);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.06;
        for (let x = x1 + 0.3; x < x2; x += 0.6) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.stroke(); }
        ctx.fillStyle = dim('#a06a4a'); ctx.fillRect(x1, top - 0.08, w, 0.08);
        break;
      }
      case 'overpass': {
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, dim('#a8a49b')); g.addColorStop(1, dim('#6f6b63'));
        ctx.fillStyle = g; ctx.fillRect(x1, bot, w, th);
        ctx.fillStyle = dim('#4a4a4e'); ctx.fillRect(x1, top - 0.15, w, 0.15);
        ctx.strokeStyle = dim('#9aa0a6'); ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.moveTo(x1, top + 0.7); ctx.lineTo(x2, top + 0.7); ctx.stroke();
        for (let x = x1 + 1; x < x2; x += 2.5) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + 0.7); ctx.stroke(); }
        ctx.setLineDash([1.5, 1.5]); ctx.strokeStyle = 'rgba(230,220,170,0.45)'; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(x1, top - 0.08); ctx.lineTo(x2, top - 0.08); ctx.stroke(); ctx.setLineDash([]);
        break;
      }
      case 'pipe': {
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, dim('#9aa0a4')); g.addColorStop(0.45, dim('#c2c6c8')); g.addColorStop(1, dim('#4d5256'));
        ctx.fillStyle = g; roundRect(ctx, x1, bot, w, th, th / 2); ctx.fill();
        ctx.fillStyle = 'rgba(90,50,20,0.35)';
        for (let x = x1 + 3; x < x2; x += 6) ctx.fillRect(x, bot, 0.35, th);
        break;
      }
      case 'trailer': {
        const col = ['#dfe3e6', '#3e6ea0', '#b53a2a'][this.seed % 3];
        ctx.fillStyle = dim(col); ctx.fillRect(x1, bot, w, th);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.05;
        for (let x = x1 + 12; x < x2; x += 12) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x1, bot + th * 0.45, w, 0.25);
        break;
      }
      case 'saloon': case 'station': {
        ctx.fillStyle = dim(style === 'station' ? '#6e3a2e' : '#7a5a3a'); ctx.fillRect(x1, bot, w, th);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.04;
        for (let x = x1 + 0.5; x < x2; x += 0.9) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.stroke(); }
        ctx.fillStyle = dim('#3a2616'); ctx.fillRect(x1, top - 0.1, w, 0.1);
        break;
      }
      case 'log': {
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, dim('#7a5a3a')); g.addColorStop(1, dim('#3e2c1c'));
        ctx.fillStyle = g; roundRect(ctx, x1, bot, w, th, th / 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.05;
        for (let x = x1 + 2; x < x2; x += 3.5) { ctx.beginPath(); ctx.moveTo(x, bot + 0.2); ctx.lineTo(x + 1.6, bot + 0.5); ctx.stroke(); }
        ctx.fillStyle = dim('#b08a5a'); ctx.beginPath(); ctx.ellipse(x2, bot + th / 2, 0.15, th / 2, 0, 0, Math.PI * 2); ctx.fill();
        // корни в начале ствола
        ctx.strokeStyle = dim('#4a3a2a'); ctx.lineWidth = 0.18;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x1 + 0.2, bot + th / 2); ctx.lineTo(x1 - 1.2, bot + th / 2 + (i - 2) * 0.6); ctx.stroke(); }
        break;
      }
      case 'gantry': case 'crane': {
        ctx.fillStyle = dim('#c9a13a'); ctx.fillRect(x1, top - 0.2, w, 0.2); ctx.fillRect(x1, bot, w, 0.2);
        ctx.strokeStyle = dim('#a8842a'); ctx.lineWidth = 0.12;
        ctx.beginPath();
        for (let x = x1; x < x2; x += 1.2) { ctx.moveTo(x, bot + 0.2); ctx.lineTo(x + 0.6, top - 0.2); ctx.lineTo(x + 1.2, bot + 0.2); }
        ctx.stroke();
        if (style === 'crane') {
          ctx.strokeStyle = dim('#8a6e24'); ctx.lineWidth = 0.35;
          ctx.beginPath(); ctx.moveTo(x2 + 1.5, -6); ctx.lineTo(x2 + 1.5, top + 6); ctx.lineTo(x1 - 4, top + 0.2); ctx.stroke();
          ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x1 + w * 0.3, bot); ctx.lineTo(x1 + w * 0.3, bot - 1.2); ctx.stroke();
        }
        break;
      }
      case 'bunker': {
        ctx.fillStyle = dim('#7d7b6a'); ctx.fillRect(x1, bot, w, th);
        ctx.fillStyle = dim('#5d6a45');
        for (let i = 0; i < w / 3; i++) { ctx.beginPath(); ctx.ellipse(x1 + 1.5 + i * 3, bot + th * (0.3 + (i % 2) * 0.4), 1.1, 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#111'; ctx.fillRect(x1 + 2, bot + th * 0.45, w - 4, 0.12);
        break;
      }
      case 'container': {
        const cols = ['#a33b27', '#2f6b8f', '#c9922a', '#3f7a45', '#6b4a8a'];
        for (let x = x1, i = 0; x < x2 - 0.1; x += 6.1, i++) {
          const cw = Math.min(6, x2 - x);
          const c = dim(cols[(i + this.seed) % cols.length]);
          const g = ctx.createLinearGradient(0, top, 0, bot);
          g.addColorStop(0, shade(c, 0.15)); g.addColorStop(1, shade(c, -0.35));
          ctx.fillStyle = g; ctx.fillRect(x, bot, cw, th);
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.05;
          for (let xx = x + 0.3; xx < x + cw; xx += 0.3) { ctx.beginPath(); ctx.moveTo(xx, bot + 0.1); ctx.lineTo(xx, top - 0.1); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.08; ctx.strokeRect(x, bot, cw, th);
        }
        break;
      }
      case 'dam': {
        ctx.fillStyle = dim('#8c8a84'); ctx.fillRect(x1, bot, w, th);
        ctx.fillStyle = dim('#5d5b56'); ctx.fillRect(x1, top - 0.12, w, 0.12);
        break;
      }
    }
  }
}

// тяжёлые брёвна поперёк дороги
class LogPile extends Prop {
  constructor(game, x, y) {
    const W = game.world;
    super(game, 'logs', null, { x });
    this.bodies = [];
    const log = (lx, ly) => {
      const b = W.add(new Body({ x: lx, y: ly, shapes: [{ type: 'poly', verts: [[-2.1, -0.28], [2.1, -0.28], [2.25, 0], [2.1, 0.28], [-2.1, 0.28], [-2.25, 0]] }], mass: 240, friction: 0.8, cat: CAT.PROP, buoyancy: 1.6, angDamp: 0.4 }));
      b.data = { kind: 'prop', prop: this };
      this.bodies.push(b);
    };
    log(x, y + 0.3); log(x + 0.2, y + 0.9);
    this.px = x;
    this.spawnX = x;
    this.crushDist = 12;
  }
  get x() { return this.bodies[0].removed ? this.px : this.bodies[0].x; }
  render(ctx, alpha) {
    for (const b of this.bodies) {
      if (b.removed) continue;
      ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha));
      const g = ctx.createLinearGradient(0, 0.28, 0, -0.28);
      g.addColorStop(0, '#7a5a3a'); g.addColorStop(1, '#3e2c1c');
      ctx.fillStyle = g; roundRect(ctx, -2.25, -0.28, 4.5, 0.56, 0.28); ctx.fill();
      ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.ellipse(2.2, 0, 0.08, 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// зона огня: поджигает транспорт и сжигает зомби
class FireZone extends Prop {
  constructor(game, x1, x2, y) {
    super(game, 'fire', null, { x: x1 });
    this.x1 = x1; this.x2 = x2; this.y = y;
    this.t = Math.random() * 3;
  }
  get x() { return this.x2; }
  update(h) {
    this.t += h;
    const G = this.game, P = G.particles;
    const water = G.world.water;
    const y = water ? water.height((this.x1 + this.x2) / 2, G.world.time) : this.y;
    if (Math.random() < 0.9 * P.quality) P.fire(lerp(this.x1, this.x2, Math.random()), y + 0.1, 0, 0.5, 1, 1.1);
    if (Math.random() < 0.15 * P.quality) P.smoke(lerp(this.x1, this.x2, Math.random()), y + 1.5, 0.3, 1.5, 1, 0.9, 1.6);
    if (Math.random() < 0.2) P.lights.push({ x: (this.x1 + this.x2) / 2, y: y + 1, r: 9, age: 0, life: 0.12, color: 'rgba(255,140,50,' });
    const v = G.vehicle;
    if (v) {
      const bb = v.chassis.aabb;
      if (bb.maxX > this.x1 && bb.minX < this.x2 && bb.minY < y + 2.2 && bb.maxY > y - 1) v.burnT = 2.5;
    }
    for (const z of G.zombies) {
      if (!z.alive) continue;
      const b = z.body;
      if (b.x > this.x1 && b.x < this.x2 && Math.abs(b.y - y) < 2.5) z.kill(0, 3, 'fire');
    }
  }
  render(ctx) {
    const water = this.game.world.water;
    const y = water ? water.height((this.x1 + this.x2) / 2, this.game.world.time) : this.y;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y + 2, 0, y);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(1, `rgba(255,140,40,${0.35 + Math.sin(this.t * 9) * 0.08})`);
    ctx.fillStyle = g; ctx.fillRect(this.x1 - 0.5, y, this.x2 - this.x1 + 1, 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(this.x1, y - 0.05, this.x2 - this.x1, 0.12);
  }
}

// плита гребня плотины: падает через ~0.9 с после наезда
class CollapseSlab extends Prop {
  constructor(game, x1, x2, top) {
    const th = 1.2;
    const b = game.world.add(new Body({ x: 0, y: 0, shapes: [{ type: 'poly', verts: [[x1, top - th], [x2, top - th], [x2, top], [x1, top]] }], mass: 900, friction: 0.9, cat: CAT.STATIC, buoyancy: 0 }));
    super(game, 'slab', b, {});
    this.saved = { invMass: b.invMass, invI: b.invI };
    b.isStatic = true; b.invMass = 0; b.invI = 0;
    this.x1 = x1; this.x2 = x2; this.top = top;
    this.minX = x1; this.maxX = x2;
    this.timer = -1; this.falling = false; this.fallT = 0;
  }
  get x() { return this.x2 + 20; }
  update(h) {
    const b = this.body, G = this.game;
    if (!this.falling) {
      const v = G.vehicle;
      if (this.timer < 0 && v) {
        for (const vb of v.bodies) {
          if (vb.x > this.x1 - 0.5 && vb.x < this.x2 + 0.5 && vb.y > this.top - 0.5 && vb.y < this.top + 3) { this.timer = 0.9; AUDIO.impact(0.25); G.shake(0.05); break; }
        }
      }
      if (this.timer >= 0) {
        this.timer -= h;
        if (Math.random() < 0.3) G.particles.dust(lerp(this.x1, this.x2, Math.random()), this.top - 1.2, 0, -1, 1, 'rgba(140,140,130,');
        if (this.timer < 0) {
          this.falling = true;
          b.isStatic = false; b.invMass = this.saved.invMass; b.invI = this.saved.invI;
          b.vy = -1; b.w = (Math.random() - 0.5) * 0.6;
          AUDIO.impact(0.7);
          G.particles.dust((this.x1 + this.x2) / 2, this.top - 1, 0, -2, 8, 'rgba(140,140,130,');
        }
      }
    } else {
      this.fallT += h;
      if (b.y < G.world.terrain.heightAt(b.x) - 3 || this.fallT > 8) this.remove();
    }
  }
  render(ctx, alpha) {
    const b = this.body;
    ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha)); ctx.translate(-b.com.x, -b.com.y);
    const shakeX = this.timer > 0 ? (Math.random() - 0.5) * 0.06 : 0;
    ctx.translate(shakeX, 0);
    const w = this.x2 - this.x1;
    const g = ctx.createLinearGradient(0, this.top, 0, this.top - 1.2);
    g.addColorStop(0, '#9a978f'); g.addColorStop(1, '#6a6862');
    ctx.fillStyle = g; ctx.fillRect(this.x1, this.top - 1.2, w, 1.2);
    ctx.fillStyle = '#5d5b56'; ctx.fillRect(this.x1, this.top - 0.12, w, 0.12);
    ctx.strokeStyle = 'rgba(230,220,170,0.5)'; ctx.lineWidth = 0.06; ctx.setLineDash([1.2, 1.2]);
    ctx.beginPath(); ctx.moveTo(this.x1, this.top - 0.3); ctx.lineTo(this.x2, this.top - 0.3); ctx.stroke(); ctx.setLineDash([]);
    if (this.timer >= 0 || this.falling) {
      ctx.strokeStyle = '#2a2a28'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(this.x1 + w * 0.3, this.top); ctx.lineTo(this.x1 + w * 0.4, this.top - 0.5); ctx.lineTo(this.x1 + w * 0.35, this.top - 1.2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.05; ctx.strokeRect(this.x1, this.top - 1.2, w, 1.2);
    ctx.restore();
  }
}

// сошедший с рельсов вагон / бон — статичные преграды
class Obstacle extends Prop {
  constructor(game, verts, style) {
    const b = game.world.add(new Body({ x: 0, y: 0, shapes: [{ type: 'poly', verts }], isStatic: true, friction: 0.7, cat: CAT.STATIC }));
    super(game, 'obstacle', b, {});
    this.verts = verts; this.style = style;
    this.minX = Math.min(...verts.map(v => v[0])); this.maxX = Math.max(...verts.map(v => v[0]));
    this.minY = Math.min(...verts.map(v => v[1])); this.maxY = Math.max(...verts.map(v => v[1]));
  }
  get x() { return this.maxX; }
  render(ctx) {
    const { minX, maxX, minY, maxY } = this;
    const w = maxX - minX, h = maxY - minY;
    if (this.style === 'wagon') {
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(minX, minY + 0.6, w, h - 0.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.06;
      for (let x = minX + 0.5; x < maxX; x += 0.8) { ctx.beginPath(); ctx.moveTo(x, minY + 0.6); ctx.lineTo(x, maxY); ctx.stroke(); }
      ctx.fillStyle = '#4a2a1e'; ctx.fillRect(minX - 0.2, maxY - 0.2, w + 0.4, 0.3);
      ctx.fillStyle = '#222';
      for (const wx of [minX + 1.4, minX + 2.6, maxX - 2.6, maxX - 1.4]) { ctx.beginPath(); ctx.arc(wx, minY + 0.5, 0.45, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e0d0a0'; ctx.fillRect(minX + w / 2 - 1.2, minY + 1.4, 2.4, 1);
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(minX + w / 2 - 1.1, minY + 1.5, 2.2, 0.8);
    } else if (this.style === 'boom') {
      ctx.fillStyle = '#d65a22'; roundRect(ctx, minX, maxY - 0.9, w, 0.9, 0.3); ctx.fill();
      ctx.fillStyle = '#eee'; ctx.fillRect(minX + 0.2, maxY - 0.6, w - 0.4, 0.2);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(minX + w / 2 - 0.15, minY, 0.3, h - 0.9);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.05;
      for (let yy = minY; yy < maxY - 0.9; yy += 0.4) { ctx.beginPath(); ctx.moveTo(minX, yy); ctx.lineTo(maxX, yy + 0.4); ctx.stroke(); }
    }
  }
}
