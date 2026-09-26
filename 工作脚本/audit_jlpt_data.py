# -*- coding: utf-8 -*-
"""Comprehensive audit of jlpt真题备份 (source) vs jlpt-bank (generated)."""
import json, re, glob, os, collections, sys

ROOT = "C:/Users/L/WorkBuddy/JLPT真题保存"
BACKUP = os.path.join(ROOT, "jlpt真题备份")
BANK_JS = os.path.join(ROOT, "jlpt-bank/jlpt-bank/data/questions.js")
AUDIO_DIR = os.path.join(BACKUP, "audio")
IMG_DIR = os.path.join(BACKUP, "images")

CATS = {"文字词汇", "语法", "读解", "听解"}
VALID_CAT = CATS

def norm_opt(x):
    """Normalize an option string for comparison (strip HTML/tags/entities/spaces)."""
    if x is None:
        return None
    s = str(x).replace("&nbsp;", " ").replace("\u3000", " ")
    s = re.sub(r"<[^>]+>", "", s).strip()
    return s

def load_bank():
    txt = open(BANK_JS, encoding="utf-8").read()
    m = re.search(r'window\.__QUESTIONS__\s*=\s*(\[.*\])\s*;', txt, re.S)
    return json.loads(m.group(1))

def load_backup():
    out = {}
    for f in glob.glob(os.path.join(BACKUP, "N[123]_*.json")):
        base = os.path.basename(f)
        try:
            d = json.load(open(f, encoding="utf-8"))
            out[base] = d
        except Exception as e:
            out[base] = {"__error__": str(e)}
    return out

report = []
def note(sev, where, msg):
    report.append((sev, where, msg))

bank = load_bank()
backup = load_backup()

print("=== 加载完成 ===")
print("bank 总题数:", len(bank))
print("backup 文件数:", len([k for k in backup if "__error__" not in backup[k]]))

# ---------------------------------------------------------------
# 1) BACKUP AUDIT
# ---------------------------------------------------------------
print("\n=== 1) 备份源审计 ===")
bk_counts = collections.Counter()
dup_id_global = collections.Counter()
for fname in sorted(backup):
    d = backup[fname]
    if "__error__" in d:
        note("ERROR", fname, "JSON 解析失败: " + d["__error__"])
        continue
    # top-level
    if "sections" not in d or not isinstance(d.get("sections"), list):
        note("ERROR", fname, "缺少 sections 数组")
        continue
    secs = d["sections"]
    indices = []
    for si, s in enumerate(secs):
        idx = s.get("index")
        cat = s.get("category")
        if cat not in VALID_CAT:
            note("WARN", f"{fname} sec{si}", f"category 非法: {cat!r}")
        if not isinstance(idx, int):
            note("WARN", f"{fname} sec{si}", f"section.index 非 int: {idx!r}")
        else:
            indices.append(idx)
        if not s.get("questions"):
            note("WARN", f"{fname} sec{idx}", "该大题为空(无小题)")
        qs = s.get("questions", [])
        # question number sequence
        qnums = []
        for qi, q in enumerate(qs):
            bk_counts[cat] += 1
            ident = q.get("identity")
            if ident:
                dup_id_global[ident] += 1
            else:
                note("WARN", f"{fname} sec{idx} q{qi}", "缺少 identity")
            # options
            opts = q.get("options")
            if not isinstance(opts, list) or len(opts) < 2:
                note("ERROR", f"{fname} {ident}", f"options 无效(长度<2): {opts!r}")
                optn = 0
            else:
                optn = len(opts)
                if any((o is None or (isinstance(o, str) and o.strip() == "")) for o in opts):
                    note("WARN", f"{fname} {ident}", "options 含空选项")
            # answerIndex
            ai = q.get("answerIndex")
            if not isinstance(ai, int) or isinstance(ai, bool) or not (0 <= ai < optn):
                note("ERROR", f"{fname} {ident}", f"answerIndex 越界/非法: {ai!r} (opts={optn})")
            # answerText matches options[ai]
            if isinstance(ai, int) and 0 <= ai < optn:
                at = q.get("answerText")
                if at is not None and str(at) != str(opts[ai]):
                    note("WARN", f"{fname} {ident}", f"answerText({at!r}) != options[answerIndex]({opts[ai]!r})")
            # title / question stem
            if not q.get("title") and not q.get("article"):
                note("WARN", f"{fname} {ident}", "title 与 article 均为空(无题干)")
            # analysis
            if not q.get("analysis"):
                note("WARN", f"{fname} {ident}", "缺少 analysis(解析)")
            # 听解 needs mediaId
            if cat == "听解":
                if not q.get("mediaId"):
                    note("ERROR", f"{fname} {ident}", "听解题缺少 mediaId(音频)")
            # problemNumber
            pn = q.get("problemNumber")
            if not isinstance(pn, int):
                note("WARN", f"{fname} {ident}", f"problemNumber 非 int: {pn!r}")
            qn = q.get("questionNumber")
            qnums.append(qn)
        # within a section, questionNumber is the OFFICIAL GLOBAL JLPT question
        # number (e.g. a reading section may start at 41), so it is NOT expected
        # to be a 1..N per-section sequence. We only flag genuine anomalies:
        # duplicates or non-increasing order.
        if all(isinstance(x, int) for x in qnums) and qnums:
            if len(qnums) != len(set(qnums)) or qnums != sorted(qnums):
                note("WARN", f"{fname} sec{idx}", f"小题号异常(重复或非递增): {qnums}")
    # index completeness (best-effort): set should be 1..max with no dup
    if indices:
        sset = set(indices)
        if len(sset) != len(indices):
            note("WARN", fname, f"section.index 有重复: {indices}")
        mx = max(indices)
        missing = [i for i in range(1, mx + 1) if i not in sset]
        if missing:
            note("WARN", fname, f"section.index 缺失: {missing} (max={mx})")

