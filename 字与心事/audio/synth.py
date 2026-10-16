"""Instrument and effect synthesis for 《字与心事》. Everything is generated from code."""
import numpy as np
from scipy import signal

SR = 48000


def n_samples(dur):
    return max(1, int(round(dur * SR)))


def t_axis(n):
    return np.arange(n) / SR


NOTE_OFFS = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3,
             "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}


def hz(name):
    if isinstance(name, (int, float)):
        return float(name)
    p = name[:-1]
    o = int(name[-1])
    return 440.0 * 2 ** ((NOTE_OFFS[p] + (o - 4) * 12) / 12)


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    b, a = signal.butter(order, fc / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, order=2):
    f2 = min(f2, SR * 0.45)
    b, a = signal.butter(order, [f1 / (SR / 2), f2 / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def peak(x, f0, q, gain_db):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    b = np.array([1 + alpha * A, -2 * np.cos(w0), 1 - alpha * A])
    a = np.array([1 + alpha / A, -2 * np.cos(w0), 1 - alpha / A])
    return signal.lfilter(b / a[0], a / a[0], x)


def norm(x, v=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * v


def fade(x, a=0.002, r=0.01):
    n = len(x)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    e = np.ones(n)
    if na > 0:
        e[:na] = np.linspace(0, 1, na)
    if nr > 0:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return x * e


def rng(seed):
    return np.random.default_rng(seed)


# ---------------------------------------------------------------- strings
def ks(f0, dur, t60=3.0, bright=0.6, pos=0.18, seed=0):
    """Karplus-Strong with fractional-delay all-pass tuning (lfilter, fast)."""
    n = n_samples(dur)
    P = SR / f0
    N = int(np.floor(P - 0.5 - 0.1))
    d = P - 0.5 - N
    c = (1 - d) / (1 + d)
    g = 0.001 ** (1.0 / (t60 * f0))
    r = rng(seed)
    exc = r.uniform(-1, 1, N)
    exc = lp(exc, 1200 + 11000 * bright, 1)
    k = max(1, int(N * pos))
    exc[k:] -= 0.65 * exc[:-k]
    x = np.zeros(n)
    x[:N] = exc
    b = np.array([2.0, 2.0 * c])
    a = np.zeros(N + 3)
    a[0], a[1] = 2.0, 2.0 * c
    a[N] -= g * c
    a[N + 1] -= g * (1 + c)
    a[N + 2] -= g
    y = signal.lfilter(b, a, x)
    return y


def warp_pitch(y, ratio):
    """Variable-rate playback: ratio(t) array (same length) → pitch bend/vibrato."""
    pos = np.cumsum(ratio)
    pos = pos - pos[0]
    pos = pos[pos < len(y) - 1]
    return np.interp(pos, np.arange(len(y)), y)


def guzheng(note, dur=2.4, vel=1.0, bright=0.62, t60=None, vib=0.0, bend=0.0, bend_at=0.08, bend_dur=0.18, seed=0):
    """Additive plucked-string model: near-bridge pluck, faster decay for upper partials,
    slight stiffness inharmonicity, pick noise, body resonance."""
    f0 = hz(note)
    if t60 is None:
        t60 = float(np.clip(5.0 - np.log2(f0 / 110) * 0.9, 1.3, 5.0))
    n = n_samples(dur + 0.05)
    t = t_axis(n)
    r = rng(seed)
    cents = np.zeros(n)
    if bend:
        ramp = np.clip((t - bend_at) / bend_dur, 0, 1)
        cents += bend * 100 * ramp * ramp * (3 - 2 * ramp)
    if vib:
        cents += vib * 100 * np.clip((t - 0.15) / 0.35, 0, 1) * np.sin(2 * np.pi * 5.6 * t)
    pitch = 2 ** (cents / 1200) * (1 + 0.004 * np.exp(-t / 0.03))
    phase = 2 * np.pi * np.cumsum(f0 * pitch) / SR
    p = 0.1
    B = 7e-5
    y = np.zeros(n)
    T1 = t60 / 6.9
    kmax = int(min(18, (SR * 0.42) / f0))
    for k in range(1, kmax + 1):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        ak = abs(np.sin(np.pi * k * p)) / k ** (1.45 - 0.35 * bright)
        tk = T1 / (1 + 0.26 * (k - 1) ** 1.2)
        y += ak * np.sin(fk * phase / f0 + r.uniform(0, 2 * np.pi)) * np.exp(-t / tk)
    y *= np.minimum(1, t / 0.0015)
    pick = bp(r.standard_normal(n_samples(0.008)), 1800, 9000) * np.linspace(1, 0, n_samples(0.008)) ** 2
    y[: len(pick)] += pick * 0.25 * bright * np.max(np.abs(y))
    y = 0.8 * y + 0.2 * peak(y, 210, 1.1, 8)
    y = lp(y, 9500, 1)
    y = y[: n_samples(dur)]
    return fade(norm(y, vel), 0.0003, 0.08)


# ---------------------------------------------------------------- winds
def flute_line(notes, vel=1.0, breath=0.12, vib=0.011, seed=0, glide=0.035, kind="dizi"):
    """notes: list of (start_s, dur_s, note). Continuous breath with portamento."""
    end = max(s + d for s, d, _ in notes) + 0.4
    n = n_samples(end)
    t = t_axis(n)
    f = np.zeros(n)
    amp = np.zeros(n)
    notes = sorted(notes)
    for i, (s, d, nt) in enumerate(notes):
        f0 = hz(nt)
        i0, i1 = n_samples(s), min(n, n_samples(s + d))
        f[i0:i1] = f0
        # articulation envelope per note
        seg = t[i0:i1] - s
        att = np.clip(seg / 0.06, 0, 1)
        rel = np.clip((d - seg) / 0.09, 0, 1)
        a = att * (0.82 + 0.18 * rel) * np.minimum(1, rel * 3 + 0.25)
        swell = 1 + 0.12 * np.clip((seg - 0.12) / 0.6, 0, 1)
        amp[i0:i1] = np.maximum(amp[i0:i1], a * swell)
    # fill frequency gaps (hold previous), then smooth for portamento
    last = hz(notes[0][2])
    for i in range(n):
        if f[i] == 0:
            f[i] = last
        else:
            last = f[i]
    k = max(1, int(glide * SR))
    f = np.convolve(np.pad(f, (k, k), mode="edge"), np.ones(k) / k, mode="same")[k:-k]
    # vibrato grows inside each held note
    vibdepth = np.zeros(n)
    for s, d, _ in notes:
        i0, i1 = n_samples(s), min(n, n_samples(s + d))
        seg = t[i0:i1] - s
        vibdepth[i0:i1] = vib * np.clip((seg - 0.18) / 0.4, 0, 1)
    f = f * (1 + vibdepth * np.sin(2 * np.pi * 5.3 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "xun":
        tone = np.sin(ph) + 0.12 * np.sin(3 * ph) + 0.04 * np.sin(5 * ph)
    else:
        tone = np.sin(ph) + 0.46 * np.sin(2 * ph + 0.3) + 0.28 * np.sin(3 * ph) + 0.12 * np.sin(4 * ph) + 0.07 * np.sin(5 * ph) + 0.04 * np.sin(6 * ph)
        # 笛膜 buzz: soft odd-harmonic saturation on the louder parts
        tone = tone + 0.15 * np.tanh(2.4 * tone) * amp
    r = rng(seed)
    noise = r.standard_normal(n)
    br = bp(noise, 900, 7000) * 0.5 + bp(noise, 300, 1200) * 0.3
    sm = lp(np.abs(np.diff(np.concatenate([[0], amp]))) * 200, 30)
    y = (tone * (1 - breath) + br * (breath + 0.6 * np.clip(sm, 0, 1))) * lp(amp, 40)
    y = lp(y, 9000)
    return fade(norm(y, vel), 0.01, 0.2)


# ---------------------------------------------------------------- pads & bass
def polyblep_saw(f, n, phase0=0.0):
    dt = f / SR
    ph = (phase0 + np.cumsum(np.full(n, dt) if np.isscalar(f) else dt)) % 1.0
    dtv = np.full(n, dt) if np.isscalar(f) else dt
    y = 2 * ph - 1
    m1 = ph < dtv
    x = ph[m1] / dtv[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dtv
    x = (ph[m2] - 1) / dtv[m2]
    y[m2] -= x * x + x + x + 1
    return y


def pad(notes, dur, vel=1.0, attack=0.8, release=1.2, cutoff=1800, seed=0, voices=4, detune=8):
    n = n_samples(dur + release)
    t = t_axis(n)
    y = np.zeros(n)
    r = rng(seed)
    for nt in notes:
        f0 = hz(nt)
        for v in range(voices):
            cents = (v - (voices - 1) / 2) * detune / max(1, voices - 1) * 2 + r.uniform(-1.5, 1.5)
            y += polyblep_saw(f0 * 2 ** (cents / 1200), n, r.uniform())
    y = lp(y, cutoff, 2)
    env = np.clip(t / attack, 0, 1) ** 1.5
    env *= np.where(t > dur, np.clip(1 - (t - dur) / release, 0, 1), 1)
    y *= env
    return fade(norm(y, vel), 0.01, 0.05)


def sine_pad(notes, dur, vel=1.0, attack=1.0, release=1.5):
    n = n_samples(dur + release)
    t = t_axis(n)
    y = np.zeros(n)
    for k, nt in enumerate(notes):
        f0 = hz(nt)
        y += np.sin(2 * np.pi * f0 * t + k) * (1 + 0.15 * np.sin(2 * np.pi * 0.3 * t + k))
        y += 0.2 * np.sin(4 * np.pi * f0 * t + 2 * k)
    env = np.clip(t / attack, 0, 1) ** 1.6 * np.where(t > dur, np.clip(1 - (t - dur) / release, 0, 1), 1)
    return norm(y * env, vel)


def bass808(note, dur, vel=1.0, punch=2.4, drive=1.8, glide_to=None):
    n = n_samples(dur)
    t = t_axis(n)
    f0 = hz(note)
    f = f0 * (1 + punch * np.exp(-t / 0.03))
    if glide_to is not None:
        f1 = hz(glide_to)
        g = np.clip((t - dur * 0.6) / (dur * 0.35), 0, 1)
        f = f * (f1 / f0) ** (g * g * (3 - 2 * g))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.12 * np.sin(2 * ph)
    env = np.minimum(1, t / 0.003) * np.exp(-t / max(0.2, dur * 0.7))
    y = np.tanh(drive * y * env) / np.tanh(drive)
    return fade(y * vel, 0.0005, 0.04)


# ---------------------------------------------------------------- drums
def kick(vel=1.0, seed=0):
    n = n_samples(0.45)
    t = t_axis(n)
    f = 48 + 120 * np.exp(-t / 0.028)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    r = rng(seed)
    click = hp(r.uniform(-1, 1, n), 3000) * np.exp(-t / 0.003) * 0.4
    y = np.tanh(1.6 * (y + click))
    return y * vel


def snare(vel=1.0, seed=0):
    n = n_samples(0.35)
    t = t_axis(n)
    r = rng(seed)
    nz = bp(r.standard_normal(n), 1400, 9000) * np.exp(-t / 0.11)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.06)
    return norm(nz * 0.8 + body * 0.6, vel)


def clap(vel=1.0, seed=0):
    n = n_samples(0.4)
    t = t_axis(n)
    r = rng(seed)
    nz = bp(r.standard_normal(n), 900, 5000)
    env = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        i = n_samples(d)
        env[i:] += np.exp(-(t[i:] - d) / 0.008) * (0.8 if k < 2 else 1)
    env += np.exp(-np.clip(t - 0.03, 0, None) / 0.12) * (t > 0.03) * 0.5
    return norm(nz * env, vel)


def hat(vel=1.0, open_=False, seed=0):
    n = n_samples(0.45 if open_ else 0.08)
    t = t_axis(n)
    r = rng(seed)
    nz = hp(r.standard_normal(n), 7000, 3)
    y = nz * np.exp(-t / (0.2 if open_ else 0.022))
    return norm(y, vel)


def tom(vel=1.0, f0=95, seed=0):
    n = n_samples(0.5)
    t = t_axis(n)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.05))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    r = rng(seed)
    y += lp(r.standard_normal(n), 2000) * np.exp(-t / 0.02) * 0.3
    return norm(y, vel)


def taiko(vel=1.0, seed=0):
    n = n_samples(2.0)
    t = t_axis(n)
    f = 46 + 70 * np.exp(-t / 0.09)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    r = rng(seed)
    skin = lp(r.standard_normal(n), 900) * np.exp(-t / 0.06) * 0.6
    return norm(np.tanh(1.3 * (y + skin)), vel)


def crash(vel=1.0, seed=0, dur=2.2):
    n = n_samples(dur)
    t = t_axis(n)
    r = rng(seed)
    nz = hp(r.standard_normal(n), 3500, 2) + 0.4 * bp(r.standard_normal(n), 5000, 12000)
    y = nz * np.exp(-t / (dur * 0.35)) * np.minimum(1, t / 0.002)
    return norm(y, vel)


# ---------------------------------------------------------------- bells & UI
def bell(note, dur=3.0, vel=1.0, partials=None, seed=0):
    f0 = hz(note)
    n = n_samples(dur)
    t = t_axis(n)
    if partials is None:
        partials = [(0.5, 0.35, 1.6), (1.0, 1.0, 1.0), (1.19, 0.32, 0.55), (1.5, 0.35, 0.5), (2.0, 0.45, 0.42), (2.98, 0.25, 0.25), (4.07, 0.14, 0.15), (5.2, 0.07, 0.09)]
    y = np.zeros(n)
    r = rng(seed)
    for ratio, amp, dec in partials:
        ph = r.uniform(0, 2 * np.pi)
        y += amp * np.sin(2 * np.pi * f0 * ratio * t * (1 + r.uniform(-0.002, 0.002)) + ph) * np.exp(-t / (dur * dec * 0.45))
    strike = hp(r.standard_normal(n), 2000) * np.exp(-t / 0.004) * 0.25
    return fade(norm(y + strike, vel), 0.0005, 0.1)


def ding(vel=1.0):
    a = bell("D6", 1.6, 1.0, [(1, 1, 0.8), (2.0, 0.18, 0.4), (3.0, 0.05, 0.2)], seed=3)
    b = bell("A6", 1.6, 0.8, [(1, 1, 0.8), (2.0, 0.15, 0.4), (3.0, 0.04, 0.2)], seed=4)
    out = np.zeros(len(a) + n_samples(0.09))
    out[: len(a)] += a
    out[n_samples(0.09): n_samples(0.09) + len(b)] += b
    return norm(out, vel)


def key_tap(vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(0.05)
    t = t_axis(n)
    f1 = 2200 + r.uniform(-300, 300)
    nz = bp(r.standard_normal(n), f1 * 0.7, f1 * 1.8) * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * (140 + r.uniform(-15, 15)) * t) * np.exp(-t / 0.012) * 0.35
    return norm(nz + body, vel * r.uniform(0.75, 1.0))


def modal(freqs, decays, amps, dur, vel=1.0, seed=0, noise=0.4):
    n = n_samples(dur)
    t = t_axis(n)
    r = rng(seed)
    y = np.zeros(n)
    for f, d, a in zip(freqs, decays, amps):
        y += a * np.sin(2 * np.pi * f * (1 + r.uniform(-0.03, 0.03)) * t + r.uniform(0, 6)) * np.exp(-t / d)
    y += noise * hp(r.standard_normal(n), 1000) * np.exp(-t / 0.003)
    return norm(y, vel)


def clack(vel=1.0, seed=0):
    """letterpress type block striking paper"""
    a = modal([480, 1120, 1980, 3150, 4400], [0.07, 0.05, 0.035, 0.022, 0.014], [1, 0.7, 0.45, 0.3, 0.2], 0.3, 1.0, seed, 0.6)
    t = t_axis(len(a))
    thump = np.sin(2 * np.pi * 105 * t) * np.exp(-t / 0.05) * 0.8
    return norm(a + thump, vel)


def wood_tick(vel=1.0, seed=0):
    return modal([1850, 3400], [0.02, 0.012], [1, 0.5], 0.08, vel, seed, 0.3)


def bamboo(vel=1.0, seed=0):
    return modal([1650, 2900, 4300], [0.025, 0.016, 0.01], [1, 0.6, 0.35], 0.09, vel, seed, 0.7)


def wood_knock(vel=1.0, seed=0):
    return modal([260, 560, 980], [0.09, 0.05, 0.03], [1, 0.6, 0.3], 0.3, vel, seed, 0.2)


def creak(dur=0.35, vel=1.0, seed=0, rate=55, f0=620):
    n = n_samples(dur)
    t = t_axis(n)
    r = rng(seed)
    y = np.zeros(n)
    tt = 0.0
    while tt < dur:
        i = n_samples(tt)
        g = modal([f0 * r.uniform(0.85, 1.2), f0 * 2.3 * r.uniform(0.9, 1.1)], [0.012, 0.007], [1, 0.4], 0.04, 1.0, int(r.integers(1 << 30)), 0.5)
        m = min(len(g), n - i)
        y[i:i + m] += g[:m] * r.uniform(0.4, 1.0)
        tt += 1.0 / (rate * r.uniform(0.6, 1.4))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return norm(y * env, vel)


def heartbeat(vel=1.0, strong=True):
    n = n_samples(0.4)
    t = t_axis(n)
    f = 52 + 28 * np.exp(-t / 0.04)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.11 if strong else 0.08))
    y += 0.5 * np.sin(2 * np.pi * 34 * t) * np.exp(-t / 0.12)
    return norm(np.tanh(1.5 * y), vel)


def beep(f0=1046.5, dur=0.06, vel=1.0):
    n = n_samples(dur)
    t = t_axis(n)
    y = np.sin(2 * np.pi * f0 * t) + 0.15 * np.sin(4 * np.pi * f0 * t)
    return fade(norm(y, vel), 0.003, 0.008)


# ---------------------------------------------------------------- noise fx
def shaped_noise(dur, f_curve, bw_oct=1.2, env=None, seed=0):
    """Band-pass sweep via STFT shaping. f_curve: function(t_norm 0..1) -> centre Hz."""
    n = n_samples(dur)
    r = rng(seed)
    x = r.standard_normal(n + 2048)
    f, tt, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    T = Z.shape[1]
    for j in range(T):
        u = min(1.0, j / max(1, T - 1))
        fc = f_curve(u)
        lo, hi = fc / 2 ** (bw_oct / 2), fc * 2 ** (bw_oct / 2)
        w = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / (bw_oct / 2.4)) ** 2)
        Z[:, j] *= w
    _, y = signal.istft(Z, SR, nperseg=1024, noverlap=768)
    y = y[:n]
    if env is not None:
        y = y * env(t_axis(n) / dur)
    return norm(y)


