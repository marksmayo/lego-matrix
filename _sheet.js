/**
 * Contact sheet. Renders a grid of key frames from across the whole piece into
 * one canvas so the staging can actually be looked at. Each cell warms up from
 * its act's first frame so physics debris and one-shot cues are in the right
 * state by the time the frame is drawn.
 *
 *   python -m http.server 8123
 *   chrome --headless=new --screenshot=sheet.png --window-size=1920,1640 \
 *          http://localhost:8123/_sheet.html?shots=...
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Physics } from './src/core/physics.js';
import { Audio } from './src/core/audio.js';
import { Subtitles } from './src/core/subtitles.js';
import { makePost } from './src/fx/post.js';
import { DIALOGUE } from './src/script.js';

import a1 from './src/acts/01-screen.js';
import a2 from './src/acts/02-room303.js';
import a3 from './src/acts/03-exterior.js';
import a4 from './src/acts/04-fight.js';
import a5 from './src/acts/05-operator.js';
import a6 from './src/acts/06-escape.js';
import a7 from './src/acts/07-roof.js';
import a8 from './src/acts/08-dive.js';
import a9 from './src/acts/09-street.js';
import a10 from './src/acts/10-title.js';

const ACTS = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10];

const DEFAULT_SHOTS = [
  3, 26, 59.5, 66, 71.2, 78,
  84, 95, 115.6, 118, 135, 158,
  161.5, 182.5, 194.5, 197, 212, 223,
  224.8, 227, 236, 245,
];
const q = new URLSearchParams(location.search);
const SHOTS = q.get('shots')
  ? q.get('shots').split(',').map(Number)
  : DEFAULT_SHOTS;
const COLS = Number(q.get('cols') || 4);
const FLAT = q.get('flat') === '1';
const CW = Number(q.get('w') || 480), CH = Math.round(CW * 9 / 16);

const out = document.getElementById('out');
const sheet = document.getElementById('sheet');
const rows = Math.ceil(SHOTS.length / COLS);
sheet.width = COLS * CW;
sheet.height = rows * CH;
const g2 = sheet.getContext('2d');
g2.fillStyle = '#000';
g2.fillRect(0, 0, sheet.width, sheet.height);

const canvas = document.getElementById('stage');
canvas.width = CW; canvas.height = CH;
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(CW, CH);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(38, CW / CH, 0.08, 1200);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.16;
pmrem.dispose();

const physics = new Physics(scene);
const audio = new Audio();
const post = makePost(renderer, scene, camera);
const subs = new Subtitles(document.getElementById('subs'), DIALOGUE);
const ctx = { scene, camera, renderer, physics, audio, post, subs, THREE };

if (FLAT) {
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(40, 80, 60);
  const key2 = new THREE.DirectionalLight(0xdde8ff, 1.4);
  key2.position.set(-50, 30, -40);
  scene.add(key, key2, new THREE.HemisphereLight(0xcfe0ff, 0x556066, 2.2));
}

const insts = ACTS.map((a) => {
  const inst = a.build(ctx);
  inst.def = a;
  return inst;
});

const actAt = (t) => {
  for (let i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].start) return i;
  return 0;
};

const tc = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * 24);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
};

let mounted = -1;
const STEP = 1 / 12;
const notes = [];
const ray = new THREE.Raycaster();
ray.far = 400;

/** What is the lens actually pointing at, and how close is it? */
function probe() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  ray.set(camera.position, dir);
  // Solid geometry only: points and sprites are not what blocks a lens.
  const targets = [];
  scene.traverseVisible((o) => {
    if (o.isMesh && o.visible) targets.push(o);
  });
  const hits = ray.intersectObjects(targets, false);
  if (!hits.length) return 'nothing';
  return hits.slice(0, 3).map((h) => {
    let o = h.object, name = o.name || o.type;
    // Walk up for a meaningful label.
    let p = o.parent;
    while (p && p !== scene) {
      if (p.name) { name = `${p.name}/${name}`; break; }
      p = p.parent;
    }
    const q = h.point;
    return `${name}@${h.distance.toFixed(1)} at(${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}) size(${
      (() => { const b = new THREE.Box3().setFromObject(h.object); const v = b.getSize(new THREE.Vector3());
        return `${v.x.toFixed(1)}x${v.y.toFixed(1)}x${v.z.toFixed(1)}`; })()})`;
  }).join(' | ');
}

SHOTS.forEach((t, n) => {
  const i = actAt(t);
  // Fresh mount every cell: the warm-up has to start from the act's own zero.
  if (mounted >= 0) {
    insts[mounted].exit?.(ctx);
    if (insts[mounted].group.parent) scene.remove(insts[mounted].group);
  }
  physics.reset();
  scene.fog = null;
  mounted = i;
  scene.add(insts[i].group);
  insts[i].cues?.reset();
  insts[i].enter?.(ctx);

  const target = t - ACTS[i].start;
  for (let lt = 0; lt <= target; lt += STEP) {
    insts[i].cues?.tick(lt);
    insts[i].update(lt, STEP, ctx);
    physics.step(STEP);
  }
  post.u.uFade.value = insts[i].fade ?? 0;
  if (FLAT) {
    // Technical pass: kill the grade and flood the set, so framing can be
    // judged separately from lighting. Applied after update(), because that's
    // where the acts set their own grade.
    post.u.uGreen.value = 0;
    post.u.uVignette.value = 0;
    post.u.uGrain.value = 0;
    post.u.uScan.value = 0;
    post.u.uAberr.value = 0;
    post.u.uWhite.value = 0;
    post.u.uFade.value = 0;
    post.bloom.strength = 0;
  }
  post.render(STEP, t);

  const col = n % COLS, row = Math.floor(n / COLS);
  g2.drawImage(canvas, col * CW, row * CH, CW, CH);
  g2.strokeStyle = 'rgba(0,255,120,0.25)';
  g2.strokeRect(col * CW + 0.5, row * CH + 0.5, CW - 1, CH - 1);
  g2.font = '13px ui-monospace, monospace';
  g2.fillStyle = 'rgba(0,0,0,0.65)';
  g2.fillRect(col * CW + 4, row * CH + 4, 250, 20);
  g2.fillStyle = '#8effb8';
  g2.fillText(`${tc(t)}  ${ACTS[i].slug}`, col * CW + 8, row * CH + 18);
  const p = camera.position;
  let seen = 'probe failed';
  try { seen = probe(); } catch (err) { seen = 'probe error: ' + err.message; }
  out.textContent = notes.join('\n');
  notes.push(`${tc(t)} ${ACTS[i].slug}  cam(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}) fov ${camera.fov.toFixed(0)} bodies ${physics.count}
      sees: ${seen}`);
});

out.textContent = `SHEET OK ${SHOTS.length} frames\n${notes.join('\n')}`;
