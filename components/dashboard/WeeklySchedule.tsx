'use client';

interface ScheduleDay {
  date: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  isReviewDay: boolean;
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
    <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isToday = day.date === todayDate;
          const isOff = day.rangeStart === null;

          return (
            <div
              key={day.date}
              className={`flex min-h-[80px] flex-col items-center justify-between rounded-2xl border p-1.5 text-center transition ${
                isToday
                  ? 'border-akashiito bg-akashiito/5 ring-2 ring-akashiito/30'
                  : day.isReviewDay
                  ? 'border-highlighter bg-highlighter/30'
                  : isOff
                  ? 'border-line/40 bg-line/20 text-ink/30'
                  : 'border-line/80 bg-paper'
              }`}
            >
              <div>
                <span className={`block font-maru text-[11px] font-bold ${isToday ? 'text-akashiito' : 'text-ink/60'}`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={`block font-maru text-xs font-bold ${isToday ? 'text-akashiito' : 'text-ink'}`}>
                  {formatDateShort(day.date)}
                </span>
              </div>

              <div className="my-1">
                {day.isReviewDay ? (
                  <span className="rounded-sm bg-highlighter/60 px-1 py-0.5 text-[9px] font-bold text-ink">
                    復習
                  </span>
                ) : isOff ? (
                  <span className="text-[10px] text-ink/30">休</span>
                ) : (
                  <span className="font-maru text-[10px] font-bold text-ink/80">
                    {day.rangeEnd !== null && day.rangeStart !== null ? day.rangeEnd - day.rangeStart + 1 : 0}語
                  </span>
                )}
              </div>

              {isToday ? (
                <div className="h-1.5 w-1.5 rounded-full bg-akashiito" />
              ) : (
                <div className="h-1.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
