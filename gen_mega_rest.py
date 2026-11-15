# -*- coding: utf-8 -*-
"""gen_mega_rest.py —— 生成剩余 MEGA 卷的抽取清单

2026-11-10 用户：「继续吧」。
已抽 18 卷（II/1.1-1.2、II/3.1-3.6、II/4.1-4.3、II/5、II/6、II/10、I/2、MEGA¹ I/5）。
本脚本扫 `G:\\path\\to\\workspace\\百度网盘\\MEGA-2\\`，把剩下的全部列出来。
"""
import json
import os
import re
from pathlib import Path

D = Path(r"G:\path\to\workspace\百度网盘\MEGA-2")
OUT = Path(r"G:\path\to\workspace\马理论输出\_ml\MEGA_rest.json")

# 已抽（卷号）
DONE = {
    ("II", "1.1"), ("II", "1.2"),
    ("II", "3.1"), ("II", "3.2"), ("II", "3.3"),
    ("II", "3.4"), ("II", "3.5"), ("II", "3.6"),
    ("II", "4.1"), ("II", "4.2"), ("II", "4.3"),
    ("II", "5"), ("II", "6"), ("II", "10"),
    ("I", "2"),
    ("I", "5"),     # MEGA¹ I/5 已抽
}

PAT = re.compile(r"MEGA\s*[²¹]?\s*([IV]+)\.(\d+(?:\.\d+)?)")


def main():
    rows = []
    for f in sorted(D.glob("*.pdf")):
        n = f.name
        m = PAT.search(n)
        if not m:
            continue
        part, vol = m.group(1), m.group(2)
        if (part, vol) in DONE:
            continue
        is_m1 = ("MEGA¹" in n) or ("MEGA1" in n) or ("¹" in n)
        tag = "MEGA1" if is_m1 else "MEGA2"
        ver = "MEGA¹" if is_m1 else "MEGA²"
        safe_vol = vol.replace(".", "-")
        out = f"{tag}-{part}-{safe_vol}.txt"
        # 简述内容：从文件名尾部取
        desc = re.sub(r"^MEGA\s*[²¹]?\s*[IV]+\.\d+(\.\d+)?\s*[-–.]?\s*", "", n)
        desc = desc.replace(".pdf", "").strip(" -–.")
        rows.append({
            "pdf": str(f),
            "out": out,
            "book": desc[:90] or n[:80],
            "vol": f"{ver} {part}/{vol}",
            "source": "本机百度网盘",
            "layer": "L0",
        })

    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"待抽 {len(rows)} 卷：")
    for x in rows:
        print(f"  {x['vol']:<14} {x['book'][:56]}")


if __name__ == "__main__":
    main()
