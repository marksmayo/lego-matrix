/**
 * Score.
 *
 * Original cues written to sit where the film's score sits, in the same
 * idiom — low sustained drones, an industrial pulse, tritone brass-ish stabs,
 * a driving sixteenth ostinato for the action, and a percussive hit on the
 * cuts — but the patterns, intervals and progressions here are written for
 * this piece. Nothing is transcribed from any recording.
 *
 * All of it is oscillators and filtered noise through the same master bus as
 * the sound effects, so one mute button covers everything.
 *
 * A cue is a bpm, a set of sixteen-step patterns, and a couple of held voices.
 * `cue(name)` crossfades; the step clock keeps running so cues change on the
 * beat rather than restarting.
 */

const SEMI = (n) => Math.pow(2, n / 12);

/**
 * Patterns are 16 steps of a bar. Pitches are semitone offsets from the cue's
 * root, `null` is a rest.
 */
const CUES = {
  /* Act 1 — the terminal. Almost nothing: a heartbeat and a room tone. */
  terminal: {
    bpm: 52, root: 41.2,               // E1
    pad: [0, 7], padLevel: 0.05,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    kickLevel: 0.42,
    bass: [0, null, null, null, null, null, null, null,
      0, null, null, null, null, null, null, null],
    bassLevel: 0.05,
  },

  /* Act 2 — four torches in a burnt corridor. Held, airless, creeping. */
  creep: {
    bpm: 60, root: 43.7,               // F1
    pad: [0, 6], padLevel: 0.055,      // the tritone does the work
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    kickLevel: 0.34,
    tick: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    tickLevel: 0.05,
    bass: [0, null, null, 0, null, null, null, null,
      -2, null, null, null, null, null, null, null],
    bassLevel: 0.06,
  },

  /* Act 3 — the Agents arrive. Cold, level, unhurried. */
  agents: {
    bpm: 56, root: 36.7,               // D1
    pad: [0, 7, 11], padLevel: 0.05,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    kickLevel: 0.3,
    bass: [0, null, null, null, null, null, null, null,
      0, null, null, null, null, null, null, null],
    bassLevel: 0.055,
  },

  /* Act 4 — the fight. Sixteenths, and a stab on the backbeat. */
  fight: {
    bpm: 132, root: 55.0,              // A1
    pad: [0, 5], padLevel: 0.03,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    kickLevel: 0.5,
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    hatLevel: 0.045,
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    snareLevel: 0.16,
    bass: [0, 0, null, 0, null, 0, null, null,
      -3, -3, null, -3, null, 0, null, null],
    bassLevel: 0.075,
    stab: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    stabLevel: 0.05, stabChord: [0, 6, 13],
  },

  /* Held for the suspended kick: everything drops away but one low note. */
  suspend: {
    bpm: 132, root: 55.0,
    pad: [0, 6], padLevel: 0.07,
    bass: [0, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null],
    bassLevel: 0.05,
  },

  /* Act 6 — the Operator. Sparse, two notes, room to breathe. */
  operator: {
    bpm: 64, root: 49.0,               // G1
    pad: [0, 7], padLevel: 0.045,
    bass: [0, null, null, null, null, null, null, null,
      5, null, null, null, null, null, null, null],
    bassLevel: 0.055,
    tick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    tickLevel: 0.035,
  },

  /* Acts 7 and 9 — the chase. Faster, and it does not resolve. */
  chase: {
    bpm: 148, root: 61.7,              // B1
    pad: [0, 5], padLevel: 0.028,
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    kickLevel: 0.46,
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    hatLevel: 0.05,
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
    snareLevel: 0.14,
    bass: [0, null, 0, null, -5, null, 0, null,
      2, null, 2, null, -3, null, 0, null],
    bassLevel: 0.075,
  },

  /* Act 8 — the dive and the stairwell. Weight, and then wreckage. */
  fall: {
    bpm: 72, root: 38.9,               // D#1
    pad: [0, 1], padLevel: 0.06,       // minor second: nothing is fine
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    kickLevel: 0.44,
    bass: [0, null, null, null, null, null, null, null,
      1, null, null, null, null, null, null, null],
    bassLevel: 0.07,
  },

  /* Act 11 — the booth. Builds all the way to the impact. */
  street: {
    bpm: 138, root: 46.2,              // F#1
    pad: [0, 7], padLevel: 0.035,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    kickLevel: 0.48,
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    hatLevel: 0.045,
    bass: [0, 0, null, 0, null, null, 0, null,
      -4, -4, null, -4, null, null, -2, null],
    bassLevel: 0.08,
    stab: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    stabLevel: 0.045, stabChord: [0, 6, 12],
  },

  /* Title. One chord, held, and a slow pulse under it. */
  title: {
    bpm: 50, root: 41.2,
    pad: [0, 7, 12], padLevel: 0.075,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    kickLevel: 0.36,
  },
};

export class Score {
  constructor(audio) {
    this.audio = audio;
    this.cueName = null;
    this.cue = null;
    this.step = 0;
    this.timer = null;
    this.level = 1;
    this.pads = [];
  }

