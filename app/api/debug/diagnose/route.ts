import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const diagnostics: Array<{
    step: string;
    status: "ok" | "error" | "warning";
    message: string;
    data?: any;
  }> = [];

  try {
    const supabase = await createClient();

    // 1. 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      diagnostics.push({
        step: "1. ログイン認証",
        status: "error",
        message: "ユーザーがログインしていません",
        data: authError?.message,
      });
      return NextResponse.json({ diagnostics });
    }

    diagnostics.push({
      step: "1. ログイン認証",
      status: "ok",
      message: `ログイン中: ${user.email} (ID: ${user.id})`,
    });

    // 2. 単語帳設定チェック
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, wordbook_id, wordbooks(name, total_words)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wordbook_id) {
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "error",
        message: "単語帳が設定されていません",
        data: profileError?.message,
      });
    } else {
      const wb = profile.wordbooks as any;
      diagnostics.push({
        step: "2. 単語帳設定",
        status: "ok",
        message: `選択中: ${wb?.name || "ID: " + profile.wordbook_id} (総語数: ${wb?.total_words ?? 0}語)`,
      });
    }

    // 3. 日次割当チェック
    const { data: assignments, error: assignError } = await supabase
      .from("daily_assignments")
      .select("id, date, range_start, range_end, is_review_day")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (assignError) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "error",
        message: "割当データの取得に失敗しました (RLS等の可能性)",
        data: assignError.message,
      });
    } else if (!assignments || assignments.length === 0) {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "warning",
        message: "割当が0件です。ダッシュボードで範囲を設定してください。",
      });
    } else {
      diagnostics.push({
        step: "3. 学習割当 (daily_assignments)",
        status: "ok",
        message: `現在 ${assignments.length} 日分の割当が設定されています`,
        data: assignments.map((a) => `${a.date}: No.${a.range_start}〜${a.range_end} (${a.is_review_day ? "復習" : "進める"})`),
      });
    }

    // 4. テストセッションチェック
    const { data: sessions, error: sessionsError } = await supabase
      .from("test_sessions")
      .select("id, date, type, correct_count, total_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (sessionsError) {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "error",
        message: "test_sessions の取得に失敗しました",
        data: sessionsError.message,
      });
    } else {
      diagnostics.push({
        step: "4. テストセッション (test_sessions)",
        status: "ok",
        message: `通算 ${sessions.length} 件のテスト履歴が見つかりました (最新5件取得)`,
        data: sessions.map((s) => `${s.date} [${s.type}]: ${s.correct_count}/${s.total_count}語 (${s.created_at})`),
      });
    }

    // 5. テスト回答チェック
    const { data: answers, error: answersError } = await supabase
      .from("test_answers")
      .select("id, is_known, origin_daily_assignment_id, word_id, session_id, created_at, test_sessions!inner(user_id)")
      .eq("test_sessions.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (answersError) {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "error",
        message: "test_answers の取得に失敗しました",
        data: answersError.message,
      });
    } else {
      diagnostics.push({
        step: "5. テスト回答 (test_answers)",
        status: "ok",
        message: `test_answers の取得成功 (最新10件)`,
        data: {
          totalFetched: answers.length,
          sample: answers.slice(0, 3),
        },
      });
    }

    // 6. 単語ごとの連続正解カウント (word_correct_streaks) チェック
    const { data: wordStreaks, error: wordStreaksError } = await supabase
      .from("word_correct_streaks")
      .select("word_id, streak_count, last_updated_date, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (wordStreaksError) {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "error",
        message: "word_correct_streaks の取得に失敗しました",
        data: wordStreaksError.message,
      });
    } else {
      diagnostics.push({
        step: "6. 連続正解カウント (word_correct_streaks)",
        status: "ok",
        message: `記録済み単語数: ${wordStreaks.length} 件 (最新10件取得)`,
        data: wordStreaks.map((s) => `WordID: ${s.word_id} => 連続正解 ${s.streak_count}回 (最終更新: ${s.last_updated_date})`),
      });
    }

    // 7. デイリースコアエントリー (daily_score_entries) チェック (フェーズC-3新設)
    const { data: scoreEntries, error: scoreError } = await supabase
      .from("daily_score_entries")
      .select("date, normalized_score, raw_score, word_count, accuracy_rate, computed_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5);

    if (scoreError) {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "error",
        message: "daily_score_entries の取得に失敗しました (マイグレーション未適用の可能性)",
        data: scoreError.message,
      });
    } else {
      diagnostics.push({
        step: "7. デイリースコア (daily_score_entries)",
        status: "ok",
        message: `スコア記録数: ${scoreEntries.length} 件 (最新5件取得)`,
        data: scoreEntries.map((e) => `${e.date}: ${e.normalized_score}点 (raw: ${e.raw_score}, 正答率: ${Math.round((e.accuracy_rate || 0) * 100)}%, ${e.word_count}語)`),
      });
    }

    return NextResponse.json({ diagnostics });
  } catch (err: any) {
    return NextResponse.json(
      { 
        diagnostics: [
          { 
            step: "致命的エラー", 
            status: "error", 
            message: err?.message || String(err) 
          } 
        ] 
      },
      { status: 500 }
    );
  }
}
