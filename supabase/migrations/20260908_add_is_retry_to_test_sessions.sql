-- test_sessions に間違えた単語の即時復習フラグを追加
ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS is_retry boolean DEFAULT false;

COMMENT ON COLUMN test_sessions.is_retry IS 'テスト直後の間違えた単語復習テストかどうか (弱点マップのドリル集計から除外用)';
