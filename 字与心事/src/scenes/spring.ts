// Scene E · 与君南北不同春。 (22–26 s)
// The sheet parts at a fold into two windows at the same minute. South (left, his side):
// 杏花春雨 — apricot in full bloom under a warm lamp, a fine drizzle, petals coming down.
// North (right, hers): a bare peach bough with only buds, cold moonlight, a little wind,
// old snow on the limbs and a few flakes blowing. The poem is set on the fold, lit by both.
import * as THREE from "three";
import cues from "../cues.json";
import { makeCanvas } from "../lib/glyph";
import { toTex, glowCanvas, paperCanvas } from "../lib/textures";
import { southBranchCanvas, northBranchCanvas, growthMap } from "../lib/branches";
import { HW } from "../lib/util";
import { glyphInk } from "../lib/ink";
import { W, H, lerp, prog, smooth, easeOutCubic, easeInOutCubic, easeInCubic, mulberry32, clamp } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";

const E = cues.spring;
const SEAM = W / 2;
/** the poem's column on the fold (Video.tsx sets the DOM glyphs with the same numbers). Its ink — 与 at
 *  the top to the 。 at the foot, each glyph's ink centred on its row — is centred between the frame's top
 *  and the credit's ink top (y = 1004), and 2 px lower, as the user asked (v4.0). v4.5: worked out from the
 *  glyphs' outlines (lib/ink): the ink's centre is yCenter + (h。 − h与) / 4, h a glyph's ink height. v4.0–
 *  v4.4 wrote in 515, found by measuring frames (v3.1: 513), which on the exact outlines is 0.57 px high */
const COL_TEXT = "与君南北不同春。", COL_SIZE = 82, COL_STEP = 100;
const inkH = (ch: string) => {
  const g = glyphInk(ch, COL_SIZE);
  return g.b - g.t;
};
export const SPRING_COL = {
  x: 960,
  yCenter: 1004 / 2 + 2 - (inkH(COL_TEXT[COL_TEXT.length - 1]) - inkH(COL_TEXT[0])) / 4,
  size: COL_SIZE,
  step: COL_STEP,
};
/** what each glyph of the column is gathered from: L = petals (the south), R = snow (the north) */
export const SPRING_GATHER: { ch: string; at: number; sides: "LR" | "L" | "R"; wall?: boolean }[] = [
  { ch: "与", at: E.yujun, sides: "LR" },
  { ch: "君", at: E.yujun + 6, sides: "LR" },
  { ch: "南", at: E.nan, sides: "L" },
  { ch: "北", at: E.bei, sides: "R" },
  { ch: "不", at: E.butong, sides: "LR", wall: true },
  { ch: "同", at: E.butong + 6, sides: "LR", wall: true },
];

const VERT = `varying vec2 vUv; varying vec2 vPx; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vPx = vec2(w.x, -w.y); gl_Position = projectionMatrix * viewMatrix * w; }`;

