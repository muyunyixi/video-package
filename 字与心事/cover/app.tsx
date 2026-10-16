// 封面 · cover drafts for 字与心事, made from the film's own elements (its paper, lattice, branches,
// roofs, colours, type) and set with the film's own typesetting (lib/ink), 1080×1440 (3:4).
// Kept outside src/: the film's code coda shows src/, so nothing here changes the film.
// Rendered by cover/shoot.mjs at a pixel ratio of 2 and scaled down; the scene comes from ?scene=.
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { createClockCover } from "./clockCover";
import { paperCanvas } from "../src/lib/textures";
import { lanternLattice } from "../src/lib/lattice";
import { southBranchCanvas, northBranchCanvas } from "../src/lib/branches";
import { nearRoofs, ROOF_H } from "../src/lib/roofs";
import { lineInk, glyphInk, spanTop, type LineInk } from "../src/lib/ink";
import { COLORS, HW } from "../src/lib/util";

const CW = 1080, CH = 1440;
const TITLE = "字与心事";
const SUB = "从落笔，到有人读懂";

// ---------- the type: the opening's title and subtitle, set as the film sets lines ----------
// (《文案撰写指南》8.3: the title one line, centred on its cells, its ink top at y 170, its line of ink
// about 70% of the width; tracking in the opening's own proportions, added between cells as the
// opening adds it (title: 36 at 320 px; subtitle: 34 at 120 px). The drafts had the title at 0.22 em:
// that is the gap between the opening's inks (its tracking plus the glyphs' side bearings), taken for
// the tracking, so the side bearings were counted twice and the title stood 1.4 times as loose as the
// opening's. The subtitle 60 px, 70 px under the title's ink; a short vermilion rule under it)
export type TypeStyle = "ink" | "light" | "moon";
const T = { size: 178, track: 36 / 320, inkTop: 170, sSize: 60, sTrack: 34 / 120, gap: 70, ruleW: 0.2, ruleH: 5, ruleGap: 34 };

type Glyph = { ch: string; left: number; top: number; size: number; color: string; shadow?: string };
function setLine(text: string, size: number, track: number, inkTop: number, color: (i: number) => string, shadow?: (i: number) => string) {
  const chars = [...text];
  const tr = Math.round(size * track);
  const L: LineInk = lineInk(chars, size, chars.map((_, i) => (i ? tr : 0)));
  const x0 = CW / 2 - (L.boxL + L.boxR) / 2;
  const baseline = inkTop - L.inkT;
  const glyphs: Glyph[] = chars.map((ch, i) => ({ ch, left: x0 + L.xs[i], top: spanTop(baseline, size), size, color: color(i), shadow: shadow?.(i) }));
  return { glyphs, L, x0, baseline, inkTop: baseline + L.inkT, inkBottom: baseline + L.inkB, inkL: x0 + L.inkL, inkR: x0 + L.inkR };
}

const PALETTE: Record<TypeStyle, { a: string; b: string; sub: string; rule: string; glowA?: string; glowB?: string; glowS?: string }> = {
  // paper: the opening's own colours (title 墨 + 朱砂, subtitle 淡墨)
  ink: { a: COLORS.ink, b: COLORS.vermilion, sub: COLORS.inkSoft, rule: COLORS.vermilion },
  // 漏声长: the line's light on the water — warm white, with its glow; 心事 a warm vermilion light
  light: {
    a: "#fff1dc", b: "#ff8a6a", sub: "#efdcc2", rule: "#ff7a5c",
    glowA: "0 0 3px rgba(255,226,182,0.95), 0 0 14px rgba(255,204,148,0.6), 0 0 40px rgba(255,176,104,0.32)",
    glowB: "0 0 3px rgba(255,138,106,0.95), 0 0 14px rgba(255,96,64,0.55), 0 0 40px rgba(255,80,48,0.3)",
    glowS: "0 0 3px rgba(255,220,170,0.6), 0 0 12px rgba(255,200,140,0.3)",
  },
  // the night: 月白, and the 朱砂 of the HUD's seal, a little hotter on the dark
  moon: {
    a: COLORS.moon, b: COLORS.vermilionHot, sub: "#dfe6ea", rule: COLORS.vermilionHot,
    glowA: "0 0 10px rgba(230,236,239,0.35), 0 0 28px rgba(200,214,232,0.2)",
    glowB: "0 0 10px rgba(226,73,63,0.35)",
    glowS: "0 0 8px rgba(11,16,27,0.7)",
  },
};

