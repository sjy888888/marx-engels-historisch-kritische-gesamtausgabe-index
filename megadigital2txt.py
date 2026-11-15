# -*- coding: utf-8 -*-
"""megadigital2txt.py —— MEGAdigital 详情页正文 → 入库文本

2026-11-10 现状：
  已抓 43 个 detail 条目，合计 1293 万字（德文/英文原文转写）。
  内容性质：马克思、恩格斯的**摘录本/笔记**（Exzerpte, Notizen, Zeitungsausschnitte），
  属 MEGA 第 IV 部分。这是**首次公开**的材料，很多在别处没有。

价值定位（必须写清，否则引用会越位）：
  · 这是**读书摘录与笔记**，不是马克思的成熟著作
  · 引用时不能说「马克思在《资本论》里说」，要说「马克思 1868 年笔记中摘录」
  · 大量是转抄别人的话（Economist、Money Market Review 等），前面常带出处
  · **对 844 考试的直接用处有限**，但对理解马克思怎么读书、怎么积累材料很有用

页码纪律：
  详情页给的是**转写文本**，没有印刷页码。标【p?】。
  MEGA IV/19 之类的卷号可以标，但具体页码要查纸本。

用法:
  python megadigital2txt.py
"""
import json
import re
import time
from pathlib import Path

SRC = Path(r"G:\path\to\workspace\马理论输出\_ml\megadigital-details-full.json")
DST = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著\MEGA-MEGAdigital摘录")


def main():
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    DST.mkdir(parents=True, exist_ok=True)

    # 按卷聚合（43 条 → 5 卷）
    byvol = {}
    for r in rows:
        byvol.setdefault(r["vol"], []).append(r)

    total = 0
    for vol, items in sorted(byvol.items()):
        parts = []
        for it in items:
            parts.append(f"\n{'─'*60}")
            parts.append(f"【条目 {it['id']}】{it['title'][:80]}")
            parts.append(f"来源：https://megadigital.bbaw.de/exzerpte/detail.xql?id={it['id']}")
            parts.append(f"{'─'*60}\n")
            parts.append(it["body"])
            parts.append("")
            total += it["chars"]
        slug = vol.replace("/", "-")
        out = DST / f"MEGA摘录-{slug}.txt"
        head = [
            "=" * 74,
            f"文献：MEGA IV 部分摘录本（{vol}）",
            "出处：MEGAdigital（柏林-勃兰登堡科学院 MEGA 数字化平台）",
            f"来源：https://megadigital.bbaw.de/exzerpte/index.xql?volume={vol}",
            f"处理日期：{time.strftime('%Y-%m-%d')}",
            f"条目数：{len(items)}",
            "",
            "★ 内容性质：这是马克思/恩格斯的**读书摘录与笔记**，不是成熟著作。",
            "  引用纪律：",
            "    ✔ 「马克思在 1868 年笔记中摘录《经济学家》道……」",
            "    ✘ 「马克思说……」——摘录里大量是转抄别人的话，不是他的论断。",
            "★ 页码：转写文本无印刷页码，标【p?】，引用写「页码待核」。",
            "=" * 74,
        ]
        body = "\n".join(head) + "\n\n【p?】\n" + "\n".join(parts)
        out.write_text(body, encoding="utf-8")
        print(f"[ok] {out.name}  {len(items)} 条  {len(body):,} 字")

    print(f"\n合计 {len(rows)} 条 / {total:,} 字 / {len(byvol)} 卷")
    print(f"目录：{DST}")


if __name__ == "__main__":
    main()
