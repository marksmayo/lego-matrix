/**
 * Dialogue performance.
 *
 * Every line is spoken by the browser's own speech synthesiser, which means no
 * audio assets and no impersonation of any actor — but a flat text-to-speech
 * read of "your men are already dead" is worse than silence. So each character
 * gets a fixed casting decision (which installed voice, and a baseline pitch,
 * rate and volume), and each line gets an acting note on top: urgent, cold,
 * shouted, weary. The two combine into the utterance.
 *
 * Windows usually exposes only two or three distinct system voices, so most of
 * the characterisation has to come out of pitch and rate rather than out of
 * picking different voices. That is why the Agents are slow and level, the
 * officers are fast and high, and Morpheus is a full octave below everyone.
 */

/** Casting: baseline delivery per character. */
const CAST = {
  TRINITY:        { sex: 'f', pitch: 1.04, rate: 1.00, vol: 1.00 },
  CYPHER:         { sex: 'm', pitch: 0.72, rate: 0.94, vol: 0.92 },
  MORPHEUS:       { sex: 'm', pitch: 0.52, rate: 0.78, vol: 1.00, prefer: ['david', 'mark', 'george'] },
  MAN:            { sex: 'm', pitch: 0.58, rate: 0.82, vol: 0.95 },
  'AGENT SMITH':  { sex: 'm', pitch: 0.74, rate: 0.84, vol: 0.98, prefer: ['mark', 'david'] },
  'AGENT BROWN':  { sex: 'm', pitch: 0.70, rate: 0.86, vol: 0.95 },
  'AGENT JONES':  { sex: 'm', pitch: 0.78, rate: 0.86, vol: 0.95 },
  LIEUTENANT:     { sex: 'm', pitch: 0.86, rate: 1.10, vol: 1.00 },
  'BIG COP':      { sex: 'm', pitch: 0.96, rate: 1.26, vol: 1.00 },
  COP:            { sex: 'm', pitch: 1.02, rate: 1.22, vol: 1.00 },
};

/** Acting notes, applied over the casting. */
const EMOTE = {
  neutral: {},
  cold:    { pitch: -0.05, rate: -0.06 },
  flat:    { pitch: -0.02, rate: -0.02, vol: -0.05 },
  urgent:  { pitch: +0.09, rate: +0.14 },
  panic:   { pitch: +0.16, rate: +0.22 },
  shout:   { pitch: +0.12, rate: +0.16, vol: +0.05 },
  weary:   { pitch: -0.06, rate: -0.14, vol: -0.12 },
  resolve: { pitch: +0.02, rate: -0.06 },
  quiet:   { pitch: -0.03, rate: -0.10, vol: -0.35 },
  amused:  { pitch: +0.06, rate: -0.08 },
  dread:   { pitch: -0.08, rate: -0.18, vol: -0.10 },
};

export class Voices {
  constructor() {
    this.ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
    this.muted = false;
    this.voices = [];
    this.picked = new Map();
    this.lastSpoken = null;
    this.pending = null;
    this.spoken = [];      // diagnostics: every line actually handed to the synth
    this.failures = [];
    /*
     * How a cancelled-then-replaced utterance is handed over. Chrome drops an
     * utterance passed to speak() in the same task as a cancel(), so in the
     * browser this has to cross a tick. Injectable so the delivery test can
     * run the whole timeline synchronously.
     */
    this.schedule = (fn) => setTimeout(fn, 40);
    this.unschedule = (h) => clearTimeout(h);
  }

  init() {
    if (!this.ok) return;
    const load = () => {
      try {
        this.voices = speechSynthesis.getVoices() || [];
      } catch { this.voices = []; }
    };
    load();
    // Chrome populates the list asynchronously, sometimes after first paint.
    if (!this.voices.length) {
      speechSynthesis.addEventListener?.('voiceschanged', load);
      setTimeout(load, 400);
      setTimeout(load, 1500);
    }
  }

