// Scenes H + I · 月 → 子正 · 此夜心同明月在，照见卿卿，别后许多年。 (37.2–49.0 s)
// Every 月 the search lit lifts off the page as a little seal — 白文 (a white 月 cut in a
// red chip) from her white bubbles, 朱文 (a red 月 on a white chip) from his red ones — and
// more come in over the edges of the frame from the rest of the history. Rising, each one
// burns from its edges into sparks, in its own colour; the sparks spiral in and soak a disc
// with light until a full moon hangs there, its grey seas, close up, a field of tiny 月.
// The last spark lands and the moon breathes out: its light spreads from it and opens the
// night as it goes, either side of the crease — the south warm (apricot in bloom, a soft
// hazy moon), the north cold (a budding peach bough, old snow, a crisp moon) — one moon
// over both. As time runs on, cloud forms round the moon and thickens until, in the
// countdown, the moon is gone behind it; 23:59:59: everything holds. 子正: the bell — a gust
// carries the cloud off, the moon comes out, the flowers and the snow blow across. Her reply
// sets off from the northern window and crosses under the moon to his, in the south.
import * as THREE from "three";
import cues from "../cues.json";
import { makePost } from "../lib/post";
import { glyphCell, toTex, glowCanvas, paperCanvas } from "../lib/textures";
import { makeCanvas, sampleTextPoints } from "../lib/glyph";
import { southBranchCanvas, northBranchCanvas, southFlowers, northSnow } from "../lib/branches";
import { nearRoofs, farRoofs, ROOF_TOP, ROOF_H } from "../lib/roofs";
import { drawBranch, flowerBud } from "../lib/paint";
import { moonGlyphs } from "./Chat";
import { W, H, HW, lerp, prog, smooth, easeInOutCubic, easeOutCubic, easeInCubic, mulberry32, clamp } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";

const M = cues.moon;
const Hh = cues.history;
const RP = cues.reply;
const SEAM = 960;
const MC = { x: 960, y: 354 }; // the moon's centre (px). v4.0: 30 px higher (v3.1: 384)
const MR = 182; // radius (px)
const MOON_PAD = 1.1; // the moon's plane, relative to its disc
const R_CLOSED = -400; // breath radius before the moon breathes: nothing open
const WIN_S = { x: 318, y: 1004 }; // his window, in the south
const WIN_N = { x: 1612, y: 996 }; // hers, in the north

// vPx: where a fragment is in the px its layer was drawn in — so the light, the haze and the
// crease stay on the things they belong to while the camera pushes in and the layers drift
// (uLay: the root's offset x, y and scale, and the layer's own drift)
const TO_LAYER = `vPx = vec2((w.x - uLay.x) / uLay.z, -((w.y - uLay.y) / uLay.z - uLay.w));`;
const VERT = `uniform vec4 uLay; varying vec2 vUv; varying vec2 vPx; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); ${TO_LAYER} gl_Position = projectionMatrix * viewMatrix * w; }`;
const NOISE = `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ return 0.55*vn(p) + 0.28*vn(p*2.03+7.1) + 0.17*vn(p*4.01+3.3); }`;
// the moon's breath: a circle of radius R (px) running out from the moon; inside it the night is
// open (0 closed .. 1 shown). v4.1: its edge is moonlight spreading, not a line: the night comes up
// over BREATH_F px either side of it (v4.0: 34 px, on a circle made ragged by two noises, 84 and
// 26 px deep, with a bright rim — "a ring of dirty water pulled open", the user said). Only a slow
// swell is left in its outline, so it is not drawn with compasses.
export const BREATH_F = 170;
const SHOWN = `
  float shH(vec2 i){ return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453); }
  float shN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(shH(i), shH(i+vec2(1,0)), f.x), mix(shH(i+vec2(0,1)), shH(i+vec2(1,1)), f.x), f.y); }
  float breathD(vec2 p){ return length(p - vec2(${MC.x.toFixed(1)}, ${MC.y.toFixed(1)})) + (shN(p * 0.0042 + 2.0) - 0.5) * 36.0; }
  float shownAt(vec2 p, float R){ return smoothstep(R + ${BREATH_F.toFixed(1)}, R - ${BREATH_F.toFixed(1)}, breathD(p)); }`;

