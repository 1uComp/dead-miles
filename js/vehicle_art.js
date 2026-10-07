'use strict';
/* Внешний вид транспорта по реальным прототипам (вид сбоку, метры, ось y вверх).

   Прототипы:
   • Ржавчик — ВАЗ-2108 «Спутник»: трёхдверный хэтчбек-«клин», длина 4006 мм, база 2460 мм, чёрные пластиковые
     бамперы и молдинг, длинная дверь с форточкой-треугольником, покатое стекло двери багажника;
   • Мул — Toyota Hilux N40 (1979–83): короткая кабина, плоский капот, круглые фары в решётке, хромированный
     бампер, ступенчатый задний бампер, расширители арок и полоса-декаль 80-х;
   • Бультерьер — Dodge Charger R/T 1970: длинный капот (большое расстояние от оси до стойки), «кока-кольные»
     бёдра над задним колесом, выемки на дверях, скрытые фары в решётке с хромированной рамкой-бампером,
     «пчелиная» полоса R/T вокруг кормы, утиный хвост;
   • Джаггернаут — инкассаторский грузовик на капотном шасси: бронекабина с маленькими окнами, бронированный
     кузов-фургон с бойницами, заклёпками, проблесковыми маячками и задними дверями;
   • Носорог — БРДМ-2: лодкообразный корпус (плавающая машина), наклонные бронелисты, смотровые люки
     с поднятыми крышками, конусная башня БПУ-1 с КПВТ, выдвижные колёса между осями, водомёт на корме.
   Подача формы — как в эскизах транспортного дизайна: на краске отражается небо над «линией горизонта»
   и земля под ней, по плечу проходит блик, у порога — затенение. */

/* ------------------------------ колёса ------------------------------ */

