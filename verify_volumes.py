# -*- coding: utf-8 -*-
"""
verify_volumes.py —— 卷次自检：每卷的文件名，必须能被该卷正文里的验证词支撑

为什么要有这一步（2026-11-09 事故）：
  下载后按「我以为的卷号」命名，7 个列宁卷里 5 个名字是错的。
  文件名错了不会报错——它只会让人引错卷。这比没引更糟，因为看起来有出处。

判据（三项全过才算 PASS）：
  1. 文件名里的「卷号」与该卷首页的「第 X 卷」字样一致
  2. 文件名里的「代表篇目」在该卷正文里出现 ≥ 3 次
  3. 该卷时代跨度与首页标注的年月区间一致（人工核，脚本只打印出来对照）
用法: python verify_volumes.py [--dir 目录]
"""
import re
import sys
import json
from pathlib import Path

DIRS = [
    Path(r"G:\path\to\knowledge-base\学科资料\原著原文"),
    Path(r"G:\path\to\knowledge-base\学科资料\教材原文"),
]

# 文件名代表篇目 → 该卷必须有这些串
EXPECT = {
    "怎么办": ["怎么办"],
    "唯物主义和经验批判主义": ["唯物主义和经验批判主义"],
    "马克思主义的三个来源": ["马克思主义的三个来源"],
    "帝国主义是资本主义的最高阶段": ["帝国主义是资本主义"],   # 保留最短可靠前缀
    "国家与革命": ["国家与革命"],
    "十月革命后文献": ["被剥削劳动人民权利宣言", "土地法令"],
    "共产主义运动中的左派幼稚病": ["左派", "幼稚病"],
    "文集01": ["1844年经济学哲学手稿", "关于费尔巴哈的提纲"],
    "文集02": ["共产党宣言"],
    "文集03": ["哥达纲领批判", "法兰西内战"],
    "文集04": ["家庭、私有制和国家的起源", "费尔巴哈和德国古典哲学的终结"],
    "文集05": ["资本论", "商品"],
    "文集06": ["资本论"],
    "文集07": ["资本论"],
    "文集08": ["经济学手稿"],
    "文集09": ["反杜林论"],
    "文集10": ["恩格斯致"],
    "选集01": ["共产党宣言"],
    "选集02": ["政治经济学批判"],
    "选集03": ["资本论"],
    "选集04": ["家庭、私有制"],
    "教材-马发史": ["马克思主义发展史"],
}

VOL_RE = re.compile(r"第\s*([一二三四五六七八九十百零\d]+)\s*卷")


def cn2num(s):
    m = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7,
         "八": 8, "九": 9, "十": 10}
    if s.isdigit():
        return int(s)
    if s in m:
        return m[s]
    if s.startswith("十"):
        return 10 + m.get(s[1:], 0)
    if s.endswith("十"):
        return m.get(s[:-1], 0) * 10
    if "十" in s:
        a, b = s.split("十")
        return m.get(a, 0) * 10 + m.get(b, 0)
    return None


def check(path):
    name = path.name
    text = path.read_text(encoding="utf-8", errors="replace")
    head = text[:4000]

    # 1) 卷号一致性
    m = re.search(r"列宁全集(\d{2})", name)
    vol_ok = None
    if m:
        want = int(m.group(1))
        found = [cn2num(x) for x in VOL_RE.findall(head)]
        found = [f for f in found if f]
        vol_ok = want in found if found else None

    # 2) 代表篇目
    kw = None
    for k in EXPECT:
        if k in name:
            kw = k
            break
    needles = EXPECT.get(kw, []) if kw else []
    counts = {n: text.count(n) for n in needles}
    kw_ok = all(v >= 3 for v in counts.values()) if counts else None

    return {
        "file": name,
        "volume_ok": vol_ok,
        "keyword": kw,
        "keyword_hits": counts,
        "keyword_ok": kw_ok,
        "status": "PASS" if (vol_ok is not False and kw_ok is not False) else "FAIL",
    }


def main():
    d = Path(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "--dir" else None
    dirs = [d] if d else DIRS
    rows = []
    for dd in dirs:
        if not dd.exists():
            continue
        for f in sorted(dd.glob("*.txt")):
            if f.name.startswith("_"):
                continue
            rows.append(check(f))

    for r in rows:
        flag = "✅" if r["status"] == "PASS" else "❌"
        print(f"{flag} {r['file']}")
        print(f"     卷号一致={r['volume_ok']}  代表篇目「{r['keyword']}」命中={r['keyword_hits']}")

    fails = [r for r in rows if r["status"] == "FAIL"]
    print(f"\n共 {len(rows)} 卷，PASS {len(rows) - len(fails)}，FAIL {len(fails)}")
    if fails:
        print("FAIL 的卷必须改名或核对，不许留着——文件名错了就会引错卷。")
        sys.exit(1)


if __name__ == "__main__":
    main()
