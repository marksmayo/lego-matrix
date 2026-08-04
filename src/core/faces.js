import * as THREE from 'three';

/**
 * Printed minifigure faces, painted to a canvas at runtime.
 *
 * The head is a cylinder, so the print has to wrap. The canvas covers the full
 * circumference (4.96 u) by the head height (1.4 u) — which means the pixel
 * grid is stretched ~1.8× vertically. Rather than pre-distort every shape, the
 * canvas gets a transform so drawing happens in head units with Y up, and the
 * stretch cancels out when it lands on the cylinder.
 */

const W = 512, H = 256;
const HEAD_H = 1.4;
const CIRC = Math.PI * 1.58;   // circumference of a 12.6 mm head

const cache = new Map();

function paint(draw) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true;
  return { cv, g };
}

function unitSpace(g) {
  // x: head units around the cylinder, centred on the face. y: up from the chin.
  g.setTransform(W / CIRC, 0, 0, -H / HEAD_H, W / 2, H);
  g.lineJoin = 'round';
  g.lineCap = 'round';
}

function ellipse(g, x, y, rx, ry, fill) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

/**
 * @param {object} o
 *  skin, eyes, brow, mouth ('grim'|'shout'|'smirk'|'set'|'open'|'flat'),
 *  shades, moustache, stubble, earpiece, lips, sweat, scar
 */
