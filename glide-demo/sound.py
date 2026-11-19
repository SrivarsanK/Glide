"""vol. 11 bed + mascot chiptune + foley → mix.wav. Every hit is read from events.json, so sound and picture share one clock.
Run from anywhere: python sound.py (needs the Lemo-Opuscar library at LEMO, default C:/Users/Srivarsan/lemo-opuscar)."""
import sys, os, json, numpy as np, soundfile as sf
LEMO = os.environ.get('LEMO', 'C:/Users/Srivarsan/lemo-opuscar'); sys.path.insert(0, LEMO)
from core.audio.sfx import SR, bp, lp, add, limit, click as sclick
HERE = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'events.json'), encoding='utf-8')); E = J['ev']; DUR = J['dur']
NS = int((DUR + .5) * SR); rng = np.random.default_rng(11)
def tt(d): return np.arange(int(round(d * SR))) / SR
def hz(n):  # 'C5' → Hz
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    return 440 * 2 ** ((names[n[0]] + 12 * (int(n[1:]) + 1) - 69) / 12)

def pulse(f, d, duty=.25, vol=1., slide=None):  # band-limited square wave (same synthesis as the style demo)
    t = tt(d); fr = np.full(len(t), float(f)) if slide is None else f * (slide ** (t / d))
    ph = np.cumsum(fr) / SR; x = np.zeros(len(t))
    for k in range(1, 24): x += (fr * k < 16000) * (np.sin(np.pi * k * duty) / k) * np.cos(2 * np.pi * k * (ph - duty / 2))
    return (x * np.minimum(1, t / .003) * np.minimum(1, (d - t) / .04).clip(0) * vol * .5).astype(np.float32)
def crush(x, bits=5): q = 2 ** bits; return (np.round(x * q) / q).astype(np.float32)
def nz(d, lo, hi, vol=1., tau=None):
    x = bp(rng.standard_normal(int(d * SR)), lo, hi) * vol
    if tau: x *= np.exp(-tt(d)[:len(x)] / tau)
    return x.astype(np.float32)
def key(v=.7, heavy=False):
    t = tt(.09); th = np.sin(2 * np.pi * (170 + rng.uniform(-20, 20)) * t) * np.exp(-t / .018) * .5
    return ((th + (nz(.09, 2500, 7000, .5, .006) + nz(.09, 900, 2200, .3, .012))[:len(th)]) * v * (1.5 if heavy else 1)).astype(np.float32)
def pop(v=.35, f0=520, f1=980): t = tt(.12); f = f0 * (f1 / f0) ** np.minimum(1, t / .05); return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .035) * v).astype(np.float32)
def swish(d=.4, v=.3, lo=300, hi=3500):
    x = rng.standard_normal(int(d * SR)); return (bp(x, lo, hi) * np.sin(np.pi * tt(d)[:len(x)] / d) ** 2 * v).astype(np.float32)
def boom(v=.3, f0=110, d=.6): t = tt(d); f = f0 * np.exp(-t * 2.2) + 32; return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .3) * v).astype(np.float32)

# ── foley + mascot voice
fx = np.zeros((NS, 2), np.float32)
CHIP = ['C5', 'E5', 'G5', 'A5', 'C6']; ci = 0
for e in E:
    t0, tp = e['t'], e['type']
    if tp == 'key': add(fx, key(.45), t0, .5, rng.uniform(-.15, .05))
    elif tp == 'enter': add(fx, key(1, True), t0, .4, 0)
    elif tp == 'click': add(fx, sclick(1.1, .8), t0, .45, .1)
    elif tp in ('press', 'release'): add(fx, sclick(.9 if tp == 'press' else 1.3, .5), t0, .35, .1)
    elif tp in ('pop', 'toast'): add(fx, pop(), t0, 1, 0)
    elif tp == 'chip': add(fx, pulse(hz(CHIP[ci % 5]), .11, .25, .2), t0, 1, .15); ci += 1  # the mascot "talks" in square waves
    elif tp == 'jump': add(fx, pulse(330, .12, .25, .16, slide=2.4), t0, 1, .1)
    elif tp == 'land': add(fx, pulse(110, .06, .5, .18), t0, 1, 0); add(fx, crush(nz(.05, 200, 2000, .15, .015)), t0, 1, 0)
    elif tp == 'stomp': add(fx, pulse(hz('C3'), .14, .5, .32, slide=.5), t0, 1, .2); add(fx, boom(), t0, 1, .1)
    elif tp == 'crumble': add(fx, crush(nz(.3, 600, 5000, .2, .08), 4), t0 + .02, 1, -.1)
    elif tp == 'whip': add(fx, swish(.35, .3), t0 - .12, 1, .3)
    elif tp == 'wipe':
        add(fx, swish(.6, .32, 500, 6000), t0, 1, 0)
        for k, p in enumerate(['C5', 'G5', 'C6']): add(fx, pulse(hz(p), .07, .125, .12), t0 + .05 + k * .06, 1, (k - 1) * .3)
    elif tp == 'drop': add(fx, boom(.2, 160, .3), t0, 1, 0)
    elif tp == 'error': add(fx, pulse(hz('E4'), .1, .5, .2), t0, 1, 0); add(fx, pulse(hz('C4'), .16, .5, .2), t0 + .11, 1, 0)  # one muted blip
    elif tp == 'burst':
        for k in range(10): add(fx, pulse(rng.uniform(1200, 2800), .03, .125, .07), t0 + k * .025, 1, (k % 2 - .5) * 1.2)
    # resume: nothing; the chip on the same frame carries it

# ── music bed: vol. 11 from 0, 0.1 s fade-in, ~3 dB duck under typing, 0.6 s fade-out from 24.4
y, sr = sf.read(os.path.join(HERE, 'audio', 'vol11_long.wav'), dtype='float32'); assert sr == SR
mus = np.zeros((NS, 2), np.float32); n = min(NS, len(y)); mus[:n] = y[:n]
tn = np.arange(NS) / SR; g = np.ones(NS)
for e in E:
    if e['type'] == 'key': g = np.minimum(g, np.where(np.abs(tn - e['t'] - .05) < .25, 10 ** (-3 / 20), 1))
k = int(.08 * SR); g = np.convolve(g, np.ones(k) / k, 'same')
g *= np.clip(tn / .1, 0, 1) * np.clip((DUR - tn) / 1.8, 0, 1)
mus *= g[:, None]
mus = mus / (np.abs(mus).max() + 1e-9) * .5
fx = fx / (np.abs(fx).max() + 1e-9) * .42
G_MUS, G_FX = 10 ** (float(os.environ.get('GM', 0)) / 20), 10 ** (float(os.environ.get('GF', 2)) / 20)
mix = limit(mus * G_MUS + fx * G_FX * np.clip((DUR - tn) / 1.8, 0, 1)[:, None], .95)
assert np.isfinite(mix).all() and np.abs(mix).max() <= 1.0
sf.write(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'mix.wav'), mix[:int(DUR * SR)], SR)
print('mix.wav', DUR, 's, events', len(E))
