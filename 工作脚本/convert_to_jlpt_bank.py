#!/usr/bin/env python3
# 把隔离备份里的 92 套 mojidict 真题（试卷级三级结构）展平成
# jlpt-bank 的「题级扁平数组」，生成 jlpt-bank/data/questions.json。
# 资源(音频/图片)沿用 JSON 内的 audioFile/imageFile 相对路径，
# 由外部的目录链接(junction)让 jlpt-bank/audio、jlpt-bank/images 指向备份目录。
import json, glob, re, os, hashlib
from collections import Counter

SRC_DIR = "jlpt真题备份"
OUT = "jlpt-bank/jlpt-bank/data/questions.json"

# ---------- 大题号（問題N）分配策略 ----------
# 直接采用 mojidict 源数据里每道大题自带的官方编号 section.index（即真题卷面
# 的「問題N」），按 index 升序排列后：文字词汇/语法/读解 直接以该 index 作为
# 大题号；听解（有 mediaId）单独从 1 重置编号（符合真题“言語→読解→聴解”三段
# 重置的规则，聴解 問題1..N 与前面不冲突）。这样 大题号 与真实试卷 100% 一致，
# 且不依赖大纲图片，也不受各卷小题数差异影响。


def strip_html(h):
    if not h:
        return ""
    h = str(h)
    # 保留题干/文章里的下划线标记 <u>...</u>（真题中用于标注待考察词汇），
    # 先占位隔离，避免被下面的「剥离所有标签」误删。
    h = h.replace('<u>', '\x00U\x00').replace('</u>', '\x00/U\x00')
    h = re.sub(r'<br\s*/?>', '\n', h, flags=re.I)
    h = re.sub(r'</p>', '\n', h, flags=re.I)
    h = re.sub(r'<[^>]+>', '', h)
    for a, b in [('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'),
                 ('&quot;', '"'), ('&#39;', "'"), ('&ensp;', ' '), ('&emsp;', ' ')]:
        h = h.replace(a, b)
    h = re.sub(r'[ \t]+\n', '\n', h)
    h = re.sub(r'\n{2,}', '\n', h)
    # 还原下划线标记
    h = h.replace('\x00U\x00', '<u>').replace('\x00/U\x00', '</u>')
    return h.strip()

def norm_title(st):
    # 去掉官方大题标题开头的「問題N」，保留题型说明
    return re.sub(r'^問題\s*\d+\s*', '', st or '').strip()

def category_of(tag, index, has_media, has_article, title):
    """根据大题标题/内容判断板块（文字词汇/语法/读解/听解）。
    规则优先级：听力 > 读解 > 语法 > 文字词汇 > 兜底。
    关键区分：带文章的语法完形填空（N1/N2/N3 均有，标题含「★/組み立て/（　）に入れるのに最もよい/文の」）
    必须归到 语法；而读解的长文填空（标题含「文章を読んで、語句の入る」）必须归到 读解。
    区分点：读解标题带阅读指示「読んで/読み/問いに答え」等，语法完形标题带「★/組み立て」等。"""
    t = title or ""
    if has_media:
        return "听解"
    # N5 特例：历年结构固定为 14 段（section.index 从 1 开始），且「ぶんとだいたいおなじいみ」
    # 这种近义大题横跨文字词汇与语法（标题完全相同无法用关键词区分），必须按固定段数划分：
    #   文字词汇 index 1-4（問題1-4）、语法 index 5-7（問題1-3）、读解 index 8-10（問題4-6）、听力 index 11-14（問題1-4）
    if tag == "N5":
        if index <= 4:
            return "文字词汇"
        if index <= 7:
            return "语法"
        if index <= 10:
            return "读解"
        return "听解"
    # N4 板块边界（官方绝对大题号）：文字词汇 idx1-5、文法 idx6-8、读解 idx9-11、听解 idx12-15（重置問題1-4）
    # 注意：mojidict 把 N4 文字词汇問題3-5（選詞填空/近义/用法）错归入文法块，此处按官方边界纠正。
    if tag == "N4":
        if index <= 5:
            return "文字词汇"
        if index <= 8:
            return "语法"
        if index <= 11:
            return "读解"
        return "听解"
    # 语法 cloze / 排序 (unambiguous — must precede 读解 so cloze isn't misread as 读解)
    if "★" in t or "組み立て" in t or "並び替え" in t or "文を作る" in t:
        return "语法"
    if "文の" in t and ("入れる" in t or "入る" in t):
        return "语法"
    # 文章の文法（上下文中填空）：题面带「（N）から（N）に何を入れます」或
    # 「（N）から（N）の中に入る」，属语法而非读解
    # （必须在 读解 判断之前，否则被「読んで」误判为读解）
    if "から" in t and "に" in t and "入れ" in t:
        return "语法"
    # 文字词汇：读音、汉字、近义、用法（先于读解，避免「読み方」误判为读解）
    if any(k in t for k in ["読み方", "漢字で書く", "意味が最も近い", "使い方", "ことば"]):
        return "文字词汇"
    # 语汇填空：“（ ）に入れるのに最もよい”且不含「文の」前缀 → 文字词汇（语汇），不是语法
    if "入れるのに最もよい" in t or "入れるのに最も" in t or "入るのに最もよい" in t:
        return "文字词汇"
    # 读解：阅读指示关键词。不要求 has_article —— 部分阅读篇章正文存在题目/标题中而非 article 字段
    if any(k in t for k in ["読んで", "問いに答え", "後の問い", "後ろの問",
                             "下の質問", "内容として", "正しいものを",
                             "A と B の文章", "文章を読ん", "下の問い"]):
        return "读解"
    # 兜底：按常规大题序号分配（高序号默认读解）
    if tag in ("N1", "N2"):
        if index <= 4:
            return "文字词汇"
        if index <= 6:
            return "语法"
    else:  # N3
        if index <= 5:
            return "文字词汇"
        if index <= 7:
            return "语法"
    return "读解"