  get ctx() { return this.audio.ctx; }

  /** Switch cue. Pass null to stop. */
  play(name, { level = 1 } = {}) {
    if (!this.audio.ready) return;
    this.level = level;
    if (name === this.cueName) return;
    this.cueName = name;
    this.cue = name ? CUES[name] : null;
    this.setPad(this.cue);
    if (!this.cue) { this.stopClock(); return; }
    this.startClock();
  }

  stop() {
    if (this.cueName) this.lastName = this.cueName;
    this.play(null);
  }

  /** Restart whatever was playing before the last stop (i.e. after a pause). */
  resume() {
    if (this.lastName && !this.cueName) this.play(this.lastName, { level: this.level });
  }

  startClock() {
    if (this.timer) return;
    const tick = () => {
      if (!this.cue || !this.audio.ready) { this.timer = null; return; }
      this.beat(this.step % 16);
      this.step++;
      const ms = (60000 / this.cue.bpm) / 4;
      this.timer = setTimeout(tick, ms);
    };
    this.timer = 1;
    tick();
  }

  stopClock() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** Held chord voices, crossfaded when the cue changes. */
  setPad(cue) {
    const a = this.audio;
    if (!a.ready) return;
    const t = a.ctx.currentTime;
    for (const p of this.pads) {
      p.gain.gain.setTargetAtTime(0, t, 0.5);
      p.osc.stop(t + 3);
    }
    this.pads = [];
    if (!cue?.pad) return;

    for (const semi of cue.pad) {
      const osc = a.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = cue.root * SEMI(semi);
      const det = a.ctx.createOscillator();
      det.type = 'sawtooth';
      det.frequency.value = cue.root * SEMI(semi) * 1.004;
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 340;
      f.Q.value = 1.6;
      const gain = a.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(f); det.connect(f); f.connect(gain); gain.connect(a.master);
      osc.start(); det.start();
      gain.gain.setTargetAtTime((cue.padLevel || 0.04) * this.level, t, 1.2);
      this.pads.push({ osc, gain });
      this.pads.push({ osc: det, gain });
    }
  }

  /** One sixteenth. */
  beat(i) {
    const a = this.audio;
    const c = this.cue;
    if (!a.ready || a.muted || !c) return;
    const L = this.level;

    if (c.kick?.[i]) {
      a.tone(c.root * 1.5, {
        type: 'sine', a: 0.004, d: 0.1, r: 0.16,
        peak: (c.kickLevel || 0.4) * L, glide: c.root * 0.62,
      });
      a.noise({ filter: 'lowpass', freq: 220, a: 0.002, d: 0.03, r: 0.05, peak: 0.05 * L });
    }
    if (c.snare?.[i]) {
      a.noise({
        filter: 'bandpass', freq: 1900, q: 0.9,
        a: 0.002, d: 0.05, r: 0.09, peak: (c.snareLevel || 0.15) * L,
      });
    }
    if (c.hat?.[i]) {
      a.noise({
        filter: 'highpass', freq: 7200,
        a: 0.001, d: 0.014, r: 0.02, peak: (c.hatLevel || 0.05) * L * (i % 2 ? 0.6 : 1),
      });
    }
    if (c.tick?.[i]) {
      a.noise({
        filter: 'bandpass', freq: 3400, q: 7,
        a: 0.001, d: 0.02, r: 0.03, peak: (c.tickLevel || 0.04) * L,
      });
    }
    const b = c.bass?.[i];
    if (b !== null && b !== undefined) {
      a.tone(c.root * SEMI(b), {
        type: 'square', a: 0.006, d: 0.09, r: 0.1, peak: (c.bassLevel || 0.06) * L,
      });
      a.tone(c.root * SEMI(b) * 0.5, {
        type: 'sine', a: 0.006, d: 0.12, r: 0.14, peak: (c.bassLevel || 0.06) * L * 0.7,
      });
    }
    if (c.stab?.[i]) {
      for (const s of c.stabChord || [0, 6]) {
        a.tone(c.root * 4 * SEMI(s), {
          type: 'sawtooth', a: 0.008, d: 0.16, r: 0.24, peak: (c.stabLevel || 0.05) * L,
        });
      }
      a.noise({ filter: 'bandpass', freq: 900, q: 1.2, a: 0.004, d: 0.1, r: 0.2, peak: 0.04 * L });
    }
  }

  /** A one-off hit, for a cut or an impact. */
  hit(power = 1) {
    const a = this.audio;
    if (!a.ready) return;
    const root = this.cue?.root || 44;
    a.tone(root * 2, { type: 'sawtooth', a: 0.005, d: 0.2, r: 0.4, peak: 0.07 * power });
    a.tone(root * 2 * SEMI(6), { type: 'sawtooth', a: 0.005, d: 0.2, r: 0.4, peak: 0.06 * power });
    a.tone(root * 0.5, { type: 'sine', a: 0.004, d: 0.24, r: 0.5, peak: 0.3 * power, glide: root * 0.3 });
  }
}
