'use strict';
/* Транспорт: машины, байки, лодки — определения, физическая сборка, управление, отрисовка */

const UPGRADE_KEYS = ['engine', 'gearbox', 'tires', 'armor', 'fuel', 'boost', 'gun'];
const UPGRADE_MAX = { engine: 5, gearbox: 4, tires: 4, armor: 5, fuel: 5, boost: 4, gun: 4 };
const UPGRADE_COST_MULT = [1, 1.9, 3.3, 5.2, 7.8];
const UPGRADE_WEIGHT = { engine: 1.2, gearbox: 0.9, tires: 0.8, armor: 1.0, fuel: 0.7, boost: 1.3, gun: 1.4 };
const UPGRADE_NAMES = {
  car: { engine: 'Двигатель', gearbox: 'Коробка передач', tires: 'Колёса и подвеска', armor: 'Броня', fuel: 'Топливный бак', boost: 'Ракетный ускоритель', gun: 'Пулемёт на крыше' },
  bike: { engine: 'Двигатель', gearbox: 'Трансмиссия', tires: 'Подвеска', armor: 'Защитная рама', fuel: 'Топливный бак', boost: 'Закись азота', gun: 'Обрез' },
  boat: { engine: 'Лодочный мотор', gearbox: 'Обтекаемый корпус', tires: 'Гребной винт', armor: 'Носовой таран', fuel: 'Топливный бак', boost: 'Водомётная турбина', gun: 'Турель' }
};
const UPGRADE_DESC = {
  engine: 'Больше мощности и максимальной скорости',
  gearbox: 'Резвее разгон с места и на подъёмах',
  tires: 'Лучше сцепление и мягче приземление',
  armor: 'Зомби меньше тормозят, давить их проще',
  fuel: 'Больше топлива — дальше заезд',
  boost: 'Мощный рывок вперёд (Shift/Пробел)',
  gun: 'Автоматически стреляет по зомби впереди'
};

const VEHICLES = [
  {
    id: 'rust', type: 'car', name: 'Ржавчик', desc: 'Старый хэтчбек из мастерской Алекса. Держится на честном слове и изоленте.',
    price: 0, unlock: 0, cost: 90,
    color: '#b8612f', color2: '#d8c9a3', rim: '#8d8f93', rust: true,
    look: { rear: -1.95, front: 1.95, bottom: -0.32, belt: 0.38, hood: 0.1, trunk: 0.12, roof: 1.12, cr: -1.55, cf: 0.55, rr: -1.2, rf: -0.05, style: 'hatch' },
    hull: [[[-1.95, -0.3], [1.95, -0.3], [1.95, 0.35], [-1.95, 0.5]], [[-1.5, 0.45], [0.6, 0.45], [0.0, 1.1], [-1.25, 1.1]]],
    com: [0, -0.05],
    mass: 950, wheels: [{ x: -1.25, y: -0.38, r: 0.43, drive: true, m: 35 }, { x: 1.28, y: -0.38, r: 0.43, drive: true, m: 35 }],
    susp: { freq: 3.4, damp: 0.45, lower: -0.28, upper: 0.16 },
    torque: 1150, topSpeed: 22, grip: 1.05, fuel: 14, killSpeed: 9, tilt: 4.2, boostPower: 13, driver: '#e0b48a'
  },
  {
    id: 'mule', type: 'car', name: 'Мул', desc: 'Фермерский пикап с высоким клиренсом. В кузов влезет всё, даже надежда.',
    price: 2600, unlock: 1, cost: 160,
    color: '#3b6e8f', color2: '#e8e2d0', rim: '#c7c9cc', offroad: true,
    look: { rear: -2.5, front: 2.4, bottom: -0.2, belt: 0.55, hood: 0.12, trunk: 0.0, roof: 1.45, cr: -0.35, cf: 1.05, rr: -0.25, rf: 0.55, style: 'pickup' },
    hull: [[[-2.5, -0.18], [2.4, -0.18], [2.4, 0.6], [-2.5, 0.65]], [[-0.4, 0.6], [1.15, 0.6], [0.6, 1.45], [-0.3, 1.45]]],
    com: [0.15, 0.05],
    mass: 1350, wheels: [{ x: -1.62, y: -0.42, r: 0.52, drive: true, m: 50 }, { x: 1.62, y: -0.42, r: 0.52, drive: true, m: 50 }],
    susp: { freq: 2.7, damp: 0.42, lower: -0.38, upper: 0.2 },
    torque: 2300, topSpeed: 25, grip: 1.12, fuel: 12, killSpeed: 8, tilt: 3.8, boostPower: 13, driver: '#8a5a3c'
  },
  {
    id: 'bull', type: 'car', name: 'Бультерьер', desc: 'Американский маслкар. Восемь цилиндров чистой ярости.',
    price: 7800, unlock: 5, cost: 300,
    color: '#1d1f24', color2: '#e8b21e', rim: '#d9a520', stripes: true,
    look: { rear: -2.35, front: 2.35, bottom: -0.28, belt: 0.3, hood: 0.04, trunk: 0.06, roof: 0.92, cr: -1.25, cf: 0.45, rr: -0.85, rf: -0.15, style: 'muscle' },
    hull: [[[-2.35, -0.26], [2.35, -0.26], [2.35, 0.25], [-2.35, 0.38]], [[-1.3, 0.35], [0.5, 0.35], [-0.15, 0.92], [-0.85, 0.92]]],
    com: [0, -0.1],
    mass: 1250, wheels: [{ x: -1.5, y: -0.36, r: 0.47, drive: true, m: 45 }, { x: 1.45, y: -0.38, r: 0.44, drive: true, m: 40 }],
    susp: { freq: 3.8, damp: 0.5, lower: -0.22, upper: 0.14 },
    torque: 2600, topSpeed: 30, grip: 1.1, fuel: 15, killSpeed: 7.5, tilt: 4.0, boostPower: 15, driver: '#f1c7a0'
  },
  {
    id: 'jugg', type: 'car', name: 'Джаггернаут', desc: 'Бронированный инкассаторский грузовик. Дверь толщиной с книгу.',
    price: 16500, unlock: 11, cost: 520,
    color: '#4e5a3a', color2: '#2b2f24', rim: '#50554a', offroad: true, armored: true,
    look: { rear: -2.9, front: 2.75, bottom: -0.1, belt: 0.75, hood: 0.15, trunk: 0.9, roof: 2.0, cr: -2.9, cf: 1.35, rr: -2.9, rf: 1.05, style: 'truck' },
    hull: [[[-2.9, -0.08], [2.75, -0.08], [2.75, 0.9], [-2.9, 0.9]], [[-2.9, 0.85], [1.4, 0.85], [1.05, 2.0], [-2.9, 2.0]]],
    com: [0.1, 0.25],
    mass: 2600, wheels: [{ x: -1.95, y: -0.5, r: 0.66, drive: true, m: 90 }, { x: 1.85, y: -0.5, r: 0.66, drive: true, m: 90 }],
    susp: { freq: 2.5, damp: 0.5, lower: -0.35, upper: 0.2 },
    torque: 6200, topSpeed: 30, grip: 1.15, fuel: 58, killSpeed: 5.5, tilt: 3.2, boostPower: 13, driver: '#c99872'
  },
  {
    id: 'rhino', type: 'car', name: 'Носорог', desc: 'Армейский бронетранспортёр из ангара «Северной звезды». Шесть тонн упрямства.',
    price: 0, unlock: 14, cost: 700,
    color: '#5b6640', color2: '#2f3522', rim: '#3d4236', offroad: true, armored: true, military: true,
    look: { rear: -3.1, front: 3.0, bottom: -0.05, belt: 0.8, hood: 0.2, trunk: 0.9, roof: 2.1, cr: -3.1, cf: 1.6, rr: -3.1, rf: 1.2, style: 'truck' },
    hull: [[[-3.1, -0.03], [3.0, -0.03], [3.0, 0.95], [-3.1, 0.95]], [[-3.1, 0.9], [1.65, 0.9], [1.2, 2.1], [-3.1, 2.1]]],
    com: [0.1, 0.3],
    mass: 3200, wheels: [{ x: -2.1, y: -0.5, r: 0.72, drive: true, m: 110 }, { x: 2.05, y: -0.5, r: 0.72, drive: true, m: 110 }],
    susp: { freq: 2.4, damp: 0.5, lower: -0.38, upper: 0.22 },
    torque: 8600, topSpeed: 33, grip: 1.18, fuel: 30, killSpeed: 4.5, tilt: 3.0, boostPower: 13, driver: '#b58b69'
  },
  {
    id: 'hopper', type: 'bike', name: 'Кузнечик', desc: 'Лёгкий эндуро. Прыгает как кузнечик, падает как кирпич.',
    price: 4200, unlock: 3, cost: 220,
    color: '#e0551b', color2: '#222', rim: '#bbb',
    hull: [[[-0.65, -0.12], [0.55, -0.12], [0.72, 0.42], [-0.55, 0.42]]],
    com: [0, 0.05],
    mass: 190, wheels: [{ x: -0.74, y: -0.36, r: 0.37, drive: true, m: 11 }, { x: 0.78, y: -0.36, r: 0.37, drive: false, m: 9 }],
    susp: { freq: 2.1, damp: 0.62, droop: 0.14, comp: 0.26 },
    torque: 330, topSpeed: 22, grip: 1.25, fuel: 24, killSpeed: 8, tilt: 9, boostPower: 14, driver: '#2f6fbf',
    bikeStyle: 'enduro',
    // физика мотоцикла: рама + гонщик на шарнире (перенос веса) + вилка под углом
    bike: {
      skid: [[-0.42, -0.1], [0.38, -0.1], [0.32, 0.28], [-0.36, 0.3]],
      frameMass: 115, frameCom: [0.02, 0.12], frameInertia: 30,
      riderMass: 72, riderInertia: 7, rake: 0.42,
      leanTorque: 700, leanAngle: 0.6, airAssist: 6.5, maxAirW: 5.5, groundLean: 0.26
    }
  },
  {
    id: 'hound', type: 'bike', name: 'Цербер', desc: 'Тяжёлый чоппер байкерского клуба «Цербер». Длинная вилка, короткий фитиль.',
    price: 11000, unlock: 8, cost: 400,
    color: '#7a0f14', color2: '#ccc', rim: '#e6e6e6',
    hull: [[[-0.9, -0.1], [0.6, -0.1], [0.8, 0.45], [-0.8, 0.4]]],
    com: [-0.05, 0.0],
    mass: 280, wheels: [{ x: -1.05, y: -0.3, r: 0.4, drive: true, m: 15 }, { x: 1.2, y: -0.34, r: 0.38, drive: false, m: 12 }],
    susp: { freq: 2.3, damp: 0.6, droop: 0.1, comp: 0.2 },
    torque: 620, topSpeed: 25, grip: 1.2, fuel: 17, killSpeed: 7.5, tilt: 7.5, boostPower: 16, driver: '#222',
    bikeStyle: 'chopper',
    bike: {
      skid: [[-0.62, -0.08], [0.5, -0.08], [0.45, 0.26], [-0.56, 0.28]],
      frameMass: 195, frameCom: [-0.05, 0.1], frameInertia: 70,
      riderMass: 80, riderInertia: 8, rake: 0.6,
      leanTorque: 950, leanAngle: 0.5, airAssist: 5.2, maxAirW: 4.8, groundLean: 0.22
    }
  },
  {
    id: 'gull', type: 'boat', name: 'Чайка', desc: 'Алюминиевая рыбацкая лодка с подвесным мотором. Пахнет рыбой и бензином.',
    price: 0, unlock: 9, cost: 260,
    color: '#dfe6ea', color2: '#2d6b8a', rim: '#555',
    hull: [[[-2.1, -0.15], [-0.6, -0.5], [1.2, -0.42], [2.35, 0.35], [2.2, 0.5], [-2.1, 0.5]]],
    samples: 'boat', com: [-0.1, -0.12],
    mass: 520, thrust: 7.5, topSpeed: 17, fuel: 50, killSpeed: 8, tilt: 4.5, boostPower: 12,
    prop: [-2.35, -0.45], driver: '#d7a784', boatStyle: 'skiff', buoyancy: 3.1
  },
  {
    id: 'cuda', type: 'boat', name: 'Барракуда', desc: 'Гоночный катер контрабандистов. Скользит над волнами, почти не касаясь воды.',
    price: 9500, unlock: 9, cost: 420,
    color: '#f2f2f2', color2: '#d1261f', rim: '#333',
    hull: [[[-2.6, -0.1], [-1.0, -0.45], [1.5, -0.4], [3.0, 0.3], [2.8, 0.45], [-2.6, 0.45]]],
    samples: 'boat', com: [-0.2, -0.1],
    mass: 700, thrust: 10, topSpeed: 26, fuel: 50, killSpeed: 7, tilt: 4.2, boostPower: 14,
    prop: [-2.7, -0.35], driver: '#e3b996', boatStyle: 'speed', buoyancy: 3.0
  },
  {
    id: 'clad', type: 'boat', name: 'Броненосец', desc: 'Патрульный катер береговой охраны. Сталь, дизель и пулемётное гнездо.',
    price: 19000, unlock: 12, cost: 600,
    color: '#5d6b73', color2: '#e3e3e3', rim: '#333', armored: true,
    hull: [[[-3.2, -0.1], [-1.4, -0.65], [1.8, -0.6], [3.6, 0.45], [3.4, 0.7], [-3.2, 0.7]]],
    samples: 'boat', com: [-0.1, -0.2],
    mass: 1600, thrust: 9, topSpeed: 24, fuel: 60, killSpeed: 5, tilt: 3.4, boostPower: 12,
    prop: [-3.3, -0.45], driver: '#b98a66', boatStyle: 'patrol', buoyancy: 3.0
  }
];
const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map(v => [v.id, v]));

