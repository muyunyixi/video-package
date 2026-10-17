import React from "react";
import { useCurrentFrame } from "remotion";
import cues from "./cues.json";
import { COLORS, HW, SANS, SERIF, prog, easeOutCubic, easeOutBack, easeInOutCubic, clamp, lerp, smooth } from "./lib/util";
import { glyphInk } from "./lib/ink";

// The frame layer follows one margin rule (EBU R95 graphics-safe, 5%), measured on
// the visible ink: 54 px from the top and bottom, 96 px from the sides.
export const SAFE = { top: 54, bottom: 54, side: 96 };

// ---------------------------------------------------------------- story clock
// 0–26.5 s run in real time from 23:57:43 (so the minute turns exactly when the message lands), the
// wait is time-lapsed, the last three seconds tick on the beat, and 00:00:00 falls on the downbeat of
// the moon.
// v4.5: the lapse in three parts, its speed eased into each (smoothstep), so the clock never stands and
// never jumps: from the pool's first drop (26.5 s, 23:58:09.5) it gathers speed out of real time; from
// where the drop that never comes would have fallen (clock.stop, 31.5 s) it runs at its fastest, eight
// seconds a second — one a sixteenth note, each on the score's grid — through the years scrolling back;
// from the moon coming whole (moon.form, 39.83 s) it slows, into the count's own pace, a second a beat,
// at 23:59:57 (43.5 s). The fastest speed is what makes the three parts come out at lapseTo exactly:
// 5 s × 4.5 + 8.33 s × 8 + 3.67 s × 5 = 107.5 s of the story (RATE, solved below: 8). v4.4 eased in out
// of a standstill and out into one, so it stood at 23:58:09 for 1.8 s and at 23:59:56 for 2.2 s, while
// the ratchet raced and the clouds gathered; a first v4.5 draft ran faster and faster, to 20×, and fell
// into the count at once.
const ST = cues.story;
const RUSH = cues.clock.stop, SLOW = cues.moon.form;
const COUNT_RATE = 30 / cues.beat; // the count's pace: a second a beat
const S1 = ST.t0 + ST.realUntil / 30;
const T_IN = (RUSH - ST.realUntil) / 30, T_HOLD = (SLOW - RUSH) / 30, T_OUT = (ST.lapseEnd - SLOW) / 30;
const RATE = (ST.lapseTo - S1 - T_IN / 2 - (COUNT_RATE * T_OUT) / 2) / (T_IN / 2 + T_HOLD + T_OUT / 2);
const easedArea = (u: number) => u * u * u - (u * u * u * u) / 2; // ∫₀ᵘ smoothstep
export function storySeconds(f: number) {
  if (f <= ST.realUntil) return ST.t0 + f / 30;
  if (f <= RUSH) {
    const u = (f - ST.realUntil) / 30 / T_IN;
    return S1 + T_IN * (u + (RATE - 1) * easedArea(u));
  }
  const s2 = S1 + (T_IN * (1 + RATE)) / 2;
  if (f <= SLOW) return s2 + (RATE * (f - RUSH)) / 30;
  const s3 = s2 + RATE * T_HOLD;
  if (f <= ST.lapseEnd) {
    const u = (f - SLOW) / 30 / T_OUT;
    return s3 + T_OUT * (RATE * u - (RATE - COUNT_RATE) * easedArea(u));
  }
  if (f < ST.midnight) return ST.lapseTo + Math.floor((f - ST.lapseEnd) / 15);
  return 86400 + (f - ST.midnight) / 30;
}
const two = (n: number) => String(n).padStart(2, "0");
function clockAt(f: number) {
  const s = Math.floor(storySeconds(f) + 1e-6);
  const day = s >= 86400 ? 21 : 20;
  const t = s % 86400;
  return { date: `5月${day}日`, time: `${two(Math.floor(t / 3600))}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}` };
}

// v4.0: the frame layer's two styles (dark ink with a paper halo over light pictures, pale text
// over dark ones) cross-fade instead of flipping in one frame. Each range is [from, to, fadeIn,
// fadeOut]: the style is fully "light" inside it and the change is spread evenly across the
// boundary (fades are set from the measured brightness under the clock and the credit).
const ramp = (f: number, at: number, len: number) => (len <= 0 ? (f >= at ? 1 : 0) : smooth(prog(f, at - len / 2, at + len / 2)));
export const lightAmt = (f: number) =>
  Math.max(0, ...(cues.light as number[][]).map(([a, b, fi = 0, fo = 0]) => Math.min(ramp(f, a, fi), 1 - ramp(f, b, fo))));
