-- daily_score_entries に計算時の正規化基準値R(その日の目標語数)を記録するカラムを追加
ALTER TABLE daily_score_entries ADD COLUMN IF NOT EXISTS reference_max_score integer;

COMMENT ON COLUMN daily_score_entries.reference_max_score IS 'スコア計算時に使用された正規化基準値R(その日の目標語数)';
