'use strict';
/* Кисти слоёв задника. Каждая рисует тайл 2048×720: низ канвы — линия «пола» слоя.
   Свет всегда справа (солнце на 0.72 ширины экрана): склоны, уходящие вправо-вниз, светлее,
   левые — в тени. Чем дальше слой, тем слабее контраст (это задаёт Backdrop.colors). */

const BD_PAINT = {};

function vgrad(g, y0, y1, c0, c1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
function bdPoly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
// дымка внизу слоя: воздух у земли плотнее, подножия тонут в мареве
function bdHaze(g, W, H, C, k = 1) {
  g.fillStyle = vgrad(g, H - 260 * k, H, rgba(C.haze, 0), rgba(C.haze, C.fog ? 0.85 : 0.5));
  g.fillRect(0, H - 260 * k, W, 260 * k);
}
function bdSpeckle(g, W, H, r, C, n, y0, y1) {
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = y0 + r() * (y1 - y0);
    g.fillStyle = rgba(r() < 0.5 ? C.dark : C.lit, 0.05 + r() * 0.08);
    g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
  }
}
// силуэт по высотной функции + светотень по уклону + промоины
function bdRelief(g, W, H, hf, C, o) {
  const step = 6;
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += step) g.lineTo(x, H - hf(x));
  g.lineTo(W, H); g.closePath();
  const peak = H - hf(0) - 200;
  g.fillStyle = vgrad(g, Math.max(0, peak), H, C.body, mix(C.body, C.haze, 0.45));
  g.fill();
  g.save(); g.clip();
  // свет ложится полосой по гребню: справа от вершин — освещённый склон, слева — тень
  const drop = o.drop || 200;
  const n = Math.floor(W / step) + 1;
  const slope = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * step; slope[i] = (hf(x + step) - hf(x - step)) / (step * 2); }
  for (const side of [1, -1]) {
    // сглаживаем уклон, иначе полоса света рвётся на вертикальные «подтёки»
    const ks = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, cnt = 0;
      for (let j = -6; j <= 6; j++) { const q = (i + j + n) % n; sum += clamp(side * -slope[q] * 1.4, 0, 1); cnt++; }
      ks[i] = sum / cnt;
    }
    g.beginPath(); g.moveTo(0, H);
    for (let i = 0; i < n; i++) {
      const x = i * step;
      g.lineTo(x, H - hf(x) + 6 + ks[i] * drop);
    }
    g.lineTo(W, H); g.closePath();
    const col = side > 0 ? C.lit : C.dark;
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = vgrad(g, H - hf(0) - 200, H, rgba(col, side > 0 ? 0.42 : 0.4), rgba(col, 0.05));
    g.save(); g.clip();
    g.fillStyle = vgrad(g, H - 600, H, rgba(col, side > 0 ? 0.5 : 0.45), rgba(col, 0));
    g.fillRect(0, 0, W, H); g.restore();
    g.globalCompositeOperation = 'source-over';
  }
  return () => g.restore();
}
// промоины и осыпи: короткие штрихи вниз по склону
function bdGullies(g, W, H, hf, C, r, n, len) {
  g.lineCap = 'round';
  n = Math.round(n * clamp(C.d * 2.2, 0, 1));
  for (let i = 0; i < n; i++) {
    let x = r() * W, y = H - hf(x) + r() * 20;
    const light = r() < 0.5;
    g.strokeStyle = rgba(light ? C.lit : C.dark, 0.05 + r() * 0.06);
    g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, y);
    const L = len * (0.4 + r() * 0.6), drift = (r() - 0.5) * 1.2;
    for (let k = 0; k < 6; k++) { x += drift * L / 6 + (r() - 0.5) * 10; y += L / 6; g.lineTo(x, y); }
    g.stroke();
  }
}

/* ------------------------------ природа ------------------------------ */

