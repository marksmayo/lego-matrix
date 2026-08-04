import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { geoSize } from './legoParts.js';

/**
 * Rigid-body layer.
 *
 * Everything here works in stud-units (1 u = 8 mm), so gravity has to be
 * scaled: 9.81 m/s² is 1226 u/s², which is correct but reads as a blur at
 * this size. Real LEGO debris genuinely does fall that fast — it just looks
 * wrong on camera. GRAVITY is tuned to the middle ground: heavy enough to
 * feel like plastic, slow enough to read as stunt work.
 */
const GRAVITY = -420;
const MAX_BODIES = 420;

export class Physics {
  constructor(scene) {
    this.scene = scene;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 7;

    this.absMat = new CANNON.Material('abs');
    this.groundMat = new CANNON.Material('ground');
    // Plastic on plastic: bouncy, low friction. This ratio is most of why
    // scattered bricks slide and chatter instead of landing like bean bags.
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.absMat, this.absMat, {
      friction: 0.28, restitution: 0.34,
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.absMat, this.groundMat, {
      friction: 0.36, restitution: 0.28,
    }));

    this.dynamic = [];   // { mesh, body, born, life, fade }
    this.statics = [];
    this.accum = 0;
    this.time = 0;
    this.onImpact = null;
  }

  /** Immovable collider. `size` is a full-extent Vector3-ish. */
  addStatic(pos, size, quat = null) {
    const half = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
    const body = new CANNON.Body({ mass: 0, material: this.groundMat });
    body.addShape(new CANNON.Box(half));
    body.position.set(pos[0], pos[1], pos[2]);
    if (quat) body.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    this.world.addBody(body);
    this.statics.push(body);
    return body;
  }

  addGround(y = 0, extent = 400) {
    return this.addStatic([0, y - 5, 0], [extent, 10, extent]);
  }

  /**
   * Hand an existing mesh to the solver. The mesh is re-parented to the
   * scene root at its current world transform, so parts can be torn straight
   * off a rigged minifigure mid-animation.
   */
  release(mesh, { vel = [0, 0, 0], spin = 6, mass = null, life = 14, size = null } = {}) {
    // A part can only be torn off once — the fight releases some heads early.
    if (mesh.userData.released) return null;
    mesh.userData.released = true;
    if (this.dynamic.length >= MAX_BODIES) this.retireOldest();

    mesh.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    const ws = new THREE.Vector3();
    mesh.matrixWorld.decompose(wp, wq, ws);

    const s = size ? new THREE.Vector3(...size) : geoSize(mesh.geometry).multiply(ws);
    // Collision proxy is a hair smaller than the part: shrink-wrapped boxes
    // on chamfered bricks otherwise jitter when they pile up.
    const half = new CANNON.Vec3(
      Math.max(0.06, s.x * 0.46),
      Math.max(0.06, s.y * 0.46),
      Math.max(0.06, s.z * 0.46),
    );
    const volume = s.x * s.y * s.z;
    const body = new CANNON.Body({
      mass: mass ?? Math.max(0.02, volume * 0.06),
      material: this.absMat,
      linearDamping: 0.06,
      angularDamping: 0.14,
      allowSleep: true,
      sleepSpeedLimit: 0.6,
      sleepTimeLimit: 0.4,
    });
    body.addShape(new CANNON.Box(half));
    body.position.set(wp.x, wp.y, wp.z);
    body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
    body.velocity.set(vel[0], vel[1], vel[2]);
    body.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
    );
    this.world.addBody(body);

    // Detach from its rig, keep the world transform.
    this.scene.attach(mesh);
    mesh.position.copy(wp);
    mesh.quaternion.copy(wq);

    const rec = { mesh, body, born: this.time, life, settled: false };
    this.dynamic.push(rec);
    return rec;
  }

  /** Radial impulse — an explosion at `origin`. */
  burst(origin, strength = 60, upBias = 0.45, radius = 6) {
    const o = new THREE.Vector3(...origin);
    const d = new THREE.Vector3();
    for (const r of this.dynamic) {
      d.set(r.body.position.x, r.body.position.y, r.body.position.z).sub(o);
      const dist = Math.max(0.4, d.length());
      if (dist > radius) continue;
      d.normalize().multiplyScalar(strength / dist);
      d.y += strength * upBias;
      r.body.wakeUp();
      r.body.velocity.x += d.x;
      r.body.velocity.y += d.y;
      r.body.velocity.z += d.z;
    }
  }

  retireOldest() {
    const r = this.dynamic.shift();
    if (r) this.destroy(r);
  }

  destroy(r) {
    this.world.removeBody(r.body);
    if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
  }

  /** Drop every dynamic part — called on a scene change. */
  clearDebris() {
    for (const r of this.dynamic) this.destroy(r);
    this.dynamic.length = 0;
  }

  /** Drop every collider too — a full teardown between acts. */
  reset() {
    this.clearDebris();
    for (const b of this.statics) this.world.removeBody(b);
    this.statics.length = 0;
  }

  step(dt) {
    // Bullet time. Acts set this to hold every loose part in mid-air; the
    // solver is skipped entirely rather than slowed, because a fixed-step
    // integrator run at 1/20 speed drifts and the pieces sag.
    if (this.frozen) return;
    this.time += dt;
    // Fixed timestep with a bounded catch-up: a long frame must never
    // integrate ten steps at once or the whole pile explodes.
    const h = 1 / 120;
    this.accum = Math.min(this.accum + dt, h * 8);
    while (this.accum >= h) {
      this.world.step(h);
      this.accum -= h;
    }

    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const r = this.dynamic[i];
      const p = r.body.position;
      const q = r.body.quaternion;
      r.mesh.position.set(p.x, p.y, p.z);
      r.mesh.quaternion.set(q.x, q.y, q.z, q.w);

      const age = this.time - r.born;
      if (age > r.life || p.y < -60) {
        this.destroy(r);
        this.dynamic.splice(i, 1);
      }
    }
  }

  get count() { return this.dynamic.length; }
}

/**
 * Shatter a mesh into loose bricks: used for doors, walls and the phone booth.
 * `mesh` is removed and replaced by `pieces` clones scattered from its bounds.
 */
export function shatterInto(physics, group, geo, material, count, box, opts = {}) {
  const { vel = [0, 0, 0], spread = 18, jitter = 1, spin = 10, life = 12 } = opts;
  const out = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(
      box.min.x + Math.random() * (box.max.x - box.min.x),
      box.min.y + Math.random() * (box.max.y - box.min.y),
      box.min.z + Math.random() * (box.max.z - box.min.z),
    );
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.castShadow = true;
    group.add(m);
    out.push(physics.release(m, {
      vel: [
        vel[0] + (Math.random() - 0.5) * spread * jitter,
        vel[1] + Math.random() * spread * 0.6 * jitter,
        vel[2] + (Math.random() - 0.5) * spread * jitter,
      ],
      spin, life,
    }));
  }
  return out;
}
