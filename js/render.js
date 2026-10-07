'use strict';
/* Рендерер: небо, параллакс, рельеф, декорации, вода, погода, освещение, HUD */

const LAYER_W = 2048, LAYER_H = 720;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.layers = null;
    this.rain = [];
    this.flash = 0;
    this.quality = 1;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality >= 1 ? 2 : 1.25);
    const w = Math.max(320, window.innerWidth || 1280), h = Math.max(200, window.innerHeight || 720);
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr); this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.W = this.canvas.width; this.H = this.canvas.height;
    this.light.width = Math.floor(this.W / 2); this.light.height = Math.floor(this.H / 2);
    this.skyCache = null;
  }

  setLevel(def) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.sky = SKIES[def.sky || def.time];
    this.night = this.sky.dark > 0.3;
    this.fire = def.sky === 'fire';
    this.backdrop = new Backdrop(def, this.sky, this.theme);
    this.groundPattern = null;
    this.skyCache = null;
    this.rain = [];
  }

  _groundPattern(ctx) {
    if (this.groundPattern) return this.groundPattern;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const th = this.theme;
    const base = this.night ? mix(th.ground, '#050608', 0.4) : th.ground;
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    const r = mulberry32(this.def.seed + 33);
    // слои
    for (let i = 0; i < 8; i++) {
      g.fillStyle = rgba(shade(base, (r() - 0.5) * 0.25), 0.5);
      const y = r() * 256;
      g.fillRect(0, y, 256, 6 + r() * 18);
    }
    for (let i = 0; i < 900; i++) {
      const s = r();
      g.fillStyle = rgba(s < 0.5 ? shade(base, -0.35) : shade(base, 0.25), 0.25 + r() * 0.5);
      const x = r() * 256, y = r() * 256, rr = 0.5 + r() * 2.5;
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    // камни
    for (let i = 0; i < 18; i++) {
      const x = r() * 256, y = r() * 256, rr = 3 + r() * 8;
      g.fillStyle = rgba(shade(base, -0.2 + r() * 0.3), 0.8);
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba('#ffffff', 0.08);
      g.beginPath(); g.ellipse(x - rr * 0.2, y - rr * 0.2, rr * 0.5, rr * 0.3, 0, 0, Math.PI * 2); g.fill();
    }
    const p = ctx.createPattern(c, 'repeat');
    this.groundPattern = p;
    return p;
  }

  /* ------------------------------ кадр ------------------------------ */
  render(game, alpha) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const S = game.zoom * this.dpr;
    const camX = game.camX + game.shakeX, camY = game.camY + game.shakeY;
    this.S = S; this.camX = camX; this.camY = camY;
    const toSX = x => W / 2 + (x - camX) * S;
    const toSY = y => H / 2 - (y - camY) * S;
    const x0 = camX - W / 2 / S - 2, x1 = camX + W / 2 / S + 2;
    const y0 = camY - H / 2 / S - 2, y1 = camY + H / 2 / S + 2;
    const t = game.world.time;
    const W_ = game.world.water;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // параллакс считается в постоянном масштабе (не зависит от зума камеры),
    // поэтому фон не «уезжает» при разгоне и не прыгает на холмах
    this.BASE = H / 24;
    const pcx = game.camX, pcy = game.camY;
    this._sky(ctx, game, t, pcx);
    this._layers(ctx, pcx, pcy, t, W_);

    // мир
    ctx.setTransform(S, 0, 0, -S, W / 2 - camX * S, H / 2 + camY * S);
    ctx.lineJoin = 'round';
    // декор позади
    for (const d of game.decor) {
      if (d.x < x0 - 25 || d.x > x1 + 25) continue;
      if (d.back) drawDecor(ctx, d, this, t);
    }
    this._terrain(ctx, game, x0, x1, y0);
    game.particles.renderDecals(ctx, x0, x1);
    for (const d of game.decor) {
      if (d.x < x0 - 30 || d.x > x1 + 30) continue;
      if (!d.back) drawDecor(ctx, d, this, t);
    }
    if (W_) this._waterBack(ctx, W_, x0, x1, t);
    game.particles.render(ctx, x0, x1, 'back');
    for (const p of game.props) if (p.x > x0 - 20 && (p.minX === undefined ? p.x : p.minX) < x1 + 20) p.render(ctx, alpha);
    for (const d of game.debris) {
      const b = d.body;
      if (b.x < x0 || b.x > x1) continue;
      ctx.save(); ctx.translate(b.ix(alpha), b.iy(alpha)); ctx.rotate(b.ia(alpha));
      ctx.globalAlpha = clamp(d.life, 0, 1);
      ctx.fillStyle = d.color; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      ctx.globalAlpha = 1; ctx.restore();
    }
    for (const r of game.ragdolls) if (r.x > x0 - 5 && r.x < x1 + 5) r.render(ctx, alpha);
    for (const z of game.zombies) if (z.alive && z.body.x > x0 - 3 && z.body.x < x1 + 3) z.render(ctx, alpha);
    if (game.vehicle) game.vehicle.render(ctx, alpha, this.night);
    // снежная стена лавины
    if (game.avalanche && game.avalanche.active && !game.avalanche.done) this._avalanche(ctx, game, x0, t);
    // передняя часть финишного здания (стены, ворота) — поверх транспорта
    if (game.finish && game.finish.x < x1 + 40 && game.finish.x > x0 - 60) drawFinish(ctx, game.finish, this, t, 'front');
    game.particles.render(ctx, x0, x1, 'front');
    if (W_) this._waterFront(ctx, W_, x0, x1, y0, t, game);
    game.particles.render(ctx, x0, x1, 'water');
    game.particles.render(ctx, x0, x1, 'mist');

    // освещение
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._lighting(ctx, game, toSX, toSY, S, t);
    this._weather(ctx, game, t);
    this._post(ctx, game);
    // всплывающий текст
    for (const tx of game.particles.texts) {
      const k = tx.age / tx.life;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const sc = (k < 0.12 ? k / 0.12 : 1) * tx.size;
      ctx.font = `900 ${Math.round(22 * this.dpr * sc)}px Oswald, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 * this.dpr; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(tx.str, toSX(tx.x), toSY(tx.y));
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.str, toSX(tx.x), toSY(tx.y));
    }
    ctx.globalAlpha = 1;
  }

  _sky(ctx, game, t, pcx) { this.backdrop.drawSky(ctx, this, t, pcx); }

  _layers(ctx, pcx, pcy, t, water) { this.backdrop.drawLayers(ctx, this, pcx, pcy, t, water); }

  _terrain(ctx, game, x0, x1, y0) {
    const T = game.world.terrain;
    const th = this.theme;
    const i0 = clamp(Math.floor((x0 - T.x0) / T.dx), 0, T.n - 1), i1 = clamp(Math.ceil((x1 - T.x0) / T.dx), 0, T.n - 1);
    const bottom = y0 - 5;
    ctx.beginPath();
    ctx.moveTo(T.x0 + i0 * T.dx, bottom);
    for (let i = i0; i <= i1; i++) ctx.lineTo(T.x0 + i * T.dx, T.h[i]);
    ctx.lineTo(T.x0 + i1 * T.dx, bottom);
    ctx.closePath();
    const pat = this._groundPattern(ctx);
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / 48, 1 / 48));
    ctx.fillStyle = pat;
    ctx.fill();
    // затемнение вглубь
    const g = ctx.createLinearGradient(0, this.camY + 4, 0, this.camY - 14);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fill();
    // верхняя полоса
    const surf = th.surface;
    const nightK = this.night ? 0.45 : 0;
    const top = mix(th.top, '#05070c', nightK), hi = mix(th.topHi, '#05070c', nightK);
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) ctx.lineTo(T.x0 + i * T.dx, T.h[i] - (surf === 'asphalt' || surf === 'steel' ? 0.35 : 0.22));
    ctx.strokeStyle = shade(top, -0.25); ctx.lineWidth = surf === 'asphalt' || surf === 'steel' ? 0.75 : 0.55; ctx.stroke();
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) ctx.lineTo(T.x0 + i * T.dx, T.h[i] - 0.1);
    ctx.strokeStyle = top; ctx.lineWidth = 0.28; ctx.stroke();
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) ctx.lineTo(T.x0 + i * T.dx, T.h[i] + 0.01);
    ctx.strokeStyle = hi; ctx.lineWidth = 0.07; ctx.stroke();
    if (surf === 'asphalt' || surf === 'steel') {
      ctx.setLineDash(surf === 'steel' ? [0.2, 0.6] : [2, 2.5]);
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) ctx.lineTo(T.x0 + i * T.dx, T.h[i] - 0.3);
      ctx.strokeStyle = surf === 'steel' ? 'rgba(240,200,60,0.5)' : 'rgba(230,220,170,0.55)'; ctx.lineWidth = 0.07; ctx.stroke();
      ctx.setLineDash([]);
    }
    // трава / снег / камешки
    if (surf === 'grass' || surf === 'snow' || surf === 'sand' || surf === 'dirt') {
      for (let i = i0; i <= i1; i++) {
        const hsh = (i * 2654435761) >>> 0;
        const xx = T.x0 + i * T.dx, yy = T.h[i];
        if (surf === 'grass') {
          if (hsh % 3) continue;
          ctx.strokeStyle = (hsh % 5) ? hi : top; ctx.lineWidth = 0.04;
          const hgt = 0.15 + (hsh % 7) * 0.04, lean = ((hsh >> 3) % 5 - 2) * 0.04;
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + lean, yy + hgt); ctx.moveTo(xx + 0.08, yy); ctx.lineTo(xx + 0.1 + lean, yy + hgt * 0.7); ctx.stroke();
        } else if (surf === 'snow') {
          if (hsh % 4) continue;
          ctx.fillStyle = hi; ctx.beginPath(); ctx.ellipse(xx, yy + 0.02, 0.3, 0.06, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          if (hsh % 6) continue;
          ctx.fillStyle = shade(top, -0.3); ctx.beginPath(); ctx.arc(xx, yy - 0.05, 0.05 + (hsh % 3) * 0.03, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  _avalanche(ctx, game, x0, t) {
    const av = game.avalanche, T = game.world.terrain;
    const front = av.wallX;
    if (front < x0 - 5) return;
    const back = Math.min(front - 60, x0 - 5);
    ctx.beginPath();
    ctx.moveTo(back, T.heightAt(back) - 2);
    for (let x = back; x <= front; x += 1) ctx.lineTo(x, T.heightAt(x) + 14 + Math.sin(x * 0.35 + t * 3) * 1.2);
    // клубящийся фронт
    const gy = T.heightAt(front);
    for (let k = 0; k <= 14; k++) {
      const yy = gy + 14 - k;
      const bulge = Math.sin(k * 1.3 + t * 6) * 0.9 + (1 - Math.abs(k - 7) / 7) * 2.5;
      ctx.lineTo(front + bulge, yy);
    }
    ctx.lineTo(front, gy - 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(front - 30, 0, front + 3, 0);
    g.addColorStop(0, this.night ? '#6f7886' : '#c9d3dc'); g.addColorStop(1, this.night ? '#aab4c0' : '#f4f8fb');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 0; k < 10; k++) {
      const px = front - (k * 5.3 + t * 7) % 40, py = T.heightAt(px) + 4 + (k * 3.7) % 9;
      ctx.beginPath(); ctx.arc(px, py, 1.4 + (k % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  _waterBack(ctx, W_, x0, x1, t) {
    // тёмная толща воды за объектами (чтобы дно просвечивало)
  }

  _waterFront(ctx, W_, x0, x1, y0, t, game) {
    const step = 0.5;
    const pts = [];
    for (let x = Math.floor(x0); x <= x1 + step; x += step) pts.push([x, W_.height(x, t)]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], y0 - 5);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], y0 - 5);
    ctx.closePath();
    const night = this.night;
    const g = ctx.createLinearGradient(0, 1, 0, -18);
    if (night) { g.addColorStop(0, 'rgba(20,50,70,0.55)'); g.addColorStop(0.3, 'rgba(8,24,38,0.8)'); g.addColorStop(1, 'rgba(3,10,18,0.95)'); }
    else if (this.def.sky === 'fog') { g.addColorStop(0, 'rgba(90,120,125,0.5)'); g.addColorStop(0.3, 'rgba(50,80,90,0.78)'); g.addColorStop(1, 'rgba(25,45,55,0.95)'); }
    else { g.addColorStop(0, 'rgba(40,110,140,0.45)'); g.addColorStop(0.25, 'rgba(20,70,100,0.72)'); g.addColorStop(1, 'rgba(8,30,50,0.95)'); }
    ctx.fillStyle = g; ctx.fill();
    // каустика
    ctx.save(); ctx.clip();
    ctx.strokeStyle = night ? 'rgba(120,180,220,0.05)' : 'rgba(180,230,255,0.08)'; ctx.lineWidth = 0.12;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = Math.floor(x0); x <= x1; x += 1) {
        const y = -1.2 - k * 1.6 + Math.sin(x * 0.7 + t * (1 + k * 0.2) + k) * 0.3;
        ctx.lineTo(x, y + W_.height(x, t) * 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
    // пена по поверхности
    ctx.beginPath();
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = night ? 'rgba(170,200,220,0.5)' : 'rgba(235,250,255,0.85)'; ctx.lineWidth = 0.09; ctx.stroke();
    ctx.beginPath();
    for (const p of pts) ctx.lineTo(p[0], p[1] - 0.18);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.2; ctx.stroke();
    // гребни волн
    if (W_.amp > 0.8) {
      for (let i = 1; i < pts.length - 1; i++) {
        if (pts[i][1] > pts[i - 1][1] && pts[i][1] > pts[i + 1][1] && pts[i][1] > W_.amp * 0.6) {
          ctx.fillStyle = 'rgba(240,250,255,0.6)';
          ctx.beginPath(); ctx.ellipse(pts[i][0], pts[i][1], 0.8, 0.12, 0, 0, Math.PI * 2); ctx.fill();
          if (Math.random() < 0.05) game.particles.add({ type: 'spray', x: pts[i][0], y: pts[i][1], vx: 2 + Math.random() * 2, vy: 1 + Math.random() * 2, g: -12, life: 0.6, size: 0.06, water: true });
        }
      }
    }
  }

  _lighting(ctx, game, toSX, toSY, S, t) {
    const dark = this.sky.dark;
    const v = game.vehicle;
    if (dark < 0.05) {
      // только аддитивные вспышки
      this.backdrop.drawGlow(ctx, this, t);
      this._glows(ctx, game, toSX, toSY, S, 0.6);
      return;
    }
    const L = this.lctx, lw = this.light.width, lh = this.light.height;
    const k = lw / this.W;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = this.night ? `rgba(4,8,20,${dark})` : `rgba(20,10,20,${dark})`;
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const g = L.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g; L.beginPath(); L.arc(x * k, y * k, r * k, 0, Math.PI * 2); L.fill();
    };
    const headOK = v && !(v.dmg && v.dmg.lost.has('headL'));
    if (v && v.brake && v.dmg && !v.dmg.lost.has('tailL')) {
      const tp = v.chassis.worldPoint(v.def.look.rear, v.def.look.belt - 0.18);
      hole(toSX(tp.x), toSY(tp.y), 2.2 * S, 0.5);
    }
    if (v && !headOK) hole(toSX(v.chassis.x), toSY(v.chassis.y), 7 * S, 0.8);
    if (v && headOK) {
      const c = v.chassis;
      // помятая морда: фара мигает от плохого контакта
      const flick = v.dmg && v.dmg.zone.front > 0.08 && Math.random() < v.dmg.zone.front * 0.25;
      const front = v.type === 'bike' ? c.worldPoint(0.75, 0.7) : v.type === 'boat' ? c.worldPoint(v.def.hull[0][3][0] - 0.5, 0.9) : c.worldPoint(v.def.look.front - 0.05, v.def.look.belt - 0.12);
      const sx = toSX(front.x), sy = toSY(front.y);
      const ang = -c.a;
      const len = 22 * S;
      L.save();
      L.translate(sx * k, sy * k); L.rotate(ang);
      const g = L.createLinearGradient(0, 0, len * k, 0);
      const hk = flick ? 0.35 : 1;
      g.addColorStop(0, `rgba(0,0,0,${0.95 * hk})`); g.addColorStop(0.6, `rgba(0,0,0,${0.6 * hk})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g;
      L.beginPath(); L.moveTo(0, -3 * k); L.lineTo(len * k, -len * 0.32 * k); L.lineTo(len * k, len * 0.2 * k); L.lineTo(0, 3 * k); L.closePath(); L.fill();
      L.restore();
      hole(toSX(c.x), toSY(c.y), 7 * S, 0.8);
    }
    for (const l of game.particles.lights) {
      const a = 1 - l.age / l.life;
      hole(toSX(l.x), toSY(l.y), l.r * S * (0.7 + 0.3 * a), a);
    }
    for (const p of game.particles.list) {
      if (p.type === 'fire' && Math.random() < 0.3) hole(toSX(p.x), toSY(p.y), 2.5 * S, 0.5 * (1 - p.age / p.life));
    }
    for (const d of game.decor) {
      if (d.light && Math.abs(d.x - this.camX) < this.W / S) {
        const flick = d.flicker ? 0.75 + Math.sin(t * 13 + d.x) * 0.15 + Math.random() * 0.1 : 1;
        hole(toSX(d.x + (d.lx || 0)), toSY(d.y + d.light), (d.lr || 7) * S * flick, 0.9);
      }
    }
    for (const p of game.props) if (p.kind === 'pickup' && Math.abs(p.px - this.camX) < 40) hole(toSX(p.px), toSY(p.py), 3 * S, 0.7);
    this.backdrop.lightHoles(hole, this);
    if (this.flash > 0) { L.fillStyle = `rgba(0,0,0,${this.flash})`; L.fillRect(0, 0, lw, lh); }
    ctx.drawImage(this.light, 0, 0, this.W, this.H);
    this.backdrop.drawGlow(ctx, this, t);
    this._glows(ctx, game, toSX, toSY, S, 1);
  }

  _glows(ctx, game, toSX, toSY, S, strength) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of game.particles.lights) {
      const a = (1 - l.age / l.life) * strength;
      const r = l.r * S * 0.8;
      const x = toSX(l.x), y = toSY(l.y);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, l.color + (0.45 * a) + ')'); g.addColorStop(1, l.color + '0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (this.night && game.vehicle && game.vehicle.brake && game.vehicle.dmg && !game.vehicle.dmg.lost.has('tailL')) {
      const v = game.vehicle, tp = v.chassis.worldPoint(v.def.look.rear - 0.02, v.def.look.belt - 0.18);
      const x = toSX(tp.x), y = toSY(tp.y), r = 1.3 * S;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,60,40,0.75)'); g.addColorStop(1, 'rgba(255,30,20,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (this.night && game.vehicle && !(game.vehicle.dmg && game.vehicle.dmg.lost.has('headL'))) {
      const v = game.vehicle, c = v.chassis;
      const front = v.type === 'bike' ? c.worldPoint(0.75, 0.7) : v.type === 'boat' ? c.worldPoint(v.def.hull[0][3][0] - 0.5, 0.9) : c.worldPoint(v.def.look.front - 0.05, v.def.look.belt - 0.12);
      const x = toSX(front.x), y = toSY(front.y), r = 1.5 * S;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,250,210,0.8)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _weather(ctx, game, t) {
    const w = this.def.weather, W = this.W, H = this.H;
    // дождь, гроза, снег, пепел, пыль — в модуле погоды (параллакс по глубине, брызги, молнии)
    if (!this.weatherFx) this.weatherFx = new WeatherFX();
    this.weatherFx.draw(ctx, this, game, t);
    if (w === 'fog') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(200,208,210,0.1)'); g.addColorStop(0.6, 'rgba(200,208,210,0.35)'); g.addColorStop(1, 'rgba(200,208,210,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.7);
      g2.addColorStop(0, 'rgba(200,208,210,0)'); g2.addColorStop(1, 'rgba(200,208,210,0.6)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    }
  }

  // свечение: яркие места (фары, огни, солнце, вспышки) мягко растекаются по кадру
  _bloom(ctx) {
    if (this.quality < 1) return;
    const W = this.W, H = this.H;
    const bw = Math.max(80, Math.round(W / 5)), bh = Math.max(50, Math.round(H / 5));
    if (!this.bloomA || this.bloomA.width !== bw) {
      this.bloomA = document.createElement('canvas'); this.bloomA.width = bw; this.bloomA.height = bh;
      this.bloomActx = this.bloomA.getContext('2d');
    }
    const b = this.bloomActx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, bw, bh);
    // порог: оставляем только светлое, потом размываем
    b.filter = 'brightness(0.5) contrast(9) saturate(1.3)';   // порог: сквозь него проходят только самые светлые места
    b.drawImage(this.canvas, 0, 0, bw, bh);
    b.filter = 'none';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.night ? 0.55 : 0.3;
    ctx.filter = 'blur(' + Math.round(6 * this.dpr) + 'px)';
    ctx.drawImage(this.bloomA, 0, 0, W, H);
    ctx.filter = 'none';
    ctx.restore();
  }

  // кинематографичная подача: S-кривая контраста, тёплые света и холодные тени, зерно
  _grade(ctx, game, t) {
    const W = this.W, H = this.H;
    const sky = this.sky;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = this.night ? 'rgba(96,104,124,0.12)' : this.fire ? 'rgba(138,110,88,0.14)' : 'rgba(126,122,114,0.1)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const cool = this.night ? 'rgba(120,140,190,1)' : 'rgba(180,196,220,1)';
    g.addColorStop(0, 'rgba(255,248,235,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(1, cool);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (this.quality >= 1) {
      // зерно плёнки: чуть шевелится, скрывает полосы градиентов
      const nt = noiseTile();
      ctx.save();
      ctx.globalAlpha = 0.05;
      const off = (Math.floor(t * 24) % 8) * 16;
      const pat = ctx.createPattern(nt, 'repeat');
      ctx.translate(-off, off * 0.6);
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 128, H + 128);
      ctx.restore();
    }
  }

  _post(ctx, game) {
    const W = this.W, H = this.H;
    this._bloom(ctx);
    this._grade(ctx, game, game.world.time);
    // виньетка
    const g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ускорение: полосы скорости
    const v = game.vehicle;
    const precip = ['rain', 'storm', 'snow', 'ash', 'dust'].includes(this.def.weather);
    if (v && !precip && (v.boosting || v.speed() > 28)) {
      const a = v.boosting ? 0.25 : 0.1;
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.5 * this.dpr;
      for (let i = 0; i < 14; i++) {
        const y = Math.random() * H, x = Math.random() * W, l = (60 + Math.random() * 160) * this.dpr;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l, y); ctx.stroke();
      }
    }
    if (game.hurtFlash > 0) {
      ctx.fillStyle = `rgba(160,0,0,${game.hurtFlash * 0.3})`; ctx.fillRect(0, 0, W, H);
    }
    if (game.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,240,220,${game.whiteFlash * 0.5})`; ctx.fillRect(0, 0, W, H);
    }
    if (game.slowmo < 0.9) {
      ctx.fillStyle = `rgba(20,10,0,${(1 - game.slowmo) * 0.25})`; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ------------------------------ HUD ------------------------------ */
  hud(game) {
    const ctx = this.ctx, W = this.W, H = this.H, d = this.dpr;
    const v = game.vehicle;
    if (!v || game.demo) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const u = Math.min(W / 1280, H / 720) * 1.0;
    const font = (sz, w = 700) => `${w} ${Math.round(sz * u)}px Oswald, 'Arial Narrow', Impact, sans-serif`;
    // прогресс
    const pw = Math.min(W * 0.5, 720 * u), px = (W - pw) / 2, py = 26 * u;
    const prog = clamp(game.distance / game.level.length, 0, 1);
    const best = clamp((game.save.best[game.level.id] || 0) / game.level.length, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, px - 14 * u, py - 12 * u, pw + 28 * u, 46 * u, 10 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, px, py + 4 * u, pw, 8 * u, 4 * u); ctx.fill();
    const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
    pg.addColorStop(0, '#e0a030'); pg.addColorStop(1, '#ff5a2a');
    ctx.fillStyle = pg;
    roundRect(ctx, px, py + 4 * u, Math.max(8 * u, pw * prog), 8 * u, 4 * u); ctx.fill();
    if (best > 0.01) {
      ctx.fillStyle = '#9fe07a';
      ctx.fillRect(px + pw * best - 1.5 * u, py - 4 * u, 3 * u, 24 * u);
      ctx.font = font(10, 600); ctx.textAlign = 'center';
      ctx.fillText('РЕКОРД', px + pw * best, py + 30 * u);
    }
    // флаг финиша
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(px + pw + 2 * u + i * 5 * u, py - 4 * u + j * 5 * u, 5 * u, 5 * u); }
    // маркер
    const mx = px + pw * prog;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(mx, py + 2 * u); ctx.lineTo(mx - 7 * u, py - 9 * u); ctx.lineTo(mx + 7 * u, py - 9 * u); ctx.closePath(); ctx.fill();
    ctx.font = font(15); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.floor(game.distance)} м  /  ${game.level.length} м`, W / 2, py + 26 * u);

    // деньги
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, 16 * u, 14 * u, 190 * u, 56 * u, 10 * u); ctx.fill();
    ctx.font = font(12, 500); ctx.fillStyle = '#c8c8c8';
    ctx.fillText('ЗАРАБОТАНО', 30 * u, 34 * u);
    ctx.font = font(24); ctx.fillStyle = '#8fe06a';
    ctx.fillText(fmtMoney(game.runMoney()), 30 * u, 60 * u);
    ctx.font = font(13, 500); ctx.fillStyle = '#ddd'; ctx.textAlign = 'right';
    ctx.fillText(`☠ ${game.kills}`, 196 * u, 60 * u);

    // приборы: указатель топлива, спидометр, тахометр
    if (!this.cluster) this.cluster = new InstrumentCluster();
    this.cluster.drawFuel(ctx, 86 * u, H - 84 * u, u, game, this.night);

    let bx = 180 * u;
    if (v.boostMax > 0) {
      const bw = 26 * u, bh = 110 * u, by = H - 30 * u - bh;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, bx - 6 * u, by - 24 * u, bw + 12 * u, bh + 34 * u, 8 * u); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, bh);
      const k = v.boost / v.boostMax;
      const g = ctx.createLinearGradient(0, by + bh, 0, by);
      g.addColorStop(0, '#2a7fff'); g.addColorStop(1, '#8fe8ff');
      ctx.fillStyle = g; ctx.fillRect(bx, by + bh * (1 - k), bw, bh * k);
      ctx.font = font(11, 700); ctx.fillStyle = '#9fdcff'; ctx.textAlign = 'center';
      ctx.fillText('NITRO', bx + bw / 2, by - 8 * u);
      bx += 52 * u;
    }
    if (v.ammoMax > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, bx - 6 * u, H - 64 * u, 96 * u, 44 * u, 8 * u); ctx.fill();
      ctx.font = font(22); ctx.fillStyle = v.ammo > 0 ? '#ffd24a' : '#a33'; ctx.textAlign = 'left';
      ctx.fillText(`▮ ${v.ammo}`, bx + 6 * u, H - 33 * u);
    }

    this.cluster.draw(ctx, W, H, u, game, this.night, font);
    ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;

    // комбо
    if (game.combo > 2 && game.comboT > 0) {
      const sc = 1 + Math.max(0, game.comboPulse) * 0.4;
      ctx.save(); ctx.translate(W / 2, 110 * u); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.font = font(34, 900);
      ctx.lineWidth = 6 * u; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(`КОМБО ×${game.combo}`, 0, 0);
      ctx.fillStyle = '#ffcf3a'; ctx.fillText(`КОМБО ×${game.combo}`, 0, 0);
      ctx.restore();
    }
    // сообщения
    if (game.msg && game.msg.t > 0) {
      const m = game.msg;
      const k = clamp(m.t / 0.3, 0, 1) * clamp((m.life - (m.life - m.t)) / 0.3, 0, 1);
      ctx.globalAlpha = clamp(m.t / 0.4, 0, 1);
      const sc = 1 + (1 - clamp((m.life - m.t) / 0.25, 0, 1)) * 0.6;
      ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.font = font(m.size || 48, 900);
      ctx.lineWidth = 8 * u; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(m.text, 0, 0);
      ctx.fillStyle = m.color || '#fff'; ctx.fillText(m.text, 0, 0);
      if (m.sub) { ctx.font = font(20, 600); ctx.lineWidth = 5 * u; ctx.strokeText(m.sub, 0, 36 * u); ctx.fillStyle = '#ddd'; ctx.fillText(m.sub, 0, 36 * u); }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (game.showFps) {
      ctx.textAlign = 'left'; ctx.font = font(12, 500); ctx.fillStyle = '#0f0';
      ctx.fillText(`${Math.round(game.fps)} fps  тел: ${game.world.bodies.length}`, 16 * u, 90 * u);
    }
  }
}

