#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 N4/N5 音频在 file:// 下无法播放的问题。

根因：N4/N5 的音频源文件名含中文（如 "02第一大题1.mp3"），
浏览器在 file:// 协议下无法正确加载中文路径的 <audio src>。
N1/N2/N3 使用纯 ASCII 文件名（uuid/日期），所以能正常播放。

方案：把所有非 ASCII 的音频文件名重命名为唯一 ASCII 名
（N45audio_<md5前8位>.mp3），保持内容不变，并更新
data/questions.json / data/questions.js 中的 audioUrl 引用。
file:// 下直接双击 index.html 即可播放，无需服务器。
"""
import json, os, hashlib, re

ROOT = "/Users/kanryo/Documents/工作空间/JLPT题库"
AUDIO_DIR = os.path.join(ROOT, "audio")
QJSON = os.path.join(ROOT, "data", "questions.json")
QJS = os.path.join(ROOT, "data", "questions.js")

def is_ascii(s):
    try:
        s.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False

# 1) 收集当前 audio/ 下所有非 ASCII 文件，建立 原名 -> 新名 映射
rename_map = {}  # old_basename -> new_basename
for fn in os.listdir(AUDIO_DIR):
    if not fn.lower().endswith((".mp3", ".m4a", ".ogg", ".wav")):
        continue
    if is_ascii(fn):
        continue  # 已经是 ASCII（N1/N2/N3），不动
    # 生成稳定 ASCII 名：用文件内容 md5 前 8 位，保证唯一且可复现
    path = os.path.join(AUDIO_DIR, fn)
    h = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    ext = os.path.splitext(fn)[1].lower()
    new_name = f"N45audio_{h}{ext}"
    # 防止极小概率碰撞
    while new_name in rename_map.values():
        h = hashlib.md5((h + "x").encode()).hexdigest()[:8]
        new_name = f"N45audio_{h}{ext}"
    rename_map[fn] = new_name

print(f"需重命名的中文音频文件数: {len(rename_map)}")

# 2) 执行重命名（同目录内 rename，安全）
renamed = 0
for old, new in rename_map.items():
    src = os.path.join(AUDIO_DIR, old)
    dst = os.path.join(AUDIO_DIR, new)
    if os.path.exists(dst):
        continue
    os.rename(src, dst)
    renamed += 1
print(f"实际重命名: {renamed}")

# 3) 更新 questions.json
with open(QJSON, encoding="utf-8") as f:
    data = json.load(f)

def fix_url(u):
    if not u:
        return u
    bn = os.path.basename(u)
    if bn in rename_map:
        return "audio/" + rename_map[bn]
    return u

changed_json = 0
for q in data:
    if q.get("audioUrl"):
        nu = fix_url(q["audioUrl"])
        if nu != q["audioUrl"]:
            q["audioUrl"] = nu
            changed_json += 1

with open(QJSON, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print(f"questions.json 更新引用: {changed_json}")

# 4) 更新 questions.js  (window.__QUESTIONS__=[...])
with open(QJS, encoding="utf-8") as f:
    js = f.read()

# 直接做字符串替换： "audio/<原名>" -> "audio/<新名>"
changed_js = 0
def repl(m):
    global changed_js
    old_full = m.group(1)  # 形如 audio/02第一大题1.mp3
    bn = os.path.basename(old_full)
    if bn in rename_map:
        changed_js += 1
        return '"audio/' + rename_map[bn] + '"'
    return m.group(0)

js2 = re.sub(r'"audio/([^"]+)"', repl, js)
with open(QJS, "w", encoding="utf-8") as f:
    f.write(js2)
print(f"questions.js 更新引用: {changed_js}")

# 5) 校验：重跑一遍，确认数据里已无中文音频路径
with open(QJSON, encoding="utf-8") as f:
    data2 = json.load(f)
left = [q["audioUrl"] for q in data2 if q.get("audioUrl") and not is_ascii(os.path.basename(q["audioUrl"]))]
print(f"残留中文音频引用: {len(left)}")
for x in left[:5]:
    print("  残留:", x)
