// Scenes F2 + G · 只今无处听更漏。 / 许多年前 (29–37.2 s)
// The chat, set on red-ruled letter paper (信笺). The drop from the water clock
// shrinks into the first of three "typing" dots; they fall like drips, then
// stop. Waiting, the sender scrolls back — years of messages, every one a line
// of 桃子's poems — to the first 520, and searches the history for 月.
import React from "react";
import { useCurrentFrame } from "remotion";
import cues from "../cues.json";
import { HW, SERIF, SANS, COLORS, clamp, prog, smooth, lerp, easeOutCubic, easeInOutCubic, easeInCubic, easeOutBack, mulberry32 } from "../lib/util";
import { glyphInk, lineInk, spanTop, penInCell } from "../lib/ink";
import { FIRST_LINE } from "./typing";
import { DriftShape, fallPose, type DriftKind } from "../lib/drift";

const K = cues.clock;
const Hh = cues.history;

type Msg = { kind: "mine" | "theirs" | "date"; text: string; read?: boolean };
// oldest first; the history is a poetry anthology
export const HISTORY: Msg[] = [
  { kind: "date", text: "2019年5月20日" },
  { kind: "theirs", text: "长街时有草虫鸣。" },
  { kind: "mine", text: "挽手慢慢行。" },
  { kind: "theirs", text: "忽然云散，明月明明，" },
  { kind: "mine", text: "照见卿卿。" },
  { kind: "date", text: "2020年 秋" },
  { kind: "theirs", text: "曲低风定月明楼。" },
  { kind: "mine", text: "寂寥月对无事身。" },
  { kind: "date", text: "2021年 冬" },
  { kind: "theirs", text: "空庭积雪灯如昼。" },
  { kind: "mine", text: "起来月魄减清光，" },
  { kind: "theirs", text: "夜深明月又昭昭。" },
  { kind: "date", text: "2022年 春" },
  { kind: "mine", text: "岁岁惊春春愈早。" },
  { kind: "theirs", text: "到处心情依旧好。" },
  { kind: "mine", text: "南北人间迢递老。" },
  { kind: "date", text: "2023年 夏" },
  { kind: "theirs", text: "不热不凉夜，不慌不躁晨。" },
  { kind: "mine", text: "果茶过三巡。" },
  { kind: "theirs", text: "几行诗里关河月，" },
  { kind: "mine", text: "无数人间燕子楼。" },
  { kind: "date", text: "2024年 秋" },
  { kind: "theirs", text: "世事七分无所谓，" },
  { kind: "mine", text: "凭君看取楚人弓。" },
  { kind: "theirs", text: "足看枝上月、涧中霄。" },
  { kind: "date", text: "2025年 春" },
  { kind: "mine", text: "相思渐与柳丝长。" },
  { kind: "theirs", text: "一春唯有我多情。" },
  { kind: "mine", text: "人间灯火灿于星。" },
  { kind: "date", text: "今天 23:57" },
  { kind: "mine", text: FIRST_LINE, read: true },
];

const FS = 46; // message size
const PADX = 32, PADY = 22, GAP = 24, DATE_H = 84;
const COL_L = 520, COL_R = 1400; // the chat column
const BUBBLE_H = Math.round(FS * 1.0 + PADY * 2);

export type Laid = { msg: Msg; y: number; h: number; x0: number; w: number; glyphs: { ch: string; x: number; y: number }[] };

