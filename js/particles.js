'use strict';
/* Частицы: пыль, кровь, искры, огонь, дым, брызги, щепки, гильзы, дождь; декали крови; всплывающий текст */

class Particles {
  constructor(max = 2500) {
    this.max = max;
    this.list = [];
    this.decals = [];     // пятна на земле
    this.texts = [];      // всплывающие надписи
    this.lights = [];     // вспышки света (для ночи)
    this.quality = 1;
  }
  clear() { this.list.length = 0; this.decals.length = 0; this.texts.length = 0; this.lights.length = 0; }

  add(p) {
    if (this.list.length >= this.max * this.quality) this.list.shift();
    p.age = 0;
    p.life = p.life || 1;
    p.vx = p.vx || 0; p.vy = p.vy || 0;
    p.g = p.g !== undefined ? p.g : -9;
    p.drag = p.drag || 0;
    p.size = p.size || 0.1;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    this.list.push(p);
    return p;
  }

  update(dt, world) {
    const T = world && world.terrain, W = world && world.water;
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.g * dt;
      if (p.drag) { const k = 1 / (1 + p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.collide && T) {
        const gy = T.heightAt(p.x);
        if (p.y < gy) {
          if (p.type === 'blood' && p.decal && Math.random() < 0.5 && this.decals.length < 900) {
            this.decals.push({ x: p.x, y: gy, r: p.size * (1.5 + Math.random() * 2.5), c: p.color, a: 0.8 });
          }
          if (p.stick) { p.y = gy; p.vx = 0; p.vy = 0; p.g = 0; }
          else if (p.bounce) { p.y = gy; p.vy = -p.vy * p.bounce; p.vx *= 0.6; p.vr *= 0.6; }
          else { p.age = p.life; continue; }
        }
      }
      if (p.water && W) {
        const wy = W.height(p.x, world.time);
        if (p.y < wy && p.type !== 'bubble') {
          if (p.type === 'spray' || p.type === 'blood') { p.age = p.life; continue; }
          p.vy *= 0.9; p.vx *= 0.95;
          if (p.type === 'debris') { p.vy += 12 * dt; }
        }
        if (p.type === 'bubble' && p.y > wy) { p.age = p.life; continue; }
      }
      this.list[w++] = p;
    }
    this.list.length = w;
    let tw = 0;
    for (const t of this.texts) {
      t.age += dt;
      if (t.age < t.life) { t.y += t.vy * dt; t.vy *= 0.97; this.texts[tw++] = t; }
    }
    this.texts.length = tw;
    let lw = 0;
    for (const l of this.lights) { l.age += dt; if (l.age < l.life) this.lights[lw++] = l; }
    this.lights.length = lw;
  }

