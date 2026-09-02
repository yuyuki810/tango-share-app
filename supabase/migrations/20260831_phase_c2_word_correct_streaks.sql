-- =============================================================================
-- Migration: フェーズC-2 単語ごとの連続正解カウントテーブル (word_correct_streaks)
-- =============================================================================

CREATE TABLE IF NOT EXISTS word_correct_streaks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_updated_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, word_id)
);

-- Enable RLS
ALTER TABLE word_correct_streaks ENABLE ROW LEVEL SECURITY;

-- Policies for users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can view their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can view their own word correct streaks"
      ON word_correct_streaks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can insert their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can insert their own word correct streaks"
      ON word_correct_streaks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'word_correct_streaks' AND policyname = 'Users can update their own word correct streaks'
  ) THEN
    CREATE POLICY "Users can update their own word correct streaks"
      ON word_correct_streaks FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_word_correct_streaks_user_id 
ON word_correct_streaks (user_id);
