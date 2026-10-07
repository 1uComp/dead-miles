'use strict';
/* Заезд: мир, спавн объектов, камера, правила, награды */

const STEP = 1 / 120;

class Game {
  constructor(app, levelIndex, vehicleId, o = {}) {
    this.app = app;
    this.save = app.save;
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.demo = !!o.demo;
    this.world = new World();
    const gen = generateLevel(this.level, { demo: this.demo, branch: this.save.branch });
    this.world.terrain = gen.terrain;
    this.world.water = gen.water;
    this.spawns = gen.spawns;
    this.decor = gen.decor;
    this.finish = this.decor.find(d => d.finish) || null;
    this.deaths = gen.deaths || [];
    this.issues = gen.issues || [];
    this.avalanche = gen.avalanche && !this.demo ? { x: gen.avalanche.x, x2: gen.avalanche.x2, active: false, wallX: 0, speed: 15, done: false, rumbleT: 0 } : null;
    this.deathT = 0;
    if (this.finish) this.finish.doorK = 0;
    this.spawnIdx = 0;
    this.particles = new Particles(app.settings.quality >= 1 ? 2600 : 1200);
    this.particles.quality = app.settings.quality >= 1 ? 1 : 0.5;
    this.zombies = []; this.ragdolls = []; this.props = []; this.debris = [];
    this.raiders = []; this.combat = new CombatDirector(this);
    this.kills = 0; this.killMoney = 0; this.stuntMoney = 0; this.pickupMoney = 0; this.flips = 0; this.bestAir = 0;
    this.distance = 0; this.maxDistance = 0;
    this.combo = 0; this.comboT = 0; this.comboPulse = 0;
    this.state = 'drive';
    this.endT = 0; this.stuckT = 0; this.flipT = 0; this.fuelT = 0; this.sinkT = 0;
    this.slowmo = 1; this.slowTarget = 1;
    this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    this.hurtFlash = 0; this.whiteFlash = 0;
    this.msg = null;
    this.theme = THEMES[this.level.theme];
    this.dustColor = this.theme.dust;
    this.cashPerMeter = 0.45 * (1 + 0.2 * levelIndex);
    this.killMult = 1 + 0.15 * levelIndex;
    this.airT = 0;
    this.fps = 60;
    this.showFps = app.settings.fps;

    const def = VEHICLE_BY_ID[vehicleId];
    const up = this.demo ? (o.upgrades || {}) : (this.save.owned[vehicleId] ? this.save.owned[vehicleId].up : {});
    let sx = 0, sy;
    if (def.type === 'boat') { sy = 0.2; }
    else {
      const minY = Math.min(...def.wheels.map(w => w.y - w.r));
      sy = this.world.terrain.heightAt(sx) - minY + 0.05;
    }
    this.startX = sx;
    this.vehicle = new Vehicle(this, def, up, sx, sy);
    if (this.demo) { this.vehicle.fuel = 1e9; this.vehicle.fuelMax = 1e9; }
    this.camX = sx + 4; this.camY = sy + 2;
    this.zoom = 30;
    this._spawn();

    this.world.preSolve = c => this._preSolve(c);
    if (!this.demo) {
      this.vehicle.startSound();
      if (this.level.weather === 'rain' || this.level.weather === 'storm') AUDIO.startRain();
      this.message('ВПЕРЁД!', { color: '#ffcf3a', life: 1.2 });
    }
  }

  destroy() {
    if (this.vehicle) this.vehicle.destroy();
    if (!this.demo) AUDIO.stopRain();
  }

  message(text, o = {}) {
    this.msg = { text, t: o.life || 1.6, life: o.life || 1.6, color: o.color, sub: o.sub, size: o.size };
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }

  runMoney() {
    return Math.floor(this.maxDistance * this.cashPerMeter) + this.killMoney + this.stuntMoney + this.pickupMoney;
  }

