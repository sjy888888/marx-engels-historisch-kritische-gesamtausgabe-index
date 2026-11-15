# -*- coding: utf-8 -*-
"""extract_letters.py —— 从书信卷正文提取书信条目

2026-11-12 起因（目标：优化马恩列选集）：
    《马恩全集2版-第50卷-书信1856-1859》72 万字，_toc 只有 3 个篇目，
    而且 3 个全是垃圾（'0 莱•博克.一编者注'、'第五十卷'）。

    查下来发现两种「致XX」行：
      目录页（1047 条）：'2. 恩格斯致马克思（2 月 7 日）........  6-9'
                        → 带省略号 + 页码，是目录
      正文里（239 条）：  '1856年1月18日于［伦敦j'
                        → 日期 + 地点，这才是书信开头

    所以：**用日期行做篇名**，不用「致XX」。

判据：
    ① 行形如「YYYY年M月D日于〔地点〕」或「YYYY年M月D日」
    ② 排除目录页行（带省略号 / 末尾页码）
    ③ 用页标记定位页码

用法：
    python extract_letters.py --book "第50卷" --dry
    python extract_letters.py --book "第50卷" --apply
"""
import argparse
import json
import re
import sys
from pathlib import Path

BASE = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著")
OUT = Path(r"G:\path\to\knowledge-base\索引")
MARK = re.compile(r"(?:【p(\d+)[※]?】)?\[PDFp(\d+)\]")

# 日期行：「1856年1月18日于［伦敦j」「1856年2月7日于曼彻斯特」
#   2026-11-12 修：原来只认行首。实测日期行前面还有「马克思致恩格斯」「曼彻斯特」两行，
#   而日期行本身确实在行首，但全文只有 455 行以「YYYY年」开头——
#   真正的篇名要「致XX + 日期」组合，单看日期不够。
DATE_LINE = re.compile(
    r"^[ \t]*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*[—\-－至]\s*\d{1,2}\s*日)?)(.*)$",
    re.M)
# 「致XX」行（正文里的，不是目录页）
ADDRESS = re.compile(r"^([\u4e00-\u9fff·•\.]{2,24}(?:致|给)[\u4e00-\u9fff·•\.《》〔〕]{2,28})(?:（.*）)?$")
# 目录页特征
TOC_TELL = re.compile(r"[·…\.]{2,}|[（(]\s*\d+\s*[)）]\s*$|\d+\s*[-—－]\s*\d+\s*$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", required=True, help="书名关键词")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    files = [f for f in BASE.glob("*.txt") if args.book in f.name]
    if not files:
        print(f"没找到含「{args.book}」的文件")
        return
    f = files[0]
    t = f.read_text(encoding="utf-8", errors="replace")
    marks = [(m.start(), m.group(1)) for m in MARK.finditer(t)]

    def page_at(pos):
        last = None
        for p, n in marks:
            if p > pos:
                break
            last = n
        return last

    items = []
    seen = set()
    skipped_toc = 0
    lines = t.split("\n")
    # 建行首偏移表
    offs = []
    acc = 0
    for ln in lines:
        offs.append(acc)
        acc += len(ln) + 1
    def line_idx(pos):
        import bisect
        return max(0, bisect.bisect_right(offs, pos) - 1)

    for m in DATE_LINE.finditer(t):
        line = m.group(0).strip()
        if TOC_TELL.search(line):
            skipped_toc += 1
            continue
        date, rest = m.group(1), m.group(2).strip()
        rest = re.sub(r"\s+", "", rest)[:14]
        # 往上回溯最多 4 行，找「XX致YY」
        addr = ""
        li = line_idx(m.start())
        for k in range(li - 1, max(-1, li - 5), -1):
            prev = lines[k].strip()
            if not prev:
                continue
            am = ADDRESS.match(prev)
            if am and not TOC_TELL.search(prev):
                addr = am.group(1)
                break
        name = ((addr + "　") if addr else "") + date + (("　" + rest) if rest else "")
        name = name.strip()
        p = page_at(m.start())
        if p is None:
            continue
        key = (name, p)
        if key in seen:
            continue
        seen.add(key)
        items.append({"name": name, "start": int(p), "end": int(p)})

    items.sort(key=lambda x: x["start"])
    print(f"文件：{f.name}")
    print(f"  提出书信条目 {len(items)} 条（跳过目录行 {skipped_toc} 条）")
    print("\n前 10 条：")
    for x in items[:10]:
        print(f"   p{x['start']:<5} {x['name'][:56]}")

    if args.dry or not args.apply:
        print("\n（未写入，加 --apply 才改）")
        return

    outp = OUT / f"书信条目-{args.book}.json"
    OUT.mkdir(parents=True, exist_ok=True)
    outp.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n已写 {outp}")


if __name__ == "__main__":
    main()
