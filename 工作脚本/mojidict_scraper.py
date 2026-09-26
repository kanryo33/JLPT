import urllib.request
import urllib.error
import json
import gzip
import re
import os
import sys
import time


class AuthError(Exception):
    """登录态失效（401/403），需刷新 x-moji-token 后重试。"""

BASE_URL = "https://api.mojidict.com"

# 你的认证信息（从浏览器 Network 的请求头里复制，token 过期后需更新）
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,ja;q=0.5",
    "Origin": "https://test.mojidict.com",
    "Referer": "https://test.mojidict.com/",
    "x-moji-app-id": "com.mojitec.mojitest",
    "x-moji-app-version": "v1.6.4.20260622",
    "x-moji-device-id": "22b321f5-c91c-4812-bc9f-aa6fd7a4fc92",
    "x-moji-os": "PCWeb",
    "x-moji-session-id": "r:84a341fd0d685a6955ad0994055e4305",
    "x-moji-token": "r:84a341fd0d685a6955ad0994055e4305",
}

OUT_DIR = r"C:\Users\L\WorkBuddy\JLPT真题保存"


def fetch(url, retry=2):
    req = urllib.request.Request(url, headers=HEADERS)
    last_err = None
    for attempt in range(retry):
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            data = resp.read()
            if data[:2] == b'\x1f\x8b':
                data = gzip.decompress(data)
            return json.loads(data.decode("utf-8"))
        except urllib.error.HTTPError as e:
            # 401/403 是登录态失效，无需重试，直接抛出 AuthError
            if e.code in (401, 403):
                raise AuthError(f"登录态失效 (HTTP {e.code})，需刷新 x-moji-token 后重试") from e
            last_err = e
            time.sleep(1)
        except Exception as e:
            last_err = e
            time.sleep(1)
    raise last_err


def strip_html(text):
    if not text:
        return ""

    placeholders = []

    def _u_repl(m):
        inner = m.group(1)
        # 去掉 inner 中可能嵌套的 HTML 标签，得到纯文本（如 <ruby>壊<rt>こわ</rt></ruby> -> 壊こわ）
        clean = re.sub(r'<[^>]+>', '', inner).replace('&nbsp;', ' ')
        # 去掉 HTML 空白实体和普通/全角空格，判断是否只有占位空白或星标
        stripped = clean.replace(' ', '').replace('\u3000', '').strip()
        if stripped == '★':
            return '★'
        if not stripped:
            # 空的 <u></u> 是排序题句首/句中的「空位」占位。
            # 它在浏览器里是零宽下划线（不显示横线），与 <u>★</u> 同理，
            # 故渲染为空串，而非画一条横线（否则句首会多出一条不该有的线）。
            return ''
        # 有实际文字（問題1 等读音/阅读题的被考查词）：保留文字并用真实下划线 <u> 标注，
        # 先用占位符保护，避免被后面的「去标签」步骤误删
        token = '\x00U%d\x00' % len(placeholders)
        placeholders.append('<u>%s</u>' % clean)
        return token

    # 先处理 <u> 标签（替换为占位符）
    text = re.sub(r'<u>(.*?)</u>', _u_repl, text, flags=re.S)
    # 去掉其余所有 HTML 标签
    text = re.sub(r'<[^>]+>', '', text)
    # 去掉残留的 &nbsp; 等 HTML 空白实体
    text = text.replace('&nbsp;', ' ')
    # 还原 <u> 下划线占位符
    for i, val in enumerate(placeholders):
        text = text.replace('\x00U%d\x00' % i, val)
    return text.strip()


def identity_number(identity):
    """从 identity 字符串末尾提取题号，例如 201007N1010209041*41 -> 41"""
    if not identity:
        return None
    m = re.search(r'\*(\d+)$', str(identity))
    return int(m.group(1)) if m else None


def parse_transcript(subtitle_html, translation_html):
    """解析听力原文时间轴和中文翻译。

    返回 (transcript_list, translation_list)
      transcript_list: [{"start": "...", "end": "...", "text": "..."}, ...]  时间格式 HH:MM:SS,mmm
      translation_list: ["...", ...]   与 transcript 大致按行对应（题干行可能合并）
    """
    transcript = []
    if subtitle_html:
        for m in re.finditer(
            r'<p[^>]*data-starttime="([^"]*)"[^>]*data-endtime="([^"]*)"[^>]*>(.*?)</p>',
            subtitle_html, re.S):
            start, end, text = m.group(1), m.group(2), m.group(3)
            text = strip_html(text).strip()
            if text:
                transcript.append({"start": start, "end": end, "text": text})
    translation = []
    if translation_html:
        for m in re.finditer(r'<p[^>]*>(.*?)</p>', translation_html, re.S):
            t = strip_html(m.group(1)).strip()
            if t:
                translation.append(t)
    return transcript, translation