const isLight = (f: number) => lightAmt(f) >= 0.5;
const mixRGBA = (a: number[], b: number[], t: number) => `rgba(${a.slice(0, 3).map((v, i) => Math.round(lerp(v, b[i], t))).join(",")},${lerp(a[3], b[3], t).toFixed(3)})`;
/**
 * Where a glyph's ink visibly ends on the right, in px from its pen position — found the way the
 * frames are measured (《整体制作指南》8.3): rasterized 8× over, each pixel's cover, the darkest
 * pixel of every column, the edge where that falls through 50 % (pixel centres at x + 0.5),
 * averaged over four sub-pixel pen positions. measureText's actualBoundingBox will not do here:
 * Chromium rounds it out to whole pixels (》 at 24 px: 12, where the outline ends at 11.1 and its
 * point shows to about 10.9). The first v4.0 pass centred the credit on that box and measured
 * 0.8 px left of centre on frames 160–178; on this edge it measures −0.03 px (dark) and −0.3 px (light).
 */
const right50 = new Map<string, number>();
const inkRight50 = (ch: string, size: number, font: string, weight: number) => {
  const key = `${ch}|${size}|${font}|${weight}`;
  const hit = right50.get(key);
  if (hit !== undefined) return hit;
  const SS = 8, N = Math.ceil(size * 2), PH = 4;
  const c = document.createElement("canvas");
  c.width = c.height = N * SS;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.font = `${weight} ${size * SS}px ${font}`;
  x.textBaseline = "alphabetic";
  let sum = 0;
  for (let ph = 0; ph < PH; ph++) {
    x.clearRect(0, 0, c.width, c.height);
    const ox = Math.round(size * 0.5) + ph / PH;
    x.fillText(ch, ox * SS, Math.round(size * 1.4) * SS);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const col = new Float64Array(N);
    for (let py = 0; py < N; py++)
      for (let px = 0; px < N; px++) {
        let a = 0;
        for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) a += d[((py * SS + yy) * c.width + px * SS + xx) * 4 + 3];
        col[px] = Math.max(col[px], a / (SS * SS * 255));
      }
    let j = N - 2;
    while (j > 0 && col[j] < 0.5) j--;
    sum += j + 0.5 + (col[j] - 0.5) / (col[j] - col[j + 1]) - ox;
  }
  right50.set(key, sum / PH);
  return sum / PH;
};
/** the right side of the closing 》 that shows no ink (its advance minus where its ink visibly ends) */
const closeBlank = (weight: number) => {
  const g = glyphInk("》", 24, SANS, weight);
  return Math.max(0, g.adv - inkRight50("》", 24, SANS, weight));
};


const CREDITS = [
  { from: 150, to: 191, text: "定风波·520—521作" },
  { from: 276, to: 506, text: "烛影摇红·为我多明媚" },
  { from: 530, to: 658, text: "定风波·520—521作" },
  { from: 675, to: 778, text: "相思二首·其二" },
  // (v4.1: everything from the pool on is one beat later — a beat inserted at 26.0 s — so these are +15)
  { from: 807, to: 973, text: "踏莎行·浮棹归时" },
  // v4.0: no credit while the chat history scrolls — the page is full of her lines already
  { from: 1357, to: 1449, text: "定风波·520—521作" },
  { from: 1533, to: 1635, text: "烛影摇红·为我多明媚" },
  { from: 1695, to: 1901, text: "绝句·年来秋夏少流萤" },
];

type Status = { text: string; dots?: boolean; live?: boolean; dong?: number };
function status(f: number): Status {
  const R = cues.reply;
  if (f < cues.hover.send) return { text: "输入中", dots: true };
  if (f < cues.thread.km[1] + 5) return { text: "发送中", dots: true, live: true };
  if (f < cues.clock.drips[2]) return { text: "已送达" }; // read as the third drop lands (v4.0: 810)
  if (f < cues.clock.dots[0] - 6) return { text: "已读" };
  if (f < cues.clock.stop) return { text: "对方正在输入", dots: true };
  if (f < R.typing) return { text: "已读" };
  if (f < R.land) return { text: "对方正在输入", dots: true };
  if (f < R.dong) return { text: "已读" };
  return { text: "已读", dong: f - R.dong };
}

