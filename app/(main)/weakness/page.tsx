export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeChunkStats } from '@/lib/weakness/computeChunkStats';
import { WeaknessMapClient } from '@/components/weakness/WeaknessMapClient';

export default async function WeaknessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('wordbook_id, wordbooks(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.wordbook_id) {
    redirect('/dashboard');
  }

  const wordbookName = (profile.wordbooks as { name?: string } | null)?.name ?? '';
  const chunks = await computeChunkStats(supabase, user.id, profile.wordbook_id);

  return (
    <main className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl w-full px-4 sm:px-0 pb-24 pt-6">
      <WeaknessMapClient chunks={chunks} wordbookName={wordbookName} />
    </main>
  );
}
