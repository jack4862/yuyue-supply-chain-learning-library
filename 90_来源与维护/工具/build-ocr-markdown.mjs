import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ocrDir = path.join(root, "90_来源与维护", "OCR原始数据");
const outputDir = path.join(root, "90_来源与维护", "全文底稿");

const books = [
  {
    key: "book1",
    title: "采购管理",
    sourcePage: "采购管理来源",
    expectedPages: 358,
  },
  {
    key: "book2",
    title: "供应链规划",
    sourcePage: "供应链规划来源",
    expectedPages: 292,
  },
  {
    key: "book3",
    title: "供应链领导力",
    sourcePage: "供应链领导力来源",
    expectedPages: 301,
  },
  {
    key: "book4",
    title: "供应链运作",
    sourcePage: "供应链运作来源",
    expectedPages: 312,
  },
];

const cjkPunctuation = "\\p{Script=Han}，。；：！？、（）《》“”‘’";

function normalizeLine(value) {
  const text = String(value ?? "").replaceAll("\u00a0", " ");
  return text
    .replace(new RegExp(`(?<=[${cjkPunctuation}])[ \\t]+(?=[${cjkPunctuation}])`, "gu"), "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pageLabel(pdfPage) {
  if (pdfPage <= 16) {
    return `PDF 第 ${pdfPage} 页；原书前置页`;
  }
  return `PDF 第 ${pdfPage} 页；原书第 ${pdfPage - 16} 页`;
}

fs.mkdirSync(outputDir, { recursive: true });

let totalPages = 0;
let totalCharacters = 0;

for (const book of books) {
  const inputPath = path.join(ocrDir, `${book.key}.json`);
  const pages = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  if (pages.length !== book.expectedPages) {
    throw new Error(`${book.key}: expected ${book.expectedPages} pages, got ${pages.length}`);
  }

  const parts = [];
  let characterCount = 0;

  for (const page of pages) {
    const pdfPage = Number(page.page);
    const lines = (page.lines ?? []).map((line) => normalizeLine(line.text)).filter(Boolean);
    const text = lines.length ? lines.map((line) => `> ${line}`).join("\n") : "> （本页未识别到文字）";
    characterCount += lines.reduce((sum, line) => sum + line.length, 0);

    parts.push(`## PDF 第 ${String(pdfPage).padStart(3, "0")} 页\n\n> [!note] 页码映射\n> ${pageLabel(pdfPage)}\n\n${text}`);
  }

  const output = `---\ntype: source\ndomain: source\nstatus: compiled\nupdated: 2026-11-12\nsource_id: ${book.key}\ntags: [OCR, 全文底稿, ${book.title}]\n---\n\n# ${book.title} OCR 全文底稿\n\n> [!warning] 证据等级\n> 本页由扫描 PDF 经 120 DPI 渲染和 Windows OCR 自动生成。中文之间的识别空白已做轻量规整，便于 Obsidian 搜索；OCR 仍可能错字、漏字、串行或错排表格。精确引文、数字、公式和法律条文必须回看桌面 PDF 原页。\n\n- 来源档案：[[90_来源与维护/来源档案/${book.sourcePage}]]\n- 来源总表：[[90_来源与维护/来源总表]]\n- PDF 页数：${pages.length}\n- 原书页码：PDF 页码减 16\n- 识别字符数（规整后）：${characterCount.toLocaleString("en-US")}\n\n## 使用方法\n\n在 Obsidian 全局搜索中输入一个短词或短语。先在本页定位 PDF 页，再回到对应章节页和 PDF 原页核对语境。\n\n---\n\n${parts.join("\n\n---\n\n")}\n`;

  const outputPath = path.join(outputDir, `${book.title}-OCR全文.md`);
  fs.writeFileSync(outputPath, output, "utf8");
  totalPages += pages.length;
  totalCharacters += characterCount;
  console.log(`${book.title}: ${pages.length} pages, ${characterCount} characters -> ${path.relative(root, outputPath)}`);
}

console.log(`Total: ${totalPages} pages, ${totalCharacters} characters`);
console.log(`Input OCR retained at ${path.relative(root, ocrDir)}`);

