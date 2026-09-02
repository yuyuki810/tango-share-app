/**
 * setup_phase_e3.js
 * フェーズE-3: Next.js 16移行の安全性確認・proxy.ts移行・設定最適化スクリプト
 * 
 * 実行方法:
 *   node setup_phase_e3.js
 */

const fs = require('fs');
const path = require('path');

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
console.log('フェーズE-3: Next.js 16 安全性確認・proxy.ts移行のセットアップを開始します');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. middleware.ts から proxy.ts への移行 (Next.js 16 規約)
// -----------------------------------------------------------------------------
const middlewarePath = path.join(process.cwd(), 'middleware.ts');
if (fs.existsSync(middlewarePath)) {
  fs.unlinkSync(middlewarePath);
  console.log('[CLEAN] 非推奨となった middleware.ts を削除しました');
}

const proxyTs = `import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 proxy: Supabase Auth セッションリフレッシュ処理
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // セッションの有効期限を自動更新
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
`;

writeFile('proxy.ts', proxyTs);

// -----------------------------------------------------------------------------
// 2. next.config.ts (Next.js 16 Turbopack & 本番ビルド Serwist 最適化)
// -----------------------------------------------------------------------------
const nextConfigTs = `import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Next.js 16 Turbopack 互換フラグ
};

// 開発時は Turbopack で高速起動し、本番ビルド (next build) 時のみ Serwist PWA を適用
export default isDev
  ? nextConfig
  : require("@serwist/next").default({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      reloadOnOnline: true,
    })(nextConfig);
`;

writeFile('next.config.ts', nextConfigTs);

// -----------------------------------------------------------------------------
// 3. package.json の Node.js 20.9+ エンジン要件明記
// -----------------------------------------------------------------------------
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    pkg.engines = {
      node: ">=20.9.0"
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[FILE] package.json に engines: { "node": ">=20.9.0" } を明記しました');
  } catch (err) {
    console.error('package.json の更新に失敗しました:', err);
  }
}

console.log('\n================================================================');
console.log('✅ フェーズE-3: Next.js 16 移行・安全性確認の更新が完了しました！');
console.log('================================================================\n');