import * as THREE from 'three';
import { rng, clamp } from '../core/anim.js';

/**
 * The screen, and then the inside of the screen.
 *
 * Two pieces:
 *   ScreenCanvas — a 2D canvas painted every frame: the cursor, the falling
 *     columns, the trace program's terminal lines and the ten digits locking
 *     into place. This is what we look AT.
 *   GlyphField  — thousands of glyphs as GPU points in a volume, which the
 *     camera then flies THROUGH. This is what the screen turns out to be.
 */

const GLYPHS = '01234567890123456789ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﬁﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ:.=*+-<>¦╌';

/* ------------------------------------------------------------------ */
/* the CRT                                                             */
/* ------------------------------------------------------------------ */

export class ScreenCanvas {
  constructor(w = 1024, h = 768) {
    this.cv = document.createElement('canvas');
    this.cv.width = w;
    this.cv.height = h;
    this.g = this.cv.getContext('2d', { alpha: false });
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;

    this.cell = 15;
    this.cols = Math.floor(w / this.cell);
    this.rows = Math.floor(h / this.cell);
    const rand = rng(1337);
    this.drops = Array.from({ length: this.cols }, () => ({
      y: -Math.floor(rand() * this.rows * 2),
      speed: 0.5 + rand() * 1.7,
      len: 6 + Math.floor(rand() * 18),
      glyphs: Array.from({ length: 40 }, () => GLYPHS[(rand() * GLYPHS.length) | 0]),
      churn: rand(),
    }));

    this.lines = [];        // terminal output
    this.rainLevel = 0;     // 0 = black screen, 1 = full downpour
    this.cursorOn = true;
    this.cursorFrac = [0.44, 0.52];
    this.digits = null;     // the phone number being traced
    this.scan = 0;
  }

  /** Print a line into the terminal area, teletype style. */
  print(text, opts = {}) {
    this.lines.push({ text, t: 0, ...opts });
    if (this.lines.length > 14) this.lines.shift();
  }

  clearLines() { this.lines.length = 0; }

  /**
   * Set up the trace readout. `target` is the number as a string of digits;
   * `locked` is how many have snapped into place.
   */
  setTrace(target, locked = 0) {
    this.digits = { target, locked, spin: 0 };
  }

