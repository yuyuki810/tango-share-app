/**
 * setup_phase_e1.js
 * フェーズE-1: PWA化（ホーム画面追加・オフライン耐性）一括セットアップスクリプト
 * 
 * 実行方法:
 *   node setup_phase_e1.js
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
console.log('フェーズE-1: PWA化（ホーム画面追加・オフライン耐性）のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. app/manifest.ts (Next.js App Router Web App Manifest)
// -----------------------------------------------------------------------------
const manifestTs = `import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '英単語グループ学習',
    short_name: '単語道場',
    description: '少人数グループで日々の単語テストを継続する受験生向けアプリ',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F4EF', // Tailwind paper トークン実値
    theme_color: '#232A3B',      // Tailwind ink トークン実値
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
`;

writeFile('app/manifest.ts', manifestTs);

// -----------------------------------------------------------------------------
// 2. components/pwa/IOSInstallPrompt.tsx (iOSホーム画面追加案内バナー)
// -----------------------------------------------------------------------------
const iosInstallPromptTsx = `'use client';

import React, { useState, useEffect } from 'react';
import { Share, X, PlusSquare } from 'lucide-react';

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. iOS環境判定
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // 2. スタンドアロン表示（インストール済み）判定
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    // 3. 過去に閉じたかどうかの確認
    const isDismissed = localStorage.getItem('pwa_ios_prompt_dismissed') === '1';

    if (isIOS && !isStandalone && !isDismissed) {
      // 画面ロード直後のチラつきを防ぐため少し遅延して表示
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_ios_prompt_dismissed', '1');
  };

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="ホーム画面に追加の案内"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-white/95 p-4 shadow-sheet backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-akashiito text-white shadow-2xs">
            <PlusSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mincho text-sm font-bold text-ink">
              ホーム画面に追加してアプリとして使う
            </h2>
            <p className="mt-0.5 font-maru text-[11px] text-ink/60 leading-tight">
              Safari下部の共有ボタン <Share className="inline h-3 w-3 mx-0.5 text-ink/70 -mt-0.5" /> をタップし、
              <strong>「ホーム画面に追加」</strong>を選択してください。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink/40 hover:bg-paper hover:text-ink cursor-pointer transition"
          aria-label="案内を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
`;

writeFile('components/pwa/IOSInstallPrompt.tsx', iosInstallPromptTsx);

// -----------------------------------------------------------------------------
// 3. app/layout.tsx (iOS用PWAメタデータ & インストールプロンプトの追加)
// -----------------------------------------------------------------------------
const layoutTsx = `import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";

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
  themeColor: "#232A3B", // Tailwind ink トークン実値
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
      className={\`\${shipporiMincho.variable} \${zenKakuGothic.variable} \${zenMaruGothic.variable}\`}
    >
      <body className="flex min-h-screen flex-col items-center justify-start bg-paper antialiased">
        <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl min-h-screen flex flex-col px-4 py-6 sm:px-6 md:px-8">
          {children}
        </div>
        {/* iOS向けホーム画面追加の控えめな案内 */}
        <IOSInstallPrompt />
      </body>
    </html>
  );
}
`;

writeFile('app/layout.tsx', layoutTsx);

// -----------------------------------------------------------------------------
// 4. app/sw.ts (Serwist Service Worker ソースファイル)
// -----------------------------------------------------------------------------
const swTs = `import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. テスト送信・回答保存などのAPIルートは絶対にキャッシュせず常にネットワーク優先
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // 2. 動的ページ（ダッシュボード・グループ・弱点マップ等）: NetworkFirst 戦略
    // オンライン時は常に最新を取得し、回線切断・不安定時のみ直近のキャッシュにフォールバック
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
      }),
    },
    // 3. 静的アセット・フォント・画像などのデフォルトキャッシュ
    ...defaultCache,
  ],
});

serwist.addEventListeners();
`;

writeFile('app/sw.ts', swTs);

// -----------------------------------------------------------------------------
// 5. next.config.ts (Serwist プラグインの適用)
// -----------------------------------------------------------------------------
const nextConfigTs = `import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  // 動的SSR・APIルート・Supabase連携をそのまま維持
};

export default withSerwist(nextConfig);
`;

writeFile('next.config.ts', nextConfigTs);

// -----------------------------------------------------------------------------
// 6. package.json の依存関係更新 (@serwist/next & serwist 追加)
// -----------------------------------------------------------------------------
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    pkg.dependencies = pkg.dependencies || {};
    if (!pkg.dependencies['@serwist/next']) {
      pkg.dependencies['@serwist/next'] = '^9.0.11';
    }
    if (!pkg.dependencies['serwist']) {
      pkg.dependencies['serwist'] = '^9.0.11';
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[FILE] package.json に @serwist/next, serwist を追加しました');
  } catch (err) {
    console.error('package.json の更新に失敗しました:', err);
  }
}

// -----------------------------------------------------------------------------
// 7. public/icons/ フォルダと仮アイコン (SVG/PNGプレースホルダー)
// -----------------------------------------------------------------------------
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// プレースホルダー用SVGアイコン（画像配置までの404防止）
const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#232A3B"/>
  <rect x="32" y="32" width="448" height="448" rx="72" fill="#F5F4EF"/>
  <path d="M160 140 H352 V372 H160 Z" fill="#E2483D"/>
  <text x="256" y="280" font-size="72" font-weight="bold" fill="#FFFFFF" text-anchor="middle" font-family="sans-serif">単語</text>
</svg>`;

writeFile('public/icons/icon.svg', placeholderSvg);
console.log('[INFO] public/icons/ にアイコン画像を後ほど配置してください:');
console.log('       - icon-192x192.png');
console.log('       - icon-512x512.png');
console.log('       - icon-maskable-512x512.png');
console.log('       - apple-touch-icon.png');

console.log('\n================================================================');
console.log('✅ フェーズE-1: PWA化の全ファイルが正常に生成・更新されました！');
console.log('================================================================\n');
console.log('【次のステップ】');
console.log('1. npm install を実行して @serwist/next をインストール');
console.log('2. public/icons/ にアプリアイコン画像 (PNG) を配置');
console.log('3. npm run build && npm run start で本番ビルドでのPWA動作を確認');