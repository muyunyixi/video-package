import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import cues from "./cues.json";
import { ThreeLayer } from "./lib/ThreeLayer";
import { createTyping } from "./scenes/typing";
import { createTitle } from "./scenes/title";
import { createThread } from "./scenes/thread";
import { createInkheart } from "./scenes/inkheart";
import { createSpring, SPRING_COL, SPRING_GATHER } from "./scenes/spring";
import { createClock, CLOCK_PREROLL, CLOCK_IN } from "./scenes/clock";
import { SplitColumn, type VGlyph } from "./Vertical";
import { Chat } from "./scenes/Chat";
import { createMoon } from "./scenes/moon";
import { Reply } from "./scenes/Reply";
import { Rewrite } from "./scenes/Rewrite";
import { createCity } from "./scenes/city";
import { Ending } from "./scenes/Ending";
import { PoemLine, glyphsOf, stackLines, type Line } from "./Poem";
import { HUD } from "./HUD";
import { COLORS, HW, prog, smooth, lerp } from "./lib/util";

export const SAMPLE_FRAMES = cues.total;

type Seg = { from: number; to: number; create: Parameters<typeof ThreeLayer>[0]["create"] };

// Each WebGL scene owns one context; Remotion mounts it only inside its window.
const SC = cues.scenes;
const SEGMENTS: Seg[] = [
  { from: SC.typing[0], to: SC.typing[1], create: createTyping },
  { from: SC.title[0], to: SC.title[1], create: createTitle },
  { from: SC.thread[0], to: SC.thread[1], create: createThread },
  { from: SC.inkheart[0], to: SC.inkheart[1], create: createInkheart },
  { from: SC.spring[0], to: SC.spring[1], create: createSpring },
  // v4.1: it dissolves in over 南北 (25.8–26.0 s); the first drop is seen for a beat before it lands on
  // the first drip, at 26.5 s (a beat was inserted at 26.0 s; v4.0 cut in on the drip)
  { from: SC.clock[0] - CLOCK_PREROLL, to: cues.clock.match + 2, create: createClock },
  { from: SC.moon[0], to: SC.moon[1], create: createMoon },
  { from: SC.city[0], to: SC.city[1], create: createCity },
  // v4.0 · 字回字盘: the last half second is the opening's own room, run up to the frame before
  // the film's first (typing scene at −15 … −1), under the listing as it lets go — so the film
  // ends on the frame that leads into its first, and plays round without a seam
  { from: cues.loop.start, to: cues.loop.end, create: (r) => {
    const h = createTyping(r);
    return { render: (f: number) => h.render(f - cues.loop.end), dispose: h.dispose };
  } },
];

const night = (f: number) => smooth(prog(f, 418, 470));
const mixHex = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

// 一线 山南 海北。 — word gaps instead of punctuation, centred on the ink
const TW = cues.thread.words;
const wordGlyphs = (wi: number[], gaps: number[], color?: (i: number) => string | undefined) =>
  wi.flatMap((w, n) => [...TW[w].text].map((ch, k) => ({ ch, at: TW[w].at[k], gapBefore: k === 0 && n > 0 ? gaps[n - 1] : undefined, color: color?.(n) })));
const LINE1: Line = {
  glyphs: wordGlyphs([0, 1, 2], [46, 46]),
  x: 960,
  y: 205,
  size: 118,
  tracking: 8,
  out: [404, 420],
  color: () => COLORS.ink,
  halo: "rgba(236,233,225,0.95)",
  reveal: "slam",
};
// v4.0: the line sits over hills, water and the telegraph poles, so like 一线 it gets a halo; the
// halo and the ink turn over together when the water behind them goes dark (15.0–15.5 s, measured:
// the background under the line is ~175 until 15.1 s and ~85 by 15.5 s). v3.1 turned the ink pale
// from 13.9 s on, while the water was still light, and the poles crossed a mid-grey line.
const dusk2 = (f: number) => smooth(prog(f, 448, 466));
const LINE2: Line = {
  glyphs: wordGlyphs([3, 4], [30], (n) => (n === 1 ? COLORS.vermilion : undefined)).map((g) => (g.ch === "。" ? { ...g, color: undefined } : g)),
  x: 960,
  y: 868,
  size: 104,
  tracking: 6,
  out: [498, 508],
  color: (f) => mixHex([22, 21, 25], [236, 232, 224], dusk2(f)),
  glow: (f) => night(f),
  halo: (f, colored) => {
    const d = dusk2(f);
    // a pale halo the colour of the water while the ink is dark, a dusk one once it is pale — but not for
    // 红笺小字, whose red glows at night instead: v4.5, its pale halo fades out under the glow (v4.4
    // dropped it at 13.97 s, the glow's first frame)
    if (d < 0.5) return `rgba(196,201,214,${(0.85 * (1 - 2 * d)).toFixed(3)})`;
    return colored ? undefined : `rgba(44,32,46,${(0.8 * (2 * d - 1)).toFixed(3)})`;
  },
  reveal: "slam",
};

