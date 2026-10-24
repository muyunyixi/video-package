import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { W, H, lerp } from "./util";

export const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSeed: { value: 0 },
    uGrain: { value: 0.02 },
    uVignette: { value: 0.35 },
    uCA: { value: 0.0012 },
    uRes: { value: new THREE.Vector2(W, H) },
    uFade: { value: 0 }, // fade to black 0..1
    uFlash: { value: 0 }, // flash to white 0..1
    uBlur: { value: new THREE.Vector2(0, 0) }, // directional motion blur, uv units
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSeed, uGrain, uVignette, uCA, uFade, uFlash; uniform vec2 uRes; uniform vec2 uBlur; uniform vec3 uFadeColor;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 tap(vec2 uv, vec2 off){
      vec3 c;
      c.r = texture2D(tDiffuse, uv + off).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - off).b;
      return c;
    }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c,c);
      vec2 off = c * uCA * (0.4 + r2 * 2.0);
      vec3 col;
      if (length(uBlur) > 0.00005) {
        col = vec3(0.0);
        float j = h12(vUv * uRes) - 0.5;
        for (int i = 0; i < 12; i++) {
          float t = (float(i) + 0.5 + j) / 12.0 - 0.5;
          col += tap(vUv + uBlur * t, off);
        }
        col /= 12.0;
      } else {
        col = tap(vUv, off);
      }
      float vig = smoothstep(0.85, 0.15, length(c * vec2(uRes.x/uRes.y, 1.0)) * 0.72);
      col *= mix(1.0 - uVignette, 1.0, vig);
      float g = h12(vUv * uRes + uSeed * 17.31) - 0.5;
      float lum = dot(col, vec3(0.299,0.587,0.114));
      col += g * uGrain * (0.35 + 0.65 * (1.0 - lum));
      col = mix(col, uFadeColor, uFade);
      col = mix(col, vec3(1.0), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export type Post = {
  composer: EffectComposer;
  bloom: UnrealBloomPass | null;
  finish: ShaderPass;
  renderPass: RenderPass;
};

export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { bloom?: [number, number, number] | null } = {}): Post {
  const flags = ((globalThis as any).__flags ?? {}) as Record<string, any>;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: flags.msaa ?? 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  let bloom: UnrealBloomPass | null = null;
  if (opts.bloom !== null && !flags.noBloom) {
    const [s, r, t] = opts.bloom ?? [0.55, 0.5, 0.82];
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), s, r, t);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  if (!flags.noFxaa) {
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H);
    composer.addPass(fxaa);
  }
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  return { composer, bloom, finish, renderPass };
}

// the output's neutral tone mapping (exposure 1, then sRGB), both ways: what it makes of a linear colour
// (0–255), and the linear colour it turns into a given one (below its compression, as these all are).
// v5.6: here (from scenes/typing) so every tone-mapped scene can show 朱砂 as 朱砂
export const seen = (c: THREE.Color) => {
  const x = Math.min(c.r, c.g, c.b), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let v = [c.r - off, c.g - off, c.b - off];
  const peak = Math.max(...v);
  if (peak >= 0.76) {
    const np = 1 - (0.24 * 0.24) / (peak - 0.52), w = 1 - 1 / (0.15 * (peak - np) + 1);
    v = v.map((a) => lerp((a * np) / peak, np, w));
  }
  return v.map((a) => Math.round(255 * (a <= 0.0031308 ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055)));
};
export const untoned = (hex: string, gain = 1) => {
  // gain: for a surface the scene darkens (its light, its vignette) by 1 / gain
  const c = new THREE.Color(hex).multiplyScalar(gain);
  const m = Math.min(c.r, c.g, c.b);
  return c.addScalar((m < 0.04 ? Math.sqrt(m / 6.25) : m + 0.04) - m);
};
/** the same, as a canvas colour (sRGB hex): a canvas texture painted with it shows as `hex` */
export const untonedHex = (hex: string, gain = 1) => "#" + untoned(hex, gain).getHexString();
