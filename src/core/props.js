import * as THREE from 'three';
import { abs, absTrans, chrome, rubber, glow, C } from './materials.js';
import {
  brickGeo, plateGeo, tileGeo, slopeGeo, roundBrickGeo, barGeo,
  tyreGeo, hubGeo, instanced, studGeo, BRICK_H, PLATE_H,
} from './legoParts.js';

/**
 * Set dressing, all of it brick-built.
 *
 * Vehicles follow the LEGO City recipe — a plate for the chassis, bricks for
 * the body, slopes for the bonnet and roof, a windscreen, four wheels on axles
 * — because that silhouette is instantly readable even in the dark.
 */

const wheelPairs = (g, positions, r = 0.85, w = 0.6) => {
  const wheels = [];
  for (const [x, y, z] of positions) {
    const hub = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo(r, w), rubber());
    const rim = new THREE.Mesh(hubGeo(r * 0.6, w * 1.04), chrome(C.silver, { roughness: 0.34 }));
    hub.add(tyre, rim);
    hub.position.set(x, y, z);
    g.add(hub);
    wheels.push(hub);
  }
  return wheels;
};

/** Agent Smith's car: a black sedan with tinted glass. */
export function sedan(opts = {}) {
  const { color = C.trueBlack, tint = 0.86 } = opts;
  const g = new THREE.Group();
  const body = abs(color, { clearcoat: 0.95, clearcoatRoughness: 0.1, roughness: 0.3 });
  const glass = absTrans(0x0a0d10, { opacity: tint, roughness: 0.06 });

  const chassis = new THREE.Mesh(plateGeo(6, 14), abs(C.darkGrey));
  chassis.position.y = 0.9;
  g.add(chassis);

  const lower = new THREE.Mesh(brickGeo(6, 14), body);
  lower.position.y = 0.9 + PLATE_H;
  g.add(lower);

  const sill = new THREE.Mesh(brickGeo(6, 10), body);
  sill.position.set(0, 0.9 + PLATE_H + BRICK_H, -0.4);
  g.add(sill);

  // Bonnet and boot slopes.
  const bonnet = new THREE.Mesh(slopeGeo(6, 3, BRICK_H), body);
  bonnet.position.set(0, 0.9 + PLATE_H + BRICK_H, 5.4);
  bonnet.rotation.y = Math.PI;
  g.add(bonnet);
  const boot = new THREE.Mesh(slopeGeo(6, 2, BRICK_H * 0.8), body);
  boot.position.set(0, 0.9 + PLATE_H + BRICK_H, -6.2);
  g.add(boot);

  // Cabin: windscreen, side glass, roof.
  const cabinY = 0.9 + PLATE_H + BRICK_H * 2;
  const wind = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.4, 0.28), glass);
  wind.position.set(0, cabinY + 1.1, 3.5);
  wind.rotation.x = -0.42;
  g.add(wind);
  const rear = wind.clone();
  rear.position.z = -4.4;
  rear.rotation.x = 0.46;
  g.add(rear);
  for (const sx of [-2.75, 2.75]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 7.4), glass);
    side.position.set(sx, cabinY + 1.0, -0.5);
    g.add(side);
  }
  const roof = new THREE.Mesh(tileGeo(6, 9), body);
  roof.position.set(0, cabinY + 2.1, -0.5);
  g.add(roof);
  for (const sx of [-2.85, 2.85]) {
    const pillar = new THREE.Mesh(brickGeo(1, 9, BRICK_H * 1.8), body);
    pillar.position.set(sx, cabinY, -0.5);
    g.add(pillar);
  }

  // Lights and trim.
  const hl = [];
  for (const sx of [-1.9, 1.9]) {
    const l = new THREE.Mesh(roundBrickGeo(1, 0.4, false), glow(0xfff6e0, 2.6));
    l.rotation.x = Math.PI / 2;
    l.position.set(sx, 1.9, 7.05);
    g.add(l);
    hl.push(l);
    const t = new THREE.Mesh(roundBrickGeo(1, 0.4, false), glow(0xff2a12, 1.4));
    t.rotation.x = Math.PI / 2;
    t.position.set(sx, 2.0, -7.05);
    g.add(t);
  }
  const grille = new THREE.Mesh(tileGeo(4, 1), chrome(C.silver));
  grille.rotation.x = Math.PI / 2;
  grille.position.set(0, 1.5, 7.02);
  g.add(grille);

  g.userData.wheels = wheelPairs(g, [[-3.1, 0.9, 4.4], [3.1, 0.9, 4.4], [-3.1, 0.9, -4.4], [3.1, 0.9, -4.4]]);
  g.userData.headlights = hl;
  g.userData.doorY = cabinY;
  return g;
}

