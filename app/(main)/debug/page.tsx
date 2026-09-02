'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DiagnosticResult {
  step: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  data?: any;
}

export default function DebugPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      const res = await fetch('/api/debug/diagnose');
      const data = await res.json();
      setResults(data.diagnostics || []);
    } catch (err: any) {
      setResults([
        { 
          step: '診断API実行',
          status: 'error',
          message: '診断APIとの通信に失敗しました',
          data: err?.message || String(err),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-md w-full px-4 pb-24 pt-6 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          ダッシュボードへ戻る
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="font-mincho text-2xl font-bold text-ink">システム自己診断</h1>
            <p className="font-maru text-xs text-ink/50 mt-0.5">
              データベース疎通・RLS権限・回答保存状況の自己チェック
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 shadow-xs text-center">
        <button
          type="button"
          onClick={runDiagnostic}
          disabled={isRunning}
          className="w-full min-h-[50px] rounded-xl bg-ink font-mincho text-sm font-bold text-paper transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? '診断実行中...' : 'ワンタップで全項目を自己診断'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-mincho text-xs font-bold text-ink/60 px-1">診断結果一覧</h2>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3.5 space-y-1.5 transition ${
                  r.status === 'ok'
                    ? 'border-line bg-white'
                    : r.status === 'warning'
                    ? 'border-highlighter bg-highlighter/15'
                    : 'border-akashiito-border bg-akashiito/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mincho text-sm font-bold text-ink flex items-center gap-1.5">
                    {r.status === 'ok' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : r.status === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-akashiito" />
                    )}
                    {r.step}
                  </span>
                  <span
                    className={`font-maru text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-akashiito/20 text-akashiito'
                    }`}
                  >
                    {r.status === 'ok' ? '正常' : r.status === 'warning' ? '要確認' : 'エラー'}
                  </span>
                </div>
                <p className="font-maru text-xs text-ink/70 leading-relaxed">{r.message}</p>
                {r.data && (
                  <pre className="text-[10px] bg-black/5 p-2 rounded overflow-x-auto font-mono text-ink/80">
                    {typeof r.data === 'object' ? JSON.stringify(r.data, null, 2) : String(r.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
