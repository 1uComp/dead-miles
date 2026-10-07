'use strict';
/* Процедурный звук: двигатель, удары, выстрелы, взрывы, всплески, музыка-эмбиент */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.musicVolume = 0.5;
    this.engines = [];
    this._lastPlay = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVolume * 0.35; this.music.connect(this.master);
    // буфер шума
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // коричневый шум
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const e = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = last * 3.5; }
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.music) this.music.gain.value = v * 0.35; }

  _throttle(name, ms) {
    const now = performance.now();
    if (this._lastPlay[name] && now - this._lastPlay[name] < ms) return false;
    this._lastPlay[name] = now; return true;
  }

  noiseBurst({ dur = 0.2, vol = 0.5, type = 'lowpass', freq = 1000, q = 1, freqEnd = null, brown = false, delay = 0, pan = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    src.connect(f); f.connect(g); node.connect(this.sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  tone({ freq = 200, freqEnd = null, dur = 0.2, vol = 0.3, type = 'sine', delay = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- эффекты ----
  impact(strength, pan = 0) {
    if (!this.ctx || !this._throttle('impact', 45)) return;
    const s = clamp(strength, 0, 1);
    this.noiseBurst({ dur: 0.12 + s * 0.25, vol: 0.15 + s * 0.5, freq: 300 + s * 900, freqEnd: 80, brown: true, pan });
    this.tone({ freq: 90 + Math.random() * 30, freqEnd: 40, dur: 0.15 + s * 0.2, vol: 0.2 + s * 0.4, type: 'sine' });
    if (s > 0.5) this.noiseBurst({ dur: 0.18, vol: 0.12 * s, type: 'bandpass', freq: 2500, q: 3, freqEnd: 1200, pan });
  }
  metal(strength, pan = 0) {
    if (!this.ctx || !this._throttle('metal', 70)) return;
    const s = clamp(strength, 0, 1);
    const base = 300 + Math.random() * 400;
    this.tone({ freq: base, freqEnd: base * 0.8, dur: 0.3, vol: 0.08 * s, type: 'triangle' });
    this.tone({ freq: base * 2.76, freqEnd: base * 2.5, dur: 0.25, vol: 0.05 * s, type: 'sine' });
    this.noiseBurst({ dur: 0.1, vol: 0.2 * s, type: 'highpass', freq: 1500, pan });
  }
  splat(strength = 0.6, pan = 0) {
    if (!this.ctx || !this._throttle('splat', 30)) return;
    this.noiseBurst({ dur: 0.18, vol: 0.35 * strength, freq: 900, freqEnd: 150, q: 2, pan });
    this.tone({ freq: 120, freqEnd: 50, dur: 0.14, vol: 0.35 * strength, type: 'sine' });
  }
  crateBreak(pan = 0) {
    if (!this.ctx || !this._throttle('crate', 60)) return;
    this.noiseBurst({ dur: 0.25, vol: 0.4, type: 'bandpass', freq: 900, q: 1.5, freqEnd: 300, pan });
    for (let i = 0; i < 3; i++) this.noiseBurst({ dur: 0.05, vol: 0.25, type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 4, delay: 0.03 + i * 0.04, pan });
  }
  gunshot(big = false) {
    if (!this.ctx || !this._throttle('gun', 40)) return;
    this.noiseBurst({ dur: big ? 0.35 : 0.14, vol: big ? 0.5 : 0.3, type: 'lowpass', freq: big ? 2500 : 5000, freqEnd: 300 });
    this.tone({ freq: big ? 110 : 180, freqEnd: 45, dur: big ? 0.25 : 0.08, vol: big ? 0.4 : 0.2, type: 'square' });
  }
  // автомат анархиста: хлёсткий щелчок + низкий хлопок, громкость по расстоянию
  rifle(pan = 0, vol = 1) {
    if (!this.ctx || !this._throttle('rifle', 28)) return;
    this.noiseBurst({ dur: 0.07, vol: 0.22 * vol, type: 'highpass', freq: 2200, pan });
    this.noiseBurst({ dur: 0.16, vol: 0.18 * vol, type: 'lowpass', freq: 1200, freqEnd: 180, brown: true, pan });
  }
  // пуля по металлу
  ricochet(pan = 0) {
    if (!this.ctx || !this._throttle('ricochet', 60)) return;
    this.tone({ freq: 2600 + Math.random() * 900, freqEnd: 900, dur: 0.18, vol: 0.08, type: 'sine' });
    this.noiseBurst({ dur: 0.05, vol: 0.2, type: 'bandpass', freq: 3500, q: 3, pan });
  }
  // свист пролетевшей рядом пули
  whiz(pan = 0) {
    if (!this.ctx || !this._throttle('whiz', 90)) return;
    this.noiseBurst({ dur: 0.12, vol: 0.09, type: 'bandpass', freq: 5200, q: 6, freqEnd: 2400, pan });
  }
  explosion(strength = 1, pan = 0) {
    if (!this.ctx) return;
    this.noiseBurst({ dur: 1.4 * strength, vol: 0.9, freq: 1400, freqEnd: 60, brown: true, pan });
    this.noiseBurst({ dur: 0.3, vol: 0.5, type: 'lowpass', freq: 5000, freqEnd: 400, pan });
    this.tone({ freq: 70, freqEnd: 25, dur: 1.0, vol: 0.7, type: 'sine' });
  }
  splash(strength = 0.5, pan = 0) {
    if (!this.ctx || !this._throttle('splash', 80)) return;
    const s = clamp(strength, 0.1, 1);
    this.noiseBurst({ dur: 0.3 + s * 0.6, vol: 0.2 + s * 0.4, type: 'bandpass', freq: 1400, q: 0.7, freqEnd: 400, pan });
    this.noiseBurst({ dur: 0.2, vol: 0.15 * s, type: 'highpass', freq: 3000, delay: 0.05, pan });
  }
  pickup() {
    if (!this.ctx) return;
    this.tone({ freq: 660, freqEnd: 990, dur: 0.12, vol: 0.2, type: 'triangle' });
    this.tone({ freq: 990, freqEnd: 1320, dur: 0.18, vol: 0.18, type: 'triangle', delay: 0.08 });
  }
  cash() {
    if (!this.ctx || !this._throttle('cash', 50)) return;
    this.tone({ freq: 1400, dur: 0.06, vol: 0.08, type: 'square' });
    this.tone({ freq: 2100, dur: 0.12, vol: 0.06, type: 'square', delay: 0.05 });
  }
  click() {
    if (!this.ctx) return;
    this.tone({ freq: 520, freqEnd: 380, dur: 0.06, vol: 0.12, type: 'triangle' });
  }
  buy() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.15, vol: 0.14, type: 'triangle', delay: i * 0.06 }));
    this.noiseBurst({ dur: 0.15, vol: 0.2, type: 'highpass', freq: 4000, delay: 0.1 });
  }
  denied() {
    if (!this.ctx) return;
    this.tone({ freq: 200, freqEnd: 140, dur: 0.25, vol: 0.2, type: 'sawtooth' });
  }
  shift() {
    if (!this.ctx) return;
    this.noiseBurst({ dur: 0.08, vol: 0.08, type: 'bandpass', freq: 600, q: 3 });
  }
  groan(pan = 0) {
    if (!this.ctx || !this._throttle('groan', 1400)) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const base = 90 + Math.random() * 50;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 0.75, t + 0.9);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 4;
    const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 8;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); node = p; }
    o.connect(f); f.connect(g); node.connect(this.sfx);
    o.start(t); lfo.start(t); o.stop(t + 1.1); lfo.stop(t + 1.1);
  }
  thunder() {
    if (!this.ctx) return;
    this.noiseBurst({ dur: 3.0, vol: 0.6, freq: 400, freqEnd: 40, brown: true, delay: 0.2 + Math.random() * 0.6 });
  }
  // ---- шум дождя: шелест капель + низкий гул ливня ----
  startRain() {
    if (!this.ctx || this.rainNode) return;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const g = c.createGain(); g.gain.value = 0;
    const src2 = c.createBufferSource(); src2.buffer = this.brown; src2.loop = true;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 380;
    const g2 = c.createGain(); g2.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.sfx);
    src2.connect(lp2); lp2.connect(g2); g2.connect(this.sfx);
    src.start(0, Math.random()); src2.start(0, Math.random());
    this.rainNode = { src, src2, g, g2, lp, patter: 0 };
  }
  setRain(intensity, storm, wind) {
    const n = this.rainNode; if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    n.g.gain.setTargetAtTime((storm ? 0.1 : 0.06) + intensity * (storm ? 0.1 : 0.06), t, 0.4);
    n.g2.gain.setTargetAtTime(storm ? 0.08 + Math.abs(wind || 0) * 0.012 : 0.02, t, 0.6);
    n.lp.frequency.setTargetAtTime(4500 + intensity * 3000, t, 0.5);
    // редкие отдельные тяжёлые капли по кузову
    n.patter -= 1;
    if (n.patter <= 0) {
      n.patter = 3 + Math.floor(Math.random() * 8);
      this.noiseBurst({ dur: 0.03, vol: 0.02 + Math.random() * 0.03, type: 'bandpass', freq: 2500 + Math.random() * 3000, q: 4, pan: Math.random() * 2 - 1 });
    }
  }
  // визг шин: полосовой шум с «пилой» по высоте, громкость от скорости проскальзывания
  setSkid(k) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.skidNode) {
      if (k < 0.02) return;
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 9;
      const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 3100; bp2.Q.value = 12;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(bp); src.connect(bp2); bp.connect(g); bp2.connect(g); g.connect(this.sfx);
      src.start(0, Math.random());
      this.skidNode = { src, bp, bp2, g };
    }
    const n = this.skidNode;
    n.g.gain.setTargetAtTime(Math.min(1, k) * 0.55, t, 0.05);
    n.bp.frequency.setTargetAtTime(1600 + k * 700 + Math.sin(t * 23) * 120, t, 0.03);
    n.bp2.frequency.setTargetAtTime(2800 + k * 900, t, 0.03);
  }
  stopSkid() {
    const n = this.skidNode; if (!n || !this.ctx) return;
    n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => { try { n.src.stop(); } catch (e) { } }, 400);
    this.skidNode = null;
  }
  stopRain() {
    const n = this.rainNode; if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    n.g.gain.setTargetAtTime(0, t, 0.3); n.g2.gain.setTargetAtTime(0, t, 0.3);
    setTimeout(() => { try { n.src.stop(); n.src2.stop(); } catch (e) { } }, 1500);
    this.rainNode = null;
  }

  levelComplete() {
    if (!this.ctx) return;
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.4, vol: 0.16, type: 'triangle', delay: i * 0.11 }));
  }

  // ---- двигатель ----
  createEngine(kind) {
    if (!this.ctx) return null;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.sfx);
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800; filter.Q.value = 2;
    filter.connect(out);
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const o3 = c.createOscillator(); o3.type = 'sine';
    const g1 = c.createGain(); g1.gain.value = kind === 'bike' ? 0.35 : 0.5;
    const g2 = c.createGain(); g2.gain.value = kind === 'bike' ? 0.3 : 0.18;
    const g3 = c.createGain(); g3.gain.value = 0.5;
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(filter); g2.connect(filter); g3.connect(filter);
    // тарахтение (амплитудная модуляция)
    const am = c.createOscillator(); am.type = 'square';
    const amg = c.createGain(); amg.gain.value = 0.25;
    const amBias = c.createGain(); amBias.gain.value = 1;
    am.connect(amg); amg.connect(amBias.gain);
    filter.disconnect(); filter.connect(amBias); amBias.connect(out);
    const nsrc = c.createBufferSource(); nsrc.buffer = this.noise; nsrc.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = kind === 'boat' ? 500 : 1200; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0;
    nsrc.connect(nf); nf.connect(ng); ng.connect(out);
    [o1, o2, o3, am, nsrc].forEach(o => o.start());
    const eng = { kind, out, filter, o1, o2, o3, am, ng, nf, nodes: [o1, o2, o3, am, nsrc] };
    this.engines.push(eng);
    return eng;
  }
  updateEngine(eng, rpm01, load, extra = {}) {
    if (!eng || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const kind = eng.kind;
    const base = kind === 'bike' ? 38 : kind === 'boat' ? 26 : 30;
    const range = kind === 'bike' ? 150 : kind === 'boat' ? 80 : 150;
    const f = base + rpm01 * range;
    eng.o1.frequency.setTargetAtTime(f, t, 0.03);
    eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    eng.o3.frequency.setTargetAtTime(f * 0.25, t, 0.03);
    eng.am.frequency.setTargetAtTime(f * (kind === 'bike' ? 0.5 : 0.25), t, 0.03);
    eng.filter.frequency.setTargetAtTime(300 + rpm01 * 1400 + load * 900, t, 0.05);
    const vol = (0.07 + load * 0.1 + rpm01 * 0.06) * (extra.muffle ? 0.5 : 1);
    eng.out.gain.setTargetAtTime(extra.off ? 0 : vol, t, 0.08);
    eng.ng.gain.setTargetAtTime((extra.water || 0) * 0.25 + (extra.boost ? 0.35 : 0) + load * 0.03, t, 0.1);
    eng.nf.frequency.setTargetAtTime(extra.boost ? 900 : (kind === 'boat' ? 400 + rpm01 * 600 : 1200), t, 0.1);
  }
  stopEngine(eng) {
    if (!eng || !this.ctx) return;
    const t = this.ctx.currentTime;
    eng.out.gain.setTargetAtTime(0, t, 0.1);
    setTimeout(() => { eng.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); try { eng.out.disconnect(); } catch (e) { } }, 600);
    this.engines = this.engines.filter(e => e !== eng);
  }
  stopAllEngines() { [...this.engines].forEach(e => this.stopEngine(e)); this.stopSkid(); }

  // ---- эмбиент-музыка (минорные аккорды, мягкий пад + пульс) ----
  startMusic(mood = 'menu') {
    if (!this.ctx) return;
    this.stopMusic();
    const c = this.ctx;
    const chords = mood === 'tense'
      ? [[110, 130.8, 164.8], [98, 116.5, 146.8], [87.3, 110, 130.8], [98, 123.5, 146.8]]
      : [[110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8]];
    const bus = c.createGain(); bus.gain.value = 0; bus.connect(this.music);
    bus.gain.setTargetAtTime(1, c.currentTime, 2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(bus);
    const delay = c.createDelay(1.0); delay.delayTime.value = 0.45;
    const fb = c.createGain(); fb.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(lp);
    const state = { bus, timer: null, step: 0, oscs: [] };
    const playChord = () => {
      const t = c.currentTime;
      const ch = chords[state.step % chords.length];
      ch.forEach((f, i) => {
        [1, 2].forEach(mult => {
          const o = c.createOscillator(); o.type = mult === 1 ? 'triangle' : 'sine';
          o.frequency.value = f * mult * (1 + (Math.random() - 0.5) * 0.004);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05 / mult, t + 1.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
          o.connect(g); g.connect(lp); g.connect(delay);
          o.start(t); o.stop(t + 4.3);
        });
      });
      // пульсирующий бас
      for (let k = 0; k < 8; k++) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.value = ch[0] / 2;
        const g = c.createGain();
        const tt = t + k * 0.5;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(mood === 'tense' ? 0.12 : 0.06, tt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
        o.connect(g); g.connect(bus);
        o.start(tt); o.stop(tt + 0.45);
      }
      // колокольчик
      if (Math.random() < 0.6) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.value = ch[Math.floor(Math.random() * 3)] * 4;
        const g = c.createGain(); const tt = t + Math.random() * 3;
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.025, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2);
        o.connect(g); g.connect(delay); o.start(tt); o.stop(tt + 2.1);
      }
      state.step++;
    };
    playChord();
    state.timer = setInterval(playChord, 4000);
    this.musicState = state;
  }
  stopMusic() {
    if (!this.musicState || !this.ctx) return;
    const s = this.musicState;
    clearInterval(s.timer);
    s.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    setTimeout(() => { try { s.bus.disconnect(); } catch (e) { } }, 3000);
    this.musicState = null;
  }
}

const AUDIO = new AudioEngine();
