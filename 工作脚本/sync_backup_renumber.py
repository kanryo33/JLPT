#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把"JLPT题库备份"里 N4/N5 的题号改写成与开发目录(data/questions.json)一致
的官方卷面编号体系：
  - problemNumber : 按板块重置的卷面正解题号（文字1-N / 语法重置 / 读解接语法 / 听力每大题从1）
  - questionNumber: 该大题内小题连续从 1 开始
以每题 identity 为桥梁，从开发目录取金标准值回填，保证两边 100% 一致。
不会改变题目内容、答案、板块归属，仅改题号字段。
"""
import json, glob, os

DEV = "/Users/kanryo/Documents/工作空间/JLPT题库/data/questions.json"
BAK = "/Users/kanryo/Documents/工作空间/JLPT题库备份"

# 1) 开发目录金标准: identity -> (problemNumber, questionNumber)
dev = json.load(open(DEV, encoding="utf-8"))
gold = {}
for x in dev:
    if x.get("level") in ("N4", "N5") and x.get("id"):
        gold[x["id"]] = (x.get("problemNumber"), x.get("questionNumber"))

# 2) 遍历备份 N4/N5，按 identity 回填
files = sorted(glob.glob(f"{BAK}/N4/N4_*.json") + glob.glob(f"{BAK}/N5/N5_*.json"))

total = 0
updated = 0
missing = 0
examples = []

for f in files:
    d = json.load(open(f, encoding="utf-8"))
    changed = False
    for sec in d["sections"]:
        for q in sec["questions"]:
            total += 1
            ident = q.get("identity")
            g = gold.get(ident)
            if not g:
                missing += 1
                if len(examples) < 10:
                    examples.append(f"未找到金标准: {ident}")
                continue
            new_prob, new_qnum = g
            if q.get("problemNumber") != new_prob or q.get("questionNumber") != new_qnum:
                q["problemNumber"] = new_prob
                q["questionNumber"] = new_qnum
                # 同时把 section.index 也对齐成卷面 problemNumber（让 section 级别也一致）
                if sec.get("index") != new_prob:
                    sec["index"] = new_prob
                updated += 1
                changed = True
    if changed:
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=2)

print(f"备份 N4/N5 总题: {total}")
print(f"已更新题号: {updated}")
print(f"未找到金标准(identity缺失): {missing}")
for e in examples:
    print("  ", e)
