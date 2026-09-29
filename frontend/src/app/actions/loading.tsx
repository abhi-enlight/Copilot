export default function ActionsLoading() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] font-sans select-none">
      {/* Top Header Skeleton */}
      <header className="h-14 bg-white/80 border-b border-black/[0.06] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl animate-shimmer" />
          <div className="w-28 h-4 rounded-md animate-shimmer" />
        </div>
        <div className="w-24 h-7 rounded-full animate-shimmer" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Nav rail skeleton */}
        <aside className="w-64 h-full bg-white border-r border-black/[0.06] p-4 hidden md:flex flex-col justify-between flex-shrink-0">
          <div className="space-y-3">
            <div className="w-full h-10 rounded-xl animate-shimmer" />
            <div className="space-y-2 pt-2">
              <div className="w-full h-9 rounded-xl animate-shimmer" />
              <div className="w-full h-9 rounded-xl animate-shimmer" />
              <div className="w-full h-9 rounded-xl animate-shimmer" />
            </div>
          </div>
        </aside>

        {/* Center Main Ledger Skeleton */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAFAF9]">
          {/* Subheader Toolbar */}
          <div className="p-6 bg-white border-b border-black/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="w-48 h-5 rounded-md animate-shimmer" />
              <div className="w-80 h-3 rounded-md animate-shimmer" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl animate-shimmer" />
              <div className="w-28 h-8 rounded-xl animate-shimmer" />
            </div>
          </div>

          {/* Filter Bar Skeleton */}
          <div className="px-6 py-3 bg-white border-b border-black/[0.04] flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-7 rounded-lg animate-shimmer" />
              <div className="w-20 h-7 rounded-lg animate-shimmer" />
              <div className="w-20 h-7 rounded-lg animate-shimmer" />
            </div>
            <div className="w-28 h-7 rounded-lg animate-shimmer hidden sm:block" />
          </div>

          {/* Action Cards List Skeleton */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5 max-w-4xl mx-auto w-full">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white border border-black/[0.07] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl animate-shimmer flex-shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="w-44 h-4 rounded-md animate-shimmer" />
                    <div className="w-64 h-3 rounded-md animate-shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-20 h-6 rounded-full animate-shimmer" />
                  <div className="w-16 h-3 rounded-md animate-shimmer hidden sm:block" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
