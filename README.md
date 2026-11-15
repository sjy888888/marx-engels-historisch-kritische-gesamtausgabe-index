# 马克思恩格斯历史考证版 卷目索引

**Marx-Engels-Gesamtausgabe (MEGA) 卷目索引与抓取工具。**

查「某篇著作在马克思恩格斯历史考证版哪一卷、第几页」。

## 这个仓解决什么

做马恩文本研究，绕不开马克思恩格斯历史考证版。但真实困难不是「拿不到正文」，是三件事：

1. **某一篇著作收在哪一卷？** 《德意志意识形态》的某段手稿在 I/5 还是 IV/3？
2. **这一卷收了什么？** 做文献综述要知道一卷的完整篇目。
3. **异文表在哪？** 手稿改动记录在哪个分卷？

**这三件事，官方都是免费给的。**

每卷的「目录与导论」（Inhaltsverzeichnis und Einführung）公开可下，里面完整列出该卷收了哪些文献、起止页、编者说明。异文表（Variantenverzeichnisse）与勘误也在公开范围。

这批工具就是去把这部分拿下来，做成可检索的索引。

## 版权边界（先看这条）

| 内容 | 能不能用 |
|---|---|
| 各卷目录与导论、异文表、勘误 | ✅ 官网公开，本仓抓的就是这个 |
| 正文（Text 卷） | ❌ De Gruyter 在版，受版权保护 |
| 本仓产出的索引数据 | ✅ 事实性信息（篇名+页码），可自由使用 |

**本仓不含任何正文文本。** 只有「哪篇在哪卷哪页」这类事实数据。

## 结构

马克思恩格斯历史考证版分四个 Abteilung（部）：

| 部 | 内容 |
|---|---|
| I | 著作、文章、草稿（Werke, Artikel, Entwürfe） |
| II | 《资本论》及其手稿（Das Kapital und Vorarbeiten） |
| III | 书信（Briefwechsel） |
| IV | 摘录、笔记、边注（Exzerpte, Notizen, Marginalien） |

卷号形如 `I/5`、`II/11`、`IV/32`。

## 脚本

### 抓取

| 文件 | 干什么 |
|---|---|
| `mega-fetch.mjs` | 扒官方免费 PDF（各卷目录与导论 / 异文表 / 勘误） |
| `mega-crawl.mjs` | 递归爬官网站内全部 PDF（不只首层） |
| `mega-enum.mjs` | 按卷号规律直接枚举卷页，绕过 JS 分页 |
| `mega-deep.mjs` | 逐卷进独立页 + 抓 MEGAdigital 的 IIIF 图像清单 |
| `mega-probe.mjs` | 探测 MEGAdigital 到底提供什么（全文 / 影印 / 只有目录） |
| `megadigital-probe.mjs` | 摸清 IIIF 接口，抓影印页清单 |
| `megadigital-fetch.mjs` | 从 MEGAdigital 抓影印页清单（不下载大图，先出清单） |
| `megadigital-detail.mjs` | 从详情页抓真正的正文与影印图 |
| `megadigital-briefe.mjs` | 抓 MEGAdigital 书信库全部年份 |
| `mega-hunt.mjs` / `mega-hunt2.mjs` | 死磕正文换所有路子 / 有头模式重试反爬 |

### 转文本

| 文件 | 干什么 |
|---|---|
| `mega2txt.py` | 官方 PDF → 可检索文本 |
| `megadigital2txt.py` | MEGAdigital 详情页正文 → 入库文本 |
| `briefe2txt.py` | MEGAdigital 书信 → 按年入库 |
| `extract_letters.py` | 从书信卷正文提取书信条目 |

### 建索引

| 文件 | 干什么 |
|---|---|
| `mega_index.py` | **参照索引**：卷号 → 收了什么 → 多少字 → 在哪（产出 md + json + html 三份） |
| `build_mega_index.py` | 从官方导论 PDF 抽卷目索引（篇名 + 页码） |
| `mega-find.mjs` | 查「某篇著作在哪一卷、第几页」 |
| `mega-compare.mjs` | 按卷提取段落，与中文《文集》做对照 |
| `l0_index.py` | 原著库总目 |
| `gen_mega_rest.py` | 生成剩余卷的抽取清单 |

### 核验

| 文件 | 干什么 |
|---|---|
| `verify_mega.py` | 确认这批 PDF 是不是真的（前 6 页找封面标识 + 页数比对） |
| `verify_volumes.py` | 卷次自检：每卷文件名必须被该卷正文里的验证词支撑 |
| `mega_doi_probe.py` | 探测各卷在 Crossref 有没有 DOI |

## 关键判断：为什么索引不给页码

`mega_index.py` 头部的原话：

> **用途是参照，不是引用** —— 这批文件没有印刷页码（前置部分用罗马数字），文件头自己写明了「标的是 PDF 页序，不是印刷页码」。
>
> 所以索引要做的是：**让你知道去哪一卷找什么**，不是给页码。

这是本仓最重要的一条设计原则。**索引的职责是导航，不是替代原文。**

## 判据都不靠猜

`mega_index.py` 的三条判据来源：

| 字段 | 从哪来 |
|---|---|
| 卷号 | 文件名提（`mega_I-05` / `mega_II-14` / `mega_IV-32`） |
| 内容性质 | 文件头读（文件头自己写的） |
| 页数 | 文件头的「来源文件：xxx.pdf（N 页）」 |

**没有一条是推测的。** 推测出来的索引比没有索引更坏——它会让人引错。

## 用法

```bash
# 抓某一卷的目录与导论
node mega-fetch.mjs I/5

# 建全量索引
python build_mega_index.py
python mega_index.py

# 查某篇在哪
node mega-find.mjs "德意志意识形态"
node mega-find.mjs "政治经济学批判大纲"

# 核验手上的 PDF 是不是真的
python verify_mega.py
python verify_volumes.py
```

## 路径

原版写的是作者本机路径，本仓已替换为占位符：

```
BASE = Path(r"G:\path\to\knowledge-base")
```

跑之前改成你自己的语料根目录。

## 依赖

- Node.js 18+
- Python 3.10+
- `pymupdf`（`mega2txt.py` 用）

## 精度声明

- 本仓产出的是**卷目级**信息：哪一篇在哪一卷、起止页、篇幅。**不是文本级校对。**
- 索引里的页码来自官方导论的实测值，但**不同版次的导论页码可能不同**，引用前核对你手上的版本。
- 本仓不含正文。需要正文请走图书馆或 De Gruyter 授权渠道。

## 姊妹仓

- [pdf-page-anchored-extraction](https://github.com/sjy888888/pdf-page-anchored-extraction) —— 带印刷页码的文本抽取
- [chinese-ocr-audit](https://github.com/sjy888888/chinese-ocr-audit) —— 中文 OCR 错字审计
- [citation-verification](https://github.com/sjy888888/citation-verification) —— 引文三态核验

## 参考

- 马克思恩格斯历史考证版（Marx-Engels-Gesamtausgabe）官方站点
- 各卷 Inhaltsverzeichnis und Einführung（目录与导论），官方免费公开

## 许可

代码 MIT。索引数据为事实性信息。