  draw(t, dt) {
    const { g, cv } = this;
    const w = cv.width, h = cv.height;

    // Phosphor persistence: never clear to black, always fade. This is what
    // gives the trails their length and the screen its depth.
    g.fillStyle = `rgba(0, 8, 3, ${0.16 + 0.1 * this.rainLevel})`;
    g.fillRect(0, 0, w, h);

    g.font = `${this.cell - 2}px ui-monospace, "Courier New", monospace`;
    g.textBaseline = 'top';

    if (this.rainLevel > 0.01) {
      for (let i = 0; i < this.cols; i++) {
        const d = this.drops[i];
        d.y += d.speed * dt * 26 * (0.4 + this.rainLevel);
        if (d.y - d.len > this.rows) {
          d.y = -Math.floor(Math.random() * 12);
          d.len = 6 + Math.floor(Math.random() * 18);
        }
        const x = i * this.cell;
        if (Math.random() < 0.14) {
          d.glyphs[(Math.random() * d.glyphs.length) | 0] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        for (let k = 0; k < d.len; k++) {
          const row = Math.floor(d.y) - k;
          if (row < 0 || row > this.rows) continue;
          const fade = 1 - k / d.len;
          const ch = d.glyphs[(row + i) % d.glyphs.length];
          if (k === 0) {
            g.fillStyle = `rgba(215,255,230,${0.95 * this.rainLevel})`;
            g.shadowColor = '#7dfda1';
            g.shadowBlur = 12;
          } else {
            g.fillStyle = `rgba(40,${140 + 90 * fade | 0},${70 + 40 * fade | 0},${fade * 0.9 * this.rainLevel})`;
            g.shadowBlur = 0;
          }
          g.fillText(ch, x, row * this.cell);
        }
      }
      g.shadowBlur = 0;
    }

    // Terminal lines, top-left, with a teletype reveal.
    let y = this.cell * 1.2;
    for (const ln of this.lines) {
      ln.t += dt;
      const chars = Math.min(ln.text.length, Math.floor(ln.t * 46));
      g.fillStyle = ln.dim ? 'rgba(70,190,120,0.75)' : 'rgba(190,255,215,0.96)';
      g.shadowColor = '#4dff90';
      g.shadowBlur = 9;
      g.fillText(ln.text.slice(0, chars), this.cell, y);
      g.shadowBlur = 0;
      y += this.cell * 1.35;
    }

    // The traced number, top-right, digits spinning like a slot machine.
    if (this.digits) {
      const d = this.digits;
      const fs = this.cell * 2.6;
      g.font = `bold ${fs}px ui-monospace, monospace`;
      const total = d.target.length;
      const startX = w - this.cell - total * fs * 0.66;
      for (let i = 0; i < total; i++) {
        const ch = d.target[i];
        const isLocked = i < d.locked;
        const glyph = isLocked || ch === '-'
          ? ch
          : String.fromCharCode(48 + ((Math.random() * 10) | 0));
        g.fillStyle = isLocked ? 'rgba(220,255,235,1)' : 'rgba(60,215,130,0.85)';
        g.shadowColor = isLocked ? '#c8ffdd' : '#3bd782';
        g.shadowBlur = isLocked ? 22 : 8;
        g.fillText(glyph, startX + i * fs * 0.66, this.cell * 1.1);
      }
      g.shadowBlur = 0;
      g.font = `${this.cell - 2}px ui-monospace, monospace`;
    }

    // The cursor: "a blinding cursor pulses in the electric darkness".
    if (this.cursorOn) {
      const beat = 0.5 + 0.5 * Math.sin(t * 3.1);
      const a = 0.35 + 0.65 * Math.pow(beat, 2);
      const cx = w * this.cursorFrac[0], cy = h * this.cursorFrac[1] - this.cell * 0.6;
      g.shadowColor = '#9dffc0';
      g.shadowBlur = 34 * a;
      g.fillStyle = `rgba(190,255,215,${a})`;
      g.fillRect(cx, cy, this.cell * 0.62, this.cell * 1.15);
      g.shadowBlur = 0;
    }

    // Rolling scanline, faint.
    this.scan = (this.scan + dt * 260) % h;
    const grad = g.createLinearGradient(0, this.scan - 40, 0, this.scan + 40);
    grad.addColorStop(0, 'rgba(120,255,170,0)');
    grad.addColorStop(0.5, 'rgba(120,255,170,0.045)');
    grad.addColorStop(1, 'rgba(120,255,170,0)');
    g.fillStyle = grad;
    g.fillRect(0, this.scan - 40, w, 80);

    this.tex.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* the volume behind it                                                */
/* ------------------------------------------------------------------ */

function glyphAtlas() {
  const N = 8, S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N * S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, cv.width, cv.height);
  g.font = `bold ${S * 0.78}px ui-monospace, "Courier New", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  for (let i = 0; i < N * N; i++) {
    const ch = GLYPHS[i % GLYPHS.length];
    g.fillText(ch, (i % N) * S + S / 2, Math.floor(i / N) * S + S * 0.54);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

const VERT = /* glsl */`
  attribute float aGlyph;
  attribute float aBright;
  attribute float aSpeed;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uHeight;
  uniform float uChurn;
  varying float vGlyph;
  varying float vBright;
  void main() {
    vec3 p = position;
    // Fall, and wrap within the column's height.
    p.y = mod(p.y - uTime * aSpeed * 14.0 + uHeight * 0.5, uHeight) - uHeight * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (300.0 / max(1.0, -mv.z));
    // Head of the column burns white; body dims with depth.
    float lead = smoothstep(0.0, 1.0, aBright);
    vBright = lead;
    vGlyph = floor(mod(aGlyph + floor(uTime * uChurn * (2.0 + aSeed * 6.0)), 64.0));
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  uniform vec3 uColor;
  uniform vec3 uLead;
  uniform float uOpacity;
  varying float vGlyph;
  varying float vBright;
  void main() {
    float col = mod(vGlyph, 8.0);
    float row = floor(vGlyph / 8.0);
    vec2 uv = (vec2(col, row) + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / 8.0;
    float a = texture2D(uAtlas, uv).r;
    if (a < 0.06) discard;
    vec3 c = mix(uColor, uLead, pow(vBright, 3.0));
    gl_FragColor = vec4(c * (0.22 + vBright * 0.85), a * uOpacity * (0.22 + vBright * 0.8));
  }
`;

/**
 * A volume of falling glyphs arranged in columns, sized so the camera can be
 * flown straight through it. `depth` runs along −Z, away from the viewer.
 */
export class GlyphField {
  constructor({
    columns = 130, perColumn = 26, width = 90, height = 120, depth = 340,
    size = 26, color = 0x18b34e, lead = 0xd8ffe6, seed = 4,
  } = {}) {
    const rand = rng(seed);
    const n = columns * perColumn;
    const pos = new Float32Array(n * 3);
    const glyph = new Float32Array(n);
    const bright = new Float32Array(n);
    const speed = new Float32Array(n);
    const sd = new Float32Array(n);

    let i = 0;
    for (let c = 0; c < columns; c++) {
      const x = (rand() - 0.5) * width;
      const z = -rand() * depth;
      const sp = 0.5 + rand() * 2.2;
      const y0 = rand() * height;
      for (let k = 0; k < perColumn; k++) {
        pos[i * 3] = x;
        pos[i * 3 + 1] = y0 - k * 1.55;
        pos[i * 3 + 2] = z;
        glyph[i] = (rand() * 64) | 0;
        bright[i] = Math.pow(1 - k / perColumn, 2.2);
        speed[i] = sp;
        sd[i] = rand();
        i++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -depth / 2), depth);

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uHeight: { value: height },
        uChurn: { value: 1.0 },
        uAtlas: { value: glyphAtlas() },
        uColor: { value: new THREE.Color(color) },
        uLead: { value: new THREE.Color(lead) },
        uOpacity: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  set opacity(v) { this.mat.uniforms.uOpacity.value = clamp(v, 0, 1); }
  get opacity() { return this.mat.uniforms.uOpacity.value; }
  set churn(v) { this.mat.uniforms.uChurn.value = v; }

  update(t) { this.mat.uniforms.uTime.value = t; }
}

/**
 * A flat curtain of rain used as a backdrop — same shader, shallow depth.
 * Sits behind the title card at the end.
 */
export function rainCurtain(opts = {}) {
  return new GlyphField({
    columns: 90, perColumn: 22, width: 140, height: 90, depth: 14,
    size: 20, ...opts,
  });
}
