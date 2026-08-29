export type DayType = 'new' | 'review' | 'off';
export type CycleType = 'five_two' | 'four_three' | 'custom';

// 曜日順は 土,日,月,火,水,木,金 固定（土曜起点）
export const CYCLE_DAY_LABELS = ['土', '日', '月', '火', '水', '木', '金'] as const;

const FIVE_TWO: DayType[] = ['new', 'new', 'new', 'new', 'new', 'review', 'review'];
const FOUR_THREE: DayType[] = ['new', 'new', 'new', 'new', 'review', 'review', 'review'];

export function resolveDayTypes(cycleType: CycleType, customDayTypes?: DayType[]): DayType[] {
  if (cycleType === 'five_two') return FIVE_TWO;
  if (cycleType === 'four_three') return FOUR_THREE;
  if (cycleType === 'custom') {
    if (!customDayTypes || customDayTypes.length !== 7) {
      throw new Error('カスタムサイクルには7日分の設定が必要です');
    }
    return customDayTypes;
  }
  throw new Error(`不明な cycleType: ${cycleType}`);
}
