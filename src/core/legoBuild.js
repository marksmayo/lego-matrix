import * as THREE from 'three';
import { abs, absTrans, glow, C, shade } from './materials.js';
import {
  brickGeo, plateGeo, tileGeo, studGeo, slopeGeo, instanced,
  BRICK_H, PLATE_H, TILE_H, PITCH,
} from './legoParts.js';
import { rng } from './anim.js';

/**
 * Structures built the way you'd actually build them: courses of bricks,
 * staggered so the joints don't line up, in mixed shades from the same
 * family. Real brick-built walls are never one flat colour — the variation
 * is what makes a grey wall look like plastic rather than concrete.
 */

/** Baseplate with a full stud grid. Two draw calls regardless of size. */
export function baseplate(w, d, color = C.darkGrey, { y = 0, studs = true } = {}) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(w * PITCH, PLATE_H, d * PITCH),
    abs(color, { roughness: 0.55 }),
  );
  slab.position.y = y - PLATE_H / 2;
  slab.receiveShadow = true;
  g.add(slab);

  if (studs) {
    const xf = [];
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < d; j++) {
        xf.push([(i - (w - 1) / 2) * PITCH, y, (j - (d - 1) / 2) * PITCH]);
      }
    }
    const im = instanced(studGeo(), abs(color, { roughness: 0.5 }), xf);
    im.castShadow = false;
    g.add(im);
  }
  g.userData.collider = [[0, y - 0.5, 0], [w * PITCH, 1 + PLATE_H, d * PITCH]];
  return g;
}

/**
 * A brick-built wall, running along +X, centred on the origin, rising from y=0.
 *
 * `openings` are [xCentre, width, yBottom, height] holes in stud/unit space —
 * doorways and windows. Courses stagger by half a brick each row.
 */
export function wall(lengthStuds, courses, opts = {}) {
  const {
    color = C.darkGrey, variation = 0.1, seed = 7, openings = [],
    depth = 1, sootTop = 0, capTiles = false,
  } = opts;

  const rand = rng(seed);
  const xf = [];
  const half = lengthStuds / 2;

  const blocked = (x0, x1, y0, y1) => openings.some(([cx, w, yb, h]) =>
    x1 > cx - w / 2 && x0 < cx + w / 2 && y1 > yb && y0 < yb + h);

  for (let c = 0; c < courses; c++) {
    const y = c * BRICK_H;
    let x = -half;
    let first = c % 2 === 0;           // stagger: even courses start with a 1×
    while (x < half - 0.001) {
      let len = first ? 1 : (x + 2 <= half && rand() > 0.3 ? 2 : 1);
      first = false;
      if (x + len > half) len = 1;
      const x0 = x, x1 = x + len;
      if (!blocked(x0, x1, y, y + BRICK_H)) {
        // Soot: the fire "spooled soot up the walls", so darken with height.
        const sootK = sootTop > 0 ? Math.pow(c / courses, 1.6) * sootTop : 0;
        let col = shade(color, variation, rand());
        if (sootK > 0) {
          col = new THREE.Color(col).lerp(new THREE.Color(0x141518), sootK).getHex();
        }
        xf.push([(x0 + x1) / 2, y, 0, 0, col, len]);
      }
      x += len;
    }
  }

  const g = new THREE.Group();
  for (const len of [1, 2]) {
    const subset = xf.filter((t) => t[5] === len).map((t) => [t[0], t[1], t[2], t[3], t[4]]);
    if (subset.length) g.add(instanced(brickGeo(len, depth), abs(color), subset));
  }

  if (capTiles) {
    const caps = [];
    for (let i = 0; i < lengthStuds; i += 2) {
      caps.push([-half + i + 0.5, courses * BRICK_H, 0, 0, shade(color, 0.08, rand())]);
    }
    g.add(instanced(tileGeo(2, depth), abs(color), caps));
  }

  g.userData.height = courses * BRICK_H;
  g.userData.colliders = solidSpans(lengthStuds, courses, openings, depth);
  return g;
}

