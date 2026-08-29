"use client";

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
          <button onClick={handleLogout} aria-label="ログアウト" className="rounded-lg p-2 text-ink-muted hover:bg-paper-hover hover:text-akashiito transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
};
