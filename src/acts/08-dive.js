import * as THREE from 'three';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp, noise1, shake, handheld, rng } from '../core/anim.js';
import { move, jump } from '../core/actor.js';
import { shatterInto } from '../core/physics.js';
import { roofDeck, facade, wall, stairs, tiledFloor, railing } from '../core/legoBuild.js';
import { minifig, pistol } from '../core/minifig.js';
import { glassPane } from '../core/props.js';
import { abs, absTrans, glow, GLOW, C } from '../core/materials.js';
import { brickGeo, tileGeo, plateGeo, instanced, BRICK_H, PLATE_H } from '../core/legoParts.js';
import { Sparks, Smoke } from '../fx/particles.js';

/**
 * 10  EXT. WINDOW  /  A10  INT. BACK STAIRWELL
 *
 * "A yellow glow in the midst of a dark brick building." The window is the
 * only warm thing in the entire sequence, and she is aiming at it from 50 feet
 * away with nothing underneath.
 *
 * Unlike the rooftop leap, this one does not go well. It is not supposed to.
 */

const WIN = new THREE.Vector3(0, 34, -9.6);
const GLASS = brickGeo(1, 1, PLATE_H);
const WOOD = brickGeo(2, 1, BRICK_H * 0.6);

const CAM = [
  // Running the last roof, camera behind and low.
  { t: 0, pos: [7, 41.5, 58], look: [1, 41, 40], fov: 44 },
  { t: 2.0, pos: [6, 41.5, 44], look: [0.5, 39, 22], fov: 42, ease: ease.linear },
  // Over her shoulder: her, the empty night space, and the one yellow window
  // on the far side of it, all in the same frame.
  { t: 3.1, pos: [3.0, 47.5, 38.0], look: [0.3, 35.5, -8.0], fov: 40, ease: ease.io },
  { t: 3.6, pos: [2.0, 45.5, 33.0], look: [0.3, 35.0, -8.0], fov: 44, ease: ease.io },
  // Coming straight at the glass.
  { t: 3.9, pos: [0, 34.6, -4.5], look: [0, 36, 24], fov: 52, ease: ease.io },
  { t: 5.0, pos: [0, 34.4, -6.6], look: [0, 35.4, 14], fov: 58, ease: ease.linear },
  // CUT — inside, looking back at the opening as it comes in.
  { t: 5.28, pos: [-6, 30, -20], look: [0.5, 33.5, -10], fov: 50, ease: ease.linear },
  { t: 6.3, pos: [-8, 26, -22], look: [0, 27, -18], fov: 46, ease: ease.io },
  // The tumble, from the bottom of the flight.
  { t: 7.3, pos: [-7, 15.5, -34], look: [0, 20, -24], fov: 44, ease: ease.io },
  { t: 8.6, pos: [-4.5, 15.0, -31], look: [0, 14.6, -28.5], fov: 36, ease: ease.io },
  // She wheels on the smashed opening above.
  { t: 9.6, pos: [-5.5, 15.4, -30], look: [0, 30, -12], fov: 40, ease: ease.io },
  { t: 11.0, pos: [-5.0, 16.0, -29], look: [0.5, 33.5, -10.5], fov: 34, ease: ease.io },
  // Wide: how small and how broken.
  { t: 12.4, pos: [-9.5, 20.0, -26], look: [0, 15.5, -28], fov: 46, ease: ease.io },
  // Up, and down the rest of the stairs.
  { t: 14.2, pos: [-6.0, 14.6, -30.5], look: [0, 14.4, -27], fov: 38, ease: ease.io },
  { t: 16.0, pos: [-5.0, 12.0, -36], look: [0, 11.5, -31], fov: 40, ease: ease.io },
];

/** Where she hits, and how hard: [time, y, z, force]. */
const BOUNCES = [
  [5.62, 30.2, -15.5, 1.0],
  [6.15, 26.4, -20.0, 0.75],
  [6.62, 22.6, -23.4, 0.6],
  [7.05, 19.0, -26.0, 0.5],
  [7.5, 16.2, -27.8, 0.35],
];

