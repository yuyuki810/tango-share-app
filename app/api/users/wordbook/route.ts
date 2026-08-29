import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wordbookId } = await request.json();
    if (!wordbookId) {
      return NextResponse.json({ error: "単語帳を選択してください" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ wordbook_id: wordbookId })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "単語帳の設定に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
