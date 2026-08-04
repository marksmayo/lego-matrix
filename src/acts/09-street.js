import * as THREE from 'three';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp, noise1, shake, handheld, rng } from '../core/anim.js';
import { move, driveAlong, route, stand } from '../core/actor.js';
import { shatterInto } from '../core/physics.js';
import { street, sidewalk, facade, wall, streetLamp, tiledFloor, railing } from '../core/legoBuild.js';
import { phoneBooth, garbageTruck, dumpster, neonSign } from '../core/props.js';
import { minifig, pistol } from '../core/minifig.js';
import { abs, absTrans, chrome, glow, C } from '../core/materials.js';
import { brickGeo, tileGeo, plateGeo, instanced, BRICK_H, PLATE_H } from '../core/legoParts.js';
import { Sparks, Smoke, Flashes } from '../fx/particles.js';
import { GlyphField } from '../fx/rain.js';

/**
 * 11  EXT. STREET
 *
 * "The telephone booth." Wells and Lake, in a pool of white street light, with
 * a garbage truck coming for it.
 *
 * The booth is built as 5 separate plexiglas panels in an aluminium frame so
 * that when 26 tons of LEGO City refuse vehicle arrives, all of it can leave
 * independently. "SMASHING it to PLEXIGLAS PULP" is a stage direction the
 * physics solver is unusually well suited to.
 */

const BOOTH = new THREE.Vector3(0, 0, -15.5);
const PLEX = brickGeo(1, 1, PLATE_H);
const FRAME = brickGeo(1, 1, BRICK_H);

const CAM = [
  // Out of the alley, limping.
  { t: 0, pos: [-52, 4.6, -6], look: [-58, 4.0, -14], fov: 40 },
  { t: 2.6, pos: [-48, 4.2, -7], look: [-54, 3.6, -15], fov: 38, ease: ease.io },
  // Her eyeline down the block: the booth, in its pool of light.
  // Her eyeline down the block: the booth, in its pool of light. Kept off the
  // kerb line, because that is where the lamp posts are.
  { t: 3.6, pos: [-53.0, 5.6, -16.4], look: [-18, 5.4, -15.4], fov: 30, ease: ease.io },
  { t: 5.4, pos: [-50.0, 5.4, -16.4], look: [-10, 5.6, -15.2], fov: 26, ease: ease.io },
  // The truck, across the street, turning.
  { t: 7.0, pos: [44, 3.0, 26], look: [56, 4.0, 12], fov: 42, ease: ease.io },
  { t: 8.8, pos: [30, 2.4, 22], look: [18, 3.5, 8], fov: 44, ease: ease.io },
  // The race. Low, tracking her feet and the booth beyond.
  { t: 10.6, pos: [-26, 2.2, -11], look: [-6, 3.0, -15], fov: 44, ease: ease.linear },
  { t: 12.4, pos: [-14, 2.0, -10], look: [4, 3.0, -15], fov: 44, ease: ease.linear },
  // Headlights arcing at the booth "as if taking aim".
  { t: 13.6, pos: [-6, 6.0, -22], look: [14, 3.0, -8], fov: 40, ease: ease.io },
  { t: 15.0, pos: [-7.5, 5.0, -19.5], look: [0, 5.0, -15.5], fov: 34, ease: ease.io },
  // She answers the phone. Wide enough to hold her, the booth and what is
  // arriving behind it.
  { t: 16.2, pos: [-13.5, 7.0, -6.0], look: [-0.8, 5.4, -14.4], fov: 40, ease: ease.io },
  { t: 17.0, pos: [-13.0, 6.8, -6.4], look: [-0.8, 5.4, -14.6], fov: 38 },
  // Impact, from across the street.
  { t: 17.45, pos: [-18, 4.5, -1], look: [1, 4.0, -15], fov: 48, ease: ease.linear },
  { t: 19.0, pos: [-22, 6.0, 1], look: [0, 3.5, -15], fov: 46, ease: ease.io },
  // A black loafer steps down from the cab, driver's side, low.
  { t: 20.2, pos: [-14.0, 1.4, -16.5], look: [-5.0, 1.0, -13.0], fov: 36, ease: ease.io },
  // He inspects the wreckage. There is no body. Shot along the wall, down the
  // gap the truck left between its nose and the brick.
  { t: 21.8, pos: [-20.0, 5.4, -19.0], look: [-5.0, 3.4, -19.8], fov: 44, ease: ease.io },
  { t: 23.8, pos: [-17.0, 5.2, -19.4], look: [-4.6, 4.8, -19.9], fov: 34, ease: ease.io },
  { t: 26.2, pos: [-15.0, 5.2, -19.5], look: [-4.6, 4.8, -19.9], fov: 30 },
  // Agent Smith almost smiles.
  { t: 28.4, pos: [-13.0, 5.2, -19.6], look: [-4.6, 4.9, -19.8], fov: 26, ease: ease.io },
  { t: 30.4, pos: [-12.5, 5.3, -19.6], look: [-4.6, 5.0, -19.8], fov: 25 },
  { t: 32.0, pos: [-24, 16, -8], look: [-4, 3, -18], fov: 46, ease: ease.io },
];

