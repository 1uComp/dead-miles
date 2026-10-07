'use strict';
/* Анархисты «Стая» Ворона: стрелки с автоматами и их катера.

   Как устроен ИИ (по Game AI Pro 3, гл. 33 «Using Your Combat AI Accuracy…», Game AI Pro Online 2021
   «You had me at AAAAHHH» и «Steering Behaviors for Autonomous Characters» К. Рейнольдса):
   • восприятие: дальность зрения + линия видимости (луч до цели), слух — шум мотора слышно дальше, чем видно;
   • реакция: человек реагирует за 0.2–0.45 с, ещё время — вскинуть автомат; у каждого своя задержка;
   • выбор цели по полезности: вплотную подошедший мертвец важнее машины вдалеке;
   • предупреждение: перед первой очередью стрелок целится, виден лазерный луч — игрок успевает среагировать;
   • «жетон попадания»: попасть по игроку может только один выстрел за интервал, который зависит
     от дистанции и скорости цели; остальные пули ложатся рядом — видно и слышно, но без шквала урона;
   • реакции: прыжок в сторону от несущейся машины, крики, отступление от мертвецов, злость на игрока,
     если он задавил «нейтрального»;
   • катера: преследование со смещением и «прибытие» (плавное торможение у точки рядом с игроком). */

ZOMBIE_TYPES.raider = {
  name: 'Анархист', speed: 2.4, mass: 82, w: 0.5, h: 1.8, hp: 2, reward: 45,
  skin: ['#d6a37c', '#c79471', '#e0b08a', '#b98563'], scale: 1, killMul: 1.1, raider: true
};

const RAIDER_BARKS = {
  spot: ['Вон он!', 'Это Алекс!', 'Огонь!', 'Машина!', 'Вали его!'],
  zombie: ['Мертвяки!', 'Слева!', 'Держи строй!', 'Вот же твари!'],
  reload: ['Перезаряжаю!', 'Прикрой!', 'Пустой!'],
  dodge: ['А-а-а!', 'С дороги!', 'Псих!'],
  neutral: ['Проезжай!', 'Не стреляем!', 'Ворон велел пропустить!'],
  angry: ['Ах ты гад!', 'Он своих давит!', 'Огонь по машине!'],
  bitten: ['Он меня укусил!', 'Уберите его!'],
  // военные (ветка «Стая»)
  mil_spot: ['Стоять!', 'Огонь по машине!', 'Это он, юг!', 'Цель на дороге!'],
  mil_zombie: ['Заражённые!', 'Держать периметр!', 'Слева, заражённые!'],
  mil_reload: ['Перезарядка!', 'Прикройте!'],
  mil_dodge: ['Ложись!', 'В сторону!'],
  mil_bitten: ['Меня укусили!', 'Санитара!'],
  mil_vs: ['Анархисты!', 'Чёрные флаги!', 'Огонь по Стае!'],
  vs: ['Военные!', 'Серые, на час!', 'Бей серых!'],
  ally: ['Жми, механик!', 'Прикроем!', 'За Стаю!']
};

/* ------------------------------ режиссёр боя ------------------------------ */

class CombatDirector {
  constructor(game) {
    this.game = game;
    this.lastHit = -10;
    this.barkT = 0;
    this.announced = false;
  }
  // может ли этот выстрел попасть в игрока — «жетон» выдаётся одному стрелку раз в интервал
  requestHit(shooter, sx, sy) {
    const G = this.game, v = G.vehicle, now = G.world.time;
    if (!v || v.crashed) return false;
    const dist = Math.hypot(v.x - sx, v.y - sy);
    const speed = v.speed();
    let delay = 1.15;
    delay *= clamp(lerp(0.55, 1.5, (dist - 8) / 24), 0.55, 1.5);            // ближе — чаще
    delay *= speed > 24 ? 2.0 : speed > 15 ? 1.45 : speed > 6 ? 1.1 : 0.8;   // по быстрой цели труднее
    // едет на стрелка — прицелиться проще, уходит — сложнее
    const toward = Math.sign(sx - v.x) === Math.sign(v.chassis.vx || 1);
    delay *= toward ? 0.85 : 1.35;
    if (G.renderer && G.renderer.night) delay *= 1.25;
    if (now - this.lastHit < delay) return false;
    this.lastHit = now;
    return true;
  }
  bark(x, y, kind, color, faction) {
    const now = this.game.world.time;
    if (now < this.barkT) return;
    this.barkT = now + 1.4 + Math.random();
    const list = (faction === 'military' && RAIDER_BARKS['mil_' + kind]) || RAIDER_BARKS[kind];
    this.game.particles.text(x, y, list[Math.floor(Math.random() * list.length)], color || '#ff7a5a', 0.75);
  }
}