  /* ------------------------------ события ------------------------------ */
  _preSolve(c) {
    const da = c.a.data, db = c.b.data;
    if (!da || !db) return true;
    // деревянные ящики транспорт проламывает на скорости, а не спотыкается о них
    {
      let crate = null, vb = null;
      if (da.kind === 'prop' && da.prop instanceof Crate && !da.prop.metal && (db.kind === 'vehicle' || db.kind === 'wheel' || db.kind === 'rider')) { crate = da.prop; vb = c.b; }
      else if (db.kind === 'prop' && db.prop instanceof Crate && !db.prop.metal && (da.kind === 'vehicle' || da.kind === 'wheel' || da.kind === 'rider')) { crate = db.prop; vb = c.a; }
      if (crate) {
        if (crate.dead) return false;
        const cb = crate.body, v = this.vehicle;
        const rvx = vb.vx - cb.vx, rvy = vb.vy - cb.vy;
        if (Math.hypot(rvx, rvy) > 7) {
          let mc = 0; for (const b of v.bodies) mc += b.mass;
          const k = cb.mass / (mc + cb.mass) * 0.5;
          for (const b of v.bodies) { b.vx -= rvx * k; }
          cb.vx = vb.vx * 0.8; cb.vy = vb.vy + 3;
          if (v.dmg && vb === v.chassis) v.dmg.zombieHit(cb.x, cb.y, -rvx / Math.hypot(rvx, rvy), -rvy / Math.hypot(rvx, rvy), Math.hypot(rvx, rvy), cb.mass * 1.5, cb.id);
          crate.breakApart();
          this.shake(0.06);
          return false;
        }
      }
    }
    let z = null;
    if (da.kind === 'zombie' && (db.kind === 'vehicle' || db.kind === 'wheel')) z = da.zombie;
    else if (db.kind === 'zombie' && (da.kind === 'vehicle' || da.kind === 'wheel')) z = db.zombie;
    if (z) {
      if (!z.alive) return false;
      const v = this.vehicle, ch = v.chassis;
      const rvx = ch.vx - z.body.vx, rvy = ch.vy - z.body.vy;
      const rel = Math.hypot(rvx, rvy);
      const killSpeed = v.st.killSpeed * (z.t.killMul || 1);
      if (rel > killSpeed && !v.crashed) {
        const mz = z.t.mass;
        let mc = ch.mass; for (const w of v.wheels) mc += w.mass;
        // утопленник в воде почти невесом — лодка теряет гораздо меньше скорости, чем машина о пешего зомби
        const k = mz / (mc + mz) * (1 - v.st.plow) * (v.type === 'boat' ? 0.35 : 1);
        for (const b of v.bodies) { b.vx -= rvx * k; b.vy -= rvy * k * 0.4; }
        const up = Math.abs(rvx) * (0.25 + Math.random() * 0.2) + 2;
        z.kill(ch.vx * 1.1 + rvx * 0.15, Math.max(ch.vy, 0) + up, 'vehicle');
        v.addBlood(z.body.x - Math.sign(ch.vx) * 0.3, z.body.y + 0.3);
        if (v.dmg && (da.kind === 'vehicle' || db.kind === 'vehicle')) v.dmg.zombieHit(z.body.x, z.body.y + 0.2, -rvx / rel, -rvy / rel, rel, mz, z.body.id);
        this.shake(0.08 + mz / 1500);
        return false;
      } else if (z.t.brute && rel > killSpeed * 0.5) {
        // громила получает урон от ударов
        z.hp -= rel * 0.08;
        if (v.dmg) v.dmg.zombieHit(z.body.x, z.body.y + 0.3, -rvx / rel, -rvy / rel, rel, z.t.mass, z.body.id);
        if (z.hp <= 0) { z.kill(ch.vx, ch.vy + 5, 'vehicle'); return false; }
        this.shake(0.2);
        AUDIO.impact(0.6);
      }
      return true;
    }
    return true;
  }

