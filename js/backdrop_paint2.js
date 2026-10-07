'use strict';
/* Кисти слоёв: рукотворное — руины города, посёлок, НПЗ, город-призрак, плотина, порт, флот.
   Всё уже разрушено: проломы в стенах, обвалившиеся этажи, копоть над окнами, накренившиеся мачты. */

// фасад с окнами: днём стёкла тёмные с отражением неба, ночью кое-где горит свет
function bdWindows(g, x, y, w, h, C, r, o) {
  const cw = o.cw || 16, ch = o.ch || 22;
  for (let wy = y + 10; wy < y + h - 14; wy += ch) {
    for (let wx = x + 7; wx < x + w - 10; wx += cw) {
      const broken = r() < (o.broken || 0.3);
      if (C.night) {
        const lit = r() < (o.lit || 0.06) && !broken;
        g.fillStyle = lit ? rgba(C.win, 0.55 + r() * 0.45) : rgba('#05070c', 0.55);
      } else {
        g.fillStyle = broken ? rgba('#05070c', 0.6) : rgba(mix(C.body, C.lit, 0.55), 0.5 + r() * 0.2);
      }
      g.fillRect(wx, wy, cw * 0.55, ch * 0.5);
      if (broken && r() < 0.5) { // копоть над проёмом
        g.fillStyle = rgba('#0b0b0d', 0.25);
        g.fillRect(wx - 2, wy - ch * 0.5, cw * 0.7, ch * 0.55);
      }
    }
  }
}

// высотка: боковая грань, ломаная макушка, обрушенные перекрытия
function bdTower(g, x, w, h, H, C, r, o) {
  const y = H - h, side = Math.min(18, w * 0.22);
  g.save();
  g.fillStyle = vgrad(g, y, H, mix(C.body, C.lit, 0.12), mix(C.body, C.haze, 0.35));
  const wrecked = r() < (o.wrecked || 0.35);
  const cut = wrecked ? h * (0.1 + r() * 0.2) : 0;
  g.beginPath();
  g.moveTo(x, H); g.lineTo(x, y + cut);
  if (wrecked) { // рваный край перекрытий
    let xx = x, yy = y + cut;
    while (xx < x + w) { const sw = 6 + r() * 22; yy = y + cut + (r() - 0.5) * cut * 0.8; g.lineTo(xx, yy); g.lineTo(xx + sw, yy); xx += sw; }
    g.lineTo(x + w, y + cut * 0.6);
  } else g.lineTo(x + w, y);
  g.lineTo(x + w, H); g.closePath();
  g.fill();
  g.save(); g.clip();
  bdWindows(g, x, y + cut, w, h - cut, C, r, o);
  // тень слева, свет справа
  g.fillStyle = rgba(C.dark, 0.35); g.fillRect(x, y, w * 0.25, h);
  g.fillStyle = rgba(C.lit, 0.25); g.fillRect(x + w - side * 1.6, y, side * 1.6, h);
  if (wrecked) { // торчащие плиты и арматура
    for (let i = 0; i < 3; i++) {
      const sy = y + cut + 10 + r() * h * 0.25;
      g.fillStyle = rgba(C.dark, 0.5); g.fillRect(x + r() * w * 0.5, sy, w * (0.3 + r() * 0.5), 4);
    }
  }
  g.restore();
  // грань в перспективе
  g.fillStyle = rgba(C.lit, 0.18); g.fillRect(x + w, y + cut * 0.6, side * 0.5, h - cut * 0.6);
  if (wrecked) {
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = rgba(C.dark, 0.5); g.lineWidth = 1;
      const bx = x + 10 + r() * (w - 20), by = y + cut;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (r() - 0.5) * 12, by - 8 - r() * 14); g.stroke();
    }
  }
  if (!wrecked && r() < 0.4) { // мачта на крыше
    const mx = x + w * (0.3 + r() * 0.4);
    g.fillStyle = C.dark; g.fillRect(mx, y - 30 - r() * 40, 3, 50);
  }
  g.restore();
}

