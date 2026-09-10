import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const SIZES = {
  xs: { img: 'h-4 w-24 sm:w-26', wordmark: 'text-[9.5px]', subtext: 'text-[10px]', gap: 'gap-1.5' },
  sm: { img: 'h-5 w-28 sm:w-32', wordmark: 'text-[10px]', subtext: 'text-[10.5px]', gap: 'gap-2' },
  md: { img: 'h-7 w-40 sm:w-44', wordmark: 'text-sm', subtext: 'text-xs', gap: 'gap-2.5' },
  lg: { img: 'h-10 w-52 sm:w-56', wordmark: 'text-base', subtext: 'text-sm', gap: 'gap-3' },
} as const;

export type EnlightLogoSize = keyof typeof SIZES;

interface EnlightLogoProps {
  /** Where the logo navigates to when clicked. */
  href?: string;
  size?: EnlightLogoSize;
  layout?: 'horizontal' | 'stacked';
  className?: string;
  wordmarkClassName?: string;
  subtextClassName?: string;
  showWordmark?: boolean;
  wordmark?: string;
  subtext?: string;
  ariaLabel?: string;
  priority?: boolean;
}

/**
 * Enlight Lab brand lockup (modeled directly on OrgForge's OrgForgeLogo):
 * Renders the Enlight Lab logo (`public/enlight-logo.png`, 615×96)
 * with `object-contain` and gentle `scale-[1.02]` on hover.
 * Supports stacked layout (logo on top with subtext underneath)
 * and horizontal layout.
 */
export default function EnlightLogo({
  href,
  size = 'md',
  layout = 'horizontal',
  className = '',
  wordmarkClassName = '',
  subtextClassName = '',
  showWordmark = true,
  wordmark = 'BCP ASSIST',
  subtext,
  ariaLabel = 'BCP Assist, by Enlight Lab',
  priority = false,
}: EnlightLogoProps) {
  const s = SIZES[size];

  const imageElement = (
    <span aria-hidden="true" className={`relative block shrink-0 ${s.img}`}>
      <Image
        src="/enlight-logo.png"
        alt=""
        fill
        sizes="(min-width: 640px) 180px, 144px"
        className="object-contain transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        priority={priority}
      />
    </span>
  );

  const wordmarkElement = showWordmark ? (
    <span
      className={`font-bold tracking-[0.22em] text-stone-900 transition-colors duration-200 group-hover:text-blue-600 ${s.wordmark} ${wordmarkClassName}`}
    >
      {wordmark}
    </span>
  ) : null;

  let content: React.ReactNode;

  if (layout === 'stacked') {
    content = (
      <span className={`group inline-flex flex-col ${className}`}>
        <span className={`inline-flex items-center ${s.gap}`}>
          {imageElement}
          {wordmarkElement}
        </span>
        {subtext && (
          <span
            className={`text-stone-500 font-medium mt-0.5 tracking-tight ${s.subtext} ${subtextClassName}`}
          >
            {subtext}
          </span>
        )}
      </span>
    );
  } else {
    content = (
      <span className={`group inline-flex items-center ${s.gap} ${className}`}>
        {imageElement}
        {wordmarkElement}
        {subtext && (
          <span
            className={`text-stone-400 font-normal border-l border-stone-200/80 pl-2 ml-0.5 ${s.subtext} ${subtextClassName}`}
          >
            {subtext}
          </span>
        )}
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}

// Named export for compatibility
export { EnlightLogo };
