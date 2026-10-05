"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion for the landing page. Apple-style gentle rise + fade.
 */
export default function Reveal({
  children,
  delay = 0,
  onMount = false,
  className = "",
  id,
}: {
  children: ReactNode;
  delay?: number;
  onMount?: boolean;
  className?: string;
  id?: string;
}) {
  const transition = { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const };

  if (onMount) {
    return (
      <motion.div
        id={id}
        data-reveal
        className={className}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
