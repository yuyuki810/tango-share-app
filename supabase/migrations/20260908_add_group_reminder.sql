-- groups テーブルにリマインダー時刻(JST)カラムを追加
ALTER TABLE groups ADD COLUMN IF NOT EXISTS reminder_time time;
COMMENT ON COLUMN groups.reminder_time IS 'グループのデイリーリマインダー配信時刻(JST)。NULLでオフ';

-- リマインダー二重送信防止テーブル
CREATE TABLE IF NOT EXISTS reminder_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_reminder_per_group_date UNIQUE (group_id, date)
);

CREATE INDEX IF NOT EXISTS idx_reminder_send_log_group_date ON reminder_send_log(group_id, date);

ALTER TABLE reminder_send_log ENABLE ROW LEVEL SECURITY;