def parse_leaf(q, context=None):
    """解析叶子小题"""
    options = q.get("options", []) or []
    right_idx = -1
    try:
        right_idx = int(q.get("rightAnswer", "0"))
    except (TypeError, ValueError):
        pass
    answer_text = options[right_idx] if 0 <= right_idx < len(options) else ""

    identity = q.get("identity", [])
    if isinstance(identity, list) and identity:
        identity = identity[0]

    ctx = context or {}
    return {
        "id": q.get("_id") or q.get("id"),
        "identity": identity,
        "questionNumber": identity_number(identity),
        "article": strip_html(ctx.get("article")) if ctx.get("article") else None,
        "transcript": ctx.get("transcript"),
        "translation": ctx.get("translation"),
        "mediaId": ctx.get("mediaId") or q.get("mediaId"),
        "imageId": ctx.get("imageId") or q.get("imageId"),
        "title": strip_html(q.get("title", "") or q.get("subtitle", "")),
        "options": options,
        "answerIndex": right_idx,
        "answerText": answer_text,
        "analysis": strip_html(q.get("analysis", "")),
        "questionType": q.get("questionType"),
    }


def extract_questions(item, context=None):
    """递归提取小题。

    节点有嵌套 items -> 是文章/听力 wrapper 或分组节点：
      - 听力材料（有 mediaId 且 subtitle 含时间轴）：解析 transcript/translation，不把 subtitle 当文章
      - 其他：title/subtitle 作为共用文章
    节点无嵌套但有 options -> 叶子小题
    """
    nested = item.get("items", []) or []
    if not nested:
        if item.get("options"):
            return [parse_leaf(item, context)]
        return []

    ctx = dict(context or {})
    if item.get("mediaId") and item.get("subtitle"):
        # 听力材料：subtitle=带时间戳日文原文，translation=中文翻译
        tr, tl = parse_transcript(item.get("subtitle", ""), item.get("translation", ""))
        if tr or tl:
            ctx["transcript"] = tr
            ctx["translation"] = tl
    else:
        wrapper_title = strip_html(item.get("title", "") or item.get("subtitle", ""))
        if wrapper_title:
            ctx["article"] = wrapper_title
    if item.get("mediaId"):
        ctx["mediaId"] = item.get("mediaId")
    if item.get("imageId"):
        ctx["imageId"] = item.get("imageId")

    result = []
    for sub in nested:
        result.extend(extract_questions(sub, ctx))
    return result


def scrape_exam(exam_id):
    print(f"正在获取试卷 {exam_id} ...")
    exam = fetch(f"{BASE_URL}/app/mojitest/api/v1/exam/{exam_id}")
    title = exam.get("title", exam_id)
    tag = exam.get("tag", "")
    group_ids = exam.get("items", [])

    sections = []
    total = 0
    for gi, gid in enumerate(group_ids, start=1):
        print(f"  [大题 {gi}/{len(group_ids)}] {gid}")
        try:
            g = fetch(f"{BASE_URL}/app/mojitest/api/v1/exam/question/{gid}").get("result", {})
        except Exception as e:
            print(f"    ⚠️ 大题获取失败: {e}")
            continue

        section_title = strip_html(g.get("title", ""))
        subs = g.get("items", []) or []

        questions = []
        for s in subs:
            questions.extend(extract_questions(s))

        # 剔除串题：mojidict 偶发把别卷题（年份/等级前缀不符）串入本卷 group，
        # 题号还常与本卷真題重复。这类一律丢弃，避免污染本卷数据。
        ym = re.search(r"(\d{4})\D*(\d+)\s*月", title)
        if ym and tag:
            pre = f"{int(ym.group(1)):04d}{int(ym.group(2)):02d}{tag}"
            before = len(questions)
            questions = [q for q in questions if (q.get("identity") or "").startswith(pre)]
            if len(questions) != before:
                print(f"    ✂ 剔除串题 {before - len(questions)} 道（前缀≠{pre}）")

        sections.append({
            "index": gi,
            "groupId": gid,
            "sectionTitle": section_title,
            "questions": questions,
        })
        total += len(questions)
        time.sleep(0.2)

    return {
        "exam": {
            "id": exam_id,
            "title": title,
            "tag": tag,
            "sectionCount": len(group_ids),
            "questionCount": total,
        },
        "sections": sections,
    }


