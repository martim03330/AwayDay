"""Original music for the AwayDay ad, synthesised from scratch (so there is no licence to worry about).

120 BPM: one beat is exactly 15 frames at 30 fps, so every cut in the video can land on a beat. The short ad's moments (seconds) are
the same as in src/tempos.ts: change them in both places.

    0-2    hook: a claps on each word, a riser
    2      DROP as the group chat comes in; full beat until 18
    6/10/14 the "A AwayDay trata..." word changes: a soft swell into each
    18     the stadium stamp (the app's own stamp sound), half-time
    20     the end card: impact and a big chord ringing out to 23

Usage:  python3 musica.py curto public/musica.wav
        python3 musica.py longo public/musica-longo.wav   (needs numpy and scipy, outside the app)
"""

import os
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
# Which piece: `curto` (the 23 s ad) or `longo` (the full tour of the app). Chapter lengths of the long one, in bars
# of 2 s, are the same as CAPITULOS in src/longo/capitulos.ts: change them in both places.
MODO = sys.argv[1] if len(sys.argv) > 2 else 'curto'
BARRAS_LONGO = [2, 4, 4, 5, 2, 3, 3, 5, 3, 3, 3, 4, 3]
LENGTH = 25.0 if MODO == 'curto' else sum(BARRAS_LONGO) * 2.0 + 1.0
N = int(SR * LENGTH)
rng = np.random.default_rng(7)


def at(seconds):
    return int(round(seconds * SR))


def env(length, attack=0.002, decay=0.2):
    t = np.arange(int(length * SR)) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-t / decay)


def filt(x, kind, freq, order=2):
    sos = butter(order, freq, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def place(track, sound, start, gain=1.0):
    i = at(start)
    if i >= len(track):
        return
    end = min(len(track), i + len(sound))
    track[i:end] += sound[: end - i] * gain


def note_hz(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    semis = names[name[0]] + (1 if '#' in name else 0)
    octave = int(name[-1])
    return 440 * 2 ** ((semis + 12 * (octave - 4)) / 12)


def saw(freq, length, detune_cents=(0,)):
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    for c in detune_cents:
        f = freq * 2 ** (c / 1200)
        phase = rng.random()
        out += 2 * ((t * f + phase) % 1) - 1
    return out / len(detune_cents)


# --- Sounds -------------------------------------------------------------------------------------------------------

def kick():
    length = 0.45
    t = np.arange(int(length * SR)) / SR
    freq = 45 + 110 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t / 0.22)
    click = filt(rng.standard_normal(len(t)), 'highpass', 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))


def clap():
    length = 0.35
    n = int(length * SR)
    noise = filt(rng.standard_normal(n), 'bandpass', [900, 6000])
    t = np.arange(n) / SR
    e = np.zeros(n)
    for k, offset in enumerate((0, 0.011, 0.022)):
        i = at(offset)
        e[i:] += np.exp(-(t[: n - i]) / (0.012 if k < 2 else 0.12))
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    return (noise * e * 0.6 + body) * 0.9


def hat(open_=False):
    length = 0.25 if open_ else 0.06
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'highpass', 7000)
    return noise * np.exp(-t / (0.08 if open_ else 0.015)) * 0.35


def impact():
    length = 2.5
    t = np.arange(int(length * SR)) / SR
    sub = np.sin(2 * np.pi * (38 + 40 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.7)
    crash = filt(rng.standard_normal(len(t)), 'highpass', 3000) * np.exp(-t / 0.9) * 0.35
    return sub + crash


def riser(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    noise = rng.standard_normal(n)
    # Sweep the band up in short chunks.
    chunk = int(0.05 * SR)
    for i in range(0, n, chunk):
        f = 400 + 9000 * (i / n) ** 2
        out[i : i + chunk] = filt(noise[i : i + chunk], 'bandpass', [f, min(f * 1.8, 20000)], order=1)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / length) ** 2) / SR) * 0.15
    return (out * 0.5 + tone) * (t / length) ** 1.5


def stab(notes, length=0.28):
    out = sum(saw(note_hz(nm), length, (-12, -4, 4, 12)) for nm in notes) / len(notes)
    out = filt(out, 'lowpass', 3200)
    return out * env(length, 0.003, 0.12)


def pad(notes, length):
    out = sum(saw(note_hz(nm), length, (-15, -6, 6, 15)) for nm in notes) / len(notes)
    out = filt(out, 'lowpass', 1400)
    t = np.arange(len(out)) / SR
    return out * np.clip(t / 0.4, 0, 1) * np.clip((length - t) / 0.6, 0, 1)


def bass(note, length=0.22):
    f = note_hz(note)
    out = saw(f, length, (0, 7)) * 0.7 + np.sin(2 * np.pi * f * np.arange(int(length * SR)) / SR) * 0.6
    out = filt(out, 'lowpass', 600)
    return out * env(length, 0.004, 0.16)


