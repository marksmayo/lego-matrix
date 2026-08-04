import * as THREE from 'three';
import { hotelSet } from '../sets/hotel.js';
import { Cues, camKeys, ease, seg, eseg, lerp, noise1, shake, handheld, rng } from '../core/anim.js';
import { move, jump, route, follow } from '../core/actor.js';
import { shatterInto } from '../core/physics.js';
import { brickGeo, tileGeo, BRICK_H, PLATE_H } from '../core/legoParts.js';
import { abs, absTrans, glow, C } from '../core/materials.js';
import { wall, facade, fireEscape, railing, tiledFloor } from '../core/legoBuild.js';
import { minifig, flashlight } from '../core/minifig.js';
import { glassPane, dumpster } from '../core/props.js';
import { Sparks, Smoke, lightCone } from '../fx/particles.js';

/**
 * 7  INT. HALL  /  8  EXT. FIRE ESCAPE
 *
 * "She bursts out of the room as Agent Brown enters the hall... Trinity races
 * to the opposite end, exiting through a broken window onto the fire escape."
 *
 * Two locations in one scene, so the alley is built 300 units away and we cut
 * to it. Cheaper than swapping sets, and nothing in frame can tell.
 */

const ALLEY_X = 300;
const GLASS = brickGeo(1, 1, PLATE_H);

const CAM = [
  // Wide down the hall: her out of 303, Brown in at the far end.
  { t: 0, pos: [10.0, 6.0, 21.5], look: [-2.0, 4.6, 19.0], fov: 44 },
  { t: 1.6, pos: [12.0, 5.6, 21.8], look: [-6.0, 4.4, 20.0], fov: 46, ease: ease.io },
  // Running at camera, camera retreating.
  { t: 3.2, pos: [24.0, 5.2, 21.6], look: [8.0, 4.4, 21.0], fov: 42, ease: ease.linear },
  { t: 4.6, pos: [22.0, 5.6, 25.6], look: [30.0, 4.8, 21.2], fov: 42, ease: ease.io },
  // Through the window, from back down the corridor: the wall stays a wall
  // and the opening she is aiming at stays in shot.
  { t: 5.3, pos: [19.0, 6.0, 25.4], look: [33.5, 5.4, 21.2], fov: 46, ease: ease.io },

  // CUT — the fire escape. She lands hard on the grating.
  { t: 5.55, pos: [ALLEY_X + 12, 12.0, 14.0], look: [ALLEY_X + 2.0, 9.5, 4.0], fov: 44, ease: ease.linear },
  { t: 7.2, pos: [ALLEY_X + 9.0, 10.5, 11.0], look: [ALLEY_X + 1.0, 9.0, 3.5], fov: 38, ease: ease.io },
  // She looks down. Smith is in the alley at z = 13.5, looking straight up.
  { t: 8.4, pos: [ALLEY_X + 5.0, 9.2, 8.2], look: [ALLEY_X + 1.6, 1.2, 13.2], fov: 42, ease: ease.io },
  // Reverse: from beside him, up the fire escape at her.
  { t: 9.8, pos: [ALLEY_X + 6.5, 2.4, 11.5], look: [ALLEY_X + 1.2, 9.8, 4.2], fov: 46, ease: ease.io },
  // "She can only go up."
  { t: 11.4, pos: [ALLEY_X + 10.0, 14.0, 12.0], look: [ALLEY_X + 1.0, 16.0, 3.0], fov: 42, ease: ease.io },
  { t: 14.0, pos: [ALLEY_X + 16.0, 26.0, 20.0], look: [ALLEY_X + 1.0, 34.0, 3.0], fov: 48, ease: ease.io },
];

