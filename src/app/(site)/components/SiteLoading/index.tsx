import type { ReactNode } from "react";
import { LoadingAnimation } from "./LoadingAnimation";
import styles from "./index.module.css";

export function SiteFrame({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-site-frame="" className={`${styles.frame} min-h-dvh`}>
      {header}
      <div className={styles.content}>{children}</div>
      <div
        role="status"
        className={`${styles.overlay} fixed inset-x-0 bottom-0 z-30 grid place-content-center justify-items-center gap-1 bg-background text-muted`}
      >
        <LoadingAnimation />
        <span className="text-xs tracking-[0.13em]">正在加载</span>
      </div>
    </div>
  );
}

export function SiteLoading() {
  return (
    <main
      data-site-loading=""
      className="min-h-[calc(100dvh-var(--site-header-height))]"
    />
  );
}