def whoosh(dur=0.6, f0=300, f1=4000, vel=1.0, seed=0, peak_at=0.6):
    return shaped_noise(
        dur,
        lambda u: f0 * (f1 / f0) ** u,
        1.4,
        lambda u: np.where(u < peak_at, (u / peak_at) ** 2, np.clip(1 - (u - peak_at) / (1 - peak_at), 0, 1) ** 1.5),
        seed,
    ) * vel


def riser(dur=1.0, vel=1.0, seed=0):
    y = shaped_noise(dur, lambda u: 400 * (9000 / 400) ** (u ** 1.4), 1.6, lambda u: u ** 2.2, seed)
    t = t_axis(len(y))
    f = 200 * (1600 / 200) ** ((t / dur) ** 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.25
    return norm(y + tone, vel)


def reverse_swell(dur=0.8, vel=1.0, seed=0):
    c = crash(1.0, seed, dur)
    return norm(c[::-1] * np.linspace(0, 1, len(c)) ** 1.5, vel)


def splash(dur=1.4, vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    body = shaped_noise(dur, lambda u: 2200 * (500 / 2200) ** u, 1.8, lambda u: np.exp(-u * 6.0) * np.minimum(1, u * 80), seed)
    drops = np.zeros(n)
    for k in range(70):
        tt = r.uniform(0.02, dur * 0.8) ** 1.3
        i = n_samples(tt)
        d = modal([r.uniform(900, 4200)], [r.uniform(0.004, 0.012)], [1], 0.03, r.uniform(0.2, 1.0), int(r.integers(1 << 30)), 0.5)
        m = min(len(d), n - i)
        if m > 0:
            drops[i:i + m] += d[:m] * np.exp(-tt * 2.5)
    return norm(body + 0.6 * drops, vel)


def impact(vel=1.0, seed=0):
    tk = taiko(1.0, seed)
    n = len(tk) + n_samples(1.0)
    y = np.zeros(n)
    y[: len(tk)] += tk
    t = t_axis(n)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 35 * np.exp(-t / 0.25)) / SR) * np.exp(-t / 0.9) * 0.9
    y += sub
    y += 0.35 * shaped_noise(len(y) / SR, lambda u: 2200 * (250 / 2200) ** u, 2.0, lambda u: np.exp(-u * 9) * np.minimum(1, u * 300), seed + 1)
    return norm(np.tanh(1.2 * y), vel)


