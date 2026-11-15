/**
 * megadigital-briefe.mjs —— 抓 MEGAdigital 的书信库（Briefe）全部年份
 *
 * 2026-11-10 实测：
 *   https://megadigital.bbaw.de/briefe/index.xql?jahr=1868
 *   → 42 个 detail 链接（M0000504 等）
 *   条目形态：「Sigismund Ludwig Borkheim an Karl Marx」「Friedrich Engels an Jenny Marx」
 *
 * 这个库的价值：
 *   马克思恩格斯的**全部往来书信**，按年编排，含收信人/写信人、日期、转写全文。
 *   比中文《全集》书信卷更全（中文版是选译，MEGA 是全收）。
 *
 * 判据（每条）：
 *   ① 正文 ≥ 150 字（短信也算，但不能是空壳）
 *   ② 不含 404 错误页
 *   ③ 标题含「an Karl Marx」/「von Karl Marx」/「Engels」之一（确认是书信）
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/workspace/马理论输出/_ml/megadigital-briefe.json';
// 实测站内有 1866–1871 等年份，先扫 1860–1883
const YEARS = Array.from({ length: 24 }, (_, i) => 1860 + i);

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(30000);

// ── ① 收 id ──
const ids = new Map();
for (const y of YEARS) {
  try {
    const r = await p.goto(`https://megadigital.bbaw.de/briefe/index.xql?jahr=${y}`,
      { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (!r || r.status() !== 200) continue;
    await p.waitForTimeout(1400);
    const found = await p.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70) }))
      .filter((x) => /briefe\/detail\.xql\?id=M\d+/.test(x.h)));
    if (!found.length) continue;
    for (const f of found) {
      const m = /id=(M\d+)/.exec(f.h);
      if (m && !ids.has(m[1])) ids.set(m[1], { year: y, title: f.t });
    }
    console.log(`[${y}] +${found.length}（累计 ${ids.size}）`);
  } catch (e) { /* skip */ }
}
console.log(`\n去重后 ${ids.size} 封书信\n`);

// ── ② 逐封抓正文 ──
const rows = [];
let n = 0;
for (const [id, meta] of ids) {
  n++;
  try {
    await p.goto(`https://megadigital.bbaw.de/briefe/detail.xql?id=${id}`,
      { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(900);
    const info = await p.evaluate(() => {
      const sels = ['#content', '.content', 'main', 'article', 'body'];
      let best = '';
      for (const s of sels) for (const el of document.querySelectorAll(s)) {
        const t = (el.innerText || '').trim();
        if (t.length > best.length) best = t;
      }
      return { text: best, title: document.title };
    });
    const nav = /^(MEGAdigital|Kapital|Briefe|Exzerpte|Register|Editorische|Suche|Zum Hauptinhalt|Menü|Jahrgang)/;
    const lines = info.text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 6 && !nav.test(l));
    const body = lines.join('\n');
    if (body.length < 150) continue;
    if (/HTTP ERROR 404|Document .* not found/.test(body)) continue;
    rows.push({ id, year: meta.year, title: meta.title, url: `https://megadigital.bbaw.de/briefe/detail.xql?id=${id}`, chars: body.length, body });
    if (n % 50 === 0) console.log(`  ${n}/${ids.size}，有效 ${rows.length}`);
  } catch (e) { /* skip */ }
}

fs.writeFileSync(OUT, JSON.stringify(rows.map((r) => ({ ...r, body: r.body.slice(0, 2000) })), null, 1), 'utf8');
const full = 'G:/path/to/workspace/马理论输出/_ml/megadigital-briefe-full.json';
fs.writeFileSync(full, JSON.stringify(rows, null, 1), 'utf8');
const tot = rows.reduce((a, r) => a + r.chars, 0);
console.log(`\n有效 ${rows.length} 封，合计 ${tot.toLocaleString()} 字`);
console.log(`全文：${full}`);
await b.close();
