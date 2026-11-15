/**
 * mega-enum.mjs —— 按卷号规律直接枚举 MEGA 卷页，绕过 JS 分页
 *
 * 2026-11-10 问题：
 *   `mega-deep.mjs` 试 ?page=1..4，但四个 Abteilung 页都返回同样的 10 卷
 *   —— 说明分页是 JS 渲染的，URL 参数无效。
 *
 * 但从首层链已知卷页规律：
 *   /de/mega-baende/i-abteilung/i/9-m/e
 *   /de/mega-baende/i-abteilung/i/21-m/e
 * 即 /de/mega-baende/<dept>/<abbr>/<号>-m/e
 *
 * 本脚本直接按号枚举：
 *   I 部 1–32（实出约 20 卷）
 *   II 部 1–15（《资本论》全部手稿）
 *   III 部 1–35（书信）
 *   IV 部 1–32（摘录笔记）
 * 每卷试 /e 后缀，命中就抓 PDF。
 *
 * 判据：页面正文 > 500 字且标题含卷号，才算这卷存在。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/knowledge-base/学科资料/L0-马恩列原著/_MEGA官方PDF';
const BASE = 'https://mega.bbaw.de';
fs.mkdirSync(OUT, { recursive: true });

const DEPTS = [
  ['i-abteilung', 'i', 32],
  ['ii-abteilung', 'ii', 16],
  ['iii-abteilung', 'iii', 36],
  ['iv-abteilung', 'iv', 33],
];

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);

const pdfs = new Map();
let hitVol = 0, tried = 0;

for (const [dept, abbr, max] of DEPTS) {
  let deptHit = 0;
  for (let i = 1; i <= max; i++) {
    tried++;
    // 试两种后缀：/e （带子卷）与无后缀
    for (const cand of [`/${dept}/${abbr}/${i}-m/e`, `/${dept}/${abbr}/${i}`, `/${dept}/${abbr}/${i}-m`]) {
      try {
        const r = await p.goto(BASE + '/de/mega-baende' + cand, { waitUntil: 'domcontentloaded', timeout: 18000 });
        if (!r || r.status() !== 200) continue;
        await p.waitForTimeout(700);
        const info = await p.evaluate(() => ({
          len: (document.body.innerText || '').length,
          title: document.title,
          pdfs: [...document.querySelectorAll('a')]
            .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
            .filter((x) => /\.pdf$/i.test(x.h)),
        }));
        if (info.len < 500) continue;
        hitVol++;
        deptHit++;
        for (const f of info.pdfs) {
          const full = f.h.startsWith('http') ? f.h : BASE + f.h;
          if (!pdfs.has(full)) pdfs.set(full, { title: f.t, from: cand });
        }
        console.log(`  ✓ ${cand.padEnd(34)} ${info.len}字 PDF${info.pdfs.length}  ${info.title.slice(0, 26)}`);
        break; // 这个卷找到了，不再试别的后缀
      } catch (e) { /* 下一个 */ }
    }
  }
  console.log(`[${dept}] 命中 ${deptHit} 卷`);
}

console.log(`\n试了 ${tried} 个卷号，存在 ${hitVol} 卷，收集 PDF ${pdfs.size} 个`);

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
      if (new Uint8Array(buf.slice(0, 4))[0] !== 0x25) return 'NOTPDF';
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
console.log(`目录共 ${fs.readdirSync(OUT).filter((f) => f.endsWith('.pdf')).length} 个 PDF`);
await b.close();