def room_tone(dur, vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(dur)
    w = r.standard_normal(n)
    # pink-ish
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    p = signal.lfilter(b, a, w)
    return norm(lp(p, 1500), vel)


def crickets(dur, vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(dur)
    y = np.zeros(n)
    t0 = r.uniform(0, 0.3)
    while t0 < dur:
        f0 = r.uniform(4300, 4900)
        for k in range(3):
            i = n_samples(t0 + k * 0.045)
            m = n_samples(0.03)
            if i + m >= n:
                break
            tt = t_axis(m)
            y[i:i + m] += np.sin(2 * np.pi * f0 * tt) * np.sin(np.pi * tt / 0.03) * (0.5 + 0.5 * np.sin(2 * np.pi * 180 * tt))
        t0 += r.uniform(0.5, 0.9)
    return norm(y, vel)


# ---------------------------------------------------------------- space
def make_ir(rt60=2.2, seed=1, damp=5200, pre=0.015):
    r = rng(seed)
    n = n_samples(rt60 * 1.25)
    t = t_axis(n)
    env = np.exp(-6.9 * t / rt60)
    L = r.standard_normal(n) * env
    R = r.standard_normal(n) * env
    # darken tail progressively
    L = 0.6 * lp(L, damp) + 0.4 * lp(L, damp * 0.35)
    R = 0.6 * lp(R, damp) + 0.4 * lp(R, damp * 0.35)
    ir = np.zeros((n + n_samples(pre), 2))
    ir[n_samples(pre):, 0] = L
    ir[n_samples(pre):, 1] = R
    for k in range(8):
        d = n_samples(pre + r.uniform(0.004, 0.06))
        ir[d, 0] += r.uniform(-0.6, 0.6)
        ir[d, 1] += r.uniform(-0.6, 0.6)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve_stereo(x, ir):
    out = np.zeros((x.shape[0] + ir.shape[0] - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x[:, c], ir[:, c])
    return out