/** Squad car: white over blue, lightbar that actually strobes. */
export function cruiser(opts = {}) {
  const { seed = 1 } = opts;
  const g = new THREE.Group();
  const s = sedan({ color: C.white, tint: 0.4 });
  g.add(s);
  // Blue lower body panel.
  const panel = new THREE.Mesh(brickGeo(6, 10, BRICK_H * 0.9), abs(C.darkBlue));
  panel.position.set(0, 1.35, -0.4);
  g.add(panel);

  const bar = new THREE.Group();
  const base = new THREE.Mesh(plateGeo(4, 2), abs(C.trueBlack));
  bar.add(base);
  // Cloned so each car strobes on its own phase.
  const red = new THREE.Mesh(brickGeo(2, 2, 0.7),
    absTrans(0xff1a0a, { opacity: 0.8, emissive: 0xff1a0a }).clone());
  const blue = new THREE.Mesh(brickGeo(2, 2, 0.7),
    absTrans(0x1a4aff, { opacity: 0.8, emissive: 0x1a4aff }).clone());
  red.position.set(-1, PLATE_H, 0);
  blue.position.set(1, PLATE_H, 0);
  bar.add(red, blue);
  bar.position.set(0, 5.5, -0.5);
  g.add(bar);

  const rl = new THREE.PointLight(0xff2010, 0, 26, 2);
  const bl = new THREE.PointLight(0x2040ff, 0, 26, 2);
  rl.position.set(-1, 6.2, -0.5);
  bl.position.set(1, 6.2, -0.5);
  g.add(rl, bl);

  g.userData.strobe = { red, blue, rl, bl, seed };
  g.userData.wheels = s.userData.wheels;
  return g;
}

/** Drive the light bar. Call every frame. */
export function strobe(car, t) {
  const s = car.userData.strobe;
  if (!s) return;
  const p = (t * 3.4 + s.seed * 0.37) % 1;
  const on = p < 0.28 ? 1 : 0;
  const off = p > 0.5 && p < 0.78 ? 1 : 0;
  s.red.material.emissiveIntensity = 0.15 + on * 1.4;
  s.blue.material.emissiveIntensity = 0.15 + off * 1.4;
  s.rl.intensity = on * 520;
  s.bl.intensity = off * 520;
}

/** The garbage truck. Blunt, front-loading, and entirely made of grey bricks. */
export function garbageTruck() {
  const g = new THREE.Group();
  const body = abs(0x4a5148, { roughness: 0.55 });
  const dark = abs(C.darkGrey);

  const chassis = new THREE.Mesh(plateGeo(8, 26), dark);
  chassis.position.y = 1.5;
  g.add(chassis);

  // Cab.
  const cab = new THREE.Mesh(brickGeo(8, 8, BRICK_H * 4), body);
  cab.position.set(0, 1.5 + PLATE_H, 8.6);
  g.add(cab);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 0.3), absTrans(0x0d1418, { opacity: 0.55 }));
  wind.position.set(0, 1.5 + PLATE_H + BRICK_H * 4 + 1.6, 12.4);
  wind.rotation.x = -0.12;
  g.add(wind);
  const cabTop = new THREE.Mesh(brickGeo(8, 8, BRICK_H * 3), body);
  cabTop.position.set(0, 1.5 + PLATE_H + BRICK_H * 4, 8.2);
  g.add(cabTop);
  const roof = new THREE.Mesh(tileGeo(8, 8), body);
  roof.position.set(0, 1.5 + PLATE_H + BRICK_H * 7, 8.2);
  g.add(roof);

  // Hopper with a sloped tail.
  const hopper = new THREE.Mesh(brickGeo(8, 16, BRICK_H * 6), body);
  hopper.position.set(0, 1.5 + PLATE_H, -4.4);
  g.add(hopper);
  const tail = new THREE.Mesh(slopeGeo(8, 4, BRICK_H * 3), abs(0x3c423a));
  tail.position.set(0, 1.5 + PLATE_H + BRICK_H * 6, -10.4);
  g.add(tail);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(brickGeo(9, 1, BRICK_H * 6), abs(0x565d53));
    rib.position.set(0, 1.5 + PLATE_H, -11 + i * 3.2);
    g.add(rib);
  }

  // Bull bar and lights: the bit that meets the phone booth.
  const bar = new THREE.Mesh(brickGeo(9, 1, BRICK_H * 2), dark);
  bar.position.set(0, 1.2, 13.2);
  g.add(bar);
  const hl = [];
  for (const sx of [-2.8, 2.8]) {
    const l = new THREE.Mesh(roundBrickGeo(1.4, 0.4, false), glow(0xfff4dd, 4.2));
    l.rotation.x = Math.PI / 2;
    l.position.set(sx, 2.6, 13.4);
    g.add(l);
    hl.push(l);
  }
  const beamL = new THREE.SpotLight(0xfff2d8, 0, 90, Math.PI * 0.2, 0.5, 1.4);
  beamL.position.set(-2.4, 2.8, 13);
  beamL.target.position.set(-2.4, 0, 40);
  const beamR = beamL.clone();
  beamR.position.x = 2.4;
  beamR.target.position.set(2.4, 0, 40);
  g.add(beamL, beamL.target, beamR, beamR.target);

  g.userData.wheels = wheelPairs(g, [
    [-4.3, 1.6, 9.4], [4.3, 1.6, 9.4],
    [-4.3, 1.6, -5.6], [4.3, 1.6, -5.6],
    [-4.3, 1.6, -8.4], [4.3, 1.6, -8.4],
  ], 1.6, 0.9);
  g.userData.headlights = hl;
  g.userData.beams = [beamL, beamR];
  return g;
}