/* ------------------------------ фоновые слои ------------------------------ */

/* ------------------------------ декорации (мир) ------------------------------ */

function drawDecor(ctx, d, R, t) {
  const night = R.night;
  const dim = (c) => night ? mix(c, '#07080c', 0.55) : c;
  const s = d.s || 1;
  const x = d.x, y = d.y;
  const rng = mulberry32(d.seed || 1);
  switch (d.type) {
    case 'house': {
      const w = 7 * s, h = 4.5 * s, base = y - 1.5;
      const wall = dim(['#9a8a74', '#8a9aa4', '#a4845e', '#7e8a6a'][d.seed % 4]);
      ctx.fillStyle = wall; ctx.fillRect(x - w / 2, base, w, h + 1.5);
      ctx.fillStyle = dim('#5a3a2a');
      polyPath(ctx, [[x - w / 2 - 0.5, base + h + 1.5], [x, base + h + 4 * s], [x + w / 2 + 0.5, base + h + 1.5]]); ctx.fill();
      ctx.fillStyle = night ? (d.seed % 3 === 0 ? '#e0b060' : '#101418') : '#2a3440';
      ctx.fillRect(x - w * 0.35, base + h * 0.55 + 1.5, 1.4, 1.3); ctx.fillRect(x + w * 0.15, base + h * 0.55 + 1.5, 1.4, 1.3);
      ctx.fillStyle = dim('#4a3020'); ctx.fillRect(x - 0.6, base + 1.5, 1.2, 2.2);
      if (d.seed % 2) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - w * 0.35, base + h * 0.55 + 1.5, 1.4, 1.3); ctx.strokeStyle = dim('#6a5a4a'); ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(x - w * 0.37, base + h * 0.55 + 1.5); ctx.lineTo(x - w * 0.37 + 1.5, base + h * 0.55 + 2.8); ctx.stroke(); }
      if (night && d.seed % 3 === 0) { d.light = h * 0.6 + 1; d.lr = 5; d.lx = -w * 0.35 + 0.7; }
      break;
    }
    case 'tree': {
      const h = 6 * s;
      ctx.fillStyle = dim('#4a3524'); ctx.fillRect(x - 0.2 * s, y - 0.5, 0.4 * s, h * 0.55);
      const leaf = dim(['#3e6b35', '#4c7a3a', '#5b6b2e'][d.seed % 3]);
      ctx.fillStyle = leaf;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * 2.4 * s, y + h * 0.6 + rng() * h * 0.35, (1 + rng() * 0.8) * s, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.arc(x - 0.6 * s, y + h * 0.85, 0.9 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pine': case 'snowpine': {
      const h = 8 * s;
      ctx.fillStyle = dim('#3a2a1c'); ctx.fillRect(x - 0.2, y - 0.5, 0.4, 1.8);
      for (let i = 0; i < 4; i++) {
        const ty = y + 1 + i * h * 0.19, tw = 2.2 * s * (1 - i * 0.2);
        ctx.fillStyle = dim(i % 2 ? '#24422c' : '#2c4f33');
        polyPath(ctx, [[x - tw, ty], [x, ty + h * 0.33], [x + tw, ty]]); ctx.fill();
        if (d.type === 'snowpine') { ctx.fillStyle = dim('#eef3f8'); polyPath(ctx, [[x - tw * 0.5, ty + h * 0.16], [x, ty + h * 0.33], [x + tw * 0.5, ty + h * 0.16]]); ctx.fill(); }
      }
      break;
    }
    case 'palm': {
      const h = 7 * s;
      ctx.strokeStyle = dim('#6b5236'); ctx.lineWidth = 0.35; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y - 0.3); ctx.quadraticCurveTo(x + 0.8, y + h * 0.5, x + 1.2, y + h); ctx.stroke();
      ctx.strokeStyle = dim('#3f7a3a'); ctx.lineWidth = 0.25;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + Math.sin(t + d.x) * 0.05;
        ctx.beginPath(); ctx.moveTo(x + 1.2, y + h); ctx.quadraticCurveTo(x + 1.2 + Math.cos(a) * 1.8, y + h + 0.8, x + 1.2 + Math.cos(a) * 3, y + h - 0.6 - Math.abs(Math.sin(a))); ctx.stroke();
      }
      break;
    }
    case 'lamp': case 'pierlamp': {
      const h = 6;
      ctx.fillStyle = dim('#3b3f44'); ctx.fillRect(x - 0.08, y - 0.3, 0.16, h);
      ctx.fillRect(x - 0.08, y + h - 0.3, 1.2, 0.12);
      ctx.fillStyle = night ? '#fff2c0' : '#bbb'; ctx.fillRect(x + 0.8, y + h - 0.45, 0.45, 0.15);
      if (night && d.seed % 4 !== 0) { d.light = h - 0.5; d.lx = 1; d.lr = 9; d.flicker = d.seed % 5 === 1; }
      break;
    }
    case 'pole': {
      ctx.fillStyle = dim('#5a4632'); ctx.fillRect(x - 0.12, y - 0.3, 0.24, 8);
      ctx.fillRect(x - 1, y + 7, 2, 0.15);
      ctx.strokeStyle = dim('#222'); ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(x - 1, y + 7.1); ctx.quadraticCurveTo(x + 12, y + 5.5, x + 25, y + 7.1); ctx.stroke();
      break;
    }
    case 'fence': {
      ctx.fillStyle = dim('#6b5236');
      for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 0.9, y - 0.3, 0.12, 1.4 + (i % 2) * 0.1);
      ctx.fillRect(x, y + 0.5, 5, 0.1); ctx.fillRect(x, y + 0.95, 5, 0.1);
      break;
    }
    case 'rail': {
      ctx.fillStyle = dim('#8c9296');
      for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 1.5, y - 0.3, 0.12, 1.0);
      ctx.fillRect(x, y + 0.55, 7, 0.22);
      break;
    }
    case 'billboard': {
      ctx.fillStyle = dim('#444'); ctx.fillRect(x - 0.15, y - 0.3, 0.3, 6); ctx.fillRect(x + 3, y - 0.3, 0.3, 6);
      ctx.fillStyle = dim('#d8d0b8'); ctx.fillRect(x - 1, y + 5.5, 5.3, 3);
      ctx.fillStyle = dim(['#b53a2a', '#2a6ab5', '#3a9a4a'][d.seed % 3]); ctx.fillRect(x - 0.8, y + 5.7, 4.9, 2.6);
      ctx.save(); ctx.translate(x + 1.65, y + 7); ctx.scale(1, -1);
      ctx.fillStyle = dim('#fff'); ctx.font = 'bold 0.8px Oswald, Impact, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(['ЭВАКУАЦИЯ', 'СЕВЕР →', 'НЕ ОСТАНАВЛИВАЙТЕСЬ'][d.seed % 3], 0, 0.3);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 1.2, y + 5.7, 0.8, 1.6);
      break;
    }
    case 'warn': {
      // треугольный знак «!» — предупреждение об опасности впереди
      ctx.fillStyle = dim('#666'); ctx.fillRect(x - 0.07, y - 0.3, 0.14, 2.8);
      ctx.fillStyle = dim('#f2c230');
      polyPath(ctx, [[x, y + 3.9], [x + 0.85, y + 2.4], [x - 0.85, y + 2.4]]); ctx.fill();
      ctx.strokeStyle = dim('#c62828'); ctx.lineWidth = 0.12; ctx.stroke();
      ctx.save(); ctx.translate(x, y + 2.95); ctx.scale(1, -1);
      ctx.fillStyle = '#111'; ctx.font = 'bold 0.8px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 0.05);
      ctx.restore();
      break;
    }
    case 'sign': case 'canyonsign': case 'barricadesign': {
      ctx.fillStyle = dim('#555'); ctx.fillRect(x - 0.06, y - 0.3, 0.12, 2.4);
      const col = d.type === 'barricadesign' ? '#d8c020' : d.type === 'canyonsign' ? '#c8a030' : '#2a6a3a';
      ctx.fillStyle = dim(col); roundRect(ctx, x - 0.9, y + 1.6, 1.8, 0.9, 0.1); ctx.fill();
      ctx.save(); ctx.translate(x, y + 2.05); ctx.scale(1, -1);
      ctx.fillStyle = d.type === 'sign' ? '#fff' : '#111'; ctx.font = 'bold 0.42px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.type === 'barricadesign' ? '⚠ ЗАСЛОН' : d.type === 'canyonsign' ? 'МОСТ' : 'СЕВЕР', 0, 0);
      ctx.restore();
      break;
    }
    case 'marker': case 'buoymarker': {
      const yy = d.type === 'buoymarker' ? R.def && 0 : y;
      ctx.fillStyle = dim('#ddd'); ctx.fillRect(x - 0.08, yy - 0.3, 0.16, 3);
      ctx.fillStyle = dim('#c62828'); roundRect(ctx, x - 1.1, yy + 2.3, 2.2, 0.9, 0.12); ctx.fill();
      ctx.save(); ctx.translate(x, yy + 2.75); ctx.scale(1, -1);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 0.55px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.text, 0, 0);
      ctx.restore();
      break;
    }
    case 'cactus': {
      const h = 3.2 * s;
      ctx.fillStyle = dim('#4f7a3e');
      roundRect(ctx, x - 0.3, y - 0.3, 0.6, h, 0.3); ctx.fill();
      roundRect(ctx, x - 1.1, y + h * 0.45, 0.45, h * 0.35, 0.22); ctx.fill();
      ctx.fillRect(x - 1.1, y + h * 0.45, 0.9, 0.35);
      roundRect(ctx, x + 0.65, y + h * 0.55, 0.45, h * 0.3, 0.22); ctx.fill();
      ctx.fillRect(x + 0.2, y + h * 0.55, 0.9, 0.35);
      break;
    }
    case 'rock': {
      ctx.fillStyle = dim('#6e675d');
      ctx.beginPath(); ctx.moveTo(x - 1.5 * s, y - 0.3); ctx.lineTo(x - 1.1 * s, y + 0.9 * s); ctx.lineTo(x - 0.1 * s, y + 1.4 * s); ctx.lineTo(x + 1.2 * s, y + 0.8 * s); ctx.lineTo(x + 1.6 * s, y - 0.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x - 1.1 * s, y + 0.9 * s); ctx.lineTo(x - 0.1 * s, y + 1.4 * s); ctx.lineTo(x, y + 0.6 * s); ctx.fill();
      break;
    }
    case 'skull': {
      ctx.fillStyle = dim('#e8e0c8');
      ctx.beginPath(); ctx.ellipse(x, y + 0.2, 0.45, 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 1.1, y + 0.35, 0.8, 0.12); ctx.fillRect(x + 0.3, y + 0.35, 0.8, 0.12);
      break;
    }
    case 'deadtree': {
      ctx.strokeStyle = dim('#4a3a2a'); ctx.lineCap = 'round';
      const br = (bx, by, a, l, w, depth) => {
        if (depth === 0) return;
        const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l;
        ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        br(ex, ey, a + 0.5 + rng() * 0.3, l * 0.7, w * 0.65, depth - 1);
        br(ex, ey, a - 0.5 - rng() * 0.3, l * 0.65, w * 0.65, depth - 1);
      };
      br(x, y - 0.3, Math.PI / 2, 2.5 * s, 0.35 * s, 4);
      break;
    }
    case 'minecart': {
      ctx.fillStyle = dim('#5a4a3a'); polyPath(ctx, [[x - 1, y + 0.4], [x + 1, y + 0.4], [x + 1.2, y + 1.5], [x - 1.2, y + 1.5]]); ctx.fill();
      ctx.fillStyle = dim('#222'); ctx.beginPath(); ctx.arc(x - 0.6, y + 0.3, 0.3, 0, Math.PI * 2); ctx.arc(x + 0.6, y + 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'saloon': {
      const w = 8 * s, h = 5 * s;
      ctx.fillStyle = dim('#7a5a3a'); ctx.fillRect(x - w / 2, y - 1, w, h + 1);
      ctx.fillRect(x - w / 2 - 0.3, y + h, w + 0.6, 1.8);
      ctx.fillStyle = dim('#5a3f26'); ctx.fillRect(x - w / 2 - 0.6, y + h * 0.5, w + 1.2, 0.25);
      for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + i * w / 3, y - 0.5, 0.15, h * 0.5 + 0.5);
      ctx.fillStyle = night && d.seed % 2 ? '#e09a40' : '#1e1a16';
      ctx.fillRect(x - w * 0.3, y + h * 0.62, 1.2, 1.1); ctx.fillRect(x + w * 0.15, y + h * 0.62, 1.2, 1.1);
      ctx.fillStyle = '#1e1a16'; ctx.fillRect(x - 0.6, y, 1.2, 2);
      if (night && d.seed % 2) { d.light = h * 0.7; d.lr = 5; d.lx = -w * 0.3 + 0.6; d.flicker = true; }
      break;
    }
    case 'watertower': {
      ctx.fillStyle = dim('#5a4632');
      ctx.fillRect(x - 1.5, y - 0.3, 0.2, 7); ctx.fillRect(x + 1.3, y - 0.3, 0.2, 7);
      ctx.fillStyle = dim('#6a5238'); roundRect(ctx, x - 2, y + 6.5, 4, 3, 0.4); ctx.fill();
      polyPath(ctx, [[x - 2.2, y + 9.5], [x, y + 11], [x + 2.2, y + 9.5]]); ctx.fill();
      break;
    }
    case 'log': {
      ctx.fillStyle = dim('#5a3f26'); roundRect(ctx, x - 2, y - 0.2, 4, 0.6, 0.3); ctx.fill();
      ctx.fillStyle = dim('#a07a4a'); ctx.beginPath(); ctx.ellipse(x + 2, y + 0.1, 0.12, 0.3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'cabin': {
      const w = 6, h = 3;
      ctx.fillStyle = dim('#6a4a2e'); ctx.fillRect(x - w / 2, y - 0.5, w, h + 0.5);
      ctx.strokeStyle = dim('#4a321e'); ctx.lineWidth = 0.08;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y + i * 0.5); ctx.lineTo(x + w / 2, y + i * 0.5); ctx.stroke(); }
      ctx.fillStyle = dim('#eef3f8'); polyPath(ctx, [[x - w / 2 - 0.6, y + h], [x, y + h + 2.2], [x + w / 2 + 0.6, y + h]]); ctx.fill();
      ctx.fillStyle = night ? '#e0a050' : '#222'; ctx.fillRect(x - 0.6, y + 1, 1.2, 1);
      if (night) { d.light = 1.5; d.lr = 5; d.flicker = true; }
      break;
    }
    case 'bunker': {
      ctx.fillStyle = dim('#6a6a5a');
      ctx.beginPath(); ctx.moveTo(x - 3, y - 0.3); ctx.lineTo(x - 2.4, y + 2); ctx.lineTo(x + 2.4, y + 2); ctx.lineTo(x + 3, y - 0.3); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(x - 1.2, y + 1, 2.4, 0.4);
      break;
    }
    case 'tank': {
      const w = 6 * s, h = 5 * s;
      ctx.fillStyle = dim('#8a8a86'); ctx.fillRect(x - w / 2, y - 0.3, w, h);
      ctx.beginPath(); ctx.ellipse(x, y + h - 0.3, w / 2, 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - w / 2, y + h * 0.4, w, 0.2);
      ctx.fillStyle = 'rgba(40,20,10,0.35)'; ctx.fillRect(x + w * 0.1, y - 0.3, w * 0.3, h * 0.6);
      break;
    }
    case 'pipe': {
      ctx.fillStyle = dim('#6a6a66');
      ctx.fillRect(x - 5, y + 2, 10, 0.5); ctx.fillRect(x - 4, y - 0.3, 0.25, 2.5); ctx.fillRect(x + 4, y - 0.3, 0.25, 2.5);
      break;
    }
    case 'flare': {
      ctx.fillStyle = dim('#555'); ctx.fillRect(x - 0.2, y - 0.3, 0.4, 12);
      d.light = 12.5; d.lr = 14; d.flicker = true;
      if (Math.random() < 0.5) R._flareFire = true;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const fh = 1.5 + Math.sin(t * 9 + i * 2) * 0.4 + i * 0.5;
        ctx.fillStyle = `rgba(255,${150 - i * 30},40,${0.45 - i * 0.08})`;
        ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 5 + i) * 0.2, y + 12 + fh * 0.6, 0.5 + i * 0.2, fh, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'jet': {
      ctx.fillStyle = dim('#5d666c');
      ctx.beginPath(); ctx.moveTo(x - 7, y + 0.8); ctx.lineTo(x + 6, y + 0.8); ctx.lineTo(x + 8, y + 1.3); ctx.lineTo(x + 5, y + 2); ctx.lineTo(x - 6, y + 2); ctx.lineTo(x - 7.5, y + 4); ctx.lineTo(x - 8, y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dim('#384046'); polyPath(ctx, [[x - 2, y + 1.4], [x + 2, y + 1.4], [x - 1, y + 0.6], [x - 4, y + 0.6]]); ctx.fill();
      ctx.fillStyle = dim('#1a2a33'); ctx.beginPath(); ctx.ellipse(x + 4, y + 2.0, 1.2, 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x - 3, y, 0.3, 0, Math.PI * 2); ctx.arc(x + 4, y, 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'deckmark': {
      ctx.fillStyle = 'rgba(240,210,60,0.5)';
      ctx.fillRect(x - 3, y - 0.05, 6, 0.08);
      break;
    }
    case 'gasstation': {
      ctx.fillStyle = dim('#ddd'); ctx.fillRect(x - 7, y + 4.5, 14, 0.8);
      ctx.fillStyle = dim('#c62828'); ctx.fillRect(x - 7, y + 4.3, 14, 0.3);
      ctx.fillStyle = dim('#888'); ctx.fillRect(x - 5, y - 0.3, 0.3, 4.8); ctx.fillRect(x + 4.7, y - 0.3, 0.3, 4.8);
      ctx.fillStyle = dim('#c62828'); roundRect(ctx, x - 1.8, y - 0.3, 1, 1.8, 0.1); ctx.fill(); roundRect(ctx, x + 0.8, y - 0.3, 1, 1.8, 0.1); ctx.fill();
      ctx.fillStyle = dim('#9a8a74'); ctx.fillRect(x + 8, y - 0.3, 8, 4);
      ctx.save(); ctx.translate(x, y + 4.9); ctx.scale(1, -1); ctx.fillStyle = '#c62828'; ctx.font = 'bold 0.6px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('АЗС', 0, 0); ctx.restore();
      if (night) { d.light = 4; d.lr = 10; d.flicker = true; }
      break;
    }
    case 'shipwreck': {
      ctx.fillStyle = dim('#4a3020');
      ctx.fillRect(x - 1, y, 0.35, 5);
      ctx.fillRect(x - 3, y + 3.5, 4, 0.15);
      ctx.strokeStyle = dim('#3a2a1a'); ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(x - 0.8, y + 5); ctx.lineTo(x - 5, y); ctx.stroke();
      break;
    }
    case 'piling': {
      ctx.fillStyle = dim('#4a3a2a');
      for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 1.6, -6, 0.35, 7 + (i % 2) * 0.8);
      ctx.fillRect(x - 0.3, 1.1, 4, 0.25);
      break;
    }
    case 'sunkenhouse': {
      const w = 7 * s;
      ctx.fillStyle = dim('#6d6a64'); ctx.fillRect(x - w / 2, -6, w, 9 * s);
      ctx.fillStyle = dim('#4a3a30'); polyPath(ctx, [[x - w / 2 - 0.4, 3 * s + (9 * s - 9)], [x, 5.5 * s + (9 * s - 9)], [x + w / 2 + 0.4, 3 * s + (9 * s - 9)]]); ctx.fill();
      ctx.fillStyle = night && d.seed % 3 === 0 ? '#e0b060' : '#1d2226';
      ctx.fillRect(x - w * 0.3, 1.5, 1.2, 1.2); ctx.fillRect(x + w * 0.1, 1.5, 1.2, 1.2);
      if (night && d.seed % 3 === 0) { d.light = 2; d.lr = 5; d.lx = -w * 0.3 + 0.6; }
      break;
    }
    case 'start': {
      // гараж старта
      ctx.fillStyle = dim('#6d6f70'); ctx.fillRect(x - 6, y - 0.3, 12, 4.5);
      ctx.fillStyle = dim('#8a8c8e'); ctx.fillRect(x - 6.3, y + 4.2, 12.6, 0.5);
      ctx.fillStyle = dim('#3a3d40'); ctx.fillRect(x - 4.5, y - 0.3, 9, 3.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.06;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - 4.5, y + 3.2 - i * 0.2); ctx.lineTo(x + 4.5, y + 3.2 - i * 0.2); ctx.stroke(); }
      ctx.save(); ctx.translate(x, y + 3.85); ctx.scale(1, -1); ctx.fillStyle = '#e0c060'; ctx.font = 'bold 0.5px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('СТАРТ', 0, 0); ctx.restore();
      break;
    }
    case 'startdock': {
      ctx.fillStyle = dim('#6a5a4a'); ctx.fillRect(-60, y + 1, 3, 6);
      ctx.fillStyle = dim('#8a7a6a'); ctx.fillRect(-58, y, 18, 3.5);
      ctx.fillStyle = dim('#4a3a2a'); polyPath(ctx, [[-59, y + 3.5], [-49, y + 5.5], [-39, y + 3.5]]); ctx.fill();
      break;
    }
    case 'finish': drawFinish(ctx, d, R, t, 'back'); break;
    case 'goal': drawGoal(ctx, d, R, t, dim); break;
    case 'goal_sea': drawGoalSea(ctx, d, R, t, dim); break;
  }
}

