'use client';

import { Check } from 'lucide-react';

export interface ScheduleDay {
  date: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
  isCompleted?: boolean;
}

interface WeeklyScheduleProps {
  days: ScheduleDay[];
  todayDate: string;
}

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];

function formatDateShort(dateStr: string): string {
  const [, , d] = dateStr.split('-').map(Number);
  return `${d}`;
}

export function WeeklySchedule({ days, todayDate }: WeeklyScheduleProps) {
  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-xs">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isToday = day.date === todayDate;
          const isOff = day.rangeStart === null;
          const isCompleted = !!day.isCompleted;

          // 色の役割定義:
          // 1. 完了日 (今日含む): エメラルドグリーン + チェック
          // 2. 本日の未完了枠: 中立な青 (#378ADD / #185FA5)
          // 3. 復習日 (未完了): ミント寄りのティール (#9FE1CB / #136C56)
          // 4. 休み: 薄いグレー
          // 5. 新規進捗日 (未完了): ペーパー
          let dayStyle = 'border-line/80 bg-paper text-ink';
          if (isCompleted) {
            dayStyle = isToday
              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-300 shadow-2xs'
              : 'border-emerald-300 bg-emerald-50/60 shadow-2xs';
          } else if (isToday) {
            dayStyle = 'border-[#378ADD] bg-[#EBF4FC] ring-2 ring-[#378ADD]/40';
          } else if (day.isReviewDay) {
            dayStyle = 'border-[#9FE1CB] bg-[#E6F7F2]';
          } else if (isOff) {
            dayStyle = 'border-line/40 bg-line/20 text-ink/30';
          }

          const labelColor = isCompleted
            ? 'text-emerald-800'
            : isToday
            ? 'text-[#185FA5]'
            : day.isReviewDay
            ? 'text-[#136C56]'
            : 'text-ink/60';

          const dateColor = isCompleted
            ? 'text-emerald-950 font-bold'
            : isToday
            ? 'text-[#185FA5] font-bold'
            : day.isReviewDay
            ? 'text-[#136C56] font-bold'
            : 'text-ink font-bold';

          return (
            <div
              key={day.date}
              className={`relative flex min-h-[82px] flex-col items-center justify-between rounded-2xl border p-1.5 text-center transition ${dayStyle}`}
            >
              {/* 曜日・日付ヘッダー */}
              <div>
                <span className={`block font-maru text-[11px] font-bold ${labelColor}`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={`block font-maru text-xs ${dateColor}`}>
                  {formatDateShort(day.date)}
                </span>
              </div>

              {/* 中央コンテンツ */}
              <div className="my-1 flex flex-col items-center justify-center">
                {isCompleted ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : day.isReviewDay ? (
                  <span className="rounded-sm bg-[#9FE1CB] border border-[#6ECBAE] px-1 py-0.5 text-[9px] font-bold text-[#136C56]">
                    復習
                  </span>
                ) : isOff ? (
                  <span className="text-[10px] text-ink/30 font-maru">休</span>
                ) : (
                  <span className="font-maru text-[10px] font-bold text-ink/80">
                    {day.rangeEnd !== null && day.rangeStart !== null
                      ? day.rangeEnd - day.rangeStart + 1
                      : 0}語
                  </span>
                )}
              </div>

              {/* 下部インジケータ */}
              <div className="flex h-1.5 items-center justify-center">
                {isToday ? (
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      isCompleted ? 'bg-emerald-600' : 'bg-[#378ADD]'
                    }`}
                  />
                ) : (
                  <div className="h-1.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
