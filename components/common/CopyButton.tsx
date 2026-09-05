'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className = '', label = 'コピー' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-maru text-xs font-semibold transition active:scale-95 cursor-pointer ${
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-line bg-white text-ink/80 hover:bg-paper hover:text-ink'
      } ${className}`}
      aria-label="招待コードをコピー"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="h-3.5 w-3.5 text-ink/50" />}
      <span>{copied ? 'コピー完了' : label}</span>
    </button>
  );
}
