import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Real product screenshots live in `frontend/public/screenshots/`. When a file is
 * present it is served through next/image; when it is missing the caller renders
 * a live component preview instead, so the page never shows a broken image.
 */
export function screenshotAvailable(fileName: string): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", "screenshots", fileName));
  } catch {
    return false;
  }
}

export default function Screenshot({
  fileName,
  alt,
  priority = false,
  width = 1600,
  height = 1000,
  sizes = "(min-width: 1024px) 640px, 100vw",
  className = "",
}: {
  fileName: string;
  alt: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
}) {
  return (
    <Image
      src={`/screenshots/${fileName}`}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={`h-auto w-full rounded-2xl border border-black/[0.06] ${className}`}
    />
  );
}