/** Coarse box colliders for a wall, skipping the openings. */
function solidSpans(lengthStuds, courses, openings, depth) {
  const h = courses * BRICK_H;
  if (!openings.length) {
    return [[[0, h / 2, 0], [lengthStuds, h, depth]]];
  }
  const out = [];
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  let x = -lengthStuds / 2;
  for (const [cx, w] of sorted) {
    const left = cx - w / 2;
    if (left > x) out.push([[(x + left) / 2, h / 2, 0], [left - x, h, depth]]);
    x = cx + w / 2;
  }
  if (x < lengthStuds / 2) {
    out.push([[(x + lengthStuds / 2) / 2, h / 2, 0], [lengthStuds / 2 - x, h, depth]]);
  }
  return out;
}

/**
 * Floor of tiles with occasional missing pieces — burnt polyester carpet.
 *
 * `y` is the WALKING SURFACE, not the underside: the tiles are dropped by
 * their own thickness so that a figure standing at y=0 stands on the floor
 * rather than inside it. Every collider in the project assumes the same.
 */
export function tiledFloor(w, d, opts = {}) {
  const { color = C.darkBrown, seed = 3, missing = 0.0, y = 0, tileSize = 2 } = opts;
  const base = y - TILE_H;
  const rand = rng(seed);
  const xf = [];
  const nx = Math.ceil(w / tileSize);
  const nz = Math.ceil(d / tileSize);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (rand() < missing) continue;
      xf.push([
        -w / 2 + tileSize / 2 + i * tileSize,
        base,
        -d / 2 + tileSize / 2 + j * tileSize,
        0,
        shade(color, 0.16, rand()),
      ]);
    }
  }
  return instanced(tileGeo(tileSize, tileSize), abs(color, { roughness: 0.7 }), xf);
}

/**
 * A city building facade: brick courses plus lit and dark windows. Used for
 * the hotel, the rooftop skyline and everything the chase runs past.
 */
export function facade(wStuds, hCourses, opts = {}) {
  const {
    color = 0x6b4a3a, seed = 11, windowRows = null, litChance = 0.22,
    windowW = 2, windowH = 3, spacingX = 6, startY = 3, spacingY = 5,
    simple = false,
  } = opts;
  const rand = rng(seed);
  const g = new THREE.Group();

  const openings = [];
  const wins = [];
  const rows = windowRows ?? Math.floor((hCourses - startY) / spacingY);
  for (let r = 0; r < rows; r++) {
    const yb = (startY + r * spacingY) * BRICK_H;
    for (let x = -wStuds / 2 + 3; x <= wStuds / 2 - 3; x += spacingX) {
      openings.push([x, windowW, yb, windowH * BRICK_H]);
      wins.push({ x, yb, lit: rand() < litChance, k: rand() });
    }
  }

  if (simple) {
    // Background buildings: a brick-built wall this size is 1,500 parts and
    // several hundred thousand triangles that nobody will ever be close
    // enough to count. Distant blocks get a slab and their windows.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(wStuds * PITCH, hCourses * BRICK_H, PITCH),
      abs(color, { roughness: 0.72 }),
    );
    slab.position.y = (hCourses * BRICK_H) / 2;
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);
    // Course lines, so it still reads as coursed brick in silhouette.
    const lines = [];
    for (let c = 4; c < hCourses; c += 4) {
      lines.push([0, c * BRICK_H, -0.42, 0, shade(color, 0.18, rand())]);
    }
    if (lines.length) {
      g.add(instanced(tileGeo(Math.max(1, Math.round(wStuds)), 1), abs(color), lines));
    }
  } else {
    g.add(wall(wStuds, hCourses, { color, seed, openings, variation: 0.13 }));
  }

  // Glazing: a transparent pane set back from the brick face.
  const paneGeo = new THREE.BoxGeometry(windowW * PITCH - 0.2, windowH * BRICK_H - 0.15, 0.16);
  const dark = absTrans(0x0b1418, { opacity: 0.72, roughness: 0.18 });
  // Real walls have a hole to sit the glazing in; slabs don't, so the panes
  // go on the outer face instead.
  const paneZ = simple ? 0.54 : -0.22;
  const lit = [];
  for (const w of wins) {
    const m = new THREE.Mesh(paneGeo, dark);
    m.position.set(w.x, w.yb + (windowH * BRICK_H) / 2, paneZ);
    g.add(m);
    if (w.lit) {
      const l = new THREE.Mesh(paneGeo, glow(w.k > 0.6 ? 0xffcf8a : 0xd9e6a8, 0.7 + w.k * 0.6));
      l.position.set(w.x, w.yb + (windowH * BRICK_H) / 2, paneZ + (simple ? 0.02 : -0.08));
      g.add(l);
      lit.push(l);
    }
  }
  g.userData.lit = lit;
  g.userData.height = hCourses * BRICK_H;
  return g;
}

