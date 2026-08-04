import * as THREE from 'three';

/** Easing. `io` variants are the ones that read as "camera on a dolly". */
export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  ioCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inQuint: (t) => t * t * t * t * t,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  /** Snappy settle — for a brick clicking into place. */
  snap: (t) => 1 - Math.pow(1 - t, 4) * Math.cos(t * Math.PI * 1.2),
};

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalised, clamped progress of `t` through the window [a, b]. */
export const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-6));

/** Same, but eased. */
export const eseg = (t, a, b, fn = ease.io) => fn(seg(t, a, b));

/** Progress through [a, b] with no clamping — useful for continuous motion. */
export const useg = (t, a, b) => (t - a) / (b - a || 1e-6);

/** 0 → 1 → 0 pulse across the window. */
export const pulse = (t, a, b) => {
  const p = seg(t, a, b);
  return Math.sin(p * Math.PI);
};

/** Deterministic pseudo-random, so a "random" shot looks the same every replay. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Cheap value noise, for handheld camera shake and flickering lights. */
export function noise1(t) {
  const i = Math.floor(t), f = t - i;
  const h = (n) => {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * Keyframed camera. `keys` is [{ t, pos:[x,y,z], look:[x,y,z], fov?, ease? }]
 * with `t` in act-local seconds. Interpolates position, target and FOV.
 */
export function camKeys(camera, t, keys, target = new THREE.Vector3()) {
  let i = 0;
  while (i < keys.length - 1 && t >= keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const span = (k1.t - k0.t) || 1e-6;
  const raw = clamp((t - k0.t) / span);
  const e = (k1.ease || ease.io)(raw);

  _a.fromArray(k0.pos);
  _b.fromArray(k1.pos);
  camera.position.lerpVectors(_a, _b, e);

  _a.fromArray(k0.look);
  _b.fromArray(k1.look);
  target.lerpVectors(_a, _b, e);

  const fov = lerp(k0.fov ?? camera.fov, k1.fov ?? k0.fov ?? camera.fov, e);
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(target);
  return target;
}

/** Additive camera shake — impacts, gunfire, a garbage truck arriving. */
export function shake(camera, amount, t, freq = 22) {
  if (amount <= 0.0001) return;
  camera.position.x += noise1(t * freq) * amount;
  camera.position.y += noise1(t * freq + 31.7) * amount;
  camera.rotateZ(noise1(t * freq * 0.6 + 11.3) * amount * 0.12);
}

/** Documentary-style float, so locked-off shots still feel operated. */
export function handheld(camera, t, amount = 0.02) {
  camera.position.x += noise1(t * 0.7) * amount;
  camera.position.y += noise1(t * 0.53 + 9.1) * amount * 0.8;
}

/** Smooth path through points, with arc-length parameterisation. */
export function path(points, closed = false, tension = 0.5) {
  return new THREE.CatmullRomCurve3(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3().fromArray(p))),
    closed, 'catmullrom', tension,
  );
}

/**
 * One-shot cue scheduler. Fires each cue once as act-local time passes it.
 * On a seek, cues already in the past are replayed with `skipped = true` so
 * an act can apply the state change (door is open) without the fireworks.
 */
export class Cues {
  constructor() { this.fired = new Set(); this.last = null; this.now = 0; this.jumped = false; }

  reset() { this.fired.clear(); this.last = null; }

  /** Call every frame. `id` must be stable. */
  at(t, id, fn) {
    if (this.fired.has(id)) return;
    if (this.now >= t) {
      this.fired.add(id);
      fn(this.jumped);
    }
  }

  /** Set the current time; detects seeks so cues can fire silently. */
  tick(t) {
    const first = this.last === null;
    this.jumped = first ? t > 0.6 : (t < this.last - 0.001 || t > this.last + 0.6);
    if (!first && t < this.last - 0.001) this.fired.clear();
    this.now = t;
    this.last = t;
  }
}
