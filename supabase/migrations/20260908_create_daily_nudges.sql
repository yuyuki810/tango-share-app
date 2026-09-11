-- 未完了メンバーへの応援(催促)記録テーブル
CREATE TABLE IF NOT EXISTS daily_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_daily_nudge_per_target UNIQUE (group_id, sender_id, target_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_nudges_target_date ON daily_nudges(target_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_nudges_sender_date ON daily_nudges(sender_id, date);

COMMENT ON TABLE daily_nudges IS 'デイリーチェック未受検者への1日1回限定のアプリ内応援(催促)メッセージ';
