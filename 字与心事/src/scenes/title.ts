// Scene B · 发送 → 字与心事 (6.2–9 s)
// Low angle: the twelve wooden types of the sent line come down face first,
// wet ink on their faces — a true plate, each character cut reversed. Impact: the camera snaps overhead into a
// full-frame ink burst, then pulls back while every drop is gathered, stroke
// order sweeping left to right, into the title. A red thread is pulled from 心.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import cues from "../cues.json";
import { makePost } from "../lib/post";
import { paperCanvas, glyphCell, glowCanvas, toTex } from "../lib/textures";
import { drawText, makeCanvas, sampleTextPoints } from "../lib/glyph";
import { W, H, COLORS, HW, lerp, prog, easeInOutCubic, easeOutCubic, easeInCubic, easeOutExpo, easeOutQuart, mulberry32, clamp, smooth } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";
import { FIRST_LINE } from "./typing";

const T = cues.title;
const LINE = FIRST_LINE;
const TITLE = "字与心事";
const N = 56000;
const FALL0 = 186; // cut from the typing whip

/** ink bounding box of a canvas (alpha > thr), in canvas px */
function inkBox(c: HTMLCanvasElement, thr = 40) {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > thr) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, x1, y0, y1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
}

function woodCanvas(seed: number, w = 512, h = 512, base = [58, 47, 40], soak = 0.42) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(seed);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, w, h);
  // long-grain: wavy darker/lighter lines
  for (let i = 0; i < 140; i++) {
    const y0 = r() * h;
    const amp = 2 + r() * 8;
    const fr = 0.004 + r() * 0.01;
    const ph = r() * 6.28;
    const dark = r() < 0.65;
    ctx.strokeStyle = dark ? `rgba(14,11,10,${0.1 + r() * 0.25})` : `rgba(150,132,116,${0.04 + r() * 0.08})`;
    ctx.lineWidth = 0.6 + r() * 2.4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3.1 + ph * 2) * amp * 0.25;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // pores & ink stains near the face edge
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(10,8,8,${0.05 + r() * 0.12})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
  // years of ink soaked up from the face: dark at the face end, ragged where it stops
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(8,7,8,0.0)");
  g.addColorStop(1 - soak, "rgba(8,7,8,0.0)");
  g.addColorStop(1 - soak * 0.45, "rgba(8,7,8,0.55)");
  g.addColorStop(1, "rgba(8,7,8,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, len = h * soak * (0.3 + r() * 0.7);
    const gg = ctx.createLinearGradient(0, h - len, 0, h);
    gg.addColorStop(0, "rgba(8,7,8,0)");
    gg.addColorStop(1, `rgba(8,7,8,${0.25 + r() * 0.4})`);
    ctx.fillStyle = gg;
    ctx.fillRect(x, h - len, 3 + r() * 14, len);
  }
  return c;
}

