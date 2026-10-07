'use strict';
/* Ориентиры на дальних планах: крупные узнаваемые силуэты, за которые цепляется глаз.
   Рисуются поверх «ковра» слоя в координатах тайла (x — по ширине 2048, y — от линии пола). */

const BD_MARK = {};

function bdMarks(g, W, H, r, C, list, B) {
  for (const m of list) {
    const fn = BD_MARK[m.k];
    if (!fn) continue;
    const s = m.s || 1;
    wrapDraw(W, m.x, 400 * s, x => {
      g.save(); g.translate(x, H - (m.y || 0)); g.scale(s, s);
      fn(g, r, C, m, B);
      g.restore();
    });
  }
}

// разбитый пассажирский самолёт: фюзеляж переломлен, хвост задран, крыло воткнулось в грунт
BD_MARK.airliner = (g, r, C) => {
  const body = mix(C.body, C.lit, 0.35), dark = mix(C.body, C.dark, 0.4);
  g.save(); g.rotate(-0.12);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-150, 0); g.quadraticCurveTo(-120, -34, -40, -36);
  g.lineTo(70, -30); g.quadraticCurveTo(110, -26, 120, -8);
  g.lineTo(118, 2); g.quadraticCurveTo(40, 12, -150, 8); g.closePath(); g.fill();
  g.fillStyle = dark;
  for (let i = -130; i < 100; i += 22) g.fillRect(i, -24, 8, 7);        // иллюминаторы
  g.fillStyle = mix(C.body, C.dark, 0.2);
  g.beginPath(); g.moveTo(100, -22); g.quadraticCurveTo(122, -20, 126, -8); g.lineTo(100, -6); g.closePath(); g.fill();
  g.restore();
  // хвост отломан и задран
  g.save(); g.translate(-160, -6); g.rotate(0.55);
  g.fillStyle = body;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-18, -70); g.lineTo(18, -74); g.lineTo(34, 0); g.closePath(); g.fill();
  g.fillStyle = dark; g.fillRect(-14, -78, 54, 10);
  g.restore();
  // крыло и двигатель
  g.fillStyle = mix(C.body, C.dark, 0.25);
  g.beginPath(); g.moveTo(-40, -8); g.lineTo(60, -54); g.lineTo(74, -46); g.lineTo(-20, 2); g.closePath(); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(28, -34, 16, 9, -0.5, 0, Math.PI * 2); g.fill();
  // борозда и обломки в грунте
  g.fillStyle = rgba(C.dark, 0.3);
  g.beginPath(); g.ellipse(-40, 8, 210, 12, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 12; i++) { const x = -220 + r() * 300; g.fillRect(x, 2 - r() * 8, 4 + r() * 12, 3 + r() * 4); }
};

// рухнувшая эстакада: пролёт обломился и повис, на нём брошенные машины
BD_MARK.bridge = (g, r, C) => {
  const deck = mix(C.body, C.lit, 0.25), pier = mix(C.body, C.dark, 0.3);
  g.fillStyle = pier;
  for (const px of [-190, 40]) { g.fillRect(px, -150, 26, 150); g.fillRect(px - 10, -162, 46, 14); }
  g.fillStyle = deck;
  g.fillRect(-260, -176, 190, 16);
  g.save(); g.translate(-70, -176); g.rotate(0.42);
  g.fillRect(0, 0, 130, 15); g.restore();
  g.fillRect(60, -176, 210, 16);
  // оборванная арматура
  g.strokeStyle = rgba(C.dark, 0.7); g.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const x = -70 + r() * 30; g.beginPath(); g.moveTo(x, -170); g.lineTo(x + (r() - 0.5) * 16, -186 - r() * 14); g.stroke(); }
  // машины на пролёте
  for (let i = 0; i < 4; i++) {
    const x = -250 + i * 42 + r() * 20;
    g.fillStyle = mix(['#7a3a32', '#39505f', '#5c5a4a', '#2f3a44'][i % 4], C.body, 0.45);
    g.fillRect(x, -190, 30, 9); g.fillRect(x + 6, -197, 16, 8);
  }
  g.fillStyle = rgba(C.dark, 0.35);
  for (let i = 0; i < 16; i++) { const x = -120 + r() * 200; g.fillRect(x, -6 - r() * 12, 8 + r() * 22, 5 + r() * 8); }
};

