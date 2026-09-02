-- =============================================================================
-- Migration: フェーズC-3 デイリースコア永続化テーブル (daily_score_entries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_score_entries (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  raw_score NUMERIC NOT NULL,
  normalized_score INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  accuracy_rate NUMERIC,
  avg_difficulty_weight NUMERIC,
  avg_diminishing_factor NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- Enable RLS
ALTER TABLE daily_score_entries ENABLE ROW LEVEL SECURITY;

-- Policies for users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_score_entries' AND policyname = 'Authenticated users can view daily scores'
  ) THEN
    CREATE POLICY "Authenticated users can view daily scores"
      ON daily_score_entries FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_score_entries' AND policyname = 'Users can insert or update their own daily scores'
  ) THEN
    CREATE POLICY "Users can insert or update their own daily scores"
      ON daily_score_entries FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Index for date & user ranking lookup
CREATE INDEX IF NOT EXISTS idx_daily_score_entries_date_user 
ON daily_score_entries (date, user_id);