function upgradeCost(def, key, level) {
  return Math.round(def.cost * UPGRADE_WEIGHT[key] * UPGRADE_COST_MULT[level] / 10) * 10;
}

function vehicleStats(def, up) {
  const u = k => (up && up[k]) || 0;
  return {
    torque: (def.torque || 0) * (1 + 0.32 * u('engine')),
    thrust: (def.thrust || 0) * (1 + 0.24 * u('engine')),
    topSpeed: def.topSpeed * (1 + 0.07 * u('engine') + 0.03 * u('gearbox')),
    lowGear: 1 + 0.25 * u('gearbox'),
    grip: (def.grip || 1) * (1 + 0.07 * u('tires')),
    suspFreq: def.susp ? def.susp.freq * (1 + 0.03 * u('tires')) : 0,
    suspDamp: def.susp ? def.susp.damp + 0.05 * u('tires') : 0,
    suspTravel: 1 + 0.08 * u('tires'),
    propEff: 1 + 0.12 * u('tires'),
    hullDrag: 1 - 0.08 * u('gearbox'),
    killSpeed: def.killSpeed * (1 - 0.1 * u('armor')),
    plow: 0.25 + 0.13 * u('armor'),
    fuel: def.fuel * (1 + 0.34 * u('fuel')),
    boost: u('boost') ? 2.2 + 1.3 * u('boost') : 0,
    boostPower: def.boostPower * (1 + 0.1 * u('boost')),
    gun: u('gun'),
    ammo: u('gun') ? 20 + u('gun') * 18 : 0,
    fireRate: 0.32 - u('gun') * 0.045,
    gunDamage: 1 + u('gun') * 0.6,
    armor: u('armor')
  };
}

function boatSamples(def) {
  const h = def.hull[0];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of h) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const out = [];
  const rows = [minY + 0.1, (minY + maxY) * 0.5, maxY];
  const N = 8;
  for (const ry of rows) for (let i = 0; i < N; i++) {
    const x = lerp(minX + 0.2, maxX - 0.4, i / (N - 1));
    // оставить только точки внутри корпуса (приблизительно)
    const bottom = hullBottomAt(h, x);
    out.push([x, Math.max(ry, bottom + 0.08)]);
  }
  return out;
}
function hullBottomAt(h, x) {
  let y = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      y = Math.min(y, a[1] + (b[1] - a[1]) * t);
    }
  }
  return y === Infinity ? 0 : y;
}

let _vehicleGroup = 5000;

class Vehicle {
  constructor(game, def, upgrades, x, y) {
    this.game = game;
    this.def = def;
    this.type = def.type;
    this.up = Object.assign({}, upgrades || {});
    this.st = vehicleStats(def, this.up);
    this.group = _vehicleGroup++;
    this.fuel = this.st.fuel; this.fuelMax = this.st.fuel;
    this.boost = this.st.boost; this.boostMax = this.st.boost;
    this.ammo = this.st.ammo; this.ammoMax = this.st.ammo;
    this.throttle = 0; this.brake = 0;
    this.boosting = false;
    this.gear = 1; this.rpm = 0; this.shiftTimer = 0;
    this.aim = 0; this.gunCooldown = 0; this.target = null;
    this.lean = 0; this.crashed = false; this.airTime = 0; this.airborne = false;
    this.flipAccum = 0; this.lastAngle = 0;
    this.wheels = []; this.joints = [];
    this.bloodSpots = [];
    this.exhaustT = 0;
    this.propSubmerged = false;
    this.headlights = true;
    // пассажир по сюжету: Мира сидит сзади на мотоцикле, в машине, стоит на палубе катера
    this.passenger = game.level && game.level.passenger ? game.level.passenger : null;
    this.mira = { aim: Math.PI, cd: 0.8, shells: 2, reload: 0, open: 0, recoil: 0, flash: 0 };
    this.build(x, y);
    this.lastAngle = this.chassis.a;
    // автомобиль: трансмиссия и модель повреждений
    if (this.type === 'car' && def.look) {
      this.dt = makeDrivetrain(def, this.st, this.up);
      this.dmg = new CarDamage(this);
      this.pitch = { a: 0, w: 0, prevV: 0, f: 0 };
      this.skid = 0;
    }
  }

