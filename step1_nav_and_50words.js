const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[Updated] ${filePath}`);
}

// 1. components/weekly-range/WeeklyRangeModal.tsx (初期値50問)
const modalPath = 'components/weekly-range/WeeklyRangeModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');
modalContent = modalContent.replace(
  /initialPerDayCount\s*\?\?\s*20/g,
  'initialPerDayCount ?? 50'
);
writeFile(modalPath, modalContent);

// 2. components/weekly-range/CycleSettingsPanel.tsx (50問中心のチップ)
const panelPath = 'components/weekly-range/CycleSettingsPanel.tsx';
let panelContent = fs.readFileSync(panelPath, 'utf8');
panelContent = panelContent.replace(
  /const PER_DAY_CHIPS = \[10, 15, 20, 25, 30, 50\];/g,
  'const PER_DAY_CHIPS = [20, 30, 40, 50, 75, 100];'
);
panelContent = panelContent.replace(
  /<p className="mb-1\.5 font-maru text-xs font-medium text-ink\/60">1日の単語数<\/p>/g,
  '<p className="mb-1.5 font-maru text-xs font-medium text-ink/60">1日の単語数 (標準50語)</p>'
);
writeFile(panelPath, panelContent);

// 3. components/test/TestResultScreen.tsx (backUrl & backLabel 対応)
const resultPath = 'components/test/TestResultScreen.tsx';
let resultContent = fs.readFileSync(resultPath, 'utf8');
if (!resultContent.includes('backUrl?: string;')) {
  resultContent = resultContent.replace(
    /saveStatus\?: \{[\s\S]*?\};\n\}/,
    match => `${match.slice(0, -1)}  backUrl?: string;\n  backLabel?: string;\n}`
  );
  resultContent = resultContent.replace(
    /saveStatus,\n\}: TestResultScreenProps/,
    `saveStatus,\n  backUrl = '/dashboard',\n  backLabel = 'ダッシュボードへ戻る',\n}: TestResultScreenProps`
  );
  resultContent = resultContent.replace(
    /<Link\s+href="\/dashboard"\s+className="flex min-h-\[52px\][\s\S]*?>\s*ダッシュボードへ戻る\s*<\/Link>/,
    `<Link\n          href={backUrl}\n          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"\n        >\n          {backLabel}\n        </Link>`
  );
  writeFile(resultPath, resultContent);
}

// 4. components/review/WordJudgeCardScreen.tsx (中断ボタン・完了ボタンの backUrl 対応)
const screenPath = 'components/review/WordJudgeCardScreen.tsx';
let screenContent = fs.readFileSync(screenPath, 'utf8');
if (!screenContent.includes('backUrl?: string;')) {
  screenContent = screenContent.replace(
    /title\?: string;\n\}/,
    `title?: string;\n  backUrl?: string;\n  backLabel?: string;\n}`
  );
  screenContent = screenContent.replace(
    /title,\n\}: WordJudgeCardScreenProps/,
    `title,\n  backUrl = '/dashboard',\n  backLabel = 'ダッシュボードへ戻る',\n}: WordJudgeCardScreenProps`
  );
  // 中断モーダルの遷移先
  screenContent = screenContent.replace(
    /onClick=\{\(\) => router\.push\('\/dashboard'\)\}/g,
    `onClick={() => router.push(backUrl)}`
  );
  // テスト完了画面の遷移先
  screenContent = screenContent.replace(
    /<Link\s+href="\/dashboard"\s+className="flex min-h-\[52px\][\s\S]*?>\s*ダッシュボードへ戻る\s*<\/Link>/,
    `<Link\n            href={backUrl}\n            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"\n          >\n            {backLabel}\n          </Link>`
  );
  writeFile(screenPath, screenContent);
}

console.log('✅ ステップ1 (弱点マップ戻り先 & 50問化) の更新が完了しました。');
