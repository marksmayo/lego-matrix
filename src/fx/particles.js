import * as THREE from 'three';
import { rng } from '../core/anim.js';

/**
 * Gunfire, sparks and dust — all pooled, because a firefight in a corridor
 * fires forty rounds in eight seconds and allocating during a shot is how you
 * get a hitch exactly when the audience is watching a cop come apart.
 */

/* ---------------------------------------------------------------- */

/** Tracer rounds: a stretched, additive sliver of light per shot. */
export class Tracers {
  constructor(parent, { pool = 26, color = 0xfff0b0 } = {}) {
    this.items = [];
    const geo = new THREE.BoxGeometry(0.09, 0.09, 1);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < pool; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      parent.add(m);
      this.items.push({ m, life: 0, dur: 1 });
    }
    this.i = 0;
  }

  fire(from, to, { life = 0.075, width = 1 } = {}) {
    const it = this.items[this.i++ % this.items.length];
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    it.m.visible = true;
    it.m.position.copy(from).addScaledVector(d, 0.5);
    it.m.scale.set(width, width, len * 0.9);
    it.m.lookAt(to);
    it.m.material.opacity = 1;
    it.life = 0;
    it.dur = life;
    return it;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.life += dt;
      const k = it.life / it.dur;
      if (k >= 1) { it.m.visible = false; continue; }
      it.m.material.opacity = 1 - k * k;
    }
  }
}

/** Muzzle flashes: a brief light plus a cross-shaped billboard. */
export class Flashes {
  constructor(parent, { pool = 8, color = 0xffe2a0 } = {}) {
    this.items = [];
    const geo = new THREE.PlaneGeometry(1.7, 1.7);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < pool; i++) {
      const g = new THREE.Group();
      const a = new THREE.Mesh(geo, mat.clone());
      const b = new THREE.Mesh(geo, a.material);
      b.rotation.z = Math.PI / 4;
      b.scale.setScalar(0.6);
      const l = new THREE.PointLight(color, 0, 22, 2);
      g.add(a, b, l);
      g.visible = false;
      parent.add(g);
      this.items.push({ g, a, l, life: 0, dur: 1 });
    }
    this.i = 0;
    this.cam = null;
  }

  pop(pos, { life = 0.07, size = 1, power = 300 } = {}) {
    const it = this.items[this.i++ % this.items.length];
    it.g.visible = true;
    it.g.position.copy(pos);
    it.g.scale.setScalar(size * (0.8 + Math.random() * 0.5));
    it.g.rotation.z = Math.random() * 6.28;
    it.a.material.opacity = 1;
    it.l.intensity = power;
    it.life = 0;
    it.dur = life;
  }

  update(dt, camera) {
    for (const it of this.items) {
      if (!it.g.visible) continue;
      it.life += dt;
      const k = it.life / it.dur;
      if (k >= 1) { it.g.visible = false; it.l.intensity = 0; continue; }
      it.a.material.opacity = 1 - k;
      it.l.intensity *= 0.55;
      if (camera) it.g.quaternion.copy(camera.quaternion);
    }
  }
}

/**
 * Sparks and plastic chips. CPU-integrated points — a few hundred at most, and
 * they need gravity and per-particle colour, which is cheaper to do here than
 * to marshal into a shader.
 */
export class Sparks {
  constructor(parent, { max = 700, size = 0.22 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.n = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.rand = rng(99);
  }

  emit(origin, count, opts = {}) {
    const {
      speed = 26, spread = 1, up = 0.4, ttl = 0.5, color = [1, 0.85, 0.45], jitter = 0.35,
    } = opts;
    const r = this.rand;
    for (let k = 0; k < count; k++) {
      const i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
      const i3 = i * 3;
      this.pos[i3] = origin.x + (r() - 0.5) * 0.3;
      this.pos[i3 + 1] = origin.y + (r() - 0.5) * 0.3;
      this.pos[i3 + 2] = origin.z + (r() - 0.5) * 0.3;
      const s = speed * (0.35 + r());
      this.vel[i3] = (r() - 0.5) * 2 * spread * s;
      this.vel[i3 + 1] = (r() * up + 0.15) * s;
      this.vel[i3 + 2] = (r() - 0.5) * 2 * spread * s;
      this.ttl[i] = ttl * (0.6 + r() * 0.8);
      this.life[i] = 0;
      this.col[i3] = color[0] * (1 - jitter + r() * jitter * 2);
      this.col[i3 + 1] = color[1] * (1 - jitter + r() * jitter * 2);
      this.col[i3 + 2] = color[2] * (1 - jitter + r() * jitter * 2);
    }
    this.points.geometry.setDrawRange(0, this.n);
  }

  update(dt) {
    const g = -160 * dt;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      if (this.life[i] >= this.ttl[i]) {
        // Park dead particles far away rather than compacting the buffer.
        this.pos[i3 + 1] = -9999;
        continue;
      }
      this.life[i] += dt;
      this.vel[i3 + 1] += g;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = 1 - this.life[i] / this.ttl[i];
      this.col[i3] *= 0.985;
      this.col[i3 + 1] *= 0.978;
      this.col[i3 + 2] *= 0.97;
      if (k < 0.02) this.pos[i3 + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  reset() {
    this.n = 0;
    this.points.geometry.setDrawRange(0, 0);
  }
}

/** Slow drifting dust / smoke puffs, for the burnt corridor and the wreckage. */
export class Smoke {
  constructor(parent, { pool = 26, color = 0x8a9a90, size = 8 } = {}) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);

    this.items = [];
    for (let i = 0; i < pool; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.scale.setScalar(size);
      m.visible = false;
      parent.add(m);
      this.items.push({ m, life: 0, dur: 1, vy: 0, drift: new THREE.Vector3() });
    }
    this.i = 0;
  }

  puff(pos, { dur = 3.4, size = 8, vy = 1.2, opacity = 0.5, spread = 1.4 } = {}) {
    const it = this.items[this.i++ % this.items.length];
    it.m.visible = true;
    it.m.position.copy(pos);
    it.m.scale.setScalar(size * (0.7 + Math.random() * 0.6));
    it.m.material.opacity = opacity;
    it.m.material.rotation = Math.random() * 6.28;
    it.base = opacity;
    it.grow = size * 0.9;
    it.vy = vy;
    it.drift.set((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread);
    it.life = 0;
    it.dur = dur;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.life += dt;
      const k = it.life / it.dur;
      if (k >= 1) { it.m.visible = false; continue; }
      it.m.position.y += it.vy * dt;
      it.m.position.addScaledVector(it.drift, dt);
      it.m.scale.addScalar(it.grow * dt);
      it.m.material.opacity = it.base * Math.sin(k * Math.PI) ;
    }
  }
}

/** Volumetric-ish flashlight/headlight cone. Cheap, additive, and convincing. */
export function lightCone(length = 16, radius = 1.4, color = 0xfff0cc, opacity = 0.045) {
  const geo = new THREE.ConeGeometry(radius, length, 20, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(-Math.PI / 2);       // point down +Z
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.baseOpacity = opacity;
  return m;
}
