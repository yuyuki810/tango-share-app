'use client';

import type { DayType } from '@/lib/assignment/cycleTypes';

const DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'];
const TYPE_ORDER: DayType[] = ['new', 'review', 'off'];
const TYPE_LABEL: Record<DayType, string> = { new: '新規', review: '復習', off: '休み' };
const TYPE_STYLE: Record<DayType, string> = {
  new: 'bg-paper border-ink text-ink font-medium',
  review: 'bg-highlighter/50 border-highlighter text-ink font-bold shadow-sm',
  off: 'bg-line/30 border-line text-ink/40',
};

interface DaySequenceEditorProps {
  value: DayType[];
  onChange: (next: DayType[]) => void;
}

export function DaySequenceEditor({ value, onChange }: DaySequenceEditorProps) {
  const cycleDay = (index: number) => {
    const current = value[index];
    const nextType = TYPE_ORDER[(TYPE_ORDER.indexOf(current) + 1) % TYPE_ORDER.length];
    const next = [...value];
    next[index] = nextType;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAY_LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => cycleDay(i)}
          className={`flex min-h-[46px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs transition active:scale-95 ${TYPE_STYLE[value[i]]}`}
        >
          <span className="font-maru text-xs">{label}</span>
          <span className="mt-0.5 text-[10px]">{TYPE_LABEL[value[i]]}</span>
        </button>
      ))}
    </div>
  );
}
