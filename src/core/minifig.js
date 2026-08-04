import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { abs, pvc, chrome, printed, glow, C } from './materials.js';
import { studGeo, barGeo, handGeo, nonIndexed } from './legoParts.js';
import { makeFace, makeTorsoPrint } from './faces.js';
import { clamp, lerp, ease } from './anim.js';

/**
 * The minifigure.
 *
 * Real proportions, in stud units (1 u = 8 mm). A minifig is 40 mm to the top
 * of the head, which is 5 u — so it stands exactly as tall as four bricks plus
 * a plate, which is the joke LEGO has been making since 1978.
 *
 *   feet .............. y = 0.00
 *   hip joint ......... y = 1.40   (legs pivot here, LEGO has no knees)
 *   waist / torso base  y = 2.20
 *   shoulder .......... y = 3.95
 *   neck .............. y = 4.25
 *   top of head ....... y = 5.65
 *
 * Every part is a separate mesh, listed on `fig.parts`, because the whole
 * point of casting minifigures as stunt performers is that they come apart.
 */

export const HIP_Y = 1.4;
export const TORSO_Y = 2.2;
export const SHOULDER_Y = 1.75;   // local to torso
export const NECK_Y = 2.05;       // local to torso
export const FIG_H = 5.65;

/** Merges only accept all-indexed or all-non-indexed input. Flatten first. */
const flat = (parts) => parts.map(nonIndexed);

const geoCache = new Map();
const memo = (k, f) => {
  let g = geoCache.get(k);
  if (!g) { g = f(); geoCache.set(k, g); }
  return g;
};

/** Box with a different width/depth at the top — the minifig torso taper. */
function taperedBox(wb, wt, h, db, dt) {
  const g = new THREE.BoxGeometry(wb, h, db, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * (wt / wb));
      p.setZ(i, p.getZ(i) * (dt / db));
    }
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}

function torsoGeo() {
  return memo('torso', () => taperedBox(2.02, 1.5, 2.0, 1.06, 0.92));
}

/** Arm: shoulder ball, upper, elbow, forearm — pivot at the shoulder. */
function armGeo() {
  return memo('arm', () => {
    const shoulder = new THREE.SphereGeometry(0.31, 14, 10);
    const upper = new THREE.BoxGeometry(0.42, 0.78, 0.46);
    upper.translate(0, -0.38, 0.02);
    const elbow = new THREE.SphereGeometry(0.235, 12, 8);
    elbow.translate(0, -0.72, 0.08);
    const fore = new THREE.BoxGeometry(0.4, 0.6, 0.43);
    fore.rotateX(-0.62);
    fore.translate(0, -0.94, 0.26);
    const g = mergeGeometries(flat([shoulder, upper, elbow, fore]));
    g.computeVertexNormals();
    return g;
  });
}
const WRIST = new THREE.Vector3(0, -1.16, 0.42);

/** Leg + moulded foot. Pivots at the hip, hangs down. */
function legGeo() {
  return memo('leg', () => {
    const shin = new THREE.BoxGeometry(0.94, 1.36, 1.02);
    shin.translate(0, -0.68, -0.02);
    const foot = new THREE.BoxGeometry(0.94, 0.4, 1.38);
    foot.translate(0, -1.18, 0.18);
    const hipTop = new THREE.CylinderGeometry(0.47, 0.47, 0.92, 12);
    hipTop.rotateZ(Math.PI / 2);
    hipTop.translate(0, -0.02, -0.02);
    const g = mergeGeometries(flat([shin, foot, hipTop]));
    g.computeVertexNormals();
    return g;
  });
}

function hipsGeo() {
  return memo('hips', () => {
    const block = new THREE.BoxGeometry(2.0, 0.8, 1.04);
    block.translate(0, 0.4, 0);
    const g = mergeGeometries(flat([block]));
    g.computeVertexNormals();
    return g;
  });
}

function headGeo() {
  return memo('head', () => {
    const g = new THREE.CylinderGeometry(0.79, 0.79, 1.4, 28, 1);
    g.translate(0, 0.7, 0);
    return g;
  });
}

