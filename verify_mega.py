# -*- coding: utf-8 -*-
"""verify_mega.py —— 确认这批 PDF 是不是真的 MEGA

2026-11-10 用户：「先确定一下这是不是 mega」。

不能只看文件名。判据要看**内容特征**：
  ① 扉页是否有 MEGA 标准封面格式（KARL MARX FRIEDRICH ENGELS GESAMTAUSGABE）
  ② 版权页是否有 De Gruyter / Dietz / Akademie Verlag
  ③ 正文是否有 Text / Apparat 两套页码体系（MEGA 的标志）
  ④ 是否有 MEGA 卷标（如 "MEGA II/5"）
  ⑤ 页数是否与官方公布一致
"""
import re
import sys
from pathlib import Path

import pymupdf

D = Path(r"G:\path\to\workspace\百度网盘\MEGA-2")

# 待验证的核心卷（文件名关键词 → 官方页数参考）
CHECK = [
    ("II.5 - Karl Marx - Das Kapital", "II/5（1867 初版《资本论》第一卷）", 660),
    ("II.6 - Karl Marx - Das Kapital", "II/6（1872 第二版）", 734),
    ("II.10 - Karl Marx - Das Kapital", "II/10（1890 第四版）", 704),
    ("II.13 - Karl Marx", "II/13（《资本论》第二卷 1885 恩格斯编）", 494),
    ("II.15 - Karl Marx", "II/15（《资本论》第三卷 1894 恩格斯编）", 861),
    ("II.1.1. Karl Marx", "II/1.1（《大纲》上）", 314),
    ("Die Deutsche Ideologie", "MEGA¹ I/5（德意志意识形态）", 714),
]


def probe(pdf):
    doc = pymupdf.open(pdf)
    n = doc.page_count
    out = {"pages": n, "cover": "", "copyright": "", "apparat": 0, "mega_tag": 0, "text_marker": 0}

    # ① 前 6 页找封面标识
    head = ""
    for i in range(min(6, n)):
        head += doc.load_page(i).get_text("text")
    if re.search(r"GESAMTAUSGABE", head, re.I):
        out["cover"] = "GESAMTAUSGABE ✓"
    elif re.search(r"MARX.{0,20}ENGELS", head, re.I):
        out["cover"] = "MARX/ENGELS（未见 GESAMTAUSGABE）"

    # ② 版权页
    if re.search(r"De Gruyter", head):
        out["copyright"] = "De Gruyter"
    elif re.search(r"Dietz", head):
        out["copyright"] = "Dietz Verlag"
    elif re.search(r"Akademie", head):
        out["copyright"] = "Akademie Verlag"

    # ③④ 全书中抽样 40 页，统计 Apparat 与 MEGA 卷标出现次数
    step = max(1, n // 40)
    for i in range(0, n, step):
        t = doc.load_page(i).get_text("text")
        if re.search(r"\bApparat\b", t):
            out["apparat"] += 1
        if re.search(r"MEGA\s*(I{1,3}V?|IV)?\s*[\d./]+", t):
            out["mega_tag"] += 1
        if re.search(r"^\s*Text\s*$", t, re.M):
            out["text_marker"] += 1

    doc.close()
    return out


def main():
    print(f"{'书名':<40} {'页数':>5} {'官方':>5} {'封面':<22} {'版权':<14} {'Apparat':>7} {'卷标':>5}")
    print("-" * 118)
    verdicts = []
    for key, label, official in CHECK:
        hits = list(D.glob(f"*{key}*.pdf"))
        if not hits:
            print(f"{label[:38]:<40} {'缺':>5}")
            continue
        r = probe(hits[0])
        dpage = r["pages"] - official
        print(f"{label[:38]:<40} {r['pages']:>5} {official:>5} {r['cover'][:20]:<22} "
              f"{r['copyright'][:12]:<14} {r['apparat']:>7} {r['mega_tag']:>5}")
        # 判定
        score = 0
        if "GESAMTAUSGABE" in r["cover"]:
            score += 1
        if r["copyright"]:
            score += 1
        if r["mega_tag"] > 0:
            score += 1
        if abs(dpage) <= 30:
            score += 1
        verdicts.append((label, score, dpage))

    print("\n=== 判定（4 项：封面 / 版权 / MEGA卷标 / 页数吻合）===")
    for label, score, dpage in verdicts:
        mark = "✅ 是 MEGA" if score >= 3 else ("⚠ 存疑" if score == 2 else "❌ 可疑")
        print(f"  {label[:44]:<46} {score}/4 页差{dpage:+d}  {mark}")


if __name__ == "__main__":
    main()