BD_PAINT.city = (g, W, H, r, C, o) => {
  const rows = o.rows || 2;
  for (let row = 0; row < rows; row++) {
    const far = row === 0 && rows > 1;
    const CC = far ? Object.assign({}, C, { body: mix(C.body, C.haze, 0.35), lit: mix(C.lit, C.haze, 0.35), dark: mix(C.dark, C.haze, 0.3) }) : C;
    let x = -40;
    while (x < W + 40) {
      const w = (far ? 40 : 60) + r() * (far ? 70 : 110);
      const h = ((far ? 110 : 150) + r() * (o.h || 320)) * (far ? 0.8 : 1);
      bdTower(g, x, w, h, H - (far ? 40 : 0), CC, r, o);
      x += w + 4 + r() * 26;
    }
    if (far) { g.fillStyle = rgba(C.haze, 0.3); g.fillRect(0, H - 520, W, 520); }
  }
  // завалы у подножия
  g.fillStyle = rgba(C.dark, 0.35);
  for (let i = 0; i < 26; i++) { const x = r() * W; g.beginPath(); g.ellipse(x, H - 6 + r() * 10, 30 + r() * 70, 8 + r() * 16, 0, 0, Math.PI * 2); g.fill(); }
  bdHaze(g, W, H, C, 0.6);
};

// посёлок: дома с двускатными крышами, сараи, водонапорка; часть выгорела
BD_PAINT.town = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 30);
  const house = (x, w, h, burnt) => {
    const y = gy - h, roofH = h * (0.45 + r() * 0.25);
    g.fillStyle = vgrad(g, y, gy, mix(C.body, C.lit, 0.15), mix(C.body, C.dark, 0.2));
    g.fillRect(x, y, w, h);
    g.fillStyle = rgba(C.dark, 0.3); g.fillRect(x, y, w * 0.3, h);
    if (!burnt) {
      g.fillStyle = mix(C.body, C.dark, 0.45);
      bdPoly(g, [[x - w * 0.08, y], [x + w / 2, y - roofH], [x + w * 1.08, y], [x + w * 1.02, y + 6], [x - w * 0.02, y + 6]]); g.fill();
      g.fillStyle = rgba(C.lit, 0.3);
      bdPoly(g, [[x + w / 2, y - roofH], [x + w * 1.08, y], [x + w * 1.02, y + 4], [x + w / 2, y - roofH + 6]]); g.fill();
      g.fillStyle = mix(C.body, C.dark, 0.6); g.fillRect(x + w * 0.66, y - roofH * 0.75, w * 0.1, roofH * 0.8);
    } else {
      // сгоревший дом: стропила и копоть
      g.fillStyle = rgba('#141014', 0.55); g.fillRect(x, y, w, h);
      g.strokeStyle = rgba('#0d0b0d', 0.8); g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 4 + i * w / 4, y + 4); g.lineTo(x + w / 2 + (r() - 0.5) * 20, y - roofH * (0.3 + r() * 0.4)); g.stroke(); }
    }
    bdWindows(g, x, y, w, h, C, r, { cw: 18, ch: 20, broken: burnt ? 1 : 0.35, lit: burnt ? 0 : 0.12 });
  };
  let x = -30;
  while (x < W + 30) {
    const k = r();
    if (k < 0.62) { const w = 90 + r() * 80; house(x, w, 60 + r() * 45, r() < (o.burnt || 0.25)); x += w + 30 + r() * 70; }
    else if (k < 0.78) { // сарай
      const w = 130 + r() * 90, h = 70 + r() * 30, y = gy - h;
      g.fillStyle = mix(C.body, C.dark, 0.25); g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.body, C.dark, 0.5);
      bdPoly(g, [[x - 6, y], [x + w * 0.25, y - h * 0.5], [x + w * 0.75, y - h * 0.5], [x + w + 6, y]]); g.fill();
      g.fillStyle = rgba(C.dark, 0.5); g.fillRect(x + w * 0.4, y + h * 0.35, w * 0.25, h * 0.65);
      x += w + 50 + r() * 80;
    } else if (k < 0.9) { // водонапорная башня
      const h = 150 + r() * 60, bx = x + 30;
      g.strokeStyle = mix(C.body, C.dark, 0.35); g.lineWidth = 5;
      for (const dx of [-26, 26]) { g.beginPath(); g.moveTo(bx + dx, gy); g.lineTo(bx + dx * 0.45, gy - h * 0.7); g.stroke(); }
      g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 24, gy - h * 0.3); g.lineTo(bx + 24, gy - h * 0.45); g.moveTo(bx + 24, gy - h * 0.3); g.lineTo(bx - 24, gy - h * 0.45); g.stroke();
      g.fillStyle = mix(C.body, C.lit, 0.2); g.fillRect(bx - 30, gy - h, 60, h * 0.32);
      g.fillStyle = mix(C.body, C.dark, 0.5); bdPoly(g, [[bx - 34, gy - h], [bx, gy - h - 22], [bx + 34, gy - h]]); g.fill();
      x += 120 + r() * 80;
    } else { // церковь со шпилем
      const w = 80, h = 100, y = gy - h;
      g.fillStyle = mix(C.body, C.lit, 0.1); g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.body, C.dark, 0.5);
      bdPoly(g, [[x + w * 0.25, y], [x + w * 0.5, y - 130], [x + w * 0.75, y]]); g.fill();
      g.fillStyle = C.dark; g.fillRect(x + w * 0.49, y - 152, 3, 24); g.fillRect(x + w * 0.44, y - 144, 13, 3);
      x += w + 70 + r() * 90;
    }
  }
  // заборы и столбы
  g.strokeStyle = rgba(C.dark, 0.5); g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const px = r() * W; g.beginPath(); g.moveTo(px, gy + 8); g.lineTo(px, gy - 14 - r() * 10); g.stroke(); }
  bdHaze(g, W, H, C, 0.5);
};

