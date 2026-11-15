/**
 * mega-compare.mjs —— MEGA 核对库：按卷提取段落，与中文《文集》做对照
 *
 * 2026-11-10 用户定的架构：
 *   「这批东西的价值在**对照**，不在检索。」
 *   「不进 kb.mjs 主索引 → 单独建一个 MEGA 核对库 → 按卷提取关键段落
 *     → 与中文《文集》对应页做逐句对照 → 对照结果写进「事实/异文对照」目录」
 *
 * 所以这个工具不参与日常检索。它只做三件事：
 *   ① 查：某卷某页有什么（按卷定位）
 *   ② 抽：把德文段落抽出来（带 MEGA 自身页码）
 *   ③ 对照：给一个中文关键词，两边各找，列并排
 *
 * 用法：
 *   node mega-compare.mjs --list                    列所有 MEGA 卷
 *   node mega-compare.mjs --vol "II/5" --page 100   看某卷第 100 页
 *   node mega-compare.mjs --find "Entfremdung"      全 MEGA 库搜德文词
 *   node mega-compare.mjs --pair "异化劳动" "Entfremdung"   中德对照
 */
import fs from 'node:fs';
import path from 'node:path';

const MEGA_DIR = 'G:/path/to/knowledge-base/MEGA核对库';
const L0 = 'G:/path/to/knowledge-base/学科资料/L0-马恩列原著';

const argv = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = argv.indexOf(k);
  return i >= 0 ? (argv[i + 1] ?? d) : d;
};

function listFiles() {
  if (!fs.existsSync(MEGA_DIR)) return [];
  return fs.readdirSync(MEGA_DIR).filter((f) => f.endsWith('.txt')).sort();
}

/** 从 MEGA txt 里按【pN】切页 */
function pagesOf(file) {
  const t = fs.readFileSync(path.join(MEGA_DIR, file), 'utf8');
  const out = [];
  const re = /^【p(\d+|\?)(?:\|pdf(\d+))?】.*$/gm;
  const marks = [...t.matchAll(re)];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    out.push({
      page: m[1],
      pdf: m[2] || null,
      text: t.slice(m.index + m[0].length, end).trim(),
    });
  }
  return out;
}

const mode = argv[0];

if (mode === '--list' || !mode) {
  const files = listFiles();
  console.log(`MEGA 核对库：${MEGA_DIR}\n共 ${files.length} 卷\n`);
  const byPart = {};
  for (const f of files) {
    const m = /^MEGA([12])-([IV]+)-/.exec(f);
    if (!m) continue;
    const k = `MEGA${m[1] === '1' ? '¹' : '²'} ${m[2]} 部`;
    byPart[k] = (byPart[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byPart).sort()) console.log(`  ${k.padEnd(16)} ${v} 卷`);
  console.log('\n★ 不参与 kb.mjs 主索引。查德文原文或做版本对照时才用。');
  process.exit(0);
}

if (mode === '--vol') {
  const vol = arg('--vol');
  const pg = parseInt(arg('--page', '0'), 10);
  const files = listFiles().filter((f) => f.includes(`-${vol.replace('/', '-')}`) || f.includes(vol));
  if (!files.length) {
    console.log(`找不到卷 ${vol}`);
    process.exit(0);
  }
  const f = files[0];
  const ps = pagesOf(f);
  console.log(`═══ ${f}（${ps.length} 页）═══\n`);
  const show = pg ? ps.filter((x) => String(x.page) === String(pg) || String(x.pdf) === String(pg)) : ps.slice(0, 2);
  for (const p of show) {
    console.log(`【p${p.page}${p.pdf ? ` / pdf${p.pdf}` : ''}】`);
    console.log(p.text.slice(0, 1200));
    console.log();
  }
  process.exit(0);
}

if (mode === '--find') {
  const term = arg('--find');
  const files = listFiles();
  console.log(`在 MEGA 核对库搜「${term}」（${files.length} 卷）\n`);
  let total = 0;
  for (const f of files) {
    const ps = pagesOf(f);
    const hits = ps.filter((p) => p.text.includes(term));
    if (!hits.length) continue;
    total += hits.length;
    console.log(`📖 ${f}　命中 ${hits.length} 页`);
    for (const h of hits.slice(0, 2)) {
      const idx = h.text.indexOf(term);
      const s = Math.max(0, idx - 60);
      console.log(`   S.${h.page}｜…${h.text.slice(s, idx + 140).replace(/\n/g, " ")}…`);
    }
  }
  console.log(`\n合计 ${total} 页命中`);
  process.exit(0);
}

if (mode === '--pair') {
  const cn = arg('--pair');
  const de = argv[argv.indexOf('--pair') + 2];
  console.log(`═══ 中德对照：中文「${cn}」 vs 德文「${de}」═══\n`);
  // 德文侧
  console.log('【德文 · MEGA 核对库】');
  let deHits = 0;
  for (const f of listFiles()) {
    const ps = pagesOf(f);
    const hits = ps.filter((p) => p.text.includes(de));
    if (!hits.length) continue;
    deHits += hits.length;
    console.log(`  ${f}  命中 ${hits.length} 页`);
    for (const h of hits.slice(0, 1)) {
      const idx = h.text.indexOf(de);
      console.log(`    S.${h.page}｜…${h.text.slice(Math.max(0, idx - 50), idx + 150).replace(/\n/g, ' ')}…`);
    }
  }
  if (!deHits) console.log('  （无命中）');

  console.log('\n【中文 · L0 原文库】');
  const { execSync } = await import('node:child_process');
  try {
    const out = execSync(`node "G:/path/to/knowledge-base/工具/quote.mjs" -n 1 --exact "${cn}"`, { encoding: 'utf8' });
    console.log(out.split('\n').slice(0, 8).join('\n'));
  } catch (e) {
    console.log('  （调用 quote.mjs 失败）');
  }
  console.log('\n★ 对照结果请写进 知识库/事实/异文对照/ 目录。');
  process.exit(0);
}

console.log('用法：--list | --vol II/5 --page 100 | --find Entfremdung | --pair 异化劳动 Entfremdung');
