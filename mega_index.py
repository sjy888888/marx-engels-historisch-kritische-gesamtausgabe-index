# -*- coding: utf-8 -*-
"""mega_index.py —— MEGA² 参照索引

2026-11-12 起因（犬子：「mega2也算马恩，要不要做个索引什么的？」→「主要是为了参照」）：

    库里 MEGA² 三块共 68 个文件、3,123 万字：
        MEGA官方文本/          58 个  目录与导论 + 正文节选
        MEGA-书信/              9 个  1865–1875 年书信
        MEGA-MEGAdigital摘录/   1 个  1,295 万字读书摘录（43 个条目）

    **用途是参照，不是引用** —— 这批文件没有印刷页码（MEGA 前置部分用罗马数字），
    文件头自己写明了「标的是 PDF 页序，不是印刷页码」。

    所以索引要做的是：**让你知道去哪一卷找什么**，不是给页码。

产出三份：
    ① 索引\\MEGA2参照索引.md      人读的：卷号 → 收了什么 → 多少字 → 在哪
    ② 索引\\MEGA2参照索引.json    机器用
    ③ 产出\\MEGA2参照索引.html    可查的网页

判据都不靠猜：
    卷号从文件名提（mega_I-05 / mega_II-14 / mega_III-9 / mega_IV-32）
    「内容性质」从文件头读（文件头自己写的）
    页数从文件头的「来源文件：xxx.pdf（N 页）」读
"""
import json
import re
import sys
import io
from collections import defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = Path(r"G:\path\to\knowledge-base\学科资料\L0-马恩列原著")
OUTDIR = Path(r"G:\path\to\knowledge-base\索引")
PROD = Path(r"G:\path\to\knowledge-base\产出")

# MEGA² 四个 Abteilung 的内容
ABT = {
    "I": ("第 I 部", "著作、文章、草稿（Werke, Artikel, Entwürfe）"),
    "II": ("第 II 部", "《资本论》及其手稿（Das Kapital und Vorarbeiten）"),
    "III": ("第 III 部", "书信（Briefwechsel）"),
    "IV": ("第 IV 部", "摘录、笔记、边注（Exzerpte, Notizen, Marginalien）"),
}

VOL_PAT = re.compile(r"(?:mega|MEGA|MEGA_I-9|Inh_Einf_MEGA|Einfuehrung|I_32|IV-?5|IV3|i21|Feuerb)"
                     r"[_ -]*([IV]+)[-_ ]?(\d+)", re.I)


def vol_of(stem):
    """判定卷号。

    2026-11-12 修：原来只靠一条正则，25 个文件归到「未标卷号」。
    查下来发现那 25 个分两类，**混在一起归成「卷」是分类错误**：

      ① MEJB_*（14 个，约 1000 万字）—— MEGA-Jahrbuch，**MEGA 年鉴**，
         按年出版的研究文集，不属于任何一卷。单列一类。
      ② 其余 11 个 —— 文件名里其实带卷号线索，只是格式五花八门：
         Feuerb_1845_IV_3 → IV/3    Feuerb_1888_I_30 → I/30
         i21_einfuehrung  → I/21    I_32_inhalt_einf → I/32
         Inh_Einf_Band_I_8 → I/8    IV3_Seiten → IV/3
         IV-5_Exzerpte... → IV/5    Inhaltsverzeichnis_IV-10 → IV/10
         edri → 资料（作者名缩写，卷号不明）  Prospekt_MEGA_2022_1 → 出版说明
    """
    n = stem
    if n.upper().startswith("MEJB"):
        return "年鉴"
    if n.startswith("Prospekt"):
        return "出版说明"
    if n.startswith("edri"):
        return "资料"
    if n.startswith("i21"):
        return "I/21"
    if n.startswith("I_32"):
        return "I/32"
    if "Band_I_8" in n:
        return "I/8"
    if n.startswith("Inhaltsverzeichnis_IV-10"):
        return "IV/10"
    if n.startswith("IV3"):
        return "IV/3"
    if n.startswith("IV-5"):
        return "IV/5"
    m = re.search(r"(?:^|_)(I{1,3}V?|IV)[-_ ]?(\d+)(?:_|$)", n, re.I)
    if m:
        return f"{m.group(1).upper()}/{m.group(2)}"
    m = VOL_PAT.search(n)
    if m:
        return f"{m.group(1).upper()}/{m.group(2)}"
    return "未标卷号"