// НПЗ: колонны, сферы, резервуары, факельная труба, эстакады
BD_PAINT.industry = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 20);
  const cyl = (x, y, w, h, col) => {
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, mix(col, C.dark, 0.55)); gr.addColorStop(0.35, col); gr.addColorStop(0.75, mix(col, C.lit, 0.5)); gr.addColorStop(1, mix(col, C.dark, 0.3));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  };
  let x = -20;
  while (x < W + 20) {
    const k = r();
    if (k < 0.3) { // ректификационная колонна
      const w = 26 + r() * 22, h = 180 + r() * 220, y = gy - h;
      cyl(x, y, w, h, C.body);
      g.fillStyle = rgba(C.dark, 0.45);
      for (let i = 1; i < 6; i++) g.fillRect(x - 4, y + i * h / 6, w + 8, 4);
      g.fillStyle = mix(C.body, C.lit, 0.3); g.fillRect(x + w * 0.2, y - 8, w * 0.6, 8);
      g.strokeStyle = rgba(C.dark, 0.5); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + w + 5, gy); g.lineTo(x + w + 5, y + 10); g.stroke();
      x += w + 26 + r() * 40;
    } else if (k < 0.5) { // сферический газгольдер
      const rr = 30 + r() * 26, cx = x + rr, cy = gy - rr - 34;
      g.strokeStyle = mix(C.body, C.dark, 0.4); g.lineWidth = 4;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * rr * 0.4, cy + rr * 0.6); g.lineTo(cx + i * rr * 0.5, gy); g.stroke(); }
      const sg = g.createRadialGradient(cx + rr * 0.35, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
      sg.addColorStop(0, mix(C.body, C.lit, 0.5)); sg.addColorStop(1, mix(C.body, C.dark, 0.4));
      g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      x += rr * 2 + 30 + r() * 40;
    } else if (k < 0.7) { // резервуар
      const w = 110 + r() * 90, h = 60 + r() * 40, y = gy - h;
      cyl(x, y, w, h, mix(C.body, C.lit, 0.08));
      g.fillStyle = mix(C.body, C.lit, 0.25); g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba(C.dark, 0.35); g.fillRect(x, y + h * 0.45, w, 3);
      if (r() < 0.35) { g.fillStyle = rgba('#120c0a', 0.5); g.fillRect(x + w * 0.2, y, w * 0.5, h); }  // выгорел
      x += w + 34 + r() * 50;
    } else if (k < 0.85) { // эстакада труб
      const w = 200 + r() * 160, y = gy - 50 - r() * 40;
      g.fillStyle = mix(C.body, C.dark, 0.3);
      for (let i = 0; i < 4; i++) g.fillRect(x, y + i * 9, w, 6);
      g.fillStyle = rgba(C.lit, 0.25); for (let i = 0; i < 4; i++) g.fillRect(x, y + i * 9, w, 2);
      g.fillStyle = mix(C.body, C.dark, 0.5);
      for (let px = x; px < x + w; px += 60) g.fillRect(px, y, 7, gy - y);
      x += w + 20;
    } else { // факельная труба
      const h = 300 + r() * 160, bx = x + 10;
      g.fillStyle = mix(C.body, C.dark, 0.25); g.fillRect(bx, gy - h, 12, h);
      g.strokeStyle = rgba(C.dark, 0.4); g.lineWidth = 2;
      for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(bx - 8, gy - i * h / 8); g.lineTo(bx + 20, gy - (i + 1) * h / 8); g.stroke(); }
      g.fillStyle = mix(C.body, C.lit, 0.3); g.fillRect(bx - 4, gy - h - 6, 20, 8);
      x += 90 + r() * 70;
    }
  }
  bdHaze(g, W, H, C, 0.55);
};

