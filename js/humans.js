'use strict';
/* Персонажи: общий скелет, внешности и походки.

   Один «риг» на всех (вид сбоку, ступни на y=0, взгляд вправо, рост ~1.8 м): таз → торс → шея → голова,
   бедро → голень → стопа, плечо → предплечье → кисть. Кисти и стопы ставятся инверсной кинематикой
   (руль, подножки, цевьё оружия), а при ходьбе ноги считаются прямой кинематикой из углов бедра и колена —
   поэтому таз сам опускается, когда ноги расставлены (поза «опускание» в цикле шага Р. Уильямса:
   контакт → опускание → перенос → подъём).
   Походки:
   • шаг человека — симметричный, руки в противофазе ногам;
   • «волочащийся» шаг зомби — асимметрия: одна нога почти не сгибается и тащится, шаг рывком,
     вес переносится не вовремя, корпус ведут плечи, руки вытянуты вперёд, голова болтается;
   • бег — большой мах, наклон корпуса, фаза полёта, руки работают согнутыми;
   • «вразвалку» у толстяков, тяжёлые шаги громилы.
   Внешности: Алекс и Мира одинаковые на любом транспорте и в портретах; солдаты — «Ратник»:
   шлем 6Б47 в чехле, бронежилет 6Б45 с подсумками, камуфляж ЕМР («цифра»); анархисты — кожа, банданы. */

const RIG = { torso: 0.52, neck: 0.08, thigh: 0.45, shin: 0.44, ua: 0.31, fa: 0.29, foot: 0.24 };

const LOOKS = {
  alex: {
    skin: '#d6a07a', hair: 'beanie', hairColor: '#2b1d15', hat: '#b53a2c', stubble: true,
    top: 'jacket', topColor: '#3b4a5c', stripe: '#e8883a', collar: '#2c3846',
    pants: '#2e3642', boots: '#3a2a1e', gloves: null, bulk: 1
  },
  mira: {
    skin: '#e6b594', hair: 'mira', hairColor: '#151012', band: '#b8302a', goggles: true,
    top: 'leather', topColor: '#6a3528', scarf: '#c9a36a',
    pants: '#2b2f3a', boots: '#1e1a18', gloves: '#1b1b1b', bulk: 0.9, female: true
  }
};

/* ------------------------------ примитивы ------------------------------ */

// сегмент конечности с сужением и скруглёнными суставами
function seg2(ctx, x1, y1, x2, y2, w1, w2, color) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L, ny = dx / L;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.lineTo(x2 - nx * w2 / 2, y2 - ny * w2 / 2);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x1, y1, w1 / 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x2, y2, w2 / 2, 0, Math.PI * 2); ctx.fill();
}

function rot(ax, ay, ang, x, y) { const c = Math.cos(ang), s = Math.sin(ang); return [ax + x * c - y * s, ay + x * s + y * c]; }

// пиксельный камуфляж ЕМР по прямоугольной области (в текущем клипе)
function emrPattern(ctx, x0, y0, w, h, seed) {
  const rng = mulberry32(seed || 7);
  const cols = ['#5b6647', '#3c4530', '#7b7d5c', '#2a2f22'];
  const s = 0.045;
  for (let i = 0; i < w * h / (s * s) * 0.45; i++) {
    ctx.fillStyle = cols[Math.floor(rng() * 4)];
    ctx.fillRect(x0 + Math.floor(rng() * w / s) * s, y0 + Math.floor(rng() * h / s) * s, s * (1 + Math.floor(rng() * 2)), s);
  }
}

/* ------------------------------ голова ------------------------------ */

