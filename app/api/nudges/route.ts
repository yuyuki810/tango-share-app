import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { sendPushNotificationToUser } from '@/lib/push/sendPushNotification';

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

    const body = await req.json();
    const { targetId } = body;

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ error: 'Target ID is required' }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: '自分自身には応援を送れません' }, { status: 400 });
    }

    const todayJst = getTodayJST();

    const { data: sender } = await supabase
      .from('users')
      .select('group_id, name')
      .eq('id', user.id)
      .single();

    if (!sender?.group_id) {
      return NextResponse.json({ error: 'グループに参加していません' }, { status: 400 });
    }

    const { data: senderSession } = await supabase
      .from('test_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily_check')
      .eq('date', todayJst)
      .not('completed_at', 'is', null)
      .maybeSingle();

    if (!senderSession) {
      return NextResponse.json(
        { error: '自分が本日の本番チェックを完了するまで応援は送れません' },
        { status: 403 }
      );
    }

    const { data: target } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', targetId)
      .single();

    if (target?.group_id !== sender.group_id) {
      return NextResponse.json({ error: '同じグループのメンバーではありません' }, { status: 400 });
    }

    const { data: targetSession } = await supabase
      .from('test_sessions')
      .select('id')
      .eq('user_id', targetId)
      .eq('type', 'daily_check')
      .eq('date', todayJst)
      .not('completed_at', 'is', null)
      .maybeSingle();

    if (targetSession) {
      return NextResponse.json(
        { error: '相手は既に本日の本番チェックを受験済みです' },
        { status: 400 }
      );
    }

    const { data: insertedNudge, error: insertError } = await supabase
      .from('daily_nudges')
      .insert({
        group_id: sender.group_id,
        sender_id: user.id,
        target_id: targetId,
        date: todayJst,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '本日すでにこのメンバーに応援メッセージを送信済みです' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: '応援メッセージの送信に失敗しました', detail: insertError.message },
        { status: 500 }
      );
    }

    // Web Push通知をバックグラウンド送信 (失敗しても催促DB保存は成功させる)
    try {
      await sendPushNotificationToUser(supabase, targetId, {
        title: '単語道場 | 仲間からの応援',
        body: `${sender.name}さんから応援が届きました！「今日もいっしょに頑張ろう！」`,
        url: '/dashboard',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
      });
    } catch (pushErr) {
      console.error('Background push notification error:', pushErr);
    }

    return NextResponse.json({
      success: true,
      nudge: insertedNudge,
      message: '応援メッセージを送信しました！',
    });
  } catch (err: any) {
    console.error('Nudge API error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