function drawGoal(ctx, d, R, t, dim) {
  const x = d.x, y = d.y;
  if (d.final) {
    // вертолётная площадка на носу корабля
    ctx.fillStyle = dim('#3a4046'); ctx.fillRect(x - 2, y - 0.3, 26, 6);
    ctx.fillStyle = dim('#505860'); ctx.fillRect(x - 2, y + 5.7, 26, 0.4);
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 0.25;
    ctx.beginPath(); ctx.arc(x + 11, y + 6.1, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(x + 11, y + 6.2); ctx.scale(1, 0.25);
    ctx.fillStyle = '#f0f0f0'; ctx.font = 'bold 5px Oswald, Impact'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.scale(1, -1); ctx.fillText('H', 0, 0); ctx.restore();
    // вертолёт
    const hx = x + 14, hy = y + 6.1;
    ctx.fillStyle = dim('#39463a');
    ctx.beginPath(); ctx.ellipse(hx, hy + 1.6, 3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(hx - 7, hy + 1.6, 5, 0.5);
    ctx.fillRect(hx - 7.3, hy + 1.6, 0.4, 1.4);
    ctx.fillStyle = 'rgba(150,200,230,0.6)'; ctx.beginPath(); ctx.ellipse(hx + 1.8, hy + 1.9, 1, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(hx - 2, hy + 0.1, 4, 0.12); ctx.fillRect(hx - 1.5, hy + 0.1, 0.12, 0.4); ctx.fillRect(hx + 1.4, hy + 0.1, 0.12, 0.4);
    ctx.fillRect(hx - 0.1, hy + 2.9, 0.2, 0.5);
    const blade = Math.cos(t * 25) * 5;
    ctx.fillStyle = 'rgba(20,20,20,0.7)'; ctx.fillRect(hx - Math.abs(blade), hy + 3.35, Math.abs(blade) * 2, 0.1);
    d.light = 6; d.lr = 12;
    return;
  }
  // арка финиша
  ctx.fillStyle = dim('#3a3a3a');
  ctx.fillRect(x - 6, y - 0.5, 0.5, 8); ctx.fillRect(x + 5.5, y - 0.5, 0.5, 8);
  ctx.fillStyle = dim('#1f1f1f'); ctx.fillRect(x - 6.3, y + 7, 12.6, 1.6);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#111' : '#eee';
    ctx.fillRect(x - 6 + i * 0.75, y + 7.1 + j * 0.7, 0.75, 0.7);
  }
  const lights = Math.floor(t * 4) % 2;
  for (let i = 0; i < 6; i++) { ctx.fillStyle = (i % 2) === lights ? '#ffda40' : '#6a5a20'; ctx.beginPath(); ctx.arc(x - 5 + i * 2, y + 8.9, 0.18, 0, Math.PI * 2); ctx.fill(); }
  // флаги
  for (const fx of [x - 6, x + 5.8]) {
    ctx.fillStyle = '#c62828';
    const wv = Math.sin(t * 5 + fx) * 0.2;
    ctx.beginPath(); ctx.moveTo(fx, y + 10.5); ctx.quadraticCurveTo(fx + 0.8, y + 10.2 + wv, fx + 1.6, y + 10 + wv); ctx.lineTo(fx, y + 9.4); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(fx - 0.05, y + 8.6, 0.1, 2);
  }
  d.light = 8; d.lr = 12;
}

function drawGoalSea(ctx, d, R, t, dim) {
  const x = d.x;
  if (d.level === 'chase') {
    // корма «Северной звезды» с аппарелью
    ctx.fillStyle = dim('#3c444a');
    ctx.beginPath(); ctx.moveTo(x - 2, -4); ctx.lineTo(x + 60, -4); ctx.lineTo(x + 60, 16); ctx.lineTo(x + 4, 16); ctx.lineTo(x - 2, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dim('#e8e8e8');
    ctx.save(); ctx.translate(x + 20, 12); ctx.scale(1, -1); ctx.font = 'bold 2px Oswald, Impact'; ctx.fillText('СЕВЕРНАЯ ЗВЕЗДА', 0, 0); ctx.restore();
    ctx.fillStyle = dim('#5a646a'); polyPath(ctx, [[x - 14, -1], [x, -1], [x, 3]]); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = night(R) ? '#ffd070' : '#222'; ctx.fillRect(x + 8 + i * 7, 7, 2, 1.5); }
    d.light = 6; d.lr = 18; d.lx = 5;
    return;
  }
  // ворота из буёв с флагами
  for (const bx of [x - 5, x + 5]) {
    ctx.fillStyle = '#d63a22'; polyPath(ctx, [[bx - 0.8, -0.8], [bx + 0.8, -0.8], [bx + 0.4, 2.5], [bx - 0.4, 2.5]]); ctx.fill();
    ctx.fillStyle = '#eee'; ctx.fillRect(bx - 0.6, 0.5, 1.2, 0.5);
    ctx.fillStyle = '#333'; ctx.fillRect(bx - 0.06, 2.5, 0.12, 4);
  }
  ctx.fillStyle = '#111'; ctx.fillRect(x - 5, 6.2, 10, 0.1);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#111' : '#eee'; polyPath(ctx, [[x - 5 + i * 0.83, 6.2], [x - 5 + (i + 1) * 0.83, 6.2], [x - 5 + (i + 0.5) * 0.83, 5.4]]); ctx.fill(); }
  // маяк
  ctx.fillStyle = dim('#d8d8d8'); polyPath(ctx, [[x + 12, -2], [x + 16, -2], [x + 15, 16], [x + 13, 16]]); ctx.fill();
  ctx.fillStyle = dim('#c62828'); ctx.fillRect(x + 12.6, 4, 2.8, 2); ctx.fillRect(x + 13, 10, 2, 2);
  ctx.fillStyle = '#ffe890'; ctx.fillRect(x + 12.8, 16, 2.4, 1.5);
  const a = t * 1.2;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,240,180,0.15)';
  ctx.beginPath(); ctx.moveTo(x + 14, 16.7); ctx.lineTo(x + 14 + Math.cos(a) * 40, 16.7 + 3); ctx.lineTo(x + 14 + Math.cos(a) * 40, 16.7 - 3); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  d.light = 16.7; d.lr = 14; d.lx = 14;
}
function night(R) { return R.night; }
