import * as THREE from 'three';

/**
 * ABS plastic materials.
 *
 * Real LEGO is injection-moulded ABS: it is not shiny like a mirror and not
 * matte like clay. It has a soft specular sheen plus a thin, slightly rougher
 * surface layer from the mould. MeshPhysicalMaterial's clearcoat models that
 * almost exactly, which is most of what sells "this is a real brick".
 */

/** Official-ish LEGO colour names → hex. */
export const C = {
  black: 0x1b2a34,          // LEGO "black" is a very dark blue-grey, never 0x000000
  trueBlack: 0x14181b,
  darkGrey: 0x6c6e68,       // dark bluish grey
  grey: 0xa0a5a9,           // light bluish grey
  lightGrey: 0xc7cdd0,
  white: 0xf2f3f2,
  red: 0xc91a09,
  darkRed: 0x720e0f,
  yellow: 0xf2cd37,
  brightOrange: 0xfe8a18,
  brown: 0x583927,
  darkBrown: 0x3f2a1b,
  tan: 0xe4cd9e,
  darkTan: 0x958a73,
  blue: 0x0055bf,
  darkBlue: 0x0a3463,
  sandBlue: 0x6074a1,
  green: 0x237841,
  brightGreen: 0x4b9f4a,
  lime: 0xbbe90b,
  nougat: 0xd09168,
  medNougat: 0xaa7d55,
  darkFlesh: 0x7c503a,
  silver: 0x9ba19d,
  gold: 0xdcbe61,
  sandGreen: 0xa0bcac,
  darkGreenGrey: 0x354b3d,
};

/**
 * Global trim on self-lit surfaces.
 *
 * Lighting here is in physical units (three.js has not used the old light model
 * since r155), so a night exterior needs a moon of 5-7 lux and a torch needs
 * hundreds of candela — a spot at "130" is a tenth as bright as it looks like
 * it should be. Emissive materials, meanwhile, ignore the light rig entirely.
 * Once the lights were calibrated against a contact sheet, every screen, lamp
 * lens and neon in the piece was three times too hot; GLOW is the single trim
 * that rebalances self-lit against lit. Anything that animates its own
 * emissiveIntensity has to apply the same factor at its call site.
 */
export const GLOW = 0.42;

const cache = new Map();

/** Opaque ABS. Cached per colour so the renderer can batch. */
export function abs(color, opts = {}) {
  const key = `abs:${color}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    ...opts,
  });
  cache.set(key, m);
  return m;
}

/**
 * PVC. Not a LEGO material at all — but Trinity's costume is patent vinyl, and
 * moulding her in the same matte ABS as a police uniform loses the one thing
 * the audience recognises her by. Very low roughness, full clearcoat, and a
 * cool sheen so the highlight wraps the edge of a curved surface the way a
 * latex catsuit does rather than sitting on it as a dot.
 */
export function pvc(color = 0x0b0d10, opts = {}) {
  const key = `pvc:${color}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.14,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    sheen: 0.85,
    sheenRoughness: 0.3,
    sheenColor: new THREE.Color(0x9fb4c8),
    specularIntensity: 1.0,
    ...opts,
  });
  cache.set(key, m);
  return m;
}

/** Transparent ABS — windscreens, glass, the phone booth, trans-neon-green. */
export function absTrans(color, opts = {}) {
  const key = `trans:${color}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ior: 1.52,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...opts,
  });
  cache.set(key, m);
  return m;
}

/** Chrome / metallic-silver elements: hubcaps, gun barrels, door handles. */
export function chrome(color = C.silver, opts = {}) {
  return abs(color, { metalness: 0.92, roughness: 0.22, clearcoat: 0, ...opts });
}

/** Rubber: tyres and hoses. Deliberately dead-flat compared to ABS. */
export function rubber(opts = {}) {
  return abs(0x0f1214, { roughness: 0.94, clearcoat: 0.06, ...opts });
}

/** Self-lit surface — screens, flashlight lenses, the neon of the trace. */
export function glow(color, intensity = 1.6) {
  const key = `glow:${color}:${intensity}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    // Emissive surfaces are not affected by the light rig, so once the lights
    // were calibrated to physical units these all sat far too hot. GLOW is the
    // one place to rebalance self-lit against lit.
    emissiveIntensity: intensity * GLOW,
    roughness: 1,
    metalness: 0,
  });
  cache.set(key, m);
  return m;
}

/** Printed part — a decorated tile or a minifig head. Never cached (unique map). */
export function printed(map, color = C.white, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    ...opts,
  });
}

/** Slightly randomised colour, so a brick-built wall doesn't look extruded. */
export function shade(hex, amount = 0.06, seed = Math.random()) {
  const c = new THREE.Color(hex);
  const f = 1 + (seed - 0.5) * 2 * amount;
  c.multiplyScalar(f);
  return c.getHex();
}
