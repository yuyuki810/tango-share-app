-- wordbooks: 名前の重複投入を防ぐため一意制約を追加し、単語帳マスタを登録
alter table wordbooks add constraint uq_wordbooks_name unique (name);

insert into wordbooks (name, total_words) values
  ('システム英単語', 2180),
  ('英単語ターゲット1900', 1900)
on conflict (name) do update set total_words = excluded.total_words;

-- words: 発音記号カラム(任意)
alter table words add column if not exists pronunciation text;

-- test_answers: 復習日のテストで各単語がどの「進める日」由来かを記録するカラムとインデックス
alter table test_answers
  add column if not exists origin_daily_assignment_id uuid references daily_assignments(id) on delete set null;

create index if not exists idx_test_answers_origin on test_answers(origin_daily_assignment_id);

-- streaks: シンプルな連続記録テーブル
create table if not exists streaks (
  user_id uuid primary key references users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table streaks enable row level security;

create policy "own streaks" on streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
