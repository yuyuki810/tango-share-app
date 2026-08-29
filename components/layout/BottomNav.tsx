'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: '📖' },
    { href: '/review-preview', label: '単語カード', icon: '📇' },
    { href: '/history', label: '学習記録', icon: '📈' },
    { href: '/settings', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/80 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
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
              <span className="mt-0.5 font-maru text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
