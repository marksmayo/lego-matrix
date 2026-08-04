import * as THREE from 'three';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp, noise1, shake, handheld, rng } from '../core/anim.js';
import { move, jump, stand, route, follow } from '../core/actor.js';
import { roofDeck, facade, wall, railing, tiledFloor, streetLamp } from '../core/legoBuild.js';
import { minifig, disassemble } from '../core/minifig.js';
import { abs, glow, C } from '../core/materials.js';
import { brickGeo, tileGeo, instanced, BRICK_H } from '../core/legoParts.js';
import { Sparks, Smoke } from '../fx/particles.js';

/**
 * 9  EXT. ROOF
 *
 * "It is a dizzying chase up and over the dark plateaued landscape of rooftops
 * and sheer cliffs of brick."
 *
 * The gap is 40 feet. A minifigure is 40 mm tall and stands in for a 1.7 m
 * person, so the scale here is about 1:42 — which puts 40 feet at 36 studs.
 * That number is why this scene is laid out the way it is: the last roof is
 * exactly 36 units of nothing away, and you can see that it is too far.
 */

const ROOFS = [
  { x0: -64, x1: -12, y: 44, seed: 3, color: 0x585d5a },
  { x0: -8, x1: 30, y: 41, seed: 9, color: 0x4f544f },
  { x0: 34, x1: 62, y: 47, seed: 15, color: 0x5c5148, open: ['+x'] },
  { x0: 98, x1: 156, y: 44, seed: 21, color: 0x54595c, open: ['-x'] },  // 36 away
];

const CAM = [
  // Over the parapet with her, wide.
  { t: 0, pos: [-72, 52, 34], look: [-56, 46, 6], fov: 46 },
  { t: 2.6, pos: [-52, 50, 28], look: [-38, 46, 4], fov: 44, ease: ease.io },
  // Tracking alongside the run — camera out over the drop.
  { t: 5.0, pos: [-24, 48, 30], look: [-14, 45.5, 2], fov: 42, ease: ease.linear },
  { t: 7.4, pos: [4, 46, 28], look: [12, 43.5, 2], fov: 42, ease: ease.linear },
  // Low and ahead, so the last roof reads as far too far.
  { t: 9.6, pos: [46, 44.5, 22], look: [66, 46, 0], fov: 40, ease: ease.io },
  { t: 12.0, pos: [64, 50, 26], look: [92, 45, 0], fov: 34, ease: ease.io },
  // Her run-up, from behind and above the parapet line.
  { t: 13.8, pos: [42, 53, 14], look: [68, 48, 1], fov: 40, ease: ease.io },
  { t: 15.2, pos: [54, 52, 11], look: [78, 48, 0], fov: 46, ease: ease.out },
  // "From above, the ground seems to flow beneath her as she hangs in flight."
  // High and wide, so the drop under her stays in frame the whole way across.
  { t: 15.9, pos: [70, 64, 17], look: [74, 50, 1], fov: 52, ease: ease.io },
  { t: 17.4, pos: [93, 61, 15], look: [96, 46, 1], fov: 50, ease: ease.linear },
  // She lands, somersaults up, still running hard.
  { t: 18.3, pos: [112, 50, 20], look: [101, 45, 0], fov: 44, ease: ease.io },
  { t: 20.0, pos: [76, 50, 24], look: [58, 47, 2], fov: 40, ease: ease.io },
  // Brown duplicates the move exactly.
  { t: 22.0, pos: [86, 49, 22], look: [92, 45.5, 1], fov: 42, ease: ease.io },
  { t: 24.0, pos: [96, 52, 30], look: [104, 46, 0], fov: 44, ease: ease.io },
];

