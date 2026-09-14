"use client";

import { motion, useReducedMotion } from "motion/react";
import { ClockIcon, DocumentIcon, HeartIcon, HomeIcon, MoreIcon } from "@/components/icons";

export type NavigationIconKind = "home" | "regular" | "heartwork" | "recent" | "more";

function Icon({ kind }: { kind: NavigationIconKind }) {
  switch (kind) {
    case "home": return <HomeIcon className="size-[18px]" />;
    case "regular": return <DocumentIcon selected className="size-[18px]" />;
    case "heartwork": return <HeartIcon selected className="size-[18px]" />;
    case "recent": return <ClockIcon className="size-[18px]" />;
    case "more": return <MoreIcon className="size-[18px]" />;
  }
}

export function NavigationIcon({ kind, selected }: {
  kind: NavigationIconKind;
  selected: boolean;
}) {
  const reduceMotion = useReducedMotion();

  if (!selected) return null;

  return (
    <motion.span
      aria-hidden="true"
      data-navigation-icon={kind}
      className="mr-2 inline-flex size-[18px] shrink-0 text-accent"
      initial={reduceMotion ? false : { opacity: 0, x: -5, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "tween", duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : 0.08, ease: "easeOut" }}
    >
      <Icon kind={kind} />
    </motion.span>
  );
}