export function makeFace(o = {}) {
  const key = JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);

  const skin = o.skin ?? '#f2cd37';
  const { cv, g } = paint();

  // Base: the whole head is moulded in one colour, print sits on top.
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);

  unitSpace(g);

  const ink = '#151515';
  const eyeY = 0.86;
  const eyeX = 0.235;

  if (o.shades) {
    // Wraparound agent shades: a band that runs off both edges of the face,
    // because a minifig print that stops short of the temples looks like
    // someone drew glasses on with a marker.
    g.fillStyle = '#0d0f11';
    g.beginPath();
    g.moveTo(-0.62, eyeY + 0.15);
    g.lineTo(0.62, eyeY + 0.15);
    g.lineTo(0.58, eyeY - 0.13);
    g.quadraticCurveTo(0.3, eyeY - 0.21, 0.075, eyeY - 0.12);
    g.quadraticCurveTo(0, eyeY - 0.07, -0.075, eyeY - 0.12);
    g.quadraticCurveTo(-0.3, eyeY - 0.21, -0.58, eyeY - 0.13);
    g.closePath();
    g.fill();
    // Specular streak across the lenses.
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 0.045;
    g.beginPath();
    g.moveTo(-0.5, eyeY + 0.07);
    g.lineTo(-0.16, eyeY - 0.02);
    g.moveTo(0.18, eyeY + 0.07);
    g.lineTo(0.5, eyeY - 0.01);
    g.stroke();
  } else {
    const er = o.eyes === 'wide' ? 0.105 : 0.082;
    ellipse(g, -eyeX, eyeY, er, er, ink);
    ellipse(g, eyeX, eyeY, er, er, ink);
    // Catchlights — the single detail that stops a face reading as dead.
    ellipse(g, -eyeX + 0.03, eyeY + 0.035, er * 0.3, er * 0.3, '#ffffff');
    ellipse(g, eyeX + 0.03, eyeY + 0.035, er * 0.3, er * 0.3, '#ffffff');
    if (o.eyes === 'wide') {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 0.028;
      g.beginPath();
      g.arc(-eyeX, eyeY, er + 0.035, 0, Math.PI * 2);
      g.arc(eyeX, eyeY, er + 0.035, 0, Math.PI * 2);
      g.stroke();
    }
  }

  if (o.brow) {
    g.strokeStyle = ink;
    g.lineWidth = 0.055;
    g.beginPath();
    if (o.brow === 'angry') {
      g.moveTo(-0.38, eyeY + 0.26); g.lineTo(-0.1, eyeY + 0.15);
      g.moveTo(0.38, eyeY + 0.26); g.lineTo(0.1, eyeY + 0.15);
    } else if (o.brow === 'raised') {
      g.moveTo(-0.36, eyeY + 0.2); g.lineTo(-0.11, eyeY + 0.26);
      g.moveTo(0.36, eyeY + 0.2); g.lineTo(0.11, eyeY + 0.26);
    } else {
      g.moveTo(-0.36, eyeY + 0.22); g.lineTo(-0.11, eyeY + 0.22);
      g.moveTo(0.36, eyeY + 0.22); g.lineTo(0.11, eyeY + 0.22);
    }
    g.stroke();
  }

  if (o.stubble) {
    g.fillStyle = 'rgba(30,30,35,0.22)';
    g.beginPath();
    g.moveTo(-0.42, 0.62);
    g.quadraticCurveTo(0, 0.02, 0.42, 0.62);
    g.quadraticCurveTo(0, 0.34, -0.42, 0.62);
    g.fill();
  }

  const my = 0.44;
  g.strokeStyle = ink;
  g.lineWidth = 0.05;
  g.fillStyle = ink;
  switch (o.mouth) {
    case 'shout':
    case 'open':
      g.beginPath();
      g.ellipse(0, my - 0.02, 0.13, o.mouth === 'shout' ? 0.14 : 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(120,40,40,0.85)';
      g.beginPath();
      g.ellipse(0, my - 0.06, 0.085, 0.055, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'smirk':
      g.beginPath();
      g.moveTo(-0.15, my + 0.02);
      g.quadraticCurveTo(0.02, my - 0.06, 0.2, my + 0.12);
      g.stroke();
      break;
    case 'grim':
      g.beginPath();
      g.moveTo(-0.19, my + 0.05);
      g.quadraticCurveTo(0, my - 0.02, 0.19, my + 0.05);
      g.stroke();
      break;
    case 'flat':
      g.beginPath();
      g.moveTo(-0.16, my);
      g.lineTo(0.16, my);
      g.stroke();
      break;
    case 'set':
    default:
      g.beginPath();
      g.moveTo(-0.17, my + 0.03);
      g.quadraticCurveTo(0, my - 0.05, 0.17, my + 0.03);
      g.stroke();
      if (o.lips) {
        g.strokeStyle = o.lips;
        g.lineWidth = 0.085;
        g.beginPath();
        g.moveTo(-0.15, my + 0.02);
        g.quadraticCurveTo(0, my - 0.04, 0.15, my + 0.02);
        g.stroke();
      }
      break;
  }

  if (o.moustache) {
    g.fillStyle = o.moustache === true ? '#3b2a1c' : o.moustache;
    g.beginPath();
    g.moveTo(-0.26, my + 0.15);
    g.quadraticCurveTo(0, my + 0.05, 0.26, my + 0.15);
    g.quadraticCurveTo(0, my + 0.3, -0.26, my + 0.15);
    g.fill();
  }

  if (o.sweat) {
    ellipse(g, 0.44, 1.02, 0.045, 0.075, 'rgba(160,220,255,0.75)');
  }

  if (o.earpiece) {
    // Sits at a quarter turn around the head, i.e. the temple.
    g.strokeStyle = '#d8d8d0';
    g.lineWidth = 0.055;
    g.beginPath();
    g.moveTo(1.1, eyeY);
    g.quadraticCurveTo(1.24, eyeY - 0.28, 1.16, 0.22);
    g.stroke();
    ellipse(g, 1.1, eyeY + 0.02, 0.08, 0.08, '#e8e8e0');
  }

  g.setTransform(1, 0, 0, 1, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Geometry u = 0 faces +Z; the print is centred at u = 0.5. Shift it round.
  tex.offset.x = 0.5;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** A torso print: shirt, tie, badge, zip. Drawn flat on the chest. */
export function makeTorsoPrint(kind) {
  if (cache.has('torso:' + kind)) return cache.get('torso:' + kind);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');

  const base = {
    agent: '#20262c', cop: '#1d2b3a', trinity: '#15181c',
    lieut: '#2a3442', truckie: '#3f6b45',
  }[kind] || '#20262c';
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);

  if (kind === 'agent' || kind === 'lieut') {
    // White shirt V and a black tie.
    g.fillStyle = '#eceff1';
    g.beginPath();
    g.moveTo(86, 0); g.lineTo(128, 120); g.lineTo(170, 0);
    g.closePath(); g.fill();
    g.fillStyle = kind === 'agent' ? '#0e1114' : '#3a1f22';
    g.beginPath();
    g.moveTo(115, 22); g.lineTo(141, 22); g.lineTo(148, 210);
    g.lineTo(128, 232); g.lineTo(108, 210);
    g.closePath(); g.fill();
    // Lapels.
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(74, 0); g.lineTo(120, 138);
    g.moveTo(182, 0); g.lineTo(136, 138);
    g.stroke();
  }

  if (kind === 'cop') {
    g.fillStyle = '#101820';
    g.fillRect(0, 96, 256, 22);              // duty belt
    g.fillStyle = '#c9a227';
    g.beginPath();                            // shield
    g.moveTo(66, 44); g.lineTo(96, 44); g.lineTo(96, 70);
    g.lineTo(81, 82); g.lineTo(66, 70); g.closePath(); g.fill();
    g.fillStyle = '#e8eef2';
    g.fillRect(150, 40, 46, 8);               // name tape
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(128, 0); g.lineTo(128, 96);      // placket
    g.stroke();
    g.fillStyle = '#f2f4f6';
    g.font = 'bold 26px sans-serif';
    g.fillText('POLICE', 60, 150);
  }

  if (kind === 'trinity') {
    // A patent coat: high collar, centre zip, waist buckle, and the vertical
    // highlight that vinyl always has down the front of a curved panel.
    const sheen = g.createLinearGradient(78, 0, 178, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(214,232,255,0.16)');
    sheen.addColorStop(0.5, 'rgba(235,248,255,0.28)');
    sheen.addColorStop(0.58, 'rgba(214,232,255,0.16)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(78, 0, 100, 256);
    // Collar, standing up.
    g.fillStyle = '#101318';
    g.beginPath();
    g.moveTo(84, 0); g.lineTo(128, 46); g.lineTo(172, 0);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(190,214,238,0.35)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(84, 0); g.lineTo(128, 46); g.lineTo(172, 0); g.stroke();
    // Zip.
    g.strokeStyle = '#5c6470';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(128, 44); g.lineTo(128, 190); g.stroke();
    g.strokeStyle = 'rgba(226,240,255,0.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(125, 44); g.lineTo(125, 190); g.stroke();
    // Belt and buckle.
    g.fillStyle = '#0a0c0f';
    g.fillRect(0, 190, 256, 30);
    g.fillStyle = '#9aa2a8';
    g.fillRect(110, 193, 36, 24);
    g.fillStyle = '#4a5056';
    g.fillRect(118, 199, 20, 12);
    // Seams.
    g.strokeStyle = 'rgba(200,224,248,0.12)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(66, 0); g.lineTo(102, 188);
    g.moveTo(190, 0); g.lineTo(154, 188); g.stroke();
  }

  if (kind === 'truckie') {
    g.fillStyle = '#d9d2b6';
    g.fillRect(96, 0, 64, 96);
    g.fillStyle = '#2c3a2c';
    g.fillRect(0, 150, 256, 18);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('torso:' + kind, tex);
  return tex;
}
