import * as THREE from 'three';
import { ease, seg, clamp, lerp, path } from './anim.js';

/**
 * Blocking helpers — the animation equivalent of chalk marks on a stage.
 * Everything is a pure function of time so any moment can be scrubbed to.
 */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Walk/run a figure from A to B between t0 and t1. */
export function move(fig, t, t0, t1, from, to, opts = {}) {
  const { mode = 'walk', e = ease.io, face = true, speed = 1, amp = null } = opts;
  const raw = seg(t, t0, t1);
  const k = e(raw);
  _a.set(from[0], from[1] ?? 0, from[2]);
  _b.set(to[0], to[1] ?? 0, to[2]);
  fig.position.lerpVectors(_a, _b, k);

  const active = t >= t0 - 0.001 && t <= t1 + 0.15;
  if (active) {
    if (mode === 'run') fig.walk(t, { run: true, speed, amp });
    else if (mode === 'creep') fig.creep(t, speed);
    else if (mode === 'limp') fig.limp(t, speed);
    else fig.walk(t, { speed, amp });
    if (face) {
      _d.subVectors(_b, _a);
      if (_d.lengthSq() > 1e-5) fig.face(_d.x, _d.z);
    }
  }
  fig.position.y += fig.userData.bob || 0;
  return { k, raw, done: raw >= 1, active };
}

/** Follow a curve. `t` maps [t0, t1] onto the whole path. */
export function follow(fig, t, t0, t1, curve, opts = {}) {
  const { mode = 'run', e = ease.linear, face = true, speed = 1 } = opts;
  const raw = seg(t, t0, t1);
  const k = clamp(e(raw), 0, 0.9999);
  curve.getPointAt(k, _a);
  fig.position.copy(_a);
  if (mode === 'run') fig.walk(t, { run: true, speed });
  else if (mode === 'walk') fig.walk(t, { speed });
  if (face) {
    curve.getTangentAt(k, _d);
    fig.face(_d.x, _d.z);
  }
  fig.position.y += fig.userData.bob || 0;
  return { k, raw, done: raw >= 1 };
}

/**
 * A jump. Ballistic arc between two points with a chosen apex, plus the
 * airborne pose. This is the move the whole rooftop sequence is built on.
 */
export function jump(fig, t, t0, t1, from, to, opts = {}) {
  const { height = 6, pose = true, spin = 0 } = opts;
  const k = seg(t, t0, t1);
  _a.set(from[0], from[1] ?? 0, from[2]);
  _b.set(to[0], to[1] ?? 0, to[2]);
  fig.position.lerpVectors(_a, _b, k);
  // Parabola: 4h·k(1−k) peaks at the midpoint.
  fig.position.y += 4 * height * k * (1 - k);
  if (k > 0 && k < 1) {
    _d.subVectors(_b, _a);
    fig.face(_d.x, _d.z);
    if (pose) fig.leap(k);
    if (spin) fig.rotation.x = spin * k;
  }
  return { k, airborne: k > 0 && k < 1, done: k >= 1 };
}

/** Stand somewhere, breathing, facing a direction. */
export function stand(fig, t, pos, ry = 0, opts = {}) {
  fig.position.set(pos[0], pos[1] ?? 0, pos[2]);
  fig.rotation.y = ry;
  fig.neutral();
  fig.idle(t, opts);
}

/** Build a smoothed route from waypoints. */
export function route(points, tension = 0.4) {
  return path(points, false, tension);
}

/**
 * Vehicle mover: drives along a curve with wheel spin and body roll.
 * `wheels` come from the prop builders' userData.
 */
export function driveAlong(veh, t, t0, t1, curve, opts = {}) {
  const { e = ease.io, wheelR = 0.85, roll = 0.05, faceForward = true } = opts;
  const raw = seg(t, t0, t1);
  const k = clamp(e(raw), 0, 0.9999);
  curve.getPointAt(k, _a);
  const prevY = veh.position.z;
  veh.position.copy(_a);
  if (faceForward) {
    curve.getTangentAt(k, _d);
    veh.rotation.y = Math.atan2(_d.x, _d.z);
  }
  // Wheel spin from distance travelled, not from time, so a slow crawl and a
  // fast pass both look right.
  const dist = Math.abs(veh.position.z - prevY) + 0.0001;
  const spin = (curve.getLength() * k) / wheelR;
  for (const w of veh.userData.wheels || []) w.rotation.x = -spin;
  veh.rotation.z = Math.sin(k * 8) * roll * (raw > 0 && raw < 1 ? 1 : 0);
  return { k, raw, moving: raw > 0 && raw < 1, dist };
}

/** Point a spotlight-bearing group at a world position. */
export function aimLightAt(obj, target) {
  obj.lookAt(target);
}

const _m = new THREE.Matrix4();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * Orient a figure by its own axes rather than by yaw — which is the only way
 * to put a minifigure sideways on a wall. `up` is the direction from its feet
 * to its head; `fwd` is the way it is travelling. Both in world space.
 */
export function orient(fig, up, fwd) {
  _up.set(up[0], up[1], up[2]).normalize();
  _fwd.set(fwd[0], fwd[1], fwd[2]).normalize();
  _right.crossVectors(_up, _fwd).normalize();
  // Re-square the basis in case the two inputs weren't perpendicular.
  _fwd.crossVectors(_right, _up).normalize();
  _m.makeBasis(_right, _up, _fwd);
  fig.quaternion.setFromRotationMatrix(_m);
  fig.rotation.setFromQuaternion(fig.quaternion);
}

/**
 * Run along a wall. `plane` is the wall's inner surface, `normal` points away
 * from it into the room, and `dir` is the direction of travel across it.
 * Gravity is a suggestion.
 */
export function wallRun(fig, t, t0, t1, from, to, opts = {}) {
  const { normal = [-1, 0, 0], speed = 1.6, e = ease.io } = opts;
  const raw = seg(t, t0, t1);
  const k = e(raw);
  _a.set(from[0], from[1], from[2]);
  _b.set(to[0], to[1], to[2]);
  fig.position.lerpVectors(_a, _b, k);
  _d.subVectors(_b, _a);
  orient(fig, normal, [_d.x, _d.y, _d.z]);
  if (raw > 0 && raw < 1) fig.walk(t, { run: true, speed });
  return { k, raw, on: raw > 0 && raw < 1 };
}

export { lerp, clamp, seg, ease };
