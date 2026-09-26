#!/usr/bin/env python3
# 把 92 套备份真题（jlpt真题备份/N[123]_*.json）就地归一化，使其与 jlpt-bank 完全对应：
#   1) 按官方板块顺序重排 sections（文字词汇→语法→读解→听解，同板块内保序）；
#   2) 修复 identity 等级字段错误（如 N3 卷里某题写成 N1）；
#   3) 清理小题号异常（剔除他卷混入项、★/重复时按首项连续重排）；
#   4) 给每道题写入 problemNumber（言語知識+読解 连续 1..N；聴解 单独 1..5 重置），
#      并给每个 section 写入 category。
# 逻辑与 convert_to_jlpt_bank.py 保持一致（排序后再按序计数），保证两边 problemNumber 相同。
import json, glob, re, os
from collections import Counter
import mojidict_scraper  # 用于归一并重生成 .md

SRC_DIR = "jlpt真题备份"

def category_of(tag, index, has_media, has_article, title):
    t = title or ""
    if has_media:
        return "听解"
    # 语法 cloze / 排序 (unambiguous — must precede 读解 so cloze isn't misread as 读解)
    if "★" in t or "組み立て" in t or "並び替え" in t or "文を作る" in t:
        return "语法"
    if "文の" in t and ("入れる" in t or "入る" in t):
        return "语法"
    # 文字词汇：读音、汉字、近义、用法（先于读解，避免「読み方」误判为读解）
    if any(k in t for k in ["読み方", "漢字で書く", "意味が最も近い", "使い方", "ことば"]):
        return "文字词汇"
    if "入れるのに最もよい" in t or "入れるのに最も" in t or "入るのに最もよい" in t:
        return "文字词汇"
    # 读解：阅读指示关键词。不要求 has_article —— 部分阅读篇章正文存在题目/标题中而非 article 字段
    if any(k in t for k in ["読んで", "問いに答え", "後の問い", "後ろの問",
                             "下の質問", "内容として", "正しいものを",
                             "A と B の文章", "文章を読ん", "下の問い"]):
        return "读解"
    if tag in ("N1", "N2"):
        if index <= 4:
            return "文字词汇"
        if index <= 6:
            return "语法"
    else:
        if index <= 5:
            return "文字词汇"
        if index <= 7:
            return "语法"
    return "读解"

def rebuild_identity(q, paper_prefix_str, new_qn):
    """用正确的试卷前缀 + 大题 group code + 新题号，重建 identity。
    例：paper_prefix_str='202107N1', group='010106', new_qn=21
        -> '202107N1010106021*21'
    identity 正确时保持原值不变（幂等）。
    """
    iid = q.get('identity') or ''
    group = iid[8:14] if len(iid) >= 14 else '010106'
    expected = f"{paper_prefix_str}{group}{new_qn:03d}*{new_qn}"
    q['questionNumber'] = new_qn
    if iid != expected:
        q['identity'] = expected


def fix_identity_prefix(q, paper_prefix_str):
    """仅修正非 int 题（听解 *N番）的年份/等级前缀，保留原题号后缀。"""
    iid = q.get('identity') or ''
    if not iid or iid.startswith(paper_prefix_str):
        return
    suf = iid.rpartition('*')[2] if '*' in iid else ''
    group = iid[8:14] if len(iid) >= 14 else '010106'
    if suf:
        emb = iid[14:17] if len(iid) >= 17 else ''
        q['identity'] = f"{paper_prefix_str}{group}{emb}*{suf}"
    else:
        q['identity'] = f"{paper_prefix_str}{group}"