  onZombieKilled(z, cause) {
    if (this.demo) return;
    // мертвецов и людей, убитых не игроком, в счёт не берём; «нейтральный» анархист — не добыча
    if (cause === 'raider' || cause === 'zombie') return;
    if (z.raider && z.neutral && !z.angered) { this.particles.text(z.body.x, z.body.y + 2, 'СВОИ ЖЕ!', '#ff5a3a', 1); return; }
    this.kills++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 1.6; this.comboPulse = 1;
    let reward = Math.round(z.t.reward * this.killMult);
    if (this.combo >= 3) reward = Math.round(reward * (1 + Math.min(1, (this.combo - 2) * 0.1)));
    this.killMoney += reward;
    this.particles.text(z.body.x, z.body.y + 2, '+$' + reward, this.combo >= 5 ? '#ff9a3a' : '#9fe06a', z.t.brute ? 1.6 : 1);
    if (z.t.brute) { this.message('ГРОМИЛА ПОВЕРЖЕН!', { color: '#ff7a3a', sub: '+$' + reward }); this.slowTarget = 0.3; this._slowT = 0.8; }
    AUDIO.cash();
  }
  onFlip() {
    if (this.demo) return;
    this.flips++;
    const r = Math.round(60 * this.killMult);
    this.stuntMoney += r;
    this.message('САЛЬТО!', { color: '#6fd0ff', sub: '+$' + r, life: 1.2, size: 40 });
    AUDIO.pickup();
  }
  onRiderCrash() {
    if (this.demo) return;
    this.message('ВЫЛЕТЕЛ ИЗ СЕДЛА!', { color: '#ff5a3a', life: 2.2 });
    this.slowTarget = 0.35; this._slowT = 0.9;
  }
  onPickup(p) {
    if (p.type === 'fuel') {
      const v = this.vehicle;
      v.fuel = Math.min(v.fuelMax, v.fuel + v.fuelMax * 0.35);
      this.particles.text(p.px, p.py + 1, '+ТОПЛИВО', '#ffa040', 1.2);
    } else {
      const r = Math.round(70 * this.killMult);
      this.pickupMoney += r;
      this.particles.text(p.px, p.py + 1, '+$' + r, '#9fe06a', 1.2);
    }
    AUDIO.pickup();
  }
  addPickup(x, y, type) {
    const p = new Pickup(this, x, y, type);
    this.props.push(p);
    return p;
  }
  onBulletHit(hit, dx, dy, dmg, cause) {
    const b = hit.body, d = b.data;
    if (d && d.kind === 'zombie') { d.zombie.hit(dmg, dx, dy, 10, cause === 'raider' ? 'raider' : 'bullet'); return; }
    if (d && d.kind === 'ragdoll') {
      b.applyImpulse(dx * 40, dy * 40 + 10, hit.x, hit.y);
      this.particles.blood(hit.x, hit.y, dx * 5, dy * 5, 6);
      return;
    }
    if (d && d.kind === 'prop') {
      if (!b.isStatic) b.applyImpulse(dx * 80, dy * 80, hit.x, hit.y);
      const p = d.prop;
      if (p.onBullet) { p.onBullet(dmg, hit, dx, dy, cause); return; }
      if (p instanceof Barrel) p.ignite();
      if (p instanceof Floater && p.armed) { p.armed = false; p.remove(); this.explode(b.x, b.y, 1.6, 'mine'); }
      if (p instanceof Crate && !p.metal) { p.strength -= 900; if (p.strength <= 0) p.breakApart(); }
      this.particles.sparks(hit.x, hit.y, -dx, -dy, 4);
      return;
    }
    this.particles.dust(hit.x, hit.y, -dx, 1, 2, this.dustColor);
  }

  // попадание пули анархиста по транспорту игрока: вмятина, трещина в стекле, пробитый бак
  onPlayerShot(hit, dx, dy, owner) {
    const v = this.vehicle;
    if (!v) return;
    this.particles.sparks(hit.x, hit.y, -dx, -dy, 7);
    AUDIO.ricochet(clamp((hit.x - this.camX) / 25, -1, 1));
    this.hurtFlash = Math.max(this.hurtFlash, 0.45);
    this.shake(0.07);
    if (v.dmg) {
      v.dmg.apply(hit.x, hit.y, dx, dy, 0.03, { bullet: true });
      if (Math.random() < 0.25 && v.dmg.glass < 1) {
        const c = v.chassis, loc = c.worldToLocal(hit.x, hit.y);
        v.dmg._glass(1, loc.x + c.com.x, loc.y + c.com.y);
      }
    }
    // бак: у брони пробивается реже и течёт меньше
    const armor = (v.up.armor || 0) + (v.def.armored ? 3 : 0);
    if (Math.random() < 0.8 - armor * 0.08) {
      const first = !(v.leakT > 0);
      v.leakT = Math.min(7, (v.leakT || 0) + 1.8 * (1 - armor * 0.09));
      if (first && !this.demo && !this._leakMsg) { this._leakMsg = true; this.message('БАК ПРОБИТ!', { color: '#ffae1a', life: 1.2, size: 36, sub: 'топливо утекает' }); }
    }
  }