const TypeLayer: React.FC<{ style: TypeStyle }> = ({ style }) => {
  const P = PALETTE[style];
  const t = setLine(TITLE, T.size, T.track, T.inkTop, (i) => (i >= 2 ? P.b : P.a), (i) => (i >= 2 ? P.glowB ?? "" : P.glowA ?? ""));
  const s = setLine(SUB, T.sSize, T.sTrack, t.inkBottom + T.gap, () => P.sub, () => P.glowS ?? "");
  const sw = s.inkR - s.inkL;
  const rw = Math.round(sw * T.ruleW);
  const ruleTop = s.inkBottom + T.ruleGap;
  (window as any).__type = { title: { inkTop: t.inkTop, inkBottom: t.inkBottom, inkL: t.inkL, inkR: t.inkR }, sub: { inkTop: s.inkTop, inkBottom: s.inkBottom, inkL: s.inkL, inkR: s.inkR }, rule: { top: ruleTop, w: rw } };
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {[...t.glyphs, ...s.glyphs].map((g, i) => (
        <span key={i} style={{ position: "absolute", left: g.left, top: g.top, fontFamily: HW, fontSize: g.size, lineHeight: 0, whiteSpace: "pre", color: g.color, textShadow: g.shadow || undefined }}>
          {g.ch}
        </span>
      ))}
      <div style={{ position: "absolute", left: CW / 2 - rw / 2, top: ruleTop, width: rw, height: T.ruleH, background: P.rule, boxShadow: style === "light" ? "0 0 8px rgba(255,96,64,0.7)" : undefined }} />
    </div>
  );
};

// ---------- canvases at the pixel ratio of the shot ----------
const DPR = 2;
function hiCanvas() {
  const c = document.createElement("canvas");
  c.width = CW * DPR;
  c.height = CH * DPR;
  const ctx = c.getContext("2d")!;
  ctx.scale(DPR, DPR);
  return { c, ctx };
}
const url = (c: HTMLCanvasElement) => c.toDataURL("image/png");
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 窗棂月影: the ending's page, set upright ----------
// the ending's paper and its moonlight through the 灯笼锦 lattice (Ending.tsx: latticeShade), the
// film's own source faint through the paper, and the slip of the first line sealed 懂
function windowLayers() {
  const paper = paperCanvas(CW * DPR, CH * DPR, { base: "#ece7dd", seed: 41, mottle: 0.3, fibers: 5200, speck: 1700 });
  const { c, ctx } = hiCanvas();
  const S = "rgb(178,166,152)";
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, CW, CH);
  const place = () => {
    ctx.translate(560, 930);
    ctx.transform(1, 0.05, -0.2, 1, 0, 0);
    ctx.rotate(-0.06);
  };
  const w = 1060, h = 1240;
  ctx.save(); place();
  ctx.globalCompositeOperation = "destination-out";
  ctx.filter = "blur(26px)";
  ctx.fillStyle = "#000";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.save(); place();
  ctx.filter = "blur(9px)";
  ctx.fillStyle = "rgba(178,166,152,0.62)";
  lanternLattice(ctx, -w / 2, -h / 2, w, h, 26);
  ctx.restore();
  return { paper: url(paper), shade: url(c) };
}
const WindowScene: React.FC = () => {
  const [L] = useState(windowLayers);
  // the film's own source, faint through the paper: the ending's few lines, as in the film
  const lines = [
    "type ThemeLine = { text: string; at: number; y?: number; below?: number;",
    "const THEME: ThemeLine[] = [",
    '  { text: "从落笔到被读懂，", at: E.l1, y: 410, size: 58 },',
    '  { text: "方式一直在变，", at: E.l2, below: 1.35 * 58 },',
    '  { text: "有些心事却一直相通。", at: E.l3, red: "心事" },',
    "];",
    'const SIGN = "/muyun.";',
  ];
  const SLIP = { x: 912, y0: 690, size: 30, step: 39 };
  const first = [..."掂量情思敲字句，轻顿指尖"];
  const slipTop = SLIP.y0 - 36, slipBot = SLIP.y0 + (first.length - 1) * SLIP.step + 34;
  const SEAL = { x: SLIP.x, y: slipBot + 46, size: 46 };
  const g34 = glyphInk("懂", 34);
  return (
    <>
      <img src={L.paper} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      <div style={{ position: "absolute", left: 120, top: 620, fontFamily: '"Latin Modern Mono", monospace', fontSize: 25, lineHeight: "46px", color: "rgba(22,21,25,0.085)", whiteSpace: "pre", filter: "blur(0.5px)" }}>
        {lines.join("\n")}
      </div>
      <img src={L.shade} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, mixBlendMode: "multiply", opacity: 0.42 }} />
      <div style={{ position: "absolute", left: SLIP.x - 38, top: slipTop, width: 76, height: slipBot - slipTop, background: "rgba(250,247,240,0.55)", boxShadow: "0 1px 3px rgba(60,40,20,0.08)", outline: "1.5px solid rgba(192,48,44,0.55)" }}>
        <div style={{ position: "absolute", inset: 5, border: "1px solid rgba(192,48,44,0.35)" }} />
      </div>
      {first.map((ch, i) => {
        const g = glyphInk(ch, SLIP.size);
        const cy = SLIP.y0 + i * SLIP.step;
        return (
          <span key={i} style={{ position: "absolute", left: SLIP.x - (g.l + g.r) / 2, top: spanTop(cy - (g.t + g.b) / 2, SLIP.size), fontFamily: HW, fontSize: SLIP.size, lineHeight: 0, color: "rgba(22,21,25,0.78)" }}>
            {ch}
          </span>
        );
      })}
      <div style={{ position: "absolute", left: SEAL.x - SEAL.size / 2, top: SEAL.y - SEAL.size / 2, width: SEAL.size, height: SEAL.size, transform: "rotate(-4deg)" }}>
        <div style={{ position: "absolute", inset: 0, background: COLORS.vermilion, borderRadius: 4 }} />
        <span style={{ position: "absolute", left: (SEAL.size - g34.l - g34.r) / 2, top: spanTop(SEAL.size / 2 - (g34.t + g34.b) / 2, 34), fontFamily: HW, fontSize: 34, lineHeight: 0, color: "#f4ede2" }}>懂</span>
      </div>
      <TypeLayer style="ink" />
    </>
  );
};

