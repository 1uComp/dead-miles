'use strict';
/* Погода: дождь, ливень с грозой, снег, пепел, пыль.
   Частицы живут в слоях глубины перед камерой: сдвиг каждого слоя зависит от реального
   движения камеры (параллакс), черта капли — её траектория за время «выдержки» кадра,
   поэтому на месте дождь падает почти отвесно, а на скорости косо летит навстречу. */

class WeatherFX {
  constructor() {
    this.drops = [];
    this.splashes = [];
    this.bolts = [];
    this.game = null;
    this.kind = null;
    this.prevCamX = 0; this.prevCamY = 0;
    this.nextBolt = 4;
  }

  _reset(game, kind, W, H) {
    this.game = game; this.kind = kind;
    this.drops.length = 0; this.splashes.length = 0; this.bolts.length = 0;
    this.prevCamX = game.camX; this.prevCamY = game.camY;
    const N = { rain: 750, storm: 1150, snow: 420, ash: 260, dust: 160 }[kind] || 0;
    for (let i = 0; i < N; i++) this.drops.push(this._newDrop(W, H, true));
    this.nextBolt = 3 + Math.random() * 6;
  }

  _newDrop(W, H, anywhere) {
    const z = Math.pow(Math.random(), 0.8);                // больше дальних капель
    return {
      x: Math.random() * (W + 300) - 150,
      y: anywhere ? Math.random() * (H + 200) - 150 : -20 - Math.random() * 160,
      z, sp: 0.85 + Math.random() * 0.3, ph: Math.random() * 100,
      vx: 0, vy: 0, py: 0, hot: Math.random() < 0.3
    };
  }

  // параметры погоды во времени: порывы ветра и волны интенсивности
  _wind(t) {
    if (this.kind === 'storm') return -6 + Math.sin(t * 0.37) * 3 + Math.sin(t * 1.3 + 2) * 1.2;
    if (this.kind === 'rain') return -1.4 + Math.sin(t * 0.23) * 0.9;
    if (this.kind === 'snow') return -0.8 + Math.sin(t * 0.3) * 0.8;
    if (this.kind === 'dust') return -11 + Math.sin(t * 0.5) * 4;
    if (this.kind === 'ash') return -0.6 + Math.sin(t * 0.2) * 0.5;
    return 0;
  }
  _intensity(t) {
    if (this.kind === 'storm') return 0.82 + 0.18 * Math.sin(t * 0.19 + 1);
    if (this.kind === 'rain') return 0.7 + 0.3 * Math.sin(t * 0.13 + 2);
    return 1;
  }

  draw(ctx, R, game, t) {
    const kind = R.def.weather;
    const W = R.W, H = R.H, S = R.S, dpr = R.dpr;
    if (kind !== 'rain' && kind !== 'storm' && kind !== 'snow' && kind !== 'ash' && kind !== 'dust') return;
    if (this.game !== game || this.kind !== kind) this._reset(game, kind, W, H);
    const dt = Math.min(0.05, game.frameDt || 0);
    // смещение камеры за кадр (без тряски — капли не должны дёргаться)
    let camDx = game.camX - this.prevCamX, camDy = game.camY - this.prevCamY;
    this.prevCamX = game.camX; this.prevCamY = game.camY;
    if (Math.abs(camDx) > 50 || Math.abs(camDy) > 50) { camDx = 0; camDy = 0; }  // рестарт/телепорт
    const wind = this._wind(t), inten = this._intensity(t);
    const q = R.quality >= 1 ? 1 : 0.55;
    const active = Math.floor(this.drops.length * inten * q);

    if (kind === 'rain' || kind === 'storm') this._rain(ctx, R, game, t, dt, camDx, camDy, wind, active);
    else if (kind === 'snow') this._flakes(ctx, R, t, dt, camDx, camDy, wind, active, 'snow');
    else if (kind === 'ash') this._flakes(ctx, R, t, dt, camDx, camDy, wind, active, 'ash');
    else if (kind === 'dust') this._dust(ctx, R, t, dt, camDx, camDy, wind, active);

    if (kind === 'storm') this._lightning(ctx, R, game, t, dt);
    if (AUDIO.rainNode && (kind === 'rain' || kind === 'storm')) AUDIO.setRain(inten, kind === 'storm', wind);
  }

