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
  "components/dashboard/TodayRangeCard.tsx": "'use client';\n\nimport Link from 'next/link';\n\ninterface TodayRangeCardProps {\n  rangeStart: number | null;\n  rangeEnd: number | null;\n  isReviewDay: boolean;\n  wordbookName: string;\n}\n\nexport function TodayRangeCard({\n  rangeStart,\n  rangeEnd,\n  isReviewDay,\n  wordbookName,\n}: TodayRangeCardProps) {\n  const hasRange = rangeStart !== null && rangeEnd !== null;\n  const wordCount = hasRange ? rangeEnd - rangeStart + 1 : 0;\n\n  return (\n    <div className=\"relative overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm\">\n      <div className=\"flex items-start justify-between\">\n        <div>\n          <span className=\"font-maru text-xs font-medium text-ink/50\">\n            {wordbookName || '単語帳'}\n          </span>\n          <h2 className=\"mt-1 font-mincho text-xl font-bold text-ink\">今日の学習ノルマ</h2>\n        </div>\n        {hasRange && (\n          <span\n            className={`rounded-full border px-3 py-1 font-maru text-xs font-bold shadow-xs ${\n              isReviewDay\n                ? 'border-highlighter bg-highlighter/50 text-ink'\n                : 'border-line bg-paper text-ink/80'\n            }`}\n          >\n            {isReviewDay ? '総復習の日' : '新規進捗'}\n          </span>\n        )}\n      </div>\n\n      <div className=\"my-5 flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-paper py-5 text-center\">\n        {hasRange ? (\n          <>\n            <p className=\"font-mincho text-3xl font-bold tracking-tight text-ink sm:text-4xl\">\n              No.{rangeStart} <span className=\"text-xl font-normal text-ink/40\">〜</span> No.{rangeEnd}\n            </p>\n            <p className=\"mt-1.5 font-maru text-xs font-medium text-ink/60\">\n              本日 {wordCount} 語 {isReviewDay ? '（今週の範囲を総点検）' : '（新規インプット）'}\n            </p>\n          </>\n        ) : (\n          <div className=\"py-2\">\n            <p className=\"font-mincho text-xl font-bold text-ink/70\">今日は休養日、または範囲未設定です</p>\n            <p className=\"mt-1 font-maru text-xs text-ink/40\">上部のボタンから今週のスケジュールを設定してください</p>\n          </div>\n        )}\n      </div>\n\n      {hasRange && (\n        <Link\n          href=\"/test\"\n          className=\"flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-akashiito font-mincho text-base font-bold text-paper shadow-md shadow-akashiito/20 transition active:scale-98\"\n        >\n          今日の学習をはじめる\n        </Link>\n      )}\n    </div>\n  );\n}\n"
};

console.log('🚀 本番テスト画面(/test)への接続修正を適用します...\n');
for (const [filePath, content] of Object.entries(files)) {
  writeFile(filePath, content);
}
console.log('\n✨ 本番テスト画面への接続が完了しました！');
