"""More instruments and foley for the full 60 s cut (all synthesized)."""
import numpy as np
from scipy import signal
import synth as S

SR = S.SR
n_samples, t_axis, rng = S.n_samples, S.t_axis, S.rng


def env_ar(n, a, r):
    t = t_axis(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))


# ---------------------------------------------------------------- birds
def goose_honk(f0=320.0, dur=0.22, vel=1.0, seed=0):
    """A nasal two-part honk: buzzy source through nasal formants, pitch lifting then breaking."""
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    u = t / dur
    f = f0 * (1 + 0.28 * np.sin(np.pi * np.clip(u * 1.2, 0, 1)) ** 0.6) * (1 + 0.01 * r.standard_normal(n).cumsum() / np.sqrt(n))
    ph = np.cumsum(f) / SR
    src = 2 * (ph % 1.0) - 1  # saw
    src = np.sign(src) * np.abs(src) ** 0.7
    y = 0.9 * S.bp(src, 650, 1300) + 0.8 * S.bp(src, 1500, 2600) + 0.35 * S.bp(src, 2800, 4200)
    y += 0.08 * S.bp(r.standard_normal(n), 1000, 5000)
    e = np.minimum(1, t / 0.012) * np.clip((dur - t) / 0.05, 0, 1) * (0.75 + 0.25 * np.sin(np.pi * u))
    return S.fade(S.norm(y * e, vel), 0.002, 0.02)


def wing_flap(dur=0.2, vel=1.0, seed=0, lo=180, hi=1100):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    y = S.bp(r.standard_normal(n), lo, hi)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2.5
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.03) * 0.3
    return S.norm(y * e + thump * e, vel)


def flutter(dur=0.7, vel=1.0, seed=0, rate=22.0):
    """Small wings taking off: rapid flaps, accelerating away."""
    r = rng(seed)
    n = n_samples(dur)
    y = np.zeros(n)
    tt = 0.0
    k = 0
    while tt < dur - 0.03:
        g = wing_flap(0.05, 1.0, seed * 100 + k, 400, 3200) * (1 - tt / dur) ** 0.8 * r.uniform(0.6, 1.0)
        i = n_samples(tt)
        m = min(len(g), n - i)
        y[i:i + m] += g[:m]
        tt += 1.0 / (rate * r.uniform(0.85, 1.15))
        k += 1
    return S.norm(y, vel)


def sparrow_chirp(vel=1.0, seed=0, syl=None):
    r = rng(seed)
    syl = syl or int(r.integers(2, 4))
    parts = []
    for k in range(syl):
        d = r.uniform(0.025, 0.05)
        n = n_samples(d)
        t = t_axis(n)
        f0, f1 = r.uniform(3600, 5200), r.uniform(2600, 6200)
        f = f0 + (f1 - f0) * (t / d) ** r.uniform(0.6, 1.6)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 1.5
        y += 0.2 * np.sin(4 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
        parts.append(y)
        parts.append(np.zeros(n_samples(r.uniform(0.015, 0.04))))
    return S.norm(np.concatenate(parts), vel)


# ---------------------------------------------------------------- fire, water, air
def crackle(dur, density=30, vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(dur)
    y = np.zeros(n)
    count = int(density * dur)
    for _ in range(count):
        i = int(r.uniform(0, n - 400))
        m = int(r.uniform(40, 300))
        c = S.bp(r.standard_normal(m), r.uniform(1500, 3500), r.uniform(5000, 9000)) * np.exp(-np.arange(m) / (m * 0.25))
        y[i:i + m] += c * r.uniform(0.2, 1.0) ** 2
    return S.norm(y, vel)


def fire_whump(vel=1.0, seed=0, dur=1.2):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    body = S.lp(r.standard_normal(n), 420, 2) * np.minimum(1, t / 0.03) * np.exp(-t / 0.28)
    sub = np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.18)
    roar = S.bp(r.standard_normal(n), 300, 1800) * np.minimum(1, t / 0.08) * np.exp(-t / 0.5) * 0.35
    cr = crackle(dur, 26, 1.0, seed + 7) * np.exp(-t / 0.6) * 0.5
    return S.norm(body * 1.0 + sub * 0.8 + roar + cr, vel)


def water_drop(f0=900.0, vel=1.0, seed=0, ring=0.07):
    """A bubble 'plink': resonance rising in pitch as it decays, plus the impact."""
    r = rng(seed)
    n = n_samples(0.35)
    t = t_axis(n)
    f = f0 * (1 + 0.55 * (1 - np.exp(-t / 0.02)))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.0015) * np.exp(-t / ring)
    tick = S.hp(r.standard_normal(n), 2500) * np.exp(-t / 0.0015) * 0.25
    plop = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.015) * 0.3
    return S.fade(S.norm(y + tick + plop, vel), 0.0005, 0.05)


