'use strict';
/* Состав задника по темам: слои (от горизонта к дороге) и живность/техника.
   d — глубина для воздушной перспективы (0 — у горизонта, 1 — рядом), par — скорость параллакса,
   anchor — где стоит «пол» слоя по высоте экрана. life: k — вид объекта, x/y — точка на тайле слоя. */

const BACKDROPS = {
  suburbs: {
    layers: [
      { paint: 'hills', col: '#6d818c', d: 0.08, anchor: 0.555, par: 0.05, o: { top: 150, amp: 110, cells: 3 } },
      { paint: 'town', col: '#6e6a5c', d: 0.3, anchor: 0.6, par: 0.12, o: { burnt: 0.3 }, marks: [{ k: 'radiotower', x: 1320, y: 30 }] },
      { paint: 'hills', col: '#55663f', d: 0.55, anchor: 0.645, par: 0.24, o: { top: 70, amp: 60, fields: true }, marks: [{ k: 'turbine', x: 520, y: 70, s: 0.55 }, { k: 'turbine', x: 700, y: 62, s: 0.45 }] },
      { paint: 'treeline', col: '#34412d', d: 0.85, anchor: 0.7, par: 0.45, sway: 5, o: { dead: 0.3 } }
    ],
    life: [
      { k: 'crow', every: 13, max: 2, sp: 55, y0: 0.18, yv: 0.5, sc: 1.1, par: 0.05 },
      { k: 'flock', every: 34, max: 1, sp: 38, y0: 0.06, yv: 0.25 },
      { k: 'biplane', every: 46, max: 1, sp: 95, y0: 0.14, yv: 0.3, sc: 1 },
      { k: 'plume', layer: 1, x: 620, y: 86, h: 300, r: 50, a: 0.42 },
      { k: 'plume', layer: 1, x: 1580, y: 60, h: 220, r: 40, a: 0.32, wind: 34 }
    ,
      { k: 'turbine', layer: 2, x: 525, y: 198, r: 62, sp: 0.5 },
      { k: 'turbine', layer: 2, x: 703, y: 165, r: 50, sp: 0.62 },
      { k: 'motes', max: 1, every: 999, sc: 1 },
      { k: 'horde', where: 'layer', layer: 2, every: 50, max: 1, sp: 5, y0: 0.645, yv: 0.004, sc: 1, par: 0.24 }
    ]
  },
  highway: {
    layers: [
      { paint: 'hills', col: '#74838f', d: 0.07, anchor: 0.55, par: 0.045, o: { top: 130, amp: 90 } },
      { paint: 'city', col: '#5a6773', d: 0.26, anchor: 0.6, par: 0.1, o: { rows: 2, h: 330, wrecked: 0.3, lit: 0.05 }, marks: [{ k: 'radiotower', x: 1620, y: 300, s: 1.1 }] },
      { paint: 'city', col: '#3e4952', d: 0.52, anchor: 0.645, par: 0.2, o: { rows: 1, h: 250, wrecked: 0.5, broken: 0.5 }, marks: [{ k: 'bridge', x: 560, y: 0 }] },
      { paint: 'powerlines', col: '#2c333b', d: 0.85, anchor: 0.7, par: 0.45, o: { h: 250, step: 470 } }
    ],
    life: [
      { k: 'crow', every: 15, max: 2, sp: 60, y0: 0.2, yv: 0.45 },
      { k: 'flock', every: 40, max: 1, sp: 42, y0: 0.05 },
      { k: 'jet', every: 55, max: 1, sp: 85, y0: 0.05, yv: 0.1, sc: 0.9, par: 0.008 },
      { k: 'heli', every: 62, max: 1, sp: 105, y0: 0.16, yv: 0.25, sc: 0.85 },
      { k: 'plume', layer: 1, x: 900, y: 240, h: 420, r: 70, a: 0.4 },
      { k: 'plume', layer: 2, x: 300, y: 120, h: 300, r: 55, a: 0.45, col: '#4a4d54' }
    ,
      { k: 'motes', max: 1, every: 999 },
      { k: 'horde', where: 'layer', layer: 2, every: 45, max: 1, sp: 6, y0: 0.645, yv: 0.004, sc: 1.1, par: 0.2 }
    ]
  },
  refinery: {
    layers: [
      { paint: 'hills', col: '#7a4230', d: 0.08, anchor: 0.55, par: 0.05, o: { top: 120, amp: 90 } },
      { paint: 'industry', col: '#5a4740', d: 0.3, anchor: 0.605, par: 0.11 },
      { paint: 'industry', col: '#3a2c27', d: 0.55, anchor: 0.65, par: 0.22, o: { top: 10 }, marks: [{ k: 'wreckheli', x: 1700, y: 26 }] },
      { paint: 'pipes', col: '#2a1e1a', d: 0.85, anchor: 0.71, par: 0.45, o: { top: 110 } }
    ],
    life: [
      { k: 'crow', every: 22, max: 1, sp: 50, y0: 0.2, yv: 0.4 },
      { k: 'heli', every: 70, max: 1, sp: 110, y0: 0.12, yv: 0.2, sc: 0.8 },
      { k: 'flame', layer: 1, x: 1290, y: 470, h: 70, w: 26 },
      { k: 'plume', layer: 1, x: 1290, y: 540, h: 360, r: 60, a: 0.35, col: '#3a3330', wind: 40 },
      { k: 'plume', layer: 2, x: 520, y: 150, h: 420, r: 80, a: 0.5, col: '#241d1b', wind: 60, sp: 0.13 },
      { k: 'flame', layer: 2, x: 500, y: 150, h: 90, w: 40 },
      { k: 'plume', layer: 1, x: 200, y: 120, h: 260, r: 48, a: 0.3, col: '#4a3c36' }
    ,
      { k: 'motes', max: 1, every: 999, ember: true },
      { k: 'flag', layer: 2, x: 980, y: 120, w: 40, h: 24, col: '#8d3126' }
    ]
  },
  desert: {
    sunX: 0.62,
    layers: [
      { paint: 'mountains', col: '#9e7b64', d: 0.04, anchor: 0.55, par: 0.035, o: { top: 150, amp: 150, snow: false, cells: 4 } },
      { paint: 'mesas', col: '#b77c5a', d: 0.3, anchor: 0.6, par: 0.1, o: { n: 5, h: 200, hv: 180 }, marks: [{ k: 'airliner', x: 980, y: 34, s: 0.95 }] },
      { paint: 'dunes', col: '#cfa068', d: 0.62, anchor: 0.655, par: 0.22, o: { top: 70, amp: 80 } }
    ],
    life: [
      { k: 'crow', every: 26, max: 2, sp: 34, y0: 0.14, yv: 0.35, sc: 1.2 },
      { k: 'flock', every: 44, max: 1, sp: 40, y0: 0.07 },
      { k: 'biplane', every: 38, max: 1, sp: 110, y0: 0.12, yv: 0.28, sc: 1.05 },
      { k: 'tumbleweed', where: 'layer', layer: 2, every: 11, max: 3, sp: 70, y0: 0.62, yv: 0.02, sc: 1, par: 0.22 }
    ,
      { k: 'motes', max: 1, every: 999 }
    ]
  },
  canyon: {
    sunX: 0.78,
    layers: [
      { paint: 'mesas', col: '#a4674a', d: 0.1, anchor: 0.55, par: 0.05, o: { n: 4, h: 230, hv: 200 } },
      { paint: 'mesas', col: '#8a4f32', d: 0.34, anchor: 0.605, par: 0.12, o: { n: 5, h: 260, hv: 220 } },
      { paint: 'cliffs', col: '#6e3c26', d: 0.7, anchor: 0.67, par: 0.3, o: { top: 280, amp: 140 }, marks: [{ k: 'wreckheli', x: 1460, y: 120, s: 0.8 }] }
    ],
    life: [
      { k: 'crow', every: 9, max: 3, sp: 46, y0: 0.15, yv: 0.5, sc: 1.15 },
      { k: 'flock', every: 36, max: 1, sp: 44, y0: 0.06 },
      { k: 'biplane', every: 44, max: 1, sp: 100, y0: 0.1, yv: 0.25 }
    ,
      { k: 'motes', max: 1, every: 999 }
    ]
  },
  ghost: {
    sunX: 0.8,
    layers: [
      { paint: 'mesas', col: '#3b3547', d: 0.12, anchor: 0.55, par: 0.05, o: { n: 4, h: 200, hv: 160 } },
      { paint: 'hills', col: '#3a3340', d: 0.36, anchor: 0.61, par: 0.12, o: { top: 90, amp: 70 } },
      { paint: 'western', col: '#2e2731', d: 0.7, anchor: 0.67, par: 0.3, o: { mills: [520, 1560] }, marks: [{ k: 'watertower', x: 1180, y: 24 }] }
    ],
    life: [
      { k: 'bat', every: 16, max: 2, sp: 60, y0: 0.2, yv: 0.4 },
      { k: 'crow', every: 30, max: 1, sp: 44, y0: 0.22, yv: 0.35 },
      { k: 'windmill', layer: 2, x: 546, y: 176, r: 34, sp: 0.55 },
      { k: 'windmill', layer: 2, x: 1586, y: 176, r: 32, sp: 0.4 },
      { k: 'plume', layer: 2, x: 980, y: 90, h: 180, r: 34, a: 0.22, col: '#2a2630' }
    ,
      { k: 'horde', where: 'layer', layer: 1, every: 40, max: 1, sp: 5, y0: 0.61, yv: 0.004, sc: 1, par: 0.12 },
      { k: 'flag', layer: 2, x: 890, y: 96, w: 34, h: 20, col: '#7a2f28' }
    ]
  },
  forest: {
    sunX: 0.3,
    layers: [
      { paint: 'mountains', col: '#53606f', d: 0.06, anchor: 0.545, par: 0.04, o: { top: 250, amp: 240, snowline: 420 } },
      { paint: 'mountains', col: '#3d4a52', d: 0.28, anchor: 0.6, par: 0.1, o: { top: 170, amp: 170, snow: false } },
      { paint: 'forest', col: '#27342c', d: 0.55, anchor: 0.65, par: 0.2, sway: 2.5, o: { top: 90, amp: 60 }, marks: [{ k: 'radiotower', x: 1500, y: 120, s: 0.75 }] },
      { paint: 'forest', col: '#16201a', d: 0.86, anchor: 0.71, par: 0.44, sway: 4, o: { top: 50, amp: 30 } }
    ],
    life: [
      { k: 'crow', every: 12, max: 2, sp: 52, y0: 0.2, yv: 0.45, sc: 1.1 },
      { k: 'flock', every: 40, max: 1, sp: 40, y0: 0.07 },
      { k: 'heli', every: 58, max: 1, sp: 100, y0: 0.15, yv: 0.25, sc: 0.85 },
      { k: 'plume', layer: 2, x: 1320, y: 120, h: 300, r: 55, a: 0.3, col: '#3e4346' }
    ,
      { k: 'firefly', max: 1, every: 999 }
    ]
  },
  snow: {
    sunX: 0.66,
    layers: [
      { paint: 'mountains', col: '#8496ab', d: 0.05, anchor: 0.545, par: 0.035, o: { top: 280, amp: 300, snowline: 430, cells: 4 } },
      { paint: 'mountains', col: '#5b6a79', d: 0.3, anchor: 0.6, par: 0.1, o: { top: 170, amp: 220, snowline: 300 }, marks: [{ k: 'wreckheli', x: 880, y: 150, s: 0.9 }] },
      { paint: 'forest', col: '#2d3842', d: 0.62, anchor: 0.66, par: 0.22, sway: 1.5, o: { snow: true, top: 80, amp: 50 } }
    ],
    life: [
      { k: 'crow', every: 20, max: 2, sp: 48, y0: 0.18, yv: 0.4 },
      { k: 'flock', every: 46, max: 1, sp: 36, y0: 0.06 },
      { k: 'heli', every: 50, max: 1, sp: 95, y0: 0.14, yv: 0.22, sc: 0.9 }
    ]
  },
  dam: {
    layers: [
      { paint: 'mountains', col: '#38414d', d: 0.1, anchor: 0.545, par: 0.045, o: { top: 250, amp: 240, snowline: 380 } },
      { paint: 'damwall', col: '#4a4e54', d: 0.4, anchor: 0.62, par: 0.13, o: { h: 430 } },
      { paint: 'mountains', col: '#242a31', d: 0.8, anchor: 0.69, par: 0.4, o: { top: 120, amp: 160, snow: false } }
    ],
    life: [
      { k: 'spill', layer: 1, x: 866, y: 400, w: 72, h: 400 },
      { k: 'spill', layer: 1, x: 996, y: 400, w: 72, h: 400 },
      { k: 'spill', layer: 1, x: 1126, y: 400, w: 72, h: 400 },
      { k: 'beacon', layer: 1, x: 420, y: 446, per: 2.4 },
      { k: 'beacon', layer: 1, x: 1640, y: 446, per: 3.1 },
      { k: 'searchlight', layer: 1, x: 1760, y: 90, sp: 0.18, sweep: 0.5, len: 800 },
      { k: 'bat', every: 20, max: 2, sp: 66, y0: 0.24, yv: 0.35 },
      { k: 'heli', every: 64, max: 1, sp: 120, y0: 0.13, yv: 0.2, sc: 0.85 }
    ,
      { k: 'flag', layer: 1, x: 1180, y: 452, w: 40, h: 24, col: '#7f2b24' }
    ]
  },
  docks: {
    sunX: 0.26,
    layers: [
      { paint: 'city', col: '#586675', d: 0.12, anchor: 0.5, par: 0.045, o: { rows: 2, h: 300, lit: 0.07 } },
      { paint: 'harbor', col: '#333c45', d: 0.42, anchor: 0.55, par: 0.13, marks: [{ k: 'cargoship', x: 1480, y: 20, s: 0.95 }] }
    ],
    life: [
      { k: 'gull', every: 10, max: 3, sp: 62, y0: 0.2, yv: 0.5 },
      { k: 'crow', every: 34, max: 1, sp: 50, y0: 0.25, yv: 0.3 },
      { k: 'ship', every: 70, max: 1, sp: 16, y0: 0.495, yv: 0.01, sc: 1, par: 0.02 },
      { k: 'plume', layer: 0, x: 1180, y: 170, h: 380, r: 60, a: 0.35, col: '#4c525a' },
      { k: 'plume', layer: 1, x: 420, y: 90, h: 260, r: 45, a: 0.3, col: '#3c424a' },
      { k: 'beacon', layer: 1, x: 330, y: 330, per: 2.8 },
      { k: 'searchlight', layer: 1, x: 1500, y: 240, sp: 0.22, sweep: 0.55, len: 700 }
    ,
      { k: 'flag', layer: 1, x: 1480, y: 190, w: 36, h: 22, col: '#2f5a7a' }
    ]
  },
  sea: {
    sunX: 0.68,
    layers: [
      { paint: 'islands', col: '#46545f', d: 0.1, anchor: 0.5, par: 0.04, o: { n: 4, h: 70, trees: true }, marks: [{ k: 'cargoship', x: 640, y: 6, s: 0.55 }] },
      { paint: 'lighthouse', col: '#2b353d', d: 0.42, anchor: 0.55, par: 0.13, o: { x: 900 } }
    ],
    life: [
      { k: 'gull', every: 9, max: 3, sp: 58, y0: 0.18, yv: 0.5, sc: 1.05 },
      { k: 'ship', every: 60, max: 2, sp: 14, y0: 0.492, yv: 0.012, par: 0.02 },
      { k: 'lighthouse', layer: 1, x: 900, y: 244, per: 7, len: 760 },
      { k: 'jet', every: 90, max: 1, sp: 80, y0: 0.06, yv: 0.08, sc: 0.8, par: 0.008 }
    ]
  },
  island: {
    sunX: 0.8,
    layers: [
      { paint: 'tropical', col: '#5f7a8c', d: 0.1, anchor: 0.5, par: 0.04, o: { volcano: 0.62 } },
      { paint: 'tropical', col: '#2f4d38', d: 0.42, anchor: 0.56, par: 0.13, sway: 3, o: { palms: true }, marks: [{ k: 'airliner', x: 1420, y: 8, s: 0.7 }] }
    ],
    life: [
      { k: 'gull', every: 11, max: 3, sp: 56, y0: 0.18, yv: 0.45 },
      { k: 'flock', every: 40, max: 1, sp: 40, y0: 0.07 },
      { k: 'plume', layer: 0, x: 1270, y: 300, h: 420, r: 70, a: 0.3, col: '#6a6c70', sp: 0.1, wind: 50 },
      { k: 'biplane', every: 50, max: 1, sp: 100, y0: 0.13, yv: 0.25 },
      { k: 'ship', every: 80, max: 1, sp: 15, y0: 0.492, par: 0.02 }
    ]
  },
  carrier: {
    layers: [
      { paint: 'fleet', col: '#26333f', d: 0.15, anchor: 0.5, par: 0.045, o: { n: 5 } },
      { paint: 'superstructure', col: '#262c31', d: 0.45, anchor: 0.56, par: 0.12, o: { x: 520 }, marks: [{ k: 'wreckheli', x: 1560, y: 44, s: 0.9 }] }
    ],
    life: [
      { k: 'plume', layer: 0, x: 400, y: 30, h: 400, r: 70, a: 0.4, col: '#2e2a2a', wind: 70 },
      { k: 'flame', layer: 0, x: 400, y: 26, h: 70, w: 34 },
      { k: 'plume', layer: 0, x: 1500, y: 26, h: 320, r: 60, a: 0.35, col: '#2a2626', wind: 60 },
      { k: 'flame', layer: 0, x: 1500, y: 22, h: 50, w: 26 },
      { k: 'beacon', layer: 1, x: 625, y: 446, per: 1.8 },
      { k: 'searchlight', layer: 1, x: 760, y: 300, sp: 0.3, sweep: 0.7, len: 900 },
      { k: 'searchlight', layer: 1, x: 1400, y: 60, sp: 0.21, sweep: 0.5, len: 800 },
      { k: 'heli', every: 34, max: 2, sp: 130, y0: 0.14, yv: 0.22, sc: 0.9 },
      { k: 'gull', every: 30, max: 1, sp: 60, y0: 0.24, yv: 0.3 }
    ,
      { k: 'motes', max: 1, every: 999, ember: true }
    ]
  }
};
