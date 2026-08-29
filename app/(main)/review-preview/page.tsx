'use client';

import { WordJudgeCardScreen } from '@/components/review/WordJudgeCardScreen';
import type { WordCardData } from '@/components/review/WordJudgeCard';

const MOCK_CARDS: WordCardData[] = [
  {
    wordId: '1',
    headword: 'cat',
    pronunciation: 'kæt',
    meaning: '猫',
    exampleSentence: 'I have a cat.',
    studyCount: 0,
  },
  {
    wordId: '2',
    headword: 'benefit',
    pronunciation: 'ˈbenɪfɪt',
    meaning: '利益、恩恵',
    exampleSentence: 'It will benefit everyone.',
    studyCount: 2,
  },
  {
    wordId: '3',
    headword: 'consequence',
    pronunciation: 'ˈkɑːnsəkwens',
    meaning: '結果、影響',
    exampleSentence: 'Consider the consequences.',
    studyCount: 5,
  },
  {
    wordId: '4',
    headword: 'characteristically',
    pronunciation: 'ˌkærəktəˈrɪstɪkli',
    meaning: '特徴的に、相変わらず',
    studyCount: 1,
  },
  {
    wordId: '5',
    headword: 'abandon',
    pronunciation: 'əˈbændən',
    meaning: '〜を捨てる、放棄する',
    exampleSentence: 'He abandoned the plan.',
    studyCount: 3,
  },
  {
    wordId: '6',
    headword: 'diminish',
    pronunciation: 'dɪˈmɪnɪʃ',
    meaning: '減少する、弱める',
    studyCount: 0,
  },
  {
    wordId: '7',
    headword: 'genuine',
    pronunciation: 'ˈdʒenjuɪn',
    meaning: '本物の、心からの',
    studyCount: 4,
  },
  {
    wordId: '8',
    headword: 'fluctuate',
    pronunciation: 'ˈflʌktʃueɪt',
    meaning: '変動する',
    studyCount: 1,
  },
  {
    wordId: '9',
    headword: 'illustrate',
    pronunciation: 'ˈɪləstreɪt',
    meaning: '説明する、示す',
    studyCount: 2,
  },
  {
    wordId: '10',
    headword: 'justify',
    pronunciation: 'ˈdʒʌstɪfaɪ',
    meaning: '正当化する',
    studyCount: 0,
  },
];

export default function ReviewPreviewPage() {
  return (
    <main className="mx-auto h-[100dvh] max-w-md bg-paper">
      <WordJudgeCardScreen
        cards={MOCK_CARDS}
        onJudge={(wordId, isKnown) => {
          console.log('judged', wordId, isKnown);
        }}
        onAllDone={() => {
          console.log('all done');
        }}
      />
    </main>
  );
}
