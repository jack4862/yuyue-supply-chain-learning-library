import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".obsidian", "tmp", "node_modules"]);
const requiredFrontmatter = ["type", "domain", "status", "updated"];
const validDomains = new Set([
  "foundation",
  "procurement",
  "planning",
  "operations",
  "leadership",
  "diagnostic",
  "learning",
  "source",
]);
const frontmatterExceptions = new Set(["AGENTS.md", "这是我们的第一篇笔记.md"]);
const orphanExceptions = new Set(["AGENTS.md", "这是我们的第一篇笔记.md", "欢迎.md"]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function withoutMd(value) {
  return value.replace(/\.md$/i, "");
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (field) data[field[1]] = field[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

function stripFencedCode(text) {
  return text.replace(/^```[\s\S]*?^```\s*$/gm, "");
}

function extractWikiLinks(text) {
  const links = [];
  const clean = stripFencedCode(text);
  const pattern = /!?\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = pattern.exec(clean))) {
    const raw = match[1];
    const targetPart = raw.split("|", 1)[0];
    const target = targetPart.split("#", 1)[0].trim();
    links.push({ raw, target });
  }
  return links;
}

function checkHeadings(text) {
  const clean = stripFencedCode(text);
  let previous = 0;
  const jumps = [];
  for (const match of clean.matchAll(/^(#{1,6})\s+\S.+$/gm)) {
    const level = match[1].length;
    if (previous && level > previous + 1) jumps.push(`${previous}->${level}: ${match[0]}`);
    previous = level;
  }
  return jumps;
}

function checkFences(text) {
  const fences = [...text.matchAll(/^```/gm)].length;
  return fences % 2 === 0 ? null : `unbalanced fenced-code markers: ${fences}`;
}

const files = walk(root).sort();
const relativeFiles = files.map((file) => toPosix(path.relative(root, file)));
const exactTargets = new Map();
const basenameTargets = new Map();

for (const relative of relativeFiles) {
  const exact = withoutMd(relative).toLowerCase();
  const basename = withoutMd(path.posix.basename(relative)).toLowerCase();
  if (!exactTargets.has(exact)) exactTargets.set(exact, []);
  exactTargets.get(exact).push(relative);
  if (!basenameTargets.has(basename)) basenameTargets.set(basename, []);
  basenameTargets.get(basename).push(relative);
}

const pages = new Map();
const missingLinks = [];
const frontmatterIssues = [];
const headingIssues = [];
const fenceIssues = [];
const h1Groups = new Map();
const incoming = new Map(relativeFiles.map((file) => [file, new Set()]));
let wikiLinkCount = 0;
let mermaidBlocks = 0;

for (const file of files) {
  const relative = toPosix(path.relative(root, file));
  const text = fs.readFileSync(file, "utf8");
  const frontmatter = parseFrontmatter(text);
  const links = extractWikiLinks(text);
  pages.set(relative, { text, frontmatter, links });
  wikiLinkCount += links.length;
  mermaidBlocks += [...text.matchAll(/^```mermaid\s*$/gm)].length;

  if (!frontmatterExceptions.has(relative)) {
    if (!frontmatter) {
      frontmatterIssues.push({ file: relative, issue: "missing frontmatter" });
    } else {
      for (const field of requiredFrontmatter) {
        if (!frontmatter[field]) frontmatterIssues.push({ file: relative, issue: `missing ${field}` });
      }
      if (frontmatter.domain && !validDomains.has(frontmatter.domain)) {
        frontmatterIssues.push({ file: relative, issue: `invalid domain: ${frontmatter.domain}` });
      }
      if (frontmatter.updated && !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.updated)) {
        frontmatterIssues.push({ file: relative, issue: `invalid updated: ${frontmatter.updated}` });
      }
    }
  }

  for (const link of links) {
    if (!link.target) continue;
    const normalized = withoutMd(link.target.replaceAll("\\", "/")).toLowerCase();
    const matches = exactTargets.get(normalized) ?? basenameTargets.get(normalized) ?? [];
    if (matches.length === 0) {
      missingLinks.push({ file: relative, link: link.raw });
    } else if (matches.length > 1) {
      missingLinks.push({ file: relative, link: link.raw, issue: `ambiguous: ${matches.join(", ")}` });
    } else if (matches[0] !== relative) {
      incoming.get(matches[0])?.add(relative);
    }
  }

  const jumps = checkHeadings(text);
  if (jumps.length) headingIssues.push({ file: relative, issues: jumps });
  const fenceIssue = checkFences(text);
  if (fenceIssue) fenceIssues.push({ file: relative, issue: fenceIssue });

  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) {
    if (!h1Groups.has(h1)) h1Groups.set(h1, []);
    h1Groups.get(h1).push(relative);
  }
}

const orphanPages = relativeFiles
  .filter((file) => !orphanExceptions.has(file) && incoming.get(file)?.size === 0)
  .sort();
const duplicateH1 = [...h1Groups.entries()]
  .filter(([, group]) => group.length > 1)
  .map(([title, group]) => ({ title, files: group }));
const typeCounts = {};
const domainCounts = {};

for (const { frontmatter } of pages.values()) {
  if (frontmatter?.type) typeCounts[frontmatter.type] = (typeCounts[frontmatter.type] ?? 0) + 1;
  if (frontmatter?.domain) domainCounts[frontmatter.domain] = (domainCounts[frontmatter.domain] ?? 0) + 1;
}

const indexPage = pages.get("index.md");
const indexedTargets = new Set();
for (const link of indexPage?.links ?? []) {
  const normalized = withoutMd(link.target.replaceAll("\\", "/")).toLowerCase();
  const matches = exactTargets.get(normalized) ?? basenameTargets.get(normalized) ?? [];
  for (const match of matches) indexedTargets.add(match);
}
const indexExceptions = new Set(["index.md", "AGENTS.md", "这是我们的第一篇笔记.md"]);
const notDirectlyIndexed = relativeFiles
  .filter((file) => !indexExceptions.has(file) && !indexedTargets.has(file))
  .sort();

const sourceByDomain = new Map([
  ["procurement", "90_来源与维护/来源档案/采购管理来源.md"],
  ["planning", "90_来源与维护/来源档案/供应链规划来源.md"],
  ["leadership", "90_来源与维护/来源档案/供应链领导力来源.md"],
  ["operations", "90_来源与维护/来源档案/供应链运作来源.md"],
]);
const mappingIssues = [];
const citationIssues = [];

function isInsideRange(start, end, range) {
  return start >= range.start && end <= range.end && start <= end;
}

function checkCitations(file, text, originalRange, pdfRange) {
  const citationPatterns = [
    { label: "原书", range: originalRange, pattern: /原书第\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*页/g },
    { label: "PDF", range: pdfRange, pattern: /PDF\s*第\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*页/g },
  ];

  for (const line of text.split(/\r?\n/)) {
    if (/附录|不计入本章正文|范围外/.test(line)) continue;
    for (const { label, range, pattern } of citationPatterns) {
      for (const match of line.matchAll(pattern)) {
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        if (!isInsideRange(start, end, range)) {
          citationIssues.push({
            file,
            issue: `${label} citation ${start}-${end} outside chapter range ${range.start}-${range.end}`,
          });
        }
      }
    }
  }
}

for (const [file, page] of pages.entries()) {
  if (page.frontmatter?.type !== "chapter" || !page.frontmatter.source_pages) continue;
  const sourceFile = sourceByDomain.get(page.frontmatter.domain);
  const sourceText = sourceFile ? pages.get(sourceFile)?.text : null;
  if (!sourceText) {
    mappingIssues.push({ file, issue: `source page not found for domain ${page.frontmatter.domain}` });
    continue;
  }

  const target = `[[${withoutMd(file)}]]`;
  const mappingLine = sourceText
    .split(/\r?\n/)
    .find((line) => line.includes(target));
  if (!mappingLine) {
    mappingIssues.push({ file, issue: "chapter link missing from source mapping table" });
    continue;
  }

  const originalRangeValue = page.frontmatter.source_pages;
  const rangeMatch = mappingLine.match(/\|\s*(\d+)\s*-\s*(\d+)\s*\|\s*(\d+)\s*-\s*(\d+)\s*\|/);
  if (!rangeMatch) {
    mappingIssues.push({ file, issue: "source mapping row has no page ranges" });
    continue;
  }
  const [, originalStart, originalEnd, pdfStart, pdfEnd] = rangeMatch.map(Number);
  const originalRange = { start: originalStart, end: originalEnd };
  const pdfRange = { start: pdfStart, end: pdfEnd };
  if (`${originalStart}-${originalEnd}` !== originalRangeValue) {
    mappingIssues.push({
      file,
      issue: `frontmatter source_pages ${originalRangeValue} differs from source table ${originalStart}-${originalEnd}`,
    });
  }
  if (Number(pdfStart) !== originalStart + 16 || Number(pdfEnd) !== originalEnd + 16) {
    mappingIssues.push({ file, issue: `PDF range ${pdfStart}-${pdfEnd} is not original + 16` });
  }

  checkCitations(file, page.text, originalRange, pdfRange);
}

const report = {
  generatedAt: new Date().toISOString(),
  markdownPages: relativeFiles.length,
  wikiLinkCount,
  mermaidBlocks,
  typeCounts,
  domainCounts,
  missingLinks,
  frontmatterIssues,
  orphanPages,
  notDirectlyIndexed,
  duplicateH1,
  mappingIssues,
  citationIssues,
  headingIssues,
  fenceIssues,
  status: [missingLinks, frontmatterIssues, orphanPages, notDirectlyIndexed, duplicateH1, mappingIssues, citationIssues, headingIssues, fenceIssues].every(
    (items) => items.length === 0,
  )
    ? "PASS"
    : "FAIL",
};

console.log(JSON.stringify(report, null, 2));
if (!report.status) process.exitCode = 1;

