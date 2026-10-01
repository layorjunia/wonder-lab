#!/bin/bash
# Record one Kokoro voice into its own folder, using every core.
#
#   tools/record_voice.sh heart af_heart
#   tools/record_voice.sh michael am_michael
#
# The Kokoro pipeline is NOT thread-safe (tts_engines holds a lock), so
# --workers only ever parallelised the afconvert encoding. Real parallelism has
# to be separate PROCESSES: each shard loads its own model and renders every
# Nth clip. One shard runs on the graphics chip, the rest on CPU with two
# threads each — measured on this M4 Pro at roughly 8x real time per process.
# A final plain pass writes the manifest and prunes.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:?usage: record_voice.sh <folder> <kokoro-voice-id>}"
VOICE="${2:?}"
SHARDS="${SHARDS:-6}"
OUT="audio/$NAME"
PY=.venv-tts/bin/python
mkdir -p "$OUT" .work/log

echo "recording $VOICE into $OUT with $SHARDS shards"
pids=()
for i in $(seq 0 $((SHARDS - 1))); do
  if [ "$i" = 0 ]; then export KOKORO_DEVICE=mps; unset KOKORO_THREADS || true
  else export KOKORO_DEVICE=cpu; export KOKORO_THREADS=2; fi
  $PY tools/gen_audio.py --engine kokoro --voice "$VOICE" --out "$OUT" \
      --shards "$SHARDS" --shard "$i" --workers 2 \
      > ".work/log/$NAME-$i.log" 2>&1 &
  pids+=($!)
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done
[ "$fail" = 0 ] || { echo "a shard failed — see .work/log/$NAME-*.log"; exit 1; }

# One plain pass: writes the manifest, checks for silence, prunes orphans.
KOKORO_DEVICE=mps $PY tools/gen_audio.py --engine kokoro --voice "$VOICE" --out "$OUT" \
  2>&1 | grep -v "FutureWarning\|warnings.warn\|UserWarning\|WeightNorm\|super().__init__\|^Warning:"
