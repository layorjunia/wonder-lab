#!/bin/bash
# Copy the lesson drafter, the new facts/plans and the lists to the iMac and queue the drafting run there.
#   bash tools/imac/start_lessons.sh [host]
set -e
cd "$(dirname "$0")/../.."
IM=${1:-jacob@100.83.59.120}
R='~/WonderLabBuild/wonder-lab'
ssh -o ConnectTimeout=10 -o BatchMode=yes "$IM" "mkdir -p $R/.work/lessons-plan $R/.work/lessons-src $R/.work/lessons-draft $R/tools"
rsync -a -e "ssh -o BatchMode=yes" tools/draft_lessons.py tools/draft_pages.py tools/finalize_drafts.py tools/check_lessons.py \
  tools/promote_lessons.py tools/parse_lessons.py tools/audit_report.py tools/build_animals.py tools/speech_forms.py \
  tools/readability.py tools/lint_draft.py tools/lexicon.py tools/names.py "$IM:$R/tools/"
rsync -a -e "ssh -o BatchMode=yes" .work/lesson-batch-*.json .work/gate-allow.json "$IM:$R/.work/"
rsync -a -e "ssh -o BatchMode=yes" .work/lessons-plan/ "$IM:$R/.work/lessons-plan/"
rsync -a -e "ssh -o BatchMode=yes" .work/lessons-src/ "$IM:$R/.work/lessons-src/"
rsync -a -e "ssh -o BatchMode=yes" .work/grow/ids-*.txt "$IM:$R/.work/grow/"
scp -q tools/imac/run_lessons.sh "$IM:~/WonderLabBuild/run_lessons.sh"
ssh "$IM" 'cd ~/WonderLabBuild && rm -f LESSONS_DONE && (nohup perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" zsh run_lessons.sh > lessons.out 2>&1 &) ; sleep 2; cd wonder-lab && python3 tools/draft_pages.py --all --count 2>&1 | tail -1'
echo "queued. It starts after the audit judge. Check: ssh $IM 'tail -3 ~/WonderLabBuild/wonder-lab/.work/grow/lessons.log; ls ~/WonderLabBuild/wonder-lab/.work/lessons-draft | wc -l'"