// общий выстрел для стрелков и катеров
function raiderShoot(G, owner, mx, my, ang, target, isNeutral) {
  const W = G.world, v = G.vehicle, P = G.particles;
  let aim = ang, hitPlayer = false;
  const ALL = CAT.GROUND | CAT.STATIC | CAT.PROP | CAT.ZOMBIE;
  const VEH = CAT.CHASSIS | CAT.WHEEL | CAT.RIDER;
  let mask = ALL;
  if (target && target.player && !isNeutral) {
    hitPlayer = G.combat.requestHit(owner, mx, my);
    if (hitPlayer) {
      const c = v.chassis;
      aim = Math.atan2(c.y + (Math.random() - 0.3) * 0.5 - my, c.x + (Math.random() - 0.5) * 1.2 - mx);
      mask = ALL | VEH;
    } else {
      // промах — но так, чтобы его было видно: пыль у колёс или трассер над крышей
      const c = v.chassis;
      let tx, ty;
      if (Math.random() < 0.55) {
        tx = c.x + c.vx * 0.2 + (Math.random() - 0.5) * 6;
        ty = W.water ? W.water.height(tx, W.time) : W.terrain.heightAt(tx);
      } else {
        tx = c.x + (Math.random() - 0.5) * 3;
        ty = c.y + 1.7 + Math.random() * 1.2;
      }
      aim = Math.atan2(ty - my, tx - mx) + (Math.random() - 0.5) * 0.03;
    }
  } else if (target && (target.unit || target.boat)) {
    const tb = (target.unit || target.boat).body;
    const d = Math.hypot(tb.x - mx, tb.y - my);
    const pHit = clamp(1.0 - d / 30, 0.25, 0.8);
    aim = Math.atan2(tb.y + (target.boat ? 0.5 : 0.35) - my, tb.x - mx) + (Math.random() < pHit ? (Math.random() - 0.5) * 0.03 : (Math.random() - 0.5) * 0.2);
  } else if (target && target.zombie) {
    const zb = target.zombie.body;
    const d = Math.hypot(zb.x - mx, zb.y - my);
    const pHit = clamp(1.05 - d / 22, 0.3, 0.9);
    aim = Math.atan2(zb.y + 0.3 - my, zb.x - mx) + (Math.random() < pHit ? (Math.random() - 0.5) * 0.02 : (Math.random() - 0.5) * 0.25);
  } else aim += (Math.random() - 0.5) * 0.08;
  const ex = mx + Math.cos(aim) * 48, ey = my + Math.sin(aim) * 48;
  // свои не мешают: стрелок бьёт поверх плеча товарища — луч проходит сквозь анархистов и собственный катер
  let hit = null, sx = mx, sy = my;
  for (let k = 0; k < 4; k++) {
    hit = W.rayCast(sx, sy, ex, ey, mask);
    const hd = hit && hit.body.data;
    const friend = hd && ((hd.kind === 'zombie' && hd.zombie.raider && hd.zombie.faction === owner.faction) || (hd.kind === 'prop' && (hd.prop === owner || (hd.prop.isRaiderBoat && hd.prop.faction === owner.faction))));
    if (!friend) break;
    sx = hit.x + Math.cos(aim) * 0.7; sy = hit.y + Math.sin(aim) * 0.7;
    hit = null;
  }
  P.muzzle(mx, my, aim);
  P.lights.push({ x: mx, y: my, r: 3, age: 0, life: 0.05, color: 'rgba(255,200,90,' });
  const cam = G.camX;
  const dist = Math.abs(mx - cam);
  AUDIO.rifle(clamp((mx - cam) / 25, -1, 1), clamp(1.2 - dist / 45, 0.12, 1));
  if (!hit) { P.tracer(mx, my, ex, ey); return; }
  P.tracer(mx, my, hit.x, hit.y);
  const b = hit.body, d = b.data;
  const dx = Math.cos(aim), dy = Math.sin(aim);
  if (d && (d.kind === 'vehicle' || d.kind === 'wheel' || d.kind === 'rider')) { G.onPlayerShot(hit, dx, dy, owner); return; }
  if (d && d.kind === 'zombie') {
    if (d.zombie === owner) return;
    d.zombie.hit(1, dx, dy, 6, 'raider');
    return;
  }
  if (d && d.kind === 'prop' && d.prop === owner) return;
  // остальное — как обычная пуля (бочки, ящики, пыль), но без награды игроку
  G.onBulletHit(hit, dx, dy, 0.5, 'raider');
  // пуля, пролетевшая рядом с игроком, свистит
  if (target && target.player && v) {
    const c = v.chassis;
    const t = clamp(((c.x - mx) * dx + (c.y - my) * dy), 0, 48);
    const px = mx + dx * t, py = my + dy * t;
    if (Math.hypot(px - c.x, py - c.y) < 3.5) AUDIO.whiz(clamp((px - cam) / 25, -1, 1));
  }
}

/* ------------------------------ стрелок ------------------------------ */

class Raider extends Zombie {
  constructor(game, x, y, o = {}) {
    super(game, 'raider', x, y, o);
    this.raider = true;
    this.faction = o.faction || 'raiders';
    this.neutral = !!o.neutral;
    this.angered = false;
    const rng = Math.random;
    if (this.faction === 'military') {
      // солдаты Вальц: камуфляж, каска, лицо открыто
      this.shirt = ['#4d5a3c', '#55603f', '#465236'][Math.floor(rng() * 3)];
      this.pants = ['#3f4a33', '#444c36'][Math.floor(rng() * 2)];
      this.bandana = null; this.hat = -1; this.helmet = true;
    } else {
      this.shirt = ['#1f2023', '#2b2622', '#262a2e'][Math.floor(rng() * 3)];
      this.pants = ['#2c2f33', '#3a3530', '#23262b'][Math.floor(rng() * 3)];
      this.bandana = rng() < 0.6 ? '#141414' : '#7a1c1c';
      this.hat = Math.floor(rng() * 3);   // 0 шапка, 1 ирокез, 2 капюшон
    }
    // свои и нейтральные стоят у дороги — машина игрока проезжает мимо, а не сквозь толпу
    if (this.neutral) this.body.mask &= ~(CAT.CHASSIS | CAT.WHEEL);
    this.aim = 0; this.aimT = 0; this.aimNeed = 0.55;
    this.target = null; this.targetKey = null;
    this.senseT = rng() * 0.2; this.reactT = 0;
    this.burst = 0; this.fireT = 0.5 + rng() * 0.6; this.mag = 20 + Math.floor(rng() * 10); this.reloadT = 0;
    this.flashT = 0; this.laser = 0; this.laserX = 0; this.laserY = 0;
    this.dodgeCd = 0; this.bitten = 0;
    this.dir = -1;
  }

  get hostile() { return !this.neutral || this.angered; }

