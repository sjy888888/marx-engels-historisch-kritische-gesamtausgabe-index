/**
 * mega-crawl.mjs —— 递归爬 MEGA 官网站内全部 PDF（不只首层）
 *
 * 2026-11-10 第一版 `mega-fetch.mjs` 只扫了 4 个 Abteilung 首页面的直链，
 * 拿到 40 个。但站内还有：
 *   · 每卷的独立页 /de/mega-baende/i-abteilung/i/9-m/e  —— 里面可能还有 PDF
 *   · /de/publikationen 出版物页
 *   · /de/projektbeschreibung 项目说明（可能有总目）
 *
 * 本脚本做 BFS：从 4 个 Abteilung 页 + publikationen 出发，
 * 跟进所有 /de/mega-baende/** 链接，收集全部 .pdf。
 * 限制：最多 200 页、深度 3，避免爬爆。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/knowledge-base/学科资料/L0-马恩列原著/_MEGA官方PDF';
const BASE = 'https://mega.bbaw.de';
fs.mkdirSync(OUT, { recursive: true });

const SEEDS = [
  '/de/mega-baende',
  '/de/mega-baende/i-abteilung',
  '/de/mega-baende/ii-abteilung',
  '/de/mega-baende/iii-abteilung',
  '/de/mega-baende/iv-abteilung',
  '/de/publikationen',
  '/de/projektbeschreibung',
];

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(30000);

const seenPages = new Set();
const queue = SEEDS.map((s) => ({ url: s, depth: 0 }));
const pdfs = new Map();
let pagesVisited = 0;

while (queue.length && pagesVisited < 200) {
  const { url, depth } = queue.shift();
  if (seenPages.has(url) || depth > 3) continue;
  seenPages.add(url);
  pagesVisited++;
  try {
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(1000);
    const links = await p.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim() })));
    let nPdf = 0, nPage = 0;
    for (const x of links) {
      let h = x.h;
      if (!h) continue;
      if (/\.pdf$/i.test(h)) {
        const full = h.startsWith('http') ? h : BASE + h;
        if (!pdfs.has(full)) {
          pdfs.set(full, { title: x.t, from: url });
          nPdf++;
        }
      } else if (h.startsWith('/de/') && !seenPages.has(h)) {
        // 只跟进卷页与出版物页
        if (/mega-baende|publikationen/.test(h)) {
          queue.push({ url: h, depth: depth + 1 });
          nPage++;
        }
      }
    }
    if (nPdf || nPage) console.log(`[${url.slice(0, 44)}] +PDF ${nPdf}  +待爬 ${nPage}`);
  } catch (e) {
    /* 跳过 */
  }
}

console.log(`\n访问 ${pagesVisited} 页，收集 PDF ${pdfs.size} 个`);

// 下载
let ok = 0, skip = 0, fail = 0;
for (const [full, meta] of pdfs) {
  const fname = decodeURIComponent(full.split('/').pop());
  const dst = path.join(OUT, fname);
  if (fs.existsSync(dst) && fs.statSync(dst).size > 20000) { skip++; continue; }
  try {
    const b64 = await p.evaluate(async (u) => {
      const r = await fetch(u, { credentials: 'include' });
      if (!r.ok) return 'ERR:' + r.status;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 20000) return 'SMALL:' + buf.byteLength;
      const head = new Uint8Array(buf.slice(0, 4));
      if (head[0] !== 0x25) return 'NOTPDF';
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      return btoa(bin);
    }, full);
    if (b64.startsWith('ERR') || b64.startsWith('SMALL') || b64 === 'NOTPDF') { fail++; continue; }
    fs.writeFileSync(dst, Buffer.from(b64, 'base64'));
    ok++;
    if (ok % 10 === 0) console.log(`  已下 ${ok}...`);
  } catch (e) { fail++; }
}

const list = [...pdfs.entries()].map(([url, m]) => ({
  url, title: m.title, from: m.from,
  file: decodeURIComponent(url.split('/').pop()),
}));
fs.writeFileSync(path.join(OUT, '_清单.json'), JSON.stringify(list, null, 1), 'utf8');
console.log(`\n新增 ${ok}｜已存在 ${skip}｜失败 ${fail}｜总计 ${pdfs.size}`);
await b.close();
