import React from 'react';

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-[20%] left-[20%] w-[600px] h-[600px] rounded-full bg-indigo-200/35 blur-[160px]" />
      <div className="absolute top-[35%] -right-[10%] w-[550px] h-[550px] rounded-full bg-sky-200/30 blur-[150px]" />
      <div className="absolute -bottom-[20%] left-[30%] w-[600px] h-[600px] rounded-full bg-amber-100/40 blur-[160px]" />
      <div className="absolute inset-0 bg-light-grain opacity-[0.03]" />
    </div>
  );
}
