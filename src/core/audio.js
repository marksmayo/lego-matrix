/**
 * Everything you hear is synthesised in the browser — no asset loading, and
 * nothing that needs licensing. Which is the right call anyway: the sounds
 * this sequence needs are a ringing phone, a modem, gunfire, plastic hitting
 * a floor, and a low pulse underneath it all. All of that is oscillators.
 */

export class Audio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.ctx = null;
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // Shared noise source material.
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.ready = true;
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  get t() { return this.ctx.currentTime; }

  /* -------------------------------------------------------------- */
  /* primitives                                                     */
  /* -------------------------------------------------------------- */

  env(dest, { a = 0.005, d = 0.2, s = 0, r = 0.1, peak = 1, at = 0 } = {}) {
    const g = this.ctx.createGain();
    const t = this.t + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (s > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.55), t + a + d);
      g.gain.setValueAtTime(peak * 0.55, t + a + d + s);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + s + r);
    g.connect(dest || this.master);
    return { g, end: t + a + d + s + r };
  }

  tone(freq, opts = {}) {
    if (!this.ready || this.muted) return;
    const { type = 'sine', detune = 0, dest = null } = opts;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const { g, end } = this.env(dest, opts);
    o.connect(g);
    o.start(this.t + (opts.at || 0));
    o.stop(end + 0.02);
    if (opts.glide) {
      o.frequency.exponentialRampToValueAtTime(opts.glide, end);
    }
    return o;
  }

  noise(opts = {}) {
    if (!this.ready || this.muted) return;
    const { filter = 'lowpass', freq = 1200, q = 1, dest = null } = opts;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const { g, end } = this.env(dest, opts);
    s.connect(f);
    f.connect(g);
    s.start(this.t + (opts.at || 0));
    s.stop(end + 0.02);
    if (opts.sweep) {
      f.frequency.exponentialRampToValueAtTime(opts.sweep, end);
    }
    return s;
  }

  /* -------------------------------------------------------------- */
  /* the sounds of the scene                                        */
  /* -------------------------------------------------------------- */

  /** US ring cadence: 440 + 480 Hz, two seconds on, four off. */
  startRing() {
    if (!this.ready || this.ringing) return;
    this.ringing = true;
    const cycle = () => {
      if (!this.ringing) return;
      for (const f of [440, 480]) {
        this.tone(f, { type: 'sine', a: 0.02, d: 0.1, s: 1.7, r: 0.15, peak: 0.11 });
      }
      this.ringTimer = setTimeout(cycle, 6000);
    };
    cycle();
  }

  stopRing() {
    this.ringing = false;
    clearTimeout(this.ringTimer);
  }

  /** Distant ring, as heard down a street. */
  payphoneRing() {
    if (!this.ready) return;
    for (const f of [1050, 1400]) {
      this.tone(f, { type: 'square', a: 0.01, d: 0.06, s: 0.55, r: 0.2, peak: 0.045 });
    }
  }

  /** Handset lifted / hung up. */
  click(peak = 0.14) {
    this.noise({ filter: 'bandpass', freq: 2600, q: 2, a: 0.001, d: 0.02, r: 0.02, peak });
  }

  keyClick() {
    this.noise({ filter: 'bandpass', freq: 1800 + Math.random() * 900, q: 3, a: 0.001, d: 0.012, r: 0.02, peak: 0.05 });
  }

  /** 1998 data. Two carrier squeals and a handshake. */
  modem() {
    if (!this.ready) return;
    this.tone(1270, { type: 'sine', a: 0.01, d: 0.08, r: 0.06, peak: 0.06 });
    this.tone(2225, { type: 'sine', a: 0.01, d: 0.05, r: 0.06, peak: 0.04, at: 0.12 });
    this.noise({ filter: 'bandpass', freq: 1800, q: 0.7, a: 0.02, d: 0.2, r: 0.2, peak: 0.03, at: 0.24, sweep: 900 });
  }

  /** A digit snapping into place, like a slot machine wheel stopping. */
  lockDigit(i = 0) {
    this.tone(680 + i * 42, { type: 'square', a: 0.001, d: 0.04, r: 0.04, peak: 0.07, glide: 320 + i * 30 });
    this.noise({ filter: 'highpass', freq: 3400, a: 0.001, d: 0.02, r: 0.03, peak: 0.05 });
  }

  /** The electric hum of the numbers, which grows into an ominous roar. */
  hum(level = 0.1, freq = 46) {
    if (!this.ready) return;
    if (!this.humNodes) {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const o3 = this.ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'sine';
      o2.detune.value = 11;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      f.Q.value = 3;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o1.connect(f); o2.connect(f); o3.connect(g);
      f.connect(g);
      g.connect(this.master);
      o1.start(); o2.start(); o3.start();
      this.humNodes = { o1, o2, o3, f, g };
    }
    const n = this.humNodes;
    const t = this.t;
    n.g.gain.setTargetAtTime(this.muted ? 0 : level, t, 0.18);
    n.o1.frequency.setTargetAtTime(freq, t, 0.2);
    n.o2.frequency.setTargetAtTime(freq * 1.5, t, 0.2);
    n.o3.frequency.setTargetAtTime(freq * 0.5, t, 0.2);
    n.f.frequency.setTargetAtTime(220 + level * 2600, t, 0.25);
  }

  stopHum() { if (this.humNodes) this.humNodes.g.gain.setTargetAtTime(0, this.t, 0.3); }

  /** Handgun: a crack, a body, and a tail. */
  gunshot(power = 1) {
    if (!this.ready) return;
    this.noise({ filter: 'lowpass', freq: 4200, a: 0.0008, d: 0.03, r: 0.06, peak: 0.5 * power, sweep: 380 });
    this.noise({ filter: 'highpass', freq: 2600, a: 0.0005, d: 0.012, r: 0.03, peak: 0.34 * power });
    this.tone(72, { type: 'sine', a: 0.002, d: 0.07, r: 0.1, peak: 0.34 * power, glide: 40 });
    // Corridor slap-back.
    this.noise({ filter: 'bandpass', freq: 900, q: 0.9, a: 0.02, d: 0.16, r: 0.3, peak: 0.06 * power, at: 0.055 });
  }

  /** ABS on concrete. The signature sound of this entire project. */
  clatter(n = 6, spread = 0.5, peak = 0.16) {
    if (!this.ready) return;
    for (let i = 0; i < n; i++) {
      this.noise({
        filter: 'bandpass',
        freq: 900 + Math.random() * 3400,
        q: 6 + Math.random() * 8,
        a: 0.0008, d: 0.014 + Math.random() * 0.03, r: 0.05,
        peak: peak * (0.5 + Math.random()),
        at: Math.random() * spread,
      });
      this.tone(220 + Math.random() * 500, {
        type: 'triangle', a: 0.001, d: 0.02, r: 0.03,
        peak: peak * 0.3, at: Math.random() * spread,
      });
    }
  }

  /** A door being kicked off its hinges. */
  kick() {
    this.tone(58, { type: 'sine', a: 0.002, d: 0.1, r: 0.18, peak: 0.5, glide: 34 });
    this.noise({ filter: 'lowpass', freq: 900, a: 0.002, d: 0.08, r: 0.2, peak: 0.34, sweep: 180 });
    this.clatter(9, 0.35, 0.2);
  }

  /** Breaking glass — bright, and it keeps tinkling. */
  glass() {
    if (!this.ready) return;
    this.noise({ filter: 'highpass', freq: 3000, a: 0.001, d: 0.06, r: 0.25, peak: 0.34 });
    for (let i = 0; i < 16; i++) {
      this.tone(2400 + Math.random() * 5200, {
        type: 'sine', a: 0.001, d: 0.03 + Math.random() * 0.08, r: 0.1,
        peak: 0.05 + Math.random() * 0.06, at: Math.random() * 0.9,
      });
    }
  }

  /** Heavy impact: the truck, the landing, the body hitting the stairs. */
  crash(power = 1) {
    if (!this.ready) return;
    this.tone(46, { type: 'sine', a: 0.003, d: 0.22, r: 0.5, peak: 0.6 * power, glide: 26 });
    this.noise({ filter: 'lowpass', freq: 1600, a: 0.003, d: 0.2, r: 0.55, peak: 0.42 * power, sweep: 120 });
    this.noise({ filter: 'bandpass', freq: 2200, q: 1.2, a: 0.002, d: 0.1, r: 0.3, peak: 0.2 * power });
  }

  /** Air past the camera on a jump or a whip pan. */
  whoosh(dur = 0.5, peak = 0.16) {
    this.noise({ filter: 'bandpass', freq: 400, q: 0.8, a: dur * 0.4, d: dur * 0.3, r: dur * 0.5, peak, sweep: 2600 });
  }

  /** Big diesel engine, held for as long as the truck is moving. */
  engine(level = 0.12, rpm = 42) {
    if (!this.ready) return;
    if (!this.eng) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const sub = this.ctx.createOscillator();
      sub.type = 'square';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 240;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(f); sub.connect(f); f.connect(g); g.connect(this.master);
      o.start(); sub.start();
      this.eng = { o, sub, f, g };
    }
    const e = this.eng;
    e.g.gain.setTargetAtTime(this.muted ? 0 : level, this.t, 0.12);
    e.o.frequency.setTargetAtTime(rpm, this.t, 0.15);
    e.sub.frequency.setTargetAtTime(rpm * 0.5, this.t, 0.15);
    e.f.frequency.setTargetAtTime(140 + level * 2200, this.t, 0.2);
  }

  stopEngine() { if (this.eng) this.eng.g.gain.setTargetAtTime(0, this.t, 0.25); }

  /** Tyres screaming as the truck u-turns. */
  skid(dur = 1.2) {
    this.noise({ filter: 'bandpass', freq: 1500, q: 7, a: 0.08, d: dur * 0.5, r: dur * 0.5, peak: 0.2, sweep: 2400 });
  }

  /** A low, slow pulse under the scene. Not music — a pressure. */
  pulse(peak = 0.3) {
    this.tone(41, { type: 'sine', a: 0.01, d: 0.3, r: 0.5, peak, glide: 27 });
  }

  /** Two-note ostinato with a filtered pad, started and stopped by acts. */
  bed(on, { root = 55, level = 0.055 } = {}) {
    if (!this.ready) return;
    if (on && !this.bedTimer) {
      let step = 0;
      const tick = () => {
        if (!this.bedTimer) return;
        const n = [0, 0, 3, 0, 0, 0, -2, 0][step % 8];
        const f = root * Math.pow(2, n / 12);
        this.tone(f, { type: 'triangle', a: 0.03, d: 0.4, r: 0.6, peak: level });
        this.tone(f * 2.005, { type: 'sine', a: 0.05, d: 0.4, r: 0.5, peak: level * 0.4 });
        if (step % 4 === 0) this.pulse(level * 2.2);
        step++;
        this.bedTimer = setTimeout(tick, 700);
      };
      this.bedTimer = 1;
      tick();
    } else if (!on && this.bedTimer) {
      clearTimeout(this.bedTimer);
      this.bedTimer = null;
    }
  }

  /** Panic strings substitute: a rising cluster. Used for the leap. */
  riser(dur = 1.6) {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) {
      this.tone(180 + i * 90, {
        type: 'sawtooth', a: dur * 0.7, d: dur * 0.2, r: 0.3,
        peak: 0.035, glide: (180 + i * 90) * 2.4,
      });
    }
    this.noise({ filter: 'highpass', freq: 600, a: dur * 0.8, d: 0.1, r: 0.4, peak: 0.06, sweep: 6000 });
  }

  /** Everything drops out for a beat. Called before the truck lands. */
  silence(dur = 0.4) {
    if (!this.ready) return;
    const g = this.master.gain;
    g.setTargetAtTime(0.0001, this.t, 0.03);
    g.setTargetAtTime(this.muted ? 0 : 0.85, this.t + dur, 0.05);
  }

  /** Called on act change so nothing sustains into the next scene. */
  quiet() {
    this.stopRing();
    this.stopHum();
    this.stopEngine();
    this.bed(false);
  }
}
