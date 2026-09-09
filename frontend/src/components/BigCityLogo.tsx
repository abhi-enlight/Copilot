import React from "react";
import Image from "next/image";

interface BigCityLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  className?: string;
}

export default function BigCityLogo({
  size = 32,
  className = "",
  style,
  ...props
}: BigCityLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <Image
        src="/bigcity-logo-clean.png"
        alt="BigCity Promotions"
        width={size * 2}
        height={size * 2}
        className="w-full h-full object-contain"
        priority
      />
    </div>
  );
}
