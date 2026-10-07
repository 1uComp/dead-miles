'use strict';
/* Интерфейс: меню, карта глав, сюжетные диалоги, гараж, результаты, пауза, настройки */

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.current = null;
    this._raf = null;
  }
  clear() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    this.root.innerHTML = '';
    this.current = null;
  }
  mount(node, name) {
    this.clear();
    this.root.appendChild(node);
    this.current = name;
    node.querySelectorAll('.btn, .lvl').forEach(b => b.addEventListener('pointerdown', () => AUDIO.init(), { once: true }));
    return node;
  }
  onKey(fn) { this._keyHandler = fn; window.addEventListener('keydown', fn); }

  /* ------------------------------ меню ------------------------------ */
  showMenu() {
    const s = this.app.save;
    const hasProgress = s.unlocked > 0 || s.money > 0 || Object.keys(s.best).length;
    const n = this.mount(el(`
      <div class="screen menu">
        <div class="logo"><span class="l1">Мёртвые</span><span class="l2">мили</span></div>
        <div class="tagline">Тысяча километров до последнего корабля. Семь дней. Одна машина — и та на честном слове.</div>
        <div class="btns">
          <button class="btn big" data-a="play">${hasProgress ? '▶ Продолжить' : '▶ Новая игра'}</button>
          <button class="btn dark" data-a="map">Главы</button>
          <button class="btn dark" data-a="settings">Настройки</button>
          ${hasProgress ? '<button class="btn dark small" data-a="reset">Сбросить прогресс</button>' : ''}
        </div>
        <div class="foot">Газ: ↑ / W &nbsp;·&nbsp; Тормоз/назад: ↓ / S &nbsp;·&nbsp; Наклон: ← → / A D &nbsp;·&nbsp; Ускоритель: Пробел / Shift &nbsp;·&nbsp; Пауза: Esc</div>
      </div>`), 'menu');
    n.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      AUDIO.init(); AUDIO.click();
      const act = a.dataset.a;
      if (act === 'play') this.app.continueGame();
      if (act === 'map') this.showMap();
      if (act === 'settings') this.showSettings(() => this.showMenu());
      if (act === 'reset') { if (confirm('Удалить весь прогресс, деньги и машины?')) { this.app.resetSave(); this.showMenu(); } }
    });
  }

  /* ------------------------------ карта ------------------------------ */
  showMap() {
    const s = this.app.save;
    let html = `<div class="screen map">
      <div class="topbar"><button class="btn dark small" data-a="back">← Меню</button><h2 class="title-font">Дорога на север</h2><div class="money"><small>БАНК</small>${fmtMoney(s.money)}</div></div>
      <div class="chapters">`;
    CHAPTERS.forEach((ch, ci) => {
      html += `<div class="chapter panel" style="animation-delay:${ci * 0.07}s"><h2><span>${ch.title}</span>${ch.name}</h2><div class="levels">`;
      LEVELS.forEach((lv, li) => {
        if (lv.chapter !== ci) return;
        const locked = li > s.unlocked;
        const done = s.completed.includes(lv.id);
        const best = s.best[lv.id] || 0;
        const pct = Math.min(100, best / lv.length * 100);
        const times = { dawn: 'рассвет', day: 'день', noon: 'полдень', dusk: 'закат', night: 'ночь' };
        html += `<div class="lvl ${locked ? 'locked' : ''} ${done ? 'done' : ''}" data-l="${li}">
          <div class="num">УРОВЕНЬ ${li + 1}</div>
          <div class="name">${locked ? '???' : lv.name}</div>
          <div class="meta">${lv.length} м · ${times[lv.time] || ''}${lv.type === 'sea' ? ' · море' : ''}</div>
          <div class="bar"><i style="width:${done ? 100 : pct}%"></i></div>
          ${done ? '<div class="badge">ПРОЙДЕН</div>' : ''}
          <div class="type">${locked ? '🔒' : lv.type === 'sea' ? '🚤' : '🚙'}</div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += `</div></div>`;
    const n = this.mount(el(html), 'map');
    n.addEventListener('click', e => {
      if (e.target.closest('[data-a="back"]')) { AUDIO.click(); return this.showMenu(); }
      const l = e.target.closest('.lvl'); if (!l) return;
      const li = +l.dataset.l;
      if (li > s.unlocked) { AUDIO.denied(); return; }
      AUDIO.click();
      this.app.selectLevel(li);
    });
    this.onKey(e => { if (e.key === 'Escape') this.showMenu(); });
  }

  /* ------------------------------ сюжет ------------------------------ */
  showChapterCard(ci, onDone) {
    const ch = CHAPTERS[ci];
    const n = this.mount(el(`<div class="screen chaptercard">
      <div class="ct">${ch.title}</div><div class="cn">${ch.name}</div><div class="cx">${(this.app.save.branch === 'raiders' && ch.textB) || ch.text}</div>
      <div class="hint">нажмите, чтобы продолжить</div></div>`), 'chapter');
    AUDIO.startMusic('tense');
    let done = false;
    const go = () => { if (done) return; done = true; AUDIO.click(); onDone(); };
    setTimeout(() => { n.addEventListener('click', go); this.onKey(e => { if ([' ', 'Enter', 'Escape'].includes(e.key)) go(); }); }, 500);
  }

  showStory(lines, onDone) {
    let i = 0, typing = null, full = false, choosing = false;
    const app = this.app;
    const n = this.mount(el(`<div class="screen story">
      <button class="btn dark small skip">Пропустить »</button>
      <div class="dialog"><div class="portrait"><canvas width="300" height="360"></canvas></div>
      <div class="dbox panel"><div class="who"></div><div class="text"></div><div class="choices"></div><div class="hint">▼ далее</div></div></div></div>`), 'story');
    const who = n.querySelector('.who'), text = n.querySelector('.text'), cv = n.querySelector('canvas'), portrait = n.querySelector('.portrait');
    const dialog = n.querySelector('.dialog'), choices = n.querySelector('.choices'), hint = n.querySelector('.hint');
    // реплики чужой ветки сюжета пропускаются
    const visible = l => !l.branch || l.branch === (app.save.branch || 'military');
    const skipHidden = () => { while (i < lines.length && !visible(lines[i])) i++; };
    // живые портреты: у каждого говорящего своё лицо, эмоции и липсинк
    const stage = new PortraitStage();
    const pctx = cv.getContext('2d');
    const drawP = () => {
      if (!lines[i]) return;
      stage.draw(pctx);
      this._raf = requestAnimationFrame(drawP);
    };
    const finish = () => { clearInterval(typing); onDone(); };
    // выбор: кнопки под репликой
    const offerChoice = line => {
      choosing = true;
      hint.style.display = 'none';
      choices.innerHTML = '';
      line.choice.forEach((c, k) => {
        const btn = el(`<button class="btn ${k ? 'red' : 'dark'} choice"><span class="key">${k + 1}</span>${c.label}</button>`);
        btn.addEventListener('click', e => { e.stopPropagation(); pick(c.value); });
        choices.appendChild(btn);
      });
    };
    const pick = value => {
      if (!choosing) return;
      choosing = false;
      app.save.branch = value;
      app.persist();
      AUDIO.pickup();
      choices.innerHTML = '';
      hint.style.display = '';
      i++; skipHidden();
      if (i >= lines.length) return finish();
      show();
    };
    const show = () => {
      const line = lines[i];
      const sp = SPEAKERS[line.who];
      who.textContent = line.name || sp.name; who.style.color = line.name === '???' ? '#9aa0a8' : sp.color;
      // звук в сцене: выстрел в рации, помехи
      if (line.sfx === 'gunshot') { AUDIO.gunshot(true); setTimeout(() => AUDIO.noiseBurst({ dur: 1.2, vol: 0.12, type: 'highpass', freq: 1800 }), 250); }
      if (line.sfx === 'static') AUDIO.noiseBurst({ dur: 1.4, vol: 0.14, type: 'highpass', freq: 1500 });
      portrait.style.display = line.who === 'narrator' ? 'none' : 'block';
      if (line.who !== 'narrator') stage.say(line);
      text.className = 'text' + (line.who === 'narrator' ? ' narr' : '');
      dialog.style.animation = 'none'; void dialog.offsetWidth; dialog.style.animation = '';
      text.textContent = '';
      full = false;
      let k = 0;
      clearInterval(typing);
      typing = setInterval(() => {
        k += 2;
        text.textContent = line.text.slice(0, k);
        if (k % 6 === 0 && line.who !== 'narrator') AUDIO.tone({ freq: line.who === 'mira' ? 520 : line.who === 'semyon' ? 260 : line.who === 'raven' ? 190 : 380, dur: 0.03, vol: 0.02, type: 'square' });
        if (k >= line.text.length) { clearInterval(typing); full = true; if (line.choice) offerChoice(line); }
      }, 22);
    };
    const next = () => {
      if (choosing) return;
      if (!full) {
        clearInterval(typing); text.textContent = lines[i].text; full = true;
        if (lines[i].choice) offerChoice(lines[i]);
        return;
      }
      i++; skipHidden();
      if (i >= lines.length) return finish();
      AUDIO.click();
      show();
    };
    // «Пропустить» не перепрыгивает через выбор: сначала останавливается на нём
    const skip = () => {
      if (choosing) return;
      const ci = lines.findIndex((l, k) => k >= i && l.choice);
      if (ci < 0) return finish();
      i = ci; show();
    };
    n.addEventListener('click', e => {
      if (e.target.closest('.skip')) { AUDIO.click(); skip(); return; }
      if (e.target.closest('.choices')) return;
      next();
    });
    this.onKey(e => {
      if (choosing && (e.key === '1' || e.key === '2')) { e.preventDefault(); pick(lines[i].choice[+e.key - 1].value); return; }
      if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
      if (e.key === 'Escape') skip();
    });
    skipHidden();
    if (i >= lines.length) return finish();
    show(); drawP();
  }

  /* ------------------------------ гараж ------------------------------ */
  showGarage(li) {
    const app = this.app, s = app.save, lv = LEVELS[li];
    const swap = app.checkVehicleSwap(li);
    const vid = app.currentVehicleFor(li);
    const def = VEHICLE_BY_ID[vid];
    const fromDef = swap && swap.from ? VEHICLE_BY_ID[swap.from] : null;
    const n = this.mount(el(`<div class="screen garage">
      <div class="topbar"><button class="btn dark small" data-a="map">← Карта</button>
        <h2 class="title-font">Гараж · ${lv.name}</h2><div class="money"><small>БАНК</small><span class="mval"></span></div></div>
      <div class="body">
        <div class="showroom">
          <div class="stage"><canvas></canvas></div>
          <div class="vsel"><div class="vname"></div></div>
          <div class="vdesc"></div>
          <div class="stats panel"></div>
        </div>
        <div class="upgrades panel"></div>
      </div>
      <div class="bottom"><button class="btn dark" data-a="story">Брифинг</button><div class="lock-note"></div><button class="btn big green" data-a="go">В путь ▶</button></div>
    </div>`), 'garage');
    const cv = n.querySelector('canvas'), ctx = cv.getContext('2d');
    const upBox = n.querySelector('.upgrades');
    const go = n.querySelector('[data-a="go"]');
    const note = n.querySelector('.lock-note');
    // анимация смены транспорта
    const anim = { active: !!swap, t0: performance.now(), done: !swap };
    const SWAP_LEN = fromDef ? 4.2 : 3.0;
    const finishAnim = () => {
      if (anim.done) return;
      anim.done = true; anim.active = false;
      AUDIO.buy();
      this._flash = 1;
      render();
    };
    const render = () => {
      const up = s.owned[vid].up;
      n.querySelector('.mval').textContent = fmtMoney(s.money);
      n.querySelector('.vname').textContent = def.name;
      n.querySelector('.vdesc').textContent = def.desc;
      const st = vehicleStats(def, up);
      const bars = [
        ['Скорость', st.topSpeed / 45],
        ['Мощность', def.type === 'boat' ? st.thrust / 16 : st.torque / def.mass / 3.2],
        ['Топливо', st.fuel / 60],
        ['Броня', 1 - st.killSpeed / 12],
        ['Ускоритель', st.boost / 8],
        ['Оружие', st.gun / 4]
      ];
      n.querySelector('.stats').innerHTML = bars.map(([k, v]) => `<div class="stat">${k}<div class="sb"><i style="width:${clamp(v, 0.03, 1) * 100}%"></i></div></div>`).join('');
      go.disabled = !anim.done;
      note.textContent = anim.done ? '' : 'Новый транспорт…';
      if (!anim.done) {
        upBox.innerHTML = `<div style="margin:auto;text-align:center;padding:30px;opacity:.85">
          <h2 class="title-font" style="font-size:30px;margin-bottom:10px">${fromDef ? 'Смена транспорта' : 'Новый транспорт'}</h2>
          <p style="color:#aaa">${fromDef ? `«${fromDef.name}» остаётся позади. Дальше — «${def.name}».` : `Теперь у вас есть «${def.name}».`}</p>
          <p style="color:#777;margin-top:16px;font-size:13px">нажмите на сцену, чтобы пропустить</p></div>`;
        return;
      }
      const names = UPGRADE_NAMES[def.type];
      upBox.innerHTML = UPGRADE_KEYS.map(k => {
        const lvl = up[k] || 0, max = UPGRADE_MAX[k];
        const cost = lvl < max ? upgradeCost(def, k, lvl) : 0;
        return `<div class="upg"><div><div class="un">${names[k]}</div><div class="ud">${UPGRADE_DESC[k]}</div>
          <div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          ${lvl < max ? `<button class="btn" data-up="${k}" ${s.money < cost ? 'disabled' : ''}>${fmtMoney(cost)}</button>` : '<button class="btn dark" disabled>МАКС</button>'}</div>`;
      }).join('');
    };
    n.addEventListener('click', e => {
      if (e.target.closest('.stage') && !anim.done) { finishAnim(); return; }
      const a = e.target.closest('[data-a], [data-up]'); if (!a) return;
      if (a.disabled) { AUDIO.denied(); return; }
      if (a.dataset.up) {
        if (app.buyUpgrade(vid, a.dataset.up)) { AUDIO.buy(); this._flash = 1; } else AUDIO.denied();
        return render();
      }
      AUDIO.click();
      const act = a.dataset.a;
      if (act === 'map') this.showMap();
      if (act === 'story') this.showStory(storyLines(lv, 'intro', this.app.save), () => this.showGarage(li));
      if (act === 'go') app.startRun(li, vid);
    });
    this.onKey(e => {
      if (e.key === 'Escape') this.showMap();
      if (e.key === 'Enter') { if (anim.done) app.startRun(li, vid); else finishAnim(); }
    });
    render();
    this._flash = 0;
    const t0 = performance.now();
    let lastSound = -1;
    const loop = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(rect.width * dpr) || cv.height !== Math.round(rect.height * dpr)) { cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr); }
      const t = (performance.now() - t0) / 1000;
      const st = anim.done ? -1 : (performance.now() - anim.t0) / 1000;
      if (!anim.done) {
        // звуки анимации: уезжает старый, въезжает новый
        const phase = st < 1.2 ? 0 : st < (fromDef ? 2.0 : 0.3) ? 1 : st < SWAP_LEN - 0.9 ? 2 : 3;
        if (phase !== lastSound) {
          lastSound = phase;
          if (phase === 0 && fromDef) AUDIO.noiseBurst({ dur: 1.0, vol: 0.25, freq: 500, freqEnd: 120, brown: true });
          if (phase === 2) AUDIO.noiseBurst({ dur: 1.2, vol: 0.25, freq: 150, freqEnd: 600, brown: true });
          if (phase === 3) AUDIO.impact(0.4);
        }
        if (st >= SWAP_LEN) finishAnim();
      }
      drawShowroom(ctx, cv.width, cv.height, { def, up: s.owned[vid].up, t, swapT: st, fromDef, fromUp: fromDef && s.owned[fromDef.id] ? s.owned[fromDef.id].up : {}, flash: this._flash, swapLen: SWAP_LEN });
      this._flash = Math.max(0, this._flash - 0.03);
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  /* ------------------------------ результаты ------------------------------ */
  showResults(sum, info) {
    const lv = LEVELS[sum.level];
    const rows = [
      ['Дистанция: ' + sum.distance + ' м', sum.distMoney],
      ['Зомби: ' + sum.kills, sum.killMoney],
      ['Трюки' + (sum.flips ? ` (сальто: ${sum.flips})` : ''), sum.stuntMoney],
      ['Находки', sum.pickupMoney]
    ];
    if (sum.bonus) rows.push(['Бонус за финиш', sum.bonus]);
    const reasonText = { fuel: 'Топливо кончилось', stuck: 'Застряли', flip: 'Машина перевернулась', crash: 'Гонщик вылетел из седла', fall: 'Сорвались в пропасть', sink: 'Транспорт затонул', avalanche: 'Накрыло лавиной' };
    const n = this.mount(el(`<div class="screen results"><div class="rbox panel">
      <h2 class="${sum.complete ? 'win' : ''}">${sum.complete ? 'Уровень пройден!' : 'Заезд окончен'}</h2>
      <div class="rsub">${lv.name} · ${sum.complete ? 'добрались до цели' : (reasonText[sum.reason] || '')}</div>
      ${rows.map((r, i) => `<div class="rrow" style="animation-delay:${0.15 + i * 0.18}s"><span>${r[0]}</span><b>+${fmtMoney(r[1])}</b></div>`).join('')}
      <div class="rtotal"><span>Итого</span><b class="tot">$0</b></div>
      ${info.newBest && !sum.complete ? `<div class="newbest">Новый рекорд: ${sum.distance} м!</div>` : ''}
      <div class="rbtns">
        ${sum.complete ? '<button class="btn big green" data-a="next">Дальше ▶</button>' : '<button class="btn big" data-a="garage">Гараж</button>'}
        ${sum.complete ? '<button class="btn dark" data-a="garage">Гараж</button>' : '<button class="btn dark" data-a="again">Ещё заезд ↻</button>'}
      </div></div></div>`), 'results');
    const tot = n.querySelector('.tot');
    const start = performance.now(), delay = 0.15 + rows.length * 0.18;
    const count = () => {
      const k = clamp(((performance.now() - start) / 1000 - delay) / 0.8, 0, 1);
      tot.textContent = fmtMoney(sum.total * (1 - Math.pow(1 - k, 3)));
      if (k < 1) { this._raf = requestAnimationFrame(count); if (Math.random() < 0.3) AUDIO.cash(); }
    };
    count();
    n.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      AUDIO.click();
      if (a.dataset.a === 'garage') this.app.toGarage(sum.level);
      if (a.dataset.a === 'again') this.app.startRun(sum.level, sum.vehicle);
      if (a.dataset.a === 'next') this.app.afterComplete(sum.level);
    });
    this.onKey(e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sum.complete ? this.app.afterComplete(sum.level) : this.app.startRun(sum.level, sum.vehicle); }
      if (e.key === 'Escape') this.app.toGarage(sum.level);
    });
  }

  /* ------------------------------ пауза ------------------------------ */
  showHudButtons() {
    const n = this.mount(el(`<div class="screen" style="pointer-events:none"><button class="btn dark small pausebtn">❚❚ Пауза</button></div>`), 'hud');
    n.querySelector('.pausebtn').addEventListener('click', () => this.app.pause());
  }
  showPause() {
    const n = this.mount(el(`<div class="screen overlay"><div class="obox panel">
      <h2>Пауза</h2>
      <button class="btn big green" data-a="resume">Продолжить</button>
      <button class="btn dark" data-a="end">Закончить заезд (забрать деньги)</button>
      <button class="btn dark" data-a="settings">Настройки</button>
      <div class="keys"><kbd>↑</kbd>/<kbd>W</kbd> газ · <kbd>↓</kbd>/<kbd>S</kbd> тормоз/задний ход · <kbd>←</kbd><kbd>→</kbd>/<kbd>A</kbd><kbd>D</kbd> наклон назад/вперёд · <kbd>Пробел</kbd>/<kbd>Shift</kbd> ускоритель · <kbd>R</kbd> закончить заезд</div>
    </div></div>`), 'pause');
    n.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      AUDIO.click();
      if (a.dataset.a === 'resume') this.app.resume();
      if (a.dataset.a === 'end') this.app.forceEnd();
      if (a.dataset.a === 'settings') this.showSettings(() => this.showPause());
    });
    this.onKey(e => { if (e.key === 'Escape') { e.preventDefault(); this.app.resume(); } });
  }

  showSettings(back) {
    const st = this.app.settings;
    const n = this.mount(el(`<div class="screen overlay"><div class="obox panel">
      <h2>Настройки</h2>
      <div class="setrow"><span>Громкость</span><input type="range" min="0" max="100" data-s="volume" value="${st.volume * 100}"></div>
      <div class="setrow"><span>Музыка</span><input type="range" min="0" max="100" data-s="music" value="${st.music * 100}"></div>
      <div class="setrow"><span>Качество графики</span><select data-s="quality"><option value="1" ${st.quality >= 1 ? 'selected' : ''}>Высокое</option><option value="0.5" ${st.quality < 1 ? 'selected' : ''}>Производительность</option></select></div>
      <div class="setrow"><span>Показывать FPS</span><input type="checkbox" data-s="fps" ${st.fps ? 'checked' : ''}></div>
      <div class="setrow"><span>Сенсорные кнопки</span><select data-s="touch"><option value="auto" ${st.touch === 'auto' ? 'selected' : ''}>Авто</option><option value="on" ${st.touch === 'on' ? 'selected' : ''}>Вкл</option><option value="off" ${st.touch === 'off' ? 'selected' : ''}>Выкл</option></select></div>
      <button class="btn" data-a="back">Готово</button>
    </div></div>`), 'settings');
    n.addEventListener('input', e => {
      const k = e.target.dataset.s; if (!k) return;
      if (k === 'volume') { st.volume = e.target.value / 100; AUDIO.setVolume(st.volume); }
      if (k === 'music') { st.music = e.target.value / 100; AUDIO.setMusicVolume(st.music); }
      if (k === 'quality') { st.quality = +e.target.value; this.app.applyQuality(); }
      if (k === 'fps') st.fps = e.target.checked;
      if (k === 'touch') { st.touch = e.target.value; this.app.updateTouch(); }
      this.app.persist();
    });
    n.addEventListener('click', e => { if (e.target.closest('[data-a="back"]')) { AUDIO.click(); back(); } });
    this.onKey(e => { if (e.key === 'Escape') back(); });
  }
}

/* ------------------------------ шоурум гаража ------------------------------ */
// o: { def, up, t, swapT (-1 если без анимации), fromDef, fromUp, flash, swapLen }
function drawShowroom(ctx, W, H, o) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const floorY = H * 0.78;
  const def = o.def;
  const boatScene = def.type === 'boat';
  // пол и прожектор
  const sg = ctx.createRadialGradient(W / 2, floorY, 10, W / 2, floorY, W * 0.5);
  sg.addColorStop(0, 'rgba(255,220,160,0.22)'); sg.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,240,200,0.06)';
  ctx.beginPath(); ctx.moveTo(W * 0.42, 0); ctx.lineTo(W * 0.58, 0); ctx.lineTo(W * 0.85, floorY); ctx.lineTo(W * 0.15, floorY); ctx.fill();
  if (boatScene) {
    const wg = ctx.createLinearGradient(0, floorY - 10, 0, H);
    wg.addColorStop(0, 'rgba(40,110,140,0.8)'); wg.addColorStop(1, 'rgba(8,30,50,0.9)');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, floorY + Math.sin(x * 0.02 + o.t * 2) * 4);
    ctx.lineTo(W, H); ctx.fill();
  } else {
    ctx.fillStyle = '#1b1d20'; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.strokeStyle = 'rgba(240,200,60,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([30, 20]);
    const dash = o.swapT >= 0 ? (o.swapT * 400) % 50 : 0;
    ctx.lineDashOffset = dash;
    ctx.beginPath(); ctx.moveTo(0, floorY + 30); ctx.lineTo(W, floorY + 30); ctx.stroke(); ctx.setLineDash([]);
  }

  const fit = (d) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const h of d.hull) for (const p of h) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    if (d.wheels) for (const w of d.wheels) minY = Math.min(minY, w.y - w.r);
    maxY += d.type === 'bike' ? 1.3 : 0.6;
    const scale = Math.min(W * 0.72 / (maxX - minX + 1.2), H * 0.62 / (maxY - minY + 0.5));
    return { minX, maxX, minY, scale };
  };
  // xOff в долях ширины, drive — скорость вращения колёс, yBounce в пикселях
  const drawOne = (d, up, xOff, wheelAng, yBounce, tilt) => {
    const f = fit(d);
    const cx = W / 2 - (f.minX + f.maxX) / 2 * f.scale + xOff * W;
    const bottom = d.type === 'boat' ? floorY + 0.25 * f.scale + Math.sin(o.t * 2) * 3 : floorY;
    // тень
    if (d.type !== 'boat') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(W / 2 + xOff * W, floorY + 4, (f.maxX - f.minX) * f.scale * 0.45, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, bottom + (d.type === 'boat' ? 0 : f.minY * f.scale) - yBounce);
    ctx.scale(f.scale, -f.scale);
    ctx.rotate(tilt + (d.type === 'boat' ? Math.sin(o.t * 1.6) * 0.03 : 0));
    drawVehiclePreview(ctx, d, up, o.t, wheelAng);
    ctx.restore();
    return f;
  };
  const puff = (x, y, a) => {
    ctx.fillStyle = `rgba(150,140,120,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 18 + (1 - a) * 30, 0, Math.PI * 2); ctx.fill();
  };

  const T = o.swapT;
  if (T < 0) {
    drawOne(def, o.up, 0, -o.t * 2, Math.abs(Math.sin(o.t * 3)) * 0.5, 0);
  } else {
    const hasFrom = !!o.fromDef;
    const outEnd = 1.2, inStart = hasFrom ? 1.5 : 0.2, inEnd = inStart + 1.4;
    // старый уезжает влево с пробуксовкой
    if (hasFrom && T < outEnd) {
      const k = T / outEnd;
      const x = -Math.pow(k, 2.2) * 1.2;
      drawOne(o.fromDef, o.fromUp, x, -T * 40 * k, 0, k < 0.15 ? k * 0.4 : 0.06 * (1 - k));
      for (let i = 0; i < 5; i++) puff(W / 2 + x * W + W * 0.18 + i * 22, floorY - 6 - i * 4, Math.max(0, 0.35 - k * 0.3 - i * 0.05));
    }
    // новый въезжает справа, тормозит и покачивается на подвеске
    if (T >= inStart) {
      const k = clamp((T - inStart) / (inEnd - inStart), 0, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      const x = (1 - ease) * 1.2;
      const settle = Math.max(0, T - inEnd);
      const bounce = settle > 0 ? Math.sin(settle * 14) * Math.exp(-settle * 4) * 8 : 0;
      const tilt = k < 1 ? -(1 - k) * 0.05 : Math.sin(settle * 12) * Math.exp(-settle * 5) * 0.03;
      drawOne(def, o.up, x, (1 - ease) * 30, bounce, tilt);
      if (k > 0.7 && k < 1) for (let i = 0; i < 4; i++) puff(W / 2 + x * W - W * 0.2 - i * 20, floorY - 6, 0.25 * (1 - k) * 3);
      // баннер
      if (T > inEnd) {
        const bk = clamp((T - inEnd) / 0.35, 0, 1);
        const sc = 0.6 + 0.4 * (1 - Math.pow(1 - bk, 3)) + Math.sin(bk * Math.PI) * 0.08;
        ctx.save();
        ctx.translate(W / 2, H * 0.14);
        ctx.scale(sc, sc);
        ctx.globalAlpha = bk;
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(H * 0.06)}px Oswald, Impact, sans-serif`;
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText('НОВЫЙ ТРАНСПОРТ', 0, 0);
        ctx.fillStyle = '#ffcf3a'; ctx.fillText('НОВЫЙ ТРАНСПОРТ', 0, 0);
        ctx.font = `700 ${Math.round(H * 0.045)}px Oswald, Impact, sans-serif`;
        ctx.strokeText(`«${def.name}»`, 0, H * 0.065);
        ctx.fillStyle = '#fff'; ctx.fillText(`«${def.name}»`, 0, H * 0.065);
        ctx.restore();
      }
    }
    // вспышка при остановке
    if (T > inEnd && T < inEnd + 0.25) {
      ctx.fillStyle = `rgba(255,230,160,${0.35 * (1 - (T - inEnd) / 0.25)})`; ctx.fillRect(0, 0, W, H);
    }
  }
  if (boatScene) { ctx.fillStyle = 'rgba(40,110,140,0.35)'; ctx.fillRect(0, floorY + 6, W, H); }
  if (o.flash > 0) { ctx.fillStyle = `rgba(255,220,120,${o.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
}
