/**
 * setup_phase_f5.js
 * フェーズF-5: テーマカラー選択機能（和紙 ⇄ 紫夜 ダークテーマ）一括反映スクリプト
 * 
 * 実行方法:
 *   node setup_phase_f5.js
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local / .env 自動読み込み
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log(`[ENV] 環境変数を読み込みました: ${envPath}`);
      break;
    }
  }
}

loadEnv();

// ファイル書き出しヘルパー
function writeFile(relativeFilePath, fileContent) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, fileContent.trim() + '\n', 'utf8');
  console.log(`[FILE] 生成/更新完了: ${relativeFilePath}`);
}

console.log('================================================================');
console.log('フェーズF-5: テーマカラー選択機能（和紙 ⇄ 紫夜）のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. app/globals.css (CSS変数による2つの独立した包括的配色セット定義)
// -----------------------------------------------------------------------------
const globalsCss = `@import "tailwindcss";

@theme {
  --color-paper: var(--color-paper-val);
  --color-paper-card: var(--color-paper-card-val);
  --color-paper-hover: var(--color-paper-hover-val);

  --color-ink: var(--color-ink-val);
  --color-ink-muted: var(--color-ink-muted-val);
  --color-ink-subtle: var(--color-ink-subtle-val);

  --color-akashiito: var(--color-akashiito-val);
  --color-akashiito-hover: var(--color-akashiito-hover-val);
  --color-akashiito-subtle: var(--color-akashiito-subtle-val);
  --color-akashiito-border: var(--color-akashiito-border-val);

  --color-highlighter: var(--color-highlighter-val);
  --color-highlighter-subtle: var(--color-highlighter-subtle-val);

  --color-line: var(--color-line-val);
  --color-line-light: var(--color-line-light-val);

  --font-mincho: var(--font-shippori), serif;
  --font-gothic: var(--font-zen-kaku), sans-serif;
  --font-number: var(--font-zen-maru), sans-serif;

  --shadow-paper: 0 2px 8px -2px rgba(35, 42, 59, 0.05), 0 1px 3px -1px rgba(35, 42, 59, 0.05);
  --shadow-sheet: 0 8px 24px -6px rgba(226, 72, 61, 0.12);
}

/* 🍵 既定テーマ: 和紙 (Washi) */
:root, [data-theme='washi'] {
  --color-paper-val: #F5F4EF;
  --color-paper-card-val: #FFFFFF;
  --color-paper-hover-val: #EFECE3;

  --color-ink-val: #232A3B;
  --color-ink-muted-val: #626B7F;
  --color-ink-subtle-val: #8D95A5;

  --color-akashiito-val: #E2483D;
  --color-akashiito-hover-val: #C9382E;
  --color-akashiito-subtle-val: #FDF2F1;
  --color-akashiito-border-val: #F7B8B3;

  --color-highlighter-val: #F5C84C;
  --color-highlighter-subtle-val: #FEF8E8;

  --color-line-val: #D8D3C4;
  --color-line-light-val: #EBE8DF;
}

/* 🌌 新テーマ: 紫夜 (Dark Purple / Obsidian) */
[data-theme='dark-purple'] {
  --color-paper-val: #120E1C;
  --color-paper-card-val: #1E172E;
  --color-paper-hover-val: #2A203F;

  --color-ink-val: #F3EEFA;
  --color-ink-muted-val: #B3A7C7;
  --color-ink-subtle-val: #7E7196;

  --color-akashiito-val: #FF5353;
  --color-akashiito-hover-val: #E03E3E;
  --color-akashiito-subtle-val: #2E151A;
  --color-akashiito-border-val: #6E2228;

  --color-highlighter-val: #F7C948;
  --color-highlighter-subtle-val: #2A2211;

  --color-line-val: #34274F;
  --color-line-light-val: #251B38;
}

/* 紫夜テーマ時のカード・背景自動適合 */
[data-theme='dark-purple'] .bg-white {
  background-color: var(--color-paper-card-val) !important;
}