/** Hair and headgear. */
function hairGeo(kind) {
  return memo('hair:' + kind, () => {
    if (kind === 'cap') {
      const crown = new THREE.CylinderGeometry(0.84, 0.86, 0.46, 22);
      crown.translate(0, 0.23, 0);
      const top = new THREE.SphereGeometry(0.84, 22, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
      top.scale(1, 0.5, 1);
      top.translate(0, 0.44, 0);
      const peak = new THREE.CylinderGeometry(0.82, 0.82, 0.11, 20, 1, false, -Math.PI * 0.42, Math.PI * 0.84);
      peak.scale(1, 1, 1.42);
      peak.translate(0, 0.06, 0.26);
      const g = mergeGeometries(flat([crown, top, peak]));
      g.computeVertexNormals();
      return g;
    }
    if (kind === 'slick') {
      // Trinity: flat, severe, swept back and gathered at the nape.
      const cap = new THREE.SphereGeometry(0.845, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.66);
      cap.scale(1.0, 0.92, 1.06);
      const nape = new THREE.BoxGeometry(0.62, 0.66, 0.5);
      nape.rotateX(0.28);
      nape.translate(0, -0.34, -0.66);
      const sides = new THREE.BoxGeometry(1.74, 0.62, 0.9);
      sides.translate(0, -0.3, -0.16);
      const g = mergeGeometries(flat([cap, sides, nape]));
      g.computeVertexNormals();
      return g;
    }
    if (kind === 'combed') {
      // Agents: short, parted, immovable.
      const cap = new THREE.SphereGeometry(0.85, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
      cap.scale(1.0, 0.88, 1.04);
      const back = new THREE.BoxGeometry(1.7, 0.5, 1.1);
      back.translate(0, -0.22, -0.2);
      const fringe = new THREE.BoxGeometry(1.5, 0.34, 0.34);
      fringe.rotateX(-0.2);
      fringe.translate(0, 0.1, 0.62);
      const g = mergeGeometries(flat([cap, back, fringe]));
      g.computeVertexNormals();
      return g;
    }
    // buzz / short
    const cap = new THREE.SphereGeometry(0.83, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    cap.scale(1, 0.8, 1.02);
    const back = new THREE.BoxGeometry(1.66, 0.34, 1.0);
    back.translate(0, -0.14, -0.24);
    const g = mergeGeometries(flat([cap, back]));
    g.computeVertexNormals();
    return g;
  });
}

function shadesGeo() {
  return memo('shades', () => {
    const band = new THREE.TorusGeometry(0.8, 0.085, 6, 18, Math.PI * 0.86);
    band.scale(1, 0.52, 1);
    band.rotateX(Math.PI / 2);
    band.rotateY(-Math.PI * 0.43 + Math.PI / 2);
    const g = mergeGeometries(flat([band]));
    g.computeVertexNormals();
    return g;
  });
}

/* ------------------------------------------------------------------ */
/* held props                                                          */
/* ------------------------------------------------------------------ */

export function pistol(matBody = abs(C.trueBlack)) {
  const g = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.2), matBody);
  grip.rotation.x = 0.24;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.62), matBody);
  body.position.set(0, 0.32, 0.18);
  const barrel = new THREE.Mesh(barGeo(0.34, 0.062), chrome(C.silver));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.34, 0.5);
  g.add(grip, body, barrel);
  g.userData.muzzle = new THREE.Vector3(0, 0.34, 0.72);
  return g;
}

export function flashlight() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(barGeo(0.95, 0.14), abs(C.black));
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.06;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.3, 14), abs(C.darkGrey));
  head.rotation.x = Math.PI / 2;
  head.position.z = 1.12;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), glow(0xfff3d0, 3.2));
  lens.position.z = 1.28;
  g.add(body, head, lens);
  g.userData.lens = lens;
  return g;
}

export function handset() {
  const g = new THREE.Group();
  const m = abs(C.trueBlack);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 1.15), m);
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), m);
  ear.position.set(0, -0.06, 0.56);
  const mouth = ear.clone();
  mouth.position.z = -0.56;
  g.add(bar, ear, mouth);
  return g;
}

