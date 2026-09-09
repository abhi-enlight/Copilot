import React from "react";

interface PrismLogoProps {
  size?: number;
  /** tile = gradient squircle (sidebar/header); glyph = mark on transparent bg */
  variant?: "tile" | "glyph";
  className?: string;
}

/**
 * 🔷 Prism brand mark.
 *
 * A light beam enters a triangular prism from the left and refracts out the
 * right into violet → cyan rays, the "one interface, every system" metaphor.
 *
 * - variant="tile": gradient squircle tile (used in the sidebar / app chrome).
 * - variant="glyph": the prism on a transparent background (empty states,
 *   white surfaces), rendered with the brand gradient strokes.
 */
export default function PrismLogo({
  size = 34,
  variant = "tile",
  className = "",
}: PrismLogoProps) {
  if (variant === "glyph") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <defs>
          <linearGradient id="prism-glyph-stroke" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        {/* prism wedge */}
        <path
          d="M16 4.5 25 26H7L16 4.5Z"
          stroke="url(#prism-glyph-stroke)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* entering beam */}
        <path d="M1.5 20.5H8" stroke="#A8A29E" strokeWidth="2.2" strokeLinecap="round" />
        {/* refracted spectrum rays */}
        <path d="M16 15.5 22.5 23.5" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M21 17.5 26.5 24.5" stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" />
        {/* focal dot */}
        <circle cx="10.5" cy="14.5" r="1.9" fill="#7C3AED" />
      </svg>
    );
  }

  return (
    <div
      className={`prism-gradient inline-flex items-center justify-center rounded-[30%] text-white shadow-md shadow-violet-600/20 select-none flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none">
        <path
          d="M16 4.5 25 26H7L16 4.5Z"
          stroke="white"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M2.5 20.5H8" stroke="rgba(255,255,255,0.75)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 15.5 22.5 23.5" stroke="rgba(255,255,255,0.95)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M21 17.5 26.5 24.5" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
