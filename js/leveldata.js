'use strict';
/* Утверждённые трассы (по «Атласу трасс»). Координаты в метрах.
   profile — ключевые точки высоты рельефа (для моря — дно).
   Типы объектов:
   z{x,n,k,abs,y}   группа зомби: k = w бродяга | r бегун | f толстяк | s солдат | b пузырь (на море w — утопленник)
   boss{x}          Громила
   ramp{x,h}        трамплин (верх в точке x)
   upper{x,x2,h,style,gap}  верхний ярус на опорах (заезд — автоматический трамплин перед началом)
   bridge{x,x2,pillar,gap}  подвесной мост между краями
   wreck/crates/barrels{x,n}, barricade{x}, logs{x}, wagon{x}, fire{x,w}
   mine{x,n}, raft{x}, cont{x}, pier{x}, wramp{x}, reef{x,x2}, buoys{x,x2}, overhead{x,x2,h}, boom{x}
   fuel{x,y|abs}, cash{x,y|abs}, sign{x}, lamp{x}, safe{x,x2}, ice{x,x2}, death{x,x2}
   avalanche{x,x2}, collapse{x,x2,gaps}
*/

const LEVEL_DESIGN = {
  garages: {
    profile: [[0, 0], [40, 0], [70, 0.8], [100, 0], [130, 1], [160, 0], [300, 0], [340, 4], [370, 4.5], [420, 1], [450, 0], [470, 0], [480, -2], [495, -2], [505, 0], [690, 0], [702, -2.5], [716, -2.5], [726, 0], [770, 0], [810, 3], [845, 3], [865, 0], [900, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 62, n: 1 }, { t: 'z', x: 96, n: 1 }, { t: 'z', x: 142, n: 2 }, { t: 'ramp', x: 172, h: 1.2 }, { t: 'cash', x: 188, y: 3 },
      { t: 'crates', x: 262, n: 5 }, { t: 'z', x: 302, n: 3 }, { t: 'fuel', x: 360, y: 2 }, { t: 'z', x: 405, n: 8 }, { t: 'sign', x: 440 }, { t: 'ramp', x: 466, h: 1.5 },
      { t: 'upper', x: 530, x2: 625, h: 3.8, style: 'roof' }, { t: 'wreck', x: 560, n: 2 }, { t: 'z', x: 585, n: 5 }, { t: 'crates', x: 612, n: 3 },
      { t: 'z', x: 652, n: 3, k: 'r' }, { t: 'ramp', x: 688, h: 1.8 }, { t: 'z', x: 812, n: 10 }, { t: 'z', x: 832, n: 1, k: 'f' }, { t: 'safe', x: 860, x2: 900 }
    ]
  },
  highway: {
    profile: [[0, 0], [612, 0], [625, 0], [640, -6], [690, -6], [725, 0], [1100, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 62, n: 2 }, { t: 'wreck', x: 92, n: 1, light: true }, { t: 'ramp', x: 140, h: 1.3 }, { t: 'wreck', x: 154, n: 1 }, { t: 'z', x: 205, n: 4 },
      { t: 'ramp', x: 268, h: 1.8 }, { t: 'wreck', x: 284, n: 3 }, { t: 'z', x: 312, n: 5 }, { t: 'ramp', x: 338, h: 1.8 }, { t: 'wreck', x: 354, n: 2 },
      { t: 'upper', x: 395, x2: 576, h: 6, style: 'overpass', gap: [495, 503] }, { t: 'fuel', x: 545, y: 6.4 }, { t: 'wreck', x: 442, n: 2 }, { t: 'z', x: 470, n: 2, k: 'f' }, { t: 'cash', x: 484 }, { t: 'wreck', x: 522, n: 2 },
      { t: 'sign', x: 600 }, { t: 'ramp', x: 622, h: 2.2 }, { t: 'death', x: 0, x2: 0 }, { t: 'z', x: 660, n: 3, k: 'f' }, { t: 'barrels', x: 674, n: 2 }, { t: 'fuel', x: 690, y: 1.2 },
      { t: 'ramp', x: 744, h: 1.8 }, { t: 'wreck', x: 760, n: 2 }, { t: 'z', x: 805, n: 4, k: 'r' },
      { t: 'ramp', x: 924, h: 2 }, { t: 'barrels', x: 940, n: 1 }, { t: 'barricade', x: 950 }, { t: 'z', x: 985, n: 14, k: 'r' }, { t: 'safe', x: 1060, x2: 1100 }
    ]
  },
  refinery: {
    profile: [[0, 0], [240, 0], [270, 2], [330, 2], [350, 0], [690, 0], [700, -3], [735, -3], [745, 0], [1000, 0], [1085, 8], [1250, 8]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 52, n: 2 }, { t: 'barrels', x: 92, n: 1 }, { t: 'z', x: 98, n: 3 }, { t: 'crates', x: 150, n: 3 },
      { t: 'upper', x: 300, x2: 485, h: 5, style: 'pipe' }, { t: 'fire', x: 400, w: 5 }, { t: 'fuel', x: 462, abs: 8.4 },
      { t: 'barrels', x: 352, n: 3 }, { t: 'z', x: 360, n: 6 }, { t: 'barrels', x: 430, n: 3 }, { t: 'z', x: 438, n: 6 }, { t: 'cash', x: 455 },
      { t: 'z', x: 562, n: 8 }, { t: 'wreck', x: 602, n: 1 }, { t: 'sign', x: 640 }, { t: 'ramp', x: 686, h: 2 }, { t: 'fire', x: 715, w: 8 },
      { t: 'ramp', x: 792, h: 2 }, { t: 'barrels', x: 826, n: 3 }, { t: 'z', x: 872, n: 10, k: 'r' }, { t: 'z', x: 932, n: 1, k: 'b' },
      { t: 'z', x: 1040, n: 12 }, { t: 'z', x: 1058, n: 2, k: 'f' }, { t: 'z', x: 1070, n: 1, k: 'b' }, { t: 'safe', x: 1190, x2: 1250 }
    ]
  },
  saltflat: {
    profile: [[0, 0], [60, 0], [90, 3], [120, 0], [150, 3.5], [180, 0], [210, 3], [240, 0], [315, 0], [342, 4], [346, 4], [350, -1.5], [356, -1.5], [362, 0], [455, 0], [480, 4.5], [484, 4.5], [488, -2], [498, -2], [505, 0], [595, 0], [622, 5], [626, 5], [631, -2], [645, -2], [652, 0], [1350, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 75, n: 1 }, { t: 'z', x: 135, n: 2 }, { t: 'z', x: 196, n: 1 }, { t: 'z', x: 262, n: 2 },
      { t: 'z', x: 420, n: 4, k: 'r' }, { t: 'fuel', x: 494, y: 7 }, { t: 'z', x: 560, n: 4, k: 'r' }, { t: 'cash', x: 640, y: 7 },
      { t: 'upper', x: 740, x2: 900, h: 5.4, style: 'trailer', gap: [815, 822] }, { t: 'wreck', x: 762, n: 1 }, { t: 'wreck', x: 832, n: 1 }, { t: 'z', x: 798, n: 8 }, { t: 'wreck', x: 878, n: 1 },
      { t: 'fire', x: 940, w: 5, wreck: true }, { t: 'z', x: 992, n: 6 }, { t: 'z', x: 1002, n: 1, k: 'f' },
      { t: 'sign', x: 1120 }, { t: 'ramp', x: 1180, h: 2.5 }, { t: 'z', x: 1250, n: 40 }, { t: 'safe', x: 1310, x2: 1350 }
    ]
  },
  canyon: {
    profile: [[0, 0], [270, 0], [276, -4], [290, -4], [296, 0], [410, 0], [414, -14], [436, -14], [440, 0], [460, 0], [470, 1], [480, 0], [490, 1.2], [500, 0], [510, 1], [520, 0], [555, 0], [559, -16], [586, -16], [590, 0], [640, 0], [680, 3], [720, 0], [760, 2.5], [790, 0], [815, -10], [825, -10], [850, 0], [1180, 0], [1300, -10], [1450, -10]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 120, n: 2 }, { t: 'z', x: 210, n: 2 }, { t: 'bridge', x: 270, x2: 296 }, { t: 'z', x: 283, n: 3, bottom: true },
      { t: 'sign', x: 360 }, { t: 'bridge', x: 410, x2: 440 }, { t: 'death', x: 413, x2: 437 }, { t: 'z', x: 425, n: 2, abs: 0.2 },
      { t: 'sign', x: 505 }, { t: 'bridge', x: 555, x2: 590, pillar: 572 }, { t: 'death', x: 558, x2: 587 }, { t: 'z', x: 578, n: 2, abs: 0.2 },
      { t: 'z', x: 680, n: 4 }, { t: 'z', x: 760, n: 5, k: 'r' }, { t: 'sign', x: 740 },
      { t: 'bridge', x: 790, x2: 850, pillar: 808, gap: [814, 820], jump: true }, { t: 'z', x: 834, n: 8, bottom: true }, { t: 'z', x: 816, n: 2, bottom: true }, { t: 'fuel', x: 823, abs: -9 },
      { t: 'crates', x: 1000, n: 4 }, { t: 'z', x: 1080, n: 6 }, { t: 'z', x: 1240, n: 6 }, { t: 'z', x: 1360, n: 15 }, { t: 'safe', x: 1400, x2: 1450 }
    ]
  },
  ghosttown: {
    profile: [[0, 0], [1500, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'lamp', x: 80 }, { t: 'z', x: 84, n: 2 }, { t: 'lamp', x: 160 }, { t: 'z', x: 164, n: 3 }, { t: 'ramp', x: 240, h: 1.5 }, { t: 'lamp', x: 290 }, { t: 'z', x: 294, n: 3 },
      { t: 'upper', x: 355, x2: 520, h: 4.5, style: 'saloon', gap: [440, 448] }, { t: 'z', x: 400, n: 10 }, { t: 'crates', x: 470, n: 4 }, { t: 'cash', x: 478 },
      { t: 'upper', x: 595, x2: 740, h: 4.2, style: 'saloon' }, { t: 'z', x: 650, n: 12 }, { t: 'z', x: 702, n: 1, k: 'f' }, { t: 'fuel', x: 720, abs: 5.8 },
      { t: 'sign', x: 850 }, { t: 'upper', x: 895, x2: 1010, h: 5, style: 'station' }, { t: 'logs', x: 950 }, { t: 'z', x: 1050, n: 2, k: 'b' }, { t: 'z', x: 1100, n: 6, k: 'r' },
      { t: 'ramp', x: 1287, h: 3.4 }, { t: 'wagon', x: 1300 }, { t: 'z', x: 1350, n: 25 }, { t: 'safe', x: 1440, x2: 1500 }
    ]
  },
  pines: {
    profile: [[0, 0], [120, 0], [250, 10], [300, 11], [420, 2], [560, 2], [600, 8], [700, 4], [800, 6], [850, 6], [880, -12], [900, -12], [960, 6], [1000, 6], [1060, 9], [1120, 6], [1200, 6], [1550, 6]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 180, n: 2 }, { t: 'z', x: 330, n: 3 }, { t: 'logs', x: 460 }, { t: 'logs', x: 520 }, { t: 'ramp', x: 562, h: 2 },
      { t: 'z', x: 620, n: 3, k: 's' }, { t: 'crates', x: 700, n: 3 }, { t: 'z', x: 745, n: 8 }, { t: 'sign', x: 820 },
      { t: 'upper', x: 853, x2: 957, h: 0, style: 'log' }, { t: 'z', x: 890, n: 12, bottom: true }, { t: 'fuel', x: 892, abs: -10.8 },
      { t: 'z', x: 1060, n: 6, k: 'r' }, { t: 'barrels', x: 1340, n: 2 }, { t: 'logs', x: 1352 }, { t: 'ramp', x: 1330, h: 2.2 }, { t: 'z', x: 1400, n: 16 }, { t: 'z', x: 1420, n: 4, k: 's' }, { t: 'safe', x: 1490, x2: 1550 }
    ]
  },
  avalanche: {
    profile: [[0, 0], [100, 0], [300, -8], [800, -34], [940, -36], [948, -44], [1080, -46], [1090, -56], [1250, -58], [1650, -60]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 150, n: 2 }, { t: 'z', x: 240, n: 2 }, { t: 'ramp', x: 372, h: 2 }, { t: 'ice', x: 440, x2: 480 }, { t: 'ramp', x: 512, h: 2 }, { t: 'z', x: 560, n: 4 },
      { t: 'ice', x: 600, x2: 640 }, { t: 'ramp', x: 672, h: 2 }, { t: 'fuel', x: 722, y: 4 }, { t: 'sign', x: 820 }, { t: 'avalanche', x: 850, x2: 1250 },
      { t: 'z', x: 980, n: 8, k: 'r' }, { t: 'z', x: 1150, n: 8 },
      { t: 'sign', x: 1290 }, { t: 'bridge', x: 1340, x2: 1390, pillar: 1365 }, { t: 'death', x: 1342, x2: 1388 }, { t: 'z', x: 1450, n: 12, k: 's' }, { t: 'safe', x: 1600, x2: 1650 }
    ],
    chasm: [[1340, 1390, -85]]
  },
  dam: {
    profile: [[0, 0], [60, 0], [300, 12], [1450, 12], [1600, 0], [1750, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'lamp', x: 150 }, { t: 'z', x: 200, n: 2, k: 's' }, { t: 'gun', x: 216, n: 2 }, { t: 'sign', x: 330 },
      { t: 'ramp', x: 420, h: 2 }, { t: 'barricade', x: 436 }, { t: 'z', x: 450, n: 5, k: 's' }, { t: 'ramp', x: 490, h: 2 }, { t: 'barricade', x: 505 },
      { t: 'upper', x: 555, x2: 765, h: 6, style: 'gantry' }, { t: 'barricade', x: 620 }, { t: 'z', x: 632, n: 5, k: 's' }, { t: 'barricade', x: 710 }, { t: 'z', x: 722, n: 5, k: 's' }, { t: 'fuel', x: 742, abs: 19.4 },
      { t: 'ramp', x: 826, h: 2 }, { t: 'barricade', x: 842 }, { t: 'fuel', x: 1000, y: 1.2 },
      { t: 'ramp', x: 1060, h: 2.5 }, { t: 'barrels', x: 1084, n: 4 }, { t: 'boss', x: 1102 },
      { t: 'sign', x: 1270 }, { t: 'collapse', x: 1320, x2: 1440, gaps: [[1360, 1366], [1410, 1416]] }, { t: 'z', x: 1520, n: 10, k: 'r' }, { t: 'gun', x: 1545, n: 3 }, { t: 'safe', x: 1690, x2: 1750 }
    ]
  },
  docks: {
    waves: [0.35, 0.45],
    profile: [[0, -6], [1500, -6]],
    items: [
      { t: 'safe', x: 0, x2: 50 }, { t: 'buoys', x: 60, x2: 260 }, { t: 'z', x: 120, n: 1 }, { t: 'z', x: 190, n: 1 }, { t: 'z', x: 250, n: 2 },
      { t: 'reef', x: 360, x2: 375 }, { t: 'reef', x: 470, x2: 486 }, { t: 'z', x: 520, n: 6 }, { t: 'fuel', x: 525, y: 1 },
      { t: 'pier', x: 600 }, { t: 'gun', x: 596, abs: 1.85 }, { t: 'raft', x: 700 },
      { t: 'cont', x: 850 }, { t: 'cont', x: 905 }, { t: 'cont', x: 960 }, { t: 'sign', x: 1010 }, { t: 'overhead', x: 1050, x2: 1080, h: 3.5 }, { t: 'z', x: 1120, n: 10 },
      { t: 'pier', x: 1250 }, { t: 'gun', x: 1245, abs: 1.85, n: 2 }, { t: 'z', x: 1350, n: 12 }, { t: 'safe', x: 1450, x2: 1500 }
    ]
  },
  storm: {
    waves: [0.6, 1.5],
    profile: [[0, -8], [1800, -8]],
    items: [
      { t: 'safe', x: 0, x2: 50 }, { t: 'rboat', x: 70, role: 'escort', side: 'B' }, { t: 'z', x: 200, n: 2 }, { t: 'z', x: 320, n: 2 }, { t: 'rboat', x: 360, role: 'chase' }, { t: 'wramp', x: 520 }, { t: 'raft', x: 600 }, { t: 'z', x: 650, n: 8 }, { t: 'wramp', x: 760 },
      { t: 'rboat', x: 860, role: 'ahead' }, { t: 'sign', x: 930 }, { t: 'wramp', x: 978 }, { t: 'reef', x: 1000, x2: 1060 }, { t: 'fuel', x: 1120, y: 1 }, { t: 'reef', x: 1180, x2: 1230 },
      { t: 'rboat', x: 1300, role: 'chase' }, { t: 'cont', x: 1460 }, { t: 'cont', x: 1520 }, { t: 'z', x: 1500, n: 6 }, { t: 'z', x: 1650, n: 10 }, { t: 'safe', x: 1750, x2: 1800 }
    ]
  },
  mines: {
    waves: [0.6, 0.8],
    profile: [[0, -8], [1900, -8]],
    items: [
      { t: 'safe', x: 0, x2: 50 }, { t: 'rboat', x: 70, role: 'escort', side: 'B' }, { t: 'buoys', x: 205, x2: 235 }, { t: 'mine', x: 220, n: 1 }, { t: 'z', x: 320, n: 2 },
      { t: 'mine', x: 450, n: 3 }, { t: 'wramp', x: 562 }, { t: 'mine', x: 590, n: 3 }, { t: 'z', x: 700, n: 6 }, { t: 'raft', x: 800, gun: true }, { t: 'mine', x: 812, n: 1 }, { t: 'rboat', x: 880, role: 'chase' },
      { t: 'raft', x: 1000 }, { t: 'mine', x: 1012, n: 1 }, { t: 'raft', x: 1100, gun: true }, { t: 'mine', x: 1112, n: 1 }, { t: 'fuel', x: 1150, y: 1 }, { t: 'pier', x: 1200 }, { t: 'gun', x: 1195, abs: 1.85 }, { t: 'mine', x: 1222, n: 4 }, { t: 'rboat', x: 1300, role: 'chase' },
      { t: 'sign', x: 1550 }, { t: 'wramp', x: 1588 }, { t: 'boom', x: 1602 }, { t: 'z', x: 1720, n: 14 }, { t: 'safe', x: 1850, x2: 1900 }
    ]
  },
  island: {
    profile: [[0, 0], [60, 0], [280, 6], [1300, 6], [1450, 12], [1650, 0], [1900, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'ice', x: 40, x2: 280, f: 0.6 }, { t: 'barricade', x: 120, bags: true }, { t: 'z', x: 132, n: 3, k: 's' }, { t: 'barricade', x: 200, bags: true }, { t: 'z', x: 212, n: 3, k: 's' },
      { t: 'barricade', x: 380 }, { t: 'gun', x: 330, n: 2 }, { t: 'gun', x: 296, n: 2, side: 'B' }, { t: 'z', x: 394, n: 6, k: 's' }, { t: 'barricade', x: 460 }, { t: 'ramp', x: 528, h: 2.5 }, { t: 'barricade', x: 542 },
      { t: 'upper', x: 600, x2: 760, h: 5.4, style: 'bunker' }, { t: 'z', x: 660, n: 12 }, { t: 'gun', x: 712, n: 2 }, { t: 'fuel', x: 735, abs: 12.6 },
      { t: 'gun', x: 840, n: 3 }, { t: 'sign', x: 870 }, { t: 'mine', x: 920, n: 5 }, { t: 'fuel', x: 1050, y: 1.2 }, { t: 'barrels', x: 1132, n: 4 }, { t: 'boss', x: 1152 },
      { t: 'gun', x: 1250, n: 3 }, { t: 'gun', x: 1214, n: 2, side: 'B' }, { t: 'z', x: 1400, n: 8, k: 'r' }, { t: 'gun', x: 1600, n: 2 }, { t: 'z', x: 1720, n: 20, k: 'r' }, { t: 'safe', x: 1840, x2: 1900 }
    ]
  },
  chase: {
    waves: [0.8, 1.1],
    profile: [[0, -8], [2000, -8]],
    items: [
      { t: 'safe', x: 0, x2: 50 }, { t: 'rboat', x: 70, role: 'escort', side: 'B' }, { t: 'z', x: 220, n: 3 }, { t: 'rboat', x: 260, role: 'chase' }, { t: 'raft', x: 330, gun: true }, { t: 'wramp', x: 520 }, { t: 'mine', x: 650, n: 2 }, { t: 'wramp', x: 780 }, { t: 'cont', x: 842 }, { t: 'mine', x: 900, n: 2 },
      { t: 'fuel', x: 960, y: 1 }, { t: 'rboat', x: 1000, role: 'ahead' }, { t: 'wramp', x: 1100 }, { t: 'fire', x: 1135, w: 10 }, { t: 'z', x: 1200, n: 12 }, { t: 'wramp', x: 1300 }, { t: 'fire', x: 1335, w: 10 },
      { t: 'rboat', x: 1380, role: 'escort', side: 'B' }, { t: 'rboat', x: 1420, role: 'chase' }, { t: 'rboat', x: 1460, role: 'chase' }, { t: 'sign', x: 1700 }, { t: 'wramp', x: 1762 }, { t: 'mine', x: 1792, n: 3 }, { t: 'z', x: 1880, n: 8 }, { t: 'safe', x: 1950, x2: 2000 }
    ]
  },
  carrier: {
    profile: [[0, 0], [1740, 0], [1745, -8], [1775, -8], [1780, 0], [2060, 0], [2062, -14], [2094, -14], [2096, 0], [2100, 0]],
    items: [
      { t: 'safe', x: 0, x2: 40 }, { t: 'z', x: 120, n: 4, k: 's' }, { t: 'crates', x: 180, n: 4, metal: true }, { t: 'ramp', x: 252, h: 2 }, { t: 'wreck', x: 270, n: 1 },
      { t: 'upper', x: 480, x2: 640, h: 6.6, style: 'container' }, { t: 'upper', x: 760, x2: 900, h: 8.2, style: 'container' }, { t: 'fuel', x: 880, abs: 9.6 },
      { t: 'z', x: 560, n: 15 }, { t: 'z', x: 602, n: 3, k: 'b' }, { t: 'gun', x: 625, n: 2 }, { t: 'z', x: 820, n: 12 }, { t: 'gun', x: 885, n: 2 },
      { t: 'gun', x: 1060, n: 3 }, { t: 'gun', x: 1024, n: 2, side: 'B' }, { t: 'barrels', x: 1120, n: 5 }, { t: 'boss', x: 1150 }, { t: 'z', x: 1240, n: 8, k: 'r' }, { t: 'barrels', x: 1330, n: 5 }, { t: 'boss', x: 1352 }, { t: 'fire', x: 1420, w: 8 },
      { t: 'gun', x: 1560, n: 3 }, { t: 'gun', x: 1522, n: 2, side: 'B' }, { t: 'sign', x: 1680 }, { t: 'ramp', x: 1730, h: 3 }, { t: 'death', x: 1745, x2: 1775 }, { t: 'z', x: 1900, n: 25 }, { t: 'gun', x: 1990, n: 2 },
      { t: 'ramp', x: 2046, h: 4 }, { t: 'death', x: 2062, x2: 2094 }
    ]
  }
};