export default {
  slug: '9 · Ext. Roof',
  start: 179,
  end: 203,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const sparks = new Sparks(group, { max: 400, size: 0.3 });
    const smoke = new Smoke(group, { pool: 6, color: 0x8f9a9e, size: 6 });
    const rand = rng(1717);

    /* ---------------- the plateaued landscape ---------------- */
    for (const r of ROOFS) {
      const w = r.x1 - r.x0;
      const deck = roofDeck(w, 62, {
        color: r.color, parapet: 3, seed: r.seed, clutter: Math.max(1, (w / 22) | 0),
        // The 36-stud gap is a clean drop on both sides: she launches off the
        // edge of roof 3 and lands on the edge of roof 4, and a parapet there
        // is 3.6 units of brick to pass through.
        open: r.open || [],
      });
      deck.position.set((r.x0 + r.x1) / 2, r.y, 0);
      group.add(deck);
      // The cliff of brick below each roof.
      const f = facade(w, Math.round(r.y / BRICK_H) - 3, {
        color: 0x4e3a30, seed: r.seed + 50, litChance: 0.13, spacingX: 8, spacingY: 6,
        simple: true,
      });
      f.position.set((r.x0 + r.x1) / 2, 0, -31);
      group.add(f);
      const b = facade(w, Math.round(r.y / BRICK_H) - 3, {
        color: 0x45362e, seed: r.seed + 90, litChance: 0.1, spacingX: 8, spacingY: 6,
        simple: true,
      });
      b.position.set((r.x0 + r.x1) / 2, 0, 31);
      b.rotation.y = Math.PI;
      group.add(b);
      // The sheer wall facing the gap.
      for (const [x, ry] of [[r.x0, -Math.PI / 2], [r.x1, Math.PI / 2]]) {
        const s = facade(62, Math.round(r.y / BRICK_H) - 3, {
          color: 0x483a32, seed: r.seed + x, litChance: 0.06, spacingX: 10, spacingY: 7,
          simple: true,
        });
        s.position.set(x, 0, 0);
        s.rotation.y = ry;
        group.add(s);
      }
    }

    // The paved chasm at the bottom, 44 units down.
    group.add(tiledFloor(300, 90, { color: 0x2b2f31, seed: 44, tileSize: 6, y: 0 }));
    for (const x of [70, 84, 120]) {
      const l = streetLamp({ h: 15, arm: 4, intensity: 170 });
      l.position.set(x, 0, 18);
      group.add(l);
    }

    // Skyline. Distant blocks with lit windows, purely for depth.
    for (let i = 0; i < 14; i++) {
      const w = 20 + rand() * 40;
      const h = 20 + rand() * 46;
      const blk = facade(w, h | 0, {
        color: 0x33373c, seed: 200 + i, litChance: 0.3, spacingX: 7, spacingY: 5,
        simple: true,
      });
      blk.position.set(-160 + rand() * 460, 0, -120 - rand() * 260);
      blk.rotation.y = (rand() - 0.5) * 0.6;
      group.add(blk);
    }

    /* ---------------- light ---------------- */
    const amb = new THREE.HemisphereLight(0x33465e, 0x0c1014, 3.4);
    group.add(amb);
    const moon = new THREE.DirectionalLight(0xa8c8f5, 7.2);
    moon.position.set(-120, 140, 90);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 20;
    moon.shadow.camera.far = 400;
    moon.shadow.camera.left = -120;
    moon.shadow.camera.right = 120;
    moon.shadow.camera.top = 80;
    moon.shadow.camera.bottom = -40;
    moon.shadow.bias = -0.0022;
    group.add(moon, moon.target);
    // Sodium bounce off the city below.
    const bounce = new THREE.DirectionalLight(0xff9a4a, 2.2);
    bounce.position.set(40, -20, 60);
    group.add(bounce);

    /* ---------------- performers ---------------- */
    const tri = minifig('trinity', { shades3d: true });
    group.add(tri);
    const brown = minifig('agent');
    group.add(brown);
    const cops = [0, 1, 2, 3].map((i) => {
      const c = minifig('cop', {
        face: { skin: '#f2cd37', brow: i % 2 ? 'angry' : 'raised', mouth: 'shout', sweat: i > 1 },
      });
      group.add(c);
      return c;
    });

    /**
     * Her route across the first three roofs: run, jump, run, jump, run.
     * Each entry is [t0, t1, kind, from, to, apex].
     */
    const LEGS = [
      [0.0, 2.9, 'run', [-60, 44, 2], [-15, 44, 2]],
      [2.9, 3.7, 'jump', [-15, 44, 2], [-5, 41, 2], 6.6],
      [3.7, 6.9, 'run', [-5, 41, 2], [27, 41, 1.5]],
      [6.9, 7.8, 'jump', [27, 41, 1.5], [37, 47, 1.5], 7.6],
      [7.8, 10.4, 'run', [37, 47, 1.5], [58, 47, 1]],
      [10.4, 13.4, 'walk', [58, 47, 1], [55, 47, 1]],      // she stops, and looks
      [13.4, 15.3, 'run', [55, 47, 1], [61.0, 47, 1]],     // the run-up
    ];

    return {
      group, cues,

      enter(c) {
        c.physics.addGround(0);
        for (const r of ROOFS) {
          c.physics.addStatic([(r.x0 + r.x1) / 2, r.y - 0.5, 0], [r.x1 - r.x0, 1, 62]);
          // Parapets, so debris bounces off them and the clip checker can see
          // anything trying to run through one.
          const ph = 3 * BRICK_H;
          const open = r.open || [];
          if (!open.includes('-x')) c.physics.addStatic([r.x0 + 0.5, r.y + ph / 2, 0], [1, ph, 62]);
          if (!open.includes('+x')) c.physics.addStatic([r.x1 - 0.5, r.y + ph / 2, 0], [1, ph, 62]);
          c.physics.addStatic([(r.x0 + r.x1) / 2, r.y + ph / 2, -30.5], [r.x1 - r.x0, ph, 1]);
          c.physics.addStatic([(r.x0 + r.x1) / 2, r.y + ph / 2, 30.5], [r.x1 - r.x0, ph, 1]);
        }
        sparks.reset();
        c.scene.fog = new THREE.FogExp2(0x0b1219, 0.0011);
        c.post.u.uGreen.value = 0.17;
        c.post.u.uVignette.value = 1.0;
        c.post.bloom.strength = 0.396;
        c.audio.cue('chase');
      },

      exit(c) {
        c.scene.fog = null;
        c.audio.cue(null);
      },

      reseek() {
        for (const cop of cops) { cop.visible = true; }
      },

      update(t, dt, c) {
        /* ---------- Trinity ---------- */
        tri.visible = true;
        tri.neutral();
        let airborne = false;

        for (const [a, b, kind, from, to, apex] of LEGS) {
          if (t >= a && t < b) {
            if (kind === 'jump') {
              const j = jump(tri, t, a, b, from, to, { height: apex });
              airborne = j.airborne;
            } else if (kind === 'walk') {
              // "The cops slow, realizing they are about to see something
              // ugly." She doesn't slow. She stops, and measures it.
              const k = seg(t, a, a + 0.5);
              tri.position.set(lerp(from[0], to[0], ease.out(k)), from[1], from[2]);
              if (k < 1) tri.walk(t, { speed: 0.6 });
              else {
                tri.idle(t, { breath: 2.4 });
                // "...staring at some point beyond the other roof."
                tri.face(1, 0);
                tri.userData.rig.head.rotation.y = 0;
                tri.userData.rig.torso.rotation.x = -0.06;
              }
            } else {
              move(tri, t, a, b, from, to, { mode: 'run', speed: 1.5, e: ease.linear });
            }
          }
        }

        /* ---------- the 40-foot jump ---------- */
        // Held long, high and slow. Everything else in the scene stops.
        const BIG_A = 15.3, BIG_B = 17.9;
        if (t >= BIG_A && t < BIG_B) {
          const j = jump(tri, t, BIG_A, BIG_B, [61.0, 47, 1], [99.5, 44, 1], { height: 11, pose: false });
          airborne = true;
          const k = j.k;
          // "her body leveling into a dive" — she lays out flat, then reaches.
          const r = tri.userData.rig;
          tri.face(1, 0);
          r.torso.rotation.x = lerp(-0.5, 0.25, k);
          r.legL.rotation.x = lerp(-1.2, 0.2, k) - Math.sin(k * Math.PI) * 0.4;
          r.legR.rotation.x = lerp(-0.6, -0.1, k) + Math.sin(k * Math.PI) * 0.5;
          r.armL.rotation.x = lerp(-2.2, -1.0, k);
          r.armR.rotation.x = lerp(-1.6, -2.4, k);
          r.armL.rotation.z = 0.5;
          r.armR.rotation.z = -0.5;
          r.head.rotation.x = lerp(-0.2, 0.1, k);
        } else if (t >= BIG_B) {
          // "then hits, somersaulting up, still running hard."
          const roll = seg(t, BIG_B, BIG_B + 0.85);
          if (roll < 1) {
            tri.position.set(lerp(99, 108, roll), 44 + Math.sin(roll * Math.PI) * 0.9, 1);
            tri.rotation.x = -roll * Math.PI * 2;
            tri.rotation.y = Math.PI / 2;
            tri.crumple(Math.sin(roll * Math.PI) * 0.7);
          } else {
            tri.rotation.x = 0;
            move(tri, t, BIG_B + 0.85, 24, [108, 44, 1], [150, 44, 3], { mode: 'run', speed: 1.5, e: ease.linear });
          }
        }
        if (t < BIG_A) tri.rotation.x = 0;

        cues.at(15.3, 'launch', (skip) => {
          if (!skip) { c.audio.whoosh(1.2, 0.22); c.audio.riser(2.4); c.audio.silence(0.35); }
        });
        cues.at(BIG_B, 'land', (skip) => {
          if (skip) return;
          c.audio.crash(0.7);
          c.audio.clatter(6, 0.3, 0.14);
          sparks.emit(new THREE.Vector3(99, 44.4, 1), 26, {
            speed: 16, color: [0.6, 0.6, 0.55], ttl: 0.6, up: 0.5,
          });
          smoke.puff(new THREE.Vector3(99, 44.6, 1), { dur: 3, size: 6, vy: 1.4, opacity: 0.11 });
        });

        /* ---------- Agent Brown ---------- */
        // "Agent Brown, however, has the same unnatural grace."
        brown.visible = true;
        brown.neutral();
        const BLEGS = [
          [1.2, 4.0, 'run', [-62, 44, -3], [-15, 44, -3]],
          [4.0, 4.8, 'jump', [-15, 44, -3], [-5, 41, -3], 6.6],
          [4.8, 8.0, 'run', [-5, 41, -3], [27, 41, -2]],
          [8.0, 8.9, 'jump', [27, 41, -2], [37, 47, -2], 7.6],
          [8.9, 12.4, 'run', [37, 47, -2], [56, 47, -2]],
          [12.4, 19.6, 'wait', [56, 47, -2], [58, 47, -2]],
        ];
        for (const [a, b, kind, from, to, apex] of BLEGS) {
          if (t >= a && t < b) {
            if (kind === 'jump') jump(brown, t, a, b, from, to, { height: apex });
            else if (kind === 'wait') {
              brown.position.set(58, 47, -2);
              brown.face(1, 0);
              brown.idle(t * 0.5, { breath: 0.3 });
              // He is not out of breath. He is waiting for his turn.
            } else move(brown, t, a, b, from, to, { mode: 'run', speed: 1.45, e: ease.linear });
          }
        }
        // "...as Agent Brown duplicates the move exactly, landing, rolling
        // over a shoulder up onto one knee."
        if (t >= 19.6 && t < 22.1) {
          jump(brown, t, 19.6, 22.1, [61.0, 47, -2], [99.5, 44, -2], { height: 11, pose: false });
          const k = seg(t, 19.6, 22.1);
          const r = brown.userData.rig;
          brown.face(1, 0);
          r.torso.rotation.x = lerp(-0.4, 0.2, k);
          r.legL.rotation.x = lerp(-1.0, 0.3, k);
          r.legR.rotation.x = lerp(-0.5, -0.2, k);
          r.armL.rotation.x = lerp(-1.8, -0.9, k);
          r.armR.rotation.x = lerp(-1.4, -2.2, k);
        } else if (t >= 22.1) {
          const roll = seg(t, 22.1, 23.0);
          brown.position.set(lerp(99, 105, roll), 44, -2);
          brown.rotation.y = Math.PI / 2;
          if (roll < 0.7) {
            brown.rotation.x = -roll * Math.PI * 1.4;
            brown.crumple(Math.sin(roll * 1.4 * Math.PI) * 0.6);
          } else {
            // Up onto one knee. Perfectly composed. Suit undisturbed.
            brown.rotation.x = 0;
            brown.userData.rig.legR.rotation.x = 1.35;
            brown.userData.rig.legL.rotation.x = -0.3;
            brown.userData.rig.torso.rotation.x = -0.12;
            brown.position.y = 43.2;
          }
        }
        cues.at(22.1, 'brownLand', (skip) => { if (!skip) c.audio.crash(0.5); });

        /* ---------- "the wild jumps of the cops" ---------- */
        cops.forEach((cop, i) => {
          if (cop.userData.dismantled) return;
          const off = i * 0.42;
          const z = -8 - i * 3.2;
          const CLEGS = [
            [1.9 + off, 5.4 + off, 'run', [-62, 44, z], [-15, 44, z]],
            [5.4 + off, 6.5 + off, 'jump', [-15, 44, z], [-4, 41, z], 6.4],
            [6.5 + off, 10.2 + off, 'run', [-4, 41, z], [27, 41, z]],
            [10.2 + off, 11.4 + off, 'jump', [27, 41, z], [37.5, 47, z], 7.6],
            [11.4 + off, 13.6 + off, 'run', [37.5, 47, z], [52 - i * 2, 47, z]],
          ];
          cop.visible = true;
          cop.neutral();
          let handled = false;
          for (const [a, b, kind, from, to, apex] of CLEGS) {
            if (t >= a && t < b) {
              handled = true;
              if (kind === 'jump') {
                jump(cop, t, a, b, from, to, { height: apex });
                // Wild: arms and legs going in directions that will not help.
                const k = seg(t, a, b);
                const r = cop.userData.rig;
                r.armL.rotation.x = -2.6 - Math.sin(k * 9 + i) * 0.7;
                r.armR.rotation.x = -2.2 + Math.sin(k * 11 + i) * 0.9;
                r.armL.rotation.z = 0.9;
                r.armR.rotation.z = -1.1;
                r.legL.rotation.x = -1.4 + Math.sin(k * 13) * 0.8;
                r.legR.rotation.x = 1.2 - Math.sin(k * 12) * 0.9;
                r.torso.rotation.z = Math.sin(k * 7 + i) * 0.4;
              } else {
                move(cop, t, a, b, from, to, { mode: 'run', speed: 1.2 + i * 0.05, e: ease.linear });
                cop.userData.rig.torso.rotation.z = Math.sin(t * 6 + i) * 0.12;
              }
            }
          }
          if (!handled && t > 13.6 + off) {
            // "The cops slow, realizing they are about to see something ugly."
            cop.position.set(52 - i * 2, 47, z);
            cop.face(1, 0);
            cop.idle(t * 1.4 + i, { breath: 3 });
            const gape = seg(t, 17.9, 19.0);
            cop.userData.rig.head.rotation.x = -0.1 - gape * 0.2;
            cop.userData.rig.torso.rotation.x = 0.06 + gape * 0.08;
            if (t > 18.2) {
              // Slack-jawed, tracking something that just went 40 feet.
              cop.userData.rig.armL.rotation.x = -0.2;
              cop.userData.rig.armR.rotation.x = -0.15;
              cop.lookAtPoint(new THREE.Vector3(tri.position.x, tri.position.y + 4, tri.position.z));
            }
          }
          // One of them does not stick the second landing.
          if (i === 3) {
            cues.at(11.4 + off + 1.05, 'copFall', (skip) => {
              const o = cop.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2, 0));
              disassemble(cop, c.physics, { origin: o, force: skip ? 12 : 22, spin: 12 });
              if (!skip) {
                c.audio.clatter(9, 0.5, 0.2);
                c.audio.crash(0.3);
              }
            });
          }
        });

        cues.at(12.0, 'gotHer', (skip) => { if (!skip) c.audio.pulse(0.22); });
        cues.at(18.6, 'impossible', (skip) => { if (!skip) c.audio.pulse(0.3); });

        /* ---------- camera ---------- */
        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, 0.06);
        // Hand-held while running, locked off for the leap.
        const rough = (t > 15.2 && t < 18.2) ? 0.02 : 0.12;
        shake(c.camera, rough, t, 11);

        // Time gets thick for the jump: bloom and vignette lean in.
        const slow = (t > 15.3 && t < 17.9) ? Math.sin(seg(t, 15.3, 17.9) * Math.PI) : 0;
        c.post.bloom.strength = 0.396 + slow * 0.3;
        c.post.u.uVignette.value = 1.0 + slow * 0.5;
        c.post.u.uAberr.value = 0.22 + slow * 1.2;

        sparks.update(dt);
        smoke.update(dt);
      },
    };
  },
};
