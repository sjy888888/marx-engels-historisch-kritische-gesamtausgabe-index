# -*- coding: utf-8 -*-
"""mega_doi_probe.py —— 探测 MEGA² 各卷在 Crossref 有没有 DOI

2026-11-12 起因（犬子：「已安装的Cite插件或许能与索引什么的结合一下？」）：

    查下来发现 MEGA² 整卷在 Crossref 有记录：
      《德意志意识形态》→ 10.1524/9783050050096（2010）

    如果 33 卷大部分能查到 DOI，那么引用 MEGA² 就能：
      给 DOI（真实可查）+ 卷号 + 标题 + **页码留白让查纸本**
    比现在「只有卷号」强，也比编个页码安全。

    但如果覆盖率低（老卷 1975 年出的可能没 DOI），这件事就不值得做。
    **所以先探，再决定。**——这一步不能跳。

勘误记录：
    一开始我用 cite_lookup 查，它返回元数据但**不暴露 DOI 字段**，
    试了两个猜的 DOI（10.1515/9783050063456 / 10.1524/9783050086837）全是假的。
    **猜 DOI 是绝对不能做的事**——假 DOI 比没有更坏。
    改走 Crossref REST API 直接取，能拿到真值。

用法：
    python mega_doi_probe.py            # 探测全部 33 卷
    python mega_doi_probe.py --save     # 结果存 json
"""
import argparse
import json
import sys
import io
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

OUTDIR = Path(r"G:\path\to\knowledge-base\索引")
API = "https://api.crossref.org/works"

# MEGA² 各 Abteilung 的官方名称
ABT_NAME = {
    "I": "Erste Abteilung",
    "II": "Zweite Abteilung",
    "III": "Dritte Abteilung",
    "IV": "Vierte Abteilung",
}

# 各部的检索词（用官方德文表述，命中率最高）
ABT_QUERY = {
    "I": 'Werke Artikel Entwürfe',
    "II": '"Das Kapital" und Vorarbeiten',
    "III": 'Briefwechsel',
    "IV": 'Exzerpte Notizen Marginalien',
}


def probe(vol):
    """探一卷。返回 dict。"""
    abt, num = vol.split("/")
    abt = abt.upper()
    # 三种检索式，从精确到宽泛
    queries = [
        f'Karl Marx Friedrich Engels Gesamtausgabe MEGA {ABT_NAME[abt]} Band {num}',
        f'MEGA {ABT_NAME[abt]} Band {num} {ABT_QUERY[abt]}',
        f'Marx-Engels-Gesamtausgabe Band {num}',
    ]
    best = None
    for q in queries:
        params = urllib.parse.urlencode({
            "query.bibliographic": q,
            "rows": 5,
            "select": "DOI,title,container-title,published,publisher",
        })
        try:
            req = urllib.request.Request(
                f"{API}?{params}",
                headers={"User-Agent": "dsh-kb/1.0 (mailto:noreply@example.com)"})
            with urllib.request.urlopen(req, timeout=25) as fh:
                data = json.loads(fh.read().decode("utf-8"))
        except Exception as e:
            return {"vol": vol, "doi": None, "title": "", "year": None,
                    "err": str(e)[:60]}
        items = data.get("message", {}).get("items", [])
        for it in items:
            title = " ".join(it.get("title") or [])[:120]
            cont = " ".join(it.get("container-title") or [])[:120]
            blob = (title + " " + cont).lower()
            # 判据：标题或丛书名里必须同时出现 MEGA 特征 + 本卷号
            has_mega = ("gesamtausgabe" in blob or "mega" in blob)
            has_vol = (f"band {num}" in blob) or (f"band{num}" in blob)
            if has_mega and has_vol:
                yr = None
                pub = it.get("published", {}).get("date-parts") or [[]]
                if pub and pub[0]:
                    yr = pub[0][0]
                best = {
                    "vol": vol,
                    "doi": it.get("DOI"),
                    "title": title,
                    "container": cont,
                    "year": yr,
                    "publisher": (it.get("publisher") or "")[:50],
                    "err": "",
                }
                break
        if best:
            break
        time.sleep(0.4)
    return best or {"vol": vol, "doi": None, "title": "", "year": None, "err": "未命中"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", action="store_true")
    args = ap.parse_args()

    vols = ["I/05", "I/07", "I/14", "I/16", "I/21", "I/30", "I/31", "I/32",
            "I/4", "I/5", "I/8", "I/9",
            "II/11", "II/12", "II/13", "II/14", "II/15", "II/43",
            "III/9", "III/10", "III/11", "III/12", "III/13", "III/30",
            "IV/3", "IV/5", "IV/10", "IV/12", "IV/14", "IV/18", "IV/26",
            "IV/31", "IV/32"]

    rows = []
    hit = 0
    for v in vols:
        r = probe(v)
        rows.append(r)
        mark = "✅" if r.get("doi") else "❌"
        if r.get("doi"):
            hit += 1
        print(f"{mark} {v:<8} {r.get('doi') or '—':<34} "
              f"{str(r.get('year') or '—'):<6} {r.get('title','')[:52]}")
        time.sleep(0.5)

    print(f"\n覆盖率 {hit}/{len(vols)} = {hit/len(vols):.0%}")
    if args.save:
        OUTDIR.mkdir(parents=True, exist_ok=True)
        p = OUTDIR / "MEGA2-DOI.json"
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"已写 {p}")


if __name__ == "__main__":
    main()