// 与君南北不同春。 — set vertically on the fold
const SP = cues.spring;
// v4.0: the first six are gathered out of petals (left halves) and snow (right halves), see
// scenes/spring SPRING_GATHER; 春 still slams down, 。 seeps in
const SPRING_GLYPHS: VGlyph[] = [
  ...SPRING_GATHER.map((g): VGlyph => ({ ch: g.ch, at: g.at, from: "gather", lead: g.sides === "L" ? "L" : g.sides === "R" ? "R" : undefined })),
  { ch: "春", at: SP.chun, from: "slam" },
  { ch: "。", at: SP.stop, from: "ink" },
];
const SpringText: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  return (
    <SplitColumn
      f={f}
      glyphs={SPRING_GLYPHS}
      x={SPRING_COL.x}
      // the column's ink (与 at the top to the 。, which sits mid-cell, at the foot) was centred between
      // the frame's top and the credit's ink top (1004) in v3.1: 128.0 px above, 128.1 below. v4.0: 2 px
      // lower, as the user asked (yCenter 513 → 515); v4.5: yCenter worked out from the glyphs' ink
      // (scenes/spring SPRING_COL), 515.57
      yCenter={SPRING_COL.yCenter}
      size={SPRING_COL.size}
      step={SPRING_COL.step}
      // gone as the pool comes in (v4.1: as it dissolves in, 774–780)
      out={[CLOCK_IN[1] - 10, CLOCK_IN[1]]}
      warm="#efe2d0"
      cold="#e1e9f3"
      warmGlow="rgba(226,168,120,0.42)"
      coldGlow="rgba(140,170,230,0.4)"
    />
  );
};

// 昔人多恨漏声长， is written into the 更漏 scene itself (v4.0: scenes/clock); on the chat it is rewritten
// into 只今无处听更漏。 (v4.1: scenes/Rewrite)

// 此夜心同明月在， / 照见卿卿，别后许多年。
// v4.0: up 30 px with the moon (v3.1: 828 / 938), and 1.35 × 80 = 108 apart, baseline to baseline
const MN = cues.moon;
const MOON1: Line = {
  glyphs: glyphsOf("此夜心同明月在，", MN.line1, 4),
  x: 960,
  y: 798,
  size: 80,
  tracking: 10,
  out: [MN.end - 12, MN.end - 2],
  color: () => "#eef1f2",
  halo: "rgba(10,14,23,0.85)",
  reveal: "ink",
  exit: "blur",
};
const MOON2: Line = {
  glyphs: glyphsOf("照见卿卿，别后许多年。", MN.line2, 4),
  x: 960,
  y: 906,
  size: 80,
  tracking: 10,
  out: [MN.end - 12, MN.end - 2],
  color: () => "#eef1f2",
  halo: "rgba(10,14,23,0.85)",
  reveal: "ink",
  exit: "blur",
};
const MoonText: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  const [a, b] = stackLines([MOON1, MOON2], MOON1.y);
  return (
    <>
      <PoemLine line={a} frame={f} />
      <PoemLine line={b} frame={f} />
    </>
  );
};

// 击壤忽然成古史， / 人间灯火灿于星。
const CT = cues.city;
const cityLine = (text: string, at: number, y: number): Line => ({
  glyphs: glyphsOf(text, at, 4),
  x: 960,
  y,
  size: 80,
  tracking: 10,
  out: [CT.dive - 4, CT.dive + 8],
  color: () => "#f3ebdb",
  halo: "rgba(6,8,14,0.85)",
  reveal: "ink",
  exit: "blur",
});
// v4.0: 1.35 × 80 = 108 apart, baseline to baseline (v3.1: 104 between ink centres)
const CITY1 = cityLine("击壤忽然成古史，", CT.line1, 160);
const CITY2 = cityLine("人间灯火灿于星。", CT.line2, 268);
const CityText: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  const [a, b] = stackLines([CITY1, CITY2], CITY1.y);
  return (
    <>
      <PoemLine line={a} frame={f} />
      <PoemLine line={b} frame={f} />
    </>
  );
};

const SECTIONS: { key: keyof typeof cues.scenes; el: (from: number) => React.ReactNode }[] = [
  { key: "spring", el: (from) => <SpringText from={from} /> },
  { key: "moon", el: (from) => <MoonText from={from} /> },
  { key: "reply", el: (from) => <Reply from={from} /> },
  { key: "city", el: (from) => <CityText from={from} /> },
];

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      {SEGMENTS.map((s) => (
        <Sequence key={s.from} from={s.from} durationInFrames={s.to - s.from} layout="none">
          <ThreeLayer create={s.create} from={s.from} />
        </Sequence>
      ))}
      <Sequence from={270} durationInFrames={242} layout="none">
        <Abs from={270}>
          <PoemLine line={LINE1} />
          <PoemLine line={LINE2} />
        </Abs>
      </Sequence>
      <Sequence from={cues.clock.match} durationInFrames={cues.history.end - cues.clock.match} layout="none">
        <Chat from={cues.clock.match} />
        <Rewrite from={cues.clock.match} />
      </Sequence>
      {SECTIONS.map(({ key, el }) => {
        const [a, b] = cues.scenes[key];
        return (
          <Sequence key={key} from={a} durationInFrames={b - a} layout="none">
            {el(a)}
          </Sequence>
        );
      })}
      {/* 片尾 and the code coda share one page */}
      <Sequence from={cues.ending.start} durationInFrames={cues.loop.end - cues.ending.start} layout="none">
        <Ending from={cues.ending.start} />
      </Sequence>
      <HUD />
    </AbsoluteFill>
  );
};

/** Children read absolute frames: re-offset the Sequence clock. */
const FrameCtx = React.createContext(0);
export const useAbsFrame = () => useCurrentFrame() + React.useContext(FrameCtx);
const Abs: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => {
  const f = useCurrentFrame() + from;
  return (
    <FrameCtx.Provider value={from}>
      {React.Children.map(children, (c) => (React.isValidElement(c) ? React.cloneElement(c as React.ReactElement<any>, { frame: f }) : c))}
    </FrameCtx.Provider>
  );
};

export { glyphsOf };
