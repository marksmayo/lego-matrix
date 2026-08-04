import * as THREE from 'three';
import { hotelSet } from '../sets/hotel.js';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp, noise1, shake } from '../core/anim.js';
import { move, stand } from '../core/actor.js';
import { shatterInto } from '../core/physics.js';
import { Smoke, Sparks } from '../fx/particles.js';
import { brickGeo, BRICK_H } from '../core/legoParts.js';
import { abs } from '../core/materials.js';

/**
 * 2  INT. HEART O' THE CITY HOTEL — NIGHT
 *
 * Four torches down a burnt corridor, a door coming off its hinges, and a
 * woman who has not stopped typing. The door is the first real physics beat:
 * it doesn't swing, it disassembles — nine courses of brick going in nine
 * different directions.
 */

const T_KICK = 7.8;          // local time the boot lands (global 70.8)
const DOOR_BRICK = brickGeo(2, 1, BRICK_H);

const CAM = [
  // Following them down the hall, hand-held, from behind.
  { t: 0, pos: [-34, 5.6, 24.5], look: [-24, 4.4, 20.5], fov: 42 },
  { t: 4.2, pos: [-16.5, 5.4, 24.2], look: [-5, 4.2, 19.5], fov: 42, ease: ease.io },
  // Swing round to see them stack either side of 303.
  { t: 6.6, pos: [-9.5, 4.4, 25.6], look: [0.5, 3.6, 17.5], fov: 40, ease: ease.io },
  { t: 7.6, pos: [-7.2, 3.6, 23.4], look: [0, 3.4, 16], fov: 38, ease: ease.out },
  // Inside the room, low, as the door comes in.
  { t: 7.85, pos: [2.6, 3.2, 5.4], look: [0, 3.8, 15.2], fov: 46, ease: ease.linear },
  { t: 10.4, pos: [5.5, 4.4, 2.5], look: [-1, 3.4, 12.5], fov: 44, ease: ease.io },
  // Push in on Trinity, still at the keyboard. Across the empty +X half of the
  // room: her back is to the door and the desk is in the way on the other
  // side, so this is the one clear line onto her.
  { t: 12.0, pos: [8.0, 5.9, -8.5], look: [-3.4, 4.5, -1.8], fov: 40, ease: ease.io },
  { t: 15.6, pos: [5.6, 5.4, -6.4], look: [-3.45, 4.45, -1.7], fov: 32, ease: ease.io },
  { t: 17.0, pos: [4.9, 5.3, -5.6], look: [-3.5, 4.45, -1.7], fov: 28, ease: ease.io },
];