export function cuffs() {
  const g = new THREE.Group();
  const m = chrome(C.silver);
  for (const x of [-0.16, 0.16]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 14), m);
    r.position.x = x;
    r.rotation.y = Math.PI / 2;
    g.add(r);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* the figure                                                          */
/* ------------------------------------------------------------------ */

const PRESET = {
  trinity: {
    // A shade lighter than LEGO black so the clearcoat has something to lift:
    // patent vinyl reads as black plus a hard white edge, never as flat black.
    legs: 0x0b0d10, hips: 0x0b0d10, torso: 0x0b0d10, arms: 0x0b0d10,
    hands: 0x0b0d10, head: 0xf0d9b8, hair: 'slick', hairColor: 0x0d0f12,
    material: 'pvc', torsoPrint: 'trinity',
    face: { skin: '#f0d9b8', brow: 'flat', mouth: 'set', lips: '#8d3b48' },
  },
  agent: {
    legs: 0x22282e, hips: 0x22282e, torso: 0x22282e, arms: 0x22282e,
    hands: 0xd9b48c, head: 0xe8bb8c, hair: 'combed', hairColor: 0x2a2018,
    torsoPrint: 'agent',
    face: { skin: '#e8bb8c', shades: true, mouth: 'flat', earpiece: true },
  },
  cop: {
    legs: 0x1a2634, hips: 0x1a2634, torso: 0x1d2b3a, arms: 0x1d2b3a,
    hands: 0xf2cd37, head: C.yellow, hair: 'cap', hairColor: 0x131c26,
    torsoPrint: 'cop',
    face: { skin: '#f2cd37', brow: 'angry', mouth: 'shout', moustache: true },
  },
  lieutenant: {
    legs: 0x2a3442, hips: 0x2a3442, torso: 0x2a3442, arms: 0x2a3442,
    hands: 0xf2cd37, head: C.yellow, hair: 'buzz', hairColor: C.grey,
    torsoPrint: 'lieut',
    face: { skin: '#f2cd37', brow: 'angry', mouth: 'grim', moustache: '#8a8378', stubble: true },
  },
  truckie: {
    legs: 0x2c3a2c, hips: 0x2c3a2c, torso: 0x3f6b45, arms: 0x3f6b45,
    hands: 0xf2cd37, head: C.yellow, hair: 'buzz', hairColor: 0x3b2a1c,
    torsoPrint: 'truckie',
    face: { skin: '#f2cd37', brow: 'flat', mouth: 'flat' },
  },
};

let figSeed = 0;

/**
 * @param {string|object} kind  preset name, or a spec object
 * @param {object} over         overrides merged over the preset
 */