// горный хребет: острые гребни, снеговая линия, ледниковые цирки
BD_PAINT.mountains = (g, W, H, r, C, o) => {
  const sd = Math.floor(r() * 1e6);
  const f1 = periodicFbm(sd, W, o.cells || 5, 5, true), f2 = periodicFbm(sd + 7, W, (o.cells || 5) * 3, 4, false);
  const top = o.top || 300, amp = o.amp || 240;
  const hf = x => top + amp * (0.45 + 0.55 * f1(x)) + amp * 0.2 * f2(x);
  const done = bdRelief(g, W, H, hf, C, { drop: 240 });
  bdGullies(g, W, H, hf, C, r, 70, 120);
  const sl = o.snowline !== undefined ? o.snowline : top + amp * 0.75;
  if (o.snow !== false) {
    // нижняя кромка снега: волнистая, с языками в ложбинах
    const edge = x => {
      const h = hf(x);
      const over = h - sl;
      if (over <= 0) return null;
      const tongue = Math.max(0, -(hf(x + 24) - hf(x - 24)) * 0 + (0.5 + 0.5 * Math.sin(x * 0.011)) * 40);
      return H - Math.max(sl - tongue * 0.4 + Math.sin(x * 0.04) * 12 + Math.sin(x * 0.013) * 22, h - 150);
    };
    g.save();
    g.beginPath();
    let open = false;
    for (let x = 0; x <= W; x += 4) {
      const e = edge(x);
      if (e === null) { open = false; continue; }
      if (!open) { g.moveTo(x, H - hf(x)); open = true; }
      g.lineTo(x, H - hf(x));
    }
    for (let x = W; x >= 0; x -= 4) { const e = edge(x); if (e !== null) g.lineTo(x, e); }
    g.closePath();
    g.fillStyle = rgba(C.snow, 0.88); g.fill();
    g.clip();
    // скальные выходы из-под фирна
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = H - hf(x) + 10 + r() * 90, w = 14 + r() * 40, hh = 10 + r() * 26;
      g.fillStyle = rgba(C.dark, 0.3 + r() * 0.3);
      g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x + w * 0.4, y); g.lineTo(x + w, y + hh * 0.8); g.closePath(); g.fill();
    }
    // мягкая тень слева по всей шапке
    g.fillStyle = rgba(C.snowShade, 0.3);
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      let sm = 0;
      for (let j = -4; j <= 4; j++) sm += clamp((hf(x + j * 8 + 8) - hf(x + j * 8 - 8)) / 16 * 1.6, 0, 1);
      g.lineTo(x, H - hf(x) + 4 + sm / 9 * 130);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    g.restore();
  }
  bdSpeckle(g, W, H, r, C, 400, H - amp - top, H);
  bdHaze(g, W, H, C);
  done();
};

