import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: me } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', user.id)
      .single();

    if (!me?.group_id) {
      return NextResponse.json({ error: 'グループに参加していません' }, { status: 400 });
    }

    const body = await req.json();
    const { reminderTime } = body;

    let formattedTime: string | null = null;
    if (typeof reminderTime === 'string' && reminderTime.trim().length > 0) {
      const match = reminderTime.trim().match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])/);
      if (!match) {
        return NextResponse.json({ error: '時刻の形式が正しくありません (例: 20:00)' }, { status: 400 });
      }
      formattedTime = `${match[1].padStart(2, '0')}:${match[2]}:00`;
    }

    const { error: updateError } = await supabase
      .from('groups')
      .update({ reminder_time: formattedTime })
      .eq('id', me.group_id);

    if (updateError) {
      return NextResponse.json({ error: 'リマインダー時刻の保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reminderTime: formattedTime ? formattedTime.slice(0, 5) : null,
    });
  } catch (err: any) {
    console.error('Update reminder time error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
