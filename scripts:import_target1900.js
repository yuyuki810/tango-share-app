/**
 * scripts/import_target1900.js
 * ターゲット1900 CSV一括インポートスクリプト
 * 
 * 実行コマンド:
 *   node scripts/import_target1900.js [CSVファイルのパス]
 *   例: node scripts/import_target1900.js target1900.csv
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. .env.local 自動読み込み
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log(`[ENV] 環境変数を読み込みました: ${envPath}`);
      break;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// サービスロールキーがあれば優先（RLSをバイパス）、なければAnonキーを使用
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ エラー: NEXT_PUBLIC_SUPABASE_URL または SUPABASE_KEY が見つかりません。.env.local を確認してください。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. CSVパーサー (カンマ区切り・ダブルクォート対応)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];

  for (const line of lines) {
    const row = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        row.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim().replace(/^"|"$/g, ''));
    rows.push(row);
  }
  return rows;
}

async function main() {
  const targetFile = process.argv[2] || 'target1900.csv';
  const fullPath = path.isAbsolute(targetFile) ? targetFile : path.join(process.cwd(), targetFile);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ エラー: CSVファイルが見つかりません: ${fullPath}`);
    console.log('💡 使用方法: node scripts/import_target1900.js [CSVファイルのパス]');
    process.exit(1);
  }

  console.log(`📂 CSVファイルを読み込み中: ${fullPath}`);
  const csvContent = fs.readFileSync(fullPath, 'utf8');
  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    console.error('❌ エラー: CSVが空です。');
    process.exit(1);
  }

  // 3. ヘッダー行の判定と列マッピング
  let headerRow = rows[0].map((h) => h.toLowerCase());
  let dataRows = rows.slice(1);

  let numIdx = headerRow.findIndex((h) => ['no', 'number', 'id', '番号', 'no.'].includes(h));
  let wordIdx = headerRow.findIndex((h) => ['word', 'headword', 'english', '単語', '英語', '見出し語'].includes(h));
  let meaningIdx = headerRow.findIndex((h) => ['meaning', 'japanese', '意味', '日本語', '訳', '和訳'].includes(h));
  let pronIdx = headerRow.findIndex((h) => ['pronunciation', 'ipa', '発音', '発音記号'].includes(h));

  // ヘッダーがなく1行目からデータ（例: "1,create,創造する"）の場合のフォールバック
  if (wordIdx === -1 || meaningIdx === -1) {
    console.log('ℹ️ ヘッダーが検出されないため、列順 [番号, 単語, 意味, (発音)] でパースします。');
    dataRows = rows;
    numIdx = 0;
    wordIdx = 1;
    meaningIdx = 2;
    pronIdx = 3;
  }

  console.log(`📊 対象単語数: ${dataRows.length} 語`);

  // 4. 単語帳 (wordbooks) レコードの作成または取得
  const wordbookName = 'ターゲット1900';
  let wordbookId = null;

  const { data: existingWb } = await supabase
    .from('wordbooks')
    .select('id')
    .eq('name', wordbookName)
    .maybeSingle();

  if (existingWb) {
    wordbookId = existingWb.id;
    console.log(`📖 既存の単語帳を使用します: "${wordbookName}" (ID: ${wordbookId})`);
    // 総語数を更新
    await supabase.from('wordbooks').update({ total_words: dataRows.length }).eq('id', wordbookId);
  } else {
    const { data: newWb, error: wbError } = await supabase
      .from('wordbooks')
      .insert({ name: wordbookName, total_words: dataRows.length })
      .select('id')
      .single();

    if (wbError || !newWb) {
      console.error('❌ 単語帳の作成に失敗しました:', wbError?.message);
      process.exit(1);
    }
    wordbookId = newWb.id;
    console.log(`📖 新規単語帳を作成しました: "${wordbookName}" (ID: ${wordbookId})`);
  }

  // 5. 単語データの構築
  const wordsToInsert = [];
  dataRows.forEach((r, idx) => {
    const num = numIdx !== -1 && r[numIdx] && !isNaN(Number(r[numIdx])) ? Number(r[numIdx]) : idx + 1;
    const word = wordIdx !== -1 && r[wordIdx] ? r[wordIdx] : '';
    const meaning = meaningIdx !== -1 && r[meaningIdx] ? r[meaningIdx] : '';
    const pronunciation = pronIdx !== -1 && r[pronIdx] ? r[pronIdx] : null;

    if (word && meaning) {
      wordsToInsert.push({
        wordbook_id: wordbookId,
        number: num,
        word: word,
        meaning: meaning,
        pronunciation: pronunciation,
      });
    }
  });

  console.log(`🚀 ${wordsToInsert.length} 語のデータベース登録を開始します...`);

  // 6. 200件ずつのバッチ登録 (負荷軽減・タイムアウト防止)
  const BATCH_SIZE = 200;
  let insertedCount = 0;

  // 既存単語を一旦クリアして再インポートする場合
  await supabase.from('words').delete().eq('wordbook_id', wordbookId);

  for (let i = 0; i < wordsToInsert.length; i += BATCH_SIZE) {
    const batch = wordsToInsert.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from('words').insert(batch);

    if (insertError) {
      console.error(`❌ バッチ登録エラー (${i + 1}〜${i + batch.length}語):`, insertError.message);
    } else {
      insertedCount += batch.length;
      process.stdout.write(`\r進捗: [${insertedCount} / ${wordsToInsert.length}語 登録完了]`);
    }
  }

  console.log('\n\n================================================================');
  console.log(`🎉 ターゲット1900 のインポートが正常に完了しました！ (計 ${insertedCount} 語)`);
  console.log('================================================================');
  console.log('💡 アプリの「単語帳設定」またはオンボーディングで「ターゲット1900」を選択して学習を開始できます。');
}

main().catch((err) => {
  console.error('致命的エラー:', err);
  process.exit(1);
});