/**
 * setup_phase3_ui.js
 * 
 * 単語判定カード画面(わかる/わからない) UI先行実装
 * 
 * [今回の改善点]
 * - スワイプ判定スタンプ（「わからなかった」「わかった」）を学習回数バッジの下(top-16)へオフセット配置し、バッジとの重なりを完全解消
 * - 英単語のディセンダー見切れ防止、発音記号の視認性向上、奥のカード静止によるブレ解消、動的フォントサイズ等を維持
 */

const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trimStart(), 'utf8');
  console.log(`  [CREATED/UPDATED] ${filePath}`);
}

console.log('🚀 単語判定カードUI先行実装ファイル（スタンプ配置改善版）の生成を開始します...\n');

// 1. components/review/WordJudgeCard.tsx
writeFile(
  'components/review/WordJudgeCard.tsx',
  `'use client';

import { useState, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface WordCardData {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  exampleSentence?: string;
  studyCount: number; // これまでの学習回数(0 = 初めて)
}

interface WordJudgeCardProps {
  card: WordCardData;
  isTop: boolean; // スタックの一番手前かどうか(操作を受け付けるのは一番手前のみ)
  stackOffset: number; // 0 = 一番手前, 1 = 1枚奥, ...
  onJudge: (isKnown: boolean) => void;
}

const SWIPE_THRESHOLD_RATIO = 0.25;

/** 文字数に応じた動的フォントサイズ（改行を防止しつつ最大限大きく表示） */
function getHeadwordFontSize(word: string): string {
  const len = word.length;
  if (len <= 8) return 'text-5xl sm:text-6xl';
  if (len <= 12) return 'text-4xl sm:text-5xl';
  if (len <= 16) return 'text-3xl sm:text-4xl';
  return 'text-2xl sm:text-3xl';
}

export function WordJudgeCard({ card, isTop, stackOffset, onJudge }: WordJudgeCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isPointerDown = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleReveal = () => {
    if (!isRevealed) {
      setIsRevealed(true);
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTop || exitDirection !== null) return;
    if ((e.target as HTMLElement).closest('button[data-action="judge"]')) return;

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    isPointerDown.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || dragStartX.current === null) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - (dragStartY.current ?? e.clientY);

    // 未開示状態のときはスワイプさせずタップ判定待機
    if (!isRevealed) return;

    // 水平方向への明確なドラッグを検知
    if (!isDragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragX(deltaX);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;

    const deltaX = dragStartX.current !== null ? e.clientX - dragStartX.current : 0;
    const deltaY = dragStartY.current !== null ? e.clientY - dragStartY.current : 0;
    const isTap = Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10;

    // カードのどこをタップしても開示
    if (!isRevealed && isTap) {
      handleReveal();
    } else if (isRevealed && isDragging) {
      const width = cardRef.current?.offsetWidth ?? 320;
      if (Math.abs(dragX) > width * SWIPE_THRESHOLD_RATIO) {
        commitJudge(dragX > 0);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }

    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartX.current = null;
    dragStartY.current = null;
    isPointerDown.current = false;
    setIsDragging(false);
    setDragX(0);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const commitJudge = (isKnown: boolean) => {
    setExitDirection(isKnown ? 'right' : 'left');
    setTimeout(() => onJudge(isKnown), 200);
  };

  const studyCountLabel = card.studyCount === 0 ? 'はじめての単語' : \`\${card.studyCount}回目\`;
  const headwordFontSize = getHeadwordFontSize(card.headword);

  // 文字のぼやけ防止: 手前のカードのみ移動し、奥のカードは定位置で静止
  const transform = isTop
    ? exitDirection
      ? \`translateX(\${exitDirection === 'right' ? 450 : -450}px) rotate(\${exitDirection === 'right' ? 8 : -8}deg)\`
      : \`translateX(\${dragX}px) rotate(\${dragX * 0.02}deg)\`
    : 'none';

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform,
        zIndex: 10 - stackOffset,
        opacity: exitDirection ? 0 : 1,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      className={\`absolute inset-0 flex select-none flex-col justify-between rounded-3xl border border-line bg-white p-6 shadow-lg touch-none \${
        !isRevealed && isTop ? 'cursor-pointer' : ''
      } \${
        isTop && !isDragging
          ? 'transition-[transform,opacity] duration-200 motion-reduce:transition-none'
          : 'transition-none'
      }\`}
    >
      {/* 1. 学習回数バッジ */}
      <div className="flex justify-start">
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink/60">
          {studyCountLabel}
        </span>
      </div>

      {/* ドラッグ中のスタンプ表示（学習回数バッジと被らないよう top-16 へオフセット配置） */}
      {isTop && isRevealed && dragX !== 0 && (
        <div
          style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}
          className={\`pointer-events-none absolute top-16 z-20 rounded-lg border-2 px-3 py-1 text-sm font-bold \${
            dragX > 0 ? 'right-6 -rotate-12 border-ink text-ink' : 'left-6 rotate-12 border-ink/50 text-ink/50'
          }\`}
        >
          {dragX > 0 ? 'わかった' : 'わからなかった'}
        </div>
      )}

      {/* 2. 単語本体（見切れ防止パディング + 発音記号クッキリ表示） */}
      <div className="my-auto flex w-full flex-col items-center justify-center gap-1.5 py-2 text-center">
        <p
          className={\`w-full font-mincho font-bold text-ink tracking-tight whitespace-nowrap leading-normal py-2 \${headwordFontSize}\`}
        >
          {card.headword}
        </p>
        {card.pronunciation ? (
          <p className="font-maru text-lg sm:text-xl text-ink/75 tracking-wider">
            /{card.pronunciation}/
          </p>
        ) : (
          <div className="h-7" />
        )}
      </div>

      {/* 3. 下部エリア（意味 + 判定ボタン） */}
      <div className="flex flex-col gap-3">
        {/* 意味エリア + 赤シート */}
        <div className="relative h-24 overflow-hidden rounded-2xl">
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-paper p-3 text-center">
            <p className="font-maru text-base font-bold text-ink leading-snug">{card.meaning}</p>
            {card.exampleSentence && (
              <p className="mt-1 font-maru text-xs text-ink/50 line-clamp-1">{card.exampleSentence}</p>
            )}
          </div>

          <div
            style={{
              transform: isRevealed ? 'translateX(105%) rotate(6deg)' : 'translateX(0)',
            }}
            className={\`absolute inset-0 flex items-center justify-center rounded-2xl bg-akashiito text-sm font-bold text-paper shadow-inner transition-transform duration-300 ease-out motion-reduce:transition-none \${
              isRevealed ? 'pointer-events-none' : ''
            }\`}
          >
            タップして確認
          </div>
        </div>

        {/* 4. 判定ボタン（最初から領域を確保しレイアウトシフトを完全排除） */}
        <div
          className={\`flex gap-3 transition-opacity duration-200 \${
            isRevealed && isTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }\`}
        >
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(false);
            }}
            className="min-h-[56px] flex-1 rounded-2xl border border-line bg-white font-medium text-ink/70 transition active:bg-paper"
          >
            わからなかった
          </button>
          <button
            type="button"
            data-action="judge"
            tabIndex={isRevealed && isTop ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              commitJudge(true);
            }}
            className="min-h-[56px] flex-1 rounded-2xl bg-ink font-medium text-paper transition active:opacity-90"
          >
            わかった
          </button>
        </div>
      </div>
    </div>
  );
}
`
);

