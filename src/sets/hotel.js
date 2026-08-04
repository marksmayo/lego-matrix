import * as THREE from 'three';
import { abs, absTrans, glow, C } from '../core/materials.js';
import { brickGeo, plateGeo, tileGeo, instanced, BRICK_H, PLATE_H } from '../core/legoParts.js';
import { wall, tiledFloor, baseplate, railing } from '../core/legoBuild.js';
import { workstation, door, glassPane, bareBulb, neonSign } from '../core/props.js';
import { minifig, flashlight, pistol, cuffs, handset, disassemble } from '../core/minifig.js';
import { lightCone } from '../fx/particles.js';
import { rng } from '../core/anim.js';

/**
 * INT. HEART O' THE CITY HOTEL — the burnt-out floor and Room 303.
 *
 * Shared by four acts (the arrest, the fight, the call to the Operator, and
 * the run for the fire escape), so it's built once and kept. Each act resets
 * the actors on entry and drives them from its own local clock.
 *
 * Layout, looking down:
 *
 *        −X ←──────────── hall (z = +16 … +28) ────────────→ +X
 *                        ┌──── doorway (x = 0) ────┐
 *        ┌───────────────┴─────────────────────────┴────────┐  z = +15
 *        │                  ROOM 303                        │
 *        │   [table + powerbook]        window → fire escape │
 *        └──────────────────────────────────────────────────┘  z = −15
 */

const ROOM_W = 34, ROOM_D = 30, COURSES = 13;
const HALL_Z0 = 15, HALL_Z1 = 28;
const DOOR_W = 6;
export const WINDOW_POS = new THREE.Vector3(-11, 7.5, -15);

let cached = null;

