'use strict';
/* Приборная панель: стрелочный спидометр, тахометр и указатель топлива.
   Статичные циферблаты рисуются один раз в кэш, стрелки — каждый кадр
   с инерцией (стрелка догоняет значение, слегка проскакивает и дрожит от мотора). */

const KMH = 3.6, KNOTS = 1.9438;

class InstrumentCluster {
  constructor() {
    this.cache = new Map();
    this.speed = { pos: 0, vel: 0 };
    this.tach = { pos: 0, vel: 0 };
    this.fuel = { pos: 1, vel: 0 };
    this.vehicle = null;
    this.odo = 0;
  }

  reset(vehicle) {
    this.vehicle = vehicle;
    this.speed.pos = 0; this.speed.vel = 0;
    this.tach.pos = 0.8; this.tach.vel = 0;
    this.fuel.pos = vehicle.fuel / vehicle.fuelMax; this.fuel.vel = 0;
  }

  // пружинная стрелка: k — жёсткость, c — демпфирование (слегка недодемпфирована, как у настоящей)
  _spring(s, target, dt, k, c) {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    if (!isFinite(target)) target = 0;
    if (!isFinite(s.pos) || !isFinite(s.vel)) { s.pos = target; s.vel = 0; }
    for (let i = 0; i < steps; i++) {
      s.vel += ((target - s.pos) * k - s.vel * c) * h;
      s.pos += s.vel * h;
    }
  }

