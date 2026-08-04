import * as THREE from 'three';
import { hotelSet } from '../sets/hotel.js';
import { Cues, camKeys, ease, seg, eseg, lerp, noise1, shake, handheld, rng } from '../core/anim.js';
import { move } from '../core/actor.js';
import { brickGeo, plateGeo, tileGeo, roundBrickGeo, instanced, BRICK_H } from '../core/legoParts.js';
import { abs, C } from '../core/materials.js';
import { handset, flashlight, pistol } from '../core/minifig.js';
import { Smoke, lightCone } from '../fx/particles.js';

/**
 * 6  INT. HEART O' THE CITY HOTEL
 *
 * "Trinity is on the phone, pacing." The room she is pacing in is now ankle
 * deep in other people's parts. Two torches are still on, lying where they
 * fell, throwing her shadow up the soot on the wall.
 */

// She paces the lane x −7…−1, z 1…6. Every one of these sits outside it.
const CAM = [
  { t: 0, pos: [-16.0, 5.6, 6.5], look: [-5.0, 4.3, 3.0], fov: 36 },
  { t: 3.0, pos: [-15.0, 5.4, 9.2], look: [-4.0, 4.3, 3.6], fov: 34, ease: ease.io },
  { t: 6.2, pos: [-1.6, 5.2, 13.0], look: [-4.2, 4.4, 3.4], fov: 30, ease: ease.io },
  { t: 10.4, pos: [-2.4, 5.0, 12.0], look: [-4.2, 4.4, 3.2], fov: 28 },
  // High and wide: the floor of the room is other people's parts.
  { t: 12.6, pos: [-14.5, 8.4, 12.5], look: [-4.5, 3.4, 3.4], fov: 42, ease: ease.io },
  { t: 15.2, pos: [-9.8, 4.9, 9.6], look: [-3.8, 4.5, 3.7], fov: 30, ease: ease.io },
  { t: 19.4, pos: [-8.8, 4.9, 9.0], look: [-3.7, 4.55, 3.6], fov: 27, ease: ease.io },
  { t: 21.0, pos: [-8.2, 4.8, 8.6], look: [-3.7, 4.5, 3.6], fov: 26 },
  // She drops the phone.
  { t: 22.4, pos: [-7.2, 2.6, 8.2], look: [-3.5, 0.9, 4.0], fov: 34, ease: ease.io },
  { t: 23.0, pos: [-6.8, 2.2, 7.8], look: [-3.4, 0.7, 3.9], fov: 34 },
];

