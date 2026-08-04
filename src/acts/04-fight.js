import * as THREE from 'three';
import { hotelSet } from '../sets/hotel.js';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp, noise1, shake, rng } from '../core/anim.js';
import { move, stand, orient, wallRun } from '../core/actor.js';
import { shatterInto } from '../core/physics.js';
import { Tracers, Flashes, Sparks, Smoke } from '../fx/particles.js';
import { brickGeo, roundBrickGeo, BRICK_H } from '../core/legoParts.js';
import { abs, C } from '../core/materials.js';
import { cuffs, disassemble } from '../core/minifig.js';

/**
 * 4  INT. HEART O' THE CITY HOTEL — the arrest goes wrong
 *
 * Built shot for shot off the opening's 43-shot camera sheet, shots 11 to 41:
 *
 *   11  4:05  over shoulder                  cop pulls out cuffs
 *   12  2:01  over shoulder                  Trinity eyes
 *   13  1:00  med close up                   Trinity spins
 *   14  0:19  med close up                   breaks arm
 *   15  0:16  over shoulder                  punch nose
 *   17  0:15  down shot                      cop screams
 *   18  0:20  medium                         Trinity anticipates
 *   19  3:11  med long · pan up dolly round  TRINITY JUMPS UP
 *   20  0:15  close up                       feet kick
 *   21  0:25  medium · pan                   cop flies back
 *   22  0:29  med long                       hits other cop into wall
 *   24  0:19  close up                       Trinity anticipates
 *   25  0:20  medium                         kicks chair
 *   26  0:16  medium                         chair hits cop
 *   27  0:18  medium                         cop points gun
 *   28  1:07  medium long · pan              Trinity turns runs up wall
 *   30  0:25  medium                         Trinity on wall
 *   32  0:25  close up                       Trinity lands
 *   33  0:15  medium                         grabs cop & spins
 *   35  0:20  over shoulder                  shoots cop
 *   39  1:11  medium long                    kicks cop in head
 *   40  2:21  long down shot                 turns to look around
 *
 * Shot 19 is three times the length of anything around it, and it is the first
 * bullet-time shot in the film: she leaves the floor, time stops, and the
 * camera walks all the way around a minifigure hanging in mid-air with one leg
 * out. The physics solver freezes with her — every loose brick in the room
 * stops where it is — which is most of the joke, because by that point the
 * room is full of loose bricks.
 *
 * The standing problem is that a minifigure cannot punch: no elbows, no
 * wrists. So the film's "breaks arm" is played completely straight. The arm
 * comes off. He looks at where it used to be.
 */

const BRICK = brickGeo(2, 1, BRICK_H);
const CHIP = brickGeo(1, 1, BRICK_H);
const BLOOD = roundBrickGeo(1, 0.4, false);   // 1×1 round plates, dark red

/* ---- shot 19: the suspended kick ---- */
const JUMP_A = 6.2;      // she leaves the floor
const FREEZE_A = 6.9;    // time stops
const FREEZE_B = 9.35;   // time restarts
const JUMP_B = 9.8;      // the kick lands
const APEX = new THREE.Vector3(3.0, 5.0, 2.8);
// Pivot on the figure, so the lens always looks at the centre of its own arc.
const ORBIT_PIVOT = new THREE.Vector3(3.0, 5.0, 2.8);

/* ---- shots 28-31: the wall run, on the room's +X wall ---- */
const WALL_X = 16.3;

const WALL_HITS = [
  [16.2, 7.0, 6.0], [16.2, 5.2, 9.4], [16.2, 9.0, 11.0],
  [16.2, 6.2, 13.2], [16.2, 10.4, 8.0], [16.2, 4.0, 11.8],
];