export function createSpring(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ece9e1");
  const camera = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
  const root = new THREE.Group();
  scene.add(root);
  // the same sheet the sparrows were on (same fibres, same lamp falloff), so the cut is a fold, not a flash
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.2, H * 1.2), new THREE.MeshBasicMaterial({ map: toTex(paperCanvas(2304, 1296, { seed: 52, base: "#ece9e1", fibers: 7000, speck: 2200 })), depthWrite: false }));
  sheet.position.set(W / 2, -H / 2, -9);
  scene.add(sheet);
  const sheetVig = makeCanvas(512, 288);
  {
    const ctx = sheetVig.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 130, 40, 256, 144, 330);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(40,36,34,0.32)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 288);
  }
  const sheetVigMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: toTex(sheetVig), transparent: true, depthWrite: false }));
  sheetVigMesh.position.set(W / 2, -H / 2, -8);
  scene.add(sheetVigMesh);
  const uT = { value: 0 };
  const uReveal = { value: 0 };
  const uLip = { value: 0 }; // v4.0: the fold's lit lip flares where 不同 are thrown back off it

  // ---------- backdrops ----------
  const panel = (left: boolean) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uT, uReveal, uLip, uLeft: { value: left ? 1 : 0 } },
      vertexShader: VERT,
      fragmentShader: `uniform float uT, uReveal, uLip, uLeft; varying vec2 vUv; varying vec2 vPx;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec2 p = vPx;
          vec3 c;
          if (uLeft > 0.5) {
            // south: a lamp-warm room behind rain
            c = mix(vec3(0.14, 0.095, 0.075), vec3(0.23, 0.145, 0.095), smoothstep(0.0, 1080.0, p.y));
            float lamp = exp(-pow(length((p - vec2(120.0, 840.0)) / vec2(620.0, 520.0)), 2.0));
            c += vec3(0.6, 0.33, 0.13) * lamp * 0.68;
            // the room's light spills up behind the wet leaves, so they read against it
            float room = exp(-pow(length((p - vec2(420.0, 560.0)) / vec2(820.0, 640.0)), 2.0));
            c += vec3(0.32, 0.17, 0.07) * room * 0.32;
            // v4.0: the lamp's warmth kept, its saturation taken down to the midnight fold's
            // (measured: v3.1 south 161/93/48, midnight south 103/83/68)
            float lum = dot(c, vec3(0.299, 0.587, 0.114));
            c = mix(vec3(lum), c, 0.42);
          } else {
            // north: cold, clear, moonlit
            c = mix(vec3(0.05, 0.075, 0.12), vec3(0.09, 0.12, 0.17), smoothstep(0.0, 1080.0, p.y));
            float moon = exp(-pow(length((p - vec2(1760.0, 140.0)) / vec2(700.0, 560.0)), 2.0));
            c += vec3(0.32, 0.4, 0.52) * moon * 0.5;
            float star = step(0.9985, h(floor(p / 3.0))) * smoothstep(620.0, 80.0, p.y) * (0.6 + 0.4 * sin(uT * 3.0 + h(floor(p / 3.0) + 3.0) * 30.0));
            c += vec3(0.8, 0.85, 0.95) * star;
          }
          float d = abs(p.x - ${SEAM.toFixed(1)});
          float shown = smoothstep(uReveal * 980.0 + 2.0, uReveal * 980.0 - 2.0, d);
          // the fold: a dark crease with a lit lip
          c *= 1.0 - 0.35 * exp(-d * d / 180.0);
          c += vec3(0.5, 0.48, 0.45) * exp(-pow(d - 1.5, 2.0) / 1.2) * (0.35 + uLip);
          c += vec3(0.42, 0.4, 0.38) * exp(-d / 14.0) * uLip * 0.35;
          gl_FragColor = vec4(c, shown);
        }`,
    });
  const L = new THREE.Mesh(new THREE.PlaneGeometry(SEAM + 40, H + 80), panel(true));
  L.position.set((SEAM + 40) / 2 - 40, -H / 2, 0);
  const R = new THREE.Mesh(new THREE.PlaneGeometry(SEAM + 40, H + 80), panel(false));
  R.position.set(SEAM + (SEAM + 40) / 2, -H / 2, 0);
  root.add(L, R);

  // ---------- south: an apricot bough in full bloom, wet ----------
  const southC = southBranchCanvas(true);
  const southTex = toTex(southC);
  // v4.0: each bough is painted in from its root at the frame's edge towards the fold, the way a
  // brush draws it — limbs first, flowers and buds opening as the growth reaches them (uGrow 0…1
  // against a map of when each part grows, lib/branches growthMap)
  const sway = (tex: THREE.Texture, dir: number, grow: { value: number }, growTex: THREE.Texture) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: tex }, uT, uReveal, uDir: { value: dir }, uGrow: grow, uGrowTex: { value: growTex } },
      vertexShader: VERT,
      fragmentShader: `uniform sampler2D uTex, uGrowTex; uniform float uT, uReveal, uDir, uGrow; varying vec2 vUv; varying vec2 vPx;
        void main(){
          vec2 uv = vUv;
          float far = uDir > 0.0 ? uv.x : 1.0 - uv.x;
          // the south bough hangs heavy and wet; the bare north one is worked by the wind in gusts
          float amp = uDir > 0.0 ? 1.0 : 1.9 * (0.65 + 0.35 * sin(uT * 0.8) * sin(uT * 2.1 + 1.3));
          uv.y += sin(uT * 1.3 + uv.x * 4.0) * 0.004 * far * amp;
          uv.x += sin(uT * 0.9 + uv.y * 3.0) * 0.003 * far * amp;
          vec4 t = texture2D(uTex, uv);
          float when = texture2D(uGrowTex, uv).r;
          float grown = smoothstep(when - 0.012, when + 0.012, uGrow * 1.03 - 0.015);
          float d = abs(vPx.x - ${SEAM.toFixed(1)});
          float shown = smoothstep(uReveal * 980.0 + 2.0, uReveal * 980.0 - 2.0, d);
          gl_FragColor = vec4(t.rgb, t.a * shown * grown);
        }`,
    });
  const growS = { value: 0 }, growN = { value: 0 };
  const southBranch = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1160), sway(southTex, 1, growS, toTex(growthMap("south"))));
  southBranch.position.set(550 - 80, -580 + 20, 1);
  root.add(southBranch);

  // a fine spring drizzle over the south window, seen where the lamp catches it
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT, uReveal },
    vertexShader: VERT,
    fragmentShader: `uniform float uT, uReveal; varying vec2 vUv; varying vec2 vPx;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        vec2 p = vPx;
        float a = 0.0;
        for (int L = 0; L < 3; L++) {
          float fl = float(L);
          float cw = 9.0 + fl * 6.0;
          float speed = 760.0 + fl * 260.0;
          // slanting down to the right, with the breeze that carries the petals (v3 leaned the
          // other way, and — the phase ran with +uT — every streak climbed the screen)
          vec2 q = p - vec2(p.y * 0.08, 0.0);
          float col = floor(q.x / cw);
          float ph = h(col * 13.1 + fl * 7.0);
          // y runs from a streak's top (0) to its head (len); the head falls, so the phase subtracts time
          float y = mod(p.y - uT * speed + ph * 1200.0, 1200.0);
          float len = 20.0 + fl * 14.0;
          float xin = abs(fract(q.x / cw) - 0.5) * cw;
          // brightest at the falling head, a crisp lower end, the tail thinning upwards
          float streak = smoothstep(0.7 + fl * 0.22, 0.0, xin) * smoothstep(len, len - 6.0, y) * smoothstep(0.0, len * 0.65, y);
          a += streak * (0.21 + fl * 0.1) * step(0.42, h(col * 3.7 + fl));
        }
        float lit = 0.5 + 0.9 * exp(-pow(length((p - vec2(160.0, 820.0)) / vec2(720.0, 620.0)), 2.0));
        float d = abs(p.x - ${SEAM.toFixed(1)});
        float shown = smoothstep(uReveal * 980.0 + 2.0, uReveal * 980.0 - 2.0, d) * smoothstep(${SEAM.toFixed(1)}, ${(SEAM - 20).toFixed(1)}, p.x);
        gl_FragColor = vec4(vec3(0.93, 0.87, 0.79), clamp(a * lit, 0.0, 1.0) * shown * 0.85);
      }`,
  });
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(SEAM, H), rainMat);
  rain.position.set(SEAM / 2, -H / 2, 2);
  root.add(rain);

  // ---------- north: a bare peach bough, buds only, old snow ----------
  const northC = northBranchCanvas(true);
  const northBranch = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1160), sway(toTex(northC), -1, growN, toTex(growthMap("north"))));
  northBranch.position.set(SEAM + 550 - 60, -580 + 20, 1);
  root.add(northBranch);

  // drifting particles drawn as round or petal-shaped sprites, each with its own size and turn
  const drift = (n: number, seed: number, sprite: HTMLCanvasElement, init: (r: () => number) => { x: number; y: number; s: number; ph: number; sp: number }) => {
    const r = mulberry32(seed);
    const items = Array.from({ length: n }, () => init(r));
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), size = new Float32Array(n), turn = new Float32Array(n);
    items.forEach((it, i) => (size[i] = it.s));
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aTurn", new THREE.BufferAttribute(turn, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: toTex(sprite) }, uOp: { value: 0 } },
      vertexShader: `attribute float aSize; attribute float aTurn; varying float vTurn; varying vec2 vPx;
        void main(){ vTurn = aTurn; vec4 w = modelMatrix * vec4(position, 1.0); vPx = vec2(w.x, -w.y); gl_Position = projectionMatrix * viewMatrix * w; gl_PointSize = aSize; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOp; varying float vTurn; varying vec2 vPx;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float cs = cos(vTurn), sn = sin(vTurn);
          vec2 uv = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y) + 0.5;
          vec4 t = texture2D(uTex, uv);
          gl_FragColor = vec4(t.rgb, t.a * uOp);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    return { items, pos, turn, geo, mat };
  };
  // south: apricot petals, wet and heavy, brought down by the drizzle
  const petalC = makeCanvas(64, 64);
  {
    const ctx = petalC.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 40, 2, 32, 32, 26);
    g.addColorStop(0, "rgba(236,150,160,0.95)");
    g.addColorStop(0.5, "rgba(252,232,230,0.95)");
    g.addColorStop(1, "rgba(255,242,238,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 32, 24, 17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const petals = drift(30, 8, petalC, (r) => ({ x: 40 + r() * (SEAM - 120), y: r() * 1100, s: 12 + r() * 10, ph: r() * 6.28, sp: 80 + r() * 60 }));
  // north: a few flakes of old snow blown off the boughs
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
  const flakes = drift(34, 18, flakeC, (r) => ({ x: SEAM + 40 + r() * (W - SEAM + 300), y: r() * 1100, s: 4 + r() * 6, ph: r() * 6.28, sp: 26 + r() * 30 }));

  // window light spilling across the fold, both sides
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "236,182,136", 0.4)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  warm.position.set(SEAM - 160, -560, 3);
  const cold = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "150,185,235", 0.4)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  cold.position.set(SEAM + 160, -560, 3);
  root.add(warm, cold);

  // ---------- v4.0: 与君南北不同春 is gathered out of the two springs ----------
  // Each glyph of the column stands on the fold and is drawn twice, warm left of it and cold right
  // of it (Vertical.tsx). Its left half gathers out of apricot petals blown in from beyond the left
  // edge of the frame, its right half out of snow from beyond the right edge; neither ever crosses
  // the fold. 南 comes of petals alone and 北 of snow alone (their other halves seep in after),
  // and at 不同 both rush the fold and are thrown back off it. 春 lands with a burst of both.
  type Mote = { kind: 0 | 1; tx: number; ty: number; sx: number; sy: number; cx: number; cy: number; t0: number; t1: number; size: number; rot: number; spin: number; wall: boolean };
  const motes: Mote[] = [];
  const gr = mulberry32(735);
  const col0 = SPRING_COL.yCenter - ((8 - 1) / 2) * SPRING_COL.step;
  const inkOf = (ch: string, cy: number) => {
    const S = SPRING_COL.size;
    const c = makeCanvas(S * 2, S * 2);
    const ctx = c.getContext("2d")!;
    ctx.font = `400 ${S}px ${HW}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";
    ctx.fillText(ch, S * 0.5, S * 1.4);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const pts: [number, number][] = [];
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (d[(y * c.width + x) * 4 + 3] > 150) {
        pts.push([x, y]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; // the column centres every glyph's ink on (960, cy)
    return pts.map(([x, y]) => ({ x: SPRING_COL.x + (x - mx), y: cy + (y - my) }));
  };
  SPRING_GATHER.forEach((g, gi) => {
    const cy = col0 + gi * SPRING_COL.step;
    const pts = inkOf(g.ch, cy);
    for (const p of pts) {
      const left = p.x < SEAM;
      if ((left && !g.sides.includes("L")) || (!left && !g.sides.includes("R"))) continue;
      if (gr() > 0.34) continue; // about one mote for every 12 px² of ink
      const kind: 0 | 1 = left ? 0 : 1;
      const sx = left ? -60 - gr() * 260 : W + 60 + gr() * 260;
      const sy = clamp(p.y + (gr() - 0.5) * 900, -120, H + 120);
      // the wind bends every path: petals sweep in under, snow comes over the top
      const bend = (left ? 1 : -1) * (120 + gr() * 260);
      const t1 = g.at - 3 + Math.floor(gr() * 6);
      const t0 = Math.max(E.start + 1 + Math.floor(gr() * 4), t1 - (16 + Math.floor(gr() * 12)));
      motes.push({
        kind, tx: p.x, ty: p.y, sx, sy,
        cx: (sx + p.x) / 2 + bend * 0.3, cy: (sy + p.y) / 2 + bend,
        t0, t1, size: kind === 0 ? 8 + gr() * 6 : 4 + gr() * 4, rot: gr() * 6.28, spin: (gr() - 0.5) * 0.5, wall: !!g.wall,
      });
    }
  });
  // 春: the two springs burst off it, each to its own side
  type Spark = { kind: 0 | 1; x: number; y: number; vx: number; vy: number; size: number; rot: number; spin: number };
  const sparks: Spark[] = [];
  {
    const cy = col0 + 6 * SPRING_COL.step;
    for (let i = 0; i < 150; i++) {
      const kind: 0 | 1 = i % 2 ? 1 : 0;
      const ang = (gr() - 0.5) * 1.9;
      const sp = 9 + Math.pow(gr(), 0.6) * 20;
      sparks.push({
        kind, x: SEAM + (kind ? 1 : -1) * (2 + gr() * 34), y: cy + (gr() - 0.5) * 70,
        vx: (kind ? 1 : -1) * Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 3,
        size: kind === 0 ? 8 + gr() * 6 : 4 + gr() * 4, rot: gr() * 6.28, spin: (gr() - 0.5) * 0.6,
      });
    }
  }
  const sprites = (n: number, sprite: HTMLCanvasElement) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), size = new Float32Array(n), turn = new Float32Array(n), alpha = new Float32Array(n);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aTurn", new THREE.BufferAttribute(turn, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: toTex(sprite) } },
      vertexShader: `attribute float aSize; attribute float aTurn; attribute float aAlpha; varying float vTurn; varying float vA;
        void main(){ vTurn = aTurn; vA = aAlpha; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_PointSize = aSize; }`,
      fragmentShader: `uniform sampler2D uTex; varying float vTurn; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float cs = cos(vTurn), sn = sin(vTurn);
          vec4 t = texture2D(uTex, vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y) + 0.5);
          gl_FragColor = vec4(t.rgb, t.a * vA);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts); // in the frame, not on the slowly zooming sheet: they land on the DOM glyphs
    return { pos, size, turn, alpha, geo };
  };
  const nP = motes.filter((m) => m.kind === 0).length + sparks.filter((m) => m.kind === 0).length;
  const nS = motes.length + sparks.length - nP;
  const gP = sprites(nP, petalC), gS = sprites(nS, flakeC);

  return {
    render(f: number) {
      const T = f / 30;
      uT.value = T;
      // boughs: the south one first and faster, the bare north one after it
      growS.value = smooth(prog(f, E.start + 2, E.nan + 4));
      growN.value = smooth(prog(f, E.start + 6, E.bei + 4));
      // the fold's lip where 不 and 同 strike it: v5.6, no flare any more (v4.0–v5.5: 0.55 at 不 and again at
      // 同, 0.2 s apart, each gone in 0.1 s — it read as the line flickering twice; the user: "它弹开是春的时候再
      // 弹开，中间的逻辑关联性不是很强，你干脆都别闪了"). The lip keeps its steady light (0.35 in the shader)
      uLip.value = 0;
      // motes and sparks
      let iP = 0, iS = 0;
      const put = (kind: 0 | 1, x: number, y: number, size: number, turn: number, a: number) => {
        const g = kind === 0 ? gP : gS;
        const i = kind === 0 ? iP++ : iS++;
        g.pos[i * 3] = x;
        g.pos[i * 3 + 1] = -y;
        g.pos[i * 3 + 2] = 6;
        g.size[i] = size;
        g.turn[i] = turn;
        g.alpha[i] = a;
      };
      for (const m of motes) {
        let x = m.tx, y = m.ty, a = 0, size = m.size;
        if (f >= m.t0) {
          const u = clamp((f - m.t0) / Math.max(1, m.t1 - m.t0));
          const e = 1 - Math.pow(1 - u, 2.6);
          const q = 1 - e;
          x = q * q * m.sx + 2 * q * e * m.cx + e * e * m.tx;
          y = q * q * m.sy + 2 * q * e * m.cy + e * e * m.ty;
          a = smooth(prog(f, m.t0, m.t0 + 4));
          if (f > m.t1) {
            const k = f - m.t1;
            if (m.wall) {
              // thrown back off the fold: a spring that never lets it across
              const toward = m.kind === 0 ? 1 : -1;
              x += toward * 16 * Math.exp(-k / 2.6) * Math.cos(k * 1.25);
            }
            a *= 1 - smooth(clamp(k / 7));
            size *= 1 - 0.35 * clamp(k / 7);
          }
          if (m.kind === 0) x = Math.min(x, SEAM - 1.5);
          else x = Math.max(x, SEAM + 1.5);
        }
        put(m.kind, x, y, size, m.rot + f * m.spin, a);
      }
      for (const s of sparks) {
        const k = f - E.chun;
        let x = s.x, y = s.y, a = 0;
        if (k >= 0) {
          const drag = (1 - Math.pow(0.9, k)) / 0.1; // ∑ 0.9^i
          x = s.x + s.vx * drag;
          y = s.y + s.vy * drag + 0.35 * k * k * 0.5;
          a = (1 - smooth(clamp(k / 32))) * smooth(clamp(k / 2));
          if (s.kind === 0) x = Math.min(x, SEAM - 1.5);
          else x = Math.max(x, SEAM + 1.5);
        }
        put(s.kind, x, y, s.size, s.rot + f * s.spin, a);
      }
      for (const g of [gP, gS]) for (const k of ["position", "aSize", "aTurn", "aAlpha"]) (g.geo.attributes as any)[k].needsUpdate = true;
      uReveal.value = easeOutCubic(prog(f, E.start + 1, E.start + 14));
      const z = lerp(1.0, 1.045, easeInOutCubic(prog(f, E.start, E.end)));
      root.scale.set(z, z, 1);
      root.position.set(W / 2 - (W / 2) * z, -H / 2 + (H / 2) * z, 0);
      const t = T - E.start / 30;
      petals.items.forEach((p, i) => {
        petals.pos[i * 3] = p.x + t * 12 + Math.sin(t * 1.4 + p.ph) * 18;
        petals.pos[i * 3 + 1] = -((p.y + t * p.sp) % 1120) + 20;
        petals.pos[i * 3 + 2] = 4;
        petals.turn[i] = p.ph + t * (1.2 + (i % 3) * 0.6);
      });
      flakes.items.forEach((p, i) => {
        const gust = 1 + 0.6 * Math.sin(t * 0.8 + p.ph * 0.2);
        const x = p.x - t * 70 * gust + Math.sin(t * 2.3 + p.ph) * 10;
        flakes.pos[i * 3] = SEAM + 8 + ((((x - SEAM - 8) % (W - SEAM + 300)) + (W - SEAM + 300)) % (W - SEAM + 300));
        flakes.pos[i * 3 + 1] = -((p.y + t * p.sp) % 1120) + 20;
        flakes.pos[i * 3 + 2] = 4;
      });
      for (const d of [petals, flakes]) {
        d.geo.attributes.position.needsUpdate = true;
        (d.geo.attributes as any).aTurn.needsUpdate = true;
        d.mat.uniforms.uOp.value = uReveal.value;
      }
      const glow = smooth(prog(f, E.chun - 2, E.chun + 6)) * (0.55 + 0.45 * Math.exp(-Math.max(0, f - E.chun) / 10));
      (warm.material as THREE.MeshBasicMaterial).opacity = 0.16 * glow;
      (cold.material as THREE.MeshBasicMaterial).opacity = 0.16 * glow;
      renderer.render(scene, camera);
    },
  };
}
