'use client';

import React, { useState } from "react";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

interface ScoreEntryPoint {
  date: string;
  normalizedScore: number;
}

interface ScoreTrendCardProps {
  scoreHistory: ScoreEntryPoint[];
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

export function ScoreTrendCard({ scoreHistory }: ScoreTrendCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const chartWidth = 320;
  const chartHeight = 80;
  const paddingX = 35;
  const paddingY = 16;

  const hasData = scoreHistory.length > 0;

  const points = hasData
    ? scoreHistory.map((h, i) => {
        const x =
          scoreHistory.length === 1
            ? chartWidth / 2
            : paddingX + (i / (scoreHistory.length - 1)) * (chartWidth - paddingX * 2);

        const y = chartHeight - paddingY - (h.normalizedScore / 100) * (chartHeight - paddingY * 2);

        return {
          x,
          y,
          score: h.normalizedScore,
          date: formatDateLabel(h.date),
        };
      })
    : [];

  const pathD =
    points.length > 1
      ? points.reduce(
          (acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`,
          ""
        )
      : "";

  const latestScore = hasData ? scoreHistory[scoreHistory.length - 1]?.normalizedScore ?? 0 : 0;
  const maxScore = hasData ? Math.max(...scoreHistory.map((s) => s.normalizedScore)) : 0;

  return (
    <div className="rounded-3xl border border-line bg-white shadow-xs overflow-hidden transition-all text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-paper/50 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mincho text-sm md:text-base font-bold text-ink">
              スコア推移グラフ (直近30日)
            </h3>
            <span className="font-maru text-[10px] text-ink/50">
              {hasData ? `最高: ${maxScore}点 / 最新: ${latestScore}点` : "日々の学習成果を可視化"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-ink/40">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-5 pt-1 space-y-3 border-t border-line/40">
          {hasData ? (
            <div className="w-full overflow-x-auto py-2">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-24 w-full overflow-visible">
                <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#EBE8DF" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="#EBE8DF" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#EBE8DF" strokeWidth="1" />

                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#378ADD"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#378ADD" stroke="#FFFFFF" strokeWidth="2" />
                    <text x={p.x} y={p.y - 7} textAnchor="middle" fill="#185FA5" className="text-[10px] font-bold font-mono">
                      {p.score}
                    </text>
                    <text x={p.x} y={chartHeight + 1} textAnchor="middle" className="fill-ink/40 text-[9px] font-maru">
                      {p.date}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-paper/60 border border-line/60 text-center">
              <p className="font-mincho text-xs font-bold text-ink/60">まだスコア記録がありません</p>
              <p className="font-maru text-[10px] text-ink/40 mt-0.5">本番チェックを受験すると、ここに過去30日間の成長推移が表示されます</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
