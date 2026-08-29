const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// .env.local の自動パース・読み込み
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').replace(/(^["']|["']$)/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL と Supabase Key を .env.local に設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleWords = [
  { number: 1, word: 'abandon', pronunciation: 'əˈbændən', meaning: '〜を捨てる、放棄する' },
  { number: 2, word: 'benefit', pronunciation: 'ˈbenɪfɪt', meaning: '利益、恩恵' },
  { number: 3, word: 'consequence', pronunciation: '', meaning: '結果、影響' },
  { number: 4, word: 'diminish', pronunciation: '', meaning: '減少する、弱める' },
  { number: 5, word: 'evident', pronunciation: '', meaning: '明白な' },
];

async function seed() {
  console.log('--- サンプル単語の投入を開始 ---');
  const { data: wordbook, error: wbError } = await supabase
    .from('wordbooks')
    .select('id, name')
    .eq('name', 'システム英単語')
    .single();

  if (wbError || !wordbook) {
    console.error('単語帳「システム英単語」が見つかりません。先にマイグレーションを実行してください。');
    return;
  }

  const rows = sampleWords.map((w) => ({
    ...w,
    wordbook_id: wordbook.id,
  }));

  const { error } = await supabase.from('words').upsert(rows, { onConflict: 'wordbook_id,number' });
  if (error) {
    console.error('単語投入エラー:', error.message);
  } else {
    console.log(`システム英単語に ${rows.length} 語のサンプルデータを投入しました。`);
  }
}

seed();