let LAYOUT: Laid[] | null = null;
/** Content-space layout (y grows down the history). Pure: font metrics only. */
export function chatLayout(): Laid[] {
  if (LAYOUT) return LAYOUT;
  let y = 0;
  LAYOUT = HISTORY.map((m) => {
    if (m.kind === "date") {
      const r: Laid = { msg: m, y, h: DATE_H, x0: 0, w: 0, glyphs: [] };
      y += DATE_H;
      return r;
    }
    const chars = [...m.text];
    const L = lineInk(chars, FS, chars.map(() => 0));
    // the padding is measured from the line's edges as every line is aligned (lib/ink): a
    // character's cell, but a closing 。 or ， only as far as its ink — it is mostly empty on its
    // right, and counting that would leave the right margin wider than the left (v4.1: v4.0
    // measured from the ink at both ends, so a line ending on a character had its cell's margin
    // too little)
    const w = L.boxR - L.boxL + PADX * 2;
    const x0 = m.kind === "mine" ? COL_R - w : COL_L;
    const base = y + PADY + FS * 0.5 - (L.inkT + L.inkB) / 2;
    const glyphs = chars.map((ch, i) => ({ ch, x: x0 + PADX - L.boxL + L.xs[i], y: base }));
    const h = BUBBLE_H + (m.read ? 34 : 0);
    const r: Laid = { msg: m, y, h, x0, w, glyphs };
    y += h + GAP;
    return r;
  });
  return LAYOUT;
}
/** How far to shift a centred, letter-spaced line so that the edges it is aligned by (its first and
 *  last characters' cells, or an end mark's ink: lib/ink) sit evenly about the centre, not its CSS
 *  box (letter-spacing also follows the last glyph). (v4.1: v4.0 centred the ink.) */
export const inkShift = (text: string, size: number, font: string, ls: number) => {
  const chars = [...text];
  const L = lineInk(chars, size, chars.map((_, i) => (i ? ls : 0)), font);
  return (L.adv + ls) / 2 - (L.boxL + L.boxR) / 2;
};
const contentH = () => {
  const L = chatLayout();
  const last = L[L.length - 1];
  return last.y + last.h;
};

// scroll: content y at the top of the view
const VIEW_TOP = 250;
const presentScroll = () => contentH() + BUBBLE_H + GAP + 40 - 640; // keep the newest message + typing bubble low on screen
const oldScroll = () => -40; // the 2019 divider near the top
/** Scroll that centres a message on screen (content y → view). */
const centreOn = (text: string, screenY = 500) => {
  const l = chatLayout().find((m) => m.msg.text === text)!;
  return VIEW_TOP + l.y + l.h / 2 - screenY;
};
// While the history runs, the sheet comes in a little closer (no year counter in the margin:
// the time is in the seasons drifting down the sides instead)
export const CHAT_S = 1.2;
export const ORIGIN = { x: 960, y: 432 }; // the sheet's transform origin (50% 40%)
export const chatScale = (f: number) => lerp(1, CHAT_S, smooth(prog(f, Hh.start - 4, Hh.start + 16)));
// Waiting, he scrolls back: a fast run to 2023, a breath on two lines there,
// then all the way to the first 520, where it settles.
export function scrollAt(f: number) {
  const p0 = presentScroll(), p1 = oldScroll();
  const mid = (centreOn("几行诗里关河月，", 470) + centreOn("无数人间燕子楼。", 470)) / 2;
  if (f < Hh.start) return p0;
  if (f < Hh.y2023 - 8) return lerp(p0, mid + 60, easeInOutCubic(prog(f, Hh.start, Hh.y2023 - 8)));
  if (f < Hh.y2023 + 20) return lerp(mid + 60, mid - 40, prog(f, Hh.y2023 - 8, Hh.y2023 + 20)); // the breath: a slow drift
  return lerp(mid - 40, p1, easeInOutCubic(prog(f, Hh.y2023 + 20, Hh.stop)));
}
const speedAt = (f: number) => Math.abs(scrollAt(f + 0.5) - scrollAt(f - 0.5));

/** Screen positions of every 月 at the search, for the moon to take over. */
export function moonGlyphs() {
  const s = scrollAt(Hh.stop + 2);
  const out: { x: number; y: number; size: number; red: boolean }[] = [];
  for (const l of chatLayout())
    for (const g of l.glyphs)
      if (g.ch === "月") {
        const gi = glyphInk(g.ch, FS);
        // red: it sat in one of his red bubbles (lit as a white chip with a red 月, 朱文)
        const x = g.x + (gi.l + gi.r) / 2, y = g.y - s + VIEW_TOP + (gi.t + gi.b) / 2;
        // where it is on screen: the sheet is drawn at CHAT_S about its origin by now
        out.push({ x: ORIGIN.x + (x - ORIGIN.x) * CHAT_S, y: ORIGIN.y + (y - ORIGIN.y) * CHAT_S, size: FS * CHAT_S, red: l.msg.kind === "mine" });
      }
  // every 月 in their history, including those scrolled out of view below
  return out.filter((p) => p.y > 120);
}

