/**
 * 日本時間(Asia/Tokyo)基準の日付計算ユーティリティ
 * 週のサイクルは「土曜日始まり・金曜日終わり」の7日間
 */

export function getTodayJST(): string {
  const now = new Date();
  return now.toLocaleString('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 指定日(YYYY-MM-DD)が属する「土曜始まりの週」の土曜日の日付を返す */
export function getSaturdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=日, 1=月, ..., 6=土
  date.setUTCDate(date.getUTCDate() - ((dayOfWeek + 1) % 7));
  return date.toISOString().slice(0, 10);
}

export function getThisWeekSaturdayJST(): string {
  return getSaturdayOf(getTodayJST());
}

/** 指定土曜日の1週間前(-7日)の土曜日を返す */
export function getPreviousSaturday(saturdayStr: string): string {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** 土曜日から金曜日までの7日分の日付配列(YYYY-MM-DD)を返す */
export function getWeekDates(saturdayStr: string): string[] {
  const [y, m, d] = saturdayStr.split('-').map(Number);
  const saturday = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(saturday);
    dt.setUTCDate(saturday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}
