"""重新生成全部 92 套真题的 Markdown 试卷。

只重渲染 .md，不动 .json / 题库 / 离线 HTML。
用于 _normalize_sorting_blanks 修复 文章の文法（問題6/8/2-★）题干后，
把修正同步到所有 md 文件。
"""
import json
import glob
import os

import mojidict_scraper as S

SRC_DIR = "jlpt真题备份"


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "N[123]_*.json")))
    print(f"找到 {len(files)} 个备份 JSON")
    ok = 0
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        md_path = os.path.join(SRC_DIR, base + ".md")
        data = json.load(open(f, encoding="utf-8"))
        S.save_markdown(data, md_path)
        ok += 1
    print(f"已重新生成 {ok} 个 Markdown 试卷")


if __name__ == "__main__":
    main()
