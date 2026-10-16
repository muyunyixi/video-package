"""Full score for 《字与心事》 (72.3 s), locked to the picture cue sheet (cues.json).
D major pentatonic, 120 bpm (one beat = 15 frames). Everything is synthesized.

v3.1, third version: the film as one song, at one tempo.
  intro (落笔, 片名, 0–9) · verse (一线, 9–17) · the verse answered (雀跃 → 南北, 17–25: the dizi sings
  the second half of the verse across the cut) · interlude (更漏, 25–31) · the verse again (往事 → 月,
  31–39: back to where the story began) · pre-chorus (the night opens, the minutes run, 39–43) · the
  one three-beat bar of the film (23:59:57 · 58 · 59) · chorus (子正 → 读懂, 44.5–52.5: the lights' dizi
  line, all of it) · turnaround (52.5–54.5) · chorus again (灯火, as v3) · outro (片尾, 彩蛋).
Every bar is four beats except the count; phrases run across the cuts; the sound effects sit on the
beat, in the chord, under the tune. Bars: two seconds from 1.0 s to 43.0 s, then from 44.5 s.
VER=A: the refrain sung an octave lower (A4–A5), the lights' bells with it. VER=B (default): the
refrain where v3 had it (A5–A6), its tone softened, the bells a little quieter. Both: the outro's
dizi an octave down, and a low floor under it."""
import json, os, sys
import numpy as np
from scipy.io import wavfile
import synth as S
import sfx2 as X

SR = S.SR
CUES = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/zxs/src/cues.json"))
OUT = sys.argv[2] if len(sys.argv) > 2 else "/home/claude/zxs/out/audio/full_premaster.wav"
DUR = CUES["total"] / 30.0
FPS = 30.0
fr = lambda f: f / FPS
STEP = 0.125  # 16th note
VER = os.environ.get("VER", "B").upper()
REG = -1 if VER == "A" else 0  # the octave of the refrain (and of the pre-chorus line leading into it)
SOFT = VER != "A"  # B keeps v3's register for the refrain, so it rounds off the dizi's top instead


class Bus:
    def __init__(self, send=0.0):
        self.x = np.zeros((S.n_samples(DUR) + SR * 5, 2))
        self.send = send

    def add(self, y, t, db=0.0, pan=0.0):
        if y is None or len(y) == 0:
            return
        g = 10 ** (db / 20)
        i = S.n_samples(t)
        if i < 0:
            y = y[-i:]
            i = 0
        if y.ndim == 1:
            a = (pan + 1) * np.pi / 4
            st = np.stack([y * np.cos(a), y * np.sin(a)], axis=1) * np.sqrt(2)
        else:
            st = y
        m = min(len(st), self.x.shape[0] - i)
        if m > 0:
            self.x[i:i + m] += st[:m] * g


rnd = np.random.default_rng(2026)
amb = Bus(0.05)
sfx = Bus(0.18)
ui = Bus(0.08)
drums = Bus(0.08)
bass = Bus(0.0)
music = Bus(0.3)
lead = Bus(0.42)
bells = Bus(0.45)
fxb = Bus(0.2)
loopb = Bus(0.3)  # the loop: the groove's guzheng figure, kept going under the whole film

C = CUES


def groove(b0, bass_note, pad_notes, cutoff, osti, seed, kick_db=-6, full=True, shaker=True, crash=True, hats=True, snare=True, pad_db=-21, osti_db=-19, bass_db=-6.5, glide=None):
    """One 2 s bar of the main groove (the 'travelling' rhythm of the film)."""
    if crash:
        drums.add(S.crash(1.0, seed, 2.0), b0, -13, pan=0.3 if seed % 2 else -0.3)
        drums.add(S.taiko(1.0, seed + 1), b0, -11)
    kicks = [0, 6, 11] if full else [0, 8]
    for j, s in enumerate(kicks):
        drums.add(S.kick(1.0, seed + 2 + j), b0 + s * STEP, kick_db if s == 0 else kick_db - 2)
        nxt = (kicks[j + 1] if j + 1 < len(kicks) else 16) - s
        g = glide if j == len(kicks) - 1 else None
        if bass_note:
            bass.add(S.bass808(bass_note, nxt * STEP + 0.05, 1.0, glide_to=g), b0 + s * STEP, bass_db)
    if snare:
        drums.add(S.snare(1.0, seed + 6), b0 + 8 * STEP, -10)
        drums.add(S.clap(1.0, seed + 7), b0 + 8 * STEP, -13, pan=0.1)
    if hats:
        for s in range(0, 16, 2):
            drums.add(S.hat(1.0, s == 14, seed + 10 + s), b0 + s * STEP, -18 if s % 4 == 0 else -21, pan=0.28)
    if shaker:
        for s in range(16):
            drums.add(S.hat(1.0, False, seed + 40 + s) * 0.6, b0 + s * STEP + 0.006, -27 + (2 if s % 4 == 2 else 0), pan=-0.32)
    if pad_notes:
        music.add(S.pad(pad_notes, 2.0, 1.0, attack=0.25, release=0.6, cutoff=cutoff, seed=seed + 60), b0, pad_db)
    if osti:
        for s, nt in enumerate(osti.split()):
            if nt == "-":
                continue
            music.add(S.guzheng(nt, 0.7, 1.0, 0.8, t60=1.1, seed=seed + 100 + s), b0 + s * STEP, osti_db + (1.5 if s % 4 == 0 else 0), pan=-0.35 if s % 2 else 0.35)


def dizi(notes, t0, db, seed, breath=0.13, vib=0.012, kind="dizi"):
    lead.add(S.flute_line([(s - t0, d, n) for s, d, n in notes], 1.0, breath=breath, vib=vib, seed=seed, kind=kind), t0, db)


def pan_sweep(y, p0, p1):
    """Mono → stereo with the pan travelling from p0 to p1 (equal power)."""
    a = (np.linspace(p0, p1, len(y)) + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], axis=1) * np.sqrt(2)


def env_curve(n, pts):
    """Piecewise-linear envelope through (seconds, level) points."""
    xs, vs = zip(*pts)
    return np.interp(S.t_axis(n), xs, vs)


# ---------------------------------------------------------------- one grid, one loop, one refrain
# Two-second bars from 1.0 s to 43.0 s; the countdown bar 43.0–44.5 is 3/4 (23:59:57 · 58 · 59 on
# its three beats, 子正 on the next downbeat); then two-second bars from 44.5 s on. Every section's
# groove sits on this grid, so the strong beat never jumps at a cut.
def half_bar(t):
    """Start of the half-bar (one second) that t falls in."""
    if t < 43.0:
        return float(np.floor(t + 1e-6))
    if t < 44.5:
        return 43.0 if t < 44.0 - 1e-6 else 44.0
    return 44.5 + float(np.floor(t - 44.5 + 1e-6))


# the loop: the first half-bar of the groove's guzheng figure (root, 5th, 6th, 5th · root, 2nd,
# root, 5th), moved onto whatever chord is under it; in eighths it rocks on the first four notes
FIG = {
    "D": "D5 A4 B4 A4 D5 E5 D5 A4".split(),
    "Bm": "B4 F#4 A4 F#4 B4 D5 B4 F#4".split(),
    "A": "A4 E4 F#4 E4 A4 B4 A4 E4".split(),
    "G": "G4 D4 E4 D4 G4 A4 G4 D4".split(),
}


def loop(t0, t1, chords, db, seed, every=1, bright=0.8, shape=None, pan=0.35):
    """The loop figure in sixteenths (every=2: eighths) from t0 to t1 over the chord changes
    [(time, chord), ...]; shape = [(t, dB), ...] bends its level, and bright its tone."""
    t, k = t0, 0
    while t < t1 - 1e-6:
        a = half_bar(t)
        i = int(round((t - a) / STEP)) % 8 if every == 1 else int(round((t - a) / (2 * STEP))) % 4
        ch = [c for (tc, c) in chords if tc <= t + 1e-6][-1]
        g = db + (1.5 if i % 4 == 0 else 0) + (float(np.interp(t, *zip(*shape))) if shape else 0.0)
        br = bright(t) if callable(bright) else bright
        loopb.add(S.guzheng(FIG[ch][i], 0.7, 1.0, br, t60=1.1, seed=seed + k), t, g, pan=-pan if (k % 2) else pan)
        t += STEP * every
        k += 1


def shaker(t0, t1, db, seed, shape=None):
    """The glue: a soft shaker in sixteenths, the third of every four leaning in."""
    t, k = t0, 0
    while t < t1 - 1e-6:
        i = int(round((t - half_bar(t)) / STEP)) % 4
        g = db + (2 if i == 2 else 0) + (float(np.interp(t, *zip(*shape))) if shape else 0.0)
        drums.add(S.hat(1.0, False, seed + k) * 0.6, t + 0.006, g, pan=-0.32)
        t += STEP
        k += 1


def octave(n, k):
    return n[:-1] + str(int(n[-1]) + k)


def dizi_r(notes, t0, db, seed, breath=0.13, vib=0.012):
    """The refrain's dizi. In version B (v3's high register) its tone is rounded off: breath noise and
    upper harmonics above ~4 kHz are rolled back, where the master's treble lift makes it sharp."""
    y = S.flute_line([(s - t0, d, n) for s, d, n in notes], 1.0, breath=breath * (0.75 if SOFT else 1.0), vib=vib, seed=seed)
    if SOFT:
        y = S.norm(S.lp(y, 3800, 1), 1.0)
    lead.add(y, t0, db)


