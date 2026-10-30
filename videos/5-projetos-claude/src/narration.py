"""Narração (voz masculina pt-BR, Kokoro-82M) + tempos estimados de cada palavra.

Uso: python3 narration.py <kokoro.onnx> <pm_alex.bin> <saida.wav> <saida.js>

Cada fala é sintetizada por frase, sem o silêncio das pontas, e posicionada no tempo definido
em LINES (ou logo após a fala anterior, se ela ainda não tiver terminado). O tempo de cada palavra é estimado pela proporção de fonemas dentro da frase.
O .js gerado (window.NARR) é lido pelo video.html para sincronizar o texto com a voz.
"""
import json
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "pm_alex"
SPEED = 1.12
SR = 24000
DUR = 40.0
GAP = 0.12  # pausa entre frases da mesma fala

# (início em segundos, [frases]) — a grafia de algumas palavras ajusta a pronúncia
LINES = [
    (0.35, ["Esquece o próximo curso de IA."]),
    (3.15, ["Cinco projetos no Clóud ensinam mais.", "E cabem num fim de semana."]),
    (7.60, ["Um: um painel do dia.", "Agenda, e-mail e tarefas, num resumo toda manhã."]),
    (12.05, ["Dois: um segundo cérebro.", "Contrato, aluguel e seguro numa pasta só.", "É só perguntar."]),
    (17.55, ["Três: um agente que revisa o seu dia,", "e no domingo diz o que mudar."]),
    (21.85, ["Quatro: o kit da sua marca.", "Cores, fontes e tom de voz."]),
    (26.25, ["Cinco: a biblioteca da sua vida.", "Tudo que você leu, num lugar só."]),
    (30.15, ["Não tenta os cinco de uma vez.", "Começa pelo primeiro, hoje."]),
    (33.80, ["Comenta projetos,", "que eu te mando o pedido pronto."]),
]


def trim(a, thr=0.012):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a
    return a[max(0, idx[0] - int(0.02 * SR)): idx[-1] + int(0.06 * SR)]


def main(model, voice_bin, out_wav, out_js):
    # o kokoro-js distribui cada voz como float32 cru (510×256); o kokoro-onnx espera um .npz
    npz = out_wav + ".voices.npz"
    np.savez(npz, **{VOICE: np.fromfile(voice_bin, dtype=np.float32).reshape(-1, 1, 256)})
    k = Kokoro(model, npz)
    track = np.zeros(int(DUR * SR), dtype=np.float32)
    narr = []
    prev_end = 0.0
    for li, (start, sentences) in enumerate(LINES):
        start = max(start, prev_end + 0.25)
        t = start
        line = {"start": round(start, 3), "sentences": []}
        for s in sentences:
            a, sr = k.create(s, voice=VOICE, speed=SPEED, lang="pt-br")
            assert sr == SR
            a = trim(a)
            d = len(a) / SR
            words = s.split()
            # peso de cada palavra ~ número de fonemas (+ pausa na pontuação)
            ph = [max(1, len(k.tokenizer.phonemize(w.strip(",.:"), "pt-br"))) + (4 if w[-1] in ",.:" else 0) for w in words]
            tot = sum(ph)
            acc, wt = 0, []
            for w, p in zip(words, ph):
                wt.append({"w": w.strip(",.:").lower(), "t": round(t + d * acc / tot, 3)})
                acc += p
            i = int(t * SR)
            track[i:i + len(a)] += a[: len(track) - i]
            line["sentences"].append({"text": s, "start": round(t, 3), "end": round(t + d, 3), "words": wt})
            t += d + GAP
        line["end"] = round(t - GAP, 3)
        narr.append(line)
        prev_end = line["end"]
        print(f"fala {li + 1}: {start:.2f} – {line['end']:.2f}s")
    assert prev_end < 38.2, f"narração longa demais ({prev_end:.2f}s)"
    sf.write(out_wav, track, SR)
    with open(out_js, "w") as f:
        f.write("// gerado por narration.py — tempos da narração\nwindow.NARR = " + json.dumps(narr, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main(*sys.argv[1:5])
