import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, name, inviteCode } = body;

    if (action === "create") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "グループ名を入力してください" }, { status: 400 });
      }

      let code = generateInviteCode();
      let insertedGroup = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("groups")
          .insert({ name: name.trim(), invite_code: code })
          .select()
          .single();

        if (!error && data) {
          insertedGroup = data;
          break;
        }
        code = generateInviteCode();
      }

      if (!insertedGroup) {
        return NextResponse.json({ error: "グループ作成に失敗しました" }, { status: 500 });
      }

      await supabase.from("users").update({ group_id: insertedGroup.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group: insertedGroup });
    }

    if (action === "join") {
      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "招待コードを入力してください" }, { status: 400 });
      }

      const cleanCode = inviteCode.trim().toUpperCase();
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("id, name, invite_code")
        .eq("invite_code", cleanCode)
        .single();

      if (findError || !group) {
        return NextResponse.json({ error: "該当する招待コードのグループが見つかりません" }, { status: 404 });
      }

      await supabase.from("users").update({ group_id: group.id }).eq("id", user.id);
      return NextResponse.json({ success: true, group });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