// пологие холмы, местами поля и кусты
BD_PAINT.hills = (g, W, H, r, C, o) => {
  const sd = Math.floor(r() * 1e6);
  const f1 = periodicFbm(sd, W, o.cells || 4, 4, false), f2 = periodicFbm(sd + 3, W, 12, 3, false);
  const top = o.top || 120, amp = o.amp || 90;
  const hf = x => top + amp * (0.5 + 0.5 * f1(x)) + amp * 0.25 * f2(x);
  const done = bdRelief(g, W, H, hf, C, { drop: 220 });
  if (o.fields) {
    g.globalAlpha = 0.25;
    for (let i = 0; i < 14; i++) {
      const x = r() * W, w = 90 + r() * 200, y = H - hf(x) + 20 + r() * 90;
      g.fillStyle = r() < 0.5 ? C.lit : C.dark;
      bdPoly(g, [[x, y], [x + w, y - 8], [x + w * 0.9, y + 34], [x - 10, y + 40]]); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (o.bushes !== false) {
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = H - hf(x) + r() * 60;
      g.fillStyle = rgba(r() < 0.4 ? C.lit : C.dark, 0.22);
      g.beginPath(); g.ellipse(x, y, 6 + r() * 16, 4 + r() * 8, 0, 0, Math.PI * 2); g.fill();
    }
  }
  bdSpeckle(g, W, H, r, C, 260, H - amp - top, H);
  bdHaze(g, W, H, C, 0.7);
  done();
};

// столовые горы: обрывистые стены со слоями пород и осыпью у подножия
BD_PAINT.mesas = (g, W, H, r, C, o) => {
  const hf = x => (o.base || 60) + Math.sin(x / W * Math.PI * 2) * 18 + Math.sin(x / W * Math.PI * 6 + 1) * 10;
  const done = bdRelief(g, W, H, hf, C, { drop: 120 });
  done();
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.15 + r() * 0.5) * W / n, w = 150 + r() * 260, h = (o.h || 180) + r() * (o.hv || 200);
    const kind = r();
    wrapDraw(W, x, w, X => {
      const y = H - h, bx = X, tx = X + 26, tw = w - 52;
      g.save();
      if (kind < 0.45) {        // столовая гора с ровной шапкой
        bdPoly(g, [[bx, H - 40], [tx, y], [tx + tw, y], [bx + w, H - 40], [bx + w, H], [bx, H]]);
      } else if (kind < 0.75) { // с уступом-террасой
        bdPoly(g, [[bx, H - 40], [bx + 18, y + h * 0.42], [bx + w * 0.42, y + h * 0.36], [bx + w * 0.46, y],
          [tx + tw, y], [bx + w - 10, y + h * 0.3], [bx + w, H - 40], [bx + w, H], [bx, H]]);
      } else {                  // острая башня-останец
        bdPoly(g, [[bx + w * 0.1, H - 40], [bx + w * 0.3, y + h * 0.18], [bx + w * 0.44, y],
          [bx + w * 0.62, y + h * 0.1], [bx + w * 0.78, y + h * 0.45], [bx + w * 0.92, H - 40], [bx + w * 0.92, H], [bx + w * 0.1, H]]);
      }
      g.fillStyle = vgrad(g, y, H, mix(C.body, C.dark, 0.12), mix(C.body, C.haze, 0.35)); g.fill();
      g.clip();
      // освещённая правая треть и тень слева
      g.fillStyle = vgrad(g, y, H - 40, rgba(C.lit, 0.65), rgba(C.lit, 0.08)); g.fillRect(bx + w * 0.58, y, w * 0.5, h);
      g.fillStyle = vgrad(g, y, H - 40, rgba(C.dark, 0.6), rgba(C.dark, 0.1)); g.fillRect(bx - 4, y, w * 0.34, h);
      // слои пород
      for (let k = 1; k < 7; k++) {
        const yy = y + k * h / 7 + (r() - 0.5) * 6;
        g.fillStyle = rgba(k % 2 ? C.dark : C.lit, 0.24);
        g.beginPath(); g.moveTo(bx - 10, yy); g.lineTo(bx + w + 10, yy + (r() - 0.5) * 8); g.lineTo(bx + w + 10, yy + 8 + r() * 10); g.lineTo(bx - 10, yy + 10); g.closePath(); g.fill();
      }
      // вертикальная эрозия
      for (let k = 0; k < 14; k++) {
        const xx = bx + 20 + r() * (w - 40);
        g.strokeStyle = rgba(r() < 0.5 ? C.dark : C.lit, 0.09); g.lineWidth = 2 + r() * 5;
        g.beginPath(); g.moveTo(xx, y + 4); g.lineTo(xx + (r() - 0.5) * 8, y + h * (0.25 + r() * 0.35)); g.stroke();
      }
      // шапка и осыпь
      g.fillStyle = rgba(C.lit, 0.35); g.fillRect(tx, y, tw, 6);
      g.fillStyle = rgba(C.dark, 0.25);
      bdPoly(g, [[bx - 30, H], [bx + 10, H - 46], [bx + w - 10, H - 46], [bx + w + 30, H]]); g.fill();
      g.restore();
    });
  }
  // мелкие останцы и валуны у подножия — масштаб читается лучше
  for (let i = 0; i < 14; i++) {
    const x = r() * W, w = 30 + r() * 70, h = 30 + r() * 70;
    g.fillStyle = mix(C.body, C.dark, 0.18);
    bdPoly(g, [[x, H - 10], [x + 6, H - h], [x + w - 8, H - h * 0.9], [x + w, H - 10]]); g.fill();
    g.fillStyle = rgba(C.lit, 0.3);
    bdPoly(g, [[x + w * 0.6, H - h * 0.92], [x + w, H - 10], [x + w * 0.7, H - 10]]); g.fill();
  }
  bdSpeckle(g, W, H, r, C, 300, H - 380, H);
  bdHaze(g, W, H, C, 0.8);
};