export function minifig(kind = 'cop', over = {}) {
  const spec = { ...(PRESET[kind] || {}), ...over };
  spec.face = { ...(PRESET[kind]?.face || {}), ...(over.face || {}) };

  const root = new THREE.Group();
  root.name = 'minifig:' + kind;
  const parts = [];
  const add = (parent, mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    parts.push(mesh);
    return mesh;
  };

  // Most figures are ABS. Trinity is not: see pvc() in materials.js.
  const body = spec.material === 'pvc' ? pvc : abs;
  const matLeg = body(spec.legs);
  const matHip = body(spec.hips);
  const matArm = body(spec.arms);
  const matHand = body(spec.hands);

  // --- legs -------------------------------------------------------
  const legL = new THREE.Group();
  legL.position.set(-0.5, HIP_Y, 0);
  const legR = legL.clone();
  legR.position.x = 0.5;
  add(legL, new THREE.Mesh(legGeo(), matLeg));
  add(legR, new THREE.Mesh(legGeo(), matLeg));
  root.add(legL, legR);

  const hips = add(root, new THREE.Mesh(hipsGeo(), matHip));
  hips.position.y = HIP_Y;

  // --- torso ------------------------------------------------------
  const torso = new THREE.Group();
  torso.position.y = TORSO_Y;
  root.add(torso);

  const torsoMats = [
    body(spec.torso), body(spec.torso), body(spec.torso), body(spec.torso),
    spec.torsoPrint
      ? printed(makeTorsoPrint(spec.torsoPrint), 0xffffff, spec.material === 'pvc'
        ? { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }
        : {})
      : body(spec.torso),
    body(spec.torso),
  ];
  const torsoMesh = add(torso, new THREE.Mesh(torsoGeo(), torsoMats));
  // Neck stud, so the head reads as a separate moulded element.
  const neck = add(torso, new THREE.Mesh(studGeo(), body(spec.torso)));
  neck.position.y = NECK_Y - 0.16;

  const mkArm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 1.02, SHOULDER_Y, 0);
    add(g, new THREE.Mesh(armGeo(), matArm));
    const hand = new THREE.Group();
    hand.position.copy(WRIST);
    const hm = add(hand, new THREE.Mesh(handGeo(), matHand));
    hm.rotation.x = -0.3;
    g.add(hand);
    g.userData.hand = hand;
    torso.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // --- head -------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = NECK_Y;
  torso.add(head);
  const faceTex = makeFace(spec.face);
  const headMats = [printed(faceTex, spec.head), abs(spec.head), abs(spec.head)];
  add(head, new THREE.Mesh(headGeo(), headMats));
  const topStud = add(head, new THREE.Mesh(studGeo(), abs(spec.head)));
  topStud.position.y = 1.4;

  let hair = null;
  if (spec.hair && spec.hair !== 'none') {
    hair = add(head, new THREE.Mesh(hairGeo(spec.hair),
      body(spec.hairColor ?? C.trueBlack)));
    hair.position.y = spec.hair === 'cap' ? 1.32 : 1.24;
  }
  let shades = null;
  if (spec.shades3d) {
    shades = add(head, new THREE.Mesh(shadesGeo(), abs(0x101317)));
    shades.position.set(0, 0.86, 0.02);
  }

  root.userData.rig = {
    legL, legR, hips, torso, torsoMesh, armL, armR, head, hair, shades,
    handL: armL.userData.hand, handR: armR.userData.hand,
    parts, seed: ++figSeed,
  };

  // Neutral minifig stance: arms hanging with a slight outward flare.
  armL.rotation.set(0, 0, 0.06);
  armR.rotation.set(0, 0, -0.06);

  attachApi(root);
  return root;
}

/* ------------------------------------------------------------------ */
/* posing                                                             */
/* ------------------------------------------------------------------ */

