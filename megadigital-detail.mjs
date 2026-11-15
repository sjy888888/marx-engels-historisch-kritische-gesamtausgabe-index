/**
 * megadigital-detail.mjs —— 从详情页抓真正的正文与影印图
 *
 * 2026-11-10 关键发现：
 *   卷首页（index.xql?volume=IV/24）只有导航和 43 张同样的缩略图。
 *   真正的条目在**详情页**：
 *     https://megadigital.bbaw.de/exzerpte/detail.xql?id=M0004847
 *     https://megadigital.bbaw.de/exzerpte/detail.xql?id=M0004848
 *   每个 id 对应一份摘录/手稿，页里有：
 *     · 标题（如 `London. 1868. "Economist" (1866 u. 1867)`）
 *     · 转写正文（Edition）
 *     · 影印图（IIIF）
 *
 * 本脚本：
 *   ① 从 5 个 Exzerpte 卷首页收集全部 detail id
 *   ② 逐个进详情页，抓标题 + 正文 + 图名
 *   ③ 落 json，供入库
 *
 * 判据：正文 ≥ 200 字符才算有效条目（空壳页不收）。
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = 'G:/path/to/workspace/dsh-official-home/profiles/desktop/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = 'G:/path/to/workspace/马理论输出/_ml/megadigital-details.json';
const VOLS = ['IV/19', 'IV/23', 'IV/24', 'IV/25', 'IV/27'];

const b = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await b.newContext({ locale: 'de-DE' });
const p = await ctx.newPage();
p.setDefaultTimeout(35000);

// ── ① 收 detail id ──
const ids = new Map();
for (const v of VOLS) {
  try {
    await p.goto(`https://megadigital.bbaw.de/exzerpte/index.xql?volume=${encodeURIComponent(v)}`,
      { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(2500);
    const found = await p.evaluate(() => [...document.querySelectorAll('a')]
      .map((a) => ({ h: a.getAttribute('href') || '', t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) }))
      .filter((x) => /detail\.xql\?id=M\d+/.test(x.h)));
    console.log(`[${v}] 详情链接 ${found.length}`);
    for (const f of found) {
      const m = /id=(M\d+)/.exec(f.h);
      if (m && !ids.has(m[1])) ids.set(m[1], { vol: v, title: f.t, href: f.h });
    }
  } catch (e) {
    console.log(`[${v}] ERR ${String(e.message).slice(0, 40)}`);
  }
}
console.log(`\n去重后 ${ids.size} 个 detail id\n`);

// ── ② 逐详情页抓正文 ──
const rows = [];
let n = 0;
for (const [id, meta] of ids) {
  n++;
  // 2026-11-10 修：原始 href 是 `../exzerpte/detail.xql?id=M0004847`，
  // 它在 /exzerpte/index.xql 这一层，所以 `../` 应解析到站点根，
  // 正确 URL = https://megadigital.bbaw.de/exzerpte/detail.xql?id=...
  // 第一版写死成 /exzerpte/ + 去掉 ../ 后的 `exzerpte/detail.xql`
  // → 变成 /exzerpte/exzerpte/detail.xql → 43 条全 404，我却当成"有效条目 43"。
  let url;
  if (meta.href.startsWith('http')) url = meta.href;
  else {
    const m = /id=(M\d+)/.exec(meta.href);
    url = `https://megadigital.bbaw.de/exzerpte/detail.xql?id=${m ? m[1] : ''}`;
  }
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      // 正文：找最长文本容器
      const sels = ['#content', '.content', 'main', 'article', 'body'];
      let best = '';
      for (const s of sels) for (const el of document.querySelectorAll(s)) {
        const t = (el.innerText || '').trim();
        if (t.length > best.length) best = t;
      }
      const imgs = [...document.querySelectorAll('img')].map((i) => i.src)
        .map((s) => { const m = /IIIF\/([^/]+\.jpg)/.exec(s); return m ? m[1] : null; })
        .filter(Boolean);
      return { text: best, imgs: [...new Set(imgs)], title: document.title };
    });
    // 去导航行
    const nav = /^(MEGAdigital|Kapital|Briefe|Exzerpte|Register|Editorische|Suche|Zum Hauptinhalt|Menü)/;
    const lines = info.text.split('\n').map((l) => l.trim())
      .filter((l) => l.length >= 8 && !nav.test(l));
    const body = lines.join('\n');
    // 404 错误页不算条目（2026-11-10：第一版把 404 页当正文收了 43 条）
    if (body.length < 200 || /HTTP ERROR 404|Document .* not found/.test(body)) { continue; }
    rows.push({
      id, vol: meta.vol, title: meta.title || info.title,
      url, chars: body.length, images: info.imgs, body,
    });
    if (n % 20 === 0) console.log(`  已抓 ${n}/${ids.size}，有效 ${rows.length}`);
  } catch (e) { /* skip */ }
}

fs.writeFileSync(OUT, JSON.stringify(rows.map((r) => ({ ...r, body: r.body.slice(0, 3000) })), null, 1), 'utf8');
// 全文另存
const full = 'G:/path/to/workspace/马理论输出/_ml/megadigital-details-full.json';
fs.writeFileSync(full, JSON.stringify(rows, null, 1), 'utf8');

const total = rows.reduce((a, r) => a + r.chars, 0);
const totalImgs = rows.reduce((a, r) => a + r.images.length, 0);
console.log(`\n有效条目 ${rows.length}，合计 ${total.toLocaleString()} 字，影印图 ${totalImgs} 张`);
console.log(`清单：${OUT}`);
console.log(`全文：${full}`);
await b.close();
