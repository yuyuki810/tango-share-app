/**
 * fix_weekdates.js
 * lib/assignment/weekDates.ts に DAY_LABELS_SAT を追加して上書き
 */

const fs = require('fs');
const path = require('path');

const content = `/**
 * 土曜始まりの曜日ラベル（土〜金）
 */
export const DAY_LABELS_SAT = ['土', '日', '月', '火', '水', '木', '金'] as const;

/**
 * JST (UTC+9) 基準の日付文字列 (YYYY-MM-DD) を取得する
 */
export function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * JST基準で今週の開始日(直近の土曜日)を取得する
 */
export function getThisWeekSaturdayJST(): string {
  const todayStr = getTodayJST();
  const [y, m, d] = todayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  // getUTCDay(): 0: 日, 1: 月, ..., 6: 土
  const day = date.getUTCDay();
  const diffToSat = (day + 1) % 7;
  date.setUTCDate(date.getUTCDate() - diffToSat);

  return date.toISOString().slice(0, 10);
}

/**
 * 週開始日(土曜日)から7日分(土〜金)の日付文字列の配列を返す
 */
export function getWeekDates(weekStartDate: string): string[] {
  const [y, m, d] = weekStartDate.split('-').map(Number);
  const dates: string[] = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(Date.UTC(y, m - 1, d + i));
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

/**
 * 指定日の前日の日付文字列を取得する
 */
export function getYesterday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
`;

const targetPath = path.join(process.cwd(), 'lib/assignment/weekDates.ts');
fs.writeFileSync(targetPath, content.trim() + '\n', 'utf8');
console.log('✅ lib/assignment/weekDates.ts updated successfully!');