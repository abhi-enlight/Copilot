"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    // When pathname/searchParams update, turn off navigation bar after brief ease-out
    const timer = setTimeout(() => {
      setNavigating(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Intercept clicks on links that lead to another page
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        target.target !== "_blank" &&
        href !== pathname
      ) {
        setNavigating(true);
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [pathname]);

  if (!navigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-[2.5px] pointer-events-none overflow-hidden bg-transparent">
      <div className="h-full w-full bg-gradient-to-r from-sky-600 via-sky-400 to-amber-500 animate-shimmer shadow-[0_0_8px_rgba(2,132,199,0.6)]" />
    </div>
  );
}