const CAM = [
  // 11 — over his shoulder onto her, still seated.
  { t: 0, pos: [4.6, 5.2, 6.0], look: [-2.4, 4.4, -0.4], fov: 34 },
  { t: 2.0, pos: [4.2, 5.0, 5.4], look: [-2.6, 4.4, -0.6], fov: 30, ease: ease.io },
  // 12 — her eyes. In profile, because her own chair back is between the
  // door side of the room and her face.
  { t: 2.05, pos: [2.4, 4.7, -1.3], look: [-3.3, 4.5, -1.5], fov: 24, ease: ease.linear },
  { t: 3.0, pos: [2.1, 4.7, -1.4], look: [-3.3, 4.5, -1.5], fov: 24, ease: ease.io },
  // 13 — she spins up out of the chair.
  { t: 3.05, pos: [6.4, 4.8, 1.0], look: [-0.6, 4.2, 0.8], fov: 34, ease: ease.linear },
  { t: 3.8, pos: [6.0, 4.6, 0.6], look: [-0.2, 4.1, 1.4], fov: 32, ease: ease.io },
  // 14 — breaks arm. The contact is between the two of them.
  { t: 3.85, pos: [7.0, 4.8, -2.6], look: [1.0, 4.0, 2.2], fov: 40, ease: ease.linear },
  { t: 4.5, pos: [6.4, 4.7, -2.0], look: [1.1, 4.0, 2.4], fov: 38, ease: ease.io },
  // 15/16 — the nose.
  { t: 4.55, pos: [-3.8, 5.4, 7.8], look: [1.2, 4.5, 2.9], fov: 34, ease: ease.linear },
  { t: 5.0, pos: [-3.2, 5.3, 7.2], look: [1.3, 4.5, 2.9], fov: 32, ease: ease.io },
  // 17 — down shot: one arm short, no head, still upright.
  { t: 5.05, pos: [4.8, 8.2, 6.6], look: [1.8, 1.4, 3.4], fov: 40, ease: ease.linear },
  { t: 5.6, pos: [4.4, 7.4, 6.2], look: [2.0, 1.2, 3.6], fov: 38, ease: ease.io },
  // 18 — Trinity anticipates.
  { t: 5.65, pos: [-3.4, 4.9, 5.6], look: [1.2, 4.3, 1.6], fov: 32, ease: ease.linear },
  { t: 6.2, pos: [-3.0, 4.8, 5.2], look: [1.3, 4.3, 1.5], fov: 30, ease: ease.io },
  // 19 is the orbit, driven procedurally below.
  // 20 — feet kick.
  { t: 9.8, pos: [7.8, 4.2, 6.8], look: [3.6, 3.8, 3.9], fov: 26, ease: ease.linear },
  { t: 10.3, pos: [7.4, 4.1, 6.4], look: [3.8, 3.8, 4.0], fov: 26, ease: ease.io },
  // 21 — cop flies back.
  { t: 10.35, pos: [0.0, 5.6, 8.8], look: [5.4, 3.8, 6.2], fov: 40, ease: ease.linear },
  { t: 11.0, pos: [0.6, 5.8, 9.2], look: [7.4, 3.4, 9.6], fov: 40, ease: ease.io },
  // 22 — hits the other cop into the wall.
  { t: 11.05, pos: [-2.6, 6.0, 6.0], look: [7.4, 4.0, 12.4], fov: 44, ease: ease.linear },
  { t: 11.9, pos: [-1.8, 6.0, 6.4], look: [8.0, 3.6, 12.8], fov: 44, ease: ease.io },
  // 23 — cop turns.
  { t: 11.95, pos: [7.0, 4.8, 6.0], look: [3.9, 4.4, 11.0], fov: 32, ease: ease.linear },
  { t: 12.4, pos: [6.6, 4.8, 6.4], look: [3.9, 4.4, 11.0], fov: 32, ease: ease.io },
  // 24 — Trinity anticipates.
  { t: 12.45, pos: [5.2, 4.9, 3.2], look: [-1.2, 4.4, 0.6], fov: 26, ease: ease.linear },
  { t: 13.0, pos: [4.6, 4.8, 3.0], look: [-1.3, 4.4, 0.5], fov: 26, ease: ease.io },
  // 25 — kicks the chair. Wide enough to hold her and it.
  { t: 13.05, pos: [4.4, 4.2, 6.4], look: [-2.6, 2.4, 0.2], fov: 36, ease: ease.linear },
  { t: 13.7, pos: [4.0, 4.0, 6.8], look: [-2.0, 2.2, 0.6], fov: 36, ease: ease.io },
  // 26 — the chair hits the cop.
  { t: 13.75, pos: [-2.0, 5.2, 4.4], look: [3.4, 3.6, 10.4], fov: 38, ease: ease.linear },
  { t: 14.3, pos: [-1.4, 5.2, 4.8], look: [3.6, 3.4, 10.6], fov: 38, ease: ease.io },
  // 27 — cop points gun.
  { t: 14.35, pos: [8.6, 4.6, 6.4], look: [4.2, 4.2, 10.4], fov: 30, ease: ease.linear },
  { t: 15.0, pos: [8.2, 4.6, 6.8], look: [4.2, 4.2, 10.4], fov: 30, ease: ease.io },
  // 28 — she turns and runs at the wall; the lens pans up it with her.
  { t: 15.05, pos: [-1.0, 5.4, -4.6], look: [4.0, 3.8, 2.0], fov: 44, ease: ease.linear },
  { t: 16.4, pos: [0.6, 6.6, -3.4], look: [14.2, 5.0, 8.0], fov: 44, ease: ease.io },
  // 29 — cop shoots.
  { t: 16.45, pos: [1.0, 4.8, 8.6], look: [4.0, 4.4, 11.0], fov: 28, ease: ease.linear },
  { t: 16.9, pos: [1.4, 4.8, 8.8], look: [4.0, 4.4, 11.0], fov: 28, ease: ease.io },
  // 30 — Trinity on the wall.
  { t: 16.95, pos: [7.6, 8.0, 1.6], look: [15.6, 6.4, 10.6], fov: 40, ease: ease.linear },
  { t: 17.8, pos: [8.4, 8.6, 2.6], look: [15.8, 7.2, 12.0], fov: 40, ease: ease.io },
  // 31 — cop shoots.
  { t: 17.85, pos: [0.6, 5.0, 9.4], look: [3.6, 4.6, 11.2], fov: 24, ease: ease.linear },
  { t: 18.5, pos: [0.9, 5.0, 9.6], look: [3.6, 4.6, 11.2], fov: 24, ease: ease.io },
  // 32 — she lands.
  { t: 18.55, pos: [5.0, 3.2, 14.2], look: [11.4, 2.4, 11.6], fov: 34, ease: ease.linear },
  { t: 19.4, pos: [5.6, 2.6, 13.8], look: [11.2, 2.0, 11.4], fov: 34, ease: ease.io },
  // 33 — grabs the cop and spins.
  { t: 19.45, pos: [4.4, 5.0, 5.6], look: [10.2, 4.2, 10.8], fov: 34, ease: ease.linear },
  { t: 20.0, pos: [4.8, 5.0, 5.4], look: [10.2, 4.2, 10.8], fov: 34, ease: ease.io },
  // 34 — finishes the spin.
  { t: 20.05, pos: [-2.0, 6.4, 2.0], look: [10.4, 4.0, 10.8], fov: 44, ease: ease.linear },
  { t: 20.7, pos: [-1.4, 6.4, 2.4], look: [10.4, 4.0, 10.8], fov: 44, ease: ease.io },
  // 35 — shoots the cop.
  { t: 20.75, pos: [13.4, 5.2, 6.6], look: [9.6, 4.6, 10.6], fov: 30, ease: ease.linear },
  { t: 21.4, pos: [13.0, 5.2, 6.8], look: [9.6, 4.6, 10.6], fov: 30, ease: ease.io },
  // 36 — Trinity shooting.
  { t: 21.45, pos: [8.0, 4.9, 6.6], look: [10.6, 4.6, 10.4], fov: 20, ease: ease.linear },
  { t: 22.2, pos: [8.2, 4.9, 6.8], look: [10.6, 4.6, 10.4], fov: 20, ease: ease.io },
  // 37 — the cop gets shot.
  { t: 22.25, pos: [4.0, 5.6, 4.0], look: [9.8, 3.8, 10.6], fov: 42, ease: ease.linear },
  { t: 23.0, pos: [4.4, 5.6, 4.2], look: [9.8, 3.8, 10.6], fov: 42, ease: ease.io },
  // 38 — she spins.
  { t: 23.05, pos: [12.4, 5.2, 12.4], look: [8.6, 4.6, 8.6], fov: 32, ease: ease.linear },
  { t: 23.5, pos: [12.0, 5.2, 12.0], look: [8.4, 4.6, 8.4], fov: 32, ease: ease.io },
  // 39 — kicks the last one in the head.
  { t: 23.55, pos: [13.0, 4.4, 4.0], look: [7.4, 4.2, 8.0], fov: 38, ease: ease.linear },
  { t: 24.9, pos: [12.4, 4.6, 4.4], look: [7.0, 4.0, 8.0], fov: 38, ease: ease.io },
  // 40 — long down shot: she turns to look at what she has done.
  { t: 24.95, pos: [12.0, 9.4, 2.0], look: [7.0, 2.0, 8.0], fov: 46, ease: ease.linear },
  { t: 26.4, pos: [10.0, 7.2, 3.0], look: [7.6, 3.6, 8.4], fov: 38, ease: ease.io },
  { t: 27.6, pos: [9.0, 5.6, 4.2], look: [7.8, 4.4, 8.6], fov: 30, ease: ease.io },
  // 41 — a flashlight rocks slowly to a stop.
  { t: 27.65, pos: [2.0, 1.6, 8.0], look: [7.0, 0.8, 10.0], fov: 36, ease: ease.linear },
  { t: 30.0, pos: [1.4, 2.2, 7.2], look: [7.4, 1.2, 10.4], fov: 36, ease: ease.io },
];