function attachApi(fig) {
  const r = fig.userData.rig;

  /** Reset joints to the default stance before applying a pose. */
  fig.neutral = () => {
    r.legL.rotation.set(0, 0, 0);
    r.legR.rotation.set(0, 0, 0);
    r.armL.rotation.set(0, 0, 0.06);
    r.armR.rotation.set(0, 0, -0.06);
    r.torso.rotation.set(0, 0, 0);
    r.torso.position.set(0, TORSO_Y, 0);
    r.head.rotation.set(0, 0, 0);
    r.handL.rotation.set(0, 0, 0);
    r.handR.rotation.set(0, 0, 0);
    fig.userData.bob = 0;
  };

  /**
   * Stiff-legged LEGO gait. No knees, no ankles — the comedy is doing it
   * straight. `speed` in studs/sec drives the cadence.
   */
  fig.walk = (t, { run = false, speed = 1, amp = null, lean = null } = {}) => {
    const a = amp ?? (run ? 0.92 : 0.5);
    const cad = (run ? 8.2 : 5.0) * speed;
    const p = t * cad + r.seed;
    r.legL.rotation.x = Math.sin(p) * a;
    r.legR.rotation.x = -Math.sin(p) * a;
    r.armL.rotation.x = -Math.sin(p) * a * (run ? 1.05 : 0.62);
    r.armR.rotation.x = Math.sin(p) * a * (run ? 1.05 : 0.62);
    r.armL.rotation.z = 0.1 + (run ? 0.12 : 0);
    r.armR.rotation.z = -0.1 - (run ? 0.12 : 0);
    r.torso.rotation.x = lean ?? (run ? -0.26 : -0.05);
    r.torso.rotation.y = -Math.sin(p) * (run ? 0.13 : 0.07);
    // Hips lift on each stride because the legs are rigid levers.
    const lift = Math.abs(Math.sin(p)) * (run ? 0.2 : 0.1);
    fig.userData.bob = lift;
    r.torso.position.y = TORSO_Y + lift * 0.25;
    return lift;
  };

  /** Creeping down a burnt corridor with a torch. */
  fig.creep = (t, speed = 1) => {
    const p = t * 3.0 * speed + r.seed;
    r.legL.rotation.x = Math.sin(p) * 0.3;
    r.legR.rotation.x = -Math.sin(p) * 0.3;
    r.torso.rotation.x = -0.14;
    r.armL.rotation.x = -1.15 + Math.sin(p) * 0.05;
    r.armR.rotation.x = -1.2 - Math.sin(p) * 0.05;
    r.armL.rotation.z = 0.24;
    r.armR.rotation.z = -0.2;
    r.head.rotation.y = Math.sin(t * 1.1) * 0.24;
    fig.userData.bob = Math.abs(Math.sin(p)) * 0.06;
  };

  /** Two-handed weapon stance, aimed at a world point. */
  fig.aim = (worldTarget, tighten = 1) => {
    const local = fig.worldToLocal(worldTarget.clone());
    const yaw = Math.atan2(local.x, local.z);
    const dist = Math.hypot(local.x, local.z);
    const pitch = Math.atan2(local.y - (TORSO_Y + SHOULDER_Y), dist);
    r.torso.rotation.y = clamp(yaw, -0.7, 0.7) * 0.6;
    r.armL.rotation.x = -1.52 + pitch;
    r.armR.rotation.x = -1.52 + pitch;
    r.armL.rotation.z = 0.3 * tighten;
    r.armR.rotation.z = -0.3 * tighten;
    r.head.rotation.y = clamp(yaw, -0.5, 0.5) * 0.35;
  };

  /** Hands going slowly behind the head. k: 0 = down, 1 = fully up. */
  fig.handsUp = (k) => {
    const e = ease.io(clamp(k));
    r.armL.rotation.x = lerp(0, -2.5, e);
    r.armR.rotation.x = lerp(0, -2.5, e);
    r.armL.rotation.z = lerp(0.06, 0.85, e);
    r.armR.rotation.z = lerp(-0.06, -0.85, e);
    r.torso.rotation.x = lerp(0, 0.06, e);
  };

  /** Sitting at the fold-up table, hands on the keyboard. */
  fig.sitType = (t, typing = true) => {
    r.legL.rotation.x = 1.52;
    r.legR.rotation.x = 1.52;
    r.torso.rotation.x = -0.08;
    const clatter = typing ? Math.sin(t * 17 + r.seed) * 0.07 : 0;
    r.armL.rotation.x = -1.15 + clatter;
    r.armR.rotation.x = -1.15 - clatter;
    r.armL.rotation.z = 0.2;
    r.armR.rotation.z = -0.2;
    r.torso.position.y = TORSO_Y - 0.02;
  };

  /** Airborne: tucked, then reaching for the landing. k: 0 → 1 across the leap. */
  fig.leap = (k) => {
    const tuck = Math.sin(clamp(k) * Math.PI);
    r.legL.rotation.x = -0.5 - tuck * 0.9;
    r.legR.rotation.x = -0.2 + tuck * 1.5;
    r.armL.rotation.x = -1.1 - tuck * 1.4;
    r.armR.rotation.x = -0.9 - tuck * 0.6;
    r.armL.rotation.z = 0.5;
    r.armR.rotation.z = -0.6;
    r.torso.rotation.x = lerp(-0.35, 0.2, clamp(k));
  };

  /** Diving head-first, arms over the head, through a window. */
  fig.dive = (k) => {
    r.torso.rotation.x = -0.1;
    r.legL.rotation.x = -0.16;
    r.legR.rotation.x = -0.24;
    r.armL.rotation.x = -2.75;
    r.armR.rotation.x = -2.75;
    r.armL.rotation.z = 0.24;
    r.armR.rotation.z = -0.24;
    r.head.rotation.x = 0.2 * clamp(k);
  };

  /** Crumpled at the bottom of the stairwell. */
  fig.crumple = (k) => {
    const e = clamp(k);
    r.torso.rotation.x = lerp(0, 0.9, e);
    r.torso.rotation.z = lerp(0, 0.22, e);
    r.legL.rotation.x = lerp(0, 1.3, e);
    r.legR.rotation.x = lerp(0, 0.6, e);
    r.armL.rotation.x = lerp(0, -0.7, e);
    r.armR.rotation.x = lerp(0, -0.2, e);
    r.head.rotation.z = lerp(0, -0.2, e);
  };

  /** Limping — one leg carries, the other drags. */
  fig.limp = (t, speed = 1) => {
    const p = t * 3.4 * speed + r.seed;
    const s = Math.sin(p);
    r.legL.rotation.x = s * 0.42;
    r.legR.rotation.x = -s * 0.16 - 0.1;
    r.torso.rotation.x = -0.16 + Math.max(0, s) * 0.14;
    r.torso.rotation.z = 0.12 + s * 0.06;
    r.armL.rotation.x = -0.5 - s * 0.1;
    r.armR.rotation.x = -0.9;
    r.armR.rotation.z = -0.5;              // clutching her ribs
    r.head.rotation.z = 0.1;
    fig.userData.bob = -Math.abs(Math.min(0, s)) * 0.12;
  };

  /** Standing still, breathing. Always better than a T-pose. */
  fig.idle = (t, { breath = 1 } = {}) => {
    const p = t * 1.5 + r.seed;
    r.torso.position.y = TORSO_Y + Math.sin(p) * 0.015 * breath;
    r.armL.rotation.x = Math.sin(p * 0.8) * 0.03;
    r.armR.rotation.x = -Math.sin(p * 0.8 + 1) * 0.03;
    r.head.rotation.y = Math.sin(p * 0.35) * 0.06;
  };

  /** Put a prop in a hand. Returns the prop. */
  fig.hold = (prop, side = 'R', { rot = [0, 0, 0], pos = [0, -0.28, 0.14] } = {}) => {
    const hand = side === 'L' ? r.handL : r.handR;
    prop.position.set(...pos);
    prop.rotation.set(...rot);
    hand.add(prop);
    return prop;
  };

  /** Face a world-space direction (yaw only). */
  fig.face = (x, z) => { fig.rotation.y = Math.atan2(x, z); };

  fig.lookAtPoint = (v) => {
    const local = fig.worldToLocal(v.clone());
    r.head.rotation.y = clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
    r.head.rotation.x = clamp(-Math.atan2(local.y - 4.2, Math.hypot(local.x, local.z)), -0.4, 0.4);
  };

  return fig;
}