# ======================================================== A · 落笔 (0–6 s)
amb.add(S.room_tone(6.4, 1.0, 1), 0.0, -50)
bells.add(S.bell("A5", 2.2, 1.0, [(1, 1, 0.7), (2.0, 0.22, 0.35), (2.76, 0.08, 0.2)], seed=1), 0.05, -21, pan=0.15)
music.add(S.sine_pad(["D2", "A2"], 1.6, 1.0, attack=0.4, release=1.2), 0.0, -27)
amb.add(S.crickets(5.8, 1.0, 7), 0.0, -46, pan=-0.35)
amb.add(S.crickets(5.8, 1.0, 8), 0.4, -49, pan=0.45)
stamp_notes = {"掂量": ("D4", 0.15), "情思": ("E4", 0.1), "敲字句": ("F#4", 0.1), "轻顿": ("A4", 0.15), "指尖": ("B4", 0.3)}
for ei, e in enumerate(C["ime"]):
    for k in e["keys"]:
        ui.add(S.key_tap(1.0, int(k * 7 + ei)), fr(k), -21 + rnd.uniform(-2, 1), pan=rnd.uniform(-0.15, 0.15))
    if e["tray"] >= 0:
        sfx.add(S.wood_knock(1.0, 30 + ei), fr(e["tray"]), -20, pan=-0.05)
        sfx.add(S.whoosh(0.16, 700, 2600, 1.0, 40 + ei, 0.4), fr(e["tray"]) - 0.02, -30)
    for j, (f, _) in enumerate(e["hl"]):
        if j > 0:
            ui.add(S.wood_tick(1.0, 60 + ei * 3 + j), fr(f), -24, pan=0.1)
    if e["word"] != "，":
        sfx.add(S.whoosh(0.12, 1500, 4500, 1.0, 80 + ei, 0.7), fr(e["pick"]), -30)
    sfx.add(S.clack(1.0, 100 + ei), fr(e["stamp"]), -11 if e["word"] != "，" else -19, pan=-0.1 + 0.03 * ei)
    if e["word"] in stamp_notes:
        nt, vib = stamp_notes[e["word"]]
        music.add(S.guzheng(nt, 3.0, 1.0, 0.65, vib=vib, seed=200 + ei), fr(e["stamp"]), -11, pan=-0.12 + 0.05 * ei)
    else:
        bells.add(S.bell("A5", 1.2, 1.0, [(1, 1, 0.5), (2, 0.2, 0.2)], seed=11), fr(e["stamp"]), -27, pan=0.2)
# the drone holds right through the hesitation (no dead air): it thickens instead
music.add(S.pad(["D2", "A2"], 4.6, 1.0, attack=2.5, release=0.25, cutoff=700, seed=3), 1.4, -24)
H = C["hover"]
# the unsent half rises out of the types as a candidate: a xun sighs, a soft glassy lift
lead.add(S.flute_line([(fr(H["suggest"]) - 0.02, 0.24, "A3"), (fr(H["suggest"]) + 0.22, 0.32, "G#3")], 1.0, breath=0.3, vib=0.006, seed=5, kind="xun"), 0.0, -17)
bells.add(X.shimmer(0.35, ["E6", "B5", "F#6"], (10, 26), 1.0, 6, 0.3), fr(H["suggest"]), -30, pan=0.2)
music.add(S.sine_pad(["D1", "A1"], fr(H["send"]) - fr(H["slow"]) + 0.1, 1.0, attack=0.5, release=0.05), fr(H["slow"]), -19)
# two heartbeats on the send button's pulses; the room holds its breath under them
drums.add(S.heartbeat(1.0, True), fr(H["beat1"]), -8)
drums.add(S.heartbeat(1.0, False), fr(H["beat2"]), -11)
fxb.add(S.reverse_swell(fr(H["send"]) - fr(H["slow"]), 1.0, 12), fr(H["slow"]), -21)
sfx.add(X.paper_rustle(0.5, 1.0, 13, 600, 3000), fr(H["slow"]), -36)

# ======================================================== B · 发送 → 字与心事 (6–9 s)
T = C["title"]
ui.add(S.key_tap(1.0, 999), fr(T["send"]), -14)
sweep = S.n_samples(0.07)
tt = S.t_axis(sweep)
ui.add(S.fade(np.sin(2 * np.pi * np.cumsum(700 + 900 * tt / 0.07) / SR), 0.002, 0.02), fr(T["send"]), -20)
fxb.add(S.whoosh(0.42, 350, 7000, 1.0, 7, 0.75), fr(T["send"]), -13)
fxb.add(S.reverse_swell(0.5, 1.0, 9), fr(T["impact"]) - 0.5, -12)
# the forme comes down as one: its frame creaks, then twelve types strike at once
sfx.add(S.creak(0.22, 1.0, 149, 60, 300), fr(T["impact"]) - 0.3, -26, pan=-0.1)
for k in range(12):
    sfx.add(S.clack(1.0, 150 + k) * 0.6, fr(T["impact"]) + k * 0.0035, -18 - k * 0.3, pan=-0.55 + k * 0.1)
fxb.add(S.impact(1.0, 21), fr(T["impact"]), -1.5)
sfx.add(S.splash(0.9, 1.0, 22), fr(T["impact"]), -10)
drums.add(S.crash(1.0, 23, 1.6), fr(T["impact"]), -19)
for k in range(14):
    sfx.add(S.clack(1.0, 300 + k), fr(T["impact"]) + rnd.uniform(0.01, 0.45) ** 1.4, -17 - k * 0.6, pan=rnd.uniform(-0.8, 0.8))
fxb.add(S.reverse_swell(fr(T["lock"]) - fr(T["converge"]), 1.0, 31), fr(T["converge"]), -11)
fxb.add(S.riser(fr(T["lock"]) - fr(T["converge"]), 1.0, 32), fr(T["converge"]), -17)
rb = S.bell("D5", 1.4, 1.0, seed=33)[::-1]
bells.add(rb, fr(T["lock"]) - len(rb) / SR, -19)
for nt, db in [("D3", -8), ("A3", -11), ("D4", -12), ("F#4", -15)]:
    bells.add(S.bell(nt, 4.0, 1.0, seed=sum(map(ord, nt)) % 1000), fr(T["lock"]), db, pan=rnd.uniform(-0.2, 0.2))
drums.add(S.taiko(1.0, 41), fr(T["lock"]), -5)
bass.add(S.bass808("D1", 1.0, 1.0), fr(T["lock"]), -8)
gl = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6"]
for k, nt in enumerate(gl):
    music.add(S.guzheng(nt, 1.6, 1.0, 0.75, seed=400 + k), fr(T["lock"]) - 0.22 + k * 0.022, -17 + k * 0.3, pan=-0.5 + k * 0.1)
bells.add(S.bell("A5", 1.8, 1.0, [(1, 1, 0.6), (2.0, 0.25, 0.3), (3.0, 0.1, 0.2)], seed=44), fr(T["subtitle"]), -23, pan=0.25)
for k in range(8):
    drums.add(S.hat(1.0, False, 500 + k), fr(T["lock"]) + k * 0.125 + 0.0625, -27 + (2 if k % 2 else 0), pan=0.25)
music.add(S.pad(["D3", "A3", "E4"], 1.1, 1.0, attack=0.6, release=0.4, cutoff=1500, seed=6), fr(T["lock"]), -24)
music.add(S.guzheng("D5", 1.4, 1.0, 0.8, bend=7, bend_at=0.03, bend_dur=0.24, seed=55), fr(T["pull"]), -12, pan=0.2)
sfx.add(S.creak(0.32, 1.0, 56, 70, 520), fr(T["pull"]), -22, pan=0.3)
fxb.add(S.whoosh(0.32, 6500, 700, 1.0, 57, 0.35), fr(262), -10, pan=0.4)
fxb.add(S.riser(0.35, 1.0, 58), fr(270) - 0.35, -20)

# ======================================================== C · 一线山南海北 (9–17 s)
BARS = [9.0, 11.0, 13.0, 15.0]
bass_notes = ["D2", "B1", "A1", "D2"]
pads = [["D3", "A3", "E4"], ["B2", "F#3", "D4"], ["A2", "E3", "B3"], ["D3", "A3", "F#4"]]
cut = [1500, 1800, 2300, 3200]
osti = [
    "D5 A4 B4 A4 D5 E5 D5 A4 F#5 E5 D5 A4 E5 D5 B4 A4",
    "B4 F#4 A4 F#4 B4 D5 B4 F#4 D5 B4 A4 F#4 A4 B4 D5 E5",
    "A4 E4 F#4 E4 A4 B4 A4 E4 B4 A4 F#4 E4 F#4 A4 B4 D5",
    "D5 A4 B4 D5 E5 F#5 E5 D5 F#5 A5 F#5 E5 D5 E5 F#5 A5",
]
for b, b0 in enumerate(BARS):
    groove(b0, bass_notes[b], pads[b], cut[b], osti[b], 600 + b * 200, shaker=b >= 1, glide="A2" if b == 3 else None)
    if b % 2 == 1:
        for k in range(8):
            drums.add(S.hat(1.0, False, 700 + b * 8 + k), b0 + 12 * STEP + k * STEP / 2, -27 + k, pan=0.28)
MELODY = [
    (9.5, 0.25, "A4"), (9.75, 0.25, "B4"), (10.0, 0.5, "D5"), (10.5, 0.25, "E5"), (10.75, 0.25, "D5"),
    (11.0, 1.0, "F#5"), (12.0, 0.25, "E5"), (12.25, 0.25, "D5"), (12.5, 0.5, "B4"),
    (13.0, 0.5, "A4"), (13.5, 0.25, "B4"), (13.75, 0.25, "D5"), (14.0, 0.5, "E5"), (14.5, 0.5, "A5"),
    (15.0, 1.0, "B5"), (16.0, 0.25, "A5"), (16.25, 0.25, "F#5"), (16.5, 0.25, "E5"), (16.75, 0.25, "D5"),
    (17.0, 0.8, "D5"),  # (v3.1: 0.8 s, not 1.3: it no longer lies over the bounce of 雀跃)
]
dizi(MELODY, 9.5, -9, 9)
# geese: wings on the beat, honks calling across the flock
for k in range(8):
    sfx.add(X.wing_flap(0.22, 1.0, 1800 + k), 9.0 + k * 0.5 - 0.06, -27, pan=0.1 + 0.05 * (k % 3))
for t0, f0, pan in [(9.12, 330, 0.25), (9.3, 300, 0.4), (9.86, 345, 0.1), (10.4, 315, 0.35), (10.62, 290, 0.5)]:
    sfx.add(X.goose_honk(f0, 0.2, 1.0, int(t0 * 100)), t0, -22, pan=pan)