/** Cop marks, carried over from the end of scene 2. */
const MARKS = [
  [-1.6, 0, 10.4], [3.8, 0, 11.2], [-7.2, 0, 12.6], [8.0, 0, 13.4],
];

export default {
  slug: '4 · The Arrest Goes Wrong',
  start: 112,
  end: 142,

  build(ctx) {
    const set = hotelSet();
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const tracers = new Tracers(group, { pool: 34 });
    const flashes = new Flashes(group, { pool: 12 });
    const sparks = new Sparks(group, { max: 620, size: 0.26 });
    const smoke = new Smoke(group, { pool: 16, color: 0x7c837c, size: 6 });
    const rand = rng(808);

    const braceletPair = cuffs();
    braceletPair.visible = false;
    group.add(braceletPair);

    const fightKey = new THREE.SpotLight(0xc2dcff, 0, 70, Math.PI * 0.36, 0.65, 1.5);
    fightKey.position.set(7, 14, -3);
    fightKey.target.position.set(3, 3, 4);
    const fightRim = new THREE.SpotLight(0xffd2a0, 0, 60, Math.PI * 0.32, 0.6, 1.5);
    fightRim.position.set(-3, 10, 13);
    fightRim.target.position.set(4, 3.5, 4);
    const fightFill = new THREE.HemisphereLight(0x22303c, 0x0c0e10, 0);
    group.add(fightKey, fightKey.target, fightRim, fightRim.target, fightFill);

    // The chair gets kicked across the room, so its mark has to be recorded
    // before the solver takes ownership of it.
    const chair = set.desk.userData.chair;
    const chairHome = {
      parent: chair.parent,
      pos: chair.position.clone(),
      rot: chair.rotation.clone(),
    };

    /** Release every mesh under a node — a limb, a prop, a whole figure. */
    const detach = (node, c, vel, spin = 14) => {
      const meshes = [];
      node.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const m of meshes) {
        c.physics.release(m, {
          vel: [
            vel[0] + (rand() - 0.5) * 8,
            vel[1] + rand() * 5,
            vel[2] + (rand() - 0.5) * 8,
          ],
          spin, life: 20,
        });
      }
    };

    /** Detach a cop's kit so it falls with him instead of vanishing. */
    const dropKit = (i, c, vel) => {
      const p = set.copProps[i];
      if (!p || p.dropped) return;
      p.dropped = true;
      p.cone.visible = false;
      c.physics.release(p.torch, {
        size: [0.6, 0.6, 2.4], mass: 0.05, life: 24,
        vel: [vel[0] * 0.5 + (rand() - 0.5) * 8, 4 + rand() * 5, vel[2] * 0.5 + (rand() - 0.5) * 8],
        spin: 9,
      });
      c.physics.release(p.gun, {
        size: [0.5, 0.7, 0.9], mass: 0.05, life: 24,
        vel: [vel[0] * 0.4 + (rand() - 0.5) * 10, 5 + rand() * 6, vel[2] * 0.4 + (rand() - 0.5) * 10],
        spin: 14,
      });
    };

    const takeApart = (i, c, origin, force, vel = [0, 0, 0], quiet = false) => {
      dropKit(i, c, vel);
      const cop = set.cops[i];
      if (!cop || cop.userData.dismantled) return;
      const o = new THREE.Vector3(...origin);
      disassemble(cop, c.physics, { origin: o, force });
      // The LEGO equivalent of "blood erupting": a burst of dark red 1×1
      // round plates. Plastic, not viscera.
      const box = new THREE.Box3(
        o.clone().add(new THREE.Vector3(-0.6, -0.4, -0.6)),
        o.clone().add(new THREE.Vector3(0.6, 0.6, 0.6)),
      );
      shatterInto(c.physics, group, BLOOD, abs(C.darkRed), 7, box, {
        vel: [vel[0] * 0.2, 6, vel[2] * 0.2], spread: 10, spin: 20, life: 8,
      });
      sparks.emit(o, 26, { speed: 16, color: [0.5, 0.1, 0.1], ttl: 0.5, up: 0.7, jitter: 0.2 });
      if (!quiet) {
        c.audio.clatter(11, 0.45, 0.24);
        c.audio.crash(0.45);
      }
    };

    /** A cop fires; something comes off whatever he hits. */
    const fireAt = (i, hit, c) => {
      const cop = set.cops[i];
      if (!cop || cop.userData.dismantled) return;
      const p = set.copProps[i];
      const muzzle = new THREE.Vector3(0, 0.34, 0.72);
      p.gun.localToWorld(muzzle);
      const to = new THREE.Vector3(...hit);
      tracers.fire(muzzle, to);
      flashes.pop(muzzle, { size: 1.1, power: 260 });
      c.audio.gunshot(0.85);
      sparks.emit(to, 16, { speed: 24, color: [1, 0.8, 0.45], ttl: 0.4, up: 0.4 });
      const box = new THREE.Box3(to.clone().addScalar(-0.5), to.clone().addScalar(0.5));
      const dir = to.clone().sub(muzzle).normalize().multiplyScalar(-14);
      shatterInto(c.physics, group, rand() > 0.5 ? CHIP : BRICK, abs(0x8f8778), 2, box, {
        vel: [dir.x, 6, dir.z], spread: 10, spin: 18, life: 9,
      });
    };

    /** Her own shot, from a snatched pistol. */
    const trinityFires = (c, from, to) => {
      tracers.fire(from, to, { width: 1.2 });
      flashes.pop(from, { size: 1.5, power: 340 });
      c.audio.gunshot(1);
      c.post.u.uWhite.value = Math.max(c.post.u.uWhite.value, 0.22);
    };

    return {
      group, cues,

      enter(c) {
        c.scene.add(set.group);
        set.reset();
        set.addColliders(c.physics);
        sparks.reset();
        braceletPair.visible = false;
        for (const p of set.copProps) { p.dropped = false; p.cone.visible = true; }
        // Put the chair back on its mark if a previous pass kicked it away.
        if (chair.userData.released) {
          chair.userData.released = false;
          chairHome.parent.add(chair);
          chair.position.copy(chairHome.pos);
          chair.rotation.copy(chairHome.rot);
        }
        chair.visible = true;
        c.physics.frozen = false;
        c.post.u.uGreen.value = 0.12;
        c.post.u.uVignette.value = 1.2;
        c.post.bloom.strength = 0.48;
        c.audio.cue('fight');
      },

      exit(c) {
        c.scene.remove(set.group);
        c.physics.frozen = false;
        c.audio.cue(null);
        c.audio.stopHum();
      },

      reseek(t, c) {
        // Coming back into the aftermath: everyone is already down.
        if (t > 25) {
          for (let i = 0; i < 4; i++) {
            const cop = set.cops[i];
            if (cop && !cop.userData.dismantled) {
              cop.visible = false;
              cop.userData.dismantled = true;
              set.copProps[i].cone.visible = false;
              set.copProps[i].beam.intensity = 0;
            }
          }
          chair.visible = false;
        }
      },

      update(t, dt, c) {
        const tri = set.trinity;
        const r = tri.userData.rig;
        const [big, second, third, fourth] = set.cops;

        /* ---------- bullet time ---------- */
        // Time stops for shot 19, and nothing but the camera moves.
        const frozen = t >= FREEZE_A && t < FREEZE_B;
        c.physics.frozen = frozen;
        // The practicals stop flickering too: a held frame that still
        // flickers reads as a stutter rather than as stopped time.
        set.tickLights(frozen ? FREEZE_A + 40 : t + 40);

        // Up as the fight starts, hard up for the held frame, down after.
        const lit = seg(t, 2.6, 3.4) * (1 - seg(t, 25.5, 27.5) * 0.75);
        const hero = frozen ? ease.io(seg(t, FREEZE_A, FREEZE_A + 0.5)) : 0;
        fightKey.intensity = lit * (260 + hero * 900);
        fightRim.intensity = lit * (200 + hero * 700);
        fightFill.intensity = lit * (0.9 + hero * 1.6);
        // The key follows her, so the orbit always has something to model.
        fightKey.target.position.set(tri.position.x, 3.0, tri.position.z);
        if (!frozen) {
          fightRim.position.set(-3, 10, 13);
          fightRim.target.position.set(tri.position.x, 3.4, tri.position.z);
        }

        /* ---------- 11: the cuffs ---------- */
        if (!big.userData.dismantled) {
          move(big, t, 0.3, 1.9, MARKS[0], [1.3, 0, 2.8], { mode: 'walk', speed: 0.75 });
          if (t >= 1.9 && t < 3.05) {
            big.position.set(1.3, 0, 2.8);
            big.face(-0.4, -1);
            big.neutral();
            const reach = seg(t, 1.9, 2.6);
            big.userData.rig.armR.rotation.x = -1.2 * ease.out(reach);
            big.userData.rig.armR.rotation.z = -0.24;
            big.userData.rig.torso.rotation.x = -0.16 * reach;
          }
          if (t >= 3.05 && t < 5.0) {
            // Held on his mark while she takes the arm and then the nose.
            big.position.set(1.3, 0, 2.8);
            big.face(-1, -0.9);
            big.userData.rig.armR.rotation.x = -1.2;
            big.userData.rig.armR.rotation.z = -0.24;
            big.userData.rig.armL.rotation.x = -0.4;
            big.userData.rig.torso.rotation.x = -0.16;
          }
          cues.at(1.4, 'cuffs', (skip) => {
            braceletPair.visible = true;
            if (!skip) c.audio.click(0.2);
          });
          if (braceletPair.visible && t < 3.6) {
            big.userData.rig.handR.getWorldPosition(braceletPair.position);
            braceletPair.rotation.y = big.rotation.y;
          } else {
            braceletPair.visible = false;
          }
        }

        // The other three hold a bead until she moves.
        const aimPoint = new THREE.Vector3(-3.4, 4.6, -1.0);
        for (let i = 1; i < 4; i++) {
          const cop = set.cops[i];
          if (!cop || cop.userData.dismantled) continue;
          if (t < 11.9) {
            cop.position.set(...MARKS[i]);
            cop.neutral();
            cop.face(aimPoint.x - cop.position.x, aimPoint.z - cop.position.z);
            cop.aim(aimPoint);
            cop.userData.rig.armL.rotation.x = -1.35;
            cop.userData.rig.torso.rotation.y += noise1(t * 7 + i * 5) * 0.05;
          }
        }

        /* ---------- 12-16: she stands, spins, and the arm comes off ------- */
        tri.visible = true;
        tri.neutral();
        if (t < 2.9) {
          // Seated, hands behind her head, watching him reach for her wrists.
          tri.position.set(-3.5, 1.4, -1.6);
          tri.rotation.y = Math.PI + 0.18;
          tri.sitType(t, false);
          tri.handsUp(1);
        } else if (t < JUMP_A) {
          const rise = eseg(t, 2.9, 3.25, ease.outQuint);
          const spin = seg(t, 3.05, 3.8);
          const brk = seg(t, 3.8, 4.5);
          const palm = seg(t, 4.5, 5.0);

          tri.position.set(
            lerp(-3.5, -3.0, rise) + lerp(0, 3.0, spin) + lerp(0, 0.6, brk),
            lerp(1.4, 0, rise),
            lerp(-1.6, 0.4, rise) + lerp(0, 1.4, spin) + lerp(0, 0.4, brk),
          );
          // Out of the chair and round to face him.
          tri.rotation.y = lerp(Math.PI + 0.18, Math.PI * 2 + 0.5, ease.io(Math.max(rise * 0.4, spin)));
          r.legL.rotation.x = lerp(1.52, -0.1, rise) - spin * 0.3;
          r.legR.rotation.x = lerp(1.52, 0.1, rise) + spin * 0.35;
          r.torso.rotation.x = lerp(-0.08, -0.2, rise);
          r.torso.rotation.y = Math.sin(spin * Math.PI) * 0.5;
          r.armR.rotation.x = lerp(-2.5, -1.1, rise);
          r.armL.rotation.x = lerp(-2.5, -0.9, rise);
          r.armR.rotation.z = lerp(-0.85, -0.35, rise);
          r.armL.rotation.z = lerp(0.85, 0.35, rise);

          // 14: both her hands on his forearm, and a short sharp twist.
          if (brk > 0) {
            const tw = Math.sin(brk * Math.PI);
            r.armR.rotation.x = -1.5 - tw * 0.5;
            r.armL.rotation.x = -1.45 - tw * 0.45;
            r.torso.rotation.z = tw * 0.4;
            r.torso.rotation.x = -0.2 - tw * 0.2;
          }
          // 15: "the eye blinks and Trinity's palm snaps up".
          if (palm > 0) {
            const sn = ease.outQuint(palm);
            r.armR.rotation.x = lerp(-2.0, -2.7, sn);
            r.armR.rotation.z = -0.1;
            r.torso.rotation.x = -0.3 + sn * 0.25;
            r.torso.rotation.z = 0;
          }
        }

        // Shot 14 — the arm comes off. He does not immediately notice.
        cues.at(4.32, 'arm', (skip) => {
          if (big.userData.dismantled) return;
          const arm = big.userData.rig.armR;
          const gun = set.copProps[0].gun;
          if (!skip) {
            detach(gun, c, [7, 6, 9], 18);
            detach(arm, c, [6, 7, 8], 20);
            c.audio.clatter(4, 0.2, 0.22);
            c.audio.crash(0.3);
            sparks.emit(arm.getWorldPosition(new THREE.Vector3()), 12, {
              speed: 12, color: [0.5, 0.12, 0.12], ttl: 0.4, up: 0.6, jitter: 0.2,
            });
          } else {
            arm.visible = false;
          }
        });

        // Shot 15/17 — the nose, and then the head, which lands face up and
        // goes on shouting.
        cues.at(4.94, 'nose', (skip) => {
          if (big.userData.dismantled) return;
          const head = big.userData.rig.head;
          const wp = head.getWorldPosition(new THREE.Vector3());
          if (!skip) {
            detach(head, c, [3, 15, 12], 22);
            const box = new THREE.Box3(wp.clone().addScalar(-0.4), wp.clone().addScalar(0.4));
            shatterInto(c.physics, group, BLOOD, abs(C.red), 6, box, {
              vel: [2, 9, 12], spread: 12, spin: 20, life: 7,
            });
            c.audio.crash(0.5);
            c.audio.clatter(4, 0.2, 0.2);
            c.post.u.uWhite.value = 0.4;
          } else {
            head.visible = false;
          }
        });

        // 17-18: he is still standing, one arm short and headless. She backs
        // off a step and sets her feet.
        if (t >= 5.0 && t < JUMP_A && !big.userData.dismantled) {
          const stagger = seg(t, 5.0, 6.2);
          big.position.set(1.3 + stagger * 1.4, 0, 2.8 + stagger * 1.0);
          big.userData.rig.torso.rotation.x = -0.1 + Math.sin(t * 9) * 0.12 * (1 - stagger);
          big.userData.rig.armL.rotation.x = -1.6 + Math.sin(t * 7) * 0.4;
        }
        if (t >= 5.0 && t < JUMP_A) {
          const feet = seg(t, 5.6, 6.2);
          tri.position.set(lerp(1.2, 1.4, feet), 0, lerp(2.6, 1.4, feet));
          tri.face(1, 1);
          r.legL.rotation.x = -0.25 * feet;
          r.legR.rotation.x = 0.3 * feet;
          r.torso.rotation.x = -0.24;
          r.armR.rotation.x = -0.6;
          r.armL.rotation.x = -0.8;
          r.armR.rotation.z = -0.4;
          r.armL.rotation.z = 0.5;
        }

        /* ================= 19: THE SUSPENDED KICK ================= */
        if (t >= JUMP_A && t < JUMP_B) {
          // One continuous leap, whose middle lasts two and a half seconds
          // because the camera has somewhere to be.
          const rise = seg(t, JUMP_A, FREEZE_A);
          const fall = seg(t, FREEZE_B, JUMP_B);
          const k = frozen || fall > 0 ? 1 : rise;

          tri.position.set(
            lerp(1.4, APEX.x, k),
            lerp(0, APEX.y, ease.out(k)) - fall * 0.5,
            lerp(1.4, APEX.z, k),
          );
          tri.face(1, 0.55);
          // Laid back, right leg extended laterally into the officer — the
          // pose the whole shot exists in order to look at.
          const ext = ease.outQuint(k);
          tri.rotation.z = -0.5 * ext;
          r.torso.rotation.x = lerp(-0.3, 0.34, ext);
          r.torso.rotation.z = 0.2 * ext;
          r.legR.rotation.x = lerp(-0.4, -1.62, ext);
          r.legL.rotation.x = lerp(-0.2, 0.75, ext);
          r.armR.rotation.x = lerp(-0.6, -2.5, ext);
          r.armL.rotation.x = lerp(-0.8, -0.55, ext);
          r.armR.rotation.z = lerp(-0.4, -0.8, ext);
          r.armL.rotation.z = lerp(0.5, 0.95, ext);
          r.head.rotation.y = 0.3 * ext;

          // He is held in the instant before it connects.
          if (!big.userData.dismantled) {
            big.position.set(5.4, 0, 5.2);
            big.face(-1, -0.8);
            big.userData.rig.torso.rotation.x = -0.12;
            big.userData.rig.armL.rotation.x = -1.9;
            big.userData.rig.armL.rotation.z = 0.6;
          }
        }

        cues.at(FREEZE_A, 'freeze', (skip) => {
          if (skip) return;
          c.audio.whoosh(0.5, 0.3);
          c.audio.hum(0.09, 28);
          c.audio.cue('suspend');
        });
        cues.at(FREEZE_B, 'unfreeze', (skip) => {
          if (skip) return;
          c.audio.stopHum();
          c.audio.whoosh(0.35, 0.34);
        });

        /* ---------- 20-22: the kick lands ---------- */
        cues.at(JUMP_B, 'kick', (skip) => {
          takeApart(0, c, [5.4, 3.8, 5.2], skip ? 26 : 44, [24, 0, 28]);
          if (!skip) {
            c.audio.crash(0.8);
            c.audio.sting(1.0);
            c.physics.burst([5.4, 3.8, 5.2], 30, 0.5, 8);
            c.post.u.uWhite.value = 0.42;
            c.audio.cue('fight');
          }
        });
        // 22 — "a two-hundred-fifty pound sack of limp meat and bone that
        // slams into the cop farthest from her."
        cues.at(11.35, 'slam', (skip) => {
          takeApart(3, c, [7.6, 4.0, 12.6], skip ? 24 : 44, [14, 0, 24]);
          if (!skip) {
            c.post.u.uWhite.value = 0.3;
            const box = new THREE.Box3(
              new THREE.Vector3(9, 2, 13.6), new THREE.Vector3(14, 9, 14.6),
            );
            shatterInto(c.physics, group, BRICK, abs(0x8f8778), 14, box, {
              vel: [10, 6, 8], spread: 14, spin: 16, life: 10,
            });
            for (let i = 0; i < 3; i++) {
              smoke.puff(new THREE.Vector3(10 + i * 2, 3 + i, 13), { dur: 5, size: 6, vy: 1.1, opacity: 0.26 });
            }
          }
        });

        if (t >= JUMP_B && t < 12.45) {
          // She rides the kick down and lands on her feet.
          const land = seg(t, JUMP_B, 10.6);
          tri.position.set(lerp(APEX.x, 3.6, land), lerp(APEX.y, 0, ease.in(land)), lerp(APEX.z, 4.4, land));
          tri.rotation.z = lerp(-0.5, 0, land);
          tri.face(1, 0.55);
          r.legR.rotation.x = lerp(-1.62, -0.2, land);
          r.legL.rotation.x = lerp(0.75, 0.2, land);
          r.torso.rotation.x = lerp(0.34, -0.15, land);
          r.torso.rotation.z = lerp(0.2, 0, land);
          r.armR.rotation.x = lerp(-2.5, -0.5, land);
          r.armL.rotation.x = lerp(-0.55, -0.4, land);
        }

        /* ---------- 24-26: the chair ---------- */
        if (t >= 12.45 && t < 15.05) {
          const back = seg(t, 12.45, 13.0);
          const swing = seg(t, 13.0, 13.55);
          tri.position.set(lerp(3.6, -1.4, back), 0, lerp(4.4, 0.4, back));
          tri.face(-0.4, -1);
          if (swing > 0) {
            // A short, flat sweep of the right leg into the seat back.
            const s = Math.sin(swing * Math.PI);
            tri.rotation.y += s * 0.5;
            r.legR.rotation.x = -1.5 * s;
            r.legL.rotation.x = 0.3 * s;
            r.torso.rotation.x = -0.2 - s * 0.3;
            r.torso.rotation.z = s * 0.35;
            tri.position.y = s * 0.3;
          } else {
            r.torso.rotation.x = -0.18;
            r.armR.rotation.x = -0.5;
            r.armL.rotation.x = -0.45;
          }
        }

        cues.at(13.5, 'chair', (skip) => {
          if (chair.userData.released) return;
          if (skip) { chair.visible = false; return; }
          c.physics.release(chair, {
            size: [4.2, 5.2, 4.2], mass: 0.35, life: 20,
            vel: [17, 9, 26], spin: 7,
          });
          c.audio.clatter(6, 0.3, 0.2);
          c.audio.crash(0.25);
        });

        // 26 — it arrives. He goes over, and gets back up.
        cues.at(14.1, 'chairHit', (skip) => {
          if (!skip) { c.audio.crash(0.45); c.audio.clatter(5, 0.3, 0.18); }
        });
        if (t >= 14.1 && t < 15.05 && second && !second.userData.dismantled) {
          const down = seg(t, 14.1, 14.5);
          const up = seg(t, 14.5, 15.05);
          second.neutral();
          second.position.set(3.9, 0, 11.0);
          second.face(-1, -1);
          second.crumple(down - up);
          second.rotation.z = 0.4 * (down - up);
        }

        /* ---------- 27-31: the wall run ---------- */
        if (t >= 15.05 && t < 18.55) {
          if (t < 15.75) {
            // She turns and goes at the wall.
            move(tri, t, 15.05, 15.75, [-1.4, 0, 0.4], [13.6, 0, 6.6], {
              mode: 'run', speed: 1.7, e: ease.in,
            });
          } else if (t < 16.15) {
            // The plant: one foot onto the brick, and up.
            const p = seg(t, 15.75, 16.15);
            tri.position.set(lerp(13.6, WALL_X, p), lerp(0, 1.4, p), lerp(6.6, 7.4, p));
            orient(tri, [lerp(-0.2, -1, p), lerp(1, 0, p), 0], [0.3, 1, 0.9]);
            tri.walk(t, { run: true, speed: 2 });
          } else if (t < 17.95) {
            // On the wall. Gravity is a suggestion.
            wallRun(tri, t, 16.15, 17.95, [WALL_X, 1.4, 7.4], [WALL_X, 8.4, 13.2], {
              normal: [-1, 0, 0], speed: 1.8, e: ease.io,
            });
          } else {
            // Push off, and rotate back under herself on the way down.
            const off = seg(t, 17.95, 18.55);
            tri.position.set(
              lerp(WALL_X, 11.4, ease.out(off)),
              lerp(8.4, 0.9, ease.in(off)),
              lerp(13.2, 11.8, off),
            );
            orient(tri, [lerp(-1, 0, off), lerp(0, 1, off), 0], [-1, -0.2, -0.4]);
            tri.leap(1 - off);
          }
        }

        // 29/31 — they shoot at her, and hit the wall she is standing on.
        const WALL_SHOTS = [
          [16.5, 1, 0], [16.8, 2, 1], [17.15, 1, 2],
          [17.5, 2, 3], [17.85, 1, 4], [18.2, 2, 5],
        ];
        for (const [st, who, hit] of WALL_SHOTS) {
          cues.at(st, `wshot${st}`, (skip) => { if (!skip) fireAt(who, WALL_HITS[hit], c); });
        }
        if (t >= 15.6 && t < 19.5) {
          for (const i of [1, 2]) {
            const cop = set.cops[i];
            if (!cop || cop.userData.dismantled) continue;
            cop.neutral();
            // Cop 1 closes the distance; cop 2 crosses the middle of the room.
            const mark = i === 1
              ? [lerp(3.9, 9.6, seg(t, 15.6, 18.4)), 0, lerp(11.0, 10.2, seg(t, 15.6, 18.4))]
              : [lerp(-7.2, 6.4, seg(t, 15.6, 19.0)), 0, lerp(12.6, 7.6, seg(t, 15.6, 19.0))];
            cop.position.set(mark[0], mark[1], mark[2]);
            cop.aim(new THREE.Vector3(tri.position.x, tri.position.y + 2.4, tri.position.z));
            cop.face(tri.position.x - cop.position.x, tri.position.z - cop.position.z);
            cop.userData.rig.armL.rotation.x = -1.4;
          }
        }

        /* ---------- 32-37: grabs cop & spins, and shoots him ---------- */
        const SPIN_A = 19.45, SPIN_B = 20.7;
        if (t >= 18.55 && t < SPIN_A) {
          // Landing, and closing on him.
          const s = seg(t, 18.55, SPIN_A);
          tri.rotation.set(0, 0, 0);
          tri.position.set(lerp(11.4, 10.6, s), 0, lerp(11.8, 11.0, s));
          tri.crumple(Math.sin(s * Math.PI) * 0.5);
          tri.face(-1, -0.2);
        } else if (t >= SPIN_A && t < 22.25) {
          // 33/34 — she has him by the wrist and they go round together.
          const sp = seg(t, SPIN_A, SPIN_B);
          const ang = ease.io(sp) * Math.PI * 1.9;
          const pivot = new THREE.Vector3(10.1, 0, 10.7);
          const R = 1.15;
          tri.rotation.set(0, 0, 0);
          tri.position.set(pivot.x + Math.sin(ang) * R, 0, pivot.z + Math.cos(ang) * R);
          tri.rotation.y = ang + Math.PI;
          r.armR.rotation.x = -1.5;
          r.armL.rotation.x = -1.35;
          r.armR.rotation.z = -0.5;
          r.armL.rotation.z = 0.45;
          r.torso.rotation.x = -0.24;
          r.legL.rotation.x = Math.sin(t * 14) * 0.45;
          r.legR.rotation.x = -Math.sin(t * 14) * 0.45;

          if (second && !second.userData.dismantled) {
            second.neutral();
            second.position.set(pivot.x - Math.sin(ang) * R, 0, pivot.z - Math.cos(ang) * R);
            second.rotation.y = ang;
            second.rotation.z = 0.24;
            second.userData.rig.torso.rotation.x = 0.2;
            second.userData.rig.armR.rotation.x = -2.3;
            second.userData.rig.armL.rotation.x = -1.1;
            second.userData.rig.legL.rotation.x = 0.5;
            second.userData.rig.legR.rotation.x = -0.4;
          }
        }

        cues.at(SPIN_A, 'grab', (skip) => { if (!skip) c.audio.clatter(3, 0.15, 0.16); });
        // 35/36/37 — point blank.
        cues.at(20.95, 'shootCop', (skip) => {
          const from = new THREE.Vector3(10.4, 4.4, 11.4);
          const to = new THREE.Vector3(9.6, 4.2, 10.2);
          if (!skip) trinityFires(c, from, to);
          takeApart(1, c, [9.7, 4.2, 10.3], skip ? 20 : 38, [-4, 0, -8]);
        });

        /* ---------- 38-39: spins, and kicks the last one in the head ------ */
        if (t >= 22.25 && t < 24.95) {
          const turn = seg(t, 22.25, 23.5);
          const kick = seg(t, 23.5, 24.3);
          tri.position.set(lerp(10.6, 8.6, turn), 0, lerp(11.2, 9.2, turn));
          tri.rotation.y = lerp(Math.PI * 0.6, Math.PI * 1.45, ease.io(Math.max(turn, kick)));
          if (kick > 0) {
            const s = Math.sin(kick * Math.PI);
            tri.position.y = s * 1.5;
            tri.rotation.z = -0.35 * s;
            r.legR.rotation.x = -1.7 * s;
            r.legL.rotation.x = 0.6 * s;
            r.torso.rotation.x = 0.25 * s;
            r.armR.rotation.x = -2.2 * s;
            r.armL.rotation.x = -0.9;
            r.armL.rotation.z = 0.9;
          } else {
            r.torso.rotation.x = -0.2;
            r.armR.rotation.x = -0.9;
            r.armL.rotation.x = -0.7;
          }
        }
        if (t >= 19.0 && t < 24.1 && third && !third.userData.dismantled) {
          third.neutral();
          third.position.set(6.4, 0, 7.6);
          third.face(tri.position.x - 6.4, tri.position.z - 7.6);
          third.aim(new THREE.Vector3(tri.position.x, 4.4, tri.position.z));
          third.userData.rig.armL.rotation.x = -1.4;
        }
        cues.at(24.05, 'headKick', (skip) => {
          if (third && !third.userData.dismantled) {
            const head = third.userData.rig.head;
            if (!skip) detach(head, c, [-14, 12, -10], 24);
          }
          takeApart(2, c, [6.4, 4.4, 7.6], skip ? 22 : 40, [-14, 0, -12]);
          if (!skip) {
            c.audio.crash(0.6);
            c.post.u.uWhite.value = 0.3;
          }
        });

        /* ---------- 40: "Trinity is the only one standing" ---------- */
        if (t >= 24.95) {
          tri.rotation.z = 0;
          tri.position.set(8.0, 0, 8.8);
          tri.neutral();
          const settle = eseg(t, 24.95, 26.6);
          // She turns on the spot, taking it in.
          tri.rotation.y = Math.PI * 1.45 + ease.io(seg(t, 25.0, 27.4)) * Math.PI * 1.1;
          r.armR.rotation.x = lerp(-1.3, -0.45, settle);
          r.armL.rotation.x = lerp(-0.9, -0.2, settle);
          r.armR.rotation.z = lerp(-0.4, -0.12, settle);
          r.armL.rotation.z = lerp(0.4, 0.12, settle);
          const breath = Math.sin(t * (4.6 - settle * 2.6));
          r.torso.rotation.x = -0.16 + breath * 0.07 * (1.2 - settle * 0.6);
          r.torso.position.y = 2.2 + breath * 0.05;
          if (t > 27.0) r.head.rotation.x = 0.18;   // looking at the floor
        }

        cues.at(25.0, 'quiet', (skip) => { if (!skip) c.audio.cue(null); });
        cues.at(25.2, 'shit', (skip) => { if (!skip) c.audio.pulse(0.24); });
        cues.at(27.8, 'torchStop', (skip) => { if (!skip) c.audio.clatter(2, 0.5, 0.06); });

        /* ---------- residue ---------- */
        if (!frozen && t > 4.5 && t < 25 && Math.random() < dt * 4) {
          smoke.puff(
            new THREE.Vector3((Math.random() - 0.5) * 22, 2 + Math.random() * 6, Math.random() * 14),
            { dur: 7, size: 7, vy: 0.7, opacity: 0.09, spread: 0.7 },
          );
        }
        set.copProps.forEach((p, i) => {
          if (!p.dropped) return;
          p.beam.intensity = 450 * (0.9 + 0.1 * noise1(t * 3 + i));
        });

        if (!frozen) c.post.u.uWhite.value *= Math.pow(0.0006, dt);

        /* ---------- camera ---------- */
        if (frozen) {
          // Shot 19: "pan up dolly round". Two hundred degrees around her at
          // six or seven studs, rising the whole way. The lens is the only
          // thing in the room with any momentum left.
          const o = ease.io(seg(t, FREEZE_A, FREEZE_B));
          // 290° → 470° passes through 61°, which is the way she is facing.
          const ang = THREE.MathUtils.degToRad(lerp(290, 470, o));
          const rad = lerp(10.8, 10.2, o);
          c.camera.position.set(
            ORBIT_PIVOT.x + Math.sin(ang) * rad,
            lerp(3.2, 9.0, o),
            ORBIT_PIVOT.z + Math.cos(ang) * rad,
          );
          target.set(APEX.x, APEX.y + 2.4, APEX.z);
          c.camera.lookAt(target);
          if (Math.abs(c.camera.fov - 30) > 0.01) {
            c.camera.fov = 30;
            c.camera.updateProjectionMatrix();
          }
          // Rim light parked opposite the lens for the whole orbit.
          const rimAng = ang + Math.PI;
          fightRim.position.set(
            ORBIT_PIVOT.x + Math.sin(rimAng) * 8.0,
            9.0,
            ORBIT_PIVOT.z + Math.cos(rimAng) * 7.5,
          );
          fightRim.target.position.set(APEX.x, APEX.y + 2.2, APEX.z);
          // No handheld and no shake: the operator is the only thing moving.
          c.post.u.uVignette.value = 1.2 + o * 0.45;
          c.post.u.uAberr.value = 0.22 + Math.sin(o * Math.PI) * 1.1;
          c.post.bloom.strength = 0.34 + Math.sin(o * Math.PI) * 0.16;
        } else {
          camKeys(c.camera, t, CAM, target);
          const chaos = (t > 2.9 && t < 25) ? 0.12 : 0.03;
          shake(c.camera, chaos, t, 16);
          c.post.u.uVignette.value = 1.2;
          c.post.u.uAberr.value = 0.22;
          c.post.bloom.strength = 0.48 + seg(t, 15.6, 18.4) * 0.18 * (1 - seg(t, 20.9, 22.5));
        }

        if (!frozen) {
          tracers.update(dt);
          flashes.update(dt, c.camera);
          sparks.update(dt);
          smoke.update(dt);
        }
      },
    };
  },
};
