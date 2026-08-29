import { ReviewQueueItem } from './types';

interface DueReviewItem {
  id: string;
  stage: number;
  ease_factor: number;
  wrong_count: number;
  interval_days: number;
  words: {
    id: string;
    word: string;
    meaning: string;
    pronunciation?: string | null;
    example_sentences?: Array<{ text: string; translation?: string | null }>;
  };
}

interface NewWordCandidate {
  id: string;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  example_sentences?: Array<{ text: string; translation?: string | null }>;
}

export function generate4Choices(
  correctMeaning: string,
  distractorPool: string[]
): { choices: string[]; correctChoiceIndex: number } {
  const filtered = distractorPool.filter((m) => m && m !== correctMeaning);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const selectedDistractors = shuffled.slice(0, 3);

  const fallback = [
    '考慮する・検討する',
    '維持する・継続する',
    '達成する・成し遂げる',
    '要求する・必要とする',
    '改善する・向上させる',
  ];
  let fallbackIdx = 0;
  while (selectedDistractors.length < 3) {
    const candidate = fallback[fallbackIdx % fallback.length];
    if (candidate !== correctMeaning && !selectedDistractors.includes(candidate)) {
      selectedDistractors.push(candidate);
    }
    fallbackIdx++;
  }

  const choices = [correctMeaning, ...selectedDistractors].sort(() => Math.random() - 0.5);
  const correctChoiceIndex = choices.indexOf(correctMeaning);
  return { choices, correctChoiceIndex };
}

export function buildInterleavedQueue(
  dueReviews: DueReviewItem[],
  newCandidates: NewWordCandidate[],
  distractorPool: string[],
  maxTotal = 20
): ReviewQueueItem[] {
  const queue: ReviewQueueItem[] = [];
  let rIdx = 0;
  let nIdx = 0;

  while (
    (rIdx < dueReviews.length || nIdx < newCandidates.length) &&
    queue.length < maxTotal
  ) {
    let reviewsAdded = 0;
    while (rIdx < dueReviews.length && reviewsAdded < 4 && queue.length < maxTotal) {
      const item = dueReviews[rIdx];
      const ex = item.words?.example_sentences?.[0] || null;
      queue.push({
        queueId: `review-${item.words.id}-${Date.now()}-${Math.random()}`,
        wordId: item.words.id,
        word: item.words.word,
        meaning: item.words.meaning,
        pronunciation: item.words.pronunciation,
        format: 'review',
        exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
        stage: item.stage,
        easeFactor: item.ease_factor,
        wrongCount: item.wrong_count,
      });
      rIdx++;
      reviewsAdded++;
    }

    if (nIdx < newCandidates.length && queue.length < maxTotal) {
      const nItem = newCandidates[nIdx];
      const ex = nItem.example_sentences?.[0] || null;
      const { choices, correctChoiceIndex } = generate4Choices(nItem.meaning, distractorPool);
      queue.push({
        queueId: `new-${nItem.id}-${Date.now()}-${Math.random()}`,
        wordId: nItem.id,
        word: nItem.word,
        meaning: nItem.meaning,
        pronunciation: nItem.pronunciation,
        format: 'new',
        exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
        choices,
        correctChoiceIndex,
      });
      nIdx++;
    }

    if (rIdx >= dueReviews.length && nIdx < newCandidates.length) {
      while (nIdx < newCandidates.length && queue.length < maxTotal) {
        const nItem = newCandidates[nIdx];
        const ex = nItem.example_sentences?.[0] || null;
        const { choices, correctChoiceIndex } = generate4Choices(nItem.meaning, distractorPool);
        queue.push({
          queueId: `new-${nItem.id}-${Date.now()}-${Math.random()}`,
          wordId: nItem.id,
          word: nItem.word,
          meaning: nItem.meaning,
          pronunciation: nItem.pronunciation,
          format: 'new',
          exampleSentence: ex ? { text: ex.text, translation: ex.translation } : null,
          choices,
          correctChoiceIndex,
        });
        nIdx++;
      }
    }
  }

  return queue;
}

export function insertRetryItem(
  currentQueue: ReviewQueueItem[],
  currentIndex: number,
  distractorPool: string[]
): ReviewQueueItem[] {
  const currentItem = currentQueue[currentIndex];
  if (!currentItem) return currentQueue;

  const retryItem: ReviewQueueItem = {
    ...currentItem,
    queueId: `${currentItem.wordId}-retry-${Date.now()}`,
    isRetry: true,
  };

  if (retryItem.format === 'new') {
    const { choices, correctChoiceIndex } = generate4Choices(retryItem.meaning, distractorPool);
    retryItem.choices = choices;
    retryItem.correctChoiceIndex = correctChoiceIndex;
  }

  const offset = 5 + Math.floor(Math.random() * 5);
  const targetIndex = currentIndex + 1 + offset;

  const newQueue = [...currentQueue];
  if (targetIndex >= newQueue.length) {
    newQueue.push(retryItem);
  } else {
    newQueue.splice(targetIndex, 0, retryItem);
  }
  return newQueue;
}