/** Flat roof: tiles, a parapet wall all round, and rooftop clutter. */
export function roofDeck(w, d, opts = {}) {
  const {
    color = C.darkGrey, parapet = 3, seed = 5, y = 0, clutter = 2,
    // Edges to leave open, e.g. ['+x'] for a roof someone has to jump off.
    open = [],
  } = opts;
  const g = new THREE.Group();
  const deck = tiledFloor(w, d, { color, seed, y, tileSize: 4 });
  g.add(deck);

  if (parapet > 0) {
    const mk = (len, px, pz, ry) => {
      const p = wall(len, parapet, { color: 0x5c4038, seed: seed + len, variation: 0.12, capTiles: true });
      p.position.set(px, y, pz);
      p.rotation.y = ry;
      g.add(p);
      return p;
    };
    if (!open.includes('-z')) mk(w, 0, -d / 2 + 0.5, 0);
    if (!open.includes('+z')) mk(w, 0, d / 2 - 0.5, 0);
    if (!open.includes('-x')) mk(d, -w / 2 + 0.5, 0, Math.PI / 2);
    if (!open.includes('+x')) mk(d, w / 2 - 0.5, 0, Math.PI / 2);
  }
  g.userData.parapet = parapet * BRICK_H;
  g.userData.open = open;

  const rand = rng(seed * 3 + 1);
  for (let i = 0; i < clutter; i++) {
    const kind = rand();
    const x = (rand() - 0.5) * (w - 10);
    const z = (rand() - 0.5) * (d - 10);
    if (kind < 0.45) {
      // Air handling unit.
      const box = new THREE.Group();
      const body = new THREE.Mesh(brickGeo(6, 5, BRICK_H * 3), abs(C.grey));
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.9, 16), abs(C.darkGrey));
      vent.position.y = BRICK_H * 3 + 0.45;
      box.add(body, vent);
      box.position.set(x, y, z);
      box.rotation.y = rand() * 3;
      g.add(box);
    } else if (kind < 0.75) {
      // Water tank on a frame — pure Chicago rooftop.
      const t = new THREE.Group();
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 18), abs(C.brown));
      tank.position.y = 6;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 18), abs(C.darkBrown));
      cone.position.y = 9.2;
      t.add(tank, cone);
      for (const [lx, lz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), abs(C.darkBrown));
        leg.position.set(lx, 1.8, lz);
        t.add(leg);
      }
      t.position.set(x, y, z);
      g.add(t);
    } else {
      // Vent stacks.
      for (let k = 0; k < 3; k++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.6 + rand(), 12), abs(C.silver));
        p.position.set(x + k * 1.2, y + 0.9, z);
        g.add(p);
      }
    }
  }
  g.userData.collider = [[0, y - 0.5, 0], [w, 1, d]];
  return g;
}

/** Chain-link / rail fence for rooftop edges and alleys. */
export function railing(len, opts = {}) {
  const { h = 2.6, color = C.darkGrey, posts = 6 } = opts;
  const g = new THREE.Group();
  const m = abs(color, { roughness: 0.7 });
  for (let i = 0; i <= posts; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h, 8), m);
    p.position.set(-len / 2 + (len / posts) * i, h / 2, 0);
    g.add(p);
  }
  for (const y of [h * 0.98, h * 0.55]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), m);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = y;
    g.add(bar);
  }
  return g;
}

/** Stair flight rising along +Z. Returns group with `top` in userData. */
export function stairs(steps, opts = {}) {
  const { w = 8, rise = BRICK_H, run = 1.6, color = C.darkBrown } = opts;
  const g = new THREE.Group();
  const xf = [];
  for (let i = 0; i < steps; i++) {
    xf.push([0, i * rise, i * run]);
  }
  g.add(instanced(brickGeo(w, 2, rise), abs(color), xf));
  g.userData.top = new THREE.Vector3(0, steps * rise, steps * run);
  g.userData.colliders = [];
  for (let i = 0; i < steps; i++) {
    g.userData.colliders.push([[0, i * rise + rise / 2, i * run], [w, rise, 2]]);
  }
  return g;
}

