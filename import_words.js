const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. .env.local の環境変数を読み込む
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local ファイルが見つかりません。');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    }
  });

  return env;
}

// 簡易CSVパーサー（カンマ区切り、ダブルクォート対応）
function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  const rows = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const row = [];
    let insideQuote = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    rows.push(row);
  }

  return rows;
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SupabaseのURLまたはKEYが .env.local に設定されていません。');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // コマンド引数からCSVパスを取得（デフォルト: words.csv）
  const csvFileName = process.argv[2] || 'words.csv';
  const csvPath = path.isAbsolute(csvFileName)
    ? csvFileName
    : path.join(process.cwd(), csvFileName);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSVファイルが見つかりません: ${csvPath}`);
    console.log(`💡 使い方: node import_words.js [CSVファイルのパス]`);
    console.log(`例: node import_words.js system_words.csv`);
    process.exit(1);
  }

  console.log(`📖 CSVファイルを読み込み中: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvContent);

  const wordList = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const rawNum = row[0].replace(/[^0-9]/g, '');
    const num = parseInt(rawNum, 10);
    const word = row[1];
    const meaning = row[2];

    // 1行目がヘッダー（例: '番号', '単語'）の場合は自動スキップ
    if (isNaN(num) || !word || !meaning) {
      continue;
    }

    wordList.push({
      number: num,
      word: word,
      meaning: meaning,
    });
  }

  // 単語番号順にソート
  wordList.sort((a, b) => a.number - b.number);

  console.log(`✅ 有効な単語データ: ${wordList.length} 件 検出`);
  if (wordList.length === 0) {
    console.error('❌ 取り込み可能な単語データがありませんでした。');
    process.exit(1);
  }

  // 1. 単語帳マスタ (wordbooks) の作成 or 取得
  const wordbookName = 'システム英単語';
  console.log(`📚 単語帳「${wordbookName}」を設定中...`);

  let { data: existingWordbook } = await supabase
    .from('wordbooks')
    .select('id')
    .eq('name', wordbookName)
    .maybeSingle();

  let wordbookId = existingWordbook?.id;

  if (!wordbookId) {
    const { data: newWb, error: createError } = await supabase
      .from('wordbooks')
      .insert({
        name: wordbookName,
        total_words: wordList.length,
      })
      .select('id')
      .single();

    if (createError || !newWb) {
      console.error('❌ 単語帳の作成に失敗しました:', createError);
      process.exit(1);
    }
    wordbookId = newWb.id;
  } else {
    await supabase
      .from('wordbooks')
      .update({ total_words: wordList.length })
      .eq('id', wordbookId);

    console.log('🧹 既存の単語データを更新のためクリーンアップ中...');
    await supabase.from('words').delete().eq('wordbook_id', wordbookId);
  }

  // 2. words テーブルへバッチインサート (500件ずつ)
  const BATCH_SIZE = 500;
  console.log(`🚀 ${wordList.length} 件の単語を登録中... (${BATCH_SIZE}件ずつバッチ実行)`);

  for (let i = 0; i < wordList.length; i += BATCH_SIZE) {
    const batch = wordList.slice(i, i + BATCH_SIZE).map((w) => ({
      wordbook_id: wordbookId,
      number: w.number,
      word: w.word,
      meaning: w.meaning,
    }));

    const { error: insertError } = await supabase.from('words').insert(batch);
    if (insertError) {
      console.error(`❌ バッチ登録に失敗しました (No.${batch[0].number}〜):`, insertError);
      process.exit(1);
    }
    console.log(`  ✓ No.${batch[0].number} 〜 No.${batch[batch.length - 1].number} 登録完了`);
  }

  console.log('\n🎉 システム英単語のインポートが完了しました！');
  console.log(`📊 登録件数: ${wordList.length} 語 (No.${wordList[0].number} 〜 No.${wordList[wordList.length - 1].number})`);
  console.log('\n👉 アプリ設定（/settings/wordbook）で「システム英単語」を選択してテストを開始してください。');
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
