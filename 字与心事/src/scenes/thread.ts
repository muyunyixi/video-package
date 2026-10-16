// Scene C · 一线山南海北 (9–17 s)
// One red line crosses an ink-wash landscape, and every era carries it its own
// way: a wild goose flies it out (鸿雁传书), beacon towers relay it along the
// ridges (烽燧), poles hold it as a telegraph wire, and it runs on as light in
// a fibre across the night sea. Day turns to dusk, blue hour, then night.
import * as THREE from "three";
import cues from "../cues.json";
import { makePost } from "../lib/post";
import { paperCanvas, glowCanvas, toTex } from "../lib/textures";
import { makeCanvas } from "../lib/glyph";
import { gooseAtlas } from "../lib/birds";
import { W, H, COLORS, HW, lerp, prog, smooth, easeInOutCubic, easeInCubic, easeOutCubic, easeOutBack, mulberry32, clamp } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";

const C = cues.thread;
const F0 = C.start; // 270
const F1 = C.segments[1].from; // 330
const F2 = C.segments[2].from; // 390
const F3 = C.segments[3].from; // 450
const FE = 512;

// ---------- camera path: speed surges at each segment boundary (downbeats) ----------
const camX: number[] = [];
{
  let x = 0;
  for (let f = F0 - 20; f <= FE + 10; f++) {
    camX[f] = x;
    const boost = [F1, F2, F3].reduce((a, b) => a + Math.exp(-Math.pow((f - b) / 6, 2)), 0);
    const slowEnd = 1 - 0.75 * smooth(prog(f, 486, 506));
    x += (0.26 + 0.55 * boost) * slowEnd;
  }
}
const cx = (f: number) => {
  const i = Math.floor(f);
  const a = camX[Math.max(F0 - 20, Math.min(FE + 9, i))] ?? 0;
  const b = camX[Math.max(F0 - 20, Math.min(FE + 10, i + 1))] ?? a;
  return lerp(a, b, f - i);
};
const LOOK_AHEAD = 1.2;
const X1 = cx(F1) + LOOK_AHEAD;
const X2 = cx(F2) + LOOK_AHEAD;
const X3 = cx(F3) + LOOK_AHEAD;
const XEND = cx(FE) + 9;
const XCOAST = lerp(X1, X2, 0.62);

// beacon towers between X1 and X2, just behind the line
const TOWERS: { x: number; top: number }[] = [];
for (let k = 0; ; k++) {
  const x = X1 + 2.2 + k * 5.6;
  if (x > X2 - 1.5) break;
  TOWERS.push({ x, top: 0.55 + 0.25 * Math.sin(k * 1.7) });
}
const TOWER_Z = -1.4;

// ---------- the line ----------
const POLE_GAP = 6.0;
const skyPath = (x: number) => 0.95 + 0.3 * Math.sin(x * 0.33) + 0.1 * Math.sin(x * 0.9 + 1.0);
function beaconPath(x: number) {
  // hangs from beacon to beacon, a slack cord between the fires
  let i = 0;
  while (i < TOWERS.length - 1 && TOWERS[i + 1].x < x) i++;
  const a = TOWERS[Math.max(0, i)], b = TOWERS[Math.min(TOWERS.length - 1, i + 1)];
  if (x <= TOWERS[0].x) return TOWERS[0].top + 1.15;
  if (x >= TOWERS[TOWERS.length - 1].x) return TOWERS[TOWERS.length - 1].top + 1.15;
  const t = (x - a.x) / Math.max(0.001, b.x - a.x);
  return lerp(a.top, b.top, t) + 1.15 - 0.55 * (1 - Math.pow(2 * t - 1, 2));
}
const wireY = (x: number) => {
  const k = (x - X2) / POLE_GAP;
  const t = k - Math.floor(k);
  return 1.25 - 0.75 * (1 - Math.pow(2 * t - 1, 2));
};
const fiberY = (x: number) => 0.35 + 0.12 * Math.sin(x * 0.6);
function threadY(x: number) {
  if (x < X1) return skyPath(x);
  if (x < X2) return lerp(skyPath(x), beaconPath(x), smooth(clamp((x - X1) / 3.5)));
  if (x < X3) return lerp(beaconPath(x), wireY(x), smooth(clamp((x - X2) / 3)));
  return lerp(wireY(x), fiberY(x), smooth(clamp((x - X3) / 4)));
}
function threadR(x: number) {
  const b = smooth(clamp((x - X2 + 0.6) / 1.2));
  const c = smooth(clamp((x - X3 + 0.6) / 1.2));
  return lerp(lerp(0.034, 0.03, b), 0.046, c);
}

// sky stage: 0 day · 1 dusk · 2 blue hour · 3 night
const stageOf = (f: number) => smooth(prog(f, 322, 348)) + smooth(prog(f, 388, 412)) + smooth(prog(f, 446, 470));

// the goose that carries the line, and the moment it lets go
const LEAD_DX = LOOK_AHEAD + 2.6;
const RELEASE = 326;
const leadX = (f: number) => cx(f) + LEAD_DX + (f > RELEASE ? (f - RELEASE) * 0.06 : 0);