/** Down both margins, a few things of the season each stretch of the history belongs to,
 *  all out of her poems: autumn ginkgo, summer fireflies, winter snow, spring petals.
 *  v4.0: they fall, as they do in her reply (lib/drift) — v3.1 had them rise, because the
 *  history runs backwards, which read as nothing in particular. Each stays in its own year:
 *  it fades in as it falls into its stretch and out as it leaves it. */
type Drift = { x: number; cy: number; size: number; ph: number; kind: DriftKind; top: number; bot: number };
const DRIFT_FALL = 270; // the furthest any of them falls while the history runs (156 frames)
let DRIFTS: Drift[] | null = null;
function drifts(): Drift[] {
  if (DRIFTS) return DRIFTS;
  const L = chatLayout();
  const dates = L.filter((l) => l.msg.kind === "date");
  const r = mulberry32(611);
  const out: Drift[] = [];
  dates.forEach((d, k) => {
    // the first year reaches up past the top of the frame, so its petals come down from outside it
    const top = d.y - (k === 0 ? 420 : 40);
    const bot = k + 1 < dates.length ? dates[k + 1].y - 40 : d.y + 660;
    const t = d.msg.text;
    const kind: DriftKind = t.includes("秋") ? "leaf" : t.includes("夏") ? "fly" : t.includes("冬") ? "snow" : "petal";
    // fireflies hover where they are; the rest start up to a fall's length above their stretch
    const lead = kind === "fly" ? 0 : DRIFT_FALL;
    const n = Math.max(5, Math.round((bot - top + lead) / 60));
    for (let j = 0; j < n; j++) {
      const side = r() < 0.5 ? -1 : 1;
      // content x: the margins either side of the sheet, inside the frame once scaled
      out.push({ x: side < 0 ? 180 + r() * 170 : 1570 + r() * 170, cy: top - lead + r() * (bot - top + lead), size: 0.7 + r() * 0.6, ph: r() * 6.28, kind, top, bot });
    }
  });
  return (DRIFTS = out);
}
const SeasonDrift: React.FC<{ f: number }> = ({ f }) => {
  const on = smooth(prog(f, Hh.start, Hh.start + 10));
  if (on <= 0) return null;
  const t = f - Hh.start;
  return (
    <>
      {drifts().map((d, i) => {
        const p = fallPose(d.kind, t, d.ph, d.size);
        const y = d.cy + p.dy;
        const inYear = smooth(prog(y, d.top - 50, d.top + 10)) * (1 - smooth(prog(y, d.bot - 10, d.bot + 50)));
        return <DriftShape key={i} kind={d.kind} x={d.x + p.dx} y={y} size={d.size} rot={p.rot} flip={p.flip} blink={p.blink} opacity={0.85 * on * inYear} />;
      })}
    </>
  );
};

/** v4.0 · the search box: how far the magnifier and the picked 月 are nudged off the flex centre.
 *  Measured in v3.1 (box 96–160, centre 128): 月's ink 112–144, centred (ink centroid 0.45 px high);
 *  the magnifier's ring was centred, so with its handle the icon spanned 117–144, 2.5 px low. As the
 *  big apps do it (Material icons, SF Symbols: the icon's whole box is centred, the ring sits a
 *  little above the middle), the icon goes up 2.5 px and the 月 stays: both are now centred by
 *  their outer edges, on the box's centre line. (Compared with centring by ink centroid, icon
 *  −1.6 px: analysis/搜索框_三种居中对比.png.) */
const SB_NUDGE = { icon: -2.5, text: 0 };

