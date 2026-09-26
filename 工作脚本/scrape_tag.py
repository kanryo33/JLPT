"""批量抓取指定 tag 的真题（导入 mojidict_scraper，带断点续传 + token 失效保护）。

用法：python scrape_tag.py N2 N3 [--force]
- 已生成 md 的试卷自动跳过（除非 --force）
- 遇 401/403（token 失效）立即停止并打印剩余列表，方便 resume
- resume：修正 token 后重新运行同一条命令（不带 --force）即可续抓
"""
import sys
import os
import json
import mojidict_scraper as ms

TAGS = [a for a in sys.argv[1:] if a != "--force"]
FORCE = "--force" in sys.argv
if not TAGS:
    TAGS = ["N2", "N3"]

with open("exam_ids_by_tag.json", encoding="utf-8") as f:
    data = json.load(f)

total_done = total_skip = total_fail = 0
aborted = False
for tag in TAGS:
    exams = data.get(tag, [])
    print(f"\n########## 开始抓取 {tag}（共 {len(exams)} 场）##########")
    done = skip = fail = 0
    for i, e in enumerate(exams, 1):
        eid = e["id"]
        title = e["title"]
        safe = f"{tag}_{title}"
        md_path = os.path.join(ms.OUT_DIR, safe + ".md")
        if os.path.exists(md_path) and os.path.getsize(md_path) > 100 and not FORCE:
            print(f"[{i}/{len(exams)}] ⏭️ 跳过(已存在): {safe}")
            skip += 1
            continue
        print(f"\n===== [{i}/{len(exams)}] {safe} =====")
        try:
            ms.run(eid)
            done += 1
        except ms.AuthError as ex:
            print(f"\n🛑 登录态失效，批次中止：{ex}")
            remaining = [x["title"] for x in exams[i - 1:]]
            print(f"   {tag} 未完成（resume 用）：{remaining}")
            aborted = True
            break
        except Exception as ex:
            print(f"❌ 失败 {safe}: {ex}")
            fail += 1
    print(f"\n==== {tag} 结束: 成功{done} 跳过{skip} 失败{fail} ====")
    total_done += done
    total_skip += skip
    total_fail += fail
    if aborted:
        break

print(f"\n########## 全部结束: 成功{total_done} 跳过{total_skip} 失败{total_fail} ##########")
if aborted:
    print("⚠️ 因 token 失效中止，请刷新 token 后用相同命令 resume。")
