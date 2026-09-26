import json, glob, os

APP = r"C:/Users/L/Desktop/JLPT题库"
BAK = r"C:/Users/L/Desktop/JLPT题库备份"

def norm_id(x):
    if not x:
        return None
    x = str(x).strip()
    if len(x) >= 2 and x[0] == "'" and x[-1] == "'":
        x = x[1:-1]
    return x

print("=== 1) 题目一致性（按 identity/id）===")
bank = json.load(open(os.path.join(APP, "data", "questions.json"), encoding="utf-8"))
bank_ids = set()
for q in bank:
    i = norm_id(q.get("id"))
    if i:
        bank_ids.add(i)
print(f"题库 software questions.json 题目数: {len(bank)}，有效 identity: {len(bank_ids)}")
if len(bank) != len(bank_ids):
    print(f"  ⚠ 题库内有 {len(bank)-len(bank_ids)} 条缺少 id")

bak_files = sorted(glob.glob(os.path.join(BAK, "N[123]", "*.json")))
bak_ids = set()
bak_qcount = 0
for f in bak_files:
    d = json.load(open(f, encoding="utf-8"))
    for s in d.get("sections", []):
        for q in s.get("questions", []):
            i = norm_id(q.get("identity"))
            if i:
                bak_ids.add(i)
            bak_qcount += 1
print(f"备份 N1/N2/N3 json 题目数: {bak_qcount}，有效 identity: {len(bak_ids)}")

only_app = bank_ids - bak_ids
only_bak = bak_ids - bank_ids
print(f"仅题库有、备份无: {len(only_app)}")
print(f"仅备份有、题库无: {len(only_bak)}")
if only_app:
    print("  题库独有样例:", sorted(only_app)[:8])
if only_bak:
    print("  备份独有样例:", sorted(only_bak)[:8])
print("题目集合完全一致:", len(only_app) == 0 and len(only_bak) == 0)

print()
print("=== 2) 音频文件集合对比 ===")
app_audio = set(os.listdir(os.path.join(APP, "audio")))
bak_audio = set(os.listdir(os.path.join(BAK, "audio")))
print(f"题库 audio: {len(app_audio)}，备份 audio: {len(bak_audio)}")
print(f"差异: 仅题库 {len(app_audio-bak_audio)}，仅备份 {len(bak_audio-app_audio)}")
print("音频完全一致:", app_audio == bak_audio)

print()
print("=== 3) 图片文件集合对比 ===")
app_img = set(os.listdir(os.path.join(APP, "images")))
bak_img = set(os.listdir(os.path.join(BAK, "images")))
print(f"题库 images: {len(app_img)}，备份 images: {len(bak_img)}")
print(f"差异: 仅题库 {len(app_img-bak_img)}，仅备份 {len(bak_img-app_img)}")
print("图片完全一致:", app_img == bak_img)

print()
print("=== 4) 备份 md 与 json 配对（去扩展名比较）===")
def stemset(files):
    return {os.path.splitext(os.path.basename(f))[0] for f in files}
json_stems = stemset(glob.glob(os.path.join(BAK, "N[123]", "*.json")))
md_stems = stemset(glob.glob(os.path.join(BAK, "N[123]", "*.md")))
missing = json_stems ^ md_stems
print(f"json 套数: {len(json_stems)}，md 套数: {len(md_stems)}，不配对: {len(missing)}")
if missing:
    print("  不配对样例:", sorted(missing)[:8])
print("md/json 完全配对:", len(missing) == 0)

print()
print("=== 5) 题库 audioUrl 引用的音频是否都在 audio 目录 ===")
missing_audio_ref = 0
for q in bank:
    u = q.get("audioUrl") or ""
    if u and "audio/" in u:
        fn = u.split("audio/")[-1].split("?")[0]
        if fn not in app_audio:
            missing_audio_ref += 1
print("题库中指向 audio/ 但文件缺失的引用数:", missing_audio_ref)

print()
print("=== 总体结论 ===")
all_ok = (len(only_app)==0 and len(only_bak)==0 and
          app_audio==bak_audio and app_img==bak_img and
          len(missing)==0 and missing_audio_ref==0)
print("两份文件夹数据完全一致:", all_ok)
