#!/bin/zsh
# Render one voice's whole corpus, six Kokoro processes wide, then finalize.
#
#   tools/render_voice.sh af_heart audio/heart
#
# One process on the graphics chip, five on the CPU — the engine's lock means
# threads inside one process buy nothing (see gen_audio.py's --shards note).
# Shards deliberately skip the manifest and the prune; the plain pass at the
# end writes the manifest, energy-checks anything the shards missed, and
# prunes orphans.
set -e
cd "$(dirname "$0")/.."
V=$1; OUT=$2
[ -n "$V" ] && [ -n "$OUT" ] || { echo "usage: render_voice.sh <kokoro voice> <out dir>"; exit 2; }

pids=()
for i in 0 1 2 3 4 5; do
  dev=$([ $i = 0 ] && echo mps || echo cpu)
  KOKORO_DEVICE=$dev KOKORO_THREADS=2 .venv-tts/bin/python tools/gen_audio.py \
    --engine kokoro --voice "$V" --out "$OUT" --shards 6 --shard $i \
    --workers 2 --no-energy > ".work/render-$V-s$i.log" 2>&1 &
  pids+=($!)
done
for p in $pids; do wait $p; done

.venv-tts/bin/python tools/gen_audio.py --engine kokoro --voice "$V" \
  --out "$OUT" --workers 2 > ".work/render-$V-final.log" 2>&1
tail -3 ".work/render-$V-final.log"
