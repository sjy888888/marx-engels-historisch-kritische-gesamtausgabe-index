/**
 * megadigital-probe.mjs —— 摸清 MEGAdigital 的 IIIF 接口，把影印页清单抓下来
 *
 * 2026-11-10 用户：「这个相当相当重要。」
 *
 * 官网 PDF 已抓完（58 个，全是目录/导论/年鉴）。
 * 剩下的真货在 megadigital.bbaw.de：
 *   实测它的图来自 https://digilib.bbaw.de/digitallibrary/servlet/Scaler/IIIF/silo10!mega!exzerptst...
 *   这是 IIIF Image API，说明背后有 manifest（清单）。
 *
 * 本脚本要找到：
 *   ① IIIF manifest URL 规律
 *   ② 每个 volume 有多少页
 *   ③ 页面图像的直链模板
 *
 * 拿到模板后就能批量下图 → OCR → 入库。
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(35000);

// 监听所有网络请求，找 IIIF / manifest / json
const netlog = [];
p.on('request', (req) => {
  const u = req.url();
  if (/IIIF|manifest|\.json|Scaler|digitallibrary/i.test(u)) {
    netlog.push(u);
  }
});

const PAGES = [
  ['MEGAdigital 首页', 'https://megadigital.bbaw.de/'],
  ['Kapital', 'https://megadigital.bbaw.de/kapital/index.xql'],
  ['Briefe', 'https://megadigital.bbaw.de/briefe/index.xql'],
  ['Exzerpte IV/24', 'https://megadigital.bbaw.de/exzerpte/index.xql?volume=IV/24'],
];

for (const [name, url] of PAGES) {
  netlog.length = 0;
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(4000);
    const info = await p.evaluate(() => ({
      title: document.title,
      len: (document.body.innerText || '').length,
      imgs: [...document.querySelectorAll('img')].map((i) => i.src).slice(0, 3),
      links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '')
        .filter((h) => /volume|band|seite|page|manifest/i.test(h)).slice(0, 8),
    }));
    console.log(`\n═══ ${name} ═══`);
    console.log(`HTTP ${r ? r.status() : '?'} | ${info.len} 字 | ${info.title.slice(0, 44)}`);
    if (info.imgs.length) info.imgs.forEach((s) => console.log(`  img: ${s.slice(0, 110)}`));
    if (info.links.length) info.links.forEach((s) => console.log(`  link: ${s.slice(0, 90)}`));
    const iiif = [...new Set(netlog)].filter((u) => /IIIF|manifest|\.json/i.test(u)).slice(0, 8);
    if (iiif.length) {
      console.log('  网络请求里的 IIIF/manifest：');
      iiif.forEach((u) => console.log(`    ${u.slice(0, 120)}`));
    }
  } catch (e) {
    console.log(`\n═══ ${name} ═══ ERR ${String(e.message).slice(0, 44)}`);
  }
}

fs.writeFileSync('G:/path/to/workspace/马理论输出/_ml/megadigital-probe.json',
  JSON.stringify({ netlog: [...new Set(netlog)] }, null, 1), 'utf8');
await b.close();