def save_json(data, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _normalize_sorting_blanks(text):
    """清理 文章の文法（問題6 / 8 / 2-★）题干，使其忠实于 mojitest 源。

    源数据（已 strip_html）形如：
      - 格式A（如 2021）："＿ステージに__  __  ★   __上がった。"
        句首的 ＿ 是空 <u></u> 标签的残留——网页上它为零宽下划线、不显示横线，
        所以不应画一条横线；其余每个 __ 是一个空位，★ 标记答案空位。

    本函数只做"忠实显示"：
      - 去掉句首多余的单条空下划线占位（如有）；
      - 每个双下划线 __ 规范为单个全角空框 ＿（一个空位对应一个 ＿）；
      - 固定文字（如「ステージに」「上がった」）与 ★ 原样保留，
        绝不合并相邻空位、绝不移动 ★。

    输出："ステージに＿ ＿ ★ ＿上がった。"
    """
    if "★" not in text:
        return text
    # 去掉句首 artifact 空下划线（源 <u></u> 渲染为零宽，不显示横线）
    text = re.sub(r"^＿\s*", "", text)
    # ASCII 双下划线 -> 单个全角空框（逐个空位对应一个 ＿）
    text = text.replace("__", "＿")
    # 防御性：合并任何连续全角框为一个
    text = re.sub(r"＿+", "＿", text)
    # 清理空格
    text = re.sub(r"\s+", " ", text).strip()
    return text


def save_markdown(data, path):
    exam = data["exam"]
    sections = data["sections"]
    lines = [
        f"# {exam['title']} {exam['tag']} 真题",
        f"",
        f"- 试卷ID：`{exam['id']}`",
        f"- 大题数：{exam['sectionCount']}",
        f"- 小题总数：{exam['questionCount']}",
        f"",
    ]

    qnum = 0
    prev_article = None
    current_transcript = None  # 当前听力篇的 transcript，用于跨小题判重
    tag = exam.get("tag", "")

    def _classify(idx, is_listening):
        if is_listening:
            return "listening"
        if tag in ("N1", "N2"):
            return "reading" if 7 <= idx <= 13 else "vocab_grammar"
        if tag == "N3":
            if 1 <= idx <= 7:
                return "vocab_grammar"
            if 8 <= idx <= 12:
                return "reading"
            return "listening"
        return "vocab_grammar"

    def _section_heading(idx, sec_title, is_listening):
        m = re.match(r"問題\s*(\d+)[\s　]*(.*)", sec_title)
        official_num = m.group(1) if m else str(idx)
        clean_title = (m.group(2) if m else sec_title).strip()
        # 统一全角括号内的空格与数字，如（ 4 ）->（４）
        def _fw_num(m):
            n = m.group(1)
            return "（" + n.translate(str.maketrans("0123456789", "０１２３４５６７８９")) + "）"
        clean_title = re.sub(r"（\s*([0-9０-９]+)\s*）", _fw_num, clean_title)
        if tag in ("N1", "N2"):
            if 1 <= idx <= 4:
                booklet = "文字・語彙"
            elif 5 <= idx <= 6:
                booklet = "文法"
            elif 7 <= idx <= 13:
                booklet = "読解"
            else:
                booklet = "聴解"
        elif tag == "N3":
            if 1 <= idx <= 5:
                booklet = "文字・語彙"
            elif 6 <= idx <= 7:
                booklet = "文法"
            elif 8 <= idx <= 12:
                booklet = "読解"
            else:
                booklet = "聴解"
        else:
            booklet = ""
        return f"## {booklet} 問題{official_num}　{clean_title}"

    def _subq_heading(section_type, qn, identity):
        if section_type == "listening":
            suffix = identity.split("*")[-1] if "*" in identity else ""
            if suffix and re.search(r"[番質問]", suffix):
                if tag == "N3" and suffix.endswith("番"):
                    suffix = suffix[:-1] + "ばん"
                return f"### {suffix}"
            return f"### {qn}{'ばん' if tag == 'N3' else '番'}"
        if section_type == "reading":
            return f"### {qn}"
        return f"### [{qn}]"

    for sec in sections:
        sec_title = sec.get("sectionTitle") or ""
        is_listening = any(q.get("transcript") for q in sec["questions"])
        section_type = _classify(sec["index"], is_listening)
        is_usage_section = "使い方" in sec_title
        is_sorting_section = "★" in sec_title

        lines.append(_section_heading(sec["index"], sec_title, is_listening))
        lines.append("")
        prev_article = None  # 每节重置，避免上一节文章污染本节判重
        seen_images = set()  # 每节重置，图片(材料图)只渲染一次

        # 阅读/文字题：若本节所有非空文章去空白后相同或只有一篇，先在大标题后输出一次，
        # 与真题一致（大标题→文章→各小题题号→题干）。
        _arts_nonnull = [q.get("article") for q in sec["questions"] if q.get("article")]
        if _arts_nonnull:
            _norm = {a.strip() for a in _arts_nonnull}
            if len(_norm) <= 1:  # 整节共享一篇长文
                prev_article = max(_arts_nonnull, key=len)
                lines.append("**文章**：")
                lines.append(prev_article)
                lines.append("")

        for q in sec["questions"]:
            qnum += 1
            qn = q.get("questionNumber") or qnum
            tr = q.get("transcript")
            identity = q.get("identity") or ""

            if tr:
                # 听力题：题号/材料号使用 identity 后缀（1番/2番/質問1/質問2 等），与真题一致
                lines.append(_subq_heading("listening", qn, identity))
                if identity:
                    lines.append(f"**标识**：{identity}")
                # 听力题：每篇材料只在首次出现时输出音频 + 时间轴表
                if tr != current_transcript:
                    current_transcript = tr
                    if q.get("audioFile"):
                        lines.append(f"**音频**：[{q['audioFile']}]({q['audioFile']})")
                    elif q.get("mediaId"):
                        lines.append(f"**音频**：`{q['mediaId']}`")
                    lines.append("")
                    lines.append("**听力原文（带时间轴，适合精听）**：")
                    lines.append("")
                    lines.append("| 时间 | 日文 | 中文 |")
                    lines.append("| --- | --- | --- |")
                    tl = q.get("translation") or []
                    for i, seg in enumerate(tr):
                        zh = tl[i] if i < len(tl) else ""
                        jp = seg["text"].replace("|", "丨")
                        zh = zh.replace("|", "丨")
                        lines.append(f"| {seg['start']} | {jp} | {zh} |")
                    if len(tl) > len(tr):
                        lines.append("")
                        lines.append("**补充中文翻译**：")
                        for t in tl[len(tr):]:
                            lines.append(f"- {t.replace('|', '丨')}")
                    lines.append("")
                else:
                    # 同一篇听力，仅重复音频链接方便跳转
                    if q.get("audioFile"):
                        lines.append(f"**音频**：[{q['audioFile']}]({q['audioFile']})")
                    elif q.get("mediaId"):
                        lines.append(f"**音频**：`{q['mediaId']}`")
                    lines.append("")
                # 听力题图片(图表/写真)：每个唯一 imageId 在本节只渲染一次，置于音频材料之后、题干之前
                img = q.get("imageId")
                if img and img not in seen_images:
                    seen_images.add(img)
                    img_ref = q.get("imageFile") or ("images/" + img.rsplit("/", 1)[-1])
                    lines.append(f"![图片]({img_ref})")
                    lines.append("")
            else:
                current_transcript = None
                article = q.get("article")
                # 阅读/文字题：文章(材料)在「题号」之前输出，匹配真题结构（材料→文章→题号→题干）
                if article and article.strip() != (prev_article or "").strip():
                    lines.append("**文章**：")
                    lines.append(article)
                    lines.append("")
                    prev_article = article
                # 图片(材料图)：每个唯一 imageId 在本节只渲染一次，置于题号前，匹配真题「图表→题号→题干」
                img = q.get("imageId")
                if img and img not in seen_images:
                    seen_images.add(img)
                    img_ref = q.get("imageFile") or ("images/" + img.rsplit("/", 1)[-1])
                    lines.append(f"![图片]({img_ref})")
                    lines.append("")
                # 题号在每个小题的题干之前
                lines.append(_subq_heading(section_type, qn, identity))
                if identity:
                    lines.append(f"**标识**：{identity}")

            title = q.get("title") or ""
            if is_usage_section and title:
                # 問題4（言葉の使い方）：题干即为目标词，单独作为词头展示；选项中不再加下划线
                lines.append(f"**{title}**")
            elif title:
                rendered_title = _normalize_sorting_blanks(title) if is_sorting_section else title
                lines.append(f"**题干**：{rendered_title}")

            lines.append("**选项**：")
            for i, opt in enumerate(q["options"], start=1):
                marker = " ✅" if i - 1 == q["answerIndex"] else ""
                opt_text = re.sub(r"</?u>", "", opt) if is_usage_section else opt
                lines.append(f"{i}. {opt_text}{marker}")
            lines.append("")
            answer_text = re.sub(r"</?u>", "", q['answerText']) if is_usage_section else q['answerText']
            lines.append(f"**正确答案**：{answer_text}")
            lines.append("")

            if q.get("analysis"):
                lines.append("**解析**：")
                lines.append(q["analysis"])
                lines.append("")

            lines.append("---")
            lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def download_audio(data, out_dir):
    """收集全部 mediaId（JSON 小题 + API 补充），下载到 audio/ 并给每题写回 audioFile 相对路径。

    OSS 直链 https://oss.mojidict.com/{mediaId} 公开可读，下载不依赖登录态。
    """
    from urllib.parse import quote
    from collections import OrderedDict

    AUDIO_DIR = os.path.join(out_dir, "audio")
    os.makedirs(AUDIO_DIR, exist_ok=True)
    OSS_BASE = "https://oss.mojidict.com/"

    # 1) JSON 小题里的 mediaId
    media_ids = OrderedDict()
    for sec in data["sections"]:
        for q in sec["questions"]:
            m = (q.get("mediaId") or "").strip()
            if m:
                media_ids[m] = True

    # 2) 仅当 JSON 里一个 mediaId 都没收集到时，才回源 API 补充（需 token）
    if not media_ids:
        for sec in data["sections"]:
            gid = sec.get("groupId")
            if not gid:
                continue
            try:
                obj = fetch(f"{BASE_URL}/app/mojitest/api/v1/exam/question/{gid}")
            except Exception:
                continue

            def _walk(o):
                if isinstance(o, dict):
                    mm = (o.get("mediaId") or "").strip()
                    if mm:
                        media_ids[mm] = True
                    for v in o.values():
                        _walk(v)
                elif isinstance(o, list):
                    for v in o:
                        _walk(v)
            _walk(obj)

    # 3) mediaId -> 文件名（去重）
    mapping = {}
    used = set()
    for m in media_ids:
        fname = m.rsplit("/", 1)[-1]
        if not fname.lower().endswith(".mp3"):
            fname += ".mp3"
        if fname in used:
            fname = m.replace("/", "_")[-80:] + ".mp3"
        used.add(fname)
        mapping[m] = fname

    # 4) 下载（已存在则跳过）
    ok = 0
    for m, fname in mapping.items():
        url = OSS_BASE + quote(m, safe="/")
        out = os.path.join(AUDIO_DIR, fname)
        if os.path.exists(out) and os.path.getsize(out) > 100:
            ok += 1
            continue
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://test.mojidict.com/",
            })
            resp = urllib.request.urlopen(req, timeout=60)
            body = resp.read()
            if len(body) < 100:
                raise ValueError(f"文件过小 ({len(body)} bytes)")
            with open(out, "wb") as f:
                f.write(body)
            ok += 1
            print(f"  ✔ {fname} ({len(body)//1024} KB)")
        except Exception as e:
            print(f"  ✘ 下载失败 {m}: {e}")

    # 5) 写回 audioFile
    for sec in data["sections"]:
        for q in sec["questions"]:
            m = (q.get("mediaId") or "").strip()
            if m in mapping:
                q["audioFile"] = f"audio/{mapping[m]}"

    print(f"音频：成功 {ok}/{len(mapping)}")
    return mapping


