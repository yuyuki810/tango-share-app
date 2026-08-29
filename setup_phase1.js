/**
 * フェーズ1: 基盤（認証・グループ参加・単語帳選択・データ投入・UI基盤）
 * 全ファイル一括生成スクリプト（完全修正版）
 * 復旧用
 * 
 * 実行方法:
 *   node setup_phase1_complete.js
 */

const fs = require("fs");
const path = require("path");

const files = {
  // ============================================
  // 1. Supabase 初期マイグレーション SQL
  // ============================================
  "supabase/migrations/20260823000000_init_schema.sql": `-- 1. テーブル定義
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table wordbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_words integer not null,
  created_at timestamptz not null default now()
);

create table words (
  id uuid primary key default gen_random_uuid(),
  wordbook_id uuid not null references wordbooks(id) on delete cascade,
  number integer not null,
  word text not null,
  meaning text not null,
  unique (wordbook_id, number)
);
create index idx_words_wordbook_number on words (wordbook_id, number);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  group_id uuid references groups(id) on delete set null,
  wordbook_id uuid references wordbooks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table weekly_ranges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wordbook_id uuid not null references wordbooks(id),
  week_start_date date not null,
  range_start integer not null,
  range_end integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create table daily_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wordbook_id uuid not null references wordbooks(id),
  date date not null,
  range_start integer not null,
  range_end integer not null,
  is_review_day boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('normal', 'daily_check')),
  correct_count integer not null default 0,
  total_count integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index uq_daily_check_once_per_day
  on test_sessions (user_id, date) where type = 'daily_check';

create table test_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  word_id uuid not null references words(id),
  is_known boolean not null,
  created_at timestamptz not null default now()
);

create table review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,
  ease_factor numeric(4,2) not null default 2.5,
  interval_days integer not null default 1,
  next_review_date date not null default current_date,
  repetition_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);
create index idx_review_cards_due on review_cards (user_id, next_review_date);

-- 2. Auth トリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '受験生'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. RLS 再帰防止関数
create or replace function public.get_auth_user_group_id()
returns uuid as $$
  select group_id from public.users where id = auth.uid();
$$ language sql security definer stable set search_path = public;

-- 4. RLS 有効化
alter table groups enable row level security;
alter table wordbooks enable row level security;
alter table words enable row level security;
alter table users enable row level security;
alter table weekly_ranges enable row level security;
alter table daily_assignments enable row level security;
alter table test_sessions enable row level security;
alter table test_answers enable row level security;
alter table review_cards enable row level security;

create policy "wordbooks readable" on wordbooks for select using (auth.role() = 'authenticated');
create policy "words readable" on words for select using (auth.role() = 'authenticated');
create policy "groups readable" on groups for select using (auth.role() = 'authenticated');
create policy "groups insertable" on groups for insert with check (auth.role() = 'authenticated');

create policy "own or groupmate user rows" on users for select using (
  auth.uid() = id or (group_id is not null and group_id = public.get_auth_user_group_id())
);
create policy "update own user row" on users for update using (auth.uid() = id);

create policy "own weekly_ranges" on weekly_ranges for all using (auth.uid() = user_id);
create policy "own daily_assignments" on daily_assignments for all using (auth.uid() = user_id);
create policy "own test_sessions" on test_sessions for all using (auth.uid() = user_id);
create policy "groupmate daily_check visible" on test_sessions for select using (
  type = 'daily_check' and user_id in (select id from users where group_id = public.get_auth_user_group_id())
);
create policy "own test_answers" on test_answers for all using (
  session_id in (select id from test_sessions where user_id = auth.uid())
);
create policy "own review_cards" on review_cards for all using (auth.uid() = user_id);
`,

  // ============================================
  // 2. スタイル・設定 (Tailwind v4 対応)
  // ============================================
  "app/globals.css": `@import "tailwindcss";

@theme {
  --color-paper: #F5F4EF;
  --color-paper-card: #FFFFFF;
  --color-paper-hover: #EFECE3;

  --color-ink: #232A3B;
  --color-ink-muted: #626B7F;
  --color-ink-subtle: #8D95A5;

  --color-akashiito: #E2483D;
  --color-akashiito-hover: #C9382E;
  --color-akashiito-subtle: #FDF2F1;
  --color-akashiito-border: #F7B8B3;

  --color-highlighter: #F5C84C;
  --color-highlighter-subtle: #FEF8E8;

  --color-line: #D8D3C4;
  --color-line-light: #EBE8DF;

  --font-mincho: var(--font-shippori), serif;
  --font-gothic: var(--font-zen-kaku), sans-serif;
  --font-number: var(--font-zen-maru), sans-serif;

  --shadow-paper: 0 2px 8px -2px rgba(35, 42, 59, 0.05), 0 1px 3px -1px rgba(35, 42, 59, 0.05);
  --shadow-sheet: 0 8px 24px -6px rgba(226, 72, 61, 0.12);
}

@layer base {
  body {
    background-color: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-gothic);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  ::selection {
    background-color: rgba(245, 200, 76, 0.3);
  }

  :focus-visible {
    outline: 2px solid var(--color-akashiito);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
`,

  "app/layout.tsx": `import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const shipporiMincho = Shippori_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-shippori",
  display: "swap",
});

const zenKakuGothic = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  display: "swap",
});

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const metadata: Metadata = {
  title: "英単語グループ学習",
  description: "少人数グループで日々の単語テストを継続する受験生向けアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={\`\${shipporiMincho.variable} \${zenKakuGothic.variable} \${zenMaruGothic.variable}\`}
    >
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper">
        <div className="w-full max-w-md min-h-screen flex flex-col px-4 py-6 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}
`,

  // ============================================
  // 3. 型定義
  // ============================================
  "types/index.ts": `export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Wordbook {
  id: string;
  name: string;
  total_words: number;
  created_at: string;
}

export interface Word {
  id: string;
  wordbook_id: string;
  number: number;
  word: string;
  meaning: string;
}

export interface UserProfile {
  id: string;
  name: string;
  group_id: string | null;
  wordbook_id: string | null;
  created_at: string;
  wordbooks?: Wordbook | null;
  groups?: Group | null;
}

export interface GroupMember {
  id: string;
  name: string;
  wordbook_id: string | null;
  wordbooks?: {
    name: string;
  } | null;
}
`,

  // ============================================
  // 4. Supabase クライアント & ミドルウェア
  // ============================================
  "lib/supabase/client.ts": `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`,

  "lib/supabase/server.ts": `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component では無視
          }
        },
      },
    }
  );
}
`,

  "middleware.ts": `import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/signup";
  const isPublicApi = path.startsWith("/auth/callback");

  if (isPublicApi) {
    return supabaseResponse;
  }

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
`,

  // ============================================
  // 5. 共通コンポーネント
  // ============================================
  "components/common/Button.tsx": `import React, { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3.5 text-base w-full",
  };

  const variantStyles = {
    primary: "bg-ink text-paper hover:bg-ink/90 shadow-sm",
    secondary: "bg-line/40 text-ink hover:bg-line/60",
    outline: "border border-line bg-paper-card text-ink hover:bg-paper-hover",
    danger: "bg-akashiito text-white hover:bg-akashiito-hover shadow-sm",
  };

  return (
    <button
      className={\`\${baseStyles} \${sizeStyles[size]} \${variantStyles[variant]} \${className}\`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>処理中...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
`,

  "components/common/Input.tsx": `import React, { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold tracking-wider text-ink-muted uppercase">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={\`w-full rounded-lg border bg-paper-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle/60 transition-all focus:border-ink \${
            error ? "border-akashiito focus:ring-akashiito" : "border-line focus:ring-ink"
          } \${className}\`}
          {...props}
        />
        {error && <p className="text-xs text-akashiito">{error}</p>}
        {helperText && !error && <p className="text-xs text-ink-muted">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
`,

  "components/common/Card.tsx": `import React, { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  accent = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={\`rounded-xl border bg-paper-card p-5 shadow-paper transition-shadow \${
        accent ? "border-akashiito/40 ring-1 ring-akashiito/20" : "border-line"
      } \${className}\`}
      {...props}
    >
      {children}
    </div>
  );
};
`,

  "components/common/Header.tsx": `"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, LogOut, Settings } from "lucide-react";

interface HeaderProps {
  userName?: string;
  showNav?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ userName, showNav = true }) => {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="mb-6 flex items-center justify-between border-b border-line pb-4 pt-1">
      <Link href="/dashboard" className="flex items-center gap-2 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-akashiito text-white shadow-sm transition-transform group-hover:scale-105">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <span className="font-mincho text-lg font-bold tracking-tight text-ink">単語道場</span>
          <span className="ml-2 inline-block rounded-full bg-highlighter/30 px-2 py-0.5 font-number text-[10px] font-bold text-ink">
            Phase 1
          </span>
        </div>
      </Link>

      {showNav && (
        <div className="flex items-center gap-3">
          {userName && <span className="text-xs text-ink-muted font-medium">{userName}</span>}
          <Link href="/settings/wordbook" aria-label="単語帳設定" className="rounded-lg p-2 text-ink-muted hover:bg-paper-hover hover:text-ink transition-colors">
            <Settings className="h-4 w-4" />
          </Link>
          <button onClick={handleLogout} aria-label="ログアウト" className="rounded-lg p-2 text-ink-muted hover:bg-paper-hover hover:text-akashiito transition-colors cursor-pointer">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
};
`,

  // ============================================
  // 6. 認証機能
  // ============================================
  "components/auth/LoginForm.tsx": `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
            {error}
          </div>
        )}
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          ログインして学習を再開
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        アカウントをお持ちでないですか？{" "}
        <Link href="/signup" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          新規登録する
        </Link>
      </div>
    </Card>
  );
};
`,

  "components/auth/SignupForm.tsx": `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const SignupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "サインアップに失敗しました");
        return;
      }

      router.push("/join-group");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
            {error}
          </div>
        )}
        <Input label="表示名 (ニックネーム)" type="text" required placeholder="例: たろう" value={name} onChange={(e) => setName(e.target.value)} helperText="グループメンバーに表示されます" />
        <Input label="メールアドレス" type="email" required autoComplete="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="パスワード" type="password" required autoComplete="new-password" placeholder="6文字以上" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          アカウントを作成
        </Button>
      </form>
      <div className="mt-5 text-center text-xs text-ink-muted">
        すでにアカウントをお持ちですか？{" "}
        <Link href="/login" className="font-semibold text-akashiito underline underline-offset-2 hover:opacity-80">
          ログインする
        </Link>
      </div>
    </Card>
  );
};
`,

  "app/(auth)/login/page.tsx": `import React from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">毎日を積み重ねる</h1>
        <p className="mt-2 text-xs text-ink-muted">グループ英単語共有テストにログイン</p>
      </div>
      <LoginForm />
    </main>
  );
}
`,

  "app/(auth)/signup/page.tsx": `import React from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-6">
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">新しい仲間と始める</h1>
        <p className="mt-2 text-xs text-ink-muted">4人グループで合格までの暗記を習慣化</p>
      </div>
      <SignupForm />
    </main>
  );
}
`,

  // ============================================
  // 7. グループ作成・参加機能
  // ============================================
  "components/group/CreateGroupForm.tsx": `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const CreateGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループ作成に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">新しいグループを作る</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input placeholder="例: 東大志望4人組" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" size="lg" isLoading={loading}>
          グループを作成して招待コードを発行
        </Button>
      </form>
    </Card>
  );
};
`,

  "components/group/JoinGroupForm.tsx": `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";

export const JoinGroupForm = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "グループへの参加に失敗しました");
        return;
      }

      router.push("/select-wordbook");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="font-mincho text-base font-bold text-ink mb-3">招待コードで参加する</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-akashiito">{error}</p>}
        <Input
          placeholder="6桁のコード (例: 7K9X2P)"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-number tracking-widest uppercase text-center font-bold text-base"
          required
        />
        <Button type="submit" variant="secondary" size="lg" isLoading={loading}>
          グループに参加
        </Button>
      </form>
    </Card>
  );
};
`,

  "components/group/GroupMembersList.tsx": `"use client";

import React from "react";
import { Card } from "@/components/common/Card";
import { Users, User, Copy } from "lucide-react";
import type { GroupMember } from "@/types";

interface GroupMembersListProps {
  groupName: string;
  inviteCode: string;
  members: GroupMember[];
  currentUserId: string;
}

export const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupName,
  inviteCode,
  members,
  currentUserId,
}) => {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">参加中グループ</span>
          <h2 className="font-mincho text-lg font-bold text-ink">{groupName}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 border border-line">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          <span className="font-number text-xs font-bold text-ink">{members.length} / 4人</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-highlighter/15 p-3 border border-highlighter/40">
        <div>
          <span className="block text-[10px] font-bold text-ink-muted uppercase">招待コード (仲間を招待)</span>
          <span className="font-number text-lg font-bold tracking-widest text-ink">{inviteCode}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode);
            alert("招待コードをコピーしました！");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-paper-card px-2.5 py-1.5 text-xs font-semibold text-ink border border-line shadow-sm hover:bg-paper-hover active:scale-95 transition-all cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5 text-ink-muted" />
          コピー
        </button>
      </div>

      <div>
        <span className="text-xs font-semibold text-ink-muted mb-2 block">メンバー一覧</span>
        <ul className="space-y-2">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            return (
              <li
                key={member.id}
                className={\`flex items-center justify-between rounded-lg p-2.5 border transition-all \${
                  isMe ? "bg-akashiito-subtle/50 border-akashiito-border" : "bg-paper/50 border-line/60"
                }\`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={\`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold \${
                    isMe ? "bg-akashiito text-white" : "bg-line text-ink-muted"
                  }\`}>
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-ink">{member.name}</span>
                    {isMe && <span className="ml-1.5 text-[10px] font-bold text-akashiito">(あなた)</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded px-2 py-0.5 text-[11px] bg-paper-card border border-line text-ink-muted font-medium">
                    {member.wordbooks?.name || "単語帳未設定"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
};
`,

  "app/api/groups/route.ts": `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, name, inviteCode } = body;

    if (action === "create") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "グループ名を入力してください" }, { status: 400 });
      }

      let code = generateInviteCode();
      let insertedGroup = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("groups")
          .insert({ name: name.trim(), invite_code: code })
          .select()
          .single();

        if (!error && data) {
          insertedGroup = data;
          break;
        }
        code = generateInviteCode();
      }

      if (!insertedGroup) {
        return NextResponse.json({ error: "グループ作成に失敗しました" }, { status: 500 });
      }

      await supabase.from("users").update({ group_id: insertedGroup.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group: insertedGroup });
    }

    if (action === "join") {
      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "招待コードを入力してください" }, { status: 400 });
      }

      const cleanCode = inviteCode.trim().toUpperCase();
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("id, name, invite_code")
        .eq("invite_code", cleanCode)
        .single();

      if (findError || !group) {
        return NextResponse.json({ error: "該当する招待コードのグループが見つかりません" }, { status: 404 });
      }

      await supabase.from("users").update({ group_id: group.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
`,

  "app/(onboarding)/join-group/page.tsx": `import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { CreateGroupForm } from "@/components/group/CreateGroupForm";
import { JoinGroupForm } from "@/components/group/JoinGroupForm";

export default async function JoinGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("group_id, wordbook_id, name")
    .eq("id", user.id)
    .single();

  if (profile?.group_id) {
    if (!profile.wordbook_id) {
      redirect("/select-wordbook");
    }
    redirect("/dashboard");
  }

  return (
    <main className="w-full">
      <Header userName={profile?.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">グループに参加しよう</h1>
        <p className="mt-2 text-xs text-ink-muted">仲間と一緒に単語テストを始める準備をします</p>
      </div>
      <div className="space-y-6">
        <CreateGroupForm />
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-line" />
          <span className="absolute bg-paper px-3 text-xs font-semibold text-ink-subtle">または</span>
        </div>
        <JoinGroupForm />
      </div>
    </main>
  );
}
`,

  // ============================================
  // 8. 単語帳選択・設定機能
  // ============================================
  "components/wordbook/WordbookSelector.tsx": `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Book, CheckCircle2 } from "lucide-react";
import type { Wordbook } from "@/types";

interface WordbookSelectorProps {
  wordbooks: Wordbook[];
  currentWordbookId?: string | null;
  redirectPath?: string;
}

export const WordbookSelector: React.FC<WordbookSelectorProps> = ({
  wordbooks,
  currentWordbookId = null,
  redirectPath = "/dashboard",
}) => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    currentWordbookId || (wordbooks[0]?.id ?? null)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/users/wordbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordbookId: selectedId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "設定に失敗しました");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-akashiito-subtle p-3 text-xs text-akashiito border border-akashiito-border">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {wordbooks.map((wb) => {
          const isSelected = selectedId === wb.id;
          return (
            <div
              key={wb.id}
              onClick={() => setSelectedId(wb.id)}
              className={\`cursor-pointer rounded-xl border p-4 transition-all duration-150 \${
                isSelected
                  ? "border-akashiito bg-akashiito-subtle/40 ring-1 ring-akashiito"
                  : "border-line bg-paper-card hover:bg-paper-hover"
              }\`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={\`flex h-10 w-10 items-center justify-center rounded-lg \${
                      isSelected
                        ? "bg-akashiito text-white"
                        : "bg-paper text-ink-muted border border-line"
                    }\`}
                  >
                    <Book className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-mincho text-base font-bold text-ink">{wb.name}</h3>
                    <p className="font-number text-xs text-ink-muted">収録語数: {wb.total_words} 語</p>
                  </div>
                </div>

                {isSelected && <CheckCircle2 className="h-5 w-5 text-akashiito" />}
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="primary" size="lg" onClick={handleSave} disabled={!selectedId} isLoading={loading}>
        この単語帳で決定する
      </Button>
    </div>
  );
};
`,

  "app/api/users/wordbook/route.ts": `import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wordbookId } = await request.json();
    if (!wordbookId) {
      return NextResponse.json({ error: "単語帳を選択してください" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ wordbook_id: wordbookId })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "単語帳の設定に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
`,

  "app/(onboarding)/select-wordbook/page.tsx": `import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import type { Wordbook } from "@/types";

export default async function SelectWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, group_id, wordbook_id")
    .eq("id", user.id)
    .single();

  if (!profile?.group_id) {
    redirect("/join-group");
  }

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="w-full">
      <Header userName={profile.name} showNav={false} />
      <div className="mb-6 text-center">
        <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">使用する単語帳を選択</h1>
        <p className="mt-2 text-xs text-ink-muted">各自が使う単語帳を選んでください</p>
      </div>
      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
`,

  "app/(main)/settings/wordbook/page.tsx": `import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import { ChevronLeft } from "lucide-react";
import type { Wordbook } from "@/types";

export default async function SettingsWordbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, wordbook_id")
    .eq("id", user.id)
    .single();

  const { data: wordbooks } = await supabase
    .from("wordbooks")
    .select("id, name, total_words, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="w-full">
      <Header userName={profile?.name} />
      <div className="mb-4">
        <Link href="/dashboard" className="inline-flex items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors">
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>
      <div className="mb-6 text-left">
        <h1 className="font-mincho text-xl font-bold tracking-tight text-ink">単語帳の変更</h1>
        <p className="mt-1 text-xs text-ink-muted">テスト対象となる単語帳を変更します</p>
      </div>
      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile?.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
`,

  // ============================================
  // 9. ダッシュボード
  // ============================================
  "app/(main)/dashboard/page.tsx": `import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/common/Header";
import { GroupMembersList } from "@/components/group/GroupMembersList";
import { Card } from "@/components/common/Card";
import { Sparkles } from "lucide-react";
import type { GroupMember } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select(\`
      id,
      name,
      group_id,
      wordbook_id,
      groups:groups!users_group_id_fkey(id, name, invite_code),
      wordbooks:wordbooks!users_wordbook_id_fkey(id, name, total_words)
    \`)
    .eq("id", user.id)
    .single();

  if (!profile?.group_id) {
    redirect("/join-group");
  }

  if (!profile.wordbook_id) {
    redirect("/select-wordbook");
  }

  const { data: groupMembers } = await supabase
    .from("users")
    .select(\`
      id,
      name,
      wordbook_id,
      wordbooks:wordbooks!users_wordbook_id_fkey(name)
    \`)
    .eq("group_id", profile.group_id);

  const group = profile.groups as unknown as { id: string; name: string; invite_code: string } | null;
  const wordbook = profile.wordbooks as unknown as { id: string; name: string; total_words: number } | null;

  return (
    <main className="w-full space-y-6">
      <Header userName={profile.name} />

      <Card className="border-line bg-paper-card">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">マイ単語帳</span>
            <h3 className="font-mincho text-lg font-bold text-ink">{wordbook?.name || "未設定"}</h3>
            <p className="font-number text-xs text-ink-muted">全 {wordbook?.total_words || 0} 語</p>
          </div>
          <Link href="/settings/wordbook" className="rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold text-ink border border-line hover:bg-paper-hover transition-colors">
            変更
          </Link>
        </div>
      </Card>

      <div className="rounded-xl border border-dashed border-akashiito-border bg-akashiito-subtle/30 p-4 text-center">
        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-akashiito/10 text-akashiito mb-2">
          <Sparkles className="h-4 w-4" />
        </div>
        <h4 className="font-mincho text-sm font-bold text-ink">フェーズ1 基盤構築完了</h4>
        <p className="mt-1 text-xs text-ink-muted">週間範囲設定、デイリーテスト機能は後続フェーズで追加されます。</p>
      </div>

      {group && (
        <GroupMembersList
          groupName={group.name}
          inviteCode={group.invite_code}
          members={(groupMembers as unknown as GroupMember[]) || []}
          currentUserId={user.id}
        />
      )}
    </main>
  );
}
`,

  // ============================================
  // 10. シード用スクリプト & CSV (環境変数自動読込版)
  // ============================================
  "scripts/sample_words.csv": `number,word,meaning
1,abandon,〜を捨てる、断念する
2,accommodate,〜を収容する、適応させる
3,accumulate,〜を蓄積する、積もる
4,adapt,〜を適応させる、順応する
5,adequate,十分な、適切な
6,advocate,〜を主張する、支持者
7,ambiguous,あいまいな、多義の
8,anticipate,〜を予想する、期待する
9,arbitrary,任意の、独断的な
10,comprehensive,包括的な、総合的な
11,crucial,極めて重要な、決定的な
12,deficient,不足している、不完全な
13,eliminate,〜を排除する、除去する
14,facilitate,〜を容易にする、促進する
15,genuine,本物の、心からの
16,inevitable,避けられない、必然的な
17,legitimate,正当な、合法的な
18,mutual,相互の、共通の
19,persistent,粘り強い、持続する
20,reluctant,気乗りしない、気が進まない
`,

  "scripts/seed-words.ts": `import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

// .env.local を自動ロード
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...values] = trimmed.split("=");
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join("=").trim();
      }
    }
  }
}

loadEnv();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl && supabaseUrl.includes("/rest/v1")) {
  supabaseUrl = supabaseUrl.split("/rest/v1")[0];
}

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ エラー: .env.local からキーを読み込めませんでした。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function seedWordbook(bookName: string, csvFilePath: string): Promise<void> {
  console.log(\`\\n📚 単語帳「\${bookName}」の投入中...\`);

  const absolutePath = path.resolve(process.cwd(), csvFilePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(\`CSVファイルが見つかりません: \${absolutePath}\`);
  }

  const fileContent = fs.readFileSync(absolutePath, "utf-8");
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

  let wordbookId: string;
  const { data: existingBook } = await supabase
    .from("wordbooks")
    .select("id")
    .eq("name", bookName)
    .maybeSingle();

  if (existingBook) {
    wordbookId = existingBook.id;
    await supabase.from("wordbooks").update({ total_words: records.length }).eq("id", wordbookId);
    console.log(\`既存の単語帳を更新: ID = \${wordbookId}\`);
  } else {
    const { data: newBook, error } = await supabase
      .from("wordbooks")
      .insert({ name: bookName, total_words: records.length })
      .select("id")
      .single();
    if (error || !newBook) throw error;
    wordbookId = newBook.id;
    console.log(\`新規単語帳を作成: ID = \${wordbookId}\`);
  }

  const wordsToInsert = records.map((r: any) => ({
    wordbook_id: wordbookId,
    number: parseInt(String(r.number), 10),
    word: r.word,
    meaning: r.meaning,
  }));

  const { error: wordsError } = await supabase.from("words").upsert(wordsToInsert, {
    onConflict: "wordbook_id,number",
  });

  if (wordsError) throw wordsError;
  console.log(\`✅ \${records.length} 語の投入が完了しました！\`);
}

async function main() {
  try {
    await seedWordbook("標準英単語20 (サンプル)", "scripts/sample_words.csv");
    await seedWordbook("発展テーマ別英単語 (サンプル)", "scripts/sample_words.csv");
    console.log("\\n🎉 全てのシードデータ投入が完了しました！\\n");
  } catch (err: any) {
    console.error("❌ エラーが発生しました:", err.message || err);
    process.exit(1);
  }
}

main();
`,
};

// ============================================
// ファイル一括書き出し処理
// ============================================
console.log("🚀 フェーズ1 全ファイルの一括生成を開始します...");

let count = 0;
for (const [filePath, content] of Object.entries(files)) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim() + "\n", "utf8");
  console.log(`  ✓ 生成: ${filePath}`);
  count++;
}

console.log(`\n✨ 合計 ${count} 個のファイルが最新状態で正常に生成・更新されました！\n`);