  // ---------- эмиттеры ----------
  dust(x, y, vx, vy, n = 3, color = 'rgba(150,130,100,') {
    for (let i = 0; i < n * this.quality; i++) {
      this.add({
        type: 'smoke', x: x + (Math.random() - 0.5) * 0.3, y: y + Math.random() * 0.2,
        vx: vx * 0.3 + (Math.random() - 0.5) * 2, vy: vy * 0.2 + Math.random() * 1.5,
        g: 0.5, drag: 2, life: 0.8 + Math.random() * 0.8, size: 0.25 + Math.random() * 0.35, grow: 1.6,
        color, alpha: 0.45
      });
    }
  }
  blood(x, y, vx, vy, n = 20, color = '#6b0d0d') {
    for (let i = 0; i < n * this.quality; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 7;
      this.add({
        type: 'blood', x, y, vx: vx * 0.4 + Math.cos(a) * s, vy: vy * 0.3 + Math.sin(a) * s + 2,
        g: -15, life: 0.8 + Math.random() * 0.8, size: 0.04 + Math.random() * 0.09,
        color: Math.random() < 0.5 ? color : '#8a1414', collide: true, decal: true, water: true
      });
    }
    for (let i = 0; i < 3 * this.quality; i++) {
      this.add({ type: 'mist', x, y, vx: vx * 0.2 + (Math.random() - 0.5) * 2, vy: vy * 0.1 + Math.random(), g: 0, drag: 3, life: 0.45, size: 0.15 + Math.random() * 0.2, grow: 1.2, color: 'rgba(110,10,10,', alpha: 0.25 });
    }
  }
  gore(x, y, vx, vy, skin) {
    for (let i = 0; i < 6 * this.quality; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
      this.add({
        type: 'chunk', x, y, vx: vx * 0.5 + Math.cos(a) * s, vy: vy * 0.4 + Math.abs(Math.sin(a)) * s + 2,
        g: -15, life: 3 + Math.random() * 2, size: 0.07 + Math.random() * 0.1, vr: (Math.random() - 0.5) * 20,
        color: Math.random() < 0.5 ? skin : '#5a0a0a', collide: true, bounce: 0.3, fade: 0.5, water: true
      });
    }
  }
  sparks(x, y, nx, ny, n = 10) {
    for (let i = 0; i < n * this.quality; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.2, s = 4 + Math.random() * 10;
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -12, life: 0.2 + Math.random() * 0.35, size: 0.04, collide: true, bounce: 0.4 });
    }
  }
  splinters(x, y, vx, vy, n = 12, color = '#8a5a2b') {
    for (let i = 0; i < n * this.quality; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
      this.add({ type: 'chunk', rect: true, x, y, vx: vx * 0.5 + Math.cos(a) * s, vy: vy * 0.3 + Math.abs(Math.sin(a)) * s, g: -15, life: 2 + Math.random() * 2, size: 0.05 + Math.random() * 0.12, vr: (Math.random() - 0.5) * 30, color, collide: true, bounce: 0.3, fade: 0.6, water: true });
    }
  }
  fire(x, y, vx, vy, n = 2, scale = 1) {
    for (let i = 0; i < n * this.quality; i++) {
      this.add({ type: 'fire', x: x + (Math.random() - 0.5) * 0.3 * scale, y, vx: vx + (Math.random() - 0.5) * scale, vy: vy + 1 + Math.random() * 2 * scale, g: 3, drag: 1.5, life: 0.3 + Math.random() * 0.5, size: (0.2 + Math.random() * 0.3) * scale, grow: -0.5 });
    }
  }
  smoke(x, y, vx, vy, n = 1, dark = 0.2, scale = 1) {
    for (let i = 0; i < n * this.quality; i++) {
      const c = Math.floor(40 + (1 - dark) * 120);
      this.add({ type: 'smoke', x, y, vx: vx + (Math.random() - 0.5) * 0.8, vy: vy + 0.5 + Math.random(), g: 1.2, drag: 1.2, life: 1.2 + Math.random() * 1.5, size: (0.3 + Math.random() * 0.3) * scale, grow: 2.2, color: `rgba(${c},${c},${c},`, alpha: 0.5 });
    }
  }
  explosion(x, y, power = 1) {
    const q = this.quality;
    for (let i = 0; i < 30 * power * q; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 10 * power;
      this.add({ type: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 2, g: 2, drag: 3, life: 0.4 + Math.random() * 0.6, size: 0.5 + Math.random() * 0.9 * power, grow: -0.3 });
    }
    for (let i = 0; i < 18 * power * q; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 6 * power;
      this.add({ type: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1.5, g: 1.5, drag: 1.8, life: 2 + Math.random() * 2, size: 0.8 + Math.random() * power, grow: 2, color: 'rgba(45,40,38,', alpha: 0.65, delay: 0.1 });
    }
    this.sparks(x, y, 0, 1, 25 * power);
    for (let i = 0; i < 10 * q; i++) {
      const a = Math.random() * Math.PI, s = 6 + Math.random() * 12;
      this.add({ type: 'chunk', rect: true, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -15, life: 2.5, size: 0.08 + Math.random() * 0.12, vr: (Math.random() - 0.5) * 30, color: '#2a2622', collide: true, bounce: 0.3, fade: 0.5 });
    }
    this.add({ type: 'shock', x, y, life: 0.35, size: 6 * power, g: 0 });
    this.lights.push({ x, y, r: 16 * power, age: 0, life: 0.6, color: 'rgba(255,170,60,' });
  }
  splash(x, y, vx, strength = 1) {
    const q = this.quality;
    const n = Math.min(60, 8 + strength * 18);
    for (let i = 0; i < n * q; i++) {
      const s = Math.random() * 4 * strength + 1;
      this.add({ type: 'spray', x: x + (Math.random() - 0.5) * strength, y, vx: vx * 0.4 + (Math.random() - 0.5) * 5 * strength, vy: 2 + s * 1.8, g: -15, life: 0.9 + Math.random() * 0.6, size: 0.05 + Math.random() * 0.12, water: true });
    }
    for (let i = 0; i < 4 * q; i++) {
      this.add({ type: 'foam', x: x + (Math.random() - 0.5) * 2 * strength, y: y + 0.05, vx: vx * 0.1, vy: 0, g: 0, drag: 1, life: 1.5 + Math.random(), size: 0.4 + Math.random() * 0.6 * strength, grow: 1 });
    }
  }
  wake(x, y, vx) {
    this.add({ type: 'spray', x, y, vx: -vx * 0.2 + (Math.random() - 0.5), vy: 1.5 + Math.random() * 3, g: -15, life: 0.6, size: 0.05 + Math.random() * 0.08, water: true });
    if (Math.random() < 0.3) this.add({ type: 'foam', x, y: y + 0.03, vx: 0, vy: 0, g: 0, life: 1.2, size: 0.3 + Math.random() * 0.4, grow: 1.2 });
  }
  bubbles(x, y, n = 3) {
    for (let i = 0; i < n * this.quality; i++) this.add({ type: 'bubble', x: x + (Math.random() - 0.5) * 0.5, y, vx: 0, vy: 1 + Math.random() * 1.5, g: 1, life: 2, size: 0.04 + Math.random() * 0.06, water: true });
  }
  muzzle(x, y, ang) {
    this.add({ type: 'flash', x, y, rot: ang, life: 0.06, size: 0.6, g: 0 });
    this.lights.push({ x, y, r: 5, age: 0, life: 0.08, color: 'rgba(255,220,120,' });
    this.add({ type: 'shell', rect: true, x, y, vx: -Math.cos(ang) * 1.5 + (Math.random() - 0.5), vy: 3 + Math.random() * 2, g: -15, life: 1.5, size: 0.04, vr: 25, color: '#c9a03a', collide: true, bounce: 0.4 });
    this.smoke(x + Math.cos(ang) * 0.3, y + Math.sin(ang) * 0.3, Math.cos(ang) * 2, 0, 1, 0.1, 0.4);
  }
  tracer(x1, y1, x2, y2) {
    this.add({ type: 'tracer', x: x1, y: y1, x2, y2, life: 0.07, g: 0, size: 0.05 });
  }
  text(x, y, str, color = '#ffd34d', size = 1) {
    this.texts.push({ x, y, str, color, size, age: 0, life: 1.2, vy: 2.2 });
  }

  // ---------- отрисовка (мировые координаты, y вверх) ----------
  renderDecals(ctx, x0, x1) {
    for (const d of this.decals) {
      if (d.x < x0 || d.x > x1) continue;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = d.c;
      if (d.skid) { ctx.fillRect(d.x - d.w / 2, d.y - 0.045, d.w, 0.07); continue; }
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  render(ctx, x0, x1, layer) {
    for (const p of this.list) {
      if (p.x < x0 - 5 || p.x > x1 + 5) continue;
      const t = p.age / p.life;
      switch (p.type) {
        case 'smoke': case 'mist': {
          if (p.type === 'smoke' && layer !== 'back') break;
          if (p.type === 'mist' && layer !== 'mist') break;
          const s = p.size * (1 + t * (p.grow || 0));
          ctx.fillStyle = p.color + (p.alpha * (1 - t) * (t < 0.1 ? t * 10 : 1)).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'fire': {
          if (layer !== 'front') break;
          const s = Math.max(0.02, p.size * (1 + t * (p.grow || 0)));
          const r = 255, g = Math.floor(230 - t * 180), b = Math.floor(120 - t * 120);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(${r},${g},${Math.max(0, b)},${(1 - t) * 0.7})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'blood': case 'spray': case 'bubble': {
          if (layer !== 'front') break;
          if (p.type === 'spray') ctx.fillStyle = `rgba(225,240,250,${0.85 * (1 - t)})`;
          else if (p.type === 'bubble') ctx.fillStyle = `rgba(210,240,255,${0.5 * (1 - t)})`;
          else ctx.fillStyle = p.color;
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > 3 && p.type !== 'bubble') {
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = p.size * 1.6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'chunk': case 'shell': {
          if (layer !== 'front') break;
          ctx.globalAlpha = p.fade && t > p.fade ? 1 - (t - p.fade) / (1 - p.fade) : 1;
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          if (p.rect) ctx.fillRect(-p.size * 1.8, -p.size * 0.5, p.size * 3.6, p.size);
          else { ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'spark': {
          if (layer !== 'front') break;
          ctx.strokeStyle = `rgba(255,${Math.floor(240 - t * 120)},120,${1 - t})`;
          ctx.lineWidth = 0.05;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
          break;
        }
        case 'foam': {
          if (layer !== 'water') break;
          const s = p.size * (1 + t * (p.grow || 0));
          ctx.fillStyle = `rgba(240,250,255,${0.5 * (1 - t)})`;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, s, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'flash': {
          if (layer !== 'front') break;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,220,120,${1 - t})`;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.size, 0.12); ctx.lineTo(p.size * 1.3, 0); ctx.lineTo(p.size, -0.12); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(0.1, 0, 0.18, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
          break;
        }
        case 'tracer': {
          if (layer !== 'front') break;
          ctx.strokeStyle = `rgba(255,240,180,${1 - t})`;
          ctx.lineWidth = 0.05;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke();
          break;
        }
        case 'shock': {
          if (layer !== 'front') break;
          ctx.strokeStyle = `rgba(255,240,220,${0.5 * (1 - t)})`;
          ctx.lineWidth = 0.4 * (1 - t);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.stroke();
          break;
        }
      }
    }
  }
}