// голова в профиль; mood: { jaw 0..1, blink, snarl }
function drawPersonHead(ctx, L, x, y, ang, mood = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.12, 1.12);
  const skin = mood.hurt ? '#f0d8c8' : L.skin;
  const zombie = !!L.zombie;
  // затылочные волосы под шапкой/капюшоном
  if (L.hair === 'mira') {
    ctx.fillStyle = L.hairColor;
    ctx.beginPath(); ctx.moveTo(-0.02, 0.15); ctx.quadraticCurveTo(-0.24, 0.12, -0.2, -0.24); ctx.lineTo(-0.08, -0.22); ctx.quadraticCurveTo(-0.1, 0.0, 0.02, 0.06); ctx.fill();
  }
  if (L.hair === 'hood') {
    ctx.fillStyle = L.hood || '#1b1b1d';
    ctx.beginPath(); ctx.moveTo(0.1, 0.17); ctx.quadraticCurveTo(-0.1, 0.26, -0.22, 0.06); ctx.lineTo(-0.2, -0.2); ctx.lineTo(0.0, -0.16); ctx.quadraticCurveTo(-0.08, 0.05, 0.1, 0.17); ctx.fill();
  }
  // шея
  seg2(ctx, -0.02, -0.08, -0.02, -0.2, 0.1, 0.1, shade(skin, -0.18));
  // череп и челюсть
  const g = ctx.createRadialGradient(0.02, 0.06, 0.02, 0, 0, 0.17);
  g.addColorStop(0, shade(skin, 0.14)); g.addColorStop(1, shade(skin, -0.22));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(-0.005, 0.02, 0.12, 0.14, 0, 0, Math.PI * 2); ctx.fill();
  const jaw = (mood.jaw || 0) * 0.05;
  ctx.beginPath(); ctx.moveTo(-0.05, -0.06); ctx.quadraticCurveTo(0.0, -0.13 - jaw, 0.08, -0.12 - jaw); ctx.lineTo(0.11, -0.06); ctx.lineTo(0.1, 0.0); ctx.closePath(); ctx.fill();
  // нос, ухо
  ctx.beginPath(); ctx.moveTo(0.1, 0.04); ctx.lineTo(0.155, -0.02); ctx.lineTo(0.11, -0.03); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(skin, -0.25); ctx.beginPath(); ctx.ellipse(-0.03, 0.0, 0.028, 0.042, 0, 0, Math.PI * 2); ctx.fill();
  // щетина
  if (L.stubble) { ctx.fillStyle = 'rgba(40,28,20,0.35)'; ctx.beginPath(); ctx.moveTo(-0.02, -0.02); ctx.quadraticCurveTo(0.0, -0.14, 0.09, -0.12); ctx.lineTo(0.11, -0.05); ctx.quadraticCurveTo(0.05, -0.04, -0.02, -0.02); ctx.fill(); }
  // глаз и бровь
  if (zombie) {
    ctx.fillStyle = '#1b1f16'; ctx.beginPath(); ctx.ellipse(0.07, 0.035, 0.03, 0.026, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6e8b0'; ctx.beginPath(); ctx.arc(0.08, 0.035, 0.011, 0, Math.PI * 2); ctx.fill();
  } else if (mood.blink) {
    ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.05, 0.035); ctx.lineTo(0.095, 0.03); ctx.stroke();
  } else {
    ctx.fillStyle = '#f2ece4'; ctx.beginPath(); ctx.ellipse(0.075, 0.035, 0.022, 0.016, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(0.085, 0.035, 0.011, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = zombie ? 'rgba(30,30,20,0.6)' : (L.hairColor || '#2b1d15'); ctx.lineWidth = 0.018; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.04, 0.07); ctx.lineTo(0.11, 0.065 - (mood.snarl ? 0.02 : 0)); ctx.stroke();
  // рот
  if (zombie && (mood.jaw || 0) > 0.2) {
    ctx.fillStyle = '#2a0c0c'; ctx.beginPath(); ctx.moveTo(0.05, -0.06); ctx.lineTo(0.12, -0.06); ctx.lineTo(0.09, -0.1 - jaw); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfc6a8'; ctx.fillRect(0.07, -0.07, 0.04, 0.012);
  } else {
    ctx.strokeStyle = 'rgba(60,20,15,0.7)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.07, -0.065); ctx.lineTo(0.115, -0.06); ctx.stroke();
  }
  // кожа зомби: трупные пятна и рана
  if (zombie) {
    ctx.fillStyle = 'rgba(70,90,60,0.35)'; ctx.beginPath(); ctx.ellipse(-0.05, 0.07, 0.04, 0.03, 0, 0, Math.PI * 2); ctx.fill();
    if (L.wound) { ctx.fillStyle = '#6a1010'; ctx.beginPath(); ctx.ellipse(0.02, -0.03, 0.025, 0.015, 0.4, 0, Math.PI * 2); ctx.fill(); }
  }
  // волосы и головные уборы
  const hc = L.hairColor || '#2b1d15';
  switch (L.hair) {
    case 'beanie':
      ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-0.1, 0.02); ctx.lineTo(-0.13, -0.05); ctx.lineTo(-0.06, -0.02); ctx.fill();
      { const bg = ctx.createLinearGradient(-0.1, 0.18, 0.1, 0.05); bg.addColorStop(0, shade(L.hat, 0.25)); bg.addColorStop(1, shade(L.hat, -0.3)); ctx.fillStyle = bg; }
      ctx.beginPath(); ctx.moveTo(-0.13, 0.04); ctx.quadraticCurveTo(-0.12, 0.2, 0.0, 0.2); ctx.quadraticCurveTo(0.12, 0.19, 0.12, 0.07); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(L.hat, -0.15); ctx.beginPath(); ctx.moveTo(-0.135, 0.02); ctx.lineTo(0.125, 0.05); ctx.lineTo(0.125, 0.1); ctx.lineTo(-0.135, 0.08); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.008; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 0.035, 0.04 + k * 0.003); ctx.lineTo(k * 0.035, 0.09 + k * 0.003); ctx.stroke(); }
      break;
    case 'mira':
      ctx.fillStyle = hc;
      ctx.beginPath(); ctx.moveTo(-0.13, 0.02); ctx.quadraticCurveTo(-0.12, 0.2, 0.02, 0.19); ctx.quadraticCurveTo(0.13, 0.17, 0.13, 0.08); ctx.lineTo(0.08, 0.1); ctx.lineTo(0.06, 0.05); ctx.lineTo(0.02, 0.1); ctx.lineTo(-0.06, 0.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle = L.band; ctx.beginPath(); ctx.moveTo(-0.13, 0.08); ctx.lineTo(0.12, 0.12); ctx.lineTo(0.11, 0.15); ctx.lineTo(-0.12, 0.12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.12, 0.1); ctx.quadraticCurveTo(-0.2, 0.08, -0.26, 0.0); ctx.lineTo(-0.24, -0.02); ctx.quadraticCurveTo(-0.18, 0.04, -0.12, 0.07); ctx.fill();
      if (L.goggles) { ctx.fillStyle = '#3a3634'; ctx.beginPath(); ctx.ellipse(0.05, 0.17, 0.05, 0.035, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7ea0c0'; ctx.beginPath(); ctx.ellipse(0.06, 0.17, 0.03, 0.022, 0.2, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'helmet':   // шлем 6Б47 в чехле ЕМР
      ctx.save(); ctx.beginPath(); ctx.moveTo(-0.15, 0.02); ctx.quadraticCurveTo(-0.15, 0.24, 0.01, 0.24); ctx.quadraticCurveTo(0.16, 0.23, 0.15, 0.05); ctx.lineTo(0.12, 0.04); ctx.lineTo(-0.12, 0.0); ctx.closePath();
      ctx.fillStyle = '#4c553a'; ctx.fill(); ctx.clip(); emrPattern(ctx, -0.16, 0.0, 0.33, 0.26, 3); ctx.restore();
      ctx.fillStyle = '#2f3524'; ctx.beginPath(); ctx.moveTo(-0.15, 0.0); ctx.lineTo(0.16, 0.05); ctx.lineTo(0.16, 0.07); ctx.lineTo(-0.15, 0.03); ctx.fill();
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.02, 0.0); ctx.quadraticCurveTo(0.0, -0.08, 0.08, -0.12); ctx.stroke();
      break;
    case 'hood':
      ctx.fillStyle = L.hood || '#1b1b1d';
      ctx.beginPath(); ctx.moveTo(-0.16, -0.06); ctx.quadraticCurveTo(-0.18, 0.24, 0.04, 0.23); ctx.quadraticCurveTo(0.17, 0.2, 0.14, 0.08); ctx.lineTo(0.08, 0.12); ctx.quadraticCurveTo(-0.06, 0.14, -0.08, -0.04); ctx.closePath(); ctx.fill();
      break;
    case 'mohawk':
      ctx.fillStyle = '#c0392b';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-0.1 + k * 0.045, 0.13); ctx.lineTo(-0.085 + k * 0.045, 0.27); ctx.lineTo(-0.06 + k * 0.045, 0.13); ctx.fill(); }
      break;
    case 'knit':
      ctx.fillStyle = L.hat || '#2a2a2a'; ctx.beginPath(); ctx.moveTo(-0.13, 0.04); ctx.quadraticCurveTo(-0.12, 0.21, 0.0, 0.2); ctx.quadraticCurveTo(0.12, 0.19, 0.12, 0.07); ctx.closePath(); ctx.fill();
      break;
    case 'bald':
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(0.0, 0.11, 0.06, 0.03, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'sparse':
      ctx.fillStyle = hc; for (let k = 0; k < 6; k++) { ctx.fillRect(-0.11 + k * 0.035, 0.12 + (k % 2) * 0.015, 0.02, 0.05); }
      break;
    case 'long':
      ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-0.12, 0.02); ctx.quadraticCurveTo(-0.1, 0.19, 0.04, 0.18); ctx.quadraticCurveTo(0.12, 0.15, 0.1, 0.1); ctx.lineTo(-0.02, 0.1); ctx.quadraticCurveTo(-0.12, 0.0, -0.18, -0.2); ctx.lineTo(-0.2, -0.05); ctx.closePath(); ctx.fill();
      break;
    default:
      ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-0.13, 0.02); ctx.quadraticCurveTo(-0.12, 0.19, 0.02, 0.18); ctx.quadraticCurveTo(0.12, 0.16, 0.11, 0.1); ctx.lineTo(-0.04, 0.1); ctx.closePath(); ctx.fill();
  }
  // бандана с оскалом черепа
  if (L.bandana) {
    ctx.fillStyle = L.bandana;
    ctx.beginPath(); ctx.moveTo(-0.06, 0.0); ctx.lineTo(0.165, -0.01); ctx.lineTo(0.13, -0.13); ctx.lineTo(0.0, -0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(240,240,240,0.7)'; for (let k = 0; k < 4; k++) ctx.fillRect(0.04 + k * 0.028, -0.07, 0.016, 0.03);
  }
  ctx.restore();
}

