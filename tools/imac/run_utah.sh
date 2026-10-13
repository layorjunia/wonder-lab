#!/bin/zsh
# Draft the Utah History lessons on the iMac, unattended and resumable (3 rounds at most per lesson).
# Started by tools/imac/start_utah.sh from the MacBook. Results: .work/lessons-src/utah.txt on the iMac.
cd "$(dirname "$0")/wonder-lab"
MODEL=${MODEL:-qwen2.5:32b}
export DRAFT_COOLDOWN=0
LOG=.work/utah-build.log
say() { echo "$(date '+%m-%d %H:%M:%S') $*" >> $LOG; }
say "utah build started with $MODEL, pid $$"
for round in 1 2 3; do
  say "round $round: drafting utah"
  python3 tools/draft_pages.py --course utah --model $MODEL >> .work/utah-pages.log 2>&1
  python3 tools/finalize_drafts.py --discard-failures >> $LOG 2>&1
  left=$(python3 tools/draft_pages.py --course utah --model $MODEL --count 2>/dev/null | tail -1)
  say "round $round finished, $left utah lesson(s) still to draft"
  [ "$left" = "0" ] && break
done
python3 tools/finalize_drafts.py >> $LOG 2>&1
say "utah build finished"
date > ../UTAH_DONE