export default {
  slug: '7 · Hall & Fire Escape',
  start: 165,
  end: 179,

  build(ctx) {
    const set = hotelSet();
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const sparks = new Sparks(group, { max: 300, size: 0.24 });
    const smoke = new Smoke(group, { pool: 10, color: 0x8a9088, size: 7 });
    const rand = rng(717);

    /* ---------------- the end of the hall ---------------- */
    const endWall = wall(13, set.COURSES, {
      color: 0x7d7466, seed: 88, sootTop: 0.7,
      openings: [[0, 5, 4 * BRICK_H, 5 * BRICK_H]],
    });
    endWall.position.set(36, 0, (set.HALL_Z0 + set.HALL_Z1) / 2);
    endWall.rotation.y = Math.PI / 2;
    group.add(endWall);

    const hallPane = glassPane(4.8, 5.4 * BRICK_H, { opacity: 0.18 });
    hallPane.rotation.y = Math.PI / 2;
    hallPane.position.set(35.8, 4 * BRICK_H + 2.6 * BRICK_H, (set.HALL_Z0 + set.HALL_Z1) / 2);
    group.add(hallPane);
    // Night beyond it, so the window reads as an exit and not a picture.
    const night = new THREE.Mesh(new THREE.PlaneGeometry(5, 5.4 * BRICK_H), glow(0x1a2b3c, 0.9));
    night.rotation.y = -Math.PI / 2;
    night.position.set(36.6, hallPane.position.y, hallPane.position.z);
    group.add(night);

    /* ---------------- Brown and the second unit ---------------- */
    const brown = minifig('agent');
    group.add(brown);
    const unit = [0, 1, 2].map((i) => {
      const u = minifig('cop', {
        face: { skin: '#f2cd37', brow: 'angry', mouth: 'shout', sweat: i === 1 },
      });
      const t = flashlight();
      u.hold(t, 'L', { pos: [0, -0.3, 0.1] });
      const cone = lightCone(16, 1.4, 0xfff2d0, 0.05);
      t.add(cone);
      if (i === 0) {
        const beam = new THREE.SpotLight(0xfff2d8, 550, 60, Math.PI * 0.17, 0.45, 1.5);
        beam.position.set(0, 0, 1.3);
        beam.target.position.set(0, 0, 30);
        t.add(beam, beam.target);
      }
      group.add(u);
      return u;
    });

    /* ---------------- 8  EXT. FIRE ESCAPE ---------------- */
    const alley = new THREE.Group();
    alley.position.x = ALLEY_X;
    group.add(alley);

    // Two brick cliffs and a strip of ground between them.
    const near = facade(46, 46, { color: 0x5e4034, seed: 61, litChance: 0.08, spacingX: 8 });
    near.position.set(0, 0, 0);
    alley.add(near);
    const far = facade(46, 50, { color: 0x4a4038, seed: 73, litChance: 0.05, spacingX: 9, simple: true });
    far.position.set(0, 0, 26);
    far.rotation.y = Math.PI;
    alley.add(far);
    alley.add(tiledFloor(46, 26, { color: 0x33383a, seed: 91, tileSize: 4, y: 0 }));

    const esc = fireEscape(6, { floorH: 9, w: 9 });
    esc.position.set(0, 9, 1.6);
    alley.add(esc);

    const bin = dumpster();
    bin.position.set(-13, 0, 8);
    bin.rotation.y = 0.3;
    alley.add(bin);

    const alleyLamp = new THREE.PointLight(0xffd9a0, 130, 40, 2);
    alleyLamp.position.set(-8, 12, 12);
    alley.add(alleyLamp);
    const alleyAmb = new THREE.HemisphereLight(0x24303e, 0x0a0c0d, 3.0);
    alley.add(alleyAmb);
    const moon = new THREE.DirectionalLight(0x9dc0f0, 6.0);
    moon.position.set(-30, 60, 40);
    alley.add(moon);
    // Steam and a single bare bulb over a service door: alley grammar.
    const doorLight = new THREE.PointLight(0xffe0b0, 60, 18, 2);
    doorLight.position.set(6, 5, 24);
    alley.add(doorLight);

    // Smith, in the alley, looking up. He does not move. That's the horror.
    const smith = minifig('agent', { face: { skin: '#e8bb8c', shades: true, mouth: 'flat', earpiece: true } });
    smith.position.set(1.5, 0, 13.5);
    smith.rotation.y = Math.PI;
    alley.add(smith);

    // Trinity is doubled: the hotel set's figure runs the hall, and this one
    // takes the fire escape. Same spec, so the cut is invisible.
    const triAlley = minifig('trinity', { shades3d: true });
    triAlley.visible = false;
    alley.add(triAlley);

    const climb = route([
      [0.5, 9.4, 3.4], [2.6, 13.0, 3.0], [0.6, 18.4, 3.4],
      [2.6, 27.2, 3.0], [0.8, 36.0, 3.4], [2.2, 45.0, 3.2],
    ], 0.3);

    return {
      group, cues,

      enter(c) {
        c.scene.add(set.group);
        set.reset();
        set.addColliders(c.physics);
        set.cops.forEach((cop, i) => {
          cop.visible = false;
          set.copProps[i].beam.intensity = 0;
          set.copProps[i].cone.visible = false;
        });
        set.door303.userData.slab.visible = false;
        set.desk.userData.chair.visible = false;
        hallPane.visible = true;
        sparks.reset();
        c.post.u.uGreen.value = 0.15;
        c.post.bloom.strength = 0.432;
        c.audio.bed(true, { root: 62, level: 0.05 });
      },

      exit(c) {
        c.scene.remove(set.group);
        c.audio.bed(false);
      },

      reseek(t) { if (t > 5.2) hallPane.visible = false; },

      update(t, dt, c) {
        set.tickLights(t + 80);
        const tri = set.trinity;
        const inHall = t < 5.45;

        /* ---------- 7  INT. HALL ---------- */
        tri.visible = inHall;
        if (inHall) {
          tri.neutral();
          // Out of 303 and hard right down the corridor.
          if (t < 1.1) {
            move(tri, t, 0, 1.1, [-3.4, 0, 6.0], [-1.0, 0, 18.6], { mode: 'run', speed: 1.5, e: ease.in });
          } else {
            move(tri, t, 1.1, 5.15, [-1.0, 0, 18.6], [34.6, 0, 21.4], { mode: 'run', speed: 1.35, e: ease.linear });
          }
          // The dive at the window: legs leave the floor a beat before it goes.
          if (t > 4.75) {
            const d = seg(t, 4.75, 5.3);
            tri.dive(d);
            tri.position.y += d * 2.6;
            tri.rotation.z = d * 0.25;
          }

          // "Agent Brown enters the hall, leading another unit of police."
          move(brown, t, 1.0, 5.2, [-35, 0, 21.0], [-8, 0, 21.0], { mode: 'run', speed: 0.95, e: ease.io });
          unit.forEach((u, i) => {
            move(u, t, 1.4 + i * 0.25, 5.4, [-38 - i * 3, 0, 19 + i * 2.4], [-16 + i * 2, 0, 18.4 + i * 2.6],
              { mode: 'run', speed: 1.1, e: ease.io });
            if (t > 2) u.lookAtPoint(new THREE.Vector3(tri.position.x, 4, tri.position.z));
          });
          brown.visible = true;
          unit.forEach((u) => { u.visible = true; });
          if (t > 1.2) brown.lookAtPoint(new THREE.Vector3(tri.position.x, 4.4, tri.position.z));
        } else {
          brown.visible = false;
          unit.forEach((u) => { u.visible = false; });
        }

        // "...exiting through a broken window."
        cues.at(5.2, 'glass', (skip) => {
          hallPane.visible = false;
          if (skip) return;
          const p = hallPane.position;
          const box = new THREE.Box3(
            new THREE.Vector3(p.x - 0.4, p.y - 3.2, p.z - 2.4),
            new THREE.Vector3(p.x + 0.4, p.y + 3.2, p.z + 2.4),
          );
          shatterInto(c.physics, group, GLASS, absTrans(0xd6e9ee, { opacity: 0.4 }), 34, box, {
            vel: [26, 3, 0], spread: 12, spin: 14, life: 8,
          });
          c.audio.glass();
          c.audio.crash(0.4);
          sparks.emit(p.clone(), 30, { speed: 20, color: [0.7, 0.9, 1.0], ttl: 0.6, up: 0.5 });
        });

        /* ---------- 8  EXT. FIRE ESCAPE ---------- */
        const onEscape = t >= 5.45;
        triAlley.visible = onEscape;
        if (onEscape) {
          triAlley.neutral();
          if (t < 6.6) {
            // Landing: through the window, onto the grating, rolls up.
            const k = seg(t, 5.45, 6.6);
            triAlley.position.set(lerp(-3.2, 1.0, k), lerp(11.6, 9.4, ease.out(k)), lerp(0.4, 3.6, k));
            triAlley.rotation.y = Math.PI * 0.5;
            triAlley.dive(1 - k);
            triAlley.crumple(Math.sin(k * Math.PI) * 0.8);
          } else if (t < 9.8) {
            // At the rail, looking down into the alley.
            triAlley.position.set(1.0, 9.4, 3.9);
            triAlley.rotation.y = Math.PI;
            triAlley.idle(t, { breath: 2.2 });
            const lean = eseg(t, 6.8, 8.2);
            triAlley.userData.rig.torso.rotation.x = lean * 0.42;
            triAlley.userData.rig.head.rotation.x = lean * 0.34;
            triAlley.userData.rig.armL.rotation.x = -0.5 * lean;
            triAlley.userData.rig.armR.rotation.x = -0.5 * lean;
          } else {
            // "She can only go up."
            const turn = seg(t, 9.8, 10.5);
            triAlley.rotation.y = lerp(Math.PI, Math.PI * 2, ease.io(turn));
            if (t < 10.5) {
              triAlley.position.set(1.0, 9.4, 3.9);
              triAlley.idle(t, { breath: 2 });
            } else {
              follow(triAlley, t, 10.5, 14.0, climb, { mode: 'run', speed: 1.6, face: false });
              triAlley.rotation.y = Math.PI * 2;
              // Hauling herself up ladders: arms overhead, alternating.
              const r = triAlley.userData.rig;
              const p = t * 9;
              r.armL.rotation.x = -2.5 + Math.sin(p) * 0.5;
              r.armR.rotation.x = -2.5 - Math.sin(p) * 0.5;
              r.armL.rotation.z = 0.3;
              r.armR.rotation.z = -0.3;
              r.torso.rotation.x = 0.12;
            }
          }
        }

        // Smith, from below. Absolutely still, head tilting up to track her.
        smith.neutral();
        smith.idle(t * 0.4, { breath: 0.2 });
        if (onEscape) {
          const look = new THREE.Vector3().copy(triAlley.position);
          look.x += ALLEY_X;
          smith.lookAtPoint(look);
          smith.userData.rig.head.rotation.x = -0.38;
        }

        cues.at(5.5, 'land', (skip) => {
          if (!skip) { c.audio.crash(0.5); c.audio.clatter(5, 0.3, 0.12); }
        });
        cues.at(8.4, 'seeSmith', (skip) => { if (!skip) c.audio.pulse(0.42); });
        cues.at(10.6, 'up', (skip) => { if (!skip) c.audio.riser(2.6); });

        if (Math.random() < dt * 1.2) {
          smoke.puff(new THREE.Vector3(ALLEY_X + 6 + Math.random() * 4, 0.5, 20 + Math.random() * 4), {
            dur: 6, size: 7, vy: 2.4, opacity: 0.12,
          });
        }

        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, inHall ? 0.06 : 0.03);
        shake(c.camera, inHall ? 0.1 : t < 7 ? 0.08 : 0.02, t, 13);
        sparks.update(dt);
        smoke.update(dt);
      },
    };
  },
};