/* ------------------------------ тело ------------------------------ */

// P: { hip:[x,y], lean, head, feet:{B,F}, knees:{B,F}, hands:{B,F}, elbows, item:{type, aim, recoil, open}, sit, mood }
function drawPerson(ctx, L, P) {
  const s = L.scale || 1;
  ctx.save();
  if (s !== 1) ctx.scale(s, s);
  const [hx, hy] = P.hip;
  const lean = P.lean || 0;
  const bulk = L.bulk || 1;
  const sh = rot(hx, hy, -lean, 0, RIG.torso);
  const neck = rot(hx, hy, -lean, 0.01, RIG.torso + RIG.neck);
  const headAng = -lean * 0.6 + (P.head || 0);
  const headC = rot(neck[0], neck[1], headAng, 0.02, 0.14);
  const dark = c => shade(c, -0.32);
  const skinC = P.mood && P.mood.hurt ? '#f0d8c8' : L.skin;
  const leg = (side) => {
    const foot = P.feet[side];
    const knee = ik2(hx, hy, foot[0], foot[1], RIG.thigh, RIG.shin, (P.knees && P.knees[side]) || 1);
    const col = side === 'B' ? dark(L.pants) : L.pants;
    const torn = L.zombie && L.tornLeg === side;
    seg2(ctx, hx, hy, knee.x, knee.y, 0.17 * bulk, 0.13, col);
    seg2(ctx, knee.x, knee.y, foot[0], foot[1] + 0.06, 0.13, torn ? 0.08 : 0.1, torn ? (side === 'B' ? dark(L.skin) : L.skin) : col);
    // ботинок: носок по направлению стопы
    const fa = (P.footAng && P.footAng[side]) || 0;
    ctx.save(); ctx.translate(foot[0], foot[1]); ctx.rotate(fa);
    ctx.fillStyle = side === 'B' ? dark(L.boots) : L.boots;
    ctx.beginPath(); ctx.moveTo(-0.06, 0.1); ctx.lineTo(0.04, 0.1); ctx.quadraticCurveTo(0.2, 0.06, 0.19, 0.0); ctx.lineTo(-0.07, 0.0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-0.07, 0.0, 0.26, 0.018);
    ctx.restore();
    if (side === 'F' && L.kneePad) { ctx.fillStyle = '#2c3024'; ctx.beginPath(); ctx.ellipse(knee.x + 0.04, knee.y, 0.06, 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
  };
  const arm = (side) => {
    const hand = P.hands[side];
    const elbow = ik2(sh[0], sh[1], hand[0], hand[1], RIG.ua, RIG.fa, (P.elbows && P.elbows[side]) || -1);
    const sleeve = side === 'B' ? dark(L.topColor) : L.topColor;
    const bare = L.zombie && L.tornArm === side;
    seg2(ctx, sh[0], sh[1], elbow.x, elbow.y, 0.13 * bulk, 0.1, sleeve);
    seg2(ctx, elbow.x, elbow.y, hand[0], hand[1], 0.1, 0.08, bare ? (side === 'B' ? dark(skinC) : skinC) : sleeve);
    ctx.fillStyle = L.gloves ? (side === 'B' ? dark(L.gloves) : L.gloves) : (side === 'B' ? dark(skinC) : skinC);
    ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.055, 0, Math.PI * 2); ctx.fill();
    if (side === 'F' && L.armband) { const m = [lerp(sh[0], elbow.x, 0.45), lerp(sh[1], elbow.y, 0.45)]; ctx.fillStyle = L.armband; ctx.beginPath(); ctx.arc(m[0], m[1], 0.07, 0, Math.PI * 2); ctx.fill(); }
  };

  // слой 'front' — только ближняя рука с оружием (рисуется поверх соседа, например водителя)
  if (P.layer === 'front') {
    if (P.item) drawHeldItem(ctx, P, sh);
    arm('F');
    ctx.restore();
    return;
  }
  // дальние рука и нога
  arm('B');
  leg('B');
  if (P.item && P.item.behind) drawHeldItem(ctx, P, sh);
  // торс
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(-lean);
  const w = 0.17 * bulk;
  const torsoPath = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 0.85, 0.0);
    ctx.quadraticCurveTo(-w * 1.05, RIG.torso * 0.5, -w * 0.8, RIG.torso + 0.02);
    ctx.quadraticCurveTo(0, RIG.torso + 0.08, w * 0.75, RIG.torso);
    ctx.quadraticCurveTo(w * (L.female ? 1.25 : 1.15) * (L.fat ? 1.5 : 1), RIG.torso * 0.6, w * (L.fat ? 1.35 : 0.95), RIG.torso * 0.15);
    ctx.quadraticCurveTo(w * 0.9, 0.0, w * 0.8, -0.03);
    ctx.closePath();
  };
  torsoPath();
  const tg = ctx.createLinearGradient(-w, 0, w, 0);
  tg.addColorStop(0, shade(L.topColor, -0.3)); tg.addColorStop(0.6, L.topColor); tg.addColorStop(1, shade(L.topColor, 0.12));
  ctx.fillStyle = tg; ctx.fill();
  ctx.save(); torsoPath(); ctx.clip();
  if (L.camo) emrPattern(ctx, -0.3, -0.05, 0.6, 0.7, L.seed || 5);
  if (L.top === 'jacket') {
    ctx.fillStyle = L.stripe; ctx.fillRect(-0.3, 0.2, 0.6, 0.05);
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(w * 0.7, 0.02); ctx.lineTo(w * 0.8, RIG.torso); ctx.stroke();
    ctx.fillStyle = L.collar; ctx.beginPath(); ctx.moveTo(-w * 0.6, RIG.torso + 0.06); ctx.lineTo(w * 0.7, RIG.torso + 0.02); ctx.lineTo(w * 0.6, RIG.torso - 0.08); ctx.lineTo(-w * 0.5, RIG.torso - 0.04); ctx.fill();
  } else if (L.top === 'leather') {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(w * 0.6, 0.0); ctx.lineTo(w * 0.3, RIG.torso); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-w * 0.6, RIG.torso * 0.3, 0.03, RIG.torso * 0.5);
  } else if (L.top === 'rags') {
    ctx.fillStyle = shade(L.skin, -0.1);
    ctx.beginPath(); ctx.moveTo(w * 0.2, 0.08); ctx.lineTo(w * 0.95, 0.14); ctx.lineTo(w * 0.5, 0.36); ctx.closePath(); ctx.fill();
    if (L.ribs) { ctx.strokeStyle = 'rgba(80,40,30,0.55)'; ctx.lineWidth = 0.012; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(w * 0.35, 0.13 + k * 0.05); ctx.lineTo(w * 0.85, 0.16 + k * 0.05); ctx.stroke(); } }
    if (L.blood) { ctx.fillStyle = 'rgba(110,12,10,0.7)'; ctx.beginPath(); ctx.ellipse(w * 0.4, RIG.torso * 0.72, 0.07, 0.1, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w * 0.3, RIG.torso * 0.35, 0.03, 0.18); }
    ctx.fillStyle = shade(L.topColor, -0.25); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-w + k * 0.08, 0.0); ctx.lineTo(-w + 0.04 + k * 0.08, -0.07); ctx.lineTo(-w + 0.08 + k * 0.08, 0.0); ctx.fill(); }
  }
  if (L.vest) {
    // бронежилет 6Б45: плита, подсумки под магазины, плечевые лямки
    ctx.fillStyle = L.vest; roundRect(ctx, -w * 0.95, 0.06, w * 1.95, RIG.torso * 0.78, 0.03); ctx.fill();
    ctx.save(); roundRect(ctx, -w * 0.95, 0.06, w * 1.95, RIG.torso * 0.78, 0.03); ctx.clip(); emrPattern(ctx, -0.25, 0.04, 0.5, 0.5, 11); ctx.restore();
    ctx.fillStyle = '#2f3524'; for (let k = 0; k < 3; k++) roundRect(ctx, w * 0.2, 0.1 + k * 0.1, w * 0.8, 0.08, 0.015), ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w * 0.95, RIG.torso * 0.5, w * 1.95, 0.015);
  }
  if (L.scarf) { ctx.fillStyle = L.scarf; ctx.beginPath(); ctx.moveTo(-w * 0.7, RIG.torso + 0.05); ctx.quadraticCurveTo(0, RIG.torso - 0.08, w * 0.9, RIG.torso + 0.02); ctx.lineTo(w * 0.7, RIG.torso - 0.12); ctx.quadraticCurveTo(0, RIG.torso - 0.18, -w * 0.6, RIG.torso - 0.06); ctx.fill(); }
  // ремень
  ctx.fillStyle = L.belt || '#1b1b1b'; ctx.fillRect(-w, -0.01, w * 2, 0.05);
  ctx.restore();
  ctx.restore();
  // ближняя нога, голова, ближняя рука
  leg('F');
  drawPersonHead(ctx, L, headC[0], headC[1], headAng, P.mood || {});
  if (P.layer !== 'back') {
    if (P.item && !P.item.behind) drawHeldItem(ctx, P, sh);
    arm('F');
  }
  ctx.restore();
}

