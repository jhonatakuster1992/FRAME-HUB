"""Trilha (deep house minimalista, 120 BPM, Lá menor) + efeitos sonoros sintetizados.

Uso: python3 audio.py <sfx.json> <narracao.wav> <saida.wav>
Os efeitos vêm do sfx.json exportado pelo motion.html, então ficam sincronizados com a animação.
A música abaixa automaticamente enquanto a narração fala.
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 44100
DUR = 40.0
BPM = 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(42)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s = sig[max(0, -i):]
    i = max(0, i)
    n = min(len(s), len(buf) - i)
    buf[i:i + n] += s[:n] * gain


def reverb(x, seconds=2.2, wet=0.25, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (seconds / 6.9 * SR))
    ir = lp(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + fftconvolve(x, ir)[: len(x)] * wet


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * f + phase) % 1.0) - 1


# ---------------------------------------------------------------- instrumentos
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.16)
    click = hp(rng.standard_normal(n), 3000) * env_exp(n, 0.004) * 0.3
    return np.tanh(1.6 * (body + click)) * 0.9


def clap():
    n = int(0.35 * SR)
    noise = bp(rng.standard_normal(n), 900, 3200)
    e = np.zeros(n)
    for d in (0, 0.011, 0.022):
        k = int(d * SR)
        e[k:] += env_exp(n - k, 0.012 if d < 0.02 else 0.09)
    return noise * e * 0.45


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    x = hp(rng.standard_normal(n), 7500, 4)
    return x * env_exp(n, 0.07 if open_ else 0.012) * (0.22 if open_ else 0.16)


def bass_note(note, dur):
    n = int(dur * SR)
    f = midi(note)
    x = 0.6 * saw(f, n) + 0.8 * np.sin(2 * np.pi * f * np.arange(n) / SR)
    x = lp(x, 520)
    a = np.minimum(1, np.arange(n) / (0.004 * SR)) * env_exp(n, 0.16)
    return np.tanh(1.4 * x * a) * 0.5


def pad_chord(notes, dur):
    n = int(dur * SR)
    x = np.zeros(n)
    for m in notes:
        for det in (-0.09, 0.0, 0.11):
            x += saw(midi(m + det), n, phase=rng.random())
    x = lp(x / (len(notes) * 3), 1500)
    att = np.minimum(1, np.arange(n) / (0.35 * SR))
    rel = np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    return x * att * rel * 0.32


def pluck(note, dur=0.22):
    n = int(dur * SR)
    f = midi(note)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t)
    return lp(x, 2600) * env_exp(n, 0.07) * 0.16


# Am - F - C - G  (2 s por compasso)
CHORDS = [(57, [57, 60, 64, 69]), (53, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 67])]


def music():
    L = np.zeros(N)
    R = np.zeros(N)
    drums = np.zeros(N)
    bass = np.zeros(N)
    pad = np.zeros(N)
    arp = np.zeros(N)
    kick_times = []
    K, C, HC, HO = kick(), clap(), hat(), hat(True)

    bars = int(DUR / (4 * BEAT))
    for b in range(bars):
        t0 = b * 4 * BEAT
        root, chord = CHORDS[b % 4]
        full = 2 <= b <= 14 or 17 <= b <= 18  # 4–30 s e 34–38 s
        intro = b < 2
        breakdown = b in (15, 16)  # 30–34 s
        outro = b >= 19
        # pad sempre presente
        place(pad, pad_chord([c + 12 if outro else c for c in chord], 4 * BEAT + 0.3), t0)
        # arpejo em semicolcheias
        if not outro:
            seq = [chord[i % 4] + 12 for i in (0, 2, 1, 3, 2, 0, 3, 1)]
            for s in range(16):
                if intro and s % 2:
                    continue
                place(arp, pluck(seq[s % 8]), t0 + s * BEAT / 4, 0.7 if breakdown else 1.0)
        if outro:
            continue
        for beat in range(4):
            tb = t0 + beat * BEAT
            if full or (intro and beat in (0, 2)):
                place(drums, K, tb)
                kick_times.append(tb)
            if full and beat in (1, 3):
                place(drums, C, tb)
            if full or intro:
                place(drums, HO if full else HC, tb + BEAT / 2)
                if full:
                    place(drums, HC, tb + BEAT / 4, 0.7)
                    place(drums, HC, tb + 3 * BEAT / 4, 0.7)
            if full:
                place(bass, bass_note(root - 12, BEAT * 0.45), tb + BEAT / 2)
        # caixa acelerando no build (32–34.5 s)
        if b == 16:
            for i, s in enumerate(np.linspace(0, 4 * BEAT, 24, endpoint=False)):
                place(drums, C, t0 + s, 0.25 + 0.6 * i / 24)

    # sidechain pelo bumbo
    sc = np.ones(N)
    for kt in kick_times:
        i = int(kt * SR)
        n = min(int(0.3 * SR), N - i)
        sc[i:i + n] = np.minimum(sc[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / (0.09 * SR)))

    # eco do arpejo (3/16, ping-pong)
    d = int(0.75 * BEAT * SR)
    arpL, arpR = arp.copy(), arp.copy()
    arpL[d:] += arp[:-d] * 0.35
    arpR[2 * d:] += arp[: -2 * d] * 0.25
    padv = reverb(pad, 3.0, 0.35, 3) * sc
    bass *= sc
    L = drums + bass + padv + arpL * sc
    R = drums + bass + np.roll(padv, 300) + arpR * sc
    # leve filtro no intro e no breakdown
    return np.stack([L, R]), kick_times


# ---------------------------------------------------------------- efeitos
def whoosh(d=0.5):
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 40
    for i in range(blocks):
        a, b = i * n // blocks, (i + 1) * n // blocks
        k = i / blocks
        fc = 300 + 5200 * np.sin(np.pi * k) ** 2
        out[a:b] = bp(x[a:b + 2048][: b - a], fc * 0.6, min(fc * 1.6, 18000), 1)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out * e * 0.5


def impact():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 60 * np.exp(-t / 0.05)) * t) * env_exp(n, 0.35)
    crack = lp(rng.standard_normal(n), 4000) * env_exp(n, 0.05) * 0.5
    return reverb(np.tanh(1.5 * (boom + crack)), 1.8, 0.3, 9) * 0.8


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2300 * t) * env_exp(n, 0.004) * 0.18


def pop():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    f = 380 + 700 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.025) * 0.5


def ding():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((1318.5, 1), (2637, 0.3), (1760, 0.5)))
    x[int(0.11 * SR):] += (np.sin(2 * np.pi * 1760 * t) * 0.8)[: n - int(0.11 * SR)]
    return x * env_exp(n, 0.3) * 0.16


def typing(d):
    n = int(d * SR)
    out = np.zeros(n)
    t = 0.0
    while t < d - 0.03:
        k = int(0.025 * SR)
        c = bp(rng.standard_normal(k), 1800, 6000) * env_exp(k, 0.004) * (0.25 + 0.15 * rng.random())
        place(out, c, t)
        t += 0.06 + 0.06 * rng.random()
    return out


def scratch():
    n = int(0.22 * SR)
    x = bp(rng.standard_normal(n), 1200, 5000)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 0.6 * (0.7 + 0.3 * np.sin(np.linspace(0, 40, n)))
    return x * e * 0.4


def riser(d):
    n = int(d * SR)
    t = np.arange(n) / SR
    k = t / d
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1000 * k ** 2) / SR) * 0.25
    noise = hp(rng.standard_normal(n), 2000) * 0.35
    return (tone + noise) * k ** 2.5 * 0.6


def sfx_track(events):
    L = np.zeros(N)
    R = np.zeros(N)
    for ev in events:
        t, k = ev["t"], ev["k"]
        if k == "whoosh":
            s, g, pan = whoosh(), 0.8, 0.0
            t -= 0.25  # o pico do whoosh cai no corte
        elif k == "impact":
            s, g, pan = impact(), 0.9, 0.0
        elif k == "tick":
            s, g, pan = tick(), 0.5, rng.uniform(-0.4, 0.4)
        elif k == "pop":
            s, g, pan = pop(), 0.6, rng.uniform(-0.3, 0.3)
        elif k == "ding":
            s, g, pan = ding(), 1.0, 0.0
        elif k == "type":
            s, g, pan = typing(ev["d"]), 0.7, 0.15
        elif k == "scratch":
            s, g, pan = scratch(), 0.7, 0.1
        elif k == "riser":
            s, g, pan = riser(ev["d"]), 0.8, 0.0
        else:
            continue
        place(L, s, t, g * (1 - max(0, pan)))
        place(R, s, t, g * (1 + min(0, pan)))
    return np.stack([L, R])


def rms(x):
    return np.sqrt(np.mean(x ** 2))


def load_voice(path):
    with wave.open(path) as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype=np.int16 if sw == 2 else np.int32).astype(np.float64)
    x = x.reshape(-1, ch).mean(axis=1) / (32768.0 if sw == 2 else 2147483648.0)
    if sr != SR:
        from math import gcd
        g = gcd(SR, sr)
        x = resample_poly(x, SR // g, sr // g)
    out = np.zeros(N)
    out[: min(N, len(x))] = x[:N]
    return out


if __name__ == "__main__":
    events = json.load(open(sys.argv[1]))
    voice = load_voice(sys.argv[2])
    mus, _ = music()
    fx = sfx_track(events)
    mus /= rms(mus)
    fx /= rms(fx) + 1e-9
    voice = hp(voice, 80)
    voice /= np.sqrt(np.mean(voice[np.abs(voice) > 1e-4] ** 2))
    # ducking: envelope da voz (suavizado) abaixa a música ~7 dB enquanto ele fala
    env = np.abs(voice)
    k = int(0.25 * SR)
    env = np.convolve(env, np.ones(k) / k, mode="same")
    duck = 1 - 0.55 * np.clip(env / 0.25, 0, 1)
    mix = voice[None, :] * 1.0 + mus * 0.30 * duck[None, :] + fx * 0.16
    fade = np.ones(N)
    tail = int(1.0 * SR)
    fade[-tail:] = np.linspace(1, 0, tail) ** 1.5
    mix *= fade
    mix = np.tanh(mix / np.max(np.abs(mix)) * 1.15) * 0.89
    pcm = (mix.T * 32767).astype(np.int16)
    with wave.open(sys.argv[3], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("ok", sys.argv[3])