// 2. components/review/WordJudgeCardScreen.tsx
writeFile(
  'components/review/WordJudgeCardScreen.tsx',
  `'use client';

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
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-mincho text-2xl font-bold text-ink">おつかれさま!</p>
        <p className="font-maru text-sm text-ink/60">{total}語の判定が終わりました</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 上部プログレスバー */}
      <div className="px-4 pb-2 pt-4">
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
`
);

// 3. app/(main)/review-preview/page.tsx
writeFile(
  'app/(main)/review-preview/page.tsx',
  `'use client';

import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';

const MOCK_CARDS: WordCardData[] = [
  {
    wordId: '1',
    headword: 'cat',
    pronunciation: 'kæt',
    meaning: '猫',
    exampleSentence: 'I have a cat.',
    studyCount: 0,
  },
  {
    wordId: '2',
    headword: 'benefit',
    pronunciation: 'ˈbenɪfɪt',
    meaning: '利益、恩恵',
    exampleSentence: 'It will benefit everyone.',
    studyCount: 2,
  },
  {
    wordId: '3',
    headword: 'consequence',
    pronunciation: 'ˈkɑːnsəkwens',
    meaning: '結果、影響',
    exampleSentence: 'Consider the consequences.',
    studyCount: 5,
  },
  {
    wordId: '4',
    headword: 'characteristically',
    pronunciation: 'ˌkærəktəˈrɪstɪkli',
    meaning: '特徴的に、相変わらず',
    studyCount: 1,
  },
  {
    wordId: '5',
    headword: 'abandon',
    pronunciation: 'əˈbændən',
    meaning: '〜を捨てる、放棄する',
    exampleSentence: 'He abandoned the plan.',
    studyCount: 3,
  },
  {
    wordId: '6',
    headword: 'diminish',
    pronunciation: 'dɪˈmɪnɪʃ',
    meaning: '減少する、弱める',
    studyCount: 0,
  },
  {
    wordId: '7',
    headword: 'genuine',
    pronunciation: 'ˈdʒenjuɪn',
    meaning: '本物の、心からの',
    studyCount: 4,
  },
  {
    wordId: '8',
    headword: 'fluctuate',
    pronunciation: 'ˈflʌktʃueɪt',
    meaning: '変動する',
    studyCount: 1,
  },
  {
    wordId: '9',
    headword: 'illustrate',
    pronunciation: 'ˈɪləstreɪt',
    meaning: '説明する、示す',
    studyCount: 2,
  },
  {
    wordId: '10',
    headword: 'justify',
    pronunciation: 'ˈdʒʌstɪfaɪ',
    meaning: '正当化する',
    studyCount: 0,
  },
];

export default function ReviewPreviewPage() {
  return (
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
      <WordJudgeCardScreen
        cards={MOCK_CARDS}
        onJudge={(wordId, isKnown) => {
          console.log('judged', wordId, isKnown);
        }}
        onAllDone={() => {
          console.log('all done');
        }}
      />
    </main>
  );
}
`
);

console.log('\n✨ 単語判定カードUI先行実装ファイル（スタンプ配置改善版）の生成が完了しました！');