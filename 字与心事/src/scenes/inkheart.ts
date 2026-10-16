// Scene D · 雀跃更浓于忐忑，从前未好过今天。 (17–22 s)
// After "已送达": two drops of ink. The pale one (淡墨) seeps into 忐忑, which will not keep
// still. The dense one (浓墨) lands on 雀跃 and blooms — then the joy bursts: the wet
// strokes throw up a spray of ink, and in the fastest frames the biggest drops open into
// sparrows (墨滴化雀), first as bare ink, inked in as they slow. One flies straight out of
// the frame to the left, wheels round out of sight and comes back in low from the left
// edge, crossing fast under the words to the right; three circle and come down on 忐忑,
// which stops trembling under their weight; two more are gone over the top of the page.
// 浓 is literal: ink density.
import * as THREE from "three";
import cues from "../cues.json";
import { paperCanvas, toTex } from "../lib/textures";
import { makeCanvas } from "../lib/glyph";
import { sparrowSideAtlas, SP_CELL, SP_BODY_Y, SP_PERCH_Y, SP_POSES } from "../lib/sparrow";
import { sdfTexture } from "../lib/sdf";
import { lineInk, glyphInk } from "../lib/ink";
import { W, H, COLORS, HW, lerp, prog, smooth, easeOutCubic, easeInOutCubic, easeInCubic, clamp, mulberry32 } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";

const D = cues.inkheart;
const L1 = "雀跃更浓于忐忑，";
const L2 = "从前未好过今天。";
const S1 = 150, S2 = 92;
const TAN_GRAD = 0.38; // 忐忑: top halves this much denser than the mean, the 心 this much paler
const Y1 = 470, Y2 = 668; // ink centres
const K = 2; // SDF supersampling
const PAD = 48;
const FPS = 30;

