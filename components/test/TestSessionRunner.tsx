'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';

interface TestSessionRunnerProps {
  cards: WordCardData[];
  dailyAssignmentId: string;
  sessionType: 'daily_check' | 'normal';
}

export function TestSessionRunner({
  cards,
  dailyAssignmentId,
  sessionType,
}: TestSessionRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJudge = (wordId: string, isKnown: boolean) => {
    setAnswers((prev) => new Map(prev).set(wordId, isKnown));
  };

  const handleAllDone = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const results = cards.map((c) => ({
      wordId: c.wordId,
      isKnown: answers.get(c.wordId) ?? false,
    }));

    try {
      const res = await fetch('/api/test-sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyAssignmentId,
          type: sessionType,
          results,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save test session');
      }
    } catch (err) {
      console.error('Error submitting test session', err);
    } finally {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <WordJudgeCardScreen
      cards={cards}
      onJudge={handleJudge}
      onAllDone={handleAllDone}
    />
  );
}