// ---------- 南北月: 子正's two halves of one night, the moon on the fold ----------
// sky colours sampled from the film's 子正 (frame 1430, away from the moon); the branches and the
// roofs are the film's own canvases (lib/branches, lib/roofs); the moon as the film draws it at
// rest: a soft-edged disc, warm on the south half and cold on the north, with its glow
function moonLayer() {
  const { c, ctx } = hiCanvas();
  const SEAM = CW / 2;
  const sky = (x0: number, x1: number, stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, x1 - x0, CH);
  };
  sky(0, SEAM, [[0, "rgb(66,55,50)"], [0.3, "rgb(86,72,64)"], [0.55, "rgb(108,92,82)"], [0.8, "rgb(112,88,70)"], [1, "rgb(122,98,78)"]]);
  sky(SEAM, CW, [[0, "rgb(30,41,66)"], [0.3, "rgb(44,57,84)"], [0.55, "rgb(66,78,100)"], [0.8, "rgb(50,66,94)"], [1, "rgb(42,56,82)"]]);
  // stars, more on the clear north side
  const r = mulberry32(7);
  for (let i = 0; i < 70; i++) {
    const north = r() < 0.7;
    const x = north ? SEAM + r() * SEAM : r() * SEAM;
    const y = r() * CH * 0.62;
    ctx.fillStyle = `rgba(235,240,248,${0.25 + r() * 0.6})`;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + r() * 1.1, 0, Math.PI * 2); ctx.fill();
  }
  // the moon
  const M = { x: SEAM + 10, y: 790, r: 205 };
  const glow = ctx.createRadialGradient(M.x, M.y, M.r * 0.9, M.x, M.y, M.r * 2.3);
  glow.addColorStop(0, "rgba(236,232,226,0.34)");
  glow.addColorStop(0.35, "rgba(226,224,222,0.12)");
  glow.addColorStop(1, "rgba(220,220,224,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);
  for (const [x0, x1, col] of [[0, SEAM, "rgb(246,239,230)"], [SEAM, CW, "rgb(232,238,245)"]] as [number, number, string][]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, CH); ctx.clip();
    const d = ctx.createRadialGradient(M.x, M.y, 0, M.x, M.y, M.r);
    d.addColorStop(0, col); d.addColorStop(0.93, col); d.addColorStop(1, "rgba(240,238,234,0)");
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(M.x, M.y, M.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // the fold itself: the two halves meet in a hair of light
  ctx.fillStyle = "rgba(235,232,226,0.18)";
  ctx.fillRect(SEAM - 0.75, 0, 1.5, CH);
  // the branches: south (apricot in bloom) from the left, north (peach in bud) from the right, each
  // kept to its own half — in the film neither crosses the fold
  const BS = 0.62;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, SEAM, CH); ctx.clip();
  ctx.drawImage(southBranchCanvas(), -60, 560, 1100 * BS, 1160 * BS);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(SEAM, 0, CW - SEAM, CH); ctx.clip();
  ctx.drawImage(northBranchCanvas(), SEAM - 40, 520, 1100 * BS, 1160 * BS);
  ctx.restore();
  // the roofs of both sides along the foot, his window and hers lit
  const WIN_S = { x: 318, y: 1004 }, WIN_N = { x: 1612, y: 996 };
  const rf = nearRoofs(WIN_S, WIN_N);
  const k = CW / 1920;
  const top = CH - ROOF_H * k;
  ctx.drawImage(rf, 0, top, CW, ROOF_H * k);
  for (const w of [WIN_S, WIN_N]) {
    const x = w.x * k, y = top + (w.y - 780) * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
    g.addColorStop(0, "rgba(255,196,120,0.55)"); g.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 40, y - 40, 80, 80);
  }
  return url(c);
}
const MoonScene: React.FC = () => {
  const [bg] = useState(moonLayer);
  return (
    <>
      <img src={bg} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      <TypeLayer style="moon" />
    </>
  );
};

