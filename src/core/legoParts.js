import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Part geometry, in real LEGO dimensions.
 *
 *   1 world unit  = 1 stud pitch = 8.0 mm
 *   brick height  = 9.6 mm  = 1.20 u   (exactly 6/5 of a stud pitch)
 *   plate height  = 3.2 mm  = 0.40 u
 *   stud diameter = 4.8 mm  = 0.60 u
 *   part gap      = 0.2 mm  = 0.025 u  (why a 2x1 brick is 15.8 mm, not 16)
 *
 * Every geometry is chamfered — the 0.3 mm bevel on a real brick's edges is
 * what catches the light, and without it bricks read as plain boxes. Geometry
 * is cached by signature so a wall of 400 bricks is one buffer, reused.
 */

export const PITCH = 1.0;
export const BRICK_H = 1.2;
export const PLATE_H = 0.4;
export const TILE_H = 0.4;
export const GAP = 0.025;
export const STUD_R = 0.3;
export const STUD_H = 0.225;
const BEVEL = 0.035;

const cache = new Map();
function cached(key, build) {
  let g = cache.get(key);
  if (!g) { g = build(); cache.set(key, g); }
  return g;
}

/** Rounded rectangle in the XY plane, centred on the origin. */
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * mergeGeometries refuses to mix indexed and non-indexed inputs, and
 * ExtrudeGeometry — which every brick body is built from — is non-indexed
 * while every primitive (cylinder studs, spheres, torus hands) is indexed.
 * So everything gets flattened before it goes into a merge.
 */
export const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);
const merge = (parts) => {
  const g = mergeGeometries(parts.map(nonIndexed));
  g.computeVertexNormals();
  return g;
};

/** Re-origin a geometry: centred in X/Z, sitting on Y = 0. */
export function groundCenter(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(
    -(b.min.x + b.max.x) / 2,
    -b.min.y,
    -(b.min.z + b.max.z) / 2,
  );
  return geo;
}

/** A chamfered slab: the body of any brick, plate or tile. */
function slabGeo(w, d, h) {
  const shape = roundedRect(w * PITCH - GAP, d * PITCH - GAP, 0.09);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, h - BEVEL * 2),
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, BEVEL, 0);
  g.computeVertexNormals();
  return g;
}

export function studGeo() {
  return cached('stud', () => {
    const g = new THREE.CylinderGeometry(STUD_R, STUD_R * 0.985, STUD_H, 14, 1);
    g.translate(0, STUD_H / 2, 0);
    return g;
  });
}

/** Stud centre positions across a w × d footprint. */
export function studGrid(w, d) {
  const out = [];
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      out.push([(i - (w - 1) / 2) * PITCH, (j - (d - 1) / 2) * PITCH]);
    }
  }
  return out;
}

/**
 * The workhorse. `w` × `d` studs, `h` units tall, origin at bottom centre.
 * studs=false gives a tile (smooth top).
 */
export function brickGeo(w, d, h = BRICK_H, studs = true) {
  return cached(`b:${w}:${d}:${h}:${studs}`, () => {
    const parts = [slabGeo(w, d, h)];
    if (studs) {
      for (const [x, z] of studGrid(w, d)) {
        const s = studGeo().clone();
        s.translate(x, h, z);
        parts.push(s);
      }
    }
    return merge(parts);
  });
}

export const plateGeo = (w, d, studs = true) => brickGeo(w, d, PLATE_H, studs);
export const tileGeo = (w, d) => brickGeo(w, d, TILE_H, false);