  // --- восприятие: кто рядом и кого видно ---
  _sense() {
    const G = this.game, b = this.body, v = G.vehicle, W = G.world;
    const ex = b.x, ey = b.y + 0.55;
    let best = null, bestScore = 0;
    // машина игрока
    if (v && this.hostile && !v.crashed) {
      const c = v.chassis;
      const d = Math.hypot(c.x - ex, c.y - ey);
      // слух: мотор слышно издалека — стрелок заранее поворачивается и вскидывает автомат
      const heard = d < 70 && (v.throttle > 0.1 || v.speed() > 8);
      if (heard && !this.alerted) { this.alerted = true; this.dir = c.x > b.x ? 1 : -1; }
      if (d < 50) {
        const blocked = W.rayCast(ex, ey, c.x, c.y + 0.3, CAT.GROUND | CAT.STATIC);
        if (!blocked) {
          const s = 1.15 * (1 - d / 50) + 0.35;
          if (s > bestScore) { bestScore = s; best = { player: true, key: 'player' }; }
        } else if (heard) this.dir = c.x > b.x ? 1 : -1;   // слышит мотор — поворачивается на звук
      }
    }
    // люди другой стороны: военные и «Стая» стреляют друг в друга
    for (const r of G.raiders) {
      if (!r.alive || r === this || r.faction === this.faction) continue;
      const rb = r.body, dx = rb.x - ex;
      if (dx > 40 || dx < -40) continue;
      const d = Math.hypot(dx, rb.y - ey);
      if (d > 40) continue;
      const s = 1.05 * (1 - d / 40) + 0.3;
      if (s <= bestScore) continue;
      if (W.rayCast(ex, ey, rb.x, rb.y + 0.5, CAT.GROUND | CAT.STATIC)) continue;
      bestScore = s; best = { unit: r, key: r };
    }
    for (const p of G.props) {
      if (!p.isRaiderBoat || p.dead || p.faction === this.faction) continue;
      const d = Math.hypot(p.body.x - ex, p.body.y - ey);
      if (d > 42) continue;
      const s = 1.0 * (1 - d / 42) + 0.3;
      if (s > bestScore) { bestScore = s; best = { boat: p, key: p }; }
    }
    // мертвецы
    for (const z of G.zombies) {
      if (!z.alive || z.raider) continue;
      const zb = z.body;
      const dx = zb.x - ex;
      if (dx > 18 || dx < -18) continue;
      const d = Math.hypot(dx, zb.y - ey);
      if (d > 18) continue;
      let s = 1.7 * (1 - d / 18) + (d < 4 ? 1.2 : 0);
      if (s <= bestScore) continue;
      if (d > 4 && W.rayCast(ex, ey, zb.x, zb.y + 0.3, CAT.GROUND | CAT.STATIC)) continue;
      bestScore = s; best = { zombie: z, key: z };
    }
    const prevKey = this.targetKey;
    this.target = best;
    this.targetKey = best ? best.key : null;
    if (best && best.key !== prevKey) {
      // новая цель: время реакции + вскинуть автомат
      const fresh = !prevKey;
      // кто услышал мотор заранее, уже держит автомат наготове
      const ready = best.player && this.alerted;
      this.reactT = ready ? 0.08 + Math.random() * 0.12 : (fresh ? 0.25 + Math.random() * 0.25 : 0.12 + Math.random() * 0.15) + (best.player && fresh ? 0.2 : 0);
      this.aimT = 0; this.aimNeed = best.player ? (ready ? 0.42 : 0.6) : 0.3; this.burst = 0;
      if (ready) this.fireT = Math.min(this.fireT, 0.1);
      if (fresh) G.combat.bark(b.x, b.y + 1.5, best.player ? 'spot' : (best.unit || best.boat) ? 'vs' : 'zombie', this.faction === 'military' ? '#d8e0a0' : null, this.faction);
      if (best.player && !G.combat.announced && !G.demo) {
        G.combat.announced = true;
        if (this.faction === 'military') G.message('СОЛДАТЫ ВАЛЬЦ!', { color: '#ff5a3a', life: 1.4, size: 42, sub: 'военные стреляют по машине' });
        else G.message('АНАРХИСТЫ!', { color: '#ff5a3a', life: 1.4, size: 42, sub: 'люди Ворона стреляют по машине' });
      }
    }
    // нейтральные кричат проезжающему игроку
    if (this.neutral && !this.angered && v && Math.abs(v.x - b.x) < 12 && Math.random() < 0.08) G.combat.bark(b.x, b.y + 1.5, G.level.afterChoice ? 'ally' : 'neutral', '#e6e6e6');
  }

  _targetPoint() {
    const t = this.target, v = this.game.vehicle;
    if (!t) return null;
    if (t.player) { const c = v.chassis; return { x: c.x, y: c.y + 0.2, vx: c.vx, vy: c.vy }; }
    if (t.unit) { if (!t.unit.alive) return null; const ub = t.unit.body; return { x: ub.x, y: ub.y + 0.35, vx: ub.vx, vy: ub.vy }; }
    if (t.boat) { if (t.boat.dead) return null; const bb = t.boat.body; return { x: bb.x, y: bb.y + 0.5, vx: bb.vx, vy: bb.vy }; }
    const zb = t.zombie.body;
    if (!t.zombie.alive) return null;
    return { x: zb.x, y: zb.y + 0.3, vx: zb.vx, vy: zb.vy };
  }