  build(x, y) {
    if (this.type === 'bike' && this.def.bike) return this._buildBike(x, y);
    const W = this.game.world, def = this.def;
    const cat = CAT.CHASSIS;
    const samples = def.samples === 'boat' ? boatSamples(def) : undefined;
    this.chassis = W.add(new Body({
      x, y, shapes: def.hull.map(h => ({ type: 'poly', verts: h })),
      mass: def.mass, com: def.com, friction: 0.35, restitution: 0.05,
      cat, mask: CAT.ALL & ~CAT.RIDER, group: this.group,
      angDamp: this.type === 'boat' ? 0.6 : 0.25, linDamp: 0.01,
      buoyancy: def.buoyancy || (this.type === 'car' ? 0.55 : 0.5),
      samples, sampleDepth: this.type === 'boat' ? 0.3 : 0.4,
      waterDragF: this.type === 'boat' ? 0.55 * this.st.hullDrag : 1.2,
      waterDragN: this.type === 'boat' ? 3.2 : 2,
      waterAngDrag: this.type === 'boat' ? 2.5 : 2,
      data: { kind: 'vehicle', vehicle: this }
    }));
    if (this.type === 'boat') {
      // гидродинамика по форме корпуса
      const c0 = this.chassis;
      const verts = def.hull[0].map(p => [p[0] - c0.com.x, p[1] - c0.com.y]);
      let area = 0, minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < verts.length; i++) {
        const p = verts[i], q = verts[(i + 1) % verts.length];
        area += p[0] * q[1] - q[0] * p[1];
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      }
      area = Math.abs(area) * 0.5;
      const len = maxX - minX;
      const drag = this.st.hullDrag;
      c0.hydro = {
        verts, area, len,
        rho: c0.mass / (0.3 * area),        // в покое погружено ~30% корпуса
        k: c0.mass / len,
        cp1: 1.3 * drag, cp2: 0.16 * drag, fp: 1.6,   // давление на грань, входящую в воду
        cs1: 0.22 * drag, cs2: 0.012 * drag, fs: 1.0, // подсасывание грани, выходящей из воды
        cf: 0.005 * drag,                              // трение вдоль корпуса
        maxDecel: 9, maxAcc: 34, angDamp: 1.8
      };
    }
    if (def.wheels) {
      const perWheel = def.mass / def.wheels.length;
      const omega = 2 * Math.PI * this.st.suspFreq;
      for (const wd of def.wheels) {
        const p = this.chassis.worldPoint(wd.x, wd.y);
        const wheel = W.add(new Body({
          x: p.x, y: p.y, shapes: [{ type: 'circle', r: wd.r }], mass: wd.m,
          friction: this.st.grip, restitution: 0.02, cat: CAT.WHEEL, mask: CAT.ALL & ~CAT.RIDER,
          group: this.group, angDamp: 0.15, linDamp: 0.01, buoyancy: 0.7,
          data: { kind: 'wheel', vehicle: this }
        }));
        wheel.def = wd;
        const j = W.addJoint(new WheelJoint(this.chassis, wheel, p.x, p.y, {
          stiffness: perWheel * omega * omega,
          damping: 2 * perWheel * this.st.suspDamp * omega,
          lower: def.susp.lower * this.st.suspTravel, upper: def.susp.upper
        }));
        this.wheels.push(wheel); this.joints.push(j);
      }
    }
  }

  /* Мотоцикл по мотивам Trials / Elasto Mania:
     рама (низкий центр масс) + гонщик — отдельное тело на шарнире в седле (перенос веса),
     заднее колесо на маятнике, переднее — на вилке под углом, с землёй опасна только голова. */
  _buildBike(x, y) {
    const W = this.game.world, def = this.def, B = def.bike, st = this.st;
    this.chassis = W.add(new Body({
      x, y, shapes: [{ type: 'poly', verts: B.skid }],
      mass: B.frameMass, com: B.frameCom, inertia: B.frameInertia, friction: 0.4, restitution: 0.05,
      cat: CAT.CHASSIS, mask: CAT.ALL & ~CAT.RIDER, group: this.group,
      angDamp: 0.05, linDamp: 0.005, buoyancy: 0.5,
      data: { kind: 'vehicle', vehicle: this }
    }));
    const geo = riderGeometry(def);
    this.riderGeo = geo;
    const head = [geo.hip[0] + geo.head[0], geo.hip[1] + geo.head[1]];
    const torso = [geo.hip[0] + geo.head[0] * 0.45, geo.hip[1] + geo.head[1] * 0.45];
    this.rider = W.add(new Body({
      x, y, shapes: [{ type: 'circle', r: 0.19, x: head[0], y: head[1] }],
      mass: B.riderMass, com: torso, inertia: B.riderInertia, friction: 0.5, restitution: 0.05,
      cat: CAT.RIDER, mask: CAT.GROUND | CAT.STATIC | CAT.PROP, group: this.group,
      angDamp: 0.1, linDamp: 0.005, buoyancy: 0.8,
      data: { kind: 'rider', vehicle: this }
    }));
    const hip = this.chassis.worldPoint(geo.hip[0], geo.hip[1]);
    this.riderJoint = W.addJoint(new RevoluteJoint(this.chassis, this.rider, hip.x, hip.y, { lower: -0.75, upper: 0.75 }));
    this.riderJoint.maxMotorTorque = B.leanTorque;
    // колёса: подрессоренная масса делится поровну
    const sprung = (B.frameMass + B.riderMass) / 2;
    const omega = 2 * Math.PI * st.suspFreq;
    const k = sprung * omega * omega, cdamp = 2 * sprung * st.suspDamp * omega;
    const sag = sprung * -PHYS.gravity / k;
    def.wheels.forEach((wd, i) => {
      const front = i === 1;
      const ax = front ? -Math.sin(B.rake) : 0, ay = front ? Math.cos(B.rake) : 1;
      const p = this.chassis.worldPoint(wd.x, wd.y);
      const wheel = W.add(new Body({
        x: p.x, y: p.y, shapes: [{ type: 'circle', r: wd.r }], mass: wd.m,
        friction: st.grip, restitution: 0.02, cat: CAT.WHEEL, mask: CAT.ALL & ~CAT.RIDER,
        group: this.group, angDamp: 0.08, linDamp: 0.005, buoyancy: 0.7,
        data: { kind: 'wheel', vehicle: this }
      }));
      wheel.def = wd;
      // точка крепления сдвинута на величину просадки: под весом колесо встаёт ровно на своё место
      const j = W.addJoint(new WheelJoint(this.chassis, wheel, p.x - ax * sag, p.y - ay * sag, {
        axisX: ax, axisY: ay, stiffness: k, damping: cdamp,
        lower: sag - def.susp.droop, upper: sag + def.susp.comp * st.suspTravel
      }));
      this.wheels.push(wheel); this.joints.push(j);
    });
  }

  riderLean(alpha) {
    if (!this.rider) return 0;
    let rel = (alpha === undefined ? this.rider.a - this.chassis.a : this.rider.ia(alpha) - this.chassis.ia(alpha)) - this.riderJoint.refAngle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return rel;
  }

  _bikeControl(h, tilt, inAir) {
    const c = this.chassis, R = this.rider, j = this.riderJoint, B = this.def.bike;
    if (!R || this.crashed) return;
    // перенос веса: гонщик плавно наклоняется к целевому углу
    const rel = this.riderLean();
    let ang = c.a % (Math.PI * 2); if (ang > Math.PI) ang -= Math.PI * 2; if (ang < -Math.PI) ang += Math.PI * 2;
    if (inAir) {
      // в прыжке гонщик держит нейтральную посадку: отдача от переноса веса не должна крутить байк против нажатия
      j.motorSpeed = clamp(-rel * 6, -4, 4);
      j.maxMotorTorque = B.leanTorque * 0.8;
    } else {
      let target = tilt * B.leanAngle;
      // на вилли (или стоппи) гонщик не откидывается дальше — корпус остаётся над седлом
      if (target * ang > 0) target *= clamp(1 - Math.abs(ang) / 0.9, 0.1, 1);
      j.motorSpeed = clamp((target - rel) * 12, -8, 8);
      j.maxMotorTorque = B.leanTorque;
    }
    const mTot = c.mass + R.mass + this.wheels.reduce((s, w) => s + w.mass, 0);
    const base = Math.abs(this.def.wheels[1].x - this.def.wheels[0].x);
    if (inAir) {
      // в воздухе — «вольтинг»: вращение байка вместе с гонщиком, с ограничением угловой скорости
      if (tilt) {
        const dx = R.x - c.x, dy = R.y - c.y;
        const Isys = c.I + R.I + R.mass * (dx * dx + dy * dy) + this.wheels.reduce((s, w) => s + w.mass * ((w.x - c.x) ** 2 + (w.y - c.y) ** 2), 0);
        const wDir = c.w * tilt;
        if (wDir < B.maxAirW) c.t += tilt * B.airAssist * Isys * clamp((B.maxAirW - wDir) / 1.5, 0.15, 1) * (wDir < 0 ? 1.4 : 1);
      } else {
        c.w *= 1 - h * 0.35;
      }
    } else {
      // на земле перенос веса поднимает или прижимает переднее колесо (как в Trials)
      if (tilt) {
        let k = 1;
        if (ang * tilt > 0.35) k = clamp(1 - (ang * tilt - 0.35) * 2.2, 0, 1);
        c.t += tilt * mTot * -PHYS.gravity * base * B.groundLean * k;
      }
      // нос поднимается слишком быстро — гонщик гасит вращение (иначе на мощном моторе перекрутит назад)
      if (ang > 0.15 && c.w > 1.2 && this.wheels[0].contactCount > 0) c.t -= (c.I + R.I + R.mass * 0.5) * (c.w - 1.2) * 9;
      // отпустил наклон на вилли — гонщик мягко возвращает вес вперёд, нос опускается
      if (!tilt && ang > 0.3) c.t -= mTot * -PHYS.gravity * base * 0.1 * Math.min(1, (ang - 0.3) * 2);
      // точка баланса вилли: выше ~60° гонщик сам уводит вес вперёд и гасит вращение
      const over = Math.abs(ang) - 1.0;
      if (over > 0 && this.wheels.some(w => w.contactCount > 0)) {
        const s = Math.sign(ang);
        c.t -= s * mTot * -PHYS.gravity * base * clamp(over * 1.6, 0, 0.9);
        if (ang * c.w > 0) c.t -= s * (c.I + R.I) * Math.abs(c.w) * 5;
      }
    }
  }

  get bodies() { return this.rider ? [this.chassis, ...this.wheels, this.rider] : [this.chassis, ...this.wheels]; }
  get x() { return this.chassis.x; }
  get y() { return this.chassis.y; }
  speed() { return Math.hypot(this.chassis.vx, this.chassis.vy); }
  forwardSpeed() { return this.chassis.vx * this.chassis.cos + this.chassis.vy * this.chassis.sin; }

  destroy() {
    const W = this.game.world;
    for (const b of this.bodies) W.remove(b);
    for (const j of this.joints) W.removeJoint(j);
    if (this.riderJoint) W.removeJoint(this.riderJoint);
    if (this.engineSound) { AUDIO.stopEngine(this.engineSound); this.engineSound = null; }
    if (this.dt) AUDIO.stopSkid();
  }

  startSound() {
    if (!this.engineSound) this.engineSound = AUDIO.createEngine(this.type);
  }

  update(h, input) {
    const c = this.chassis;
    const st = this.st;
    const hasFuel = this.fuel > 0 && !this.crashed;
    let gas = input.gas && hasFuel ? 1 : 0;
    const brk = input.brake && hasFuel ? 1 : 0;
    this.throttle += (gas - this.throttle) * Math.min(1, h * 8);
    if (gas) this.fuel = Math.max(0, this.fuel - h * (0.6 + 0.4 * this.throttle));
    else if (brk) this.fuel = Math.max(0, this.fuel - h * 0.35);
    // пробитый пулей бак
    if (this.leakT > 0) {
      this.leakT -= h;
      this.fuel = Math.max(0, this.fuel - h * 0.9);
      if (Math.random() < h * 30 * this.game.particles.quality) {
        const tp = this.type === 'car' ? c.worldPoint(this.def.look.rear + 0.6, this.def.look.bottom + 0.05) : c.worldPoint(-0.4, 0);
        this.game.particles.add({ type: 'blood', x: tp.x, y: tp.y, vx: c.vx * 0.8, vy: -1, g: -15, life: 1.2, size: 0.045, color: '#b8862a', collide: true });
      }
    }

    // контакт с поверхностью
    let touching = c.contactCount > 0;
    for (const w of this.wheels) if (w.contactCount > 0) touching = true;
    if (this.type === 'boat' && c.submerged > 0.02) touching = true;
    if (!touching) this.airTime += h; else this.airTime = 0;
    const wasAir = this.airborne;
    this.airborne = this.airTime > 0.25;
    // сальто
    let da = c.a - this.lastAngle;
    this.lastAngle = c.a;
    if (this.airborne) this.flipAccum += da;
    else {
      if (wasAir) this.onLand();
      this.flipAccum = 0;
    }
    if (Math.abs(this.flipAccum) > Math.PI * 2 - 0.4) {
      this.flipAccum -= Math.sign(this.flipAccum) * Math.PI * 2;
      this.game.onFlip && this.game.onFlip(this);
    }

    // наклон
    const tilt = this.crashed ? 0 : (input.right ? -1 : 0) + (input.left ? 1 : 0);
    // наклон как в Earn to Die: сильный в воздухе, ощутимый на земле (можно поднять нос на подъёме)
    const inAir = this.airborne || (this.type === 'boat' && c.submerged < 0.05);
    if (this.type === 'bike' && this.def.bike) {
      this._bikeControl(h, tilt, inAir);
      this.lean += (tilt - this.lean) * Math.min(1, h * 6);
      this._updateWheeled(h, gas, brk);
      this._afterDrive(h, input);
      return;
    }
    const airPower = this.def.tilt * 1.9 * c.I;
    let groundPower = airPower * 0.6;
    if (this.def.wheels) {
      // на земле нужно преодолеть вес машины, чтобы оторвать колёса
      const base = Math.abs(this.def.wheels[1].x - this.def.wheels[0].x);
      groundPower = Math.max(groundPower, c.mass * -PHYS.gravity * base * (this.type === 'bike' ? 0.4 : 0.6));
      // при сильном крене на земле ослабляем, чтобы машина не переворачивалась сама
      let ang = c.a % (Math.PI * 2); if (ang > Math.PI) ang -= Math.PI * 2; if (ang < -Math.PI) ang += Math.PI * 2;
      const lim = this.type === 'bike' ? 0.5 : 0.7;
      if (ang * tilt > lim) groundPower *= clamp(1 - (ang * tilt - lim) * 1.5, 0.15, 0.4);
    }
    const power = inAir ? airPower : groundPower;
    const maxW = inAir ? (this.type === 'bike' ? 7 : 5.5) : (this.type === 'bike' ? 3.5 : 2.4);
    if (tilt) {
      // ограничиваем угловую скорость, чтобы машина не закручивалась бесконтрольно
      const wDir = c.w * tilt;
      if (wDir < maxW) c.t += tilt * power * clamp((maxW - wDir) / 1.2, 0.2, 1);
      // быстрый разворот, если крутимся в обратную сторону
      if (wDir < 0) c.t += tilt * power * 0.4;
    }
    // стабилизатор вилли: стоя на колесе под крутым углом, водитель переносит вес — возвращающий момент
    if (!inAir && this.wheels.length && !this.crashed && this.airTime < 0.6) {
      let a = c.a % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2;
      const lim = this.type === 'bike' ? 0.7 : 0.9;
      if (Math.abs(a) > lim) {
        const base = Math.abs(this.def.wheels[1].x - this.def.wheels[0].x);
        const over = Math.abs(a) - lim;
        const s = Math.sign(a);
        // убрать наклон в сторону опрокидывания
        if (tilt === s) c.t -= tilt * power * clamp((maxW - c.w * tilt) / 1.2, 0.2, 1);
        c.t -= s * c.mass * -PHYS.gravity * base * clamp(over * 2.5, 0, 1.2);
        if (a * c.w > 0) c.t -= s * c.I * Math.abs(c.w) * 6;
      }
    }
    else if (this.airborne) c.w *= 1 - h * 0.6;
    this.lean += (tilt - this.lean) * Math.min(1, h * 6);

    if (this.type === 'boat') this._updateBoat(h, gas, brk);
    else if (this.dt) this._updateCar(h, gas, brk);
    else this._updateWheeled(h, gas, brk);
    this._afterDrive(h, input);
  }

  _afterDrive(h, input) {
    const c = this.chassis, st = this.st;
    // ускоритель
    this.boosting = false;
    if (input.boost && this.boost > 0 && !this.crashed) {
      this.boost = Math.max(0, this.boost - h);
      // тяга через общий центр масс (всем частям пропорционально массе), иначе ракета задирает нос
      if (this.type === 'bike' && this.rider) {
        // общая тяга как раньше (по массе из паспорта), но распределена по раме, колёсам и гонщику
        const total = this.bodies.reduce((s, b) => s + b.mass, 0);
        const scale = this.def.mass / total;
        for (const b of this.bodies) {
          const F = b.mass * st.boostPower * scale;
          b.fx += c.cos * F; b.fy += c.sin * F;
        }
      } else {
        const F = c.mass * st.boostPower;
        c.fx += c.cos * F; c.fy += c.sin * F;
      }
      this.boosting = true;
    }

    // оружие: на мотоцикле с Мирой стреляет она из обреза, на катере она ещё и с винтовкой на корме
    this.gunCooldown -= h;
    const miraShotgun = this.type === 'bike' && this.passenger === 'mira';
    if (st.gun && this.ammo > 0 && !this.crashed && !miraShotgun) this._updateGun(h);
    if (this.passenger === 'mira' && !this.crashed) this._updateMira(h);

    this._effects(h);
  }

  _updateWheeled(h, gas, brk) {
    const c = this.chassis, st = this.st;
    const fwd = this.forwardSpeed();
    let topW = 0, r = 0.4;
    this.shiftTimer -= h;
    let maxWheelLin = 0;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i], j = this.joints[i], wd = w.def;
      r = wd.r;
      topW = st.topSpeed / r;
      const rel = w.w - c.w;
      maxWheelLin = Math.max(maxWheelLin, Math.abs(rel) * r);
      if (gas > 0.01) {
        if (wd.drive) {
          const frac = clamp(Math.abs(rel) / topW, 0, 1);
          let curve = lerp(st.lowGear * 1.15, 0.45, Math.pow(frac, 1.3));
          if (this.shiftTimer > 0) curve *= 0.35;
          let ang = c.a % (Math.PI * 2); if (ang > Math.PI) ang -= Math.PI * 2; if (ang < -Math.PI) ang += Math.PI * 2;
          if (this.type === 'bike' && this.def.bike) {
            // байк: газ в воздухе слегка задирает нос (как у настоящего мотоцикла), на земле — честная реакция колеса
            if (this.airTime > 0.08) curve *= 0.3;
            // инстинкт гонщика: на «свечке» плавно сбрасывает газ, а если нос летит вверх слишком быстро — резко
            if (!this.airborne && ang > 0.8) curve *= clamp(1 - (ang - 0.8) * 2.2, 0.05, 1);
            if (!this.airborne && ang > 0.3 && c.w > 2.0) curve *= clamp(1 - (c.w - 2.0) * 0.7, 0.1, 1);
          } else {
            // в воздухе колесо раскручивается мягко: отдача мотора не должна запрокидывать транспорт
            if (this.airTime > 0.08) curve *= 0.1;
            // мягкий ограничитель вилли, если игрок сам не тянет нос вверх
            const wl = this.lean > 0.3 ? 1.1 : 0.55;
            if (!this.airborne && ang > wl) curve *= clamp(1 - (ang - wl) * 3, 0.05, 1);
            // антиподрыв: нос поднимается слишком быстро — сбрасываем газ (как опытный водитель)
            if (!this.airborne && ang > 0.25 && c.w > 2.2) curve *= clamp(1 - (c.w - 2.2) * 0.6, 0.15, 1);
          }
          j.enableMotor = true;
          // в воздухе мотор раскручивает колесо до абсолютной скорости: когда колесо раскрутилось,
          // отдачи больше нет (иначе мотор «держит» колесо относительно рамы и бесконечно крутит байк)
          j.motorSpeed = this.airTime > 0.08 ? -topW * this.throttle - c.w : -topW * this.throttle;
          j.maxMotorTorque = st.torque * curve / this.wheels.filter(q => q.def.drive).length;
          // контроль вилли: момент на заднем колесе не больше того, что поднимает переднее колесо.
          // Чем выше нос, тем ближе центр масс к задней оси и тем меньше допустимый момент — байк сам находит баланс.
          if (this.type === 'bike' && this.rider && w.contactCount > 0) {
            const R = this.rider;
            let mT = 0, mx = 0, my = 0;
            for (const b of this.bodies) { mT += b.mass; mx += b.mass * b.x; my += b.mass * b.y; }
            mx /= mT; my /= mT;
            // плечо силы тяжести — горизонтальное расстояние от центра масс до пятна контакта заднего колеса
            const along = mx - w.x;
            const height = my - (w.y - wd.r);
            const share = this.lean > 0.3 ? 1.04 : 0.85;
            const liftTorque = mT * -PHYS.gravity * Math.max(0, along) / Math.max(0.35, height) * wd.r * share;
            // минимальный момент нужен только почти на ровном (чтобы тронуться), на вилли он не должен держать нос
            const floorT = ang < 0.35 ? st.torque * 0.08 : 0;
            j.maxMotorTorque = Math.min(j.maxMotorTorque, Math.max(liftTorque, floorT));
          }
        } else {
          j.enableMotor = false;
        }
      } else if (brk) {
        if (fwd > 1.5) {
          // у байка передний тормоз сильнее заднего — можно поставить стоппи
          const bk = this.type === 'bike' ? (wd.drive ? 0.9 : 1.5) : 1.2;
          j.enableMotor = true; j.motorSpeed = 0; j.maxMotorTorque = st.torque * bk;
        } else if (wd.drive) {
          j.enableMotor = true; j.motorSpeed = topW * 0.35; j.maxMotorTorque = st.torque * 0.6;
        } else j.enableMotor = false;
      } else {
        j.enableMotor = true; j.motorSpeed = 0; j.maxMotorTorque = 8 * w.mass * 0.05;
      }
    }
    // передачи (для звука и рывков)
    const vLin = this.airborne ? maxWheelLin : Math.max(Math.abs(fwd), maxWheelLin * 0.9);
    const frac = clamp(vLin / st.topSpeed, 0, 1.05);
    const gears = [0.16, 0.34, 0.54, 0.76, 1.0];
    let g = 0;
    while (g < gears.length - 1 && frac > gears[g]) g++;
    if (g + 1 !== this.gear) {
      if (g + 1 > this.gear && gas) { this.shiftTimer = 0.12; AUDIO.shift(); if (this.st.torque > 2000 || this.up.engine >= 3) this.backfire = 0.15; }
      this.gear = g + 1;
    }
    const lo = g === 0 ? 0 : gears[g - 1], hi = gears[g];
    const inGear = clamp((frac - lo) / (hi - lo), 0, 1);
    const targetRpm = this.fuel > 0 ? (0.15 + inGear * 0.85) * (gas ? 1 : 0.7) : 0;
    this.rpm += ((gas ? targetRpm : Math.max(0.08, targetRpm * 0.6)) - this.rpm) * Math.min(1, h * (this.shiftTimer > 0 ? 25 : 10));

    // байк: проверка падения гонщика
    if (this.type === 'bike' && !this.crashed) {
      const T = this.game.world.terrain;
      let crash = false;
      if (this.rider) {
        // как в Elasto Mania: авария — когда голова гонщика касается земли или препятствия
        const R = this.rider, hs = R.shapes[0];
        if (R.contactCount > 0) {
          // смертельно: земля, постройки и тяжёлые предметы; лёгкие ящики и бочки гонщик сносит
          for (const ct of (this.game.world.activeContacts || [])) {
            if (ct.a !== R && ct.b !== R) continue;
            const o = ct.a === R ? ct.b : ct.a;
            if (o === this.game.world.ground || o.isStatic || o.mass > 120) { crash = true; break; }
          }
        }
        if (hs.wy < T.heightAt(hs.wx) - 0.05) crash = true;
      } else {
        const head = this.chassis.worldPoint(-0.1, 1.55);
        if (head.y < T.heightAt(head.x) + 0.1) crash = true;
      }
      // рама лежит на боку вверх колёсами
      if (c.cos < -0.35 && c.contactCount > 0) crash = true;
      if (crash) this.crashRider();
    }
  }

  /* Автомобиль: мотор (кривая момента) → сцепление → 5-ступенчатый автомат → главная пара → колёса.
     Колёса ведёт мотор шарнира с ограничением момента: пока колесо не догнало скорость отсечки, на него идёт
     ровно столько момента, сколько даёт мотор на текущих оборотах. Сцепление шины зависит от проскальзывания. */
  _updateCar(h, gas, brk) {
    const c = this.chassis, st = this.st, D = this.dt, dmg = this.dmg;
    const fwd = this.forwardSpeed();
    const air = this.airTime > 0.08;
    const hasFuel = this.fuel > 0;
    let ang = c.a % (Math.PI * 2); if (ang > Math.PI) ang -= Math.PI * 2; if (ang < -Math.PI) ang += Math.PI * 2;

    // --- шины: коэффициент проскальзывания и сцепление по кривой ---
    let nDrive = 0, wDrive = 0, ground = 0, maxSpin = 0;
    for (const w of this.wheels) {
      const r = w.def.r;
      const vg = w.vx * c.cos + w.vy * c.sin;
      const vs = -w.w * r;
      const on = w.contactCount > 0;
      w.slip = on ? (vs - vg) / Math.max(Math.abs(vg), 3) : 0;
      w.slipV = on ? vs - vg : 0;
      // трение контакта = sqrt(трение земли × трение колеса), поэтому множитель — в квадрате
      w.friction = st.grip * tireGrip(w.slip) ** 2;
      if (on) ground++;
      if (w.def.drive) { nDrive++; wDrive += -(w.w - c.w); if (on) maxSpin = Math.max(maxSpin, w.slip); }
    }
    wDrive /= Math.max(1, nDrive);

    // --- передача ---
    D.shiftT -= h;
    // задний ход — как у автомата: остановиться, подержать тормоз, и только тогда включается «R»
    D.stopT = brk && !gas && Math.abs(fwd) < 0.8 && !air ? (D.stopT || 0) + h : 0;
    if (gas) D.reverse = false;
    else if (D.stopT > 0.3) D.reverse = true;
    else if (!brk && fwd > 0.5) D.reverse = false;
    // катимся назад на передней передаче — первая
    if (!D.reverse && fwd < -0.5 && D.gear > 1) { D.gear = 1; D.shiftT = 0; }
    const gearK = () => (D.reverse ? D.revRatio : D.ratios[D.gear - 1]) * D.fd;
    let wr = Math.abs(wDrive) * gearK() * RPM_PER_RADS;
    if (!D.reverse && !air && D.shiftT < -0.35 && hasFuel) {
      const upRpm = lerp(0.62, 0.95, this.throttle) * D.redline;
      const downRpm = (gas ? 0.42 : 0.3) * D.redline;
      if (gas && D.gear < D.ratios.length && wr > upRpm && maxSpin < 0.3) {
        D.gear++; D.shiftT = D.shiftTime;
        AUDIO.shift();
        if (st.torque > 2000 || this.up.engine >= 3) this.backfire = 0.12;
      } else if (D.gear > 1 && wr < downRpm) {
        D.gear--; D.shiftT = D.shiftTime * 0.5;
      }
      wr = Math.abs(wDrive) * gearK() * RPM_PER_RADS;
    }
    const k = gearK();
    const pedal = D.reverse ? brk * 0.6 : this.throttle;

    // --- обороты мотора ---
    let target, engaged = true;
    if (!hasFuel) { target = 0; engaged = false; }
    else if (D.shiftT > 0) { target = Math.max(D.idle, wr * 0.97); engaged = false; }
    else if ((D.gear === 1 || D.reverse) && wr < D.clutchRpm && pedal > 0.05) {
      // трогание: сцепление пробуксовывает, мотор держит обороты
      target = Math.max(wr, lerp(D.idle, D.clutchRpm, pedal));
    } else if (wr < D.idle * 1.1) { target = D.idle * (1 + 0.6 * pedal); engaged = false; }
    else target = wr;
    D.rpm += (target - D.rpm) * Math.min(1, h * (engaged ? 30 : 6));
    if (D.rpm > D.redline) D.cut = true; else if (D.rpm < D.redline - 250) D.cut = false;
    // перебои зажигания у разбитого мотора
    if (dmg.engine > 0.4 && hasFuel) {
      D.misfireT -= h;
      if (D.misfireT <= 0) {
        D.misfireT = 0.15 + Math.random() * 0.6;
        if (Math.random() < (dmg.engine - 0.3) * 0.9) {
          D.misfire = 0.06 + Math.random() * 0.1;
          if (pedal > 0.3 && Math.random() < 0.4) this.backfire = 0.06;
        }
      }
    }
    D.misfire = Math.max(0, D.misfire - h);

    // --- момент ---
    const x = D.rpm / D.redline;
    let Te = D.cut ? 0 : D.Tpk * torqueCurve(x) * dmg.powerFactor;
    if (D.misfire > 0) Te *= 0.2;
    const Tw = hasFuel && D.shiftT <= 0 ? Te * k * D.eff * pedal : 0;
    // привычки водителя из ETD: в полёте мотор не раскручивает машину, на вилли газ сбрасывается
    let mod = 1;
    if (air) mod *= 0.12;
    else if (!D.reverse) {
      const wl = this.lean > 0.3 ? 1.1 : 0.55;
      if (!this.airborne && ang > wl) mod *= clamp(1 - (ang - wl) * 3, 0.05, 1);
      if (!this.airborne && ang > 0.25 && c.w > 2.2) mod *= clamp(1 - (c.w - 2.2) * 0.6, 0.15, 1);
    }
    // антипробуксовка (кроме старых машин и маслкара): срезает момент при буксовании
    let tcs = 1;
    if (D.tcs && !air && pedal > 0 && maxSpin > 0.2) tcs = clamp(1 - (maxSpin - 0.2) * 1.8, 0.35, 1);
    D.tcsCut += (tcs - D.tcsCut) * Math.min(1, h * 20);
    this.tcsActive = D.tcsCut < 0.9;
    // торможение мотором (сцепление замкнуто, газ отпущен)
    const engBrake = engaged && hasFuel && pedal < 0.05 && wr > D.idle * 1.3 ? D.Tpk * (0.12 + 0.18 * x) * k : 0;
    const wLim = (D.redline / RPM_PER_RADS) / k;
    // педаль против направления движения — это тормоз
    const braking = (brk && !D.reverse) || (gas && fwd < -1) || (D.reverse && brk && fwd > 0.8);
    this.brake = braking ? 1 : 0;
    this.absActive = false;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i], j = this.joints[i], wd = w.def;
      const front = wd.x > 0;
      if (braking) {
        // тормоза: 62% спереди; ABS отпускает колесо, уходящее в блокировку
        let T = D.brakeTorque * (front ? D.brakeBias : 1 - D.brakeBias) * 2 / this.wheels.length * (wd.r / D.r);
        if (D.abs && w.contactCount > 0 && w.slip < -0.14 && Math.abs(fwd) > 2) { T *= 0.15; this.absActive = true; }
        if (air) T *= 0.3;
        j.enableMotor = true; j.motorSpeed = 0; j.maxMotorTorque = T;
      } else if (wd.drive && Tw > 0 && !braking) {
        j.enableMotor = true;
        const dir = D.reverse ? 1 : -1;
        j.motorSpeed = air ? dir * wLim - c.w : dir * wLim;
        j.maxMotorTorque = Tw * mod * D.tcsCut / nDrive;
      } else if (wd.drive && engBrake > 0) {
        j.enableMotor = true; j.motorSpeed = 0; j.maxMotorTorque = engBrake / nDrive;
      } else {
        // накат: трение в подшипниках и трансмиссии
        j.enableMotor = true; j.motorSpeed = 0; j.maxMotorTorque = 4 + w.mass * 0.4;
      }
    }

    // --- сопротивление: аэродинамика (∝ v²) и качение (∝ вес) ---
    const v2 = c.vx * c.vx + c.vy * c.vy;
    if (v2 > 1 && c.submerged < 0.1) {
      const vl = Math.sqrt(v2), F = 0.5 * 1.225 * D.CdA * v2;
      c.fx -= c.vx / vl * F; c.fy -= c.vy / vl * F;
    }
    if (ground) {
      const F = D.Crr * D.massTotal * -PHYS.gravity * clamp(fwd / 0.5, -1, 1) * ground / this.wheels.length;
      c.fx -= c.cos * F; c.fy -= c.sin * F;
    }

    // --- для звука и приборов ---
    this.gear = D.reverse ? -1 : D.gear;
    this.rpmReal = D.rpm;
    let r01 = D.rpm / D.redline;
    if (D.cut && pedal > 0) r01 -= Math.random() * 0.04;
    if (D.misfire > 0) r01 *= 0.85;
    this.rpm = clamp(r01, 0, 1.02);
    this.shiftTimer = D.shiftT;
  }

  // после шага физики: удары по кузову, подвеска, следы шин, перенос веса на подвеске
  postStep(h) {
    if (!this.dt) return;
    const c = this.chassis, G = this.game, W = G.world, dmg = this.dmg, P = G.particles;
    // --- удары: суммарный импульс от каждого препятствия за шаг ---
    const hits = this._hits || (this._hits = new Map());
    hits.clear();
    for (const ct of W.activeContacts || []) {
      let other, sign;
      if (ct.b === c) { other = ct.a; sign = 1; } else if (ct.a === c) { other = ct.b; sign = -1; } else continue;
      if (!ct.impulse) continue;
      const d = other.data;
      if (d && (d.kind === 'zombie' || d.kind === 'ragdoll' || d.kind === 'wheel')) continue;
      if (other.cat === CAT.DEBRIS) continue;
      let hs = hits.get(other);
      if (!hs) { hs = { j: 0, x: 0, y: 0, nx: 0, ny: 0 }; hits.set(other, hs); }
      const pt = ct.pts[0];
      hs.j += ct.impulse; hs.x += pt.x * ct.impulse; hs.y += pt.y * ct.impulse;
      hs.nx += ct.nx * sign * ct.impulse; hs.ny += ct.ny * sign * ct.impulse;
    }
    let maxDv = 0;
    for (const [other, hs] of hits) {
      // лёгкий предмет не может остановить машину — и помять её сильно тоже
      const mo = other.isStatic || other === W.ground ? Infinity : other.mass;
      const dv = hs.j / c.mass * (mo === Infinity ? 1 : Math.min(1, mo / c.mass * 2));
      maxDv = Math.max(maxDv, dv);
      if (dv > 3.2) {
        const nl = Math.hypot(hs.nx, hs.ny) || 1;
        dmg.collide(hs.x / hs.j, hs.y / hs.j, hs.nx / nl, hs.ny / nl, dv, other, other === W.ground);
      }
    }
    // --- подвеска: удар в отбойник ---
    let maxSusp = 0;
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      if (j.jUpper > 0) {
        const dvS = j.jUpper / (c.mass * 0.5);
        maxSusp = Math.max(maxSusp, dvS);
        dmg.suspensionHit(i, dvS);
      }
    }
    if (window.__dmgStat) { const S = window.__dmgStat; S.dv = Math.max(S.dv || 0, maxDv); S.susp = Math.max(S.susp || 0, maxSusp); }
    dmg.tick(h);

    // --- перенос веса: кузов на пружинах клюёт при торможении и приседает при разгоне ---
    const pv = this.pitch;
    const vf = this.forwardSpeed();
    const acc = (vf - pv.prevV) / h;
    pv.prevV = vf;
    // «акселерометр»: ускорение минус проекция силы тяжести; в полёте перенос веса пропадает
    const onGround = this.airTime < 0.05 && this.wheels.some(w => w.contactCount > 0);
    const fAcc = onGround ? clamp(acc - PHYS.gravity * c.sin, -14, 14) : 0;
    pv.f += (fAcc - pv.f) * Math.min(1, h * 25);
    const lp = this.def.look;
    const hK = lp.style === 'truck' ? 0.9 : lp.style === 'muscle' ? 0.55 : 0.75;
    const targetA = clamp(pv.f * 0.0062 * hK, -0.075, 0.075);
    const om = 2 * Math.PI * 1.6, zeta = 0.38;
    pv.w += ((targetA - pv.a) * om * om - pv.w * 2 * zeta * om) * h;
    pv.a = clamp(pv.a + pv.w * h, -0.1, 0.1);

    // --- шины: визг, дым и чёрные следы ---
    let skid = 0;
    for (const w of this.wheels) {
      if (w.contactCount === 0 || !w.slipV) continue;
      const sv = Math.abs(w.slipV);
      if (sv < 2.5) continue;
      skid = Math.max(skid, Math.min(1, (sv - 2.5) / 8));
      const gy = W.terrain.heightAt(w.x);
      if (Math.abs(w.y - w.def.r - gy) < 0.25 && Math.random() < 0.5) {
        if (P.decals.length > 1400) P.decals.splice(0, 200);
        P.decals.push({ x: w.x, y: gy, w: 0.16 + Math.min(0.25, sv * 0.02), skid: true, c: '#0c0c0c', a: Math.min(0.5, 0.12 + sv * 0.035) });
      }
      if (Math.random() < Math.min(0.9, sv * 0.08) * P.quality) {
        P.smoke(w.x - Math.sign(w.slipV) * w.def.r * 0.6, w.y - w.def.r * 0.8, -w.slipV * 0.15 + c.vx * 0.3, 0.3, 1, 0.08, 0.4 + Math.min(0.7, sv * 0.05));
      }
    }
    this.skid += (skid - this.skid) * Math.min(1, h * 12);
  }

  _updateBoat(h, gas, brk) {
    const c = this.chassis, st = this.st, W = this.game.world;
    const pp = c.worldPoint(this.def.prop[0], this.def.prop[1]);
    const surf = W.water ? W.water.height(pp.x, W.time) : -999;
    this.propSubmerged = pp.y < surf + 0.05;
    this.propDepth = surf - pp.y;
    const fwd = this.forwardSpeed();
    const topSpeed = st.topSpeed;
    let thrust = 0;
    if (gas) thrust = st.thrust * st.propEff * clamp(1 - fwd / (topSpeed * 1.05), 0, 1.2) * this.throttle;
    else if (brk) thrust = fwd > 1 ? -st.thrust * 0.8 : -st.thrust * 0.45;
    if (this.propSubmerged && thrust !== 0) {
      const F = thrust * c.mass;
      c.applyForce(c.cos * F, c.sin * F, pp.x, pp.y);
      // лёгкий подъём носа при разгоне (выход на глиссирование)
      c.t += gas * c.I * 0.25 * clamp(fwd / topSpeed, 0, 1);
    }
    // лодку выбросило на сушу/настил: мотор медленно сталкивает её обратно в воду
    if ((gas || brk) && !this.propSubmerged && c.contactCount > 0 && c.submerged < 0.05 && Math.abs(fwd) < 3) {
      const dir = gas ? 1 : -1;
      const F = c.mass * 16 * dir;
      c.fx += c.cos * F; c.fy += c.sin * F;
      this.fuel = Math.max(0, this.fuel - h * 0.4);
      if (Math.random() < 0.3) this.game.particles.dust(c.x, c.y - 0.4, -dir * 2, 0, 1, this.game.dustColor);
    }
    const target = gas ? (this.propSubmerged ? 0.2 + 0.8 * clamp(Math.abs(fwd) / topSpeed, 0, 1) : 1) : (brk ? 0.4 : 0.1);
    this.rpm += ((this.fuel > 0 ? target : 0) - this.rpm) * Math.min(1, h * 5);
    this.propSpin = (this.propSpin || 0) + this.rpm * h * 60;
  }

  _updateGun(h) {
    const G = this.game, c = this.chassis;
    const mount = this._gunMount();
    const mp = c.worldPoint(mount[0], mount[1]);
    // выбор цели
    let best = null, bestD = 22;
    // катера анархистов — приоритетная цель
    for (const p of G.props) {
      if (!p.isRaiderBoat || p.dead || p.ally) continue;
      const dx = p.body.x - mp.x, dy = p.body.y + 0.5 - mp.y;
      if (dx < -4 || dx > 26 || Math.abs(dy) > 9) continue;
      const d = Math.hypot(dx, dy) * 0.7;
      if (d < bestD) { bestD = d; best = p; }
    }
    for (const z of G.zombies) {
      if (!z.alive || (z.raider && z.neutral && !z.angered)) continue;
      const dx = z.body.x - mp.x, dy = z.body.y + 0.3 - mp.y;
      if (dx < 1.5 || dx > 22 || Math.abs(dy) > 9) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = z; }
    }
    this.target = best;
    let desired = c.a;
    if (best) desired = Math.atan2(best.body.y + 0.4 - mp.y, best.body.x - mp.x);
    let diff = desired - this.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.aim += diff * Math.min(1, h * 10);
    if (best && this.gunCooldown <= 0 && Math.abs(diff) < 0.15) {
      this.gunCooldown = this.st.fireRate;
      this.ammo--;
      const ang = this.aim + (Math.random() - 0.5) * 0.04;
      const bx = mp.x + Math.cos(ang) * 0.9, by = mp.y + Math.sin(ang) * 0.9;
      const ex = bx + Math.cos(ang) * 30, ey = by + Math.sin(ang) * 30;
      const hit = G.world.rayCast(bx, by, ex, ey, CAT.GROUND | CAT.ZOMBIE | CAT.RAGDOLL | CAT.PROP | CAT.STATIC, this.group);
      G.particles.muzzle(bx, by, ang);
      AUDIO.gunshot(this.type === 'boat' && this.def.boatStyle === 'patrol');
      this.recoil = 1;
      if (hit) {
        G.particles.tracer(bx, by, hit.x, hit.y);
        G.onBulletHit(hit, Math.cos(ang), Math.sin(ang), this.st.gunDamage);
      } else G.particles.tracer(bx, by, ex, ey);
    }
  }

  // плечо Миры в координатах рамы
  _miraMount() {
    const d = this.def;
    if (this.type === 'boat') { const m = (BOAT_ART[d.id] && BOAT_ART[d.id].mira) || [-1.5, 0.5]; return [m[0] + 0.05, m[1] + 1.36]; }
    if (this.type === 'bike') return d.bikeStyle === 'chopper' ? [-0.78, 1.1] : [-0.6, 1.24];
    return null;
  }

  _updateMira(h) {
    const G = this.game, c = this.chassis, M = this.mira, st = this.st, W = G.world, P = G.particles;
    M.recoil = Math.max(0, M.recoil - h * 6); M.flash = Math.max(0, M.flash - h); M.cd -= h;
    if (M.reload > 0) { M.reload -= h; M.open = Math.min(1, M.open + h * 7); if (M.reload <= 0) M.shells = 2; }
    else M.open = Math.max(0, M.open - h * 7);
    const boat = this.type === 'boat';
    const armed = boat || (this.type === 'bike' && st.gun && this.ammo > 0);
    const mount = this._miraMount();
    if (!armed || !mount) { M.aim += (c.a + 0.2 - M.aim) * Math.min(1, h * 3); return; }
    const mp = c.worldPoint(mount[0], mount[1]);
    const range = boat ? 34 : 10;
    // цели: катера «Стаи» или военных (кто враг на этой ветке), стрелки, мертвецы
    let best = null, bestS = -1;
    for (const p of G.props) {
      if (!p.isRaiderBoat || p.dead || p.ally) continue;
      const d = Math.hypot(p.body.x - mp.x, p.body.y - mp.y);
      if (d < range && 2 - d / range > bestS) { bestS = 2 - d / range; best = { x: p.body.x, y: p.body.y + 0.7 }; }
    }
    for (const z of G.zombies) {
      if (!z.alive || (z.raider && z.neutral && !z.angered)) continue;
      const d = Math.hypot(z.body.x - mp.x, z.body.y + 0.4 - mp.y);
      const lim = z.raider ? range : range * (boat ? 0.55 : 1);
      if (d < lim && 1 - d / range + (z.raider ? 0.5 : 0) > bestS) { bestS = 1 - d / range + (z.raider ? 0.5 : 0); best = { x: z.body.x, y: z.body.y + 0.45 }; }
    }
    const desired = best ? Math.atan2(best.y - mp.y, best.x - mp.x) : c.a + (boat ? Math.PI - 0.15 : 0.2);
    let diff = desired - M.aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    M.aim += diff * Math.min(1, h * 8);
    M.aim = Math.atan2(Math.sin(M.aim), Math.cos(M.aim));
    if (!best || M.cd > 0 || Math.abs(diff) > 0.1 || M.reload > 0) return;
    const cs = Math.cos(M.aim), sn = Math.sin(M.aim);
    const mask = CAT.GROUND | CAT.STATIC | CAT.PROP | CAT.ZOMBIE;
    if (boat) {
      // винтовка: одиночные выстрелы по катерам и пловцам
      const mx = mp.x + cs * 0.9, my = mp.y + sn * 0.9;
      const a = M.aim + (Math.random() - 0.5) * 0.025;
      const ex = mx + Math.cos(a) * 42, ey = my + Math.sin(a) * 42;
      const hit = W.rayCast(mx, my, ex, ey, mask);
      P.muzzle(mx, my, a); P.tracer(mx, my, hit ? hit.x : ex, hit ? hit.y : ey);
      AUDIO.rifle(clamp((mx - G.camX) / 25, -1, 1), 0.9);
      if (hit) G.onBulletHit(hit, Math.cos(a), Math.sin(a), 1.4 + st.gun * 0.4);
      M.cd = 1.0 - st.gun * 0.1; M.recoil = 1; M.flash = 0.06;
    } else {
      // обрез: дуплет картечью, потом переломить стволы и перезарядить
      this.ammo--;
      const mx = mp.x + cs * 0.65, my = mp.y + sn * 0.65;
      for (let k = 0; k < 7; k++) {
        const a = M.aim + (Math.random() - 0.5) * 0.3;
        const ex = mx + Math.cos(a) * 11, ey = my + Math.sin(a) * 11;
        const hit = W.rayCast(mx, my, ex, ey, mask);
        P.tracer(mx, my, hit ? hit.x : ex, hit ? hit.y : ey);
        if (hit) G.onBulletHit(hit, Math.cos(a), Math.sin(a), 0.6 * st.gunDamage);
      }
      P.muzzle(mx, my, M.aim); P.smoke(mx, my, cs * 2, sn * 2, 2, 0.3, 0.5);
      AUDIO.gunshot(true);
      c.vx -= cs * 0.25;
      M.shells--; M.cd = 0.32; M.recoil = 1; M.flash = 0.07;
      if (M.shells <= 0) M.reload = 1.25 - st.gun * 0.12;
    }
  }

  _gunMount() {
    const d = this.def;
    if (this.type === 'bike') return [0.1, 1.2];
    if (this.type === 'boat') return d.boatStyle === 'patrol' ? [1.2, 1.55] : [0.6, 1.2];
    return [(d.look.rr + d.look.rf) * 0.5, d.look.roof + 0.25];
  }

  onLand() {
    const c = this.chassis;
    const imp = Math.abs(c.vy);
    if (imp > 4) {
      this.game.shake(Math.min(0.6, imp * 0.04));
      AUDIO.impact(Math.min(1, imp / 18), 0);
      for (const w of this.wheels) this.game.particles.dust(w.x, w.y - w.def.r, c.vx, 0, 6, this.game.dustColor);
    }
  }

  crashRider() {
    if (this.crashed) return;
    this.crashed = true;
    const c = this.chassis;
    let px, py, ang, vx, vy;
    if (this.rider) {
      // рэгдолл появляется ровно там, где было тело гонщика, с его скоростью
      const R = this.rider, geo = this.riderGeo;
      px = R.x; py = R.y; vx = R.vx; vy = R.vy + 1;
      ang = c.a + geo.neutral + this.riderLean() - Math.PI / 2;
      this.game.world.remove(R);
      this.game.world.removeJoint(this.riderJoint);
      this.rider = null; this.riderJoint = null;
    } else {
      const p = c.worldPoint(-0.1, 0.9);
      px = p.x; py = p.y; ang = c.a; vx = c.vx; vy = c.vy + 2;
    }
    const rag = new Ragdoll(this.game, px, py, ang, vx, vy, { human: true, person: LOOKS.alex, skin: LOOKS.alex.skin });
    this.game.ragdolls.push(rag);
    // Мира слетает следом
    if (this.passenger === 'mira') {
      const mp = c.worldPoint(this.def.bikeStyle === 'chopper' ? -0.75 : -0.6, 1.0);
      this.game.ragdolls.push(new Ragdoll(this.game, mp.x, mp.y, ang, vx * 0.9, vy + 1.5, { human: true, person: LOOKS.mira, skin: LOOKS.mira.skin }));
    }
    this.riderRagdoll = rag;
    AUDIO.impact(0.9);
    this.game.shake(0.5);
    this.game.onRiderCrash && this.game.onRiderCrash();
  }

  _effects(h) {
    const G = this.game, c = this.chassis, P = G.particles;
    const sp = this.speed();
    // выхлоп
    this.exhaustT -= h;
    if (this.type !== 'boat' && this.exhaustT <= 0 && this.fuel > 0) {
      this.exhaustT = 0.05 + (1 - this.throttle) * 0.15;
      const ex = this.type === 'bike' ? c.worldPoint(-0.85, 0.05) : c.worldPoint(this.def.look.rear - 0.05, this.def.look.bottom + 0.1);
      P.smoke(ex.x, ex.y, -c.cos * 2 + c.vx * 0.5, c.vy * 0.3, 1, 0.35 + this.throttle * 0.2, 0.35 + this.throttle * 0.3);
    }
    if (this.backfire > 0) {
      this.backfire -= h;
      const ex = this.type === 'bike' ? c.worldPoint(-0.95, 0.05) : c.worldPoint(this.def.look.rear - 0.1, this.def.look.bottom + 0.1);
      P.fire(ex.x, ex.y, -c.cos * 5 + c.vx, 0, 1, 0.5);
    }
    if (this.boosting) {
      const bp = this._boostNozzle();
      const w = c.worldPoint(bp[0], bp[1]);
      P.fire(w.x, w.y, -c.cos * 14 + c.vx, -c.sin * 14 + c.vy, 3, 0.8);
      P.smoke(w.x, w.y, -c.cos * 6 + c.vx * 0.5, -c.sin * 6, 1, 0.1, 0.6);
      P.lights.push({ x: w.x, y: w.y, r: 6, age: 0, life: 0.05, color: 'rgba(255,160,60,' });
    }
    // колёса: пыль и искры
    for (const w of this.wheels) {
      if (w.contactCount === 0) continue;
      const slip = Math.abs(w.w * w.def.r + (w.vx * c.cos + w.vy * c.sin));
      if ((slip > 3 || sp > 12) && Math.random() < 0.5 * P.quality) {
        P.dust(w.x, w.y - w.def.r * 0.8, -Math.sign(w.w) * slip * 0.5 + w.vx * 0.3, 0, 1, G.dustColor);
      }
    }
    // скребёт брюхом
    if (this.type !== 'boat' && c.groundContact && sp > 5 && Math.random() < 0.6) {
      const p = c.worldPoint(0, this.type === 'bike' ? -0.1 : this.def.look.bottom);
      P.sparks(p.x, p.y, -c.vx * 0.1, 1, 2);
    }
    // лодка: кильватер и брызги
    if (this.type === 'boat' && G.world.water) {
      const W = G.world.water;
      if (this.propSubmerged && this.rpm > 0.25 && Math.random() < 0.9 * P.quality) {
        const pp = c.worldPoint(this.def.prop[0], this.def.prop[1]);
        P.wake(pp.x, W.height(pp.x, G.world.time), c.vx);
        if (Math.random() < 0.3) P.bubbles(pp.x, pp.y, 1);
      }
      const bow = c.worldPoint(this.def.hull[0][3][0] - 0.4, 0);
      const by = W.height(bow.x, G.world.time);
      if (Math.abs(bow.y - by) < 0.6 && sp > 6 && Math.random() < 0.7 * P.quality) {
        P.add({ type: 'spray', x: bow.x, y: by, vx: c.vx * 0.6 + (Math.random() - 0.3) * 3, vy: 2 + Math.random() * sp * 0.25, g: -15, life: 0.8, size: 0.06 + Math.random() * 0.1, water: true });
      }
      // удар о воду
      const wasIn = this._wasInWater;
      const inWater = c.submerged > 0.05;
      if (inWater && !wasIn && Math.abs(c.vy) > 3) {
        const s = Math.min(2.5, Math.abs(c.vy) / 5);
        P.splash(c.x, W.height(c.x, G.world.time), c.vx, s);
        AUDIO.splash(s / 2.5);
        G.shake(s * 0.15);
      }
      this._wasInWater = inWater;
    }
    if (this.recoil) this.recoil = Math.max(0, this.recoil - h * 8);
    // горение: пламя по кузову и ускоренный расход топлива
    if (this.burnT > 0) {
      this.burnT -= h;
      this.fuel = Math.max(0, this.fuel - h * 1.2);
      if (Math.random() < 0.7 * P.quality) {
        const bb = c.aabb;
        P.fire(lerp(bb.minX, bb.maxX, Math.random()), lerp(bb.minY, bb.maxY, Math.random()) + 0.3, c.vx, c.vy + 1, 1, 0.7);
      }
      if (Math.random() < 0.1) P.smoke(c.x, c.y + 1, c.vx * 0.5, 1, 1, 0.9, 1);
      if (Math.random() < 0.04) AUDIO.noiseBurst({ dur: 0.3, vol: 0.12, freq: 900, freqEnd: 300 });
    }

    // звук
    if (this.engineSound) {
      const water = this.type === 'boat' ? clamp(this.speed() / 20, 0, 1) * (this.chassis.submerged > 0 ? 1 : 0) : 0;
      AUDIO.updateEngine(this.engineSound, this.rpm, this.dt && this.dt.shiftT > 0 ? this.throttle * 0.3 : this.throttle, { boost: this.boosting, water, off: this.fuel <= 0 && this.rpm < 0.05 });
      if (this.dt) AUDIO.setSkid(this.skid);
    }
  }

  _boostNozzle() {
    if (this.type === 'bike') return [-0.95, 0.45];
    if (this.type === 'boat') return [this.def.hull[0][0][0] - 0.1, 0.75];
    return [this.def.look.rear - 0.25, this.def.look.style === 'truck' ? 1.2 : this.def.look.belt + 0.25];
  }

  addBlood(wx, wy) {
    if (this.bloodSpots.length > 40) this.bloodSpots.shift();
    const l = this.chassis.worldToLocal(wx, wy);
    this.bloodSpots.push({ x: l.x + this.chassis.com.x, y: l.y + this.chassis.com.y, r: 0.08 + Math.random() * 0.16 });
  }

  /* ----------------------------- отрисовка ----------------------------- */
  render(ctx, alpha, night) {
    const c = this.chassis;
    const cx = c.ix(alpha), cy = c.iy(alpha), ca = c.ia(alpha);
    const state = {
      t: this.game.world.time, lean: this.lean, boosting: this.boosting, aim: this.aim - ca,
      recoil: this.recoil || 0, rpm: this.rpm, crashed: this.crashed, night,
      wheelSpin: this.wheels.map(w => Math.abs(w.w)), propSpin: this.propSpin || 0,
      propSubmerged: this.propSubmerged, blood: this.bloodSpots, throttle: this.throttle,
      riderRel: this.rider ? this.riderLean(alpha) : undefined,
      passenger: this.passenger, mira: { aim: Math.atan2(Math.sin(this.mira.aim - ca), Math.cos(this.mira.aim - ca)), recoil: this.mira.recoil, flash: this.mira.flash > 0, open: this.mira.open },
      dmg: this.dmg, brake: this.brake
    };
    // кузов на подвеске: поворот вокруг середины базы на уровне осей
    const pitchA = this.pitch ? this.pitch.a : 0;
    const pvx = this.type === 'car' ? (this.def.wheels[0].x + this.def.wheels[1].x) / 2 : 0;
    const pvy = this.type === 'car' ? this.def.wheels[0].y : 0;
    // стойки подвески и колёса позади
    if (this.type === 'car') {
      ctx.save();
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i], wd = w.def;
        const sp = Math.sin(pitchA), cp = Math.cos(pitchA);
        const lx0 = pvx + (wd.x - pvx) * cp - (wd.y + 0.35 - pvy) * sp, ly0 = pvy + (wd.x - pvx) * sp + (wd.y + 0.35 - pvy) * cp;
        const ax = cx + Math.cos(ca) * (lx0 - c.com.x) - Math.sin(ca) * (ly0 - c.com.y);
        const ay = cy + Math.sin(ca) * (lx0 - c.com.x) + Math.cos(ca) * (ly0 - c.com.y);
        const wx = w.ix(alpha), wy = w.iy(alpha);
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(wx, wy); ctx.stroke();
        ctx.strokeStyle = '#8f7f3a'; ctx.lineWidth = 0.05;
        const n = 6;
        ctx.beginPath();
        for (let k = 0; k <= n; k++) {
          const t = k / n, px = lerp(ax, wx, t * 0.8), py = lerp(ay, wy, t * 0.8);
          const off = (k % 2 ? 0.08 : -0.08);
          ctx.lineTo(px + Math.cos(ca) * off, py + Math.sin(ca) * off);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ca);
    ctx.translate(-c.com.x, -c.com.y);
    if (this.type === 'car') {
      if (pitchA) { ctx.translate(pvx, pvy); ctx.rotate(pitchA); ctx.translate(-pvx, -pvy); }
      // вмятины: весь рисунок кузова проходит через поле деформации
      drawCarBody(this.dmg && this.dmg.active ? this.dmg.wrap(ctx) : ctx, this.def, this.up, state);
    }
    else if (this.type === 'bike') drawBike(ctx, this.def, this.up, state, this);
    else drawBoat(ctx, this.def, this.up, state);
    ctx.restore();
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      drawWheel(ctx, w.ix(alpha), w.iy(alpha), w.ia(alpha), w.def.r, wheelLook(this.def, this.up, i, Math.abs(w.w)));
    }
    // передние части байка (вилка) поверх колеса
    if (this.type === 'bike') {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ca); ctx.translate(-c.com.x, -c.com.y);
      const fw = this.wheels[1];
      const lp = c.worldToLocal(fw.ix(alpha) - (cx - c.x) * 0, fw.iy(alpha));
      // локальная позиция колеса с учётом интерполяции
      const dx = fw.ix(alpha) - cx, dy = fw.iy(alpha) - cy;
      const lx = Math.cos(ca) * dx + Math.sin(ca) * dy + c.com.x;
      const ly = -Math.sin(ca) * dx + Math.cos(ca) * dy + c.com.y;
      drawBikeFork(ctx, this.def, lx, ly);
      ctx.restore();
    }
  }
}