type Word = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; x: number; y: number; w: number; h: number; canvas: HTMLCanvasElement };

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
  uniform sampler2D uSdf; uniform vec2 uSize; uniform float uSpread;
  uniform vec2 uDrop; uniform float uR, uBleed, uDensity, uRim, uHalo, uSeed, uT, uTremble, uSplit, uBob;
  uniform vec3 uInk; uniform float uAlpha, uGrad, uGradR, uStreak;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ return 0.5 * n(p) + 0.3 * n(p * 2.3) + 0.2 * n(p * 5.1); }
  void main(){
    vec2 px = vUv * uSize;
    vec2 off = vec2(sin(uT * 47.0 + px.y * 0.05), cos(uT * 53.0 + px.x * 0.04)) * uTremble;
    float upper = smoothstep(uSplit - 6.0, uSplit + 6.0, px.y);
    off.y += upper * uBob;
    vec2 uv = (px - off) / uSize;
    float sd = (texture2D(uSdf, uv).r - 0.5) * 2.0 * uSpread;
    float g = fbm(px * 0.045);
    float g2 = fbm(px * 0.21 + 7.0);
    float edge = uBleed * (0.55 + 0.9 * g);
    float dd = length(px - uDrop * uSize) + (g - 0.5) * 60.0;
    // v4.0 飞白: the second line is brushed out behind a flying sparrow — the wet front is combed
    // into streaks along the flight (0 for every other word)
    dd += (n(vec2(px.x * 0.012, px.y * 0.34) + uSeed) - 0.5) * uStreak;
    float wet = uR > 0.0 ? smoothstep(uR, uR - 40.0, dd) : 0.0;
    float ink = smoothstep(edge + 1.2, edge - 1.2, sd) * wet;
    float rim = exp(-pow((sd - edge + 2.5) / 3.0, 2.0)) * uRim * wet;
    float fringe = smoothstep(edge + 10.0, edge, sd) * (1.0 - ink) * smoothstep(0.45, 0.85, g2) * 0.5 * wet;
    float halo = smoothstep(edge + 26.0, edge + 4.0, sd) * (1.0 - ink) * uHalo * wet;
    float dens = uDensity * (0.86 + 0.18 * g) + rim;
    // v4.0: ink is densest where the drop struck and thins as it soaks away (only 忐忑 use it: the
    // pale drop lands on their top halves, so the heavy 心 below get the palest ink)
    dens *= mix(1.0 + uGrad, 1.0 - uGrad, smoothstep(0.0, uGradR, dd));
    float a = clamp(ink * dens + fringe * uDensity + halo * 0.07, 0.0, 1.0) * uAlpha;
    gl_FragColor = vec4(uInk, a);
  }`;

// a sparrow sprite: pose from an atlas row, flipped to face left, motion-blurred along its
// flight (and zoom-blurred when it rushes the lens), born as bare ink spreading out from the
// body (uGrow), then inked in (uDetail)
const BIRD_FRAG = /* glsl */ `
  uniform sampler2D uTex; uniform float uCells, uPose, uFlip, uA, uDetail, uGrow, uSeed, uZoom; uniform vec2 uBlur, uCentre; uniform vec3 uInk;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  vec4 samp(vec2 uv){ uv = clamp(uv, vec2(0.002), vec2(0.998)); return texture2D(uTex, vec2((uv.x + uPose) / uCells, uv.y)); }
  void main(){
    vec2 uv = vec2(uFlip > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
    vec2 bl = vec2(uFlip > 0.0 ? uBlur.x : -uBlur.x, uBlur.y);
    vec3 rgb = vec3(0.0); float a = 0.0;
    for (int i = 0; i < 9; i++) {
      float t = float(i) / 8.0;
      // along its flight, and (coming at the lens) back through the smaller sizes it just was
      vec4 c = samp(uCentre + (uv - uCentre) * (1.0 + uZoom * t) + bl * (t - 0.5));
      rgb += c.rgb * c.a; a += c.a;
    }
    rgb /= max(a, 1e-4); a /= 9.0;
    float d = length(uv - uCentre) / 0.5 + (n(uv * 11.0) - 0.5) * 0.35;
    float grow = 1.0 - smoothstep(uGrow - 0.18, uGrow, d);
    vec3 col = mix(uInk, rgb, uDetail);
    gl_FragColor = vec4(col, a * grow * uA);
  }`;

export function createInkheart(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.paper);
  const camera = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
  const root = new THREE.Group();
  scene.add(root);

  // ---------- paper ----------
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, H * 1.3), new THREE.MeshBasicMaterial({ map: toTex(paperCanvas(2304, 1296, { seed: 52, base: COLORS.paper, fibers: 7000, speck: 2200 })) }));
  paper.position.set(W / 2, -H / 2, -1);
  root.add(paper);
  const vig = makeCanvas(512, 288);
  {
    const ctx = vig.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 130, 40, 256, 144, 330);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(40,36,34,0.32)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 288);
  }
  const vigMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: toTex(vig), transparent: true, depthWrite: false }));
  vigMesh.position.set(W / 2, -H / 2, 5);
  scene.add(vigMesh);
  // a shadow over the page (unused since the near bird no longer passes the lens)
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0c0b0c, transparent: true, opacity: 0, depthWrite: false }));
  shade.position.set(W / 2, -H / 2, 4.5);
  scene.add(shade);

  // ---------- the words, laid out on their ink ----------
  const chars1 = [...L1];
  const L = lineInk(chars1, S1, chars1.map((_, i) => (i ? 6 : 0)));
  const x01 = W / 2 - (L.boxL + L.boxR) / 2; // cells on their axes, end marks trimmed (lib/ink)
  const base1 = Y1 - (L.inkT + L.inkB) / 2;
  const chars2 = [...L2];
  const M = lineInk(chars2, S2, chars2.map((_, i) => (i ? 10 : 0)));
  const x02 = W / 2 - (M.boxL + M.boxR) / 2;
  const base2 = Y2 - (M.inkT + M.inkB) / 2;

  const makeWord = (chars: string[], xs: number[], a: number, b: number, size: number, x0: number, baseline: number, seed: number): Word => {
    let l = Infinity, r = -Infinity, t = Infinity, bt = -Infinity;
    for (let i = a; i < b; i++) {
      const g = glyphInk(chars[i], size);
      l = Math.min(l, xs[i] + g.l);
      r = Math.max(r, xs[i] + g.r);
      t = Math.min(t, g.t);
      bt = Math.max(bt, g.b);
    }
    const w = r - l + PAD * 2, h = bt - t + PAD * 2;
    const c = makeCanvas(w * K, h * K);
    const ctx = c.getContext("2d")!;
    ctx.font = `400 ${size * K}px ${HW}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";
    for (let i = a; i < b; i++) ctx.fillText(chars[i], (xs[i] - l + PAD) * K, (-t + PAD) * K);
    const tex = sdfTexture(c, 40 * K);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uSdf: { value: tex }, uSize: { value: new THREE.Vector2(w, h) }, uSpread: { value: 40 },
        uDrop: { value: new THREE.Vector2(0.5, 0.5) }, uR: { value: 0 }, uBleed: { value: 0.5 }, uDensity: { value: 0.9 },
        uRim: { value: 0.1 }, uHalo: { value: 0.6 }, uSeed: { value: seed }, uT: { value: 0 }, uTremble: { value: 0 },
        uSplit: { value: h * 0.55 }, uBob: { value: 0 }, uInk: { value: new THREE.Color(COLORS.ink) }, uAlpha: { value: 1 },
        uGrad: { value: 0 }, uGradR: { value: 1 }, uStreak: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const cxp = x0 + l - PAD + w / 2;
    const cyp = baseline + t - PAD + h / 2;
    mesh.position.set(cxp, -cyp, 0);
    root.add(mesh);
    return { mesh, mat, x: cxp, y: cyp, w, h, canvas: c };
  };
  const que = makeWord(chars1, L.xs, 0, 2, S1, x01, base1, 1);
  const mid = makeWord(chars1, L.xs, 2, 5, S1, x01, base1, 2);
  const comma = makeWord(chars1, L.xs, 7, 8, S1, x01, base1, 4);
  const line2 = chars2.map((_, i) => makeWord(chars2, M.xs, i, i + 1, S2, x02, base2, 10 + i));
  que.mat.uniforms.uInk.value = new THREE.Color("#0c0c0f");
  const tan1 = makeWord(chars1, L.xs, 5, 6, S1, x01, base1, 3); // 忐
  const tan2 = makeWord(chars1, L.xs, 6, 7, S1, x01, base1, 5); // 忑
  for (const w of [tan1, tan2]) w.mat.uniforms.uInk.value = new THREE.Color("#2a2a30");

  /** canvas px of a word -> screen px */
  const toScreen = (wd: Word, px: number, py: number) => ({ x: wd.x - wd.w / 2 + px / K, y: wd.y - wd.h / 2 + py / K });
  const alphaOf = (wd: Word) => wd.canvas.getContext("2d")!.getImageData(0, 0, wd.canvas.width, wd.canvas.height);
  /** the first long horizontal stroke from the top of a glyph: somewhere for a bird to stand */
  const perchOf = (wd: Word) => {
    const img = alphaOf(wd);
    const cw = img.width, ch = img.height;
    let minX = cw, maxX = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (img.data[(y * cw + x) * 4 + 3] > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const need = (maxX - minX) * 0.4;
    for (let y = 0; y < ch; y++) {
      let run = 0, best = 0, bestEnd = 0;
      for (let x = 0; x < cw; x++) {
        if (img.data[(y * cw + x) * 4 + 3] > 128) { run++; if (run > best) { best = run; bestEnd = x; } } else run = 0;
      }
      if (best > need) {
        const a = toScreen(wd, bestEnd - best + 1, y), b = toScreen(wd, bestEnd, y);
        return { x0: a.x, x1: b.x, y: a.y };
      }
    }
    return { x0: wd.x - 40, x1: wd.x + 40, y: wd.y - wd.h / 2 + PAD };
  };
  const perch1 = perchOf(tan1), perch2 = perchOf(tan2);

  // ---------- drops ----------
  // We look straight down at the paper, so a drop falls towards it along our line of sight:
  // it comes in near the lens, big and out of focus, and shrinks and sharpens onto its spot,
  // while its shadow on the paper gathers under it.
  const DROP_FS = `uniform vec3 uCol; uniform float uA, uSoft; varying vec2 vUv;
    void main(){
      float d = length(vUv - 0.5) * 2.0;
      float a = smoothstep(1.0, 1.0 - uSoft, d);
      // a glint where the drop is glossy, top left
      float gl = smoothstep(0.32, 0.0, length(vUv - vec2(0.36, 0.64))) * (1.0 - uSoft) * 0.35;
      gl_FragColor = vec4(uCol + gl, a * uA);
    }`;
  const mkDrop = (col: string) => {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: VERT, fragmentShader: DROP_FS, uniforms: { uCol: { value: new THREE.Color(col) }, uA: { value: 0 }, uSoft: { value: 0.5 } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: VERT, fragmentShader: DROP_FS, uniforms: { uCol: { value: new THREE.Color("#2a2724") }, uA: { value: 0 }, uSoft: { value: 0.9 } } }));
    root.add(shadow, m);
    return { m, mat, shadow };
  };
  const dropA = mkDrop("#5d5b5c"); // 淡墨
  const dropB = mkDrop("#0c0b0e"); // 浓墨
  const tanC = { x: (tan1.x + tan2.x) / 2, y: tan1.y };
  // v4.0: where the pale drop strikes — on the top halves (上, 下) of 忐忑, not their middle — so
  // the ink is heaviest there and the 心 beneath are the palest: the words' weight rises to the
  // line's without moving them a pixel (the user: "在数值上我们要做到绝对的标准")
  const tanI = { x: tanC.x, y: tanC.y - 0.24 * S1 };
  // satellite droplets thrown by each impact
  const splashes: { mesh: THREE.Mesh; at: number; ox: number; oy: number; dx: number; dy: number; r: number; dark: boolean }[] = [];
  const sr = mulberry32(12);
  const addSplash = (at: number, ox: number, oy: number, n: number, dark: boolean) => {
    for (let i = 0; i < n; i++) {
      const ang = sr() * Math.PI * 2;
      const dist = 30 + Math.pow(sr(), 0.7) * (dark ? 190 : 120);
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: dark ? 0x0c0c0f : 0x6e6c6a, transparent: true, opacity: 0, depthWrite: false }));
      root.add(m);
      splashes.push({ mesh: m, at, ox, oy, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist * 0.8, r: 1.5 + Math.pow(sr(), 3) * (dark ? 9 : 5), dark });
    }
  };
  addSplash(D.drop1, tanI.x, tanI.y, 26, false);
  addSplash(D.drop2, que.x, que.y, 46, true);

  // ---------- the burst: 雀跃 throws up its ink ----------
  const softDot = (() => {
    const c = makeCanvas(64, 64);
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0, "rgba(12,11,13,1)");
    g.addColorStop(0.62, "rgba(12,11,13,0.95)");
    g.addColorStop(1, "rgba(12,11,13,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return toTex(c);
  })();
  // splat marks left where drops come down on the paper
  const splatTex = [0, 1, 2, 3].map((k) => {
    const c = makeCanvas(128, 128);
    const x = c.getContext("2d")!;
    const r = mulberry32(300 + k);
    x.fillStyle = "rgba(12,11,13,0.92)";
    for (let i = 0; i < 6; i++) {
      x.beginPath();
      x.ellipse(64 + (r() - 0.5) * 14, 64 + (r() - 0.5) * 10, 10 + r() * 12, 8 + r() * 9, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    // the thrown arm of the splat and a few satellites
    const ang = r() * Math.PI * 2;
    for (let i = 0; i < 5; i++) {
      const d = 26 + i * 7 + r() * 5;
      x.beginPath();
      x.arc(64 + Math.cos(ang + (r() - 0.5) * 0.5) * d, 64 + Math.sin(ang + (r() - 0.5) * 0.5) * d, 5 - i * 0.8, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 9; i++) {
      const a2 = r() * Math.PI * 2, d = 30 + r() * 26;
      x.beginPath();
      x.arc(64 + Math.cos(a2) * d, 64 + Math.sin(a2) * d, 1 + r() * 2.4, 0, Math.PI * 2);
      x.fill();
    }
    return toTex(c);
  });
  const img = alphaOf(que);
  const inkPts: { x: number; y: number }[] = [];
  {
    const r = mulberry32(77);
    let guard = 0;
    while (inkPts.length < 400 && guard++ < 200000) {
      const px = Math.floor(r() * img.width), py = Math.floor(r() * img.height);
      if (img.data[(py * img.width + px) * 4 + 3] > 200) inkPts.push(toScreen(que, px, py));
    }
  }
  const G = 3000; // px/s², down the page
  const KD = 1.1; // drag, 1/s
  /** ballistic flight with linear drag (dv/dt = g − k·v, g down the page), t in seconds */
  const fly = (x0: number, y0: number, vx: number, vy: number, t: number) => {
    const ex = Math.exp(-KD * t), e = (1 - ex) / KD, vt = G / KD;
    return {
      x: x0 + vx * e,
      y: y0 + vt * t + (vy - vt) * e,
      vx: vx * ex,
      vy: vt + (vy - vt) * ex,
    };
  };
  type Spray = { x0: number; y0: number; vx: number; vy: number; delay: number; size: number; land: number; lx: number; ly: number; mesh: THREE.Mesh; splat: THREE.Mesh | null };
  const sprays: Spray[] = [];
  {
    const r = mulberry32(91);
    for (let i = 0; i < 120; i++) {
      const p = inkPts[Math.floor(r() * inkPts.length)];
      const ang = -Math.PI / 2 + (r() + r() + r() - 1.5) * 0.78;
      const sp = 380 + Math.pow(r(), 0.7) * 920;
      const size = 2.5 + Math.pow(r(), 2.4) * 15;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const delay = Math.floor(r() * 3);
      // where it comes down: the first time it falls back past a floor a little below its start
      const floor = p.y + (r() - 0.3) * 230;
      let land = -1, lx = 0, ly = 0;
      for (let f = 1; f < 110; f++) {
        const s = fly(p.x, p.y, vx, vy, f / FPS);
        if (s.vy > 0 && s.y >= floor) { land = f; lx = s.x; ly = s.y; break; }
      }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot, transparent: true, opacity: 0, depthWrite: false }));
      mesh.position.z = 1.5;
      root.add(mesh);
      let splat: THREE.Mesh | null = null;
      if (land > 0 && lx > -50 && lx < W + 50 && ly > -50 && ly < H + 50) {
        splat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex[i % 4], transparent: true, opacity: 0, depthWrite: false }));
        splat.position.set(lx, -ly, 0.3);
        splat.rotation.z = r() * Math.PI * 2;
        root.add(splat);
      }
      sprays.push({ x0: p.x, y0: p.y, vx, vy, delay, size, land, lx, ly, mesh, splat });
    }
  }

  // ---------- the sparrows ----------
  const sideTex = toTex(sparrowSideAtlas());
  const birdMat = (tex: THREE.Texture, cells: number, centreV: number, seed: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERT,
      fragmentShader: BIRD_FRAG,
      uniforms: {
        uTex: { value: tex }, uCells: { value: cells }, uPose: { value: 0 }, uFlip: { value: 1 }, uA: { value: 0 },
        uDetail: { value: 0 }, uGrow: { value: 0 }, uSeed: { value: seed }, uZoom: { value: 0 }, uBlur: { value: new THREE.Vector2() },
        uCentre: { value: new THREE.Vector2(0.5, centreV) }, uInk: { value: new THREE.Color("#141215") },
      },
    });
  const BODY_V = 1 - SP_BODY_Y / SP_CELL; // body centre in a side cell (uv)
  const FEET = (SP_PERCH_Y - SP_CELL / 2) / SP_CELL; // feet below the cell centre, per px of size

  type Key = { f: number; x: number; y: number };
  type Bird = {
    launch: { vx: number; vy: number; x: number; y: number }; // the drop it is born from
    morph: number; // frame the drop opens
    keys: Key[]; // flight after the morph, frame-stamped
    land?: number; // touchdown frame
    perch?: { x: number; y: number };
    takeoff?: number;
    size: number;
    phase: number;
    hero?: boolean;
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    blob: THREE.Mesh;
    touch?: THREE.Mesh;
  };
  const B0 = D.burst;
  const qx = que.x, qy = que.y;
  // two face each other across 忑's top stroke, beak to beak with a little air between
  const p1 = { x: lerp(perch2.x0, perch2.x1, 0.12), y: perch2.y }; // 忑, left
  const p2 = { x: lerp(perch1.x0, perch1.x1, 0.22), y: perch1.y }; // 忐
  const p3 = { x: lerp(perch2.x0, perch2.x1, 0.92), y: perch2.y }; // 忑, right
  const [LA, LB, LC] = D.lands;
  const FLY = D.fly;
  const mk = (b: Omit<Bird, "mesh" | "mat" | "blob">): Bird => {
    const mat = birdMat(sideTex, SP_POSES, BODY_V, b.phase);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = b.hero ? 3 : 2;
    root.add(mesh);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot, transparent: true, opacity: 0, depthWrite: false }));
    blob.position.z = 1.6;
    root.add(blob);
    let touch: THREE.Mesh | undefined;
    if (b.perch) {
      touch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot, transparent: true, opacity: 0, depthWrite: false }));
      touch.position.set(b.perch.x, -b.perch.y - 2, 0.8);
      root.add(touch);
    }
    return { ...b, mesh, mat, blob, touch };
  };
  // where a drop launched at the burst is at frame f
  const blobAt = (b: { launch: Bird["launch"] }, f: number) => fly(b.launch.x, b.launch.y, b.launch.vx, b.launch.vy, Math.max(0, f - B0) / FPS);
  const birds: Bird[] = [];
  // v4.5: a bird comes down where its first perched frame stands it: squashed by the touchdown (0.9 of
  // its height) with its feet on the perch, its body is ARRIVE × its size above the perch point (v4.4
  // flew the body onto the perch point itself, and the bird stood up 0.18 × its size as it landed)
  const ARRIVE = 0.9 * FEET - (0.5 - BODY_V);
  const add = (b: Omit<Bird, "mesh" | "mat" | "blob" | "keys"> & { keys: (start: Key) => Key[] }) => {
    const s = blobAt(b, b.morph);
    const start = { f: b.morph, x: s.x, y: s.y };
    const keys = [start, ...b.keys(start)];
    const last = keys[keys.length - 1];
    if (b.perch && last.f === b.land) last.y = b.perch.y - ARRIVE * b.size;
    birds.push(mk({ ...b, keys }));
  };
  // the nearest: thrown out to the left, it opens into a bird and keeps going, out of the
  // frame; it wheels round out of sight and comes back in low from the left edge, crossing
  // fast under the words and out on the right — never turning about where we can see it
  const [X0c, X1c] = D.cross;
  add({
    hero: true, launch: { x: qx - 70, y: qy + 10, vx: -560, vy: -380 }, morph: B0 + 3, size: 186, phase: 1,
    keys: (s) => [
      { f: B0 + 7, x: s.x - 150, y: s.y - 22 },
      { f: B0 + 11, x: 80, y: s.y - 18 },
      { f: B0 + 14, x: -120, y: s.y + 10 },
      // v4.0 (用户方案): it comes back skimming the second line, a little slower across it, and
      // brushes the line out behind itself (see 从前未好过今天 below)
      { f: X0c - 5, x: -280, y: 700 },
      { f: X0c - 2, x: -150, y: 752 },
      { f: X0c, x: 40, y: 762 },
      { f: X0c + 6, x: 470, y: 752 },
      { f: X0c + 12, x: 800, y: 744 },
      { f: X0c + 18, x: 1130, y: 748 },
      { f: X0c + 24, x: 1450, y: 740 },
      { f: X1c, x: 1880, y: 720 },
      { f: X1c + 4, x: 2240, y: 700 },
    ],
  });
  // three that come down on 忐忑
  add({
    launch: { x: qx - 50, y: qy - 20, vx: -320, vy: -1350 }, morph: B0 + 5, size: 205, phase: 0.3, perch: p1, land: LA, takeoff: FLY,
    keys: (s) => [
      { f: B0 + 12, x: s.x - 90, y: s.y - 110 },
      { f: B0 + 20, x: s.x - 40, y: 120 },
      { f: B0 + 28, x: s.x + 220, y: 105 },
      { f: B0 + 36, x: 1000, y: 190 },
      { f: LA - 5, x: p1.x - 120, y: p1.y - 110 },
      { f: LA, x: p1.x, y: p1.y },
    ],
  });
  add({
    launch: { x: qx + 10, y: qy - 40, vx: 160, vy: -1500 }, morph: B0 + 7, size: 192, phase: 0.6, perch: p2, land: LB, takeoff: FLY + 3,
    keys: (s) => [
      { f: B0 + 15, x: s.x + 60, y: 120 },
      { f: B0 + 24, x: s.x + 260, y: 80 },
      { f: B0 + 33, x: s.x + 470, y: 120 },
      { f: B0 + 42, x: p2.x - 40, y: 210 },
      { f: LB - 5, x: p2.x - 90, y: p2.y - 100 },
      { f: LB, x: p2.x, y: p2.y },
    ],
  });
  add({
    launch: { x: qx + 60, y: qy - 10, vx: 640, vy: -1150 }, morph: B0 + 8, size: 182, phase: 0.85, perch: p3, land: LC, takeoff: FLY + 6,
    keys: (s) => [
      { f: B0 + 15, x: s.x + 230, y: s.y - 120 },
      { f: B0 + 25, x: s.x + 560, y: 160 },
      { f: B0 + 36, x: 1640, y: 230 },
      { f: LC - 12, x: 1640, y: 320 },
      { f: LC - 5, x: p3.x + 120, y: p3.y - 100 },
      { f: LC, x: p3.x, y: p3.y },
    ],
  });
  // two that are simply gone over the top of the page
  add({ launch: { x: qx - 90, y: qy, vx: -700, vy: -950 }, morph: B0 + 9, size: 140, phase: 0.15, keys: (s) => [{ f: B0 + 16, x: s.x - 160, y: s.y - 160 }, { f: B0 + 26, x: -160, y: -120 }] });
  add({ launch: { x: qx + 110, y: qy - 20, vx: 860, vy: -1050 }, morph: B0 + 11, size: 128, phase: 0.45, keys: (s) => [{ f: B0 + 18, x: s.x + 260, y: s.y - 190 }, { f: B0 + 28, x: s.x + 600, y: -160 }] });

  const heroKeys = birds.find((b) => b.hero)!.keys;
  const BRUSH_LAG = 50; // px behind the bird's centre where the ink comes off its tail

  /** Catmull-Rom through frame-stamped keys */
  const along = (keys: Key[], f: number) => {
    if (f <= keys[0].f) return { x: keys[0].x, y: keys[0].y };
    let i = 0;
    while (i < keys.length - 2 && f > keys[i + 1].f) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[Math.min(keys.length - 1, i + 1)], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const t = clamp((f - k1.f) / Math.max(1e-3, k2.f - k1.f));
    const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    return { x: cr(k0.x, k1.x, k2.x, k3.x), y: cr(k0.y, k1.y, k2.y, k3.y) };
  };
  // v4.1 · as the three come down on 忐忑, each shakes a few flecks of its ink off onto the paper just
  // above the words — a little trace of their flight, which stays (the user: "小鸟飞过忐忑的时候…
  // 留一点点墨痕"). Each fleck leaves the bird's tail in its last frames before it lands, flies a
  // short arc, and soaks into the paper as a speck.
  type Fleck = { at: number; x0: number; y0: number; x1: number; y1: number; size: number; dot: THREE.Mesh; mark: THREE.Mesh };
  const flecks: Fleck[] = [];
  {
    const r = mulberry32(4105);
    const landing = birds.filter((b) => b.perch && b.land !== undefined);
    landing.forEach((b, bi) => {
      const n = bi === 1 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const at = b.land! - 5 + k * 1.5 + r() * 0.8;
        const p = along(b.keys, at), q = along(b.keys, at - 1);
        const vx = p.x - q.x, vy = p.y - q.y, l = Math.hypot(vx, vy) || 1;
        const x0 = p.x - (vx / l) * 40, y0 = p.y - (vy / l) * 40; // off the tail
        const x1 = b.perch!.x + (r() - 0.5) * 90 + vx * 0.6, y1 = b.perch!.y - 26 - r() * 58;
        const size = 1.4 + Math.pow(r(), 1.6) * 2.4;
        const dot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot, transparent: true, opacity: 0, depthWrite: false }));
        dot.position.z = 1.5;
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex[(bi + k) % 4], transparent: true, opacity: 0, depthWrite: false }));
        mark.position.set(x1, -y1, 0.3);
        mark.rotation.z = r() * Math.PI * 2;
        root.add(dot, mark);
        flecks.push({ at, x0, y0, x1, y1, size, dot, mark });
      }
    });
  }
  // flapping with the sparrow's bounding rhythm: three beats, then a short glide with wings shut
  const FLAP = [2, 3, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 5, 5, 5, 5, 5];
  const flapPose = (b: Bird, f: number, climb: boolean) => {
    const k = Math.floor(f + b.phase * 17);
    if (climb) return [2, 3, 4, 3][((k % 4) + 4) % 4];
    return FLAP[((k % FLAP.length) + FLAP.length) % FLAP.length];
  };

  return {
    render(f: number) {
      const T = f / 30;
      (shade.material as THREE.MeshBasicMaterial).opacity = 0;
      // ---------- camera: a slow push, a punch on the burst, a look up while they fly ----------
      let shake = 0;
      for (const at of [D.drop1, D.drop2]) if (f >= at) shake += 3.5 * Math.exp(-(f - at) / 2.5);
      if (f >= B0) shake += 6 * Math.exp(-(f - B0) / 3);
      const punch = f >= B0 ? 0.035 * Math.exp(-(f - B0) / 7) : 0;
      const z = lerp(1.0, 1.045, easeInOutCubic(prog(f, D.land, D.end))) + punch;
      const lookUp = 46 * smooth(prog(f, B0, B0 + 14)) * (1 - smooth(prog(f, LA - 14, LA + 4)));
      root.scale.set(z, z, 1);
      root.position.set(W / 2 - (W / 2) * z + Math.sin(f * 2.1) * shake, -H / 2 + (H / 2) * z + Math.cos(f * 1.7) * shake - lookUp, 0);

      // ---------- the two drops ----------
      const drop = (d: ReturnType<typeof mkDrop>, at: number, cxp: number, cyp: number, big: number) => {
        const FALL = 9;
        const u = d.mat.uniforms, su = (d.shadow.material as THREE.ShaderMaterial).uniforms;
        if (f < at - FALL || f >= at) {
          u.uA.value = 0;
          su.uA.value = 0;
          return;
        }
        const e = Math.pow(prog(f, at - FALL, at), 2); // gravity: slow at first, fast at the end
        const sc = 1 / (1 - 0.9 * (1 - e)); // nearer the lens it looks bigger
        const off = (sc - 1) * 0.06;
        d.m.position.set(cxp + (cxp - 960) * off, -(cyp + (cyp - 540) * off), 2.5);
        d.m.scale.setScalar(big * 0.5 * sc);
        u.uA.value = lerp(0.5, 0.95, e) * smooth(prog(f, at - FALL, at - FALL + 2));
        u.uSoft.value = lerp(0.95, 0.14, e);
        d.shadow.position.set(cxp + 5, -(cyp + 7), 0.4);
        d.shadow.scale.setScalar(big * lerp(1.6, 0.62, e));
        su.uA.value = lerp(0.04, 0.3, e);
        su.uSoft.value = lerp(0.95, 0.6, e);
      };
      drop(dropA, D.drop1, tanI.x, tanI.y, 16);
      drop(dropB, D.drop2, que.x, que.y, 24);
      for (const s of splashes) {
        const t = prog(f, s.at, s.at + 6);
        const m = s.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = f >= s.at ? (s.dark ? 0.92 : 0.6) : 0;
        const e = easeOutCubic(t);
        s.mesh.position.set(s.ox + s.dx * e, -(s.oy + s.dy * e), 0.5);
        s.mesh.scale.setScalar(s.r * (0.6 + 0.4 * e));
      }

      // ---------- 忐忑: pale ink that will not keep still, until the birds are on it ----------
      let landed = 0;
      for (const at of D.lands) landed += smooth(prog(f, at, at + 8));
      for (const [wd, sign] of [[tan1, 1], [tan2, -1]] as [Word, number][]) {
        const u = wd.mat.uniforms;
        u.uT.value = T;
        u.uDrop.value.set((tanI.x - (wd.x - wd.w / 2)) / wd.w, 1 - (tanI.y - (wd.y - wd.h / 2)) / wd.h);
        u.uR.value = f >= D.drop1 ? 700 * easeOutCubic(prog(f, D.drop1, D.drop1 + 22)) : 0;
        u.uGrad.value = TAN_GRAD;
        u.uGradR.value = 1.15 * S1;
        u.uBleed.value = lerp(0.5, 2.0, prog(f, D.drop1, D.drop1 + 30));
        const nerves = smooth(prog(f, D.drop1 + 6, D.drop1 + 14)) * (1 - landed / 3) * (f < B0 ? 1 : lerp(1, 1.35, smooth(prog(f, B0, B0 + 6))));
        u.uTremble.value = 1.6 * nerves;
        const beat = Math.pow(Math.max(0, Math.sin(T * Math.PI * 4)), 6);
        u.uBob.value = sign * 7 * beat * nerves;
        u.uDensity.value = lerp(0.36, 0.3, prog(f, D.mid, D.end));
        u.uRim.value = 0.12;
        u.uHalo.value = 0.8;
        // each landing presses the word down a little
        let press = 0;
        D.lands.forEach((at, i) => {
          const onThis = (i === 1) === (wd === tan1);
          if (onThis && f >= at) press += 4 * Math.exp(-(f - at) / 5) * Math.sin(Math.min(Math.PI, (f - at) / 2));
        });
        wd.mesh.position.y = -wd.y - press;
      }

      // ---------- 雀跃: dense ink that blooms, then throws itself up ----------
      {
        const u = que.mat.uniforms;
        u.uT.value = T;
        u.uDrop.value.set(0.5, 0.5);
        u.uR.value = f >= D.drop2 ? 900 * easeOutCubic(prog(f, D.drop2, D.drop2 + 16)) : 0;
        const bloom = easeOutCubic(prog(f, D.drop2, B0 + 6));
        u.uBleed.value = lerp(0.8, 4.4, bloom);
        u.uDensity.value = lerp(0.72, 1.0, bloom);
        u.uRim.value = 0.25;
        u.uHalo.value = 1.0;
        // two swells like held breath before the burst, then the kick of it
        const held = f < B0 ? 0.03 * Math.pow(Math.max(0, Math.sin(((f - D.drop2) / 7.5) * Math.PI)), 6) * (f > D.drop2 ? 1 : 0) : 0;
        const kick = f >= B0 ? 0.07 * Math.exp(-(f - B0) / 3) : 0;
        que.mesh.scale.setScalar(1 + 0.045 * Math.exp(-Math.max(0, f - D.drop2) / 6) * (f >= D.drop2 ? 1 : 0) + held + kick);
      }

      // ---------- 更浓于， then the second line ----------
      const seep = (wd: Word, at: number, dur: number, dens: number) => {
        const u = wd.mat.uniforms;
        u.uT.value = T;
        u.uDrop.value.set(0.3, 0.7);
        u.uR.value = f >= at ? 600 * easeOutCubic(prog(f, at, at + dur)) : 0;
        u.uBleed.value = lerp(0.3, 1.3, prog(f, at, at + dur + 10));
        u.uDensity.value = dens;
        u.uRim.value = 0.1;
        u.uHalo.value = 0.5;
      };
      seep(mid, D.mid, 9, 0.88);
      seep(comma, D.comma, 5, 0.88);
      // 从前未好过今天。 — brushed out behind the low sparrow as it skims the line (v3.1 seeped the
      // glyphs in one every 3 frames from 20.7 s, and the whole line stood 0.6 s before the cut;
      // now it is written by 20.2 s and stands about 1.8 s)
      const hx = along(heroKeys, f).x;
      line2.forEach((wd) => {
        const u = wd.mat.uniforms;
        u.uT.value = T;
        const front = hx - BRUSH_LAG - (wd.x - wd.w / 2 + PAD); // how far the wet front is past the glyph's left
        u.uDrop.value.set(PAD / wd.w, 0.5);
        u.uR.value = front > 0 ? Math.min(600, front * 1.35) : 0;
        u.uBleed.value = lerp(0.3, 1.3, clamp(front / 420));
        u.uDensity.value = 0.82;
        u.uRim.value = 0.1;
        u.uHalo.value = 0.5;
        u.uStreak.value = 130;
      });

      // ---------- spray ----------
      for (const s of sprays) {
        const m = s.mesh.material as THREE.MeshBasicMaterial;
        const tf = f - B0 - s.delay;
        if (tf < 0 || (s.land > 0 && tf >= s.land)) {
          m.opacity = 0;
        } else {
          const p = fly(s.x0, s.y0, s.vx, s.vy, tf / FPS);
          const sp = Math.hypot(p.vx, p.vy);
          m.opacity = 0.95;
          s.mesh.position.set(p.x, -p.y, 1.5);
          s.mesh.rotation.z = -Math.atan2(p.vy, p.vx);
          const swell = 1 + 0.5 * Math.sin(Math.min(1, tf / 14) * Math.PI); // nearer the lens at the top of its arc
          s.mesh.scale.set(s.size * swell * (1 + sp / 1700), s.size * swell * 0.92, 1);
        }
        if (s.splat) {
          const sm = s.splat.material as THREE.MeshBasicMaterial;
          const st = tf - s.land;
          sm.opacity = st >= 0 ? 0.9 : 0;
          s.splat.scale.setScalar(s.size * 3.2 * lerp(0.55, 1, easeOutCubic(clamp(st / 3))));
        }
      }

      // ---------- v4.1: the flecks shaken off as they land ----------
      for (const k of flecks) {
        const t = (f - k.at) / 4;
        const dm = k.dot.material as THREE.MeshBasicMaterial, mm = k.mark.material as THREE.MeshBasicMaterial;
        if (t < 0) {
          dm.opacity = 0;
          mm.opacity = 0;
        } else if (t < 1) {
          const e = easeOutCubic(t);
          k.dot.position.set(lerp(k.x0, k.x1, e), -(lerp(k.y0, k.y1, e) - 14 * Math.sin(Math.PI * t)), 1.5);
          k.dot.scale.setScalar(k.size * 2.2);
          dm.opacity = 0.9;
          mm.opacity = 0;
        } else {
          dm.opacity = 0;
          mm.opacity = 0.62;
          k.mark.scale.setScalar(k.size * 3.0 * lerp(0.6, 1, easeOutCubic(clamp((t - 1) * 2))));
        }
      }

      // ---------- sparrows ----------
      for (const b of birds) {
        const m = b.mat.uniforms;
        const blobM = b.blob.material as THREE.MeshBasicMaterial;
        // before the morph: a drop in flight
        if (f < b.morph + 5) {
          const p = blobAt(b, Math.min(f, b.morph + 5));
          const sp = Math.hypot(p.vx, p.vy);
          const shrink = 1 - easeInCubic(prog(f, b.morph, b.morph + 5));
          blobM.opacity = f >= B0 ? 0.96 : 0;
          b.blob.position.set(p.x, -p.y, 1.6);
          b.blob.rotation.z = -Math.atan2(p.vy, p.vx);
          const r0 = 15 + b.size * 0.04;
          b.blob.scale.set(r0 * (1 + sp / 1500) * shrink, r0 * shrink, 1);
        } else blobM.opacity = 0;
        if (f < b.morph) {
          m.uA.value = 0;
          continue;
        }
        // position, velocity (px/frame)
        let p = along(b.keys, f);
        const p0 = along(b.keys, f - 1), p2 = along(b.keys, f + 1);
        let vx = (p2.x - p0.x) / 2, vy = (p2.y - p0.y) / 2;
        let pose = flapPose(b, f, vy < -3);
        let size = b.size;
        let rotZ = 0;
        let perched = false;
        // the drop opens into a bird, bare ink first, inked in as it slows
        m.uGrow.value = 1.25 * easeOutCubic(prog(f, b.morph, b.morph + 6));
        m.uDetail.value = smooth(prog(f, b.morph + 5, b.morph + 17));
        m.uZoom.value = 0;
        if (b.land !== undefined && b.perch && f >= b.land - 5 && (b.takeoff === undefined || f < b.takeoff)) {
          if (f < b.land) pose = 6; // flare: wings up and forward, legs reaching
          else {
            perched = true;
            const since = f - b.land;
            pose = since < 3 ? 1 : 0;
            p = { x: b.perch.x, y: b.perch.y };
            vx = 0;
            vy = 0;
          }
        }
        if (b.takeoff !== undefined && b.perch && f >= b.takeoff) {
          const since = f - b.takeoff;
          if (since < 2) {
            perched = true;
            pose = 1;
            p = { x: b.perch.x, y: b.perch.y };
          } else {
            // off and away to the right, over the fold that is coming
            const t = (since - 2) / FPS;
            const ex = b.perch.x + 680 * t + 900 * t * t, ey = b.perch.y - 120 * t - 900 * t * t - 40 * Math.min(1, since / 3);
            vx = 680 / FPS + 1800 * t / FPS;
            vy = -(120 + 1800 * t) / FPS;
            p = { x: ex, y: ey };
            pose = since < 4 ? 7 : flapPose(b, f, true);
          }
        }
        // which way it faces; landed birds keep the way they came in
        const facingLeft = perched ? (b.perch && along(b.keys, (b.land ?? f) - 2).x > b.perch.x + 4) : vx < -0.6;
        const flip = facingLeft ? -1 : 1;
        // one of them turns to look back, once it has settled
        let lookBack = 1;
        if (b === birds[2] && perched && f >= LB + 14 && f < LB + 26) lookBack = -1;
        m.uFlip.value = flip * lookBack;
        if (!perched) {
          const climb = Math.atan2(-vy, Math.abs(vx) + 1e-3);
          rotZ = clamp(climb * 0.55, -0.5, 0.6) * flip;
        }
        m.uPose.value = pose;
        const sp = Math.hypot(vx, vy);
        const blurLen = perched ? 0 : clamp((sp / size) * 0.35, 0, 0.07);
        m.uBlur.value.set(sp > 0 ? (vx / sp) * blurLen : 0, sp > 0 ? (-vy / sp) * blurLen : 0);
        m.uA.value = 1;
        // squash on touchdown, the feet kept planted; a small bob of the head afterwards
        const sleek = perched ? 0 : clamp((sp - 8) / 40, 0, 1);
        let sx = size * (1 + 0.06 * sleek), sy = size * (1 - 0.1 * sleek);
        if (perched && b.land !== undefined && f >= b.land) {
          const s = f - b.land;
          const sq = Math.exp(-s / 2.4) * Math.cos(s * 0.9);
          sx = size * (1 + 0.07 * sq);
          sy = size * (1 - 0.1 * sq);
        }
        if (perched) {
          // perch point is under the feet
          b.mesh.position.set(p.x, -(p.y - FEET * sy), 2);
        } else b.mesh.position.set(p.x, -p.y + (0.5 - BODY_V) * size, 2);
        b.mesh.rotation.z = rotZ;
        b.mesh.scale.set(sx, sy, 1);
        if (b.touch && b.land !== undefined) {
          const tm = b.touch.material as THREE.MeshBasicMaterial;
          const e = easeOutCubic(prog(f, b.land, b.land + 9));
          tm.opacity = f >= b.land ? 0.42 * e : 0;
          b.touch.scale.set(lerp(6, 30, e), lerp(2, 7, e), 1);
        }
      }

      renderer.render(scene, camera);
    },
  };
}
