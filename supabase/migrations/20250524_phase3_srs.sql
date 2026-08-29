-- 1. words テーブル拡張 (既存の wordbook_id / number は維持)
alter table words
  add column if not exists pronunciation text,
  add column if not exists frequency_rank integer,
  add column if not exists is_writing_target boolean not null default false;

-- 2. 例文テーブル
create table if not exists example_sentences (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  text text not null,
  translation text,
  created_at timestamptz not null default now()
);
create index if not exists idx_example_sentences_word on example_sentences(word_id);

-- 3. SRS進捗テーブル
create table if not exists word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,
  stage integer not null default 0,
  ease_factor numeric(3,2) not null default 2.5,
  interval_days numeric not null default 0,
  next_review_at date,
  correct_streak integer not null default 0,
  wrong_count integer not null default 0,
  last_reviewed_at timestamptz,
  exposure_count integer not null default 0,
  is_in_srs boolean not null default false,
  comprehension_stage integer default 0,
  production_stage integer default 0,
  stability numeric default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);
create index if not exists idx_word_progress_due
  on word_progress (user_id, next_review_at)
  where is_in_srs = true;

-- 4. 当日導入単語の追跡テーブル (デイリーチェック対象特定用)
create table if not exists daily_new_words (
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  word_id uuid not null references words(id) on delete cascade,
  checked boolean not null default false,
  is_known boolean,
  created_at timestamptz not null default now(),
  primary key (user_id, date, word_id)
);

-- 5. ストリーク管理テーブル
create table if not exists streaks (
  user_id uuid primary key references users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- 6. 日次統計テーブル
create table if not exists daily_stats (
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  new_learned integer not null default 0,
  reviewed integer not null default 0,
  correct_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- 7. RLS設定
alter table word_progress enable row level security;
alter table daily_new_words enable row level security;
alter table streaks enable row level security;
alter table daily_stats enable row level security;
alter table example_sentences enable row level security;

create policy "own word_progress" on word_progress for all using (auth.uid() = user_id);
create policy "own daily_new_words" on daily_new_words for all using (auth.uid() = user_id);
create policy "own streaks" on streaks for all using (auth.uid() = user_id);
create policy "own daily_stats" on daily_stats for all using (auth.uid() = user_id);
create policy "example_sentences readable" on example_sentences for select using (auth.role() = 'authenticated');
