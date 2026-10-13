#!/bin/bash
# One command: copy the Utah sources + drafting tools to the iMac and start the draft run there.
#   bash tools/imac/start_utah.sh [host]        (default host is the iMac's Tailscale address)
# Needs the iMac awake and reachable (turn Tailscale on, on this Mac, first).
set -e
cd "$(dirname "$0")/../.."
IM=${1:-jacob@100.83.59.120}
R='~/WonderLabBuild/wonder-lab'
ssh -o ConnectTimeout=10 -o BatchMode=yes "$IM" "mkdir -p $R/.work/lessons-plan $R/tools"
rsync -a -e "ssh -o BatchMode=yes" tools/draft_lessons.py tools/draft_pages.py tools/finalize_drafts.py \
  tools/check_lessons.py tools/promote_lessons.py tools/parse_lessons.py tools/audit_report.py \
  tools/build_animals.py tools/speech_forms.py "$IM:$R/tools/"
rsync -a -e "ssh -o BatchMode=yes" .work/lesson-batch-utah.json .work/gate-allow.json "$IM:$R/.work/"
rsync -a -e "ssh -o BatchMode=yes" .work/lessons-plan/utah.txt "$IM:$R/.work/lessons-plan/"
scp -q tools/imac/run_utah.sh "$IM:~/WonderLabBuild/run_utah.sh"
ssh "$IM" 'cd ~/WonderLabBuild && rm -f UTAH_DONE && (MODEL=qwen2.5:32b nohup perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" zsh run_utah.sh > utah.out 2>&1 &) ; sleep 5; cd wonder-lab && python3 tools/draft_pages.py --course utah --count | tail -1'
echo "started. Check later with:  ssh $IM 'tail -5 ~/WonderLabBuild/wonder-lab/.work/utah-build.log; ls ~/WonderLabBuild/UTAH_DONE'"