export default {
  slug: '6 · Operator',
  start: 142,
  end: 165,

  build(ctx) {
    const set = hotelSet();
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const smoke = new Smoke(group, { pool: 12, color: 0x7a827a, size: 7 });
    const rand = rng(6161);

    /* ---------------- the aftermath, made permanent ---------------- */
    // Physics debris is cleared between scenes, so the mess is re-laid as
    // static geometry: the same bricks, now at rest.
    const litter = { brick: [], plate: [], chip: [], round: [] };
    for (let i = 0; i < 120; i++) {
      const x = -14 + rand() * 26;
      const z = -6 + rand() * 20;
      const y = 0.42 + (rand() < 0.12 ? BRICK_H : 0);
      const ry = rand() * Math.PI * 2;
      const kind = rand();
      const col = kind < 0.5
        ? [0x8f8778, 0x7d7466, 0x5b3f2f][(rand() * 3) | 0]     // door and wall
        : [0x1d2b3a, 0x1a2634, 0xf2cd37][(rand() * 3) | 0];    // uniforms and hands
      const bucket = kind < 0.3 ? 'brick' : kind < 0.55 ? 'plate' : kind < 0.85 ? 'chip' : 'round';
      litter[bucket].push([x, y, z, ry, col]);
    }
    group.add(instanced(brickGeo(2, 1, BRICK_H), abs(0x8f8778), litter.brick));
    group.add(instanced(plateGeo(2, 2), abs(0x8f8778), litter.plate));
    group.add(instanced(brickGeo(1, 1, BRICK_H), abs(0x8f8778), litter.chip));
    group.add(instanced(roundBrickGeo(1, 0.4, false), abs(C.darkRed), litter.round));

    // Two torches still burning on the floor, one of them rocking to a stop.
    const torches = [0, 1].map((i) => {
      const tor = flashlight();
      tor.position.set(i ? 6.4 : -8.2, 0.35, i ? 11.2 : 8.6);
      tor.rotation.set(Math.PI / 2, i ? 2.1 : -0.7, 0);
      const beam = new THREE.SpotLight(0xfff2d8, 600, 54, Math.PI * 0.2, 0.5, 1.5);
      beam.position.set(0, 0, 1.3);
      beam.target.position.set(0, 0, 24);
      tor.add(beam, beam.target);
      const cone = lightCone(16, 1.5, 0xfff0d4, 0.045);
      tor.add(cone);
      group.add(tor);
      return { tor, beam };
    });

    // Four police caps, four pairs of legs, and a pistol nobody is holding.
    const strays = [];
    for (let i = 0; i < 4; i++) {
      const g = pistol();
      g.position.set(-10 + rand() * 20, 0.3, 2 + rand() * 12);
      g.rotation.set(Math.PI / 2 * (rand() < 0.5 ? 1 : -1), rand() * 6, rand() * 0.4);
      group.add(g);
      strays.push(g);
    }

    const phone = handset();

    return {
      group, cues,

      enter(c) {
        c.scene.add(set.group);
        set.reset();
        set.addColliders(c.physics);
        // The cops do not get up.
        set.cops.forEach((cop, i) => {
          cop.visible = false;
          set.copProps[i].beam.intensity = 0;
          set.copProps[i].cone.visible = false;
        });
        set.door303.userData.slab.visible = false;
        set.desk.userData.chair.visible = false;
        phone.userData.released = false;
        if (!phone.parent) set.trinity.hold(phone, 'L', { pos: [0, -0.3, 0.1], rot: [1.35, 0, 0] });
        phone.visible = true;
        c.post.u.uGreen.value = 0.14;
        c.post.u.uVignette.value = 1.25;
        c.post.bloom.strength = 0.42;
      },

      exit(c) {
        c.scene.remove(set.group);
        if (phone.parent) phone.parent.remove(phone);
      },

      update(t, dt, c) {
        set.tickLights(t + 60);
        const tri = set.trinity;
        const r = tri.userData.rig;

        torches.forEach((x, i) => {
          x.beam.intensity = 600 * (i ? 0.9 + 0.1 * noise1(t * 2 + i) : 0.55 + 0.45 * Math.abs(noise1(t * 9)));
        });
        if (Math.random() < dt * 1.1) {
          smoke.puff(new THREE.Vector3(-6 + Math.random() * 16, 1.5, 4 + Math.random() * 10), {
            dur: 8, size: 8, vy: 0.5, opacity: 0.07, spread: 0.5,
          });
        }

        /* ---------- pacing ---------- */
        // Four lengths of the same six feet of carpet. She never stops moving
        // until Morpheus tells her to focus.
        tri.visible = true;
        tri.neutral();
        const PACE = [
          [0.0, 2.6, [-1.4, 0, 6.0], [-6.6, 0, 1.4]],
          [2.9, 5.4, [-6.6, 0, 1.4], [-1.0, 0, 5.6]],
          [5.7, 8.4, [-1.0, 0, 5.6], [-6.8, 0, 1.0]],
          [8.7, 11.2, [-6.8, 0, 1.0], [-1.2, 0, 5.2]],
          [11.5, 14.0, [-1.2, 0, 5.2], [-6.4, 0, 1.6]],
        ];
        let paced = false;
        for (const [a, b, from, to] of PACE) {
          if (t >= a && t < b) {
            move(tri, t, a, b, from, to, { mode: 'walk', speed: 1.15, e: ease.io });
            paced = true;
          }
        }
        if (!paced && t < 14.6) {
          // Turning on the spot between lengths.
          tri.position.set(-6.4, 0, 1.6);
          tri.idle(t, { breath: 1.4 });
        }
        // The phone hand stays at her ear the whole time.
        r.armL.rotation.x = -2.35;
        r.armL.rotation.z = 0.42;
        r.handL.rotation.x = 0.5;

        /* ---------- the call ---------- */
        cues.at(0.6, 'dial', (skip) => { if (!skip) { c.audio.click(0.18); c.audio.payphoneRing(); } });
        cues.at(1.5, 'answered', (skip) => { if (!skip) c.audio.click(0.12); });

        // "Morpheus! The line was traced!" — she gestures with the free hand.
        const urgent = seg(t, 3.0, 6.1);
        if (urgent > 0 && urgent < 1) {
          const g = Math.sin(t * 7.6);
          r.armR.rotation.x = -0.9 - g * 0.5;
          r.armR.rotation.z = -0.35;
          r.torso.rotation.y = -0.12 + g * 0.1;
        }
        // "Goddamnit!" — a fist into her own thigh.
        const swear = seg(t, 14.0, 14.9);
        if (swear > 0 && swear < 1) {
          const s = Math.sin(swear * Math.PI);
          r.armR.rotation.x = -1.1 * s;
          r.torso.rotation.x = -0.1 - s * 0.2;
          r.head.rotation.x = s * 0.22;
        }

        /* ---------- "You have to focus." ---------- */
        if (t >= 14.6) {
          tri.position.set(-3.6, 0, 3.6);
          tri.rotation.y = 0.24;
        }
        // "She takes a deep breath, centering herself." One long inhale, and
        // for the first time in the scene the minifigure is completely still.
        const breathe = seg(t, 16.0, 20.2);
        if (breathe > 0) {
          const inhale = Math.sin(seg(t, 17.2, 19.6) * Math.PI);
          r.torso.position.y = 2.2 + inhale * 0.14;
          r.torso.rotation.x = -0.02 - inhale * 0.06;
          r.head.rotation.x = lerp(0.1, -0.05, breathe);
          r.armR.rotation.x = lerp(-0.2, 0, breathe);
        }
        cues.at(17.2, 'inhale', (skip) => { if (!skip) c.audio.whoosh(1.5, 0.05); });

        /* ---------- "Go." / "She drops the phone." ---------- */
        cues.at(22.0, 'drop', (skip) => {
          if (skip) { phone.visible = false; return; }
          c.physics.release(phone, {
            size: [0.4, 0.4, 1.3], mass: 0.05, life: 12,
            vel: [0.6, 0.4, 1.2], spin: 5,
          });
          c.audio.clatter(3, 0.25, 0.14);
          c.audio.pulse(0.3);
        });
        if (t > 22.0 && t < 22.4) {
          r.armL.rotation.x = lerp(-2.35, -0.4, seg(t, 22.0, 22.4));
        } else if (t >= 22.4) {
          r.armL.rotation.x = -0.3;
          r.armL.rotation.z = 0.1;
        }

        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, 0.035);
        shake(c.camera, t > 21.8 ? 0.05 : 0.014, t, 7);
        smoke.update(dt);
      },
    };
  },
};
