/**
 * Headless smoke test. Builds every act, then steps the whole 253-second
 * timeline at 12 fps, rendering each frame, and reports the first error per
 * act. Run with:
 *   python -m http.server 8123
 *   chrome --headless=new --dump-dom http://localhost:8123/_smoke.html
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
const log = [];
const say = (s) => { log.push(s); out.textContent = log.join('\n'); };

window.addEventListener('error', (e) => say(`WINDOW ERROR: ${e.message} @ ${e.filename}:${e.lineno}`));

try {
  const canvas = document.getElementById('stage');
  canvas.width = 320; canvas.height = 180;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(320, 180);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 320 / 180, 0.08, 1200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  const physics = new Physics(scene);
  const audio = new Audio();               // never init()ed: silent, no gesture
  const post = makePost(renderer, scene, camera);
  const subs = new Subtitles(document.getElementById('subs'), DIALOGUE);
  const ctx = { scene, camera, renderer, physics, audio, post, subs, THREE };

  say(`webgl: ${renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl1'}`);

  // ---- build ----
  const insts = [];
  for (let i = 0; i < ACTS.length; i++) {
    const t0 = performance.now();
    try {
      const inst = ACTS[i].build(ctx);
      inst.def = ACTS[i];
      insts.push(inst);
      say(`built ${ACTS[i].slug} in ${(performance.now() - t0).toFixed(0)}ms`);
    } catch (err) {
      insts.push(null);
      say(`BUILD FAIL ${ACTS[i].slug}: ${err && err.stack || err}`);
    }
  }

  // ---- run ----
  // Software rasterisation is the bottleneck, not the simulation: step the
  // logic at 12 fps but only rasterise every eighth frame.
  const STEP = 1 / 12;
  let cur = -1;
  let errors = 0;
  let n = 0;
  const seen = new Set();
  for (let t = 0; t < RUNTIME; t += STEP) {
    n++;
    let want = 0;
    for (let i = ACTS.length - 1; i >= 0; i--) if (t >= ACTS[i].start) { want = i; break; }
    if (want !== cur) {
      try {
        if (cur >= 0 && insts[cur]) {
          insts[cur].exit?.(ctx);
          if (insts[cur].group.parent) scene.remove(insts[cur].group);
        }
        physics.reset();
        cur = want;
        if (insts[cur]) {
          scene.add(insts[cur].group);
          insts[cur].cues?.reset();
          insts[cur].enter?.(ctx);
        }
      } catch (err) {
        const k = `mount:${cur}`;
        if (!seen.has(k)) { seen.add(k); errors++; say(`MOUNT FAIL ${ACTS[cur].slug}: ${err && err.stack || err}`); }
      }
    }
    const inst = insts[cur];
    if (!inst) continue;
    const local = t - ACTS[cur].start;
    try {
      inst.cues?.tick(local);
      inst.update(local, STEP, ctx);
      physics.step(STEP);
      subs.update(t);
      post.u.uFade.value = inst.fade ?? 0;
      if (n % 8 === 0) post.render(STEP, t);
    } catch (err) {
      const k = `upd:${cur}`;
      if (!seen.has(k)) {
        seen.add(k);
        errors++;
        say(`UPDATE FAIL ${ACTS[cur].slug} @ local ${local.toFixed(2)}: ${err && err.stack || err}`);
      }
    }
  }

  // ---- seek test: jump backwards into the middle of every act ----
  for (let i = 0; i < ACTS.length; i++) {
    const t = ACTS[i].start + (ACTS[i].end - ACTS[i].start) * 0.6;
    try {
      if (cur >= 0 && insts[cur]) {
        insts[cur].exit?.(ctx);
        if (insts[cur].group.parent) scene.remove(insts[cur].group);
      }
      physics.reset();
      cur = i;
      scene.add(insts[i].group);
      insts[i].cues?.reset();
      insts[i].enter?.(ctx);
      const local = t - ACTS[i].start;
      insts[i].reseek?.(local, ctx);
      insts[i].cues?.tick(local);
      insts[i].update(local, STEP, ctx);
      physics.step(STEP);
      post.render(STEP, t);
    } catch (err) {
      errors++;
      say(`SEEK FAIL ${ACTS[i].slug}: ${err && err.stack || err}`);
    }
  }

  const info = renderer.info;
  say(`render: ${info.render.calls} calls, ${info.render.triangles} tris, geometries ${info.memory.geometries}, textures ${info.memory.textures}, programs ${info.programs.length}`);
  say(errors === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${errors})`);
} catch (err) {
  say(`FATAL: ${err && err.stack || err}`);
}
