#!/bin/zsh
# Runs on the iMac: draft the new lessons page by page with the local model, three workers, after the audit judge.
cd "$(dirname "$0")/wonder-lab"
OLLAMA_URL=${OLLAMA_URL:-http://127.0.0.1:11435}
export OLLAMA_HOST=$OLLAMA_URL
export DRAFT_COOLDOWN=0
mkdir -p .work/grow
say() { echo "$(date '+%m-%d %H:%M:%S') $*" >> .work/grow/lessons.log; }
while [ ! -f ../AUDIT_DONE ]; do sleep 120; done
say "lesson drafting started"
for w in 0 1 2; do
  ( python3 tools/draft_pages.py --ids $(cat .work/grow/ids-$w.txt | tr '\n' ' ') --model qwen2.5:14b >> .work/grow/lessons-$w.out 2>&1 ) &
done
wait
say "lesson drafting finished"
date > ../LESSONS_DONE