  update(h) {
    if (!this.alive) return;
    const G = this.game, b = this.body, v = G.vehicle, W = G.world, T = this.t;
    this.hurtT = Math.max(0, this.hurtT - h);
    this.flashT = Math.max(0, this.flashT - h);
    this.dodgeCd -= h;
    this.bitten = Math.max(0, this.bitten - h);
    this.senseT -= h;
    if (this.senseT <= 0) { this.senseT = 0.12 + Math.random() * 0.08; this._sense(); }
    const grounded = b.contactCount > 0;

    // --- реакция на несущуюся машину: прыжок в сторону ---
    if (v && grounded && this.dodgeCd <= 0) {
      const c = v.chassis;
      const rel = b.x - c.x;
      const closing = Math.sign(rel) * c.vx;
      if (Math.abs(rel) < 9 && Math.abs(c.y - b.y) < 2.5 && closing > 9) {
        this.dodgeCd = 1.5;
        if (Math.random() < 0.4) {
          b.vy = 6.2; b.vx = Math.sign(rel || 1) * 2.5;
          G.combat.bark(b.x, b.y + 1.6, 'dodge', '#ffd080', this.faction);
          this.burst = 0; this.aimT = 0;
        }
      }
    }

    // --- движение ---
    let targetV = 0;
    const tp = this._targetPoint();
    if (tp) {
      this.dir = tp.x > b.x ? 1 : -1;
      const d = Math.abs(tp.x - b.x);
      if (this.target.zombie && d < 3.5) targetV = -this.dir * T.speed;             // пятиться от мертвеца
      else if (this.target.player && v.speed() < 2 && d < 6) targetV = -this.dir * T.speed * 0.7; // держать дистанцию
    } else {
      this.idleTimer -= h;
      if (this.idleTimer < 0) { this.idleTimer = 2 + Math.random() * 4; this.wander = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? -1 : 1); if (this.wander) this.dir = this.wander; }
      targetV = (this.wander || 0) * 0.7;
    }
    // на ярусах и крышах не расхаживают — можно свалиться
    if (!b.groundContact) targetV = 0;
    if (grounded) {
      const dv = targetV - b.vx;
      b.vx += clamp(dv, -10 * h, 10 * h);
    }
    this.phase += Math.abs(b.vx) * h * 4.2;
    if (b.y < W.terrain.heightAt(b.x) - 6 && !W.water) this.remove();

    // --- прицеливание и стрельба ---
    this.reactT -= h;
    this.reloadT -= h;
    const shoulderX = b.x + this.dir * 0.05, shoulderY = b.y + 0.52;
    if (tp && this.reactT <= 0 && this.reloadT <= 0 && this.bitten <= 0.3) {
      const d = Math.hypot(tp.x - shoulderX, tp.y - shoulderY);
      // упреждение по скорости цели (пуля не мгновенная для глаза)
      const lead = clamp(d / 300, 0, 0.12);
      const desired = Math.atan2(tp.y + tp.vy * lead - shoulderY, tp.x + tp.vx * lead - shoulderX);
      let diff = desired - this.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.aim += diff * Math.min(1, h * 7);
      this.aimT += h;
      this.laser = clamp(this.aimT / this.aimNeed, 0, 1);
      this.laserX = tp.x; this.laserY = tp.y;
      this.fireT -= h;
      if (this.aimT >= this.aimNeed && this.fireT <= 0 && Math.abs(diff) < 0.2) {
        if (this.burst <= 0) this.burst = 3 + Math.floor(Math.random() * 3);
        const mx = shoulderX + Math.cos(this.aim) * 0.95, my = shoulderY + Math.sin(this.aim) * 0.95;
        raiderShoot(G, this, mx, my, this.aim + (Math.random() - 0.5) * 0.04, this.target, !this.hostile);
        this.flashT = 0.05;
        this.mag--; this.burst--;
        b.vx -= this.dir * 0.25;   // отдача
        if (this.mag <= 0) {
          this.mag = 24; this.reloadT = 1.7 + Math.random() * 0.6; this.burst = 0; this.laser = 0;
          G.combat.bark(b.x, b.y + 1.5, 'reload', '#ffb080', this.faction);
        }
        if (this.burst > 0) this.fireT = 0.09 + Math.random() * 0.03;
        else { this.fireT = 0.6 + Math.random() * 0.7; this.aimNeed = 0.25; this.aimT = 0; }
      }
    } else {
      this.laser = Math.max(0, this.laser - h * 4);
      if (!tp) this.aim += ((this.dir > 0 ? -0.25 : Math.PI + 0.25) - this.aim) * Math.min(1, h * 3);
    }
  }

  // мертвец вцепился
  bite(h, z) {
    if (!this.alive) return;
    this.bitten = 0.5;
    this.hp -= h * 1.3;
    this.hurtT = 0.1;
    if (Math.random() < h * 8) this.game.particles.blood(this.body.x, this.body.y + 0.5, (Math.random() - 0.5) * 3, 2, 3);
    if (Math.random() < h * 1.5) this.game.combat.bark(this.body.x, this.body.y + 1.6, 'bitten', '#ffd0d0', this.faction);
    // стреляет в упор
    this.target = { zombie: z, key: z }; this.targetKey = z; this.reactT = Math.min(this.reactT, 0.05); this.aimNeed = 0.05;
    if (this.hp <= 0) this.kill(z.body.vx * 0.5 + this.dir * -2, 3, 'zombie');
  }

  kill(vx, vy, cause) {
    if (!this.alive) return;
    const G = this.game;
    // задавил нейтрального — остальные рядом берутся за оружие
    if (this.neutral && !this.angered && (cause === 'vehicle' || cause === 'bullet' || cause === 'explosion')) {
      for (const r of G.raiders) {
        if (r !== this && r.alive && r.neutral && r.faction === this.faction && Math.abs(r.body.x - this.body.x) < 40) { r.angered = true; r.reactT = 0.4 + Math.random() * 0.4; r.body.mask |= CAT.CHASSIS | CAT.WHEEL; }
      }
      G.combat.bark(this.body.x, this.body.y + 2, 'angry', '#ff5a3a');
    }
    // автомат отлетает
    const b = this.body;
    const gun = G.world.add(new Body({
      x: b.x, y: b.y + 0.5, angle: this.aim, shapes: [{ type: 'poly', verts: boxVerts(0.9, 0.1) }], mass: 4, friction: 0.7,
      cat: CAT.DEBRIS, mask: CAT.GROUND | CAT.STATIC
    }));
    gun.vx = vx * 0.6 + (Math.random() - 0.5) * 3; gun.vy = Math.max(vy, 2) * 0.7 + 2; gun.w = (Math.random() - 0.5) * 14;
    G.debris.push({ body: gun, color: '#1c1c1c', w: 0.9, h: 0.1, life: 8 });
    super.kill(vx, vy, cause);
  }

  render(ctx, alpha) {
    if (!this.alive) return;
    const b = this.body, T = this.t;
    const x = b.ix(alpha), y = b.iy(alpha) - T.h / 2 - 0.02;
    // лазерный целеуказатель — предупреждение перед очередью
    if (this.laser > 0.02) {
      const sx = x + this.dir * 0.05, sy = y + T.h / 2 + 0.54;
      const mx = sx + Math.cos(this.aim) * 0.95, my = sy + Math.sin(this.aim) * 0.95;
      const len = Math.min(40, Math.hypot(this.laserX - mx, this.laserY - my) + 1);
      const g = ctx.createLinearGradient(mx, my, mx + Math.cos(this.aim) * len, my + Math.sin(this.aim) * len);
      g.addColorStop(0, `rgba(255,40,30,${0.55 * this.laser})`); g.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(this.aim) * len, my + Math.sin(this.aim) * len); ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.dir, 1);
    let la = this.dir > 0 ? this.aim : Math.PI - this.aim;
    while (la > Math.PI) la -= Math.PI * 2;
    while (la < -Math.PI) la += Math.PI * 2;
    drawRaiderFigure(ctx, this, this.phase, clamp(la, -1.25, 1.25), Math.abs(b.vx) > 0.3);
    ctx.restore();
  }
}

