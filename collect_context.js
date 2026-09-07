/**
 * collect_context.js
 *
 * tango-share-app のプロジェクトルートで実行してください:
 *   node collect_context.js
 *
 * app/ components/ lib/ 以下の主要ソースコードと、ルートの主要設定ファイルを
 * 1つの Markdown ファイル(context_handoff.md)にまとめて出力します。
 * 新しい会話に引き継ぐ際、このファイルを添付してください。
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, "context_handoff.md");

// 走査するディレクトリ
const INCLUDE_DIRS = ["app", "components", "lib"];

// ルート直下で個別にチェックする設定ファイル(存在するものだけ含める)
const ROOT_FILES = [
  "package.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tailwind.config.ts",
  "tailwind.config.js",
  "vercel.json",
  "tsconfig.json",
  "proxy.ts",
  "middleware.ts",
];

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "public",
  "coverage",
  "dist",
  "build",
  ".turbo",
]);

const INCLUDE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".mjs"]);

// このサイズを超えるファイルは内容を省略する(バイト数)
const MAX_FILE_SIZE = 60_000;

function walk(dir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, fileList);
    } else if (INCLUDE_EXTENSIONS.has(path.extname(entry.name))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function langFor(filePath) {
  const ext = path.extname(filePath).replace(".", "");
  return ext === "mjs" ? "js" : ext;
}

function main() {
  let files = [];

  for (const f of ROOT_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  }

  for (const dir of INCLUDE_DIRS) {
    const p = path.join(ROOT, dir);
    if (fs.existsSync(p)) files = files.concat(walk(p));
  }

  files = [...new Set(files)].sort();

  let output = `# tango-share-app コードスナップショット\n\n`;
  output += `生成日時: ${new Date().toISOString()}\n\n`;
  output += `新しい会話でこのプロジェクトの開発を引き継ぐ際に添付してください。\n\n---\n\n`;

  let totalChars = 0;
  let includedCount = 0;
  let skippedLarge = [];

  for (const file of files) {
    const relPath = path.relative(ROOT, file).replace(/\\/g, "/");
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (content.length > MAX_FILE_SIZE) {
      skippedLarge.push(relPath);
      output += `## ${relPath}\n\n(ファイルサイズが大きいため省略。必要であれば個別に確認してください)\n\n---\n\n`;
      continue;
    }

    output += `## ${relPath}\n\n\`\`\`${langFor(file)}\n${content}\n\`\`\`\n\n---\n\n`;
    totalChars += content.length;
    includedCount++;
  }

  fs.writeFileSync(OUTPUT_FILE, output, "utf8");

  console.log(`✅ ${includedCount} ファイルを ${OUTPUT_FILE} にまとめました`);
  console.log(`   合計文字数: 約${totalChars.toLocaleString()}文字`);
  if (skippedLarge.length > 0) {
    console.log(`⚠️  サイズが大きいため省略したファイル (${skippedLarge.length}件):`);
    skippedLarge.forEach((f) => console.log(`   - ${f}`));
  }
}

main();