/**
 * setup_navigation.js
 * ボトムナビゲーションに「ホーム」と「グループ」を配置するコンポーネントを生成/更新
 */
const fs = require('fs');
const path = require('path');

const files = {
  'components/layout/BottomNav.tsx': `"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  // テスト実施中は集中できるようナビゲーションを非表示にする
  if (pathname === '/test') return null;

  const links = [
    { href: '/dashboard', label: 'ホーム', icon: '🏠' },
    { href: '/group', label: 'グループ', icon: '👥' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-line bg-paper/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-around px-4">
        {links.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                'flex flex-col items-center gap-1 text-xs transition ' +
                (isActive ? 'font-bold text-ink' : 'text-ink/50 hover:text-ink/80')
              }
            >
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('[OK] ' + filePath);
}
console.log('✅ ナビゲーションの配置が完了しました！');