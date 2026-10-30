#!/usr/bin/env bash
# Gera o vídeo final: ./render.sh
# Requer node + playwright, python3 com numpy/scipy/soundfile/kokoro-onnx, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
B=build
mkdir -p $B
[ -d node_modules/gsap ] || npm install

# modelo de voz (Kokoro-82M) e voz masculina pt-BR, baixados do npm
if [ ! -f $B/kokoro-q8.onnx ]; then
  (cd $B && npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1 >/dev/null && mkdir -p m j \
    && tar xzf kokoro-q8-shards-1.0.0.tgz -C m && tar xzf kokoro-js-1.2.1.tgz -C j \
    && cat m/package/kokoro-q8.part*.bin > kokoro-q8.onnx && cp j/package/voices/pm_alex.bin . && rm -rf m j *.tgz)
fi

python3 src/narration.py $B/kokoro-q8.onnx $B/pm_alex.bin $B/narration.wav src/narration.js
rm -rf $B/frames
node src/render.js $B/frames 30
python3 src/audio.py $B/frames/sfx.json $B/narration.wav $B/mix.wav
ffmpeg -v error -y -framerate 30 -i "$B/frames/f_%05d.jpg" -i $B/mix.wav \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 \
  -shortest -movflags +faststart 5-projetos-claude.mp4
rm -rf $B/frames
echo "ok: 5-projetos-claude.mp4  (player no navegador: src/motion.html?play)"
