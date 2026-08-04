import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Physics } from './core/physics.js';
import { Audio } from './core/audio.js';
import { Subtitles } from './core/subtitles.js';
import { Voices } from './core/voices.js';
import { makePost } from './fx/post.js';
import { DIALOGUE, CHAPTERS, RUNTIME } from './script.js';
import { clamp } from './core/anim.js';

import actScreen from './acts/01-screen.js';
import actRoom303 from './acts/02-room303.js';
import actExterior from './acts/03-exterior.js';
import actFight from './acts/04-fight.js';
import actOperator from './acts/05-operator.js';
import actEscape from './acts/06-escape.js';
import actRoof from './acts/07-roof.js';
import actDive from './acts/08-dive.js';
import actStreet from './acts/09-street.js';
import actTitle from './acts/10-title.js';

const ACTS = [
  actScreen, actRoom303, actExterior, actFight, actOperator,
  actEscape, actRoof, actDive, actStreet, actTitle,
];

/* ------------------------------------------------------------------ */
/* renderer                                                            */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = null;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.08, 1200);
camera.position.set(0, 6, 30);

// A dim room environment gives ABS its specular sheen even in the dark; without
// it the plastic reads as chalk. Kept low so the scenes stay night-time.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.16;
pmrem.dispose();

const physics = new Physics(scene);
const audio = new Audio();
const post = makePost(renderer, scene, camera);
const voices = new Voices();
// Only perform a line if we have arrived at it in play, not scrubbed into the
// middle of it, and not while paused.
const subs = new Subtitles(document.getElementById('subs'), DIALOGUE, (line, into) => {
  if (playing && into < 0.4) voices.speak(line);
});

const ctx = { scene, camera, renderer, physics, audio, post, subs, voices, THREE };

/* ------------------------------------------------------------------ */
/* the director                                                        */
/* ------------------------------------------------------------------ */

const built = new Map();
let current = -1;
let time = 0;
let playing = false;
let started = false;
// Grain is a taste call, so it is a toggle rather than a constant. Acts that
// want more of it (the CRT) scale from this base.
let grainStep = 1;
let grainBase = 0.005;

function buildAct(i) {
  if (built.has(i)) return built.get(i);
  const inst = ACTS[i].build(ctx);
  inst.def = ACTS[i];
  built.set(i, inst);
  return inst;
}

function actIndexAt(t) {
  for (let i = ACTS.length - 1; i >= 0; i--) {
    if (t >= ACTS[i].start) return i;
  }
  return 0;
}

function mount(i) {
  if (i === current) return;
  if (current >= 0) {
    const old = built.get(current);
    if (old) {
      old.exit?.(ctx);
      if (old.group.parent) scene.remove(old.group);
    }
  }
  physics.reset();
  audio.quiet();
  voices.cancel();
  subs.clear();
  current = i;
  const inst = buildAct(i);
  scene.add(inst.group);
  inst.cues?.reset();
  inst.enter?.(ctx);
  slateScene.textContent = ACTS[i].slug;
  markChapter(i);
}

function seek(t) {
  voices.cancel();
  time = clamp(t, 0, RUNTIME - 0.05);
  mount(actIndexAt(time));
  const inst = built.get(current);
  inst.cues?.reset();
  inst.reseek?.(time - ACTS[current].start, ctx);
  subs.update(time);
}

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */

const clock = new THREE.Clock();
let acc = 0;

function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 0.05);
  const dt = playing ? raw : 0;
  time += dt;
  acc += raw;

  if (time >= RUNTIME) {
    time = RUNTIME - 0.001;
    playing = false;
    btnPlay.textContent = 'REPLAY';
  }

  const want = actIndexAt(time);
  if (want !== current) mount(want);
  if (current < 0) { post.render(raw, acc); return; }

  const def = ACTS[current];
  const local = time - def.start;
  const inst = built.get(current);

  inst.cues?.tick(local);
  inst.update(local, dt, ctx);
  // Grain is owned here so the toggle always wins; acts only scale it.
  post.u.uGrain.value = grainBase * (inst.grainScale ?? 1);
  physics.step(dt);
  subs.update(time);

  // Fade across scene changes unless the act asks for a hard cut.
  const outK = def.hardOut ? 0 : 1 - clamp((def.end - time) / 0.5);
  const inK = def.hardIn ? 0 : 1 - clamp(local / 0.5);
  post.u.uFade.value = Math.max(inst.fade ?? 0, outK, inK);

  post.render(raw, acc);
  updateHud();
}

/* ------------------------------------------------------------------ */
/* interface                                                           */
/* ------------------------------------------------------------------ */

