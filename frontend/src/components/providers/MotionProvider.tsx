"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Reduced motion is fewer and gentler animations, not none. With
 * `reducedMotion="user"` every `motion` component below it honours the OS
 * setting: transform and layout animations snap to their end state, while
 * opacity and colour still animate. That keeps the state-change feedback —
 * a drawer appearing, a toast arriving, a list item settling — legible
 * without anything travelling across the screen. Pairs with the reduced-
 * motion rules in globals.css, which do the same for CSS transitions and
 * keyframes.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
