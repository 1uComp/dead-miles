'use strict';
/* Портреты персонажей для диалогов: процедурный «Live2D» на Canvas.

   Риг повторяет стандартные параметры Live2D Cubism: поворот головы по X/Y/Z, открытие век, «улыбка глаз»,
   направление взгляда, брови (высота и наклон), форма рта (злость…улыбка), открытие рта, дыхание, покачивание волос.
   Поворот головы — параллакс слоёв: нос (глубина 1) смещается сильнее глаз (0.7), глаза сильнее контура лица,
   уши и затылок уходят в обратную сторону.
   Анимация:
   • дыхание — синус ~0.25 Гц, плечи и голова (живая пауза: персонаж не замирает);
   • моргание — случайно, в среднем 17 раз в минуту, 150 мс, иногда двойное; моргает при смене мысли;
   • саккады — взгляд скачками за 40 мс, фиксация 0.3–1.8 с; говоря, смотрит на собеседника;
   • липсинк — буквы текста переводятся в «виземы» (по мотивам фонем Престона Блэра: А, О, У, Э, И, М-Б-П, Ф-В,
     С-З-Ш, Л-Д-Т-Н), рот идёт к ним пружиной — формы плавно перетекают;
   • эмоции — из тега реплики или по знакам препинания; брови, веки, рот и наклон головы смешиваются за ~0.3 с;
   • захлёст — волосы, перо, провод гарнитуры догоняют голову с задержкой;
   • свет — ключевой слева сверху (светотень по Рембрандту), цветной контровой свет от фона.
   Портрет рисуется в удвоенном разрешении 300×360. */

const PW = 300, PH = 360;

/* ------------------------------ эмоции ------------------------------ */
// brow: высота бровей, ang: наклон (+ домиком, − злость), form: уголки рта, open: веки, smile: улыбка глаз, ay: наклон головы
const EMOTIONS = {
  neutral:    { brow: 0,    ang: 0,    form: 0,    open: 1,    smile: 0,   ay: 0 },
  smile:      { brow: 0.2,  ang: 0.1,  form: 0.85, open: 0.9,  smile: 0.55, ay: 0.05 },
  smirk:      { brow: 0.1,  ang: -0.2, form: 0.45, open: 0.85, smile: 0.2, ay: -0.05, asym: 1 },
  angry:      { brow: -0.6, ang: -1,   form: -0.7, open: 0.95, smile: 0,   ay: -0.15 },
  sad:        { brow: 0.15, ang: 0.9,  form: -0.55, open: 0.72, smile: 0,  ay: -0.3 },
  surprised:  { brow: 1,    ang: 0.2,  form: 0,    open: 1.28, smile: 0,   ay: 0.12, jaw: 0.25 },
  fear:       { brow: 0.85, ang: 1,    form: -0.5, open: 1.32, smile: 0,   ay: 0.05, jaw: 0.3 },
  determined: { brow: -0.3, ang: -0.45, form: -0.15, open: 0.92, smile: 0.05, ay: -0.08 },
  question:   { brow: 0.55, ang: 0.3,  form: 0.05, open: 1.08, smile: 0,   ay: 0.05, az: 0.1 },
  tired:      { brow: 0.05, ang: 0.5,  form: -0.2, open: 0.62, smile: 0,   ay: -0.2 }
};

// характер по умолчанию: к чему лицо возвращается и как реагирует на «!»
const TEMPER = {
  alex:   { base: 'neutral', exclaim: 'determined', rest: 'tired' },
  mira:   { base: 'smirk', exclaim: 'surprised', rest: 'neutral' },
  semyon: { base: 'smile', exclaim: 'surprised', rest: 'neutral' },
  valtz:  { base: 'determined', exclaim: 'angry', rest: 'neutral' },
  raven:  { base: 'smirk', exclaim: 'angry', rest: 'neutral' },
  unknown:{ base: 'neutral', exclaim: 'neutral', rest: 'neutral' },
  radio:  { base: 'neutral', exclaim: 'neutral', rest: 'neutral' }
};

function detectEmotion(line, who) {
  if (line.emo && EMOTIONS[line.emo]) return line.emo;
  const tp = TEMPER[who] || TEMPER.alex;
  const t = line.text.trim();
  if (/^…+$/.test(t) || t === '...') return 'sad';
  if (/Ха\b|ха-ха/i.test(t)) return 'smirk';
  if (t.includes('?!')) return 'surprised';
  if (t.endsWith('?')) return 'question';
  if (t.includes('!')) return tp.exclaim;
  if (t.startsWith('…') || t.endsWith('…')) return who === 'raven' ? 'smirk' : 'sad';
  return tp.base;
}

/* ------------------------------ виземы ------------------------------ */
// open: открытие челюсти, wide: растяжение, round: округление губ, close: сомкнутые губы, fv: зубы на губе, teeth
const VIS = {
  A: { open: 0.95, wide: 0.45, round: 0 },
  O: { open: 0.7, wide: -0.2, round: 0.9 },
  U: { open: 0.3, wide: -0.45, round: 1 },
  E: { open: 0.55, wide: 0.85, round: 0, teeth: 0.6 },
  I: { open: 0.28, wide: 1, round: 0, teeth: 0.9 },
  M: { open: 0, wide: 0.1, round: 0, close: 1 },
  F: { open: 0.12, wide: 0.3, round: 0, fv: 1, teeth: 1 },
  S: { open: 0.14, wide: 0.7, round: 0, teeth: 1 },
  L: { open: 0.35, wide: 0.35, round: 0, teeth: 0.5 },
  K: { open: 0.4, wide: 0.2, round: 0.1 },
  rest: { open: 0.04, wide: 0, round: 0 }
};
const LETTER_VIS = (() => {
  const m = {};
  const set = (letters, v) => { for (const ch of letters) m[ch] = v; };
  set('аяa', 'A'); set('оёo', 'O'); set('уюu', 'U'); set('эеe', 'E'); set('иыйi', 'I');
  set('мбпmbp', 'M'); set('фвfv', 'F'); set('сзцшщжчsz', 'S'); set('лдтнldtn', 'L'); set('ркгхrkgh', 'K');
  return m;
})();

/* ------------------------------ аниматор ------------------------------ */

function rnd(a, b) { return a + Math.random() * (b - a); }

// пружина (x → target), w — частота, z — затухание
function spr(s, target, dt, w, z = 1) {
  const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += ((target - s.x) * w * w - s.v * 2 * z * w) * h; s.x += s.v * h; }
  return s.x;
}
const S = x => ({ x, v: 0 });

class PortraitAnimator {
  constructor(who) {
    this.who = who;
    this.t = rnd(0, 100);
    this.seed = Math.floor(Math.random() * 1e6);
    const e = EMOTIONS[(TEMPER[who] || TEMPER.alex).base];
    this.emo = { brow: S(e.brow), ang: S(e.ang), form: S(e.form), open: S(e.open), smile: S(e.smile), ay: S(e.ay), az: S(0), jaw: S(0), asym: S(0) };
    this.emoName = (TEMPER[who] || TEMPER.alex).base;
    this.head = { ax: S(0), ay: S(0), az: S(0), nod: S(0) };
    this.hair = S(0); this.hairY = S(0);
    this.mouth = { open: S(0), wide: S(0), round: S(0), close: S(0), fv: S(0), teeth: S(0) };
    this.blink = { t: rnd(0.5, 2.5), phase: 0, double: false };
    this.look = { x: S(0), y: S(0), tx: 0, ty: 0, t: rnd(0.4, 1.4) };
    this.speech = null;
    this.cut = 0;          // «наезд» при смене говорящего
    this.pulse = 0;        // интенсивность речи (для огонька рации, стрелки прибора)
    this.lastAx = 0; this.lastAz = 0;
  }

  say(line) {
    this.speech = { text: line.text, pos: 0, rate: rnd(13, 16), pause: 0.12 };
    this.emoName = detectEmotion(line, this.who);
    // при новой мысли — моргнуть и посмотреть на собеседника
    if (Math.random() < 0.6) this.blink.t = rnd(0.02, 0.15);
    this.look.tx = rnd(-0.12, 0.12); this.look.ty = rnd(-0.05, 0.08); this.look.t = rnd(0.6, 1.5);
    this.head.nod.v -= 2.5;
  }
  enter() { this.cut = 1; }
  get talking() { return !!(this.speech && this.speech.pos < this.speech.text.length); }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const t = this.t;
    this.cut = Math.max(0, this.cut - dt * 3.5);
    // --- эмоция ---
    const e = EMOTIONS[this.emoName] || EMOTIONS.neutral;
    const em = this.emo;
    spr(em.brow, e.brow, dt, 9, 0.8); spr(em.ang, e.ang, dt, 9, 0.8); spr(em.form, e.form, dt, 8, 0.9);
    spr(em.open, e.open, dt, 10, 0.75); spr(em.smile, e.smile, dt, 8); spr(em.ay, e.ay || 0, dt, 5, 0.9);
    spr(em.az, e.az || 0, dt, 5, 0.9); spr(em.jaw, e.jaw || 0, dt, 8); spr(em.asym, e.asym || 0, dt, 6);

    // --- речь: виземы по буквам со своей скоростью (набор текста быстрее голоса) ---
    let vis = VIS.rest, talking = false;
    const sp = this.speech;
    if (sp && sp.pos < sp.text.length) {
      talking = true;
      const ch = sp.text[Math.floor(sp.pos)] || ' ';
      const low = ch.toLowerCase();
      if ('.,!?…—:;'.includes(ch)) {
        vis = VIS.rest;
        sp.pos += dt * sp.rate * (ch === ',' ? 0.35 : 0.22);   // паузы на знаках
      } else {
        vis = VIS[LETTER_VIS[low]] || (low === ' ' ? VIS.rest : VIS.L);
        sp.pos += dt * sp.rate;
        // ударные гласные подталкивают голову
        if ((vis === VIS.A || vis === VIS.O) && Math.random() < dt * 5) this.head.nod.v += rnd(0.8, 1.6) * (this.emoName === 'angry' ? 1.8 : 1);
      }
    }
    const loud = this.emoName === 'angry' || this.emoName === 'surprised' || this.emoName === 'fear' ? 1.2 : 1;
    const mo = this.mouth;
    spr(mo.open, Math.min(1.1, vis.open * loud + (talking ? Math.sin(t * 23) * 0.04 : 0)), dt, 30, 0.85);
    spr(mo.wide, vis.wide, dt, 24, 0.9); spr(mo.round, vis.round, dt, 22, 0.9);
    spr(mo.close, vis.close || 0, dt, 34); spr(mo.fv, vis.fv || 0, dt, 30); spr(mo.teeth, vis.teeth || (vis.open > 0.3 ? 0.4 : 0), dt, 26);
    this.pulse += ((talking ? 0.4 + mo.open.x * 0.8 : 0) - this.pulse) * Math.min(1, dt * 12);

