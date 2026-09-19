-- users テーブルに累積経験値カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_exp integer DEFAULT 0;
COMMENT ON COLUMN users.total_exp IS 'デイリーチェック完走時に加算される累積解答単語数(EXP)';
