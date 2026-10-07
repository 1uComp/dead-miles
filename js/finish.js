'use strict';
/* Финишные здания: гараж, заправка, лодочный ангар, корма корабля, вертолётная площадка.
   layer: 'back' — позади транспорта (интерьер), 'front' — поверх (стены, крыша, ворота) */

function worldText(ctx, str, x, y, size, color, align = 'center') {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, -1);
  ctx.fillStyle = color; ctx.font = `bold ${size}px Oswald, Impact, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

function drawRollerDoor(ctx, x, yTop, w, hDoor, color) {
  if (hDoor <= 0.01) return;
  const g = ctx.createLinearGradient(0, yTop, 0, yTop - hDoor);
  g.addColorStop(0, shade(color, 0.15)); g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(x, yTop - hDoor, w, hDoor);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.05;
  for (let yy = yTop - 0.25; yy > yTop - hDoor; yy -= 0.25) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, yTop - hDoor - 0.08, w, 0.12);
  ctx.fillRect(x + w / 2 - 0.3, yTop - hDoor + 0.05, 0.6, 0.12);
}

function drawFinish(ctx, d, R, t, layer) {
  const night = R.night;
  const dim = (c) => night ? mix(c, '#07080c', 0.45) : c;
  const X = d.x, y = d.y, k = clamp(d.doorK || 0, 0, 1);
  switch (d.kind) {
    case 'garage': {
      const Wd = 15, Hd = 5.2;
      if (layer === 'back') {
        const g = ctx.createLinearGradient(0, y + Hd, 0, y);
        g.addColorStop(0, dim('#5d5a55')); g.addColorStop(1, dim('#3b3935'));
        ctx.fillStyle = g; ctx.fillRect(X, y - 0.4, Wd, Hd + 0.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.03;
        for (let yy = y; yy < y + Hd; yy += 0.4) { ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + Wd, yy); ctx.stroke(); }
        // стеллаж с покрышками и канистрами
        ctx.fillStyle = dim('#4a3a2a');
        ctx.fillRect(X + Wd - 3.4, y - 0.3, 0.12, 3.4); ctx.fillRect(X + Wd - 0.6, y - 0.3, 0.12, 3.4);
        for (const sy of [1.2, 2.4, 3.3]) ctx.fillRect(X + Wd - 3.4, y + sy, 2.9, 0.1);
        for (let i = 0; i < 3; i++) drawWheel(ctx, X + Wd - 2.8 + i * 0.95, y + 1.65, 0, 0.42, { rim: '#555', rimScale: 0.4 });
        drawJerrycan(ctx, X + Wd - 2.6, y + 2.5, 0.5); drawJerrycan(ctx, X + Wd - 1.7, y + 2.5, 0.5);
        // доска с инструментами
        ctx.fillStyle = dim('#6b5236'); ctx.fillRect(X + 2, y + 2.2, 3.2, 1.8);
        ctx.strokeStyle = dim('#9aa0a6'); ctx.lineWidth = 0.07;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(X + 2.3 + i * 0.5, y + 3.7); ctx.lineTo(X + 2.3 + i * 0.5, y + 2.7 + (i % 2) * 0.3); ctx.stroke(); }
        // лампа
        ctx.strokeStyle = '#222'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(X + Wd / 2, y + Hd); ctx.lineTo(X + Wd / 2, y + Hd - 0.8); ctx.stroke();
        ctx.fillStyle = '#333'; polyPath(ctx, [[X + Wd / 2 - 0.4, y + Hd - 1.1], [X + Wd / 2 + 0.4, y + Hd - 1.1], [X + Wd / 2 + 0.15, y + Hd - 0.8], [X + Wd / 2 - 0.15, y + Hd - 0.8]]); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, y + Hd - 1.1, 0, y);
        lg.addColorStop(0, 'rgba(255,230,160,0.35)'); lg.addColorStop(1, 'rgba(255,230,160,0)');
        ctx.fillStyle = lg; polyPath(ctx, [[X + Wd / 2 - 0.4, y + Hd - 1.1], [X + Wd / 2 + 0.4, y + Hd - 1.1], [X + Wd / 2 + 3, y], [X + Wd / 2 - 3, y]]); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        // стоп-линия
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#111' : '#e0b020'; ctx.fillRect(X + d.stopX + 2.6, y - 0.36 + i * 0.12, 0.12, 0.12); }
        d.light = Hd - 1; d.lr = 11; d.lx = Wd / 2;
      } else {
        const wall = dim('#8d8a82');
        ctx.fillStyle = wall;
        ctx.fillRect(X - 0.6, y - 0.4, 0.6, Hd + 0.4);
        ctx.fillRect(X + Wd, y - 0.4, 3, Hd + 0.4);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X - 0.08, y - 0.4, 0.08, Hd + 0.4);
        // крыша
        ctx.fillStyle = dim('#5a3a2a');
        polyPath(ctx, [[X - 1.2, y + Hd], [X + Wd + 3.6, y + Hd], [X + Wd + 3.1, y + Hd + 1.1], [X - 0.7, y + Hd + 1.1]]); ctx.fill();
        ctx.fillStyle = dim('#3a2a20'); ctx.fillRect(X - 1.2, y + Hd - 0.1, Wd + 4.8, 0.2);
        // вывеска
        ctx.fillStyle = '#222'; roundRect(ctx, X + Wd / 2 - 3, y + Hd + 1.2, 6, 1.3, 0.12); ctx.fill();
        ctx.strokeStyle = '#e0b020'; ctx.lineWidth = 0.08; ctx.stroke();
        worldText(ctx, 'ГАРАЖ', X + Wd / 2, y + Hd + 1.85, 0.9, Math.floor(t * 3) % 2 && !k ? '#ffe080' : '#e0b020');
        // короб и ворота
        ctx.fillStyle = dim('#4a4d52'); ctx.fillRect(X - 0.1, y + Hd - 0.45, Wd + 0.2, 0.45);
        drawRollerDoor(ctx, X, y + Hd - 0.45, Wd, k * (Hd + 0.4 - 0.45), dim('#8c9296'));
        ctx.fillStyle = night ? '#e8c070' : '#2a3440'; ctx.fillRect(X + Wd + 0.8, y + 2.2, 1.4, 1.3);
      }
      break;
    }
    case 'gas': {
      const Wc = 14;
      if (layer === 'back') {
        ctx.fillStyle = dim('#9a8a74'); ctx.fillRect(X + Wc + 1, y - 0.4, 10, 4.9);
        ctx.fillStyle = night ? '#e8c070' : '#2a3440';
        ctx.fillRect(X + Wc + 2, y + 1.3, 3.5, 2); ctx.fillRect(X + Wc + 7, y + 1.3, 2, 2);
        ctx.fillStyle = dim('#c62828'); ctx.fillRect(X + Wc + 0.8, y + 4.5, 10.4, 0.5);
        for (const px of [X + 3.5, X + 9.5]) {
          ctx.fillStyle = dim('#d9d9d9'); ctx.fillRect(px - 0.2, y - 0.3, 1.2, 0.3);
          ctx.fillStyle = dim('#c62828'); roundRect(ctx, px, y, 0.8, 1.8, 0.1); ctx.fill();
          ctx.fillStyle = '#111'; ctx.fillRect(px + 0.15, y + 1.1, 0.5, 0.4);
          ctx.strokeStyle = '#222'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(px + 0.8, y + 1.2); ctx.quadraticCurveTo(px + 1.4, y + 0.6, px + 1.0, y + 0.2); ctx.stroke();
        }
        // Мира на крыше машет руками
        const mx = X + Wc + 6, my = y + 5.0;
        const wave = Math.sin(t * 8);
        limb(ctx, mx - 0.1, my, mx - 0.15, my + 0.45, 0.13, '#2c3440');
        limb(ctx, mx + 0.1, my, mx + 0.15, my + 0.45, 0.13, '#2c3440');
        limb(ctx, mx, my + 0.45, mx, my + 1.05, 0.26, '#5a2f2a');
        limb(ctx, mx - 0.05, my + 0.95, mx - 0.45 + wave * 0.15, my + 1.5, 0.09, '#5a2f2a');
        limb(ctx, mx + 0.05, my + 0.95, mx + 0.45 - wave * 0.15, my + 1.5, 0.09, '#5a2f2a');
        ctx.fillStyle = '#e6b898'; ctx.beginPath(); ctx.arc(mx, my + 1.3, 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(mx, my + 1.36, 0.17, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#b03030'; ctx.fillRect(mx - 0.17, my + 1.38, 0.34, 0.05);
        d.light = 4; d.lr = 12; d.lx = Wc / 2; d.flicker = true;
      } else {
        ctx.fillStyle = dim('#888'); ctx.fillRect(X + 0.6, y - 0.3, 0.35, 4.6); ctx.fillRect(X + Wc - 1, y - 0.3, 0.35, 4.6);
        ctx.fillStyle = dim('#e8e8e8'); ctx.fillRect(X - 0.8, y + 4.3, Wc + 0.8, 0.9);
        ctx.fillStyle = dim('#c62828'); ctx.fillRect(X - 0.8, y + 4.3, Wc + 0.8, 0.3);
        worldText(ctx, 'АЗС «ПОСЛЕДНЯЯ»', X + Wc / 2 - 0.4, y + 4.85, 0.42, '#c62828');
        ctx.fillStyle = dim('#555'); ctx.fillRect(X - 2.6, y - 0.3, 0.25, 6);
        ctx.fillStyle = dim('#c62828'); roundRect(ctx, X - 3.3, y + 4.6, 1.6, 2.2, 0.1); ctx.fill();
        worldText(ctx, 'ТОПЛ', X - 2.5, y + 6.3, 0.35, '#fff'); worldText(ctx, '??.??', X - 2.5, y + 5.6, 0.35, '#ffe080');
      }
      break;
    }
    case 'boathouse': {
      const Wd = 18, Hd = 6.2, base = -1.2;
      if (layer === 'back') {
        ctx.fillStyle = dim('#4a3a2a');
        for (let px = X - 0.5; px <= X + Wd + 0.5; px += 3) ctx.fillRect(px - 0.2, -9, 0.4, 9 + base + 0.5);
        const g = ctx.createLinearGradient(0, Hd, 0, base);
        g.addColorStop(0, dim('#6b5236')); g.addColorStop(1, dim('#3f2f20'));
        ctx.fillStyle = g; ctx.fillRect(X, base, Wd, Hd - base);
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.05;
        for (let px = X; px < X + Wd; px += 0.6) { ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, Hd); ctx.stroke(); }
        for (const [cx, cy] of [[X + 3, 3.5], [X + Wd - 4, 3.8]]) {
          ctx.strokeStyle = '#e05a22'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.arc(cx, cy, 0.45, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#eee'; ctx.setLineDash([0.35, 0.35]); ctx.beginPath(); ctx.arc(cx, cy, 0.45, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = night ? '#e8c070' : '#2a3440'; ctx.fillRect(X + Wd / 2 - 1, 3, 2, 1.4);
        d.light = 4.5; d.lr = 12; d.lx = Wd / 2;
      } else {
        ctx.fillStyle = dim('#5a4430');
        ctx.fillRect(X - 0.7, base, 0.7, Hd - base); ctx.fillRect(X + Wd, base, 0.7, Hd - base);
        ctx.fillStyle = dim('#3a4a55');
        polyPath(ctx, [[X - 1.5, Hd], [X + Wd + 1.5, Hd], [X + Wd / 2, Hd + 3.2]]); ctx.fill();
        ctx.fillStyle = '#222'; roundRect(ctx, X + Wd / 2 - 4.2, Hd + 0.3, 8.4, 1.1, 0.1); ctx.fill();
        worldText(ctx, 'ЛОДОЧНЫЙ АНГАР', X + Wd / 2, Hd + 0.85, 0.7, '#f0d070');
        ctx.fillStyle = dim('#4a4d52'); ctx.fillRect(X - 0.1, Hd - 0.5, Wd + 0.2, 0.5);
        drawRollerDoor(ctx, X, Hd - 0.5, Wd, k * (Hd - 0.5 + 0.6), dim('#7d878c'));
      }
      break;
    }
    case 'shipramp': {
      const Wd = 26, Hd = 7;
      if (layer === 'back') {
        ctx.fillStyle = dim('#2a3036'); ctx.fillRect(X, -1.5, Wd, Hd + 1.5);
        ctx.fillStyle = 'rgba(255,220,150,0.12)';
        for (let i = 0; i < 5; i++) ctx.fillRect(X + 2 + i * 5, Hd - 0.6, 2.5, 0.25);
        ctx.fillStyle = dim('#4a5258'); polyPath(ctx, [[X - 12, -1.5], [X, -1.5], [X, 0.3]]); ctx.fill();
        d.light = 5; d.lr = 16; d.lx = Wd / 2;
      } else {
        ctx.fillStyle = dim('#3c444a');
        ctx.fillRect(X - 1, Hd, Wd + 30, 12);
        ctx.fillRect(X + Wd, -4, 30, Hd + 4);
        ctx.fillStyle = dim('#343b40'); ctx.fillRect(X - 1, -4, 1, Hd + 4);
        worldText(ctx, 'СЕВЕРНАЯ ЗВЕЗДА', X + 12, Hd + 5, 1.8, dim('#e8e8e8'), 'left');
        for (let i = 0; i < 8; i++) { ctx.fillStyle = night ? '#ffd070' : '#1a1f24'; ctx.beginPath(); ctx.arc(X + 4 + i * 5, Hd + 8.5, 0.5, 0, Math.PI * 2); ctx.fill(); }
        drawRollerDoor(ctx, X, Hd, Wd, k * (Hd + 1.5), dim('#59636a'));
      }
      break;
    }
    case 'helipad': {
      if (layer === 'back') {
        ctx.fillStyle = dim('#3a4046'); ctx.fillRect(X - 2, y - 0.25, 30, 0.25);
        ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 0.2;
        ctx.beginPath(); ctx.ellipse(X + 13, y + 0.02, 5, 0.35, 0, 0, Math.PI * 2); ctx.stroke();
        const hx = X + 16, hy = y;
        ctx.fillStyle = dim('#39463a');
        ctx.beginPath(); ctx.ellipse(hx, hy + 1.9, 3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(hx - 7, hy + 1.9, 5, 0.5); ctx.fillRect(hx - 7.3, hy + 1.9, 0.4, 1.4);
        ctx.fillStyle = 'rgba(150,200,230,0.6)'; ctx.beginPath(); ctx.ellipse(hx + 1.8, hy + 2.2, 1, 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(hx - 2, hy + 0.35, 4, 0.12); ctx.fillRect(hx - 1.5, hy + 0.35, 0.12, 0.3); ctx.fillRect(hx + 1.4, hy + 0.35, 0.12, 0.3);
        ctx.fillRect(hx - 0.1, hy + 3.2, 0.2, 0.5);
        const blade = Math.cos(t * 25) * 5;
        ctx.fillStyle = 'rgba(20,20,20,0.7)'; ctx.fillRect(hx - Math.abs(blade), hy + 3.65, Math.abs(blade) * 2, 0.1);
        d.light = 6; d.lr = 14; d.lx = 13;
      }
      break;
    }
  }
}
