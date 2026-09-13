"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function NavigationPending() {
  const { pending } = useLinkStatus();

  return pending ? <span hidden data-site-loading="" /> : null;
}

export function SiteLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavigationPending />
    </Link>
  );
}