// отвесная стена каньона: колонны, карнизы, трещины
BD_PAINT.cliffs = (g, W, H, r, C, o) => {
  const sd = Math.floor(r() * 1e6);
  const f = periodicFbm(sd, W, 7, 4, false);
  const top = o.top || 300, amp = o.amp || 120;
  const hf = x => top + amp * (0.5 + 0.5 * f(x)) + Math.sin(x * 0.013) * 30;
  const done = bdRelief(g, W, H, hf, C, { drop: 420 });
  for (let x = 0; x < W; x += 14 + r() * 30) {
    const y = H - hf(x) + 10 + r() * 30, h = 60 + r() * 150;
    g.fillStyle = rgba(r() < 0.45 ? C.lit : C.dark, 0.06 + r() * 0.08);
    g.fillRect(x, y, 8 + r() * 20, h);
  }
  for (let k = 1; k < 5; k++) {
    g.fillStyle = rgba(k % 2 ? C.lit : C.dark, 0.1);
    g.beginPath();
    for (let x = 0; x <= W; x += 16) g.lineTo(x, H - hf(x) + k * 70 + Math.sin(x * 0.02 + k) * 10);
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, H - hf(x) + k * 70 + 16 + Math.sin(x * 0.02 + k) * 10);
    g.closePath(); g.fill();
  }
  bdGullies(g, W, H, hf, C, r, 60, 160);
  // ниши-«окна» выветривания и карнизы
  for (let i = 0; i < 16; i++) {
    const x = r() * W, y = H - hf(x) + 50 + r() * 190, w = 50 + r() * 110, hh = 12 + r() * 24;
    g.fillStyle = rgba(C.dark, 0.07 + r() * 0.06);
    g.beginPath(); g.ellipse(x, y, w * 0.5, hh * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(C.lit, 0.07);
    g.beginPath(); g.ellipse(x, y + hh * 0.5, w * 0.45, hh * 0.16, 0, 0, Math.PI * 2); g.fill();
  }
  // осыпь и валуны внизу
  g.fillStyle = rgba(C.dark, 0.22);
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 32) g.lineTo(x, H - 40 - Math.sin(x * 0.01) * 18 - r() * 16);
  g.lineTo(W, H); g.closePath(); g.fill();
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = H - 10 - r() * 40, rr = 5 + r() * 16;
    g.fillStyle = rgba(r() < 0.5 ? C.dark : C.lit, 0.2);
    g.beginPath(); g.ellipse(x, y, rr, rr * 0.75, r(), 0, Math.PI * 2); g.fill();
  }
  bdSpeckle(g, W, H, r, C, 400, H - 420, H);
  bdHaze(g, W, H, C, 0.6);
  done();
};

// хвойный лес: два ряда ёлок, задний тонет в дымке
BD_PAINT.forest = (g, W, H, r, C, o) => {
  const sd = Math.floor(r() * 1e6), f = periodicFbm(sd, W, 5, 3, false);
  const ground = x => (o.top || 90) + (o.amp || 50) * (0.5 + 0.5 * f(x));
  const tree = (x, gy, h, col, snow, trunk) => {
    const w = h * 0.3;
    g.fillStyle = col;

    for (let i = 0; i < 5; i++) {
      const ty = gy - h * 0.12 - i * h * 0.19, tw = w * (1 - i * 0.17);
      g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x - tw * 0.5, ty - h * 0.06);
      g.lineTo(x, ty - h * (0.3 - i * 0.02)); g.lineTo(x + tw * 0.5, ty - h * 0.06); g.lineTo(x + tw, ty); g.closePath(); g.fill();
    }
    // подсветка правой стороны
    g.fillStyle = rgba(C.lit, 0.3);
    g.beginPath(); g.moveTo(x + w * 0.1, gy - h * 0.15); g.lineTo(x + w * 0.15, gy - h * 0.95); g.lineTo(x + w * 0.5, gy - h * 0.25); g.closePath(); g.fill();
    if (snow) {
      g.fillStyle = rgba(C.snow, 0.5);
      for (let i = 3; i < 5; i++) {
        const ty = gy - h * 0.12 - i * h * 0.19, tw = w * (1 - i * 0.17) * 0.5;
        const apex = ty - h * (0.3 - i * 0.02);
        g.beginPath(); g.moveTo(x - tw, ty - h * 0.04); g.quadraticCurveTo(x, apex + h * 0.06, x + tw, ty - h * 0.04);
        g.quadraticCurveTo(x, ty + h * 0.01, x - tw, ty - h * 0.04); g.closePath(); g.fill();
      }
      g.fillStyle = col;
    }
  };
  const back = mix(C.body, C.haze, 0.5);
  for (let x = -20; x < W + 20; x += 12 + r() * 10) tree(x, H - ground(x) + 40, 90 + r() * 70, back, false, false);
  g.fillStyle = vgrad(g, H - 300, H - 90, rgba(C.haze, 0), rgba(C.haze, 0.45));
  g.fillRect(0, H - 300, W, 260);
  for (let x = -20; x < W + 20; x += 16 + r() * 16) tree(x, H - ground(x) + 90, 130 + r() * 120, C.body, o.snow, true);
  bdHaze(g, W, H, C, 0.5);
};

