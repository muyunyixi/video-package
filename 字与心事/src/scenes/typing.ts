// Scene A · 落笔 (0–6.2 s)
// The IME candidates rise out of a floor of movable type (every character of
// 桃子's 35 poems); picking a word = 拣字, and the block stamps it onto the
// paper input strip.
import * as THREE from "three";
import cues from "../cues.json";
import { makePost, seen, untoned, untonedHex } from "../lib/post";
import { glyphCell, paperCanvas, glowCanvas, toTex } from "../lib/textures";
import { drawText, makeCanvas } from "../lib/glyph";
import { ALL_CHARS } from "../corpus";
import { W, H, COLORS, SANS, HW, lerp, prog, smooth, easeInOutCubic, easeOutCubic, easeInCubic, easeOutBack, mulberry32 } from "../lib/util";
import type { SceneHandle } from "../lib/ThreeLayer";

/** The first line of the film: typed here, sent, read at midnight, sealed at the end. */
export const FIRST_LINE = "掂量情思敲字句，轻顿指尖";

type Entry = (typeof cues.ime)[number];

const STRIP_Y = 0.36;
const STRIP_Z = -0.5;
const CAND_Z = 1.5;
const SLOT0 = -5.5;
const SLOW = cues.hover.slow; // the hesitation: time thickens but never stops
const B1 = cues.hover.beat1, B2 = cues.hover.beat2;
/** scene time: real until SLOW, then ~1/3 speed until the send */
const sceneT = (f: number) => (f < SLOW ? f : f < cues.hover.send ? SLOW + (f - SLOW) * 0.35 : SLOW + (cues.hover.send - SLOW) * 0.35 + (f - cues.hover.send));
const WIDE_END = 166;
const SEND = cues.hover.send;
const slotX = (s: number) => SLOT0 + s;

// floor grid: cell centres at (c + 0.5 + GX, r + 0.5). v4.0: GX = 0 — the floor's columns are the
// strip's slots, so every printed glyph sits exactly over its column of type (v3.1 shifted the
// floor 0.14 cell right to line the risen 联想 row up with the strip's old right edge)
const FC0 = -34, FC1 = 34, FR0 = -36, FR1 = 12, GX = 0;
// v4.1 · 字回字盘: the first line's own type is in the floor from the start, in front of the strip,
// scattered as type lies in a case; at the end of the film each character goes home to its cell
// (LOOP, below). Cells (column, row), in the line's order. v4.5: each in its own slot's column, so it
// drops straight forward off the strip into it (v4.1 drew them in to columns −7 … 1, to be seen whole
// in the first frame: going home they crossed one another's way, leftward, three rows down).
export const LOOP_HOME: [number, number][] = [
  [-6, 3], [-5, 2], [-4, 4], [-3, 3], [-2, 2], [-1, 4], [0, 3], [1, 2], [2, 4], [3, 3], [4, 2], [5, 4],
];
// the strip (v4.0 用户方案三): the text fills −6…6; half a cell of paper on the left, half a cell
// between the text and the send button, and the button (a 0.8-cell disc) half a cell from the strip's
// top, bottom and right edges — 0.5 on all four sides. So the strip runs −6.5…7.8.
const SEND_D = 0.8, PADC = 0.5;
const STRIP_L = -6 - PADC, STRIP_R = 6 + PADC + SEND_D + PADC;
const STRIP_X = (STRIP_L + STRIP_R) / 2;
/** where the camera is and what it looks at, before its shake and the send's whip */
export function typingCam(follow: number, wide: number, lean: number) {
  return {
    pos: [lerp(follow, STRIP_X, wide) + 1.5 * lean, lerp(7.4, 9.4, wide) - 0.9 * lean, lerp(10.6, 14.4, wide) - 1.9 * lean] as const,
    look: [lerp(follow, STRIP_X, wide) + 1.3 * lean, 0.0, lerp(1.0, 0.75, wide) - 0.1 * lean] as const,
  };
}
/** where the camera follows to before the first key (the cursor waiting at the line's start): the
 *  film's first frames, and its last (字回字盘) */
const REST_FOLLOW = Math.max(-3.4, Math.min(2.8, (SLOT0 - 0.5) * 0.8));
export const TYPING_FOV = 30;
const CUR_W = 0.06;

// v4.5 · 字回字盘, the film's last second in this scene's own frames (the film's frame − cues.loop.end:
// −45 … −1). The first line has lain down on the strip (laid: scenes/Ending tilts it there off the
// page, the room seen wide); the camera comes back to rest (go → home) while the characters go home
// into the type one by one, the last first, each hopping off its slot (depart) into its own cell
// (lands, a click each: audio); the cursor waits at the strip's start, and blinks on into frame 0.
const LE = cues.loop.end;
export const LOOP = {
  laid: cues.loop.laid - LE,
  go: cues.loop.go - LE,
  home: cues.loop.home - LE,
  depart: cues.loop.depart.map((d) => d - LE),
  lands: cues.loop.lands.map((d) => d - LE),
  settle: cues.loop.settle,
};
/** the camera then: wide on the whole strip, and back to rest as the line goes home */
export const loopCam = (f: number) => typingCam(REST_FOLLOW, 1 - easeInOutCubic(prog(f, LOOP.go, LOOP.home)), 0);
/** where the line lies on the strip: each character's em square (as printed), and the cursor's bar */
export const LOOP_STRIP = { x: (i: number) => slotX(i), y: STRIP_Y + 0.014, z: STRIP_Z, em: 0.92, cur: { x: SLOT0 - 0.5 + CUR_W / 2, y: STRIP_Y + 0.018, w: CUR_W, h: 0.92 } };
const CURSOR_COL = new THREE.Color(COLORS.vermilionHot).multiplyScalar(1.3);
/** the cursor as the room shows it, before the vignette (scenes/Ending takes the page's cursor to it) */
export const CURSOR_SEEN = seen(CURSOR_COL);

