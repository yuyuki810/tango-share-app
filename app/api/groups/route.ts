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

    // 1. グループ作成
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

    // 2. 招待コードで参加
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

    // 3. グループ脱退 (ユーザーの全個人データ・学習履歴は保持)
    if (action === "leave") {
      const { data: me } = await supabase
        .from("users")
        .select("group_id")
        .eq("id", user.id)
        .single();

      if (!me?.group_id) {
        return NextResponse.json({ error: "グループに参加していません" }, { status: 400 });
      }

      const oldGroupId = me.group_id;

      // ユーザーの group_id を null に更新
      const { error: updateError } = await supabase
        .from("users")
        .update({ group_id: null })
        .eq("id", user.id);

      if (updateError) {
        return NextResponse.json({ error: "グループの脱退に失敗しました" }, { status: 500 });
      }

      // 残りメンバー数が0人になった場合は孤立グループを安全に削除
      const { count: remainingMembers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("group_id", oldGroupId);

      if (remainingMembers === 0) {
        await supabase.from("groups").delete().eq("id", oldGroupId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Group API fatal error:", err);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました" }, { status: 500 });
  }
}