    // --- голова: медленный дрейф + кивки + наклон эмоции ---
    const sd = this.seed;
    const driftX = Math.sin(t * 0.37 + sd) * 0.13 + Math.sin(t * 0.83 + sd * 2) * 0.06;
    const driftY = Math.sin(t * 0.29 + sd * 3) * 0.07 + Math.sin(t * 0.61 + sd) * 0.04;
    const driftZ = Math.sin(t * 0.23 + sd * 5) * 0.04;
    const talkX = talking ? Math.sin(t * 2.1 + sd) * 0.08 : 0;
    const hd = this.head;
    spr(hd.ax, driftX + talkX + this.look.x.x * 0.35, dt, 3.2, 0.9);
    spr(hd.ay, driftY + em.ay.x, dt, 3.5, 0.9);
    spr(hd.az, driftZ + em.az.x + (talking ? Math.sin(t * 1.3) * 0.03 : 0), dt, 3, 0.9);
    spr(hd.nod, 0, dt, 9, 0.45);

    // --- волосы и мелочи догоняют голову (захлёст) ---
    const vx = (hd.ax.x - this.lastAx) / dt, vz = (hd.az.x - this.lastAz) / dt;
    this.lastAx = hd.ax.x; this.lastAz = hd.az.x;
    spr(this.hair, -vx * 0.35 - vz * 0.6 + Math.sin(t * 1.7 + sd) * 0.05, dt, 6, 0.35);
    spr(this.hairY, hd.nod.x * 0.4, dt, 7, 0.4);

    // --- моргание ---
    const bl = this.blink;
    bl.t -= dt;
    if (bl.phase > 0) {
      bl.phase += dt / 0.15;
      if (bl.phase >= 2) { bl.phase = 0; if (bl.double) { bl.double = false; bl.t = 0.12; } }
    } else if (bl.t <= 0) {
      bl.phase = 0.001;
      bl.double = Math.random() < 0.15;
      // ~17 морганий в минуту, при волнении чаще
      const rate = this.emoName === 'fear' || this.emoName === 'surprised' ? 0.45 : 1;
      bl.t = -Math.log(1 - Math.random()) * 3.5 * rate + 0.4;
    }
    const blinkK = bl.phase > 0 ? (bl.phase < 1 ? bl.phase : 2 - bl.phase) : 0;
    this.blinkK = Math.min(1, blinkK * 1.4);

    // --- саккады ---
    const lk = this.look;
    lk.t -= dt;
    if (lk.t <= 0) {
      if (talking || Math.random() < 0.55) { lk.tx = rnd(-0.12, 0.12); lk.ty = rnd(-0.06, 0.06); lk.t = rnd(0.35, 1.2); }
      else { lk.tx = rnd(-0.85, 0.85); lk.ty = rnd(-0.5, 0.35); lk.t = rnd(0.4, 1.8); if (Math.random() < 0.3) bl.t = Math.min(bl.t, 0.05); }
    }
    spr(lk.x, lk.tx, dt, 45, 1); spr(lk.y, lk.ty, dt, 45, 1);
    this.talkingNow = talking;
  }

  rig() {
    const em = this.emo, mo = this.mouth, hd = this.head;
    const breath = (Math.sin(this.t * 1.6 + this.seed) + 1) * 0.5;
    return {
      t: this.t, ax: hd.ax.x, ay: hd.ay.x + hd.nod.x * 0.06, az: hd.az.x, breath,
      open: Math.max(0, em.open.x * (1 - this.blinkK)), smile: em.smile.x, blink: this.blinkK,
      lookX: this.look.x.x, lookY: this.look.y.x,
      brow: em.brow.x, browAng: em.ang.x, form: em.form.x, asym: em.asym.x,
      mOpen: clamp(mo.open.x + em.jaw.x * 0.3, 0, 1.2) * (1 - mo.close.x), mWide: mo.wide.x, mRound: mo.round.x, mFV: mo.fv.x, mTeeth: mo.teeth.x,
      hair: this.hair.x, hairY: this.hairY.x, cut: this.cut, pulse: this.pulse, talking: this.talkingNow
    };
  }
}

/* ------------------------------ геометрия лица ------------------------------ */

// преобразование точки лица с учётом поворота головы: d — «глубина» (нос 1, глаза 0.7, уши −0.5)
function faceXf(r, H) {
  const K = 30;
  const sq = 1 - Math.abs(r.ax) * 0.07;
  return (x, y, d = 0.2) => [x * sq + r.ax * d * K, y + r.ay * d * K * 0.75 - r.ay * 4];
}

function pathCmds(ctx, cmds, xf, d) {
  ctx.beginPath();
  for (const c of cmds) {
    const dd = c.d !== undefined ? c.d : d;
    if (c[0] === 'M') { const p = xf(c[1], c[2], dd); ctx.moveTo(p[0], p[1]); }
    else if (c[0] === 'L') { const p = xf(c[1], c[2], dd); ctx.lineTo(p[0], p[1]); }
    else if (c[0] === 'Q') { const a = xf(c[1], c[2], dd), p = xf(c[3], c[4], dd); ctx.quadraticCurveTo(a[0], a[1], p[0], p[1]); }
    else if (c[0] === 'C') { const a = xf(c[1], c[2], dd), b = xf(c[3], c[4], dd), p = xf(c[5], c[6], dd); ctx.bezierCurveTo(a[0], a[1], b[0], b[1], p[0], p[1]); }
    else if (c[0] === 'Z') ctx.closePath();
  }
}

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

// глаз: веки, радужка, зрачок, блик. side −1 левый (на экране), +1 правый
function drawEye(ctx, r, xf, spec, side) {
  const E = spec.eye;
  const cx0 = side * E.dx, cy0 = E.y;
  const [cx, cy] = xf(cx0, cy0, 0.7);
  // дальний глаз при повороте сужается
  const w = E.w * (1 - side * r.ax * 0.22) * (1 - Math.abs(r.ax) * 0.05);
  const hOpen = E.h * clamp(r.open, 0, 1.4);
  const smileLift = r.smile * E.h * 0.55;
  const tilt = E.tilt || 0;
  const inner = cx - side * w * 0.5, outer = cx + side * w * 0.5;
  const innerY = cy + tilt * 0.5, outerY = cy - tilt * 0.5;
  // тень глазницы
  const sg = ctx.createRadialGradient(cx, cy - E.h * 0.4, 1, cx, cy - E.h * 0.2, w * 0.95);
  sg.addColorStop(0, rgba(spec.skinShadow, 0.55)); sg.addColorStop(1, rgba(spec.skinShadow, 0));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy - E.h * 0.25, w * 0.95, E.h * 1.7, 0, 0, Math.PI * 2); ctx.fill();

  const topY = cy - hOpen * 1.05, botY = cy + E.h * 0.62 - smileLift;
  if (hOpen > E.h * 0.12) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inner, innerY);
    ctx.quadraticCurveTo(cx - side * w * 0.05, topY, outer, outerY);
    ctx.quadraticCurveTo(cx + side * w * 0.1, botY, inner, innerY);
    ctx.closePath();
    ctx.fillStyle = spec.sclera || '#e9e1d6'; ctx.fill();
    ctx.clip();
    // радужка
    const ix = cx + r.lookX * w * 0.22 + r.ax * 2, iy = cy + r.lookY * E.h * 0.35 - E.h * 0.05;
    const ir = E.iris;
    const ig = ctx.createRadialGradient(ix - ir * 0.3, iy - ir * 0.3, 1, ix, iy, ir);
    ig.addColorStop(0, shade(E.color, 0.35)); ig.addColorStop(0.7, E.color); ig.addColorStop(1, shade(E.color, -0.55));
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0907'; ctx.beginPath(); ctx.arc(ix, iy, ir * (spec.pupil || 0.42), 0, Math.PI * 2); ctx.fill();
    // тень от верхнего века
    const lg = ctx.createLinearGradient(0, topY, 0, topY + E.h * 0.9);
    lg.addColorStop(0, 'rgba(40,20,10,0.55)'); lg.addColorStop(1, 'rgba(40,20,10,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - w, topY - 2, w * 2, E.h * 1.2);
    // блик — от ключевого света слева сверху
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // линия верхнего века и ресницы
    ctx.strokeStyle = spec.lash || '#1f140f'; ctx.lineCap = 'round';
    ctx.lineWidth = E.lash || 2.6;
    ctx.beginPath(); ctx.moveTo(inner, innerY); ctx.quadraticCurveTo(cx - side * w * 0.05, topY, outer, outerY);
    if (E.flick) ctx.lineTo(outer + side * E.flick, outerY - E.flick * 0.6);
    ctx.stroke();
    // складка века
    ctx.strokeStyle = rgba(spec.skinShadow, 0.7); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(inner + side * w * 0.12, innerY - E.h * 0.55); ctx.quadraticCurveTo(cx, topY - E.h * 0.55, outer - side * w * 0.05, outerY - E.h * 0.35); ctx.stroke();
    // нижнее веко
    ctx.strokeStyle = rgba(spec.skinShadow, 0.55); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(inner + side * w * 0.1, innerY + 1); ctx.quadraticCurveTo(cx + side * w * 0.1, botY + 1.5, outer, outerY + 1); ctx.stroke();
  } else {
    // закрытый глаз: веко дугой вниз
    ctx.strokeStyle = spec.lash || '#1f140f'; ctx.lineWidth = E.lash || 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(inner, innerY); ctx.quadraticCurveTo(cx, cy + E.h * 0.45 - smileLift * 0.6, outer, outerY); ctx.stroke();
  }
  if (E.bags) {
    ctx.strokeStyle = rgba(spec.skinShadow, 0.35); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - side * w * 0.3, cy + E.h * 1.1); ctx.quadraticCurveTo(cx, cy + E.h * 1.5, cx + side * w * 0.45, cy + E.h * 0.95); ctx.stroke();
  }
}

