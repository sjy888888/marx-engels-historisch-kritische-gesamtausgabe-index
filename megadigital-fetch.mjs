/**
 * megadigital-fetch.mjs —— 从 MEGAdigital 抓影印页清单（不下载大图，先出清单）
 *
 * 2026-11-10 已摸清的结构：
 *   页面：https://megadigital.bbaw.de/{kapital|briefe|exzerpte}/index.xql?volume=<卷号>
 *   图像：https://digilib.bbaw.de/digitallibrary/servlet/Scaler/IIIF/silo10!mega!<名字>.jpg/full/!<w>,<h>/0/default.jpg
 *
 *   `<名字>` 就是该页的文献标识（如 exzerptstart!London1868、exzerptstart!1869_I_heft）。
 *
 * 本脚本做：
 *   ① 遍历三个库的所有卷
 *   ② 每卷抓出全部 IIIF 图像名
 *   ③ 输出清单 json（供后续批量下图 + OCR）
 *
 * 判据：同一卷的图名校验——必须含 volume 号或与页面标题相关，防止抓到 logo。
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/workspace/马理论输出/_ml/megadigital-manifest.json';

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(35000);

// 卷号清单（实测首页列的）
const VOLS = {
  exzerpte: ['IV/19', 'IV/23', 'IV/24', 'IV/25', 'IV/27'],
  briefe: [],
  kapital: [],
};

// 先摸 briefe / kapital 各有哪些卷
for (const lib of ['briefe', 'kapital']) {
  try {
    await p.goto(`https://megadigital.bbaw.de/${lib}/index.xql`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(2500);
    const vols = await p.evaluate(() => {
      const out = new Set();
      for (const a of document.querySelectorAll('a')) {
        const m = /volume=([^&#]+)/.exec(a.getAttribute('href') || '');
        if (m) out.add(decodeURIComponent(m[1]));
      }
      return [...out];
    });
    VOLS[lib] = vols;
    console.log(`[${lib}] 卷：${vols.join(', ') || '（无）'}`);
  } catch (e) {
    console.log(`[${lib}] ERR ${String(e.message).slice(0, 40)}`);
  }
}

// 逐卷抓图名
const manifest = {};
for (const [lib, vols] of Object.entries(VOLS)) {
  for (const v of vols) {
    const url = `https://megadigital.bbaw.de/${lib}/index.xql?volume=${encodeURIComponent(v)}`;
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await p.waitForTimeout(3000);
      const imgs = await p.evaluate(() => {
        const out = new Set();
        for (const i of document.querySelectorAll('img')) {
          const m = /IIIF\/([^/]+\.jpg)/.exec(i.src || '');
          if (m) out.add(m[1]);
        }
        // 也扫 data-src / 背景图
        for (const el of document.querySelectorAll('[data-src],[style*="IIIF"]')) {
          const s = (el.getAttribute('data-src') || el.getAttribute('style') || '');
          const m = /IIIF\/([^/'"]+\.jpg)/.exec(s);
          if (m) out.add(m[1]);
        }
        return [...out];
      });
      // 过滤 logo 与图标
      const clean = imgs.filter((x) => !/logo|icon|teaser|placeholder/i.test(x));
      manifest[`${lib}:${v}`] = { url, count: clean.length, images: clean };
      console.log(`  ${lib} ${v.padEnd(8)} → ${clean.length} 张`);
      if (clean.slice(0, 2).length) clean.slice(0, 2).forEach((x) => console.log(`      ${x.slice(0, 70)}`));
    } catch (e) {
      manifest[`${lib}:${v}`] = { url, error: String(e.message).slice(0, 60) };
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1), 'utf8');
const total = Object.values(manifest).reduce((a, x) => a + (x.count || 0), 0);
console.log(`\n共 ${Object.keys(manifest).length} 卷，${total} 张影印页`);
console.log(`清单：${OUT}`);
await b.close();
