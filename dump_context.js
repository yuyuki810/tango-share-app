const fs = require('fs');
const path = require('path');

// 収集対象ディレクトリ
const targetDirs = ['lib', 'components', 'app'];
const ignorePatterns = ['.next', 'node_modules', '.git', '.DS_Store'];

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (ignorePatterns.includes(item)) continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.sql')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = targetDirs.flatMap(d => scanDir(path.join(process.cwd(), d)));

let output = '=== CURRENT PROJECT CODE DUMP ===\n\n';
for (const file of files) {
  const relPath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf8');
  output += `// ==========================================\n// FILE: ${relPath}\n// ==========================================\n${content}\n\n`;
}

fs.writeFileSync('project_context.txt', output, 'utf8');
console.log(`[Success] ${files.length} files dumped to project_context.txt`);
