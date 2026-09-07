-- test_answers テーブルに回答修正時の streak 巻き戻し用カラムを追加
ALTER TABLE test_answers ADD COLUMN IF NOT EXISTS streak_before integer;
ALTER TABLE test_answers ADD COLUMN IF NOT EXISTS streak_after integer;

COMMENT ON COLUMN test_answers.streak_before IS '回答前の word_correct_streaks (更新がスキップされた場合は after と同値)';
COMMENT ON COLUMN test_answers.streak_after IS '回答後の word_correct_streaks (更新がスキップされた場合は before と同値)';