export function hotelSet() {
  if (cached) return cached;

  const group = new THREE.Group();
  const rand = rng(4242);
  const colliders = [];
  const push = (pos, size) => colliders.push([pos, size]);

  /* ---------- floors ---------- */
  const carpet = tiledFloor(ROOM_W, ROOM_D, {
    color: 0x4a2f28, seed: 8, tileSize: 4, missing: 0.06,
  });
  group.add(carpet);
  // Scorched patches where the fire licked across the polyester.
  const burn = tiledFloor(ROOM_W, ROOM_D, {
    color: 0x141310, seed: 19, tileSize: 2, missing: 0.86, y: PLATE_H * 0.3,
  });
  group.add(burn);
  push([0, -0.5, 0], [ROOM_W, 1, ROOM_D]);

  const hallFloor = tiledFloor(72, HALL_Z1 - HALL_Z0, {
    color: 0x3d2a24, seed: 12, tileSize: 4, missing: 0.03,
  });
  hallFloor.position.z = (HALL_Z0 + HALL_Z1) / 2;
  group.add(hallFloor);
  push([0, -0.5, (HALL_Z0 + HALL_Z1) / 2], [72, 1, HALL_Z1 - HALL_Z0]);

  /* ---------- room walls ---------- */
  const mkWall = (len, x, z, ry, openings, opts = {}) => {
    const w = wall(len, COURSES, {
      color: 0x8f8778, seed: 30 + len + x, sootTop: 0.85, variation: 0.14,
      openings, ...opts,
    });
    w.position.set(x, 0, z);
    w.rotation.y = ry;
    group.add(w);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [p, sz] of w.userData.colliders) {
      push([x + p[0] * c, p[1], z - p[0] * s], [Math.abs(sz[0] * c) + Math.abs(sz[2] * s), sz[1], Math.abs(sz[0] * s) + Math.abs(sz[2] * c)]);
    }
    return w;
  };

  // Back wall with the window Trinity later leaves through.
  mkWall(ROOM_W, 0, -ROOM_D / 2, 0, [[-11, 5, 4 * BRICK_H, 5 * BRICK_H]]);
  mkWall(ROOM_D, -ROOM_W / 2, 0, Math.PI / 2, []);
  mkWall(ROOM_D, ROOM_W / 2, 0, Math.PI / 2, []);
  // Door wall, between room and hall.
  mkWall(ROOM_W, 0, ROOM_D / 2, 0, [[0, DOOR_W, 0, 9 * BRICK_H]]);
  // Far side of the hall, with two other room doors.
  mkWall(72, 0, HALL_Z1, 0, [[-18, 5, 0, 9 * BRICK_H], [20, 5, 0, 9 * BRICK_H]], { color: 0x7d7466 });

  // Window glazing — a single pane, kept so Act H can smash it.
  const windowFrame = new THREE.Group();
  const pane = glassPane(4.7, 5.6 * BRICK_H * 0.98, { opacity: 0.17 });
  pane.position.copy(WINDOW_POS);
  pane.position.z += 0.1;
  windowFrame.add(pane);
  const sill = new THREE.Mesh(tileGeo(6, 2), abs(0x6e665a));
  sill.position.set(-11, 4 * BRICK_H - PLATE_H, -ROOM_D / 2 + 0.4);
  windowFrame.add(sill);
  group.add(windowFrame);

  /* ---------- ceiling with shadow patterns ---------- */
  const ceilY = COURSES * BRICK_H;
  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_W, PLATE_H, ROOM_D),
    abs(0x2a2622, { roughness: 0.85 }),
  );
  ceil.position.y = ceilY + PLATE_H / 2;
  group.add(ceil);
  // "Patterns of permanent shadow": soot fingers reaching across the ceiling.
  const soot = [];
  for (let i = 0; i < 40; i++) {
    soot.push([
      (rand() - 0.5) * (ROOM_W - 4), ceilY - PLATE_H,
      (rand() - 0.5) * (ROOM_D - 4), 0,
      new THREE.Color(0x0d0c0b).lerp(new THREE.Color(0x3a332c), rand()).getHex(),
    ]);
  }
  group.add(instanced(tileGeo(2, 2), abs(0x18160f), soot));

  const hallCeil = new THREE.Mesh(
    new THREE.BoxGeometry(72, PLATE_H, HALL_Z1 - HALL_Z0),
    abs(0x201d1a, { roughness: 0.9 }),
  );
  hallCeil.position.set(0, ceilY + PLATE_H / 2, (HALL_Z0 + HALL_Z1) / 2);
  group.add(hallCeil);

  /* ---------- Room 303's door ---------- */
  const door303 = door(DOOR_W - 0.4, 9, 0x5b3f2f);
  door303.position.set(-DOOR_W / 2 + 0.2, 0, ROOM_D / 2 - 0.1);
  group.add(door303);

  /* ---------- practicals ---------- */
  // Emergency exit sign at the end of the hall — the only ambient light.
  const exitSign = new THREE.Group();
  const exitBox = new THREE.Mesh(brickGeo(4, 1, BRICK_H * 2), abs(C.trueBlack));
  const exitFace = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), glow(0x33ff66, 2.4));
  exitFace.position.set(0, BRICK_H, 0.62);
  exitSign.add(exitBox, exitFace);
  exitSign.position.set(-31, ceilY - 3, HALL_Z1 - 1.2);
  const exitLight = new THREE.PointLight(0x40ff80, 80, 40, 2);
  exitLight.position.set(-31, ceilY - 3, HALL_Z1 - 3);
  group.add(exitSign, exitLight);

  const bulb = bareBulb();
  bulb.position.set(14, ceilY, HALL_Z0 + 6);
  group.add(bulb);

  // Moonlight through the window, and a cold fill from the street.
  const moon = new THREE.DirectionalLight(0x9fc4ff, 5.2);
  moon.position.set(-26, 24, -46);
  moon.target.position.set(-4, 4, 4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 140;
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -20;
  moon.shadow.bias = -0.0016;
  group.add(moon, moon.target);

  const ambient = new THREE.HemisphereLight(0x2a3a4a, 0x0a0c0e, 2.7);
  group.add(ambient);

  const windowGlow = new THREE.PointLight(0x8fb4ff, 110, 40, 2);
  windowGlow.position.set(-11, 8, -12);
  group.add(windowGlow);

  /* ---------- workstation ---------- */
  const desk = workstation();
  desk.position.set(-3.5, 0, -7);
  desk.rotation.y = 0.18;
  group.add(desk);
  push([-3.5, desk.userData.tableH - 0.3, -7], [10, 0.6, 6]);

  /* ---------- actors ---------- */
  const trinity = minifig('trinity');
  group.add(trinity);

  const cops = [];
  const copProps = [];
  const buildCops = () => {
    for (const c of cops) {
      if (c.parent) c.parent.remove(c);
    }
    cops.length = 0;
    copProps.length = 0;
    for (let i = 0; i < 4; i++) {
      const big = i === 0;
      const cop = minifig('cop', big ? {
        face: { skin: '#f2cd37', brow: 'angry', mouth: 'shout', moustache: '#2b2b2b' },
      } : {
        face: {
          skin: '#f2cd37', brow: i % 2 ? 'angry' : 'flat',
          mouth: i % 2 ? 'grim' : 'shout', moustache: i === 2 ? '#6b4a2a' : false,
          sweat: i === 3,
        },
      });
      if (big) cop.scale.setScalar(1.1);
      const torch = flashlight();
      cop.hold(torch, 'L', { rot: [0, 0, 0], pos: [0, -0.3, 0.1] });
      const cone = lightCone(17, 1.5, 0xfff2d0, 0.05);
      torch.add(cone);
      const beam = new THREE.SpotLight(0xfff2d8, i < 2 ? 650 : 0, 60, Math.PI * 0.16, 0.45, 1.5);
      beam.position.set(0, 0, 1.3);
      beam.target.position.set(0, 0, 30);
      torch.add(beam, beam.target);

      const gun = pistol();
      cop.hold(gun, 'R', { rot: [0, 0, 0], pos: [0, -0.3, 0.12] });

      group.add(cop);
      cops.push(cop);
      copProps.push({ torch, cone, beam, gun, big });
    }
  };
  buildCops();

  const agents = ['smith', 'brown', 'jones'].map((n, i) => {
    const a = minifig('agent', {
      face: { skin: '#e8bb8c', shades: true, mouth: i === 0 ? 'flat' : 'grim', earpiece: true },
    });
    a.visible = false;
    group.add(a);
    return a;
  });

  /* ---------- state ---------- */
  const state = {
    doorOpen: false,
    copsDown: false,
  };

  const set = {
    group, colliders, trinity, cops, copProps, agents, desk, door303,
    pane, windowFrame, bulb, exitSign, exitLight, moon, windowGlow,
    ROOM_W, ROOM_D, COURSES, HALL_Z0, HALL_Z1, DOOR_W, ceilY,
    state,

    /** Wire the room into the solver. */
    addColliders(physics) {
      for (const [p, s] of colliders) physics.addStatic(p, s);
    },

    /** Put every actor and prop back to its scene-2 position. */
    reset() {
      state.doorOpen = false;
      state.copsDown = false;
      door303.visible = true;
      door303.rotation.y = 0;
      door303.userData.slab.visible = true;
      pane.visible = true;
      if (cops.some((c) => c.userData.dismantled)) buildCops();
      for (const c of cops) {
        c.visible = true;
        c.neutral();
      }
      for (const a of agents) { a.visible = false; a.neutral(); }
      trinity.visible = true;
      trinity.neutral();
      trinity.position.set(-3.5, 0, -1.6);
      trinity.rotation.y = Math.PI + 0.18;
      desk.userData.chair.visible = true;
    },

    /** Take a cop apart. */
    dropCop(i, physics, origin, force = 44) {
      const cop = cops[i];
      if (!cop || cop.userData.dismantled) return null;
      const p = copProps[i];
      p.beam.intensity = 0;
      p.cone.visible = false;
      return disassemble(cop, physics, { origin, force });
    },

    /** Flicker the practicals. Called every frame by whichever act is up. */
    tickLights(t) {
      const f = 0.72 + 0.28 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 1.7 + 1.2));
      set.bulb.userData.light.intensity = 90 * f;
      set.bulb.userData.bulb.material.emissiveIntensity = 0.62 * f;
      set.bulb.rotation.z = Math.sin(t * 0.9) * 0.04;
      set.exitLight.intensity = 70 + Math.sin(t * 31) * 10;
      const scr = desk.userData;
      scr.screen.material.emissiveIntensity = 0.5 + Math.sin(t * 9.1) * 0.05;
      scr.screenLight.intensity = 55 + Math.sin(t * 7.3) * 8;
      scr.leds.forEach((l, i) => {
        l.material.emissiveIntensity = ((t * (3 + i)) % 1 > 0.5 ? 1.0 : 0.1);
      });
    },
  };

  set.reset();
  cached = set;
  return set;
}