/** 45° slope brick. Descends toward −Z (the "front"). */
export function slopeGeo(w, d, h = BRICK_H) {
  return cached(`sl:${w}:${d}:${h}`, () => {
    const dd = d * PITCH - GAP;
    const s = new THREE.Shape();
    s.moveTo(-dd / 2, 0);
    s.lineTo(dd / 2, 0);
    s.lineTo(dd / 2, h);
    s.lineTo(-dd / 2 + 0.12, h * 0.14);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: w * PITCH - GAP - BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 1,
      steps: 1,
    });
    g.rotateY(Math.PI / 2);
    groundCenter(g);
    const parts = [g];
    for (let i = 0; i < w; i++) {
      const st = studGeo().clone();
      st.translate((i - (w - 1) / 2) * PITCH, h, (d - 1) * PITCH * 0.5);
      parts.push(st);
    }
    return merge(parts);
  });
}

/** Round brick / cylinder element, diameter in studs. */
export function roundBrickGeo(dia = 1, h = BRICK_H, studs = true) {
  return cached(`rb:${dia}:${h}:${studs}`, () => {
    const r = (dia * PITCH - GAP) / 2;
    const g = new THREE.CylinderGeometry(r, r, h, 20, 1);
    g.translate(0, h / 2, 0);
    if (!studs) return g;
    const st = studGeo().clone();
    st.translate(0, h, 0);
    return merge([g, st]);
  });
}

export function coneGeo(dia = 2, h = BRICK_H) {
  return cached(`cone:${dia}:${h}`, () => {
    const r = (dia * PITCH - GAP) / 2;
    const g = new THREE.CylinderGeometry(STUD_R * 1.05, r, h, 20, 1);
    g.translate(0, h / 2, 0);
    return g;
  });
}

/** Technic bar / antenna / gun barrel. */
export function barGeo(len = 1, r = 0.105) {
  return cached(`bar:${len}:${r}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, 10, 1);
    g.translate(0, len / 2, 0);
    return g;
  });
}

/** Tyre — a fat, slightly rounded ring, axis along X. */
export function tyreGeo(r = 0.85, w = 0.55) {
  return cached(`ty:${r}:${w}`, () => {
    const g = new THREE.CylinderGeometry(r, r, w, 22, 1);
    g.rotateZ(Math.PI / 2);
    const tread = new THREE.TorusGeometry(r * 0.99, w * 0.16, 8, 22);
    tread.rotateY(Math.PI / 2);
    return merge([g, tread]);
  });
}

export function hubGeo(r = 0.52, w = 0.58) {
  return cached(`hub:${r}:${w}`, () => {
    const g = new THREE.CylinderGeometry(r, r, w, 16, 1);
    g.rotateZ(Math.PI / 2);
    return g;
  });
}

/** Minifig claw hand: an open ring, opening pointing +Y. */
export function handGeo() {
  return cached('hand', () => {
    const g = new THREE.TorusGeometry(0.26, 0.085, 7, 16, Math.PI * 1.62);
    g.rotateZ(Math.PI * 0.19);
    return g;
  });
}

/** Fast mesh helper: cached geometry, shared material. */
export function part(geo, material, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const brick = (w, d, mat, x, y, z, ry, h = BRICK_H) =>
  part(brickGeo(w, d, h), mat, x, y, z, ry);

export const plate = (w, d, mat, x, y, z, ry) =>
  part(plateGeo(w, d), mat, x, y, z, ry);

export const tile = (w, d, mat, x, y, z, ry) =>
  part(tileGeo(w, d), mat, x, y, z, ry);

/**
 * Many copies of one part in one draw call. `xforms` is a list of
 * [x, y, z, ry?, colorHex?] — colours become an instanceColor buffer.
 */
export function instanced(geo, material, xforms) {
  const im = new THREE.InstancedMesh(geo, material, xforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  let coloured = false;
  xforms.forEach((t, i) => {
    p.set(t[0], t[1], t[2]);
    e.set(0, t[3] || 0, 0);
    q.setFromEuler(e);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
    if (t[4] != null) { im.setColorAt(i, col.set(t[4])); coloured = true; }
  });
  im.instanceMatrix.needsUpdate = true;
  if (coloured) im.instanceColor.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

/** Approximate size of a part, for handing it to the physics solver. */
export function geoSize(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  return new THREE.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
}