// человек с автоматом. Координаты: ступни y=0, взгляд вправо, aim — угол ствола
function drawRaiderFigure(ctx, r, ph, aim, walking) {
  const L = raiderLook(r);
  const P = gaitPose(walking ? 'walk' : 'stand', walking ? ph : r.breathT || 0, { amp: walking ? 0.8 : 0.3 });
  P.lean = 0.08;
  // руки на оружии: приклад в плече, кисти на рукояти и цевье
  const shx = Math.sin(P.lean) * RIG.torso, shy = P.hip[1] + Math.cos(P.lean) * RIG.torso;
  const ca = Math.cos(aim), sa = Math.sin(aim);
  const at = (t, off) => [shx + ca * t - sa * off, shy + sa * t + ca * off];
  P.hands = { B: at(0.16, -0.08), F: at(0.5, -0.05) };
  P.elbows = { B: -1, F: -1 };
  P.head = clamp(aim * 0.4, -0.3, 0.3);
  P.item = { type: 'rifle', aim, flash: r.flashT > 0 };
  P.mood = { hurt: r.hurtT > 0 };
  drawPerson(ctx, L, P);
}

/* ------------------------------ катер ------------------------------ */

const RBOAT_HULL = [[-2.0, -0.1], [-0.6, -0.45], [1.1, -0.4], [2.25, 0.3], [2.1, 0.45], [-2.0, 0.45]];

