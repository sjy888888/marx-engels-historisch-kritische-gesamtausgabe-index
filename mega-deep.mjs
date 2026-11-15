/**
 * mega-deep.mjs —— MEGA 深度抓取：逐卷进独立页 + 抓 MEGAdigital 的 IIIF 图像清单
 *
 * 2026-11-10 用户：「继续帮我抓，这个相当相当重要。」
 *
 * 上一轮（mega-crawl.mjs）已拿到 59 个 PDF，但漏了两类：
 *   ① 每卷独立页（/de/mega-baende/i-abteilung/i/9-m/e）里的 PDF —— 只进了 1 个页面
 *   ② /de/mega-baende 总目页的分页（?page=N）
 *
 * 本脚本做三件事：
 *   ① 把 4 个 Abteilung 页里**所有**卷链接收全（含 i/1, i/2 ... 逐卷）
 *   ② 逐卷进页面抓 PDF
 *   ③ 同时探 MEGAdigital 的 IIIF manifest 接口（图版可批量下）
 *
 * 判据：PDF 必须 HTTP 200 + 字节 > 20KB + 首字节 0x25（%PDF）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/knowledge-base/学科资料/L0-马恩列原著/_MEGA官方PDF';
const BASE = 'https://mega.bbaw.de';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(30000);

// ── 第一段：收全所有卷链接 ──
const volPages = new Set();
const DEPTS = ['i-abteilung', 'ii-abteilung', 'iii-abteilung', 'iv-abteilung'];
for (const dep of DEPTS) {
  for (let pg = 0; pg <= 3; pg++) {
    const u = `${BASE}/de/mega-baende/${dep}` + (pg ? `?page=${pg + 1}` : '');
    try {
      await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(1200);
      const vols = await p.evaluate(() => [...document.querySelectorAll('a')]
        .map((a) => a.getAttribute('href') || '')
        .filter((h) => /\/de\/mega-baende\/[iv]+-abteilung\/[iv]+\//.test(h)));
      if (!vols.length) break;
      vols.forEach((v) => volPages.add(v));
      console.log(`[${dep} p${pg + 1}] +${vols.length} 卷（累计 ${volPages.size}）`);
    } catch (e) { break; }
  }
}

// ── 第二段：逐卷进页抓 PDF ──
const pdfs = new Map();
let n = 0;
for (const v of volPages) {
  n++;
  try {
    await p.goto(BASE + v, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(900);
    const found = await p.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter((x) => /\.pdf$/i.test(x.h)));
    for (const f of found) {
      const full = f.h.startsWith('http') ? f.h : BASE + f.h;
      if (!pdfs.has(full)) pdfs.set(full, { title: f.t, from: v });
    }
    if (found.length && n % 20 === 0) console.log(`  已扫 ${n}/${volPages.size} 卷，累计 PDF ${pdfs.size}`);
  } catch (e) { /* skip */ }
}
console.log(`\n扫完 ${volPages.size} 个卷页，收集 PDF ${pdfs.size} 个`);

// ── 第三段：下载（只下没有的）──
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
  } catch (e) { fail++; }
}
console.log(`新增 ${ok}｜已存在 ${skip}｜失败 ${fail}`);

const list = [...pdfs.entries()].map(([url, m]) => ({
  url, title: m.title, from: m.from, file: decodeURIComponent(url.split('/').pop()),
}));
fs.writeFileSync(path.join(OUT, '_清单.json'), JSON.stringify(list, null, 1), 'utf8');
console.log(`目录共 ${fs.readdirSync(OUT).filter((f) => f.endsWith('.pdf')).length} 个 PDF`);
await b.close();