function drawBrow(ctx, r, xf, spec, side) {
  const B = spec.brow;
  const lift = r.brow * B.lift + (side > 0 ? r.asym * 5 : -r.asym * 1);
  const ang = r.browAng;
  const inX = side * B.inner, outX = side * B.outer;
  const inY = B.y - lift - ang * B.tilt, outY = B.y - lift * 0.7 + ang * B.tilt * 0.35 + (B.arch || 0) * 0.2;
  const midX = side * (B.inner + B.outer) * 0.5, midY = Math.min(inY, outY) - (B.arch || 6) - lift * 0.2;
  const a = xf(inX, inY, 0.72), m = xf(midX, midY, 0.72), o = xf(outX, outY, 0.72);
  const a2 = xf(inX, inY + B.th, 0.72), m2 = xf(midX, midY + B.th * 0.8, 0.72), o2 = xf(outX, outY + B.th * 0.25, 0.72);
  ctx.fillStyle = B.color;
  ctx.beginPath();
  ctx.moveTo(a2[0], a2[1]); ctx.lineTo(a[0], a[1]);
  ctx.quadraticCurveTo(m[0], m[1], o[0], o[1]);
  ctx.quadraticCurveTo(m2[0], m2[1], a2[0], a2[1]);
  ctx.closePath(); ctx.fill();
  // морщина между бровей при злости
  if (side > 0 && ang < -0.3) {
    ctx.strokeStyle = rgba(spec.skinShadow, (-ang - 0.3) * 0.9); ctx.lineWidth = 1.4;
    const p = xf(-3, B.y + 4, 0.75), q = xf(-1, B.y + 14, 0.75), p2 = xf(4, B.y + 4, 0.75), q2 = xf(2, B.y + 14, 0.75);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.moveTo(p2[0], p2[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
  }
  // морщины на лбу при удивлении
  if (side > 0 && r.brow > 0.5 && spec.foreheadLines) {
    ctx.strokeStyle = rgba(spec.skinShadow, (r.brow - 0.5) * 0.7); ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const p = xf(-26, B.y - 22 - k * 8, 0.5), q = xf(0, B.y - 26 - k * 8, 0.5), s = xf(26, B.y - 22 - k * 8, 0.5); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(q[0], q[1], s[0], s[1]); ctx.stroke(); }
  }
}

function drawNose(ctx, r, xf, spec) {
  const N = spec.nose;
  // тень переносицы со стороны тени (справа)
  const top = xf(N.bridgeX || 4, spec.brow.y + 10, 0.9), tip = xf(N.w * 0.3, N.y - 6, 1), bot = xf(N.w * 0.9, N.y, 1);
  const g = ctx.createLinearGradient(top[0], 0, top[0] + 14, 0);
  g.addColorStop(0, rgba(spec.skinShadow, 0)); g.addColorStop(1, rgba(spec.skinShadow, 0.5));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(top[0] + 10, (top[1] + tip[1]) / 2, bot[0] + 3, bot[1] - 2); ctx.lineTo(tip[0] - 2, tip[1]); ctx.closePath(); ctx.fill();
  // кончик и крылья носа
  const c = xf(0, N.y, 1);
  ctx.fillStyle = rgba(spec.skinLight, 0.35); ctx.beginPath(); ctx.ellipse(c[0] - N.w * 0.25, c[1] - 7, N.w * 0.35, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(spec.skinShadow, 0.85); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  const l1 = xf(-N.w, N.y - 4, 0.95), l2 = xf(-N.w * 0.4, N.y + 2, 1), l3 = xf(N.w * 0.4, N.y + 2, 1), l4 = xf(N.w, N.y - 4, 0.95);
  ctx.beginPath(); ctx.moveTo(l1[0], l1[1]); ctx.quadraticCurveTo(l1[0] - 1, l2[1], l2[0], l2[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l4[0], l4[1]); ctx.quadraticCurveTo(l4[0] + 1, l3[1], l3[0], l3[1]); ctx.stroke();
  // тень под носом
  ctx.fillStyle = rgba(spec.skinShadow, 0.45);
  ctx.beginPath(); ctx.ellipse(c[0] + 2, c[1] + 5, N.w * 0.7, 3, 0, 0, Math.PI * 2); ctx.fill();
}

function drawMouth(ctx, r, xf, spec) {
  const M = spec.mouth;
  const [cx, cy] = xf(0, M.y, 0.85);
  const w = M.w * (1 + r.mWide * 0.22 - r.mRound * 0.38 + r.form * 0.08);
  const open = r.mOpen * M.open;
  const cornerUp = r.form * 5;
  const asym = r.asym * 4;
  const lx = cx - w / 2, rx = cx + w / 2;
  const ly = cy - cornerUp + asym * 0.2, ry = cy - cornerUp - asym;
  const upY = cy - 2 - open * 0.25, loY = cy + open;
  // внутренняя часть
  if (open > 1.2) {
    ctx.fillStyle = '#2a0e0c';
    ctx.beginPath(); ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(cx, upY - 1, rx, ry);
    ctx.quadraticCurveTo(cx, loY + open * 0.3, lx, ly);
    ctx.fill();
    ctx.save(); ctx.clip();
    if (r.mTeeth > 0.1 || open > 5) {
      ctx.fillStyle = '#ddd3c2';
      ctx.fillRect(cx - w * 0.38, upY - 2, w * 0.76, 3 + r.mTeeth * 3);
    }
    ctx.fillStyle = '#8a3a36'; ctx.beginPath(); ctx.ellipse(cx, loY + open * 0.25, w * 0.28, open * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // губы
  const lip = M.lip;
  ctx.fillStyle = lip;
  // верхняя
  ctx.beginPath(); ctx.moveTo(lx - 1, ly);
  ctx.quadraticCurveTo(cx - w * 0.25, upY - M.upper - 1, cx, upY - M.upper * 0.6);
  ctx.quadraticCurveTo(cx + w * 0.25, upY - M.upper - 1, rx + 1, ry);
  ctx.quadraticCurveTo(cx, upY + 1.5, lx - 1, ly);
  ctx.fill();
  // нижняя
  const lo = loY + (r.mFV > 0.3 ? -open * 0.6 - 2 : 0);
  ctx.fillStyle = shade(lip, 0.08);
  ctx.beginPath(); ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(cx, lo - 0.5, rx, ry);
  ctx.quadraticCurveTo(cx, lo + M.lower + open * 0.08, lx, ly);
  ctx.fill();
  // блик на нижней губе и тень под ней
  ctx.fillStyle = 'rgba(255,230,215,0.25)'; ctx.beginPath(); ctx.ellipse(cx - w * 0.12, lo + M.lower * 0.45, w * 0.14, 1.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(spec.skinShadow, 0.35); ctx.beginPath(); ctx.ellipse(cx + 2, lo + M.lower + 5, w * 0.3, 3, 0, 0, Math.PI * 2); ctx.fill();
  // линия смыкания
  ctx.strokeStyle = 'rgba(40,14,10,0.75)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(cx, (open > 1.2 ? upY : cy) + 0.5, rx, ry); ctx.stroke();
  // ямочки в уголках при улыбке/злости
  ctx.strokeStyle = rgba(spec.skinShadow, Math.min(0.7, Math.abs(r.form) * 0.6 + 0.1)); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(lx - 2, ly - 3 * Math.sign(r.form || 1)); ctx.quadraticCurveTo(lx - 5, ly, lx - 2, ly + 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx + 2, ry - 3 * Math.sign(r.form || 1)); ctx.quadraticCurveTo(rx + 5, ry, rx + 2, ry + 4); ctx.stroke();
}

// голова целиком: форма, свет, черты лица. Хуки spec: hairBack, ears, beard, marks, hairFront, over
function drawHead(ctx, r, spec) {
  const xf = faceXf(r, spec);
  if (spec.hairBack) spec.hairBack(ctx, r, xf, spec);
  // уши
  if (spec.ears !== false) {
    for (const side of [-1, 1]) {
      const [ex, ey] = xf(side * spec.head.w * 0.98, spec.eye.y + 12, -0.5);
      ctx.fillStyle = shade(spec.skin, -0.12);
      ctx.beginPath(); ctx.ellipse(ex, ey, 9, 17, side * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(spec.skinShadow, 0.5); ctx.beginPath(); ctx.ellipse(ex - side * 1, ey + 1, 4.5, 10, side * 0.2, 0, Math.PI * 2); ctx.fill();
      if (spec.earring && side > 0) {
        ctx.strokeStyle = spec.earring; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(ex + r.hair * 4, ey + 19, 4.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  // форма головы: лоб, скулы, челюсть, подбородок
  const Hd = spec.head;
  const shape = [
    ['M', 0, -Hd.top],
    ['C', Hd.w * 0.75, -Hd.top, Hd.w * 1.02, -Hd.top * 0.55, Hd.w, 0],
    ['C', Hd.w * 1.0, Hd.cheekY * 0.6, Hd.cheek * 1.02, Hd.cheekY, Hd.jaw, Hd.jawY],
    ['C', Hd.jaw * 0.7, Hd.chinY - 4, Hd.chinW, Hd.chinY + 2, 0, Hd.chinY + 3],
    ['C', -Hd.chinW, Hd.chinY + 2, -Hd.jaw * 0.7, Hd.chinY - 4, -Hd.jaw, Hd.jawY],
    ['C', -Hd.cheek * 1.02, Hd.cheekY, -Hd.w * 1.0, Hd.cheekY * 0.6, -Hd.w, 0],
    ['C', -Hd.w * 1.02, -Hd.top * 0.55, -Hd.w * 0.75, -Hd.top, 0, -Hd.top],
    ['Z']
  ];
  pathCmds(ctx, shape, xf, 0.15);
  const c0 = xf(-Hd.w * 0.45, -Hd.top * 0.35, 0.3);
  const sk = ctx.createRadialGradient(c0[0], c0[1], 6, c0[0] + 20, c0[1] + 30, Hd.w * 2.3);
  sk.addColorStop(0, spec.skinLight); sk.addColorStop(0.45, spec.skin); sk.addColorStop(1, spec.skinShadow);
  ctx.fillStyle = sk; ctx.fill();
  ctx.save(); ctx.clip();
  // теневая сторона (ключевой свет слева) и треугольник Рембрандта на щеке
  const sh = xf(Hd.w * 0.55, 10, 0.35);
  const sg = ctx.createLinearGradient(sh[0] - 30, 0, sh[0] + 40, 0);
  sg.addColorStop(0, rgba(spec.skinShadow, 0)); sg.addColorStop(1, rgba(spec.skinShadow, 0.75));
  ctx.fillStyle = sg; ctx.fillRect(sh[0] - 30, -Hd.top - 20, 120, Hd.chinY + Hd.top + 60);
  const tri = xf(Hd.w * 0.42, spec.eye.y + 24, 0.55);
  ctx.fillStyle = rgba(spec.skinLight, 0.16);
  ctx.beginPath(); ctx.moveTo(tri[0] - 12, tri[1] - 6); ctx.lineTo(tri[0] + 10, tri[1] - 4); ctx.lineTo(tri[0] - 4, tri[1] + 14); ctx.closePath(); ctx.fill();
  // скулы и тень под скулой
  for (const side of [-1, 1]) {
    const ck = xf(side * Hd.cheek * 0.85, Hd.cheekY + 8, 0.45);
    const cg = ctx.createRadialGradient(ck[0], ck[1], 2, ck[0], ck[1], 26);
    cg.addColorStop(0, rgba(spec.skinShadow, side > 0 ? 0.3 : 0.14)); cg.addColorStop(1, rgba(spec.skinShadow, 0));
    ctx.fillStyle = cg; ctx.fillRect(ck[0] - 30, ck[1] - 30, 60, 60);
    if (spec.blush) {
      const bk = xf(side * Hd.cheek * 0.55, spec.eye.y + 26, 0.55);
      const bg = ctx.createRadialGradient(bk[0], bk[1], 1, bk[0], bk[1], 18);
      bg.addColorStop(0, rgba(spec.blush, 0.15)); bg.addColorStop(1, rgba(spec.blush, 0));
      ctx.fillStyle = bg; ctx.fillRect(bk[0] - 20, bk[1] - 20, 40, 40);
    }
  }
  // тень под подбородком
  const ch = xf(0, Hd.chinY + 8, 0.2);
  ctx.fillStyle = rgba(spec.skinShadow, 0.5); ctx.beginPath(); ctx.ellipse(ch[0] + 6, ch[1] + 4, Hd.chinW * 1.3, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (spec.beard) spec.beard(ctx, r, xf, spec);
  ctx.restore();
  // черты лица
  for (const side of [-1, 1]) drawEye(ctx, r, xf, spec, side);
  for (const side of [-1, 1]) drawBrow(ctx, r, xf, spec, side);
  drawNose(ctx, r, xf, spec);
  if (!spec.hideMouth) drawMouth(ctx, r, xf, spec);
  if (spec.marks) spec.marks(ctx, r, xf, spec);
  if (spec.hairFront) spec.hairFront(ctx, r, xf, spec);
  // контровой свет по краю лица с теневой стороны
  if (spec.rim) {
    pathCmds(ctx, shape, xf, 0.15);
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(spec.rim, 0.55); ctx.lineWidth = 5;
    ctx.beginPath();
    const p1 = xf(Hd.w * 0.95, -Hd.top * 0.4, 0.15), p2 = xf(Hd.w * 1.02, 10, 0.15), p3 = xf(Hd.jaw * 1.02, Hd.jawY, 0.15), p4 = xf(Hd.chinW * 0.6, Hd.chinY + 2, 0.15);
    ctx.moveTo(p1[0] + 2, p1[1]); ctx.quadraticCurveTo(p2[0] + 3, p2[1], p3[0] + 1, p3[1]); ctx.quadraticCurveTo(p3[0] - 6, Hd.chinY, p4[0], p4[1]);
    ctx.stroke();
    ctx.restore();
  }
  if (spec.over) spec.over(ctx, r, xf, spec);
  return xf;
}

/* ------------------------------ окружение и тело ------------------------------ */

function portraitParticles(seed, n) {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => ({ x: rng(), y: rng(), s: rng(), p: rng() }));
}

function drawShoulders(ctx, r, o) {
  const b = r.breath;
  const y0 = 262 - b * 3;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.moveTo(-10, PH + 5);
  ctx.bezierCurveTo(0, y0 + 30, 40, y0 - 2 - b, 110, y0 - 8);
  ctx.lineTo(190, y0 - 8);
  ctx.bezierCurveTo(260, y0 - 2 - b, 300, y0 + 30, PW + 10, PH + 5);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - 10, PW, PH);
  g.addColorStop(0, shade(o.color, 0.18)); g.addColorStop(0.55, o.color); g.addColorStop(1, shade(o.color, -0.45));
  ctx.fillStyle = g; ctx.fill();
  return y0;
}

function drawNeck(ctx, r, spec, y0) {
  const nx = r.ax * 5;
  ctx.fillStyle = shade(spec.skin, -0.18);
  ctx.beginPath();
  ctx.moveTo(122 + nx, 200); ctx.lineTo(178 + nx, 200); ctx.lineTo(184, y0 + 4); ctx.quadraticCurveTo(150, y0 + 22, 116, y0 + 4); ctx.closePath(); ctx.fill();
  // тень от головы — только на шее
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 205, 0, 240);
  g.addColorStop(0, rgba(spec.skinShadow, 0.7)); g.addColorStop(1, rgba(spec.skinShadow, 0));
  ctx.fillStyle = g; ctx.fillRect(110, 200, 80, 45);
  ctx.restore();
}

// общий кадр: фон → тело → шея → голова (с наклоном) → эффекты
function renderPortrait(ctx, who, anim) {
  const def = PORTRAIT_DEFS[who];
  const r = anim.rig();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, PW, PH);
  // «наезд» камеры при смене говорящего
  // кадр: лицо крупнее (голова ~45% ширины), при смене говорящего — короткий «наезд»
  const zoom = 1.14 + r.cut * 0.07;
  const fy = 170;
  ctx.setTransform(zoom, 0, 0, zoom, -PW / 2 * (zoom - 1), -fy * (zoom - 1) + r.cut * 6);
  def.bg(ctx, r, anim);
  if (def.special) { def.special(ctx, r, anim); ctx.setTransform(1, 0, 0, 1, 0, 0); return; }
  const y0 = def.body(ctx, r, anim);
  drawNeck(ctx, r, def.face, y0);
  ctx.save();
  // голова: наклон вокруг шеи + дыхание + кивок
  const hx = 150 + r.ax * 6, hy = 138 - r.breath * 2 + r.ay * 5;
  ctx.translate(150, 215); ctx.rotate(r.az * 0.5); ctx.translate(-150, -215);
  ctx.translate(hx, hy);
  drawHead(ctx, r, def.face);
  ctx.restore();
  if (def.front) def.front(ctx, r, anim);
  // эффекты кадра
  if (def.radio) drawRadioFx(ctx, r, anim);
  const v = ctx.createRadialGradient(PW / 2, PH * 0.45, PH * 0.25, PW / 2, PH * 0.5, PH * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, PW, PH);
  if (r.cut > 0) { ctx.fillStyle = `rgba(255,255,255,${r.cut * 0.12})`; ctx.fillRect(0, 0, PW, PH); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// передача по рации: строки развёртки, редкие срывы кадра, огонёк сигнала
function drawRadioFx(ctx, r, anim) {
  const t = r.t;
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  const off = (t * 40) % 4;
  for (let y = off; y < PH; y += 4) ctx.fillRect(0, y, PW, 1.4);
  if (Math.sin(t * 7.3) > 0.985) {
    const y = (t * 997) % PH;
    const img = ctx.getImageData(0, y, PW, 10);
    ctx.putImageData(img, 6, y);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = r.talking && Math.sin(t * 22) > -0.2 ? '#ff4a3a' : '#5a1f1a';
  ctx.beginPath(); ctx.arc(PW - 24, 24, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 20px Oswald, Arial'; ctx.textAlign = 'right';
  ctx.fillText('РАЦИЯ', PW - 40, 31);
  // полоска уровня сигнала
  for (let i = 0; i < 5; i++) {
    const on = anim.pulse * 5 > i;
    ctx.fillStyle = on ? 'rgba(120,255,140,0.9)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(PW - 84 + i * 12, 52 - i * 4, 8, 8 + i * 4);
  }
}

/* ------------------------------ персонажи ------------------------------ */

const PORTRAIT_DEFS = {};

// ---------- Алекс: механик, щетина, красная шапка, рабочая куртка, гараж ----------
PORTRAIT_DEFS.alex = {
  bg(ctx, r, a) {
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#2a2622'); g.addColorStop(1, '#0e0d0c'); ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    // перфопанель с инструментами
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 20; y < 200; y += 16) for (let x = 12; x < PW; x += 16) ctx.fillRect(x, y, 2, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, 40); ctx.lineTo(30, 120); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, 36, 10, 0.3, Math.PI * 2 - 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(262, 50); ctx.lineTo(262, 130); ctx.moveTo(250, 50); ctx.lineTo(274, 50); ctx.stroke();
    // лампа слева сверху, чуть мерцает
    const fl = 0.85 + Math.sin(r.t * 13) * 0.03 + (Math.sin(r.t * 51) > 0.97 ? -0.2 : 0);
    const lg = ctx.createRadialGradient(40, -20, 5, 40, -20, 260);
    lg.addColorStop(0, `rgba(255,190,110,${0.45 * fl})`); lg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, PW, PH);
    // пыль в луче
    for (const p of a.dust || (a.dust = portraitParticles(11, 18))) {
      const x = (p.x * PW + r.t * (4 + p.s * 6)) % PW, y = (p.y * 220 + Math.sin(r.t * 0.5 + p.p * 6) * 10);
      ctx.fillStyle = `rgba(255,220,170,${0.15 + p.s * 0.2})`; ctx.fillRect(x, y, 2, 2);
    }
  },
  body(ctx, r) {
    const y0 = drawShoulders(ctx, r, { color: '#3b4a5c' });
    // воротник-стойка, молния, светоотражающая полоса
    ctx.fillStyle = '#2c3846';
    ctx.beginPath(); ctx.moveTo(106, y0 - 6); ctx.lineTo(150, y0 + 30); ctx.lineTo(194, y0 - 6); ctx.lineTo(188, y0 - 26); ctx.lineTo(150, y0 + 6); ctx.lineTo(112, y0 - 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9ccd0'; ctx.fillRect(148, y0 + 28, 4, PH - y0);
    ctx.fillStyle = '#e8883a'; ctx.fillRect(18, y0 + 58, 90, 10); ctx.fillRect(192, y0 + 58, 90, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(18, y0 + 59, 90, 2); ctx.fillRect(192, y0 + 59, 90, 2);
    ctx.fillStyle = 'rgba(20,16,12,0.5)'; ctx.beginPath(); ctx.ellipse(230, y0 + 40, 16, 9, 0.4, 0, Math.PI * 2); ctx.fill();   // пятно масла
    return y0;
  },
  face: {
    skin: '#d6a07a', skinLight: '#f0c29c', skinShadow: '#7a4a32', rim: '#6fa0d8',
    head: { w: 58, top: 78, cheek: 56, cheekY: 38, jaw: 46, jawY: 70, chinW: 22, chinY: 92 },
    eye: { dx: 25, y: 4, w: 26, h: 8, iris: 6.8, color: '#6b5436', lash: 2.8, bags: true, tilt: -1 },
    brow: { inner: 8, outer: 38, y: -12, th: 6, lift: 8, tilt: 5, arch: 4, color: '#2b1d15' },
    nose: { y: 40, w: 10 },
    mouth: { y: 60, w: 30, open: 13, upper: 3, lower: 4, lip: '#a8645a' },
    foreheadLines: true,
    beard(ctx, r, xf, s) {
      // щетина: тёмная зона челюсти с «зерном»
      const c = xf(0, 70, 0.6);
      const g = ctx.createRadialGradient(c[0], c[1] + 4, 10, c[0], c[1], 60);
      g.addColorStop(0, 'rgba(50,36,26,0.38)'); g.addColorStop(1, 'rgba(50,36,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c[0], c[1] + 10, 56, 42, 0, 0, Math.PI * 2); ctx.fill();
      const rng = mulberry32(5);
      ctx.fillStyle = 'rgba(30,20,14,0.22)';
      for (let i = 0; i < 260; i++) {
        const a = rng() * Math.PI, rr = 26 + rng() * 28;
        const p = xf(Math.cos(a) * rr * 1.05, 60 + Math.sin(a) * rr * 0.7, 0.6);
        ctx.fillRect(p[0], p[1], 0.9, 0.9);
      }
    },
    marks(ctx, r, xf, s) {
      // шрам на щеке и мазок мазута
      const a = xf(34, 14, 0.5), b = xf(42, 34, 0.5);
      ctx.strokeStyle = 'rgba(150,80,60,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,190,160,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0] - 1, a[1]); ctx.lineTo(b[0] - 1, b[1]); ctx.stroke();
      const m = xf(-40, 28, 0.45);
      const mg = ctx.createRadialGradient(m[0], m[1], 1, m[0], m[1], 10);
      mg.addColorStop(0, 'rgba(30,24,20,0.16)'); mg.addColorStop(1, 'rgba(30,24,20,0)');
      ctx.fillStyle = mg; ctx.fillRect(m[0] - 12, m[1] - 12, 24, 24);
    },
    hairBack(ctx, r, xf) {
      const p = xf(0, -20, -0.3);
      ctx.fillStyle = '#231710'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 64, 70, 0, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
    },
    hairFront(ctx, r, xf) {
      // вихры из-под шапки и шапка с отворотом
      ctx.fillStyle = '#2b1d15';
      for (let i = 0; i < 7; i++) {
        const x = -48 + i * 15, sway = r.hair * 3 * (i / 6);
        const a = xf(x, -40, 0.3), b = xf(x + 8 + sway, -22 - (i % 2) * 6, 0.35), c = xf(x + 14, -40, 0.3);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0] - 4, b[1] - 8, b[0], b[1]); ctx.quadraticCurveTo(b[0] + 2, b[1] - 10, c[0], c[1]); ctx.fill();
      }
      const cap = [['M', -64, -38], ['C', -66, -96, -30, -118, 4, -118], ['C', 40, -118, 70, -96, 66, -38], ['Z']];
      pathCmds(ctx, cap, xf, 0.12);
      const g = ctx.createLinearGradient(-60, -120, 70, -30);
      g.addColorStop(0, '#d0503c'); g.addColorStop(0.5, '#b53a2c'); g.addColorStop(1, '#6e1e16');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
      for (let x = -48; x <= 52; x += 10) { const a = xf(x, -44, 0.12), b = xf(x * 0.7, -108, 0.12); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      const fold = [['M', -68, -34], ['Q', 0, -48, 70, -34], ['L', 68, -56], ['Q', 0, -70, -66, -56], ['Z']];
      pathCmds(ctx, fold, xf, 0.2);
      ctx.fillStyle = '#9c3226'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
      for (let x = -60; x <= 62; x += 8) { const a = xf(x, -38 - Math.abs(x) * 0.02, 0.2), b = xf(x, -58 - Math.abs(x) * 0.02, 0.2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
  }
};

// ---------- Мира: чёрные волосы, красная повязка, очки-гоглы, веснушки, закат пустыни ----------
PORTRAIT_DEFS.mira = {
  bg(ctx, r, a) {
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#3a2440'); g.addColorStop(0.5, '#c2593a'); g.addColorStop(1, '#f0a260');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = 'rgba(255,220,150,0.55)'; ctx.beginPath(); ctx.arc(70, 250, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a2a2a'; ctx.beginPath(); ctx.moveTo(0, 260); ctx.lineTo(60, 230); ctx.lineTo(120, 250); ctx.lineTo(200, 220); ctx.lineTo(PW, 250); ctx.lineTo(PW, PH); ctx.lineTo(0, PH); ctx.fill();
    // ветер несёт пыль
    for (const p of a.dust || (a.dust = portraitParticles(23, 30))) {
      const x = (p.x * PW * 1.4 + r.t * (60 + p.s * 80)) % (PW * 1.4) - 20, y = p.y * PH;
      ctx.strokeStyle = `rgba(255,210,160,${0.12 + p.s * 0.2})`; ctx.lineWidth = 1 + p.s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10 - p.s * 14, y + 2); ctx.stroke();
    }
  },
  body(ctx, r) {
    const y0 = drawShoulders(ctx, r, { color: '#6a3528' });
    // шарф
    ctx.fillStyle = '#c9a36a';
    ctx.beginPath(); ctx.moveTo(100, y0 - 12); ctx.quadraticCurveTo(150, y0 + 30, 200, y0 - 12); ctx.quadraticCurveTo(205, y0 + 20, 170, y0 + 42); ctx.quadraticCurveTo(150, y0 + 50, 130, y0 + 42); ctx.quadraticCurveTo(95, y0 + 20, 100, y0 - 12); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(110 + i * 8, y0 + i * 6); ctx.quadraticCurveTo(150, y0 + 26 + i * 5, 190 - i * 8, y0 + i * 6); ctx.stroke(); }
    // кожаная куртка: швы и заклёпки
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, PH); ctx.quadraticCurveTo(80, y0 + 40, 110, y0 + 20); ctx.moveTo(240, PH); ctx.quadraticCurveTo(220, y0 + 40, 190, y0 + 20); ctx.stroke();
    ctx.fillStyle = '#c8c0b0'; for (const x of [70, 230]) { ctx.beginPath(); ctx.arc(x, y0 + 70, 3, 0, Math.PI * 2); ctx.fill(); }
    return y0;
  },
  face: {
    skin: '#e6b594', skinLight: '#fbd6b8', skinShadow: '#8a5040', rim: '#ffb070', blush: '#d06a5a', earring: '#dcdcdc',
    head: { w: 54, top: 76, cheek: 50, cheekY: 36, jaw: 38, jawY: 70, chinW: 16, chinY: 88 },
    eye: { dx: 23, y: 6, w: 27, h: 9.5, iris: 7.4, color: '#4e8a4a', lash: 3.2, flick: 5, tilt: -2 },
    brow: { inner: 8, outer: 36, y: -10, th: 4.2, lift: 9, tilt: 5, arch: 7, color: '#151010' },
    nose: { y: 38, w: 8 },
    mouth: { y: 57, w: 26, open: 12, upper: 3.2, lower: 4.6, lip: '#b8605c' },
    marks(ctx, r, xf) {
      // веснушки и грязь на скуле
      const rng = mulberry32(8);
      ctx.fillStyle = 'rgba(150,90,60,0.32)';
      for (let i = 0; i < 22; i++) { const side = i % 2 ? 1 : -1; const p = xf(side * (8 + rng() * 22), 20 + rng() * 10, 0.7); ctx.beginPath(); ctx.arc(p[0], p[1], 0.7 + rng() * 0.6, 0, Math.PI * 2); ctx.fill(); }


    },
    hairBack(ctx, r, xf) {
      const sw = r.hair * 8;
      ctx.fillStyle = '#131012';
      ctx.beginPath();
      const a = xf(-66, -40, -0.3), b = xf(-72 + sw, 60, -0.35), c = xf(-60 + sw, 110, -0.35), d = xf(60 + sw, 110, -0.35), e = xf(72 + sw, 60, -0.35), f = xf(66, -40, -0.3), top = xf(0, -96, -0.2);
      ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0] - 6, b[1], c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.quadraticCurveTo(e[0] + 6, e[1], f[0], f[1]); ctx.quadraticCurveTo(top[0] + 60, top[1], top[0], top[1]); ctx.quadraticCurveTo(top[0] - 60, top[1], a[0], a[1]);
      ctx.fill();
    },
    hairFront(ctx, r, xf) {
      const sw = r.hair * 5;
      // рваная чёлка
      ctx.fillStyle = '#18141a';
      const top = [['M', -62, -24], ['C', -68, -92, -20, -106, 8, -102], ['C', 48, -98, 72, -78, 64, -20],
        ['Q', 56, -34, 50, -30], ['Q', 46, -44, 34, -46], ['Q', 30, -30, 18, -22], ['Q', 12, -40, -2, -44], ['Q', -10, -30, -24, -18],
        ['Q', -26, -36, -38, -40], ['Q', -46, -30, -62, -24], ['Z']];
      pathCmds(ctx, top, xf, 0.25);
      ctx.fill();
      // пряди по бокам лица
      for (const side of [-1, 1]) {
        const a = xf(side * 58, -30, 0.1), b = xf(side * 64 + sw, 40, 0.1), c = xf(side * 56 + sw * 1.4, 84, 0.1), d = xf(side * 44, 0, 0.2);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.quadraticCurveTo(b[0] - side * 12, b[1], d[0], d[1]); ctx.fill();
      }
      // блики на волосах
      ctx.strokeStyle = 'rgba(160,150,190,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = xf(-40 + i * 16, -88, 0.25), b = xf(-34 + i * 16, -62, 0.25); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + 6, (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke(); }
      // красная повязка
      const band = [['M', -66, -54], ['Q', 0, -76, 66, -54], ['L', 64, -42], ['Q', 0, -62, -64, -42], ['Z']];
      pathCmds(ctx, band, xf, 0.2); ctx.fillStyle = '#b8302a'; ctx.fill();
      // хвостики повязки развеваются
      const k = xf(-62, -50, -0.2);
      ctx.fillStyle = '#9c2620';
      ctx.beginPath(); ctx.moveTo(k[0], k[1]); ctx.quadraticCurveTo(k[0] - 20 - sw * 2, k[1] + 10, k[0] - 34 - sw * 3, k[1] + 30 + Math.sin(r.t * 4) * 4); ctx.lineTo(k[0] - 26 - sw * 3, k[1] + 34); ctx.quadraticCurveTo(k[0] - 12, k[1] + 16, k[0] + 2, k[1] + 8); ctx.fill();
      // гоглы на лбу
      for (const side of [-1, 1]) {
        const g = xf(side * 24, -76, 0.3);
        ctx.fillStyle = '#3a3634'; ctx.beginPath(); ctx.ellipse(g[0], g[1], 20, 14, 0, 0, Math.PI * 2); ctx.fill();
        const lg = ctx.createLinearGradient(g[0] - 14, g[1] - 10, g[0] + 14, g[1] + 10);
        lg.addColorStop(0, '#f8c890'); lg.addColorStop(0.4, '#6a88a8'); lg.addColorStop(1, '#223040');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(g[0], g[1], 14, 9.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(g[0] - 5, g[1] - 4, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
      }
      const m = xf(0, -76, 0.3); ctx.fillStyle = '#3a3634'; ctx.fillRect(m[0] - 6, m[1] - 3, 12, 6);
    }
  }
};

// ---------- Дед Семён: седые усы, очки, наушники с микрофоном, радиорубка ----------
PORTRAIT_DEFS.semyon = {
  radio: true,
  bg(ctx, r, a) {
    ctx.fillStyle = '#1a1d1c'; ctx.fillRect(0, 0, PW, PH);
    // полки с аппаратурой
    for (const [x, y, w, h] of [[8, 30, 90, 50], [8, 90, 70, 44], [214, 26, 80, 56], [226, 92, 70, 40]]) {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#4a4c46'); g.addColorStop(1, '#2a2b28');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#111'; ctx.fillRect(x + 6, y + 8, w * 0.45, h * 0.4);
      ctx.fillStyle = `rgba(255,170,60,${0.5 + Math.sin(r.t * 3 + x) * 0.2})`; ctx.fillRect(x + 8, y + 10, w * 0.4, h * 0.3);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(x + w * 0.62 + k * 10, y + h * 0.35, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // стрелочный индикатор — пляшет, когда он говорит
    const nx = 36, ny = 76;
    const ang = -2.4 + 0.2 + a.pulse * 1.2 + Math.sin(r.t * 30) * 0.05 * a.pulse;
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(ang) * 18, ny + Math.sin(ang) * 18); ctx.stroke();
    // тёплая лампа
    const lg = ctx.createRadialGradient(60, 40, 5, 60, 40, 280);
    lg.addColorStop(0, 'rgba(255,170,80,0.35)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, PW, PH);
  },
  body(ctx, r) {
    const y0 = drawShoulders(ctx, r, { color: '#5b5a3c' });
    // вязаный узор свитера
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (let y = y0 + 20; y < PH; y += 14) { ctx.beginPath(); for (let x = 0; x <= PW; x += 10) ctx.lineTo(x, y + ((x / 10) % 2 ? 5 : 0)); ctx.stroke(); }
    ctx.fillStyle = '#7a3a2a'; ctx.fillRect(0, y0 + 50, PW, 8);
    // провод гарнитуры
    ctx.strokeStyle = '#161616'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(88, 180); ctx.bezierCurveTo(70 + r.hair * 10, 240, 100, 280, 80, PH); ctx.stroke();
    return y0;
  },
  face: {
    skin: '#d9a888', skinLight: '#f2cbaa', skinShadow: '#7c5040', rim: '#ffb060',
    head: { w: 60, top: 80, cheek: 57, cheekY: 40, jaw: 48, jawY: 70, chinW: 24, chinY: 90 },
    eye: { dx: 25, y: 6, w: 22, h: 6, iris: 5.2, color: '#5a7086', lash: 2.2, bags: true },
    brow: { inner: 8, outer: 38, y: -12, th: 6.5, lift: 7, tilt: 5, arch: 5, color: '#cfcac0' },
    nose: { y: 42, w: 12 },
    mouth: { y: 64, w: 28, open: 11, upper: 2.5, lower: 3.5, lip: '#a0645a' },
    foreheadLines: true,
    beard(ctx, r, xf, s) {
      // морщины
      ctx.strokeStyle = rgba(s.skinShadow, 0.35); ctx.lineWidth = 1.3;
      for (const side of [-1, 1]) {
        const a = xf(side * 22, 46, 0.7), b = xf(side * 34, 60, 0.6), c = xf(side * 30, 76, 0.6);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
        const e = xf(side * 44, 0, 0.5), f = xf(side * 54, 6, 0.5);
        ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(f[0], f[1]); ctx.moveTo(e[0], e[1] + 5); ctx.lineTo(f[0], f[1] + 8); ctx.stroke();
      }
    },
    marks(ctx, r, xf) {
      // пышные усы шевелятся с губой
      const c = xf(0, 56 + r.mOpen * 2, 0.9);
      ctx.fillStyle = '#e4dfd4';
      ctx.beginPath();
      ctx.moveTo(c[0], c[1] - 8);
      ctx.bezierCurveTo(c[0] + 18, c[1] - 12, c[0] + 34, c[1] - 4, c[0] + 38, c[1] + 12 + r.mOpen * 2);
      ctx.bezierCurveTo(c[0] + 26, c[1] + 6, c[0] + 12, c[1] + 4, c[0], c[1] + 3);
      ctx.bezierCurveTo(c[0] - 12, c[1] + 4, c[0] - 26, c[1] + 6, c[0] - 38, c[1] + 12 + r.mOpen * 2);
      ctx.bezierCurveTo(c[0] - 34, c[1] - 4, c[0] - 18, c[1] - 12, c[0], c[1] - 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,100,0.45)'; ctx.lineWidth = 1.2;
      for (let i = -4; i <= 4; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(c[0] + i * 4, c[1] - 5); ctx.quadraticCurveTo(c[0] + i * 7, c[1] + 2, c[0] + i * 8.5, c[1] + 8); ctx.stroke(); }
      // очки
      ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 2.6;
      for (const side of [-1, 1]) { const g = xf(side * 25, 6, 0.75); ctx.beginPath(); ctx.ellipse(g[0], g[1], 17, 13, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(200,230,255,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g[0] - 5, g[1] - 4, 8, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke(); ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 2.6; }
      const bL = xf(-8, 4, 0.85), bR = xf(8, 4, 0.85); ctx.beginPath(); ctx.moveTo(bL[0], bL[1]); ctx.quadraticCurveTo((bL[0] + bR[0]) / 2, bL[1] - 4, bR[0], bR[1]); ctx.stroke();
    },
    hairBack(ctx, r, xf) {
      ctx.fillStyle = '#bdb8ae';
      for (const side of [-1, 1]) { const p = xf(side * 56, -8, -0.3); ctx.beginPath(); ctx.ellipse(p[0], p[1], 16, 34, side * 0.2, 0, Math.PI * 2); ctx.fill(); }
    },
    hairFront(ctx, r, xf) {
      // лысина с бликом
      const t = xf(-10, -60, 0.2);
      ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(t[0], t[1], 22, 10, -0.2, 0, Math.PI * 2); ctx.fill();
      // наушники
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      const l = xf(-62, -10, -0.2), rr = xf(62, -10, -0.2), top = xf(0, -104, 0.1);
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.bezierCurveTo(l[0] - 6, top[1], rr[0] + 6, top[1], rr[0], rr[1]); ctx.stroke();
      for (const [p, side] of [[l, -1], [rr, 1]]) {
        const g = ctx.createRadialGradient(p[0] - 4, p[1] - 6, 2, p[0], p[1] + 8, 26);
        g.addColorStop(0, '#555'); g.addColorStop(1, '#111'); ctx.fillStyle = g;
        roundRect(ctx, p[0] - 14, p[1] - 4, 28, 40, 10); ctx.fill();
      }
      // микрофон на штанге
      const mic0 = xf(62, 20, -0.2), mic1 = xf(26, 76, 0.9);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mic0[0], mic0[1]); ctx.quadraticCurveTo(mic0[0] + 4, mic1[1], mic1[0], mic1[1]); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(mic1[0], mic1[1], 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
};

// ---------- Капитан Вальц: фуражка, китель с погонами, мостик в дождь ----------
PORTRAIT_DEFS.valtz = {
  radio: true,
  bg(ctx, r, a) {
    ctx.fillStyle = '#0d141b'; ctx.fillRect(0, 0, PW, PH);
    // окно мостика: ночное море, дождь, редкие молнии
    const flash = Math.sin(r.t * 0.7 + 1) > 0.995 ? 0.6 : 0;
    const sky = ctx.createLinearGradient(0, 20, 0, 210);
    sky.addColorStop(0, `rgb(${22 + flash * 150},${32 + flash * 150},${44 + flash * 160})`); sky.addColorStop(1, '#101a22');
    ctx.fillStyle = sky; ctx.fillRect(14, 20, PW - 28, 190);
    ctx.fillStyle = '#0a1016'; ctx.fillRect(14, 150 + Math.sin(r.t * 0.8) * 4, PW - 28, 60);
    ctx.strokeStyle = 'rgba(160,190,210,0.35)'; ctx.lineWidth = 1;
    for (const p of a.rain || (a.rain = portraitParticles(31, 40))) {
      const y = (p.y * 190 + r.t * (140 + p.s * 90)) % 190 + 20, x = 14 + p.x * (PW - 28) - ((r.t * 30) % 20);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10 + p.s * 8); ctx.stroke();
    }
    // рама окна и огни пульта
    ctx.strokeStyle = '#1e2830'; ctx.lineWidth = 12; ctx.strokeRect(14, 20, PW - 28, 190);
    ctx.beginPath(); ctx.moveTo(150, 20); ctx.lineTo(150, 210); ctx.stroke();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 3 ? `rgba(255,70,50,${0.5 + Math.sin(r.t * 2 + i) * 0.3})` : `rgba(80,255,140,${0.6})`; ctx.fillRect(20 + i * 34, 232, 10, 5); }
  },
  body(ctx, r) {
    const y0 = drawShoulders(ctx, r, { color: '#1b2a3d' });
    // белый воротник, галстук, погоны с золотом
    ctx.fillStyle = '#e8e6e0'; ctx.beginPath(); ctx.moveTo(122, y0 - 12); ctx.lineTo(150, y0 + 24); ctx.lineTo(178, y0 - 12); ctx.lineTo(170, y0 + 30); ctx.lineTo(130, y0 + 30); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(144, y0 + 10); ctx.lineTo(156, y0 + 10); ctx.lineTo(160, y0 + 80); ctx.lineTo(150, y0 + 92); ctx.lineTo(140, y0 + 80); ctx.fill();
    ctx.fillStyle = '#16233a'; ctx.beginPath(); ctx.moveTo(100, y0 - 4); ctx.lineTo(150, y0 + 70); ctx.lineTo(130, PH); ctx.lineTo(80, PH); ctx.fill(); ctx.beginPath(); ctx.moveTo(200, y0 - 4); ctx.lineTo(150, y0 + 70); ctx.lineTo(170, PH); ctx.lineTo(220, PH); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(150 + side * 88, y0 + 10); ctx.rotate(side * 0.28);
      ctx.fillStyle = '#0f1a2a'; roundRect(ctx, -34, -8, 68, 18, 5); ctx.fill();
      ctx.fillStyle = '#d4af37'; for (let k = 0; k < 3; k++) ctx.fillRect(-26 + k * 4, -6, 2.5, 14);
      ctx.fillRect(-30, -8, 60, 2.5);
      ctx.restore();
    }
    ctx.fillStyle = '#d4af37'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(126, y0 + 60 + k * 30, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(174, y0 + 60 + k * 30, 3.5, 0, Math.PI * 2); ctx.fill(); }
    return y0;
  },
  face: {
    skin: '#e2b69a', skinLight: '#f8d6bd', skinShadow: '#825646', rim: '#7fb0d0',
    head: { w: 54, top: 78, cheek: 53, cheekY: 32, jaw: 40, jawY: 68, chinW: 18, chinY: 90 },
    eye: { dx: 24, y: 6, w: 25, h: 8, iris: 6.4, color: '#5b7a8c', lash: 2.8, flick: 3, tilt: -1.5 },
    brow: { inner: 8, outer: 36, y: -10, th: 4, lift: 8, tilt: 6, arch: 5, color: '#8a7050' },
    nose: { y: 40, w: 8.5 },
    mouth: { y: 60, w: 25, open: 11, upper: 2.4, lower: 3.4, lip: '#b0706a' },
    marks(ctx, r, xf, s) {
      // носогубные складки — строгое лицо
      ctx.strokeStyle = rgba(s.skinShadow, 0.4); ctx.lineWidth = 1.2;
      for (const side of [-1, 1]) { const a = xf(side * 14, 44, 0.8), b = xf(side * 22, 56, 0.75), c = xf(side * 20, 66, 0.7); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke(); }
      // гарнитура: одно ухо и микрофон
      const e = xf(-56, 12, -0.3);
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(e[0], e[1], 9, 12, 0, 0, Math.PI * 2); ctx.fill();
      const m = xf(-26, 64, 0.85);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(e[0], e[1] + 8); ctx.quadraticCurveTo(e[0] + 4, m[1], m[0], m[1]); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(m[0], m[1], 4, 0, Math.PI * 2); ctx.fill();
    },
    hairBack(ctx, r, xf) {
      // пучок и гладко зачёсанные виски
      const p = xf(0, -10, -0.35);
      ctx.fillStyle = '#b89668'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 62, 72, 0, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      const bun = xf(52, 40, -0.6); ctx.beginPath(); ctx.ellipse(bun[0], bun[1], 16, 14, 0, 0, Math.PI * 2); ctx.fill();
    },
    hairFront(ctx, r, xf) {
      ctx.fillStyle = '#c9a676';
      for (const side of [-1, 1]) {
        const a = xf(side * 20, -52, 0.3), b = xf(side * 58, -34, 0.2), c = xf(side * 56, 10, 0.1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.lineTo(c[0] - side * 6, c[1]); ctx.quadraticCurveTo(b[0] - side * 12, b[1] + 6, a[0], a[1] + 8); ctx.fill();
      }
      // выбившаяся прядь
      const s0 = xf(30, -46, 0.3), s1 = xf(44 + r.hair * 6, 10, 0.3);
      ctx.strokeStyle = '#c9a676'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.quadraticCurveTo(s0[0] + 16, (s0[1] + s1[1]) / 2, s1[0], s1[1]); ctx.stroke();
      // фуражка: тулья, околыш, козырёк, кокарда
      const crown = [['M', -76, -62], ['C', -80, -104, -30, -120, 10, -118], ['C', 56, -116, 88, -100, 80, -62], ['Q', 0, -48, -76, -62], ['Z']];
      pathCmds(ctx, crown, xf, 0.15);
      const g = ctx.createLinearGradient(0, -120, 0, -56); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c8ccd0');
      ctx.fillStyle = g; ctx.fill();
      const band = [['M', -66, -66], ['Q', 0, -54, 70, -66], ['L', 70, -48], ['Q', 0, -36, -66, -48], ['Z']];
      pathCmds(ctx, band, xf, 0.2); ctx.fillStyle = '#10161e'; ctx.fill();
      const visor = [['M', -62, -48], ['Q', 0, -34, 66, -48], ['Q', 10, -18, -58, -34], ['Z']];
      pathCmds(ctx, visor, xf, 0.45); ctx.fillStyle = '#07090c'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; const v1 = xf(-40, -38, 0.45), v2 = xf(30, -36, 0.45); ctx.beginPath(); ctx.moveTo(v1[0], v1[1]); ctx.quadraticCurveTo((v1[0] + v2[0]) / 2, v1[1] + 6, v2[0], v2[1]); ctx.stroke();
      const badge = xf(2, -64, 0.3);
      ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.moveTo(badge[0], badge[1] - 12); ctx.lineTo(badge[0] + 10, badge[1]); ctx.lineTo(badge[0], badge[1] + 10); ctx.lineTo(badge[0] - 10, badge[1]); ctx.fill();
      ctx.fillStyle = '#1b2a3d'; ctx.beginPath(); ctx.arc(badge[0], badge[1], 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(badge[0] + side * 12, badge[1] + 2); ctx.quadraticCurveTo(badge[0] + side * 22, badge[1] - 4, badge[0] + side * 30, badge[1] + 4); ctx.stroke(); }
    }
  }
};

// ---------- Ворон: капюшон, перо, бандана-череп, боевая раскраска, огонь ----------
PORTRAIT_DEFS.raven = {
  radio: true,
  bg(ctx, r, a) {
    const fl = 0.8 + Math.sin(r.t * 9) * 0.08 + Math.sin(r.t * 23) * 0.06;
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#120606'); g.addColorStop(0.7, `rgb(${Math.round(90 * fl)},${Math.round(24 * fl)},12)`); g.addColorStop(1, `rgb(${Math.round(180 * fl)},${Math.round(70 * fl)},20)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    // дым и искры
    for (const p of a.embers || (a.embers = portraitParticles(41, 26))) {
      const y = PH - ((p.y * PH + r.t * (30 + p.s * 50)) % PH), x = p.x * PW + Math.sin(r.t * 2 + p.p * 9) * 8;
      ctx.fillStyle = `rgba(255,${150 + p.s * 80},60,${(y / PH) * 0.8})`; ctx.fillRect(x, y, 2 + p.s * 2, 2 + p.s * 2);
    }
    ctx.fillStyle = 'rgba(20,10,10,0.35)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(60 + i * 100 + Math.sin(r.t * 0.3 + i) * 20, 60 + i * 20, 70, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  },
  body(ctx, r) {
    const y0 = drawShoulders(ctx, r, { color: '#1a1a1c' });
    // капюшон спадает на плечи
    ctx.fillStyle = '#141416';
    ctx.beginPath(); ctx.moveTo(70, y0 - 30); ctx.quadraticCurveTo(150, y0 + 30, 230, y0 - 30); ctx.lineTo(250, y0 + 10); ctx.quadraticCurveTo(150, y0 + 60, 50, y0 + 10); ctx.fill();
    // шипы на плече и красная повязка
    ctx.fillStyle = '#9a9a9a';
    for (let i = 0; i < 5; i++) { const x = 22 + i * 16, y = y0 + 26 - i * 5; ctx.beginPath(); ctx.moveTo(x - 5, y + 6); ctx.lineTo(x, y - 8); ctx.lineTo(x + 5, y + 6); ctx.fill(); }
    ctx.fillStyle = '#b8261f'; ctx.fillRect(8, y0 + 60, 50, 18);
    ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(33, y0 + 69, 5, 0, Math.PI * 2); ctx.fill();
    return y0;
  },
  face: {
    skin: '#c9a084', skinLight: '#e6c0a2', skinShadow: '#5e3a2e', rim: '#ff7a30',
    head: { w: 55, top: 78, cheek: 54, cheekY: 32, jaw: 44, jawY: 68, chinW: 20, chinY: 90 },
    eye: { dx: 24, y: 6, w: 25, h: 7.5, iris: 6.2, color: '#b06a1e', lash: 3.2, tilt: -3, bags: true },
    brow: { inner: 7, outer: 37, y: -9, th: 5.5, lift: 7, tilt: 6, arch: 3, color: '#0f0c0c' },
    nose: { y: 40, w: 9.5 },
    mouth: { y: 60, w: 28, open: 12, upper: 3, lower: 4, lip: '#8e5a50' },
    hideMouth: true,
    marks(ctx, r, xf, s) {
      // чёрная раскраска-потёки под глазами
      for (const side of [-1, 1]) {
        const a = xf(side * 18, 14, 0.7), b = xf(side * 30, 14, 0.7), c = xf(side * 26, 44, 0.6);
        ctx.fillStyle = 'rgba(12,10,10,0.8)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill();
      }
      // шрам через бровь и глаз
      const p1 = xf(20, -24, 0.72), p2 = xf(32, 30, 0.6);
      ctx.strokeStyle = 'rgba(170,90,80,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      // бандана с оскалом черепа: нижний край тянется за челюстью
      const jaw = r.mOpen * 9;
      const band = [['M', -62, 20], ['Q', 0, 8, 62, 20], ['C', 60, 60, 44, 96 + jaw, 0, 104 + jaw], ['C', -44, 96 + jaw, -60, 60, -62, 20], ['Z']];
      pathCmds(ctx, band, xf, 0.7);
      const g = ctx.createLinearGradient(-60, 20, 60, 100); g.addColorStop(0, '#222226'); g.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = g; ctx.fill();
      // складки ткани
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = xf(-40 + i * 30, 30, 0.75), b = xf(-30 + i * 30, 80 + jaw * 0.6, 0.75); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + 8, (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke(); }
      // череп: носовая дыра, зубы размыкаются при речи
      const n = xf(0, 38, 0.9); ctx.fillStyle = 'rgba(230,228,220,0.85)';
      ctx.beginPath(); ctx.moveTo(n[0] - 5, n[1] + 8); ctx.lineTo(n[0], n[1] - 2); ctx.lineTo(n[0] + 5, n[1] + 8); ctx.fill();
      for (let i = -2; i <= 2; i++) {
        const u = xf(i * 9, 55, 0.85), l = xf(i * 9, 67 + jaw * 0.8, 0.85);
        roundRect(ctx, u[0] - 3.8, u[1], 7.6, 11 - Math.abs(i), 2); ctx.fill();
        roundRect(ctx, l[0] - 3.8, l[1], 7.6, 10 - Math.abs(i), 2); ctx.fill();
      }
      // скулы и челюсть черепа
      ctx.strokeStyle = 'rgba(230,228,220,0.55)'; ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        const a = xf(side * 30, 30, 0.8), b = xf(side * 34, 60, 0.8), c = xf(side * 24, 84 + jaw * 0.8, 0.8);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
      }
    },
    hairFront(ctx, r, xf) {
      // пряди из-под капюшона
      ctx.fillStyle = '#0c0a0b';
      // чёлка набок и длинные пряди по краям лица
      const fr = [['M', -56, -64], ['C', -20, -84, 30, -80, 58, -60], ['C', 30, -58, 0, -48, -30, -24], ['C', -40, -40, -50, -50, -56, -64], ['Z']];
      pathCmds(ctx, fr, xf, 0.3); ctx.fill();
      for (const [x, len] of [[-50, 60], [-42, 34], [46, 70], [54, 44]]) {
        const sw = r.hair * 6;
        const a = xf(x - 6, -56, 0.25), b = xf(x + sw + (x < 0 ? -2 : 2), -56 + len, 0.25), c = xf(x + 6, -56, 0.25);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] - 3, (a[1] + b[1]) / 2, b[0], b[1]); ctx.quadraticCurveTo(c[0] + 3, (a[1] + b[1]) / 2, c[0], c[1]); ctx.fill();
      }
      // капюшон
      const hood = [['M', -92, 120], ['C', -104, -40, -70, -128, 0, -130], ['C', 70, -128, 104, -40, 92, 120], ['L', 70, 120], ['C', 74, 20, 60, -72, 0, -78], ['C', -60, -72, -74, 20, -70, 120], ['Z']];
      pathCmds(ctx, hood, xf, 0.05);
      const g = ctx.createLinearGradient(-90, -130, 90, 120); g.addColorStop(0, '#2a2a2e'); g.addColorStop(0.5, '#18181b'); g.addColorStop(1, '#070708');
      ctx.fillStyle = g; ctx.fill();
      // тень капюшона на лбу
      const sh = xf(0, -52, 0.3);
      const sg = ctx.createRadialGradient(sh[0], sh[1] - 14, 10, sh[0], sh[1] + 6, 70);
      sg.addColorStop(0, 'rgba(0,0,0,0.65)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], 66, 36, 0, 0, Math.PI * 2); ctx.fill();
      // воронье перо, качается
      const f0 = xf(74, -58, 0.1);
      ctx.save(); ctx.translate(f0[0], f0[1]); ctx.rotate(0.55 + r.hair * 0.6 + Math.sin(r.t * 2.3) * 0.05);
      const fg = ctx.createLinearGradient(0, 0, 0, -90); fg.addColorStop(0, '#08080a'); fg.addColorStop(0.7, '#1c2230'); fg.addColorStop(1, '#3a4a66');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-22, -20, -20, -64, -6, -96); ctx.bezierCurveTo(10, -70, 18, -30, 0, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
      for (let k = 1; k < 7; k++) { ctx.beginPath(); ctx.moveTo(-3, -k * 12); ctx.lineTo(-14 + k * 0.8, -k * 12 + 8); ctx.moveTo(-3, -k * 12); ctx.lineTo(8 - k * 0.6, -k * 12 + 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(140,160,190,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-4, -44, -6, -94); ctx.stroke();
      ctx.restore();
    }
  }
};

// ---------- незнакомый голос: силуэт в помехах ----------
PORTRAIT_DEFS.unknown = {
  radio: true,
  bg(ctx, r) {
    ctx.fillStyle = '#16181a'; ctx.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.22})`; ctx.fillRect(Math.random() * PW, Math.random() * PH, 2, 2); }
  },
  special(ctx, r, a) {
    const b = r.breath;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath(); ctx.ellipse(150 + r.ax * 8, 140 - b * 2, 60, 76, r.az * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, PH); ctx.bezierCurveTo(10, 270, 70, 250 - b * 3, 150, 246 - b * 3); ctx.bezierCurveTo(230, 250 - b * 3, 290, 270, PW + 10, PH); ctx.fill();
    ctx.fillStyle = r.talking && Math.sin(r.t * 12) > 0 ? '#d0d4da' : '#7a8088';
    ctx.font = 'bold 84px Oswald, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 150 + r.ax * 8, 150);
    drawRadioFx(ctx, r, a);
  }
};

// ---------- рация: помехи и осциллограмма ----------
PORTRAIT_DEFS.radio = {
  bg(ctx, r) {
    ctx.fillStyle = '#101211'; ctx.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 1200; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`; ctx.fillRect(Math.random() * PW, Math.random() * PH, 2, 2); }
  },
  special(ctx, r, a) {
    ctx.strokeStyle = 'rgba(120,255,160,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 20; x <= PW - 20; x += 4) {
      const amp = (r.talking ? 40 : 6) * (0.4 + Math.random() * 0.6);
      ctx.lineTo(x, 180 + Math.sin(x * 0.12 + r.t * 20) * amp * Math.sin((x / PW) * Math.PI));
    }
    ctx.stroke();
    drawRadioFx(ctx, r, a);
  }
};

/* ------------------------------ для диалогов ------------------------------ */

// набор аниматоров на сцену: у каждого персонажа своё состояние, лицо «помнит» эмоцию между репликами
class PortraitStage {
  constructor() { this.anims = {}; this.current = null; this.last = performance.now(); }
  get(who) { return this.anims[who] || (this.anims[who] = new PortraitAnimator(who)); }
  say(line) {
    const who = line.name === '???' ? 'unknown' : line.who;
    if (!PORTRAIT_DEFS[who]) { this.current = null; return; }
    const a = this.get(who);
    if (this.current !== who) a.enter();
    this.current = who;
    a.say(line);
  }
  // true, пока персонаж ещё «договаривает»
  get talking() { const a = this.current && this.anims[this.current]; return !!(a && a.talking); }
  draw(ctx) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.current) { ctx.clearRect(0, 0, PW, PH); return; }
    const a = this.anims[this.current];
    a.update(dt);
    renderPortrait(ctx, this.current, a);
  }
}
