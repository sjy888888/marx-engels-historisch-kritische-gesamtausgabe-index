/**
 * mega-hunt2.mjs —— 有头模式重试被反爬拦截的 MEGA 源
 *
 * 2026-11-10 第一轮（无头）结果：19 个源 18 个不通。
 * 但其中三个是**反爬验证页**，不是网络不通：
 *   DDB      → "Dein Browser wird geprüft!"
 *   StaBiKat → "Human verification"
 *   DNB      → "Oh nein!"
 *   Gallica  → "Attention Required! | Cloudflare"
 *   Europeana→ "Nur einen Moment…"
 *
 * 这和 Z-Library 那次一样：无头被识别，有头能过。
 * 本脚本用有头 + 真实 UA 重试。
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const TARGETS = [
  ['DDB Marx', 'https://www.deutsche-digitale-bibliothek.de/search?query=Marx%20Engels%20Gesamtausgabe'],
  ['DDB MEGA', 'https://www.deutsche-digitale-bibliothek.de/search?query=MEGA%20Marx'],
  ['StaBiKat', 'https://stabikat.de/Search/Results?lookfor=Marx-Engels-Gesamtausgabe&type=AllFields'],
  ['DNB', 'https://portal.dnb.de/opac/simpleSearch?query=Marx-Engels-Gesamtausgabe'],
  ['Gallica Marx', 'https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&query=Marx%20Engels&maximumRecords=20'],
  ['Gallica 主站', 'https://gallica.bnf.fr/accueil/de/content/accueil-de?mode=desktop'],
  ['Europeana', 'https://www.europeana.eu/de/search?query=Marx-Engels-Gesamtausgabe'],
  ['HU Berlin edoc', 'https://edoc.hu-berlin.de/search?query=MEGA%20Marx'],
  ['BBAW 出版页', 'https://mega.bbaw.de/de/publikationen'],
  ['BBAW 卷目 I', 'https://mega.bbaw.de/de/mega-baende/i-abteilung'],
];

const b = await chromium.launch({
  channel: 'msedge', headless: false,
  args: ['--no-first-run', '--disable-blink-features=AutomationControlled',
         '--lang=de-DE,de'],
});
const ctx = await b.newContext({
  locale: 'de-DE',
  viewport: { width: 1440, height: 950 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
});
const p = await ctx.newPage();
p.setDefaultTimeout(30000);

const rows = [];
for (const [name, url] of TARGETS) {
  let verdict = 'FAIL', detail = '', hits = [];
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(3500);
    const info = await p.evaluate(() => {
      const as = [...document.querySelectorAll('a')]
        .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) }))
        .filter((x) => x.h);
      const txt = document.body.innerText || '';
      return {
        len: txt.length,
        title: document.title.slice(0, 44),
        pdf: as.filter((x) => /\.pdf$/i.test(x.h)),
        mega: as.filter((x) => /MEGA|Gesamtausgabe|Abteilung|Band\s*\d/i.test(x.t + x.h)),
        sample: txt.replace(/\s+/g, ' ').slice(0, 120),
      };
    });
    const blocked = /Browser wird geprüft|Human verification|Cloudflare|Oh nein|Nur einen Moment|Attention Required/i.test(info.title + info.sample);
    if (info.len > 1500 && !blocked) verdict = 'OK';
    if (blocked) verdict = 'BLOCKED';
    detail = `${info.len}字 PDF${info.pdf.length} MEGA链${info.mega.length} | ${info.title}`;
    hits = info.pdf.concat(info.mega).slice(0, 8);
    if (verdict === 'OK' && hits.length) {
      console.log(`\n  [${name}] 链接：`);
      hits.forEach((x) => console.log(`    ${x.t.slice(0, 40)} → ${x.h.slice(0, 80)}`));
    }
  } catch (e) {
    detail = String(e.message).replace(/^page\.goto:\s*/, '').slice(0, 44);
  }
  console.log(`${verdict.padEnd(8)} ${name.padEnd(18)} ${detail}`);
  rows.push({ name, url, verdict, detail });
}

console.log(`\n可达 ${rows.filter((r) => r.verdict === 'OK').length} / ${rows.length}`);
fs.writeFileSync('G:/path/to/workspace/马理论输出/_ml/mega-hunt2.json', JSON.stringify(rows, null, 1), 'utf8');
await b.close();
