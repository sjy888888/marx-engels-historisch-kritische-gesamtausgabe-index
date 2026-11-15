# -*- coding: utf-8 -*-
"""mega2txt.py —— 把 MEGA 官方 PDF 批量转成可检索文本

2026-11-10 情况：
  已扒到 58 个 MEGA 官方 PDF、6474 页。
  两类性质完全不同，必须分开处理：

  ① **目录与导论**（Inhaltsverzeichnis und Einführung，约 40 个）
     价值：每卷收了哪些文章、起止页、编者说明。**目录本身就是页码来源**。
     处理：抽文本，标【pPDF】页码（这是 PDF 页序，不是印刷页——目录里另有印刷页号）。

  ② **Marx-Engels-Jahrbuch 年鉴 2003–2019/20**（14 卷，3772 页）
     价值：**有全文的研究年刊**（新文献、考据、讨论）。
     处理：抽文本，标【pPDF】。

  ③ **正文节选**（Feuerbach 提纲 1845/1888 等）
     价值：直接可引。
     处理：同上。

页码纪律：
  这批 PDF 的**印刷页码与 PDF 页序不同**（每卷都有前言/目录的罗马数字页）。
  本脚本只标 PDF 页序 `【pPDF</antml>N】`，**不冒充印刷页码**。
  引用时写「MEGA I/5, S.××（按卷内印刷页码，需查目录确认）」。

用法:
  python mega2txt.py [--layer L0]
"""
import argparse
import re
import sys
import time
from pathlib import Path

import pymupdf

SRC = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著\_MEGA官方PDF")
DST = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著\MEGA官方文本")


def clean(t):
    lines, blank = [], 0
    for ln in t.replace("\r", "").split("\n"):
        ln = ln.rstrip()
        if not ln.strip():
            blank += 1
            if blank > 1:
                continue
        else:
            blank = 0
        lines.append(ln)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=0)
    args = ap.parse_args()

    DST.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(SRC.glob("*.pdf"))
    if args.end:
        pdfs = pdfs[args.start:args.end]

    ok, skip = 0, 0
    for f in pdfs:
        out = DST / (f.stem + ".txt")
        if out.exists() and out.stat().st_size > 50000:
            skip += 1
            continue
        try:
            doc = pymupdf.open(f)
            parts = []
            for i in range(doc.page_count):
                t = doc.load_page(i).get_text("text")
                parts.append(f"【pPDF{i+1}】")
                parts.extend(clean(t))
                parts.append("")
            body = "\n".join(parts)
            head = [
                "=" * 74,
                f"文献：{f.stem}",
                "出处：Marx-Engels-Gesamtausgabe (MEGA) 柏林-勃兰登堡科学院官方免费件",
                f"来源文件：{f.name}（{doc.page_count} 页）",
                f"来源 URL：https://mega.bbaw.de/fileadmin/Webdateien/Dateien/{f.name}",
                f"处理日期：{time.strftime('%Y-%m-%d')}",
                "★ 页码纪律：本文件标的是【pPDF N】= **PDF 页序**，不是印刷页码。",
                "  MEGA 各卷印刷页码与 PDF 页序不同（前置部分用罗马数字）。",
                "  引用规范：MEGA² I/5, S.××× ——印刷页码须查该卷目录确认，不得拿 pPDF 冒充。",
                "★ 内容性质：" + (
                    "目录与导论（Inhaltsverzeichnis/Einführung）——查某卷收了什么用" if "inhalt" in f.stem.lower() or "einf" in f.stem.lower()
                    else ("Marx-Engels-Jahrbuch 年鉴全文" if "mejb" in f.stem.lower()
                          else "正文节选/样例页")
                ),
                "=" * 74,
            ]
            out.write_text("\n".join(head) + "\n\n" + body + "\n", encoding="utf-8")
            ok += 1
            print(f"[ok] {f.stem[:46]:<48} {doc.page_count:>4}页 {len(body):>8}字", flush=True)
        except Exception as e:
            print(f"[FAIL] {f.name}  {str(e)[:50]}", flush=True)
    print(f"\n转换 {ok}｜跳过 {skip}｜目录 {DST}")


if __name__ == "__main__":
    main()
