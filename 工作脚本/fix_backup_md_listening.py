#!/usr/bin/env python3
# 把备份的可读 .md 卷面里「聴解」大题号从真题连续编号（如 問題13-17）重置为
# 問題1-N（符合真题“言語→読解→聴解”三段重置规则，与 jlpt-bank 展示一致）。
# 文字词汇/文法/読解 的大题号在 .md 中已是官方编号，保持不变。
import glob, re, os

SRC_DIR = "jlpt真题备份"
pat = re.compile(r'^(##\s*聴解\s*問題)(\d+)', re.M)
files = sorted(glob.glob(os.path.join(SRC_DIR, 'N[123]_*.md')))
total = 0
for f in files:
    lines = open(f, encoding='utf-8').read()
    counter = [0]
    def repl(m):
        counter[0] += 1
        return f"{m.group(1)}{counter[0]}"
    new = pat.sub(repl, lines)
    if new != lines:
        open(f, 'w', encoding='utf-8').write(new)
        total += 1
        # 统计本次重置数量
        nlisten = len(re.findall(r'^##\s*聴解\s*問題', new, re.M))
        print(f"已重置: {os.path.basename(f)}  聴解大题数={nlisten}")
print(f"\n完成。共重置 {total} 个 .md 文件。")