/* ------------- Детали апгрейдов (внешний вид транспорта — в vehicle_art.js) ------------- */

function drawPlate(ctx, x, y, w, h, color) {
  const g = ctx.createLinearGradient(0, y + h, 0, y);
  g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.02; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#bbb';
  for (const [rx, ry] of [[x + 0.06, y + 0.06], [x + w - 0.06, y + 0.06], [x + 0.06, y + h - 0.06], [x + w - 0.06, y + h - 0.06]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 0.025, 0, Math.PI * 2); ctx.fill();
  }
}

function drawJerrycan(ctx, x, y, s) {
  ctx.fillStyle = '#b3261e';
  roundRect(ctx, x - s * 0.5, y, s, s * 0.8, s * 0.1); ctx.fill();
  ctx.strokeStyle = '#6d120d'; ctx.lineWidth = 0.02; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.1); ctx.lineTo(x + s * 0.35, y + s * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + s * 0.35, y + s * 0.1); ctx.lineTo(x - s * 0.35, y + s * 0.7); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.fillRect(x + s * 0.2, y + s * 0.8, s * 0.15, s * 0.12);
}

function drawTurret(ctx, x, y, aim, recoil, lvl) {
  ctx.fillStyle = '#333a33';
  roundRect(ctx, x - 0.3, y, 0.6, 0.18, 0.05); ctx.fill();
  ctx.save();
  ctx.translate(x, y + 0.28);
  ctx.rotate(aim);
  ctx.translate(-recoil * 0.08, 0);
  ctx.fillStyle = '#23272a';
  roundRect(ctx, -0.25, -0.12, 0.45, 0.24, 0.05); ctx.fill();
  ctx.fillStyle = '#3d4449';
  ctx.fillRect(0.15, -0.045, 0.55 + lvl * 0.08, 0.09);
  if (lvl >= 3) ctx.fillRect(0.15, 0.06, 0.5 + lvl * 0.06, 0.05);
  ctx.fillStyle = '#6a6f73'; ctx.fillRect(-0.1, 0.12, 0.2, 0.06);
  if (lvl >= 2) { ctx.fillStyle = '#4d5a3f'; polyPath(ctx, [[0.1, -0.2], [0.25, -0.2], [0.25, 0.25], [0.1, 0.25]]); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#20252a';
  ctx.beginPath(); ctx.arc(x, y + 0.28, 0.09, 0, Math.PI * 2); ctx.fill();
}

function drawRocket(ctx, x, y, len, active, t, back) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, 0.2, 0, -0.2);
  g.addColorStop(0, '#d9d9d9'); g.addColorStop(1, '#6d6d6d');
  ctx.fillStyle = g;
  roundRect(ctx, -len * 0.5, -0.16, len, 0.32, 0.12); ctx.fill();
  ctx.fillStyle = '#b52020'; ctx.fillRect(-len * 0.1, -0.16, 0.12, 0.32);
  ctx.fillStyle = '#333';
  polyPath(ctx, [[-len * 0.5, -0.12], [-len * 0.5 - 0.2, -0.2], [-len * 0.5 - 0.2, 0.2], [-len * 0.5, 0.12]]); ctx.fill();
  if (active) {
    const fl = 0.8 + Math.sin(t * 60) * 0.2 + Math.random() * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(-len * 0.5 - 0.2, 0, -len * 0.5 - 0.2 - 1.4 * fl, 0);
    fg.addColorStop(0, 'rgba(255,255,220,1)'); fg.addColorStop(0.3, 'rgba(255,170,40,0.9)'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-len * 0.5 - 0.2, 0.18); ctx.quadraticCurveTo(-len * 0.5 - 0.9 * fl, 0.12, -len * 0.5 - 0.2 - 1.4 * fl, 0); ctx.quadraticCurveTo(-len * 0.5 - 0.9 * fl, -0.12, -len * 0.5 - 0.2, -0.18); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/* --------------------------- Посадка гонщика --------------------------- */

// геометрия гонщика в координатах рамы: бедро, нейтральный угол торса и смещение головы от бедра
function riderGeometry(def) {
  const chopper = def.bikeStyle === 'chopper';
  const neutral = chopper ? 1.75 : 1.25, torso = 0.62;
  const hip = chopper ? [-0.35, 0.55] : [-0.2, 0.72];
  const sh = [Math.cos(neutral) * torso, Math.sin(neutral) * torso];
  const head = [sh[0] + Math.cos(neutral - 0.25) * 0.24, sh[1] + Math.sin(neutral - 0.25) * 0.24];
  return { hip, neutral, torso, head };
}

// превью для гаража (без физики)
function drawVehiclePreview(ctx, def, up, t, wheelAng, extra) {
  if (wheelAng === undefined) wheelAng = -t * 2;
  const s = { t, lean: 0, boosting: false, aim: 0.1 * Math.sin(t), recoil: 0, rpm: 0.2, crashed: false, blood: [], wheelSpin: [], propSpin: t * 8, throttle: 0 };
  if (extra) Object.assign(s, extra);
  if (def.type === 'car') {
    for (const wd of def.wheels) {
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.14;
      ctx.beginPath(); ctx.moveTo(wd.x, wd.y + 0.35); ctx.lineTo(wd.x, wd.y); ctx.stroke();
    }
    drawCarBody(ctx, def, up, s);
  } else if (def.type === 'bike') drawBike(ctx, def, up, s, null);
  else drawBoat(ctx, def, up, s);
  if (def.wheels) for (const wd of def.wheels) {
    drawWheel(ctx, wd.x, wd.y, wheelAng, wd.r, wheelLook(def, up, def.wheels.indexOf(wd), 0));
  }
  if (def.type === 'bike') drawBikeFork(ctx, def, def.wheels[1].x, def.wheels[1].y);
}
