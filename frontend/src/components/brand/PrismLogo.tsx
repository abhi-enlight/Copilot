import React from "react";
import BigCityLogo from "@/components/BigCityLogo";

interface PrismLogoProps {
  size?: number;
  /** tile = bordered tile (sidebar/header); glyph = mark on transparent bg */
  variant?: "tile" | "glyph";
  className?: string;
}

/**
 * BCP Assist brand mark (delegates to BigCityLogo).
 */
export default function PrismLogo({
  size = 34,
  variant = "tile",
  className = "",
}: PrismLogoProps) {
  return <BigCityLogo size={size} variant={variant} className={className} />;
}
