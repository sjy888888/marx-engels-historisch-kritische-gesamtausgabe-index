/**
 * mega-probe.mjs —— 探测 MEGAdigital 到底提供什么（全文？影印？还是只有目录）
 *
 * 2026-11-10 用户问：「有 MEGA1 或 2 系列德文原版成果吗？」
 *
 * 实测已确认：
 *   mega.bbaw.de（柏林-勃兰登堡科学院官方）可通，按 I–IV Abteilung 列卷
 *   megadigital.bbaw.de（数字化平台）可通，有 Kapital / Briefe / Exzerpte / Register 四库
 *   卷页有 9543 字（不是空壳）
 *
 * 本脚本要弄清三件事：
 *   ① 正文是 HTML 文本，还是 PDF 影印？
 *   ② 有没有 PDF 直链？
 *   ③ 需不需要订阅/登录（De Gruyter 版是要买的）
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await (await b.newContext({ locale: 'de-DE' })).newPage();
p.setDefaultTimeout(35000);

const out = [];

async function probe(label, url) {
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(3000);
    const info = await p.evaluate(() => {
      const links = [...document.querySelectorAll('a')]
        .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44) }))
        .filter((x) => x.h);
      const pdfs = links.filter((x) => /\.pdf|pdf$/i.test(x.h));
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      return {
        title: document.title,
        len: text.length,
        head: text.slice(0, 240),
        pdfs: pdfs.slice(0, 10),
        nlinks: links.length,
        // 是否存在影印图（img 指向 jp2/jpg/tif）
        imgs: [...document.querySelectorAll('img')].map((i) => i.src).filter((s) => /jp2|jpg|jpeg|tif/i.test(s)).slice(0, 5),
      };
    });
    console.log(`\n═══ ${label} ═══`);
    console.log(`HTTP ${r ? r.status() : '?'} | ${info.len} 字 | 链接 ${info.nlinks} | PDF ${info.pdfs.length} | 影印图 ${info.imgs.length}`);
    console.log(`  ${info.title.slice(0, 60)}`);
    console.log(`  正文：${info.head.slice(0, 200)}`);
    if (info.pdfs.length) info.pdfs.forEach((x) => console.log(`  PDF: ${x.t} → ${x.h.slice(0, 80)}`));
    if (info.imgs.length) info.imgs.forEach((s) => console.log(`  图: ${s.slice(0, 80)}`));
    out.push({ label, url, ...info });
  } catch (e) {
    console.log(`\n═══ ${label} ═══ ERR ${String(e.message).slice(0, 50)}`);
  }
}

await probe('MEGAdigital 首页', 'https://megadigital.bbaw.de/');
await probe('Exzerpte IV/24', 'https://megadigital.bbaw.de/exzerpte/index.xql?volume=IV/24');
await probe('I. Abteilung 卷目', 'https://mega.bbaw.de/de/mega-baende/i-abteilung');
await probe('II. Abteilung 卷目', 'https://mega.bbaw.de/de/mega-baende/ii-abteilung');

// 从 I. Abteilung 页面里找一本《资本论》卷，再深入
try {
  const r = await p.goto('https://mega.bbaw.de/de/mega-baende/ii-abteilung', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await p.waitForTimeout(2500);
  const vols = await p.evaluate(() => [...document.querySelectorAll('a')]
    .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
    .filter((x) => /II\/\d|ii\/\d|abteilung\/ii/i.test(x.h) && x.t.length > 2).slice(0, 8));
  console.log('\nII. Abteilung 下的卷链接：');
  vols.forEach((v) => console.log(`  ${v.t.slice(0, 40)} → ${v.h.slice(0, 70)}`));
  if (vols.length) await probe('深入一卷', new URL(vols[0].h, 'https://mega.bbaw.de/').href);
} catch (e) {
  console.log('取卷链接失败', String(e.message).slice(0, 40));
}

fs.writeFileSync('G:/path/to/workspace/马理论输出/_ml/mega-probe.json', JSON.stringify(out, null, 1), 'utf8');
console.log('\n已写 _ml/mega-probe.json');
await b.close();
