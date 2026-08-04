import * as THREE from 'three';
import { Cues, ease, seg, eseg, clamp, lerp, rng, noise1 } from '../core/anim.js';
import { roundBrickGeo, PLATE_H } from '../core/legoParts.js';
import { rainCurtain } from '../fx/rain.js';

/**
 * TITLE
 *
 * The title assembles itself out of 1×1 round plates — one stud per pixel of
 * the word — flying in from the dark and clicking into place. It is the only
 * shot in the piece where the bricks go together instead of coming apart.
 */

const WORD = 'THE MATRIX';
const CREDITS = [
  ['THE MATRIX', 'title'],
  ['OPENING SEQUENCE · SCENES 1 – 11', 'sub'],
  ['SCREENPLAY BY LARRY & ANDY WACHOWSKI · REV. 3/9/98', 'small'],
  ['', 'gap'],
  ['REAL-TIME THREE.JS · CANNON-ES RIGID BODIES · WEB AUDIO', 'small'],
  ['CAST ENTIRELY FROM ACRYLONITRILE BUTADIENE STYRENE', 'small'],
  ['NO MINIFIGURE WAS PERMANENTLY DISASSEMBLED', 'small'],
];

/** One stud per lit pixel of the word, with a scattered start position. */
function buildTitle(scale = 0.62) {
  const px = 22;
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');
  c.font = `bold ${px}px ui-monospace, "Courier New", monospace`;
  const w = Math.ceil(c.measureText(WORD).width) + 2;
  cv.width = w;
  cv.height = Math.ceil(px * 1.5);
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${px}px ui-monospace, "Courier New", monospace`;
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(WORD, 1, cv.height / 2);
  const data = g.getImageData(0, 0, cv.width, cv.height).data;

  const targets = [];
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (data[(y * cv.width + x) * 4] > 120) {
        targets.push(new THREE.Vector3(
          (x - cv.width / 2) * scale,
          (cv.height / 2 - y) * scale,
          0,
        ));
      }
    }
  }

  const rand = rng(31337);
  const starts = targets.map(() => new THREE.Vector3(
    (rand() - 0.5) * 240,
    (rand() - 0.5) * 160,
    -180 - rand() * 420,
  ));
  const spins = targets.map(() => new THREE.Euler(
    (rand() - 0.5) * 22, (rand() - 0.5) * 22, (rand() - 0.5) * 22,
  ));
  const delays = targets.map((_, i) => {
    // Left to right, with enough jitter that it doesn't read as a wipe.
    const x = (targets[i].x + 40) / 80;
    return clamp(x, 0, 1) * 2.1 + rand() * 0.75;
  });

  const geo = roundBrickGeo(1, PLATE_H * 1.4, true).clone();
  geo.rotateX(Math.PI / 2);          // stud faces the camera
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0c2216,
    emissive: 0x2bff86,
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, targets.length);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  return { mesh, targets, starts, spins, delays, mat, count: targets.length };
}

function creditsPlane() {
  const cv = document.createElement('canvas');
  cv.width = 1400;
  cv.height = 620;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.textAlign = 'center';
  let y = 190;
  for (const [text, kind] of CREDITS) {
    if (kind === 'gap') { y += 46; continue; }
    if (kind === 'title') {
      g.font = 'bold 92px ui-monospace, monospace';
      g.fillStyle = 'rgba(190,255,215,0.95)';
      g.shadowColor = '#4dff90';
      g.shadowBlur = 30;
      g.letterSpacing = '26px';
      y += 20;
    } else if (kind === 'sub') {
      g.font = '30px ui-monospace, monospace';
      g.fillStyle = 'rgba(120,225,165,0.9)';
      g.shadowBlur = 14;
      g.letterSpacing = '12px';
      y += 84;
    } else {
      g.font = '23px ui-monospace, monospace';
      g.fillStyle = 'rgba(80,190,130,0.8)';
      g.shadowBlur = 8;
      g.letterSpacing = '6px';
      y += 48;
    }
    g.fillText(text, cv.width / 2, y);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 31),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  return mesh;
}

export default {
  slug: 'Title',
  start: 251,
  end: 265,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();

    const title = buildTitle(0.62);
    title.mesh.position.set(0, 6, 0);
    group.add(title.mesh);

    const credits = creditsPlane();
    credits.position.set(0, -6, 4);
    group.add(credits);

    const curtain = rainCurtain({ columns: 120, width: 220, height: 130, depth: 40, size: 22 });
    curtain.points.position.set(0, 10, -70);
    curtain.opacity = 0;
    group.add(curtain.points);

    // Enough light to catch the top of each stud, so they read as plastic and
    // not as glowing dots.
    const key = new THREE.DirectionalLight(0xbfffd8, 3.52);
    key.position.set(-30, 40, 60);
    group.add(key);
    const fill = new THREE.PointLight(0x2bff86, 450, 120, 2);
    fill.position.set(0, 6, 30);
    group.add(fill);
    group.add(new THREE.HemisphereLight(0x0d2a1a, 0x000000, 1.6));

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const e = new THREE.Euler();

    return {
      group, cues,

      enter(c) {
        c.camera.position.set(0, 4, 96);
        c.camera.lookAt(0, 5, 0);
        c.post.u.uGreen.value = 0.42;
        c.post.u.uVignette.value = 1.3;
        c.post.u.uScan.value = 0.25;
        c.post.u.uAberr.value = 0.7;
        c.post.bloom.strength = 0.69;
        curtain.opacity = 0;
        c.audio.cue('title');
      },

      exit(c) {
        c.audio.cue(null);
        c.post.u.uScan.value = 0;
        c.post.u.uGreen.value = 0.16;
        c.post.bloom.strength = 0.432;
      },

      update(t, dt, c) {
        curtain.update(t);
        curtain.opacity = eseg(t, 0.4, 4) * 0.22 - seg(t, 11, 14) * 0.16;

        /* ---------- the build ---------- */
        let landedNow = 0;
        for (let i = 0; i < title.count; i++) {
          const k = ease.outQuint(seg(t, 0.6 + title.delays[i], 2.0 + title.delays[i]));
          p.lerpVectors(title.starts[i], title.targets[i], k);
          // Overshoot and settle: the click.
          if (k > 0.86) {
            const o = Math.sin((k - 0.86) / 0.14 * Math.PI) * 0.5;
            p.z += o;
          }
          e.set(
            title.spins[i].x * (1 - k),
            title.spins[i].y * (1 - k),
            title.spins[i].z * (1 - k),
          );
          q.setFromEuler(e);
          const scale = 1 + (1 - k) * 0.4;
          s.set(scale, scale, scale);
          m.compose(p, q, s);
          title.mesh.setMatrixAt(i, m);
          if (k > 0.999) landedNow++;
        }
        title.mesh.instanceMatrix.needsUpdate = true;

        // Studs clicking home, in waves.
        for (const [ct, n] of [[1.2, 6], [1.7, 9], [2.2, 10], [2.7, 9], [3.2, 8], [3.8, 6], [4.4, 4]]) {
          cues.at(ct, 'click' + ct, (skip) => { if (!skip) c.audio.clatter(n, 0.4, 0.1); });
        }
        cues.at(4.9, 'set', (skip) => { if (!skip) { c.audio.pulse(0.42); c.audio.hum(0.1, 40); } });

        // Once assembled, the word breathes.
        const settled = seg(t, 4.6, 5.6);
        title.mat.emissiveIntensity = 0.55 + settled * (0.25 + 0.2 * Math.sin(t * 1.6))
          + noise1(t * 9) * 0.06 * settled;

        /* ---------- credits ---------- */
        credits.material.opacity = eseg(t, 6.4, 8.4) * (1 - seg(t, 12.2, 13.8));

        /* ---------- camera ---------- */
        // One slow push, then a lift away.
        const k1 = eseg(t, 0, 8, ease.ioCubic);
        const k2 = eseg(t, 9.5, 14, ease.io);
        c.camera.position.set(
          lerp(0, 0, k1),
          lerp(3.5, 5.5, k1) + k2 * 3,
          lerp(104, 74, k1) + k2 * 16,
        );
        c.camera.lookAt(0, lerp(6, 3.5, k1), 0);
        if (Math.abs(c.camera.fov - 38) > 0.01) {
          c.camera.fov = 38;
          c.camera.updateProjectionMatrix();
        }

        c.audio.hum(0.1 * (1 - seg(t, 11.5, 13.8)), 40);
        this.fade = seg(t, 13.0, 14.0);
      },
    };
  },
};