/** The phone booth. Trans-clear panels in an aluminium frame. */
export function phoneBooth() {
  const g = new THREE.Group();
  const frame = abs(0x8d938f, { metalness: 0.5, roughness: 0.34 });
  const plex = absTrans(0xcfe6ea, { opacity: 0.16, roughness: 0.04 });

  const base = new THREE.Mesh(brickGeo(6, 6, PLATE_H * 2), abs(C.darkGrey));
  g.add(base);

  const H = 11;
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, H, 0.55), frame);
    post.position.set(x, H / 2 + PLATE_H * 2, z);
    g.add(post);
  }
  const panels = [];
  const mk = (w, h, x, y, z, ry) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), plex);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    g.add(p);
    panels.push(p);
    return p;
  };
  const py = PLATE_H * 2 + H * 0.55;
  mk(4.7, H * 0.86, 0, py, -2.6, 0);
  mk(4.7, H * 0.86, -2.6, py, 0, Math.PI / 2);
  mk(4.7, H * 0.86, 2.6, py, 0, Math.PI / 2);
  mk(2.1, H * 0.86, -1.35, py, 2.6, 0);   // folding door, left leaf
  mk(2.1, H * 0.86, 1.35, py, 2.6, 0);    // right leaf

  const roof = new THREE.Mesh(brickGeo(6, 6, PLATE_H), frame);
  roof.position.y = H + PLATE_H * 2;
  g.add(roof);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 0.2), glow(0xdff0ff, 1.5));
  sign.position.set(0, H - 0.3, 2.72);
  g.add(sign);
  const lamp = new THREE.PointLight(0xdaf0ff, 70, 20, 2);
  lamp.position.set(0, H - 1, 0);
  g.add(lamp);

  // The phone itself, on the back wall.
  const box = new THREE.Mesh(brickGeo(3, 1, BRICK_H * 3), abs(0x2b2f33));
  box.position.set(0, 5.4, -2.2);
  g.add(box);
  const hook = new THREE.Mesh(barGeo(0.5, 0.09), chrome());
  hook.position.set(-1.1, 5.6, -1.9);
  g.add(hook);
  const handset = new THREE.Group();
  const hs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.2, 0.26), abs(C.trueBlack));
  handset.add(hs);
  handset.position.set(-1.2, 5.4, -1.75);
  g.add(handset);
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 5, 12, Math.PI * 1.2), abs(C.trueBlack));
  cord.position.set(-0.7, 4.5, -1.9);
  cord.rotation.y = Math.PI / 2;
  g.add(cord);

  g.userData.panels = panels;
  g.userData.handset = handset;
  g.userData.sign = sign;
  g.userData.lamp = lamp;
  g.userData.height = H;
  return g;
}