def rain(dur, vel=1.0, seed=0, density=110):
    r = rng(seed)
    n = n_samples(dur)
    w = r.standard_normal(n)
    hiss = S.hp(S.lp(w, 5200, 2), 500, 2) * 0.55
    y = hiss * (0.85 + 0.15 * np.sin(2 * np.pi * 0.23 * t_axis(n) + 1.0))
    for _ in range(int(density * dur)):
        i = int(r.uniform(0, n - 2000))
        d = water_drop(r.uniform(1800, 4800), r.uniform(0.05, 0.3), int(r.integers(1 << 30)), r.uniform(0.006, 0.02))[:1500]
        y[i:i + len(d)] += d
    return S.norm(y, vel)


def wind(dur, vel=1.0, seed=0, lo=250, hi=1600):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    w = r.standard_normal(n)
    # two bands whose levels drift independently → gusts
    a = S.bp(w, lo, lo * 2.2) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.31 * t + 0.4))
    b = S.bp(w, hi * 0.6, hi) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.17 * t + 2.0)) ** 2
    whistle = np.sin(2 * np.pi * np.cumsum(1300 + 120 * np.sin(2 * np.pi * 0.2 * t)) / SR) * 0.02 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t))
    return S.norm(a + 0.7 * b + whistle, vel)


def paper_rustle(dur=0.5, vel=1.0, seed=0, lo=900, hi=7000):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    y = S.bp(r.standard_normal(n), lo, hi)
    m = np.abs(S.lp(r.standard_normal(n), 35)) * 4
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2
    return S.norm(y * (0.3 + m) * e, vel)


def city_hum(dur, vel=1.0, seed=0):
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    y = S.lp(r.standard_normal(n), 380, 2) + 0.25 * S.bp(r.standard_normal(n), 600, 1400)
    y += 0.12 * np.sin(2 * np.pi * 50 * t) + 0.05 * np.sin(2 * np.pi * 100 * t)
    return S.norm(y, vel)


# ---------------------------------------------------------------- mechanical
def type_key(vel=1.0, seed=0):
    """Typewriter key: hard click, typebar thunk on the platen, a little metal ring."""
    r = rng(seed)
    n = n_samples(0.12)
    t = t_axis(n)
    click = S.bp(r.standard_normal(n), 2200, 7000) * np.exp(-t / 0.0018)
    thunk = S.modal([520 * r.uniform(0.9, 1.1), 1250 * r.uniform(0.9, 1.1), 2300], [0.022, 0.014, 0.009], [1, 0.6, 0.3], 0.12, 1.0, seed, 0.2)
    ring = np.sin(2 * np.pi * 3150 * r.uniform(0.97, 1.03) * t) * np.exp(-t / 0.05) * 0.06
    return S.norm(click * 0.9 + thunk * 0.8 + ring, vel * r.uniform(0.75, 1.0))


def carriage_return(dur=1.0, vel=1.0, seed=0):
    """The ratchet of a carriage running back: clicks accelerate, then the run slows into the stop."""
    r = rng(seed)
    n = n_samples(dur)
    t = t_axis(n)
    y = np.zeros(n)
    tt = 0.0
    k = 0
    while tt < dur * 0.92:
        u = tt / dur
        rate = 14 + 70 * np.sin(np.pi * min(1.0, u * 1.08)) ** 1.3
        c = S.modal([1900 * r.uniform(0.92, 1.08), 3900], [0.008, 0.005], [1, 0.4], 0.03, 1.0, 9000 + seed * 50 + k, 0.4)
        i = n_samples(tt)
        m = min(len(c), n - i)
        y[i:i + m] += c[:m] * (0.45 + 0.55 * np.sin(np.pi * u) ** 0.6)
        tt += 1.0 / rate
        k += 1
    slide = S.shaped_noise(dur, lambda u: 900 + 1900 * np.sin(np.pi * u), 1.1, lambda u: np.sin(np.pi * u) ** 1.5, seed + 3) * 0.6
    return S.norm(y + slide, vel)


def ty_bell(vel=1.0, seed=0):
    """The little bell at the end of the line."""
    return S.bell(2470.0, 1.6, vel, [(1, 1, 0.9), (2.76, 0.35, 0.4), (5.4, 0.12, 0.2), (0.5, 0.08, 0.5)], seed)


