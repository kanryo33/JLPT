#!/usr/bin/env python3
# 规范化所有 問題6/8/2-★ 排序题题干（備份 JSON）：
#  - 句首的空下划线占位（源 <u></u> 空标签，网页零宽不显示横线）一律去掉，不画横线；
#  - 每个双下划线 __ 规范为单个全角空框 ＿；
#  - 固定文字与 ★ 原样保留，绝不合并、绝不移动 ★。
import json, glob, re

STAR = "★"   # U+2605
U = "＿"      # 全角下划线 U+FF3F

def clean(text):
    if STAR not in text:
        return text
    # 去掉句首连续的全角下划线占位（可能 1 个或多个），及其后空格
    text = re.sub(r"^\s*" + U + r"+\s*", "", text)
    text = text.replace("__", U)
    text = re.sub(U + r"+", U, text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

files = sorted(glob.glob("jlpt真题备份/N[123]_*.json"))
changed_files = 0
changed = 0
for f in files:
    d = json.load(open(f, encoding="utf-8"))
    cf = False
    for s in d["sections"]:
        for q in s.get("questions", []):
            t = q.get("title") or ""
            if STAR in t:
                nw = clean(t)
                if nw != t:
                    q["title"] = nw
                    changed += 1
                    cf = True
    if cf:
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        changed_files += 1
print("changed_files:", changed_files, "changed_titles:", changed)