// оружие в руках: автомат, обрез, винтовка; позиции кистей уже заданы позой
function drawHeldItem(ctx, P, sh) {
  const it = P.item;
  const rec = (it.recoil || 0) * 0.07;
  ctx.save(); ctx.translate(sh[0], sh[1]); ctx.rotate(it.aim); ctx.translate(-rec, 0);
  if (Math.cos(it.aim) < 0) ctx.scale(1, -1);   // стреляя назад, оружие не переворачивается рукоятью вверх
  if (it.type === 'rifle') {
    ctx.fillStyle = '#5a4630'; ctx.fillRect(-0.2, -0.06, 0.2, 0.09);
    ctx.fillStyle = '#1b1c1e'; ctx.fillRect(-0.02, -0.045, 0.62, 0.08); ctx.fillRect(0.58, -0.02, 0.35, 0.03);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(0.38, -0.05, 0.2, 0.06);
    ctx.fillStyle = '#26272a'; ctx.beginPath(); ctx.moveTo(0.2, -0.04); ctx.quadraticCurveTo(0.24, -0.2, 0.34, -0.25); ctx.lineTo(0.38, -0.2); ctx.quadraticCurveTo(0.3, -0.14, 0.3, -0.04); ctx.fill();
    if (it.flash) { ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.moveTo(0.93, 0); ctx.lineTo(1.15, 0.07); ctx.lineTo(1.3, 0); ctx.lineTo(1.15, -0.07); ctx.fill(); }
  } else if (it.type === 'shotgun') {
    // обрез двустволки: рукоять-«пистолетка», два ствола; при перезарядке «переламывается»
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.moveTo(0.0, -0.02); ctx.lineTo(0.1, 0.02); ctx.lineTo(0.08, -0.12); ctx.lineTo(0.0, -0.1); ctx.fill();
    ctx.fillStyle = '#2a2a2c'; ctx.fillRect(0.06, -0.03, 0.12, 0.06);
    ctx.save(); ctx.translate(0.16, 0.0); ctx.rotate(-(it.open || 0) * 0.9);
    ctx.fillStyle = '#3a3b3e'; ctx.fillRect(0, -0.005, 0.46, 0.035); ctx.fillStyle = '#26272a'; ctx.fillRect(0, -0.04, 0.46, 0.035);
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(0.02, -0.055, 0.16, 0.025);
    ctx.restore();
    if (it.flash) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(0.62, 0); ctx.lineTo(0.85, 0.12); ctx.lineTo(1.0, 0); ctx.lineTo(0.85, -0.12); ctx.fill(); }
  }
  ctx.restore();
}

