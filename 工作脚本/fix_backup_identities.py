# -*- coding: utf-8 -*-
"""Fix mojidict identity suffix drift in backup json.
For WRITTEN questions (questionNumber is int), the identity's trailing
`*NN` must equal questionNumber. Where it drifted, correct the suffix.
Listening questions legitimately have questionNumber=None -> skipped.
Collision-guarded: never create a duplicate identity.
"""
import json, re, glob, os, collections

BACKUP = "C:/Users/L/WorkBuddy/JLPT真题保存/jlpt真题备份"

changes = []
skipped = []

# global identity usage to guard collisions
global_idents = collections.Counter()
for f in glob.glob(os.path.join(BACKUP, "N[123]_*.json")):
    d = json.load(open(f, encoding="utf-8"))
    for s in d.get("sections", []):
        for q in s.get("questions", []):
            if q.get("identity"):
                global_idents[q["identity"]] += 1

for f in sorted(glob.glob(os.path.join(BACKUP, "N[123]_*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    changed = False
    file_idents = set()
    for s in d.get("sections", []):
        for q in s.get("questions", []):
            ident = q.get("identity")
            qn = q.get("questionNumber")
            if not ident or not isinstance(qn, int):
                continue  # skip listening (qn None) / missing
            suf = ident.rsplit("*", 1)[-1]
            numpart = re.sub(r"[^0-9]", "", suf)
            if numpart.isdigit() and int(numpart) != qn:
                prefix = ident.rsplit("*", 1)[0]
                newid = f"{prefix}*{qn:02d}"
                if newid in file_idents or global_idents.get(newid, 0) > (1 if ident == newid else 0):
                    skipped.append((os.path.basename(f), ident, newid))
                    continue
                # apply
                if q.get("identity") in global_idents:
                    global_idents[q["identity"]] -= 1
                q["identity"] = newid
                global_idents[newid] = global_idents.get(newid, 0) + 1
                file_idents.add(newid)
                changes.append((os.path.basename(f), ident, newid, qn))
                changed = True
    if changed:
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"修正 identity: {len(changes)} 条")
for c in changes:
    print(f"  {c[0]}: {c[1]} -> {c[2]}  (qn={c[3]})")
print(f"跳过(会冲突): {len(skipped)} 条")
for s in skipped:
    print(f"  SKIP {s[0]}: {s[1]} -> {s[2]}")