fxb.add(S.whoosh(0.5, 900, 6000, 1.0, 1810, 0.5), fr(326) - 0.1, -17, pan=0.3)  # the thread runs on ahead
# beacons: each near tower flares as the line reaches it, then the far chain races off
for k, f in enumerate([329, 337, 357, 378]):
    sfx.add(X.fire_whump(1.0, 1900 + k), fr(f), -13 - k * 0.5, pan=-0.2 + 0.15 * k)
    sfx.add(X.crackle(2.2, 22, 1.0, 1910 + k) * np.linspace(1, 0, S.n_samples(2.2)) ** 1.5, fr(f) + 0.1, -29, pan=-0.2 + 0.15 * k)
for k in range(14):
    sfx.add(X.fire_whump(1.0, 1950 + k, 0.8), fr(336 + k * 3.5), -26 - k * 0.7, pan=0.5 - k * 0.04)
# the telegraph: relay clicks and Morse over the mains hum
morse = [(0, 0.05), (1, 0.05), (3, 0.14), (5, 0.05), (6, 0.14), (8, 0.05), (9, 0.05), (10, 0.05), (12, 0.14), (14, 0.05), (15, 0.05)]
for rep in range(2):
    for s, d in morse:
        sfx.add(S.beep(880.0, d, 1.0), 13.0 + rep * 1.0 + s * STEP / 2, -25, pan=0.15)
        sfx.add(S.wood_tick(1.0, 2000 + rep * 20 + s) * 0.6, 13.0 + rep * 1.0 + s * STEP / 2, -31, pan=0.2)
hum_n = S.n_samples(2.0)
ht = S.t_axis(hum_n)
sfx.add(S.fade(S.norm(np.sin(2 * np.pi * 100 * ht) + 0.4 * np.sin(2 * np.pi * 200 * ht) + 0.2 * np.sin(2 * np.pi * 300 * ht)), 0.2, 0.3), 13.0, -36)
for k in range(10):  # light in the fibre
    bells.add(S.bell(["D6", "F#6", "A6", "B6"][k % 4], 0.9, 1.0, [(1, 1, 0.5), (2.0, 0.2, 0.2)], seed=1100 + k), 15.0 + k * 0.1875, -29 + k * 0.4, pan=rnd.uniform(-0.6, 0.6))
fxb.add(S.riser(1.0, 1.0, 1200), 16.0, -12)
fxb.add(S.reverse_swell(0.62, 1.0, 1201), 17.0 - 0.62, -13)
for w in C["thread"]["words"]:
    for k, f in enumerate(w["at"]):
        ch = w["text"][k]
        if ch in "。、":
            sfx.add(S.wood_tick(1.0, 1300 + f), fr(f), -24)
            continue
        if w["text"].startswith("红"):
            bells.add(S.bell(["E6", "D6", "B5", "A5"][k % 4], 1.0, 1.0, [(1, 1, 0.5), (2.0, 0.25, 0.25), (3.0, 0.08, 0.15)], seed=1400 + f), fr(f), -21, pan=-0.2 + 0.1 * k)
        else:
            strong = ch == "年" and k == 2
            drums.add(S.tom(1.0, 92 + 8 * (k % 2), 1500 + f), fr(f), -13 if strong else -17, pan=-0.15 + 0.1 * k)
            fxb.add(S.whoosh(0.09, 3000, 9000, 1.0, 1600 + f, 0.3), fr(f) - 0.06, -27)

# ======================================================== D · 雀跃更浓于忐忑 (17–21 s)
# Third version: 17–19.5 s is kept exactly (已送达, the two drops, the burst, the climbing figure).
# After that nothing new starts in the middle of a phrase: the climbing strings hand their last note to
# the dizi at 19.5, which sings the rest of the verse from there (section E); the three sparrows land on
# its notes with chirps and wings only.
D = C["inkheart"]
bells.add(S.ding(1.0), fr(D["land"]), -8, pan=0.25)  # 已送达
bass.add(S.bass808("D1", 1.6, 1.0, punch=1.4), fr(D["land"]), -10)
music.add(S.pad(["D3", "F#3", "A3", "E4"], 3.4, 1.0, attack=0.6, release=1.0, cutoff=2400, seed=81), fr(D["land"]), -19)
# a light, skipping groove: kick on 1 and 3, brushed off-beats, pizzicato bounce — two bars and a half
for b0 in (17.0, 19.0, 21.0):
    for s in (0, 8):
        if b0 == 21.0 and s == 8:
            continue
        drums.add(S.kick(1.0, 2100 + int(b0 * 10) + s), b0 + s * STEP, -9)
    for s in range(2, 16 if b0 < 21.0 else 8, 4):
        drums.add(S.hat(1.0, False, 2120 + int(b0 * 10) + s), b0 + s * STEP, -22, pan=0.25)
bounce = "D5 - A4 - B4 D5 - A4 F#5 - E5 D5 - B4 A4 -".split()
for b0, sh in ((17.0, 0), (19.0, 1)):
    for s, nt in enumerate(bounce):
        if nt != "-":
            if b0 == 19.0 and s >= 8:  # third version: the bounce hands the line to the dizi at 20.0
                continue
            music.add(S.guzheng(nt if not sh else {"D5": "E5", "F#5": "A5"}.get(nt, nt), 0.5, 1.0, 0.85, t60=0.7, seed=2200 + int(b0) * 20 + s), b0 + s * STEP, -23, pan=0.3 if s % 2 else -0.3)
# 忐忑: pale ink, a low string that wavers; 雀跃: the dense drop
sfx.add(X.water_drop(620, 1.0, 2300, 0.09), fr(D["drop1"]), -14)
sfx.add(S.splash(0.5, 1.0, 2301), fr(D["drop1"]), -24)
for k, nt in enumerate(["D5", "F#5", "A5", "D6"]):
    music.add(S.guzheng(nt, 1.8, 1.0, 0.7, vib=0.12, seed=1700 + k), fr(D["drop1"]) + k * 0.055, -13, pan=-0.3 + 0.12 * k)
bells.add(S.bell("D6", 1.5, 1.0, seed=1710), fr(D["drop1"]) + 0.2, -24, pan=-0.3)
sfx.add(X.water_drop(420, 1.0, 2302, 0.12), fr(D["drop2"]), -17, pan=0.3)
music.add(S.guzheng("A2", 2.0, 1.0, 0.4, bend=-1, bend_at=0.12, bend_dur=0.35, seed=1720), fr(D["drop2"]), -13, pan=0.35)
music.add(S.guzheng("E3", 1.6, 1.0, 0.4, vib=0.35, seed=1721), fr(D["drop2"]) + 0.25, -20, pan=0.4)
# the burst: 雀跃 throws its ink up — a splash, a bright run climbing two octaves, a rush of small wings
B = fr(D["burst"])
sfx.add(S.splash(0.9, 1.0, 2350), B, -12)
sfx.add(X.water_drop(300, 1.0, 2351, 0.15), B, -16)
drums.add(S.taiko(0.9, 2352), B, -13)
for k, nt in enumerate(["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6"]):
    music.add(S.guzheng(nt, 1.0, 1.0, 0.75, t60=0.9, seed=2360 + k), B + 0.02 + k * 0.035, -15 + k * 0.3, pan=-0.4 + 0.1 * k)
bells.add(S.bell("A6", 1.2, 1.0, seed=2370), B + 0.3, -22, pan=0.2)
for k in range(6):
    sfx.add(X.flutter(0.5, 1.0, 2380 + k), B + 0.08 + k * 0.045, -20 - (k % 3), pan=-0.5 + 0.2 * k)
for k in range(3):
    sfx.add(X.sparrow_chirp(1.0, 2390 + k), B + 0.25 + k * 0.17, -21, pan=-0.3 + 0.3 * k)
# the bed under the flight: the harmony moves, the low end drops in on the burst
bass.add(S.bass808("D1", 1.0, 1.0, punch=1.8, drive=1.3), B, -9)
music.add(S.pad(["B2", "F#3", "A3", "D4"], 2.3, 1.0, attack=0.15, release=0.8, cutoff=2600, seed=2371), 19.0, -18)
bass.add(S.bass808("B1", 0.9, 0.9, punch=1.0, drive=1.1), 19.0, -11)
# a quick guzheng figure climbing with the flock, sixteenths, until the one at the lens goes past
fig = "D5 E5 F#5 A5 B5 A5 F#5 A5 B5 D6 E6 D6 B5 D6 E6 F#6".split()
for k, nt in enumerate(fig):
    t = B + 0.12 + k * STEP
    if t > fr(D["pass"][1]) - 0.02:
        break
    music.add(S.guzheng(nt, 0.45, 1.0, 0.8, t60=0.5, seed=2380 + k * 3), t, -19 + k * 0.25, pan=-0.35 + 0.045 * k)
# the nearest one is off to the left and gone, then back low and fast, left to right
for k in range(4):
    sfx.add(X.wing_flap(0.1, 1.0, 2395 + k, 400, 2600), fr(D["burst"] + 4 + k * 3), -28 - k * 2, pan=-0.35 - 0.18 * k)
C0, C1 = fr(D["cross"][0]), fr(D["cross"][1])
for k in range(10):
    t = k / 9
    near = 1 - abs(t - 0.45) * 1.8
    sfx.add(X.wing_flap(0.09, 1.0, 2400 + k, 450, 2800), C0 - 0.05 + t * (C1 - C0), -31 + 10 * max(0, near), pan=-0.85 + 1.7 * t)
fxb.add(S.whoosh(0.75, 500, 4200, 1.0, 2410, 0.6), C0 + 0.25 * (C1 - C0), -21, pan=0.0)
# three come down on 忐忑: chirps, small ticks and wings only — no notes, so the bounce carries on.
# (v2 also struck a tom and a wavering string on 更浓于 at 19.6, gave each sparrow a note, moved the
# bass to G in the middle of the bar, and began a new dizi phrase at 20.5: that is where it broke.)
for k, f in enumerate(D["lands"]):
    sfx.add(X.sparrow_chirp(1.0, 2420 + k), fr(f) - 0.04, -23, pan=0.25 + 0.12 * k)
    sfx.add(S.wood_tick(1.0, 2430 + k) * 0.7, fr(f), -29, pan=0.25 + 0.12 * k)
    sfx.add(X.wing_flap(0.12, 1.0, 2440 + k, 500, 3000), fr(f) - 0.12, -30, pan=0.25 + 0.12 * k)
