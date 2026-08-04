import * as THREE from 'three';
import { abs, absTrans, glow, C } from '../core/materials.js';
import { brickGeo, tileGeo, plateGeo, BRICK_H, PLATE_H } from '../core/legoParts.js';
import { facade, sidewalk, street, streetLamp, wall, railing } from '../core/legoBuild.js';
import { sedan, cruiser, strobe, neonSign } from '../core/props.js';
import { minifig, flashlight } from '../core/minifig.js';
import { Cues, camKeys, ease, seg, eseg, lerp, noise1, shake, handheld } from '../core/anim.js';
import { move, stand, driveAlong, route } from '../core/actor.js';
import { Smoke, lightCone } from '../fx/particles.js';

/**
 * 3  EXT. HEART O' THE CITY HOTEL — NIGHT
 *
 * "A black sedan with tinted windows glides in through the police cruisers."
 * The Agents arrive. They wear dark suits and sunglasses even at night, and
 * they are the only three minifigures in this production whose faces never
 * change expression — which is the point.
 */

const CAM = [
  // Low, in front of it, so what arrives out of the dark is two headlights.
  { t: 0, pos: [17.0, 2.2, -12.0], look: [37, 3.2, 15], fov: 40 },
  { t: 3.4, pos: [16.0, 2.6, -12.0], look: [21, 2.6, 3], fov: 40, ease: ease.io },
  // It stops. Side on, from the hotel steps.
  { t: 5.6, pos: [-6.5, 3.6, -9.5], look: [8.0, 2.4, -3.6], fov: 40, ease: ease.io },
  // Low: three pairs of black shoes arriving on the tarmac.
  { t: 7.6, pos: [-7.0, 1.8, -8.0], look: [4.0, 2.8, -3.0], fov: 42, ease: ease.io },
  { t: 9.4, pos: [-9.5, 6.8, -6.5], look: [5.0, 4.4, -4.0], fov: 40, ease: ease.io },
  { t: 11.4, pos: [-9.5, 5.6, -0.5], look: [0.8, 4.7, -6.0], fov: 36, ease: ease.io },
  { t: 15.0, pos: [-8.0, 5.3, -1.6], look: [0.6, 4.7, -6.2], fov: 34 },
  { t: 19.4, pos: [5.5, 5.2, -1.2], look: [-3.6, 4.7, -8.4], fov: 34, ease: ease.io },
  { t: 23.0, pos: [4.0, 5.1, -2.2], look: [-3.4, 4.7, -8.6], fov: 32 },
  { t: 26.0, pos: [-8.6, 6.2, -3.0], look: [1.0, 4.6, -11.0], fov: 38, ease: ease.io },
  { t: 28.4, pos: [3.2, 5.1, -8.6], look: [-2.2, 4.8, -10.4], fov: 32, ease: ease.io },
  { t: 30.6, pos: [-6.8, 5.0, -6.2], look: [-4.0, 4.6, -9.2], fov: 30, ease: ease.io },
  { t: 32.0, pos: [-6.2, 4.9, -6.6], look: [-4.0, 4.6, -9.3], fov: 29 },
];