def pluck(note, length=0.18):
    out = saw(note_hz(note), length, (-5, 5))
    out = filt(out, 'lowpass', 2600)
    return out * env(length, 0.002, 0.07)


# --- Arrangement --------------------------------------------------------------------------------------------------

HOOK_WORDS = (0.0, 0.25, 0.5, 0.75)
DROP = 2.0
BUBBLES = (2.2, 3.8)
SWAPS = (6.0, 10.0, 14.0)
TAPS = (8.05, 15.8)
STAMP = 18.0
END = 20.0

drums = np.zeros(N)
music = np.zeros(N)
fx = np.zeros(N)
duck = np.ones(N)

CHORDS = [  # Am - F - C - G, one per bar
    (['A3', 'C4', 'E4'], 'A1', ['A4', 'C5', 'E5', 'C5']),
    (['F3', 'A3', 'C4'], 'F1', ['F4', 'A4', 'C5', 'A4']),
    (['C4', 'E4', 'G4'], 'C2', ['C5', 'E5', 'G5', 'E5']),
    (['G3', 'B3', 'D4'], 'G1', ['G4', 'B4', 'D5', 'B4']),
]

K, CL, HC, HO = kick(), clap(), hat(), hat(True)


def sidechain(t):
    i = at(t)
    d = np.linspace(0.35, 1, at(0.25))
    duck[i : i + len(d)] = np.minimum(duck[i : i + len(d)], d[: len(duck) - i])


def swell(length=0.6):
    """Reverse-noise swell that lands on a cut."""
    n = int(length * SR)
    t = np.arange(n) / SR
    s = filt(rng.standard_normal(n), 'bandpass', [1500, 9000], order=1)
    return s * (t / length) ** 3 * 0.35


def tick():
    n = int(0.04 * SR)
    t = np.arange(n) / SR
    return filt(rng.standard_normal(n), 'bandpass', [2000, 5000]) * np.exp(-t / 0.006) * 0.5


def app_sound(name):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../assets/sounds', name)
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768
        if w.getnchannels() == 2:
            data = data[::2]
        rate = w.getframerate()
    return np.interp(np.arange(int(len(data) * SR / rate)) * rate / SR, np.arange(len(data)), data)


if MODO == 'curto':
    # Same moments as src/tempos.ts (seconds).
    ACABOU, BOLEIA, TASCO, CONTAS, CARIMBO, MEMORIA, FECHO = 2.5, 3.5, 7.5, 11.5, 15.5, 18.5, 21.5

    # The chat chaos: a pluck per message, ticking faster, tension rising to the drop.
    for i in range(7):
        place(music, pluck(['A4', 'C5', 'E5', 'A5', 'C6', 'E6', 'A6'][i], 0.25), (4 + i * 8) / 30 + 0.05, 0.45)
    for i in range(16):
        place(drums, HC, 0.5 + i * 0.125, 0.15 + 0.4 * i / 16)
    place(music, pad(['A3', 'C4', 'E4'], ACABOU), 0, 0.3)
    place(fx, riser(ACABOU - 0.2), 0.2, 0.7)

    # «Acabou a confusão.»: silence for an instant, then the hit.
    place(fx, impact(), ACABOU, 1.0)
    place(drums, K, ACABOU, 1.0)
    place(drums, CL, ACABOU, 0.9)
    place(music, stab(['A3', 'C4', 'E4', 'A4'], 0.6), ACABOU, 0.7)

    # The features: full beat from the ride to the stamp.
    for bar in range(int((CARIMBO - BOLEIA) / BAR)):
        t0 = BOLEIA + bar * BAR
        chord, root, arp = CHORDS[bar % 4]
        for b in range(4):
            place(drums, K, t0 + b * BEAT, 1.0)
            sidechain(t0 + b * BEAT)
            place(drums, HO, t0 + b * BEAT + BEAT / 2, 0.45)
            place(music, bass(root), t0 + b * BEAT + BEAT / 2, 0.9)
            place(music, stab(chord), t0 + b * BEAT + BEAT / 2, 0.4)
            for sub in range(4):
                place(drums, HC, t0 + b * BEAT + sub * BEAT / 4, 0.22 if sub % 2 else 0.1)
                if bar >= 2:
                    place(music, pluck(arp[(b + sub) % 4]), t0 + b * BEAT + sub * BEAT / 4, 0.13)
        place(drums, CL, t0 + BEAT, 0.75)
        place(drums, CL, t0 + 3 * BEAT, 0.75)

    # Each scene change: a swell into it and a soft hit on it; the big numbers get a tick.
    for t in (TASCO, CONTAS):
        place(fx, swell(), t - 0.6, 1.0)
        place(fx, impact(), t, 0.3)
    for t in (BOLEIA + 0.73, BOLEIA + 1.33, BOLEIA + 1.93, CONTAS + 1.0, CONTAS + 1.4, CONTAS + 1.8):
        place(fx, tick(), t, 0.6)
    place(fx, app_sound('check-in.wav'), TASCO + 2.0, 0.7)

    # The stamp: the app's own sound on a kick, then half-time.
    place(fx, swell(), CARIMBO - 0.6, 1.0)
    place(fx, app_sound('carimbo.wav'), CARIMBO + 0.2, 1.6)
    place(drums, K, CARIMBO + 0.2, 1.0)
    place(fx, impact(), CARIMBO + 0.2, 0.4)
    for b in range(2, 6):
        place(drums, K, CARIMBO + b * BEAT, 0.7)
    place(music, pad(CHORDS[1][0], MEMORIA - CARIMBO), CARIMBO, 0.4)

    # The memory: softer, chords and a pluck line, a riser into the end.
    place(music, pad(CHORDS[2][0], BAR), MEMORIA, 0.5)
    place(music, pad(CHORDS[3][0], FECHO - MEMORIA - BAR), MEMORIA + BAR, 0.5)
    for i in range(12):
        place(music, pluck(['C5', 'E5', 'G5', 'E5'][i % 4]), MEMORIA + i * BEAT / 2, 0.2)
    place(fx, riser(FECHO - MEMORIA - 0.2), MEMORIA + 0.2, 0.45)

    # End card.
    place(fx, impact(), FECHO, 0.8)
    place(drums, K, FECHO, 1.0)
    place(music, pad(['A2', 'A3', 'C4', 'E4', 'A4'], LENGTH - FECHO), FECHO, 0.7)
    place(music, stab(['A3', 'C4', 'E4', 'A4'], 0.6), FECHO, 0.6)
    place(fx, app_sound('check-in.wav'), FECHO + 1.1, 0.6)

