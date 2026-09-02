-- =============================================================================
-- Migration: フェーズC-1 本番デイリーチェック 1日1回制約の追加
-- =============================================================================

-- test_sessions において、同一ユーザー・同日・同一タイプ(daily_check)の重複を防止するユニークインデックス
-- type = 'normal' の練習テストは何度でも保存可能
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_check_once_per_day 
ON test_sessions (user_id, date) 
WHERE (type = 'daily_check');
