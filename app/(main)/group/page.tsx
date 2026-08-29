import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/assignment/weekDates';

export default async function GroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('group_id').eq('id', user.id).single();
  if (!me?.group_id) {
    return (
      <main className="mx-auto max-w-md px-4 py-6 text-center text-ink/60">
        グループに参加していません
      </main>
    );
  }

  const { data: members } = await supabase
    .from('users')
    .select('id, name')
    .eq('group_id', me.group_id);

  const today = getTodayJST();
  const memberIds = (members ?? []).map((m) => m.id);

  const { data: todaySessions } = await supabase
    .from('test_sessions')
    .select('user_id, correct_count, total_count')
    .eq('type', 'daily_check')
    .eq('date', today)
    .in('user_id', memberIds);

  const sessionByUser = new Map((todaySessions ?? []).map((s) => [s.user_id, s]));
  const done = (members ?? []).filter((m) => sessionByUser.has(m.id));
  const notDone = (members ?? []).filter((m) => !sessionByUser.has(m.id));

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6">
      <h1 className="font-mincho text-lg text-ink">今日のグループの様子</h1>

      <section>
        <h2 className="mb-2 text-sm text-ink/60">完了した人</h2>
        <ul className="space-y-2">
          {done.map((m) => {
            const s = sessionByUser.get(m.id)!;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3"
              >
                <span className="text-ink">{m.name}</span>
                <span className="font-maru text-sm text-ink/60">
                  {s.correct_count}/{s.total_count}
                </span>
              </li>
            );
          })}
          {done.length === 0 && <p className="text-sm text-ink/40">まだ誰もいません</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink/60">まだの人</h2>
        <ul className="space-y-2">
          {notDone.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-dashed border-line bg-white/50 px-4 py-3 text-ink/50"
            >
              {m.name}
            </li>
          ))}
          {notDone.length === 0 && <p className="text-sm text-ink/40">全員完了しています!</p>}
        </ul>
      </section>
    </main>
  );
}