// радиомачта с растяжками и красными огнями (огни зажигает backdrop_life)
BD_MARK.radiotower = (g, r, C) => {
  const col = mix(C.body, C.dark, 0.25);
  const h = 300;
  g.strokeStyle = col; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-9, 0); g.lineTo(-3, -h); g.moveTo(9, 0); g.lineTo(3, -h); g.stroke();
  g.lineWidth = 1.6;
  for (let i = 0; i < 22; i++) {
    const y0 = -i * h / 22, y1 = -(i + 1) * h / 22;
    const w0 = 9 - i * 0.27, w1 = 9 - (i + 1) * 0.27;
    g.beginPath(); g.moveTo(-w0, y0); g.lineTo(w1, y1); g.moveTo(w0, y0); g.lineTo(-w1, y1); g.stroke();
  }
  g.lineWidth = 1.2;
  for (const sgn of [-1, 1]) for (const yy of [-h * 0.45, -h * 0.8]) {
    g.beginPath(); g.moveTo(0, yy); g.lineTo(sgn * (h * 0.32), 0); g.stroke();
  }
  g.fillStyle = col;
  g.fillRect(-16, -h * 0.55, 32, 5); g.fillRect(-12, -h * 0.75, 24, 4);
  g.beginPath(); g.moveTo(-2, -h); g.lineTo(2, -h); g.lineTo(1, -h - 26); g.lineTo(-1, -h - 26); g.closePath(); g.fill();
};

// сухогруз, выброшенный на берег: корпус накренился, надстройка на корме
BD_MARK.cargoship = (g, r, C) => {
  const hull = mix(C.body, C.dark, 0.2), sup = mix(C.body, C.lit, 0.2);
  g.save(); g.rotate(-0.09);
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-230, -70); g.lineTo(150, -66); g.quadraticCurveTo(220, -60, 236, -14);
  g.lineTo(-200, 0); g.quadraticCurveTo(-232, -14, -230, -70); g.closePath(); g.fill();
  g.fillStyle = rgba('#7a2f22', 0.35);                              // ржавые потёки
  for (let i = 0; i < 18; i++) { const x = -220 + r() * 440; g.fillRect(x, -60 + r() * 30, 3 + r() * 6, 20 + r() * 34); }
  g.fillStyle = rgba(C.dark, 0.4); g.fillRect(-224, -24, 450, 6);
  g.fillStyle = sup;
  g.fillRect(-214, -132, 88, 64);
  g.fillStyle = rgba(C.dark, 0.55);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillRect(-206 + i * 20, -124 + j * 18, 12, 9);
  g.fillStyle = mix(C.body, C.dark, 0.45); g.fillRect(-180, -166, 12, 36);
  // краны на палубе
  g.strokeStyle = mix(C.body, C.dark, 0.35); g.lineWidth = 5;
  for (const cx of [-60, 60]) { g.beginPath(); g.moveTo(cx, -70); g.lineTo(cx + 6, -120); g.lineTo(cx + 48, -140); g.stroke(); }
  g.restore();
};

// ветрогенератор: башня и гондола, лопасти крутит backdrop_life
BD_MARK.turbine = (g, r, C) => {
  const col = mix(C.body, C.lit, 0.4);
  const h = 230;
  g.fillStyle = col;
  g.beginPath(); g.moveTo(-9, 0); g.lineTo(-3.5, -h); g.lineTo(3.5, -h); g.lineTo(9, 0); g.closePath(); g.fill();
  g.fillStyle = mix(C.body, C.dark, 0.2);
  g.fillRect(-7, -h - 12, 22, 12);
};

// водонапорная башня на опорах
BD_MARK.watertower = (g, r, C) => {
  const col = mix(C.body, C.dark, 0.25), h = 150;
  g.strokeStyle = col; g.lineWidth = 5;
  for (const dx of [-30, 30]) { g.beginPath(); g.moveTo(dx, 0); g.lineTo(dx * 0.45, -h * 0.72); g.stroke(); }
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-28, -h * 0.3); g.lineTo(28, -h * 0.45); g.moveTo(28, -h * 0.3); g.lineTo(-28, -h * 0.45); g.stroke();
  g.fillStyle = mix(C.body, C.lit, 0.15);
  g.beginPath(); g.moveTo(-34, -h); g.lineTo(34, -h); g.lineTo(30, -h * 0.68); g.lineTo(-30, -h * 0.68); g.closePath(); g.fill();
  g.fillStyle = mix(C.body, C.dark, 0.45);
  g.beginPath(); g.moveTo(-38, -h); g.lineTo(0, -h - 26); g.lineTo(38, -h); g.closePath(); g.fill();
};

// разбитый вертолёт на склоне
BD_MARK.wreckheli = (g, r, C) => {
  const col = mix(C.body, C.dark, 0.3);
  g.save(); g.rotate(0.35);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(40, -14); g.quadraticCurveTo(50, 0, 30, 10); g.lineTo(-16, 10);
  g.quadraticCurveTo(-28, 8, -30, 2); g.lineTo(-86, -2); g.lineTo(-86, -10); g.lineTo(-30, -16);
  g.quadraticCurveTo(-18, -28, 10, -28); g.quadraticCurveTo(34, -28, 40, -14); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-84, -8); g.lineTo(-96, -34); g.lineTo(-76, -32); g.lineTo(-72, -8); g.closePath(); g.fill();
  g.strokeStyle = col; g.lineWidth = 3;
  g.beginPath(); g.moveTo(6, -28); g.lineTo(6, -40); g.stroke();
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(-40, -44); g.lineTo(30, -38); g.moveTo(6, -40); g.lineTo(-24, -20); g.stroke();
  g.restore();
};
