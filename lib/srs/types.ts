export interface WordItem {
  id: string;
  wordbook_id: string;
  number: number;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  frequency_rank?: number | null;
  is_writing_target?: boolean;
}

export interface ExampleSentence {
  id: string;
  word_id: string;
  text: string;
  translation?: string | null;
}

export interface WordProgress {
  id: string;
  user_id: string;
  word_id: string;
  stage: number;
  ease_factor: number;
  interval_days: number;
  next_review_at: string | null;
  correct_streak: number;
  wrong_count: number;
  last_reviewed_at: string | null;
  exposure_count: number;
  is_in_srs: boolean;
}

export interface ReviewQueueItem {
  queueId: string;
  wordId: string;
  word: string;
  meaning: string;
  pronunciation?: string | null;
  format: 'new' | 'review';
  exampleSentence?: {
    text: string;
    translation?: string | null;
  } | null;
  choices?: string[];
  correctChoiceIndex?: number;
  stage?: number;
  easeFactor?: number;
  wrongCount?: number;
  isRetry?: boolean;
}

export type HomeStateMachine =
  | { state: 'no_range' }
  | { state: 'review_due'; sessionCount: number; dueReviewCount: number; todayNewCount: number }
  | { state: 'daily_check_due'; count: number }
  | { state: 'completed'; streak: number; longestStreak: number; hasAheadContent: boolean };