export default {
  slug: "2 · Int. Heart O' The City Hotel",
  start: 63,
  end: 80,
  hardIn: true,

  build(ctx) {
    const set = hotelSet();
    const group = new THREE.Group();
    const cues = new Cues();
    const smoke = new Smoke(group, { pool: 14, color: 0x6a7068, size: 7 });
    const sparks = new Sparks(group, { max: 260, size: 0.3 });
    const target = new THREE.Vector3();

    return {
      group, cues,

      enter(c) {
        c.scene.add(set.group);
        set.reset();
        set.addColliders(c.physics);
        sparks.reset();
        c.post.u.uGreen.value = 0.13;
        c.post.u.uVignette.value = 1.15;
        c.post.bloom.strength = 0.372;
        c.audio.cue('creep');
      },

      exit(c) {
        c.scene.remove(set.group);
        c.audio.cue(null);
        c.post.u.uWhite.value = 0;
      },

      reseek(t) {
        if (t > T_KICK) {
          set.door303.userData.slab.visible = false;
          set.state.doorOpen = true;
        }
      },

      update(t, dt, c) {
        // The white blowout handed over from the previous scene decays into
        // the first torch beam.
        c.post.u.uWhite.value = Math.max(0, 1 - seg(t, 0, 0.7)) * 0.9;
        set.tickLights(t + 20);

        const cops = set.cops;
        const [big, second, third, fourth] = cops;

        /* ---------- the approach ---------- */
        // "We FOLLOW four armed POLICE OFFICERS using flashlights as they
        // creep down the blackened hall."
        move(big, t, 0.2, 6.2, [-30, 0, 20.2], [-3.2, 0, 18.6], { mode: 'creep', e: ease.io });
        move(second, t, 0.6, 6.6, [-33, 0, 22.6], [3.2, 0, 18.6], { mode: 'creep', e: ease.io });
        move(third, t, 1.1, 7.0, [-36, 0, 19.4], [-6.4, 0, 21.4], { mode: 'creep', e: ease.io });
        move(fourth, t, 1.5, 7.2, [-39, 0, 23.2], [6.2, 0, 21.6], { mode: 'creep', e: ease.io });

        // Ready themselves on either side of the door.
        if (t > 6.2 && t < T_KICK) {
          for (const cop of cops) {
            cop.face(0, -1);
            cop.userData.rig.torso.rotation.x = -0.1;
          }
          big.face(0.25, -1);
          second.face(-0.25, -1);
        }

        /* ---------- the kick ---------- */
        // Wind-up, then "The biggest of them violently kicks in the door."
        if (t > 6.9 && t < T_KICK) {
          const w = seg(t, 6.9, T_KICK);
          big.userData.rig.legR.rotation.x = -1.5 * Math.pow(w, 3);
          big.userData.rig.torso.rotation.x = -0.1 - 0.25 * w;
          big.position.z = 18.6 + w * 0.4;
        } else if (t >= T_KICK && t < 8.8) {
          const k = seg(t, T_KICK, 8.5);
          big.userData.rig.legR.rotation.x = lerp(-1.5, 0.55, ease.outQuint(k));
          big.position.z = 19.0 - k * 0.5;
        }

        cues.at(T_KICK, 'kick', (skip) => {
          set.state.doorOpen = true;
          const slab = set.door303.userData.slab;
          const box = new THREE.Box3(
            new THREE.Vector3(-3.2, 0.2, 14.2),
            new THREE.Vector3(2.6, 9 * BRICK_H, 15.4),
          );
          slab.visible = false;
          if (skip) return;
          // Nine courses of brick, all of them leaving.
          shatterInto(c.physics, group, DOOR_BRICK, abs(0x5b3f2f), 30, box, {
            vel: [0, 4, -18], spread: 10, spin: 16, life: 12,
          });
          c.audio.kick();
          sparks.emit(new THREE.Vector3(0, 5, 14.6), 40, {
            speed: 22, color: [0.7, 0.55, 0.35], ttl: 0.7, up: 0.5,
          });
          for (let i = 0; i < 3; i++) {
            smoke.puff(new THREE.Vector3((Math.random() - 0.5) * 5, 2 + i * 2, 14 - i), {
              dur: 4.5, size: 6, vy: 1.4, opacity: 0.3,
            });
          }
        });

        /* ---------- "the other cops pour in behind him" ---------- */
        move(big, t, 8.9, 10.6, [-3.2, 0, 18.5], [-1.6, 0, 10.4], { mode: 'walk', speed: 1.5 });
        if (t < 10.1) {
          move(second, t, 9.1, 10.1, [3.2, 0, 18.6], [1.8, 0, 15.4], { mode: 'walk', speed: 1.5 });
        } else {
          move(second, t, 10.1, 11.0, [1.8, 0, 15.4], [3.8, 0, 11.2], { mode: 'walk', speed: 1.5 });
        }
        // Through the doorway, not through the wall either side of it: the
        // opening is only six studs wide and centred on x = 0.
        if (t < 10.5) {
          move(third, t, 9.5, 10.5, [-6.4, 0, 21.4], [-1.6, 0, 15.4], { mode: 'walk', speed: 1.4 });
        } else {
          move(third, t, 10.5, 11.6, [-1.6, 0, 15.4], [-7.2, 0, 12.6], { mode: 'walk', speed: 1.4 });
        }
        if (t < 10.8) {
          move(fourth, t, 9.8, 10.8, [6.2, 0, 21.6], [1.6, 0, 15.4], { mode: 'walk', speed: 1.4 });
        } else {
          move(fourth, t, 10.8, 11.9, [1.6, 0, 15.4], [8.0, 0, 13.4], { mode: 'walk', speed: 1.4 });
        }

        // "guns thrust before them" — everyone on the woman at the desk.
        const aimPoint = new THREE.Vector3(-3.4, 4.6, -6.0);
        if (t > 10.4) {
          for (const cop of cops) {
            cop.neutral();
            cop.aim(aimPoint, 1);
            cop.face(aimPoint.x - cop.position.x, aimPoint.z - cop.position.z);
            cop.userData.rig.armL.rotation.x = -1.35;   // torch hand braces the gun
          }
        }
        // Torch beams jitter with the adrenaline.
        set.copProps.forEach((p, i) => {
          if (p.beam) p.beam.intensity = (i < 2 ? 650 : 300) * (0.82 + 0.18 * noise1(t * 6 + i * 3));
        });

        cues.at(9.0, 'shout1', (skip) => { if (!skip) c.audio.clatter(3, 0.2, 0.1); });

        /* ---------- Trinity ---------- */
        // Sitting there, her hands still on the keyboard.
        const tri = set.trinity;
        tri.position.set(-3.5, 0, -1.6);
        tri.rotation.y = Math.PI + 0.18;
        tri.neutral();
        const handsUp = seg(t, 14.2, 16.6);
        if (handsUp <= 0) {
          tri.sitType(t, t < 11.6);
        } else {
          // "She slowly puts her hands behind her head."
          tri.sitType(t, false);
          tri.handsUp(handsUp);
          tri.userData.rig.head.rotation.x = -0.1 * ease.io(handsUp);
        }
        if (t < 11.6 && Math.random() < dt * 12) c.audio.keyClick();
        cues.at(11.6, 'stopType', (skip) => { if (!skip) c.audio.click(0.08); });

        /* ---------- camera ---------- */
        camKeys(c.camera, t, CAM, target);
        // Operated, not floating: more shake while they move, less on Trinity.
        const rough = t < 7 ? 0.05 : t < 12 ? 0.09 : 0.015;
        shake(c.camera, rough * (1 + (t > T_KICK && t < T_KICK + 0.6 ? 3 : 0)), t, 9);

        smoke.update(dt);
        sparks.update(dt);
      },
    };
  },
};
