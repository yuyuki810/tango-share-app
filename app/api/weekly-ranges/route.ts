import { NextRequest, NextResponse } from 'next/server';
  import { createClient } from '@/lib/supabase/server';
  import { calculateWeeklyPreview } from '@/lib/assignment/calculateWeeklyPreview';
  import { buildDailyAssignmentRows } from '@/lib/assignment/buildDailyAssignmentRows';
  import { getWeekDates } from '@/lib/assignment/weekDates';
  import type { CycleType, DayType } from '@/lib/assignment/cycleTypes';

  export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { wordbookId, weekStartDate, rangeStart, perDayCount, cycleType, customDayTypes } = body as {
      wordbookId: string;
      weekStartDate: string;
      rangeStart: number;
      perDayCount: number;
      cycleType: CycleType;
      customDayTypes?: DayType[];
    };

    if (!wordbookId || !weekStartDate || !rangeStart || !perDayCount || !cycleType) {
      return NextResponse.json({ error: '入力が不足しています' }, { status: 400 });
    }
    if (rangeStart < 1 || perDayCount < 1) {
      return NextResponse.json({ error: '開始No.・1日の単語数は1以上にしてください' }, { status: 400 });
    }
    if (cycleType === 'custom' && (!customDayTypes || customDayTypes.length !== 7)) {
      return NextResponse.json({ error: 'カスタムサイクルには7日分の設定が必要です' }, { status: 400 });
    }

    const { data: wordbook, error: wordbookError } = await supabase
      .from('wordbooks')
      .select('total_words')
      .eq('id', wordbookId)
      .single();
    if (wordbookError || !wordbook) {
      return NextResponse.json({ error: '単語帳が見つかりません' }, { status: 404 });
    }

    const preview = calculateWeeklyPreview({
      weekStartDate,
      rangeStart,
      perDayCount,
      cycleType,
      customDayTypes,
      wordbookTotalWords: wordbook.total_words,
    });

    if (preview.isOverflow) {
      return NextResponse.json(
        {
          error: `単語帳の最大No.(${wordbook.total_words})を超えています(No.${preview.calculatedEnd}まで到達予定)`,
        },
        { status: 400 }
      );
    }

    const { data: weeklyRange, error: upsertError } = await supabase
      .from('weekly_ranges')
      .upsert(
        {
          user_id: user.id,
          wordbook_id: wordbookId,
          week_start_date: weekStartDate,
          range_start: rangeStart,
          range_end: preview.calculatedEnd,
          per_day_count: perDayCount,
          cycle_type: cycleType,
          custom_day_types: cycleType === 'custom' ? customDayTypes : null,
        },
        { onConflict: 'user_id,week_start_date' }
      )
      .select()
      .single();

    if (upsertError || !weeklyRange) {
      return NextResponse.json({ error: '保存に失敗しました', detail: upsertError?.message }, { status: 500 });
    }

    // 該当週の日次割当を再生成
    const weekDates = getWeekDates(weekStartDate);
    await supabase
      .from('daily_assignments')
      .delete()
      .eq('user_id', user.id)
      .in('date', weekDates);

    const rows = buildDailyAssignmentRows(preview.days, user.id, wordbookId);
    if (rows.length > 0) {
      const { error: assignmentError } = await supabase
        .from('daily_assignments')
        .insert(rows);

      if (assignmentError) {
        return NextResponse.json(
          { error: '日次割当の保存に失敗しました', detail: assignmentError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ weeklyRange, dailyAssignments: rows });
  }