  /* ------------------------------ дождь ------------------------------ */
  _rain(ctx, R, game, t, dt, camDx, camDy, wind, active) {
    const W = R.W, H = R.H, S = R.S, dpr = R.dpr;
    const storm = this.kind === 'storm';
    const night = R.night;
    const T = game.world.terrain, Wt = game.world.water;
    const exposure = 0.036;
    const fall = storm ? 17 : 15;
    // фары: освещённые капли вспыхивают
    let hl = null;
    const v = game.vehicle;
    if (night && v && !game.demo) {
      const c = v.chassis;
      const front = v.type === 'bike' ? c.worldPoint(0.75, 0.7) : v.type === 'boat' ? c.worldPoint(v.def.hull[0][3][0] - 0.5, 0.9) : c.worldPoint(v.def.look.front - 0.05, v.def.look.belt - 0.12);
      hl = { x: W / 2 + (front.x - R.camX) * S, y: H / 2 - (front.y - R.camY) * S, cos: Math.cos(c.a), sin: -Math.sin(c.a), len: 22 * S };
    }
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    const lit = new Path2D();
    let litCount = 0;
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      // параллакс слоя: капли у самой камеры смещаются сильнее и кажутся падающими намного быстрее дальних
      const p = 0.35 + 0.9 * d.z;
      const pv = 0.55 + 2.1 * d.z;
      if (dt > 0) {
        const dx = wind * S * p * dt - camDx * S * p;
        const dy = fall * d.sp * S * pv * dt + camDy * S * p;
        d.vx = dx / dt; d.vy = dy / dt;
        d.py = d.y;
        d.x += dx; d.y += dy;
      }
      // черта = путь капли за выдержку (относительно камеры)
      let lx = d.vx * exposure, ly = d.vy * exposure;
      const L = Math.hypot(lx, ly);
      const maxL = (40 + 60 * d.z) * dpr, minL = (5 + 10 * d.z) * dpr;
      if (L > maxL) { lx *= maxL / L; ly *= maxL / L; }
      else if (L < minL && L > 0) { lx *= minL / L; ly *= minL / L; }
      // ближний слой разбивается о землю или воду
      if (d.z > 0.62 && dt > 0) {
        const wx = R.camX + (d.x - W / 2) / S;
        const gy = Wt ? H / 2 - (Wt.height(wx, game.world.time) - R.camY) * S : H / 2 - (T.heightAt(wx) - R.camY) * S;
        if (d.py < gy && d.y >= gy) {
          if (this.splashes.length < 160 && d.x > -20 && d.x < W + 20) this._splash(d.x, gy, d.z, !!Wt, dpr, wind * S * p);
          Object.assign(d, this._newDrop(W, H, false));
          continue;
        }
      }
      // выход за экран: переносим, сохраняя плотность при быстром движении камеры
      if (d.y - ly > H + 30) { Object.assign(d, this._newDrop(W, H, false)); continue; }
      if (d.y < -260) d.y += H + 240;
      if (d.x < -160) d.x += W + 320;
      else if (d.x > W + 160) d.x -= W + 320;
      let bin = d.z < 0.35 ? 0 : d.z < 0.7 ? 1 : 2;
      let target = paths[bin];
      if (hl) {
        const rx = d.x - hl.x, ry = d.y - hl.y;
        const along = rx * hl.cos + ry * hl.sin, across = -rx * hl.sin + ry * hl.cos;
        if (along > 0 && along < hl.len && across > -along * 0.34 && across < along * 0.22) { target = lit; litCount++; }
      }
      target.moveTo(d.x, d.y);
      target.lineTo(d.x - lx, d.y - ly);
    }
    ctx.save();
    ctx.lineCap = 'round';
    const base = night ? [160, 175, 195] : [210, 222, 236];
    const layers = [[0.14, 0.8], [0.24, 1.2], [0.36, 1.8]];
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${layers[b][0] * (storm ? 1.15 : 1)})`;
      ctx.lineWidth = layers[b][1] * dpr;
      ctx.stroke(paths[b]);
    }
    if (litCount) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,245,215,0.55)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke(lit);
      ctx.globalCompositeOperation = 'source-over';
    }
    // брызги
    let w = 0;
    for (const s of this.splashes) {
      if (dt > 0) {
        s.age += dt;
        s.x -= camDx * S; s.y += camDy * S;
        for (const p of s.drops) { p.vy += 1400 * dpr * dt; p.x += (p.vx - camDx * S / Math.max(dt, 1e-4)) * dt; p.y += p.vy * dt; }
      }
      if (s.age >= s.life) continue;
      const k = s.age / s.life;
      if (s.water) {
        ctx.strokeStyle = `rgba(215,232,245,${0.45 * (1 - k)})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.3 + k * 1.6), s.r * 0.3 * (0.3 + k * 1.6), 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(215,228,240,${0.6 * (1 - k)})`;
        for (const p of s.drops) ctx.fillRect(p.x - 0.8 * dpr, p.y - 0.8 * dpr, 1.6 * dpr, 1.6 * dpr);
        ctx.strokeStyle = `rgba(215,228,240,${0.35 * (1 - k)})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.5 + k), s.r * 0.18 * (0.5 + k), 0, Math.PI, 0); ctx.stroke();
      }
      this.splashes[w++] = s;
    }
    this.splashes.length = w;
    ctx.restore();
    // лёгкая сырость в воздухе: пелена у земли и затемнение
    ctx.fillStyle = storm ? 'rgba(25,32,42,0.1)' : 'rgba(40,50,62,0.06)';
    ctx.fillRect(0, 0, W, H);
    const mist = ctx.createLinearGradient(0, H * 0.55, 0, H);
    mist.addColorStop(0, 'rgba(190,205,220,0)');
    mist.addColorStop(1, `rgba(190,205,220,${storm ? 0.12 : 0.07})`);
    ctx.fillStyle = mist; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }

  _splash(x, y, z, water, dpr, windPx) {
    const r = (3 + 5 * z) * dpr;
    const s = { x, y, r, water, age: 0, life: water ? 0.45 : 0.22, drops: [] };
    if (!water) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = (60 + Math.random() * 90) * dpr * (0.5 + z);
        s.drops.push({ x, y, vx: Math.cos(a) * sp + windPx * 0.3, vy: Math.sin(a) * sp });
      }
    }
    this.splashes.push(s);
  }

  /* ------------------------------ молнии ------------------------------ */
  _lightning(ctx, R, game, t, dt) {
    const W = R.W, H = R.H, dpr = R.dpr;
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 5 + Math.random() * 9;
      // главный разряд с ответвлениями
      const x0 = W * (0.15 + Math.random() * 0.7);
      const pts = [[x0, -10]];
      let x = x0, y = -10;
      const bottom = H * (0.35 + Math.random() * 0.2);
      const branches = [];
      while (y < bottom) {
        x += (Math.random() - 0.5) * 38 * dpr;
        y += (10 + Math.random() * 22) * dpr;
        pts.push([x, y]);
        if (Math.random() < 0.18) {
          const br = [[x, y]];
          let bx = x, by = y, dir = Math.random() < 0.5 ? -1 : 1;
          for (let k = 0; k < 4 + Math.random() * 5; k++) { bx += dir * (8 + Math.random() * 22) * dpr; by += (8 + Math.random() * 16) * dpr; br.push([bx, by]); }
          branches.push(br);
        }
      }
      this.bolts.push({ pts, branches, age: 0, life: 0.28 });
      R.flash = 0.9;
      AUDIO.thunder();
    }
    R.flash = Math.max(0, (R.flash || 0) - dt * 3);
    if (R.flash > 0) { ctx.fillStyle = `rgba(215,225,255,${R.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
    let w = 0;
    for (const b of this.bolts) {
      b.age += dt;
      if (b.age >= b.life) continue;
      // вспышка мерцает 2–3 раза, как настоящий разряд
      const flick = Math.sin(b.age * 60) > -0.2 ? 1 : 0.25;
      const a = (1 - b.age / b.life) * flick;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const stroke = (list, wd, alpha) => {
        ctx.strokeStyle = `rgba(200,215,255,${alpha})`; ctx.lineWidth = wd;
        ctx.beginPath(); list.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      };
      stroke(b.pts, 9 * dpr, 0.12 * a);
      stroke(b.pts, 3 * dpr, 0.5 * a);
      stroke(b.pts, 1.4 * dpr, 0.95 * a);
      for (const br of b.branches) { stroke(br, 4 * dpr, 0.12 * a); stroke(br, 1 * dpr, 0.7 * a); }
      ctx.restore();
      this.bolts[w++] = b;
    }
    this.bolts.length = w;
  }

  /* ------------------------------ снег и пепел ------------------------------ */
  _flakes(ctx, R, t, dt, camDx, camDy, wind, active, type) {
    const W = R.W, H = R.H, S = R.S, dpr = R.dpr;
    const snow = type === 'snow';
    const fall = snow ? 1.3 : 0.7;
    ctx.save();
    if (!snow) ctx.globalCompositeOperation = 'source-over';
    const embers = [];
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      const p = 0.35 + 1.1 * d.z;
      if (dt > 0) {
        const sway = Math.sin(t * (0.9 + d.sp) + d.ph) * (snow ? 0.9 : 0.6);
        d.x += (wind + sway) * S * p * dt - camDx * S * p;
        d.y += (snow ? fall * d.sp : (d.hot ? -0.5 : fall * d.sp)) * S * p * dt + camDy * S * p;
      }
      if (d.y > H + 20) { d.y = -20 - Math.random() * 60; d.x = Math.random() * (W + 300) - 150; }
      if (d.y < -300) { d.y = H + 10; d.x = Math.random() * (W + 300) - 150; }
      if (d.x < -160) d.x += W + 320; else if (d.x > W + 160) d.x -= W + 320;
      const size = (snow ? 1.1 + 2.6 * d.z : 0.8 + 1.8 * d.z) * dpr;
      if (snow) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.55 * d.z})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, size, 0, Math.PI * 2); ctx.fill();
      } else if (d.hot) embers.push(d, size);
      else {
        ctx.fillStyle = `rgba(60,52,48,${0.35 + 0.4 * d.z})`;
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(t * d.sp + d.ph);
        ctx.fillRect(-size, -size * 0.5, size * 2, size); ctx.restore();
      }
    }
    if (embers.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i += 2) {
        const d = embers[i], size = embers[i + 1];
        const glow = 0.5 + 0.5 * Math.sin(t * 7 + d.ph);
        ctx.fillStyle = `rgba(255,${130 + glow * 70},50,${0.5 + 0.4 * glow})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, size * 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  _dust(ctx, R, t, dt, camDx, camDy, wind, active) {
    const W = R.W, H = R.H, S = R.S, dpr = R.dpr;
    ctx.save();
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      const p = 0.35 + 1.1 * d.z;
      if (dt > 0) {
        d.x += wind * d.sp * S * p * dt - camDx * S * p;
        d.y += Math.sin(t * 1.5 + d.ph) * 12 * dpr * dt + camDy * S * p;
      }
      if (d.x < -300) { d.x += W + 600; d.y = Math.random() * H; }
      else if (d.x > W + 300) { d.x -= W + 600; d.y = Math.random() * H; }
      if (d.y < -60) d.y += H + 120; else if (d.y > H + 60) d.y -= H + 120;
      const len = (30 + 70 * d.z) * dpr;
      ctx.fillStyle = `rgba(215,185,135,${0.05 + 0.1 * d.z})`;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, len, (3 + 5 * d.z) * dpr, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(210,170,110,0.12)'; ctx.fillRect(0, 0, W, H);
  }
}
