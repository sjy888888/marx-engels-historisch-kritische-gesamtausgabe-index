/**
 * mega-fetch.mjs —— 扒 MEGA 官方免费 PDF（各卷目录与导论 / 异文表 / 勘误）
 *
 * 2026-11-10 用户要「先拿官方免费 PDF」。
 *
 * 实测 MEGA 官方站（mega.bbaw.de）每卷只提供三类 PDF：
 *   ① Inhaltsverzeichnis und Einführung   目录与导论
 *   ② Variantenverzeichnisse              异文表
 *   ③ Korrigenda                          勘误
 * **正文全文没有**（De Gruyter 出版，要买）。
 *
 * 这三类的价值：做**文献目录**——每卷收了哪些文章、起止页、编者说明。
 * 对「引文要落页码」这个目标，目录本身就是页码来源。
 *
 * 判据：HTTP 200 且 Content-Type 是 PDF 且字节 > 20KB 才算拿到。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/knowledge-base/学科资料/L0-马恩列原著/_MEGA官方PDF';
const BASE = 'https://mega.bbaw.de';
fs.mkdirSync(OUT, { recursive: true });

const SECTIONS = [
  ['I. Abteilung', '/de/mega-baende/i-abteilung'],
  ['II. Abteilung', '/de/mega-baende/ii-abteilung'],
  ['III. Abteilung', '/de/mega-baende/iii-abteilung'],
  ['IV. Abteilung', '/de/mega-baende/iv-abteilung'],
];

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE', acceptDownloads: true });
const p = await ctx.newPage();
p.setDefaultTimeout(35000);

const found = [];
for (const [name, url] of SECTIONS) {
  try {
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(2500);
    const pdfs = await p.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter((x) => /\.pdf$/i.test(x.h)));
    console.log(`[${name}] 找到 ${pdfs.length} 个 PDF`);
    for (const x of pdfs) {
      found.push({ section: name, ...x, full: x.h.startsWith('http') ? x.h : BASE + x.h });
    }
  } catch (e) {
    console.log(`[${name}] ERR ${String(e.message).slice(0, 40)}`);
  }
}

// 去重
const uniq = new Map();
for (const f of found) if (!uniq.has(f.full)) uniq.set(f.full, f);
console.log(`\n去重后 ${uniq.size} 个 PDF，开始下载`);

let ok = 0, fail = 0;
for (const [full, meta] of uniq) {
  const fname = decodeURIComponent(full.split('/').pop());
  const dst = path.join(OUT, fname);
  if (fs.existsSync(dst) && fs.statSync(dst).size > 20000) { ok++; continue; }
  try {
    // 用页面上下文 fetch（带 Referer，避免 403）
    const b64 = await p.evaluate(async (u) => {
      const r = await fetch(u, { credentials: 'include' });
      if (!r.ok) return 'ERR:' + r.status;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 20000) return 'SMALL:' + buf.byteLength;
      // 检查 PDF 魔数
      const head = new Uint8Array(buf.slice(0, 4));
      if (head[0] !== 0x25) return 'NOTPDF';
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      return btoa(bin);
    }, full);
    if (b64.startsWith('ERR') || b64.startsWith('SMALL') || b64 === 'NOTPDF') {
      console.log(`  [skip] ${fname}  ${b64}`);
      fail++;
      continue;
    }
    fs.writeFileSync(dst, Buffer.from(b64, 'base64'));
    const kb = Math.round(fs.statSync(dst).size / 1024);
    ok++;
    console.log(`  [ok] ${fname}  ${kb} KB  (${meta.section} · ${meta.t.slice(0, 30)})`);
  } catch (e) {
    console.log(`  [FAIL] ${fname}  ${String(e.message).slice(0, 40)}`);
    fail++;
  }
}

// 清单
const list = [...uniq.values()].map((x) => ({
  section: x.section, title: x.t, url: x.full,
  file: decodeURIComponent(x.full.split('/').pop()),
}));
fs.writeFileSync(path.join(OUT, '_清单.json'), JSON.stringify(list, null, 1), 'utf8');
console.log(`\n成功 ${ok}｜失败 ${fail}｜目录 ${OUT}`);
await b.close();
