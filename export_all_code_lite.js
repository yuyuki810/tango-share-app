/**
 * export_all_code_lite.js
 * トークン節約版: 実体ソースコード(app, components, lib)のみを抽出
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = 'all_project_code.txt';

// 対象とする必須ディレクトリ
const TARGET_DIRS = ['app', 'components', 'lib'];

// 対象拡張子（TypeScript / CSS のみに限定）
const TARGET_EXTENSIONS = ['.ts', '.tsx', '.css'];

// 除外するファイル（テストやバックアップ等）
const IGNORE_PATTERNS = [
  'setup_',
  'restore_',
  'export_',
  '.d.ts',
  'package-lock.json',
  '.test.',
  '.spec.'
];

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(file)) {
        getFiles(fullPath, fileList);
      }
    } else {
      const ext = path.extname(file);
      const isTargetExt = TARGET_EXTENSIONS.includes(ext);
      const isIgnored = IGNORE_PATTERNS.some((p) => file.includes(p));

      if (isTargetExt && !isIgnored) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

let allFiles = [];
TARGET_DIRS.forEach((d) => {
  const dirPath = path.join(process.cwd(), d);
  getFiles(dirPath, allFiles);
});

// package.json も追加（依存関係の確認用）
if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
  allFiles.push(path.join(process.cwd(), 'package.json'));
}

let outputContent = `# =============================================================================\n`;
outputContent += `# tango-share-app 厳選ソースコード（トークン最適化版）\n`;
outputContent += `# 出力日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n`;
outputContent += `# ファイル数: ${allFiles.length}\n`;
outputContent += `# =============================================================================\n\n`;

let totalLines = 0;

allFiles.forEach((file) => {
  const relativePath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf8').trim();
  const lineCount = content.split('\n').length;
  totalLines += lineCount;

  outputContent += `\n--- START OF FILE: ${relativePath} ---\n`;
  outputContent += content;
  outputContent += `\n--- END OF FILE: ${relativePath} ---\n`;
});

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log(`\n🎉 圧縮完了！`);
console.log(`📊 厳選ファイル数: ${allFiles.length} ファイル`);
console.log(`�� 合計行数: 約 ${totalLines} 行（劇的にトークンを削減しました）`);

try {
  execSync(`pbcopy < ${OUTPUT_FILE}`);
  console.log(`📋 最新の厳選コードをクリップボードにコピーしました！そのまま貼り付け可能です。`);
} catch (e) {
  console.log(`👉 "${OUTPUT_FILE}" を開いてコピーしてください。`);
}