// город-призрак: фальшфасады, церковь, мельница (лопасти крутит backdrop_life)
BD_PAINT.western = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 24);
  let x = -20, millI = 0;
  while (x < W + 20) {
    const k = r();
    if (k < 0.62) {
      const w = 100 + r() * 90, h = 80 + r() * 50, y = gy - h;
      g.fillStyle = vgrad(g, y, gy, mix(C.body, C.lit, 0.12), mix(C.body, C.dark, 0.25)); g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.body, C.dark, 0.4); g.fillRect(x - 8, y - 26, w + 16, 28);           // фальшфасад
      g.fillStyle = rgba(C.lit, 0.2); g.fillRect(x - 8, y - 26, w + 16, 5);
      g.fillStyle = mix(C.body, C.dark, 0.55); g.fillRect(x - 12, y + h * 0.38, w + 24, 6);     // навес
      g.strokeStyle = mix(C.body, C.dark, 0.5); g.lineWidth = 3;
      for (let i = 0; i <= 3; i++) { const px = x + i * w / 3; g.beginPath(); g.moveTo(px, y + h * 0.42); g.lineTo(px, gy); g.stroke(); }
      bdWindows(g, x, y, w, h * 0.35, C, r, { cw: 24, ch: 26, broken: 0.55, lit: 0.08 });
      x += w + 20 + r() * 60;
    } else if (k < 0.82 && (o.mills || []).length) { // ветряк
      const h = 176, bx = (o.mills[millI % o.mills.length] || x + 26); millI++;
      g.strokeStyle = mix(C.body, C.dark, 0.35); g.lineWidth = 4;
      for (const dx of [-20, 20]) { g.beginPath(); g.moveTo(bx + dx, gy); g.lineTo(bx + dx * 0.25, gy - h); g.stroke(); }
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const y0 = gy - i * h / 5, y1 = gy - (i + 1) * h / 5; g.beginPath(); g.moveTo(bx - 20 + i * 3, y0); g.lineTo(bx + 20 - i * 3, y1); g.moveTo(bx + 20 - i * 3, y0); g.lineTo(bx - 20 + i * 3, y1); g.stroke(); }
      x += 110 + r() * 70;
      continue;
    } else { // амбар и коновязь
      const w = 150, h = 90, y = gy - h;
      g.fillStyle = mix(C.body, C.dark, 0.3); g.fillRect(x, y, w, h);
      g.fillStyle = mix(C.body, C.dark, 0.55); bdPoly(g, [[x - 8, y], [x + w * 0.5, y - 44], [x + w + 8, y]]); g.fill();
      x += w + 60 + r() * 80;
    }
  }
  bdHaze(g, W, H, C, 0.5);
};