# global duplicate identity
dups = {k: v for k, v in dup_id_global.items() if v > 1}
if dups:
    for k, v in list(dups.items())[:20]:
        note("ERROR", "GLOBAL", f"identity 重复 {v} 次: {k}")
    if len(dups) > 20:
        note("ERROR", "GLOBAL", f"... 共 {len(dups)} 个重复 identity")

print("backup category 计数:", dict(bk_counts))

# ---------------------------------------------------------------
# 2) BANK AUDIT
# ---------------------------------------------------------------
print("\n=== 2) 题库审计 ===")
bank_counts = collections.Counter()
dup_bank_id = collections.Counter()
bank_by_id = {}
for q in bank:
    bid = q.get("id")
    dup_bank_id[bid] += 1
    bank_by_id.setdefault(bid, []).append(q)
    cat = q.get("category")
    bank_counts[cat] += 1
    # options
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        note("ERROR", f"bank {bid}", f"options 无效: {opts!r}")
        optn = 0
    else:
        optn = len(opts)
        if any((o is None or (isinstance(o, str) and o.strip() == "")) for o in opts):
            note("WARN", f"bank {bid}", "options 含空选项")
    # answer
    ans = q.get("answer")
    if not isinstance(ans, int) or isinstance(ans, bool) or not (0 <= ans < optn):
        note("ERROR", f"bank {bid}", f"answer 越界/非法: {ans!r} (opts={optn})")
    # question stem
    if not q.get("question") and not q.get("article"):
        note("WARN", f"bank {bid}", "question 与 article 均空")
    if not q.get("explanation"):
        note("WARN", f"bank {bid}", "缺少 explanation")
    if cat not in VALID_CAT:
        note("ERROR", f"bank {bid}", f"category 非法: {cat!r}")
    if not isinstance(q.get("problemNumber"), int):
        note("WARN", f"bank {bid}", f"problemNumber 非 int: {q.get('problemNumber')!r}")
    # 听解 audio
    if cat == "听解":
        if not q.get("audioUrl"):
            note("ERROR", f"bank {bid}", "听解题 audioUrl 为空")
    # images
    iu = q.get("imageUrl")
    if iu and not (iu.startswith("http") or os.path.exists(os.path.join(IMG_DIR, os.path.basename(str(iu))))):
        note("WARN", f"bank {bid}", f"imageUrl 可能缺失文件: {iu}")

# duplicate bank id
bd = {k: v for k, v in dup_bank_id.items() if v > 1}
if bd:
    for k, v in list(bd.items())[:20]:
        note("ERROR", "GLOBAL", f"bank id 重复 {v} 次: {k}")
    if len(bd) > 20:
        note("ERROR", "GLOBAL", f"... 共 {len(bd)} 个重复 bank id")
print("bank category 计数:", dict(bank_counts))

# ---------------------------------------------------------------
# 3) 3-BLOCK RESET RULE per paper (bank)
# ---------------------------------------------------------------
print("\n=== 3) 三大块重置规则检查 (bank) ===")
by_paper = collections.defaultdict(list)
for q in bank:
    by_paper[(q["level"], q["year"])].append(q)

def check_paper(level, year, qs):
    cats = collections.defaultdict(list)
    for q in qs:
        cats[q["category"]].append(q["problemNumber"])
    errs = []
    # 听解 resets to 1..N: distinct problemNumber values must be exactly 1..K
    # (each 大题 has many sub-questions sharing the same problemNumber, so the
    #  raw list repeats values -- we dedupe before checking)
    if "听解" in cats:
        distinct = sorted(set(cats["听解"]))
        if distinct != list(range(1, len(distinct) + 1)):
            errs.append(f"听解 problemNumber 不连续/非1起: {distinct}")
    # written block: 文字词汇, 语法, 读解 use official index; should be increasing & no collision w/ 听解 (diff cat ok)
    for c in ["文字词汇", "语法", "读解"]:
        if c in cats:
            lst = sorted(cats[c])
            if any(not isinstance(x, int) for x in lst):
                errs.append(f"{c} 含非int problemNumber: {cats[c]}")
    return errs

rule_errors = 0
for (lv, yr), qs in sorted(by_paper.items()):
    errs = check_paper(lv, yr, qs)
    if errs:
        rule_errors += 1
        for e in errs:
            note("ERROR", f"{lv} {yr}", e)