export function createTyping(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.night);
  scene.fog = new THREE.Fog(COLORS.night, 22, 58);
  const camera = new THREE.PerspectiveCamera(TYPING_FOV, W / H, 0.1, 200);

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0xfff0dc, 0.12));
  scene.add(new THREE.HemisphereLight(0xffe6c4, 0x050403, 0.22));
  const key = new THREE.SpotLight(0xffd8a8, 1000, 80, 0.42, 0.95, 2);
  key.position.set(-6, 19, 4);
  key.target.position.set(0.5, 0, 0.2);
  scene.add(key, key.target);

  // ---------- floor of movable type (cheap custom shader: baked light pool + mip-bias DOF) ----------
  const cell = 112;
  const cols = 32;
  const ATLAS = [...ALL_CHARS, "，"]; // v4.1: and the line's comma, a piece of punctuation type for its home cell
  const rows = Math.ceil(ATLAS.length / cols);
  const BLANK = ATLAS.length; // v4.5: the atlas's first empty cell, a home cell's face while its character is away
  const ac = makeCanvas(cols * cell, rows * cell);
  const actx = ac.getContext("2d")!;
  actx.fillStyle = "#211a15";
  actx.fillRect(0, 0, ac.width, ac.height);
  ATLAS.forEach((ch, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    // embossed raised type: shadow, highlight, face
    actx.drawImage(glyphCell(ch, cell, { color: "#120e0b", scale: 0.8, blur: 1.2 }), x + 3, y + 4);
    actx.drawImage(glyphCell(ch, cell, { color: "#a38f74", scale: 0.8 }), x - 1, y - 1);
    actx.drawImage(glyphCell(ch, cell, { color: "#6f5f4d", scale: 0.8 }), x, y);
  });
  const atlasTex = toTex(ac);
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  const floorGeo = new THREE.BoxGeometry(0.95, 0.6, 0.95);
  const fMat = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlasTex },
      uLamp: { value: new THREE.Vector2(0.6, 0.6) },
      uFocus: { value: 18 },
      uAperture: { value: 0.46 },
      uGlowPos: { value: new THREE.Vector2(0, 0) },
      uGlow: { value: 0 },
      uFog: { value: new THREE.Color(COLORS.night) },
      uFogNear: { value: 20 },
      uFogFar: { value: 58 },
      uPool: { value: 1 },
      uBlank: { value: new THREE.Vector2((BLANK % cols) / cols, 1 - (Math.floor(BLANK / cols) + 1) / rows) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 uvOffset; attribute float aBright; attribute float aInk; uniform vec2 uBlank;
      varying vec2 vUv; varying float vBright; varying vec3 vWorld; varying float vTop; varying float vViewZ;
      varying vec2 vUvB; varying float vInk;
      void main(){
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vTop = normal.y;
        vUv = uv / vec2(${cols}.0, ${rows}.0) + uvOffset;
        vUvB = uv / vec2(${cols}.0, ${rows}.0) + uBlank;
        vInk = aInk;
        vBright = aBright;
        vec4 mv = viewMatrix * wp;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec2 uLamp; uniform float uFocus, uAperture, uGlow, uFogNear, uFogFar, uPool;
      uniform vec2 uGlowPos; uniform vec3 uFog;
      varying vec2 vUv; varying float vBright; varying vec3 vWorld; varying float vTop; varying float vViewZ;
      varying vec2 vUvB; varying float vInk;
      void main(){
        float dz = vViewZ - uFocus;
        float blur = clamp((dz < 0.0 ? -dz * 0.95 : dz * uAperture) - 0.25, 0.0, 5.0);
        vec3 tex = texture2D(uAtlas, vUv, blur).rgb;
        vec3 none = texture2D(uAtlas, vUvB, blur).rgb;
        if (vInk < 0.999) tex = mix(none, tex, vInk);
        vec2 dxz = vWorld.xz - uLamp;
        dxz.y *= 1.35;
        float d2 = dot(dxz, dxz);
        float pool = 0.03 + uPool * (1.5 * exp(-d2 / (2.0 * 4.3 * 4.3)) + 0.2 * exp(-d2 / (2.0 * 11.0 * 11.0)));
        float face = vTop > 0.5 ? 1.0 : 0.3;
        vec3 col = tex * pool * face * vBright;
        col *= mix(0.32, 1.0, smoothstep(10.5, 15.5, vViewZ));
        float g = uGlow * exp(-dot(vWorld.xz - uGlowPos, vWorld.xz - uGlowPos) / 2.6);
        col += vec3(1.0, 0.27, 0.15) * g * (vTop > 0.5 ? 0.55 : 0.25);
        col += vec3(0.03, 0.05, 0.11) * smoothstep(5.0, 22.0, vWorld.x) * face;
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vViewZ));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const nCols = FC1 - FC0, nRows = FR1 - FR0;
  const floor = new THREE.InstancedMesh(floorGeo, fMat, nCols * nRows);
  const uvOff = new Float32Array(nCols * nRows * 2);
  const bright = new Float32Array(nCols * nRows);
  const cellIndex = (c: number, r: number) => (r - FR0) * nCols + (c - FC0);
  const dm = new THREE.Object3D();
  const rr = mulberry32(31);
  const floorH = new Float32Array(nCols * nRows);
  for (let r = FR0; r < FR1; r++) {
    for (let c = FC0; c < FC1; c++) {
      const i = cellIndex(c, r);
      const h = (rr() - 0.5) * 0.05;
      floorH[i] = h;
      dm.position.set(c + 0.5 + GX, -0.3 + h, r + 0.5);
      dm.rotation.set(0, 0, 0);
      dm.scale.set(1, 1, 1);
      dm.updateMatrix();
      floor.setMatrixAt(i, dm.matrix);
      let k = Math.floor(rr() * ALL_CHARS.length);
      const home = LOOP_HOME.findIndex(([hc, hr]) => hc === c && hr === r);
      if (home >= 0) k = ATLAS.indexOf([...FIRST_LINE][home]);
      uvOff[i * 2] = (k % cols) / cols;
      uvOff[i * 2 + 1] = 1 - (Math.floor(k / cols) + 1) / rows;
      bright[i] = 0.7 + rr() * 0.5;
    }
  }
  floorGeo.setAttribute("uvOffset", new THREE.InstancedBufferAttribute(uvOff, 2));
  floorGeo.setAttribute("aBright", new THREE.InstancedBufferAttribute(bright, 1));
  const floorInk = new Float32Array(nCols * nRows).fill(1); // v4.5: 0 = the cell's character is away
  floorGeo.setAttribute("aInk", new THREE.InstancedBufferAttribute(floorInk, 1));
  scene.add(floor);
  if (((globalThis as any).__flags ?? {}).noFloor) floor.visible = false;
  const hideCell = (c: number, r: number, hidden: boolean) => {
    const i = cellIndex(c, r);
    dm.position.set(c + 0.5 + GX, -0.3 + floorH[i], r + 0.5);
    dm.scale.setScalar(hidden ? 0.0001 : 1);
    dm.updateMatrix();
    floor.setMatrixAt(i, dm.matrix);
  };

  // ---------- light shaft (volumetric hint) ----------
  const shaftGeo = new THREE.ConeGeometry(6.5, 22, 48, 1, true);
  shaftGeo.translate(0, -11, 0);
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0.07 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uOpacity; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float fall = smoothstep(-22.0, -2.0, vY) * smoothstep(0.0, -3.0, vY);
      gl_FragColor = vec4(vec3(1.0,0.86,0.66) * uOpacity * edge * fall, 1.0); }`,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.copy(key.position);
  shaft.lookAt(key.target.position);
  shaft.rotateX(-Math.PI / 2);
  scene.add(shaft);

  // ---------- paper strip (input box) ----------
  // (its extent: STRIP_L … STRIP_R, above)
  const stripD = 1.8;
  const stripW = STRIP_R - STRIP_L;
  const SCW = Math.round((242 * stripW) / stripD); // the paper's canvas keeps the strip's aspect (round corners stay round)
  const stripC = paperCanvas(SCW, 242, { radius: 40, seed: 7, base: "#ebe7de" });
  const sctx = stripC.getContext("2d")!;
  sctx.fillStyle = "rgba(192,48,44,0.85)";
  sctx.fillRect(40, 236, SCW - 80, 4); // focus underline, modern input
  const stripMat = new THREE.MeshStandardMaterial({ map: toTex(stripC), transparent: true, roughness: 0.92, emissive: new THREE.Color(0x2c2218), emissiveIntensity: 0.25 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(stripW, stripD), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(STRIP_X, STRIP_Y, STRIP_Z);
  strip.castShadow = true;
  strip.receiveShadow = true;
  scene.add(strip);
  const stripShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(stripW + 2.4, stripD + 2.4),
    new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "0,0,0", 0.72)), transparent: true, opacity: 0.85, depthWrite: false })
  );
  stripShadow.rotation.x = -Math.PI / 2;
  stripShadow.scale.set(1, 1, 1);
  stripShadow.position.set(STRIP_X + 0.9, 0.012, STRIP_Z + 0.55);
  scene.add(stripShadow);
  const stripBody = new THREE.Mesh(new THREE.BoxGeometry(stripW - 0.3, 0.05, stripD - 0.3), new THREE.MeshStandardMaterial({ color: 0x8c7f6c, roughness: 0.9 }));
  stripBody.position.set(STRIP_X, STRIP_Y - 0.03, STRIP_Z);
  stripBody.castShadow = true;
  scene.add(stripBody);

  // ---------- printed glyphs ----------
  type Print = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; stamp: number; slot: number };
  const prints: Print[] = [];
  const entrySlots: number[] = [];
  let slot = 0;
  for (const e of cues.ime) {
    entrySlots.push(slot);
    for (const ch of e.word) {
      const mat = new THREE.MeshStandardMaterial({ map: toTex(glyphCell(ch, 256, { color: "#15100d", scale: 0.92 })), transparent: true, roughness: 0.6, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(slotX(slot), STRIP_Y + 0.012, STRIP_Z);
      mesh.renderOrder = 2;
      scene.add(mesh);
      prints.push({ mesh, mat, stamp: e.stamp, slot });
      slot++;
    }
  }

  // ink specks
  const SPECK = 30;
  const speckGeo = new THREE.BufferGeometry();
  const speckPos = new Float32Array(cues.ime.length * SPECK * 3);
  speckGeo.setAttribute("position", new THREE.BufferAttribute(speckPos, 3));
  const specks = new THREE.Points(speckGeo, new THREE.PointsMaterial({ color: 0x1a1411, size: 0.04, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(specks);

  // ---------- pinyin ----------
  const pinyinCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number; from: number; to: number }>();
  const pinyinTex = (s: string) => {
    let v = pinyinCache.get(s);
    if (!v) {
      const size = 96;
      const probe = makeCanvas(8, 8).getContext("2d")!;
      probe.font = `400 ${size}px ${SANS}`;
      const tw = Math.max(8, probe.measureText(s).width);
      const c = makeCanvas(tw + 24, size * 1.5);
      const ctx = c.getContext("2d")!;
      ctx.font = `400 ${size}px ${SANS}`;
      ctx.fillStyle = "#3a3028";
      ctx.textBaseline = "middle";
      ctx.fillText(s, 12, size * 0.68);
      ctx.fillRect(12, size * 1.3, tw, 5);
      // (where the letters' advance boxes begin and end, as fractions of the texture's width: the
      // pinyin starts at the insertion point and the cursor stands right after its last letter)
      v = { tex: toTex(c), aspect: c.width / c.height, from: 12 / c.width, to: (12 + tw) / c.width };
      pinyinCache.set(s, v);
    }
    return v;
  };
  const pinyinH = 0.52;
  const pinyin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  pinyin.rotation.x = -Math.PI / 2;
  pinyin.renderOrder = 3;
  scene.add(pinyin);

  // ---------- cursor ----------
  // v4.1 · the cursor stands at the insertion point, its left edge on it: right after the last
  // character's cell (a character's em square, a letter's advance), never letter-spacing or a gap
  // more (《整体制作指南》8.1). v4.0 set its centre 0.06 cell past the cell's edge, and after the
  // pinyin 0.07 past the end of its texture, padding included.
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(CUR_W, 0.92), new THREE.MeshBasicMaterial({ color: CURSOR_COL, transparent: true }));
  cursor.rotation.x = -Math.PI / 2;
  cursor.renderOrder = 4;
  scene.add(cursor);

  // ---------- 字回字盘 (v4.5): the first line goes home ----------
  // Each character is a card the size of its em, lying in its slot as the page left it (LOOP.laid). It
  // hops off, last first, down into its own cell of the type (LOOP_HOME), turning on the way from the
  // listing's red into the type's own face — sampled from the atlas, lit by the same pool of lamplight,
  // blurred by the same depth of field as the floor — so that landed it is the type printed in its cell:
  // the cell takes its character back (aInk) and the card fades into it.
  const homeIdx = LOOP_HOME.map(([c, r]) => cellIndex(c, r));
  const LOOP_RED = untoned(COLORS.vermilion); // the listing's red (scenes/Ending, COL.zh), as the room shows it (v5.6: 朱砂, was #b32d27)
  const cardVS = /* glsl */ `
    varying vec2 vUv; varying vec3 vWorld; varying float vViewZ;
    void main(){
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vViewZ = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const cardFS = /* glsl */ `
    uniform sampler2D uMask, uAtlas; uniform vec2 uCell, uLamp; uniform vec3 uInk, uFog;
    uniform float uFace, uAlpha, uBright, uFocus, uAperture, uPool, uFogNear, uFogFar;
    varying vec2 vUv; varying vec3 vWorld; varying float vViewZ;
    void main(){
      float dz = vViewZ - uFocus;
      float blur = clamp((dz < 0.0 ? -dz * 0.95 : dz * uAperture) - 0.25, 0.0, 5.0);
      float a = texture2D(uMask, vUv, blur).a;
      // the type's face as the floor shows it: its atlas cell, whose middle 0.8 is the em
      vec3 tex = texture2D(uAtlas, (0.5 + (vUv - 0.5) * 0.8) / vec2(${cols}.0, ${rows}.0) + uCell, blur).rgb;
      vec2 dxz = vWorld.xz - uLamp;
      dxz.y *= 1.35;
      float d2 = dot(dxz, dxz);
      float pool = 0.03 + uPool * (1.5 * exp(-d2 / (2.0 * 4.3 * 4.3)) + 0.2 * exp(-d2 / (2.0 * 11.0 * 11.0)));
      vec3 face = tex * pool * uBright * mix(0.32, 1.0, smoothstep(10.5, 15.5, vViewZ)) + vec3(0.03, 0.05, 0.11) * smoothstep(5.0, 22.0, vWorld.x);
      vec3 col = mix(uInk, face, uFace);
      gl_FragColor = vec4(mix(col, uFog, smoothstep(uFogNear, uFogFar, vViewZ)), a * uAlpha);
    }`;
  type Card = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; blob: THREE.Mesh; roll: number };
  const cardShade = toTex(glowCanvas(128, "0,0,0", 0.6));
  const cards: Card[] = [...FIRST_LINE].map((ch, i) => {
    const mask = toTex(glyphCell(ch, 256, { color: "#fff", scale: 1 }), false);
    const k = ATLAS.indexOf(ch);
    const u = fMat.uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: mask },
        uAtlas: u.uAtlas,
        uCell: { value: new THREE.Vector2((k % cols) / cols, 1 - (Math.floor(k / cols) + 1) / rows) },
        uInk: { value: LOOP_RED },
        uFace: { value: 0 },
        uAlpha: { value: 1 },
        uBright: { value: bright[homeIdx[i]] },
        uLamp: u.uLamp, uFocus: u.uFocus, uAperture: u.uAperture, uPool: u.uPool, uFog: u.uFog, uFogNear: u.uFogNear, uFogFar: u.uFogFar,
      },
      vertexShader: cardVS,
      fragmentShader: cardFS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = 5;
    mesh.visible = false;
    scene.add(mesh);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cardShade, transparent: true, opacity: 0, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = 1;
    blob.visible = false;
    scene.add(blob);
    return { mesh, mat, blob, roll: (i % 2 ? 1 : -1) * (0.06 + 0.06 * ((i * 7) % 5) / 4) };
  });

  // ---------- send button ----------
  const sendCanvas = (active: boolean) => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext("2d")!;
    // v5.6: shows as 朱砂, near enough (measured 184, 48, 45): the room darkens it about 1.86×, and the red
    // channel is at the canvas's full 255 (was COLORS.vermilion, which showed as 144, 16, 9)
    ctx.fillStyle = active ? untonedHex("#c42b26", 1.86) : "#b5aa98";
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f6efe2";
    ctx.lineWidth = 17;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(128, 180);
    ctx.lineTo(128, 76);
    ctx.moveTo(88, 116);
    ctx.lineTo(128, 74);
    ctx.lineTo(168, 116);
    ctx.stroke();
    return c;
  };
  const sendOff = toTex(sendCanvas(false));
  const sendOn = toTex(sendCanvas(true));
  const sendMat = new THREE.MeshBasicMaterial({ map: sendOff, transparent: true, depthWrite: false });
  const SEND_X = 6 + PADC + SEND_D / 2; // 6.9
  const SEND_PLANE = (SEND_D * 128) / 118; // the canvas disc has r = 118 of 128: its painted edge is SEND_D across
  const send = new THREE.Mesh(new THREE.PlaneGeometry(SEND_PLANE, SEND_PLANE), sendMat);
  send.rotation.x = -Math.PI / 2;
  send.position.set(SEND_X, STRIP_Y + 0.015, STRIP_Z);
  send.renderOrder = 3;
  scene.add(send);
  const sendGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "255,86,58", 0.35)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sendGlow.rotation.x = -Math.PI / 2;
  sendGlow.position.set(SEND_X, STRIP_Y + 0.02, STRIP_Z);
  scene.add(sendGlow);

  // ---------- candidate blocks rising from the type floor ----------
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3b, roughness: 0.5, metalness: 0.35, transparent: true });
  const faceCache = new Map<string, THREE.MeshStandardMaterial>();
  const faceMat = (ch: string) => {
    let m = faceCache.get(ch);
    if (!m) {
      const c = glyphCell(ch, 256, { color: "#1b1511", bg: "#e8dcc4", scale: 0.8 });
      const bump = glyphCell(ch, 256, { color: "#000", bg: "#fff", scale: 0.8, blur: 1.5 });
      m = new THREE.MeshStandardMaterial({ map: toTex(c), bumpMap: toTex(bump, false), bumpScale: 2.0, roughness: 0.66, metalness: 0.0, transparent: true, emissive: new THREE.Color(0xff3a1c), emissiveIntensity: 0 });
      faceCache.set(ch, m);
    }
    return m;
  };
  const blockGeo = new THREE.BoxGeometry(0.95, 0.6, 0.95);
  type Block = { mesh: THREE.Mesh; mats: THREE.MeshStandardMaterial[]; cell: [number, number]; home: THREE.Vector3; k: number; blob: THREE.Mesh };
  const blobMat = new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(128, "0,0,0", 0.6)), transparent: true, opacity: 0, depthWrite: false });
  type Group = { blocks: Block[]; label: THREE.Mesh; labelMat: THREE.MeshBasicMaterial; cx: number; width: number };
  const labelTex = (n: number, on: boolean) => toTex(drawText(String(n), { font: SANS, size: 120, weight: 500, color: on ? "#ff6a4c" : "#cbbfac", pad: 10 }).canvas);
  const labelOn = [1, 2, 3].map((n) => labelTex(n, true));
  const labelOff = [1, 2, 3].map((n) => labelTex(n, false));

  const entryGroups: Group[][] = cues.ime.map((e, ei) => {
    const totalCells = e.cands.reduce((a, c) => a + [...c].length, 0) + Math.max(0, e.cands.length - 1);
    // candidates appear near where the word will be printed
    const center = slotX(entrySlots[ei]) + ([...e.word].length - 1) / 2;
    let c0 = Math.round(center - totalCells / 2);
    // v4.1: no further left than −6, the text's first cell (v4.0: −7, and the first two trays, 掂量 and
    // 情思, stood half a cell out past the strip's left edge); on the right they may still reach 7, over
    // the send button, inside the strip — so only those two move, one cell to the right
    c0 = Math.max(-6, Math.min(7 - totalCells, c0));
    let c = c0;
    return e.cands.map((cand, j) => {
      const len = [...cand].length;
      const blocks: Block[] = [...cand].map((ch, k) => {
        const mats = [sideMat.clone(), sideMat.clone(), faceMat(ch).clone(), sideMat.clone(), sideMat.clone(), sideMat.clone()];
        const mesh = new THREE.Mesh(blockGeo, mats);
        const cc = c + k;
        const home = new THREE.Vector3(cc + 0.5 + GX, -0.3, CAND_Z);
        mesh.position.copy(home);
        mesh.visible = false;
        scene.add(mesh);
        const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), blobMat.clone());
        blob.rotation.x = -Math.PI / 2;
        blob.visible = false;
        scene.add(blob);
        return { mesh, mats, cell: [cc, Math.floor(CAND_Z - 0.5)], home, k, blob };
      });
      const cx = c + len / 2 + GX;
      const labelMat = new THREE.MeshBasicMaterial({ map: labelOff[j], transparent: true, depthWrite: false });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.4), labelMat);
      label.position.set(c + 0.12 + GX, 1.15, CAND_Z - 0.05);
      label.visible = false;
      scene.add(label);
      c += len + 1;
      return { blocks, label, labelMat, cx, width: len };
    });
  });
  const hlRing = (() => {
    const cv = makeCanvas(512, 256);
    const x = cv.getContext("2d")!;
    x.strokeStyle = "rgba(255,98,66,1)";
    x.lineWidth = 10;
    x.beginPath();
    x.roundRect(10, 10, 492, 236, 34);
    x.stroke();
    return toTex(cv);
  })();
  const hlFrame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: hlRing, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(hlFrame);
  const hlGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: toTex(glowCanvas(256, "255,80,52", 0.45)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  hlGlow.rotation.x = -Math.PI / 2;
  scene.add(hlGlow);

  // ---------- 联想: the poem's next phrase offers itself, and is not taken ----------
  // After 指尖 the IME suggests what comes next in the poem: 但恐背南辕. Five types
  // half-rise out of the floor and hang there trembling through the hesitation;
  // the finger goes to send instead, and they sink back among the rest.
  const SUGGEST = "但恐背南辕";
  const SUG_C0 = 2; // the five types come out of floor cells 2…6
  // they rise straight up out of their own cells 2…6 (南's right edge is 尖's: x = 6.0, 辕's is 7.0);
  // nearer the lens the risen row looks larger, so as seen its frame reaches almost to the strip's
  // right end (7.8): measured on frame 178, 1757.8 against 1761.7 px — 4 px short. Not aligned on
  // purpose: no block leaves its cell for it (《整体制作指南》8.3)
  const SUG_SLIDE = 0; // v3 slid the risen row 0.14 cell instead, off its cells
  const sugBlocks: Block[] = [...SUGGEST].map((ch, k) => {
    const mats = [sideMat.clone(), sideMat.clone(), faceMat(ch).clone(), sideMat.clone(), sideMat.clone(), sideMat.clone()];
    const mesh = new THREE.Mesh(blockGeo, mats);
    const cc = SUG_C0 + k;
    const home = new THREE.Vector3(cc + 0.5 + GX, -0.3, CAND_Z);
    mesh.position.copy(home);
    mesh.visible = false;
    scene.add(mesh);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), blobMat.clone());
    blob.rotation.x = -Math.PI / 2;
    blob.visible = false;
    scene.add(blob);
    return { mesh, mats, cell: [cc, Math.floor(CAND_Z - 0.5)], home, k, blob };
  });
  const sugLabelMat = new THREE.MeshBasicMaterial({ map: labelOff[0], transparent: true, depthWrite: false });
  const sugLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.4), sugLabelMat);
  sugLabel.position.set(SUG_C0 + 0.12 + GX, 1.15, CAND_Z - 0.05);
  sugLabel.visible = false;
  scene.add(sugLabel);

  // ---------- dust in the lamp light ----------
  const DUST = 420;
  const dr = mulberry32(99);
  const dust0 = new Float32Array(DUST * 3), dustV = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const t = dr();
    dust0[i * 3] = lerp(-6, 0.5, t) + (dr() - 0.5) * 7;
    dust0[i * 3 + 1] = lerp(15, 0.6, t);
    dust0[i * 3 + 2] = lerp(4, 0.2, t) + (dr() - 0.5) * 6;
    dustV[i * 3] = (dr() - 0.5) * 0.22;
    dustV[i * 3 + 1] = (dr() - 0.35) * 0.1;
    dustV[i * 3 + 2] = (dr() - 0.5) * 0.18;
  }
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ map: toTex(glowCanvas(64, "255,226,190", 0.3)), size: 0.09, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(dust);

  // ---------- post ----------
  const post = makePost(renderer, scene, camera, { bloom: [0.42, 0.5, 0.9] });

  post.finish.uniforms.uVignette.value = 0.55;
  post.finish.uniforms.uGrain.value = 0.026;

  const activeEntry = (f: number) => {
    for (let i = cues.ime.length - 1; i >= 0; i--) if (f >= cues.ime[i].keys[0]) return i;
    return -1;
  };
  const hlIndex = (e: Entry, f: number) => {
    let idx = -1;
    for (const [fr, j] of e.hl) if (f >= fr) idx = j;
    return idx;
  };
  const pickedIndex = (e: Entry) => (e.hl.length ? e.hl[e.hl.length - 1][1] : -1);
  const tmp = new THREE.Vector3();
  const hiddenNow = new Set<string>();

  return {
    render(f: number) {
      const tf = sceneT(f);
      // ---------- camera ----------
      // the camera rides along with the cursor like a carriage, then pulls back to show the line
      const curAt = (ff: number) => {
        let xx = slotX(0) - 0.5;
        for (let ei = 0; ei < cues.ime.length; ei++) {
          const e = cues.ime[ei];
          if (ff >= e.keys[0]) xx = slotX(entrySlots[ei]) + ([...e.word].length - 1) / 2;
        }
        return xx;
      };
      let cxs = 0;
      for (let k = -10; k <= 10; k++) cxs += curAt(tf + k);
      cxs /= 21;
      const follow = Math.max(-3.4, Math.min(2.8, cxs * 0.8));
      // (and before the film's first frame, the loop's last second: wide on the strip, back to rest — loopCam)
      const wide = f < 0 ? 1 - easeInOutCubic(prog(f, LOOP.go, LOOP.home)) : easeInOutCubic(prog(tf, 136, WIDE_END));
      // the hesitation: a slow lean toward the send button, never a freeze
      const lean = easeInOutCubic(prog(f, SLOW, cues.hover.send));
      const cam0 = typingCam(follow, wide, lean);
      const camPos = new THREE.Vector3(...cam0.pos);
      const look = new THREE.Vector3(...cam0.look);
      let shake = 0;
      for (const e of cues.ime) {
        const d = f - e.stamp;
        if (d >= 0 && d < 6) shake += (1 - d / 6) * (e.word === "，" ? 0.012 : 0.04);
      }
      const whip = easeInCubic(prog(f, SEND + 1, SEND + 7));
      camPos.y += whip * 4;
      camPos.z -= whip * 2.5;
      look.y += whip * 11;
      look.z -= whip * 4;
      camPos.x += Math.sin(f * 12.9898) * shake;
      camPos.y += Math.cos(f * 78.233) * shake;
      camera.position.copy(camPos);
      camera.lookAt(look);
      fMat.uniforms.uFocus.value = camPos.distanceTo(new THREE.Vector3(0.4, STRIP_Y, 0.4));

      // ---------- dust ----------
      const ts = tf / 30;
      for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = dust0[i * 3] + dustV[i * 3] * ts;
        dustPos[i * 3 + 1] = dust0[i * 3 + 1] + dustV[i * 3 + 1] * ts + Math.sin(ts * 0.7 + i) * 0.06;
        dustPos[i * 3 + 2] = dust0[i * 3 + 2] + dustV[i * 3 + 2] * ts;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // ---------- prints ----------
      for (const p of prints) {
        const d = f - p.stamp;
        if (d < 0) {
          p.mat.opacity = 0;
          continue;
        }
        p.mat.opacity = Math.min(1, 0.6 + d * 0.25);
        const s = 1 + 0.14 * (1 - easeOutCubic(prog(f, p.stamp, p.stamp + 6)));
        p.mesh.scale.set(s, s, s);
        const delay = p.slot * 0.55;
        const u = easeInCubic(prog(f, SEND + 1 + delay, SEND + 11 + delay));
        p.mesh.position.set(slotX(p.slot), STRIP_Y + 0.012 + u * 10, STRIP_Z - u * 2);
        p.mesh.rotation.x = -Math.PI / 2 + u * Math.PI * 0.5;
      }

      // ---------- specks ----------
      cues.ime.forEach((e, ei) => {
        const s0 = entrySlots[ei];
        const len = [...e.word].length;
        const d = f - e.stamp;
        const r = mulberry32(500 + ei);
        for (let k = 0; k < SPECK; k++) {
          const i = (ei * SPECK + k) * 3;
          const ang = r() * Math.PI * 2;
          const dist = 0.35 + r() * 0.5;
          const cx = slotX(s0) + (len - 1) / 2 + Math.cos(ang) * (len * 0.45);
          if (d < 0 || d > 9 || e.word === "，" || f > SEND) {
            speckPos[i + 1] = -10;
            continue;
          }
          const t = easeOutCubic(d / 9);
          speckPos[i] = cx + Math.cos(ang) * dist * t * 0.6;
          speckPos[i + 1] = STRIP_Y + 0.02;
          speckPos[i + 2] = STRIP_Z + Math.sin(ang) * dist * t * 0.5;
        }
      });
      speckGeo.attributes.position.needsUpdate = true;

      // ---------- candidates ----------
      const ai = activeEntry(f);
      fMat.uniforms.uGlow.value = 0;
      (hlGlow.material as THREE.MeshBasicMaterial).opacity = 0;
      (hlFrame.material as THREE.MeshBasicMaterial).opacity = 0;
      const nowHidden = new Set<string>();
      cues.ime.forEach((e, ei) => {
        const groups = entryGroups[ei];
        const picked = pickedIndex(e);
        const showTray = e.tray >= 0 && f >= e.tray && f < e.pick + 8;
        const rise = easeOutBack(prog(f, e.tray, e.tray + 4), 1.8);
        const sink = easeInCubic(prog(f, e.pick, e.pick + 6));
        for (let j = 0; j < groups.length; j++) {
          const g = groups[j];
          const isPicked = j === picked;
          const hi = hlIndex(e, f) === j && f < e.pick + 1;
          g.label.visible = showTray && f < e.pick + 4;
          g.labelMat.map = hi ? labelOn[j] : labelOff[j];
          g.labelMat.opacity = rise * (1 - sink);
          g.label.quaternion.copy(camera.quaternion);
          for (const b of g.blocks) {
            const m = b.mesh;
            const lift = 0.62 * rise + (hi ? 0.22 : 0);
            if (showTray && (f < e.pick + 7 || isPicked)) nowHidden.add(b.cell.join(","));
            (b.mats[2] as THREE.MeshStandardMaterial).emissiveIntensity = hi ? 0.18 : 0;
            if (!isPicked) {
              m.visible = showTray;
              m.position.copy(b.home);
              m.position.y = b.home.y + lift * (1 - sink);
              m.rotation.set(0, 0, 0);
              continue;
            }
            const target = new THREE.Vector3(slotX(entrySlots[ei] + b.k), STRIP_Y + 0.31, STRIP_Z);
            if (f < e.pick) {
              m.visible = showTray;
              m.position.copy(b.home);
              m.position.y = b.home.y + lift;
              m.rotation.set(0, 0, 0);
              b.mats.forEach((mm) => (mm.opacity = 1));
            } else if (f <= e.stamp) {
              m.visible = true;
              const t = e.stamp === e.pick ? 1 : easeInOutCubic(prog(f, e.pick, e.stamp));
              const start = b.home.clone();
              start.y += 0.62 + 0.22;
              tmp.copy(start).lerp(target, t);
              tmp.y = lerp(start.y, target.y, t) + Math.sin(Math.PI * t) * 1.5;
              m.position.copy(tmp);
              m.rotation.set(-Math.PI * t, 0, Math.sin(Math.PI * t) * 0.12);
              b.mats.forEach((mm) => (mm.opacity = 1));
            } else {
              const u = prog(f, e.stamp, e.stamp + 7);
              m.visible = u < 1;
              m.position.copy(target);
              m.position.y = target.y + easeOutCubic(u) * 1.3;
              m.rotation.set(-Math.PI, 0, 0);
              b.mats.forEach((mm) => (mm.opacity = 1 - u));
            }
          }
          for (const b of g.blocks) {
            const m = b.mesh;
            const hgt = m.position.y + 0.3;
            const onStrip = Math.abs(m.position.z - STRIP_Z) < 1.0;
            b.blob.visible = m.visible && hgt > 0.02;
            b.blob.position.set(m.position.x + 0.25, (onStrip ? STRIP_Y : 0) + 0.014, m.position.z + 0.35);
            const op = Math.min(1, hgt / 0.6) * Math.max(0, 1 - Math.max(0, hgt - 0.9) / 2.5) * 0.75 * ((b.mats[0].opacity as number) ?? 1);
            (b.blob.material as THREE.MeshBasicMaterial).opacity = op;
          }
          if (hi && showTray && ei === ai) {
            const a = rise * (1 - sink);
            hlGlow.position.set(g.cx, 0.02, CAND_Z);
            hlGlow.scale.set(g.width + 2.2, 2.6, 1);
            (hlGlow.material as THREE.MeshBasicMaterial).opacity = 0.55 * a;
            hlFrame.position.set(g.cx, -0.3 + 0.62 * rise + 0.22 + 0.315, CAND_Z);
            hlFrame.rotation.set(-Math.PI / 2, 0, 0);
            hlFrame.scale.set(g.width + 0.35, 1.25, 1);
            (hlFrame.material as THREE.MeshBasicMaterial).opacity = 0.9 * a;
            fMat.uniforms.uGlowPos.value.set(g.cx, CAND_Z);
            fMat.uniforms.uGlow.value = 0.9 * a;
          }
        }
      });
      // ---------- 联想 ----------
      {
        const HV = cues.hover;
        const rise = easeOutBack(prog(f, HV.suggest, HV.suggest + 5), 1.6);
        const sink = easeInCubic(prog(f, HV.send, HV.send + 6));
        const show = f >= HV.suggest && f < HV.send + 7;
        const hover = smooth(prog(f, HV.suggest + 5, HV.slow + 2)) * (1 - sink); // the cursor rests on it
        const shiver = smooth(prog(f, HV.slow - 2, HV.slow + 6)) * (1 - sink);
        const slide = SUG_SLIDE * Math.min(1, rise) * (1 - sink);
        sugBlocks.forEach((b, k) => {
          const tr = Math.sin(f * 2.3 + k * 1.9) * 0.6 + Math.sin(f * 3.7 + k * 0.7) * 0.4;
          const lift = 0.62 * rise + 0.22 * hover;
          b.mesh.visible = show;
          b.mesh.position.set(b.home.x + slide, b.home.y + lift * (1 - sink) + 0.03 * tr * shiver, b.home.z);
          b.mesh.rotation.set(0.012 * tr * shiver, 0, 0.03 * Math.sin(f * 2.9 + k * 2.4) * shiver);
          (b.mats[2] as THREE.MeshStandardMaterial).emissiveIntensity = 0.16 * hover;
          if (show) nowHidden.add(b.cell.join(","));
          const hgt = b.mesh.position.y + 0.3;
          b.blob.visible = show && hgt > 0.02;
          b.blob.position.set(b.mesh.position.x + 0.25, 0.014, b.mesh.position.z + 0.35);
          (b.blob.material as THREE.MeshBasicMaterial).opacity = Math.min(1, hgt / 0.6) * 0.75;
        });
        sugLabel.visible = show && f < HV.send + 4;
        sugLabel.position.x = SUG_C0 + 0.12 + GX + slide;
        sugLabelMat.map = hover > 0.5 ? labelOn[0] : labelOff[0];
        sugLabelMat.opacity = rise * (1 - sink);
        sugLabel.quaternion.copy(camera.quaternion);
        if (hover > 0.01 && show) {
          const cx = SUG_C0 + SUGGEST.length / 2 + GX + slide;
          hlGlow.position.set(cx, 0.02, CAND_Z);
          hlGlow.scale.set(SUGGEST.length + 2.2, 2.6, 1);
          (hlGlow.material as THREE.MeshBasicMaterial).opacity = 0.45 * hover * (0.85 + 0.15 * Math.sin(f * 0.9));
          hlFrame.position.set(cx, -0.3 + 0.62 * rise + 0.22 + 0.315, CAND_Z);
          hlFrame.rotation.set(-Math.PI / 2, 0, 0);
          hlFrame.scale.set(SUGGEST.length + 0.35, 1.25, 1);
          (hlFrame.material as THREE.MeshBasicMaterial).opacity = 0.85 * hover;
        }
      }

      // sync hidden floor cells (blocks lifted out of the floor)
      for (const k of hiddenNow) if (!nowHidden.has(k)) {
        const [c, r] = k.split(",").map(Number);
        hideCell(c, r, false);
        hiddenNow.delete(k);
      }
      for (const k of nowHidden) if (!hiddenNow.has(k)) {
        const [c, r] = k.split(",").map(Number);
        hideCell(c, r, true);
        hiddenNow.add(k);
      }
      floor.instanceMatrix.needsUpdate = true;

      // ---------- pinyin & cursor ----------
      let curX = slotX(0) - 0.5;
      for (let ei = 0; ei < cues.ime.length; ei++) {
        const e = cues.ime[ei];
        if (f >= e.stamp) curX = slotX(entrySlots[ei] + [...e.word].length) - 0.5;
      }
      let showPinyin = false;
      if (ai >= 0) {
        const e = cues.ime[ai];
        const typed = e.keys.filter((k) => f >= k).length;
        if (e.py && typed > 0 && f < e.pick) {
          const s = e.py.slice(0, Math.min(e.py.length, Math.round((typed / e.keys.length) * e.py.length)));
          const pt = pinyinTex(s);
          const pm = pinyin.material as THREE.MeshBasicMaterial;
          if (pm.map !== pt.tex) {
            pm.map = pt.tex;
            pm.needsUpdate = true;
          }
          const pw = pt.aspect * pinyinH;
          pinyin.scale.set(pw, pinyinH, 1);
          const left = slotX(entrySlots[ai]) - 0.5; // the insertion point: the pinyin's first letter begins here
          pinyin.position.set(left - pw * pt.from + pw / 2, STRIP_Y + 0.016, STRIP_Z + 0.03);
          curX = left + pw * (pt.to - pt.from); // and the cursor stands right after its last letter
          showPinyin = true;
        }
      }
      pinyin.visible = showPinyin;
      const keyFrames = cues.ime.flatMap((e) => [...e.keys, e.stamp]).filter((k) => k <= f);
      const lastAct = keyFrames.length ? Math.max(...keyFrames) : -100;
      const typing = f - lastAct < 8;
      const blinkOn = Math.floor(f / 7.5) % 2 === 0;
      // (v4.5: before the film's first frame — the loop's last second — it waits at the strip's start, lit,
      // from the moment the line lies there until the last character is home; then it blinks on into frame 0)
      cursor.visible = f < 0 ? f >= LOOP.laid && (f < LOOP.lands[0] + LOOP.settle || blinkOn) : f < SEND + 2 && (typing || blinkOn);
      cursor.position.set(curX + CUR_W / 2, STRIP_Y + 0.018, STRIP_Z);

      // ---------- 字回字盘 (v4.5) ----------
      for (let i = 0; i < cards.length; i++) {
        const k = cards[i];
        const d = LOOP.depart[i], l = LOOP.lands[i];
        floorInk[homeIdx[i]] = f < 0 && f < l ? 0 : 1;
        const on = f < 0 && f >= LOOP.laid && f < l + LOOP.settle;
        k.mesh.visible = on;
        k.blob.visible = false;
        if (!on) continue;
        const [hc, hr] = LOOP_HOME[i];
        const sx = slotX(i), sy = LOOP_STRIP.y, sz = STRIP_Z;
        const hx = hc + 0.5 + GX, hy = floorH[homeIdx[i]] + 0.004, hz = hr + 0.5;
        let x = sx, y = sy, z = sz, em = LOOP_STRIP.em, tilt = 0, roll = 0, face = 0, alpha = 1;
        if (f >= l) {
          // home: the cell has its character back, and the card fades into it
          [x, y, z, em, face] = [hx, hy, hz, 0.76, 1];
          alpha = 1 - smooth(prog(f, l, l + LOOP.settle));
        } else if (f >= d) {
          // the hop: forward off the strip and down into its cell, tipping toward us on the way
          const t = (f - d) / (l - d);
          x = lerp(sx, hx, t);
          z = lerp(sz, hz, t);
          y = lerp(sy, hy, t) + 1.2 * t * (1 - t);
          em = lerp(LOOP_STRIP.em, 0.76, smooth(t));
          tilt = 0.35 * Math.sin(Math.PI * t);
          roll = k.roll * Math.sin(Math.PI * t);
          face = smooth(prog(t, 0.55, 1)); // red until it nears the type, then the type's own face
          // and its shadow, cast by the lamp on the strip or the type under it
          const over = Math.abs(x - STRIP_X) < stripW / 2 && Math.abs(z - STRIP_Z) < stripD / 2;
          const ground = over ? STRIP_Y : 0.03;
          const hgt = y - ground, s = hgt / (key.position.y - y);
          k.blob.visible = hgt > 0.005;
          k.blob.position.set(x + (x - key.position.x) * s, ground + 0.006, z + (z - key.position.z) * s);
          k.blob.scale.set(em * 1.5, em * 1.5, 1);
          (k.blob.material as THREE.MeshBasicMaterial).opacity = 0.42 * Math.min(1, hgt / 0.12) * (1 - 0.55 * Math.min(1, hgt / 0.7));
        }
        k.mesh.position.set(x, y, z);
        k.mesh.rotation.set(-Math.PI / 2 + tilt, 0, roll);
        k.mesh.scale.set(em, em, 1);
        k.mat.uniforms.uFace.value = face;
        k.mat.uniforms.uAlpha.value = alpha;
      }
      floorGeo.attributes.aInk.needsUpdate = true;

      // ---------- send button ----------
      sendMat.map = f >= cues.ime[0].stamp ? sendOn : sendOff;
      const beat = (d: number) => (d >= 0 ? Math.exp(-d / 3.5) * (1 - Math.exp(-d * 1.4)) * 1.6 : 0);
      const pulse = beat(f - B1) + 0.75 * beat(f - B1 - 5) + beat(f - B2) + 0.75 * beat(f - B2 - 5);
      const breath = (x: number) => 1 + 0.06 * Math.sin(((x - 150) / 15) * Math.PI * 2);
      let ss = 1;
      if (f >= 150 && f < SEND) ss = (f < SLOW ? breath(f) : breath(SLOW) + (1 - breath(SLOW)) * prog(f, SLOW, SLOW + 6)) + 0.1 * pulse;
      if (f >= SEND) ss = f < SEND + 3 ? lerp(1, 0.8, prog(f, SEND, SEND + 2)) : lerp(0.8, 1.06, easeOutBack(prog(f, SEND + 3, SEND + 9)));
      send.scale.set(ss, ss, ss);
      const sg = f >= SEND ? Math.exp(-(f - SEND) / 5) : f >= 150 ? 0.16 + 0.08 * Math.sin(((Math.min(f, SLOW) - 150) / 15) * Math.PI * 2) + 0.35 * pulse : 0;
      (sendGlow.material as THREE.MeshBasicMaterial).opacity = sg;
      if (f >= 150) {
        fMat.uniforms.uGlowPos.value.set(SEND_X, STRIP_Z + 0.9);
        fMat.uniforms.uGlow.value = f >= SEND ? 1.6 * Math.exp(-(f - SEND) / 6) : 0.25 * sg;
      }

      // ---------- post ----------
      post.finish.uniforms.uSeed.value = f;
      post.finish.uniforms.uBlur.value.set(0, 0.12 * whip);
      post.finish.uniforms.uFlash.value = f >= SEND ? 0.05 * Math.exp(-(f - SEND) / 3) : 0;
      if (((globalThis as any).__flags ?? {}).direct) renderer.render(scene, camera); else post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