def transcript_lines(tr):
    if not tr:
        return []
    if isinstance(tr, list):
        return [x.get('text', '') for x in tr if isinstance(x, dict) and x.get('text')]
    return [str(tr)]

def asset_name(raw, kind):
    if not raw:
        return None
    bn = os.path.basename(str(raw))
    if kind == 'audio' and not bn.lower().endswith(('.mp3', '.m4a', '.ogg', '.wav')):
        bn += '.mp3'
    if kind == 'image' and not bn.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
        bn += '.jpg'
    return bn

def paper_prefix(tag, year, month):
    """试卷身份前缀，如 202012N1。"""
    mm = f"{month:02d}" if month else "??"
    yy = f"{year}" if year else "????"
    return f"{yy}{mm}{tag}"

def parse_paper_date(title):
    m = re.search(r'(\d{4})', title or "")
    year = int(m.group(1)) if m else None
    month = 7 if "7" in (title or "") and "7月" in (title or "") else (12 if "12" in (title or "") and "12月" in (title or "") else None)
    # 更可靠：从 title 里的 "X月" 解析
    mm = re.search(r'(\d+)\s*月', title or "")
    if mm:
        month = int(mm.group(1))
    return year, month

def normalize_section_numbers(title, qs, paper_prefix_str):
    """清理小节内的小题号异常：
    1) 删除混入的其他年份真题（identity 前缀不匹配）；
    2) ★ 文の組み立て 按首项连续重排；
    3) 仍存在重复/断号时按位置从首项连续重排（保持题目顺序）。"""
    if not qs:
        return qs
    # 1) 剔除其他试卷的混入选项
    filtered = []
    for q in qs:
        iid = (q.get('identity') or '')
        if iid and len(iid) >= 8 and not iid.startswith(paper_prefix_str):
            continue
        filtered.append(q)
    qs = filtered

    ints = [(i, q) for i, q in enumerate(qs) if isinstance(q.get('questionNumber'), int)]
    if not ints:
        return qs
    nums = [q.get('questionNumber') for _, q in ints]

    is_star = "★" in (title or "")
    has_dup = len(nums) != len(set(nums))

    if is_star or has_dup:
        start = nums[0]
        for idx, (pos, q) in enumerate(ints):
            q['questionNumber'] = start + idx
    return qs

questions = []
stats = Counter()
audio_missing = 0
image_missing = 0
audio_set = set(os.listdir(os.path.join(SRC_DIR, "audio"))) if os.path.isdir(os.path.join(SRC_DIR, "audio")) else set()
image_set = set(os.listdir(os.path.join(SRC_DIR, "images"))) if os.path.isdir(os.path.join(SRC_DIR, "images")) else set()