bass.add(S.bass808("B1", 0.95, 0.9, punch=0.6, drive=1.1), 20.0, -13)  # the bar stays on B minor to its end
for k in range(3):
    sfx.add(X.flutter(0.7, 1.0, 2500 + k), fr(D["fly"]) + k * 0.1, -24, pan=0.3 + 0.15 * k)
    sfx.add(X.sparrow_chirp(1.0, 2510 + k, 2), fr(D["fly"]) + 0.12 + k * 0.13, -27, pan=0.5)
fxb.add(S.whoosh(0.6, 600, 5000, 1.0, 2520, 0.5), fr(D["fly"]) + 0.15, -25, pan=0.4)
sfx.add(X.paper_rustle(0.7, 1.0, 2530), fr(D["end"]) - 0.5, -27)  # the sheet parts at the fold

# ======================================================== E · the verse answered · 与君南北不同春 (21–26 s)
E = C["spring"]
# The verse answered: the climbing strings of the burst end on F#, and the dizi takes that F# up at
# 19.5 — the long note of the verse's second bar, joined in progress — then sings the rest of the verse,
# the very notes of 12–17 s eight seconds on. E D B fall with the three sparrows landing on 忐忑; then
# A B D E A over G, the long B across 南 and 北 (Bm), the run down over A, home on D at 25 (春 lands
# just before it). The cut to 南北 at 22.0 falls on the bar's third beat; the line runs on through it.
VERSE_HALF = [(19.5, 0.5, "F#5")] + [(s + 8.0, d, n) for s, d, n in MELODY if s >= 12.0]
VERSE_HALF[-1] = (25.0, 1.0, "D5")
dizi(VERSE_HALF, 19.5, -10, 2650, vib=0.012)
music.add(S.pad(["G2", "D3", "B3", "E4"], 2.1, 1.0, attack=0.3, release=0.6, cutoff=1800, seed=2610), 21.0, -20)
music.add(S.pad(["B2", "F#3", "A3", "D4"], 1.1, 1.0, attack=0.25, release=0.4, cutoff=1500, seed=2611), 23.0, -21)
music.add(S.pad(["A2", "E3", "C#4", "E4"], 1.1, 1.0, attack=0.2, release=0.4, cutoff=1500, seed=2612), 24.0, -21)
music.add(S.pad(["D3", "A3", "F#4"], 1.3, 1.0, attack=0.15, release=0.8, cutoff=1600, seed=2613), 25.0, -21)
bass.add(S.bass808("G1", 1.9, 0.8, punch=0.6, drive=1.2), 21.0, -14)
bass.add(S.bass808("B1", 0.95, 0.8, punch=0.6, drive=1.2), 23.0, -14)
bass.add(S.bass808("A1", 0.95, 0.8, punch=0.6, drive=1.2), 24.0, -14)
bass.add(S.bass808("D2", 0.95, 0.8, punch=0.6, drive=1.2), 25.0, -14)
# the pulse stays one soft kick a second from 雀跃 through 南北 into the clock, off-beats brushed
drums.add(S.kick(1.0, 2620) * 0.8, 22.0, -14)
drums.add(S.kick(1.0, 2621) * 0.8, 24.0, -14)
for t in (23.0, 25.0):
    drums.add(S.kick(1.0, 5300 + int(t)) * 0.8, t, -15)
for t in (22.5, 23.5, 24.5):
    drums.add(S.hat(1.0, False, 5320 + int(t * 2)) * 0.7, t, -27, pan=0.28)
amb.add(X.rain(4.6, 1.0, 2600) * np.minimum(1, np.linspace(0, 6, S.n_samples(4.6))), fr(E["start"]), -28, pan=-0.85)
amb.add(X.wind(4.6, 1.0, 2601, 500, 3200) * np.minimum(1, np.linspace(0, 5, S.n_samples(4.6))), fr(E["start"]), -31, pan=0.85)
# the word painting stays, but quiet and inside the chord, so it colours the tune instead of taking
# its place: 南 a low string on the left (south), 北 a small bell on the right (north), 春 a soft drum,
# and the chord of home on the downbeat after it, in both lights
music.add(S.guzheng("B2", 2.2, 1.0, 0.45, seed=2632), fr(E["nan"]), -19, pan=-0.75)  # 南
bells.add(S.bell("F#6", 2.0, 1.0, [(1, 1, 0.7), (2.0, 0.2, 0.3), (3.01, 0.06, 0.2)], seed=2633), fr(E["bei"]), -24, pan=0.75)  # 北
amb.add(X.wind(1.2, 1.0, 2634, 900, 4000), fr(E["bei"]) - 0.1, -31, pan=0.8)
drums.add(S.taiko(1.0, 2646), fr(E["chun"]), -18)  # 春
for nt, pan, db in [("D3", -0.6, -16), ("D4", -0.3, -17), ("A4", 0.3, -18), ("D5", 0.6, -18)]:
    music.add(S.guzheng(nt, 2.4, 1.0, 0.6, seed=2640 + len(nt) * 7 + int(pan * 10)), 25.0 + (pan + 0.6) * 0.02, db, pan=pan)
bells.add(S.bell("D6", 2.2, 1.0, seed=2645), 25.0, -24)
sfx.add(S.wood_tick(1.0, 2647), fr(E["stop"]), -27)
sfx.add(X.water_drop(1300, 1.0, 2660), fr(E["drop"]), -18)

# ======================================================== F1 · 昔人多恨漏声长 (25–28 s)
K = C["clock"]
amb.add(X.crackle(3.2, 6, 1.0, 2700), fr(K["start"]), -38, pan=-0.4)  # candle
amb.add(S.room_tone(3.2, 1.0, 2701), fr(K["start"]), -44)
music.add(S.pad(["A2", "E3", "B3"], 3.0, 1.0, attack=0.4, release=0.8, cutoff=1300, seed=2710), 26.0, -19.5)
bass.add(S.bass808("A1", 1.9, 0.8, punch=0.5, drive=1.1), 26.0, -14)
bass.add(S.bass808("B1", 1.0, 0.8, punch=0.5, drive=1.1), 28.0, -15)
drip_notes = ["A5", "F#5", "E5", "D5", "B4", "A4", "F#4"]  # the drops carry the melody down
for k, f in enumerate(K["drips"]):
    last = k == len(K["drips"]) - 1
    soft = 3.0 if k == 0 else 0.0  # the first lands while the picture is still coming up out of the dark
    sfx.add(X.water_drop(S.hz(drip_notes[k]) / 1.55, 1.0, 2720 + k, 0.11), fr(f), (-10 if not last else -9) - soft, pan=0.18)
    bells.add(S.bell(drip_notes[k], 2.4, 1.0, [(1, 1, 0.9), (2.0, 0.12, 0.3)], seed=2730 + k), fr(f), -17.5 - soft * 0.7, pan=0.18)
    if k % 2 == 1:
        sfx.add(S.wood_knock(1.0, 2740 + k) * 0.6, fr(f) + 0.25, -29, pan=-0.2)  # the clock's tock between drops
for k in range(7):
    sfx.add(X.water_drop(S.hz(["E6", "D6"][k % 2]) / 1.55, 1.0, 2750 + k, 0.05), fr(K["start"] + k * 15 + 5), -33, pan=-0.3)
# the wait keeps a pulse: a soft heartbeat-kick on 1 and 3, a breath of shaker between
for k in range(6):
    t0 = 26.0 + k * 1.0
    drums.add(S.kick(1.0, 2770 + k) * 0.8, t0, -15)
    drums.add(S.hat(1.0, False, 2780 + k) * 0.7, t0 + 0.5, -28, pan=0.3)
fxb.add(S.reverse_swell(0.5, 1.0, 2760), fr(K["match"]) - 0.5, -24)

# ======================================================== F2 · 只今无处听更漏 (28–31 s)
fxb.add(S.whoosh(0.35, 3000, 600, 1.0, 2800, 0.2), fr(K["match"]), -22)
ui.add(X.ui_blip(S.hz("F#5"), 1.0), fr(K["match"]) + 0.02, -18)
# G under the dots (A F# E on the guzheng make it G major 9), so the tune of 一线 can come home to D
music.add(S.pad(["G2", "D3", "B3", "F#4"], 2.0, 1.0, attack=0.3, release=0.7, cutoff=1800, seed=2810), 29.0, -20)
bass.add(S.bass808("G1", 1.9, 0.8, punch=0.5, drive=1.1), 29.0, -15)
for k, f in enumerate(K["dots"]):  # the typing dots fall like the drops did
    ui.add(X.ui_blip(S.hz(["E6", "D6", "B5"][k]), 1.0), fr(f), -16, pan=-0.15)
    sfx.add(X.water_drop(S.hz(["E6", "D6", "B5"][k]) / 1.55, 1.0, 2820 + k, 0.04), fr(f), -30, pan=-0.15)
# 无处听更漏: the next drop is due on the stop — and does not come
for k in range(4):
    drums.add(S.hat(1.0, False, 2830 + k), 29.0 + 0.25 + k * 0.5, -28, pan=0.3)
music.add(S.guzheng("A4", 2.0, 1.0, 0.5, seed=2840), fr(K["line2"]), -18, pan=0.1)
music.add(S.guzheng("F#4", 2.0, 1.0, 0.5, seed=2841), fr(K["line2"]) + 0.5, -19, pan=0.1)
music.add(S.guzheng("E4", 2.4, 1.0, 0.5, vib=0.1, seed=2842), fr(K["line2"]) + 1.0, -18, pan=0.1)
fxb.add(S.riser(1.0, 1.0, 2850), fr(C["history"]["start"]) - 1.0, -22)


