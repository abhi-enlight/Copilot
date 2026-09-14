'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OperationsCockpitPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-900 text-stone-300">
      <p className="text-sm">Redirecting to Prism Copilot...</p>
    </div>
  );
}