// лиственные деревья и кусты вдоль дороги
BD_PAINT.treeline = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 40);
  for (let x = -40; x < W + 40; x += 60 + r() * 130) {
    const h = 120 + r() * 140, dead = r() < (o.dead || 0.25);
    g.strokeStyle = C.dark; g.lineWidth = h * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, gy); g.lineTo(x + (r() - 0.5) * 20, gy - h * 0.45); g.stroke();
    if (dead) {
      g.lineWidth = h * 0.02;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 1.8;
        g.beginPath(); g.moveTo(x, gy - h * 0.4); g.lineTo(x + Math.cos(a) * h * 0.3, gy - h * 0.4 + Math.sin(a) * h * 0.3); g.stroke();
      }
      continue;
    }
    const cx = x + (r() - 0.5) * 12, cy = gy - h * 0.62, cr = h * 0.3;
    g.fillStyle = C.body;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(cx + (r() - 0.5) * cr * 1.6, cy + (r() - 0.5) * cr * 0.9, cr * (0.5 + r() * 0.5), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = rgba(C.lit, 0.35);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + cr * (0.2 + r() * 0.7), cy - cr * (0.2 + r() * 0.5), cr * (0.25 + r() * 0.3), 0, Math.PI * 2); g.fill(); }
  }
  bdHaze(g, W, H, C, 0.4);
};

// барханы: гребень освещён, подветренный склон в тени, рябь на песке
BD_PAINT.dunes = (g, W, H, r, C, o) => {
  for (let l = 0; l < 3; l++) {
    const sd = Math.floor(r() * 1e6), f = periodicFbm(sd, W, 3 + l * 2, 3, false);
    const top = (o.top || 60) - l * 18, amp = (o.amp || 70) * (1 - l * 0.2);
    const hf = x => top + amp * (0.5 + 0.5 * f(x));
    const col = mix(C.body, C.haze, 0.35 - l * 0.15);
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H - hf(x));
    g.lineTo(W, H); g.closePath();
    g.fillStyle = vgrad(g, H - top - amp, H, mix(col, C.lit, 0.25), col); g.fill();
    g.save(); g.clip();
    for (let x = 0; x <= W; x += 8) {
      const y = H - hf(x), sl = (hf(x + 8) - hf(x - 8)) / 16;
      if (sl > 0.02) { g.fillStyle = vgrad(g, y, y + 90, rgba(C.dark, clamp(sl, 0, 1) * 0.5), rgba(C.dark, 0)); g.fillRect(x - 4, y, 9, 90); }
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * W, y = H - hf(x) + 10 + r() * 60;
      g.strokeStyle = rgba(C.lit, 0.12); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 4, x + 70, y + 2); g.stroke();
    }
    g.restore();
  }
  bdHaze(g, W, H, C, 0.5);
};