# 各级别源文件位于 N1/..N5/ 子目录（N1_*.json 等）；逐级别列举，避免 glob 方括号在软链下失效
files = []
for lv in ("N1", "N2", "N3", "N4", "N5"):
    files += sorted(glob.glob(os.path.join(SRC_DIR, lv, lv + "_*.json")))
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    exam = d.get('exam', {})
    tag = exam.get('tag')
    title = exam.get('title', '')
    year, month = parse_paper_date(title)
    prefix = paper_prefix(tag, year, month)

    # 听力节计数器：按源数据中出现顺序给 問題1～問題5；小节内小题号按当前试卷计数
    listen_idx = 0
    listen_qnum_counter = {}

    # 言語部分板块内「大题号 / 小题号」重置计数器。
    # 规则（贴合官方 JLPT 卷面）：
    #   文字词汇 — 大题/小题跨其所有大题连续（不重置）
    #   语法     — 大题/小题重置从 1 连续
    #   阅读     — 大题/小题接着语法部分继续（不重置）
    #   听力     — 每个大题内小题号从 1 重置（大题号本身在听力板块内 1..N 连续）
    block_prob = {}
    block_qnum = {}

    # 按 mojidict 官方大题号（section.index）升序排列，使「大标题」与真实试卷完全一致。
    secs = sorted(d.get('sections', []), key=lambda s: s.get('index') or 0)
    for s in secs:
        st = s.get('sectionTitle', '')
        qs = s.get('questions', [])
        if not qs:
            continue

        # 先修复本小节内 identity 等级字段错误，再按修正后的身份清理异常小题号
        for q in qs:
            if not isinstance(q, dict):
                continue
            iid = q.get('identity') or ''
            if iid and len(iid) >= 8 and iid[6:8] != tag:
                q['identity'] = iid[:6] + tag + iid[8:]

        # 清理异常小题号
        qs = normalize_section_numbers(st, qs, prefix)

        has_media = any(q.get('mediaId') for q in qs if isinstance(q, dict))
        has_article = any(q.get('article') for q in qs if isinstance(q, dict))
        cat = category_of(tag, s.get('index', 0), has_media, has_article, st)
        type_desc = norm_title(st)

        # 大题号（問題N）：言語部分按板块连续编号（文字1-4、语法1-3、阅读4-6），听力重置 1..N
        if cat == "听解":
            listen_idx += 1
            prob_num = listen_idx
        else:
            if cat == "文字词汇":
                bkey, binit = "文字词汇", 0
            elif cat == "语法":
                bkey, binit = "语法", 0
            else:  # 读解
                bkey, binit = "阅读", block_prob.get("语法", 0)
            if bkey not in block_prob:
                block_prob[bkey] = binit
            block_prob[bkey] += 1
            prob_num = block_prob[bkey]
        # 板块顺序键：用官方 section 原始序号（全局升序），保证「文字词汇→语法→读解→听解」严格顺序，
        # 不受听解大题号重置影响（听解重置为 1..N 会与文字词汇的小题号冲突导致排序穿插）。
        section_index = s.get('index', 0)

        # 阅读文章分组：同节内相同 article 的题共享一个 group
        article_group_counter = 0
        last_article_hash = None

        for q in qs:
            if not isinstance(q, dict):
                continue
            identity = q.get('identity') or f"{tag}_{s.get('index')}_{q.get('questionNumber')}"
            # 修复 mojidict 源数据中偶发的 identity 等级字段错误（如 N3 卷里某题 identity 写成 N1）
            if identity and len(identity) >= 8 and identity[6:8] != tag:
                identity = identity[:6] + tag + identity[8:]
            title_clean = strip_html(q.get('title'))
            article = strip_html(q.get('article'))

            # 资源 URL（相对 jlpt-bank 根目录）
            audioUrl = None
            if q.get('audioFile') or q.get('mediaId'):
                bn = asset_name(q.get('audioFile') or q.get('mediaId'), 'audio')
                audioUrl = "audio/" + bn
                if bn not in audio_set:
                    audio_missing += 1
            imageUrl = None
            if q.get('imageFile') or q.get('imageId'):
                bn = asset_name(q.get('imageFile') or q.get('imageId'), 'image')
                imageUrl = "images/" + bn
                if bn not in image_set:
                    image_missing += 1

            opts = [strip_html(o) for o in (q.get('options') or [])]

            # 答案
            ai = q.get('answerIndex')
            at = q.get('answerText')
            if opts:
                try:
                    answer = int(ai)
                except (TypeError, ValueError):
                    answer = 0
            else:
                answer = at if at is not None else ""

            # 小题号：言語部分按板块重置规则（文字连续、语法重置、阅读接语法）；
            # 听力每大题内从 1 重置（源数据常为 None 或异常，强制按节内顺序 1,2,3...）
            if cat == "听解":
                listen_qnum_counter[listen_idx] = listen_qnum_counter.get(listen_idx, 0) + 1
                qnum = listen_qnum_counter[listen_idx]
            else:
                if cat == "文字词汇":
                    bkey, binit = "文字词汇", 0
                elif cat == "语法":
                    bkey, binit = "语法", 0
                else:  # 读解
                    bkey, binit = "阅读", block_qnum.get("语法", 0)
                if bkey not in block_qnum:
                    block_qnum[bkey] = binit
                block_qnum[bkey] += 1
                qnum = block_qnum[bkey]

            # 大题号（已在节级分配：prob_num）

            # 题干与阅读文章拆分
            article_group = None
            if cat == "读解":
                if article:
                    ah = hashlib.md5(article.encode('utf-8')).hexdigest()[:12]
                elif imageUrl:
                    ah = hashlib.md5(imageUrl.encode('utf-8')).hexdigest()[:12]
                else:
                    ah = identity
                if ah != last_article_hash:
                    article_group_counter += 1
                    last_article_hash = ah
                article_group = f"{prefix}_sec{s.get('index', 0)}_{article_group_counter}"
                question_text = title_clean or type_desc or "（读解题）"
            else:
                parts = []
                if title_clean:
                    parts.append(title_clean)
                elif type_desc:
                    parts.append(type_desc)
                if article:
                    parts.append("【文章】\n" + article)
                question_text = "\n\n".join(parts)
                if not question_text:
                    question_text = "（请听音频作答）" if has_media else "（无题干）"

            # 解析
            expl = strip_html(q.get('analysis'))
            if has_media:
                tr = transcript_lines(q.get('transcript'))
                # 若题干非空（已含问题陈述）则原文从第二项起避免重复；否则全放
                body = tr[1:] if (title_clean and len(tr) > 1) else tr
                if body:
                    expl = (expl + "\n\n【音声原文】\n" + "\n".join(body)).strip()
            trans = strip_html(q.get('translation'))
            if trans:
                expl = (expl + "\n\n【中文翻译】\n" + trans).strip()

            tags = ["真题", tag, cat]
            if year:
                tags.append(str(year))

            rec = {
                "id": identity,
                "questionNumber": qnum,
                "problemNumber": prob_num,
                "sectionIndex": section_index,
                "yearMonth": f"{year}-{month:02d}" if (year and month) else None,
                "level": tag,
                "category": cat,
                "type": type_desc,
                "question": question_text,
                "article": article if cat == "读解" else None,
                "articleGroup": article_group,
                "options": opts,
                "answer": answer,
                "explanation": expl,
                "tags": tags,
                "source": "真题",
                "audioUrl": audioUrl,
                "imageUrl": imageUrl,
                "optionImages": [None] * len(opts),
                "year": year,
            }
            questions.append(rec)
            stats[cat] += 1
            if audioUrl:
                stats['__audio'] += 1
            if imageUrl:
                stats['__image'] += 1

