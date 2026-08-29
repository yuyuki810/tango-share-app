import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

// .env.local を手動で読み込む関数
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...values] = trimmed.split("=");
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join("=").trim();
      }
    }
  }
}

// 環境変数をロード
loadEnv();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// URLの末尾に /rest/v1 などが付いていたら自動で除去
if (supabaseUrl && supabaseUrl.includes("/rest/v1")) {
  supabaseUrl = supabaseUrl.split("/rest/v1")[0];
}

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ エラー: .env.local からキーを読み込めませんでした。");
  console.error("URL:", supabaseUrl);
  console.error("Key:", supabaseKey ? "取得済み" : "未設定");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function seedWordbook(bookName: string, csvFilePath: string): Promise<void> {
  console.log(`\n📚 単語帳「${bookName}」の投入中...`);

  const absolutePath = path.resolve(process.cwd(), csvFilePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`CSVファイルが見つかりません: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, "utf-8");
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

  let wordbookId: string;
  const { data: existingBook } = await supabase
    .from("wordbooks")
    .select("id")
    .eq("name", bookName)
    .maybeSingle();

  if (existingBook) {
    wordbookId = existingBook.id;
    await supabase.from("wordbooks").update({ total_words: records.length }).eq("id", wordbookId);
    console.log(`既存の単語帳を更新: ID = ${wordbookId}`);
  } else {
    const { data: newBook, error } = await supabase
      .from("wordbooks")
      .insert({ name: bookName, total_words: records.length })
      .select("id")
      .single();
    if (error || !newBook) throw error;
    wordbookId = newBook.id;
    console.log(`新規単語帳を作成: ID = ${wordbookId}`);
  }

  const wordsToInsert = records.map((r: any) => ({
    wordbook_id: wordbookId,
    number: parseInt(String(r.number), 10),
    word: r.word,
    meaning: r.meaning,
  }));

  const { error: wordsError } = await supabase.from("words").upsert(wordsToInsert, {
    onConflict: "wordbook_id,number",
  });

  if (wordsError) throw wordsError;
  console.log(`✅ ${records.length} 語の投入が完了しました！`);
}

async function main() {
  try {
    await seedWordbook("標準英単語20 (サンプル)", "scripts/sample_words.csv");
    await seedWordbook("発展テーマ別英単語 (サンプル)", "scripts/sample_words.csv");
    console.log("\n🎉 全てのシードデータ投入が完了しました！\n");
  } catch (err: any) {
    console.error("❌ エラーが発生しました:", err.message || err);
    process.exit(1);
  }
}

main();