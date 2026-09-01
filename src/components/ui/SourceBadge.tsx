import React from 'react';

type SourceBadgeProps = {
  label: string;
};

export function SourceBadge({ label }: SourceBadgeProps) {
  return (
    <span className="inline-flex items-center text-[10.5px] font-mono tracking-tight text-slate-500 hover:text-slate-700 transition-colors">
      <span className="w-1 h-1 rounded-full bg-slate-300 mr-1.5" />
      {label}
    </span>
  );
}