def head_field(txt, key, default=""):
    m = re.search(rf"{re.escape(key)}[：:]\s*(.+)", txt[:2000])
    return m.group(1).strip() if m else default


def main():
    rows = []
    for sub in ["MEGA官方文本", "MEGA-书信", "MEGA-MEGAdigital摘录"]:
        d = BASE / sub
        if not d.exists():
            continue
        for f in sorted(d.glob("*.txt")):
            t = f.read_text(encoding="utf-8", errors="replace")
            head = t[:2000]
            # 2026-11-12 二次修：另两个子目录**本来就不按卷组织**，
            #   打「未标卷号」是错的。
            #     MEGA-书信/          按年份分（1865–1875），MEGA III 部的书信
            #     MEGA-MEGAdigital摘录/ 按条目分（43 个条目），MEGA IV 部的摘录
            if sub == "MEGA-书信":
                yr = re.search(r"(\d{4})", f.stem)
                vol = f"书信·{yr.group(1)}" if yr else "书信"
            elif sub == "MEGA-MEGAdigital摘录":
                vol = "摘录·IV/19"
            else:
                vol = vol_of(f.stem)
            nat = head_field(t, "★ 内容性质") or head_field(t, "内容性质") or "—"
            src = head_field(t, "来源文件")
            pm = re.search(r"（(\d+)\s*页）", src)
            pages = int(pm.group(1)) if pm else None
            rows.append({
                "vol": vol,
                "file": f.name,
                "sub": sub,
                "chars": len(t),
                "nature": nat[:60],
                "src": src[:80],
                "pages": pages,
                "url": head_field(t, "来源 URL")[:90],
            })

    rows.sort(key=lambda r: (r["vol"] == "未标卷号", r["vol"], -r["chars"]))

    # 按卷号归组
    by_vol = defaultdict(list)
    for r in rows:
        by_vol[r["vol"]].append(r)

    total_chars = sum(r["chars"] for r in rows)
    print(f"MEGA² 参照库：{len(rows)} 个文件 / {len(by_vol)} 个卷号 / {total_chars:,} 字\n")

    # ① markdown
    L = ["# MEGA² 参照索引", "",
         f"生成：mega_index.py　{len(rows)} 个文件 / {len(by_vol)} 个卷号 / {total_chars:,} 字", "",
         "> **用途是参照，不是引用。**",
         "> 这批文件没有印刷页码（MEGA 前置部分用罗马数字），",
         "> 文件头自己写明「标的是 PDF 页序，不是印刷页码」。",
         "> 要引 MEGA²，必须另找纸本核 S.×××。", "",
         "## MEGA² 四个部分", "",
         "| 部分 | 内容 | 本库有几卷 |", "|---|---|---:|"]

    for k, (lab, desc) in ABT.items():
        n = len([v for v in by_vol if v.startswith(k + "/")])
        L.append(f"| {lab} | {desc} | {n} |")
    L.append("")

    for vol in sorted(by_vol, key=lambda v: (v == "未标卷号", v)):
        xs = by_vol[vol]
        ch = sum(r["chars"] for r in xs)
        L.append(f"## {vol}　{len(xs)} 个文件 / {ch/10000:.0f} 万字")
        L.append("")
        L.append("| 文件 | 万字 | 页数 | 内容性质 |")
        L.append("|---|---:|---:|---|")
        for r in xs:
            L.append(f"| {r['file'][:46]} | {r['chars']/10000:.0f} | "
                     f"{r['pages'] if r['pages'] else '—'} | {r['nature'][:44]} |")
        L.append("")

    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / "MEGA2参照索引.md").write_text("\n".join(L), encoding="utf-8")
    (OUTDIR / "MEGA2参照索引.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已写 索引\\MEGA2参照索引.md / .json")

    # ② HTML
    trs = []
    for vol in sorted(by_vol, key=lambda v: (v == "未标卷号", v)):
        xs = by_vol[vol]
        ch = sum(r["chars"] for r in xs)
        ab = vol.split("/")[0] if "/" in vol else ""
        lab = ABT.get(ab, ("", ""))[0] if ab else ""
        trs.append(f'<tr class="vol"><td colspan="4">{vol}　<span class="abt">{lab}</span>'
                   f'　<span class="cnt">{len(xs)} 文件 / {ch/10000:.0f} 万字</span></td></tr>')
        for r in xs:
            trs.append(f'<tr><td class="fn">{r["file"][:48]}</td>'
                       f'<td class="n">{r["chars"]/10000:.0f}</td>'
                       f'<td class="n">{r["pages"] or "—"}</td>'
                       f'<td class="nat">{r["nature"][:48]}</td></tr>')

    abt_rows = "".join(
        f'<tr><td class="k">{lab}</td><td>{desc}</td>'
        f'<td class="n">{len([v for v in by_vol if v.startswith(k+"/")])}</td></tr>'
        for k, (lab, desc) in ABT.items())

    html = f'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>MEGA² 参照索引</title><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#16161a;color:#e8e6e1;font:14px/1.65 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:32px 26px 40px}}