def download_images(data, out_dir):
    """收集全部 imageId（JSON 小题），下载到 images/ 并给每题写回 imageFile 相对路径。

    OSS 直链 https://oss.mojidict.com/{imageId} 公开可读，下载不依赖登录态（与音频同域）。
    """
    from urllib.parse import quote
    from collections import OrderedDict

    IMG_DIR = os.path.join(out_dir, "images")
    os.makedirs(IMG_DIR, exist_ok=True)
    OSS_BASE = "https://oss.mojidict.com/"
    EXT_RE = re.compile(r"\.(jpe?g|png|gif|webp|bmp)$", re.I)

    # 1) JSON 小题里的 imageId（去重）
    media = OrderedDict()
    for sec in data["sections"]:
        for q in sec["questions"]:
            m = (q.get("imageId") or "").strip()
            if m:
                media[m] = True

    # 2) imageId -> 文件名（去重）
    mapping = {}
    used = set()
    for m in media:
        fname = m.rsplit("/", 1)[-1]
        if not EXT_RE.search(fname):
            fname += ".jpg"
        if fname in used:
            fname = m.replace("/", "_")[-80:]
            if not EXT_RE.search(fname):
                fname += ".jpg"
        used.add(fname)
        mapping[m] = fname

    # 3) 下载（已存在则跳过）
    ok = 0
    for m, fname in mapping.items():
        url = OSS_BASE + quote(m, safe="/")
        out = os.path.join(IMG_DIR, fname)
        if os.path.exists(out) and os.path.getsize(out) > 100:
            ok += 1
            continue
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://test.mojidict.com/",
            })
            resp = urllib.request.urlopen(req, timeout=60)
            body = resp.read()
            if len(body) < 100:
                raise ValueError(f"文件过小 ({len(body)} bytes)")
            with open(out, "wb") as f:
                f.write(body)
            ok += 1
            print(f"  ✔ {fname} ({len(body)//1024} KB)")
        except Exception as e:
            print(f"  ✘ 图片下载失败 {m}: {e}")

    # 4) 写回 imageFile
    for sec in data["sections"]:
        for q in sec["questions"]:
            m = (q.get("imageId") or "").strip()
            if m in mapping:
                q["imageFile"] = f"images/{mapping[m]}"

    print(f"图片：成功 {ok}/{len(mapping)}")
    return mapping


