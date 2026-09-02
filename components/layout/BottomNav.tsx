'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  // テスト中・単語カードめくり中は下部ナビを隠して全画面で集中させる
  if (pathname.startsWith('/test') || pathname.startsWith('/review-preview')) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: '📖' },
    { href: '/group', label: 'グループ', icon: '👥' },
    { href: '/weakness', label: '弱点マップ', icon: '🗺️' },
    { href: '/settings/wordbook', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-95 ${
                isActive ? 'text-akashiito font-bold' : 'text-ink/50 hover:text-ink'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5 font-maru text-[10px] md:text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