  /** Choose, once per character, the best installed voice for them. */
  voiceFor(who) {
    if (this.picked.has(who)) return this.picked.get(who);
    if (!this.voices.length) return null;

    const cast = CAST[who] || CAST.COP;
    const en = this.voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
    const pool = en.length ? en : this.voices;

    const FEM = /zira|female|hazel|susan|linda|samantha|karen|moira|tessa|catherine|aria|jenny|sonia/i;
    const MASC = /david|mark|male|george|james|daniel|alex|fred|guy|ryan|brian|christopher/i;

    let candidates = pool.filter((v) => (cast.sex === 'f' ? FEM.test(v.name) : MASC.test(v.name)));
    if (!candidates.length) {
      // Nothing identifiable: fall back to the whole pool and let pitch carry
      // the characterisation.
      candidates = pool;
    }
    if (cast.prefer) {
      for (const want of cast.prefer) {
        const hit = candidates.find((v) => v.name.toLowerCase().includes(want));
        if (hit) { candidates = [hit]; break; }
      }
    }
    // Spread characters of the same sex across whatever distinct voices exist.
    const used = [...this.picked.values()];
    const fresh = candidates.filter((v) => !used.includes(v));
    const voice = (fresh.length ? fresh : candidates)[0] || null;
    this.picked.set(who, voice);
    return voice;
  }

  /**
   * Speak one dialogue line. `line` is a DIALOGUE entry; `dur` is how long the
   * subtitle is up, which the rate is nudged toward so speech and caption end
   * together rather than the voice running on over the next shot.
   */
  speak(line) {
    if (!this.ok || this.muted || !line?.text) return;
    const who = line.who || 'COP';
    const cast = CAST[who] || CAST.COP;
    const note = EMOTE[line.emote || 'neutral'] || {};

    let pitch = (cast.pitch + (note.pitch || 0));
    let rate = (cast.rate + (note.rate || 0));
    let vol = (cast.vol + (note.vol || 0));

    if (line.dur) {
      // Fit the line into its subtitle window: roughly 15 characters a second
      // at rate 1. Squeeze a long line toward
      // its subtitle window, but never past 1.6 or the read stops being a
      // performance and starts being an auctioneer.
      const need = line.text.length / (line.dur * 15);
      if (need > 1) rate *= Math.min(1.6, need);
    }
    // Voice-over is a phone line: thinner, and a touch quieter.
    if (line.style === 'vo') vol *= 0.9;

    let u;
    try {
      u = new SpeechSynthesisUtterance(line.text);
      const v = this.voiceFor(who);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.pitch = Math.max(0.1, Math.min(2, pitch));
      u.rate = Math.max(0.4, Math.min(1.9, rate));
      u.volume = Math.max(0, Math.min(1, vol));
      u.onerror = () => { this.failures.push(who); };
    } catch { return; }

    /*
     * speak() QUEUES. That is the whole bug this guards against: in a scene
     * where lines land every second and a half, each utterance waits for the
     * one before it to finish, the queue runs further and further behind the
     * picture, and the scene change then cancels everything still waiting —
     * so the last few characters in a dense scene simply never speak. It was
     * why the Lieutenant's rant and Trinity's whole phone call were silent.
     *
     * Only one line is ever on screen, so only one should ever be in the air.
     */
    this.enqueue(u, line);
  }

  enqueue(u, line) {
    if (this.pending !== null) this.unschedule(this.pending);
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      // Chrome can leave the queue in a paused state after a cancel, and then
      // every later utterance is accepted and silently never spoken.
      speechSynthesis.resume();
    } catch { /* ignore */ }

    this.pending = this.schedule(() => {
      this.pending = null;
      try {
        speechSynthesis.speak(u);
        this.lastSpoken = line;
        this.spoken.push(line.who || '?');
      } catch { /* a browser without speech is not a failure */ }
    });
  }

  /** Stop mid-word — on pause, on a scrub, on a scene change. */
  cancel() {
    if (!this.ok) return;
    if (this.pending !== null) this.unschedule(this.pending);
    this.pending = null;
    try { speechSynthesis.cancel(); speechSynthesis.resume(); } catch { /* ignore */ }
    this.lastSpoken = null;
  }

  /** Who has actually been given a voice, and with which installed voice. */
  casting() {
    return Object.keys(CAST).map((who) => ({
      who,
      voice: this.voiceFor(who)?.name || '(browser default)',
      ...CAST[who],
    }));
  }

  setMuted(m) {
    this.muted = m;
    if (m) this.cancel();
  }
}