def run(exam_id):
    data = scrape_exam(exam_id)
    safe_title = re.sub(r'[\\/:*?"<>|]', "_", f"{data['exam']['tag']}_{data['exam']['title']}")
    json_path = os.path.join(OUT_DIR, f"{safe_title}.json")
    md_path = os.path.join(OUT_DIR, f"{safe_title}.md")

    print("开始下载听力音频 ...")
    download_audio(data, OUT_DIR)

    print("开始下载图片 ...")
    download_images(data, OUT_DIR)

    save_json(data, json_path)
    save_markdown(data, md_path)
    print(f"\n完成：大题 {data['exam']['sectionCount']} 个，小题 {data['exam']['questionCount']} 道")
    print(f"  JSON：{json_path}")
    print(f"  Markdown：{md_path}")
    print()
    return data


if __name__ == "__main__":
    # 用法：python mojidict_scraper.py [--force] [examId ...]
    # 不传参默认抓取 2010年7月 N1
    args = sys.argv[1:]
    force = "--force" in args
    exam_ids = [a for a in args if a != "--force"]

    done, failed, skipped = 0, 0, 0
    for idx, eid in enumerate(exam_ids, start=1):
        # 跳过已生成的（除非 --force）
        safe_title = None
        try:
            meta = fetch(f"{BASE_URL}/app/mojitest/api/v1/exam/{eid}")
            safe_title = re.sub(r'[\\/:*?"<>|]', "_", f"{meta.get('tag','N1')}_{meta.get('title', eid)}")
        except AuthError as e:
            print(f"\n🛑 登录态失效，批次中止：{e}")
            break
        except Exception:
            safe_title = None

        if safe_title and not force:
            md_path = os.path.join(OUT_DIR, f"{safe_title}.md")
            if os.path.exists(md_path) and os.path.getsize(md_path) > 100:
                print(f"[{idx}/{len(exam_ids)}] ⏭️ 跳过（已存在）：{safe_title}")
                skipped += 1
                continue

        print(f"\n===== [{idx}/{len(exam_ids)}] 开始抓取 {eid} =====")
        try:
            run(eid)
            done += 1
        except AuthError as e:
            print(f"🛑 登录态失效，批次中止：{e}")
            break
        except Exception as e:
            print(f"❌ 试卷 {eid} 抓取失败: {e}")
            failed += 1

    print(f"\n========== 批次结束 ==========")
    print(f"成功 {done}　跳过 {skipped}　失败 {failed}　总计 {len(exam_ids)}")