const Glyph: React.FC<{ ch: string; x: number; y: number; color: string; hl?: number; onRed?: boolean }> = ({ ch, x, y, color, hl = 0, onRed = false }) => {
  const gi = glyphInk(ch, FS);
  const chip = onRed ? "#fbf3ea" : COLORS.vermilion;
  const lit = onRed ? COLORS.vermilion : "#fbf3ea";
  return (
    <>
      {hl > 0 && (
        <span
          style={{
            position: "absolute",
            left: x + gi.l - 6,
            top: y + gi.t - 6,
            width: gi.r - gi.l + 12,
            height: gi.b - gi.t + 12,
            background: chip,
            borderRadius: 6,
            opacity: Math.min(1, hl),
            boxShadow: onRed ? `0 0 ${16 * hl}px rgba(255,236,214,${0.65 * Math.min(1, hl)})` : `0 0 ${18 * hl}px rgba(226,73,63,${0.6 * Math.min(1, hl)})`,
          }}
        />
      )}
      <span style={{ position: "absolute", left: x, top: spanTop(y, FS), fontFamily: HW, fontSize: FS, lineHeight: 0, whiteSpace: "pre", color: hl > 0.5 ? lit : color }}>{ch}</span>
    </>
  );
};

export const Chat: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  const L = chatLayout();
  const scroll = scrollAt(f);
  const speed = speedAt(f);
  const tilt = Math.min(26, speed * 0.55); // the history leans away as it races
  const blur = Math.min(14, speed * 0.12);
  // match cut: the ink drop shrinks into the first dot
  const uiIn = smooth(prog(f, K.match + 1, K.match + 9));
  const outA = 1 - smooth(prog(f, Hh.lift - 8, Hh.lift + 5));
  const searchIn = easeOutCubic(prog(f, Hh.search - 4, Hh.search + 6));
  const pinyin = f >= Hh.search && f < Hh.pick ? "yue".slice(0, Math.min(3, 1 + Math.floor((f - Hh.search) / 3))) : "";
  const picked = f >= Hh.pick;
  const hl = smooth(prog(f, Hh.glow - 6, Hh.glow + 2)) * (1 + 0.25 * Math.sin((f - Hh.glow) * 0.6) * (f > Hh.glow ? 1 : 0));
  const hideMoons = f >= Hh.lift + 5; // the moon scene has them by now
  const topClear = lerp(250, -200, smooth(prog(f, K.end - 10, Hh.start + 12)));

  // typing bubble under the newest message
  const last = L[L.length - 1];
  const typY = last.y + last.h + GAP;
  const dotsOn = f >= K.match && f < K.stop + 6;
  const dotsGone = smooth(prog(f, K.stop, K.stop + 6));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#efeee9", opacity: outA }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="vblur" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`} />
        </filter>
      </svg>
      {/* the sheet: 信笺 with vermilion rules, tilting with the scroll */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "50% 40%",
          transform: `perspective(1500px) rotateX(${tilt}deg) scale(${chatScale(f)})`,
          filter: blur > 0.4 ? "url(#vblur)" : undefined,
          opacity: uiIn,
          // keep the top clear for the poem line until the scroll begins
          WebkitMaskImage: `linear-gradient(to bottom, rgba(0,0,0,0) ${topClear}px, #000 ${topClear + 160}px)`,
          maskImage: `linear-gradient(to bottom, rgba(0,0,0,0) ${topClear}px, #000 ${topClear + 160}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 380,
            width: 1160,
            top: -3000,
            height: 7000,
            background: "repeating-linear-gradient(90deg, rgba(192,48,44,0) 0px, rgba(192,48,44,0) 118px, rgba(192,48,44,0.13) 118px, rgba(192,48,44,0.13) 120px)",
            borderLeft: "3px solid rgba(192,48,44,0.22)",
            borderRight: "3px solid rgba(192,48,44,0.22)",
            transform: `translateY(${(-scroll % 120) - 0}px)`,
          }}
        />
        <div style={{ position: "absolute", left: 0, top: VIEW_TOP - scroll, width: 1920 }}>
          {L.map((l, i) => {
            if (l.y - scroll > 1300 || l.y + l.h - scroll < -400) return null;
            if (l.msg.kind === "date") {
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    width: 1920,
                    top: l.y + 18,
                    textAlign: "center",
                    fontFamily: SERIF,
                    fontSize: 27,
                    letterSpacing: "0.2em",
                    color: "rgba(40,38,40,0.5)",
                    transform: `translateX(${inkShift(l.msg.text, 27, SERIF, 0.2 * 27)}px)`,
                  }}
                >
                  {l.msg.text}
                </div>
              );
            }
            const mine = l.msg.kind === "mine";
            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: l.x0,
                    top: l.y,
                    width: l.w,
                    height: BUBBLE_H,
                    borderRadius: mine ? "24px 24px 6px 24px" : "24px 24px 24px 6px",
                    background: mine ? "linear-gradient(160deg, #cc3b33 0%, #b52a26 60%, #9e2321 100%)" : "#fbfaf7",
                    boxShadow: mine ? "0 6px 18px rgba(120,30,26,0.25)" : "0 4px 14px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)",
                  }}
                />
                {l.glyphs.map((g, j) => {
                  const isMoon = g.ch === "月";
                  if (isMoon && hideMoons) return null;
                  return <Glyph key={j} ch={g.ch} x={g.x} y={g.y} color={mine ? "#f7efe5" : "#1d1c1f"} hl={isMoon ? hl : 0} onRed={mine} />;
                })}
                {l.msg.read && (
                  <div style={{ position: "absolute", left: l.x0, width: l.w, top: l.y + BUBBLE_H + 8, textAlign: "right", fontFamily: SERIF, fontSize: 20, color: "rgba(40,38,40,0.5)", opacity: f >= K.drips[2] ? 1 : 0 }}>
                    {/* 读's cell ends on the bubble's edge (no trailing letter-space). v4.1: by the cell, as
                        every line (v4.0 put its ink there, taking its side bearing off too) */}
                    <span style={{ letterSpacing: "0.18em", marginRight: -0.18 * 20 }}>已读</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          <SeasonDrift f={f} />
          {/* the receiver typing: three ink dots dripping on the beat */}
          {dotsOn && (
            <div
              style={{
                position: "absolute",
                left: COL_L,
                top: typY,
                width: 166,
                height: BUBBLE_H,
                borderRadius: "24px 24px 24px 6px",
                background: "#fbfaf7",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)",
                transformOrigin: "0% 100%",
                transform: `scale(${1 - dotsGone})`,
                opacity: (1 - dotsGone) * smooth(prog(f, K.match + 2, K.match + 8)),
              }}
            />
          )}
        </div>
      </div>
      {/* the years roll back down the margin while the history runs */}
      {/* dots live outside the tilt so the match cut can start from the drop */}
      {dotsOn &&
        [0, 1, 2].map((k) => {
          const bx = COL_L + 46 + k * 38;
          const by = VIEW_TOP - scroll + typY + BUBBLE_H / 2;
          const at = K.dots[k];
          const drip = f >= at ? Math.exp(-(f - at) / 4) * Math.sin(Math.min(Math.PI, (f - at) / 3)) : 0;
          let x = bx, y = by - 12 * drip, r = 9;
          let a = f >= at - 12 || k === 0 ? 1 : 0.25;
          let gloss = 0;
          if (k === 0) {
            // grows out of the falling drop: from the frame centre, big, into place, then drips on its beat like the others
            const m = easeInOutCubic(prog(f, K.match, K.match + 9));
            x = lerp(960, bx, m);
            y = lerp(540, y, m);
            r = lerp(128, 9, m);
            // v4.0: the drop of water from the clock is still glassy for a moment (its light and its
            // rim), and dries into a dot of ink as it shrinks into place
            gloss = 1 - smooth(prog(f, K.match, K.match + 7));
          }
          a *= 1 - dotsGone;
          return (
            <div key={k} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "#1a1614", opacity: a, overflow: "hidden" }}>
              {gloss > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    opacity: gloss,
                    background:
                      "radial-gradient(circle at 36% 28%, rgba(255,250,240,0.9) 0%, rgba(255,250,240,0.35) 7%, rgba(255,250,240,0) 15%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 74%, rgba(190,196,206,0.28) 93%, rgba(230,234,240,0.5) 100%)",
                  }}
                />
              )}
            </div>
          );
        })}
      {/* search: the same input method as the opening — underlined pinyin, the cursor right
          behind it — and a flat candidate row (月 约 跃 阅: the moon, the meeting, the leap of
          joy, the reading), not type blocks: this is finding, not composing */}
      {f >= Hh.search - 4 && (
        <div style={{ position: "absolute", left: 660, top: 96, width: 600, opacity: searchIn, transform: `translateY(${(1 - searchIn) * -20}px)` }}>
          <div
            style={{
              height: 64,
              borderRadius: 32,
              background: "#fbfaf7",
              boxShadow: "0 6px 20px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              paddingLeft: 30,
            }}
          >
            <span style={{ width: 22, height: 22, marginRight: 18, borderRadius: "50%", border: "3px solid rgba(40,38,40,0.55)", display: "inline-block", position: "relative", flex: "none", transform: `translateY(${SB_NUDGE.icon}px)` }}>
              <span style={{ position: "absolute", width: 3, height: 10, background: "rgba(40,38,40,0.55)", right: -6, bottom: -8, transform: "rotate(-45deg)" }} />
            </span>
            {picked ? (
              <span style={{ fontFamily: HW, fontSize: 36, color: COLORS.vermilion, lineHeight: 1, display: "inline-block", transform: `translateY(${SB_NUDGE.text}px)` }}>月</span>
            ) : pinyin ? (
              <>
                <span style={{ fontFamily: SANS, fontWeight: 400, fontSize: 28, lineHeight: 1, color: "#3a3028", borderBottom: "2px solid #3a3028", paddingBottom: 3 }}>{pinyin}</span>
                {/* the cursor right after the last letter's advance, no gap (v4.1; v4.0 left 3 px) */}
                <span style={{ width: 2, height: 30, background: COLORS.vermilion, flex: "none" }} />
              </>
            ) : (
              <span style={{ fontFamily: SERIF, fontSize: 28, color: "rgba(40,38,40,0.35)", letterSpacing: "0.1em" }}>搜索聊天记录</span>
            )}
          </div>
          {f >= Hh.search && f < Hh.pick + 4 && (() => {
            // the candidates follow the keys, as a real input method does
            const n = pinyin.length;
            const row = n >= 3 || f >= Hh.pick ? ["月", "约", "跃", "阅"] : n === 2 ? ["与", "雨", "语", "于"] : ["一", "有", "也", "要"];
            const out = prog(f, Hh.pick, Hh.pick + 4);
            return (
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  height: 52,
                  padding: "0 28px 0 24px",
                  gap: 30,
                  borderRadius: 14,
                  background: "rgba(251,250,247,0.97)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(0,0,0,0.05)",
                  opacity: 1 - out,
                }}
              >
                {row.map((c, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "baseline", transform: i === 0 && f >= Hh.pick - 2 ? `scale(${1 + 0.15 * Math.exp(-(f - Hh.pick + 2) / 3)})` : undefined }}>
                    <span style={{ fontFamily: SANS, fontSize: 17, color: "rgba(40,38,40,0.45)", marginRight: 7 }}>{i + 1}</span>
                    {/* v4.5: each candidate in a cell of one em, set in it on its axis (lib/ink); v4.4 took the
                        font's advances (阅 1019, 语 1021 units in 1024), so the gaps between them were uneven */}
                    <span style={{ display: "inline-block", width: 32, whiteSpace: "pre", fontFamily: HW, fontSize: 32, lineHeight: 1, color: i === 0 ? COLORS.vermilion : "#2a282b" }}>
                      <span style={{ marginLeft: penInCell(c, 32, glyphInk(c, 32), HW) }}>{c}</span>
                    </span>
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
