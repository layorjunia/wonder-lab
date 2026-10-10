#!/bin/zsh
# Build every remaining lesson with the local model, unattended, then render the audio and write the audit.
#   perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s zsh tools/build_all.sh
# Resumable: it skips anything already approved or drafted, and it saves finished lessons after
# every course, so a crash costs minutes, not days. It does NOT deploy. See .work/AUDIT.md at the end.
cd "$(dirname "$0")/.."
LOG=.work/build-all.log
say() { echo "$(date '+%m-%d %H:%M:%S') $*" >> $LOG; }
export DRAFT_COOLDOWN=0.3          # rest ~25% of the time between model calls
say "build (re)started, pid $$"
for c in animals plants; do
  say "drafting $c"
  python3 tools/draft_pages.py --course $c --model qwen2.5:32b >> .work/pages-build.log 2>&1
  say "saving finished $c lessons"
  python3 tools/finalize_drafts.py >> $LOG 2>&1
done
say "retry pass for anything that errored"
python3 tools/draft_pages.py --all --model qwen2.5:32b >> .work/pages-build.log 2>&1
python3 tools/finalize_drafts.py >> $LOG 2>&1
python3 tools/parse_lessons.py >> $LOG 2>&1
python3 tools/check_lessons.py > .work/check-lessons.log 2>&1
python3 tools/build_lessons.py >> $LOG 2>&1
say "rendering audio"
zsh tools/render_voice.sh af_heart audio/heart >> .work/render-build.log 2>&1
say "gates"
.venv-tts/bin/python tools/check_norm.py > .work/check-norm.log 2>&1
.venv-tts/bin/python tools/audit_resolve.py > .work/audit-resolve.log 2>&1
python3 tools/audit_report.py >> $LOG 2>&1
say "build finished"
touch .work/BUILD_DONE
