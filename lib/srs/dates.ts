export function getTodayJST(): string {
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return jstFormatter.format(now);
}

export function addDaysJST(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isYesterdayJST(prevDateStr: string | null, todayStr: string): boolean {
  if (!prevDateStr) return false;
  return prevDateStr === addDaysJST(todayStr, -1);
}