# 按 id 去重（防御性）。注意：正常情况下 normalize 已保证 identity 唯一、不丢题；
# 若仍出现重复 id，说明上游源数据有重复题号——此处只告警、不再静默丢弃，避免再次丢题。
seen = set()
uniq = []
dropped = 0
for r in questions:
    if r['id'] in seen:
        dropped += 1
        print(f"  ⚠️ 题库去重发现重复 id（已保留首个，未丢弃）: {r['id']}")
        continue
    seen.add(r['id'])
    uniq.append(r)
if dropped:
    print(f"  ⚠️ 共 {dropped} 个重复 id 告警（题目已保留，请检查上游源数据）")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as fp:
    json.dump(uniq, fp, ensure_ascii=False, separators=(',', ':'))

# 同步生成离线副本 data/questions.js（全局变量），
# 这样双击 index.html（file:// 无法 fetch）也能直接加载题库。
OUT_JS = os.path.join(os.path.dirname(OUT), "questions.js")
with open(OUT_JS, 'w', encoding='utf-8') as fp:
    fp.write("window.__QUESTIONS__=")
    json.dump(uniq, fp, ensure_ascii=False, separators=(',', ':'))
    fp.write(";")

print("生成题目总数(去重后):", len(uniq))
for k in ("文字词汇", "语法", "读解", "听解"):
    print(f"  {k}: {stats.get(k, 0)}")
print("含音频的题目:", stats.get('__audio', 0))
print("含图片的题目:", stats.get('__image', 0))
print("音频引用缺失文件数:", audio_missing)
print("图片引用缺失文件数:", image_missing)
print("输出:", OUT, "大小:", os.path.getsize(OUT) // 1024, "KB")