const boot = document.getElementById('boot');
const startBtn = document.getElementById('start');
const loadFill = document.querySelector('#loadbar i');
const transport = document.getElementById('transport');
const chaptersEl = document.getElementById('chapters');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnMute = document.getElementById('btn-mute');
const btnRestart = document.getElementById('btn-restart');
const scrub = document.getElementById('scrub');
const scrubFill = scrub.querySelector('.fill');
const slateScene = document.getElementById('slate-scene');
const slateTc = document.getElementById('slate-tc');
const hint = document.getElementById('hint');

CHAPTERS.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'ch';
  b.textContent = c.label;
  b.onclick = () => { seek(c.t + 0.01); if (!playing) togglePlay(true); };
  chaptersEl.appendChild(b);

  const tick = document.createElement('div');
  tick.className = 'tick';
  tick.style.left = `${(c.t / RUNTIME) * 100}%`;
  tick.title = c.label;
  scrub.appendChild(tick);
});

function markChapter(i) {
  [...chaptersEl.children].forEach((el, k) => el.classList.toggle('active', k === i));
}

function togglePlay(force) {
  playing = force ?? !playing;
  if (playing && time >= RUNTIME - 0.01) time = 0;
  btnPlay.textContent = playing ? 'PAUSE' : 'PLAY';
  if (playing) audio.resume();
  else { audio.quiet(); voices.cancel(); }
}

btnPlay.onclick = () => togglePlay();
btnPrev.onclick = () => {
  const local = time - ACTS[current].start;
  seek(local < 2.5 && current > 0 ? ACTS[current - 1].start + 0.01 : ACTS[current].start + 0.01);
};
btnNext.onclick = () => seek(ACTS[Math.min(ACTS.length - 1, current + 1)].start + 0.01);
btnRestart.onclick = () => { seek(0); togglePlay(true); };
btnMute.onclick = () => {
  audio.setMuted(!audio.muted);
  voices.setMuted(audio.muted);
  btnMute.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
};

let dragging = false;
const scrubTo = (e) => {
  const r = scrub.getBoundingClientRect();
  seek(((e.clientX - r.left) / r.width) * RUNTIME);
};
scrub.addEventListener('pointerdown', (e) => { dragging = true; scrubTo(e); scrub.setPointerCapture(e.pointerId); });
scrub.addEventListener('pointermove', (e) => { if (dragging) scrubTo(e); });
scrub.addEventListener('pointerup', (e) => { dragging = false; scrub.releasePointerCapture(e.pointerId); });

addEventListener('keydown', (e) => {
  if (!started) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowRight') btnNext.onclick();
  else if (e.code === 'ArrowLeft') btnPrev.onclick();
  else if (e.key === 'm') btnMute.onclick();
  else if (e.key === 'r') btnRestart.onclick();
  else if (e.key === 'g') {
    // Film grain: off, subtle, or more than you probably want.
    grainStep = (grainStep + 1) % 3;
    grainBase = [0, 0.005, 0.013][grainStep];
    post.u.uGrain.value = grainBase;
  }
});

let idleTimer = null;
function wake() {
  transport.classList.add('visible');
  chaptersEl.classList.add('visible');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    transport.classList.remove('visible');
    chaptersEl.classList.remove('visible');
  }, 2600);
}
addEventListener('pointermove', wake);
addEventListener('pointerdown', wake);

function updateHud() {
  scrubFill.style.width = `${(time / RUNTIME) * 100}%`;
  const f = Math.floor((time % 1) * 24);
  const s = Math.floor(time) % 60;
  const m = Math.floor(time / 60);
  slateTc.textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

/**
 * Build every act before we start. It costs about a second, and it buys a
 * playthrough with no hitch when a new set walks on.
 */
async function prebuild() {
  for (let i = 0; i < ACTS.length; i++) {
    const inst = buildAct(i);
    // Mount it for one beat and compile: enter() is what pulls in the shared
    // sets, so this is the only way to precompile their shaders too.
    scene.add(inst.group);
    inst.enter?.(ctx);
    renderer.compile(scene, camera);
    inst.exit?.(ctx);
    if (inst.group.parent) scene.remove(inst.group);
    physics.reset();
    scene.fog = null;
    loadFill.style.width = `${((i + 1) / ACTS.length) * 100}%`;
    await new Promise((r) => requestAnimationFrame(r));
  }
  current = -1;
}

startBtn.disabled = true;
startBtn.style.opacity = '0.45';

prebuild().then(() => {
  startBtn.disabled = false;
  startBtn.style.opacity = '1';
  loadFill.style.width = '100%';
});

startBtn.onclick = async () => {
  if (startBtn.disabled) return;
  audio.init();
  audio.resume();
  voices.init();
  boot.classList.add('gone');
  setTimeout(() => { boot.style.display = 'none'; }, 750);
  started = true;
  seek(0);
  togglePlay(true);
  clock.getDelta();
  wake();
  setTimeout(() => { hint.style.opacity = '0'; }, 7000);
};

frame();
