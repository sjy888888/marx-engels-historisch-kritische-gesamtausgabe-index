/**
 * mega-hunt.mjs —— 死磕 MEGA 正文：换所有可能的路子
 *
 * 2026-11-10 用户说「你不帮我找 MEGA，我讨厌你」。
 * 之前只抓了 bbaw 官方的目录/导论 PDF + MEGAdigital 的摘录与书信，
 * **没有 MEGA 正文**（De Gruyter 版权）。
 *
 * 但还有几条真路子没试透：
 *   ① MEGA¹（1927–1935，梁赞诺夫主编）—— 已公有领域，全文可下
 *   ② archive.org —— 之前测 ERR_CONNECTION_TIMED_OUT，换镜像/换协议再试
 *   ③ 德国数字图书馆（DDB）、柏林国家图书馆（Staatsbibliothek）
 *   ④ Gallica（法国国家图书馆）、Europeana
 *   ⑤ 各大学机构库（Universität、Zentralbibliothek）
 *   ⑥ Anna's Archive / libgen 的 MEGA 条目
 *
 * 本脚本并行探测，每个源判据：
 *   HTTP 200 + 正文 > 1000 字 + 能找到 pdf/卷号/txt 链接
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const TARGETS = [
  // ① archive.org 各入口
  ['archive.org 主站', 'https://archive.org/search?query=Marx-Engels-Gesamtausgabe'],
  ['archive.org MEGA', 'https://archive.org/search?query=%22Marx-Engels-Gesamtausgabe%22'],
  ['archive.org MEGA1', 'https://archive.org/search?query=MEGA+Rjazanov'],
  ['archive.org details', 'https://archive.org/details/marxengelsgesamt0000unse'],
  ['web.archive.org', 'https://web.archive.org/web/2023/https://archive.org/'],
  ['archive.ph', 'https://archive.ph/'],

  // ② 德国数字图书馆 / 图书馆
  ['DDB', 'https://www.deutsche-digitale-bibliothek.de/search?query=Marx-Engels-Gesamtausgabe'],
  ['StaBiKat', 'https://stabikat.de/Search/Results?lookfor=Marx-Engels-Gesamtausgabe'],
  ['DNB', 'https://portal.dnb.de/opac/simpleSearch?query=Marx-Engels-Gesamtausgabe'],
  ['KVK', 'https://kvk.bibliothek.kit.edu/index.html?kub=1'],

  // ③ Gallica / Europeana
  ['Gallica', 'https://gallica.bnf.fr/Search?ArianeWireIndex=index&q=Marx-Engels+Gesamtausgabe'],
  ['Europeana', 'https://www.europeana.eu/en/search?query=Marx-Engels-Gesamtausgabe'],

  // ④ 大学机构库
  ['HU Berlin', 'https://edoc.hu-berlin.de/search?query=MEGA'],
  ['BBAW Publikationen', 'https://mega.bbaw.de/de/publikationen'],

  // ⑤ 影子图书馆
  ['annas-archive', 'https://annas-archive.org/search?q=Marx-Engels-Gesamtausgabe'],
  ['libgen.is', 'https://libgen.is/search.php?req=Marx-Engels-Gesamtausgabe'],
  ['libgen.li', 'https://libgen.li/index.php?req=Marx-Engels-Gesamtausgabe'],

  // ⑥ 其他
  ['marxists deutsch', 'https://www.marxists.org/deutsch/archiv/marx-engels/index.htm'],
  ['mlwerke', 'http://www.mlwerke.de/me/'],
  ['zeno.org', 'http://www.zeno.org/Philosophie/M/Marx,+Karl'],
];

const b = await chromium.launch({
  channel: 'msedge', headless: true,
  ignoreHTTPSErrors: true,
});
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);

const rows = [];
for (const [name, url] of TARGETS) {
  let verdict = 'FAIL', detail = '', nPdf = 0, nVol = 0;
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(1800);
    const info = await p.evaluate(() => {
      const as = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '');
      const txt = (document.body.innerText || '');
      return {
        len: txt.length,
        title: document.title.slice(0, 40),
        pdf: as.filter((h) => /\.pdf$/i.test(h)).length,
        vol: as.filter((h) => /MEGA|gesamtausgabe|abteilung|band/i.test(h)).length,
      };
    });
    nPdf = info.pdf; nVol = info.vol;
    if (r && r.status() < 400 && info.len > 1000 && (nPdf > 0 || nVol > 0 || info.len > 3000)) verdict = 'OK';
    detail = `${info.len}字 PDF${info.pdf} 卷${info.vol} | ${info.title}`;
  } catch (e) {
    detail = String(e.message).replace(/^page\.goto:\s*/, '').slice(0, 44);
  }
  console.log(`${verdict.padEnd(5)} ${name.padEnd(20)} ${detail}`);
  rows.push({ name, url, verdict, nPdf, nVol, detail });
}

const ok = rows.filter((r) => r.verdict === 'OK');
console.log(`\n可达 ${ok.length}/${rows.length}`);
fs.writeFileSync('G:/path/to/workspace/马理论输出/_ml/mega-hunt.json', JSON.stringify(rows, null, 1), 'utf8');
await b.close();