.wrap{{max-width:1080px;margin:0 auto}}
h1{{font-size:23px;font-weight:600}}
.sub{{color:#9a968c;font-size:13px;margin:6px 0 18px}}
.warn{{background:#2a1f1f;border:1px solid #5a3a3a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#d8b0b0;line-height:1.75}}
.warn b{{color:#e8b64c}}
.kpi{{display:flex;gap:22px;margin-bottom:18px;flex-wrap:wrap}}
.kpi div{{background:#1e1e23;border:1px solid #33333a;border-radius:8px;padding:10px 16px;min-width:104px}}
.kpi b{{display:block;font-size:21px;color:#e8b64c;font-weight:600}}
.kpi span{{font-size:12px;color:#9a968c}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{text-align:left;padding:8px 10px;border-bottom:1px solid #33333a;color:#9a968c;font-weight:500;font-size:12px}}
td{{padding:6px 10px;border-bottom:1px solid #232329;vertical-align:top}}
tr.vol td{{background:#1e1e23;color:#a888d8;font-weight:600;padding:8px 10px}}
tr.vol .abt{{color:#6a6a72;font-weight:400;font-size:11.5px;margin-left:8px}}
tr.vol .cnt{{color:#6a6a72;font-weight:400;font-size:11.5px;float:right}}
td.fn{{color:#c8c4bc}}
td.n{{width:66px;color:#6fbf9a;font-family:ui-monospace,Consolas,monospace;text-align:right}}
td.nat{{color:#8a8a94;font-size:12px}}
td.k{{color:#e8b64c;width:90px}}
.scroll{{max-height:66vh;overflow-y:auto;border:1px solid #33333a;border-radius:8px;margin-top:16px}}
.abt-tbl{{border:1px solid #33333a;border-radius:8px;margin-bottom:8px}}
</style></head><body><div class="wrap">
<h1>MEGA² 参照索引</h1>
<div class="sub">Marx-Engels-Gesamtausgabe　柏林-勃兰登堡科学院官方免费件</div>
<div class="warn">
<b>用途是参照，不是引用。</b> 这批文件没有印刷页码——MEGA 前置部分用罗马数字编号，
文件头自己写明「标的是 PDF 页序，不是印刷页码」。<br>
要引 MEGA²，必须另找纸本核 <b>S.×××</b>。本索引只回答「去哪一卷找什么」。
</div>
<div class="kpi">
  <div><b>{len(rows)}</b><span>文件</span></div>
  <div><b>{len(by_vol)}</b><span>卷号</span></div>
  <div><b>{total_chars/10000:.0f}万</b><span>字数</span></div>
</div>
<table class="abt-tbl">
<tr><th>部分</th><th>内容</th><th>本库卷数</th></tr>
{abt_rows}
</table>
<div class="scroll"><table>
<tr><th>文件</th><th>万字</th><th>页数</th><th>内容性质</th></tr>
{"".join(trs)}
</table></div>
</div></body></html>'''
    PROD.mkdir(parents=True, exist_ok=True)
    (PROD / "2026-11-12-MEGA2参照索引.html").write_text(html, encoding="utf-8")
    print(f"已写 产出\\2026-11-12-MEGA2参照索引.html")


if __name__ == "__main__":
    main()