@layer base {
  body {
    background-color: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-gothic);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    transition: background-color 0.2s ease, color 0.2s ease;
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
`;

writeFile('app/globals.css', globalsCss);

// -----------------------------------------------------------------------------
// 2. components/theme/ThemeProvider.tsx (React Context & ローカルストレージ永続化)
// -----------------------------------------------------------------------------
const themeProviderTsx = `'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'washi' | 'dark-purple';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'washi',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('washi');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('tango_theme') as ThemeMode | null;
    if (saved === 'dark-purple' || saved === 'washi') {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('tango_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
`;

writeFile('components/theme/ThemeProvider.tsx', themeProviderTsx);

// -----------------------------------------------------------------------------
// 3. components/theme/ThemeSelector.tsx (テーマ選択スウォッチカードUI)
// -----------------------------------------------------------------------------
const themeSelectorTsx = `'use client';

import React from 'react';
import { useTheme, type ThemeMode } from './ThemeProvider';
import { CheckCircle2, Moon, Sun } from 'lucide-react';

interface ThemeOption {
  id: ThemeMode;
  name: string;
  subtitle: string;
  description: string;
  icon: any;
  previewClass: string;
  borderClass: string;
  palette: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'washi',
    name: '和紙 (既定)',
    subtitle: 'Washi Cream & Sumi Ink',
    description: '生成りの和紙と墨、朱糸の伝統的な学習帳配色。日中の学習に最適です。',
    icon: Sun,
    previewClass: 'bg-[#F5F4EF]',
    borderClass: 'border-[#D8D3C4]',
    palette: ['#F5F4EF', '#FFFFFF', '#232A3B', '#E2483D', '#F5C84C'],
  },
  {
    id: 'dark-purple',
    name: '紫夜 (新テーマ)',
    subtitle: 'Obsidian Purple & Violet Light',
    description: '漆黒の紫紺に藤色の文字が映えるダークテーマ。夜間の集中学習に最適です。',
    icon: Moon,
    previewClass: 'bg-[#120E1C]',
    borderClass: 'border-[#34274F]',
    palette: ['#120E1C', '#1E172E', '#F3EEFA', '#FF5353', '#F7C948'],
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {THEME_OPTIONS.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;

          return (
            <div
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={\`cursor-pointer rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99] \${
                isSelected
                  ? 'border-akashiito bg-paper-card ring-2 ring-akashiito shadow-sm'
                  : 'border-line bg-paper-card hover:bg-paper-hover'
              }\`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  {/* テーマアイコン */}
                  <div
                    className={\`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl \${
                      isSelected
                        ? 'bg-akashiito text-white shadow-2xs'
                        : 'bg-paper text-ink-muted border border-line'
                    }\`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* テキスト説明 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mincho text-base font-bold text-ink">
                        {opt.name}
                      </h3>
                      {isSelected && (
                        <span className="rounded-full bg-akashiito/10 border border-akashiito/30 px-2 py-0.2 font-maru text-[10px] font-bold text-akashiito">
                          適用中
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-ink-muted uppercase">
                      {opt.subtitle}
                    </p>
                    <p className="font-maru text-xs text-ink/70 leading-relaxed pt-0.5">
                      {opt.description}
                    </p>

                    {/* カラースウォッチパレット */}
                    <div className="flex items-center gap-1.5 pt-2">
                      {opt.palette.map((color, i) => (
                        <span
                          key={i}
                          style={{ backgroundColor: color }}
                          className="h-4 w-4 rounded-full border border-line/40 shadow-2xs inline-block"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* チェックマーク */}
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-akashiito shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

writeFile('components/theme/ThemeSelector.tsx', themeSelectorTsx);

// -----------------------------------------------------------------------------
// 4. app/(main)/settings/theme/page.tsx (テーマ設定ページ)
// -----------------------------------------------------------------------------
const settingsThemePageTsx = `export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChevronLeft, Palette } from 'lucide-react';
import { ThemeSelector } from '@/components/theme/ThemeSelector';

export default async function SettingsThemePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* 設定ナビゲーションタブ */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/settings/wordbook"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          単語帳の変更
        </Link>
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          テーマカラー
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">テーマカラーの設定</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">
          お好みの配色にリアルタイムで切り替えます（次回起動時も保持されます）
        </p>
      </div>

      <ThemeSelector />
    </main>
  );
}
`;

writeFile('app/(main)/settings/theme/page.tsx', settingsThemePageTsx);

// -----------------------------------------------------------------------------
// 5. app/(main)/settings/wordbook/page.tsx (設定タブリンクの追加)
// -----------------------------------------------------------------------------
const settingsWordbookPageTsx = `import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WordbookSelector } from "@/components/wordbook/WordbookSelector";
import { ChevronLeft, BookOpen } from "lucide-react";
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
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full space-y-6 px-4 sm:px-0 pb-24 pt-6">
      <div>
        <Link
          href="/dashboard"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* 設定ナビゲーションタブ */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-ink bg-ink text-paper font-mincho text-xs font-bold shadow-xs">
          単語帳の変更
        </div>
        <Link
          href="/settings/theme"
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-paper-card font-maru text-xs font-medium text-ink-muted transition hover:bg-paper-hover"
        >
          テーマカラー
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-akashiito" />
          <h1 className="font-mincho text-2xl font-bold tracking-tight text-ink">単語帳の変更</h1>
        </div>
        <p className="font-maru text-xs text-ink-muted">テスト対象となる単語帳を変更します</p>
      </div>

      <WordbookSelector
        wordbooks={(wordbooks as Wordbook[]) || []}
        currentWordbookId={profile?.wordbook_id}
        redirectPath="/dashboard"
      />
    </main>
  );
}
`;

writeFile('app/(main)/settings/wordbook/page.tsx', settingsWordbookPageTsx);

// -----------------------------------------------------------------------------
// 6. app/layout.tsx (ThemeProvider & チラつき防止インラインスクリプト設置)
// -----------------------------------------------------------------------------
const layoutTsx = `import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

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

export const viewport: Viewport = {
  themeColor: "#232A3B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "英単語グループ学習",
  description: "グループで日々の単語テストを継続する受験生向けアプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "単語道場",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={\`\${shipporiMincho.variable} \${zenKakuGothic.variable} \${zenMaruGothic.variable}\`}
    >
      <head>
        {/* 初回描画前のチラつき (FOUC) を防止するインラインテーマ初期化スクリプト */}
        <script
          dangerouslySetInnerHTML={{
            __html: \`
              try {
                var theme = localStorage.getItem('tango_theme');
                if (theme === 'dark-purple') {
                  document.documentElement.setAttribute('data-theme', 'dark-purple');
                } else {
                  document.documentElement.setAttribute('data-theme', 'washi');
                }
              } catch (e) {}
            \`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper antialiased">
        <ThemeProvider>
          <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl min-h-screen flex flex-col px-4 py-6 sm:px-6 md:px-8">
            {children}
          </div>
          <IOSInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
`;

writeFile('app/layout.tsx', layoutTsx);

console.log('\n================================================================');
console.log('✅ フェーズF-5: テーマカラー選択機能のセットアップが完了しました！');
console.log('================================================================\n');