export function createThread(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const PAPER = new THREE.Color(COLORS.paper);
  scene.background = PAPER.clone();
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 400);
  const dir = new THREE.DirectionalLight(0xfff0dc, 2.4);
  dir.position.set(-4, 8, 10);
  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(dir, amb);

  const uStage = { value: 0 };
  const uF = { value: 0 };
  const uNight = { value: 0 };

  // ---------- sky: rice paper by day, washes of amber, slate and 黛 after ----------
  const skyTex = toTex(paperCanvas(2048, 1024, { seed: 41, base: COLORS.paper, fibers: 5000 }));
  skyTex.wrapS = skyTex.wrapT = THREE.MirroredRepeatWrapping;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 160),
    new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uTex: { value: skyTex }, uStage, uF },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uStage; varying vec2 vUv; varying vec3 vW;
        void main(){
          vec3 paper = texture2D(uTex, vUv * vec2(5.0, 2.0)).rgb;
          float h = smoothstep(-6.0, 34.0, vW.y);
          vec3 day = paper * mix(1.0, 0.93, smoothstep(10.0, 40.0, vW.y));
          vec3 dusk = mix(vec3(0.95, 0.66, 0.42), vec3(0.62, 0.52, 0.55), smoothstep(-2.0, 30.0, vW.y)) * mix(vec3(1.0), paper / 0.9, 0.35);
          vec3 blue = mix(vec3(0.46, 0.52, 0.62), vec3(0.17, 0.21, 0.31), h);
          vec3 night = mix(vec3(0.055, 0.065, 0.1), vec3(0.016, 0.02, 0.036), h);
          vec3 c = mix(day, dusk, clamp(uStage, 0.0, 1.0));
          c = mix(c, blue, clamp(uStage - 1.0, 0.0, 1.0));
          c = mix(c, night, clamp(uStage - 2.0, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.position.set(120, 10, -90);
  scene.add(sky);

  // ---------- ink-wash mountain layers (ridge baked into a 1D texture) ----------
  const XMIN = -60, XMAX = XEND + 140, RES = 4096;
  const ridgeData: Float32Array[] = [];
  const ridgeTex = (seed: number, hMin: number, hMax: number, wMin: number, wMax: number, coastShift: number, scale = 16) => {
    const r = mulberry32(seed);
    const pk: [number, number, number, number][] = [];
    let x = XMIN;
    while (x < XMAX) {
      x += lerp(wMin, wMax, r()) * 0.9;
      pk.push([x, lerp(hMin, hMax, Math.pow(r(), 0.8)), lerp(wMin, wMax, r()), 1.4 + r() * 1.2]);
    }
    const data = new Uint8Array(RES * 4);
    const hs = new Float32Array(RES);
    for (let i = 0; i < RES; i++) {
      const xx = XMIN + ((XMAX - XMIN) * i) / (RES - 1);
      let h = 0;
      for (const [c, hh, w, sharp] of pk) {
        const d = Math.abs(xx - c) / w;
        const prof = Math.exp(-Math.pow(d, sharp) * 2.2);
        h = Math.max(h, hh * prof + 0.35 * hh * Math.exp(-d * d * 0.5));
      }
      h += 0.12 * Math.sin(xx * 1.7 + seed) * Math.sin(xx * 0.53 + seed * 2.0);
      const K = scale * 0.7, M = scale * 0.975;
      if (h > K) h = K + (M - K) * Math.tanh((h - K) / (M - K));
      const coast = 1 - smooth(clamp((xx - (XCOAST + coastShift)) / 14));
      const v = clamp((h * (0.15 + 0.85 * coast)) / scale);
      data[i * 4] = Math.round(v * 255);
      data[i * 4 + 3] = 255;
      hs[i] = v * scale;
    }
    ridgeData.push(hs);
    const t = new THREE.DataTexture(data, RES, 1);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const ridgeAt = (k: number, x: number) => {
    const hs = ridgeData[k];
    const u = clamp((x - XMIN) / (XMAX - XMIN)) * (RES - 1);
    const i = Math.floor(u);
    return lerp(hs[i], hs[Math.min(RES - 1, i + 1)], u - i);
  };
  const blotTex = (() => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 512, 512);
    const r = mulberry32(8);
    ctx.filter = "blur(6px)";
    for (let i = 0; i < 260; i++) {
      const x = r() * 512, y = r() * 512, rr = 6 + r() * 40;
      ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.08 + r() * 0.18})` : `rgba(255,255,255,${0.08 + r() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr * 1.8, rr * 0.7, (r() - 0.5) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    for (let i = 0; i < 900; i++) {
      const x = r() * 512, y = r() * 512, len = 10 + r() * 34;
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (r() - 0.5) * 8);
      ctx.stroke();
    }
    const t = toTex(c, false);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  // z, base (mist line), peak heights, widths; ink by day / dusk / blue hour / night
  const layers = [
    { z: -88, base: 0.5, hMin: 7, hMax: 15, wMin: 10, wMax: 22, ink: "#b6b1a8", dusk: "#b38a78", blue: "#59606e", inkN: "#15161e", alpha: 0.55, seed: 11, coastShift: 22 },
    { z: -60, base: -0.5, hMin: 5, hMax: 11, wMin: 7, wMax: 16, ink: "#96918a", dusk: "#8d6458", blue: "#4a5160", inkN: "#11121a", alpha: 0.66, seed: 23, coastShift: 12 },
    { z: -40, base: -1.2, hMin: 3.5, hMax: 8, wMin: 5, wMax: 12, ink: "#6e6a64", dusk: "#5e4440", blue: "#383e4b", inkN: "#0d0e15", alpha: 0.78, seed: 37, coastShift: 5 },
    { z: -24, base: -1.8, hMin: 2.2, hMax: 5.2, wMin: 3.5, wMax: 8, ink: "#46423d", dusk: "#3c2c2b", blue: "#272c37", inkN: "#090a10", alpha: 0.86, seed: 51, coastShift: 0 },
  ];
  for (const L of layers) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uRidge: { value: ridgeTex(L.seed, L.hMin, L.hMax, L.wMin, L.wMax, L.coastShift) },
        uBlot: { value: blotTex },
        uBase: { value: L.base },
        uInk: { value: new THREE.Color(L.ink) },
        uDusk: { value: new THREE.Color(L.dusk) },
        uBlue: { value: new THREE.Color(L.blue) },
        uInkN: { value: new THREE.Color(L.inkN) },
        uAlpha: { value: L.alpha },
        uStage,
        uXMin: { value: XMIN },
        uXMax: { value: XMAX },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform sampler2D uRidge, uBlot; uniform float uBase, uAlpha, uStage, uXMin, uXMax; uniform vec3 uInk, uDusk, uBlue, uInkN;
        varying vec3 vW;
        void main(){
          float h = texture2D(uRidge, vec2((vW.x - uXMin) / (uXMax - uXMin), 0.5)).r * 16.0;
          float ridge = uBase + h;
          float below = ridge - vW.y;
          if (below < -0.06 || h < 0.05) discard;
          float edge = smoothstep(-0.06, 0.05, below);
          float bl = texture2D(uBlot, vW.xy * vec2(0.035, 0.06)).r;
          float dens = 0.28 + 0.72 * exp(-below * 0.55);
          dens *= 0.8 + 0.45 * (bl - 0.5) * 2.0;
          float mist = smoothstep(uBase - 0.3, uBase + h * 0.45 + 0.6, vW.y);
          float a = edge * clamp(dens, 0.0, 1.0) * mist * uAlpha;
          vec3 ink = mix(uInk, uDusk, clamp(uStage, 0.0, 1.0));
          ink = mix(ink, uBlue, clamp(uStage - 1.0, 0.0, 1.0));
          ink = mix(ink, uInkN, clamp(uStage - 2.0, 0.0, 1.0));
          gl_FragColor = vec4(ink, a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(XMAX - XMIN, 60), mat);
    m.position.set((XMIN + XMAX) / 2, 20, L.z);
    scene.add(m);
  }

  // ---------- beacon hills: a near ridge whose crowns carry the towers ----------
  let towerUniform: THREE.Vector4[] = [];
  {
    const data = new Uint8Array(RES * 4);
    const xa = TOWERS[0].x, xb = TOWERS[TOWERS.length - 1].x;
    // beyond the first and the last tower the ridge does not stop (a stop leaves a vertical
    // cliff): it rolls on in two lower crowns each way and sinks away below the frame (G channel)
    const tail: [number, number][] = [[xa - 4.8, 0.5], [xa - 9.8, 0.3], [xb + 4.8, 0.5], [xb + 9.8, 0.3]];
    for (let i = 0; i < RES; i++) {
      const xx = XMIN + ((XMAX - XMIN) * i) / (RES - 1);
      let h = 0;
      for (const t of TOWERS) {
        const d = (xx - t.x) / 2.9;
        const crown = Math.exp(-d * d * 1.1) * 0.85 + 0.15 * Math.exp(-d * d * 0.25);
        h = Math.max(h, (t.top + 2.9 - 0.95) * crown);
      }
      for (const [c, k] of tail) {
        const d = (xx - c) / 2.6;
        h = Math.max(h, 2.6 * k * (Math.exp(-d * d * 1.1) * 0.85 + 0.15 * Math.exp(-d * d * 0.25)));
      }
      // the ridge wanders, except under a tower: there the crown is level, so every tower
      // stands on its hill at the same depth (crest = top − 0.95)
      let near = 0;
      for (const t of TOWERS) near = Math.max(near, Math.exp(-Math.pow((xx - t.x) / 1.1, 2)));
      h += 0.18 * Math.sin(xx * 1.3) * Math.sin(xx * 0.37) * (1 - near);
      const sink = smooth(clamp((xx - xb - 1.5) / 16)) + 1 - smooth(clamp((xx - xa + 17.5) / 16));
      data[i * 4] = Math.round(clamp(h / 8) * 255);
      data[i * 4 + 1] = Math.round(clamp(sink) * 255);
      data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, RES, 1);
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    // the towers are painted into the same wash as their hill: tapered rammed earth with
    // three merlons, ink pooling at the foot; a lit beacon bleeds vermilion into the hill
    const tw = TOWERS.map((t) => new THREE.Vector4(t.x, t.top, 0.82, 0));
    while (tw.length < 12) tw.push(new THREE.Vector4(-999, -999, 0.82, 0));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uRidge: { value: t }, uBlot: { value: blotTex }, uStage, uF, uXMin: { value: XMIN }, uXMax: { value: XMAX }, uTw: { value: tw } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D uRidge, uBlot; uniform float uStage, uF, uXMin, uXMax; uniform vec4 uTw[12]; varying vec3 vW;
        float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec4 rg = texture2D(uRidge, vec2((vW.x - uXMin) / (uXMax - uXMin), 0.5));
          float h = rg.r * 8.0, sink = rg.g;
          // past the end towers the ridge line sinks below the frame and pales into the mist
          float ridge = -2.9 + h - sink * 1.8;
          float below = ridge - vW.y;
          float bl = texture2D(uBlot, vW.xy * vec2(0.06, 0.1)).r;
          float hill = below < -0.05 ? 0.0 : smoothstep(-0.05, 0.06, below) * clamp(0.55 + 0.45 * exp(-below * 0.8) + (bl - 0.5) * 0.4, 0.0, 1.0) * 0.92 * (1.0 - 0.5 * sink);
          float tower = 0.0, wash = 0.0, heat = 0.0, pool = 0.0;
          for (int i = 0; i < 12; i++) {
            vec4 T = uTw[i];
            float s = T.z;
            float dy = T.y - vW.y;
            float dx = vW.x - T.x;
            // vermilion bleeding into the wet hill around a lit beacon
            float rn = 0.75 + 0.5 * n2(vec2(vW.x * 2.2, vW.y * 2.2) + float(i) * 7.0);
            float rr = (0.6 + 1.9 * T.w) * s * rn;
            wash = max(wash, T.w * exp(-(dx * dx + dy * dy * 1.6) / (rr * rr)));
            heat = max(heat, T.w * exp(-(dx * dx * 3.0 + dy * dy * 16.0) / (s * s)));
            // the tower runs down to the hill's own surface and sinks into it: the foot is
            // measured from the crest under this pixel, not from the top, so nothing hangs
            if (dy < -0.3 * s || dy > 2.2 * s || below > 0.42) continue;
            // squat rammed earth: wider than tall, battered walls, three merlons
            float hw = mix(0.55, 0.84, clamp(dy / (1.0 * s), 0.0, 1.0)) * s;
            float u = dx / (0.55 * s);
            float mer = (abs(u) < 1.0 && fract((u + 1.0) * 1.5) < 0.56) ? 0.17 * s : 0.0;
            float side = smoothstep(hw + 0.025, hw - 0.025, abs(dx + (n2(vec2(vW.y * 9.0, float(i))) - 0.5) * 0.03));
            float lid = smoothstep(-0.02, 0.02, T.y + mer - vW.y);
            float foot = 1.0 - smoothstep(0.04, 0.4, below + (bl - 0.5) * 0.12);
            tower = max(tower, side * lid * foot * (0.8 + 0.25 * (bl - 0.5) * 2.0));
            // ink pooling where the wall meets the slope
            pool = max(pool, exp(-below * below / 0.012) * smoothstep(hw + 0.35, hw - 0.05, abs(dx)) * step(-0.3 * s, dy));
          }
          float a = max(hill, tower * 0.97);
          if (a < 0.003 && wash < 0.01) discard;
          vec3 c = mix(vec3(0.2, 0.19, 0.18), vec3(0.16, 0.11, 0.1), clamp(uStage, 0.0, 1.0));
          c = mix(c, vec3(0.08, 0.09, 0.12), clamp(uStage - 1.0, 0.0, 1.0));
          c = mix(c, c * 0.62, tower);
          c = mix(c, c * 0.7, pool * 0.6 * step(0.003, a));
          // the fire reddens the wet hillside around it; the tower stays dark, its parapet catches the light
          c = mix(c, vec3(0.62, 0.15, 0.08), clamp(wash * 0.55, 0.0, 0.5) * (1.0 - 0.8 * tower) * step(0.003, a));
          c += vec3(0.5, 0.2, 0.07) * heat * 0.55 * tower;
          gl_FragColor = vec4(c, a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(XMAX - XMIN, 20), mat);
    m.position.set((XMIN + XMAX) / 2, 3, TOWER_Z);
    scene.add(m);
    towerUniform = tw;
  }
  // soft foreground ink hills framing the bottom of the shot
  {
    const data = new Uint8Array(RES * 4);
    const r = mulberry32(91);
    const pk: [number, number, number][] = [];
    for (let x = XMIN; x < XMAX; x += 2 + r() * 3) pk.push([x, 0.6 + r() * 1.0, 2 + r() * 3]);
    for (let i = 0; i < RES; i++) {
      const xx = XMIN + ((XMAX - XMIN) * i) / (RES - 1);
      let h = 0;
      for (const [c, hh, w] of pk) h = Math.max(h, hh * Math.exp(-Math.pow(Math.abs(xx - c) / w, 1.6) * 2));
      data[i * 4] = Math.round(clamp(h / 16) * 255);
      data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, RES, 1);
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uRidge: { value: t }, uStage, uXMin: { value: XMIN }, uXMax: { value: XMAX } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D uRidge; uniform float uStage, uXMin, uXMax; varying vec3 vW;
        void main(){
          float h = texture2D(uRidge, vec2((vW.x - uXMin) / (uXMax - uXMin), 0.5)).r * 16.0;
          float below = -2.95 + h - vW.y;
          float a = smoothstep(-0.35, 0.35, below) * 0.82;
          vec3 c = mix(vec3(0.11, 0.105, 0.1), vec3(0.02, 0.022, 0.032), clamp(uStage - 1.0, 0.0, 1.0));
          gl_FragColor = vec4(c, a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(XMAX - XMIN, 20), mat);
    m.position.set((XMIN + XMAX) / 2, -6, 4.5);
    scene.add(m);
  }

  // ---------- sea ----------
  const seaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uStage, uF, uCoast: { value: XCOAST } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uStage, uF, uCoast; varying vec3 vW;
      float h(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        float t = uF / 30.0;
        float z = -vW.z;
        float w = vW.z * 1.6 + 0.6 * sin(vW.x * 0.32 + t * 1.3 + vW.z * 0.4) + 0.25 * sin(vW.x * 1.1 - t * 0.9);
        float d = abs(fract(w) - 0.5);
        float thick = mix(0.035, 0.16, smoothstep(0.0, 40.0, z));
        float line = smoothstep(thick, thick * 0.3, d);
        float brk = smoothstep(0.35, 0.7, h(floor(w) * 7.1 + floor(vW.x * 0.25)));
        float coast = smoothstep(uCoast - 2.0, uCoast + 10.0, vW.x);
        float fade = 1.0 - smoothstep(20.0, 70.0, z);
        float a = line * brk * coast * fade;
        vec3 dayC = vec3(0.17, 0.16, 0.15);
        vec3 duskC = vec3(0.42, 0.25, 0.2);
        vec3 nightC = vec3(0.55, 0.6, 0.72);
        vec3 c = mix(dayC, duskC, clamp(uStage, 0.0, 1.0));
        c = mix(c, nightC, smoothstep(1.4, 2.6, uStage));
        float glint = smoothstep(2.6, 3.0, uStage) * smoothstep(0.996, 1.0, h(floor(vW.x * 5.0) + floor(vW.z * 4.0) * 13.0 + floor(t * 6.0))) * 0.7;
        gl_FragColor = vec4(c + glint, max(a * 0.52, glint * coast * fade));
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(XMAX - XMIN, 90), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((XMIN + XMAX) / 2, -3.2, -40);
  scene.add(sea);

  // ---------- the line itself ----------
  const uHead = { value: 1e9 };
  const threadGeo = (() => {
    const xs: number[] = [];
    for (let x = -14; x <= XEND; x += 0.05) xs.push(x);
    const radial = 10;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    xs.forEach((x) => {
      const y = threadY(x);
      const dy = (threadY(x + 0.03) - threadY(x - 0.03)) / 0.06;
      const n = new THREE.Vector3(-dy, 1, 0).normalize();
      const b = new THREE.Vector3(0, 0, 1);
      const r = threadR(x);
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        const p = new THREE.Vector3(x, y, 0).addScaledVector(n, Math.cos(th) * r).addScaledVector(b, Math.sin(th) * r);
        pos.push(p.x, p.y, p.z);
        uv.push(x, j / radial);
      }
    });
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  })();
  const threadMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uF, uStage, uHead, uX2: { value: X2 }, uX3: { value: X3 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uF, uStage, uHead, uX2, uX3; varying vec2 vUv;
      float h(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        float x = vUv.x; float v = vUv.y; float t = uF / 30.0;
        if (x > uHead) discard;
        float shade = 0.55 + 0.45 * cos((v - 0.18) * 6.2832);
        vec3 verm = vec3(0.75, 0.17, 0.15);
        // silk: smooth red with a running sheen
        float sheen = pow(max(0.0, cos((v - 0.12) * 6.2832)), 14.0);
        vec3 silk = verm * shade * 1.05 + vec3(1.0, 0.72, 0.62) * sheen * (0.45 + 0.25 * sin(x * 2.0 - t * 3.0));
        silk *= mix(1.0, 1.25, clamp(uStage, 0.0, 1.0)); // warmer at dusk
        // wire: dark metal with travelling signal pulses (morse-like)
        float k = x * 1.6 - t * 9.0;
        float cellv = floor(k);
        float on = step(0.45, h(cellv * 1.7)) * step(fract(k), mix(0.25, 0.8, h(cellv * 3.3)));
        vec3 wire = vec3(0.13, 0.13, 0.15) * shade + vec3(0.9, 0.85, 0.8) * pow(max(0.0, cos((v - 0.1) * 6.2832)), 30.0) * 0.35;
        wire += vec3(2.6, 0.7, 0.45) * on;
        // fibre: glowing core with streaming light
        float stream = 0.6 + 0.4 * sin(x * 3.0 - t * 22.0) + 0.6 * smoothstep(0.92, 1.0, fract(x * 0.35 - t * 2.2));
        vec3 fibre = vec3(3.2, 0.9, 0.62) * stream * (0.75 + 0.25 * shade) + vec3(2.0, 1.6, 1.4) * pow(max(0.0, cos((v - 0.25) * 6.2832)), 6.0);
        float b = smoothstep(uX2 - 0.4, uX2 + 0.4, x);
        float c = smoothstep(uX3 - 0.4, uX3 + 0.4, x);
        vec3 col = mix(mix(silk, wire, b), fibre, c);
        float tip = smoothstep(uHead, uHead - 0.25, x);
        gl_FragColor = vec4(col, tip);
      }`,
  });
  const threadMesh = new THREE.Mesh(threadGeo, threadMat);
  threadMesh.frustumCulled = false;
  scene.add(threadMesh);

  // ---------- geese: an ink flock, beating in time ----------
  const POSES = 8;
  const gTex = toTex(gooseAtlas(POSES, 256));
  const NG = 13;
  const gr = mulberry32(73);
  type Goose = { dx: number; dy: number; dz: number; size: number; phase: number; drift: number };
  const flock: Goose[] = [{ dx: 0, dy: 0, dz: 0, size: 1.25, phase: 0, drift: 0 }];
  for (let i = 1; i < NG; i++) {
    const side = i % 2 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    flock.push({
      dx: -0.95 * rank - gr() * 0.4,
      dy: (side > 0 ? 0.22 : -0.12) * rank + (gr() - 0.5) * 0.25,
      dz: side > 0 ? -1.6 * rank - gr() * 1.2 : 0.5 * rank + gr() * 0.5,
      size: 1.05 + (gr() - 0.5) * 0.15,
      phase: gr() * 0.35 + rank * 0.07,
      drift: gr() * 6.28,
    });
  }
  // v4.1 · when the lead lets go of the line the flock does not leave all at once (v4.0 lifted it away
  // together and faded it out together — "like a sprite", the user said): it goes in no set order, two
  // or three together, or one on its own, each on the same climb as v4.0's (a first try sent them rank
  // by rank, some drawing off into the distance, which read as a staircase and as a dip)
  // (frames after the lead, by goose: the lead and two near it; one alone; three; one; three; two)
  const LEAVE_DELAY = [0, 0, 8, 4, 0, 11, 8, 13, 17, 8, 13, 17, 13];
  const LEAVE_END = RELEASE + 30 + Math.max(...LEAVE_DELAY);
  const gGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  gGeo.index = base.index;
  gGeo.setAttribute("position", base.getAttribute("position"));
  gGeo.setAttribute("uv", base.getAttribute("uv"));
  const iPos = new Float32Array(NG * 3), iSize = new Float32Array(NG), iPose = new Float32Array(NG), iAlpha = new Float32Array(NG);
  gGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3));
  gGeo.setAttribute("iSize", new THREE.InstancedBufferAttribute(iSize, 1));
  gGeo.setAttribute("iPose", new THREE.InstancedBufferAttribute(iPose, 1));
  gGeo.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(iAlpha, 1));
  gGeo.instanceCount = NG;
  const gMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTex: { value: gTex }, uStage, uSky: { value: new THREE.Color(COLORS.paper) } },
    vertexShader: `attribute vec3 iPos; attribute float iSize; attribute float iPose; attribute float iAlpha;
      varying vec2 vUv; varying float vA; varying float vDepth;
      void main(){
        vec4 mv = viewMatrix * vec4(iPos, 1.0);
        mv.xy += position.xy * iSize;
        gl_Position = projectionMatrix * mv;
        vUv = vec2((uv.x + iPose) / ${POSES}.0, uv.y);
        vA = iAlpha; vDepth = -mv.z;
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uStage; uniform vec3 uSky; varying vec2 vUv; varying float vA; varying float vDepth;
      void main(){
        vec4 t = texture2D(uTex, vUv);
        float haze = smoothstep(12.0, 26.0, vDepth) * 0.55; // far birds sink into the mist
        vec3 ink = mix(vec3(0.1, 0.1, 0.11), vec3(0.17, 0.11, 0.1), clamp(uStage, 0.0, 1.0));
        vec3 c = mix(ink, uSky, haze);
        gl_FragColor = vec4(c, t.a * vA);
      }`,
  });
  const geese = new THREE.Mesh(gGeo, gMat);
  geese.frustumCulled = false;
  scene.add(geese);

  // ---------- beacon towers (烽燧) with fire and smoke ----------
  const towerTex = (() => {
    const c = makeCanvas(64, 256);
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#5a3a2c"); // firelit lip
    g.addColorStop(0.18, "#2c221e");
    g.addColorStop(1, "#171515");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const r = mulberry32(3);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.15})`;
      ctx.fillRect(0, r() * 256, 64, 1 + r() * 2); // rammed-earth courses
    }
    return toTex(c);
  })();
  const towerMat = new THREE.MeshBasicMaterial({ map: towerTex });
  const flameMat = (seed: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uF, uSeed: { value: seed }, uOn: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy * vec2(1.0, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uF, uSeed, uOn; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float t = uF / 30.0;
          vec2 p = vUv - vec2(0.5, 0.12);
          float turb = n(vec2(p.x * 6.0, p.y * 4.0 - t * 5.0)) * 0.6 + n(vec2(p.x * 13.0, p.y * 9.0 - t * 9.0)) * 0.4;
          float w = mix(0.26, 0.02, clamp(p.y / 0.82, 0.0, 1.0)) * (0.8 + 0.4 * turb);
          float body = smoothstep(w, w * 0.25, abs(p.x + (turb - 0.5) * 0.12 * p.y)) * smoothstep(-0.08, 0.02, p.y);
          body *= smoothstep(0.86, 0.3, p.y + (turb - 0.5) * 0.3);
          // a vermilion brush-flame with a gold heart, not a white-hot CG fire
          vec3 col = mix(vec3(0.9, 0.16, 0.06), vec3(1.0, 0.7, 0.36), smoothstep(0.45, 1.0, body));
          gl_FragColor = vec4(col * body * 1.35 * uOn, 1.0);
        }`,
    });
  const smokeMat = (seed: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uF, uSeed: { value: seed }, uOn: { value: 0 }, uStage },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uF, uSeed, uOn, uStage; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float t = uF / 30.0;
          float y = vUv.y;
          float rise = y * 1.0 - uOn * 0.0;
          float drift = (n(vec2(y * 2.0 - t * 0.6, uSeed)) - 0.5) * 0.35 * y + y * y * 0.18;
          float x = vUv.x - 0.5 - drift;
          float width = mix(0.1, 0.46, pow(y, 0.7));
          float fb = n(vec2(x * 7.0, y * 5.0 - t * 1.6)) * 0.55 + n(vec2(x * 15.0, y * 11.0 - t * 2.6)) * 0.3 + n(vec2(x * 31.0, y * 21.0 - t * 3.8)) * 0.15;
          float m = smoothstep(width, width * 0.1, abs(x)) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.25, 0.75, y));
          float a = m * smoothstep(0.2, 0.7, fb + 0.3 * (1.0 - y)) * 0.9;
          // the column climbs as the fire takes
          a *= smoothstep(uOn * 1.15, uOn * 1.15 - 0.15, y);
          vec3 lit = mix(vec3(0.45, 0.24, 0.16), vec3(0.2, 0.17, 0.18), smoothstep(0.0, 0.4, y));
          vec3 c = mix(vec3(0.3, 0.29, 0.29), lit, clamp(uStage, 0.0, 1.0));
          c = mix(c, vec3(0.16, 0.17, 0.2), clamp(uStage - 1.0, 0.0, 1.0));
          gl_FragColor = vec4(c, a);
        }`,
    });
  const glowTex = toTex(glowCanvas(256, "255,150,80", 0.35));
  type Beacon = { flame: THREE.Mesh; smoke: THREE.Mesh; glow: THREE.Mesh; on: number; x: number; top: number; z: number; scale: number };
  const beacons: Beacon[] = [];
  const addBeacon = (x: number, top: number, z: number, scale: number, seed: number, withTower: boolean) => {
    // (the near towers themselves are painted into the hill's wash)
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * scale, 1.5 * scale), flameMat(seed));
    flame.position.set(x, top + (withTower ? 0.66 : 0.62) * scale, z + 0.05);
    flame.frustumCulled = false;
    scene.add(flame);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2 * scale, 4.2 * scale),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.set(x, top + 0.4 * scale, z + 0.04);
    scene.add(glow);
    const plume = withTower ? 8.0 : 4.0;
    const smoke = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * scale, plume * scale), smokeMat(seed + 1));
    smoke.position.set(x + 0.3 * scale, top + (plume / 2 + 0.2) * scale, z - 0.05);
    scene.add(smoke);
    beacons.push({ flame, smoke, glow, on: 0, x, top, z, scale });
  };
  TOWERS.forEach((t, k) => addBeacon(t.x, t.top, TOWER_Z, 0.82, 10 + k, true));
  // the far chain: fires running away along the distant ridges
  const FAR: { b: number; at: number }[] = [];
  {
    let k = 0;
    for (let x = X1 + 5; x < X2 + 24; x += 5.2) {
      const z = -40;
      const top = -1.2 + ridgeAt(2, x) - 0.05;
      if (top < 0.5) continue;
      addBeacon(x, top, z + 0.5, 1.15, 40 + k, false);
      FAR.push({ b: beacons.length - 1, at: F1 + 6 + k * 3.5 });
      k++;
    }
  }
  const nearIgnite = TOWERS.map((t) => {
    for (let f = F0; f < FE; f++) if (cx(f) + LOOK_AHEAD + 3.4 >= t.x) return f;
    return FE;
  });
  // sparks
  const NS = 260;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(NS * 3);
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ map: toTex(glowCanvas(64, "255,190,120", 0.3)), size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sr = mulberry32(5);
  const sparkSeed = Array.from({ length: NS }, () => ({ t: TOWERS.length ? Math.floor(sr() * TOWERS.length) : 0, ph: sr(), vx: (sr() - 0.5) * 0.8, vy: 0.8 + sr() * 1.6 }));

  // ---------- telegraph poles ----------
  {
    const wood = new THREE.MeshBasicMaterial({ color: 0x1f1b19 });
    const porcelain = new THREE.MeshBasicMaterial({ color: 0xb9b4ab });
    for (let x = X2 + POLE_GAP; x < X3 + 4; x += POLE_GAP) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 7.5, 8), wood);
      pole.position.set(x, 1.25 - 3.75 - 0.15, -0.25);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), wood);
      bar.position.set(x, 1.05, -0.25);
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 8), porcelain);
      ins.position.set(x, 1.2, -0.12);
      scene.add(pole, bar, ins);
    }
  }

  // ---------- the phone at the end of the fibre ----------
  const phoneC = makeCanvas(512, 1024);
  {
    const ctx = phoneC.getContext("2d")!;
    ctx.fillStyle = "#2e2c2c";
    ctx.beginPath();
    ctx.roundRect(2, 2, 508, 1020, 78);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, "#191a1f");
    g.addColorStop(1, "#0c0c10");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 992, 66);
    ctx.fill();
    ctx.fillStyle = "#08080a";
    ctx.beginPath();
    ctx.roundRect(196, 34, 120, 30, 15);
    ctx.fill();
    ctx.fillStyle = "rgba(234,230,222,0.55)";
    ctx.font = `400 26px "Noto Serif CJK SC"`;
    ctx.fillText("23:57", 56, 60);
    ctx.fillStyle = "rgba(234,230,222,0.12)";
    ctx.fillRect(16, 120, 480, 2);
    // her phone: his message has come in, so it sits on the left, as received messages do
    const bg = ctx.createLinearGradient(56, 420, 386, 540);
    bg.addColorStop(0, "#cc3a32");
    bg.addColorStop(1, "#a12623");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(40, 420, 340, 118, [30, 30, 30, 8]);
    ctx.fill();
    ctx.fillStyle = "rgba(246,240,230,0.94)";
    ctx.font = `400 34px "HW"`;
    ctx.fillText("掂量情思敲字句，", 66, 470);
    ctx.fillText("轻顿指尖", 66, 514);
    ctx.fillStyle = "rgba(234,230,222,0.12)";
    ctx.beginPath();
    ctx.roundRect(40, 900, 432, 70, 35);
    ctx.fill();
  }
  const phoneMat = new THREE.MeshBasicMaterial({ map: toTex(phoneC), transparent: true });
  const phone = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), phoneMat);
  phone.position.set(XEND - 1.5, threadY(XEND - 1.5) + 2.0, 0.2);
  scene.add(phone);
  const phoneGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "255,90,70", 0.4)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  phoneGlow.position.copy(phone.position).add(new THREE.Vector3(0, 0, -0.1));
  scene.add(phoneGlow);

  // drifting mist / ink motes in the foreground
  const MOTES = 500;
  const mr = mulberry32(61);
  const motePos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = -10 + mr() * (XEND + 20);
    motePos[i * 3 + 1] = -3 + mr() * 9;
    motePos[i * 3 + 2] = 1 + mr() * 6;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ map: toTex(glowCanvas(64, "30,26,24", 0.4)), size: 0.12, transparent: true, opacity: 0.5, depthWrite: false });
  scene.add(new THREE.Points(moteGeo, moteMat));

  const post = makePost(renderer, scene, camera, { bloom: [0.6, 0.45, 0.82] });
  post.finish.uniforms.uVignette.value = 0.3;
  post.finish.uniforms.uGrain.value = 0.02;
  post.finish.uniforms.uCA.value = 0.0006;

  const bgDay = new THREE.Color(COLORS.paper);
  const bgDusk = new THREE.Color("#d9a07c");
  const bgBlue = new THREE.Color("#3a4252");
  const bgNight = new THREE.Color("#0b0d14");
  const tmpC = new THREE.Color();

  return {
    render(f: number) {
      uF.value = f;
      const st = stageOf(f);
      uStage.value = st;
      uNight.value = clamp(st - 2);
      tmpC.copy(bgDay).lerp(bgDusk, clamp(st)).lerp(bgBlue, clamp(st - 1)).lerp(bgNight, clamp(st - 2));
      (scene.background as THREE.Color).copy(tmpC);
      (gMat.uniforms.uSky.value as THREE.Color).copy(tmpC);
      const night = clamp(st - 2);
      moteMat.color.setRGB(lerp(1, 4, night), lerp(1, 3.2, night), lerp(1, 2.6, night));
      moteMat.opacity = lerp(0.45, 0.35, night);

      const x = cx(f);
      const vel = cx(f + 0.5) - cx(f - 0.5);
      const endPush = easeInOutCubic(prog(f, 488, FE));
      const camZ = lerp(13.5, 3.6, endPush);
      const camY = lerp(1.25 + 0.25 * Math.sin(f * 0.05), threadY(XEND - 1.5) + 2.0, endPush);
      const camXX = lerp(x, XEND - 1.5, endPush);
      camera.position.set(camXX, camY, camZ);
      camera.lookAt(lerp(x + LOOK_AHEAD + 0.6, XEND - 1.5, endPush), lerp(1.05, threadY(XEND - 1.5) + 2.0, endPush), 0);

      // ---------- geese ----------
      const lx = leadX(f);
      flock.forEach((g, i) => {
        const d = LEAVE_DELAY[i];
        const leave = easeInCubic(prog(f, RELEASE - 4 + d, RELEASE + 26 + d));
        const wob = i === 0 ? 0 : 1; // the lead flies true: the line is tied to it
        const gx = lx + g.dx + leave * (2.5 + i * 0.3) + wob * 0.12 * Math.sin(f * 0.07 + g.drift);
        // (after the lead lets go the others keep the height they had: the path they flew along with
        // the line goes on down towards the beacons, and one that has not left yet would sink with it)
        const baseY = i === 0 ? threadY(lx) : skyPath(Math.min(lx, leadX(RELEASE))) + 0.15;
        const gy = baseY + g.dy + wob * 0.08 * Math.sin(f * 0.11 + g.drift) + leave * (5.5 + i * 0.4);
        const gz = g.dz - leave * 3;
        // the thread is tied at the feet: offset the sprite so the feet sit on the line
        const s = g.size;
        iPos[i * 3] = gx + (i === 0 ? 0.16 * s : 0);
        iPos[i * 3 + 1] = gy + (i === 0 ? 0.094 * s : 0);
        iPos[i * 3 + 2] = gz;
        iSize[i] = s;
        // one wing-beat per musical beat (15 frames)
        const ph = ((f / 15 + g.phase) % 1 + 1) % 1;
        iPose[i] = Math.floor(ph * POSES) % POSES;
        iAlpha[i] = (1 - smooth(prog(f, RELEASE + 6 + d, RELEASE + 28 + d))) * smooth(prog(f, F0 - 2, F0 + 2));
      });
      (gGeo.getAttribute("iPos") as THREE.BufferAttribute).needsUpdate = true;
      (gGeo.getAttribute("iSize") as THREE.BufferAttribute).needsUpdate = true;
      (gGeo.getAttribute("iPose") as THREE.BufferAttribute).needsUpdate = true;
      (gGeo.getAttribute("iAlpha") as THREE.BufferAttribute).needsUpdate = true;
      geese.visible = f < LEAVE_END;

      // the line ends at the lead goose's feet; once released it runs on ahead
      const feet = leadX(Math.min(f, RELEASE));
      uHead.value = f < RELEASE ? leadX(f) : feet + easeOutCubic(prog(f, RELEASE, RELEASE + 22)) * (XEND + 20 - feet);

      // ---------- beacons: near towers flare as the line reaches them; the far chain races off ----------
      beacons.forEach((b, i) => {
        let at = FE + 100;
        if (i < TOWERS.length) at = nearIgnite[i];
        else {
          const fr = FAR.find((q) => q.b === i);
          if (fr) at = fr.at;
        }
        const on = f >= at ? easeOutBack(prog(f, at, at + 7), 2.0) : 0;
        if (i < TOWERS.length && towerUniform[i]) towerUniform[i].w = f >= at ? smooth(prog(f, at - 1, at + 16)) : 0;
        const flick = 0.85 + 0.15 * Math.sin(f * 1.9 + i * 2.3) * Math.sin(f * 0.77 + i);
        (b.flame.material as THREE.ShaderMaterial).uniforms.uOn.value = on * flick;
        const far = i >= TOWERS.length;
        (b.glow.material as THREE.MeshBasicMaterial).opacity = on * flick * (far ? 0.35 : 0.85) * (1 + 0.8 * Math.exp(-Math.max(0, f - at) / 4));
        (b.smoke.material as THREE.ShaderMaterial).uniforms.uOn.value = f >= at ? easeOutCubic(prog(f, at, at + 40)) : 0;
        b.flame.quaternion.copy(camera.quaternion);
      });
      sparkSeed.forEach((s, i) => {
        const t = TOWERS[s.t];
        const at = nearIgnite[s.t];
        if (!t || f < at) {
          sparkPos[i * 3 + 1] = -100;
          return;
        }
        const life = ((f - at) / 30 + s.ph) % 1.2;
        sparkPos[i * 3] = t.x + s.vx * life + 0.15 * Math.sin(life * 9 + i);
        sparkPos[i * 3 + 1] = t.top + 0.4 + s.vy * life;
        sparkPos[i * 3 + 2] = TOWER_Z + 0.1;
      });
      sparkGeo.attributes.position.needsUpdate = true;

      phoneMat.opacity = smooth(prog(f, 470, 488));
      (phoneGlow.material as THREE.MeshBasicMaterial).opacity = smooth(prog(f, 478, 500)) * 0.9;

      post.finish.uniforms.uSeed.value = f;
      post.finish.uniforms.uBlur.value.set(clamp(vel * 0.018, 0, 0.06), 0);
      post.finish.uniforms.uFlash.value = smooth(prog(f, 500, FE)) * 0.9;
      post.finish.uniforms.uFadeColor.value.set(1, 1, 1);
      if (post.bloom) post.bloom.strength = lerp(0.45, 0.95, clamp(st - 0.6));
      post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
