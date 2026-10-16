// v4.1 · 昔人多恨漏声长， → 只今无处听更漏。 (29.0–32 s), at the top of the chat
// At the match cut the pool's line comes over with its drop: it is at the top of the chat as the
// cut lands, still lit (warm, soft), and cools into ink as the chat comes up. Then it is rewritten in
// the rhythm of the line it becomes (a character every 4 frames from 29.6 s, as v4.0 wrote
// 只今无处听更漏。 in): each old character lifts off as the new one seeps in, left to right —
// 昔人多恨 → 只今无处 — and 漏, the one character the two lines share, is not rewritten: 声 and 长
// lift away ahead of it and it slides on two places, from fifth to seventh, with 听 and 更 seeping
// in behind it; ， becomes 。. The finished line is v4.0's: same size, place and exit.
// Both lines are set on one grid — the new line's cells, centred by its ink as every line is — so
// the rewrite happens on one baseline, as it would in an editor.
import React from "react";
import { useCurrentFrame } from "remotion";
import cues from "../cues.json";
import { COLORS, HW, prog, smooth, lerp, easeOutCubic, easeInCubic, easeInOutCubic } from "../lib/util";
import { glyphInk, lineInk, spanTop } from "../lib/ink";
import { SeepFilter } from "../lib/seep";

const K = cues.clock;
const OLD = [..."昔人多恨漏声长，"];
const NEW = [..."只今无处听更漏。"];
const MOVER = 4, DEST = 6; // 漏: fifth in the old line, seventh in the new
const SIZE = 84, TRACK = 10, X = 960, Y = 170;
const L2 = K.line2; // 29.6 s
// slot by slot (frames): the old character lifts off / the new one seeps in. 漏 is not lifted off:
// it slides from its slot to the seventh over MOVE, once 声 and 长 have gone from its way
const OFF = [L2 - 2, L2 + 2, L2 + 6, L2 + 10, NaN, L2 + 12, L2 + 14, L2 + 22];
const ON = [L2, L2 + 4, L2 + 8, L2 + 12, L2 + 19, L2 + 23, NaN, L2 + 25];
const MOVE: [number, number] = [L2 + 14, L2 + 24];
const LIFT = 6; // frames for an old character to lift off
const SEEP = 12; // and for a new one to seep in (Poem's ink reveal)
const LIT: [number, number] = [K.match, K.match + 14]; // the pool's light cools into ink
const OUT: [number, number] = [K.end - 12, K.end - 2];
const WARM: [number, number, number] = [214, 146, 78];
const INK: [number, number, number] = [0x16, 0x15, 0x19]; // COLORS.ink

const rgb = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

export const Rewrite: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  if (f < K.match || f > OUT[1]) return null;
  const gaps = OLD.map((_, i) => (i ? TRACK : 0));
  const Ln = lineInk(NEW, SIZE, gaps);
  const Lo = lineInk(OLD, SIZE, gaps);
  const x0 = X - (Ln.boxL + Ln.boxR) / 2;
  const base = Y - (Ln.inkT + Ln.inkB) / 2;
  const top = spanTop(base, SIZE);
  const outT = prog(f, OUT[0], OUT[1]);
  const outBlur = 14 * easeInCubic(outT);
  // the old line as it arrives: lit, then ink
  const cool = smooth(prog(f, LIT[0], LIT[1]));
  const litColor = rgb(WARM, INK, cool);
  const litBlur = 5 * Math.pow(1 - cool, 1.5);
  const litShadow = cool < 1 ? `0 0 ${(16 * (1 - cool)).toFixed(1)}px rgba(255,186,104,${(0.85 * (1 - cool)).toFixed(3)})` : undefined;
  const litOp = lerp(0.82, 1, smooth(prog(f, K.match, K.match + 4)));

  const glyph = (key: string, ch: string, px: number, o: { color: string; op: number; blur: number; dy?: number; s?: number; seep?: string; shadow?: string }) => {
    const gi = glyphInk(ch, SIZE);
    const cx = px + (gi.l + gi.r) / 2, cy = base + (gi.t + gi.b) / 2;
    const blur = o.blur + outBlur;
    return (
      <span
        key={key}
        style={{
          position: "absolute",
          left: px,
          top,
          fontFamily: HW,
          fontSize: SIZE,
          lineHeight: 0,
          whiteSpace: "pre",
          color: o.color,
          opacity: o.op,
          transformOrigin: `${cx - px}px ${cy - top}px`,
          transform: `translateY(${(o.dy ?? 0).toFixed(2)}px) scale(${o.s ?? 1})`,
          filter: [o.seep, blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : ""].filter(Boolean).join(" ") || undefined,
          textShadow: o.shadow,
        }}
      >
        {ch}
      </span>
    );
  };

  const out: React.ReactNode[] = [];
  const seeps: { id: string; p: number; seed: number }[] = [];
  OLD.forEach((ch, i) => {
    if (i === MOVER) return;
    const t = prog(f, OFF[i], OFF[i] + LIFT);
    if (t >= 1) return;
    out.push(glyph(`o${i}`, ch, x0 + Lo.xs[i], { color: litColor, op: litOp * (1 - smooth(t)), blur: litBlur + 7 * t, dy: -7 * easeOutCubic(t), shadow: litShadow }));
  });
  NEW.forEach((ch, i) => {
    if (i === DEST || !(f >= ON[i])) return;
    const t = prog(f, ON[i], ON[i] + SEEP);
    const id = `rw${i}`;
    if (t < 1) seeps.push({ id, p: t, seed: (311 + i * 7) % 997 });
    out.push(glyph(`n${i}`, ch, x0 + Ln.xs[i], { color: COLORS.ink, op: 1, blur: 0, s: 1 + 0.04 * (1 - easeOutCubic(t)), seep: t < 1 ? `url(#${id})` : undefined }));
  });
  // 漏: lit like the rest of the old line, then carried on two places, lifted a hair as it goes
  {
    const m = prog(f, MOVE[0], MOVE[1]);
    const px = lerp(x0 + Lo.xs[MOVER], x0 + Ln.xs[DEST], easeInOutCubic(m));
    out.push(glyph("mv", OLD[MOVER], px, { color: litColor, op: litOp, blur: litBlur, dy: -5 * Math.sin(Math.PI * m), shadow: litShadow }));
  }
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, pointerEvents: "none", opacity: 1 - smooth(outT) }}>
      {seeps.length > 0 && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          {seeps.map((s) => (
            <SeepFilter key={s.id} id={s.id} p={s.p} size={SIZE} seed={s.seed} />
          ))}
        </svg>
      )}
      {out}
    </div>
  );
};