function drawWheel(ctx, x, y, ang, r, o = {}) {
  const spin = o.spin || 0;
  const style = o.style || 'alloy';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // шина: боковина со светлым кольцом-надписью
  ctx.fillStyle = o.tire || '#1a1a1c';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  const rim = r * (o.rimScale || 0.6);
  const sg = ctx.createRadialGradient(0, 0, rim, 0, 0, r);
  sg.addColorStop(0, '#2c2c30'); sg.addColorStop(0.5, '#1d1d20'); sg.addColorStop(1, '#0e0e10');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2); ctx.fill();
  if (spin < 18 && !o.bike) {
    ctx.strokeStyle = 'rgba(200,200,200,0.13)'; ctx.lineWidth = r * 0.035;
    for (let k = 0; k < 3; k++) { const a0 = k * 2.1; ctx.beginPath(); ctx.arc(0, 0, (rim + r) / 2, a0, a0 + 0.9); ctx.stroke(); }
  }
  // протектор
  const n = o.offroad ? 16 : 24;
  ctx.fillStyle = o.offroad ? '#0b0b0c' : '#28282b';
  for (let i = 0; i < n; i++) {
    ctx.save(); ctx.rotate(i / n * Math.PI * 2);
    if (o.offroad) { ctx.fillRect(r * 0.93, -r * 0.08, r * 0.12, r * 0.16); if (i % 2) ctx.fillRect(r * 0.86, -r * 0.05, r * 0.08, r * 0.1); }
    else ctx.fillRect(r * 0.94, -r * 0.02, r * 0.06, r * 0.04);
    ctx.restore();
  }
  // размытие на скорости
  if (spin > 25) {
    const rc = o.rim || '#9aa0a6';
    ctx.fillStyle = shade(rc, -0.2); ctx.beginPath(); ctx.arc(0, 0, rim, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = rim * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, rim * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = shade(rc, 0.3); ctx.beginPath(); ctx.arc(0, 0, rim * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const rc = o.rim || '#9aa0a6';
  const metal = (c, a, b) => { const g = ctx.createLinearGradient(-rim, rim, rim, -rim); g.addColorStop(0, shade(c, a)); g.addColorStop(0.5, c); g.addColorStop(1, shade(c, b)); return g; };
  if (style === 'spoke') {
    // спицованное колесо мотоцикла: обод, спицы крест-накрест, ступица, тормозной диск
    ctx.strokeStyle = metal(rc, 0.4, -0.3); ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, rim, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = shade(rc, 0.25); ctx.lineWidth = r * 0.012;
    const ns = o.spokes || 32;
    for (let i = 0; i < ns; i++) {
      const a = i / ns * Math.PI * 2, off = (i % 2 ? 0.35 : -0.35);
      ctx.beginPath(); ctx.moveTo(Math.cos(a + off) * r * 0.12, Math.sin(a + off) * r * 0.12); ctx.lineTo(Math.cos(a) * rim * 0.97, Math.sin(a) * rim * 0.97); ctx.stroke();
    }
    if (o.disc) {
      ctx.strokeStyle = 'rgba(170,170,175,0.9)'; ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#555'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.02, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = metal('#b8b8b8', 0.3, -0.4); ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = metal(rc, 0.45, -0.4);
  ctx.beginPath(); ctx.arc(0, 0, rim, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = r * 0.025;
  ctx.beginPath(); ctx.arc(0, 0, rim * 0.93, 0, Math.PI * 2); ctx.stroke();
  if (style === 'steel') {
    // штампованный диск с колпачком (ВАЗ)
    ctx.fillStyle = shade(rc, -0.35);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rim * 0.68, Math.sin(a) * rim * 0.68, rim * 0.1, rim * 0.06, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = metal('#d0d2d4', 0.4, -0.35); ctx.beginPath(); ctx.arc(0, 0, rim * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, rim * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (style === 'whitespoke') {
    // белый штампованный диск с прорезями (пикапы 80-х)
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.save(); ctx.rotate(a); roundRect(ctx, rim * 0.42, -rim * 0.07, rim * 0.36, rim * 0.14, rim * 0.06); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = metal('#e8e8e8', 0.2, -0.3); ctx.beginPath(); ctx.arc(0, 0, rim * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#444'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * rim * 0.2, Math.sin(a) * rim * 0.2, rim * 0.035, 0, Math.PI * 2); ctx.fill(); }
  } else if (style === 'magnum') {
    // хромированные «Магнум-500»: пять спиц с прорезями, центральный колпак
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + Math.PI / 5;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(rim * 0.36, -rim * 0.13); ctx.lineTo(rim * 0.82, -rim * 0.24); ctx.quadraticCurveTo(rim * 0.9, 0, rim * 0.82, rim * 0.24); ctx.lineTo(rim * 0.36, rim * 0.13); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = r * 0.02; ctx.beginPath(); ctx.arc(0, 0, rim * 0.9, Math.PI * 0.6, Math.PI * 1.1); ctx.stroke();
    ctx.fillStyle = metal('#e6e6e6', 0.35, -0.45); ctx.beginPath(); ctx.arc(0, 0, rim * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8261f'; ctx.beginPath(); ctx.arc(0, 0, rim * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (style === 'truck') {
    // грузовой диск: 10 гаек, выступающая ступица
    ctx.fillStyle = shade(rc, -0.3); ctx.beginPath(); ctx.arc(0, 0, rim * 0.75, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rim * 0.62, Math.sin(a) * rim * 0.62, rim * 0.1, rim * 0.06, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = metal(rc, 0.4, -0.3); ctx.beginPath(); ctx.arc(0, 0, rim * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0d0d0'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * rim * 0.33, Math.sin(a) * rim * 0.33, rim * 0.04, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = metal('#9a9a9a', 0.4, -0.4); ctx.beginPath(); ctx.arc(0, 0, rim * 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (style === 'military') {
    // армейский диск с системой подкачки шин: крышка ступицы и шланг
    ctx.fillStyle = shade(rc, -0.25); ctx.beginPath(); ctx.arc(0, 0, rim * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20241a'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * rim * 0.58, Math.sin(a) * rim * 0.58, rim * 0.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = metal(rc, 0.35, -0.4); ctx.beginPath(); ctx.arc(0, 0, rim * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(rim * 0.5, rim * 0.2, rim * 0.72, rim * 0.5); ctx.stroke();
    ctx.fillStyle = '#6b6b6b'; ctx.beginPath(); ctx.arc(0, 0, rim * 0.14, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = shade(rc, -0.5);
    for (let i = 0; i < (o.holes || 5); i++) { const a = i / (o.holes || 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * rim * 0.58, Math.sin(a) * rim * 0.58, rim * 0.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = shade(rc, 0.4); ctx.beginPath(); ctx.arc(0, 0, rim * 0.18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// параметры колеса для конкретной модели
function wheelLook(def, up, index, spin) {
  const art = CAR_ART[def.id];
  if (def.type === 'bike') {
    const chopper = def.bikeStyle === 'chopper';
    return { style: 'spoke', rim: def.rim, rimScale: chopper && index === 0 ? 0.72 : 0.8, spokes: chopper ? 40 : 32, disc: true, offroad: !chopper, bike: true, spin };
  }
  return { style: art ? art.wheelStyle : 'alloy', rim: def.rim, rimScale: art && art.rimScale || 0.6, offroad: def.offroad || up.tires >= 3, spin };
}

/* ------------------------------ общие приёмы ------------------------------ */

// нижняя кромка кузова с вырезами колёсных арок (от переднего края к заднему)
function archedSill(ctx, xFront, xRear, sillY, wheels, gap) {
  ctx.lineTo(xFront, sillY);
  const ws = wheels.slice().sort((a, b) => b.x - a.x);
  for (const w of ws) {
    const R = w.r + gap;
    const cy = w.y + gap * 0.3;
    ctx.lineTo(w.x + R, sillY);
    ctx.lineTo(w.x + R, cy);
    ctx.arc(w.x, cy, R, 0, Math.PI, false);
    ctx.lineTo(w.x - R, sillY);
  }
  ctx.lineTo(xRear, sillY);
}

// краска с отражением: небо сверху, «горизонт» под плечом, земля снизу
function paintGradient(ctx, color, top, shoulder, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  const k = y => clamp((top - y) / (top - bottom), 0, 1);
  g.addColorStop(0, shade(color, 0.32));
  g.addColorStop(k(shoulder + 0.02), shade(color, 0.18));
  g.addColorStop(k(shoulder - 0.005), shade(color, 0.42));
  g.addColorStop(k(shoulder - 0.05), shade(color, -0.22));
  g.addColorStop(k(shoulder - 0.2), shade(color, 0.02));
  g.addColorStop(k(bottom + 0.2), shade(color, -0.08));
  g.addColorStop(1, shade(color, -0.55));
  return g;
}

function chromeGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.45, '#9aa2a8'); g.addColorStop(0.5, '#3c4247'); g.addColorStop(0.7, '#c8ced2'); g.addColorStop(1, '#6d7479');
  return g;
}

function glassGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, '#7f9fb4'); g.addColorStop(0.35, '#3a5264'); g.addColorStop(1, '#0f1a22');
  return g;
}

function line(ctx, pts, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function drawDriverInside(ctx, x, y, skin, s, withMira) {
  // сиденья
  ctx.fillStyle = '#151a1f';
  ctx.beginPath(); ctx.ellipse(x - 0.2, y - 0.3, 0.2, 0.28, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d1115'; roundRect(ctx, x - 0.3, y - 0.02, 0.14, 0.2, 0.04); ctx.fill();
  // Мира на заднем плане (пассажирское место)
  if (withMira) {
    const P = seatedPose([x - 0.62, y - 0.64], [x - 0.24, y - 0.56], [x + 0.02, y - 1.02], -0.08, Math.sin((s.t || 0) * 0.7) * 0.1);
    P.hands.B = [x - 0.3, y - 0.52]; P.elbows = { F: 1, B: 1 };
    drawPerson(ctx, LOOKS.mira, P);
  }
  // Алекс: откинулся на сиденье, руки на руле
  const P = seatedPose([x - 0.16, y - 0.64], [x + 0.36, y - 0.18], [x + 0.55, y - 1.0], -0.14, 0.05);
  P.hands.B = [x + 0.32, y - 0.12];
  drawPerson(ctx, LOOKS.alex, P);
  ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.ellipse(x + 0.38, y - 0.16, 0.05, 0.16, 0.35, 0, Math.PI * 2); ctx.stroke();   // руль
}

// Мира в люке на крыше управляется с пулемётом
function drawMiraHatch(ctx, tx, ty, s) {
  ctx.save();
  ctx.beginPath(); ctx.rect(tx - 3, ty - 0.02, 6, 3); ctx.clip();
  const aim = clamp(s.aim || 0, -0.6, 0.6);
  const P = seatedPose([tx - 0.42, ty - 0.18], [tx - 0.06, ty + 0.2], [tx - 0.3, ty - 0.9], 0.18, aim * 0.4);
  P.hands.B = [tx - 0.1, ty + 0.26];
  drawPerson(ctx, LOOKS.mira, P);
  ctx.restore();
  ctx.fillStyle = '#1b1c1e'; ctx.fillRect(tx - 0.7, ty - 0.04, 0.5, 0.06);   // крышка люка
}

/* ------------------------------ машины ------------------------------ */

const CAR_ART = {};

// ВАЗ-2108
CAR_ART.rust = {
  wheelStyle: 'steel', sill: -0.22, shoulder: 0.36, top: 1.12, bottom: -0.28, arch: 0.08,
  anchors: { rocket: [-1.25, 0.74], roof: [-0.95, -0.1, 1.11], turret: [-0.55, 1.12], cans: [-0.95, 1.1], scoop: [0.95, 0.46], front: 2.0, rear: -1.99, plateY: [-0.14, 0.26], plateX: [-1.65, 1.45], barX: [-1.45, 0.48], door: [-0.7, 0.6], driver: [-0.3, 0.62], belt: 0.5, exhaust: [-1.98, -0.3], head: [1.96, 0.16], tail: [-1.95, 0.28] },
  body(ctx, W) {
    ctx.beginPath();
    ctx.moveTo(-1.93, -0.2);
    ctx.lineTo(-1.95, 0.46);
    ctx.quadraticCurveTo(-1.94, 0.57, -1.83, 0.585);
    ctx.lineTo(-1.62, 0.64);
    ctx.lineTo(-1.02, 1.07);
    ctx.quadraticCurveTo(-0.55, 1.14, -0.05, 1.1);
    ctx.lineTo(0.62, 0.52);
    ctx.lineTo(1.72, 0.31);
    ctx.quadraticCurveTo(1.97, 0.27, 1.98, 0.13);
    archedSill(ctx, 1.97, -1.93, -0.2, W, 0.08);
    ctx.closePath();
  },
  glass(ctx) {
    ctx.beginPath();
    ctx.moveTo(0.48, 0.55); ctx.lineTo(-0.02, 1.02); ctx.lineTo(-0.62, 1.035); ctx.lineTo(-0.62, 0.6); ctx.closePath();
    ctx.moveTo(-0.75, 0.61); ctx.lineTo(-0.75, 1.03); ctx.lineTo(-1.0, 1.01); ctx.lineTo(-1.46, 0.68); ctx.closePath();
  },
  paint(ctx, def) {
    // чёрный молдинг и накладки порогов
    ctx.fillStyle = '#1c1c1e'; ctx.fillRect(-2, -0.02, 4, 0.09);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-2, 0.055, 4, 0.012);
    // клиновидная линия плеча
    line(ctx, [[1.9, 0.24], [0.6, 0.42], [-1.9, 0.52]], 0.018, 'rgba(255,255,255,0.18)');
  },
  details(ctx, s, up, lost, def) {
    // двери, ручка, лючок бензобака, зеркало
    line(ctx, [[0.62, -0.18], [0.62, 0.5]], 0.02, 'rgba(0,0,0,0.4)');
    line(ctx, [[-0.7, -0.18], [-0.7, 1.05]], 0.02, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = '#18191b'; roundRect(ctx, -0.6, 0.4, 0.2, 0.04, 0.02); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.arc(-1.5, 0.36, 0.06, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1b1c1e'; polyPath(ctx, [[0.46, 0.54], [0.66, 0.53], [0.66, 0.66], [0.52, 0.66]]); ctx.fill();
    // уплотнители стёкол
    ctx.strokeStyle = '#111'; ctx.lineWidth = 0.03; this.glass(ctx); ctx.stroke();
    // фара и повторитель
    if (!lost('headL')) {
      ctx.fillStyle = '#e8e2c0'; polyPath(ctx, [[1.9, 0.08], [1.985, 0.07], [1.975, 0.24], [1.84, 0.27]]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(1.9, 0.18, 0.06, 0.03);
    } else { ctx.fillStyle = '#1b1b1b'; polyPath(ctx, [[1.9, 0.08], [1.985, 0.07], [1.975, 0.24], [1.84, 0.27]]); ctx.fill(); }
    ctx.fillStyle = '#e59a2a'; ctx.fillRect(1.72, 0.1, 0.12, 0.05);
    // фонарь
    if (!lost('tailL')) {
      ctx.fillStyle = s.brake ? '#ff3a2a' : '#a8201a'; ctx.fillRect(-1.97, 0.12, 0.08, 0.3);
      ctx.fillStyle = '#d88a2a'; ctx.fillRect(-1.97, 0.3, 0.08, 0.07);
      if (s.brake) { ctx.fillStyle = 'rgba(255,80,50,0.35)'; ctx.fillRect(-2.05, 0.06, 0.2, 0.42); }
    } else { ctx.fillStyle = '#1c1d1f'; ctx.fillRect(-1.97, 0.12, 0.08, 0.3); }
    // пластиковые бамперы
    ctx.fillStyle = '#1e1f21';
    if (!lost('bumperF')) { roundRect(ctx, 1.78, -0.3, 0.26, 0.26, 0.06); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(1.8, -0.1, 0.22, 0.02); }
    ctx.fillStyle = '#1e1f21';
    if (!lost('bumperR')) { roundRect(ctx, -2.03, -0.3, 0.26, 0.26, 0.06); ctx.fill(); }
    if (!lost('exhaust')) { ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-2.02, -0.33, 0.2, 0.06); }
  },
  rust(ctx) {
    // рыжие пятна и крыло другого цвета (снято с донора)
    const rng = mulberry32(77);
    for (let i = 0; i < 16; i++) {
      const x = lerp(-1.9, 1.9, rng()), y = lerp(-0.2, 0.6, rng());
      ctx.fillStyle = `rgba(${90 + rng() * 40},${40 + rng() * 20},20,${0.3 + rng() * 0.3})`;
      ctx.beginPath(); ctx.ellipse(x, y, 0.06 + rng() * 0.16, 0.04 + rng() * 0.08, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#c9c2a6';
    ctx.beginPath(); ctx.moveTo(0.66, -0.2); ctx.lineTo(0.66, 0.5); ctx.lineTo(1.72, 0.31); ctx.lineTo(1.95, 0.2); ctx.lineTo(1.97, -0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0.66, -0.2, 0.03, 0.7);
  }
};

// Toyota Hilux N40
CAR_ART.mule = {
  wheelStyle: 'whitespoke', sill: -0.12, shoulder: 0.66, top: 1.47, bottom: -0.18, arch: 0.1,
  anchors: { rocket: [-1.75, 0.95], roof: [-0.2, 0.55, 1.47], turret: [0.18, 1.48], cans: [-2.05, 0.72], bedCans: true, scoop: [1.55, 0.78], front: 2.42, rear: -2.5, plateY: [-0.05, 0.4], plateX: [-2.25, 2.05], barX: [-0.18, 1.0], door: [-0.26, 1.1], driver: [0.25, 0.92], belt: 0.72, exhaust: [-2.2, -0.2], head: [2.4, 0.5], tail: [-2.5, 0.38] },
  body(ctx, W) {
    ctx.beginPath();
    ctx.moveTo(-2.48, -0.12);
    ctx.lineTo(-2.5, 0.72);
    ctx.lineTo(-0.42, 0.72);
    ctx.lineTo(-0.36, 0.8);
    ctx.lineTo(-0.31, 1.4);
    ctx.quadraticCurveTo(-0.29, 1.47, -0.18, 1.47);
    ctx.lineTo(0.55, 1.46);
    ctx.lineTo(1.12, 0.83);
    ctx.lineTo(2.28, 0.76);
    ctx.quadraticCurveTo(2.41, 0.75, 2.41, 0.62);
    archedSill(ctx, 2.41, -2.48, -0.12, W, 0.1);
    ctx.closePath();
  },
  glass(ctx) {
    ctx.beginPath();
    ctx.moveTo(1.02, 0.87); ctx.lineTo(0.58, 1.38); ctx.lineTo(-0.18, 1.38); ctx.lineTo(-0.18, 0.87); ctx.closePath();
  },
  paint(ctx) {
    // полоса-декаль 80-х: три цвета, изгиб у двери
    const bands = [['#f2c14e', 0.46], ['#e2762b', 0.4], ['#b3402a', 0.34]];
    for (const [c, y] of bands) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-2.5, y); ctx.lineTo(0.95, y); ctx.lineTo(1.15, y + 0.12); ctx.lineTo(2.45, y + 0.12); ctx.lineTo(2.45, y + 0.16); ctx.lineTo(1.13, y + 0.16); ctx.lineTo(0.93, y + 0.04); ctx.lineTo(-2.5, y + 0.04); ctx.closePath(); ctx.fill();
    }
    line(ctx, [[-2.5, 0.64], [2.35, 0.68]], 0.02, 'rgba(255,255,255,0.25)');
  },
  details(ctx, s, up, lost, def, W) {
    // расширители арок
    ctx.strokeStyle = '#161616'; ctx.lineWidth = 0.1; ctx.lineCap = 'butt';
    for (const w of W) { ctx.beginPath(); ctx.arc(w.x, w.y + 0.03, w.r + 0.15, 0.08, Math.PI - 0.08, false); ctx.stroke(); }
    // зазор кабина-кузов, борт кузова, стойки, двери
    line(ctx, [[-0.4, -0.1], [-0.4, 0.72]], 0.03, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = shade(def.color, 0.35); ctx.fillRect(-2.48, 0.69, 2.04, 0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (const x of [-2.3, -1.2, -0.6]) ctx.fillRect(x, 0.62, 0.08, 0.06);
    line(ctx, [[-2.36, -0.1], [-2.36, 0.7]], 0.018, 'rgba(0,0,0,0.35)');
    line(ctx, [[1.12, -0.1], [1.12, 0.83]], 0.02, 'rgba(0,0,0,0.4)');
    line(ctx, [[-0.26, -0.1], [-0.26, 1.42]], 0.02, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = '#c8ccd0'; roundRect(ctx, -0.14, 0.73, 0.2, 0.04, 0.02); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 0.035; this.glass(ctx); ctx.stroke();
    line(ctx, [[0.74, 0.88], [0.74, 1.2]], 0.03, '#222');        // форточка
    // зеркало на кронштейне
    line(ctx, [[1.0, 0.9], [1.24, 1.02]], 0.03, '#999');
    ctx.fillStyle = chromeGradient(ctx, 0.95, 1.2); roundRect(ctx, 1.2, 0.94, 0.12, 0.24, 0.03); ctx.fill();
    // решётка и круглая фара
    ctx.fillStyle = '#121212'; ctx.fillRect(2.36, 0.1, 0.07, 0.6);
    if (!lost('headL')) { ctx.fillStyle = chromeGradient(ctx, 0.36, 0.64); ctx.beginPath(); ctx.ellipse(2.405, 0.5, 0.035, 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff6d0'; ctx.fillRect(2.415, 0.42, 0.02, 0.16); }
    ctx.fillStyle = '#e59a2a'; ctx.fillRect(2.3, 0.2, 0.08, 0.06);
    if (!lost('tailL')) {
      ctx.fillStyle = s.brake ? '#ff3a2a' : '#a8201a'; ctx.fillRect(-2.53, 0.2, 0.07, 0.34);
      if (s.brake) { ctx.fillStyle = 'rgba(255,80,50,0.35)'; ctx.fillRect(-2.6, 0.14, 0.2, 0.46); }
    } else { ctx.fillStyle = '#1c1d1f'; ctx.fillRect(-2.53, 0.2, 0.07, 0.34); }
    // хромированные бамперы
    if (!lost('bumperF')) { ctx.fillStyle = chromeGradient(ctx, -0.22, 0.1); roundRect(ctx, 2.3, -0.22, 0.28, 0.3, 0.04); ctx.fill(); }
    if (!lost('bumperR')) { ctx.fillStyle = chromeGradient(ctx, -0.2, 0.06); roundRect(ctx, -2.66, -0.2, 0.3, 0.24, 0.03); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-2.64, -0.02, 0.26, 0.03); }
    if (!lost('exhaust')) { ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-2.3, -0.22, 0.22, 0.06); }
  }
};

// Dodge Charger R/T 1970
CAR_ART.bull = {
  wheelStyle: 'magnum', sill: -0.2, shoulder: 0.28, top: 0.93, bottom: -0.26, arch: 0.07,
  anchors: { rocket: [-1.9, 0.62], roof: [-0.62, -0.1, 0.93], turret: [-0.38, 0.94], cans: [-1.95, 0.46], scoop: [1.1, 0.4], front: 2.44, rear: -2.4, plateY: [-0.14, 0.2], plateX: [-1.95, 1.95], barX: [-0.95, 0.4], door: [-0.6, 0.55], driver: [-0.25, 0.44], belt: 0.42, exhaust: [-2.3, -0.26], head: [2.4, 0.12], tail: [-2.38, 0.2] },
  body(ctx, W) {
    ctx.beginPath();
    ctx.moveTo(-2.33, -0.18);
    ctx.lineTo(-2.36, 0.38);
    ctx.lineTo(-2.38, 0.47);
    ctx.lineTo(-2.2, 0.465);
    ctx.quadraticCurveTo(-1.9, 0.44, -1.55, 0.47);
    ctx.bezierCurveTo(-1.2, 0.56, -1.0, 0.9, -0.62, 0.93);
    ctx.lineTo(-0.1, 0.93);
    ctx.lineTo(0.52, 0.42);
    ctx.lineTo(2.25, 0.37);
    ctx.quadraticCurveTo(2.39, 0.37, 2.41, 0.27);
    ctx.lineTo(2.36, -0.18);
    archedSill(ctx, 2.36, -2.33, -0.18, W, 0.07);
    ctx.closePath();
  },
  glass(ctx) {
    ctx.beginPath();
    ctx.moveTo(0.4, 0.46); ctx.lineTo(-0.06, 0.86); ctx.lineTo(-0.62, 0.87); ctx.bezierCurveTo(-0.85, 0.84, -0.98, 0.64, -1.08, 0.5); ctx.closePath();
  },
  paint(ctx, def) {
    // «кока-кольные» бёдра: блик-складка проседает на двери и поднимается над задним колесом
    line(ctx, [[2.35, 0.27], [1.2, 0.25], [0.2, 0.2], [-0.8, 0.26], [-1.4, 0.34], [-2.3, 0.36]], 0.02, 'rgba(255,255,255,0.22)');
    // выемки на дверях
    for (const [x0, x1] of [[0.45, -0.05], [-0.1, -0.55]]) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, 0.14); ctx.quadraticCurveTo((x0 + x1) / 2, 0.24, x1, 0.2); ctx.quadraticCurveTo((x0 + x1) / 2, 0.08, x0, 0.14); ctx.fill();
    }
    // «пчелиная» полоса R/T вокруг кормы
    ctx.fillStyle = def.color2; ctx.fillRect(-2.0, -0.2, 0.16, 0.7);
    ctx.fillStyle = '#111'; ctx.fillRect(-1.97, -0.2, 0.02, 0.7); ctx.fillRect(-1.88, -0.2, 0.02, 0.7);
  },
  details(ctx, s, up, lost, def) {
    // хром: водосток, порог, ручка
    ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(0.44, 0.44); ctx.lineTo(-0.08, 0.9); ctx.lineTo(-0.62, 0.905); ctx.bezierCurveTo(-0.88, 0.87, -1.02, 0.64, -1.12, 0.48); ctx.stroke();
    ctx.fillStyle = chromeGradient(ctx, -0.18, -0.12); ctx.fillRect(-1.95, -0.19, 3.3, 0.045);
    line(ctx, [[0.55, -0.16], [0.55, 0.4]], 0.018, 'rgba(0,0,0,0.5)');
    line(ctx, [[-0.62, -0.16], [-0.62, 0.45]], 0.018, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = '#c8ccd0'; ctx.fillRect(-0.48, 0.32, 0.16, 0.035);
    ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = 0.03; this.glass(ctx); ctx.stroke();
    line(ctx, [[-0.5, 0.48], [-0.5, 0.86]], 0.02, '#aaa');
    // габариты на крыльях
    ctx.fillStyle = '#e59a2a'; ctx.fillRect(2.12, 0.04, 0.12, 0.05);
    ctx.fillStyle = '#a8201a'; ctx.fillRect(-2.28, 0.04, 0.12, 0.05);
    // скрытые фары в чёрной решётке с хромированной рамкой-бампером
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(2.34, -0.02, 0.08, 0.27);
    if (!lost('bumperF')) { ctx.strokeStyle = chromeGradient(ctx, -0.12, 0.3); ctx.lineWidth = 0.05; ctx.strokeRect(2.33, -0.1, 0.12, 0.38); }
    if (lost('headL')) { ctx.fillStyle = '#222'; ctx.fillRect(2.38, 0.08, 0.04, 0.1); ctx.fillStyle = 'rgba(230,235,210,0.6)'; ctx.fillRect(2.4, 0.1, 0.02, 0.04); }
    if (!lost('tailL')) {
      ctx.fillStyle = s.brake ? '#ff3a2a' : '#a8201a'; ctx.fillRect(-2.4, 0.08, 0.06, 0.26);
      if (s.brake) { ctx.fillStyle = 'rgba(255,80,50,0.35)'; ctx.fillRect(-2.46, 0.03, 0.16, 0.36); }
    } else { ctx.fillStyle = '#1c1d1f'; ctx.fillRect(-2.4, 0.08, 0.06, 0.26); }
    if (!lost('bumperR')) { ctx.fillStyle = chromeGradient(ctx, -0.16, 0.04); roundRect(ctx, -2.46, -0.17, 0.18, 0.2, 0.04); ctx.fill(); }
    if (!lost('exhaust')) { ctx.fillStyle = chromeGradient(ctx, -0.3, -0.22); ctx.fillRect(-2.36, -0.29, 0.2, 0.06); ctx.fillRect(-2.2, -0.29, 0.12, 0.06); }
  }
};

// инкассаторский броневик на капотном шасси
CAR_ART.jugg = {
  wheelStyle: 'truck', sill: 0.0, shoulder: 0.94, top: 2.02, bottom: -0.1, arch: 0.1,
  anchors: { rocket: [-2.25, 1.2], roof: [-2.7, 0.9, 2.03], turret: [-0.6, 2.04], cans: [-2.3, 2.03], scoop: [1.95, 0.99], front: 2.8, rear: -2.93, plateY: [0.1, 0.62], plateX: [-2.55, 2.35], barX: [0.72, 1.3], door: [0.6, 1.42], driver: [0.95, 1.3], belt: 0.95, exhaust: [-0.1, -0.12], head: [2.78, 0.62], tail: [-2.93, 0.58], truck: true },
  body(ctx, W) {
    ctx.beginPath();
    ctx.moveTo(-2.88, -0.06);
    ctx.lineTo(-2.92, 2.02);
    ctx.lineTo(1.0, 2.02);
    ctx.lineTo(1.12, 1.97);
    ctx.lineTo(1.46, 1.06);
    ctx.lineTo(1.56, 1.02);
    ctx.lineTo(2.65, 0.98);
    ctx.quadraticCurveTo(2.79, 0.97, 2.79, 0.84);
    archedSill(ctx, 2.79, -2.88, -0.06, W, 0.1);
    ctx.closePath();
  },
  glass(ctx) {
    ctx.beginPath();
    ctx.moveTo(0.74, 1.2); ctx.lineTo(1.28, 1.2); ctx.lineTo(1.12, 1.66); ctx.lineTo(0.74, 1.66); ctx.closePath();
  },
  paint(ctx, def) {
    // стык кабины и бронекузова, панели и заклёпки
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0.52, -0.06, 0.05, 2.08);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-2.9, 0.92, 3.42, 0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const x of [-0.6, -1.8]) ctx.fillRect(x, 0.0, 0.02, 2.0);
    for (let x = -2.85; x < 0.5; x += 0.2) { ctx.beginPath(); ctx.arc(x, 1.95, 0.018, 0, Math.PI * 2); ctx.arc(x, 0.05, 0.018, 0, Math.PI * 2); ctx.fill(); }
    for (const x of [-0.6, -1.8]) for (let y = 0.15; y < 1.95; y += 0.22) { ctx.beginPath(); ctx.arc(x + 0.06, y, 0.016, 0, Math.PI * 2); ctx.fill(); }
    // светоотражающая полоса и эмблема-щит
    ctx.fillStyle = '#d8d6c8'; ctx.fillRect(-2.9, 0.5, 5.6, 0.07);
    // эмблема инкассации: щит с монетой
    ctx.fillStyle = '#c4a042';
    ctx.beginPath(); ctx.moveTo(-1.2, 1.55); ctx.lineTo(-0.9, 1.55); ctx.lineTo(-0.9, 1.25); ctx.quadraticCurveTo(-0.9, 1.08, -1.05, 1.0); ctx.quadraticCurveTo(-1.2, 1.08, -1.2, 1.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(def.color, -0.3); ctx.beginPath(); ctx.arc(-1.05, 1.3, 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c4a042'; ctx.beginPath(); ctx.arc(-1.05, 1.3, 0.05, 0, Math.PI * 2); ctx.fill();
  },
  details(ctx, s, up, lost, def) {
    // щели-окна и бойницы бронекузова
    ctx.fillStyle = '#10161b';
    for (const x of [-0.25, -1.45, -2.45]) { roundRect(ctx, x - 0.2, 1.52, 0.4, 0.09, 0.03); ctx.fill(); }
    ctx.fillStyle = '#26282a';
    for (const [x, y] of [[-1.25, 0.95], [-2.35, 0.95], [1.02, 0.84]]) { ctx.beginPath(); ctx.arc(x, y, 0.07, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(x, y, 0.035, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#26282a'; }
    // маячки на крыше
    for (const x of [-2.8, 0.85]) { ctx.fillStyle = '#e8a41c'; roundRect(ctx, x - 0.06, 2.02, 0.12, 0.08, 0.03); ctx.fill(); }
    // кабина: дверь, толстое окно, зеркало, решётка капота
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.02; ctx.strokeRect(0.62, 0.02, 0.8, 1.72);
    ctx.strokeStyle = '#1b1d1f'; ctx.lineWidth = 0.08; this.glass(ctx); ctx.stroke();
    ctx.fillStyle = '#c8ccd0'; ctx.fillRect(0.66, 1.0, 0.16, 0.04);
    line(ctx, [[1.4, 1.2], [1.62, 1.28]], 0.035, '#777');
    ctx.fillStyle = '#16181a'; roundRect(ctx, 1.58, 1.08, 0.08, 0.34, 0.02); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let k = 0; k < 5; k++) ctx.fillRect(2.0 + k * 0.1, 0.62, 0.04, 0.26);
    ctx.fillStyle = chromeGradient(ctx, 0.1, 0.92); ctx.fillRect(2.72, 0.1, 0.08, 0.82);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; for (let y = 0.16; y < 0.9; y += 0.08) ctx.fillRect(2.73, y, 0.07, 0.03);
    if (!lost('headL')) { ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.ellipse(2.8, 0.62, 0.035, 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(2.8, 0.62, 0.035, 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    // задние двери и фонари
    line(ctx, [[-2.8, 0.1], [-2.8, 1.9]], 0.02, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = '#555'; for (const y of [0.35, 1.0, 1.65]) ctx.fillRect(-2.94, y, 0.06, 0.12);
    if (!lost('tailL')) {
      ctx.fillStyle = s.brake ? '#ff3a2a' : '#a8201a'; ctx.fillRect(-2.96, 0.4, 0.07, 0.36);
      if (s.brake) { ctx.fillStyle = 'rgba(255,80,50,0.35)'; ctx.fillRect(-3.02, 0.34, 0.2, 0.48); }
    } else { ctx.fillStyle = '#1c1d1f'; ctx.fillRect(-2.96, 0.4, 0.07, 0.36); }
    // стальные бамперы
    ctx.fillStyle = '#2a2b2d';
    if (!lost('bumperF')) { ctx.fillRect(2.7, -0.12, 0.3, 0.34); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(2.7, 0.18, 0.3, 0.03); }
    ctx.fillStyle = '#2a2b2d';
    if (!lost('bumperR')) { ctx.fillRect(-3.04, -0.1, 0.22, 0.26); }
    if (!lost('exhaust')) { ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-0.3, -0.16, 0.5, 0.08); }
  }
};

// БРДМ-2
CAR_ART.rhino = {
  wheelStyle: 'military', sill: 0.02, shoulder: 1.0, top: 1.86, bottom: -0.05, arch: 0.12,
  anchors: { rocket: [-2.45, 1.2], roof: [-2.1, 0.9, 1.86], turret: [0.0, 1.9], cans: [-2.55, 1.66], front: 3.05, rear: -3.13, plateY: [0.12, 0.62], plateX: [-2.7, 1.6], barX: [1.3, 1.62], door: [-0.3, 0.3], driver: [1.4, 1.35], belt: 1.0, exhaust: [-3.05, 0.9], head: [2.7, 0.9], tail: [-3.1, 1.2], truck: true, apc: true },
  body(ctx, W) {
    ctx.beginPath();
    ctx.moveTo(-2.72, 0.02);
    ctx.lineTo(-3.1, 0.55);
    ctx.lineTo(-3.13, 1.35);
    ctx.lineTo(-2.96, 1.62);
    ctx.lineTo(-2.2, 1.78);
    ctx.lineTo(0.95, 1.86);
    ctx.lineTo(1.28, 1.8);
    ctx.lineTo(1.74, 1.1);
    ctx.lineTo(3.02, 0.54);
    ctx.lineTo(2.92, 0.3);
    ctx.lineTo(2.46, 0.02);
    archedSill(ctx, 2.46, -2.72, 0.02, W, 0.12);
    ctx.closePath();
  },
  glass(ctx) {
    // смотровые окна механика-водителя и командира на лобовом листе
    ctx.beginPath();
    ctx.moveTo(1.32, 1.72); ctx.lineTo(1.46, 1.5); ctx.lineTo(1.64, 1.54); ctx.lineTo(1.5, 1.76); ctx.closePath();
  },
  paint(ctx, def) {
    // верхний наклонный лист светлее нижнего корпуса, скула корпуса-лодки
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(-3.12, 1.05); ctx.lineTo(1.7, 1.12); ctx.lineTo(1.28, 1.8); ctx.lineTo(-2.2, 1.78); ctx.lineTo(-2.96, 1.62); ctx.closePath(); ctx.fill();
    line(ctx, [[-3.12, 1.05], [1.7, 1.12], [3.0, 0.55]], 0.03, 'rgba(0,0,0,0.35)');
    line(ctx, [[-3.1, 1.08], [1.7, 1.15]], 0.015, 'rgba(255,255,255,0.18)');
    // сварные швы и болты
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const x of [-2.2, -1.0, 0.3]) ctx.fillRect(x, 0.05, 0.02, 1.0);
    for (let x = -2.9; x < 1.6; x += 0.3) { ctx.beginPath(); ctx.arc(x, 1.75, 0.02, 0, Math.PI * 2); ctx.fill(); }
  },
  behind(ctx, s) {
    // выдвижные колёса для преодоления рвов
    for (const x of [-0.45, 0.45]) {
      ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(x, -0.18, 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d5a3a'; ctx.beginPath(); ctx.arc(x, -0.18, 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2c2f24'; ctx.fillRect(-0.6, -0.1, 1.2, 0.14);
  },
  details(ctx, s, up, lost, def) {
    // поднятые бронекрышки смотровых люков
    ctx.fillStyle = shade(def.color, -0.15);
    polyPath(ctx, [[1.3, 1.8], [1.52, 1.8], [1.9, 2.02], [1.66, 2.06]]); ctx.fill();
    ctx.strokeStyle = '#1b1d18'; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.strokeStyle = '#1b1d18'; ctx.lineWidth = 0.05; this.glass(ctx); ctx.stroke();
    // бортовой ящик ЗИП, трос, поручни, бойница
    ctx.fillStyle = shade(def.color, -0.22); roundRect(ctx, -1.85, 1.15, 0.9, 0.3, 0.03); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.02; ctx.strokeRect(-1.85, 1.15, 0.9, 0.3);
    line(ctx, [[-2.6, 1.55], [-0.2, 1.62]], 0.03, '#2a2a22');
    ctx.strokeStyle = '#2a2d22'; ctx.lineWidth = 0.035;
    for (const x of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(x - 0.2, 1.86); ctx.lineTo(x - 0.2, 1.94); ctx.lineTo(x + 0.2, 1.94); ctx.lineTo(x + 0.2, 1.86); ctx.stroke(); }
    ctx.fillStyle = '#1a1c16'; ctx.beginPath(); ctx.arc(0.55, 1.3, 0.06, 0, Math.PI * 2); ctx.fill();
    // фары с защитными решётками на лобовом листе
    if (!lost('headL')) {
      ctx.fillStyle = '#e8e2c0'; ctx.beginPath(); ctx.arc(2.62, 0.9, 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b1d18'; ctx.lineWidth = 0.015; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(2.55, 0.9 + k * 0.04); ctx.lineTo(2.69, 0.9 + k * 0.04); ctx.stroke(); }
    }
    // водомёт на корме, фонари, буксирные крюки
    ctx.fillStyle = '#24261e'; roundRect(ctx, -3.18, 0.42, 0.12, 0.34, 0.05); ctx.fill();
    if (!lost('tailL')) { ctx.fillStyle = s.brake ? '#ff3a2a' : '#a8201a'; ctx.fillRect(-3.16, 1.15, 0.05, 0.12); }
    ctx.fillStyle = '#1c1d18'; ctx.fillRect(2.88, 0.2, 0.14, 0.05); ctx.fillRect(-3.2, 0.9, 0.1, 0.05);
    // антенна
    line(ctx, [[-2.5, 1.8], [-2.62 - Math.sin(s.t * 3) * 0.02, 2.75]], 0.02, '#2a2a2a');
  },
  // башня БПУ-1 с КПВТ; с пулемётом-апгрейдом ствол следит за целью
  turret(ctx, s, up) {
    const bx = 0.0, by = 1.86;
    ctx.fillStyle = shade('#5b6640', -0.08);
    ctx.beginPath(); ctx.moveTo(bx - 0.62, by); ctx.lineTo(bx - 0.42, by + 0.44); ctx.lineTo(bx + 0.36, by + 0.44); ctx.lineTo(bx + 0.62, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.02; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(bx - 0.6, by + 0.02); ctx.lineTo(bx - 0.42, by + 0.42); ctx.lineTo(bx - 0.2, by + 0.42); ctx.lineTo(bx - 0.3, by + 0.02); ctx.fill();
    ctx.fillStyle = '#2a2d22'; ctx.fillRect(bx - 0.1, by + 0.44, 0.24, 0.06);
    const aim = up.gun ? clamp(s.aim, -0.4, 0.5) : 0.02;
    ctx.save(); ctx.translate(bx + 0.34, by + 0.24); ctx.rotate(aim);
    const rec = (s.recoil || 0) * 0.08;
    ctx.fillStyle = '#23261e'; ctx.fillRect(-0.05 - rec, -0.06, 0.34, 0.12);
    ctx.fillStyle = '#1b1d18'; ctx.fillRect(0.28 - rec, -0.035, 1.05, 0.07);
    ctx.fillStyle = '#3a3d34'; ctx.fillRect(1.1 - rec, -0.05, 0.2, 0.1);
    ctx.fillStyle = '#1b1d18'; ctx.fillRect(0.2 - rec, 0.07, 0.5, 0.04);
    if (up.gun && s.recoil > 0.6) { ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.moveTo(1.34, 0); ctx.lineTo(1.6, 0.1); ctx.lineTo(1.72, 0); ctx.lineTo(1.6, -0.1); ctx.fill(); }
    ctx.restore();
  }
};

/* ------------------------------ кузов с апгрейдами и повреждениями ------------------------------ */

function drawCarBody(ctx, def, up, s) {
  const p = def.look;
  const art = CAR_ART[def.id] || CAR_ART.rust;
  const A = art.anchors;
  const W = def.wheels;
  const armor = up.armor || 0;
  const D = s.dmg, lost = k => !!(D && D.lost.has(k));
  // ракетный ускоритель позади кузова
  if (up.boost && !lost('rocket')) drawRocket(ctx, A.rocket[0], A.rocket[1], 0.9 + up.boost * 0.1, s.boosting, s.t, true);
  if (art.behind) art.behind(ctx, s, up, lost);
  // колёсные ниши
  for (const w of W) {
    const R = w.r + art.arch;
    const g = ctx.createRadialGradient(w.x, w.y + R * 0.4, R * 0.2, w.x, w.y, R * 1.05);
    g.addColorStop(0, '#1e1f21'); g.addColorStop(1, '#070708');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(w.x - R, w.y - 0.1); ctx.arc(w.x, w.y + art.arch * 0.3, R, Math.PI, 0, true); ctx.lineTo(w.x + R, w.y - 0.1); ctx.closePath(); ctx.fill();
  }
  // кузов: краска с отражениями
  ctx.save();
  art.body(ctx, W);
  ctx.fillStyle = paintGradient(ctx, def.color, art.top, art.shoulder, art.bottom);
  ctx.fill();
  ctx.clip();
  if (art.paint) art.paint(ctx, def);
  if (def.rust && art.rust) art.rust(ctx);
  if (def.military) {
    const rng = mulberry32(31);
    for (let i = 0; i < 22; i++) {
      const x = lerp(A.rear, A.front, rng()), y = lerp(art.bottom, art.top, rng());
      ctx.fillStyle = ['rgba(52,60,40,0.85)', 'rgba(110,118,80,0.8)', 'rgba(38,42,30,0.85)'][i % 3];
      ctx.beginPath(); ctx.ellipse(x, y, 0.25 + rng() * 0.45, 0.12 + rng() * 0.2, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#d8d8c0'; ctx.fillRect(-1.2, 1.25, 0.5, 0.06); ctx.fillRect(-1.2, 1.36, 0.5, 0.06);
  }
  // грязь у порогов и в арках
  const mud = ctx.createLinearGradient(0, art.sill, 0, art.sill + 0.5);
  mud.addColorStop(0, 'rgba(60,45,30,0.65)'); mud.addColorStop(1, 'rgba(60,45,30,0)');
  ctx.fillStyle = mud; ctx.fillRect(A.rear - 0.2, art.sill - 0.2, A.front - A.rear + 0.4, 0.7);
  for (const w of W) {
    const mg = ctx.createRadialGradient(w.x, w.y, w.r, w.x, w.y, w.r + 0.3);
    mg.addColorStop(0, 'rgba(50,38,26,0.55)'); mg.addColorStop(1, 'rgba(50,38,26,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(w.x, w.y, w.r + 0.3, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of s.blood) {
    ctx.fillStyle = 'rgba(110,8,8,0.85)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(b.x - 0.02, b.y - b.r * 2.2, 0.04, b.r * 2);
  }
  if (D) D.drawScuffs(ctx);
  ctx.restore();
  art.body(ctx, W);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.03; ctx.stroke();

  // кузов пикапа: груз
  if (A.bedCans && up.fuel && !lost('cans')) for (let i = 0; i < Math.min(3, up.fuel); i++) drawJerrycan(ctx, -2.15 + i * 0.45, 0.72, 0.36);

  // стёкла, водитель внутри, отражение
  const winPath = () => art.glass(ctx);
  const broken = D && D.glass === 2;
  winPath();
  ctx.fillStyle = broken ? '#0c1115' : glassGradient(ctx, art.top - 0.7, art.top);
  ctx.fill();
  ctx.save(); winPath(); ctx.clip();
  drawDriverInside(ctx, A.driver[0], A.driver[1], def.driver, s, s.passenger === 'mira' && !(up.gun && !lost('turret')));
  if (!broken) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.moveTo(A.barX[1], art.top); ctx.lineTo(A.barX[1] - 0.25, art.top); ctx.lineTo(A.barX[1] - 0.75, art.top - 0.8); ctx.lineTo(A.barX[1] - 0.5, art.top - 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(A.barX[1] - 0.4, art.top); ctx.lineTo(A.barX[1] - 0.48, art.top); ctx.lineTo(A.barX[1] - 0.98, art.top - 0.8); ctx.lineTo(A.barX[1] - 0.9, art.top - 0.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (D && D.glass) D.drawGlassDamage(ctx, winPath);

  art.details(ctx, s, up, lost, def, W);

  // решётки на окна (броня 1+)
  if (armor >= 1 || def.armored) {
    ctx.save(); winPath(); ctx.clip();
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 0.035;
    for (let x = A.barX[0] + 0.05; x < A.barX[1] + 0.1; x += 0.15) { ctx.beginPath(); ctx.moveTo(x, art.bottom); ctx.lineTo(x, art.top + 0.1); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.03; winPath(); ctx.stroke();
  }
  // сорванная дверь: проём с сиденьем
  if (lost('door')) {
    const x0 = A.door[0], x1 = A.door[1], y0 = art.sill + 0.08, y1 = A.belt;
    ctx.fillStyle = '#121416'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#3a2f2a'; ctx.fillRect(x0 + 0.1, y0 + 0.16, (x1 - x0) * 0.5, 0.14);
    ctx.fillRect(x0 + 0.08, y0 + 0.16, 0.12, y1 - y0 - 0.2);
    line(ctx, [[x1, y0 + 0.05], [x1 + 0.04, y1 - 0.05]], 0.03, '#6b6f73');
  }
  // бронелисты (броня 2+)
  if (armor >= 2 || def.armored) {
    const plates = def.armored ? 6 : 3;
    const [py0, py1] = A.plateY;
    for (let i = 0; i < plates; i++) {
      const x = lerp(A.plateX[0], A.plateX[1], i / Math.max(1, plates - 1));
      if (lost('plate' + i)) {
        ctx.fillStyle = 'rgba(30,30,30,0.35)'; ctx.fillRect(x - 0.3, py0, 0.6, py1 - py0);
        ctx.fillStyle = '#999';
        for (const rx of [x - 0.24, x + 0.24]) { ctx.beginPath(); ctx.arc(rx, py0 + 0.06, 0.025, 0, Math.PI * 2); ctx.fill(); }
        continue;
      }
      drawPlate(ctx, x - 0.3, py0, 0.6, py1 - py0, '#6d7074');
    }
  }
  // воздухозаборник на капоте (мотор 3+)
  if ((up.engine || 0) >= 3 && A.scoop && !A.apc) {
    const [sx, sy] = A.scoop;
    ctx.fillStyle = '#1b1b1b';
    polyPath(ctx, [[sx - 0.3, sy], [sx - 0.18, sy + 0.2], [sx + 0.28, sy + 0.2], [sx + 0.36, sy - 0.02]]); ctx.fill();
    ctx.fillStyle = chromeGradient(ctx, sy + 0.05, sy + 0.15); ctx.fillRect(sx - 0.12, sy + 0.06, 0.34, 0.06);
  }
  // таран (броня 3+)
  const fx = A.front;
  const ty0 = art.sill - 0.12, ty1 = A.truck ? art.shoulder + 0.05 : A.belt + 0.05;
  if ((armor >= 3 || def.armored) && lost('plow')) {
    line(ctx, [[fx - 0.08, ty0 + 0.15], [fx + 0.18, ty0 + 0.05]], 0.06, '#3b3e42');
    line(ctx, [[fx - 0.08, ty1 - 0.15], [fx + 0.14, ty1 - 0.25]], 0.06, '#3b3e42');
  } else if (armor >= 3 || def.armored) {
    const g = ctx.createLinearGradient(0, ty1, 0, ty0);
    g.addColorStop(0, '#6a6e72'); g.addColorStop(0.5, '#44484c'); g.addColorStop(1, '#2c2f32');
    ctx.fillStyle = g;
    polyPath(ctx, [[fx - 0.12, ty0], [fx + 0.55, ty0 + 0.15], [fx + 0.28, ty1 + 0.05], [fx - 0.12, ty1]]);
    ctx.fill();
    ctx.strokeStyle = '#1f2123'; ctx.lineWidth = 0.03; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,200,200,0.35)'; ctx.lineWidth = 0.04;
    for (let i = 0; i < 4; i++) { const y = lerp(ty0 + 0.05, ty1 - 0.05, i / 3); ctx.beginPath(); ctx.moveTo(fx - 0.08, y); ctx.lineTo(fx + 0.42 - i * 0.07, y + 0.02); ctx.stroke(); }
    if (armor >= 4) {
      ctx.fillStyle = '#cfcfcf';
      for (let i = 0; i < 4; i++) { const y = lerp(ty0 + 0.08, ty1, i / 3); const bx = fx + 0.48 - i * 0.08; polyPath(ctx, [[bx - 0.05, y - 0.05], [bx + 0.25, y], [bx - 0.05, y + 0.05]]); ctx.fill(); }
    }
  }
  // шипы на крыше (броня 4+)
  const [rx0, rx1, ry] = A.roof;
  if (armor >= 4) {
    ctx.fillStyle = '#bdbdbd';
    for (let x = rx0 + 0.1; x < rx1; x += 0.22) { polyPath(ctx, [[x - 0.05, ry], [x, ry + 0.22], [x + 0.05, ry]]); ctx.fill(); }
  }
  // колючая проволока (броня 5)
  if (armor >= 5) {
    ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let x = A.rear + 0.2; x < A.front - 0.3; x += 0.1) ctx.lineTo(x, A.belt + 0.02 + (Math.floor(x * 10) % 2 ? 0.04 : -0.02));
    ctx.stroke();
  }
  // канистры на крыше
  if (up.fuel && !A.bedCans && !lost('cans')) {
    for (let i = 0; i < Math.min(2, Math.ceil(up.fuel / 2)); i++) drawJerrycan(ctx, A.cans[0] + i * 0.4, A.cans[1], 0.32);
  }
  // пулемёт
  const miraHatch = s.passenger === 'mira' && up.gun && !lost('turret');
  if (miraHatch) drawMiraHatch(ctx, A.turret[0], art.anchors.roof[2], s);
  if (art.turret) art.turret(ctx, s, up, lost);
  else if (up.gun && !lost('turret')) drawTurret(ctx, A.turret[0], A.turret[1], s.aim, s.recoil, up.gun);
  else if (up.gun) { ctx.fillStyle = '#23272a'; ctx.fillRect(A.turret[0] - 0.15, A.turret[1] - 0.02, 0.3, 0.07); }
}

/* ------------------------------ мотоциклы ------------------------------ */
/* Кузнечик — эндуро в духе Honda XR250R / KTM EXC: наклон рулевой колонки ~25°, 21" спереди, 18" сзади,
   длинноходная вилка, высокое переднее крыло, «маска» с фарой и номером, защита рук, одноцилиндровый мотор,
   маятник с моноамортизатором, длинное плоское сиденье, задранный вверх глушитель и крыло.
   Цербер — олдскульный чоппер-хардтейл: жёсткая рама без задней подвески, пружинная вилка с большим вылетом,
   V-твин 45° с круглым воздушным фильтром, бак-«капля», соло-седло на пружинах, «обезьяний» руль,
   трубы-«рыбьи хвосты», спинка «сисси-бар» и широкое заднее колесо. */

function tube(ctx, pts, w, color, hl) {
  line(ctx, pts, w, color);
  if (hl) line(ctx, pts.map(([x, y]) => [x - w * 0.15, y + w * 0.25]), w * 0.3, hl);
}

function drawBike(ctx, def, up, s, veh) {
  const chopper = def.bikeStyle === 'chopper';
  // заднее колесо — фактическое положение (маятник/рама двигаются с подвеской)
  const rw = def.wheels[0];
  let rwx = rw.x, rwy = rw.y;
  if (veh) { const w = veh.wheels[0], c = veh.chassis; const l = c.worldToLocal(w.x, w.y); rwx = l.x + c.com.x; rwy = l.y + c.com.y; }
  if (up.boost) drawRocket(ctx, chopper ? -0.75 : -0.6, chopper ? 0.62 : 0.52, 0.7, s.boosting, s.t, true);
  if (chopper) drawChopper(ctx, def, up, s, rwx, rwy);
  else drawEnduro(ctx, def, up, s, rwx, rwy);
  // защитная рама (броня)
  if (up.armor) {
    ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.3, -0.12); ctx.quadraticCurveTo(0.62, 0.05, 0.5, 0.48); ctx.stroke();
    if (up.armor >= 3) { ctx.beginPath(); ctx.moveTo(-0.3, 0.0); ctx.quadraticCurveTo(-0.62, -0.08, -0.6, 0.3); ctx.stroke(); }
  }
  if (!s.crashed) drawRider(ctx, def, up, s, chopper);
}

function drawEnduro(ctx, def, up, s, rwx, rwy) {
  const col = def.color, dark = '#1c1c1e';
  const piv = [-0.12, 0.08];
  // цепь
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 0.022;
  ctx.beginPath(); ctx.moveTo(-0.02, 0.1); ctx.lineTo(rwx + 0.02, rwy + 0.13); ctx.moveTo(-0.02, -0.03); ctx.lineTo(rwx + 0.02, rwy - 0.12); ctx.stroke();
  // маятник (сужающийся алюминиевый профиль)
  const ang = Math.atan2(rwy - piv[1], rwx - piv[0]), len = Math.hypot(rwx - piv[0], rwy - piv[1]);
  ctx.save(); ctx.translate(piv[0], piv[1]); ctx.rotate(ang);
  const sg = ctx.createLinearGradient(0, 0.06, 0, -0.06); sg.addColorStop(0, '#d9dcde'); sg.addColorStop(0.5, '#8a8f93'); sg.addColorStop(1, '#5a5f63');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, -0.055); ctx.lineTo(len, -0.032); ctx.lineTo(len, 0.032); ctx.lineTo(0, 0.055); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // моноамортизатор с жёлтой пружиной
  const sx = lerp(piv[0], rwx, 0.3), sy = lerp(piv[1], rwy, 0.3);
  line(ctx, [[-0.26, 0.5], [sx, sy]], 0.05, '#2b2b2b');
  const dx = sx + 0.26, dy = sy - 0.5, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  ctx.strokeStyle = '#e8c21a'; ctx.lineWidth = 0.022; ctx.beginPath();
  for (let k = 0; k <= 10; k++) { const t = 0.15 + k / 10 * 0.6, o = (k % 2 ? 1 : -1) * 0.045; ctx.lineTo(-0.26 + dx * t + nx * o, 0.5 + dy * t + ny * o); }
  ctx.stroke();
  // рама: двойная колыбель и подрамник
  tube(ctx, [[0.46, 0.66], [0.22, -0.1], [-0.12, -0.12], [-0.14, 0.12], [-0.24, 0.5]], 0.05, '#2a2a2c', 'rgba(255,255,255,0.18)');
  tube(ctx, [[0.46, 0.66], [-0.24, 0.52], [-0.9, 0.56]], 0.045, '#2a2a2c', 'rgba(255,255,255,0.18)');
  tube(ctx, [[-0.24, 0.3], [-0.8, 0.52]], 0.035, '#2a2a2c');
  // мотор: картер, крышка сцепления, оребрённый цилиндр
  const cg = ctx.createLinearGradient(0, 0.22, 0, -0.16); cg.addColorStop(0, '#b8bcc0'); cg.addColorStop(1, '#55595d');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.moveTo(-0.16, -0.12); ctx.quadraticCurveTo(-0.2, 0.16, -0.02, 0.2); ctx.lineTo(0.2, 0.18); ctx.quadraticCurveTo(0.26, -0.02, 0.14, -0.14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8e9296'; ctx.beginPath(); ctx.arc(0.04, 0.03, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(0.04, 0.03, 0.07, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.translate(0.14, 0.2); ctx.rotate(-0.22);
  ctx.fillStyle = '#6a6e72'; ctx.fillRect(-0.1, 0, 0.2, 0.26);
  ctx.fillStyle = '#9a9ea2'; for (let k = 0; k < 6; k++) ctx.fillRect(-0.13, 0.02 + k * 0.04, 0.26, 0.018);
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-0.09, 0.26, 0.18, 0.08);
  ctx.restore();
  // выпуск: колено вперёд-вниз, труба назад, задранный глушитель
  tube(ctx, [[0.24, 0.4], [0.34, 0.24], [0.28, 0.02], [0.04, -0.06], [-0.3, 0.06], [-0.5, 0.3]], 0.04, '#8a6a4a', 'rgba(255,220,180,0.3)');
  const mg = ctx.createLinearGradient(0, 0.46, 0, 0.26); mg.addColorStop(0, '#e0e3e6'); mg.addColorStop(1, '#7d8286');
  ctx.save(); ctx.translate(-0.72, 0.38); ctx.rotate(0.12);
  ctx.fillStyle = mg; roundRect(ctx, -0.26, -0.065, 0.44, 0.13, 0.05); ctx.fill();
  ctx.fillStyle = '#1b1b1b'; roundRect(ctx, -0.3, -0.055, 0.08, 0.11, 0.03); ctx.fill();
  ctx.restore();
  // защита картера
  ctx.fillStyle = '#9ca1a5'; polyPath(ctx, [[-0.16, -0.18], [0.24, -0.18], [0.3, -0.06], [0.2, -0.14], [-0.12, -0.14]]); ctx.fill();
  // заднее крыло, номерная боковина, сиденье
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-0.3, 0.6); ctx.lineTo(-1.2, 0.7); ctx.lineTo(-1.22, 0.64); ctx.quadraticCurveTo(-0.8, 0.52, -0.3, 0.48); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.moveTo(-0.62, 0.56); ctx.lineTo(-0.2, 0.56); ctx.lineTo(-0.24, 0.3); ctx.quadraticCurveTo(-0.5, 0.26, -0.66, 0.4); ctx.closePath(); ctx.fill();
  // номер «07» на боковине, нарисованный прямоугольниками
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(-0.52, 0.38, 0.03, 0.13); ctx.fillRect(-0.44, 0.38, 0.03, 0.13); ctx.fillRect(-0.52, 0.38, 0.11, 0.025); ctx.fillRect(-0.52, 0.485, 0.11, 0.025);
  ctx.fillRect(-0.36, 0.485, 0.1, 0.025); ctx.beginPath(); ctx.moveTo(-0.28, 0.51); ctx.lineTo(-0.255, 0.5); ctx.lineTo(-0.32, 0.38); ctx.lineTo(-0.35, 0.38); ctx.fill();
  const seat = ctx.createLinearGradient(0, 0.74, 0, 0.6); seat.addColorStop(0, '#3a3a3c'); seat.addColorStop(1, '#101012');
  ctx.fillStyle = seat; ctx.beginPath(); ctx.moveTo(0.1, 0.7); ctx.quadraticCurveTo(0.0, 0.74, -0.3, 0.72); ctx.lineTo(-0.92, 0.68); ctx.lineTo(-0.92, 0.62); ctx.lineTo(0.06, 0.6); ctx.closePath(); ctx.fill();
  // бак и радиаторные накладки с графикой
  const tg = ctx.createLinearGradient(0, 0.74, 0, 0.3); tg.addColorStop(0, shade(col, 0.35)); tg.addColorStop(0.6, col); tg.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(0.46, 0.66); ctx.lineTo(0.1, 0.72); ctx.lineTo(0.02, 0.56); ctx.lineTo(0.14, 0.26); ctx.lineTo(0.38, 0.2); ctx.lineTo(0.44, 0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2f2ee'; polyPath(ctx, [[0.4, 0.56], [0.12, 0.62], [0.08, 0.52], [0.36, 0.46]]); ctx.fill();
  ctx.fillStyle = def.color2; polyPath(ctx, [[0.42, 0.36], [0.16, 0.42], [0.2, 0.32], [0.38, 0.28]]); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(0.46, 0.66); ctx.lineTo(0.1, 0.72); ctx.lineTo(0.02, 0.56); ctx.lineTo(0.14, 0.26); ctx.lineTo(0.38, 0.2); ctx.stroke();
}

function drawChopper(ctx, def, up, s, rwx, rwy) {
  const col = def.color;
  const chrome = y0 => chromeGradient(ctx, y0 - 0.06, y0 + 0.06);
  // «сисси-бар» и заднее крыло-«бобер»
  tube(ctx, [[rwx + 0.3, rwy + 0.25], [rwx + 0.14, 0.72], [rwx + 0.02, 0.78], [rwx - 0.04, 0.5]], 0.045, '#8d9296', 'rgba(255,255,255,0.7)');
  const R = def.wheels[0].r + 0.07;
  const fg = ctx.createLinearGradient(0, rwy + R + 0.05, 0, rwy);
  fg.addColorStop(0, shade(col, 0.4)); fg.addColorStop(1, shade(col, -0.4));
  ctx.strokeStyle = fg; ctx.lineWidth = 0.1; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(rwx, rwy, R, Math.PI * 0.22, Math.PI * 0.95, false); ctx.stroke();
  ctx.fillStyle = '#a8201a'; ctx.fillRect(rwx - R - 0.06, rwy + 0.1, 0.06, 0.06);
  // жёсткая рама: хребет, передняя труба, нижние перья, подседельная и задние стойки
  tube(ctx, [[0.56, 0.8], [-0.36, 0.44], [-0.32, -0.12], [0.3, -0.12], [0.56, 0.8]], 0.055, '#141416', 'rgba(255,255,255,0.22)');
  tube(ctx, [[-0.32, -0.12], [rwx, rwy]], 0.05, '#141416', 'rgba(255,255,255,0.22)');
  tube(ctx, [[-0.36, 0.44], [rwx, rwy]], 0.045, '#141416', 'rgba(255,255,255,0.22)');
  // масляный бак-«подкова»
  ctx.fillStyle = '#1a1a1c'; roundRect(ctx, -0.5, 0.04, 0.2, 0.3, 0.06); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-0.47, 0.08, 0.03, 0.22);
  // V-твин: картер, два оребрённых цилиндра под 45°, хромированные крышки клапанов
  ctx.fillStyle = chrome(0.0); ctx.beginPath(); ctx.ellipse(0.06, -0.02, 0.24, 0.14, 0, 0, Math.PI * 2); ctx.fill();
  for (const [bx, a] of [[0.16, -0.38], [-0.04, 0.38]]) {
    ctx.save(); ctx.translate(bx, 0.08); ctx.rotate(a);
    ctx.fillStyle = '#3a3c3f'; ctx.fillRect(-0.09, 0, 0.18, 0.34);
    ctx.fillStyle = '#8c9094'; for (let k = 0; k < 8; k++) ctx.fillRect(-0.13, 0.02 + k * 0.035, 0.26, 0.016);
    ctx.fillStyle = chrome(0.4); roundRect(ctx, -0.12, 0.33, 0.24, 0.09, 0.03); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = chrome(0.3); ctx.beginPath(); ctx.arc(0.08, 0.26, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(0.08, 0.26, 0.07, 0, Math.PI * 2); ctx.fill();
  // крышка первичной передачи
  ctx.fillStyle = chrome(0.0); roundRect(ctx, -0.62, -0.1, 0.44, 0.2, 0.09); ctx.fill();
  // трубы-«рыбьи хвосты»
  for (const [y0, dy] of [[0.42, 0], [0.36, -0.07]]) {
    tube(ctx, [[0.32 - dy, y0], [0.4, 0.1 + dy], [0.1, -0.2 + dy], [-0.9, -0.14 + dy]], 0.045, '#d9dde0', 'rgba(255,255,255,0.6)');
    ctx.fillStyle = chrome(-0.14 + dy); polyPath(ctx, [[-0.88, -0.17 + dy], [-1.25, -0.2 + dy], [-1.3, -0.1 + dy], [-0.88, -0.11 + dy]]); ctx.fill();
  }
  // соло-седло на пружинах
  ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 0.02;
  for (const x of [-0.5, -0.4]) { ctx.beginPath(); for (let k = 0; k <= 6; k++) ctx.lineTo(x + (k % 2 ? 0.025 : -0.025), 0.3 + k * 0.022); ctx.stroke(); }
  const sg = ctx.createLinearGradient(0, 0.56, 0, 0.42); sg.addColorStop(0, '#5a3a24'); sg.addColorStop(1, '#2a1a10');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-0.62, 0.44); ctx.quadraticCurveTo(-0.35, 0.4, -0.08, 0.5); ctx.quadraticCurveTo(-0.2, 0.58, -0.45, 0.54); ctx.quadraticCurveTo(-0.62, 0.52, -0.62, 0.44); ctx.fill();
  // бак-«капля» с языками пламени
  ctx.save(); ctx.translate(0.3, 0.68); ctx.rotate(-0.4);
  const tankPath = () => { ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.bezierCurveTo(-0.28, 0.14, 0.2, 0.16, 0.3, 0.02); ctx.bezierCurveTo(0.22, -0.12, -0.26, -0.12, -0.3, 0); };
  const tg = ctx.createLinearGradient(0, 0.14, 0, -0.14); tg.addColorStop(0, shade(col, 0.45)); tg.addColorStop(0.5, col); tg.addColorStop(1, shade(col, -0.45));
  tankPath(); ctx.fillStyle = tg; ctx.fill();
  ctx.save(); tankPath(); ctx.clip();
  ctx.fillStyle = '#f0a020';
  ctx.beginPath(); ctx.moveTo(0.32, -0.08); ctx.quadraticCurveTo(0.1, -0.04, 0.02, 0.04); ctx.quadraticCurveTo(0.08, -0.02, -0.08, 0.02); ctx.quadraticCurveTo(0.0, -0.06, -0.14, -0.04); ctx.quadraticCurveTo(0.0, -0.1, 0.32, -0.14); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-0.05, 0.08, 0.16, 0.025, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = chrome(0); ctx.beginPath(); ctx.arc(0.05, 0.12, 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBikeFork(ctx, def, wx, wy) {
  const chopper = def.bikeStyle === 'chopper';
  if (chopper) {
    // пружинная вилка: жёсткие задние перья и подвижные передние, пружины у траверсы
    const topX = 0.6, topY = 0.78;
    const dx = wx - topX, dy = wy - topY, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (const off of [0, 0.07]) tube(ctx, [[topX + nx * off, topY + ny * off], [wx + nx * off * 0.6, wy + ny * off * 0.6]], 0.03, '#d9dde0', 'rgba(255,255,255,0.6)');
    ctx.strokeStyle = '#bfc4c8'; ctx.lineWidth = 0.02;
    for (const off of [0.03, 0.1]) { ctx.beginPath(); for (let k = 0; k <= 8; k++) { const t = 0.04 + k * 0.022, o = off + (k % 2 ? 0.02 : -0.02); ctx.lineTo(topX + dx * t + nx * o, topY + dy * t + ny * o); } ctx.stroke(); }
    // «обезьяний» руль и зеркало
    tube(ctx, [[0.58, 0.82], [0.52, 1.3], [0.14, 1.14]], 0.035, '#d9dde0', 'rgba(255,255,255,0.6)');
    line(ctx, [[0.5, 1.28], [0.44, 1.44]], 0.015, '#999'); ctx.fillStyle = '#ccd'; ctx.beginPath(); ctx.arc(0.44, 1.46, 0.035, 0, Math.PI * 2); ctx.fill();
    // фара-«пуля»
    ctx.fillStyle = chromeGradient(ctx, 0.64, 0.8); ctx.beginPath(); ctx.ellipse(0.76, 0.72, 0.1, 0.075, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.ellipse(0.85, 0.7, 0.025, 0.06, -0.2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // эндуро: верхние трубы (золото), нижние перья, траверсы, суппорт, высокое крыло, маска с фарой, защита рук
  const topX = 0.5, topY = 0.72;
  const dx = wx - topX, dy = wy - topY;
  const mid = [topX + dx * 0.45, topY + dy * 0.45];
  tube(ctx, [[topX, topY], mid], 0.075, '#d6a93a', 'rgba(255,240,200,0.5)');
  tube(ctx, [mid, [wx, wy]], 0.06, '#1f1f21', 'rgba(255,255,255,0.15)');
  ctx.fillStyle = '#26272a'; roundRect(ctx, topX - 0.08, topY - 0.08, 0.16, 0.08, 0.02); ctx.fill();
  const lc = [topX + dx * 0.2, topY + dy * 0.2];
  ctx.fillStyle = '#26272a'; roundRect(ctx, lc[0] - 0.08, lc[1] - 0.04, 0.16, 0.08, 0.02); ctx.fill();
  ctx.fillStyle = '#b8261f'; roundRect(ctx, wx - 0.1, wy + 0.06, 0.1, 0.1, 0.02); ctx.fill();
  // высокое переднее крыло
  ctx.fillStyle = def.color;
  ctx.beginPath(); ctx.moveTo(lc[0] - 0.36, lc[1] - 0.02); ctx.quadraticCurveTo(lc[0], lc[1] + 0.08, lc[0] + 0.5, lc[1] - 0.06); ctx.lineTo(lc[0] + 0.48, lc[1] - 0.1); ctx.quadraticCurveTo(lc[0], lc[1] - 0.02, lc[0] - 0.34, lc[1] - 0.08); ctx.closePath(); ctx.fill();
  // маска с фарой и номером
  ctx.fillStyle = '#f2f2ee';
  ctx.beginPath(); ctx.moveTo(topX + 0.06, topY + 0.16); ctx.lineTo(topX + 0.22, topY + 0.1); ctx.lineTo(topX + 0.2, topY - 0.24); ctx.lineTo(topX + 0.06, topY - 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.ellipse(topX + 0.2, topY - 0.06, 0.02, 0.06, -0.2, 0, Math.PI * 2); ctx.fill();
  // руль с защитой рук
  line(ctx, [[topX, topY], [0.52, 0.98]], 0.035, '#2a2a2a');
  ctx.fillStyle = def.color; ctx.beginPath(); ctx.moveTo(0.5, 0.92); ctx.quadraticCurveTo(0.7, 0.96, 0.66, 1.08); ctx.quadraticCurveTo(0.58, 1.02, 0.48, 1.02); ctx.closePath(); ctx.fill();
}

// гонщик: эндуро — кросс-шлем с козырьком и джерси; чоппер — полушлем, очки, борода и кожаный жилет клуба
function drawRider(ctx, def, up, s, chopper) {
  const geo = riderGeometry(def);
  const rel = s.riderRel !== undefined ? s.riderRel : -s.lean * 0.45;
  const bodyAng = geo.neutral + rel;
  const lean = Math.PI / 2 - bodyAng;
  const bar = chopper ? [0.14, 1.14] : [0.52, 0.98], peg = chopper ? [0.35, 0.1] : [-0.05, 0.12];
  let miraFront = null;
  // Мира сзади: держится за Алекса или стреляет из обреза
  if (s.passenger === 'mira') {
    const hip = chopper ? [-0.74, 0.58] : [-0.6, 0.72];
    const M = s.mira || { aim: 0.2 };
    const mLean = lean * 0.8 + 0.05;
    const P = { hip, lean: mLean, feet: { F: chopper ? [-0.42, 0.14] : [-0.4, 0.22], B: chopper ? [-0.46, 0.16] : [-0.44, 0.24] }, knees: { F: 1, B: 1 }, footAng: { F: 0, B: 0 }, elbows: { F: -1, B: -1 } };
    const shx = hip[0] + Math.sin(mLean) * RIG.torso, shy = hip[1] + Math.cos(mLean) * RIG.torso;
    if (up.gun) {
      const a = M.aim, ca = Math.cos(a), sa = Math.sin(a);
      const perp = Math.cos(a) < 0 ? -1 : 1;
      P.hands = { F: [shx + ca * 0.5, shy + sa * 0.5], B: [shx + ca * 0.18 + sa * 0.06 * perp, shy + sa * 0.18 - ca * 0.06 * perp] };
      P.item = { type: 'shotgun', aim: a, recoil: M.recoil, flash: M.flash, open: M.open };
      if (Math.cos(a) < 0) P.elbows = { F: 1, B: 1 };
      P.head = clamp(Math.cos(a) < 0 ? 0.5 : a * 0.5, -0.5, 0.6);
    } else {
      P.hands = { F: [geo.hip[0] + 0.14, geo.hip[1] + 0.22], B: [geo.hip[0] + 0.06, geo.hip[1] + 0.34] };
      P.head = 0.1;
    }
    // стреляя вперёд, она высовывается сбоку: рука с обрезом поверх Алекса
    const front = up.gun && Math.cos(M.aim) > 0;
    if (front) P.layer = 'back';
    drawPerson(ctx, LOOKS.mira, P);
    if (front) miraFront = P;
  }
  const P = {
    hip: geo.hip, lean, head: -lean * 0.4,
    feet: { F: peg, B: [peg[0] - 0.04, peg[1] + 0.02] }, knees: { F: 1, B: 1 }, footAng: { F: 0, B: 0 },
    hands: { F: bar, B: [bar[0] - 0.03, bar[1] + 0.03] }, elbows: { F: -1, B: -1 }
  };
  drawPerson(ctx, LOOKS.alex, P);
  if (miraFront) { miraFront.layer = 'front'; drawPerson(ctx, LOOKS.mira, miraFront); }
}

/* ------------------------------ лодки ------------------------------ */
/* Чайка — «Казанка-5М»: клёпаный алюминиевый корпус, поднимающаяся к носу линия борта, окрашенный поясок,
   закрытая носовая палуба, ветровое стекло из оргстекла, подвесной «Вихрь-30» на транце.
   Барракуда — гоночный катер типа Cigarette 38 Top Gun: длинный низкий нос, глубокое V, реданы на днище,
   крупная графика по борту, низкое тонированное стекло, два подвесных мотора на транце.
   Броненосец — патрульный катер береговой охраны (по мотивам USCG Response Boat–Medium, 13.6 м):
   высокий нос с развалом, мягкий привальный брус-кранец, диагональная полоса, рубка с обратным наклоном окон,
   мачта с радаром и проблесковыми огнями, водомётный движитель. */

const BOAT_ART = {};

BOAT_ART.gull = {
  sheer(ctx) {
    ctx.beginPath();
    ctx.moveTo(-2.1, -0.15); ctx.lineTo(-2.12, 0.5);
    ctx.quadraticCurveTo(0.2, 0.5, 1.7, 0.56); ctx.quadraticCurveTo(2.1, 0.6, 2.3, 0.66);
    ctx.quadraticCurveTo(2.4, 0.5, 2.34, 0.34);
    ctx.quadraticCurveTo(1.9, -0.1, 1.2, -0.42);
    ctx.lineTo(-0.6, -0.5); ctx.closePath();
  },
  top: 0.66, bottom: -0.5, deckY: 0.5,
  draw(ctx, def, up, s) {
    // подвесной «Вихрь»: кронштейн, дейдвуд, колпак с полосой
    const px = def.prop[0], py = def.prop[1];
    ctx.fillStyle = '#3a3c3e'; ctx.fillRect(px + 0.02, py + 0.08, 0.12, 1.02);
    ctx.fillStyle = '#6a6e72'; ctx.fillRect(px - 0.1, py + 0.18, 0.36, 0.04);                          // антикавитационная плита
    const cg = ctx.createLinearGradient(0, 1.1, 0, 0.5); cg.addColorStop(0, '#eef0f0'); cg.addColorStop(0.6, '#b8bcbe'); cg.addColorStop(1, '#5d6164');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(px - 0.28, 0.58); ctx.quadraticCurveTo(px - 0.34, 1.08, px + 0.02, 1.1); ctx.quadraticCurveTo(px + 0.3, 1.06, px + 0.26, 0.58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c62828'; ctx.fillRect(px - 0.3, 0.78, 0.55, 0.07);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(px + 0.2, 0.52, 0.16, 0.08);                               // струбцины
    // корпус: алюминий, окрашенный поясок, клёпка
    this.sheer(ctx);
    const g = ctx.createLinearGradient(0, this.top, 0, this.bottom);
    g.addColorStop(0, '#f2f5f6'); g.addColorStop(0.3, '#c8cfd3'); g.addColorStop(0.36, '#8e979c'); g.addColorStop(0.62, '#b9c1c5'); g.addColorStop(1, '#5a6166');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = def.color2; ctx.beginPath(); ctx.moveTo(-2.2, 0.28); ctx.quadraticCurveTo(0.2, 0.3, 2.4, 0.44); ctx.lineTo(2.4, 0.56); ctx.quadraticCurveTo(0.2, 0.42, -2.2, 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.012;
    for (let x = -1.8; x < 2.2; x += 0.45) { ctx.beginPath(); ctx.moveTo(x, 0.62); ctx.lineTo(x + 0.08, -0.6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(40,40,40,0.35)';
    for (let x = -2.05; x < 2.1; x += 0.09) { ctx.beginPath(); ctx.arc(x, 0.18 + x * 0.025, 0.008, 0, Math.PI * 2); ctx.arc(x, -0.12 + x * 0.05, 0.008, 0, Math.PI * 2); ctx.fill(); }
    line(ctx, [[2.2, 0.16], [0.4, -0.02], [-2.2, -0.04]], 0.02, 'rgba(255,255,255,0.35)');               // брызгоотбойник
    ctx.fillStyle = 'rgba(40,20,20,0.35)'; ctx.fillRect(-2.3, -0.7, 4.8, 0.48);                          // подводная часть
    for (const b of s.blood) { ctx.fillStyle = 'rgba(110,8,8,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    this.sheer(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.03; ctx.stroke();
    // привальный брус и носовая палуба
    line(ctx, [[-2.12, 0.5], [0.2, 0.5], [1.7, 0.56], [2.3, 0.66]], 0.04, '#dfe3e5');
    ctx.fillStyle = '#9aa2a6'; ctx.beginPath(); ctx.moveTo(0.4, 0.51); ctx.quadraticCurveTo(1.6, 0.6, 2.3, 0.68); ctx.lineTo(2.2, 0.72); ctx.quadraticCurveTo(1.4, 0.64, 0.4, 0.58); ctx.fill();
    ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(2.15, 0.74, 0.035, 0, Math.PI * 2); ctx.fill();         // ходовой огонь
    // Алекс у консоли
    ctx.fillStyle = '#2a3238'; roundRect(ctx, -0.12, 0.42, 0.34, 0.36, 0.05); ctx.fill();
    { const P = seatedPose([-0.55, 0.62], [0.08, 0.86], [0.1, 0.46], -0.05, 0.05); P.hands.B = [0.04, 0.9]; drawPerson(ctx, LOOKS.alex, P); }
    // ветровое стекло в алюминиевой рамке
    ctx.fillStyle = 'rgba(150,200,225,0.45)';
    polyPath(ctx, [[0.42, 0.56], [0.62, 0.58], [0.2, 1.02], [0.04, 1.0]]); ctx.fill();
    ctx.strokeStyle = '#c8ced2'; ctx.lineWidth = 0.035; ctx.stroke();
    // удочка на корме
    line(ctx, [[-1.7, 0.5], [-2.55, 1.75]], 0.02, '#3a2a1a');
    ctx.strokeStyle = 'rgba(230,230,230,0.5)'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(-2.55, 1.75); ctx.quadraticCurveTo(-2.8, 1.0, -2.75, 0.2); ctx.stroke();
  },
  gun: [0.8, 0.62], cans: [-1.6, 0.5], rocket: [-1.3, 0.75], mira: [-1.45, 0.5]
};

BOAT_ART.cuda = {
  sheer(ctx) {
    ctx.beginPath();
    ctx.moveTo(-2.6, -0.1); ctx.lineTo(-2.62, 0.46);
    ctx.lineTo(2.1, 0.47); ctx.quadraticCurveTo(2.7, 0.46, 3.02, 0.36);
    ctx.lineTo(2.9, 0.26);
    ctx.lineTo(1.5, -0.4);
    ctx.lineTo(0.35, -0.42); ctx.lineTo(0.3, -0.38); ctx.lineTo(-0.9, -0.44); ctx.lineTo(-0.95, -0.4); ctx.lineTo(-1.0, -0.45);
    ctx.closePath();
  },
  top: 0.47, bottom: -0.45, deckY: 0.46,
  draw(ctx, def, up, s) {
    // два подвесных мотора
    const px = def.prop[0];
    for (const [ox, oy, k] of [[0.12, 0.06, -0.35], [0, 0, 0]]) {
      ctx.fillStyle = shade('#2a2a2c', k); ctx.fillRect(px + 0.02 + ox, -0.3 + oy, 0.12, 0.8);
      const cg = ctx.createLinearGradient(0, 1.2 + oy, 0, 0.5 + oy); cg.addColorStop(0, shade('#3a3a3e', k + 0.3)); cg.addColorStop(1, shade('#0c0c0e', k));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(px - 0.32 + ox, 0.52 + oy); ctx.quadraticCurveTo(px - 0.4 + ox, 1.2 + oy, px + ox, 1.22 + oy); ctx.quadraticCurveTo(px + 0.32 + ox, 1.16 + oy, px + 0.28 + ox, 0.52 + oy); ctx.closePath(); ctx.fill();
      if (!k) { ctx.fillStyle = def.color2; ctx.fillRect(px - 0.34, 0.86, 0.6, 0.05); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(px - 0.2, 1.0, 0.3, 0.04); }
    }
    this.sheer(ctx);
    const g = ctx.createLinearGradient(0, this.top, 0, this.bottom);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#e8ecee'); g.addColorStop(0.42, '#a9b0b4'); g.addColorStop(0.7, '#e0e4e6'); g.addColorStop(1, '#8a9094');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // цветное днище ниже скулы и крупная графика
    ctx.fillStyle = shade(def.color2, -0.2); ctx.beginPath(); ctx.moveTo(-2.7, -0.02); ctx.lineTo(3.0, 0.24); ctx.lineTo(3.0, -0.6); ctx.lineTo(-2.7, -0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = def.color2;
    ctx.beginPath(); ctx.moveTo(3.0, 0.36); ctx.quadraticCurveTo(1.0, 0.36, -0.8, 0.1); ctx.lineTo(-2.7, 0.12); ctx.lineTo(-2.7, 0.3); ctx.lineTo(-0.9, 0.26); ctx.quadraticCurveTo(1.0, 0.44, 3.0, 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(2.6, 0.3); ctx.quadraticCurveTo(0.8, 0.28, -0.6, 0.06); ctx.lineTo(-2.7, 0.06); ctx.lineTo(-2.7, 0.09); ctx.lineTo(-0.62, 0.09); ctx.quadraticCurveTo(0.8, 0.31, 2.6, 0.33); ctx.closePath(); ctx.fill();
    line(ctx, [[2.9, 0.26], [1.2, 0.03], [-2.7, -0.02]], 0.02, 'rgba(255,255,255,0.4)');                // скула
    ctx.fillStyle = 'rgba(20,20,30,0.3)'; ctx.fillRect(-2.7, -0.7, 5.8, 0.52);
    for (const b of s.blood) { ctx.fillStyle = 'rgba(110,8,8,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    this.sheer(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.03; ctx.stroke();
    ctx.fillStyle = chromeGradient(ctx, 0.43, 0.5); ctx.fillRect(-2.62, 0.44, 5.0, 0.04);                  // хромированный привальный брус
    // жалюзи моторного отсека, пилот и штурман, низкое стекло
    ctx.fillStyle = '#d8dcde'; ctx.beginPath(); ctx.moveTo(-2.5, 0.47); ctx.quadraticCurveTo(-1.8, 0.62, -1.0, 0.5); ctx.lineTo(-2.5, 0.5); ctx.fill();
    ctx.fillStyle = '#333'; for (let k = 0; k < 5; k++) ctx.fillRect(-2.2 + k * 0.18, 0.5, 0.1, 0.03);
    ctx.fillStyle = '#1b2530'; roundRect(ctx, -0.7, 0.44, 0.32, 0.34, 0.08); ctx.fill();
    { const P = seatedPose([-0.42, 0.52], [0.02, 0.76], [0.2, 0.46], -0.12, 0.05); P.hands.B = [-0.02, 0.8]; drawPerson(ctx, LOOKS.alex, P); }
    ctx.fillStyle = 'rgba(40,50,60,0.75)'; polyPath(ctx, [[0.6, 0.47], [0.78, 0.47], [0.2, 0.76], [0.08, 0.74]]); ctx.fill();
    ctx.strokeStyle = '#999'; ctx.lineWidth = 0.02; ctx.stroke();
  },
  gun: [0.9, 0.5], cans: [-2.2, 0.5], rocket: [-1.8, 0.75], mira: [-1.62, 0.47]
};

BOAT_ART.clad = {
  sheer(ctx) {
    ctx.beginPath();
    ctx.moveTo(-3.2, -0.1); ctx.lineTo(-3.22, 0.7);
    ctx.quadraticCurveTo(0.5, 0.72, 2.6, 0.84); ctx.quadraticCurveTo(3.2, 0.9, 3.5, 0.98);
    ctx.quadraticCurveTo(3.66, 0.7, 3.58, 0.45);
    ctx.quadraticCurveTo(2.9, -0.2, 1.8, -0.6);
    ctx.lineTo(-1.4, -0.65); ctx.closePath();
  },
  top: 0.98, bottom: -0.65, deckY: 0.72,
  draw(ctx, def, up, s) {
    // водомёт вместо винта
    ctx.fillStyle = '#3a3c3e'; roundRect(ctx, -3.4, -0.25, 0.26, 0.22, 0.06); ctx.fill();
    ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.arc(-3.4, -0.14, 0.07, 0, Math.PI * 2); ctx.fill();
    // корпус
    this.sheer(ctx);
    const g = ctx.createLinearGradient(0, this.top, 0, this.bottom);
    g.addColorStop(0, shade(def.color, 0.35)); g.addColorStop(0.3, shade(def.color, 0.1)); g.addColorStop(0.36, shade(def.color, -0.25)); g.addColorStop(0.6, def.color); g.addColorStop(1, shade(def.color, -0.5));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // диагональная полоса у носа
    ctx.fillStyle = '#e8e8e8'; polyPath(ctx, [[1.55, 1.2], [1.85, 1.2], [1.45, -0.8], [1.15, -0.8]]); ctx.fill();
    ctx.fillStyle = '#2f6b8f'; polyPath(ctx, [[1.95, 1.2], [2.45, 1.2], [2.05, -0.8], [1.55, -0.8]]); ctx.fill();
    // бортовой номер блоками
    ctx.fillStyle = '#e8e8e8';
    for (const [x, y, w, h] of [[-0.9, 0.1, 0.06, 0.26], [-0.72, 0.1, 0.06, 0.26], [-0.9, 0.1, 0.24, 0.05], [-0.9, 0.31, 0.24, 0.05], [-0.5, 0.31, 0.22, 0.05], [-0.36, 0.1, 0.06, 0.26]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(30,10,10,0.45)'; ctx.fillRect(-3.4, -0.9, 7.2, 0.72);
    line(ctx, [[3.5, 0.5], [1.2, -0.12], [-3.2, -0.14]], 0.025, 'rgba(255,255,255,0.3)');
    for (const b of s.blood) { ctx.fillStyle = 'rgba(110,8,8,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    this.sheer(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.035; ctx.stroke();
    // мягкий кранец по борту, секциями
    ctx.strokeStyle = '#202225'; ctx.lineWidth = 0.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3.15, 0.62); ctx.quadraticCurveTo(0.5, 0.64, 2.6, 0.76); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-3.15, 0.68); ctx.quadraticCurveTo(0.5, 0.7, 2.6, 0.82); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.015;
    for (let x = -2.6; x < 2.6; x += 0.7) { const y = 0.62 + (x + 3.15) * 0.022; ctx.beginPath(); ctx.moveTo(x, y - 0.1); ctx.lineTo(x, y + 0.1); ctx.stroke(); }
    // леерное ограждение на носу и корме
    ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(1.1, 1.22); ctx.quadraticCurveTo(2.4, 1.18, 3.4, 1.28); ctx.stroke();
    for (let x = 1.3; x < 3.4; x += 0.45) { const y = 0.75 + (x - 1.1) * 0.08; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 0.42); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-3.1, 1.15); ctx.lineTo(-1.8, 1.15); ctx.stroke();
    for (let x = -3.1; x <= -1.8; x += 0.43) { ctx.beginPath(); ctx.moveTo(x, 0.72); ctx.lineTo(x, 1.15); ctx.stroke(); }
    ctx.fillStyle = '#2a2c2e'; ctx.fillRect(-2.7, 0.72, 0.14, 0.14);                                     // кнехт
    // рубка
    const sup = def.color2;
    ctx.fillStyle = sup;
    ctx.beginPath(); ctx.moveTo(-1.7, 0.72); ctx.lineTo(-1.62, 2.0); ctx.lineTo(1.12, 2.02); ctx.lineTo(0.84, 1.35); ctx.lineTo(1.0, 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-1.7, 0.72, 2.7, 0.18);
    ctx.fillStyle = shade(sup, -0.2); ctx.fillRect(-1.72, 1.98, 2.9, 0.08);
    ctx.fillStyle = '#16222a';
    for (const [x0, x1] of [[-1.25, -0.55], [-0.45, 0.25], [0.35, 0.8]]) { ctx.beginPath(); ctx.moveTo(x0, 1.45); ctx.lineTo(x1, 1.45); ctx.lineTo(x1 + (x1 > 0.6 ? 0.18 : 0), 1.88); ctx.lineTo(x0, 1.88); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; polyPath(ctx, [[-0.3, 1.88], [-0.12, 1.88], [-0.4, 1.45], [-0.45, 1.45]]); ctx.fill();
    // силуэты экипажа за стёклами
    ctx.save(); ctx.beginPath(); ctx.moveTo(-0.45, 1.45); ctx.lineTo(0.8, 1.45); ctx.lineTo(0.98, 1.88); ctx.lineTo(-0.45, 1.88); ctx.closePath(); ctx.clip();
    { const P = seatedPose([0.05, 1.0], [0.6, 1.32], [0.6, 0.72], -0.05, 0.05); P.hands.B = [0.56, 1.36]; drawPerson(ctx, LOOKS.alex, P); }
    ctx.fillStyle = 'rgba(22,34,42,0.35)'; ctx.fillRect(-0.5, 1.4, 1.6, 0.5);
    ctx.restore();
    // дверь с иллюминатором и спасательный круг
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.02; ctx.strokeRect(-1.55, 0.8, 0.26, 0.58);
    ctx.fillStyle = '#16222a'; ctx.beginPath(); ctx.arc(-1.42, 1.2, 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8741c'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(-1.9, 1.5, 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.07; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-1.9, 1.5, 0.13, k * Math.PI / 2, k * Math.PI / 2 + 0.35); ctx.stroke(); }
    // мачта: радар, светобалка, антенна
    line(ctx, [[-0.6, 2.06], [-0.35, 2.85]], 0.05, '#bfc4c8');
    line(ctx, [[-0.05, 2.06], [-0.3, 2.85]], 0.05, '#bfc4c8');
    ctx.fillStyle = '#24292e'; roundRect(ctx, -0.78, 2.42, 0.9, 0.1, 0.04); ctx.fill();
    const blink = Math.sin(s.t * 8) > 0;
    ctx.fillStyle = blink ? '#ff3a2a' : '#6a1a14'; ctx.fillRect(-0.72, 2.44, 0.3, 0.06);
    ctx.fillStyle = blink ? '#1e4a8a' : '#3aa0ff'; ctx.fillRect(-0.28, 2.44, 0.3, 0.06);
    ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.ellipse(-0.33, 2.95, 0.3, 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(-0.33, 2.95); ctx.scale(Math.cos(s.t * 3), 1); ctx.fillStyle = '#9aa2a6'; ctx.fillRect(-0.28, -0.03, 0.56, 0.06); ctx.restore();
    line(ctx, [[0.2, 2.06], [0.26, 3.3]], 0.015, '#888');
  },
  gun: [2.1, 1.02], cans: [-2.9, 0.72], rocket: [-2.6, 1.0], mira: [-2.55, 0.72]
};

// Мира стоит на палубе, широко расставив ноги, и целится (чаще — назад, по погоне)
function drawMiraDeck(ctx, x, y, s) {
  const M = s.mira || { aim: Math.PI, recoil: 0, flash: false };
  const back = Math.cos(M.aim) < 0;
  ctx.save(); ctx.translate(x, y);
  if (back) ctx.scale(-1, 1);
  const aim = back ? Math.PI - M.aim : M.aim;
  const sway = Math.sin((s.t || 0) * 1.3) * 0.03;
  const P = { hip: [0.0, 0.84], lean: 0.1 + sway, feet: { F: [0.26, 0], B: [-0.22, 0] }, knees: { F: 1, B: 1 }, footAng: { F: 0.1, B: -0.1 }, elbows: { F: -1, B: -1 } };
  const shx = Math.sin(P.lean) * RIG.torso, shy = 0.84 + Math.cos(P.lean) * RIG.torso;
  const ca = Math.cos(aim), sa = Math.sin(aim);
  P.hands = { B: [shx + ca * 0.16 + sa * 0.08, shy + sa * 0.16 - ca * 0.08], F: [shx + ca * 0.5 + sa * 0.05, shy + sa * 0.5 - ca * 0.05] };
  P.item = { type: 'rifle', aim, recoil: M.recoil, flash: M.flash };
  P.head = clamp(aim * 0.5, -0.4, 0.4);
  drawPerson(ctx, LOOKS.mira, P);
  ctx.restore();
}

function drawBoat(ctx, def, up, s) {
  const art = BOAT_ART[def.id] || BOAT_ART.gull;
  const h = def.hull[0];
  if (up.boost) drawRocket(ctx, art.rocket[0], art.rocket[1], 0.9, s.boosting, s.t, true);
  // винт (у патрульного катера — водомёт, винта нет)
  if (def.id !== 'clad') {
    ctx.save(); ctx.translate(def.prop[0], def.prop[1]);
    const blade = Math.cos(s.propSpin) * 0.22;
    ctx.fillStyle = '#b08d3a';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.05, Math.abs(blade) + 0.02, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  art.draw(ctx, def, up, s);
  if (s.passenger === 'mira' && art.mira) drawMiraDeck(ctx, art.mira[0], art.mira[1], s);
  // таран на носу
  if (up.armor) {
    const bx = h[3][0], by = h[3][1];
    const g = ctx.createLinearGradient(0, by + 0.2, 0, by - 0.55);
    g.addColorStop(0, '#7a7f84'); g.addColorStop(1, '#34383b');
    ctx.fillStyle = g;
    polyPath(ctx, [[bx - 0.6, by - 0.55], [bx + 0.35 + up.armor * 0.06, by - 0.05], [bx - 0.1, by + 0.2]]); ctx.fill();
    ctx.strokeStyle = '#1f2123'; ctx.lineWidth = 0.03; ctx.stroke();
    if (up.armor >= 3) { ctx.fillStyle = '#ccc'; polyPath(ctx, [[bx + 0.2, by - 0.12], [bx + 0.6, by - 0.08], [bx + 0.2, by]]); ctx.fill(); }
  }
  if (up.fuel) for (let i = 0; i < Math.min(2, up.fuel); i++) drawJerrycan(ctx, art.cans[0] + i * 0.4, art.cans[1], 0.3);
  if (up.gun) drawTurret(ctx, art.gun[0], art.gun[1], s.aim, s.recoil, up.gun);
}
