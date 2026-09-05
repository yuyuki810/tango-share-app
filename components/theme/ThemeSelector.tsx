'use client';

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
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99] ${
                isSelected
                  ? 'border-akashiito bg-paper-card ring-2 ring-akashiito shadow-sm'
                  : 'border-line bg-paper-card hover:bg-paper-hover'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  {/* テーマアイコン */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isSelected
                        ? 'bg-akashiito text-white shadow-2xs'
                        : 'bg-paper text-ink-muted border border-line'
                    }`}
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