/** Fold-up table, powerbook, modem, phone: the whole of Room 303. */
export function workstation() {
  const g = new THREE.Group();
  const legM = abs(C.silver, { metalness: 0.55, roughness: 0.4 });
  const top = new THREE.Mesh(plateGeo(10, 6), abs(0xcfc7ae, { roughness: 0.6 }));
  const H = 3.6;
  top.position.y = H;
  g.add(top);
  for (const [x, z] of [[-4.2, -2.2], [4.2, -2.2], [-4.2, 2.2], [4.2, 2.2]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, H, 8), legM);
    l.position.set(x, H / 2, z);
    g.add(l);
  }

  // Powerbook: wedge base, hinged lid, glowing screen.
  const laptop = new THREE.Group();
  const base = new THREE.Mesh(brickGeo(6, 5, PLATE_H * 1.6), abs(0x3c3f42));
  laptop.add(base);
  const kb = new THREE.Mesh(tileGeo(5, 3), abs(0x2b2e30));
  kb.position.set(0, PLATE_H * 1.6, 0.6);
  laptop.add(kb);
  const lid = new THREE.Group();
  const lidPanel = new THREE.Mesh(brickGeo(6, 5, PLATE_H * 1.2), abs(0x3c3f42));
  lidPanel.rotation.x = -Math.PI / 2;
  lidPanel.position.set(0, 2.2, 0);
  lid.add(lidPanel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), glow(0x53ff9d, 1.5));
  screen.position.set(0, 2.2, 0.33);
  lid.add(screen);
  lid.position.set(0, PLATE_H * 1.6, -2.2);
  lid.rotation.x = 0.22;
  laptop.add(lid);
  const screenLight = new THREE.PointLight(0x66ffb0, 60, 16, 2);
  screenLight.position.set(0, 3.2, 1.6);
  laptop.add(screenLight);
  laptop.position.set(-1.2, H + PLATE_H, 0);
  laptop.rotation.y = 0.12;
  g.add(laptop);

  // Modem with blinking LEDs.
  const modem = new THREE.Group();
  const mbody = new THREE.Mesh(brickGeo(4, 3, BRICK_H), abs(0xd8d2bd));
  modem.add(mbody);
  const leds = [];
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), glow(i % 2 ? 0x44ff66 : 0xffaa22, 2));
    led.position.set(-1.2 + i * 0.8, BRICK_H * 0.6, 1.55);
    modem.add(led);
    leds.push(led);
  }
  modem.position.set(3.4, H + PLATE_H, -0.6);
  g.add(modem);

  // Desk phone, off the hook.
  const phone = new THREE.Group();
  const pbody = new THREE.Mesh(brickGeo(3, 3, BRICK_H * 0.8), abs(0x24282b));
  phone.add(pbody);
  const hs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.1), abs(0x1a1d20));
  hs.position.set(0, BRICK_H * 0.8 + 0.2, 0);
  phone.add(hs);
  phone.position.set(3.2, H + PLATE_H, 2.0);
  g.add(phone);

  const chair = new THREE.Group();
  const seat = new THREE.Mesh(plateGeo(4, 4), abs(0x8a8f92));
  seat.position.y = 2.4;
  const backr = new THREE.Mesh(brickGeo(4, 1, BRICK_H * 2.5), abs(0x8a8f92));
  backr.position.set(0, 2.4 + PLATE_H, -1.6);
  chair.add(seat, backr);
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 6), legM);
    l.position.set(x, 1.2, z);
    chair.add(l);
  }
  chair.position.set(-1.2, 0, 5.2);
  chair.rotation.y = Math.PI;
  g.add(chair);

  g.userData.laptop = laptop;
  g.userData.screen = screen;
  g.userData.screenLight = screenLight;
  g.userData.leds = leds;
  g.userData.modem = modem;
  g.userData.phone = phone;
  g.userData.chair = chair;
  g.userData.tableH = H + PLATE_H;
  return g;
}