export function createTitle(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.paper);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 300);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(-6, 20, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2c0, 2.2);
  rim.position.set(4, 3, -9);
  scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xfff6ea, 2.6);
  bounce.position.set(0.5, -9, 4);
  scene.add(bounce);

  // ---------- paper ----------
  const paperTex = toTex(paperCanvas(3072, 1728, { seed: 12, base: COLORS.paper, fibers: 9000, speck: 2600 }));
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(64, 36), new THREE.MeshBasicMaterial({ map: paperTex }));
  paper.rotation.x = -Math.PI / 2;
  scene.add(paper);

  // ---------- impact splatter: big full-frame splash, revealed by an expanding front ----------
  const SPW = 40, SPH = 24;
  const spl = makeCanvas(4096, 2458);
  {
    const ctx = spl.getContext("2d")!;
    const r = mulberry32(77);
    const px = spl.width / SPW;
    const X = (x: number) => spl.width / 2 + x * px;
    const Y = (z: number) => spl.height / 2 + z * px;
    // light core along the type line (the imprint itself stays readable)
    for (let i = 0; i < 700; i++) {
      const along = (r() - 0.5) * 11.6;
      const ang = r() * Math.PI * 2;
      const dist = 0.5 + Math.pow(r(), 1.4) * 2.4;
      const rad = (0.02 + Math.pow(r(), 3) * 0.14) * (1 - dist / 3.2) * px;
      ctx.fillStyle = `rgba(14,13,15,${0.35 + r() * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(X(along + Math.cos(ang) * dist), Y(Math.sin(ang) * dist * 0.6), Math.max(1, rad * (1 + r())), Math.max(1, rad), ang, 0, Math.PI * 2);
      ctx.fill();
    }
    // radial rays: tapered streaks ending in a droplet, reaching past the frame
    for (let i = 0; i < 200; i++) {
      const along = (r() - 0.5) * 11;
      const ang = Math.atan2((r() - 0.5) * 2, (r() - 0.5) * 2 + along * 0.08);
      const len = 1.5 + Math.pow(r(), 0.8) * 13;
      const w0 = (0.015 + r() * 0.05) * px;
      const x0 = X(along), y0 = Y(0);
      const x1 = x0 + Math.cos(ang) * len * px, y1 = y0 + Math.sin(ang) * len * px * 0.75;
      const steps = 24;
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const x = lerp(x0, x1, t), y = lerp(y0, y1, t);
        const w = w0 * (1 - t * 0.85) * (0.7 + 0.6 * r());
        if (r() < 0.12) continue; // broken streaks
        ctx.fillStyle = `rgba(14,13,15,${0.35 + r() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, w), 0, Math.PI * 2);
        ctx.fill();
      }
      const dr = (0.05 + r() * 0.16) * px;
      ctx.fillStyle = `rgba(14,13,15,${0.6 + r() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(x1, y1, dr * 1.3, dr, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    // far satellite droplets
    for (let i = 0; i < 1800; i++) {
      const ang = r() * Math.PI * 2;
      const dist = 2 + Math.pow(r(), 0.7) * 17;
      const along = (r() - 0.5) * 10;
      const rad = (0.01 + Math.pow(r(), 4) * 0.12) * px;
      ctx.fillStyle = `rgba(14,13,15,${0.4 + r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(X(along + Math.cos(ang) * dist), Y(Math.sin(ang) * dist * 0.62), Math.max(0.7, rad), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const splMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTex: { value: toTex(spl) }, uR: { value: 0 }, uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uR, uA; varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uTex, vUv);
        vec2 p = (vUv - 0.5) * vec2(${SPW.toFixed(1)}, ${SPH.toFixed(1)});
        float d = length(vec2(max(abs(p.x) - 5.6, 0.0), p.y / 0.7));
        float front = smoothstep(uR, uR - 0.6, d);
        gl_FragColor = vec4(t.rgb, t.a * front * uA);
      }`,
  });
  const splat = new THREE.Mesh(new THREE.PlaneGeometry(SPW, SPH), splMat);
  splat.rotation.x = -Math.PI / 2;
  splat.position.y = 0.01;
  scene.add(splat);

  // ---------- printed line at impact (the type's imprint) ----------
  const lineC = drawText(LINE, { font: HW, size: 200, color: "#121114", pad: 0 });
  const lineW = 11.6;
  const lineH = (lineW * lineC.h) / lineC.w;
  const lineMat = new THREE.MeshBasicMaterial({ map: toTex(lineC.canvas), transparent: true, opacity: 0, depthWrite: false });
  const linePlane = new THREE.Mesh(new THREE.PlaneGeometry(lineW, lineH), lineMat);
  linePlane.rotation.x = -Math.PI / 2;
  linePlane.position.y = 0.02;
  scene.add(linePlane);

  // ---------- the forme: tall ink-soaked wooden types locked in a frame, faces down ----------
  // Each type is a tall block; its face carries the character mirrored and raised (阳刻反字),
  // the strokes wet with ink. The whole forme comes down at once, like a press. The faces are
  // cut so that, pressed straight down, they print the line the right way round: seen from
  // above through the wood, each face is exactly its printed character. (On the −y face of
  // the box the canvas maps with its top towards +z, so the glyph is drawn flipped top to
  // bottom here.)
  const TW = lineW / 12, TH = 1.9;
  const woodTex = toTex(woodCanvas(5, 256, 512));
  const woodSide = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.0 });
  const woodTop = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas(9, 256, 256, [62, 50, 42], 0)), roughness: 0.8 });
  const blocks: THREE.Mesh[] = [];
  const blockGeo = new RoundedBoxGeometry(TW * 0.965, TH, TW * 0.965, 2, 0.022);
  const forme = new THREE.Group();
  scene.add(forme);
  [...LINE].forEach((ch, i) => {
    // the face: dark ground, the mirrored character raised and glistening with ink
    const face = makeCanvas(256, 256);
    const fx = face.getContext("2d")!;
    fx.drawImage(woodCanvas(40 + i, 256, 256, [92, 86, 80], 0), 0, 0);
    fx.fillStyle = "rgba(12,10,10,0.18)";
    fx.fillRect(0, 0, 256, 256);
    // ink worn into the cut ground around the strokes
    fx.save();
    fx.translate(0, 256);
    fx.scale(1, -1);
    fx.globalAlpha = 0.35;
    fx.drawImage(glyphCell(ch, 256, { color: "#0a0909", scale: 0.84, blur: 6 }), 0, 0);
    fx.restore();
    fx.strokeStyle = "rgba(10,9,9,0.65)";
    fx.lineWidth = 8;
    fx.strokeRect(0, 0, 256, 256);
    fx.save();
    fx.translate(0, 256);
    fx.scale(1, -1);
    fx.drawImage(glyphCell(ch, 256, { color: "#030304", scale: 0.84 }), 0, 0);
    fx.restore();
    const bump = makeCanvas(256, 256);
    const bx = bump.getContext("2d")!;
    bx.fillStyle = "#000";
    bx.fillRect(0, 0, 256, 256);
    bx.save();
    bx.translate(0, 256);
    bx.scale(1, -1);
    bx.drawImage(glyphCell(ch, 256, { color: "#fff", scale: 0.84, blur: 1.4 }), 0, 0);
    bx.restore();
    // wet strokes are glossy, the cut ground is matt
    const rough = makeCanvas(256, 256);
    const rx = rough.getContext("2d")!;
    rx.fillStyle = "#c8c8c8";
    rx.fillRect(0, 0, 256, 256);
    rx.save();
    rx.translate(0, 256);
    rx.scale(1, -1);
    rx.drawImage(glyphCell(ch, 256, { color: "#1a1a1a", scale: 0.84 }), 0, 0);
    rx.restore();
    const faceMat = new THREE.MeshStandardMaterial({ map: toTex(face), bumpMap: toTex(bump, false), bumpScale: 4.0, roughnessMap: toTex(rough, false), roughness: 1.0, metalness: 0.0 });
    const m = new THREE.Mesh(blockGeo, [woodSide, woodSide, woodTop, faceMat, woodSide, woodSide]);
    m.position.set(-lineW / 2 + (i + 0.5) * TW, TH / 2, 0);
    forme.add(m);
    blocks.push(m);
  });
  // the chase: a dark frame locking the row, set back from the faces
  {
    const frameMat = new THREE.MeshStandardMaterial({ map: toTex(woodCanvas(77, 512, 128, [40, 33, 29], 0.2)), roughness: 0.55 });
    const fw = 0.24, fh = TH * 0.62, len = lineW + 2 * fw;
    for (const zz of [-1, 1]) {
      const bar = new THREE.Mesh(new RoundedBoxGeometry(len, fh, fw, 2, 0.03), frameMat);
      bar.position.set(0, 0.16 + fh / 2, zz * (TW / 2 + fw / 2));
      forme.add(bar);
    }
    for (const xx of [-1, 1]) {
      const bar = new THREE.Mesh(new RoundedBoxGeometry(fw, fh, TW + 2 * fw, 2, 0.03), frameMat);
      bar.position.set(xx * (lineW / 2 + fw / 2), 0.16 + fh / 2, 0);
      forme.add(bar);
    }
  }

  // ---------- title layout: centred on its ink, block sits at the optical centre ----------
  const titleSize = 2.75; // world units per character cell
  const tC = drawText(TITLE, { font: HW, size: 320, color: "#000", pad: 40, letterSpacing: 36 });
  const tBox = inkBox(tC.canvas);
  const pxToU = titleSize / 320;
  const TITLE_Z = -0.17; // ink centre of the title (top-down: -z is up the frame)
  const charPos: { x: number; z: number }[] = [];
  {
    let x = tC.pad;
    [...TITLE].forEach((_, ci) => {
      const adv = tC.widths[ci];
      charPos.push({ x: (x + adv / 2 - tBox.cx) * pxToU, z: TITLE_Z + (tC.h / 2 + 320 * 0.04 - tBox.cy) * pxToU });
      x += adv + 36;
    });
  }
  // per-character targets sampled from the same glyph cells used for the crisp title
  const targets = new Float32Array(N * 3);
  const isRed = new Float32Array(N);
  const order = new Float32Array(N); // 0..1 writing order
  {
    const per = N / 4;
    const r = mulberry32(900);
    [...TITLE].forEach((ch, ci) => {
      const cv = glyphCell(ch, 512, { color: "#000", scale: 1.0 });
      const d = cv.getContext("2d")!.getImageData(0, 0, 512, 512).data;
      const pts: number[] = [];
      for (let y = 0; y < 512; y += 2) for (let xx = 0; xx < 512; xx += 2) if (d[(y * 512 + xx) * 4 + 3] > 140) pts.push(xx, y);
      const m = pts.length / 2;
      for (let k = 0; k < per; k++) {
        const i = ci * per + k;
        const j = Math.floor(r() * m);
        const px = pts[j * 2] + (r() - 0.5) * 2, py = pts[j * 2 + 1] + (r() - 0.5) * 2;
        targets[i * 3] = charPos[ci].x + (px / 512 - 0.5) * titleSize;
        targets[i * 3 + 1] = 0.03;
        targets[i * 3 + 2] = charPos[ci].z + (py / 512 - 0.5) * titleSize;
        isRed[i] = ci >= 2 ? 1 : 0;
        // brush order: character by character, top-left to bottom-right within
        order[i] = ci * 2.0 + 8 * ((px / 512) * 0.45 + (py / 512) * 0.55); // frames after T.converge
      }
    });
  }
  const starts = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const delays = new Float32Array(N);
  const seeds = new Float32Array(N);
  const launch = new Float32Array(N);
  {
    const lp = sampleTextPoints(LINE, N, { font: HW, size: 200, pad: 0 }, 41);
    const s = lineW / lineC.w;
    const r = mulberry32(5);
    for (let i = 0; i < N; i++) {
      const x = lp.points[i * 2] * s;
      const z = -lp.points[i * 2 + 1] * s;
      starts[i * 3] = x;
      starts[i * 3 + 1] = 0.03;
      starts[i * 3 + 2] = z;
      // stippled rays fanning out of the type row; a few drops leap at the lens
      const K = 84;
      const ray = Math.floor(r() * K);
      const ang = ((ray + 0.5) / K) * Math.PI * 2 + (r() - 0.5) * 0.035;
      const sp = 4 + Math.pow(r(), 1.15) * 30;
      const up = r() < 0.035;
      vel[i * 3] = Math.cos(ang) * sp * 1.25 + x * 0.35;
      vel[i * 3 + 1] = up ? 8 + r() * 8 : 0.4 + r() * 3;
      vel[i * 3 + 2] = Math.sin(ang) * sp * 0.75;
      const big = up || r() < 0.02;
      sizes[i] = big ? 5 + r() * 9 : 0.9 + Math.pow(r(), 2.5) * 2.6;
      delays[i] = order[i] + r() * 1.5;
      seeds[i] = r();
      launch[i] = r() < 0.45 ? r() * 3.0 : 0.0;
    }
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(starts, 3));
  pGeo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
  pGeo.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  pGeo.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  pGeo.setAttribute("aRed", new THREE.BufferAttribute(isRed, 1));
  pGeo.setAttribute("aLaunch", new THREE.BufferAttribute(launch, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uF: { value: 0 },
      uImpact: { value: T.impact },
      uConv: { value: T.converge },
      uDur: { value: 16 },
      uFade: { value: 0 },
      uInk: { value: new THREE.Color(COLORS.ink) },
      uRed: { value: new THREE.Color(COLORS.vermilion) },
      uScale: { value: H / (2 * Math.tan((30 * Math.PI) / 360)) },
      uRes: { value: new THREE.Vector2(W, H) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aVel; attribute vec3 aTarget; attribute float aSize; attribute float aDelay; attribute float aSeed; attribute float aRed; attribute float aLaunch;
      uniform float uF, uImpact, uConv, uDur, uScale; uniform vec2 uRes;
      varying float vRed; varying float vAlpha; varying vec2 vDir; varying float vLen; varying float vSz;
      vec3 burst(float t){
        float k = 3.2;
        vec3 p = position;
        p.xz += aVel.xz * (1.0 - exp(-k * t)) / k;
        float y = aVel.y * t - 0.5 * 30.0 * t * t;
        p.y = max(0.03, 0.03 + y);
        return p;
      }
      vec3 at(float f){
        float t = max(0.0, (f - uImpact - aLaunch) / 30.0);
        float tc = max(0.0, (uConv + aDelay - uImpact - aLaunch) / 30.0);
        float u = clamp((f - uConv - aDelay) / uDur, 0.0, 1.0);
        // drops roll in across the paper and slow as they pool into the strokes
        float e = 1.0 - pow(1.0 - u, 2.6);
        e = mix(e, u * u * (3.0 - 2.0 * u), 0.35);
        vec3 pb = burst(min(t, tc));
        pb.y = mix(pb.y, 0.03, smoothstep(0.0, 0.35, u));
        vec3 dlt = aTarget - pb;
        vec3 mid = mix(pb, aTarget, 0.5) + vec3(-dlt.z, 0.0, dlt.x) * (aSeed - 0.5) * 0.28;
        vec3 a = mix(pb, mid, e);
        vec3 b = mix(mid, aTarget, e);
        return f < uImpact ? position : mix(a, b, e);
      }
      void main(){
        vec3 p = at(uF);
        vec3 pPrev = at(uF - 0.38);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 c0 = projectionMatrix * mv;
        vec4 c1 = projectionMatrix * modelViewMatrix * vec4(pPrev, 1.0);
        vec2 s0 = c0.xy / c0.w * 0.5 * uRes;
        vec2 s1 = c1.xy / c1.w * 0.5 * uRes;
        vec2 mvec = s0 - s1;
        float u = clamp((uF - uConv - aDelay) / uDur, 0.0, 1.0);
        float sz = mix(aSize, min(aSize, 1.9), smoothstep(0.0, 0.8, u)) * (uScale / -mv.z) * 0.0105;
        // a drop, never a thread: the trail is capped (longer only in the first burst)
        float len = min(length(mvec), u > 0.0 ? sz * 1.1 + 1.5 : sz * 4.0 + 4.0);
        vLen = len; vSz = sz;
        vDir = len > 0.001 ? mvec / len : vec2(1.0, 0.0);
        gl_PointSize = min(sz + len, 220.0);
        gl_Position = c0;
        vRed = aRed * smoothstep(0.72, 1.0, u);
        // near-lens drops fade before they fill the screen
        vAlpha = uF < uImpact + aLaunch ? 0.0 : (1.0 - smoothstep(60.0, 160.0, sz)) * (1.0 - 0.85 * smoothstep(0.7, 1.0, u));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk, uRed; uniform float uFade;
      varying float vRed; varying float vAlpha; varying vec2 vDir; varying float vLen; varying float vSz;
      void main(){
        // capsule along the screen-space motion: a streak while fast, a drop at rest
        vec2 pc = (gl_PointCoord - 0.5) * (vSz + vLen);
        pc.y = -pc.y;
        float along = dot(pc, vDir);
        float across = dot(pc, vec2(-vDir.y, vDir.x));
        float h = vLen * 0.5;
        float d = length(vec2(max(abs(along) - h, 0.0), across)) / max(vSz * 0.5, 0.5);
        float a = smoothstep(1.0, 0.62, d) * vAlpha * (1.0 - uFade);
        a *= mix(1.0, 0.7, clamp(vLen / (vSz * 6.0 + 1.0), 0.0, 1.0));
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uInk, uRed, vRed), a * 0.95);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  // crisp title: revealed through a grainy ink-seep mask as the drops arrive
  const titleGroup = new THREE.Group();
  const charMats: THREE.ShaderMaterial[] = [];
  [...TITLE].forEach((ch, ci) => {
    const color = new THREE.Color(ci >= 2 ? COLORS.vermilion : COLORS.ink);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: toTex(glyphCell(ch, 512, { color: "#fff", scale: 1.0 }), false) }, uP: { value: 0 }, uCol: { value: color }, uSeed: { value: ci * 3.7 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uP, uSeed; uniform vec3 uCol; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float a = texture2D(uTex, vUv).a;
          float g = 0.55 * n(vUv * 9.0) + 0.3 * n(vUv * 23.0) + 0.15 * n(vUv * 61.0);
          float sweep = (vUv.x * 0.45 + (1.0 - vUv.y) * 0.55);
          float v = g * 0.6 + sweep * 0.4;
          float th = uP * 1.25 - 0.12;
          float m = 1.0 - smoothstep(th - 0.06, th + 0.06, v);
          gl_FragColor = vec4(uCol, a * m);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(titleSize, titleSize), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(charPos[ci].x, 0.04, charPos[ci].z);
    titleGroup.add(mesh);
    charMats.push(m);
  });
  scene.add(titleGroup);

  // subtitle + vermilion rule, centred on the subtitle's ink
  const subC = drawText("从落笔，到有人读懂", { font: HW, size: 120, color: "#3a3836", letterSpacing: 34, pad: 24 });
  const sBox = inkBox(subC.canvas);
  const subH = 0.6;
  const subU = subH / subC.h;
  const SUB_Z = TITLE_Z + 2.01;
  const subMat = new THREE.MeshBasicMaterial({ map: toTex(subC.canvas), transparent: true, opacity: 0, depthWrite: false });
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(subC.w * subU, subH), subMat);
  sub.rotation.x = -Math.PI / 2;
  sub.position.set((subC.w / 2 - sBox.cx) * subU, 0.04, SUB_Z + (sBox.cy - subC.h / 2) * subU);
  scene.add(sub);
  const rule = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.035), new THREE.MeshBasicMaterial({ color: COLORS.vermilion, transparent: true, opacity: 0 }));
  rule.rotation.x = -Math.PI / 2;
  rule.position.set(0, 0.04, SUB_Z + 0.52);
  scene.add(rule);

  // ---------- the red thread pulled from 心 ----------
  const xin = titleGroup.children[2].position.clone();
  const threadMat = new THREE.MeshStandardMaterial({ color: COLORS.vermilion, emissive: new THREE.Color(COLORS.vermilion), emissiveIntensity: 0.35, roughness: 0.4 });
  const thread = new THREE.Mesh(new THREE.BufferGeometry(), threadMat);
  scene.add(thread);
  const xinGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "255,70,55", 0.4)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  xinGlow.rotation.x = -Math.PI / 2;
  xinGlow.position.set(xin.x, 0.05, xin.z);
  scene.add(xinGlow);

  const post = makePost(renderer, scene, camera, { bloom: [0.3, 0.4, 0.95] });
  post.finish.uniforms.uVignette.value = 0.2;
  post.finish.uniforms.uGrain.value = 0.02;
  post.finish.uniforms.uCA.value = 0.0006;

  const CAM_Y_END = 19.2;
  const CAM_Z = 0.55;

  return {
    render(f: number) {
      const fallT = prog(f, FALL0, T.impact);
      if (f < T.impact) {
        // ---------- low angle: the types come down at us, faces first ----------
        // seen from the foot of the printed line (+z): the faces tip towards us with the head
        // of each character away from us, so the plate reads left to right with every character
        // standing on its head (the same true plate as seen from its other side); pressed
        // straight down it prints 掂量情思敲字句，轻顿指尖 the right way round
        const e = easeInCubic(fallT);
        camera.up.set(0, 1, 0);
        camera.position.set(lerp(-0.4, -0.1, fallT), lerp(0.75, 0.42, e), lerp(14.2, 11.8, fallT));
        camera.lookAt(lerp(0.2, 0.05, fallT), lerp(2.45, 0.55, e), 0);
        // the forme drops, faces tilted to the lens, levelling as it meets the paper
        forme.visible = true;
        const ee = easeInCubic(fallT);
        forme.position.set(0.12, lerp(2.7, 0, ee), lerp(0.8, 0, ee));
        forme.rotation.set(lerp(-0.95, 0, smooth(fallT)), lerp(0.05, 0, fallT), lerp(-0.035, 0, fallT));
      } else {
        // ---------- overhead: burst fills the frame, then pull back while it gathers ----------
        const settle = easeOutQuart(prog(f, T.impact, T.lock + 6));
        let camY = lerp(12.5, CAM_Y_END, settle) - 0.9 * easeInOutCubic(prog(f, T.lock, T.end));
        let shake = 0.3 * Math.exp(-(f - T.impact) / 3.5) + (f >= T.lock ? 0.06 * Math.exp(-(f - T.lock) / 3) : 0);
        const pan = easeInCubic(prog(f, T.pull + 5, T.end));
        camera.up.set(0, 0, -1);
        camera.position.set(Math.sin(f * 1.7) * shake + pan * 26, camY, CAM_Z + Math.cos(f * 2.3) * shake);
        camera.lookAt(camera.position.x, 0, CAM_Z + Math.cos(f * 2.3) * shake * 0.5);
        camera.rotateZ(lerp(0.035, 0, settle)); // v4.5: and it settles level (v4.4: −0.46°, the title's right end 8 px high)
        forme.visible = false; // the types vanish into their own ink
      }

      // ---------- ink ----------
      lineMat.opacity = f >= T.impact ? 1 - prog(f, T.impact + 1, T.impact + 4) : 0;
      const sp = prog(f, T.impact, T.impact + 7);
      splMat.uniforms.uR.value = f >= T.impact ? 0.5 + 22 * easeOutExpo(sp) : 0;
      splMat.uniforms.uA.value = f >= T.impact ? 0.9 * (1 - easeInOutCubic(prog(f, T.converge - 4, T.lock - 6))) : 0;
      pMat.uniforms.uF.value = f;
      pMat.uniforms.uFade.value = easeInOutCubic(prog(f, T.lock + 1, T.lock + 10));
      points.visible = f >= T.impact && f < T.lock + 11;

      // ---------- title: each character seeps in as its drops land ----------
      charMats.forEach((m, ci) => {
        const a0 = T.converge + 2 * ci + 11;
        m.uniforms.uP.value = smooth(prog(f, a0, a0 + 15));
      });
      const tsc = 1 + 0.04 * (1 - easeOutExpo(prog(f, T.lock, T.lock + 8)));
      titleGroup.scale.set(tsc, 1, tsc);
      const subIn = easeOutCubic(prog(f, T.subtitle, T.subtitle + 14));
      subMat.opacity = subIn;
      sub.scale.set(lerp(1.06, 1, subIn), 1, 1);
      const ruleIn = easeOutCubic(prog(f, T.subtitle + 6, T.subtitle + 18));
      (rule.material as THREE.MeshBasicMaterial).opacity = ruleIn;
      rule.scale.x = lerp(0.01, 2.2, ruleIn);

      // ---------- thread ----------
      const pull = prog(f, T.pull, T.end);
      thread.visible = f >= T.pull;
      if (thread.visible) {
        const lane = xin.z + 1.75;
        const head = new THREE.Vector3(xin.x + 1.5 + easeInCubic(pull) * 36, 1.2 + Math.sin(pull * Math.PI) * 1.6, lane);
        const pts = [
          new THREE.Vector3(xin.x - 0.05, 0.05, xin.z + 0.05),
          new THREE.Vector3(xin.x + 0.1, 0.5 + pull * 0.5, xin.z + 0.9),
          new THREE.Vector3(xin.x + 0.9, 0.9 + pull, lane),
          new THREE.Vector3(lerp(xin.x + 2.2, head.x - 4, 0.65), 1.1 + pull * 1.2, lane),
          head,
        ];
        const curve = new THREE.CatmullRomCurve3(pts);
        thread.geometry.dispose();
        thread.geometry = new THREE.TubeGeometry(curve, 80, 0.045, 8, false);
      }
      (xinGlow.material as THREE.MeshBasicMaterial).opacity = f >= T.pull ? 0.7 * Math.sin(Math.PI * prog(f, T.pull, T.end)) : 0;

      // ---------- post ----------
      post.finish.uniforms.uSeed.value = f;
      const fallBlur = f < T.impact ? 0.05 * easeInCubic(fallT) : 0;
      post.finish.uniforms.uBlur.value.set(0.16 * easeInCubic(prog(f, T.pull + 5, T.end)), fallBlur);
      post.finish.uniforms.uFlash.value = f >= T.impact ? 0.95 * Math.exp(-(f - T.impact) / 2.4) : 0;
      post.finish.uniforms.uFade.value = 0;
      post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
