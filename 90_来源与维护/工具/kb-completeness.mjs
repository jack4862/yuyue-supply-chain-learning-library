import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const chapterSets = [
  { domain: "procurement", directory: "20_采购管理", count: 9 },
  { domain: "planning", directory: "30_供应链规划", count: 8 },
  { domain: "operations", directory: "40_供应链运作", count: 8 },
  { domain: "leadership", directory: "50_组织与领导力", count: 9 },
];

function chapterFiles(directory) {
  return fs
    .readdirSync(path.join(root, directory))
    .filter((name) => /^第\d{2}章-.+\.md$/.test(name))
    .sort();
}

function frontmatterValue(text, key) {
  return text.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)`, "m"))?.[1]?.trim() ?? null;
}

const chapters = [];
const missingChapters = [];

for (const set of chapterSets) {
  const files = chapterFiles(set.directory);
  const actualNumbers = new Set(files.map((name) => Number(name.slice(1, 3))));
  for (let number = 1; number <= set.count; number += 1) {
    if (!actualNumbers.has(number)) missingChapters.push({ domain: set.domain, chapter: number });
  }

  for (const filename of files) {
    const relative = `${set.directory}/${filename}`;
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    const questionCount = (text.match(/>\s*\[!question\]-/g) ?? []).length;
    const sectionNumbers = new Set(
      [...text.matchAll(/^\|\s*第\s*(\d+)\s*节/gmu)].map((match) => Number(match[1])),
    );
    const citationCount = (text.match(/(?:原书第|PDF 第)\s*\d+/g) ?? []).length;
    const characters = text.length;
    const coverage = frontmatterValue(text, "coverage") === "comprehensive";
    const selfContained = text.includes("## 教材精读（自足版）");
    const hasStructureMap = sectionNumbers.size >= 2;
    const hasSummary = /^###\s*(?:\d+\.\s*)?[^\r\n]*总结/m.test(text);
    const hasFormulas = /^###\s*(?:\d+\.\s*)?[^\r\n]*(?:公式|指标)/m.test(text);
    const hasCases = /^###\s*(?:\d+\.\s*)?[^\r\n]*(?:案例|业务场景)/m.test(text);
    const issues = [];

    if (!coverage) issues.push("missing coverage: comprehensive");
    if (!selfContained) issues.push("missing self-contained section");
    if (characters < 5000) issues.push(`too short: ${characters} chars`);
    if (questionCount < 15) issues.push(`too few questions: ${questionCount}`);
    if (!hasStructureMap) issues.push(`section map has fewer than 2 sections: ${sectionNumbers.size}`);
    if (citationCount < 3) issues.push(`too few page citations: ${citationCount}`);
    if (!hasFormulas) issues.push("missing formulas/metrics section");
    if (!hasCases) issues.push("missing case section");
    if (!hasSummary) issues.push("missing one-page summary");

    chapters.push({
      domain: set.domain,
      file: relative,
      sourcePages: frontmatterValue(text, "source_pages"),
      updated: frontmatterValue(text, "updated"),
      characters,
      questions: questionCount,
      mappedSections: sectionNumbers.size,
      citations: citationCount,
      coverage,
      selfContained,
      issues,
    });
  }
}

const failedChapters = chapters.filter((chapter) => chapter.issues.length > 0);
const summary = {
  expectedChapters: chapterSets.reduce((sum, set) => sum + set.count, 0),
  foundChapters: chapters.length,
  comprehensiveChapters: chapters.filter((chapter) => chapter.coverage).length,
  totalQuestions: chapters.reduce((sum, chapter) => sum + chapter.questions, 0),
  minimumCharacters: Math.min(...chapters.map((chapter) => chapter.characters)),
  averageCharacters: Math.round(chapters.reduce((sum, chapter) => sum + chapter.characters, 0) / chapters.length),
  missingChapters,
  failedChapters: failedChapters.map((chapter) => ({ file: chapter.file, issues: chapter.issues })),
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  chapters,
  status: missingChapters.length === 0 && failedChapters.length === 0 ? "PASS" : "FAIL",
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
