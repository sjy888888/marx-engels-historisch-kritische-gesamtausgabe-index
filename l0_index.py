# -*- coding: utf-8 -*-
"""l0_index.py —— L0 原著库总目

2026-11-11 起因（犬子「顺带优化一下原著库」）：
    查完发现原著库本身是健康的 ——
      根目录 62 本中文原著，3,810 万字，页码率 85–98%，篇目齐全
      MEGA 三个子目录 68 本德文，3,123 万字，有【条目】ID 和详情页链接
    真正缺的不是内容，是**导航**：62 本堆在一个目录里，
    查「异化劳动」时不知道去哪一本，全靠 quote.mjs 现场排。

这个工具做三件事：
    ① 产出总目：每本书多少字、页码率多少、多少篇目、篇目举例
    ② 按内容分组：资本论各版本 / 全集各卷 / 选集 / 文集 / 列宁 / 书信
    ③ 标出短板：无篇目的、页码率低的、无页码标记的

用法：
    python l0_index.py                 # 出总目
    python l0_index.py --markdown      # 写进 索引\\L0原著总目.md
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

BASE = Path(r"G:\path\to\knowledge-base\学科资料")
L0 = BASE / "L0-马恩列原著"
TOC = BASE / "_toc.json"
OUTDIR = Path(r"G:\path\to\knowledge-base\索引")

MARK_P = re.compile(r"【p\d+】")
MARK_Q = re.compile(r"【p\?[^\]]*】")
MARK_ANY = re.compile(r"\[PDFp\d+\]")

# 分组规则（按「子目录 + 文件名」判）
#   2026-11-11 修：原来只看文件名，把 MEGA官方文本/ 下 42 本无页码的
#   和根目录 MEGA2-III-6（94% 码率）混成一组，算出「MEGA 组 94%」——
#   实际 MEGA官方文本/ 那批是 0%。**平均值被一本好书抬高了。**
GROUPS = [
    ("MEGA官方文本（德·目录导论）", r"^MEGA官方文本/"),
    ("MEGA-MEGAdigital摘录", r"^MEGA-MEGAdigital摘录/"),
    ("MEGA-书信（德）", r"^MEGA-书信/"),
    ("资本论", r"资本论"),
    ("马克思恩格斯全集（中文2版）", r"马恩全集2版-第"),
    ("马克思恩格斯文集", r"文集\d"),
    ("马克思恩格斯选集", r"选集\d"),
    ("列宁", r"列宁"),
    ("MEGA 原文（根目录）", r"MEGA"),
    ("单篇与专题", r".*"),
]


def group_of(relpath):
    """按相对路径分组（含子目录前缀）。"""
    for lab, pat in GROUPS:
        if re.search(pat, relpath):
            return lab
    return "其他"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--markdown", action="store_true")
    args = ap.parse_args()

    toc = json.loads(TOC.read_text(encoding="utf-8")) if TOC.exists() else {}

    rows = []
    for f in L0.rglob("*.txt"):
        rel = f.relative_to(L0)
        if any(x.startswith("_") for x in rel.parts if x):
            continue
        t = f.read_text(encoding="utf-8", errors="replace")
        p_ok = len(MARK_P.findall(t))
        p_q = len(MARK_Q.findall(t))
        pages = len(MARK_ANY.findall(t))
        key = f"L0-马恩列原著/{rel.as_posix()}"
        entries = toc.get(key, [])
        rows.append({
            "sub": rel.parts[0] if len(rel.parts) > 1 else "",
            "name": f.name,
            "chars": len(t),
            "p_ok": p_ok,
            "p_q": p_q,
            "pages": pages,
            "ratio": p_ok / max(pages, 1),
            "toc": len(entries),
            "toc_head": entries[0]["name"][:32] if entries else "",
            "group": group_of(rel.as_posix()),
        })

    # 汇总
    g = defaultdict(list)
    for r in rows:
        g[r["group"]].append(r)

    print(f"L0 原著库：{len(rows)} 个文件，{sum(r['chars'] for r in rows):,} 字\n")
    print(f"{'组':<26}{'本':>4}{'万字':>8}{'平均码率':>9}{'无篇目':>7}")
    print("-" * 58)
    for lab, xs in sorted(g.items(), key=lambda kv: -sum(r["chars"] for r in kv[1])):
        ch = sum(r["chars"] for r in xs)
        ok = sum(r["p_ok"] for r in xs)
        pg = sum(r["pages"] for r in xs)
        no_toc = sum(1 for r in xs if r["toc"] == 0)
        print(f"{lab[:24]:<26}{len(xs):>4}{ch/10000:>8.0f}{ok/max(pg,1):>8.0%}{no_toc:>7}")

    # 短板
    print("\n=== 短板清单 ===")
    low = [r for r in rows if r["pages"] > 0 and r["ratio"] < 0.5]
    if low:
        print(f"页码率 <50% 的 {len(low)} 本：")
        for r in sorted(low, key=lambda x: -x["chars"])[:10]:
            print(f"   {r['ratio']:>4.0%}  {r['chars']/10000:>6.0f} 万字  {r['name'][:52]}")
    else:
        print("页码率全部 ≥50%")

    no_mark = [r for r in rows if r["pages"] == 0 and r["chars"] > 10000]
    if no_mark:
        print(f"\n完全没有页标记的 {len(no_mark)} 本：")
        for r in sorted(no_mark, key=lambda x: -x["chars"])[:10]:
            print(f"   {r['chars']/10000:>6.0f} 万字  {r['name'][:52]}")

    if not args.markdown:
        return

    # 写 markdown
    L = ["# L0 原著库总目", "",
         f"生成：l0_index.py　{len(rows)} 个文件　{sum(r['chars'] for r in rows):,} 字", "",
         "> 用途：查引用前先看这里，知道该去哪一本。",
         "> 页码率 = 有印刷页码的页 / 总页数。低于 50% 的书引用时要留神。", ""]
    for lab, xs in sorted(g.items(), key=lambda kv: -sum(r["chars"] for r in kv[1])):
        xs.sort(key=lambda r: -r["chars"])
        ch = sum(r["chars"] for r in xs)
        ok = sum(r["p_ok"] for r in xs)
        pg = sum(r["pages"] for r in xs)
        L.append(f"## {lab}　{len(xs)} 本 / {ch/10000:.0f} 万字 / 码率 {ok/max(pg,1):.0%}")
        L.append("")
        L.append("| 文件 | 万字 | 码率 | 篇目 | 首篇 |")
        L.append("|---|---:|---:|---:|---|")
        for r in xs:
            L.append(f"| {r['name'][:44]} | {r['chars']/10000:.0f} | "
                     f"{r['ratio']:.0%} | {r['toc']} | {r['toc_head'][:26]} |")
        L.append("")
    OUTDIR.mkdir(parents=True, exist_ok=True)
    p = OUTDIR / "L0原著总目.md"
    p.write_text("\n".join(L), encoding="utf-8")
    print(f"\n已写 {p}")


if __name__ == "__main__":
    main()