export default {
  slug: "3 · Ext. Heart O' The City Hotel",
  start: 80,
  end: 112,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();
    const target = new THREE.Vector3();
    const smoke = new Smoke(group, { pool: 18, color: 0x9aa8a4, size: 9 });

    /* ---------------- the block ---------------- */
    const hotel = facade(120, 40, {
      color: 0x6b4638, seed: 17, litChance: 0.16, spacingX: 7, spacingY: 5, startY: 4,
    });
    hotel.position.set(0, 0, -22);
    group.add(hotel);

    // Ground floor: entrance, boarded windows, and the neon.
    const front = wall(120, 4, { color: 0x4e3a32, seed: 3, openings: [[0, 8, 0, 4 * BRICK_H]] });
    front.position.set(0, 0, -21.4);
    group.add(front);
    const lobby = new THREE.Mesh(new THREE.PlaneGeometry(8, 4 * BRICK_H), glow(0x2a1c10, 0.5));
    lobby.position.set(0, 2.4, -21.9);
    group.add(lobby);

    const sign = neonSign("HEART O' THE CITY", { color: 0xff3a5c, size: 2.2 });
    sign.position.set(-1, 12.5, -20.6);
    sign.scale.setScalar(0.85);
    group.add(sign);

    group.add(street(120, 70));
    const walk = sidewalk(120, { depth: 8 });
    walk.position.set(0, 0, -16);
    group.add(walk);
    const farWalk = sidewalk(120, { depth: 8, seed: 41 });
    farWalk.position.set(0, 0, 34);
    farWalk.rotation.y = Math.PI;
    group.add(farWalk);

    // The other side of the street, so the frame has depth.
    const across = facade(120, 26, { color: 0x4a4a52, seed: 29, litChance: 0.1, simple: true });
    across.position.set(0, 0, 40);
    across.rotation.y = Math.PI;
    group.add(across);

    for (const x of [-38, 4, 44]) {
      const lamp = streetLamp({ h: 17, arm: 5, intensity: 275 });
      lamp.position.set(x, 0, -14);
      lamp.rotation.y = Math.PI;
      group.add(lamp);
    }

    /* ---------------- vehicles ---------------- */
    const cars = [];
    const place = [[-24, 0.2, 3, 0.34], [15, 0.2, 5, -0.42], [-7, 0.2, 14, 0.12], [30, 0.2, -2, 0.6]];
    place.forEach(([x, y, z, ry], i) => {
      const c = cruiser({ seed: i + 1 });
      c.position.set(x, y, z);
      c.rotation.y = ry;
      group.add(c);
      cars.push(c);
    });

    const car = sedan();
    car.position.set(46, 0.2, 20);
    group.add(car);
    const beams = [];
    for (const sx of [-1.9, 1.9]) {
      const b = new THREE.SpotLight(0xfff4e2, 450, 70, Math.PI * 0.16, 0.5, 1.5);
      b.position.set(sx, 2.0, 7.0);
      b.target.position.set(sx * 2, 0, 34);
      car.add(b, b.target);
      beams.push(b);
      const cone = lightCone(22, 2.0, 0xfff0d8, 0.03);
      cone.position.set(sx, 2.0, 7.2);
      car.add(cone);
    }
    // "Glides in through the police cruisers" — a long, unhurried arc.
    const carPath = route([
      [46, 0.2, 20], [34, 0.2, 15], [22, 0.2, 8], [14, 0.2, 0], [8.5, 0.2, -4.2],
    ], 0.4);

    /* ---------------- people ---------------- */
    const agents = ['SMITH', 'BROWN', 'JONES'].map((n, i) => {
      const a = minifig('agent', {
        face: {
          skin: '#e8bb8c', shades: true, earpiece: true,
          mouth: i === 0 ? 'flat' : 'grim',
        },
        hairColor: i === 1 ? 0x1c1712 : 0x2a2018,
      });
      a.name = n;
      group.add(a);
      return a;
    });
    const [smith, brown, jones] = agents;

    const lieut = minifig('lieutenant');
    group.add(lieut);
    const torch = flashlight();
    lieut.hold(torch, 'L', { pos: [0, -0.3, 0.1] });

    const uniforms = [0, 1, 2].map((i) => {
      const u = minifig('cop', {
        face: { skin: '#f2cd37', brow: 'flat', mouth: i ? 'grim' : 'flat', moustache: i === 1 && '#4a3a22' },
      });
      group.add(u);
      return u;
    });

    /* ---------------- light ---------------- */
    const amb = new THREE.HemisphereLight(0x2b3b52, 0x0d1012, 3.0);
    group.add(amb);
    const key = new THREE.DirectionalLight(0x93b6e6, 4.0);
    key.position.set(-40, 50, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 180;
    key.shadow.camera.left = -50;
    key.shadow.camera.right = 50;
    key.shadow.camera.top = 40;
    key.shadow.camera.bottom = -20;
    key.shadow.bias = -0.0018;
    group.add(key, key.target);

    return {
      group, cues,

      enter(c) {
        c.physics.addGround(0);
        c.post.u.uGreen.value = 0.15;
        c.post.u.uVignette.value = 1.05;
        c.post.bloom.strength = 0.408;
        c.audio.bed(true, { root: 46, level: 0.035 });
        c.audio.engine(0.05, 30);
      },

      exit(c) {
        c.audio.bed(false);
        c.audio.stopEngine();
      },

      update(t, dt, c) {
        for (const car of cars) strobe(car, t);
        sign.userData.panel.material.opacity = 0.75 + 0.25 * Math.abs(noise1(t * 3.2));
        sign.userData.light.intensity = 70 + noise1(t * 4) * 30;

        // Steam from the vents, because it is 1998 and this is a city street.
        if (Math.random() < dt * 1.6) {
          smoke.puff(new THREE.Vector3(-16 + Math.random() * 6, 0.4, 8 + Math.random() * 6), {
            dur: 6, size: 8, vy: 2.2, opacity: 0.13, spread: 0.8,
          });
        }

        /* ---------- the sedan arrives ---------- */
        const drive = driveAlong(car, t, 0, 5.4, carPath, { e: ease.io, roll: 0.02 });
        c.audio.engine(drive.moving ? 0.09 : 0.02, drive.moving ? 34 : 24);
        for (const b of beams) b.intensity = 450 * (1 - seg(t, 5.6, 7.2) * 0.75);
        for (const h of car.userData.headlights) {
          h.material.emissiveIntensity = 2.6 * (1 - seg(t, 5.6, 7.2) * 0.7);
        }
        cues.at(5.4, 'stop', (skip) => { if (!skip) c.audio.click(0.1); });

        /* ---------- "AGENT SMITH, AGENT BROWN, and AGENT JONES get out" ---------- */
        // Doors are a bridge too far for a minifigure. They rise from the
        // seats and step clear, which reads exactly the same at this scale.
        const outK = [seg(t, 5.9, 7.3), seg(t, 6.1, 7.5), seg(t, 6.3, 7.7)];
        const seats = [[6.4, -1.0], [11.0, -3.0], [11.0, 0.6]];
        const doorsOut = [[4.2, -2.6], [12.6, -5.0], [13.2, 1.0]];
        agents.forEach((a, i) => {
          const k = ease.io(outK[i]);
          if (k < 1) {
            a.visible = k > 0.02;
            a.position.set(
              lerp(seats[i][0], doorsOut[i][0], k), lerp(-2.4, 0, Math.min(1, k * 1.6)),
              lerp(seats[i][1], doorsOut[i][1], k),
            );
            a.neutral();
            a.rotation.y = lerp(-1.6, -0.9, k);
            a.userData.rig.legL.rotation.x = lerp(1.4, 0, k);
            a.userData.rig.legR.rotation.x = lerp(1.1, 0, k);
            a.userData.rig.torso.rotation.x = lerp(0.2, 0, k);
          } else {
            a.visible = true;
          }
        });
        cues.at(6.4, 'doors', (skip) => { if (!skip) { c.audio.click(0.12); c.audio.click(0.1); } });

        /* ---------- they walk over ---------- */
        // Smith leads. Brown and Jones flank, one step behind, always.
        move(smith, t, 7.6, 10.6, [4.2, 0, -2.6], [0.9, 0, -6.4], { mode: 'walk', speed: 0.85 });
        move(brown, t, 7.9, 11.0, [12.6, 0, -5.0], [4.4, 0, -8.6], { mode: 'walk', speed: 0.85 });
        move(jones, t, 8.1, 11.2, [13.2, 0, 1.0], [5.6, 0, -4.2], { mode: 'walk', speed: 0.85 });

        if (t > 10.6 && t < 25.6) {
          smith.neutral();
          smith.face(-1, -0.25);
          smith.idle(t, { breath: 0.5 });
          smith.lookAtPoint(new THREE.Vector3(-4, 4.6, -9.2));
        }
        if (t > 11.0 && t < 25.8) {
          brown.neutral(); brown.face(-1, -0.4); brown.idle(t * 0.8, { breath: 0.4 });
        }
        if (t > 11.2) {
          jones.neutral(); jones.face(-1, -0.5); jones.idle(t * 0.9, { breath: 0.4 });
        }

        /* ---------- the Lieutenant ---------- */
        lieut.position.set(-4, 0, -9.2);
        lieut.rotation.y = 1.35;
        lieut.neutral();
        lieut.idle(t * 1.1, { breath: 0.8 });
        lieut.lookAtPoint(new THREE.Vector3(0.9, 4.6, -6.4));

        // "You gimme that Juris-my dick-tion and you can cram it up your ass."
        // He gestures. Repeatedly. With one arm, because he has a torch in
        // the other and no intention of putting it down.
        const rant = seg(t, 13.7, 18.7);
        if (rant > 0 && rant < 1) {
          const g = Math.sin(t * 6.4);
          lieut.userData.rig.armR.rotation.x = -0.7 - g * 0.55;
          lieut.userData.rig.armR.rotation.z = -0.4;
          lieut.userData.rig.torso.rotation.y = 0.1 + g * 0.12;
          lieut.userData.rig.head.rotation.x = -0.08 + g * 0.06;
        }
        // The Lieutenant laughs.
        const laugh = seg(t, 21.6, 23.4);
        if (laugh > 0 && laugh < 1) {
          const l = Math.sin(t * 13);
          lieut.userData.rig.torso.rotation.x = -0.12 + l * 0.1;
          lieut.userData.rig.head.rotation.x = 0.16 + l * 0.08;
        }

        uniforms.forEach((u, i) => {
          const pos = [[-16, 0, -8.4], [-21, 0, -5.2], [9, 0, -12.6]][i];
          stand(u, t * (0.8 + i * 0.15), pos, [1.1, 0.7, -1.9][i]);
        });

        /* ---------- "Agent Smith nods to Agent Brown" ---------- */
        cues.at(25.6, 'nod', () => {});
        const nod = seg(t, 25.6, 26.4);
        if (nod > 0 && nod < 1) {
          smith.userData.rig.head.rotation.x = Math.sin(nod * Math.PI) * 0.28;
          smith.face(-0.4, -1);
        }
        // "...as they start toward the hotel."
        move(smith, t, 26.4, 31.4, [0.9, 0, -6.4], [-2.4, 0, -13.6], { mode: 'walk', speed: 0.7 });
        move(brown, t, 26.7, 31.6, [4.4, 0, -8.6], [1.6, 0, -14.2], { mode: 'walk', speed: 0.7 });

        // "No, Lieutenant, your men are already dead." Smith stops, turns
        // his head only, and delivers it over his shoulder.
        const turn = seg(t, 28.2, 29.0);
        if (t > 28.2) {
          smith.userData.rig.head.rotation.y = -1.1 * ease.io(turn) * (1 - seg(t, 31.0, 31.6));
        }

        // The Lieutenant hears it. He does not turn around.
        if (t > 29.6) {
          const dread = eseg(t, 29.8, 31.6);
          lieut.userData.rig.head.rotation.y = lerp(1.0, 0.1, dread);
          lieut.userData.rig.head.rotation.x = lerp(0, 0.12, dread);
          lieut.userData.rig.torso.rotation.x = lerp(0, 0.06, dread);
        }

        cues.at(28.2, 'sting', (skip) => { if (!skip) c.audio.pulse(0.4); });
        cues.at(30.4, 'sting2', (skip) => { if (!skip) c.audio.pulse(0.28); });

        camKeys(c.camera, t, CAM, target);
        handheld(c.camera, t, 0.03);
        shake(c.camera, 0.012, t, 5);
        smoke.update(dt);
      },
    };
  },
};
