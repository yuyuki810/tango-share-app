// setup_phase_f7.js
const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function writeFile(filePath, content) {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
  console.log(`[Created/Updated] ${filePath}`);
}

// -----------------------------------------------------------------------------
// 1. マイグレーションSQL: test_answers に streak 追跡カラムを追加
// -----------------------------------------------------------------------------
writeFile(
  'supabase/migrations/20260907_add_streak_tracking_to_test_answers.sql',
  `-- test_answers テーブルに回答修正時の streak 巻き戻し用カラムを追加
ALTER TABLE test_answers ADD COLUMN IF NOT EXISTS streak_before integer;
ALTER TABLE test_answers ADD COLUMN IF NOT EXISTS streak_after integer;

COMMENT ON COLUMN test_answers.streak_before IS '回答前の word_correct_streaks (更新がスキップされた場合は after と同値)';
COMMENT ON COLUMN test_answers.streak_after IS '回答後の word_correct_streaks (更新がスキップされた場合は before と同値)';
`
);

// -----------------------------------------------------------------------------
// 2. app/api/test-sessions/answer/route.ts
//    回答保存時に streak_before / streak_after を記録し、word_correct_streaks を即時更新
// -----------------------------------------------------------------------------
writeFile(
  'app/api/test-sessions/answer/route.ts',
  `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, wordId, isKnown, originDailyAssignmentId = null } = body;

    if (!sessionId || !wordId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // セッションの所有権と未完了ステータス確認
    const { data: session } = await supabase
      .from("test_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session || session.completed_at) {
      return NextResponse.json({ error: "Active session not found" }, { status: 404 });
    }

    const todayJst = getTodayJST();

    // 1. 現在の word_correct_streaks を取得
    const { data: existingStreak } = await supabase
      .from("word_correct_streaks")
      .select("streak_count, last_updated_date")
      .eq("user_id", user.id)
      .eq("word_id", wordId)
      .maybeSingle();

    let streakBefore: number | null = null;
    let streakAfter: number | null = null;
    let shouldUpdateStreak = true;

    // 同一日にすでに更新済みであれば streak 変動はスキップ（同日初回回答ルール）
    if (existingStreak && existingStreak.last_updated_date === todayJst) {
      shouldUpdateStreak = false;
      streakBefore = existingStreak.streak_count;
      streakAfter = existingStreak.streak_count;
    } else {
      streakBefore = existingStreak?.streak_count ?? 0;
      streakAfter = isKnown ? streakBefore + 1 : 0;
    }

    // 2. word_correct_streaks の更新
    if (shouldUpdateStreak) {
      await supabase.from("word_correct_streaks").upsert(
        {
          user_id: user.id,
          word_id: wordId,
          streak_count: streakAfter,
          last_updated_date: todayJst,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" }
      );
    }

    // 3. test_answers に upsert (streak_before / streak_after を保持)
    const { data: existingAnswer } = await supabase
      .from("test_answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("word_id", wordId)
      .maybeSingle();

    if (existingAnswer) {
      await supabase
        .from("test_answers")
        .update({
          is_known: isKnown,
          origin_daily_assignment_id: originDailyAssignmentId,
          streak_before: streakBefore,
          streak_after: streakAfter,
        })
        .eq("id", existingAnswer.id);
    } else {
      await supabase.from("test_answers").insert({
        session_id: sessionId,
        word_id: wordId,
        is_known: isKnown,
        origin_daily_assignment_id: originDailyAssignmentId,
        streak_before: streakBefore,
        streak_after: streakAfter,
      });
    }

    return NextResponse.json({
      success: true,
      streakBefore,
      streakAfter,
      streakUpdated: shouldUpdateStreak,
    });
  } catch (err: any) {
    console.error("Answer saving error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`
);

