import fs from "node:fs";
import path from "node:path";

const [bookArg, startArg, endArg] = process.argv.slice(2);
const bookNumber = Number(bookArg);
const startPage = Number(startArg);
const endPage = Number(endArg);

if (!Number.isInteger(bookNumber) || bookNumber < 1 || bookNumber > 4) {
  console.error("Usage: node extract-ocr-pages.mjs <book 1-4> <start PDF page> <end PDF page>");
  process.exit(1);
}
if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
  console.error("Page arguments must be positive integers and end must be >= start.");
  process.exit(1);
}

const root = process.cwd();
const inputPath = path.join(root, "90_来源与维护", "OCR原始数据", `book${bookNumber}.json`);
const pages = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const selected = pages.filter((page) => page.page >= startPage && page.page <= endPage);

if (selected.length !== endPage - startPage + 1) {
  console.error(`Requested ${endPage - startPage + 1} pages, found ${selected.length}.`);
  process.exit(1);
}

const cjkPunctuation = "\\p{Script=Han}，。；：！？、（）《》“”‘’";
function normalizeLine(value) {
  return String(value ?? "")
    .replaceAll("\u00a0", " ")
    .replace(new RegExp(`(?<=[${cjkPunctuation}])[ \\t]+(?=[${cjkPunctuation}])`, "gu"), "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

for (const page of selected) {
  const originalPage = page.page > 16 ? `原书第 ${page.page - 16} 页` : "原书前置页";
  console.log(`\n===== PDF 第 ${page.page} 页 | ${originalPage} =====`);
  for (const line of page.lines ?? []) {
    const text = normalizeLine(line.text);
    if (text) console.log(text);
  }
}