// плотина: бетонная стена с контрфорсами, водосброс, машинный зал
BD_PAINT.damwall = (g, W, H, r, C, o) => {
  const h = o.h || 430, top = H - h;
  g.fillStyle = vgrad(g, top, H, mix(C.body, C.lit, 0.65), mix(C.body, C.dark, 0.15));
  bdPoly(g, [[180, H], [300, top], [1760, top], [1880, H]]); g.fill();
  g.save(); bdPoly(g, [[180, H], [300, top], [1760, top], [1880, H]]); g.clip();
  g.fillStyle = rgba(C.dark, 0.25);
  for (let x = 320; x < 1760; x += 96) g.fillRect(x, top, 10, h);                   // швы
  g.fillStyle = rgba(C.lit, 0.12);
  for (let x = 330; x < 1760; x += 96) g.fillRect(x, top, 3, h);
  for (let i = 0; i < 4; i++) { g.fillStyle = rgba(C.dark, 0.12); g.fillRect(200, top + 60 + i * 90, 1700, 10); }
  // водосброс: три пролёта со струями
  for (let i = 0; i < 3; i++) {
    const sx = 820 + i * 130;
    g.fillStyle = rgba(C.dark, 0.45); g.fillRect(sx, top + 10, 92, h);
    g.fillStyle = rgba(mix('#dfe9f0', C.haze, 0.35), 0.5);
    g.fillRect(sx + 10, top + 30, 72, h - 30);
    g.fillStyle = rgba('#ffffff', 0.18);
    for (let k = 0; k < 8; k++) g.fillRect(sx + 12 + r() * 60, top + 40 + r() * (h - 60), 3, 40 + r() * 80);
  }
  g.fillStyle = rgba('#e8f0f4', 0.25); g.beginPath(); g.ellipse(960, H - 10, 300, 40, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // гребень с парапетом и фонарями
  g.fillStyle = mix(C.body, C.lit, 0.55); g.fillRect(290, top - 14, 1480, 16);
  g.fillStyle = mix(C.body, C.dark, 0.45);
  for (let x = 300; x < 1770; x += 60) g.fillRect(x, top - 26, 5, 14);
  if (C.night) {
    for (let x = 320; x < 1770; x += 120) {
      g.fillStyle = rgba('#ffdf9a', 0.85); g.beginPath(); g.arc(x, top - 28, 3.5, 0, Math.PI * 2); g.fill();
      const gl = g.createRadialGradient(x, top - 28, 0, x, top - 28, 46);
      gl.addColorStop(0, 'rgba(255,214,140,0.32)'); gl.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = gl; g.fillRect(x - 46, top - 74, 92, 92);
    }
  }
  // машинный зал
  g.fillStyle = mix(C.body, C.dark, 0.3); g.fillRect(1700, H - 90, 240, 90);
  bdWindows(g, 1700, H - 90, 240, 90, C, r, { cw: 22, ch: 26, broken: 0.4, lit: 0.25 });
  bdHaze(g, W, H, C, 0.5);
};

// порт: портальные краны, штабеля контейнеров, полузатонувший сухогруз
BD_PAINT.harbor = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 10);
  let x = -50;
  while (x < W + 50) {
    const k = r();
    if (k < 0.45) { // контейнерный кран
      const h = 240 + r() * 110, w = 150;
      g.strokeStyle = mix(C.body, C.dark, 0.2); g.lineWidth = 9;
      g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 14, gy - h); g.moveTo(x + w, gy); g.lineTo(x + w - 14, gy - h); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(x + 8, gy - h * 0.55); g.lineTo(x + w - 8, gy - h * 0.55); g.stroke();
      g.fillStyle = mix(C.body, C.lit, 0.2); g.fillRect(x - 110, gy - h - 14, w + 240, 13);      // стрела
      g.fillStyle = mix(C.body, C.dark, 0.35); g.fillRect(x + w * 0.35, gy - h - 40, 40, 28);    // кабина
      g.strokeStyle = mix(C.body, C.dark, 0.3); g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + 14, gy - h); g.lineTo(x - 100, gy - h - 14); g.moveTo(x + w - 14, gy - h); g.lineTo(x + w + 120, gy - h - 12); g.stroke();
      x += w + 90 + r() * 140;
    } else if (k < 0.8) { // штабель контейнеров
      const cols = 3 + Math.floor(r() * 5);
      for (let i = 0; i < cols; i++) {
        const stack = 1 + Math.floor(r() * 3);
        for (let j = 0; j < stack; j++) {
          const cx = x + i * 62, cy = gy - 30 - j * 29;
          const col = mix(['#7a4a3a', '#3f5d72', '#6a6a4a', '#5a4a5c', '#8a7a4a'][Math.floor(r() * 5)], C.body, 0.45);
          g.fillStyle = vgrad(g, cy, cy + 28, mix(col, C.lit, 0.2), mix(col, C.dark, 0.25));
          g.fillRect(cx, cy, 58, 28);
          g.fillStyle = rgba(C.dark, 0.25); for (let v = 0; v < 6; v++) g.fillRect(cx + 5 + v * 9, cy + 3, 2, 22);
        }
      }
      x += cols * 62 + 40 + r() * 60;
    } else { // полузатонувший сухогруз
      const w = 420 + r() * 200, y = gy - 40;
      g.save(); g.translate(x, y); g.rotate(0.07 + r() * 0.06);
      g.fillStyle = mix(C.body, C.dark, 0.25);
      bdPoly(g, [[0, 0], [w, -14], [w - 30, 46], [26, 52]]); g.fill();
      g.fillStyle = rgba(C.dark, 0.5); g.fillRect(0, 22, w, 8);
      g.fillStyle = mix(C.body, C.lit, 0.15); g.fillRect(w * 0.62, -60, 90, 52);
      bdWindows(g, w * 0.62, -60, 90, 52, C, r, { cw: 16, ch: 18, broken: 0.5, lit: 0.1 });
      g.fillStyle = mix(C.body, C.dark, 0.4); g.fillRect(w * 0.66, -92, 10, 34);
      g.restore();
      x += w + 80;
    }
  }
  bdHaze(g, W, H, C, 0.45);
};