// -----------------------------------------------------------------------------
// 3. app/api/test-sessions/modify-answer/route.ts (新規作成)
//    直前1問の回答修正API: streak_before への安全な巻き戻しと再計算
// -----------------------------------------------------------------------------
writeFile(
  'app/api/test-sessions/modify-answer/route.ts',
  `import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST } from "@/lib/assignment/weekDates";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, wordId, isKnown } = body;

    if (!sessionId || !wordId || typeof isKnown !== "boolean") {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // セッション所有権 & 未完了チェック
    const { data: session } = await supabase
      .from("test_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session || session.completed_at) {
      return NextResponse.json(
        { error: "テスト完了後の回答は修正できません" },
        { status: 400 }
      );
    }

    // 該当セッションで最も新しく回答されたレコードを取得 (直前1問ガード)
    const { data: latestAnswer, error: answerError } = await supabase
      .from("test_answers")
      .select("id, word_id, is_known, streak_before, streak_after, origin_daily_assignment_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (answerError || !latestAnswer) {
      return NextResponse.json({ error: "修正可能な回答が見つかりません" }, { status: 404 });
    }

    if (latestAnswer.word_id !== wordId) {
      return NextResponse.json(
        { error: "直前の1問のみ修正可能です" },
        { status: 400 }
      );
    }

    const todayJst = getTodayJST();

    // 1. streak の巻き戻しと再計算
    // streak_before と streak_after が異なっていた場合のみ、この回答で streak が変更されていたと判定
    const didUpdateStreak =
      latestAnswer.streak_before !== null &&
      latestAnswer.streak_after !== null &&
      latestAnswer.streak_before !== latestAnswer.streak_after;

    let newStreakAfter = latestAnswer.streak_after;

    if (didUpdateStreak) {
      const baseBefore = latestAnswer.streak_before ?? 0;
      newStreakAfter = isKnown ? baseBefore + 1 : 0;

      // 巻き戻した基準値から新判定で streak を再更新
      await supabase.from("word_correct_streaks").upsert(
        {
          user_id: user.id,
          word_id: wordId,
          streak_count: newStreakAfter,
          last_updated_date: todayJst,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,word_id" }
      );
    }

    // 2. test_answers を修正後の判定と streak_after に更新
    const { error: updateError } = await supabase
      .from("test_answers")
      .update({
        is_known: isKnown,
        streak_after: newStreakAfter,
      })
      .eq("id", latestAnswer.id);

    if (updateError) {
      return NextResponse.json(
        { error: "回答の修正保存に失敗しました", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      wordId,
      isKnown,
      streakBefore: latestAnswer.streak_before,
      streakAfter: newStreakAfter,
    });
  } catch (err: any) {
    console.error("Modify answer error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
`
);