def speed_ticks(samples, gain=1.0, seed=0, per_px=0.55, f0=2600):
    """Scroll ticks whose rate follows the on-screen scroll speed: samples = [(frame, px per frame)]."""
    r = np.random.default_rng(seed)
    t0, t1 = fr(samples[0][0]), fr(samples[-1][0])
    fs = np.array([fr(f) for f, _ in samples])
    vs = np.array([v for _, v in samples])
    n = S.n_samples(t1 - t0 + 0.1)
    y = np.zeros(n)
    tt, k = t0, 0
    while tt < t1:
        v = float(np.interp(tt, fs, vs))
        rate = max(0.0, v * per_px)
        if rate < 1.5:
            tt += 0.05
            continue
        c = S.modal([f0 * r.uniform(0.9, 1.1)], [0.006], [1], 0.02, 1.0, 9000 + seed * 100 + k, 0.5)
        i = S.n_samples(tt - t0)
        m = min(len(c), n - i)
        y[i:i + m] += c[:m] * r.uniform(0.5, 1.0) * min(1.0, 0.35 + v / 60)
        tt += 1.0 / rate
        k += 1
    return S.norm(y, gain), t0


def ember(dur, vel=1.0, seed=0):
    """Paper glyphs catching fire: soft high crackle over a breathy hiss."""
    n = S.n_samples(dur)
    t = S.t_axis(n)
    r = np.random.default_rng(seed)
    hiss = S.bp(r.standard_normal(n), 2500, 9000) * 0.25 * np.minimum(1, t / 0.4)
    return S.norm(X.crackle(dur, 38, 1.0, seed) * 0.8 + hiss, vel)


# ======================================================== G · 往事 — the verse again (31.0–39.0 s)
# The record runs back to where it all began, and so does the tune: the verse a third time, the same
# melody as 一线 with a bar of the same groove under each of its bars. Its strong notes fall on the
# picture: D as the record starts back (32.0), the held F# on 2023 where his thumb lingers (33.0), the
# held B as the 月 lift off the page (37.0), home on D as the moon comes whole (39.0).
G = C["history"]
STOP = fr(G["stop"])
fxb.add(S.whoosh(0.8, 400, 5000, 1.0, 2900, 0.7), fr(G["start"]), -17)
# two pulls back through the years with a breath on 2023 between them; ticks follow the scroll
HS = [(956, 0), (962, 1.9), (965, 11.8), (968, 30.1), (971, 56.9), (974, 88.9), (977, 56.9), (980, 30.1), (983, 11.8), (986, 1.9), (989, 3.6), (1013, 3.6), (1016, 1.8),
      (1019, 2.1), (1022, 8.4), (1025, 19.0), (1028, 33.7), (1031, 52.7), (1034, 75.8), (1037, 103.2), (1040, 113.3), (1043, 84.5), (1046, 59.9), (1049, 39.6), (1052, 23.4), (1055, 11.5), (1058, 3.8), (1061, 0.3), (1064, 0)]
ticks, tt0 = speed_ticks(HS, 1.0, 2901)
sfx.add(ticks, tt0, -25, pan=0.12)
sfx.add(X.paper_rustle(0.9, 1.0, 2902, 1500, 8000), fr(932), -31)
sfx.add(X.paper_rustle(1.3, 1.0, 2904, 1500, 8000), fr(990), -31)
# a small wooden flip as each year's divider goes by, lower as they go back
for k, f in enumerate([975, 990, 1034, 1039, 1043, 1047]):
    sfx.add(S.wood_tick(1.0, 2910 + k), fr(f), -24, pan=-0.45)
    bells.add(S.bell(["B5", "A5", "F#5", "E5", "D5", "B4"][k], 0.9, 1.0, [(1, 1, 0.5), (2.0, 0.2, 0.2)], seed=2920 + k), fr(f), -32, pan=-0.45)
# 31.0 is where the drop that never comes (无处听更漏) would have fallen: no drum there, only the
# harmony, the low end and the strings, and the tune's first two notes; the drums come in with the
# record (32.0) on the tune's first D
b0 = 31.0
music.add(S.pad(["D3", "A3", "E4"], 2.0, 1.0, attack=0.3, release=0.6, cutoff=2600, seed=3060), b0, -21)
bass.add(S.bass808("D2", 11 * STEP + 0.05, 0.8, punch=0.5, drive=1.2), b0, -9)
bass.add(S.bass808("D2", 5 * STEP + 0.05, 1.0), b0 + 11 * STEP, -7)
for s, nt in enumerate(osti[0].split()):
    music.add(S.guzheng(nt, 0.7, 1.0, 0.8 if s >= 8 else 0.62, t60=1.1, seed=3070 + s), b0 + s * STEP, (-20 if s >= 8 else -23) + (1.5 if s % 4 == 0 else 0), pan=-0.35 if s % 2 else 0.35)
shaker(b0, b0 + 1.0, -29, 3090)
drums.add(S.crash(1.0, 3001, 2.0), b0 + 1.0, -13, pan=-0.3)
drums.add(S.taiko(1.0, 3002), b0 + 1.0, -11)
drums.add(S.snare(1.0, 3006), b0 + 8 * STEP, -10)
drums.add(S.clap(1.0, 3007), b0 + 8 * STEP, -13, pan=0.1)
drums.add(S.kick(1.0, 3003), b0 + 8 * STEP, -8)
drums.add(S.kick(1.0, 3004), b0 + 11 * STEP, -8)
for s in range(8, 16, 2):
    drums.add(S.hat(1.0, s == 14, 3010 + s), b0 + s * STEP, -18 if s % 4 == 0 else -21, pan=0.28)
for s in range(8, 16):
    drums.add(S.hat(1.0, False, 3040 + s) * 0.6, b0 + s * STEP + 0.006, -27 + (2 if s % 4 == 2 else 0), pan=-0.32)
groove(33.0, "B1", ["B2", "F#3", "D4"], 2200, osti[1], 3200, crash=False, osti_db=-20)
# 35.0 A: the record settles on 2019 (35.4), the search, the pick — the groove lighter, still walking
groove(35.0, "A1", ["A2", "E3", "B3"], 2300, osti[2], 3300, crash=False, full=False, osti_db=-21, kick_db=-8)
drums.add(S.taiko(1.0, 3300), STOP, -15)  # the record stops on 2019: an accent off the beat
sfx.add(S.wood_knock(1.0, 3301), STOP, -18)
# 37.0 D: the 月 lift off and burn — the crash marks the cut, the tune holds its B across it
groove(37.0, "D2", ["D3", "A3", "F#4"], 2800, osti[3], 3350, osti_db=-20)
dizi([(s + 22.0, d, n) for s, d, n in MELODY], 31.5, -10, 3190)
# THE REFRAIN is the dizi line of the lights, as v3 played it there (its own first bar is 54.5)
CITY_LINE = [(56.0, 0.25, "A5"), (56.25, 0.25, "B5"), (56.5, 0.75, "D6"), (57.25, 0.25, "E6"), (57.5, 0.5, "D6"), (58.0, 0.5, "B5"),
             (58.5, 0.75, "E6"), (59.25, 0.25, "F#6"), (59.5, 0.5, "E6"), (60.0, 0.25, "D6"), (60.25, 0.25, "E6"),
             (60.5, 1.0, "A6"), (61.5, 0.5, "F#6"), (62.0, 0.5, "E6"), (62.5, 1.25, "D6")]
for k, d in enumerate([0, 3, 6]):  # y · u · e
    ui.add(S.key_tap(1.0, 3310 + k), fr(G["search"] + d), -18)
ui.add(S.wood_tick(1.0, 3320), fr(G["search"] + 8), -24)
sfx.add(S.wood_knock(1.0, 3321), fr(G["pick"]), -17)  # 拣字, once more (no note: the tune is singing)
sfx.add(S.clack(1.0, 3322), fr(G["pick"]) + 0.02, -18)
bells.add(X.shimmer(0.9, ["D7", "A6", "F#6", "E7", "B6"], (30, 60), 1.0, 3330, 0.4), fr(G["glow"]), -24)
bells.add(S.bell("A6", 1.8, 1.0, seed=3331), fr(G["glow"]), -26, pan=0.2)
fxb.add(S.riser(fr(G["end"]) - fr(G["lift"]) + 0.3, 1.0, 3340), fr(G["lift"]), -18)
fxb.add(S.whoosh(0.6, 800, 7000, 1.0, 3341, 0.8), fr(G["lift"]), -19, pan=-0.1)

# ======================================================== H · 月 → pre-chorus → the count (36.8–44.5 s)
M = C["moon"]
R = C["reply"]
T_FORM, T_FOLD, T_LAPSE = fr(M["form"]), fr(M["fold"]), fr(C["story"]["lapseEnd"])
MID = fr(M["midnight"])
TK = [fr(f) for f in M["ticks"]]
# every 月 lifts off the record and burns into light that spirals into the moon — under the verse
_em = ember(T_FORM - fr(M["start"]) + 0.6, 1.0, 3400)
amb.add(_em * np.linspace(0.4, 1, len(_em)), fr(M["start"]), -28, pan=0.1)
bells.add(X.shimmer(T_FORM - fr(M["start"]), ["D6", "E6", "F#6", "A6", "B6", "D7"], (10, 60), 1.0, 3410, 0.5), fr(M["start"]), -23)
fxb.add(S.reverse_swell(T_FORM - fr(M["start"]), 1.0, 3411), fr(M["start"]), -20)
# 39.0 the verse comes home on D as the moon comes whole; 39.33 its bloom, soft and inside the chord
music.add(S.pad(["D3", "A3", "F#4", "E5"], 1.15, 1.0, attack=0.25, release=0.45, cutoff=1700, seed=3434), 39.0, -20)
bass.add(S.bass808("D2", 1.0, 1.0, punch=0.8), 39.0, -11)
drums.add(S.kick(1.0, 3436), 39.0, -10)
drums.add(S.hat(1.0, False, 3437) * 0.7, 39.5, -25, pan=0.3)
bells.add(X.gong("D3", 4.0, 1.0, 3430), T_FORM, -19)
bells.add(S.bell("A4", 3.5, 1.0, seed=3431), T_FORM, -21, pan=-0.2)
bells.add(S.bell("D5", 3.5, 1.0, seed=3432), T_FORM + 0.04, -22, pan=0.2)
music.add(X.harmonic("F#6", 2.6, 1.0, 3433), T_FORM + 0.3, -26, pan=0.3)
fxb.add(S.reverse_swell(0.6, 1.0, 3438), 39.4, -19)  # the breath in before the night opens
# PRE-CHORUS (40.0–43.0). The moon breathes out and the night opens south and north: the strongest
# accent since the title. Then the minutes run on toward midnight: the harmony climbs a step every two
# beats (Bm, G, A), the drums tighten, and the dizi climbs the rising line of her reply.
drums.add(S.crash(1.0, 3459, 2.2), 40.0, -12, pan=0.2)
drums.add(S.taiko(1.0, 3460), 40.0, -10)
drums.add(S.kick(1.0, 3461), 40.0, -7)
sfx.add(X.paper_rustle(0.7, 1.0, 3460, 600, 5000), T_FOLD - 0.15, -21)
fxb.add(S.whoosh(0.7, 300, 3000, 1.0, 3461, 0.4), T_FOLD - 0.1, -19)
music.add(S.guzheng("F#3", 2.4, 1.0, 0.45, vib=0.04, seed=3463), T_FOLD + 0.1, -21, pan=-0.7)  # 南
bells.add(S.bell("F#6", 2.0, 1.0, [(1, 1, 0.7), (2.0, 0.2, 0.3), (3.01, 0.06, 0.2)], seed=3464), T_FOLD + 0.2, -25, pan=0.7)  # 北
for t0, bn, pd, sd in ((40.0, "B1", ["B2", "F#3", "D4", "A4"], 3462), (41.0, "G1", ["G2", "D3", "B3", "F#4"], 3465), (42.0, "A1", ["A2", "E3", "B3", "D4"], 3467)):
    bass.add(S.bass808(bn, 1.0, 1.0, punch=0.9), t0, -10)
    music.add(S.pad(pd, 1.1, 1.0, attack=0.12, release=0.35, cutoff=1500 + 300 * (t0 - 40.0), seed=sd), t0, -20)
