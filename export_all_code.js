/**
 * export_all_code.js
 * プロジェクト内の主要ソースコードを1つのテキストファイルに一括エクスポートします。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = 'all_project_code.txt';

// 対象とする拡張子
const TARGET_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.sql'];

// 無視するディレクトリ・ファイル
const IGNORE_DIRS = ['node_modules', '.next', '.git', '.turbo', 'dist', 'build', '.vercel'];
const IGNORE_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', OUTPUT_FILE, 'export_all_code.js'];

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        getFiles(fullPath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (TARGET_EXTENSIONS.includes(ext) && !IGNORE_FILES.includes(file)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const allFiles = getFiles(process.cwd());
let outputContent = `# =============================================================================\n`;
outputContent += `# tango-share-app 全ソースコード一括エクスポート\n`;
outputContent += `# 出力日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n`;
outputContent += `# ファイル総数: ${allFiles.length}\n`;
outputContent += `# =============================================================================\n\n`;

allFiles.forEach((file) => {
  const relativePath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf8');

  outputContent += `\n--- START OF FILE: ${relativePath} ---\n`;
  outputContent += content.trim();
  outputContent += `\n--- END OF FILE: ${relativePath} ---\n`;
});

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log(`✅ 全 ${allFiles.length} ファイルを "${OUTPUT_FILE}" にまとめました！`);

// Macの場合はクリップボードにも自動コピー
try {
  execSync(`pbcopy < ${OUTPUT_FILE}`);
  console.log(`📋 クリップボードに全内容をコピーしました！新しいAIのチャット欄にそのまま「Command + V」で貼り付けられます。`);
} catch (e) {
  console.log(`👉 "${OUTPUT_FILE}" の中身をコピーして新しいAIに貼り付けてください。`);
}
