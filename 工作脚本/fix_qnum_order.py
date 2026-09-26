# -*- coding: utf-8 -*-
"""Fix 大题内 questionNumber 错位（mojidict 抓取时个别小题继承了前面大题的全局题号）。

策略（只改“题号”，绝不调整小题在数组中的顺序——数组顺序即真题顺序）：
  1) 收集该大题内有 int 题号的题（听解题号为 None，跳过）；记 K = 题数。
  2) 对每个位置 i 当前题号 v，推断 lo = v - i（即“若此题号正确，则本大题起点”）。
  3) 取使 [lo, lo+K-1] 覆盖当前题号最多的 lo 作为本大题真实起点。
  4) 将第 i 题 questionNumber 设为 lo + i；同步改写 identity 后缀与内嵌 3 位题号。
  5) 仅当异常（需修正的题）≤ 2 且改写后 identity 不与本卷其它题冲突时才落盘。

这能修复：N2 2010-2011 中几道小题题号卡在前面大题号（如 33..38,30,40..44 → 30 应为 39）。
"""
import json, glob, os, re

SRC_DIR = "jlpt真题备份"

def set_qn_in_identity(ident, new_qn):
    pre, sep, suf = ident.rpartition("*")
    if not sep:
        return ident
    new_suf = str(new_qn)
    m = re.search(r"\d{3}$", pre)
    if m and int(pre[m.start():]) == int(suf):
        new_pre = pre[:m.start()] + ("%03d" % new_qn)
    else:
        # 无法可靠改写前缀，仅改后缀
        new_pre = pre
    return new_pre + "*" + new_suf

def fix_section(s, fname, used_ids):
    st = s.get("sectionTitle", "") or ""
    qs = s.get("questions", [])
    # 跳过 ★ 排序题（其题号由 normalize 单独处理）与空大题
    if "★" in st or not qs:
        return 0
    cur = [(i, q) for i, q in enumerate(qs) if isinstance(q.get("questionNumber"), int)]
    if len(cur) < 3:
        return 0
    K = len(cur)
    # 候选 lo
    cands = {}
    for i, q in cur:
        lo = q["questionNumber"] - i
        cands.setdefault(lo, 0)
    # 统计每个 lo 的覆盖数
    best_lo = None
    best_cov = -1
    for lo in cands:
        cov = sum(1 for i, q in cur if lo <= q["questionNumber"] <= lo + K - 1)
        if cov > best_cov or (cov == best_cov and best_lo is not None and lo < best_lo):
            best_cov = cov
            best_lo = lo
    if best_lo is None:
        return 0
    anomalies = [i for i, q in cur if q["questionNumber"] != best_lo + i]
    if len(anomalies) > 2:
        return 0  # 太乱，不敢动
    # 计算新 identity 并做冲突检测
    new_map = {}
    for i, q in cur:
        orig = q["questionNumber"]
        new_qn = best_lo + i
        if new_qn == orig:
            continue
        ident = q.get("identity", "")
        new_ident = set_qn_in_identity(ident, new_qn)
        # 冲突检测：本卷已用（含未改动的）
        if new_ident in used_ids or new_ident in {v[1] for v in new_map.values()}:
            return 0
        new_map[i] = (orig, new_qn, new_ident, q)
    # 落盘
    changed = 0
    for i, (orig, new_qn, new_ident, q) in new_map.items():
        q["questionNumber"] = new_qn
        q["identity"] = new_ident
        used_ids.add(new_ident)
        changed += 1
        print(f"  {fname} sec{s.get('index')}: qn {orig} -> {new_qn}  ({new_ident})")
    return changed

def idx_of(s):
    return s.get("index")

def main():
    total = 0
    for f in sorted(glob.glob(os.path.join(SRC_DIR, "N[123]_*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        used_ids = set()
        for s in d.get("sections", []):
            for q in s.get("questions", []):
                if isinstance(q, dict) and q.get("identity"):
                    used_ids.add(q["identity"])
        for s in d.get("sections", []):
            c = fix_section(s, os.path.basename(f), used_ids)
            total += c
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n共修正小题题号:", total)

if __name__ == "__main__":
    main()