for k, t in enumerate((40.5, 41.0, 41.5, 42.0, 42.5)):
    drums.add(S.kick(1.0, 3470 + k), t, -11 if t % 1 == 0 else -13)
for t in (41.0, 42.0):
    drums.add(S.snare(1.0, 3476 + int(t)), t, -14)
    drums.add(S.clap(1.0, 3478 + int(t)), t, -17, pan=0.1)
for k in range(4):  # a snare run into the count
    drums.add(S.snare(1.0, 3600 + k), 42.5 + k * STEP, -22 + k * 2)
for k in range(11):
    drums.add(S.hat(1.0, False, 3490 + k), 40.25 + k * 0.25, -23 if k % 2 == 1 else -25, pan=0.28)
shaker(40.0, 43.0, -30, 3500, shape=[(40.0, -2.0), (43.0, 1.0)])
for j, notes in enumerate((("B3", "F#4", "B4", "D5"), ("G3", "D4", "G4", "B4"), ("A3", "E4", "A4", "B4"))):
    for k, nt in enumerate(notes):
        music.add(S.guzheng(nt, 0.8, 1.0, 0.7, t60=1.2, seed=3510 + j * 4 + k), 40.0 + j + k * 0.25, -21 + j, pan=-0.3 if k % 2 else 0.3)
PRE = [(40.5, 0.25, "D5"), (40.75, 0.25, "E5"), (41.0, 0.5, "F#5"), (41.5, 0.25, "E5"), (41.75, 0.25, "F#5"), (42.0, 0.25, "A5"), (42.25, 0.7, "B5")]
dizi_r([(s, d, octave(n, REG)) for s, d, n in PRE], 40.5, -11, 3520)
lapse = X.ratchet_scroll(T_LAPSE - T_FOLD, 6, 34, 1.0, 3470)
sfx.add(lapse * np.linspace(0.3, 1, len(lapse)), T_FOLD + 0.05, -27, pan=-0.15)
fxb.add(S.riser(T_LAPSE - T_FOLD, 1.0, 3471), T_FOLD, -20)
# 23:59:57 · 58 · 59: the one three-beat bar of the film, over a held dominant (A), the drums holding
# their breath; on 59 the dizi breathes in (A, B) and 子正 lands the refrain's first D
for k, f in enumerate(M["ticks"]):
    sfx.add(X.clock_tick(1.0, 3480 + k, k == 2), fr(f), -16 + k * 2.0)
    drums.add(S.heartbeat(1.0, k == 2), fr(f), -17 + k * 2)
music.add(S.sine_pad(["A1", "E2"], MID - TK[0] - 0.1, 1.0, attack=0.25, release=0.2), TK[0], -19)
music.add(S.pad(["A2", "E3", "B3", "D4"], MID - TK[0] - 0.1, 1.0, attack=0.35, release=0.2, cutoff=1100, seed=3485), TK[0], -23)
fxb.add(S.reverse_swell(1.2, 1.0, 3490), MID - 1.2, -15)

# ======================================================== H2 · CHORUS: 子正 → her reply → 读懂 (44.5–52.5 s)
# The lights' dizi line, all of it, heard here first: its first D on the 子正 bell; the climb of its
# second bar under her reply's light flying from her window to his; its high A as the light lands at
# his window (48.5); home on D as 已读懂 is stamped and her reply opens (50.5). D · Bm · G · D under
# it, a broad beat one size below the lights.
dizi_r([(s - 12.0, d, octave(n, REG)) for s, d, n in CITY_LINE], 44.0, -11, 3560, vib=0.014)
# 子正: a bell, not a blow — and the downbeat of the chorus
bells.add(S.bell("D4", 5.0, 1.0, seed=3501), MID, -12)
bells.add(S.bell("A3", 5.0, 1.0, seed=3502), MID + 0.01, -16, pan=0.2)
bells.add(X.gong("D2", 6.5, 1.0, 3500), MID, -19)
bells.add(S.bell("D5", 3.0, 1.0, [(1, 1, 0.7), (2.0, 0.2, 0.3), (3.01, 0.06, 0.2)], seed=3505), MID + 0.02, -23, pan=-0.2)
gust = X.wind(5.5, 1.0, 3506, 220, 2600)
gust = gust * env_curve(len(gust), [(0, 0.0), (0.3, 1.0), (1.3, 0.75), (3.0, 0.35), (5.5, 0.0)])
fxb.add(pan_sweep(gust, -0.35, 0.4), MID, -21)
fxb.add(S.whoosh(1.5, 250, 2400, 1.0, 3507, 0.22), MID, -23, pan=0.1)
pet = X.paper_rustle(2.6, 1.0, 3508, 2500, 9000)  # apricot petals carried under the moon into the north
sfx.add(pan_sweep(pet, -0.7, 0.6), MID + 0.1, -35)
bells.add(X.shimmer(2.6, ["D7", "E7", "F#7", "A7", "B7"], (12, 2), 1.0, 3509, 0.28), MID + 0.15, -33)  # the snow
music.add(X.harmonic("F#6", 2.4, 1.0, 3510), MID + 0.6, -27, pan=0.2)  # the moon comes clear
music.add(X.harmonic("A6", 2.4, 1.0, 3511), MID + 1.1, -28, pan=-0.15)
bells.add(S.bell("A6", 1.2, 1.0, [(1, 1, 0.5), (2.0, 0.2, 0.2)], seed=3512), fr(M["midnight"] + 9), -28, pan=0.6)  # her window
# the beat: a crash on 子正 and on the landing; kick on one (and the push before three), snare on three
drums.add(S.crash(1.0, 3700, 2.4), MID, -12, pan=-0.2)
drums.add(S.taiko(1.0, 3701), MID, -9)
for b in range(4):
    b0 = MID + 2.0 * b
    drums.add(S.kick(1.0, 3710 + b), b0, -7 if b == 0 else -9)
    drums.add(S.kick(1.0, 3714 + b), b0 + 11 * STEP, -13)
    drums.add(S.snare(1.0, 3720 + b), b0 + 8 * STEP, -12)
    drums.add(S.clap(1.0, 3724 + b), b0 + 8 * STEP, -15, pan=0.1)
    for s in range(0, 16, 2):
        drums.add(S.hat(1.0, s == 14 and b < 3, 3730 + b * 16 + s), b0 + s * STEP, -24 if s % 4 == 0 else -26, pan=0.28)
shaker(MID, MID + 8.0, -30, 3800)
drums.add(S.crash(1.0, 3705, 2.0), 48.5, -15, pan=0.3)
drums.add(S.taiko(1.0, 3706), 48.5, -11)  # the light lands at his window
for b0, bn, pd, sd in ((44.5, "D1", ["D3", "A3", "F#4", "E5"], 3540), (46.5, "B1", ["B2", "F#3", "D4", "A4"], 3541), (48.5, "G1", ["G2", "D3", "B3", "F#4"], 3542), (50.5, "D2", ["D3", "A3", "F#4"], 3543)):
    bass.add(S.bass808(bn, 1.9, 1.0, punch=1.2 if b0 == MID else 0.9), b0, -8 if b0 == MID else -10)
    music.add(S.pad(pd, 2.0, 1.0, attack=0.3, release=0.6, cutoff=1900, seed=sd), b0, -20)
music.add(S.sine_pad(["D2", "A2"], 2.0, 1.0, attack=0.6, release=0.8), MID, -24)
# the strings walk in eighths under the tune on each bar's chord (the last bar is left to the three
# answers to her reply)
for j, (b0, notes) in enumerate(((44.5, "D4 A4 D5 E5 F#5 E5 D5 A4"), (46.5, "B3 F#4 B4 D5 E5 D5 B4 F#4"), (48.5, "G3 D4 G4 A4 B4 A4 G4 D4"))):
    for k, nt in enumerate(notes.split()):
        music.add(S.guzheng(nt, 0.9, 1.0, 0.7, t60=1.4, seed=3580 + j * 8 + k), b0 + k * 0.25, -20, pan=-0.3 if k % 2 else 0.3)
# his reply on its way: typing, then the streak from the north window to the south
for k in range(3):
    ui.add(X.ui_blip(S.hz(["F#6", "A6", "B6"][k]), 1.0), fr(R["typing"]) + k * 0.25, -28, pan=0.5)
streak = S.whoosh(fr(R["land"]) - fr(R["fly"]) + 0.1, 500, 7000, 1.0, 3570, 0.85)
fxb.add(pan_sweep(streak, 0.8, -0.6), fr(R["fly"]), -15)
bells.add(X.shimmer(0.9, ["A6", "B6", "D7", "E7"], (20, 50), 1.0, 3571, 0.3), fr(R["fly"]), -26)

