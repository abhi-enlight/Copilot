export default function RootLoading() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] font-sans">
      {/* Top Header Skeleton */}
      <header className="h-14 bg-white/80 border-b border-black/[0.06] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl animate-shimmer" />
          <div className="w-24 h-4 rounded-md animate-shimmer hidden sm:block" />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-32 h-7 rounded-full animate-shimmer" />
          <div className="w-20 h-7 rounded-full animate-shimmer" />
          <div className="w-8 h-8 rounded-full animate-shimmer" />
        </div>
      </header>

      {/* Main 3-Panel Chassis Skeleton */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Rail Skeleton */}
        <aside className="w-64 h-full bg-white border-r border-black/[0.06] p-4 hidden md:flex flex-col justify-between flex-shrink-0">
          <div className="space-y-4">
            <div className="w-full h-10 rounded-xl animate-shimmer" />
            <div className="space-y-2 pt-2">
              <div className="w-full h-9 rounded-xl animate-shimmer" />
              <div className="w-full h-9 rounded-xl animate-shimmer" />
              <div className="w-full h-9 rounded-xl animate-shimmer" />
              <div className="w-full h-9 rounded-xl animate-shimmer" />
            </div>
          </div>
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <div className="w-6 h-6 rounded-lg animate-shimmer" />
            <div className="w-14 h-3 rounded-md animate-shimmer" />
          </div>
        </aside>

        {/* Center Chat Stream Skeleton */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative p-6">
          <div className="flex-1 max-w-3xl mx-auto w-full space-y-6 pt-4">
            {/* Assistant Welcome Message Skeleton */}
            <div className="flex items-start gap-3 w-full">
              <div className="w-7 h-7 rounded-lg animate-shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-4 rounded-md animate-shimmer" />
                <div className="w-1/2 h-4 rounded-md animate-shimmer" />
              </div>
            </div>

            {/* Quick Starters Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6">
              <div className="h-24 rounded-2xl animate-shimmer" />
              <div className="h-24 rounded-2xl animate-shimmer" />
              <div className="h-24 rounded-2xl animate-shimmer" />
            </div>
          </div>

          {/* Floating Input Dock Skeleton */}
          <div className="w-full max-w-2xl mx-auto mb-4">
            <div className="h-20 rounded-2xl animate-shimmer" />
          </div>
        </main>

        {/* Right Radar Feed Skeleton (Desktop) */}
        <aside className="w-[340px] h-full bg-[#FAFAF9] border-l border-black/[0.06] p-4 hidden xl:flex flex-col space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.05]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full animate-shimmer" />
              <div className="w-20 h-4 rounded-md animate-shimmer" />
            </div>
            <div className="w-12 h-4 rounded-full animate-shimmer" />
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-28 rounded-2xl animate-shimmer" />
            <div className="h-28 rounded-2xl animate-shimmer" />
            <div className="h-28 rounded-2xl animate-shimmer" />
          </div>
        </aside>
      </div>
    </div>
  );
}