class RaiderBoat extends Prop {
  constructor(game, x, y, o = {}) {
    const b = game.world.add(new Body({
      x, y, shapes: [{ type: 'poly', verts: RBOAT_HULL }], mass: 520, friction: 0.35, restitution: 0.05,
      cat: CAT.PROP, angDamp: 0.8, linDamp: 0.01, buoyancy: 3
    }));
    super(game, 'rboat', b, o);
    const verts = RBOAT_HULL.map(p => [p[0] - b.com.x, p[1] - b.com.y]);
    let area = 0, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < verts.length; i++) {
      const p = verts[i], q = verts[(i + 1) % verts.length];
      area += p[0] * q[1] - q[0] * p[1];
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    }
    area = Math.abs(area) * 0.5;
    const len = maxX - minX;
    b.hydro = {
      verts, area, len, rho: b.mass / (0.3 * area), k: b.mass / len,
      cp1: 1.3, cp2: 0.16, fp: 1.6, cs1: 0.22, cs2: 0.012, fs: 1.0, cf: 0.005,
      maxDecel: 9, maxAcc: 34, angDamp: 1.8
    };
    this.isRaiderBoat = true;
    this.role = o.role || 'chase';
    this.faction = o.faction || 'raiders';
    this.ally = !!o.ally;   // союзник игрока (катер «Стаи» на её ветке)
    this.mil = this.faction === 'military';
    if (this.ally) b.mask &= ~(CAT.CHASSIS | CAT.WHEEL);   // не толкается с катером игрока
    this.hp = 7; this.hurtT = 0;
    this.phaseOff = Math.random() * 10;
    this.throttle = 0; this.propSpin = 0;
    // экипаж: рулевой и стрелок (стрелок — «виртуальный» стрелок с тем же ИИ прицеливания)
    this.skin = ZOMBIE_TYPES.raider.skin[Math.floor(Math.random() * 4)];
    this.gunner = this.faction === 'military'
      ? { skin: ZOMBIE_TYPES.raider.skin[Math.floor(Math.random() * 4)], shirt: '#4d5a3c', pants: '#3f4a33', bandana: null, helmet: true, hat: -1, hurtT: 0, flashT: 0 }
      : { skin: ZOMBIE_TYPES.raider.skin[Math.floor(Math.random() * 4)], shirt: '#1f2023', pants: '#2c2f33', bandana: '#141414', hat: Math.floor(Math.random() * 3), hurtT: 0, flashT: 0 };
    this.aim = Math.PI; this.aimT = 0; this.aimNeed = 0.6; this.fireT = 1 + Math.random(); this.burst = 0; this.mag = 24; this.reloadT = 0;
    this.target = null; this.targetKey = null; this.senseT = 0; this.reactT = 0.5; this.laser = 0;
    this.dir = 1;
    this.flagT = Math.random() * 5;
  }
  get x() { return this.body.x; }

  _gunnerShoulder() { return this.body.worldPoint(0.35, 1.45); }

  update(h) {
    const G = this.game, b = this.body, v = G.vehicle, W = G.world;
    if (this.dead) return;
    this.hurtT = Math.max(0, this.hurtT - h);
    this.gunner.flashT = Math.max(0, this.gunner.flashT - h);
    this.flagT += h;
    // --- рулевой: преследование со смещением и «прибытие» ---
    const surf = W.water ? W.water.height(b.x, W.time) : 0;
    const pp = b.worldPoint(-2.15, -0.35);
    const propIn = W.water && pp.y < W.water.height(pp.x, W.time) + 0.05;
    let desiredV = 0;
    if (v && !v.crashed) {
      const c = v.chassis;
      const t = W.time * 0.35 + this.phaseOff;
      const offset = this.role === 'escort' ? 7 + Math.sin(t) * 6 : this.role === 'ahead' ? 13 + Math.sin(t) * 4 : -6 + Math.sin(t) * 9;
      const xd = c.x + offset;
      // быстрее катера игрока не разгоняется — от него можно уйти
      const vmax = Math.max(15, (v.st.topSpeed || 20) * 0.93);
      desiredV = clamp(c.vx + clamp((xd - b.x) * 0.55, -9, 9), -6, vmax);
    }
    const fwd = b.vx * b.cos + b.vy * b.sin;
    this.throttle += (clamp((desiredV - fwd) * 0.45, -1, 1) - this.throttle) * Math.min(1, h * 4);
    if (propIn && this.hp > 0) {
      const acc = this.throttle > 0 ? 9.5 * this.throttle * clamp(1.2 - fwd / 30, 0, 1.2) : 7 * this.throttle;
      const F = acc * b.mass;
      b.applyForce(b.cos * F, b.sin * F, pp.x, pp.y);
    }
    // держится ровно (рулевой гасит крен)
    let a = b.a % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
    b.t -= (a * 5 + b.w * 2.2) * b.I;
    this.propSpin += Math.abs(this.throttle) * h * 50;
    if (propIn && Math.abs(fwd) > 4 && Math.random() < 0.6 * G.particles.quality) G.particles.wake(pp.x, surf, b.vx);

    // --- таран игроком ---
    if (!this.ally && b.maxImpulseOther && b.maxImpulseOther.data && (b.maxImpulseOther.data.kind === 'vehicle') && b.maxImpulse > b.mass * 4.5) {
      this.damage((b.maxImpulse / b.mass - 4.5) * 0.9, b.maxImpulseOther.vx > b.vx ? 1 : -1, 'ram');
    }
    // мины на пути
    for (const p of G.props) {
      if (!(p instanceof Floater) || !p.armed) continue;
      if (Math.abs(p.body.x - b.x) < 2.6 && Math.abs(p.body.y - b.y) < 2.4) { p.armed = false; p.remove(); G.explode(p.body.x, p.body.y, 1.6, 'mine'); }
    }

    // --- стрелок ---
    this.senseT -= h;
    if (this.senseT <= 0) { this.senseT = 0.15 + Math.random() * 0.08; this._sense(); }
    this.reactT -= h; this.reloadT -= h;
    const sh = this._gunnerShoulder();
    let tp = null;
    if (this.target) {
      if (this.target.player && v) tp = { x: v.chassis.x, y: v.chassis.y + 0.2 };
      else if (this.target.unit && this.target.unit.alive) tp = { x: this.target.unit.body.x, y: this.target.unit.body.y + 0.35 };
      else if (this.target.boat && !this.target.boat.dead) tp = { x: this.target.boat.body.x, y: this.target.boat.body.y + 0.5 };
      else if (this.target.zombie && this.target.zombie.alive) tp = { x: this.target.zombie.body.x, y: this.target.zombie.body.y + 0.3 };
    }
    if (tp && this.reactT <= 0 && this.reloadT <= 0 && this.hp > 0) {
      this.dir = tp.x > sh.x ? 1 : -1;
      const desired = Math.atan2(tp.y - sh.y, tp.x - sh.x);
      let diff = desired - this.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.aim += diff * Math.min(1, h * 5);
      this.aimT += h;
      this.laser = clamp(this.aimT / this.aimNeed, 0, 1);
      this.laserX = tp.x; this.laserY = tp.y;
      this.fireT -= h;
      if (this.aimT >= this.aimNeed && this.fireT <= 0 && Math.abs(diff) < 0.25) {
        if (this.burst <= 0) this.burst = 4 + Math.floor(Math.random() * 3);
        const mx = sh.x + Math.cos(this.aim) * 0.95, my = sh.y + Math.sin(this.aim) * 0.95;
        // на качающейся лодке разброс больше
        raiderShoot(G, this, mx, my, this.aim + (Math.random() - 0.5) * 0.08, this.target, this.ally);
        this.gunner.flashT = 0.05;
        this.mag--; this.burst--;
        if (this.mag <= 0) { this.mag = 24; this.reloadT = 2; this.burst = 0; this.laser = 0; G.combat.bark(sh.x, sh.y + 1, 'reload', '#ffb080', this.faction); }
        if (this.burst > 0) this.fireT = 0.1;
        else { this.fireT = 0.8 + Math.random() * 0.8; this.aimNeed = 0.3; this.aimT = 0; }
      }
    } else this.laser = Math.max(0, this.laser - h * 4);

    if (b.y < surf - 6 || (v && b.x < v.x - 90)) this.remove();
  }

  _sense() {
    const G = this.game, v = G.vehicle, sh = this._gunnerShoulder();
    let best = null, bestScore = 0;
    if (v && !v.crashed && !this.ally) {
      const d = Math.hypot(v.x - sh.x, v.y - sh.y);
      if (d < 46) { const s = 1.2 * (1 - d / 46) + 0.4; bestScore = s; best = { player: true, key: 'player' }; }
    }
    // катера и стрелки другой стороны
    for (const p of G.props) {
      if (!p.isRaiderBoat || p === this || p.dead || p.faction === this.faction) continue;
      const d = Math.hypot(p.body.x - sh.x, p.body.y - sh.y);
      if (d > 44) continue;
      const s = 1.3 * (1 - d / 44) + 0.35;
      if (s > bestScore) { bestScore = s; best = { boat: p, key: p }; }
    }
    for (const r of G.raiders) {
      if (!r.alive || r.faction === this.faction) continue;
      const d = Math.hypot(r.body.x - sh.x, r.body.y - sh.y);
      if (d > 36) continue;
      const s = 1.0 * (1 - d / 36) + 0.3;
      if (s > bestScore) { bestScore = s; best = { unit: r, key: r }; }
    }
    for (const z of G.zombies) {
      if (!z.alive || z.raider) continue;
      const d = Math.hypot(z.body.x - sh.x, z.body.y - sh.y);
      if (d > 12) continue;
      const s = 1.6 * (1 - d / 12) + (d < 4 ? 1 : 0);
      if (s > bestScore) { bestScore = s; best = { zombie: z, key: z }; }
    }
    const prev = this.targetKey;
    this.target = best; this.targetKey = best ? best.key : null;
    if (best && best.key !== prev) {
      this.reactT = prev ? 0.15 : 0.35 + Math.random() * 0.3;
      this.aimT = 0; this.aimNeed = best.player ? 0.65 : 0.3; this.burst = 0;
      if (!prev) G.combat.bark(sh.x, sh.y + 1.2, best.player ? 'spot' : (best.unit || best.boat) ? 'vs' : 'zombie', null, this.faction);
      if (best.player && !G.combat.announced && !G.demo) {
        G.combat.announced = true;
        if (this.mil) G.message('ПАТРУЛЬ ВАЛЬЦ!', { color: '#ff5a3a', life: 1.4, size: 42, sub: 'военные катера — тарань или уходи' });
        else G.message('КАТЕРА ВОРОНА!', { color: '#ff5a3a', life: 1.4, size: 42, sub: 'тарань или уходи от них' });
      }
    }
  }

  onBullet(dmg, hit, dx, dy, cause) { this.damage(dmg * 0.8, dx, cause === 'raider' ? 'raider' : 'bullet'); this.game.particles.sparks(hit.x, hit.y, -dx, -dy, 5); }
  onBlast(k) { this.damage(k * 9, 0, 'explosion'); }

  damage(amount, dir, cause) {
    if (this.dead || this._destroying || amount <= 0) return;
    this.hp -= amount;
    this.hurtT = 0.12;
    AUDIO.metal(Math.min(1, 0.3 + amount * 0.2));
    if (this.hp <= 0) this.destroy(dir, cause);
  }

  destroy(dir, cause) {
    if (this.dead || this._destroying) return;
    this._destroying = true;
    const G = this.game, b = this.body;
    const x = b.x, y = b.y;
    G.explode(x, y + 0.3, 0.8, 'rboat');
    for (const [lx, look] of [[-1.3, { skin: this.skin }], [0.35, this.gunner]]) {
      const p = b.worldPoint(lx, 1.0);
      G.ragdolls.push(new Ragdoll(G, p.x, p.y, (Math.random() - 0.5), b.vx * 0.5 + (Math.random() - 0.5) * 6, 7 + Math.random() * 4, {
        skin: look.skin, shirt: '#1f2023', pants: '#2c2f33', scale: 1, spin: (Math.random() - 0.5) * 10, hair: 2
      }));
    }
    for (let i = 0; i < 4; i++) {
      const w = 0.6 + Math.random() * 0.8;
      const db = G.world.add(new Body({
        x: x + (Math.random() - 0.5) * 3, y: y + 0.4, angle: Math.random() * 3, shapes: [{ type: 'poly', verts: boxVerts(w, 0.12) }],
        mass: 10, friction: 0.6, cat: CAT.DEBRIS, mask: CAT.GROUND | CAT.STATIC, buoyancy: 1.6
      }));
      db.vx = b.vx * 0.5 + (Math.random() - 0.5) * 8; db.vy = 4 + Math.random() * 6; db.w = (Math.random() - 0.5) * 12;
      G.debris.push({ body: db, color: i % 2 ? '#26292c' : '#7a1c1c', w, h: 0.12, life: 10 });
    }
    this.remove();
    if (cause !== 'raider' && !this.ally) G.onRaiderBoatDestroyed(this, x, y);
  }

  render(ctx, alpha) {
    if (this.dead) return;
    const b = this.body;
    const cx = b.ix(alpha), cy = b.iy(alpha), ca = b.ia(alpha);
    // лазер стрелка
    if (this.laser > 0.02) {
      const s = { x: cx + Math.cos(ca) * (0.35 - b.com.x) - Math.sin(ca) * (1.45 - b.com.y), y: cy + Math.sin(ca) * (0.35 - b.com.x) + Math.cos(ca) * (1.45 - b.com.y) };
      const mx = s.x + Math.cos(this.aim) * 0.95, my = s.y + Math.sin(this.aim) * 0.95;
      const len = Math.min(38, Math.hypot(this.laserX - mx, this.laserY - my) + 1);
      const g = ctx.createLinearGradient(mx, my, mx + Math.cos(this.aim) * len, my + Math.sin(this.aim) * len);
      g.addColorStop(0, `rgba(255,40,30,${0.55 * this.laser})`); g.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(this.aim) * len, my + Math.sin(this.aim) * len); ctx.stroke();
    }
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ca); ctx.translate(-b.com.x, -b.com.y);
    const h = RBOAT_HULL;
    // мотор и винт
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-2.2, -0.4, 0.1, 0.85);
    ctx.fillStyle = '#151515'; roundRect(ctx, -2.45, 0.4, 0.45, 0.55, 0.1); ctx.fill();
    ctx.fillStyle = '#b8261f'; ctx.fillRect(-2.42, 0.65, 0.4, 0.05);
    ctx.fillStyle = '#8a7a4a';
    ctx.beginPath(); ctx.ellipse(-2.15, -0.42, 0.05, Math.abs(Math.cos(this.propSpin)) * 0.2 + 0.02, 0, 0, Math.PI * 2); ctx.fill();
    // флаг: чёрный у Стаи, у военных — вымпел береговой охраны
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.04;
    if (this.mil) {
      ctx.beginPath(); ctx.moveTo(-1.8, 0.45); ctx.lineTo(-1.8, 2.1); ctx.stroke();
      ctx.fillStyle = '#e8e8e0'; ctx.beginPath(); ctx.moveTo(-1.8, 2.1); ctx.lineTo(-2.55, 1.95 + Math.sin(this.flagT * 6) * 0.04); ctx.lineTo(-1.8, 1.8); ctx.fill();
      ctx.fillStyle = '#2f6b8f'; ctx.fillRect(-2.2, 1.9, 0.3, 0.06);
    } else {
    ctx.beginPath(); ctx.moveTo(-1.8, 0.45); ctx.lineTo(-1.8, 2.3); ctx.stroke();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.moveTo(-1.8, 2.3);
    for (let i = 0; i <= 6; i++) { const t = i / 6; ctx.lineTo(-1.8 - t * 0.9, 2.3 + Math.sin(this.flagT * 6 + t * 4) * 0.06 * t); }
    for (let i = 6; i >= 0; i--) { const t = i / 6; ctx.lineTo(-1.8 - t * 0.9, 1.75 + Math.sin(this.flagT * 6 + t * 4 + 0.5) * 0.06 * t); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(-2.25, 2.03, 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e0e0e'; ctx.fillRect(-2.3, 2.0, 0.04, 0.04); ctx.fillRect(-2.22, 2.0, 0.04, 0.04);
    }
    // рулевой
    const hunched = this.mil ? { skin: this.skin, shirt: '#4d5a3c', pants: '#3f4a33', bandana: null, helmet: true, hurtT: this.hurtT, flashT: 0 }
      : { skin: this.skin, shirt: '#2b2622', pants: '#23262b', bandana: '#7a1c1c', hat: 0, hurtT: this.hurtT, flashT: 0 };
    ctx.save(); ctx.translate(-1.25, 0.2); ctx.scale(0.9, 0.9);
    drawRaiderSeated(ctx, hunched);
    ctx.restore();
    // стрелок
    ctx.save(); ctx.translate(0.35, 0.02); ctx.scale(this.dir, 1);
    let la = this.dir > 0 ? this.aim - ca : Math.PI - (this.aim - ca);
    while (la > Math.PI) la -= Math.PI * 2;
    while (la < -Math.PI) la += Math.PI * 2;
    this.gunner.hurtT = this.hurtT;
    drawRaiderFigure(ctx, this.gunner, 0, clamp(la, -1.25, 1.25), false);
    ctx.restore();
    // корпус
    ctx.beginPath(); ctx.moveTo(h[0][0], h[0][1]);
    for (let i = 1; i < h.length; i++) ctx.lineTo(h[i][0], h[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0.45, 0, -0.45);
    if (this.mil) { g.addColorStop(0, this.hurtT > 0 ? '#9a9a9a' : '#8a979e'); g.addColorStop(0.6, '#5d6b73'); g.addColorStop(1, '#34403f'); }
    else { g.addColorStop(0, this.hurtT > 0 ? '#6a6a6a' : '#3a3e42'); g.addColorStop(0.6, '#26292c'); g.addColorStop(1, '#141618'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = this.mil ? '#e3e3e3' : '#7a1c1c';
    ctx.beginPath(); ctx.moveTo(-2, 0.05); ctx.lineTo(2.25, 0.15); ctx.lineTo(2.25, 0.25); ctx.lineTo(-2, 0.15); ctx.fill();
    if (this.mil) {
      // синяя полоса береговой охраны
      ctx.fillStyle = '#2f6b8f'; ctx.beginPath(); ctx.moveTo(0.6, -0.4); ctx.lineTo(0.85, -0.4); ctx.lineTo(1.25, 0.45); ctx.lineTo(1.0, 0.45); ctx.fill();
    } else {
      // вороний череп на носу
      ctx.fillStyle = '#e6e6e6';
      ctx.beginPath(); ctx.ellipse(1.35, -0.08, 0.2, 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1.5, -0.12); ctx.lineTo(1.85, -0.2); ctx.lineTo(1.5, -0.02); ctx.fill();
      ctx.fillStyle = '#141618'; ctx.beginPath(); ctx.arc(1.33, -0.05, 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.035; ctx.stroke();
    ctx.restore();
  }
}

// рулевой, сидящий у мотора
function drawRaiderSeated(ctx, r) {
  const L = raiderLook(r);
  const P = seatedPose([0, 0.35], [-0.5, 0.62], [0.42, 0.0], -0.05, 0.1);
  P.hands.B = [-0.48, 0.66];
  P.elbows = { F: 1, B: 1 };
  drawPerson(ctx, L, P);
}

// катера «из-за спины»: появляются позади игрока, когда он проезжает отметку
class RaiderBoatTrigger extends Prop {
  constructor(game, x, o = {}) { super(game, 'rtrigger', null, Object.assign({ x }, o)); }
  update() {
    const G = this.game, v = G.vehicle;
    if (this.dead || !v) return;
    if (v.x > this.o.x) {
      const bx = v.x - 42 - Math.random() * 8;
      const boat = new RaiderBoat(G, bx, 0.3, { role: this.o.role || 'chase', faction: this.o.faction, ally: this.o.ally });
      boat.body.vx = Math.max(8, v.chassis.vx + 5);
      G.props.push(boat);
      this.dead = true;
    }
  }
}
