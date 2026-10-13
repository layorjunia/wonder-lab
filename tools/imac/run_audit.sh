#!/bin/zsh
# Runs on the iMac after the fact-sourcing run: judge every existing fact the mechanical check could not ground.
cd "$(dirname "$0")/wonder-lab"
say() { echo "$(date '+%m-%d %H:%M:%S') $*" >> .work/audit/driver.log; }
mkdir -p .work/audit
while [ ! -f ../GROW_DONE ]; do sleep 120; done
say "audit judge started"
python3 tools/audit/audit_judge.py --all --host http://127.0.0.1:11435 --model qwen2.5:14b --workers 3 >> .work/audit/judge.out 2>&1
say "audit judge finished"
date > ../AUDIT_DONE