def ratchet_scroll(dur, rate0=40, rate1=4, vel=1.0, seed=0):
    """Fast scrolling: soft ticks whose rate falls from rate0 to rate1."""
    r = rng(seed)
    n = n_samples(dur)
    y = np.zeros(n)
    tt = 0.0
    k = 0
    while tt < dur:
        u = tt / dur
        rate = rate0 * (rate1 / rate0) ** u
        c = S.modal([2600 * r.uniform(0.9, 1.1)], [0.006], [1], 0.02, 1.0, 7000 + seed * 100 + k, 0.5)
        i = n_samples(tt)
        m = min(len(c), n - i)
        y[i:i + m] += c[:m] * r.uniform(0.5, 1.0)
        tt += 1.0 / rate
        k += 1
    return S.norm(y, vel)


def clock_tick(vel=1.0, seed=0, strong=False):
    a = S.modal([1150, 2450, 3900], [0.03, 0.018, 0.01], [1, 0.55, 0.25], 0.18, 1.0, seed, 0.5)
    t = t_axis(len(a))
    body = np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.03) * (0.6 if strong else 0.35)
    return S.norm(a + body, vel)


def stamp(vel=1.0, seed=0):
    """A seal pressed onto paper: soft wooden thud, paper squeeze."""
    r = rng(seed)
    k = S.wood_knock(1.0, seed)
    n = len(k)
    t = t_axis(n)
    press = S.bp(r.standard_normal(n), 300, 2500) * np.exp(-t / 0.035) * 0.5
    low = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.06) * 0.7
    return S.norm(k * 0.8 + press + low, vel)


# ---------------------------------------------------------------- tonal colour
def ui_blip(f0=1174.7, vel=1.0, dur=0.22):
    n = n_samples(dur)
    t = t_axis(n)
    f = f0 * (1 - 0.03 * (1 - np.exp(-t / 0.02)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.07) + 0.25 * np.sin(4 * ph) * np.exp(-t / 0.012)
    return S.fade(S.norm(y * np.minimum(1, t / 0.002), vel), 0.0005, 0.03)


def shimmer(dur, notes, density=(6, 40), vel=1.0, seed=0, decay=0.5):
    """Granular glass: tiny bell grains from `notes`, density ramping density[0]→density[1] per second."""
    r = rng(seed)
    n = n_samples(dur + 1.0)
    y = np.zeros((n, 2))
    tt = 0.0
    k = 0
    while tt < dur:
        u = tt / dur
        dens = density[0] + (density[1] - density[0]) * u ** 1.4
        nt = notes[int(r.integers(len(notes)))]
        g = S.bell(nt, decay, 1.0, [(1, 1, 0.6), (2.0, 0.15, 0.3), (3.01, 0.05, 0.2)], 5000 + seed * 1000 + k) * r.uniform(0.3, 1.0)
        pan = r.uniform(-0.9, 0.9)
        a = (pan + 1) * np.pi / 4
        i = n_samples(tt)
        m = min(len(g), n - i)
        y[i:i + m, 0] += g[:m] * np.cos(a)
        y[i:i + m, 1] += g[:m] * np.sin(a)
        tt += r.exponential(1.0 / dens)
        k += 1
    return y / (np.max(np.abs(y)) + 1e-9) * vel


def gong(note="D3", dur=5.0, vel=1.0, seed=0):
    f0 = S.hz(note)
    n = n_samples(dur)
    t = t_axis(n)
    r = rng(seed)
    parts = [(1.0, 1.0, 1.0), (1.48, 0.6, 0.8), (2.0, 0.5, 0.6), (2.53, 0.4, 0.5), (3.14, 0.3, 0.4), (4.1, 0.2, 0.3), (5.3, 0.12, 0.25)]
    y = np.zeros(n)
    for ratio, amp, dec in parts:
        bloom = 1 - np.exp(-t / (0.05 + 0.1 * ratio))
        y += amp * np.sin(2 * np.pi * f0 * ratio * t * (1 + 0.004 * np.sin(2 * np.pi * 0.7 * t)) + r.uniform(0, 6)) * np.exp(-t / (dur * dec * 0.4)) * bloom
    strike = S.lp(r.standard_normal(n), 1500) * np.exp(-t / 0.02) * 0.4
    return S.fade(S.norm(y + strike, vel), 0.001, 0.2)


def harmonic(note, dur=2.5, vel=1.0, seed=0):
    """Guzheng 泛音: pure, bell-like, no pluck noise."""
    f0 = S.hz(note)
    n = n_samples(dur)
    t = t_axis(n)
    y = np.sin(2 * np.pi * f0 * t) * np.exp(-t / (dur * 0.35)) + 0.12 * np.sin(4 * np.pi * f0 * t) * np.exp(-t / (dur * 0.12))
    return S.fade(S.norm(y * np.minimum(1, t / 0.003), vel), 0.0005, 0.1)