/** One clock digit that rolls up when it changes. */
const Digit: React.FC<{ f: number; idx: number; get: (f: number) => string }> = ({ f, idx, get }) => {
  const cur = get(f)[idx];
  let since = 0;
  while (since < 6 && get(f - since - 1)[idx] === cur) since++;
  const prev = since < 6 ? get(f - since - 1)[idx] : cur;
  const t = since < 6 ? easeOutCubic(clamp((since + 1) / 5)) : 1;
  const w = /\d/.test(cur) ? "0.6em" : cur === ":" ? "0.32em" : "1em";
  return (
    <span style={{ display: "inline-block", position: "relative", width: w, height: "1.2em", overflow: "hidden", verticalAlign: "top", textAlign: "center" }}>
      {t < 1 && <span style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-t * 100}%)`, opacity: 1 - t }}>{prev}</span>}
      <span style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${(1 - t) * 100}%)`, opacity: t }}>{cur}</span>
    </span>
  );
};

/** 子初 / 子正 as a small vermilion seal (the 时辰 of the night: 子初 from 23:00, 子正 at
 *  midnight); at midnight the new seal is stamped over. */
const Seal: React.FC<{ f: number }> = ({ f }) => {
  const M = ST.midnight;
  const after = f >= M;
  const stamp = after ? prog(f, M, M + 7) : 1;
  const s = after ? lerp(1.7, 1, easeOutBack(stamp, 1.4)) : 1;
  const text = after ? "子正" : "子初";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 16,
        padding: "3px 7px 4px 9px",
        background: COLORS.vermilion,
        color: "#f4eee4",
        fontFamily: HW,
        fontSize: 24,
        letterSpacing: "0.12em",
        lineHeight: 1,
        borderRadius: 3,
        transform: `scale(${s})`,
        opacity: after ? clamp(prog(f, M - 1, M + 6) * 2.5) : 1, // (v4.5: there from midnight's own frame; v4.4 left it blank)
        boxShadow: after && stamp < 1 ? `0 0 ${24 * (1 - stamp)}px rgba(226,73,63,${0.8 * (1 - stamp)})` : undefined,
        verticalAlign: "middle",
      }}
    >
      {text}
    </span>
  );
};

/** Text whose right edge is its last character's cell: no trailing letter-spacing. v4.1: as every
 *  line in the film, a character aligns by its cell and only a mark by its ink (v4.0 took the last
 *  glyph's side bearing off whatever it was, so 读 or km stood by their ink). */
const CellRight: React.FC<{ text: string; size: number; spacing: number; style?: React.CSSProperties }> = ({ text, size, spacing, style }) => {
  const chars = [...text];
  const last = chars[chars.length - 1] ?? "";
  const g = glyphInk(last, size, SERIF);
  const mark = /[　-〿＀-￯]/.test(last) || /[.,;:!?]/.test(last);
  const bearing = mark ? Math.max(0, g.adv - g.r) : 0;
  return (
    <span style={{ whiteSpace: "pre", marginRight: -bearing, ...style }}>
      <span style={{ letterSpacing: spacing }}>{chars.slice(0, -1).join("")}</span>
      <span>{last}</span>
    </span>
  );
};

/** "···" as part of the text: three dots always there, brightening in a wave (no jitter). */
const Dots: React.FC<{ f: number; color: string; size: number }> = ({ f, color, size }) => {
  const d = Math.max(3, Math.round(size * 0.17));
  return (
    <span style={{ display: "inline-flex", gap: Math.round(size * 0.24), marginLeft: Math.round(size * 0.3), alignItems: "center", alignSelf: "center", transform: `translateY(${size * 0.08}px)` }}>
      {[0, 1, 2].map((k) => {
        const ph = (((f - k * 4) % 24) + 24) % 24;
        const a = 0.28 + 0.72 * Math.exp(-Math.pow((ph - 6) / 4, 2));
        return <span key={k} style={{ width: d, height: d, borderRadius: "50%", background: color, opacity: a, display: "inline-block" }} />;
      })}
    </span>
  );
};