export default {
  slug: '10 · Window & Back Stairwell',
  start: 203,
  end: 219,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const sparks = new Sparks(group, { max: 420, size: 0.26 });
    const smoke = new Smoke(group, { pool: 8, color: 0x8b8578, size: 6 });
    const rand = rng(2020);

    /* ---------------- the roof she leaves ---------------- */
    const deck = roofDeck(30, 40, { color: 0x55595a, parapet: 3, seed: 33, clutter: 2 });
    deck.position.set(0, 40, 48);
    group.add(deck);
    const cliff = facade(30, 32, { color: 0x453930, seed: 34, litChance: 0.08, simple: true });
    cliff.position.set(0, 0, 28.4);
    group.add(cliff);

    /* ---------------- the dark brick building ---------------- */
    const host = facade(40, 46, {
      color: 0x3d3128, seed: 55, litChance: 0.04, spacingX: 9, spacingY: 7, startY: 4,
    });
    host.position.set(0, 0, -10);
    group.add(host);
    // The window itself: a hole in the coursing with warm light behind it.
    const holeWall = wall(40, 6, {
      color: 0x3d3128, seed: 56, openings: [[0, 6, 0, 6 * BRICK_H]],
    });
    holeWall.position.set(0, WIN.y - 3 * BRICK_H, -9.9);
    group.add(holeWall);

    const pane = glassPane(5.6, 6.4 * BRICK_H, { color: 0xffe0a0, opacity: 0.5 });
    pane.position.copy(WIN);
    group.add(pane);
    const warm = new THREE.Mesh(new THREE.PlaneGeometry(6, 7 * BRICK_H), glow(0xffca70, 4.5));
    warm.position.set(0, WIN.y, WIN.z - 0.6);
    group.add(warm);
    const winLight = new THREE.PointLight(0xffc477, 1400, 90, 2);
    winLight.position.set(0, WIN.y, WIN.z - 1.5);
    group.add(winLight);

    // "the fanged maw of broken glass" — revealed after the crash.
    const fangs = new THREE.Group();
    fangs.visible = false;
    for (let i = 0; i < 16; i++) {
      const h = 0.5 + rand() * 1.7;
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.28 + rand() * 0.2, h, 4),
        absTrans(0xd6e9ee, { opacity: 0.34 }),
      );
      const side = i % 2 ? 1 : -1;
      f.position.set(-2.6 + (i / 16) * 5.2, WIN.y + side * (3.2 - rand() * 0.7), WIN.z + 0.1);
      f.rotation.z = side > 0 ? Math.PI : 0;
      f.rotation.x = (rand() - 0.5) * 0.5;
      fangs.add(f);
    }
    group.add(fangs);

    /* ---------------- INT. BACK STAIRWELL ---------------- */
    const shaft = new THREE.Group();
    group.add(shaft);
    // Four walls of the shaft, open toward −X so the camera can see in.
    const shaftWalls = [
      [12, 0, -22, Math.PI / 2, 26],
      [0, 0, -36, 0, 26],
      [0, 0, -9.4, 0, 26],
    ];
    for (const [x, , z, ry, len] of shaftWalls) {
      const w = wall(len, 24, { color: 0x5a4c3e, seed: 70 + len, variation: 0.16, sootTop: 0.4 });
      w.position.set(x, 8, z);
      w.rotation.y = ry;
      shaft.add(w);
    }
    const backWall = wall(26, 24, { color: 0x53463a, seed: 71 });
    backWall.position.set(-12, 8, -22);
    backWall.rotation.y = Math.PI / 2;
    shaft.add(backWall);

    // Landing at the top, then the flight she comes down.
    const landing = new THREE.Mesh(plateGeo(16, 8), abs(0x6b5a48));
    landing.position.set(0, 31.4, -13);
    shaft.add(landing);
    const flight = stairs(14, { w: 14, rise: BRICK_H * 1.2, run: 1.15, color: 0x6b5a48 });
    flight.rotation.y = Math.PI;
    flight.position.set(0, 15.6, -16.6);
    shaft.add(flight);
    const bottom = new THREE.Mesh(plateGeo(16, 12), abs(0x60503f));
    bottom.position.set(0, 14.0, -30.4);
    shaft.add(bottom);
    const lower = stairs(10, { w: 14, rise: BRICK_H * 1.2, run: 1.15, color: 0x64533f });
    lower.rotation.y = Math.PI;
    lower.position.set(0, 10.0, -33.2);
    shaft.add(lower);
    const rail = railing(24, { h: 3, color: 0x3a3128, posts: 9 });
    rail.position.set(-6.4, 15.6, -22);
    rail.rotation.y = Math.PI / 2;
    shaft.add(rail);

    const bulb = new THREE.PointLight(0xffe2b0, 80, 40, 2);
    bulb.position.set(0, 30, -30);
    shaft.add(bulb);
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glow(0xffe6b8, 1.8));
    bulbMesh.position.copy(bulb.position);
    shaft.add(bulbMesh);

    const amb = new THREE.HemisphereLight(0x2c3646, 0x0b0d0e, 3.2);
    group.add(amb);
    const moon = new THREE.DirectionalLight(0x9fc0ee, 6.4);
    moon.position.set(-60, 90, 70);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 10;
    moon.shadow.camera.far = 220;
    moon.shadow.camera.left = -50;
    moon.shadow.camera.right = 50;
    moon.shadow.camera.top = 60;
    moon.shadow.camera.bottom = -10;
    group.add(moon, moon.target);

    /* ---------------- her ---------------- */
    const tri = minifig('trinity', { shades3d: true });
    group.add(tri);
    const gun = pistol();
    gun.visible = false;
    tri.hold(gun, 'R', { pos: [0, -0.3, 0.12] });

    return {
      group, cues,

      enter(c) {
        c.physics.addStatic([0, 39.5, 48], [30, 1, 40]);
        c.physics.addStatic([0, 13.6, -30], [16, 1, 14]);
        c.physics.addStatic([0, 30.9, -13], [16, 1, 8]);
        pane.visible = true;
        fangs.visible = false;
        gun.visible = false;
        sparks.reset();
        c.scene.fog = new THREE.FogExp2(0x0a1016, 0.0013);
        c.post.u.uGreen.value = 0.16;
        c.post.bloom.strength = 0.432;
        c.audio.cue('fall');
      },

      exit(c) {
        c.scene.fog = null;
        c.audio.cue(null);
        c.post.u.uWhite.value = 0;
      },

      reseek(t) {
        if (t > 5.3) { pane.visible = false; fangs.visible = true; }
      },

      update(t, dt, c) {
        bulbMesh.material.emissiveIntensity = 0.58 + noise1(t * 7) * 0.2;
        bulb.intensity = 70 + noise1(t * 7) * 20;
        winLight.intensity = 1400 * (1 - seg(t, 5.3, 6.0) * 0.6);
        warm.material.emissiveIntensity = 4.5 * GLOW * (1 - seg(t, 5.3, 6.0) * 0.5);

        tri.visible = true;
        tri.neutral();
        gun.visible = t > 9.4 && t < 13.6;

        /* ---------- the run-up ---------- */
        if (t < 2.9) {
          move(tri, t, 0, 2.9, [0, 40, 56], [0, 40, 31], { mode: 'run', speed: 1.55, e: ease.linear });
          tri.face(0, -1);
        }

        /* ---------- "Hurtles herself into the empty night space" ---------- */
        const DIVE_A = 2.9, DIVE_B = 5.3;
        if (t >= DIVE_A && t < DIVE_B) {
          const k = seg(t, DIVE_A, DIVE_B);
          // Flat, fast and dropping: nothing like the controlled rooftop leap.
          tri.position.set(
            0,
            lerp(40.6, WIN.y, ease.in(k)) + Math.sin(k * Math.PI) * 2.2,
            lerp(31, WIN.z + 1.2, k),
          );
          tri.rotation.y = Math.PI;
          tri.dive(k);
          // "as the whole world seems to spin on its axis"
          tri.rotation.z = k * k * 1.1;
          tri.rotation.x = k * 0.5;
        }
        cues.at(DIVE_A, 'launch', (skip) => { if (!skip) { c.audio.whoosh(1.8, 0.28); c.audio.riser(2.2); } });

        /* ---------- "an EXPLOSION of GLASS and WOOD" ---------- */
        cues.at(5.3, 'smash', (skip) => {
          pane.visible = false;
          fangs.visible = true;
          if (skip) return;
          const box = new THREE.Box3(
            new THREE.Vector3(WIN.x - 2.8, WIN.y - 3.4, WIN.z - 0.5),
            new THREE.Vector3(WIN.x + 2.8, WIN.y + 3.4, WIN.z + 0.5),
          );
          shatterInto(c.physics, group, GLASS, absTrans(0xd6e9ee, { opacity: 0.42 }), 46, box, {
            vel: [0, 2, -30], spread: 16, spin: 18, life: 9,
          });
          shatterInto(c.physics, group, WOOD, abs(0x6b4a2f), 14, box, {
            vel: [0, 3, -26], spread: 13, spin: 14, life: 9,
          });
          c.audio.glass();
          c.audio.crash(0.9);
          sparks.emit(WIN.clone(), 50, { speed: 26, color: [0.85, 0.95, 1.0], ttl: 0.7, up: 0.4 });
          smoke.puff(WIN.clone().add(new THREE.Vector3(0, 0, -3)), { dur: 4, size: 6, vy: 1.2, opacity: 0.11 });
          c.post.u.uWhite.value = 0.5;
        });

        /* ---------- "tumbling, bouncing down stairs bleeding, broken" ---------- */
        if (t >= 5.3 && t < 7.9) {
          const k = seg(t, 5.3, 7.9);
          // Piecewise fall down the flight, hitting the treads.
          let y = 33.6, z = -11.5;
          for (let i = 0; i < BOUNCES.length; i++) {
            const [bt, by, bz] = BOUNCES[i];
            const prev = i === 0 ? [5.3, 33.6, -11.5] : BOUNCES[i - 1];
            if (t >= prev[0] && t < bt) {
              const s = seg(t, prev[0], bt);
              y = lerp(prev[1], by, ease.in(s)) + Math.sin(s * Math.PI) * (1.6 - i * 0.25);
              z = lerp(prev[2], bz, s);
              break;
            }
            y = by; z = bz;
          }
          tri.position.set(0, y + 1.2, z);
          tri.rotation.y = Math.PI;
          tri.rotation.x = -k * Math.PI * 3.4;
          tri.rotation.z = Math.sin(k * 9) * 0.4;
          tri.crumple(0.55 + Math.sin(k * 14) * 0.3);
        }
        for (const [bt, by, bz, force] of BOUNCES) {
          cues.at(bt, 'bounce' + bt, (skip) => {
            if (skip) return;
            c.audio.crash(0.28 * force);
            c.audio.clatter(3, 0.12, 0.1 * force);
            sparks.emit(new THREE.Vector3(0, by + 0.5, bz), 8, {
              speed: 10, color: [0.6, 0.25, 0.2], ttl: 0.4, up: 0.6,
            });
            c.post.u.uWhite.value = Math.max(c.post.u.uWhite.value, 0.12 * force);
          });
        }

        /* ---------- "But still alive." ---------- */
        if (t >= 7.9) {
          tri.rotation.x = 0;
          tri.rotation.z = 0;
          const rest = eseg(t, 7.9, 9.4);

          if (t < 9.4) {
            // Face down on the bottom landing, not moving much.
            tri.position.set(0, 14.6, -28.4);
            tri.rotation.y = Math.PI * 0.8;
            tri.crumple(1 - rest * 0.25);
            const gasp = Math.sin(t * 6.5);
            tri.userData.rig.torso.rotation.x = 0.85 + gasp * 0.12;
          } else if (t < 13.6) {
            // "She wheels on the smashed opening above, her gun instantly in
            // her hand, trained, waiting for Agent Brown."
            const wheel = eseg(t, 9.4, 10.1, ease.outQuint);
            tri.position.set(0, 14.6, -28.4);
            tri.rotation.y = lerp(Math.PI * 0.8, Math.PI * 0.04, wheel);
            tri.crumple(lerp(0.75, 0.42, wheel));
            const r = tri.userData.rig;
            // Aiming up at the opening, from her knees.
            r.armR.rotation.x = lerp(-0.4, -2.05, wheel);
            r.armL.rotation.x = lerp(-0.5, -1.95, wheel);
            r.armR.rotation.z = -0.18;
            r.armL.rotation.z = 0.22;
            r.head.rotation.x = lerp(0.2, -0.42, wheel);
            const hold = Math.sin(t * 8) * 0.02 * (1 + seg(t, 11, 13.6));
            r.torso.rotation.z += hold;
            // "Everything hurts." The gun arm starts to shake.
            if (t > 11.4) {
              const tremor = seg(t, 11.4, 13.6);
              r.armR.rotation.x += Math.sin(t * 19) * 0.05 * tremor;
              r.torso.rotation.x += Math.sin(t * 5) * 0.06 * tremor;
            }
          } else {
            // "She stands and limps down the rest of the stairs."
            const up = eseg(t, 13.6, 14.9);
            if (t < 14.9) {
              tri.position.set(0, lerp(14.6, 14.6, up), -28.4);
              tri.rotation.y = Math.PI * 0.04;
              tri.crumple(lerp(0.42, 0.12, up));
              const r = tri.userData.rig;
              r.armR.rotation.x = lerp(-2.05, -0.7, up);
              r.armL.rotation.x = lerp(-1.95, -0.3, up);
              r.head.rotation.x = lerp(-0.42, 0.1, up);
            } else {
              // Down the treads rather than through them: two short legs
              // along the flight instead of one straight line.
              if (t < 15.45) {
                move(tri, t, 14.9, 15.45, [0, 14.6, -28.4], [0, 14.2, -30.6], {
                  mode: 'limp', speed: 0.9, e: ease.io, face: false,
                });
              } else {
                move(tri, t, 15.45, 16.0, [0, 14.2, -30.6], [0, 12.4, -33.2], {
                  mode: 'limp', speed: 0.9, e: ease.linear, face: false,
                });
              }
              tri.rotation.y = Math.PI;
            }
          }
        }

        cues.at(8.6, 'stillAlive', (skip) => { if (!skip) c.audio.pulse(0.3); });
        // "...but is met by only a slight WIND that HISSES against the fanged
        // maw of broken glass."
        cues.at(10.4, 'wind', (skip) => { if (!skip) c.audio.whoosh(2.6, 0.09); });
        cues.at(12.6, 'wind2', (skip) => { if (!skip) c.audio.whoosh(3.0, 0.07); });
        cues.at(13.6, 'getUp', (skip) => { if (!skip) c.audio.pulse(0.34); });

        if (t > 5.4 && Math.random() < dt * 0.8) {
          smoke.puff(new THREE.Vector3((Math.random() - 0.5) * 6, 16 + Math.random() * 12, -18 - Math.random() * 10), {
            dur: 4.5, size: 6, vy: 0.5, opacity: 0.05,
          });
        }

        c.post.u.uWhite.value *= Math.pow(0.0008, dt);
        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, 0.04);
        shake(c.camera, t < 5.3 ? 0.09 : t < 8 ? 0.16 : 0.02, t, 14);

        sparks.update(dt);
        smoke.update(dt);
      },
    };
  },
};