# ======================================================== I · 读懂 → turnaround (48.4–54.5 s)
LAND = fr(R["land"])
fxb.add(S.reverse_swell(0.4, 1.0, 3600), LAND - 0.4, -18)
sfx.add(X.paper_rustle(0.4, 1.0, 3601), LAND, -24)
gl2 = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6"]
for k, nt in enumerate(gl2):
    music.add(S.guzheng(nt, 1.4, 1.0, 0.75, seed=3610 + k), LAND - 0.18 + k * 0.02, -20 + k * 0.3, pan=0.5 - k * 0.1)
# the half he never sent surfaces under the warmth: a string sighs down onto the chord, a bell runs
# backwards (v2's string fell a semitone, off the key, and loud)
GH = fr(R["ghost"])
music.add(S.guzheng("A2", 2.4, 1.0, 0.4, bend=-2, bend_at=0.2, bend_dur=0.5, seed=3630), GH, -20, pan=-0.2)
rb = S.bell("E5", 1.2, 1.0, seed=3631)[::-1]
bells.add(rb, GH + 0.6 - len(rb) / SR, -26, pan=-0.3)
sfx.add(X.paper_rustle(0.6, 1.0, 3632, 400, 2500), GH, -32)
# 已读懂
sfx.add(X.stamp(1.0, 3640), fr(R["dong"]), -14, pan=0.35)
bells.add(S.ding(1.0), fr(R["dong"]) + 0.03, -16, pan=0.35)
fxb.add(S.whoosh(0.25, 1500, 5000, 1.0, 3641, 0.6), fr(R["bubble"]) - 0.12, -25, pan=-0.2)
# her reply opens line by line while the refrain holds its D: a small bell on each line, in the chord
for k, f in enumerate([R["p1"], R["p2"], R["p3"]]):
    bells.add(S.bell(["D6", "E6", "A6"][k], 1.2, 1.0, [(1, 1, 0.5), (2.0, 0.2, 0.25)], seed=3700 + k), fr(f), -26, pan=-0.3 + 0.3 * k)
bells.add(X.shimmer(1.0, ["B6", "A6", "F#6", "E6", "D6"], (30, 8), 1.0, 3710, 0.4), fr(R["p3"]) + 0.3, -29)
# TURNAROUND = the pre-chorus once more (52.5–54.5): G, then A, the dizi's rising line again (as at
# 40.5, twelve seconds on), the drums tightening into the fill; the sheet goes back into his window
# and the groove of the lights picks up on the bar
CB = 54.5  # the city's first bar
dizi_r([(s + 12.0, d, octave(n, REG)) for s, d, n in PRE], 52.5, -11, 3790)
for t0, bn, pd, sd in ((52.5, "G1", ["G2", "D3", "B3", "E4"], 3780), (53.5, "A1", ["A2", "E3", "C#4", "E4"], 3781)):
    bass.add(S.bass808(bn, 0.95, 1.0, punch=0.9), t0, -10)
    music.add(S.pad(pd, 1.05, 1.0, attack=0.15, release=0.4, cutoff=2400, seed=sd), t0, -20)
for j, notes in enumerate((("G3", "D4", "G4", "B4"), ("A3", "E4", "A4", "B4"))):
    for k, nt in enumerate(notes):
        music.add(S.guzheng(nt, 0.8, 1.0, 0.7, t60=1.2, seed=3760 + j * 4 + k), 52.5 + j + k * 0.25, -20 + j, pan=-0.3 if k % 2 else 0.3)
drums.add(S.kick(1.0, 3791), 52.5, -9)
for k, t in enumerate((53.0, 53.5)):
    drums.add(S.kick(1.0, 3792 + k), t, -11)
drums.add(S.snare(1.0, 3750), 53.0, -15)
drums.add(S.clap(1.0, 3751), 53.0, -18, pan=0.1)
for k in range(6):
    drums.add(S.hat(1.0, False, 3795 + k), 52.75 + k * 0.25, -23 if k % 2 else -25, pan=0.28)
shaker(52.5, 54.5, -30, 3770, shape=[(52.5, -1.0), (54.5, 1.5)])
# the bar's last beat after the held D turns round into it: a snare run and four strings, as before the count
for k in range(4):
    drums.add(S.snare(1.0, 3640 + k), 52.0 + k * STEP, -23 + k * 2)
for k, nt in enumerate(["D5", "E5", "F#5", "A5"]):
    music.add(S.guzheng(nt, 0.5, 1.0, 0.78, t60=0.7, seed=3655 + k), 52.0 + k * STEP, -21 + k * 0.5, pan=-0.2 + 0.13 * k)
drums.add(S.snare(1.0, 3681), 54.0, -15)
drums.add(S.tom(1.0, 100, 3682), 54.25, -19, pan=-0.2)
drums.add(S.tom(1.0, 88, 3683), 54.375, -17, pan=0.1)
fxb.add(S.reverse_swell(CB - 53.5, 1.0, 3720), 53.5, -15)
music.add(S.pad(["D3", "A3", "E4"], CB - fr(R["pull"]) + 0.2, 1.0, attack=0.5, release=0.3, cutoff=1500, seed=3721), fr(R["pull"]), -22)
hum = X.city_hum(11.6, 1.0, 3722)
amb.add(hum * env_curve(len(hum), [(0, 0.0), (1.4, 1.0), (8.6, 1.0), (11.6, 0.0)]), fr(R["pull"]), -33)

# ======================================================== J · 人间灯火灿于星 (54.5–65.0 s)
CY = C["city"]
BEATS = [1665 + k * 15 for k in range(13)]  # 55.5–61.5: a window wakes on every beat
PK = fr(CY["peak"])  # 60.5
LT = 1875 / 30  # 62.5 the last thread lands in the dark pavilion window
DIVE, CEND = fr(CY["dive"]), fr(CY["end"])  # 63.0–65.0
osti_j = [
    "D5 A4 B4 D5 E5 F#5 E5 D5 F#5 A5 F#5 E5 D5 E5 F#5 A5",
    "B4 F#4 A4 B4 D5 E5 D5 B4 D5 F#5 E5 D5 B4 D5 E5 F#5",
    "B4 D5 E5 D5 B4 A4 B4 D5 E5 F#5 E5 D5 B4 D5 E5 F#5",
    "D5 F#5 A5 F#5 E5 D5 B4 D5 E5 F#5 A5 B5 A5 F#5 E5 D5",
]
groove(CB, "D2", ["D3", "A3", "F#4", "E5"], 3000, osti_j[0], 3800, osti_db=-19)
groove(CB + 2, "B1", ["B2", "F#3", "D4", "A4"], 3300, osti_j[1], 3900, osti_db=-18, glide="G1")
groove(CB + 4, "G1", ["G2", "D3", "B3", "F#4"], 3600, osti_j[2], 4000, osti_db=-18)
groove(CB + 6, "D2", ["D3", "A3", "F#4", "E5", "A5"], 4200, osti_j[3], 4050, osti_db=-17, kick_db=-5)  # the peak's bar
# 62.5 the last bar: no crash, no snare; the bass climbs from G to A and the drums thin out
# into the dive, gone by the last beat before the window
b0 = LT
for t, db in ((b0, -7), (b0 + 0.75, -10), (b0 + 1.0, -9), (b0 + 1.5, -11)):
    drums.add(S.kick(1.0, 4100 + int(t * 8)), t, db)
for s in range(2, 16, 4):
    drums.add(S.hat(1.0, False, 4110 + s), b0 + s * STEP, -22, pan=0.28)
for s in range(20):  # the shaker alone carries on to the window, growing with the rise
    drums.add(S.hat(1.0, False, 4130 + s) * 0.6, b0 + s * STEP + 0.006, -28 + s * 0.3, pan=-0.32)
bass.add(S.bass808("G1", 1.0, 1.0, punch=0.8), b0, -8)
bass.add(S.bass808("A1", 1.0, 1.0, punch=0.6), b0 + 1.0, -9)
music.add(S.pad(["G2", "D3", "B3", "F#4"], 1.0, 1.0, attack=0.2, release=0.4, cutoff=3000, seed=4150), b0, -20)
music.add(S.pad(["A2", "E3", "B3", "E4"], CEND - (b0 + 1.0), 1.0, attack=0.3, release=0.3, cutoff=2600, seed=4151), b0 + 1.0, -20)
for s, nt in enumerate("B4 D5 E5 D5 B4 D5 E5 F#5 E5 D5 B4 A4".split()):
    music.add(S.guzheng(nt, 0.7, 1.0, 0.8, t60=1.1, seed=4160 + s), b0 + s * STEP, -20 + (1.5 if s % 4 == 0 else 0), pan=-0.35 if s % 2 else 0.35)
# a window wakes on every beat; threads of light fly between them
wake_notes = ["A5", "B5", "D6", "E6", "F#6", "E6", "D6", "E6", "F#6", "A6", "B6", "A6", "F#6"]
for k, f in enumerate(BEATS):
    bells.add(S.bell(octave(wake_notes[k], REG), 1.4, 1.0, [(1, 1, 0.6), (2.0, 0.2, 0.25), (3.01, 0.06, 0.2)], seed=4200 + k), fr(f) + 0.1, (-23 if SOFT else -21) + k * 0.25, pan=rnd.uniform(-0.6, 0.6))
    fxb.add(S.whoosh(0.35, 2500, 9000, 1.0, 4210 + k, 0.8), fr(f) - 0.25, -27, pan=rnd.uniform(-0.5, 0.5))
    for j in range(3):  # the wave spreading through many windows
        bells.add(S.bell(octave(["D6", "E6", "F#6", "A6", "B6", "D7"][int(rnd.integers(6))], REG), 0.8, 1.0, [(1, 1, 0.5), (2.0, 0.2, 0.2)], seed=4230 + k * 3 + j), fr(f) + 0.12 + j * 0.06 + rnd.uniform(0, 0.03), -33 if SOFT else -31, pan=rnd.uniform(-0.8, 0.8))
