'use client';

import React, { useState } from 'react';
import { Bell, Check, AlertCircle } from 'lucide-react';

interface ReminderSettingCardProps {
  currentReminderTime: string | null;
}

const PRESET_TIMES = [
  { label: '20:00', value: '20:00' },
  { label: '21:00', value: '21:00' },
  { label: '22:00', value: '22:00' },
];

export function ReminderSettingCard({ currentReminderTime }: ReminderSettingCardProps) {
  const [reminderTime, setReminderTime] = useState<string>(
    currentReminderTime ? currentReminderTime.slice(0, 5) : ''
  );
  const [isCustom, setIsCustom] = useState<boolean>(
    !!currentReminderTime && !PRESET_TIMES.some((p) => p.value === currentReminderTime.slice(0, 5))
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (newTime: string | null) => {
    setIsLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/groups/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderTime: newTime }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '設定の保存に失敗しました');
      }

      setReminderTime(data.reminderTime || '');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const isConfigured = !!reminderTime;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-2xs space-y-3.5 text-left">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-ink">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mincho text-sm font-bold text-ink">
              グループ自動リマインダー
            </h3>
            <p className="font-maru text-[10px] text-ink/50">
              設定時刻に未受検のメンバーへ自動通知（誰でも変更可）
            </p>
          </div>
        </div>

        {isConfigured ? (
          <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900 shadow-2xs">
            毎日 {reminderTime}
          </span>
        ) : (
          <span className="rounded-full bg-line/30 px-2 py-0.5 font-maru text-[10px] font-bold text-ink/40">
            オフ
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TIMES.map((p) => {
            const isSelected = reminderTime === p.value && !isCustom;
            return (
              <button
                key={p.value}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setIsCustom(false);
                  handleSave(p.value);
                }}
                className={`flex-1 min-h-[36px] rounded-xl border font-mono text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                  isSelected
                    ? 'border-ink bg-ink text-paper shadow-2xs'
                    : 'border-line bg-paper/60 text-ink/70 hover:bg-paper'
                }`}
              >
                {p.label}
              </button>
            );
          })}

          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsCustom(true)}
            className={`min-h-[36px] px-3 rounded-xl border font-maru text-xs font-bold transition active:scale-95 cursor-pointer ${
              isCustom
                ? 'border-ink bg-ink text-paper shadow-2xs'
                : 'border-line bg-paper/60 text-ink/70 hover:bg-paper'
            }`}
          >
            時刻指定
          </button>

          {isConfigured && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setIsCustom(false);
                handleSave(null);
              }}
              className="min-h-[36px] px-3 rounded-xl border border-line bg-white font-maru text-xs text-ink/40 hover:text-akashiito transition active:scale-95 cursor-pointer"
            >
              オフにする
            </button>
          )}
        </div>

        {isCustom && (
          <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
            <div className="relative flex-1">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-line bg-white px-3 font-mono text-sm font-bold text-ink shadow-2xs focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
            <button
              type="button"
              disabled={isLoading || !reminderTime}
              onClick={() => handleSave(reminderTime)}
              className="min-h-[40px] px-4 rounded-xl bg-ink font-mincho text-xs font-bold text-paper shadow-sm transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              設定する
            </button>
          </div>
        )}
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-1.5 text-emerald-700 font-maru text-[11px] animate-in fade-in">
          <Check className="h-3.5 w-3.5" />
          <span>リマインダー時刻を保存しました</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-akashiito font-maru text-[11px] animate-in fade-in">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
