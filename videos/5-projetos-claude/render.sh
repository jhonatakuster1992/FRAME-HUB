#!/usr/bin/env bash
# Gera o vídeo final: ./render.sh  (requer node + playwright, python3 + numpy/scipy, ffmpeg)
set -euo pipefail
cd "$(dirname "$0")"
TMP=$(mktemp -d)
node src/render.js "$TMP/frames" 30
python3 src/audio.py "$TMP/frames/sfx.json" "$TMP/audio.wav"
ffmpeg -v error -y -framerate 30 -i "$TMP/frames/f_%05d.jpg" -i "$TMP/audio.wav" \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 \
  -shortest -movflags +faststart 5-projetos-claude.mp4
rm -rf "$TMP"
echo "ok: 5-projetos-claude.mp4"