# the refrain, whole: as v3 sang it (VER=B, its top rounded off) or an octave lower (VER=A); the dizi
# on the last thread
dizi_r([(s, d, octave(n, REG)) for s, d, n in CITY_LINE], 56.0, -11, 4300, vib=0.014)
# the peak: for one beat the whole town is woven together
bells.add(X.shimmer(1.2, ["D6", "E6", "F#6", "A6", "B6", "D7", "E7"], (60, 20), 1.0, 4310, 0.45), PK, -21)
for nt, db in [("D3", -12), ("A3", -14), ("D4", -15), ("F#4", -17)]:
    bells.add(S.bell(nt, 3.0, 1.0, seed=4320 + len(nt)), PK, db, pan=rnd.uniform(-0.2, 0.2))
drums.add(S.taiko(1.0, 4330), PK, -11)
bass.add(S.bass808("D1", 1.2, 1.0, punch=2.0), PK, -8)
amb.add(X.wind(4.0, 1.0, 4340, 300, 1400) * np.sin(np.pi * np.linspace(0, 1, S.n_samples(4.0))), PK, -36, pan=0.3)
# the last thread
bells.add(S.bell(octave("A6", REG), 2.2, 1.0, [(1, 1, 0.8), (2.0, 0.25, 0.35), (3.01, 0.08, 0.2)], seed=4350), LT, -18 if SOFT else -16, pan=0.2)
bells.add(S.bell(octave("D6", REG), 2.2, 1.0, seed=4351), LT + 0.02, -21 if SOFT else -19, pan=0.2)
fxb.add(S.whoosh(0.8, 1200, 8000, 1.0, 4352, 0.85), LT - 0.8, -20, pan=-0.1)
# the dive: a rise into the window, the strings leading in
fxb.add(S.riser(CEND - DIVE, 1.0, 4400), DIVE, -10)
fxb.add(S.whoosh(CEND - DIVE + 0.1, 300, 6000, 1.0, 4401, 0.9), DIVE, -12)
music.add(S.guzheng("A5", 1.0, 1.0, 0.7, seed=4402), CEND - 1.0, -18)
music.add(S.guzheng("B5", 1.0, 1.0, 0.7, seed=4403), CEND - 0.75, -18)
music.add(S.guzheng("D6", 1.4, 1.0, 0.7, seed=4404), CEND - 0.5, -17)

# ======================================================== K · 片尾 (65.0–70.4 s)
EN = C["ending"]
T0 = fr(EN["start"])
fxb.add(S.reverse_swell(0.25, 1.0, 4500), T0 - 0.25, -18)
bells.add(S.bell("D5", 3.0, 1.0, [(1, 1, 0.8), (2.0, 0.2, 0.3)], seed=4506), T0 + 0.01, -20, pan=0.1)  # through the window: home
music.add(S.sine_pad(["D2", "A2"], 2.7, 1.0, attack=0.02, release=1.2), T0, -22)
# a low floor under the solo, so the room does not go thin after the lights (v3.1, third version)
bass.add(S.bass808("D1", 2.6, 0.7, punch=0.3, drive=1.0), T0, -19)
amb.add(X.city_hum(2.0, 1.0, 4501) * np.linspace(1, 0, S.n_samples(2.0)) ** 2, T0, -40)
amb.add(S.room_tone(7.4, 1.0, 4502), T0, -47)
amb.add(S.crickets(5.5, 1.0, 4503), T0 + 0.5, -50, pan=0.5)
music.add(S.pad(["D3", "A3", "E4", "F#4"], 3.0, 1.0, attack=0.25, release=1.4, cutoff=1300, seed=4510), T0, -19)
sfx.add(X.paper_rustle(0.6, 1.0, 4520, 1200, 6000), fr(EN["slip"]), -32, pan=0.6)
sfx.add(X.stamp(1.0, 4521), fr(EN["seal"]), -16, pan=0.55)
# the guzheng alone: the motif once more, in the room
solo = [
    (EN["l1"], "A4", -12), (EN["l1"] + 9, "B4", -13), (EN["l1"] + 18, "D5", -12),
    (EN["l2"], "E5", -12), (EN["l2"] + 9, "D5", -13), (EN["l2"] + 18, "B4", -13),
]
for k, (f, nt, db) in enumerate(solo):
    music.add(S.guzheng(nt, 2.6, 1.0, 0.55, vib=0.12, seed=4530 + k), fr(f), db, pan=0.05)
music.add(S.guzheng("A3", 2.6, 1.0, 0.45, seed=4540), fr(EN["l2"]) - 0.02, -20, pan=-0.15)
bells.add(S.bell("D5", 2.2, 1.0, [(1, 1, 0.7), (2.0, 0.15, 0.3)], seed=4541), fr(EN["l1"]), -27, pan=-0.2)
# and the dizi of the lights goes on with it, softer, with the guzheng (an octave lower than the
# second version, which sat high and sharp there) — the refrain's opening once more — home on D
_l1, _l2, _l3 = fr(EN["l1"]), fr(EN["l2"]), fr(EN["l3"])
dizi([(_l1, 0.3, "A4"), (_l1 + 0.3, 0.3, "B4"), (_l1 + 0.6, _l2 - _l1 - 0.62, "D5"),
      (_l2, 0.3, "E5"), (_l2 + 0.3, 0.3, "D5"), (_l2 + 0.6, _l3 - _l2 - 0.62, "B4"), (_l3, 1.9, "D5")], _l1, -12.5, 4590, breath=0.15, vib=0.016)
# 有些心事却一直相通: home
L3 = fr(EN["l3"])
for nt, pan, db, dt in [("D2", 0, -13, 0.0), ("A2", -0.2, -16, 0.03), ("F#3", 0.2, -17, 0.06), ("D4", -0.1, -15, 0.09), ("A4", 0.15, -16, 0.12), ("D5", 0.0, -12, 0.15)]:
    music.add(S.guzheng(nt, 4.0, 1.0, 0.55, vib=0.08, seed=4550 + int(dt * 100)), L3 + dt, db, pan=pan)
music.add(S.pad(["D3", "A3", "F#4", "E5"], 2.8, 1.0, attack=0.5, release=1.6, cutoff=1500, seed=4560), L3, -21)
bells.add(X.gong("D3", 4.5, 1.0, 4561), L3, -21)
drums.add(S.taiko(1.0, 4562), L3, -17)
bass.add(S.bass808("D1", 2.2, 0.7, punch=0.4, drive=1.0), L3, -15)
music.add(X.harmonic("D6", 2.4, 1.0, 4563), L3 + 0.8, -25, pan=0.25)
music.add(X.harmonic("A5", 2.2, 1.0, 4564), fr(EN["sig"]), -27, pan=-0.2)
# the page becomes type
for k in range(12):
    sfx.add(X.type_key(1.0, 4600 + k), fr(EN["morph"]) + 0.06 + k * 0.04 + rnd.uniform(-0.01, 0.01), -24 + rnd.uniform(-2, 1), pan=rnd.uniform(-0.3, 0.3))

# ======================================================== L · the code runs home (70.3–72.3 s)
CD = C["code"]
sfx.add(X.carriage_return(fr(CD["stop"]) - fr(CD["rewind"]), 1.0, 4700), fr(CD["rewind"]), -15, pan=-0.1)
fxb.add(S.whoosh(fr(CD["stop"]) - fr(CD["rewind"]), 5000, 500, 1.0, 4701, 0.5), fr(CD["rewind"]), -21)
sfx.add(S.wood_knock(1.0, 4702), fr(CD["stop"]), -14)
bells.add(X.ty_bell(1.0, 4703), fr(CD["stop"]) + 0.01, -13, pan=0.2)
music.add(X.harmonic("D6", 0.8, 1.0, 4704), fr(CD["stop"]) + 0.02, -26)

# ======================================================== mix
# Nothing stops for a sound effect any more (v3 dropped the drums and bass for a beat at 14.75 and
# before 子正). Instead the tune, the harmony, the loop and the low end step aside a little while an
# effect sounds: up to 3.5 dB, in 10 ms, back over 250 ms. The drums and bells keep the pulse.
key = np.abs(sfx.x).sum(axis=1) + np.abs(fxb.x).sum(axis=1)
hop = 48  # the side chain runs at 1 kHz
w = 20
e = np.sqrt(np.convolve(key[::hop] ** 2, np.ones(w) / w, mode="same"))
ref = np.percentile(e[e > 1e-7], 99)
gr = np.clip((20 * np.log10(e / ref + 1e-9) + 18.0) * 0.25, 0.0, 3.5)
a_att, a_rel = np.exp(-1.0 / (0.010 * SR / hop)), np.exp(-1.0 / (0.25 * SR / hop))
sm = np.empty_like(gr)
v = 0.0
for i, x in enumerate(gr):
    v = a_att * v + (1 - a_att) * x if x > v else a_rel * v + (1 - a_rel) * x
    sm[i] = v
duck = 10 ** (-np.interp(np.arange(key.shape[0]), np.arange(len(sm)) * hop, sm) / 20)
for bsx, k in ((music, 1.0), (lead, 1.0), (loopb, 1.0), (bass, 0.6)):
    bsx.x *= (duck ** k)[:, None]
print("side chain: max %.1f dB, mean %.2f dB" % (sm.max(), sm.mean()))
buses = [amb, sfx, ui, drums, bass, music, lead, bells, fxb, loopb]
dry = sum(b.x for b in buses)
send = sum(b.x * b.send for b in buses)
hall = S.make_ir(2.6, 3, 5200)
wet = S.convolve_stereo(send, hall)[: dry.shape[0]]
mix = dry + wet * 0.9
n = S.n_samples(DUR)
mix = mix[:n]
t = S.t_axis(n)
mix *= np.clip((DUR - t) / 0.35, 0, 1)[:, None] ** 1.5  # the last tail settles exactly at the end
scale = 0.89 / (np.max(np.abs(mix)) + 1e-9)
mix *= scale
if os.environ.get("STEMS"):  # per-bus stems (dry, same scale) for checking the balance and the continuity
    for name, b in zip(["amb", "sfx", "ui", "drums", "bass", "music", "lead", "bells", "fxb", "loop"], buses):
        wavfile.write(os.path.join(os.environ["STEMS"], name + ".wav"), SR, np.clip(b.x[:n] * scale * 32767, -32768, 32767).astype(np.int16))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wavfile.write(OUT, SR, (mix * 32767).astype(np.int16))
print("wrote", OUT, mix.shape[0] / SR, "s")
