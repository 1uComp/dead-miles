'use strict';
/* Приложение: сохранения, ввод, главный цикл, переходы между экранами */

const SAVE_KEY = 'deadmiles_save_v1';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.ui = new UI(this);
    this.input = { gas: false, brake: false, left: false, right: false, boost: false };
    this.load();
    this.renderer.quality = this.settings.quality;
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());
    this._bindInput();
    this.game = null;
    this.state = 'menu';
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.startDemo(Math.min(this.save.unlocked, LEVELS.length - 1));
    this.ui.showMenu();
    const unlockAudio = () => { AUDIO.init(); AUDIO.setVolume(this.settings.volume); AUDIO.setMusicVolume(this.settings.music); if (this.state !== 'play' && !AUDIO.musicState) AUDIO.startMusic('menu'); };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    requestAnimationFrame(t => this.loop(t));
  }

  /* ------------------------------ сохранения ------------------------------ */
  defaultSave() {
    return {
      money: 0, unlocked: 0, completed: [], best: {},
      owned: { rust: { up: {} } },
      // активный транспорт по сюжету для суши и моря (старый после замены недоступен)
      active: { land: 'rust', sea: null },
      seen: {},
      settings: { volume: 0.8, music: 0.5, quality: 1, fps: false, touch: 'auto' }
    };
  }
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
    const d = this.defaultSave();
    this.save = Object.assign(d, s || {});
    this.save.settings = Object.assign(d.settings, (s && s.settings) || {});
    this.settings = this.save.settings;
    if (!this.save.active) this.save.active = { land: this.currentVehicleFor(this._latestOfType('land')), sea: null };
  }
  _latestOfType(type) {
    let li = 0;
    for (let j = 0; j <= Math.min(this.save.unlocked, LEVELS.length - 1); j++) if (LEVELS[j].type === type) li = j;
    return li;
  }
  // транспорт, которым игрок едет на уровне li: последний выданный по сюжету для этой среды
  currentVehicleFor(li) {
    const medium = LEVELS[li].type;
    let vid = LEVELS[li].vehicle;
    const upto = Math.max(li, Math.min(this.save.unlocked, LEVELS.length - 1));
    for (let j = 0; j <= upto; j++) if (LEVELS[j].type === medium) vid = LEVELS[j].vehicle;
    return vid;
  }
  // проверка смены транспорта: возвращает {from, to}, если по сюжету выдан новый
  checkVehicleSwap(li) {
    const medium = LEVELS[li].type === 'sea' ? 'sea' : 'land';
    const to = this.currentVehicleFor(li);
    const from = this.save.active[medium];
    if (!this.save.owned[to]) this.save.owned[to] = { up: {} };
    if (from === to) return null;
    this.save.active[medium] = to;
    this.persist();
    return { from, to };
  }
  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { }
  }
  resetSave() {
    const st = this.settings;
    this.save = this.defaultSave();
    this.save.settings = st; this.settings = st;
    this.persist();
    this.startDemo(0);
  }
  buyUpgrade(id, key) {
    const o = this.save.owned[id]; if (!o) return false;
    const def = VEHICLE_BY_ID[id];
    const lvl = o.up[key] || 0;
    if (lvl >= UPGRADE_MAX[key]) return false;
    const cost = upgradeCost(def, key, lvl);
    if (this.save.money < cost) return false;
    this.save.money -= cost;
    o.up[key] = lvl + 1;
    this.persist();
    return true;
  }
  applyQuality() {
    this.renderer.quality = this.settings.quality;
    this.renderer.resize();
    if (this.game) { this.game.particles.quality = this.settings.quality >= 1 ? 1 : 0.5; }
  }

  /* ------------------------------ ввод ------------------------------ */
  _bindInput() {
    const map = {
      ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost'
    };
    window.addEventListener('keydown', e => {
      const k = map[e.code];
      if (this.state === 'play') {
        if (k) { this.input[k] = true; e.preventDefault(); }
        if ((e.code === 'Escape' || e.code === 'KeyP') && !this.paused && this.ui.current === 'hud') { e.preventDefault(); this.pause(); }
        if (e.code === 'KeyR' && !this.paused && this.game && this.game.state === 'drive') this.game.endRun('fuel');
      }
    });
    window.addEventListener('keyup', e => { const k = map[e.code]; if (k) this.input[k] = false; });
    window.addEventListener('blur', () => { for (const k in this.input) this.input[k] = false; });
    const touch = document.getElementById('touch');
    touch.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k;
      const on = e => { e.preventDefault(); AUDIO.init(); this.input[k] = true; b.classList.add('on'); };
      const off = e => { e.preventDefault(); this.input[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    document.getElementById('tpause').addEventListener('click', () => { if (this.state === 'play' && !this.paused) this.pause(); });
    this.isTouch = matchMedia('(pointer: coarse)').matches;
  }
  updateTouch() {
    const t = this.settings.touch;
    const show = this.state === 'play' && !this.paused && (t === 'on' || (t === 'auto' && this.isTouch));
    document.getElementById('touch').classList.toggle('hidden', !show);
  }

  /* ------------------------------ переходы ------------------------------ */
  fade(fn) {
    const f = document.getElementById('fade');
    f.classList.add('on');
    setTimeout(() => { fn(); f.classList.remove('on'); }, 330);
  }

  startDemo(li) {
    if (this.game && this.game.demo && this.game.levelIndex === li) return;
    if (this.game) this.game.destroy();
    const lv = LEVELS[li];
    // на фоне меню/катсцен едет сюжетный транспорт этого уровня по дороге без препятствий
    const vid = LEVELS[li].vehicle;
    this.game = new Game(this, li, vid, { demo: true, upgrades: { armor: 3, engine: 3, tires: 2 } });
    this.renderer.setLevel(lv);
    this.demoLevel = li;
    this.acc = 0;
  }

  continueGame() {
    let li = Math.min(this.save.unlocked, LEVELS.length - 1);
    this.selectLevel(li);
  }

  selectLevel(li) {
    const lv = LEVELS[li], s = this.save;
    const chKey = 'ch' + lv.chapter;
    const firstInChapter = LEVELS.findIndex(l => l.chapter === lv.chapter) === li;
    const toGarage = () => this.fade(() => { this.startDemo(li); this.ui.showGarage(li); AUDIO.startMusic('menu'); });
    const intro = () => {
      if (!s.seen[lv.id]) {
        s.seen[lv.id] = true; this.persist();
        this.fade(() => { this.startDemo(li); this.ui.showStory(storyLines(lv, 'intro', s), toGarage); });
      } else toGarage();
    };
    if (firstInChapter && !s.seen[chKey]) {
      s.seen[chKey] = true; this.persist();
      this.fade(() => { this.startDemo(li); this.ui.showChapterCard(lv.chapter, intro); });
    } else intro();
  }

  toGarage(li) {
    this.state = 'menu';
    AUDIO.stopAllEngines();
    this.updateTouch();
    this.fade(() => { this.startDemo(li); this.ui.showGarage(li); AUDIO.startMusic('menu'); });
  }

  startRun(li, vid) {
    vid = vid || this.currentVehicleFor(li);
    if (!this.save.owned[vid]) this.save.owned[vid] = { up: {} };
    this.fade(() => {
      if (this.game) this.game.destroy();
      AUDIO.stopMusic();
      AUDIO.stopAllEngines();
      this.game = new Game(this, li, vid);
      this.renderer.setLevel(LEVELS[li]);
      this.state = 'play';
      this.paused = false;
      this.acc = 0;
      for (const k in this.input) this.input[k] = false;
      this.ui.showHudButtons();
      this.updateTouch();
    });
  }

  pause() {
    if (this.state !== 'play') return;
    this.paused = true;
    if (this.game && this.game.vehicle.engineSound) AUDIO.updateEngine(this.game.vehicle.engineSound, 0, 0, { off: true });
    AUDIO.setSkid(0);
    this.updateTouch();
    this.ui.showPause();
  }
  resume() {
    this.paused = false;
    this.last = performance.now();
    for (const k in this.input) this.input[k] = false;
    this.ui.showHudButtons();
    this.updateTouch();
  }
  forceEnd() {
    this.resume();
    if (this.game && this.game.state === 'drive') this.game.endRun('fuel');
  }

  onRunEnd(sum) {
    const s = this.save, lv = LEVELS[sum.level];
    s.money += sum.total;
    const prevBest = s.best[lv.id] || 0;
    const newBest = sum.distance > prevBest;
    if (newBest) s.best[lv.id] = sum.distance;
    if (sum.complete) {
      s.best[lv.id] = lv.length;
      if (!s.completed.includes(lv.id)) s.completed.push(lv.id);
      s.unlocked = Math.max(s.unlocked, Math.min(LEVELS.length - 1, sum.level + 1));
    }
    this.persist();
    this.state = 'results';
    AUDIO.stopAllEngines();
    AUDIO.stopRain();
    this.updateTouch();
    this.ui.showResults(sum, { newBest });
  }

  afterComplete(li) {
    const lv = LEVELS[li];
    this.state = 'menu';
    this.fade(() => {
      AUDIO.startMusic(lv.final ? 'menu' : 'tense');
      this.ui.showStory(storyLines(lv, 'outro', this.save), () => {
        if (lv.final) {
          // запоминаем, какие концовки уже открыты
          this.save.endings = Object.assign({}, this.save.endings, { [this.save.branch || 'military']: true });
          this.persist();
          this.fade(() => { this.startDemo(0); this.ui.showMenu(); });
        } else this.selectLevel(li + 1);
      });
    });
  }

  /* ------------------------------ цикл ------------------------------ */
  loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    const g = this.game;
    if (g) {
      if (!this.paused) {
        this.acc += dt * g.slowmo;
        let n = 0;
        while (this.acc >= STEP && n < 8) {
          g.step(STEP, this.input);
          this.acc -= STEP; n++;
        }
        if (n === 8) this.acc = 0;
        g.frame(dt, this.input);
        if (g.demo && g.needRestart) { const li = this.demoLevel; this.game.destroy(); this.game = null; this.startDemo(li); }
      }
      if (this.game) {
        this.game.showFps = this.settings.fps;
        this.renderer.render(this.game, this.paused ? 1 : this.acc / STEP);
        if (this.state === 'play') this.renderer.hud(this.game);
      }
    }
    requestAnimationFrame(t => this.loop(t));
  }
}

window.addEventListener('load', () => {
  try {
    window.app = new App();
    // режим отладки: #test=уровень,машина — сразу запускает заезд с автопилотом
    const m = location.hash.match(/test=(\d+),(\w+)(?:,(\w+))?/);
    if (m) {
      const li = +m[1], vid = m[2];
      app.save.owned[vid] = app.save.owned[vid] || { up: m[3] === 'max' ? { engine: 3, gearbox: 2, tires: 2, armor: 4, fuel: 3, boost: 2, gun: 3 } : {} };
      app.startRun(li, vid);
      setTimeout(() => {
        const g = app.game; if (!g || g.demo) return;
        g.step = ((orig) => function (h) { const inp = this._autopilot(); inp.boost = this.vehicle.speed() > 6 && Math.random() < 0.3; orig.call(this, h, inp); })(g.step);
      }, 500);
    }
  } catch (e) {
    console.error(e);
    document.body.innerHTML = '<pre style="color:#f66;padding:20px;white-space:pre-wrap">Ошибка запуска: ' + e.stack + '</pre>';
  }
});