/* ------------------------------ походки ------------------------------ */

const GAITS = {
  stand:   { swing: 0.05, knee: 0.05, arm: 0.05, lean: 0.03, armBase: 0.1, elbow: 0.25 },
  walk:    { swing: 0.42, knee: 0.7, arm: 0.35, lean: 0.06, armBase: 0.05, elbow: 0.3 },
  run:     { swing: 0.72, knee: 1.1, arm: 0.85, lean: 0.3, armBase: 0.1, elbow: 1.4, air: 0.05 },
  shamble: { swing: 0.36, knee: 0.55, arm: 0.12, lean: 0.22, armBase: 1.35, elbow: 0.15, asym: 0.55, drag: true },
  waddle:  { swing: 0.26, knee: 0.35, arm: 0.2, lean: -0.04, armBase: 0.35, elbow: 0.3, bob: 0.03 },
  stomp:   { swing: 0.38, knee: 0.6, arm: 0.3, lean: 0.24, armBase: 0.25, elbow: 0.5, bob: 0.02 }
};

// поза ходьбы: ноги — прямой кинематикой, таз опускается на широком шаге сам
function gaitPose(kind, phase, o = {}) {
  const G = GAITS[kind] || GAITS.walk;
  const amp = o.amp !== undefined ? o.amp : 1;
  const legFK = (ph, stiff) => {
    const thigh = Math.sin(ph) * G.swing * amp;
    const bend = (G.knee * amp * (stiff ? 0.2 : 1)) * Math.max(0, Math.sin(ph + 1.3));
    const kx = Math.sin(thigh) * RIG.thigh, ky = -Math.cos(thigh) * RIG.thigh;
    const sa = thigh - bend;
    return [kx + Math.sin(sa) * RIG.shin, ky - Math.cos(sa) * (RIG.shin + 0.06)];
  };
  // асимметрия зомби: шаг рывком, одна нога волочится
  const warp = G.asym ? phase + G.asym * Math.sin(phase) : phase;
  const fF = legFK(warp, false);
  const fB = legFK(warp + Math.PI, !!G.drag);
  const low = Math.min(fF[1], fB[1]);
  const air = G.air ? Math.max(0, Math.sin(phase * 2)) * G.air * amp : 0;
  const hipY = -low + air + (G.bob ? Math.cos(phase * 2) * G.bob : 0);
  const hip = [0, hipY];
  const feet = { F: [fF[0], Math.max(0, fF[1] + hipY)], B: [fB[0], Math.max(0, fB[1] + hipY)] };
  if (G.drag) feet.B[1] = Math.min(feet.B[1], 0.03);
  const lean = G.lean + (o.lean || 0);
  const shx = Math.sin(lean) * RIG.torso, shy = hipY + Math.cos(lean) * RIG.torso;
  const armFK = (a, bend) => {
    const ex = shx + Math.sin(a) * RIG.ua, ey = shy - Math.cos(a) * RIG.ua;
    const fa = a + bend;
    return [ex + Math.sin(fa) * RIG.fa, ey - Math.cos(fa) * RIG.fa];
  };
  const swingA = Math.sin(warp) * G.arm * amp;
  const hands = {
    F: armFK(G.armBase - swingA + (G.drag ? Math.sin(phase * 1.7) * 0.08 : 0), G.elbow),
    B: armFK(G.armBase + swingA + (G.drag ? Math.sin(phase * 1.3 + 1) * 0.1 : 0), G.elbow)
  };
  const footAng = { F: clamp(-Math.sin(warp) * 0.3 * amp, -0.35, 0.4), B: G.drag ? 0.25 : clamp(Math.sin(warp) * 0.3 * amp, -0.35, 0.4) };
  const head = G.drag ? Math.sin(phase * 0.5) * 0.18 - 0.15 : (kind === 'run' ? 0.2 : 0);
  return { hip, lean, feet, hands, footAng, head, knees: { F: 1, B: 1 }, elbows: { F: -1, B: -1 } };
}

