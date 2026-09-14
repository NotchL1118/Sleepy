"use client";

import { motion } from "motion/react";

export function ActiveIndicator() {
  return (
    <motion.span
      aria-hidden="true"
      layoutId="active-navigation"
      initial={false}
      className="pointer-events-none absolute inset-0 -z-10 bg-foreground/7"
      style={{ borderRadius: 9999 }}
    />
  );
}