  /* ------------------------------ кэш циферблатов ------------------------------ */
  _face(key, size, painter) {
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size);
      painter(c.getContext('2d'), size / 2);
      this.cache.set(key, c);
      if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
    }
    return c;
  }

  _bezel(g, R, rf) {
    // хромированный ободок
    const cx = R, cy = R;
    const ring = g.createLinearGradient(0, 0, R * 2, R * 2);
    ring.addColorStop(0, '#f4f6f8'); ring.addColorStop(0.25, '#8b9197'); ring.addColorStop(0.5, '#e3e6e9');
    ring.addColorStop(0.75, '#5b6167'); ring.addColorStop(1, '#c9cdd1');
    g.fillStyle = ring;
    g.beginPath(); g.arc(cx, cy, R - 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0a0b0c';
    g.beginPath(); g.arc(cx, cy, rf + R * 0.025, 0, Math.PI * 2); g.fill();
    // циферблат
    const face = g.createRadialGradient(cx, cy - rf * 0.3, rf * 0.1, cx, cy, rf);
    face.addColorStop(0, '#24282d'); face.addColorStop(0.7, '#15181b'); face.addColorStop(1, '#08090a');
    g.fillStyle = face;
    g.beginPath(); g.arc(cx, cy, rf, 0, Math.PI * 2); g.fill();
    // тонкие концентрические «проточки»
    g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 1;
    for (let r = rf * 0.2; r < rf; r += rf * 0.045) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  }

  _scale(g, R, rf, o) {
    const cx = R, cy = R;
    const { a0, sweep, max, major, minor, micro, labelScale, night, redFrom, fontK } = o;
    const glow = night ? '#ffd9a8' : '#f1f3f5';
    if (night) { g.shadowColor = 'rgba(255,170,90,0.85)'; g.shadowBlur = rf * 0.06; }
    // красная зона
    if (redFrom !== undefined && redFrom < max) {
      g.strokeStyle = '#d8281c'; g.lineWidth = rf * 0.07;
      g.beginPath(); g.arc(cx, cy, rf * 0.86, a0 + sweep * redFrom / max, a0 + sweep); g.stroke();
    }
    const tick = (val, len, w, col) => {
      const a = a0 + sweep * val / max;
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rf * (0.93 - len), cy + Math.sin(a) * rf * (0.93 - len));
      g.lineTo(cx + Math.cos(a) * rf * 0.93, cy + Math.sin(a) * rf * 0.93);
      g.stroke();
    };
    if (micro) for (let v = 0; v <= max + 1e-6; v += micro) tick(v, 0.05, Math.max(1, rf * 0.008), 'rgba(230,232,235,0.55)');
    for (let v = 0; v <= max + 1e-6; v += minor) tick(v, 0.09, Math.max(1.2, rf * 0.014), redFrom !== undefined && v >= redFrom ? '#ffb3aa' : 'rgba(240,242,245,0.8)');
    g.font = `600 ${Math.round(rf * fontK)}px Oswald, 'Arial Narrow', Impact, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= max + 1e-6; v += major) {
      const hot = redFrom !== undefined && v >= redFrom;
      tick(v, 0.15, Math.max(2, rf * 0.026), hot ? '#ff5a4a' : glow);
      const a = a0 + sweep * v / max;
      g.fillStyle = hot ? '#ff6b5c' : glow;
      g.fillText(String(Math.round(v * labelScale)), cx + Math.cos(a) * rf * 0.64, cy + Math.sin(a) * rf * 0.64);
    }
    g.shadowBlur = 0;
  }

  _glass(ctx, cx, cy, rf) {
    // блик на стекле
    const gl = ctx.createLinearGradient(cx - rf, cy - rf, cx + rf * 0.2, cy + rf * 0.4);
    gl.addColorStop(0, 'rgba(255,255,255,0.13)'); gl.addColorStop(0.45, 'rgba(255,255,255,0.03)'); gl.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(cx, cy, rf, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = Math.max(1, rf * 0.02);
    ctx.beginPath(); ctx.arc(cx, cy, rf * 0.97, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  }

  _needle(ctx, cx, cy, rf, a, len, u, color) {
    const tail = rf * 0.2, w = Math.max(2.2, rf * 0.035);
    const draw = (ox, oy, fill) => {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(a);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(-tail, -w * 0.9);
      ctx.lineTo(rf * len, -w * 0.22);
      ctx.lineTo(rf * len + w * 0.6, 0);
      ctx.lineTo(rf * len, w * 0.22);
      ctx.lineTo(-tail, w * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    draw(2.5 * u, 3.5 * u, 'rgba(0,0,0,0.45)');           // тень на циферблате
    draw(0, 0, color);
    // светлая сердцевина стрелки
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,230,200,0.55)'; ctx.lineWidth = Math.max(1, w * 0.25);
    ctx.beginPath(); ctx.moveTo(rf * 0.1, 0); ctx.lineTo(rf * len * 0.97, 0); ctx.stroke();
    ctx.restore();
    // хромированный колпачок оси
    const cap = ctx.createRadialGradient(cx - rf * 0.03, cy - rf * 0.04, rf * 0.01, cx, cy, rf * 0.11);
    cap.addColorStop(0, '#f6f7f8'); cap.addColorStop(0.5, '#6d737a'); cap.addColorStop(1, '#1b1e21');
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(cx, cy, rf * 0.105, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0d0e';
    ctx.beginPath(); ctx.arc(cx, cy, rf * 0.035, 0, Math.PI * 2); ctx.fill();
  }

  _lamp(ctx, x, y, s, on, color, icon) {
    ctx.save();
    ctx.translate(x, y);
    if (on) { ctx.shadowColor = color; ctx.shadowBlur = s * 1.2; }
    ctx.fillStyle = on ? color : 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = on ? color : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = Math.max(1, s * 0.14);
    icon(ctx, s);
    ctx.restore();
  }

  /* ------------------------------ панель ------------------------------ */
  draw(ctx, W, H, u, game, night, font) {
    const v = game.vehicle;
    if (!v) return;
    if (this.vehicle !== v) this.reset(v);
    const dt = Math.min(0.05, game.frameDt || 0.016);
    const t = game.world.time;
    const boat = v.type === 'boat';
    const unit = boat ? KNOTS : KMH;
    const def = v.def;
    // шкала под паспортную скорость с полной прокачкой
    const passMax = def.topSpeed * (1 + 0.07 * 5 + 0.03 * 4) * unit;
    const step = boat ? 10 : 20;
    const max = Math.max(step * 6, Math.ceil(passMax * 1.12 / step) * step);

    // --- расчёт стрелок ---
    const speedVal = Math.abs(v.forwardSpeed()) * unit;
    const vib = v.fuel > 0 ? Math.sin(t * (40 + v.rpm * 90)) * v.rpm * max * 0.0025 : 0;
    this._spring(this.speed, Math.min(speedVal, max * 1.035), dt, 55, 10.5);
    const sp = Math.max(-max * 0.01, Math.min(max * 1.04, this.speed.pos + vib));
    // у машины — настоящие обороты коленвала и своя красная зона; у байка и лодки — условные
    const real = !!v.dt;
    const tMax = real ? Math.ceil(v.dt.redline / 1000 + 1) : 8;
    const redFrom = real ? v.dt.redline / 1000 : 6.5;
    const rpmTarget = real ? (v.rpmReal || 0) / 1000 : (v.fuel > 0 || v.rpm > 0.02 ? 0.75 + v.rpm * 6.6 : 0);
    const limiter = !real && v.rpm > 0.97 ? Math.sin(t * 38) * 0.25 : 0;
    this._spring(this.tach, rpmTarget + limiter, dt, 170, 20);
    const rpmVal = Math.max(0, Math.min(tMax + 0.2, this.tach.pos + Math.sin(t * 70) * 0.02 * v.rpm));

    const R = 104 * u, rf = R * 0.86;
    const scx = W - 128 * u, scy = H - 120 * u;
    const TR = 72 * u, trf = TR * 0.86;
    const tcx = scx - R - TR * 0.78, tcy = H - 92 * u;
    const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;

    // --- тахометр (рисуется первым: спидометр крупнее и лежит поверх его ободка) ---
    const tKey = `tach|${Math.round(TR)}|${night ? 1 : 0}|${tMax}|${redFrom}`;
    const tFace = this._face(tKey, TR * 2, (g, rr) => {
      this._bezel(g, rr, trf);
      this._scale(g, rr, trf, { a0, sweep, max: tMax, major: 1, minor: 0.5, micro: 0, labelScale: 1, night, redFrom, fontK: 0.2 });
      g.fillStyle = night ? '#ffcf9a' : '#b9bec3';
      g.font = `500 ${Math.round(trf * 0.11)}px Oswald, 'Arial Narrow', sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('×1000', rr, rr - trf * 0.3);
      g.fillText('ОБ/МИН', rr, rr - trf * 0.17);
    });
    ctx.drawImage(tFace, tcx - TR, tcy - TR, TR * 2, TR * 2);
    // контрольные лампы внизу тахометра, между цифрами «0» и максимумом
    {
      const ls = trf * 0.11, ly = tcy + trf * 0.66;
      const car = !!v.dmg;
      const sp = car ? ls * 1.75 : ls * 2.1;
      const xs = car ? [-2, -1, 0, 1, 2].map(i => tcx + i * sp) : [tcx - sp, tcx, tcx + sp];
      const low = v.fuelMax > 0 && v.fuel / v.fuelMax < 0.2 && (v.fuel <= 0 || Math.sin(t * 6) > -0.3);
      this._lamp(ctx, xs[0], ly, ls, low, '#ffae1a', (c, s) => {
        c.fillRect(-s * 0.45, -s * 0.6, s * 0.6, s * 1.1);
        c.beginPath(); c.moveTo(s * 0.15, -s * 0.35); c.lineTo(s * 0.5, -s * 0.2); c.lineTo(s * 0.5, s * 0.35); c.stroke();
      });
      this._lamp(ctx, xs[1], ly, ls, v.boosting, '#3aa8ff', (c, s) => {
        c.beginPath(); c.moveTo(-s * 0.6, s * 0.4); c.lineTo(0, -s * 0.6); c.lineTo(s * 0.6, s * 0.4); c.closePath(); c.fill();
      });
      if (car) {
        // «проверь двигатель»: горит при повреждении мотора, мигает при перебоях
        const eng = v.dmg.engine > 0.3 && (v.dt.misfire <= 0 || Math.sin(t * 30) > 0);
        this._lamp(ctx, xs[2], ly, ls, eng, '#ff9a1a', (c, s) => {
          c.fillRect(-s * 0.45, -s * 0.3, s * 0.8, s * 0.6);
          c.fillRect(-s * 0.2, -s * 0.5, s * 0.35, s * 0.2);
          c.fillRect(-s * 0.7, -s * 0.12, s * 0.25, s * 0.24);
          c.fillRect(s * 0.35, -s * 0.2, s * 0.25, s * 0.4);
        });
        // антиблокировка / антипробуксовка — вспыхивает, когда система работает
        const slipOn = (v.absActive || v.tcsActive) && Math.sin(t * 24) > -0.2;
        this._lamp(ctx, xs[3], ly, ls, slipOn, '#ffcf1a', (c, s) => {
          c.beginPath(); c.arc(0, -s * 0.05, s * 0.5, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
          c.fillRect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.35);
          c.beginPath(); c.moveTo(-s * 0.55, s * 0.45); c.lineTo(-s * 0.3, s * 0.65); c.lineTo(-s * 0.05, s * 0.45); c.lineTo(s * 0.2, s * 0.65); c.lineTo(s * 0.45, s * 0.45); c.stroke();
        });
      }
      this._lamp(ctx, xs[xs.length - 1], ly, ls, night, '#3ddc6a', (c, s) => {
        c.beginPath(); c.arc(-s * 0.1, 0, s * 0.45, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.fill();
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(s * 0.15, i * s * 0.3); c.lineTo(s * 0.65, i * s * 0.3); c.stroke(); }
      });
    }
    this._needle(ctx, tcx, tcy, trf, a0 + sweep * rpmVal / tMax, 0.88, u, '#ff4d1a');
    this._glass(ctx, tcx, tcy, trf);

    // --- спидометр ---
    const sKey = `spd|${Math.round(R)}|${max}|${night ? 1 : 0}|${boat ? 1 : 0}`;
    const sFace = this._face(sKey, R * 2, (g, rr) => {
      this._bezel(g, rr, rf);
      const big = max > 160;
      this._scale(g, rr, rf, { a0, sweep, max, major: step, minor: step / 2, micro: big ? 0 : step / 4, labelScale: 1, night, fontK: max >= 200 ? 0.13 : 0.15 });
      g.fillStyle = night ? '#ffcf9a' : '#b9bec3';
      g.font = `500 ${Math.round(rf * 0.1)}px Oswald, 'Arial Narrow', sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(boat ? 'УЗЛЫ' : 'КМ/Ч', rr, rr - rf * 0.3);
    });
    ctx.drawImage(sFace, scx - R, scy - R, R * 2, R * 2);
    // ЖК-окошко: передача и одометр заезда — внизу циферблата, между «0» и последней цифрой
    {
      const lw = rf * 0.6, lh = rf * 0.22, lx = scx - lw / 2, ly = scy + rf * 0.55;
      ctx.fillStyle = '#050605';
      roundRect(ctx, lx - 2 * u, ly - 2 * u, lw + 4 * u, lh + 4 * u, 4 * u); ctx.fill();
      const lcd = ctx.createLinearGradient(0, ly, 0, ly + lh);
      lcd.addColorStop(0, night ? '#2b1d0c' : '#1d2a22'); lcd.addColorStop(1, night ? '#140d05' : '#0d1510');
      ctx.fillStyle = lcd;
      roundRect(ctx, lx, ly, lw, lh, 3 * u); ctx.fill();
      const lcdCol = night ? '#ffb45a' : '#9dffc2';
      ctx.fillStyle = lcdCol;
      ctx.shadowColor = lcdCol; ctx.shadowBlur = 5 * u;
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(lh * 0.82)}px 'Courier New', Consolas, monospace`;
      ctx.textAlign = 'left';
      let gearTxt;
      if (boat) gearTxt = v.propSubmerged ? '≈' : '↑';
      else if (v.dt) gearTxt = v.gear < 0 ? 'R' : v.rpmReal < 1 ? 'N' : String(v.gear);
      else if (v.forwardSpeed() < -0.5) gearTxt = 'R';
      else gearTxt = v.rpm < 0.1 && speedVal < 1 ? 'N' : String(v.gear);
      ctx.fillText(gearTxt, lx + lw * 0.07, ly + lh * 0.56);
      ctx.textAlign = 'right';
      ctx.font = `700 ${Math.round(lh * 0.55)}px 'Courier New', Consolas, monospace`;
      const km = Math.max(0, game.distance) / 1000;
      ctx.fillText(km.toFixed(2), lx + lw * 0.74, ly + lh * 0.56);
      ctx.font = `600 ${Math.round(lh * 0.38)}px 'Courier New', Consolas, monospace`;
      ctx.fillText('км', lx + lw * 0.95, ly + lh * 0.62);
      ctx.shadowBlur = 0;
    }
    this._needle(ctx, scx, scy, rf, a0 + sweep * sp / max, 0.9, u, '#ff4d1a');
    this._glass(ctx, scx, scy, rf);
  }

  /* ------------------------------ топливо ------------------------------ */
  drawFuel(ctx, cx, cy, u, game, night) {
    const v = game.vehicle;
    if (!v) return;
    const dt = Math.min(0.05, game.frameDt || 0.016);
    const k = v.fuelMax > 0 ? clamp(v.fuel / v.fuelMax, 0, 1) : 0;
    // указатель топлива медленный и сильно задемпфированный, как настоящий
    this._spring(this.fuel, k, dt, 9, 6);
    const R = 62 * u, rf = R * 0.86;
    const a0 = Math.PI * 1.2, sweep = Math.PI * 0.6;
    const key = `fuel|${Math.round(R)}|${night ? 1 : 0}`;
    const face = this._face(key, R * 2, (g, rr) => {
      this._bezel(g, rr, rf);
      const glow = night ? '#ffd9a8' : '#f1f3f5';
      if (night) { g.shadowColor = 'rgba(255,170,90,0.85)'; g.shadowBlur = rf * 0.06; }
      g.strokeStyle = '#d8281c'; g.lineWidth = rf * 0.08;
      g.beginPath(); g.arc(rr, rr, rf * 0.8, a0, a0 + sweep * 0.18); g.stroke();
      for (let i = 0; i <= 8; i++) {
        const a = a0 + sweep * i / 8;
        const major = i % 4 === 0;
        g.strokeStyle = i <= 1 ? '#ff6b5c' : glow; g.lineWidth = major ? rf * 0.035 : rf * 0.018;
        g.beginPath();
        g.moveTo(rr + Math.cos(a) * rf * (major ? 0.62 : 0.72), rr + Math.sin(a) * rf * (major ? 0.62 : 0.72));
        g.lineTo(rr + Math.cos(a) * rf * 0.9, rr + Math.sin(a) * rf * 0.9);
        g.stroke();
      }
      g.font = `700 ${Math.round(rf * 0.24)}px Oswald, 'Arial Narrow', sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ff6b5c'; g.fillText('E', rr + Math.cos(a0) * rf * 0.42, rr + Math.sin(a0) * rf * 0.42);
      g.fillStyle = glow; g.fillText('F', rr + Math.cos(a0 + sweep) * rf * 0.42, rr + Math.sin(a0 + sweep) * rf * 0.42);
      // значок колонки
      g.fillStyle = glow;
      const px = rr - rf * 0.12, py = rr + rf * 0.28, s = rf * 0.22;
      g.fillRect(px, py, s * 0.7, s * 1.1);
      g.fillStyle = '#15181b'; g.fillRect(px + s * 0.12, py + s * 0.12, s * 0.46, s * 0.3);
      g.strokeStyle = glow; g.lineWidth = rf * 0.03;
      g.beginPath(); g.moveTo(px + s * 0.7, py + s * 0.25); g.lineTo(px + s * 1.0, py + s * 0.4); g.lineTo(px + s * 1.0, py + s * 0.95); g.stroke();
      g.shadowBlur = 0;
    });
    ctx.drawImage(face, cx - R, cy - R, R * 2, R * 2);
    const empty = v.fuel <= 0;
    if (empty || k < 0.2) {
      // лампа резерва
      const on = empty || Math.sin(game.world.time * 6) > -0.3;
      this._lamp(ctx, cx + rf * 0.3, cy + rf * 0.39, rf * 0.11, on, '#ffae1a', (c, s) => { c.beginPath(); c.arc(0, 0, s * 0.55, 0, Math.PI * 2); c.fill(); });
    }
    this._needle(ctx, cx, cy, rf, a0 + sweep * clamp(this.fuel.pos, -0.02, 1.02), 0.88, u, '#ff4d1a');
    this._glass(ctx, cx, cy, rf);
  }
}