/** Studded ground for the street: asphalt plates with kerbs and markings. */
export function street(w, d, opts = {}) {
  const { seed = 21 } = opts;
  const g = new THREE.Group();
  g.add(tiledFloor(w, d, { color: 0x3a3f42, seed, tileSize: 4, y: 0 }));
  // Centre line.
  const line = [];
  for (let z = -d / 2 + 2; z < d / 2; z += 6) {
    line.push([0, 0, z]);
  }
  g.add(instanced(tileGeo(1, 3), abs(C.yellow, { roughness: 0.6 }), line));
  return g;
}

/** Kerb + footpath along X at a given Z. */
export function sidewalk(len, opts = {}) {
  const { depth = 8, y = 0, seed = 33 } = opts;
  const g = new THREE.Group();
  const walk = tiledFloor(len, depth, { color: 0x8d918f, seed, tileSize: 4, y });
  g.add(walk);
  const kerb = new THREE.Mesh(
    new THREE.BoxGeometry(len * PITCH, PLATE_H * 2, PITCH),
    abs(0x9aa09c, { roughness: 0.7 }),
  );
  kerb.position.set(0, y, -depth / 2);
  kerb.receiveShadow = true;
  g.add(kerb);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(len * PITCH, PLATE_H, depth * PITCH),
    abs(0x7f8482, { roughness: 0.8 }),
  );
  slab.position.set(0, y - PLATE_H - PLATE_H / 2, 0);
  slab.receiveShadow = true;
  g.add(slab);
  g.userData.collider = [[0, y - PLATE_H, 0], [len, PLATE_H * 2, depth]];
  return g;
}

/** A single sodium street lamp with its own pool of light. */
export function streetLamp(opts = {}) {
  const { h = 16, arm = 4, color = 0xffd79a, intensity = 200 } = opts;
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, h, 12), abs(C.darkGreenGrey));
  post.position.y = h / 2;
  const base = new THREE.Mesh(brickGeo(2, 2, PLATE_H * 2), abs(C.darkGreenGrey));
  const curve = new THREE.Mesh(new THREE.TorusGeometry(arm * 0.5, 0.26, 8, 12, Math.PI / 2), abs(C.darkGreenGrey));
  curve.position.set(arm * 0.5, h, 0);
  curve.rotation.z = 0;
  const headM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.0), abs(C.darkGreenGrey));
  headM.position.set(arm, h - arm * 0.5, 0);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.85), glow(color, 3.4));
  lens.position.set(arm, h - arm * 0.5 - 0.3, 0);
  g.add(post, base, curve, headM, lens);

  const light = new THREE.SpotLight(color, intensity, 46, Math.PI * 0.34, 0.55, 1.6);
  light.position.set(arm, h - arm * 0.5 - 0.4, 0);
  light.target.position.set(arm, 0, 0);
  g.add(light, light.target);
  g.userData.light = light;
  g.userData.lens = lens;
  return g;
}

/** Fire escape: a cage of Technic-ish bars bolted to a wall at x = 0. */
export function fireEscape(levels, opts = {}) {
  const { floorH = 9, w = 8 } = opts;
  const g = new THREE.Group();
  const m = abs(C.trueBlack, { roughness: 0.72 });
  for (let i = 0; i < levels; i++) {
    const y = i * floorH;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 4), m);
    deck.position.set(0, y, 2);
    g.add(deck);
    const rail = railing(w, { h: 2.2, color: C.trueBlack, posts: 5 });
    rail.position.set(0, y, 3.9);
    g.add(rail);
    // Ladder to the next level.
    if (i < levels - 1) {
      const lad = new THREE.Group();
      for (let s = 0; s < 8; s++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), m);
        r.rotation.z = Math.PI / 2;
        r.position.set(0, s * (floorH / 8), 0);
        lad.add(r);
      }
      for (const sx of [-0.8, 0.8]) {
        const side = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, floorH, 6), m);
        side.position.set(sx, floorH / 2, 0);
        lad.add(side);
      }
      lad.position.set(w * 0.3, y, 3.2);
      g.add(lad);
    }
  }
  return g;
}
