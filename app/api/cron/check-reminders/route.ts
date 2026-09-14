import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTodayJST } from '@/lib/assignment/weekDates';
import { sendPushNotificationToUser } from '@/lib/push/sendPushNotification';

export async function GET(req: NextRequest) {
  return handleCheckReminders(req);
}

export async function POST(req: NextRequest) {
  return handleCheckReminders(req);
}

async function handleCheckReminders(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.REMINDER_CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const todayJst = getTodayJST();

    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const currentHours = nowJst.getHours();
    const currentMinutes = nowJst.getMinutes();
    const currentMinutesOfDay = currentHours * 60 + currentMinutes;

    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, reminder_time')
      .not('reminder_time', 'is', null);

    if (groupsError || !groups || groups.length === 0) {
      return NextResponse.json({ message: 'No groups with reminder_time configured' });
    }

    const { data: sendLogs } = await supabase
      .from('reminder_send_log')
      .select('group_id')
      .eq('date', todayJst);

    const sentGroupIds = new Set((sendLogs ?? []).map((l) => l.group_id));

    const results = [];

    for (const group of groups) {
      if (sentGroupIds.has(group.id)) {
        continue;
      }

      if (!group.reminder_time) continue;

      const [rHour, rMin] = group.reminder_time.split(':\).map(Number);
      const reminderMinutesOfDay = rHour * 60 + rMin;

      const diffMinutes = currentMinutesOfDay - reminderMinutesOfDay;
      if (diffMinutes >= 0 && diffMinutes <= 30) {
        const { data: members } = await supabase
          .from('users')
          .select('id, name')
          .eq('group_id', group.id);

        if (!members || members.length === 0) continue;

        const memberIds = members.map((m) => m.id);

        const { data: completedSessions } = await supabase
          .from('test_sessions')
          .select('user_id')
          .eq('type', 'daily_check')
          .eq('date', todayJst)
          .not('completed_at', 'is', null)
          .in('user_id', memberIds);

        const completedUserIds = new Set((completedSessions ?? []).map((s) => s.user_id));
        const uncompletedMembers = members.filter((m) => !completedUserIds.has(m.id));
        let sentCount = 0;

        for (const target of uncompletedMembers) {
          const pushRes = await sendPushNotificationToUser(supabase, target.id, {
            title: `単語道場 | ${group.name}`,
            body: '本日の単語テストがまだ完了していません！毎日の積み重ねで記憶を定着させましょう。',
            url: '/dashboard',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
          });
          if (pushRes.sent > 0) sentCount += pushRes.sent;
        }

        await supabase.from('reminder_send_log').insert({
          group_id: group.id,
          date: todayJst,
        });

        results.push({
          groupId: group.id,
          groupName: group.name,
          reminderTime: group.reminder_time,
          uncompletedMembersCount: uncompletedMembers.length,
          pushNotificationsSent: sentCount,
        });
      }
    }

    return NextResponse.json({
      success: true,
      today: todayJst,
      currentTimeJST: `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`,
      remindersTriggered: results,
    });
  } catch (err: any) {
    console.error('Check reminders cron fatal error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err?.message }, { status: 500 });
  }
}
