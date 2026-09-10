import React from "react";
import Image from "next/image";

interface BigCityLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  variant?: "tile" | "glyph";
  className?: string;
}

export default function BigCityLogo({
  size = 32,
  variant = "glyph",
  className = "",
  style,
  ...props
}: BigCityLogoProps) {
  if (variant === "tile") {
    return (
      <div
        className={`inline-flex items-center justify-center relative flex-shrink-0 bg-white rounded-xl border border-stone-200/80 shadow-2xs p-1 ${className}`}
        style={{ width: size, height: size, ...style }}
        {...props}
      >
        <Image
          src="/bigcity-logo-clean.png"
          alt="BigCity Promotions - BCP Assist"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <Image
        src="/bigcity-logo-clean.png"
        alt="BigCity Promotions - BCP Assist"
        width={size * 2}
        height={size * 2}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}
