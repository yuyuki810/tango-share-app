/**
 * fix_vercel_build.js
 * Vercelビルドエラー（TypeScript型定義・アイコン画像・Turbopack互換性）一括修正スクリプト
 * 
 * 実行方法:
 *   node fix_vercel_build.js
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
  console.log(`[FILE] 生成完了: ${relativeFilePath}`);
}

function writeBinaryFile(relativeFilePath, base64Data) {
  const fullPath = path.join(process.cwd(), relativeFilePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
  console.log(`[FILE] 画像生成完了: ${relativeFilePath}`);
}

console.log('=== Vercelビルドエラー修正を開始します ===\n');

// 1. types/index.ts の新設 (@/types の未定義エラーを完全解消)
const typesIndexTs = `export interface Wordbook {
  id: string;
  name: string;
  total_words: number;
  created_at?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  wordbook_id?: string | null;
  wordbooks?: {
    name?: string;
    total_words?: number;
  } | null;
}

export interface UserProfile {
  id: string;
  name: string;
  group_id?: string | null;
  wordbook_id?: string | null;
  created_at?: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at?: string;
}
`;

writeFile('types/index.ts', typesIndexTs);

// 2. public/icons/ に実物の有効なPNGプレースホルダー画像を配置 (404/読込エラー防止)
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
writeBinaryFile('public/icons/icon-192x192.png', pngBase64);
writeBinaryFile('public/icons/icon-512x512.png', pngBase64);
writeBinaryFile('public/icons/icon-maskable-512x512.png', pngBase64);
writeBinaryFile('public/icons/apple-touch-icon.png', pngBase64);

// 3. next.config.ts を Vercel 本番ビルドに完全適合させる
const nextConfigTs = `import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Next.js 16 Turbopack 互換フラグ
};

// 開発時は Turbopack で高速起動、Vercel本番ビルド時は Serwist PWA をビルド
export default isDev
  ? nextConfig
  : require("@serwist/next").default({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      disable: false,
      reloadOnOnline: true,
    })(nextConfig);
`;

writeFile('next.config.ts', nextConfigTs);

console.log('\n================================================================');
console.log('✅ Vercelビルドに必要なファイルの修正が完了しました！');
console.log('================================================================\n');