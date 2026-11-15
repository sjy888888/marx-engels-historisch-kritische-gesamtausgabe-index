# -*- coding: utf-8 -*-
"""briefe2txt.py —— MEGAdigital 书信 → 按年入库

2026-11-10：抓到 246 封书信、102.7 万字，年份 1865–1879。

价值定位：
  MEGA 的书信是**全收**（中文《全集》书信卷是选译）。
  这批能补中文版没译的那些短信、便条、第三方来信。

引用纪律（写进文件头）：
  · 书信 ≠ 著作。不能说「马克思在《资本论》里说」，要说「1868年X月X日致恩格斯的信」。
  · 大量是**别人写给马克思**的（Borkheim、Kugelmann 等），不是马克思本人写的。
  · 引用必须先看署名/收信人。
"""
import json
import re
import time
from collections import defaultdict
from pathlib import Path

SRC = Path(r"G:\path\to\workspace\马理论输出\_ml\megadigital-briefe-full.json")
DST = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著\MEGA-书信")


def main():
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    DST.mkdir(parents=True, exist_ok=True)
    byyear = defaultdict(list)
    for r in rows:
        byyear[r["year"]].append(r)

    total = 0
    for y, items in sorted(byyear.items()):
        parts = []
        for it in items:
            parts.append(f"\n{'─'*60}")
            parts.append(f"【{it['id']}】{it['title']}")
            parts.append(f"来源：{it['url']}")
            parts.append(f"{'─'*60}\n")
            parts.append(it["body"])
            parts.append("")
            total += it["chars"]
        out = DST / f"MEGA书信-{y}.txt"
        head = [
            "=" * 74,
            f"文献：MEGA 马克思恩格斯书信（{y} 年）",
            "出处：MEGAdigital（柏林-勃兰登堡科学院）",
            f"来源：https://megadigital.bbaw.de/briefe/index.xql?jahr={y}",
            f"处理日期：{time.strftime('%Y-%m-%d')}",
            f"书信数：{len(items)}",
            "",
            "★ 引用纪律（书信 ≠ 著作）：",
            "  ✔ 「1868年X月X日，马克思致恩格斯的信中说……」",
            "  ✘ 「马克思说……」——必须先看**署名与收信人**。",
            "  ⚠ 本卷含大量**他人写给马克思**的信（Borkheim、Kugelmann 等），",
            "    不是马克思本人的话。引用前确认写信人。",
            "★ 页码：转写文本无印刷页码，标【p?】，引用写「页码待核」。",
            "★ 语言：德文/英文原文，未译。中文引用须自行翻译并标注「据德文原文译」。",
            "=" * 74,
        ]
        out.write_text("\n".join(head) + "\n\n【p?】\n" + "\n".join(parts), encoding="utf-8")
        print(f"[ok] {out.name}  {len(items)} 封  {out.stat().st_size//1024} KB")

    print(f"\n合计 {len(rows)} 封 / {total:,} 字 / {len(byyear)} 年")
    print(f"目录：{DST}")


if __name__ == "__main__":
    main()