// -----------------------------------------------------------------------------
// 4. components/review/WordJudgeCard.tsx
//    数字の範囲選択バグ解消 (select-none, touch-action: manipulation, pointer-events-none)
// -----------------------------------------------------------------------------
writeFile(
  'components/review/WordJudgeCard.tsx',
  `'use client';

import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

export interface WordCardData {
  wordId: string;
  headword: string;
  pronunciation?: string;
  meaning: string;
  exampleSentence?: string;
  studyCount: number;
  originDailyAssignmentId?: string;
  number?: number;
}

interface WordJudgeCardProps {
  card: WordCardData;
  isTop: boolean;
  stackOffset: number;
  onJudge: (isKnown: boolean) => void;
}

const SWIPE_THRESHOLD_RATIO = 0.25;

function getHeadwordFontSize(word: string): string {
  const len = word.length;
  if (len <= 8) return 'text-5xl sm:text-6xl lg:text-7xl';
  if (len <= 12) return 'text-4xl sm:text-5xl lg:text-6xl';
  if (len <= 16) return 'text-3xl sm:text-4xl lg:text-5xl';
  return 'text-2xl sm:text-3xl lg:text-4xl';
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

  const handleReveal = useCallback(() => {
    if (!isRevealed) {
      setIsRevealed(true);
    }
  }, [isRevealed]);

  const commitJudge = useCallback(
    (isKnown: boolean) => {
      if (exitDirection !== null) return;
      setExitDirection(isKnown ? 'right' : 'left');
      setTimeout(() => onJudge(isKnown), 200);
    },
    [exitDirection, onJudge]
  );

  // キーボードショートカット処理 (Space / W : めくる, A / ← : 不正解, D / S / → : 正解)
  useEffect(() => {
    if (!isTop || exitDirection !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;
      const key = e.key;

      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        key === ' ' ||
        key === 'ArrowUp' ||
        key === 'w' ||
        key === 'W' ||
        key === 'Enter'
      ) {
        e.preventDefault();
        handleReveal();
        return;
      }

      if (
        code === 'ArrowLeft' ||
        code === 'KeyA' ||
        key === 'ArrowLeft' ||
        key === 'a' ||
        key === 'A'
      ) {
        e.preventDefault();
        commitJudge(false);
        return;
      }

      if (
        code === 'ArrowRight' ||
        code === 'KeyD' ||
        code === 'KeyS' ||
        key === 'ArrowRight' ||
        key === 'd' ||
        key === 'D' ||
        key === 's' ||
        key === 'S'
      ) {
        e.preventDefault();
        commitJudge(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTop, exitDirection, handleReveal, commitJudge]);

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

    if (!isRevealed) return;

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

  const studyCountLabel = card.studyCount === 0 ? 'はじめての単語' : \`\${card.studyCount}回目\`;
  const headwordFontSize = getHeadwordFontSize(card.headword);

  const transform = isTop
    ? exitDirection
      ? \`translateX(\${exitDirection === 'right' ? 550 : -550}px) rotate(\${exitDirection === 'right' ? 10 : -10}deg)\`
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
        touchAction: 'manipulation',
      }}
      className={\`absolute inset-0 flex select-none flex-col justify-between rounded-3xl border border-line bg-white p-6 md:p-8 lg:p-10 shadow-lg touch-none \${
        !isRevealed && isTop ? 'cursor-pointer' : ''
      } \${
        isTop && !isDragging
          ? 'transition-[transform,opacity] duration-200 motion-reduce:transition-none'
          : 'transition-none'
      }\`}
    >
      {/* 1. 学習回数バッジ & 単語番号 (テキスト選択バグ防止: select-none + pointer-events-none) */}
      <div className="flex justify-between items-center select-none pointer-events-none">
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs md:text-sm text-ink/60 font-maru">
          {studyCountLabel}
        </span>
        {card.number && (
          <span className="font-mono text-xs text-ink/40 select-none">
            No.{card.number}
          </span>
        )}
      </div>

      {/* ドラッグ中のスタンプ表示 */}
      {isTop && isRevealed && dragX !== 0 && (
        <div
          style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}
          className={\`pointer-events-none select-none absolute top-16 z-20 rounded-xl border-2 px-4 py-1.5 text-sm md:text-base font-bold shadow-sm \${
            dragX > 0
              ? 'right-6 md:right-10 -rotate-12 border-ink text-ink bg-white/90'
              : 'left-6 md:left-10 rotate-12 border-ink/60 text-ink/60 bg-white/90'
          }\`}
        >
          {dragX > 0 ? 'わかった' : 'わからなかった'}
        </div>
      )}

      {/* 2. 単語本体 */}
      <div className="my-auto flex w-full flex-col items-center justify-center gap-2 py-4 text-center select-none pointer-events-none">
        <p
          className={\`w-full font-mincho font-bold text-ink tracking-tight whitespace-nowrap leading-normal py-2 select-none \${headwordFontSize}\`}
        >
          {card.headword}
        </p>
        {card.pronunciation ? (
          <p className="font-maru text-lg sm:text-xl md:text-2xl text-ink/75 tracking-wider select-none">
            /{card.pronunciation}/
          </p>
        ) : (
          <div className="h-7" />
        )}
      </div>

      {/* 3. 下部エリア */}
      <div className="flex flex-col gap-3 md:gap-4 select-none">
        <div className="relative h-24 md:h-28 overflow-hidden rounded-2xl select-none">
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-paper p-3 md:p-4 text-center select-none">
            <p className="font-maru text-base md:text-lg font-bold text-ink leading-snug select-none">
              {card.meaning}
            </p>
            {card.exampleSentence && (
              <p className="mt-1 font-maru text-xs md:text-sm text-ink/50 line-clamp-1 select-none">
                {card.exampleSentence}
              </p>
            )}
          </div>

          <div
            style={{
              transform: isRevealed ? 'translateX(105%) rotate(6deg)' : 'translateX(0)',
            }}
            className={\`absolute inset-0 flex items-center justify-center rounded-2xl bg-akashiito text-sm md:text-base font-bold text-paper shadow-inner transition-transform duration-300 ease-out motion-reduce:transition-none select-none \${
              isRevealed ? 'pointer-events-none' : ''
            }\`}
          >
            タップして確認
          </div>
        </div>

        {/* 4. 判定ボタン */}
        <div
          className={\`flex gap-3 md:gap-4 transition-opacity duration-200 select-none \${
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
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl border border-line bg-white font-medium text-ink/70 transition active:bg-paper hover:bg-paper/50 flex items-center justify-center cursor-pointer shadow-xs select-none"
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
            className="min-h-[56px] md:min-h-[60px] flex-1 rounded-2xl bg-ink font-medium text-paper transition active:opacity-90 hover:bg-ink/90 flex items-center justify-center cursor-pointer shadow-sm select-none"
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

// -----------------------------------------------------------------------------
// 5. components/review/WordJudgeCardScreen.tsx
//    テスト中断ボタン（確認ダイアログ付き）+ 前の回答を修正ボタン + 選択防止
// -----------------------------------------------------------------------------
writeFile(
  'components/review/WordJudgeCardScreen.tsx',
  `'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WordJudgeCard, type WordCardData } from './WordJudgeCard';
import { RotateCcw, AlertCircle, LogOut } from 'lucide-react';

interface WordJudgeCardScreenProps {
  cards: WordCardData[];
  initialIndex?: number;
  initialAnswers?: Map<string, boolean>;
  onJudge?: (wordId: string, isKnown: boolean) => void;
  onModifyJudge?: (wordId: string, isKnown: boolean) => Promise<void> | void;
  onAllDone?: (results: Array<{ wordId: string; isKnown: boolean }>) => void;
  onFinished?: (resultsMap: Map<string, boolean>) => void;
  title?: string;
}

const MAX_STACK_VISIBLE = 3;

export function WordJudgeCardScreen({
  cards,
  initialIndex = 0,
  initialAnswers,
  onJudge,
  onModifyJudge,
  onAllDone,
  onFinished,
  title,
}: WordJudgeCardScreenProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answersMap, setAnswersMap] = useState<Map<string, boolean>>(
    () => new Map(initialAnswers || [])
  );
  const resultsRef = useRef<Map<string, boolean>>(
    new Map(initialAnswers || [])
  );

  // 中断確認ダイアログ表示ステート
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  // 直前1問の修正ステート
  const [isRevising, setIsRevising] = useState(false);
  const [revisionIndex, setRevisionIndex] = useState<number | null>(null);
  const [isModifyLoading, setIsModifyLoading] = useState(false);

  useEffect(() => {
    if (initialAnswers) {
      resultsRef.current = new Map(initialAnswers);
      setAnswersMap(new Map(initialAnswers));
    }
    if (typeof initialIndex === 'number') {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, initialAnswers]);

  const total = cards.length;

  // 通常進行時 vs 修正モード時
  const effectiveIndex = isRevising && revisionIndex !== null ? revisionIndex : currentIndex;
  const remaining = isRevising && revisionIndex !== null
    ? [cards[revisionIndex]]
    : cards.slice(currentIndex, currentIndex + MAX_STACK_VISIBLE);

  // 通常判定
  const handleJudge = (wordId: string, isKnown: boolean) => {
    resultsRef.current.set(wordId, isKnown);
    const updatedMap = new Map(resultsRef.current);
    setAnswersMap(updatedMap);
    onJudge?.(wordId, isKnown);

    const next = currentIndex + 1;
    if (next >= total) {
      const resultsArray = cards.map((c) => ({
        wordId: c.wordId,
        isKnown: updatedMap.get(c.wordId) ?? false,
      }));

      setIsCompleted(true);
      onAllDone?.(resultsArray);
      onFinished?.(updatedMap);
    }
    setCurrentIndex(next);
  };

  // 修正判定の確定
  const handleReviseCommit = async (wordId: string, isKnown: boolean) => {
    setIsModifyLoading(true);
    try {
      resultsRef.current.set(wordId, isKnown);
      setAnswersMap(new Map(resultsRef.current));
      if (onModifyJudge) {
        await onModifyJudge(wordId, isKnown);
      }
    } finally {
      setIsModifyLoading(false);
      setIsRevising(false);
      setRevisionIndex(null);
    }
  };

  // 「前の回答を修正」ボタンの押下処理
  const handleStartRevision = () => {
    if (isRevising || currentIndex <= 0) return;
    const targetIdx = currentIndex - 1;
    setRevisionIndex(targetIdx);
    setIsRevising(true);
  };

  // 全問終了時は結果画面を表示
  if (isCompleted || currentIndex >= total) {
    const correctCount = cards.filter((c) => answersMap.get(c.wordId) ?? false).length;
    const wrongCards = cards.filter((c) => !(answersMap.get(c.wordId) ?? false));
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const isPerfect = wrongCards.length === 0;

    return (
      <div className="flex min-h-[100dvh] flex-col justify-between p-6 md:p-8 lg:p-10 bg-paper animate-in fade-in duration-200 max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
        <div className="space-y-6">
          <div className="text-center pt-4">
            <span className="inline-block rounded-full bg-highlighter/40 px-3 py-1 font-maru text-xs md:text-sm font-bold text-ink mb-2">
              テスト完了 🎉
            </span>
            <h1 className="font-mincho text-2xl md:text-3xl font-bold text-ink">
              {title || 'テスト結果'}
            </h1>
            <p className="mt-1 font-maru text-xs md:text-sm text-ink/60">
              {isPerfect ? '全問正解！素晴らしい成果です' : '間違えた単語を振り返って定着させましょう'}
            </p>

            <div className="mt-5 rounded-3xl border border-line bg-white p-5 md:p-6 shadow-sm text-center">
              <span className="font-maru text-xs md:text-sm text-ink/50 block">正答率</span>
              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                <span className="font-mincho text-4xl md:text-5xl font-bold tracking-tight text-ink">
                  {accuracy}%
                </span>
                <span className="font-maru text-xs md:text-sm font-bold text-ink/50">
                  ({correctCount} / {total}語 正解)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-mincho text-xs md:text-sm font-bold text-ink/60">
                要復習の単語 ({wrongCards.length}語)
              </h2>
            </div>

            {isPerfect ? (
              <div className="rounded-2xl border border-line/60 bg-white p-5 md:p-6 text-center shadow-xs">
                <p className="font-mincho text-sm md:text-base font-bold text-ink/80">ミスした単語はありません 🎯</p>
                <p className="mt-1 font-maru text-xs md:text-sm text-ink/40">この調子で毎日の学習を積み重ねましょう！</p>
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-0.5">
                {wrongCards.map((card) => (
                  <div
                    key={card.wordId}
                    className="flex items-center justify-between rounded-xl border border-line bg-white p-3.5 md:p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mincho text-base md:text-lg font-bold text-ink">{card.headword}</span>
                        {card.pronunciation && (
                          <span className="font-maru text-xs md:text-sm text-ink/40">{card.pronunciation}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-maru text-xs md:text-sm text-ink/70">{card.meaning}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-akashiito-border bg-akashiito/10 px-2.5 py-0.5 font-maru text-[10px] md:text-xs font-bold text-akashiito">
                      要復習
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 pb-2">
          <Link
            href="/dashboard"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink font-mincho text-base font-bold text-paper shadow-md transition active:scale-[0.98] hover:bg-ink/90"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const canRevise = currentIndex > 0 && !isRevising;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col justify-between overflow-hidden max-w-md md:max-w-xl lg:max-w-2xl mx-auto w-full select-none">
      {/* 上部ヘッダー操作部: [中断ボタン] [修正中バッジ/前の回答を修正] [プログレス] */}
      <div className="px-4 pb-2 pt-3 shrink-0 space-y-2 select-none" style={{ touchAction: 'manipulation' }}>
        <div className="flex items-center justify-between">
          {/* 1. 中断ボタン */}
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line/80 bg-white/90 px-3 py-1 font-maru text-xs text-ink/60 transition active:scale-95 hover:text-ink cursor-pointer shadow-2xs"
            aria-label="テストを中断する"
          >
            <LogOut className="h-3 w-3 text-ink/40" />
            <span>中断</span>
          </button>

          {/* 2. 前の回答を修正ボタン / 修正中表示 */}
          {isRevising ? (
            <div className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-maru text-xs font-bold text-amber-900 shadow-2xs">
              <RotateCcw className="h-3 w-3 text-amber-600 animate-spin-once" />
              <span>直前の回答を修正中</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canRevise}
              onClick={handleStartRevision}
              className={\`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 font-maru text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs \${
                canRevise
                  ? 'border-line bg-white text-ink/75 hover:bg-paper hover:text-ink'
                  : 'border-transparent text-ink/20 pointer-events-none'
              }\`}
              aria-label="直前の1問の回答を修正する"
            >
              <RotateCcw className="h-3 w-3 text-ink/40" />
              <span>前の回答を修正</span>
            </button>
          )}

          {/* 3. 進捗カウンター */}
          <span className="font-mono text-xs text-ink/60 font-bold select-none pointer-events-none">
            {effectiveIndex + 1}/{total}
          </span>
        </div>

        {/* プログレスバー */}
        <div className="h-1.5 md:h-2 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: \`\${((effectiveIndex) / total) * 100}%\` }}
          />
        </div>

        {/* デスクトップ用キー操作ガイド (HUD) */}
        <div className="hidden sm:flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 text-[11px] font-mono text-ink/70 whitespace-nowrap bg-white/90 px-3 py-0.5 rounded-full border border-line shadow-2xs select-none">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">Space</kbd>
              <span className="font-maru text-[10px] text-ink/50">めくる</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">A</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">←</kbd>
              <span className="font-bold text-akashiito text-[11px] ml-0.5">✕</span>
            </div>
            <span className="text-line">|</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">D</kbd>
              <span className="text-ink/30 text-[9px]">·</span>
              <kbd className="px-1.5 py-0.2 rounded border border-line bg-paper text-[10px] font-bold text-ink">→</kbd>
              <span className="font-bold text-emerald-600 text-[11px] ml-0.5">◯</span>
            </div>
          </div>
        </div>
      </div>

      {/* カードスタック領域 */}
      <div className="relative flex-1 px-4 pb-6 pt-2">
        {remaining.map((card, i) => (
          <WordJudgeCard
            key={\`\${card.wordId}-\${isRevising ? 'rev' : 'norm'}\`}
            card={card}
            isTop={i === 0}
            stackOffset={i}
            onJudge={(isKnown) => {
              if (isRevising) {
                handleReviseCommit(card.wordId, isKnown);
              } else {
                handleJudge(card.wordId, isKnown);
              }
            }}
          />
        ))}
      </div>

      {/* 中断確認モーダル (誤タップ完全防止) */}
      {showSuspendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowSuspendModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-line bg-paper p-5 shadow-xl space-y-4 text-left animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-ink">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-line/30 text-ink/70">
                <AlertCircle className="h-4 w-4" />
              </div>
              <h3 className="font-mincho text-base font-bold text-ink">
                テストを中断しますか？
              </h3>
            </div>

            <p className="font-maru text-xs text-ink/70 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-line/60">
              ここまでの回答は<strong>すべて保存されています</strong>。ダッシュボードからいつでも続きを再開できます。
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white font-maru text-xs font-medium text-ink/70 transition active:scale-98 cursor-pointer hover:bg-paper"
              >
                続ける
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
              >
                中断する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`
);

// -----------------------------------------------------------------------------
// 6. components/test/TestSessionRunner.tsx
//    回答修正ハンドラー (handleModifyJudge) を配線
// -----------------------------------------------------------------------------
writeFile(
  'components/test/TestSessionRunner.tsx',
  `'use client';

import { useState, useEffect, useRef } from 'react';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';
import { ChunkSummaryScreen, type ChunkResultItem } from '@/components/weakness/ChunkSummaryScreen';
import { TestResultScreen } from '@/components/test/TestResultScreen';
import type { ReviewChunkSummaryInfo } from '@/lib/test/getTodayTestWords';
import { RefreshCw, Play, RotateCcw } from 'lucide-react';

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string | null;
  sessionType: 'daily_check' | 'normal';
  isReviewDay?: boolean;
  reviewChunks?: ReviewChunkSummaryInfo[];
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
  isReviewDay = false,
  reviewChunks = [],
}: TestSessionRunnerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<{
    answeredCount: number;
    answeredMap: Map<string, boolean>;
  } | null>(null);

  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAnswers, setInitialAnswers] = useState<Map<string, boolean>>(new Map());
  const pendingAnswersQueue = useRef<Array<{ wordId: string; isKnown: boolean }>>([]);

  const [resultData, setResultData] = useState<{
    correctCount: number;
    totalCount: number;
    wrongCards: WordCardData[];
    chunkResults?: ChunkResultItem[];
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean;
    isSuccess: boolean;
    errorMessage?: string;
    detail?: string;
    savedCount?: number;
  }>({
    isSaving: false,
    isSuccess: false,
  });

  // 1. セッション初期化 (/api/test-sessions/start)
  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);

    fetch('/api/test-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: sessionType,
        dailyAssignmentId,
        totalCount: cards.length,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          const currentId = data.session.id;
          setSessionId(currentId);
          sessionIdRef.current = currentId;

          if (pendingAnswersQueue.current.length > 0) {
            pendingAnswersQueue.current.forEach((item) => {
              const matchedCard = cards.find((c) => c.wordId === item.wordId);
              fetch('/api/test-sessions/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: currentId,
                  wordId: item.wordId,
                  isKnown: item.isKnown,
                  originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
                }),
              }).catch((e) => console.error('Queue flush error:', e));
            });
            pendingAnswersQueue.current = [];
          }

          if (data.mode === 'resume' && data.answeredWords && data.answeredWords.length > 0) {
            const answeredMap = new Map<string, boolean>();
            data.answeredWords.forEach((a: any) => {
              answeredMap.set(a.wordId, a.isKnown);
            });

            if (data.answeredWords.length < cards.length) {
              setResumePrompt({
                answeredCount: data.answeredWords.length,
                answeredMap,
              });
            } else {
              setInitialAnswers(answeredMap);
              setInitialIndex(cards.length);
            }
          }
        } else {
          console.error('Failed to start session:', data.error);
        }
      })
      .catch((err) => {
        console.error('Start session request error:', err);
      })
      .finally(() => {
        if (isMounted) setIsInitializing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionType, dailyAssignmentId, cards.length]);

  // 2. 単語判定のたびに即座に都度保存
  const handleSingleJudge = (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    const matchedCard = cards.find((c) => c.wordId === wordId);

    if (!currentId) {
      pendingAnswersQueue.current.push({ wordId, isKnown });
      return;
    }

    fetch('/api/test-sessions/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        wordId,
        isKnown,
        originDailyAssignmentId: matchedCard?.originDailyAssignmentId || dailyAssignmentId,
      }),
    }).catch((err) => {
      console.error('Answer streaming error:', err);
    });
  };

  // 3. 一つ前の回答修正ハンドラー (/api/test-sessions/modify-answer)
  const handleModifyJudge = async (wordId: string, isKnown: boolean) => {
    const currentId = sessionIdRef.current;
    if (!currentId) return;

    try {
      const res = await fetch('/api/test-sessions/modify-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentId,
          wordId,
          isKnown,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to modify answer:', data.error);
      }
    } catch (err) {
      console.error('Modify answer request error:', err);
    }
  };

  // 4. 全問終了時のセッション完了確定処理 (正答率ベースでサマリー判定)
  const handleFinished = (resultsMap: Map<string, boolean>) => {
    const currentId = sessionIdRef.current;
    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: resultsMap.get(c.wordId) ?? false,
      originDailyAssignmentId: c.originDailyAssignmentId || dailyAssignmentId,
    }));

    const correctCount = results.filter((r) => r.isKnown).length;
    const totalCount = results.length;
    const wrongCards = cards.filter((c) => !(resultsMap.get(c.wordId) ?? false));

    if (isReviewDay && reviewChunks.length > 0) {
      const chunkResults: ChunkResultItem[] = reviewChunks.map((rc) => {
        const chunkCards = cards.filter(
          (c) =>
            c.originDailyAssignmentId === rc.chunkId ||
            (typeof c.number === 'number' &&
              c.number >= rc.rangeStart &&
              c.number <= rc.rangeEnd)
        );
        const cTotal = chunkCards.length;
        const cCorrect = chunkCards.filter((c) => resultsMap.get(c.wordId) ?? false).length;
        const cAccuracy = cTotal > 0 ? Math.round((cCorrect / cTotal) * 100) : 0;

        let status: 'improved' | 'same' | 'worse' | 'first' = 'first';
        if (rc.prevAccuracyRate !== null) {
          const diff = cAccuracy - rc.prevAccuracyRate;
          if (diff >= 10) {
            status = 'improved';
          } else if (diff <= -10) {
            status = 'worse';
          } else {
            status = 'same';
          }
        } else {
          status = 'first';
        }

        return {
          chunkId: rc.chunkId,
          rangeStart: rc.rangeStart,
          rangeEnd: rc.rangeEnd,
          originDate: rc.originDate,
          correctCount: cCorrect,
          totalCount: cTotal,
          accuracyRate: cAccuracy,
          prevAccuracyRate: rc.prevAccuracyRate,
          status,
        };
      });

      setResultData({
        correctCount,
        totalCount,
        wrongCards,
        chunkResults,
      });
    } else {
      setResultData({
        correctCount,
        totalCount,
        wrongCards,
      });
    }

    setSaveStatus({ isSaving: true, isSuccess: false });

    fetch('/api/test-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentId,
        results,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setSaveStatus({
            isSaving: false,
            isSuccess: true,
            savedCount: data.savedAnswersCount ?? results.length,
          });
        } else {
          setSaveStatus({
            isSaving: false,
            isSuccess: false,
            errorMessage: data.error || '保存エラー',
            detail: data.detail || \`HTTP \${res.status}\`,
          });
        }
      })
      .catch((err) => {
        console.error('Error completing test session:', err);
        setSaveStatus({
          isSaving: false,
          isSuccess: false,
          errorMessage: '通信エラー',
          detail: err?.message || String(err),
        });
      });
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-ink/60 font-maru select-none">
        <RefreshCw className="h-6 w-6 animate-spin text-ink/40" />
        <p className="text-xs">テストを準備中...</p>
      </div>
    );
  }

  if (resumePrompt) {
    const isDailyCheck = sessionType === 'daily_check';
    return (
      <div className="mx-auto flex min-h-[85vh] max-w-md md:max-w-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 select-none">
        <div className="w-full rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-300">
            <RotateCcw className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-mincho text-xl font-bold text-ink">
              前回の続きから再開しますか？
            </h2>
            <p className="mt-1.5 font-maru text-xs text-ink/60 leading-relaxed">
              前回の中断データが見つかりました。<br />
              <strong className="text-ink font-bold">
                {resumePrompt.answeredCount} / {cards.length} 語
              </strong> まで回答済みです。
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setInitialAnswers(resumePrompt.answeredMap);
                setInitialIndex(resumePrompt.answeredCount);
                setResumePrompt(null);
              }}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-ink font-mincho text-sm font-bold text-paper shadow-sm transition active:scale-98 cursor-pointer hover:bg-ink/90"
            >
              <Play className="h-4 w-4 fill-paper" />
              <span>続きから再開する（{resumePrompt.answeredCount + 1}問目〜）</span>
            </button>

            {!isDailyCheck ? (
              <button
                type="button"
                onClick={() => {
                  setInitialAnswers(new Map());
                  setInitialIndex(0);
                  setResumePrompt(null);
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line bg-paper font-maru text-xs font-medium text-ink/70 transition hover:bg-paper-hover active:scale-98 cursor-pointer"
              >
                最初からやり直す
              </button>
            ) : (
              <p className="font-maru text-[11px] text-ink/40 pt-1">
                ※ 本番チェックは1日1回限定のため、続きからのみ受験可能です
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resultData) {
    if (isReviewDay && resultData.chunkResults) {
      return (
        <ChunkSummaryScreen
          totalCorrect={resultData.correctCount}
          totalCount={resultData.totalCount}
          chunkResults={resultData.chunkResults}
        />
      );
    }

    return (
      <TestResultScreen
        correctCount={resultData.correctCount}
        totalCount={resultData.totalCount}
        wrongCards={resultData.wrongCards}
        sessionType={sessionType}
        saveStatus={saveStatus}
      />
    );
  }

  return (
    <WordJudgeCardScreen
      cards={cards}
      initialIndex={initialIndex}
      initialAnswers={initialAnswers}
      onJudge={handleSingleJudge}
      onModifyJudge={handleModifyJudge}
      onFinished={handleFinished}
      title={sessionType === 'daily_check' ? '本日のテスト結果' : '苦手克服テスト結果'}
    />
  );
}
`
);

console.log('\\n✨ [フェーズF-7] 全ファイルの生成・更新が完了しました。');