#!/usr/bin/env python3
"""Print a lesson's source facts, numbered the way plans refer to them.
   python3 tools/show_facts.py earth-water earth-weather"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import draft_lessons as D
src = D.load_sources()
for lid in sys.argv[1:]:
    print(D.facts_block(src[lid]).replace('COURSE:', f'##### {lid} |'))
    print()