/**
 * Take the figure apart.
 *
 * The single most LEGO thing a minifigure can do when hit by a woman in a
 * leather coat: stop being a person and become seven separate parts, each with
 * its own trajectory. Torso and head get the most energy because they're
 * furthest from the floor.
 */
export function disassemble(fig, physics, {
  origin = null, force = 40, spin = 14, life = 13, keep = [],
} = {}) {
  const rig = fig.userData.rig;
  if (!rig || fig.userData.dismantled) return [];
  fig.userData.dismantled = true;

  const o = origin
    ? new THREE.Vector3(...(origin.isVector3 ? origin.toArray() : origin))
    : fig.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.4, 0));

  const wp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const out = [];

  for (const mesh of rig.parts) {
    if (keep.includes(mesh) || mesh.userData.released) continue;
    mesh.getWorldPosition(wp);
    dir.copy(wp).sub(o);
    const d = Math.max(0.7, dir.length());
    dir.normalize();
    const boost = 1 + clamp((wp.y - o.y) * 0.3, -0.3, 1.2);
    out.push(physics.release(mesh, {
      vel: [
        dir.x * force * boost / d + (Math.random() - 0.5) * 6,
        Math.abs(dir.y) * force * 0.5 + force * 0.36 * boost + Math.random() * 6,
        dir.z * force * boost / d + (Math.random() - 0.5) * 6,
      ],
      spin, life,
    }));
  }
  fig.visible = false;
  return out;
}