export function createMoon(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#070a12");
  const camera = new THREE.OrthographicCamera(0, W, 0, -H, -20, 20);
  const root = new THREE.Group();
  scene.add(root);
  // depth layers: the sky and the moon barely move, the clouds a little, the near things most
  const far = new THREE.Group(), midL = new THREE.Group(), near = new THREE.Group();
  root.add(far, midL, near);
  const P = (x: number, y: number, z = 0) => new THREE.Vector3(x, -y, z);
  const uT = { value: 0 };
  const uFold = { value: R_CLOSED }; // the breath radius, px
  const uFlare = { value: 0 };
  const uMoon = { value: 0 };
  // 子正: cloud covers the moon in the last seconds (uVeil: how much of it is covered); on the bell a
  // wind rises (uGust: the boughs toss) and blows the cloud away (see "cloud"), and the two halves of
  // the moon, warm and cold, become one moon (uOne)
  const uVeil = { value: 0 }, uGust = { value: 0 };
  const uOne = { value: 0 };
  // where the moon stands on screen (x, y px) and at what scale, for what is lit by it in other layers
  const uMoonAt = { value: new THREE.Vector3(MC.x, MC.y, 1) };
  const layFar = { value: new THREE.Vector4(0, 0, 1, 0) }, layMid = { value: new THREE.Vector4(0, 0, 1, 0) }, layNear = { value: new THREE.Vector4(0, 0, 1, 0) };

  // ---------- the night, and after the fold: south warm, north cold ----------
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.3, H * 1.3),
    new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uT, uFold, uFlare, uMoon, uLay: layFar },
      vertexShader: VERT,
      fragmentShader: `uniform float uT, uFold, uFlare, uMoon; varying vec2 vUv; varying vec2 vPx;
        ${NOISE}
        ${SHOWN}
        void main(){
          vec2 p = vPx;
          float yy = clamp(p.y / 1080.0, 0.0, 1.0);
          vec3 night = mix(vec3(0.028, 0.038, 0.07), vec3(0.055, 0.07, 0.115), yy);
          vec3 south = mix(vec3(0.07, 0.048, 0.04), vec3(0.17, 0.105, 0.065), yy);
          south += vec3(0.32, 0.17, 0.06) * exp(-pow(length((p - vec2(220.0, 1010.0)) / vec2(560.0, 360.0)), 2.0)) * 0.55;
          vec3 north = mix(vec3(0.018, 0.032, 0.08), vec3(0.045, 0.075, 0.14), yy);
          float shown = shownAt(p, uFold);
          bool isS = p.x < ${SEAM.toFixed(1)};
          vec3 c = mix(night, isS ? south : north, shown);
          // stars: sharp in the cold half, drowned in the warm haze
          vec2 cell = floor(p / 3.0);
          float hz = mix(1.0, isS ? 0.25 : 1.35, shown);
          float st = step(0.9982, h21(cell)) * smoothstep(760.0, 120.0, p.y) * (0.55 + 0.45 * sin(uT * 0.25 + h21(cell + 3.0) * 40.0));
          c += vec3(0.78, 0.82, 0.95) * st * hz * 0.85;
          // the crease of the fold
          float d = abs(p.x - ${SEAM.toFixed(1)});
          c *= 1.0 - 0.35 * shown * exp(-d * d / 160.0);
          c += vec3(0.45, 0.44, 0.42) * exp(-pow(d - 1.5, 2.0) / 1.4) * 0.3 * shown;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.position.set(W / 2, -H / 2, -10);
  far.add(sky);

  // ---------- the moon ----------
  // its seas, for whoever looks closely, are made of the character itself, very small
  const mareC = makeCanvas(512, 512);
  {
    const ctx = mareC.getContext("2d")!;
    const r = mulberry32(5);
    const seas: { x: number; y: number; rx: number; ry: number }[] = [];
    for (let i = 0; i < 8; i++) seas.push({ x: 150 + r() * 230, y: 140 + r() * 230, rx: 40 + r() * 70, ry: 30 + r() * 60 });
    // soft washes where the light settled thinner
    for (const s of seas) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, Math.max(s.rx, s.ry));
      g.addColorStop(0, "rgba(0,0,0,0.3)");
      g.addColorStop(0.7, "rgba(0,0,0,0.11)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
    // and inside them, a field of tiny 月 — sparse enough that each one can still be read
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 1500; i++) {
      const x = 40 + r() * 432, y = 40 + r() * 432;
      let k = 0;
      for (const s of seas) k = Math.max(k, Math.exp(-(((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2)));
      if (r() > k * 1.3) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * 0.8);
      ctx.font = `400 ${12 + r() * 7}px ${HW}`;
      ctx.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.3})`;
      ctx.fillText("月", 0, 0);
      ctx.restore();
    }
  }
  const fiber = paperCanvas(512, 512, { base: "#808080", seed: 23, fibers: 2600, speck: 0, mottle: 0.4 });
  const moonMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMoon, uFlare, uT, uFold, uVeil, uOne, uLay: layFar, uFiber: { value: toTex(fiber, false) }, uMare: { value: toTex(mareC, false) } },
    vertexShader: VERT,
    fragmentShader: `uniform float uMoon, uFlare, uT, uFold, uVeil, uOne; uniform sampler2D uFiber, uMare; varying vec2 vUv; varying vec2 vPx;
      ${NOISE}
      ${SHOWN}
      void main(){
        // the plane is a little larger than the disc, so a soft edge has room outside the rim
        vec2 q = (vUv * 2.0 - 1.0) * ${MOON_PAD.toFixed(3)};
        vec2 uvm = q * 0.5 + 0.5;
        float r = length(q);
        float shown = shownAt(vPx, uFold);
        // 子正 (v4.0): the seam down the moon closes — the same light on both halves
        float south = (vPx.x < ${SEAM.toFixed(1)} ? shown : 0.0) * (1.0 - uOne);
        float north = (vPx.x >= ${SEAM.toFixed(1)} ? shown : 0.0) * (1.0 - uOne);
        float one = shown * uOne;
        // the edge: one softness either side of the crease (v3.1). In v3 the south was blurred five
        // times wider, and since the blur straddles the rim, the southern half looked a little larger
        float soft = mix(0.012, 0.03, shown);
        float edge = smoothstep(1.0 + soft * 0.5, 1.0 - soft * 0.5, r);
        float n = fbm(q * 3.1 + 4.0);
        float soak = smoothstep(n * 0.55 - 0.08, n * 0.55, uMoon * 1.25 - r * 0.7);
        float fib = texture2D(uFiber, uvm * 1.6).r;
        vec3 c = vec3(0.905, 0.915, 0.925) * (0.84 + 0.16 * sqrt(max(0.0, 1.0 - r * r)));
        c *= 0.93 + 0.1 * fib;
        float mare = texture2D(uMare, clamp(uvm, 0.0, 1.0)).a * smoothstep(0.55, 1.0, uMoon);
        c = mix(c, vec3(0.5, 0.54, 0.6), 0.62 * mare * mix(1.0, 0.6, south + 0.5 * one));
        // the same moon through two airs: warmer and lower in contrast in the south, cold in the north;
        // and after midnight one light, halfway between them
        c = mix(c, c * vec3(1.06, 0.97, 0.86) + vec3(0.04, 0.02, 0.0), south);
        c = mix(c, c * vec3(0.94, 0.99, 1.07), north);
        c = mix(c, c * vec3(1.0, 0.98, 0.965) + vec3(0.02, 0.01, 0.0), one);
        c += vec3(0.05, 0.048, 0.042) * uFlare;
        float front = soak * (1.0 - smoothstep(0.0, 0.25, uMoon * 1.25 - r * 0.7 - n * 0.55));
        c += vec3(0.25, 0.16, 0.05) * front * (1.0 - smoothstep(0.85, 1.0, uMoon));
        c *= 1.0 - 0.45 * uVeil; // behind the cloud
        gl_FragColor = vec4(c, edge * soak);
      }`,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(MR * 2 * MOON_PAD, MR * 2 * MOON_PAD), moonMat);
  moon.position.copy(P(MC.x, MC.y, 2));
  far.add(moon);
  // its light on the air: a wide warm corona in the south, a tight cold glow in the north
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uMoon, uFlare, uFold, uVeil, uOne, uLay: layFar, uWhole: { value: 0 }, uForm: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `uniform float uMoon, uFlare, uFold, uVeil, uWhole, uForm, uOne; varying vec2 vUv; varying vec2 vPx;
      ${SHOWN}
      void main(){
        // measured on its own plane (it moves with the moon), not on the screen
        float d = length(vUv - 0.5) * ${(MR * 8).toFixed(1)};
        float out_ = max(0.0, d - ${(MR * 0.96).toFixed(1)});
        float shown = shownAt(vPx, uFold);
        float south = (vPx.x < ${SEAM.toFixed(1)} ? shown : 0.0) * (1.0 - uOne);
        float north = (vPx.x >= ${SEAM.toFixed(1)} ? shown : 0.0) * (1.0 - uOne);
        // 月华 (v4.0): a bright, close glow on the rim and a wider haze round it, both brought down
        // smoothly to nothing 160 px out. The moon's rim stands about 150 px under the frame's top edge
        // (measured: 154 px at 43.3 s, 150 at 47.3 s), so the light has thinned out by the edge instead
        // of being cut by it: there it is 11 grey levels over the far sky (v3.1: 63).
        // (v3.1: one long exponential, 230 px, still at half strength at the top edge, and a faint
        // ring 373 px out that the edge cut through.) The same either side of the crease; only its
        // colour tells the two airs apart, and after midnight not even that.
        float win = pow(max(0.0, 1.0 - pow(out_ / 160.0, 2.0)), 2.0);
        float g = (0.55 * exp(-out_ / 30.0) + 0.45 * exp(-out_ / 88.0)) * win * smoothstep(${(MR * 0.9).toFixed(1)}, ${(MR * 1.02).toFixed(1)}, d);
        vec3 col = mix(vec3(0.78, 0.82, 0.9), vec3(1.0, 0.86, 0.68), south);
        col = mix(col, vec3(0.7, 0.8, 1.0), north);
        col = mix(col, vec3(0.92, 0.89, 0.82), shown * uOne);
        // while it is still forming from the burning seals, its light keeps a little of their red
        col = mix(col, vec3(1.0, 0.58, 0.44), 0.42 * uForm);
        float a = g * mix(0.34, 0.5, shown) * uMoon * (1.0 + 0.8 * uFlare + 1.2 * uWhole) * (1.0 - 0.7 * uVeil);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(MR * 8, MR * 8), haloMat);
  halo.position.copy(P(MC.x, MC.y, 1));
  far.add(halo);
  // 子正: one ripple of the bell, out from the moon
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uR: { value: 0 }, uA: { value: 0 }, uLay: layFar },
    vertexShader: VERT,
    fragmentShader: `uniform float uR, uA; varying vec2 vUv; varying vec2 vPx;
      void main(){
        float x = length(vPx - vec2(${MC.x.toFixed(1)}, ${MC.y.toFixed(1)})) - uR;
        float a = (exp(-x * x / 9.0) + 0.22 * exp(-abs(x) / 26.0)) * uA;
        gl_FragColor = vec4(vec3(0.95, 0.93, 0.87), a);
      }`,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, H * 1.3), ringMat);
  ring.position.copy(P(W / 2, H / 2, 3));
  far.add(ring);
  // the breath of the finished moon: v4.1 — its light, a broad soft wash riding the front as it
  // spreads (no rim), warm on the southern side, cold on the northern, fading as it goes
  const breathMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uFold, uA: { value: 0 }, uLay: layFar },
    vertexShader: VERT,
    fragmentShader: `uniform float uFold, uA; varying vec2 vUv; varying vec2 vPx;
      ${SHOWN}
      void main(){
        float x = breathD(vPx) - uFold;
        float wash = exp(-x * x / ${(2 * 150 * 150).toFixed(1)});
        vec3 col = vPx.x < ${SEAM.toFixed(1)} ? vec3(1.0, 0.86, 0.66) : vec3(0.78, 0.86, 1.0);
        gl_FragColor = vec4(col, wash * uA);
      }`,
  });
  const breath = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, H * 1.3), breathMat);
  breath.position.copy(P(W / 2, H / 2, 3.2));
  far.add(breath);

  // ---------- cloud ----------
  // v4.1 (second version) · v4.0's cloud, more of it. From the breath a long band of thin cloud lies
  // low across the moon, streaked by the wind, drifting east (v4.0); as midnight nears, more of it
  // gathers where it is, over the moon, and the moon goes hazy behind it — still faintly there
  // (朦胧). On the bell the cloud is drawn out to either side, the left part flowing away south, the
  // right part north, opening softly from the middle and thinning as it goes, until it is gone.
  // (v4.0 tore it along the crease in half a second and swept the halves out; the user found the
  // sudden split stiff. The first version of v4.1 drew six long bands in from either side and slid
  // them apart through one another — "rags", the user said; a later try built the cloud of small
  // lumps with volume, which was not wanted either.)
  // uVeilC: how much has gathered over the moon; uPart: how far it has been drawn out either side;
  // uBlow: how far it has thinned away
  const uVeilC = { value: 0 }, uPart = { value: 0 }, uBlow = { value: 0 };
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT, uFold, uMoon, uVeilC, uPart, uBlow, uMoonAt, uLay: layMid },
    vertexShader: VERT,
    fragmentShader: `uniform float uT, uFold, uMoon, uVeilC, uPart, uBlow; uniform vec3 uMoonAt; varying vec2 vUv; varying vec2 vPx;
      ${NOISE}
      ${SHOWN}
      void main(){
        // every point is looked up where its cloud was before the bell: drawn out from the moon's
        // middle, each side towards its own edge of the frame — no line where it parts
        float dx = vPx.x - uMoonAt.x;
        vec2 p = vec2(uMoonAt.x + dx / (1.0 + 1.7 * uPart), vPx.y);
        float shown = shownAt(vPx, uFold);
        float south = vPx.x < ${SEAM.toFixed(1)} ? shown : 0.0;
        // a long band of cloud low across the moon, streaked by the wind, drifting east (v4.0)
        vec2 q = vec2(p.x * 0.0021 - uT * 0.0011, p.y * 0.0062);
        float n = fbm(q + vec2(0.0, fbm(q * 2.0) * 0.6));
        float band = exp(-pow((p.y - ${(MC.y + 96).toFixed(1)}) / 90.0, 2.0)) + 0.6 * exp(-pow((p.y - ${(MC.y - 120).toFixed(1)}) / 50.0, 2.0)) * smoothstep(0.62, 0.8, n);
        float a = smoothstep(0.42, 0.78, n) * band;
        a *= mix(0.42, 0.75, south); // the south is damp and hazy, the north only a wisp
        // as midnight nears, more gathers where it is, over the moon — a soft bank, streaked like the
        // band, the moon hazy behind it
        float md0 = length(p - uMoonAt.xy) / uMoonAt.z;
        float veil = uVeilC * smoothstep(0.08, 0.48, n) * exp(-pow(md0 / ${(MR * 2.2).toFixed(1)}, 2.0));
        a = max(a, 0.95 * veil);
        // drawn out, it opens from the middle and thins as it flows away
        a *= 1.0 - 0.95 * uPart * exp(-pow(dx / (190.0 + 300.0 * uPart), 2.0));
        a *= (1.0 - uBlow) / (1.0 + 0.6 * uPart);
        // nothing of it ever reaches the edges of its sheet
        a *= smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y) * smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
        // lit by the moon where it now stands (v4.0)
        float md = length(vPx - uMoonAt.xy) / uMoonAt.z;
        float lit = exp(-max(0.0, md - ${MR.toFixed(1)}) / 150.0);
        vec3 c = mix(vec3(0.16, 0.18, 0.24), vec3(0.86, 0.87, 0.9), lit);
        c = mix(c, c * vec3(1.12, 0.96, 0.82), south);
        gl_FragColor = vec4(c, a * uMoon * shown);
      }`,
  });
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.2, 800), cloudMat);
  // behind the boughs and the far town, in front of the moon
  cloud.position.copy(P(W / 2, MC.y + 20, 3.5));
  midL.add(cloud);

  // ---------- the 月 from the chat: little seals that rise and burn into light ----------
  // those still on screen rise from where they sat; the rest come up from below; and more,
  // from the history beyond the frame, come in over the top and bottom edges
  const lit = moonGlyphs().map((p, k, all) => {
    const below = all.filter((q) => q.y > 1040).indexOf(p);
    return below < 0 ? { ...p, delay: 0, kind: 0 } : { ...p, y: 1130 + below * 46, delay: 4 + below * 2.5, kind: 1 };
  });
  const xr = mulberry32(31);
  // v4.0: the ones from the history above the frame no longer fly in over the top edge (they were
  // never up there): they come up where they are, in the upper part of the frame, across the chat's
  // two columns, and burn from there. Those from below still gather up from under the frame.
  const extra = Array.from({ length: 26 }, (_, k) => {
    const top = k % 2 === 0;
    if (top) {
      const j = k / 2; // 0…12, spread along the columns with a little jitter
      const x = 440 + (j + 0.5) * (1040 / 13) + (xr() - 0.5) * 40;
      let y = 84 + ((j * 7) % 4) * 58 + (xr() - 0.5) * 24;
      if (x > 620 && x < 1300 && y < 190) y += 120; // clear of the search box as it fades
      return { x, y, size: 46, red: xr() < 0.5, delay: 1 + k * 0.75 + xr() * 3, kind: 2 };
    }
    return { x: 560 + xr() * 800, y: 1120 + xr() * 130, size: 46, red: xr() < 0.5, delay: 1 + k * 0.75 + xr() * 3, kind: 3 };
  });
  const seedsAt = [...lit, ...extra];
  const emberTex = toTex(glowCanvas(128, "255,255,255", 0.3));
  const glyphTex = toTex(glyphCell("月", 256, { color: "#fff", scale: 0.66 }), false);
  const seeds = seedsAt.map((p, i) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: glyphTex }, uBurn: { value: 0 }, uA: { value: 0 }, uSeed: { value: i * 3.7 }, uRed: { value: p.red ? 1 : 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uBurn, uA, uSeed, uRed; varying vec2 vUv;
        ${NOISE}
        float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          float g = texture2D(uTex, vUv).a;
          float chip = smoothstep(0.008, -0.008, box(vUv - 0.5, vec2(0.43), 0.07));
          vec3 vermilion = vec3(0.74, 0.165, 0.14), paper = vec3(0.93, 0.905, 0.865);
          // 朱文 from his red bubbles: a red 月 on white; 白文 from hers: a white 月 cut in red
          vec3 c = uRed > 0.5 ? mix(paper, vermilion, g) : mix(vermilion, paper, g);
          float n = fbm(vUv * 6.0 + uSeed);
          float th = uBurn * 1.25 - 0.1;
          float gone = smoothstep(th - 0.03, th + 0.03, n);
          float rim = smoothstep(th - 0.12, th, n) * (1.0 - gone);
          vec3 ember = uRed > 0.5 ? vec3(1.0, 0.9, 0.66) : vec3(1.0, 0.56, 0.32);
          c = mix(ember * 1.7, c, gone);
          gl_FragColor = vec4(c, chip * uA * max(gone, rim * 1.4));
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    near.add(m);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: emberTex, color: p.red ? 0xffe2b0 : 0xff7a4a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    near.add(glow);
    return { m, mat, p, i, glow };
  });

  // ---------- sparks: each seal becomes points of light that spiral into the moon ----------
  const PER = 90;
  const NS = Math.max(1, seeds.length) * PER;
  const sr = mulberry32(42);
  type Spark = { gi: number; ox: number; oy: number; t0: number; dur: number; spin: number; size: number };
  const sparks: Spark[] = [];
  const pts = sampleTextPoints("月", PER, { font: HW, size: 100 }, 7).points;
  const burnAt = (s: (typeof seeds)[number]) => M.start + 14 + s.p.delay + s.i * 0.7;
  for (let gi = 0; gi < seeds.length; gi++) {
    for (let k = 0; k < PER; k++) {
      sparks.push({
        gi,
        ox: (pts[k * 2] / 100) * 0.7,
        oy: (-pts[k * 2 + 1] / 100) * 0.7,
        t0: burnAt(seeds[gi]) + 3 + sr() * 12,
        dur: 26 + sr() * 18,
        spin: (sr() < 0.82 ? 1 : -1) * (2.4 + sr() * 2.4),
        size: 4 + Math.pow(sr(), 2) * 13,
      });
    }
  }
  const TRAILS = 4;
  const sparkGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(NS * TRAILS * 3), sA = new Float32Array(NS * TRAILS), sS = new Float32Array(NS * TRAILS), sC = new Float32Array(NS * TRAILS * 3);
  sparks.forEach((sp, i) => {
    const red = seeds[sp.gi].p.red;
    for (let k = 0; k < TRAILS; k++) {
      const j = i * TRAILS + k;
      // 朱文 burns to a warm white-gold, 白文 to vermilion sparks
      sC[j * 3] = 1.0;
      sC[j * 3 + 1] = red ? 0.9 : 0.55;
      sC[j * 3 + 2] = red ? 0.74 : 0.36;
    }
  });
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute("aA", new THREE.BufferAttribute(sA, 1));
  sparkGeo.setAttribute("aS", new THREE.BufferAttribute(sS, 1));
  sparkGeo.setAttribute("aC", new THREE.BufferAttribute(sC, 3));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: toTex(glowCanvas(64, "255,255,255", 0.32)) } },
    vertexShader: `attribute float aA, aS; attribute vec3 aC; varying float vA; varying vec3 vC; void main(){ vA = aA; vC = aC; gl_PointSize = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(t.rgb * vC * 1.9, t.a * vA); }`,
  });
  const vortex = new THREE.Mesh(new THREE.PlaneGeometry(MR * 3.2, MR * 3.2), new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "255,232,196", 0.22)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  vortex.position.copy(P(MC.x, MC.y, 1.5));
  far.add(vortex);
  const sparkPts = new THREE.Points(sparkGeo, sparkMat);
  sparkPts.frustumCulled = false;
  far.add(sparkPts);

  // ---------- the fold: branches and rooftops of both halves ----------
  const reveal = (tex: THREE.Texture, dir: number, lay = layNear) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: tex }, uT, uFold, uGust, uDir: { value: dir }, uTint: { value: new THREE.Color(1, 1, 1) }, uLay: lay },
      vertexShader: VERT,
      fragmentShader: `uniform sampler2D uTex; uniform float uT, uFold, uGust, uDir; uniform vec3 uTint; varying vec2 vUv; varying vec2 vPx;
        ${SHOWN}
        void main(){
          vec2 uv = vUv;
          float farEnd = uDir > 0.0 ? uv.x : 1.0 - uv.x;
          // the bare north bough is worked by the wind; the wet south one hangs heavy
          float amp = uDir < 0.0 ? 2.2 * (0.6 + 0.4 * sin(uT * 0.027) * sin(uT * 0.071 + 1.3)) : 1.0;
          // 子正's wind: both boughs toss, and lean the way it swirls (the south one towards the
          // fold from below, the north one back over the top)
          float gust = uDir != 0.0 ? uGust : 0.0;
          amp *= 1.0 + 2.6 * gust;
          // houses don't sway (v3.1 let the rooftops ripple by a pixel or so with the boughs)
          if (uDir == 0.0) amp = 0.0;
          uv.y += sin(uT * 0.05 + uv.x * 4.0) * 0.003 * farEnd * amp;
          uv.x += sin(uT * 0.033 + uv.y * 3.0) * 0.002 * farEnd * amp;
          uv.x -= uDir * 0.006 * gust * farEnd;
          uv.y += uDir * 0.004 * gust * farEnd;
          vec4 t = texture2D(uTex, uv);
          gl_FragColor = vec4(t.rgb * uTint, t.a * shownAt(vPx, uFold));
        }`,
    });
  const southB = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1160), reveal(toTex(southBranchCanvas()), 1));
  southB.position.copy(P(470, 560, 4));
  near.add(southB);
  const northB = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1160), reveal(toTex(northBranchCanvas()), -1));
  northB.position.copy(P(SEAM + 490, 560, 4));
  near.add(northB);
  // and one budding peach twig of hers reaching across the lower edge of the moon
  const twigC = makeCanvas(760, 300);
  {
    const ctx = twigC.getContext("2d")!;
    drawBranch(ctx, {
      seed: 63, x: 790, y: 210, angle: Math.PI - 0.12, length: 300, width: 12, depth: 4, ink: "10,10,14", spread: 0.42, droop: -0.01,
      prune: (x, y) => x < 30 || y < 10 || y > 290,
      onTip: (c, x, y, a, lvl, r) => {
        if (lvl < 2) return;
        flowerBud(c, x, y, a + (r() - 0.5), r, 4.5 + r() * 2, "196,104,128", "70,56,52");
        if (r() < 0.5) flowerBud(c, x + Math.cos(a) * 5, y + Math.sin(a) * 5, a - 0.6, r, 4, "196,104,128", "70,56,52");
      },
      onSeg: (c, x0, y0, x1, y1, w, a, _l, r) => {
        if (w < 2.4 || Math.abs(Math.sin(a)) > 0.6 || r() < 0.35) return;
        let nx = Math.sin(a), ny = -Math.cos(a);
        if (ny > 0) { nx = -nx; ny = -ny; }
        c.strokeStyle = `rgba(226,232,240,${0.7 + r() * 0.25})`;
        c.lineWidth = Math.min(4, 1 + w * 0.3);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x0 + nx * w * 0.42, y0 + ny * w * 0.42);
        c.lineTo(x1 + nx * w * 0.42, y1 + ny * w * 0.42);
        c.stroke();
      },
    });
  }
  const twig = new THREE.Mesh(new THREE.PlaneGeometry(760, 300), reveal(toTex(twigC), -1));
  twig.position.copy(P(1430, MC.y + 30, 4.6));
  near.add(twig);
  // v4.0 · the rooftops, in two layers (lib/roofs): 粉墙黛瓦 and 马头墙 in the south, roofs under old
  // snow in the north; the far town hazy in each half's air, in the middle layer (it drifts less as
  // the eye moves down after the fold), the near houses in front. v3.1 had one strip of flat black
  // shapes. Both run on below the frame's bottom edge.
  const roofFar = new THREE.Mesh(new THREE.PlaneGeometry(1920, ROOF_H), reveal(toTex(farRoofs()), 0, layMid));
  roofFar.position.copy(P(960, ROOF_TOP + ROOF_H / 2, 4.2));
  midL.add(roofFar);
  const roofMesh = new THREE.Mesh(new THREE.PlaneGeometry(1920, ROOF_H), reveal(toTex(nearRoofs(WIN_S, WIN_N)), 0));
  roofMesh.position.copy(P(960, ROOF_TOP + ROOF_H / 2, 5));
  near.add(roofMesh);
  const winTex = toTex(glowCanvas(128, "255,186,110", 0.28));
  const windows = [WIN_S, WIN_N].map((w, i) => {
    const core = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffc27a : 0xffd9a8, transparent: true, opacity: 0, depthWrite: false }));
    core.position.copy(P(w.x, w.y, 6));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshBasicMaterial({ map: winTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.copy(P(w.x, w.y, 6.5));
    near.add(core, glow);
    return { core, glow };
  });
  // v4.1: the night dims a little while the moon is behind the cloud (over everything but the windows)
  const dimmer = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.8, H * 1.8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  dimmer.position.copy(P(W / 2, H / 2, 5.5));
  near.add(dimmer);
  // apricot petals coming down in the south, a few flakes of old snow blowing in the north
  // v4.0: kind 0 = petals (the south's), 1 = old snow (the north's). Until 子正 neither crosses the
  // crease, as in 南北 (no drift carries a petal over it now); on the bell the swirl carries them across,
  // and each takes the light of the half it comes into — a petal in the north goes moon-pale and cold,
  // a flake in the south warms to the colour of the blossom
  // v4.1: each mote can turn in the picture's plane (aTurn) and tumble (aFlip: its face's cosine,
  // so a petal goes edge-on and over); a mote that is not turned looks as in v4.0. aA: its own opacity
  const drift = (n: number, seed: number, sprite: HTMLCanvasElement, xr0: number, xr1: number, size: [number, number], kind: number) => {
    const r = mulberry32(seed);
    const items = Array.from({ length: n }, () => ({ x: xr0 + r() * (xr1 - xr0), y: r() * 980, ph: r() * 6.28, sp: 24 + r() * 36, s: size[0] + r() * (size[1] - size[0]) }));
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), sz = new Float32Array(n), turn = new Float32Array(n), flip = new Float32Array(n).fill(1), al = new Float32Array(n).fill(1);
    items.forEach((it, i) => (sz[i] = it.s));
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
    geo.setAttribute("aTurn", new THREE.BufferAttribute(turn, 1));
    geo.setAttribute("aFlip", new THREE.BufferAttribute(flip, 1));
    geo.setAttribute("aA", new THREE.BufferAttribute(al, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: toTex(sprite) }, uOp: { value: 0 }, uFold, uLay: layNear, uKind: { value: kind } },
      vertexShader: `uniform vec4 uLay; attribute float aSize, aTurn, aFlip, aA; varying vec2 vPx; varying float vTurn, vFlip, vA;
        void main(){ gl_PointSize = aSize; vTurn = aTurn; vFlip = aFlip; vA = aA; vec4 w = modelMatrix * vec4(position, 1.0); ${TO_LAYER} gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOp, uFold, uKind; varying vec2 vPx; varying float vTurn, vFlip, vA; ${SHOWN}
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float cs = cos(vTurn), sn = sin(vTurn);
          q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
          q.x /= max(0.16, abs(vFlip));
          vec2 uv = q + 0.5;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          vec4 t = texture2D(uTex, uv);
          vec3 c = t.rgb * (vFlip < 0.0 ? 0.86 : 1.0); // its back is a little darker
          float across = uKind < 0.5 ? smoothstep(${(SEAM - 14).toFixed(1)}, ${(SEAM + 14).toFixed(1)}, vPx.x) : smoothstep(${(SEAM + 14).toFixed(1)}, ${(SEAM - 14).toFixed(1)}, vPx.x);
          float lum = dot(c, vec3(0.3, 0.55, 0.15));
          vec3 other = uKind < 0.5 ? vec3(0.8, 0.87, 1.0) * lum * 1.06 : vec3(1.0, 0.8, 0.77) * lum * 1.04;
          gl_FragColor = vec4(mix(c, other, across), t.a * uOp * vA * shownAt(vPx, uFold));
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    near.add(pts);
    return { items, pos, geo, mat, sz, turn, flip, al };
  };
  const petalC = makeCanvas(64, 64);
  {
    const ctx = petalC.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 40, 2, 32, 32, 26);
    g.addColorStop(0, "rgba(236,150,160,0.95)");
    g.addColorStop(0.5, "rgba(252,232,230,0.95)");
    g.addColorStop(1, "rgba(255,242,238,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 32, 24, 15, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const flakeC = makeCanvas(32, 32);
  {
    const ctx = flakeC.getContext("2d")!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    g.addColorStop(0, "rgba(240,244,252,1)");
    g.addColorStop(0.5, "rgba(228,236,248,0.7)");
    g.addColorStop(1, "rgba(228,236,248,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  }
  const petals = drift(22, 8, petalC, 40, SEAM - 80, [11, 18], 0);
  const flakes = drift(30, 18, flakeC, SEAM + 40, W + 260, [4, 9], 1);
  const SWC = { x: 960, y: MC.y + 136 }; // the eye of the swirl, a little under the moon
  // v4.1 · 子正's wind takes the flowers off the south bough and the old snow off the north one and
  // blows each across to the other side, in profusion: the petals under the moon into the north,
  // going moon-pale and cold as they cross, the snow over the top of it into the south, warming to
  // the blossom's colour — one swirl of wind round the moon, as the clouds go through each other
  // behind it. Each sets off from a flower, or a patch of snow, on its bough (lib/branches), on the
  // gust; the stream runs out over two seconds and they settle and fade. (v4.0: 24 petals and 30
  // flakes rose from the middle of the boughs and were turned by the swirl.)
  const SB = { x: 470 - 550, y: 560 - 580 }, NB = { x: SEAM + 490 - 550, y: 560 - 580 }; // bough canvas → layer px
  type Mote = { sx: number; sy: number; cx: number; cy: number; ex: number; ey: number; d: number; k: number; ph: number; spin: number; tum: number; out: number };
  const fr = mulberry32(2026);
  const fromSouth = southFlowers()
    .map((p) => ({ x: p.x + SB.x, y: p.y + SB.y }))
    .filter((p) => p.x > 60 && p.x < SEAM - 70 && p.y > 60 && p.y < 740);
  const fromNorth = northSnow()
    .flatMap((s) => {
      const n = Math.max(1, Math.round(Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 14));
      return Array.from({ length: n }, (_, k) => ({ x: s.x0 + ((s.x1 - s.x0) * (k + 0.5)) / n + NB.x, y: s.y0 + ((s.y1 - s.y0) * (k + 0.5)) / n + NB.y }));
    })
    .filter((p) => p.x > SEAM + 70 && p.x < W - 30 && p.y > 200 && p.y < 760);
  const pick = <T,>(arr: T[], n: number) => Array.from({ length: n }, (_, i) => arr[Math.floor(((i + fr()) / n) * arr.length) % arr.length]);
  const N_FLOW = 110;
  const mkMote = (s: { x: number; y: number }, under: boolean): Mote => ({
    sx: s.x + (fr() - 0.5) * 8,
    sy: s.y + (fr() - 0.5) * 8,
    // the wind's path: under the moon going north, over it going south (the curve passes about
    // halfway to its control point, which for the snow is above the frame)
    cx: SEAM + (fr() - 0.5) * 160,
    cy: under ? MC.y + 330 + (fr() - 0.5) * 120 : -130 + (fr() - 0.5) * 80,
    ex: under ? SEAM + 150 + fr() * 680 : 160 + fr() * 640,
    ey: under ? 170 + fr() * 470 : 150 + fr() * 420,
    d: fr() * 11, // frames after the bell
    k: 9 + fr() * 7, // how quickly the gust takes it
    ph: fr() * 6.28,
    spin: (fr() < 0.5 ? -1 : 1) * (0.06 + fr() * 0.16),
    tum: 0.12 + fr() * 0.22,
    out: 70 + fr() * 26, // when it has faded (frames after the bell)
  });
  const flowP = { motes: pick(fromSouth, N_FLOW).map((s) => mkMote(s, true)), pts: drift(N_FLOW, 51, petalC, 0, 1, [10, 16], 0) };
  const flowS = { motes: pick(fromNorth, N_FLOW).map((s) => mkMote(s, false)), pts: drift(N_FLOW, 53, flakeC, 0, 1, [5, 10], 1) };
  // a gust: a critically damped push, from rest (no jolt), at its fastest after k frames
  const gustAt = (tau: number, k: number) => (tau <= 0 ? 0 : 1 - (1 + tau / k) * Math.exp(-tau / k));

  // ---------- her reply: a spark from the northern window to his, in the south ----------
  const TRAIL = 110;
  const trailTex = toTex(glowCanvas(64, "255,214,160", 0.25));
  const trail = Array.from({ length: TRAIL }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    m.position.z = 8;
    near.add(m);
    return m;
  });
  const streak = (t: number) => {
    // a high arc under the moon, north → south
    const a = WIN_N, c = { x: 960, y: 610 }, b = WIN_S;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  };

  const post = makePost(renderer, scene, camera, { bloom: [0.5, 0.5, 0.955] });
  post.finish.uniforms.uVignette.value = 0.4;
  post.finish.uniforms.uGrain.value = 0.018;
  post.finish.uniforms.uCA.value = 0.0004;

  // stillness: 23:59:59 holds the world; time resumes on 子正
  const sceneTime = (f: number) => (f < M.ticks[2] ? f : f < M.midnight ? M.ticks[2] : f - (M.midnight - M.ticks[2]));
  const WHOLE = M.form + 22; // the last light lands; the moon breathes
  // v4.1: more cloud gathers over the moon from the end of the breath through the countdown (scene
  // time: it holds with everything else at :59)
  const GATHER: [number, number] = [WHOLE + 38, M.ticks[2] - 2];

  return {
    render(f: number) {
      const ft = sceneTime(f);
      uT.value = ft;
      // a slow push, then into his window as the reply lands
      const into = easeInCubic(prog(f, RP.land - 18, RP.land));
      const zb = lerp(1.0, 1.035, smooth(prog(f, M.start, M.midnight)));
      const zi = lerp(1, 2.6, into);
      const wx = 960 + (WIN_S.x - 960) * zb, wy = 540 + (WIN_S.y - 540) * zb;
      root.scale.set(zb * zi, zb * zi, 1);
      root.position.set(wx * (1 - zi) + 960 * (1 - zb) * zi, -(wy * (1 - zi) + 540 * (1 - zb) * zi), 0);
      // after the fold the eye drifts down a little from the moon towards the windows:
      // near things move most, the moon least
      const drop = smooth(prog(f, M.fold, M.midnight + 20));
      far.position.y = 10 * drop;
      midL.position.y = 22 * drop;
      midL.position.x = 0;
      near.position.y = 38 * drop;
      const [rx, ry, rs] = [root.position.x, root.position.y, root.scale.x];
      layFar.value.set(rx, ry, rs, far.position.y);
      layMid.value.set(rx, ry, rs, midL.position.y);
      layNear.value.set(rx, ry, rs, near.position.y);
      // the cloud drifts faster than the moon: in the cloud's own px the moon sits a little lower
      uMoonAt.value.set(MC.x, MC.y + midL.position.y - far.position.y, 1);

      // ---------- the 月 rise and burn ----------
      const lift0 = Hh.lift;
      const glyphAt = (s: (typeof seeds)[number], ff: number) => {
        const d = s.p.delay;
        const t = prog(ff, lift0 + d + s.i * 0.5, lift0 + d + 26 + s.i * 0.5);
        const e = easeOutCubic(t);
        let tx: number, ty: number;
        if (s.p.kind === 0) { tx = s.p.x + (MC.x - s.p.x) * 0.18; ty = s.p.y - 170; }
        else if (s.p.kind === 1) { tx = s.p.x + (MC.x - s.p.x) * 0.18; ty = 560; }
        else if (s.p.kind === 2) {
          // in place: it comes up where it is, lifting a little as it grows
          return { x: s.p.x, y: s.p.y - 16 * e, size: s.p.size * lerp(1.0, 1.55, e), e };
        }
        else { tx = lerp(s.p.x, MC.x, 0.4); ty = 820 - ((s.i * 53) % 160); }
        return { x: lerp(s.p.x, tx, e), y: lerp(s.p.y, ty, e), size: s.p.size * lerp(1.15, 2.0, e), e };
      };
      for (const s of seeds) {
        const g = glyphAt(s, f);
        s.m.position.copy(P(g.x, g.y, 7));
        s.m.scale.set(g.size, g.size, 1);
        const b0 = burnAt(s);
        const burn = prog(f, b0, b0 + 18);
        // those that come up in place fade in (the search lighting them where they are)
        const inPlace = s.p.kind === 2 ? smooth(prog(f, lift0 + s.p.delay + s.i * 0.5, lift0 + s.p.delay + s.i * 0.5 + 9)) : 1;
        s.mat.uniforms.uA.value = f < lift0 ? 0 : inPlace;
        s.mat.uniforms.uBurn.value = burn;
        s.m.visible = f >= lift0 && burn < 1;
        const gm = s.glow.material as THREE.MeshBasicMaterial;
        s.glow.position.copy(P(g.x, g.y, 6.8));
        s.glow.scale.setScalar(g.size * 2.6);
        // a little light behind each: the white chips (朱文) need hardly any to read as lit
      const glowK = s.p.red ? [0.04, 0.24] : [0.06, 0.32];
      gm.opacity = f < lift0 ? 0 : (glowK[0] + glowK[1] * Math.sin(Math.PI * burn)) * (burn < 1 ? 1 : 0) * smooth(prog(f, lift0, lift0 + 6)) * inPlace;
      }
      // ---------- sparks ----------
      let arrived = 0;
      sparks.forEach((sp, i) => {
        const s = seeds[sp.gi];
        const g0 = glyphAt(s, Math.min(f, sp.t0));
        const gx = g0.x, gy = g0.y, gs = g0.size;
        for (let k = 0; k < TRAILS; k++) {
          const ff = f - k * 1.2;
          const u = prog(ff, sp.t0, sp.t0 + sp.dur);
          const j = i * TRAILS + k;
          if (ff < sp.t0 || u >= 1) {
            sA[j] = 0;
            sPos[j * 3 + 1] = 100;
            if (k === 0 && u >= 1) arrived++;
            continue;
          }
          const sx = gx + sp.ox * gs, sy = gy + sp.oy * gs;
          const r0 = Math.hypot(sx - MC.x, sy - MC.y);
          const th0 = Math.atan2(sy - MC.y, sx - MC.x);
          const ee = easeInOutCubic(u);
          const r = r0 * Math.pow(1 - ee, 1.15) + MR * 0.35 * Math.sin(Math.PI * ee) * 0.4;
          const th = th0 + sp.spin * ee;
          sPos[j * 3] = MC.x + Math.cos(th) * r;
          sPos[j * 3 + 1] = -(MC.y + Math.sin(th) * r);
          sPos[j * 3 + 2] = 9;
          sA[j] = smooth(prog(u, 0, 0.06)) * (1 - smooth(prog(u, 0.85, 1))) * (k === 0 ? 1 : 0.6 / k);
          sS[j] = sp.size * (k === 0 ? 1 : 0.85 - 0.1 * k);
        }
      });
      (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (sparkGeo.attributes.aA as THREE.BufferAttribute).needsUpdate = true;
      (sparkGeo.attributes.aS as THREE.BufferAttribute).needsUpdate = true;
      // 子正. v4.1: through the countdown more cloud gathers over the moon, which goes hazy behind it;
      // at :59 everything holds; on the bell the cloud is drawn out to either side and thins away, the
      // moon comes clear and brightens, its warm half and its cold half become one moon, and the
      // flowers and the old snow are blown off the boughs across to each other's side — still no
      // flash and no ripple: the turn is all movement
      const MID = M.midnight;
      const tau = f > MID ? f - MID : 0; // frames since the bell
      const gather = smooth(prog(ft, GATHER[0], GATHER[1]));
      uVeilC.value = gather;
      uPart.value = smooth(prog(tau, 0, 42));
      uBlow.value = smooth(prog(tau, 10, 56));
      // the moon dims a little behind it, and comes back as it clears
      uVeil.value = gather * (1 - smooth(prog(tau, 2, 30)));
      uGust.value = f >= MID ? smooth(prog(f, MID, MID + 6)) * (1 - 0.7 * smooth(prog(f, MID + 36, MID + 100))) : 0;
      uOne.value = f >= MID ? smooth(prog(f, MID + 4, MID + 30)) : 0;
      const fl = f >= MID ? 0.75 * smooth(prog(f, MID + 2, MID + 22)) * (1 - 0.5 * smooth(prog(f, MID + 40, MID + 110))) : 0;
      uFlare.value = fl;
      // while the moon is gone the whole night dims a little (but the lit windows); it comes back with it
      (dimmer.material as THREE.MeshBasicMaterial).opacity = 0.12 * uVeil.value;
      const soaked = sparks.length ? arrived / sparks.length : 1;
      uMoon.value = Math.max(smooth(clamp(soaked * 1.05)), smooth(prog(f, M.form, M.form + 30)));
      // the last light arrives: the moon breathes once, full — and the breath opens the fold
      const whole = f >= WHOLE ? Math.exp(-(f - WHOLE) / 8) * smooth(prog(f, WHOLE, WHOLE + 2)) : 0;
      haloMat.uniforms.uWhole.value = whole;
      haloMat.uniforms.uForm.value = 1 - smooth(prog(f, WHOLE - 6, WHOLE + 30));
      (vortex.material as THREE.MeshBasicMaterial).opacity = 0.55 * smooth(prog(f, M.start + 30, M.start + 60)) * (1 - smooth(prog(f, M.form, M.form + 40)));
      vortex.rotation.z = -f * 0.02;
      // ---------- the breath opens the night ----------
      // v4.1: moonlight spreading out from the moon over 2.1 s, easing out (v4.0: 1.5 s, starting at
      // 71 px a frame), the night coming up across a 340 px band; it starts from the moon's middle,
      // so the moon's two airs come up first, and the far corners last
      const bt = prog(f, WHOLE, WHOLE + 64);
      const R_END = 1490;
      uFold.value = f < WHOLE ? R_CLOSED : -BREATH_F + (R_END + BREATH_F) * (1 - Math.pow(1 - bt, 1.8));
      breathMat.uniforms.uA.value = f >= WHOLE ? 0.16 * Math.pow(1 - bt, 1.4) * smooth(prog(f, WHOLE, WHOLE + 4)) : 0;
      const opened = (x: number, y: number) => smooth(clamp((uFold.value + BREATH_F - Math.hypot(x - MC.x, y - MC.y)) / (2 * BREATH_F)));
      const rt = prog(f, M.midnight, M.midnight + 26);
      ringMat.uniforms.uA.value = 0; // 子正 is the moon brightening, not a ripple
      ringMat.uniforms.uR.value = MR * (1.02 + 1.9 * easeOutCubic(rt));
      // windows: his in the south has been lit all along; hers in the north wakes as she writes
      const wS = opened(WIN_S.x, WIN_S.y);
      // hers comes up on the bell: she is awake, reading, about to write
      const wN = opened(WIN_N.x, WIN_N.y) * (0.3 + 0.7 * smooth(prog(f, M.midnight + 3, M.midnight + 15)));
      const leave = f >= RP.fly ? Math.exp(-(f - RP.fly) / 5) : 0;
      const land = f >= RP.land - 6 ? smooth(prog(f, RP.land - 6, RP.land)) : 0;
      (windows[0].core.material as THREE.MeshBasicMaterial).opacity = wS;
      (windows[0].glow.material as THREE.MeshBasicMaterial).opacity = 0.55 * wS + 1.6 * land;
      windows[0].glow.scale.setScalar(1 + 3 * land);
      (windows[1].core.material as THREE.MeshBasicMaterial).opacity = wN;
      (windows[1].glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * wN + 1.4 * leave;
      // petals and snow drift (and hold still with the world at 23:59:59). On the bell the wind
      // gathers them into one slow swirl round the moon: the south's apricot petals are carried
      // under it over the fold into the north, the north's old snow back over the top into the
      // south, and for a moment the two springs mingle in front of it
      const t = ft / 30;
      // v4.0: the gust takes them at once and lets them settle (v3.1 eased in over 2.6 s)
      const sw = f < M.midnight ? 0 : easeOutCubic(prog(f, M.midnight + 1, M.midnight + 90));
      const swirl = (x: number, y: number, k: number) => {
        if (sw <= 0) return [x, y];
        const dx = x - SWC.x, dy = (y - SWC.y) / 0.62;
        const r = Math.hypot(dx, dy);
        const th = -Math.PI * 0.85 * k * sw * Math.exp(-Math.pow(r / 950, 2));
        const c = Math.cos(th), sn = Math.sin(th);
        return [SWC.x + c * dx - sn * dy, SWC.y + (sn * dx + c * dy) * 0.62];
      };
      const kOf = (ph: number) => 0.6 + 0.4 * ((ph * 0.37) % 1);
      petals.items.forEach((p, i) => {
        // v4.0: no drift east (v3.1 let a few cross the crease before midnight)
        const [x, y] = swirl(p.x + Math.sin(t * 1.3 + p.ph) * 22, ((p.y + t * p.sp * 1.6) % 980) + 20, kOf(p.ph));
        petals.pos[i * 3] = x;
        petals.pos[i * 3 + 1] = -y;
        petals.pos[i * 3 + 2] = 4.5;
      });
      flakes.items.forEach((p, i) => {
        const span = W - SEAM + 300;
        const x0 = p.x - t * 60 + Math.sin(t * 2.1 + p.ph) * 10;
        const [x, y] = swirl(SEAM + 8 + ((((x0 - SEAM - 8) % span) + span) % span), ((p.y + t * p.sp) % 980) + 20, kOf(p.ph));
        flakes.pos[i * 3] = x;
        flakes.pos[i * 3 + 1] = -y;
        flakes.pos[i * 3 + 2] = 4.5;
      });
      // v4.1: the streams off the boughs
      for (const stream of [flowP, flowS]) {
        const isP = stream === flowP;
        stream.motes.forEach((m, i) => {
          const tt = tau - m.d;
          const g = gustAt(tt, m.k);
          const u = 1 - g;
          // along the wind's path (a quadratic curve through under/over the moon), fluttering
          let x = u * u * m.sx + 2 * u * g * m.cx + g * g * m.ex;
          let y = u * u * m.sy + 2 * u * g * m.cy + g * g * m.ey;
          const fly = Math.max(0, tt);
          x += Math.sin(fly * 0.2 + m.ph) * 16 * g;
          y += Math.cos(fly * 0.16 + m.ph) * 10 * g + Math.max(0, fly - 2 * m.k) * (isP ? 0.55 : 0.4); // settling
          stream.pts.pos[i * 3] = x;
          stream.pts.pos[i * 3 + 1] = -y;
          stream.pts.pos[i * 3 + 2] = 4.6;
          stream.pts.turn[i] = m.ph + fly * m.spin;
          stream.pts.flip[i] = isP ? Math.cos(m.ph * 2 + fly * m.tum) : 1;
          stream.pts.al[i] = tt <= 0 ? 0 : smooth(prog(tt, 0, 3)) * (1 - smooth(prog(tau, m.out - 22, m.out)));
        });
        const at = stream.pts.geo.attributes;
        for (const k of ["position", "aTurn", "aFlip", "aA"]) (at[k] as THREE.BufferAttribute).needsUpdate = true;
        stream.pts.mat.uniforms.uOp.value = f >= MID ? 1 : 0;
      }
      for (const d of [petals, flakes]) (d.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      petals.mat.uniforms.uOp.value = 1;
      flakes.mat.uniforms.uOp.value = 1;

      // ---------- the reply crosses ----------
      const stt = prog(f, RP.fly, RP.land - 2);
      trail.forEach((m, i) => {
        const tt = stt - i * 0.0048;
        const mat = m.material as THREE.MeshBasicMaterial;
        if (f < RP.fly || tt <= 0) {
          mat.opacity = 0;
          return;
        }
        const p = streak(easeInOutCubic(clamp(tt)));
        m.position.x = p.x;
        m.position.y = -p.y;
        const head = 1 - i / TRAIL;
        const s = (i === 0 ? 90 : 40) * head + 10;
        m.scale.set(s, s, 1);
        mat.opacity = (i === 0 ? 1 : 0.42 * head) * (1 - smooth(prog(f, RP.land - 3, RP.land + 2)));
      });

      post.finish.uniforms.uSeed.value = f;
      const white = smooth(prog(f, RP.land - 5, RP.land + 1));
      post.finish.uniforms.uFadeColor.value.set(1, 0.98, 0.95);
      post.finish.uniforms.uFade.value = white;
      post.finish.uniforms.uFlash.value = 0.08 * whole;
      if (post.bloom) post.bloom.strength = 0.5 + 0.2 * fl + 0.35 * whole + 0.18 * smooth(prog(f, M.start + 20, M.start + 60)) * (1 - smooth(prog(f, M.form, M.form + 40)));
      post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
