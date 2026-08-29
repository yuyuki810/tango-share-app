import { createClient } from "@/lib/supabase/server";

export async function resolveOriginAssignment(
  userId: string,
  wordbookId: string,
  wordIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!wordIds || wordIds.length === 0) return map;

  const supabase = await createClient();

  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, number")
    .in("id", wordIds);

  if (wordsError || !words || words.length === 0) {
    return map;
  }

  const { data: assignments, error: assignError } = await supabase
    .from("daily_assignments")
    .select("id, range_start, range_end")
    .eq("user_id", userId)
    .eq("wordbook_id", wordbookId)
    .eq("is_review_day", false);

  if (assignError || !assignments || assignments.length === 0) {
    return map;
  }

  for (const word of words) {
    const matched = assignments.find(
      (a) => word.number >= a.range_start && word.number <= a.range_end
    );
    if (matched) {
      map.set(word.id, matched.id);
    }
  }

  return map;
}
