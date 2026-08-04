/**
 * Clipping check.
 *
 * Steps the whole timeline and, for every visible minifigure, tests its feet
 * and its torso against the act's own static colliders — which are generated
 * from the same walls, decks and floors as the visible geometry, so they are a
 * faithful proxy for "is this figure inside the set".
 *
 * Analytic rather than raycast on purpose: a brick-built wall is one
 * InstancedMesh with hundreds of instances, and raycasting a few thousand
 * samples against those costs minutes. Box tests cost nothing.
 *
 *   python -m http.server 8123
 *   chrome --headless=new --disable-gpu --virtual-time-budget=900000 \
 *          --dump-dom http://localhost:8123/_clip.html
 */
import * as THREE from 'three';
import { Physics } from './src/core/physics.js';
import { Audio } from './src/core/audio.js';
import { Subtitles } from './src/core/subtitles.js';
import { makePost } from './src/fx/post.js';
import { DIALOGUE, RUNTIME } from './src/script.js';

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
const out = document.getElementById('out');

const SINK_TOL = 0.22;    // feet below a surface they are standing on
const FLOAT_TOL = 0.45;   // feet above the nearest surface under them
const INSIDE_TOL = 0.30;  // torso inside a solid box

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 1200);
const physics = new Physics(scene);
const audio = new Audio();
const post = makePost(renderer, scene, camera);
const subs = new Subtitles(document.getElementById('subs'), DIALOGUE);
const ctx = { scene, camera, renderer, physics, audio, post, subs, THREE };

const insts = ACTS.map((a) => { const i = a.build(ctx); i.def = a; return i; });

/** Static colliders as plain boxes: [minX, maxX, minY, maxY, minZ, maxZ]. */
function boxes() {
  return physics.statics.map((b) => {
    const h = b.shapes[0].halfExtents;
    const p = b.position;
    return [p.x - h.x, p.x + h.x, p.y - h.y, p.y + h.y, p.z - h.z, p.z + h.z];
  });
}

const figs = [];
function collectFigs() {
  figs.length = 0;
  scene.traverse((o) => {
    if (o.visible && typeof o.name === 'string' && o.name.startsWith('minifig:')) figs.push(o);
  });
}

const wp = new THREE.Vector3();
const up = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const report = new Map();

function note(act, fig, kind, value, t) {
  const key = `${act} | ${fig} | ${kind}`;
  const prev = report.get(key);
  if (!prev || Math.abs(value) > Math.abs(prev.value)) {
    report.set(key, { value, t, count: (prev?.count || 0) + 1 });
  } else {
    prev.count++;
  }
}

let cur = -1;
const STEP = 1 / 8;
let bx = [];

for (let t = 0; t < RUNTIME; t += STEP) {
  let want = 0;
  for (let i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].start) { want = i; break; }
  if (want !== cur) {
    if (cur >= 0) {
      insts[cur].exit?.(ctx);
      if (insts[cur].group.parent) scene.remove(insts[cur].group);
    }
    physics.reset();
    scene.fog = null;
    cur = want;
    scene.add(insts[cur].group);
    insts[cur].cues?.reset();
    insts[cur].enter?.(ctx);
    bx = boxes();
  }
  const inst = insts[cur];
  const local = t - ACTS[cur].start;
  inst.cues?.tick(local);
  inst.update(local, STEP, ctx);
  physics.step(STEP);
  scene.updateMatrixWorld(true);

  collectFigs();
  for (const fig of figs) {
    fig.getWorldPosition(wp);
    // A figure on a wall has its own idea of up; only test gravity-relative
    // clipping for figures that are still the right way up.
    up.copy(UP).applyQuaternion(fig.getWorldQuaternion(new THREE.Quaternion()));
    const upright = up.dot(UP) > 0.72;

    // --- feet versus the surface underneath them ---
    let topBelow = -Infinity;
    for (const b of bx) {
      if (wp.x < b[0] || wp.x > b[1] || wp.z < b[4] || wp.z > b[5]) continue;
      if (b[3] <= wp.y + 0.35 && b[3] > topBelow) topBelow = b[3];
    }
    if (upright && topBelow > -Infinity) {
      const gap = wp.y - topBelow;
      if (gap < -SINK_TOL) note(ACTS[cur].slug, fig.name, 'feet sunk', gap, t);
    }

    // --- torso inside a solid ---
    const ty = wp.y + (upright ? 3.0 : 0);
    for (const b of bx) {
      const dx = Math.min(wp.x - b[0], b[1] - wp.x);
      const dz = Math.min(wp.z - b[4], b[5] - wp.z);
      const dy = Math.min(ty - b[2], b[3] - ty);
      if (dx > INSIDE_TOL && dz > INSIDE_TOL && dy > INSIDE_TOL) {
        note(ACTS[cur].slug, fig.name, 'inside solid', Math.min(dx, dz), t);
        break;
      }
    }
  }
}

const lines = [...report.entries()]
  .sort((a, b) => Math.abs(b[1].value) - Math.abs(a[1].value))
  .map(([k, v]) => `${k}  worst ${v.value.toFixed(2)}u at t=${v.t.toFixed(1)}  (${v.count} samples)`);

out.textContent = `CLIP CHECK — ${report.size} issue groups\n\n${lines.join('\n') || 'clean'}`;
