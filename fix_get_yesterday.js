const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname, { recursive: true });
}

function writeFile(relativeFilePath, content) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  ensureDirectoryExistence(fullPath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`  [UPDATED] ${relativeFilePath}`);
}

const files = {
  "lib/assignment/weekDates.ts": "/**\n * 日本時間(Asia/Tokyo)基準の日付計算ユーティリティ\n * 週のサイクルは「土曜日始まり・金曜日終わり」の7日間\n */\n\nexport function getTodayJST(): string {\n  const now = new Date();\n  return now.toLocaleString('en-CA', {\n    timeZone: 'Asia/Tokyo',\n    year: 'numeric',\n    month: '2-digit',\n    day: '2-digit',\n  });\n}\n\n/** 指定日(YYYY-MM-DD)の前日(-1日)の日付(YYYY-MM-DD)を返す */\nexport function getYesterday(dateStr: string): string {\n  const [y, m, d] = dateStr.split('-').map(Number);\n  const date = new Date(Date.UTC(y, m - 1, d));\n  date.setUTCDate(date.getUTCDate() - 1);\n  return date.toISOString().slice(0, 10);\n}\n\n/** 指定日(YYYY-MM-DD)が属する「土曜始まりの週」の土曜日の日付を返す */\nexport function getSaturdayOf(dateStr: string): string {\n  const [y, m, d] = dateStr.split('-').map(Number);\n  const date = new Date(Date.UTC(y, m - 1, d));\n  const dayOfWeek = date.getUTCDay(); // 0=日, 1=月, ..., 6=土\n  date.setUTCDate(date.getUTCDate() - ((dayOfWeek + 1) % 7));\n  return date.toISOString().slice(0, 10);\n}\n\nexport function getThisWeekSaturdayJST(): string {\n  return getSaturdayOf(getTodayJST());\n}\n\n/** 指定土曜日の1週間前(-7日)の土曜日を返す */\nexport function getPreviousSaturday(saturdayStr: string): string {\n  const [y, m, d] = saturdayStr.split('-').map(Number);\n  const date = new Date(Date.UTC(y, m - 1, d));\n  date.setUTCDate(date.getUTCDate() - 7);\n  return date.toISOString().slice(0, 10);\n}\n\n/** 土曜日から金曜日までの7日分の日付配列(YYYY-MM-DD)を返す */\nexport function getWeekDates(saturdayStr: string): string[] {\n  const [y, m, d] = saturdayStr.split('-').map(Number);\n  const saturday = new Date(Date.UTC(y, m - 1, d));\n  const dates: string[] = [];\n  for (let i = 0; i < 7; i++) {\n    const dt = new Date(saturday);\n    dt.setUTCDate(saturday.getUTCDate() + i);\n    dates.push(dt.toISOString().slice(0, 10));\n  }\n  return dates;\n}\n"
};

console.log('🚀 getYesterday のエクスポート追加を適用します...\n');
for (const [filePath, content] of Object.entries(files)) {
  writeFile(filePath, content);
}
console.log('\n✨ 修正が完了しました！');
