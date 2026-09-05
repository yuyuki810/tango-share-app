'use client';

import type { PreviewDay } from '@/lib/assignment/calculateWeeklyPreview';

const TYPE_BADGE: Record<PreviewDay['type'], { label: string; className: string }> = {
  new: { label: '新規進捗', className: 'bg-paper text-ink border-line font-medium' },
  review: { label: '総復習', className: 'bg-[#E6F7F2] text-[#136C56] border-[#9FE1CB] font-bold shadow-2xs' },
  off: { label: '休み', className: 'bg-line/30 text-ink/40 border-line' },
};

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

interface WeeklyPreviewPanelProps {
  days: PreviewDay[];
}

export function WeeklyPreviewPanel({ days }: WeeklyPreviewPanelProps) {
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const badge = TYPE_BADGE[day.type];
        return (
          <div
            key={day.date}
            className="flex min-h-[48px] items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 font-maru text-sm font-bold text-ink">
                {formatDateLabel(day.date)} {day.dayLabel}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <span className="font-maru text-sm font-bold text-ink">
              {day.rangeStart !== null ? `No.${day.rangeStart} 〜 No.${day.rangeEnd}` : '休み'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
