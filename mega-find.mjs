/**
 * mega-find.mjs —— 查「某篇著作在 MEGA 哪一卷、第几页」
 *
 * 2026-11-10 用户说「你不帮我找 MEGA」。正文（De Gruyter 版权）拿不到，
 * 但**卷目索引**是官方免费给的，而且这才是写论文真正要用的：
 *   知道某篇在 MEGA 哪一卷第几页，就能注「MEGA² I/7, S.333」。
 *
 * 数据源：`_mega_volumes.json`（32 卷 / 2592 条，由 build_mega_index.py 从官方导论 PDF 抽出）
 *
 * 用法:
 *   node mega-find.mjs Italien
 *   node mega-find.mjs "Manuskript II"
 *   node mega-find.mjs --vol I/7
 */
import fs from 'node:fs';

const JSON_PATH = 'G:/path/to/knowledge-base/学科资料/_mega_volumes.json';
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const argv = process.argv.slice(2);
let volFilter = null;
const terms = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--vol') { volFilter = argv[++i]; continue; }
  terms.push(argv[i]);
}

const q = terms.join(' ').toLowerCase().trim();

if (!q && !volFilter) {
  console.log('MEGA 卷目索引（32 卷 / 2592 条）\n');
  console.log('各卷条目数：');
  Object.keys(data).sort().forEach((v) => {
    console.log(`  MEGA ${v.padEnd(7)} ${String(data[v].items.length).padStart(4)} 条`);
  });
  console.log('\n用法: node mega-find.mjs <关键词>   或   --vol I/7');
  process.exit(0);
}

const hits = [];
for (const [vol, d] of Object.entries(data)) {
  if (volFilter && vol !== volFilter) continue;
  for (const it of d.items) {
    if (/De Gruyter|Alle Rechte|Printed in/i.test(it.name)) continue;  // 2026-11-10: 过滤 PDF 版权行
    if (!q || it.name.toLowerCase().includes(q)) {
      hits.push({ vol, ...it });
    }
  }
}

if (!hits.length) {
  console.log(`卷目里没找到「${terms.join(' ')}」。`);
  console.log('→ 可能是：① 德文拼写不同（注意 ä ö ü ß）② 该篇不在已抓的 32 卷里');
  console.log('   已抓卷：' + Object.keys(data).sort().join(', '));
  process.exit(0);
}

hits.sort((a, b) => (a.vol === b.vol ? a.page - b.page : a.vol.localeCompare(b.vol)));
console.log(`命中 ${hits.length} 条（卷目级，不是正文）：\n`);
for (const h of hits.slice(0, 40)) {
  console.log(`  MEGA² ${h.vol}, S.${h.page}　${h.name}`);
}
if (hits.length > 40) console.log(`  …还有 ${hits.length - 40} 条`);
console.log('\n★ 这是**卷目索引**：告诉你某篇在哪卷哪页。正文本身需 De Gruyter 版或图书馆。');
console.log('★ 引用格式：MEGA² ' + (hits[0].vol) + ', S.' + hits[0].page);