  onRaiderBoatDestroyed(boat, x, y) {
    if (this.demo) return;
    const reward = Math.round(160 * this.killMult);
    this.killMoney += reward;
    this.kills++;
    this.particles.text(x, y + 2.5, '+$' + reward, '#ff9a3a', 1.5);
    this.message('КАТЕР ПОТОПЛЕН!', { color: '#ff7a3a', sub: '+$' + reward, life: 1.3 });
    AUDIO.cash();
  }

  explode(x, y, power, src) {
    this.particles.explosion(x, y, power);
    AUDIO.explosion(power, clamp((x - this.camX) / 20, -1, 1));
    const dist = Math.hypot(x - this.camX, y - this.camY);
    this.shake(clamp(1.2 - dist / 40, 0.1, 1) * power);
    this.whiteFlash = Math.max(this.whiteFlash, clamp(1 - dist / 50, 0, 0.8));
    const R = 7 * power;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const dx = z.body.x - x, dy = z.body.y - y, d = Math.hypot(dx, dy);
      if (d < R) {
        const k = (1 - d / R) * 22 * power;
        z.kill(dx / (d || 1) * k, Math.abs(dy / (d || 1)) * k + 6, 'explosion');
      }
    }
    for (const b of this.world.queryRadius(x, y, R, CAT.PROP | CAT.RAGDOLL | CAT.CHASSIS | CAT.WHEEL | CAT.DEBRIS)) {
      const dx = b.x - x, dy = b.y - y, d = Math.max(0.5, Math.hypot(dx, dy));
      let k = (1 - Math.min(1, d / R)) * 18 * power;
      const isVeh = b.data && (b.data.kind === 'vehicle' || b.data.kind === 'wheel' || b.data.kind === 'rider');
      if (isVeh) {
        const veh = b.data.vehicle;
        if (veh && veh.dmg && b === veh.chassis) veh.dmg.blast(x, y, (1 - Math.min(1, d / R)) * power);
        // взрыв подбрасывает транспорт вверх (как в Earn to Die), а не отбрасывает назад и не гасит скорость
        k *= 0.35;
        b.vx += dx / d * k * (dx < 0 ? 0.25 : 0.6);
        b.vy += k * 1.1;
      } else {
        b.vx += dx / d * k; b.vy += Math.abs(dy / d) * k + k * 0.3;
      }
      b.w += (Math.random() - 0.5) * k * 0.5;
      const p = b.data && b.data.prop;
      if (p instanceof Barrel) p.ignite();
      if (p instanceof Crate && d < R * 0.6) p.breakApart();
      if (p instanceof Wreck) p.burning = true;
      if (p && p.onBlast) p.onBlast((1 - Math.min(1, d / R)) * power);
    }
    for (const r of this.ragdolls) r.age = Math.min(r.age, 1);
  }

  /* ------------------------------ шаг ------------------------------ */
  step(h, input) {
    const W = this.world;
    for (const b of W.bodies) b.savePrev();
    let inp = input;
    if (this.demo) inp = this._autopilot();
    if (this.state !== 'drive' && !this.demo) inp = { gas: false, brake: false, left: false, right: false, boost: false };
    this.vehicle.update(h, inp);
    // финиш: доводчик плавно заводит транспорт в точку остановки внутри здания
    if (this.state === 'complete' && this.finish && !this.demo) {
      const v = this.vehicle, c = v.chassis;
      const target = this.finish.x + this.finish.stopX;
      const dist = target - c.x;
      const desired = dist > 0 ? Math.min(10, Math.sqrt(2 * 7 * dist)) : 0;
      const dv = clamp(c.vx - desired, -8 * h, 70 * h);
      if (Math.abs(dist) < 0.25 && Math.abs(c.vx) < 0.3) { for (const b of v.bodies) b.vx *= 0.8; }
      else for (const b of v.bodies) b.vx -= dv;
    }
    for (const z of this.zombies) z.update(h);
    for (const p of this.props) if (!p.dead) p.update(h);
    for (const r of this.ragdolls) r.update(h);
    W.step(h);
    this._afterStep(h);
  }

  _autopilot() {
    const v = this.vehicle, c = v.chassis;
    let a = c.a; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
    return { gas: true, brake: false, left: v.airborne && a < -0.25, right: v.airborne && a > 0.25, boost: false };
  }

  _afterStep(h) {
    const v = this.vehicle, c = v.chassis;
    if (v.postStep) v.postStep(h);
    // удары по кузову
    if (c.maxImpulse > c.mass * 2.2) {
      const other = c.maxImpulseOther;
      const s = clamp(c.maxImpulse / (c.mass * 10), 0, 1);
      if (!other || !other.data || other.data.kind !== 'ragdoll') {
        if (other && other.data && other.data.kind === 'prop') AUDIO.metal(s); else AUDIO.impact(s * 0.8);
        if (s > 0.35) this.shake(s * 0.3);
      }
    }
    // тяжёлые предметы, протолкнутые слишком далеко, сминаются в хлам
    for (const p of this.props) {
      if (p.dead || !p.crushDist) continue;
      const b = p.body || (p.bodies && p.bodies[0]);
      if (!b || b.removed) continue;
      if (Math.abs(b.x - p.spawnX) > p.crushDist) p.crush();
    }
    // зомби, получившие сильный удар (ящиком, обломком)
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const imp = z.body.maxImpulse, o = z.body.maxImpulseOther;
      if (imp > z.t.mass * 9 && o && o.data && o.data.kind !== 'vehicle' && o.data.kind !== 'wheel' && o !== this.world.ground) {
        z.kill(o.vx * 0.8, o.vy * 0.5 + 3, 'prop');
      }
    }
    // брызги при падении объектов в воду
    const Wt = this.world.water;
    if (Wt) {
      for (const b of this.world.bodies) {
        if (b.isStatic || b.buoyancy <= 0) continue;
        const inW = b.submerged > 0.05;
        if (inW && !b._inW && b.vy < -4 && b !== c) {
          this.particles.splash(b.x, Wt.height(b.x, this.world.time), b.vx, clamp(b.mass / 300, 0.3, 1.5) * clamp(-b.vy / 8, 0.3, 1.5));
          if (Math.abs(b.x - this.camX) < 30) AUDIO.splash(0.3);
        }
        b._inW = inW;
      }
    }
  }

  /* ------------------------------ кадр ------------------------------ */
  frame(dt, input) {
    const v = this.vehicle, c = v.chassis;
    this.frameDt = dt;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 0.001), 0.05);
    // замедление
    if (this._slowT > 0) { this._slowT -= dt; if (this._slowT <= 0) this.slowTarget = 1; }
    this.slowmo += (this.slowTarget - this.slowmo) * Math.min(1, dt * 6);
    const sdt = dt * this.slowmo;
    this.particles.update(sdt, this.world);
    for (const d of this.debris) d.life -= sdt * 0.5;
    if (this.debris.length && this.debris[0].life < 0) { const d = this.debris.shift(); this.world.remove(d.body); }

    this._spawn();
    this._cleanup();

    // камера
    const sp = v.speed();
    const look = clamp(c.vx * 0.45, -6, 13);
    let tx = c.x + look + 3, ty = c.y + 1.8 + clamp(c.vy * 0.12, -3, 3);
    if (this.state === 'complete' && this.finish && !this.demo) {
      // показываем здание целиком, пока закрываются ворота
      tx = this.finish.x + (this.finish.kind === 'shipramp' ? 13 : 8);
      ty = this.finish.y + 3.5;
    }
    const k = 1 - Math.exp(-dt * 4.5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * (1 - Math.exp(-dt * 3));
    const H = Math.max(200, window.innerHeight || 720);
    const viewH = lerp(this.world.water ? 21 : 18, this.world.water ? 30 : 28, clamp(sp / 32, 0, 1)) + (v.boosting ? 2.5 : 0) + (v.def.id === 'jugg' ? 2 : 0);
    const targetZoom = H / viewH;
    this.zoom += (targetZoom - this.zoom) * (1 - Math.exp(-dt * 1.5));
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    const sa = this.shakeAmt * this.shakeAmt * 0.9;
    this.shakeX = (Math.random() - 0.5) * sa; this.shakeY = (Math.random() - 0.5) * sa;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2.5);
    this.comboT -= dt; this.comboPulse -= dt * 4;
    if (this.msg) this.msg.t -= dt;

    if (this.demo) { this._demoRules(dt); return; }

    // полёт
    if (v.airborne) this.airT += sdt;
    else {
      if (this.airT > 1.6 && this.state === 'drive') {
        const r = Math.round(this.airT * 18 * this.killMult);
        this.stuntMoney += r;
        this.particles.text(c.x, c.y + 3, `ПОЛЁТ ${this.airT.toFixed(1)}с  +$${r}`, '#6fd0ff', 1.1);
      }
      this.airT = 0;
    }

    // дистанция и правила
    this.distance = Math.max(0, c.x - this.startX);
    if (this.state === 'drive') {
      this.maxDistance = Math.max(this.maxDistance, Math.min(this.distance, this.level.length));
      if (this.distance >= this.level.length) return this.complete();
      if (v.fuel <= 0) {
        if (!this._fuelMsg) { this._fuelMsg = true; this.message('ТОПЛИВО КОНЧИЛОСЬ', { color: '#ff7a3a', life: 2.2 }); }
        if (sp < 0.9 || (v.type === 'boat' && sp < 1.5)) this.fuelT += dt; else this.fuelT = 0;
        if (this.fuelT > 1.3) return this.endRun('fuel');
      }
      if (sp < 0.35 && !input.gas) this.stuckT += dt;
      else if (sp < 0.35) this.stuckT += dt * 0.5;
      else this.stuckT = 0;
      if (this.stuckT > 6) return this.endRun('stuck');
      if (c.cos < -0.3 && sp < 2.5 && v.type !== 'boat') this.flipT += dt; else this.flipT = 0;
      if (this.flipT > 2.2) return this.endRun('flip');
      if (v.type === 'boat' && c.cos < -0.2 && c.submerged > 0.2) this.flipT += dt;
      if (v.type === 'boat' && this.flipT > 3) return this.endRun('flip');
      if (v.crashed) { this.endT += dt; if (this.endT > 2.4) return this.endRun('crash'); }
      if (c.y < this.world.terrain.heightAt(c.x) - 25) return this.endRun('fall');
      // обрыв: провалился ниже края пропасти — конец заезда
      let inDeath = false;
      for (const d of this.deaths) if (c.x > d.x && c.x < d.x2 && c.y < d.rim - 4) inDeath = true;
      if (inDeath) { this.deathT += dt; if (this.deathT > 0.9) return this.endRun('fall'); } else this.deathT = 0;
      // лавина
      const av = this.avalanche;
      if (av && !av.done) {
        if (!av.active && c.x > av.x) {
          av.active = true; av.wallX = c.x - 70;
          this.message('ЛАВИНА!', { color: '#e8f2ff', sub: 'не сбавляй скорость', life: 2.2 });
          AUDIO.thunder(); this.shake(0.5);
        }
        if (av.active) {
          av.speed = Math.min(19, av.speed + dt * 0.12);
          av.wallX += av.speed * dt;
          av.rumbleT -= dt;
          if (av.rumbleT < 0) { av.rumbleT = 0.9; AUDIO.noiseBurst({ dur: 1.2, vol: clamp(0.5 - (c.x - av.wallX) / 120, 0.08, 0.5), freq: 260, freqEnd: 60, brown: true }); }
          this.shake(clamp(0.25 - (c.x - av.wallX) / 200, 0, 0.25) * dt * 8);
          if (Math.random() < 0.8) this.particles.add({ type: 'smoke', x: av.wallX + Math.random() * 3, y: this.world.terrain.heightAt(av.wallX) + Math.random() * 10, vx: av.speed * 0.8, vy: 1 + Math.random() * 2, g: 0, drag: 1.5, life: 1.4, size: 1 + Math.random(), grow: 1.5, color: 'rgba(235,242,250,', alpha: 0.7 });
          if (av.wallX > c.x - 1.5) return this.endRun('avalanche');
          if (c.x > av.x2 + 40) { av.done = true; this.message('ОТОРВАЛСЯ!', { color: '#9fe06a', life: 1.4 }); }
        }
      }
      if (v.type !== 'boat' && this.world.water && c.submerged > 0.6) { this.sinkT += dt; if (this.sinkT > 2) return this.endRun('sink'); }
      if (v.type === 'boat' && c.submerged > 0.9) { this.sinkT += dt; if (this.sinkT > 3) return this.endRun('sink'); } else if (v.type === 'boat') this.sinkT = 0;
    } else {
      this.endT += dt;
      let ready = this.endT > 1.8;
      if (this.state === 'complete') {
        const f = this.finish;
        if (f) {
          const inside = c.x > f.x + 2.5 && v.speed() < 4;
          if (f.kind === 'helipad') f.doorK = 1;
          else if (inside || this.endT > 3) {
            if (!f.closing) { f.closing = true; AUDIO.metal(0.6); }
            f.doorK = Math.min(1, f.doorK + dt / 1.1);
            if (Math.random() < 0.15) AUDIO.metal(0.25);
          }
          ready = f.doorK >= 1 && this.endT > 2.2;
          if (this.endT > 7) ready = true;
        } else ready = this.endT > 2.6;
      }
      if (ready && !this._reported) {
        this._reported = true;
        this.app.onRunEnd(this.summary());
      }
    }
  }

  _demoRules(dt) {
    const v = this.vehicle;
    if (v.speed() < 0.5) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 2.5 || v.chassis.cos < -0.3 || v.chassis.x > this.level.length) this.needRestart = true;
  }

  complete() {
    this.state = 'complete';
    this.endT = 0;
    this.completed = true;
    this.slowTarget = 0.35; this._slowT = 1.1;
    this.message('ФИНИШ!', { color: '#9fe06a', life: 2.6, size: 64, sub: this.level.name });
    AUDIO.levelComplete();
  }

  endRun(reason) {
    this.state = 'ended';
    this.endT = 0;
    this.reason = reason;
    const texts = { fuel: 'ЗАЕЗД ОКОНЧЕН', stuck: 'ЗАСТРЯЛ', flip: 'ПЕРЕВЕРНУЛСЯ', crash: 'АВАРИЯ', fall: 'СОРВАЛСЯ', sink: 'ЗАТОНУЛ', avalanche: 'НАКРЫЛО ЛАВИНОЙ' };
    this.message(texts[reason] || 'ЗАЕЗД ОКОНЧЕН', { color: '#ff7a3a', life: 1.9 });
    this.slowTarget = 0.6; this._slowT = 1;
  }

  summary() {
    const distMoney = Math.floor(this.maxDistance * this.cashPerMeter);
    const bonus = this.completed ? Math.round(600 * (1 + this.levelIndex * 0.45)) : 0;
    return {
      level: this.levelIndex, vehicle: this.vehicle.def.id,
      distance: Math.floor(this.maxDistance), distMoney,
      kills: this.kills, killMoney: this.killMoney,
      stuntMoney: this.stuntMoney, flips: this.flips, pickupMoney: this.pickupMoney,
      bonus, total: distMoney + this.killMoney + this.stuntMoney + this.pickupMoney + bonus,
      complete: !!this.completed, reason: this.reason
    };
  }

  _spawn() {
    const ahead = this.camX + 75;
    while (this.spawnIdx < this.spawns.length && this.spawns[this.spawnIdx].x < ahead) {
      const s = this.spawns[this.spawnIdx++];
      if (s.x < this.camX - 50) continue;
      const obj = s.make(this);
      if (!obj || s.kind === 'pickup') continue;
      if (obj instanceof Zombie) { this.zombies.push(obj); if (obj.raider) this.raiders.push(obj); }
      else this.props.push(obj);
    }
  }

  _cleanup() {
    const left = this.camX - 70;
    let w = 0;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (z.body.x < left) { z.remove(); continue; }
      this.zombies[w++] = z;
    }
    this.zombies.length = w;
    this.raiders = this.raiders.filter(r => r.alive);
    w = 0;
    for (const p of this.props) {
      if (p.dead) continue;
      const px = p.maxX !== undefined ? p.maxX : p.x;
      if (px < left) { p.remove(); continue; }
      this.props[w++] = p;
    }
    this.props.length = w;
    w = 0;
    let active = 0;
    for (let i = this.ragdolls.length - 1; i >= 0; i--) if (!this.ragdolls[i].frozen) active++;
    for (const r of this.ragdolls) {
      if (r.x < left || r.dead) { r.remove(); continue; }
      if (!r.frozen && active > 28 && r !== this.vehicle.riderRagdoll) { r.freeze(); active--; }
      this.ragdolls[w++] = r;
    }
    this.ragdolls.length = w;
    if (this.ragdolls.length > 80) { const r = this.ragdolls.shift(); r.remove(); }
  }
}
