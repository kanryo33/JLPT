"""按 tag 拉取 mojidict 试卷 ID（列表接口一页即返回全部，无需 cursor 分页）。

用法：python fetch_exam_ids.py N2 N3
输出：exam_ids_by_tag.json
"""
import sys
import urllib.request
import json
import gzip

BASE = "https://api.mojidict.com/app/mojitest/api/v1"
H = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://test.mojidict.com",
    "Referer": "https://test.mojidict.com/",
    "x-moji-app-id": "com.mojitec.mojitest",
    "x-moji-app-version": "v1.6.4.20260622",
    "x-moji-device-id": "22b321f5-c91c-4812-bc9f-aa6fd7a4fc92",
    "x-moji-os": "PCWeb",
    "x-moji-session-id": "r:84a341fd0d685a6955ad0994055e4305",
    "x-moji-token": "r:84a341fd0d685a6955ad0994055e4305",
}


def get(url):
    req = urllib.request.Request(url, headers=H)
    r = urllib.request.urlopen(req, timeout=30)
    d = r.read()
    if d[:2] == b"\x1f\x8b":
        d = gzip.decompress(d)
    return json.loads(d.decode("utf-8"))


def fetch_tag(tag):
    data = get(f"{BASE}/exam/list?tag={tag}")
    items = data.get("list", []) or []
    seen = set()
    out = []
    for it in items:
        iid = it.get("id") or it.get("_id")
        if not iid or iid in seen:
            continue
        seen.add(iid)
        out.append({"id": iid, "title": it.get("title"), "tag": it.get("tag")})
    return out


if __name__ == "__main__":
    tags = sys.argv[1:] or ["N2", "N3"]
    result = {}
    for tag in tags:
        print(f"拉取 {tag} 列表 ...")
        result[tag] = fetch_tag(tag)
        print(f"  {tag}: {len(result[tag])} 场")
    out = "exam_ids_by_tag.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n已保存到 {out}")
