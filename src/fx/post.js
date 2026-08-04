import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * The look.
 *
 * Bloom does the heavy lifting — every practical light in the film blooms, and
 * it's what makes an emissive LEGO screen read as "glowing" rather than
 * "painted bright green". The grade pass on top adds the rest of the grammar:
 * the green cast, the vignette, a little chromatic aberration at the edges,
 * scanlines when we're inside the screen, and the fades between scenes.
 */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGreen: { value: 0.16 },      // strength of the green cast
    uVignette: { value: 1.0 },
    uScan: { value: 0.0 },        // scanlines: 1 while we're inside the CRT
    uFade: { value: 0.0 },        // 1 = full black
    uWhite: { value: 0.0 },       // 1 = full white (glass, muzzle flash)
    uAberr: { value: 0.45 },
    uGrain: { value: 0.016 },
    uSharpen: { value: 0.32 },
    uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    uAspect: { value: 1.777 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGreen, uVignette, uScan, uFade, uWhite, uAberr, uGrain, uAspect, uSharpen;
    uniform vec2 uTexel;
    varying vec2 vUv;

    // Hash without directional structure.
    //
    // The obvious fract(sin(dot(p, k)) * big) has isolines along one direction,
    // so its "random" values change smoothly along that direction and abruptly
    // across it — which paints visible diagonal streaks over the whole frame.
    // This one mixes all three components together and has no preferred axis.
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // Chromatic aberration, radial and subtle.
      float k = 0.0016 * uAberr;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * k).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * k).b;

      // Unsharp mask: bloom and a 16-bit-ish bevel on every brick edge make
      // the frame soft, so a little local contrast puts the studs back.
      if (uSharpen > 0.001) {
        vec3 blur =
          texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0)).rgb +
          texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0)).rgb +
          texture2D(tDiffuse, uv + vec2(0.0, uTexel.y)).rgb +
          texture2D(tDiffuse, uv - vec2(0.0, uTexel.y)).rgb;
        col = clamp(col + (col * 4.0 - blur) * (uSharpen * 0.25), 0.0, 8.0);
      }

      // Green lift in the shadows, cool the highlights slightly. Push the
      // cast into the low end only, so white practicals stay white.
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 tint = vec3(0.55, 1.22, 0.72);
      col = mix(col, col * tint, uGreen * (1.0 - smoothstep(0.35, 0.95, luma)));
      col += vec3(0.0, 0.012, 0.004) * uGreen * 4.0 * (1.0 - luma);

      // Scanlines + aperture grille, only inside the screen.
      if (uScan > 0.001) {
        float lines = 0.5 + 0.5 * sin(uv.y * 1400.0);
        float grille = 0.5 + 0.5 * sin(uv.x * 2200.0);
        col *= mix(1.0, 0.78 + 0.22 * lines * grille, uScan);
      }

      // Vignette.
      col *= mix(1.0, smoothstep(1.08, 0.16, r2 * 1.3), uVignette);

      // Film grain: fine, monochrome, and animated per frame.
      float g = hash(uv / max(uTexel.x, 1e-5) * 0.5 + fract(uTime) * 371.7) - 0.5;
      col += g * uGrain;

      col = mix(col, vec3(1.0), uWhite);
      col *= (1.0 - uFade);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function makePost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Tight radius: a wide bloom on this many small emissive parts turns the
  // whole frame to haze.
  const bloom = new UnrealBloomPass(size.clone(), 0.42, 0.32, 0.85);
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    grade,
    u: grade.uniforms,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
      grade.uniforms.uAspect.value = w / h;
      grade.uniforms.uTexel.value.set(1 / w, 1 / h);
    },
    render(dt, t) {
      grade.uniforms.uTime.value = t;
      composer.render(dt);
    },
  };
}