// скалистые острова на горизонте
BD_PAINT.islands = (g, W, H, r, C, o) => {
  const n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.2 + r() * 0.5) * W / n, w = 180 + r() * 320, h = (o.h || 60) + r() * 90;
    wrapDraw(W, x - w / 2, w, X => {
      g.save();
      g.beginPath(); g.moveTo(X, H);
      g.lineTo(X + w * 0.12, H - h * 0.55);
      g.quadraticCurveTo(X + w * 0.3, H - h * 1.15, X + w * 0.52, H - h * 0.9);
      g.quadraticCurveTo(X + w * 0.72, H - h * 0.7, X + w * 0.88, H - h * 0.3);
      g.lineTo(X + w, H); g.closePath();
      g.fillStyle = vgrad(g, H - h * 1.1, H, C.body, mix(C.body, C.haze, 0.35)); g.fill();
      g.clip();
      g.fillStyle = rgba(C.lit, 0.4); g.fillRect(X + w * 0.55, H - h * 1.2, w, h * 1.4);
      g.fillStyle = rgba(C.dark, 0.35); g.fillRect(X, H - h * 1.2, w * 0.3, h * 1.4);
      if (o.trees) { g.fillStyle = rgba(C.dark, 0.5); for (let k = 0; k < 14; k++) { const tx = X + w * (0.15 + r() * 0.7); g.beginPath(); g.arc(tx, H - h * (0.5 + r() * 0.45), 6 + r() * 10, 0, Math.PI * 2); g.fill(); } }
      // прибой у уреза воды
      g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(X - 6, H - 4, w + 12, 4);
      g.restore();
    });
  }
  bdHaze(g, W, H, C, 0.35);
};

// тропический остров: вулкан, пляж, пальмы
BD_PAINT.tropical = (g, W, H, r, C, o) => {
  BD_PAINT.islands(g, W, H, r, C, { n: 3, h: 70, trees: true });
  if (o.volcano) {
    const x = o.volcano * W, h = 300, w = 560;
    g.beginPath(); g.moveTo(x - w / 2, H); g.lineTo(x - 44, H - h); g.lineTo(x + 40, H - h + 10); g.lineTo(x + w / 2, H); g.closePath();
    g.fillStyle = vgrad(g, H - h, H, mix(C.body, C.dark, 0.3), mix(C.body, C.haze, 0.3)); g.fill();
    g.fillStyle = rgba(C.lit, 0.35);
    bdPoly(g, [[x + 40, H - h + 10], [x + w / 2, H], [x + w * 0.22, H], [x + 10, H - h + 12]]); g.fill();
    g.fillStyle = rgba(C.dark, 0.4); g.fillRect(x - 44, H - h, 84, 8);
  }
  if (o.palms) {
    const gy = H - 10;
    // пальмы растут купами на островках, а не сплошным частоколом
    let x = 30;
    while (x < W) {
      if (r() < 0.32) { x += 180 + r() * 260; continue; }
      const h = 46 + r() * 40, lean = (r() - 0.5) * 26;
      g.strokeStyle = mix(C.body, C.dark, 0.5); g.lineWidth = 4.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, gy); g.quadraticCurveTo(x + lean * 0.4, gy - h * 0.6, x + lean, gy - h); g.stroke();
      const tx = x + lean, ty = gy - h;
      for (let i = 0; i < 8; i++) {
        const a = -2.6 + i * 0.66 + (r() - 0.5) * 0.2, L = h * 0.3 + r() * 10;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.75 + 10;
        const mx = tx + Math.cos(a) * L * 0.55, my = ty + Math.sin(a) * L * 0.55 - 6;
        g.fillStyle = mix(C.body, C.dark, 0.35);
        g.beginPath(); g.moveTo(tx, ty);
        g.quadraticCurveTo(mx, my - 5, ex, ey);
        g.quadraticCurveTo(mx, my + 6, tx, ty + 3); g.closePath(); g.fill();
      }
      g.fillStyle = mix(C.body, C.dark, 0.6); g.beginPath(); g.arc(tx, ty + 3, 3, 0, Math.PI * 2); g.fill();
      x += 34 + r() * 70;
    }
  }
  bdHaze(g, W, H, C, 0.4);
};

BD_PAINT.ocean = (g, W, H, r, C) => { g.fillStyle = rgba(C.haze, 0.15); g.fillRect(0, H - 6, W, 6); };
