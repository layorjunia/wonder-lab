#!/bin/zsh
# Runs on the iMac: write sourced facts for every new section, then have a second model call check each one.
#   MODEL=qwen2.5:14b zsh run_grow.sh      (started by tools/imac/start_grow.sh)
cd "$(dirname "$0")/wonder-lab"
MODEL=${MODEL:-qwen2.5:14b}
OLLAMA_URL=${OLLAMA_URL:-http://127.0.0.1:11435}
mkdir -p .work/grow
say() { echo "$(date '+%m-%d %H:%M:%S') $*" >> .work/grow/driver.log; }
say "grow run started with $MODEL at $OLLAMA_URL"
for pass in 1 2; do
  python3 tools/grow/extract_facts.py --all --host $OLLAMA_URL --model $MODEL --workers 3 >> .work/grow/extract.out 2>&1
  say "extract pass $pass finished: $(ls .work/grow/facts 2>/dev/null | wc -l) sections"
done
python3 tools/grow/verify_facts.py --all --host $OLLAMA_URL --model $MODEL --workers 3 >> .work/grow/verify.out 2>&1
say "verify finished"
date > ../GROW_DONE