/** A hinged door slab. `hinge` group rotates; `slab` can be blown to bits. */
export function door(w = 5, courses = 6, color = 0x6b4a3a) {
  const hinge = new THREE.Group();
  const slab = new THREE.Group();
  const panel = new THREE.Mesh(brickGeo(w, 1, courses * BRICK_H), abs(color));
  panel.position.set(w / 2, 0, 0);
  slab.add(panel);
  const knob = new THREE.Mesh(roundBrickGeo(1, 0.3, false), chrome(C.gold));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(w - 0.8, courses * BRICK_H * 0.5, 0.7);
  slab.add(knob);
  const numberPlate = new THREE.Mesh(tileGeo(2, 1), abs(C.gold, { metalness: 0.7 }));
  numberPlate.rotation.x = Math.PI / 2;
  numberPlate.position.set(w / 2, courses * BRICK_H * 0.78, 0.62);
  slab.add(numberPlate);
  hinge.add(slab);
  hinge.userData.slab = slab;
  hinge.userData.panel = panel;
  hinge.userData.size = [w, courses * BRICK_H, 1];
  return hinge;
}

/** Transparent pane, ready to be replaced by a cloud of trans-clear bricks. */
export function glassPane(w, h, opts = {}) {
  const { color = 0xd6e9ee, opacity = 0.2 } = opts;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.2),
    absTrans(color, { opacity, roughness: 0.02 }),
  );
  m.userData.size = [w, h, 0.2];
  return m;
}

/** Alley dressing: dumpster, bags, puddle sheen. */
export function dumpster(color = 0x2c5b3a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(brickGeo(10, 6, BRICK_H * 4), abs(color, { roughness: 0.6 }));
  g.add(body);
  const lid = new THREE.Mesh(tileGeo(10, 6), abs(color));
  lid.position.y = BRICK_H * 4;
  lid.rotation.z = 0.03;
  g.add(lid);
  g.userData.wheels = wheelPairs(g, [[-4, 0.5, 2], [4, 0.5, 2], [-4, 0.5, -2], [4, 0.5, -2]], 0.5, 0.3);
  return g;
}

/** Neon sign — the hotel's name, mostly burnt out. */
export function neonSign(text = 'HOTEL', opts = {}) {
  const { color = 0xff3355, size = 2.6 } = opts;
  const g = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, 512, 128);
  c.font = 'bold 92px ui-monospace, monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.shadowColor = '#ff5577';
  c.shadowBlur = 26;
  c.fillStyle = '#ffdde6';
  c.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 4, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  g.add(panel);
  const box = new THREE.Mesh(brickGeo(Math.round(size * 4), 1, size * 1.2), abs(C.trueBlack));
  box.position.set(0, -size * 0.6, -0.4);
  g.add(box);
  const l = new THREE.PointLight(color, 18, 26, 2);
  l.position.z = 1.4;
  g.add(l);
  g.userData.panel = panel;
  g.userData.light = l;
  return g;
}

/** Torn-open ceiling / bare bulb, swinging. */
export function bareBulb() {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), abs(C.trueBlack));
  cord.position.y = -1.5;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), glow(0xffe6b0, 2.4));
  bulb.position.y = -3.2;
  const l = new THREE.PointLight(0xffdca8, 110, 34, 2);
  l.position.y = -3.2;
  g.add(cord, bulb, l);
  g.userData.light = l;
  g.userData.bulb = bulb;
  return g;
}

/** Studded LEGO logo text, extruded from 1×1 round plates. Used for the title. */
export function studText(text, opts = {}) {
  const { color = 0x1de56a, scale = 1, glowMat = true } = opts;
  const cv = document.createElement('canvas');
  const px = 12;
  cv.width = text.length * px * 0.72 | 0;
  cv.height = px * 1.4 | 0;
  const c = cv.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#fff';
  c.font = `bold ${px}px ui-monospace, monospace`;
  c.textBaseline = 'middle';
  c.fillText(text, 1, cv.height / 2);
  const data = c.getImageData(0, 0, cv.width, cv.height).data;

  const xf = [];
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (data[(y * cv.width + x) * 4] > 128) {
        xf.push([(x - cv.width / 2) * scale, (cv.height - y) * scale, 0]);
      }
    }
  }
  // Pre-rotate the plate so its stud faces the camera down +Z.
  const geo = roundBrickGeo(1, PLATE_H, true).clone();
  geo.rotateX(Math.PI / 2);
  const mat = glowMat
    ? new THREE.MeshStandardMaterial({ color: 0x0a1f12, emissive: color, emissiveIntensity: 1.6, roughness: 0.5 })
    : abs(color);
  const im = instanced(geo, mat, xf);
  const g = new THREE.Group();
  g.add(im);
  g.userData.count = xf.length;
  g.userData.mesh = im;
  return g;
}