// ---------- 活字: the forme that prints the title (the title scene's twelve blocks) ----------
// the opening's paper; the forme cut out of the film's own render of frame 186 (cover/forme_cut.py),
// tilted across the lower half, its ends running off the page; a soft shadow under it
function formeLayer(forme: HTMLImageElement) {
  const paper = paperCanvas(CW * DPR, CH * DPR, { seed: 12, base: COLORS.paper, fibers: 9000, speck: 2600 });
  const { c, ctx } = hiCanvas();
  ctx.drawImage(paper, 0, 0, CW, CH);
  const fw = 2150, fh = fw * (forme.height / forme.width);
  ctx.save();
  ctx.translate(CW / 2 - 60, 950);
  ctx.rotate(-0.12);
  // the shadow it casts on the paper as it comes down
  ctx.save();
  ctx.translate(30, fh * 0.55);
  ctx.filter = "blur(26px)";
  ctx.fillStyle = "rgba(60,48,36,0.32)";
  ctx.fillRect(-fw / 2 + 60, -fh * 0.3, fw - 120, fh * 0.55);
  ctx.restore();
  ctx.drawImage(forme, -fw / 2, -fh / 2, fw, fh);
  ctx.restore();
  return url(c);
}
const FormeScene: React.FC = () => {
  const [bg, setBg] = useState<string | null>(null);
  useEffect(() => {
    const im = new Image();
    im.onload = () => setBg(formeLayer(im));
    im.src = "../out/cover/forme_186.png";
  }, []);
  if (!bg) return null;
  return (
    <>
      <img src={bg} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      <TypeLayer style="ink" />
    </>
  );
};

// ---------- 漏声长: the film's own 更漏, its line written as the title ----------
// cover/clockCover.ts is the film's ray-traced water clock with 字与心事 for its line, drawn at the
// cover's size; at frame 884 the seventh drop has stopped in front of the line and time with it, the
// camera close: the line out of focus behind, the drop sharp, the title upside down inside it
const CLOCK_FRAME = 884;
const YF = 0.035 + 0.12, ZD = -4.65;
// the camera 0.645 from the drop, a little to the left, so that what lies straight behind the drop is
// 心 (its cell's centre, half a pitch right of the line's middle, 0.35 behind the drop): the drop, a
// ball lens, shows it upside down in its middle; aimed a little above the drop, which sits low
const CLOCK_CAM = { pos: [-0.2307, YF, ZD + 0.6023], look: [0, YF + 0.0432, ZD] };
const ClockScene: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const cam = new URLSearchParams(location.search).get("cam");
    (window as any).__coverCam = cam ? JSON.parse(cam) : CLOCK_CAM;
    const r = new THREE.WebGLRenderer({ canvas: ref.current!, antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(CW * DPR, CH * DPR, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const h = createClockCover(r);
    h.render(CLOCK_FRAME);
    setDone(true);
  }, []);
  return (
    <>
      <canvas ref={ref} width={CW * DPR} height={CH * DPR} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      {done && <TypeLayer style="light" />}
    </>
  );
};

// ---------- the page ----------
const SCENES: Record<string, React.FC> = { window: WindowScene, moon: MoonScene, forme: FormeScene, clock: ClockScene };
const App: React.FC = () => {
  const name = new URLSearchParams(location.search).get("scene") || "window";
  const S = SCENES[name];
  useEffect(() => {
    // the images are data URLs or loaded before their scene renders; give layout two frames
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => ((window as any).coverReady = true)));
    // ready when the type is set (every scene sets it last) and every image has loaded
    const wait = () => {
      const imgs = [...document.images];
      if (document.querySelector("#c span") && imgs.every((i) => i.complete)) done();
      else setTimeout(wait, 50);
    };
    wait();
  }, []);
  return (
    <div id="c" style={{ position: "relative", width: CW, height: CH, overflow: "hidden", background: "#000" }}>
      <S />
    </div>
  );
};

Promise.all([document.fonts.load('100px "HW"', TITLE + SUB + "掂量情思敲字句，轻顿指尖懂"), document.fonts.load('25px "Latin Modern Mono"', "const")]).then(() =>
  createRoot(document.getElementById("root")!).render(<App />)
);