export const HUD: React.FC = () => {
  const f = useCurrentFrame();
  const lt = lightAmt(f);
  const light = lt >= 0.5;
  const fg = mixRGBA([234, 230, 222, 0.82], [30, 29, 32, 0.84], lt);
  const fgDim = mixRGBA([234, 230, 222, 0.5], [30, 29, 32, 0.52], lt);
  const creditColor = mixRGBA([234, 230, 222, 0.85], [30, 29, 32, 0.85], lt);
  const H = (a: number) => `rgba(214,208,196,${(a * lt).toFixed(3)})`;
  // the clock retires in the window's white flash: the coda is outside the story
  const intro = easeOutCubic(prog(f, 2, 16)) * (1 - smooth(prog(f, cues.ending.start - 14, cues.ending.start)));
  const st = status(f);
  const [k0, k1, kmMax] = cues.thread.km;
  const R = cues.reply;
  let kmLine: { dir: string; km: number } | null = null;
  if (f >= k0) kmLine = { dir: "南 → 北", km: Math.round(kmMax * easeOutCubic(prog(f, k0, k1))) };
  if (f >= R.fly) kmLine = { dir: "北 → 南", km: Math.round(kmMax * easeInOutCubic(prog(f, R.fly, R.land))) };
  const clockStr = (ff: number) => clockAt(ff).time;
  const dateStr = (ff: number) => clockAt(ff).date;
  const credit = CREDITS.find((c) => f >= c.from && f < c.to);
  const cOp = credit ? clamp(Math.min((f - credit.from) / 8, (credit.to - f) / 6)) : 0;
  const date = dateStr(f);
  const S2 = 23;
  const dongIn = st.dong !== undefined ? easeOutBack(prog(st.dong, 0, 8), 1.6) : 0;

  return (
    <>
      <div
        style={{
          position: "absolute",
          right: SAFE.side,
          top: SAFE.top - 1, // the seal's top edge is the first ink
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          fontFamily: SERIF,
          color: fg,
          opacity: intro,
          transform: `translateY(${(1 - intro) * -8}px)`,
          lineHeight: 1,
        }}
      >
        <div style={{ fontSize: 27, fontWeight: 400, letterSpacing: "0.06em", display: "flex", justifyContent: "flex-end", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
          {/* the text sits 1 px lower so its ink centre matches the seal's (both on y = 69) */}
          <span style={{ marginRight: 20, position: "relative", top: 1 }}>
            {[...date].map((_, i) => (
              <Digit key={i} f={f} idx={i} get={dateStr} />
            ))}
          </span>
          <span style={{ position: "relative", top: 1 }}>
            {[..."00:00:00"].map((_, i) => (
              <Digit key={i} f={f} idx={i} get={clockStr} />
            ))}
          </span>
          <Seal f={f} />
        </div>
        <div style={{ fontSize: S2, fontWeight: 400, marginTop: 13, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {st.live && <span style={{ width: 8, height: 8, borderRadius: 4, marginRight: 10, background: COLORS.vermilion, opacity: Math.floor(f / 15) % 2 === 0 ? 1 : 0.35, display: "inline-block" }} />}
          {st.dong !== undefined ? (
            <>
              <span style={{ letterSpacing: "0.16em" }}>{st.text}</span>
              <CellRight
                text="懂"
                size={S2}
                spacing={0}
                style={{ display: "inline-block", color: COLORS.vermilionHot, transform: `scale(${lerp(1.8, 1, dongIn)})`, opacity: clamp(st.dong / 3) }}
              />
            </>
          ) : (
            <CellRight text={st.text} size={S2} spacing={S2 * 0.16} />
          )}
          {st.dots && <Dots f={f} color={fg} size={S2} />}
        </div>
        {kmLine && (
          <div style={{ fontSize: S2, fontWeight: 400, marginTop: 13, fontVariantNumeric: "tabular-nums", color: fgDim, display: "flex", justifyContent: "flex-end" }}>
            <CellRight text={`${kmLine.dir}  `} size={S2} spacing={S2 * 0.1} style={{ marginRight: 0 }} />
            <CellRight text={`${kmLine.km.toLocaleString("en-US")} km`} size={S2} spacing={S2 * 0.1} style={{ color: fgDim }} />
          </div>
        )}
      </div>
      {credit && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: SAFE.bottom - 5, // the descender-free CJK ink bottom sits on the 95% line
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: SANS,
            fontWeight: light ? 400 : 300,
            fontSize: 24,
            letterSpacing: "0.18em",
            color: creditColor,
            opacity: cOp,
          }}
        >
          <span style={{ width: 26, height: 2, marginRight: 16, background: COLORS.vermilion, display: "inline-block", boxShadow: lt > 0 ? `0 0 6px 2px ${H(0.55)}` : undefined }} />
          {/* v4.0: the line is centred on what is drawn — the dash's left end to the ink of 》 —
              so the trailing letter-spacing and the empty right half of 》 are taken off the box */}
          <span style={{ textShadow: lt > 0 ? `0 0 2px ${H(0.55)}, 0 0 2px ${H(0.55)}, 0 0 4px ${H(0.55)}, 0 0 4px ${H(0.55)}, 0 0 9px ${H(0.55)}, 0 0 20px ${H(0.42)}` : undefined, marginRight: -(24 * 0.18 + closeBlank(light ? 400 : 300)) }}>
            桃子《{credit.text}》
          </span>
        </div>
      )}
    </>
  );
};