// сидящий: таз на сиденье, стопы на педалях, руки к рулю
function seatedPose(hip, handTarget, footTarget, lean, headTilt) {
  return {
    hip, lean: lean || -0.1, head: headTilt || 0,
    feet: { F: footTarget, B: [footTarget[0] - 0.05, footTarget[1]] },
    knees: { F: 1, B: 1 },
    hands: { F: handTarget, B: [handTarget[0] - 0.02, handTarget[1] + 0.04] },
    elbows: { F: -1, B: -1 }, footAng: { F: 0, B: 0 }
  };
}

/* ------------------------------ внешность зомби и бойцов ------------------------------ */

const ZOMBIE_TOPS = ['#5b4a3a', '#3c4f63', '#6e2f2f', '#4a5a3a', '#7a6a4f', '#303030', '#8a7d6b', '#5a3d5c', '#2f5c5a', '#9a8f7a'];

function zombieLook(z) {
  if (z._look) return z._look;
  const T = z.t, rng = mulberry32(Math.floor(z.phase * 1000) + 17);
  const hairs = ['sparse', 'messy', 'bald', 'long'];
  const L = {
    zombie: true, skin: z.skin, hair: T.helmet ? 'helmet' : hairs[z.hairStyle % 4], hairColor: ['#2b2118', '#5a4a38', '#1a1a1a', '#6b6b6b'][z.hairStyle % 4],
    top: 'rags', topColor: z.shirt, pants: z.pants, boots: rng() < 0.3 ? shade(z.skin, -0.2) : '#2b241d',
    bulk: T.fat || T.bloat ? 1.7 : T.brute ? 1.3 : 1, fat: !!(T.fat || T.bloat), ribs: z.torn, blood: rng() < 0.7, wound: rng() < 0.5,
    tornArm: rng() < 0.35 ? 'F' : null, tornLeg: rng() < 0.25 ? 'B' : null, seed: Math.floor(rng() * 1000)
  };
  if (T.helmet) { L.camo = true; L.topColor = '#4c553a'; L.pants = '#454c36'; L.vest = '#4c553a'; L.boots = '#1e1e1a'; L.top = 'uniform'; }
  z._look = L;
  return L;
}

function raiderLook(r) {
  if (r._look) return r._look;
  let L;
  if (r.faction === 'military' || r.helmet) {
    L = { skin: r.skin, hair: 'helmet', top: 'uniform', topColor: '#4c553a', camo: true, pants: '#454c36', boots: '#1e1e1a', gloves: '#2a2a22', vest: '#4c553a', kneePad: true, belt: '#2f3524', armband: '#d8d6c0', seed: Math.floor(Math.random() * 999) };
  } else {
    const hairs = ['knit', 'mohawk', 'hood'];
    L = { skin: r.skin, hair: hairs[Math.max(0, r.hat) % 3], hat: '#2a2a2a', hood: '#2a2622', top: 'leather', topColor: r.shirt, pants: r.pants, boots: '#1e1e1e', gloves: '#1b1b1b', bandana: r.bandana, armband: '#b8261f' };
  }
  r._look = L;
  return L;
}
