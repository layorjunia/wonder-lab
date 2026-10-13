#!/bin/bash
# Copy the fact-sourcing tools and source texts to the iMac and start the run there.
#   bash tools/imac/start_grow.sh [host]
set -e
cd "$(dirname "$0")/../.."
IM=${1:-jacob@100.83.59.120}
R='~/WonderLabBuild/wonder-lab'
ssh -o ConnectTimeout=10 -o BatchMode=yes "$IM" "mkdir -p $R/tools/grow $R/.work/grow/sources $R/.work/grow/facts"
rsync -a -e "ssh -o BatchMode=yes" tools/grow/*.py tools/grow/catalog.json "$IM:$R/tools/grow/"
rsync -a -e "ssh -o BatchMode=yes" tools/build_animals.py tools/readability.py "$IM:$R/tools/"
rsync -a -e "ssh -o BatchMode=yes" .work/grow/sources/ "$IM:$R/.work/grow/sources/"
rsync -a -e "ssh -o BatchMode=yes" .work/grow/existing-facts.json "$IM:$R/.work/grow/"
scp -q tools/imac/run_grow.sh "$IM:~/WonderLabBuild/run_grow.sh"
# our own ollama on 11435 (the Rithmar service on 11434 is left alone); 3 requests in parallel
ssh "$IM" 'curl -s -m 3 127.0.0.1:11435/api/version >/dev/null || (cd ~/WonderLabBuild && OLLAMA_HOST=127.0.0.1:11435 OLLAMA_NUM_PARALLEL=3 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_KEEP_ALIVE=30m nohup /Users/jacob/RithmarAssistant/ollama/ollama serve > ollama-grow.log 2>&1 &) ; sleep 3'
ssh "$IM" 'cd ~/WonderLabBuild && rm -f GROW_DONE && (MODEL=qwen2.5:14b nohup perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" zsh run_grow.sh > grow.out 2>&1 &) ; sleep 5; tail -2 wonder-lab/.work/grow/driver.log'
echo "started. Check with:  ssh $IM 'tail -5 ~/WonderLabBuild/wonder-lab/.work/grow/extract.log; ls ~/WonderLabBuild/wonder-lab/.work/grow/facts | wc -l'"
