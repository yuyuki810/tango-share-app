const fs = require('fs');
const path = require('path');

function writeFile(relativeFilePath, content) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`  [UPDATED] ${relativeFilePath}`);
}

// 1. BottomNav.tsx (テスト画面・プレビュー画面では非表示にする)
const bottomNavContent = `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  // テスト中・単語カードめくり中は下部ナビを隠して全画面で集中させる
  if (pathname.startsWith('/test') || pathname.startsWith('/review-preview')) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: '📖' },
    { href: '/review-preview', label: '単語カード', icon: '📇' },
    { href: '/history', label: '学習記録', icon: '📈' },
    { href: '/settings', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={\`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-95 \${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }\`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
`;

// 2. WordJudgeCardScreen.tsx (画面全体の高さを固定し下部に適切なセーフエリア余白を確保)
const screenContent = `'use client';

import { useState } from 'react';
import { WordJudgeCard, type WordCardData } from './WordJudgeCard';

interface WordJudgeCardScreenProps {
  cards: WordCardData[];
  onJudge: (wordId: string, isKnown: boolean) => void;
  onAllDone?: () => void;
}

const MAX_STACK_VISIBLE = 3;

export function WordJudgeCardScreen({ cards, onJudge, onAllDone }: WordJudgeCardScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = cards.length;
  const remaining = cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    onJudge(wordId, isKnown);
    const next = currentIndex + 1;
    if (next >= total) {
      onAllDone?.();
    }
    setCurrentIndex(next);
  };

  if (currentIndex >= total) {
    return (
      <div className="flex h-full min-h-[85vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-mincho text-2xl font-bold text-ink">おつかれさま!</p>
        <p className="font-maru text-sm text-ink/60">{total}語の判定が終わりました</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden">
      {/* 上部プログレスバー */}
      <div className="px-4 pb-2 pt-4 shrink-0">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: \`\${(currentIndex / total) * 100}%\` }}
          />
        </div>
        <p className="mt-1 font-maru text-right text-xs text-ink/40">
          {currentIndex}/{total}
        </p>
      </div>

      {/* カードスタック領域 */}
      <div className="relative flex-1 px-4 pb-6 pt-2">
        {remaining.map((card, i) => (
          <WordJudgeCard
            key={card.wordId}
            card={card}
            isTop={i === 0}
            stackOffset={i}
            onJudge={(isKnown) => handleJudge(card.wordId, isKnown)}
          />
        ))}
      </div>
    </div>
  );
}
`;

writeFile('components/layout/BottomNav.tsx', bottomNavContent);
writeFile('components/review/WordJudgeCardScreen.tsx', screenContent);
console.log('\n✨ テスト中のナビゲーションバー重なり改善を適用しました！');