export default {
  slug: '11 · Ext. Street',
  start: 219,
  end: 251,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const sparks = new Sparks(group, { max: 700, size: 0.28 });
    const smoke = new Smoke(group, { pool: 10, color: 0x9a9a92, size: 6 });
    const rand = rng(1109);

    /* ---------------- the block ---------------- */
    group.add(street(180, 60));
    const walk = sidewalk(180, { depth: 10, seed: 12 });
    walk.position.set(0, 0, -15);
    group.add(walk);
    const farWalk = sidewalk(180, { depth: 10, seed: 18 });
    farWalk.position.set(0, 0, 24);
    farWalk.rotation.y = Math.PI;
    group.add(farWalk);

    // The brick wall the booth gets bulldozed into.
    const block = facade(180, 34, {
      color: 0x6a4638, seed: 5, litChance: 0.13, spacingX: 8, spacingY: 6, startY: 4,
    });
    block.position.set(0, 0, -22);
    group.add(block);
    // Alley mouth she emerges from.
    const alleyDark = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), glow(0x05070a, 0.4));
    alleyDark.position.set(-58, 6, -21.6);
    group.add(alleyDark);
    const alleyWall = wall(180, 5, { color: 0x4c352c, seed: 6, openings: [[-58, 9, 0, 5 * BRICK_H]] });
    alleyWall.position.set(0, 0, -21.4);
    group.add(alleyWall);

    const across = facade(180, 30, { color: 0x4a4a54, seed: 27, litChance: 0.16, simple: true });
    across.position.set(0, 0, 30);
    across.rotation.y = Math.PI;
    group.add(across);

    // Street furniture. The lamp over the booth is the only white light here.
    const boothLamp = streetLamp({ h: 15, arm: 5, color: 0xf4f8ff, intensity: 260 });
    boothLamp.position.set(-6, 0, -13.5);
    boothLamp.rotation.y = -Math.PI / 2;
    group.add(boothLamp);
    for (const x of [-46, -24, 26, 52]) {
      const l = streetLamp({ h: 15, arm: 4.5, color: 0xffcf8a, intensity: 200 });
      l.position.set(x, 0, -13.5);
      l.rotation.y = -Math.PI / 2;
      group.add(l);
    }
    const bin = dumpster(0x2f4f6b);
    bin.position.set(-33, 0, -19.4);
    bin.rotation.y = 0.2;
    group.add(bin);
    const sign = neonSign('LAKE', { color: 0x44ddff, size: 1.6 });
    sign.position.set(-30, 11, -20.4);
    group.add(sign);

    /* ---------------- the booth ---------------- */
    const booth = phoneBooth();
    booth.position.copy(BOOTH);
    group.add(booth);
    const boothPool = new THREE.SpotLight(0xf6faff, 210, 40, Math.PI * 0.3, 0.6, 1.8);
    boothPool.position.set(-1, 14, -13);
    boothPool.target.position.copy(BOOTH);
    group.add(boothPool, boothPool.target);

    /* ---------------- the truck ---------------- */
    const truck = garbageTruck();
    truck.position.set(74, 0, 14);
    truck.rotation.y = -Math.PI / 2;
    group.add(truck);
    // The u-turn, then the run at the booth. It never stops accelerating.
    const truckPath = route([
      [74, 0, 14], [52, 0, 19], [34, 0, 21], [20, 0, 12],
      [12, 0, 4], [6, 0, -1], [2.4, 0, -4.4], [1.6, 0, -5.6],
    ], 0.42);

    /* ---------------- people ---------------- */
    const tri = minifig('trinity', { shades3d: true });
    group.add(tri);

    const agents = ['SMITH', 'JONES', 'BROWN'].map((n, i) => {
      const a = minifig('agent', {
        face: {
          skin: '#e8bb8c', shades: true, earpiece: true,
          mouth: i === 0 ? 'flat' : 'grim',
        },
      });
      a.visible = false;
      group.add(a);
      return a;
    });
    const [smith, jones, brown] = agents;

    /* ---------------- her way out ---------------- */
    // Not shown in the screenplay, and not shown here either — but the frame
    // gets one beat of green where she was.
    const exitRain = new GlyphField({
      columns: 26, perColumn: 12, width: 4, height: 12, depth: 3, size: 18, seed: 12,
    });
    exitRain.points.position.set(0, 3, -15.5);
    exitRain.opacity = 0;
    group.add(exitRain.points);

    /* ---------------- light ---------------- */
    const amb = new THREE.HemisphereLight(0x2c3a4e, 0x0a0c0e, 3.2);
    group.add(amb);
    const moon = new THREE.DirectionalLight(0x93b6e6, 4.4);
    moon.position.set(-60, 70, 60);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 8;
    moon.shadow.camera.far = 220;
    moon.shadow.camera.left = -70;
    moon.shadow.camera.right = 70;
    moon.shadow.camera.top = 50;
    moon.shadow.camera.bottom = -20;
    moon.shadow.bias = -0.002;
    group.add(moon, moon.target);

    let lastRing = -1;
    const wreck = { done: false };

    return {
      group, cues,

      enter(c) {
        c.physics.addGround(0);
        c.physics.addStatic([0, 5, -21.4], [180, 10, 2]);        // the brick wall
        c.physics.addStatic([0, -PLATE_H, -15], [180, 0.8, 10]);  // the footpath
        booth.visible = true;
        for (const p of booth.userData.panels) p.visible = true;
        booth.userData.sign.visible = true;
        for (const a of agents) a.visible = false;
        exitRain.opacity = 0;
        sparks.reset();
        wreck.done = false;
        lastRing = -1;
        c.scene.fog = new THREE.FogExp2(0x090f14, 0.0004);
        c.post.u.uGreen.value = 0.16;
        c.post.u.uVignette.value = 1.1;
        c.post.bloom.strength = 0.468;
        c.audio.cue('street');
      },

      exit(c) {
        c.scene.fog = null;
        c.audio.cue(null);
        c.audio.stopEngine();
        c.post.u.uWhite.value = 0;
      },

      reseek(t) {
        const after = t > 17.5;
        booth.visible = !after;
        if (after) for (const p of booth.userData.panels) p.visible = false;
      },

      update(t, dt, c) {
        sign.userData.panel.material.opacity = 0.7 + 0.3 * Math.abs(noise1(t * 4.4));
        exitRain.update(t);

        /* ---------- "as the PHONE begins to RING" ---------- */
        if (t > 5.0 && t < 16.5) {
          const idx = Math.floor((t - 5.0) / 1.15);
          if (idx !== lastRing) { lastRing = idx; c.audio.payphoneRing(); }
          booth.userData.sign.material.emissiveIntensity = 0.55 + (idx % 2 ? 0.35 : 0);
          booth.userData.lamp.intensity = 40 + (idx % 2 ? 22 : 0);
        }

        /* ---------- Trinity ---------- */
        tri.visible = t < 17.4;
        if (tri.visible) {
          tri.neutral();
          if (t < 3.4) {
            // "Trinity emerges from the shadows of an alley."
            move(tri, t, 0.2, 3.4, [-58, 0, -20], [-55, 0, -14.6], { mode: 'limp', speed: 0.85, face: false });
            tri.rotation.y = lerp(0, Math.PI * 0.5, seg(t, 2.2, 3.4));
          } else if (t < 5.4) {
            // She sees it.
            tri.position.set(-55, 0, -14.6);
            tri.rotation.y = Math.PI * 0.5;
            tri.limp(t, 0.2);
            tri.userData.rig.head.rotation.y = 0;
            tri.userData.rig.torso.rotation.z = 0.14;
          } else if (t < 15.4) {
            // "her pace quickening" — a limp that turns into a run it cannot
            // really sustain, which is the whole point of the shot.
            const urgency = seg(t, 5.4, 12.0);
            const legs = [
              [5.4, 9.0, [-55, 0, -14.6], [-32, 0, -14.8], 'limp'],
              [9.0, 15.4, [-32, 0, -14.8], [-1.2, 0, -14.2], 'run'],
            ];
            for (const [a, b, from, to, mode] of legs) {
              if (t >= a && t < b) {
                move(tri, t, a, b, from, to, { mode, speed: 0.9 + urgency * 0.7, e: ease.in, face: false });
              }
            }
            tri.rotation.y = Math.PI * 0.5;
            // Still favouring one side, arm clamped to her ribs.
            tri.userData.rig.armL.rotation.z = 0.42;
            tri.userData.rig.torso.rotation.z = 0.1 * (1 - urgency * 0.5);
          } else {
            // "slamming into the booth" — and reaching for the handset.
            const grab = seg(t, 15.4, 16.4);
            tri.position.set(lerp(-1.2, -0.2, ease.out(grab)), 0, lerp(-14.2, -14.6, grab));
            tri.rotation.y = Math.PI * 0.32;
            tri.crumple(0.2);
            const r = tri.userData.rig;
            r.armL.rotation.x = lerp(-0.4, -2.45, ease.outQuint(grab));
            r.armL.rotation.z = 0.5;
            r.armR.rotation.x = -0.8;
            r.torso.rotation.x = 0.18 - grab * 0.1;
            r.head.rotation.x = -0.1;
          }
        }

        /* ---------- the truck ---------- */
        // "Across the street, a garbage truck suddenly u-turns, it's TIRES
        // SCREAMING as it accelerates."
        const drive = driveAlong(truck, t, 6.6, 17.45, truckPath, { e: ease.inQuint, wheelR: 1.6, roll: 0.012 });
        if (t > 6.0 && t < 17.5) {
          const rev = seg(t, 6.6, 17.45);
          c.audio.engine(0.1 + rev * 0.16, 34 + rev * 58);
        } else if (t > 17.5) {
          c.audio.engine(0.04, 26);
        }
        for (const b of truck.userData.beams) {
          b.intensity = t > 6.0 && t < 18.4 ? 420 : 0;
        }
        cues.at(6.6, 'uturn', (skip) => {
          if (!skip) { c.audio.skid(1.6); c.audio.crash(0.2); }
        });
        cues.at(12.0, 'aim', (skip) => {
          // "as if taking aim"
          if (!skip) c.audio.pulse(0.3);
        });

        /* ---------- "She answers the phone." ---------- */
        cues.at(16.4, 'answer', (skip) => {
          const h = booth.userData.handset;
          h.rotation.z = 0.9;
          h.position.set(-0.6, 5.9, -1.2);
          if (!skip) c.audio.click(0.24);
        });
        // "There is a frozen instant of silence before the hulking mass of
        // dark metal lurches up onto the sidewalk."
        cues.at(16.75, 'frozen', (skip) => {
          if (!skip) { c.audio.silence(0.62); c.audio.cue(null); }
        });

        /* ---------- impact ---------- */
        cues.at(17.45, 'impact', (skip) => {
          if (wreck.done) return;
          wreck.done = true;
          tri.visible = false;
          booth.visible = false;

          if (skip) return;

          // Plexiglas pulp: every panel becomes a cloud of trans-clear 1×1s.
          for (const p of booth.userData.panels) {
            const wp = p.getWorldPosition(new THREE.Vector3());
            const box = new THREE.Box3(
              wp.clone().add(new THREE.Vector3(-2.2, -4.6, -0.4)),
              wp.clone().add(new THREE.Vector3(2.2, 4.6, 0.4)),
            );
            shatterInto(c.physics, group, PLEX, absTrans(0xcfe6ea, { opacity: 0.42 }), 26, box, {
              vel: [0, 8, -26], spread: 22, spin: 20, life: 14,
            });
          }
          // And the frame: aluminium bricks, bent round the wall.
          const fbox = new THREE.Box3(
            BOOTH.clone().add(new THREE.Vector3(-3, 0, -3)),
            BOOTH.clone().add(new THREE.Vector3(3, 11, 3)),
          );
          shatterInto(c.physics, group, FRAME, abs(0xb8bdb9, { metalness: 0.5 }), 34, fbox, {
            vel: [0, 10, -22], spread: 18, spin: 16, life: 16,
          });
          // Brick out of the wall behind it.
          const wbox = new THREE.Box3(
            new THREE.Vector3(-4, 1, -21.8), new THREE.Vector3(4, 9, -20.6),
          );
          shatterInto(c.physics, group, brickGeo(2, 1, BRICK_H), abs(0x6a4638), 22, wbox, {
            vel: [0, 6, -14], spread: 14, spin: 14, life: 16,
          });

          c.physics.burst([0, 4, -15.5], 70, 0.5, 16);
          c.audio.crash(1.35);
          c.audio.glass();
          c.audio.clatter(20, 1.1, 0.3);
          c.post.u.uWhite.value = 0.55;
          sparks.emit(new THREE.Vector3(0, 3, -16), 120, {
            speed: 40, color: [0.9, 0.95, 1.0], ttl: 0.9, up: 0.5,
          });
          for (let i = 0; i < 4; i++) {
            smoke.puff(new THREE.Vector3((rand() - 0.5) * 8, 1 + rand() * 5, -18 + rand() * 4), {
              dur: 4.5, size: 6, vy: 1.5, opacity: 0.055, spread: 2.0,
            });
          }
          // One green pulse where she was. Then nothing.
          exitRain.opacity = 1;
        });

        // The truck grinds to a halt in the wall.
        if (t >= 17.45) {
          const settle = seg(t, 17.45, 18.5);
          truck.position.set(lerp(1.6, 1.2, settle), 0, lerp(-5.6, -6.4, ease.out(settle)));
          truck.rotation.y = lerp(truck.rotation.y, Math.PI * 0.02, 0.2);
          truck.rotation.z = Math.sin(settle * 12) * 0.05 * (1 - settle);
        }
        exitRain.opacity = Math.max(0, exitRain.opacity - dt * 0.55);

        /* ---------- "Agent Smith inspects the wreckage." ---------- */
        if (t > 19.0) {
          smith.visible = true;
          // "a black loafer steps down from the cab of the garbage truck"
          const down = seg(t, 19.2, 20.6);
          if (down < 1) {
            smith.position.set(lerp(-4.2, -5.4, down), lerp(3.4, 0, ease.in(down)), lerp(-13.2, -12.6, down));
            smith.neutral();
            smith.rotation.y = -Math.PI * 0.55;
            smith.userData.rig.legR.rotation.x = lerp(0.9, 0, down);
            smith.userData.rig.legL.rotation.x = lerp(-0.4, 0, down);
            smith.userData.rig.armR.rotation.x = lerp(-1.6, -0.1, down);
          } else {
            move(smith, t, 20.6, 22.2, [-5.4, 0, -12.6], [-4.6, 0, -19.8], { mode: 'walk', speed: 0.6 });
            if (t > 22.2) {
              smith.position.set(-4.6, 0, -19.8);
              smith.neutral();
              // Facing the wreckage under the truck's front axle, but angled
              // enough that his profile is readable from down the gap.
              smith.face(-0.45, 1);
              smith.idle(t * 0.5, { breath: 0.3 });
              // Looking down into a pile of plastic that should contain a body.
              smith.userData.rig.head.rotation.x = 0.34;
              smith.userData.rig.head.rotation.y = 0.22;
              smith.userData.rig.torso.rotation.x = 0.12;
            }
          }
        }

        // "Agent Jones and Brown walk up behind him."
        if (t > 21.4) {
          jones.visible = true;
          brown.visible = true;
          // Up behind him, in a line down the gap, past him.
          move(jones, t, 21.4, 23.6, [-24, 0, -16.0], [-1.4, 0, -20.0], { mode: 'walk', speed: 0.6 });
          move(brown, t, 21.8, 24.2, [-26, 0, -17.6], [1.4, 0, -20.1], { mode: 'walk', speed: 0.6 });
          if (t > 23.8) {
            for (const a of [jones, brown]) {
              a.neutral();
              a.face(0.5, 1);
              a.idle(t * 0.45 + (a === brown ? 2 : 0), { breath: 0.3 });
            }
          }
        }

        // "His jaw sets as he grinds his molars in frustration." Then, on the
        // informant: "Agent Smith almost smiles." A minifigure's face is
        // printed and cannot change — so the performance is all in the head.
        if (t > 26.4) {
          const grind = seg(t, 26.6, 28.0);
          const smileTurn = eseg(t, 28.4, 30.2);
          smith.userData.rig.head.rotation.x = lerp(0.34, 0.0, smileTurn)
            + Math.sin(t * 22) * 0.012 * grind * (1 - smileTurn);
          // He turns to Brown, who is behind him — and therefore to camera.
          smith.userData.rig.head.rotation.y = lerp(0, -1.05, smileTurn);
          smith.userData.rig.head.rotation.z = lerp(0, 0.08, smileTurn);
          smith.userData.rig.torso.rotation.y = lerp(0, -0.34, smileTurn);
          smith.userData.rig.torso.rotation.x = lerp(0.12, 0.0, smileTurn);
        }
        cues.at(26.6, 'jaw', (skip) => { if (!skip) c.audio.pulse(0.24); });
        cues.at(28.4, 'smile', (skip) => { if (!skip) c.audio.pulse(0.34); });

        /* ---------- residue ---------- */
        if (t > 17.6 && t < 26 && Math.random() < dt * 0.9) {
          smoke.puff(new THREE.Vector3((Math.random() - 0.5) * 16, 0.6 + Math.random() * 3, -16 + Math.random() * 6), {
            dur: 4.5, size: 6, vy: 0.6, opacity: 0.028, spread: 1.0,
          });
        }
        c.post.u.uWhite.value *= Math.pow(0.0015, dt);
        c.post.bloom.strength = 0.468 + seg(t, 15.0, 17.45) * 0.28 * (1 - seg(t, 17.6, 19.5));

        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, 0.035);
        const rough = t > 17.4 && t < 18.3 ? 0.5 : t > 8 && t < 17.4 ? 0.09 : 0.02;
        shake(c.camera, rough, t, 18);

        sparks.update(dt);
        smoke.update(dt);
      },
    };
  },
};