def normalize_section_numbers(title, qs, paper_prefix_str):
    """统一大题内小题号，并重建 identity（修正年份/等级标错与重复题号）。

    关键修正：先剔除「前缀不符」的串题——mojidict 偶发把别卷题（如 2012/2016 年前缀）
    串入本卷 group，且题号与本卷真題重复。这些串题一律丢弃，绝不当真題保留或顺延重排，
    否则会把别卷内容顶替真題、并挤出本卷末尾真題（如 N1_2020 大题3/6 的事故）。
    仅对「本卷真題（前缀相符）」做原号保留，或 ★/真·重复时连续重排。
    """
    if not qs:
        return qs
    # 1) 剔除串题（identity 前缀与本卷不符）
    qs = [q for q in qs if (q.get("identity") or "").startswith(paper_prefix_str)]
    # 2) 对本卷真題：原号保留；仅 ★ 排序题或真・重复题号时连续重排并重建 identity
    ints = [(i, q) for i, q in enumerate(qs) if isinstance(q.get("questionNumber"), int)]
    if ints:
        nums = [q.get("questionNumber") for _, q in ints]
        is_star = "★" in (title or "")
        has_dup = len(nums) != len(set(nums))
        if is_star or has_dup:
            start = nums[0]
            for idx, (pos, q) in enumerate(ints):
                rebuild_identity(q, paper_prefix_str, start + idx)
        else:
            for pos, q in ints:
                rebuild_identity(q, paper_prefix_str, q["questionNumber"])
    # 非 int 题（听解）仅修正前缀
    for q in qs:
        if not isinstance(q.get("questionNumber"), int):
            fix_identity_prefix(q, paper_prefix_str)
    return qs

def paper_prefix(tag, year, month):
    mm = f"{month:02d}" if month else "??"
    yy = f"{year}" if year else "????"
    return f"{yy}{mm}{tag}"

def parse_paper_date(title):
    mm = re.search(r'(\d+)\s*月', title or "")
    month = int(mm.group(1)) if mm else None
    y = re.search(r'(\d{4})', title or "")
    year = int(y.group(1)) if y else None
    return year, month

stats = Counter()
files = sorted(glob.glob(os.path.join(SRC_DIR, 'N[123]_*.json')))
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    exam = d.get('exam', {})
    tag = exam.get('tag')
    title = exam.get('title', '')
    year, month = parse_paper_date(title)
    prefix = paper_prefix(tag, year, month)

    secs = d.get('sections', [])
    # 按官方大题号 section.index 升序排列；文字词汇/语法/读解 用 index 作大题号，
    # 听解 重置 1..N（与真实试卷三段重置一致）。
    secs = sorted(secs, key=lambda s: s.get('index') or 0)

    listen_idx = 0
    for s in secs:
        st = s.get('sectionTitle', '')
        qs = s.get('questions', [])
        if not qs:
            # 空大题（源数据缺口，如 N1 2020 問題12 阅读题 mojidict 未录入）。
            # 仍按标题/大题号推断 category，避免被标为 '未知'；空大题本身另由审计以「该大题为空」告警记录。
            s['category'] = category_of(tag, s.get('index', 0), False, False, st)
            continue
        # identity 等级字段修复
        for q in qs:
            if not isinstance(q, dict):
                continue
            iid = q.get('identity') or ''
            if iid and len(iid) >= 8 and iid[6:8] != tag:
                q['identity'] = iid[:6] + tag + iid[8:]
        qs = normalize_section_numbers(st, qs, prefix)
        s['questions'] = qs

        has_media = any(q.get('mediaId') for q in qs if isinstance(q, dict))
        has_article = any(q.get('article') for q in qs if isinstance(q, dict))
        cat = category_of(tag, s.get('index', 0), has_media, has_article, st)
        s['category'] = cat
        if cat == "听解":
            listen_idx += 1
            prob_num = listen_idx
        else:
            prob_num = s.get('index')
        for q in qs:
            if isinstance(q, dict):
                q['problemNumber'] = prob_num

    d['sections'] = secs
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 同步重生成 .md，保证 markdown 与修正后的 JSON 完全一致
    md_path = os.path.splitext(f)[0] + '.md'
    try:
        mojidict_scraper.save_markdown(d, md_path)
    except Exception as e:
        print(f"  ⚠️ md 生成失败 {os.path.basename(f)}: {e}")
    stats[tag] += 1
    print(f"已归一化: {os.path.basename(f)}  tag={tag} sections={len(secs)}")

print("\n完成。共处理文件:", sum(stats.values()))
for k in sorted(stats):
    print(f"  {k}: {stats[k]}")
