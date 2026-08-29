-- フェーズ3用 マイグレーションSQL (SupabaseのSQLエディタで実行してください)

-- daily_assignments拡張
alter table daily_assignments
  add column if not exists is_completed boolean default false,
  add column if not exists completed_at timestamptz;

-- word_progress (SRS管理)
create table if not exists word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  word_id uuid references words(id),
  stage int default 0,
  ease_factor numeric default 2.5,
  interval_days numeric default 0,
  next_review_at timestamptz default now(),
  correct_streak int default 0,
  wrong_count int default 0,
  last_reviewed_at timestamptz,
  unique(user_id, word_id)
);

-- streaks (継続日数)
create table if not exists streaks (
  user_id uuid primary key references auth.users(id),
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date
);

-- セキュリティポリシー (RLS)
alter table word_progress enable row level security;
alter table streaks enable row level security;

create policy "Users can view their own word progress" on word_progress for select using (auth.uid() = user_id);
create policy "Users can insert their own word progress" on word_progress for insert with check (auth.uid() = user_id);
create policy "Users can update their own word progress" on word_progress for update using (auth.uid() = user_id);

create policy "Users can view their own streaks" on streaks for select using (auth.uid() = user_id);
create policy "Users can insert their own streaks" on streaks for insert with check (auth.uid() = user_id);
create policy "Users can update their own streaks" on streaks for update using (auth.uid() = user_id);