else:
    starts = np.cumsum([0] + BARRAS_LONGO) * BAR
    fim = starts[-2]
    pausa = starts[9]  # the stays chapter: a breather before the last three

    # Intro: pad and a riser, claps on the first words.
    place(music, pad(CHORDS[0][0], 2 * BAR), 0, 0.35)
    place(fx, riser(2 * BAR - 0.3), 0.3, 0.55)
    for t in (0.0, 0.5, 1.0):
        place(drums, CL, t, 0.35)

    bar_index = 0
    for bar in range(2, int(fim / BAR)):
        t0 = bar * BAR
        chord, root, arp = CHORDS[bar % 4]
        no_pausa = pausa <= t0 < pausa + 3 * BAR
        for b in range(4):
            if not no_pausa:
                place(drums, K, t0 + b * BEAT, 0.9)
                sidechain(t0 + b * BEAT)
                place(drums, HO, t0 + b * BEAT + BEAT / 2, 0.32)
                place(music, bass(root), t0 + b * BEAT + BEAT / 2, 0.8)
                place(music, stab(chord), t0 + b * BEAT + BEAT / 2, 0.3)
            for sub in range(4):
                if not no_pausa:
                    place(drums, HC, t0 + b * BEAT + sub * BEAT / 4, 0.16 if sub % 2 else 0.07)
                if bar >= 6:
                    place(music, pluck(arp[(b + sub) % 4]), t0 + b * BEAT + sub * BEAT / 4, 0.16 if no_pausa else 0.11)
        if no_pausa:
            place(music, pad(chord, BAR), t0, 0.4)
        else:
            place(drums, CL, t0 + BEAT, 0.6)
            place(drums, CL, t0 + 3 * BEAT, 0.6)

    # Every chapter change: a swell into it and a soft impact on it.
    for t in starts[1:-1]:
        place(fx, swell(0.9), t - 0.9, 0.9)
        place(fx, impact(), t, 0.3)
    place(fx, riser(BAR), pausa + 2 * BAR, 0.45)

    # End card.
    place(fx, impact(), fim, 0.8)
    place(drums, K, fim, 1.0)
    place(music, pad(['A2', 'A3', 'C4', 'E4', 'A4'], LENGTH - fim), fim, 0.7)
    place(music, stab(['A3', 'C4', 'E4', 'A4'], 0.6), fim, 0.6)
    place(fx, app_sound('carimbo.wav'), fim + 0.5, 1.2)

mix = drums * 0.9 + music * duck * 0.8 + fx * 0.7
mix = filt(mix, 'highpass', 28)
mix = np.tanh(1.4 * mix) / np.tanh(1.4)
mix = mix / np.max(np.abs(mix)) * 0.89

# A little width: the music slightly delayed on one side.
right = mix.copy()
left = mix * 0.0 + drums * 0.9
left = np.tanh(1.4 * (left + np.roll(music * duck * 0.8, at(0.012)) + fx * 0.7)) / np.tanh(1.4)
left = left / np.max(np.abs(left)) * 0.89
stereo = np.stack([left, right], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')

with wave.open(sys.argv[-1] if len(sys.argv) > 1 else 'musica.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