print("违反重置规则的卷子数:", rule_errors, " / 总卷子:", len(by_paper))

# ---------------------------------------------------------------
# 4) CROSS-CHECK backup vs bank (join on identity/id)
# ---------------------------------------------------------------
print("\n=== 4) 备份↔题库 交叉比对 ===")
bk_by_id = {}
for fname, d in backup.items():
    if "__error__" in d:
        continue
    for s in d.get("sections", []):
        for q in s.get("questions", []):
            if q.get("identity"):
                bk_by_id[q["identity"]] = (fname, s, q)

only_bank = []  # in bank, not backup
only_bk = []    # in backup, not bank
mismatch = []
for bid, qs_bank in bank_by_id.items():
    qq = qs_bank[0]
    if bid not in bk_by_id:
        only_bank.append(bid)
        continue
    fname, s, qb = bk_by_id[bid]
    scat = s.get("category")
    # category (backup stores it at SECTION level)
    if scat != qq.get("category"):
        mismatch.append((bid, "category", scat, qq.get("category")))
    # problemNumber
    if qb.get("problemNumber") != qq.get("problemNumber"):
        mismatch.append((bid, "problemNumber", qb.get("problemNumber"), qq.get("problemNumber")))
    # answer
    if isinstance(qb.get("answerIndex"), int) and isinstance(qq.get("answer"), int):
        if qb["answerIndex"] != qq["answer"]:
            mismatch.append((bid, "answer", qb.get("answerIndex"), qq.get("answer")))
    # options equality (normalize: strip HTML tags, &nbsp;, full-width spaces)
    bn = [norm_opt(o) for o in (qb.get("options") or [])]
    kn = [norm_opt(o) for o in (qq.get("options") or [])]
    if bn != kn:
        mismatch.append((bid, "options", "len="+str(len(bn)), "len="+str(len(kn))))
for ident in bk_by_id:
    if ident not in bank_by_id:
        only_bk.append(ident)

if only_bank:
    note("ERROR", "CROSS", f"{len(only_bank)} 条在题库但不在备份: {only_bank[:10]}{'...' if len(only_bank)>10 else ''}")
if only_bk:
    note("ERROR", "CROSS", f"{len(only_bk)} 条在备份但不在题库: {only_bk[:10]}{'...' if len(only_bk)>10 else ''}")
if mismatch:
    # summarize by type
    bytype = collections.Counter(m[1] for m in mismatch)
    note("ERROR", "CROSS", f"{len(mismatch)} 条字段不一致: {dict(bytype)}")
    for m in mismatch[:30]:
        note("ERROR", "CROSS-DETAIL", f"{m[0]}: {m[1]} 备份={m[2]} 题库={m[3]}")
print("仅在题库:", len(only_bank), " 仅在备份:", len(only_bk), " 字段不一致:", len(mismatch))

# ---------------------------------------------------------------
# 5) AUDIO / IMAGE FILE EXISTENCE (sample)
# ---------------------------------------------------------------
print("\n=== 5) 音频/图片文件存在性 ===")
missing_audio = 0
checked_audio = 0
for q in bank:
    if q.get("category") == "听解" and q.get("audioUrl"):
        checked_audio += 1
        au = str(q["audioUrl"])
        # audioUrl may be full URL or relative path
        if au.startswith("http"):
            # OSS direct link - skip existence (network)
            continue
        p = au if os.path.isabs(au) else os.path.join(AUDIO_DIR, os.path.basename(au))
        if not os.path.exists(p):
            missing_audio += 1
            if missing_audio <= 10:
                note("ERROR", f"bank {q.get('id')}", f"音频文件缺失: {au}")
print(f"检查听解音频引用 {checked_audio} 条, 本地缺失 {missing_audio} 条")

# ---------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------
print("\n\n========== 审计汇总 ==========")
sev_order = {"ERROR": 0, "WARN": 1}
report.sort(key=lambda x: sev_order.get(x[0], 2))
n_err = sum(1 for r in report if r[0] == "ERROR")
n_warn = sum(1 for r in report if r[0] == "WARN")
print(f"ERROR: {n_err}   WARN: {n_warn}")
# group by location prefix
err_by_loc = collections.Counter()
for sev, where, msg in report:
    if sev == "ERROR":
        key = where.split(" ")[0] if where not in ("GLOBAL", "CROSS") else where
        err_by_loc[key] += 1
print("ERROR 按位置分布:", dict(err_by_loc))
print()
# print all ERROR lines
for sev, where, msg in report:
    if sev == "ERROR":
        print(f"[ERROR] {where}: {msg}")
print()
for sev, where, msg in report:
    if sev == "WARN":
        print(f"[WARN]  {where}: {msg}")

# write full report to file
with open(os.path.join(ROOT, "audit_report.txt"), "w", encoding="utf-8") as fh:
    fh.write(f"ERROR: {n_err}  WARN: {n_warn}\n")
    for sev, where, msg in report:
        fh.write(f"[{sev}] {where}: {msg}\n")
print("\n完整报告已写入 audit_report.txt")
