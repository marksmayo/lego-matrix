/**
 * Dialogue delivery check.
 *
 * Replaces window.speechSynthesis with a stub that records every utterance and
 * models the two behaviours that actually broke the real thing — utterances
 * queue, and cancel() throws away everything still queued — then plays the
 * whole timeline at 30 fps through the real Subtitles + Voices path and reports
 * which of the screenplay's lines were spoken, which were dropped, and with
 * what pitch, rate and volume.
 *
 * Headless Chrome ships no speech voices, so this cannot test that audio comes
 * out. It tests the part that was wrong: whether every line gets handed to the
 * synth, on its own cue, instead of being stuck behind the line before it.
 *
 *   python -m http.server 8123
 *   chrome --headless=new --disable-gpu --virtual-time-budget=900000 \
 *          --dump-dom http://localhost:8123/_voicecheck.html
 */
import { Subtitles } from './src/core/subtitles.js';
import { Voices } from './src/core/voices.js';
import { DIALOGUE, RUNTIME } from './src/script.js';

const out = document.getElementById('out');
const log = [];
addEventListener('error', (e) => { out.textContent = `ERROR ${e.message} @ ${e.filename}:${e.lineno}`; });

/* ---------------- a speech synthesiser that behaves like Chrome's --------- */

let now = 0;                     // virtual seconds
const spoken = [];               // { text, who, at, pitch, rate, volume }
const dropped = [];
let current = null;              // utterance in flight: { u, until }
let queue = [];

const stub = {
  get speaking() { return !!current; },
  get pending() { return queue.length > 0; },
  paused: false,
  speak(u) {
    // Duration modelled the same way the code estimates it: ~15 chars/sec.
    const dur = u.text.length / (15 * (u.rate || 1));
    if (current) queue.push({ u, dur });
    else current = { u, until: now + dur, dur };
    spoken.push({
      text: u.text, who: u.__who, at: now,
      pitch: +u.pitch.toFixed(3), rate: +u.rate.toFixed(3), volume: +u.volume.toFixed(3),
    });
  },
  cancel() {
    if (current) dropped.push({ text: current.u.text, at: now, reason: 'cut off mid-line' });
    for (const q of queue) dropped.push({ text: q.u.text, at: now, reason: 'never started' });
    current = null;
    queue = [];
  },
  resume() { this.paused = false; },
  pause() { this.paused = true; },
  getVoices() {
    // Pretend to be a typical Windows install.
    return [
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
    ];
  },
  addEventListener() {},
};

class Utt {
  constructor(text) {
    this.text = text;
    this.pitch = 1; this.rate = 1; this.volume = 1;
    this.voice = null; this.lang = 'en-US';
  }
}

// speechSynthesis is a read-only accessor on the window prototype, and module
// code is strict mode, so a plain assignment throws.
Object.defineProperty(window, 'speechSynthesis', { value: stub, configurable: true, writable: true });
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utt, configurable: true, writable: true });

function advance(dt) {
  now += dt;
  if (current && now >= current.until) {
    current = null;
    const next = queue.shift();
    if (next) current = { u: next.u, until: now + next.dur, dur: next.dur };
  }
}

/* ---------------- run the timeline --------------------------------------- */

const voices = new Voices();
voices.init();
// Hand utterances over synchronously: the 40 ms tick in the browser exists only
// to dodge a Chrome bug, and waiting for real timers here makes the test take
// minutes and finish after the DOM is dumped.
voices.schedule = (fn) => { fn(); return null; };
voices.unschedule = () => {};

// The real callback from main.js, including its guards.
let playing = true;
const subs = new Subtitles(document.getElementById('subs'), DIALOGUE, (line, into) => {
  if (playing && into < 0.4) {
    line.__who = line.who;
    const origSpeak = stub.speak.bind(stub);
    stub.speak = (u) => { u.__who = line.who; origSpeak(u); };
    voices.speak(line);
    stub.speak = origSpeak;
  }
});

const STEP = 1 / 30;
for (let t = 0; t < RUNTIME; t += STEP) {
  subs.update(t);
  advance(STEP);
}
report();

function report() {
  const want = DIALOGUE.length;
  const byText = new Map(spoken.map((s) => [s.text, s]));
  const missing = DIALOGUE.filter((l) => !byText.has(l.text));
  const never = dropped.filter((d) => d.reason === 'never started');

  log.push(`VOICE CHECK — ${want} lines in the screenplay`);
  log.push(`  handed to the synth : ${spoken.length}`);
  log.push(`  never spoken at all : ${missing.length}`);
  log.push(`  cut off by the next : ${dropped.filter((d) => d.reason === 'cut off mid-line').length}`);
  log.push(`  queued then dropped : ${never.length}`);
  log.push('');

  if (missing.length) {
    log.push('NEVER SPOKEN:');
    for (const m of missing) log.push(`  t=${m.t}  ${m.who}: ${m.text.slice(0, 60)}`);
    log.push('');
  }

  log.push('CASTING:');
  for (const c of voices.casting()) {
    log.push(`  ${c.who.padEnd(13)} ${String(c.voice).padEnd(46)} pitch ${c.pitch} rate ${c.rate}`);
  }
  log.push('');

  log.push('EVERY LINE AS DELIVERED:');
  const perChar = new Map();
  for (const s of spoken) {
    perChar.set(s.who, (perChar.get(s.who) || 0) + 1);
    log.push(`  ${String(s.at.toFixed(1)).padStart(6)}s  ${String(s.who).padEnd(13)}`
      + ` p${s.pitch.toFixed(2)} r${s.rate.toFixed(2)} v${s.volume.toFixed(2)}  ${s.text.slice(0, 52)}`);
  }
  log.push('');
  log.push('LINES PER CHARACTER:');
  for (const [who, n] of [...perChar.entries()].sort()) log.push(`  ${String(who).padEnd(13)} ${n}`);

  log.push('');
  log.push(missing.length === 0 ? 'VOICE CHECK PASS' : `VOICE CHECK FAIL (${missing.length} silent)`);
  out.textContent = log.join('\n');
}