// горящий флот на горизонте
BD_PAINT.fleet = (g, W, H, r, C, o) => {
  const gy = H - 4;
  for (let i = 0; i < (o.n || 5); i++) {
    const x = (i + 0.2 + r() * 0.5) * W / (o.n || 5), w = 180 + r() * 260, h = 16 + r() * 10;
    wrapDraw(W, x, w, X => {
      g.fillStyle = mix(C.body, C.dark, 0.2);
      bdPoly(g, [[X, gy], [X + w, gy], [X + w - 22, gy - h], [X + 18, gy - h]]); g.fill();
      const sw = w * (0.16 + r() * 0.12), sx = X + w * (0.3 + r() * 0.3);
      g.fillRect(sx, gy - h - 26, sw, 26);
      g.fillStyle = mix(C.body, C.dark, 0.45);
      g.fillRect(sx + sw * 0.4, gy - h - 60, 6, 34);
      g.fillStyle = rgba(C.lit, 0.3); g.fillRect(X + 18, gy - h, w - 40, 3);
    });
  }
  bdHaze(g, W, H, C, 0.4);
};

// надстройка авианосца
BD_PAINT.superstructure = (g, W, H, r, C, o) => {
  const gy = H - 40;
  g.fillStyle = mix(C.body, C.dark, 0.15); g.fillRect(0, gy, W, 40);
  g.fillStyle = rgba(C.lit, 0.15); g.fillRect(0, gy, W, 4);
  const x = o.x !== undefined ? o.x : 560, w = 300, h = 250;
  g.fillStyle = vgrad(g, gy - h, gy, mix(C.body, C.lit, 0.16), mix(C.body, C.dark, 0.3));
  g.fillRect(x, gy - h, w, h);
  bdWindows(g, x, gy - h, w, h * 0.8, C, r, { cw: 22, ch: 26, broken: 0.35, lit: 0.18 });
  g.fillStyle = mix(C.body, C.dark, 0.2); g.fillRect(x + 40, gy - h - 80, 150, 80);
  g.fillStyle = mix(C.body, C.dark, 0.4);
  g.fillRect(x + 100, gy - h - 190, 10, 112);                       // мачта
  g.fillRect(x + 60, gy - h - 150, 90, 6); g.fillRect(x + 70, gy - h - 120, 70, 5);
  g.save(); g.translate(x + 105, gy - h - 196); g.rotate(0.5);      // антенна РЛС
  g.fillStyle = mix(C.body, C.lit, 0.25); g.fillRect(-26, -6, 52, 10); g.restore();
  // самолёты на палубе
  for (let i = 0; i < 3; i++) {
    const px = 1150 + i * 210 + r() * 60;
    g.fillStyle = mix(C.body, C.dark, 0.35);
    bdPoly(g, [[px, gy - 4], [px + 76, gy - 10], [px + 96, gy - 4], [px + 20, gy + 2]]); g.fill();
    bdPoly(g, [[px + 30, gy - 6], [px + 52, gy - 26], [px + 62, gy - 26], [px + 56, gy - 6]]); g.fill();
  }
  bdHaze(g, W, H, C, 0.4);
};

