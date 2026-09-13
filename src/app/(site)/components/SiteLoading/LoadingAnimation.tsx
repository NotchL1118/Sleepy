"use client";

import { useEffect, useRef } from "react";
import styles from "./index.module.css";

export function LoadingAnimation() {
  const animationRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    const animation = animationRef.current;
    const frame = animation?.closest("[data-site-frame]");
    if (!animation || !frame) return;

    const syncAnimation = () => {
      const loading = frame.querySelector("[data-site-loading]") !== null;

      // Share the CSS overlay's loading lifecycle, including the handoff from
      // Link pending to the streamed fallback. Never redraw during one wait.
      if (loading && !loadingRef.current) {
        animation.dataset.variant = Math.random() < 0.5 ? "book" : "sleepy";
      }
      loadingRef.current = loading;
    };

    const observer = new MutationObserver(syncAnimation);
    observer.observe(frame, { childList: true, subtree: true });
    syncAnimation();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={animationRef}
      aria-hidden="true"
      className={`${styles.art} grid h-[100px] w-[180px] place-items-center`}
    >
      <div className={`${styles.book} relative h-[38px] w-[54px] -rotate-[5deg]`}>
        <span className={styles.spine} />
        <span className={styles.pageLines} />
        <span className={styles.leaf} />
      </div>
      <div className={`${styles.sleepy} justify-items-center gap-[15px]`}>
        <span className="text-[28px] leading-none font-[450] tracking-[-0.045em] text-foreground opacity-85">
          Sleepy
        </span>
        <div className={`${styles.sleepSigns} flex min-h-[29px] items-baseline justify-center gap-[9px]`}>
          <span className="text-xs">z</span>
          <span className="text-[18px]">Z</span>
          <span className="text-[25px] text-accent">Z</span>
        </div>
      </div>
    </div>
  );
}
