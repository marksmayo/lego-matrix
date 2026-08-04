import * as THREE from 'three';
import { ScreenCanvas, GlyphField } from '../fx/rain.js';
import { Cues, camKeys, ease, seg, eseg, clamp, lerp } from '../core/anim.js';

/**
 * 1  ON COMPUTER SCREEN
 *
 * "A blinding cursor pulses in the electric darkness like a heart coursing
 * with phosphorous light." We start so close to the glass there are no
 * boundaries, pull back as the trace program runs, then move toward the
 * number as each digit snaps into place — and finally pass through the
 * numbers entirely, into the volume they were only ever a picture of.
 */

const NUMBER = '3125550690';

// [time, digits locked]. The area code fixes all three at once.
const LOCKS = [
  [24.0, 3], [28.5, 4], [32.0, 5], [35.5, 6],
  [39.0, 7], [43.0, 8], [46.5, 9], [50.4, 10],
];

const LINES = [
  [7.0, 'Call trans opt: received. 2-19-98 13:24:18 REC:Log>'],
  [11.0, 'Trace program: running.'],
  [51.0, 'Trace complete. Call origin: #312-555-0690'],
];

const CAM = [
  { t: 0, pos: [-0.96, -0.24, 4.6], look: [-0.96, -0.24, 0], fov: 32 },
  { t: 7, pos: [-0.9, -0.2, 5.6], look: [-0.9, -0.22, 0], fov: 32, ease: ease.io },
  { t: 15, pos: [-0.3, 0, 12.2], look: [0, 0, 0], fov: 38, ease: ease.ioCubic },
  { t: 23, pos: [0, 0.1, 13.4], look: [0, 0, 0], fov: 38 },
  { t: 34, pos: [1.6, 1.2, 10.4], look: [2.2, 1.8, 0], fov: 38, ease: ease.io },
  { t: 44, pos: [3.4, 3.0, 6.6], look: [4.2, 3.8, 0], fov: 36 },
  { t: 52, pos: [4.6, 4.4, 2.6], look: [5.2, 4.9, 0], fov: 34, ease: ease.io },
  { t: 56.6, pos: [5.0, 4.8, 0.55], look: [5.3, 5.05, 0], fov: 32, ease: ease.in },
  { t: 58.4, pos: [3.4, 3.0, -8], look: [1.2, 0.9, -40], fov: 40, ease: ease.inCubic },
  { t: 61.0, pos: [0.6, 0.4, -78], look: [0, 0, -150], fov: 52, ease: ease.linear },
  { t: 63.0, pos: [0, 0, -196], look: [0, 0, -300], fov: 62, ease: ease.linear },
];

export default {
  slug: "1 · On Computer Screen",
  start: 0,
  end: 63,
  hardOut: true,

  build(ctx) {
    const group = new THREE.Group();
    const cues = new Cues();

    const screen = new ScreenCanvas(1024, 768);
    screen.cursorFrac = [0.44, 0.52];

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 12),
      new THREE.MeshBasicMaterial({
        map: screen.tex, transparent: true, opacity: 1, depthWrite: false,
      }),
    );
    group.add(plane);

    // The volume behind the glass. Wide enough that flying through the corner
    // of the screen still puts us inside a downpour.
    const field = new GlyphField({
      columns: 140, perColumn: 22, width: 150, height: 150, depth: 330,
      size: 21, seed: 7,
    });
    field.opacity = 0;
    field.points.position.z = -6;
    group.add(field.points);

    const target = new THREE.Vector3();

    return {
      group, cues, screen, field, plane,

      enter(c) {
        c.post.u.uScan.value = 1;
        c.post.u.uGreen.value = 0.55;
        c.post.u.uAberr.value = 1.7;
        c.post.u.uVignette.value = 1.25;
        c.post.u.uGrain.value = 0.075;
        c.post.bloom.strength = 0.63;
        screen.clearLines();
        screen.rainLevel = 0;
        screen.cursorOn = true;
        screen.digits = null;
        c.audio.startRing();
        c.audio.cue('terminal');
      },

      exit(c) {
        c.post.u.uScan.value = 0;
        c.post.u.uGreen.value = 0.16;
        c.post.u.uAberr.value = 1.0;
        c.post.u.uGrain.value = 0.055;
        c.post.u.uWhite.value = 0;
        c.post.bloom.strength = 0.432;
        c.audio.stopRing();
        c.audio.stopHum();
        c.audio.cue(null);
      },

      /** Rebuild the terminal state after a scrub. */
      reseek(t) {
        screen.clearLines();
        for (const [lt, text] of LINES) {
          if (t >= lt) screen.print(text, {});
        }
        for (const l of screen.lines) l.t = 99;   // already fully typed
        let locked = 0;
        for (const [lt, n] of LOCKS) if (t >= lt) locked = n;
        if (t >= 11) screen.setTrace(NUMBER, locked);
      },

      update(t, dt, c) {
        /* ----- the picture on the glass ----- */
        cues.at(4.8, 'answer', (skip) => {
          if (!skip) { c.audio.stopRing(); c.audio.click(0.2); }
        });
        for (const [lt, text] of LINES) {
          cues.at(lt, 'line' + lt, (skip) => {
            screen.print(text);
            if (skip) screen.lines[screen.lines.length - 1].t = 99;
            else c.audio.modem();
          });
        }
        cues.at(11, 'trace', () => screen.setTrace(NUMBER, 0));
        for (const [lt, n] of LOCKS) {
          cues.at(lt, 'lock' + n, (skip) => {
            if (screen.digits) screen.digits.locked = n;
            if (!skip) c.audio.lockDigit(n);
          });
        }
        // Somebody is at a keyboard on the other end of this.
        if (t > 6 && t < 50 && Math.random() < dt * 7) c.audio.keyClick();

        screen.rainLevel = eseg(t, 8.5, 19) * (1 - seg(t, 56.5, 58.5) * 0.5);
        screen.cursorOn = t < 12;
        screen.draw(t, Math.max(dt, 1 / 120));

        /* ----- the volume behind it ----- */
        field.update(t);
        field.churn = 1 + seg(t, 40, 60) * 5;
        field.opacity = eseg(t, 30, 52) * 0.5 + seg(t, 52, 58) * 0.1;
        plane.material.opacity = 1 - eseg(t, 56.2, 58.6, ease.in);

        /* ----- camera ----- */
        camKeys(c.camera, t, CAM, target);

        /* ----- grade ----- */
        // "The ELECTRIC HUM of the green NUMBERS GROWING into an ominous ROAR."
        const roar = seg(t, 26, 62);
        c.audio.hum(0.03 + roar * roar * 0.5, 44 + roar * 26);
        c.post.u.uScan.value = 1 - seg(t, 56, 59.2) * 0.88;
        c.post.u.uAberr.value = 1.7 + seg(t, 55, 62) * 5;
        c.post.u.uGreen.value = 0.55 + seg(t, 50, 60) * 0.3;
        c.post.bloom.strength = 0.63 + seg(t, 48, 62) * 0.2;

        cues.at(57.6, 'through', (skip) => { if (!skip) c.audio.whoosh(1.4, 0.3); });
        cues.at(59.6, 'riser', (skip) => { if (!skip) c.audio.riser(3.2); });

        // "Suddenly, a flash-light cuts open the darkness" — we blow out to
        // white and hand the frame, still white, to the hotel corridor.
        const flash = eseg(t, 61.9, 62.4, ease.in);
        c.post.u.uWhite.value = flash;
        this.fade = seg(t, 60.4, 61.6) * 0.9 * (1 - flash);
      },
    };
  },
};
