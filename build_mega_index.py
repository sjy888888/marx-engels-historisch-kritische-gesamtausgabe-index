# -*- coding: utf-8 -*-
"""build_mega_index.py —— 从 MEGA 官方导论 PDF 抽「卷目索引」

2026-11-10 用户问 MEGA。虽然拿不到正文（De Gruyter 版权），
但**每卷的「目录与导论」（Inhaltsverzeichnis und Einführung）是官方免费给的**，
里面完整列出该卷收了哪些文献、起止页、编者说明。

用途（这是 MEGA 对论文真正有用的部分）：
  ① 查「某篇著作在 MEGA 哪一卷、第几页」——写论文注德文版出处必需
  ② 查「某卷收了什么」——文献综述的底子
  ③ 异文表（Variantenverzeichnisse）能查手稿改动

本脚本从已抓的 58 个文本里抽出：
  · 卷号（I/5、II/11、IV/32 …）
  · 该卷收录的文献清单（篇名 + 页码）
输出 _mega_volumes.json + 一份 Markdown 总表。
"""
import json
import re
from pathlib import Path

SRC = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著\MEGA官方文本")
OUT_JSON = Path(r"G:\path\to\knowledge-base\学科资料\_mega_volumes.json")
OUT_MD = Path(r"G:\path\to\knowledge-base\事实\2026-11-10-MEGA卷目索引.md")

# 卷号：从文件名或正文里认 I/5、II/11、IV/32 这种
VOL_RE = re.compile(r"\b(I{1,3}V?|IV)\s*/\s*(\d{1,2})\b")
# 目录条目：篇名 …… 页码 / 篇名, S. 123
ITEM_RE = re.compile(r"^(.{3,90}?)[\s.·…]{3,}\s*(\d{1,4})\s*$")
ITEM_RE2 = re.compile(r"^(.{3,90}?)\s*,\s*S\.\s*(\d{1,4})")


def find_vol(text, fname):
    """卷号识别：优先文件名，其次正文前 800 字。

    2026-11-10 修（第一版全错）：
      原来 `VOL_RE.search(fname)` 用的是 `\b(I{1,3}V?|IV)\s*/\s*(\d{1,2})\b`，
      但文件名是 `mega_IV-12_inhalt-einf`（用连字符不是斜杠），一个都匹配不上；
      于是全部退到正文里搜，而各卷导论前言里恰好都提到「MEGA I/5」，
      **58 个文件全被认成 I/5**。
    现在：文件名里的 `I-5`、`II-11`、`IV-32`（连字符/下划线）也认。
    """
    # ① 文件名里的 I-5 / II-11 / IV-32 / I_05
    m = re.search(r"(?:^|[_\-\s])(IV|III|II|I)[-_](\d{1,2})(?:[_\-\s]|$)", fname, re.I)
    if m:
        return f"{m.group(1).upper()}/{int(m.group(2))}"
    # ② 文件名里的 I/5 形式
    m = re.search(r"(IV|III|II|I)\s*/\s*(\d{1,2})", fname, re.I)
    if m:
        return f"{m.group(1).upper()}/{int(m.group(2))}"
    # ③ 正文第一处
    m = re.search(r"MEGA\s*(IV|III|II|I)\s*/\s*(\d{1,2})", text[:1500], re.I)
    return f"{m.group(1).upper()}/{int(m.group(2))}" if m else None



def extract_items_de(text):
    # 德文目录条目：篇名（可跨 2-3 行）+ 单独一行纯数字页码。
    # 2026-11-10 第二版。第一版用中文同行正则，德文目录 32 卷全部 0 条。
    import re as _re
    lines = [l.strip() for l in text.split(chr(10))]
    items, buf = [], []
    for s in lines:
        if not s:
            continue
        if _re.fullmatch(r'\d{1,4}', s):
            pg = int(s)
            if buf and 1 <= pg <= 2000:
                name = ' '.join(buf).strip()
                if 6 <= len(name) <= 200:
                    items.append({'name': name, 'page': pg})
                buf = []
            continue
        if len(s) < 3:
            continue
        buf.append(s)
        if len(buf) > 6:
            buf = buf[-3:]
    if not items:
        return []
    best, cur = [], [items[0]]
    for a, b in zip(items, items[1:]):
        if b['page'] >= a['page']:
            cur.append(b)
        else:
            if len(cur) > len(best):
                best = cur
            cur = [b]
    if len(cur) > len(best):
        best = cur
    return best if len(best) >= 5 else []


def extract_items(text):
    """抽目录条目（要求连续 ≥6 条，页码递增）"""
    lines = text.split("\n")
    best = []
    cur = []
    for ln in lines:
        s = ln.strip()
        m = ITEM_RE.match(s) or ITEM_RE2.match(s)
        if m:
            name = m.group(1).strip(" .·…,")
            pg = int(m.group(2))
            if 3 <= len(name) <= 90 and 1 <= pg <= 2000:
                cur.append({"name": name, "page": pg})
                continue
        if cur:
            if len(cur) >= 6:
                pgs = [x["page"] for x in cur]
                inc = sum(1 for a, b in zip(pgs, pgs[1:]) if b >= a)
                if inc >= len(pgs) * 0.7:
                    if len(cur) > len(best):
                        best = cur[:]
            cur = []
    if len(cur) >= 6 and len(cur) > len(best):
        best = cur
    return best


def main():
    result = {}
    for f in sorted(SRC.glob("*.txt")):
        text = f.read_text(encoding="utf-8", errors="replace")
        vol = find_vol(text, f.stem)
        if not vol:
            continue
        items = extract_items_de(text) or extract_items(text)
        result.setdefault(vol, {"files": [], "items": []})
        result[vol]["files"].append(f.stem)
        if items and len(items) > len(result[vol]["items"]):
            result[vol]["items"] = items
        print(f"{vol:<8} {f.stem[:44]:<46} {len(items):>3} 条")

    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")

    # Markdown 总表
    md = ["# MEGA 卷目索引（从官方导论 PDF 抽取）", "",
          "> 来源：柏林-勃兰登堡科学院 MEGA 官网免费公开的「Inhaltsverzeichnis und Einführung」。",
          "> **不是正文**（正文由 De Gruyter 出版，需购买/机构订阅）。",
          "> 用途：查某篇著作在 MEGA 哪一卷、哪一页；查某卷收了什么。", "",
          "| 卷 | 已抓文件 | 抽到条目 | 前几条 |", "|---|---:|---:|---|"]
    for vol in sorted(result):
        d = result[vol]
        head = "；".join(x["name"][:26] + f" S.{x['page']}" for x in d["items"][:3])
        md.append(f"| MEGA {vol} | {len(d['files'])} | {len(d['items'])} | {head} |")
    md.append("")
    md.append(f"共 {len(result)} 卷。原始 JSON：`{OUT_JSON}`")
    OUT_MD.write_text("\n".join(md), encoding="utf-8")
    print(f"\n{len(result)} 卷 / 写出 {OUT_JSON.name} 与 {OUT_MD.name}")


if __name__ == "__main__":
    main()