// маяк на скале: башня с фонарным отсеком (луч крутит backdrop_life)
BD_PAINT.lighthouse = (g, W, H, r, C, o) => {
  BD_PAINT.islands(g, W, H, r, C, { n: 3, h: 54 });
  const x = o.x !== undefined ? o.x : 900, h = o.h || 250;
  g.fillStyle = vgrad(g, H - h - 60, H, mix(C.body, C.lit, 0.15), mix(C.body, C.dark, 0.3));
  g.beginPath(); g.moveTo(x - 90, H); g.quadraticCurveTo(x - 40, H - 76, x + 6, H - 66);
  g.quadraticCurveTo(x + 70, H - 56, x + 120, H); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x - 26, H - 60); g.lineTo(x - 16, H - h); g.lineTo(x + 16, H - h); g.lineTo(x + 26, H - 60); g.closePath();
  g.fillStyle = vgrad(g, H - h, H - 60, mix(C.body, C.lit, 0.35), mix(C.body, C.dark, 0.1)); g.fill();
  g.fillStyle = rgba(C.dark, 0.3);
  for (let i = 0; i < 3; i++) g.fillRect(x - 24 + i, H - h + 20 + i * 52, 48 - i * 2, 16);
  g.fillStyle = mix(C.body, C.dark, 0.4); g.fillRect(x - 22, H - h - 10, 44, 12);
  g.fillStyle = rgba('#ffeeb0', C.night ? 0.8 : 0.45); g.fillRect(x - 15, H - h - 34, 30, 26);
  g.fillStyle = mix(C.body, C.dark, 0.5);
  g.beginPath(); g.moveTo(x - 20, H - h - 34); g.lineTo(x, H - h - 52); g.lineTo(x + 20, H - h - 34); g.closePath(); g.fill();
  g.fillStyle = mix(C.body, C.dark, 0.3); g.fillRect(x + 60, H - 92, 80, 40);   // дом смотрителя
  bdWindows(g, x + 60, H - 92, 80, 40, C, r, { cw: 18, ch: 20, broken: 0.4, lit: 0.2 });
  bdHaze(g, W, H, C, 0.4);
};

// трубы и эстакады прямо у дороги
BD_PAINT.pipes = (g, W, H, r, C, o) => {
  const y = H - (o.top || 120);
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 26;
    g.fillStyle = vgrad(g, yy, yy + 18, mix(C.body, C.lit, 0.3), mix(C.body, C.dark, 0.35));
    g.fillRect(0, yy, W, 18);
    g.fillStyle = rgba(C.dark, 0.3);
    for (let x = 0; x < W; x += 140) g.fillRect(x, yy - 2, 6, 22);
  }
  g.fillStyle = mix(C.body, C.dark, 0.4);
  for (let x = 40; x < W; x += 150 + r() * 90) g.fillRect(x, y, 14, H - y);
  bdHaze(g, W, H, C, 0.4);
};

// ЛЭП: решётчатые опоры и провисающие провода, часть покосилась
BD_PAINT.powerlines = (g, W, H, r, C, o) => {
  const gy = H - (o.top || 20), step = o.step || 420, h = o.h || 260;
  const xs = [];
  for (let x = 60; x < W + step; x += step) xs.push(x);
  g.strokeStyle = rgba(C.dark, 0.75); g.lineWidth = 1.6;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], sag = 46 + r() * 20;
    for (let k = -1; k <= 1; k++) {
      const y = gy - h + 16 + k * 26;
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y); g.stroke();
    }
  }
  for (const x of xs) {
    const tilt = r() < 0.2 ? (r() - 0.5) * 0.25 : 0;
    g.save(); g.translate(x, gy); g.rotate(tilt);
    g.strokeStyle = mix(C.body, C.dark, 0.35); g.lineWidth = 4;
    g.beginPath(); g.moveTo(-34, 0); g.lineTo(-9, -h); g.moveTo(34, 0); g.lineTo(9, -h); g.stroke();
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y0 = -i * h / 7, y1 = -(i + 1) * h / 7, w0 = 34 - i * 3.6, w1 = 34 - (i + 1) * 3.6;
      g.beginPath(); g.moveTo(-w0, y0); g.lineTo(w1, y1); g.moveTo(w0, y0); g.lineTo(-w1, y1); g.moveTo(-w1, y1); g.lineTo(w1, y1); g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(-30, -h + 16); g.lineTo(30, -h + 16); g.moveTo(-20, -h + 42); g.lineTo(20, -h + 42); g.stroke();
    g.restore();
  }
  bdHaze(g, W, H, C, 0.3);
};
