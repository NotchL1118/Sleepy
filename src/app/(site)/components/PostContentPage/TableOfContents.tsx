"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PostHeading } from "@/lib/posts/types";
import styles from "./index.module.css";

type TableOfContentsProps = {
  headings: readonly PostHeading[];
};

function TocLinks({ headings, activeId }: TableOfContentsProps & { activeId: string }) {
  const scrollArea = useRef<HTMLDivElement>(null);
  const baseDepth = Math.min(...headings.map((heading) => heading.depth));

  useEffect(() => {
    const area = scrollArea.current;
    const active = area?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!area || !active || !area.clientHeight) return;
    const container = area.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    // Scroll only the directory, never the article or a closed mobile disclosure.
    if (item.top < container.top) area.scrollTop += item.top - container.top;
    else if (item.bottom > container.bottom) area.scrollTop += item.bottom - container.bottom;
  }, [activeId]);

  return (
    <div ref={scrollArea} className={styles.tocScroll}>
      <ol className={styles.tocList}>
        {headings.map((heading) => (
          <li key={heading.id} style={{ "--toc-depth": heading.depth - baseDepth } as CSSProperties}>
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              className={activeId === heading.id ? styles.tocActive : undefined}
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      let active = headings[0]?.id ?? "";
      for (const { id } of headings) {
        const heading = document.getElementById(id);
        if (!heading) continue;
        // Match each heading's scroll offset, including enlarged root font sizes.
        const offset = Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 128;
        if (heading.getBoundingClientRect().top <= offset + 8) active = id;
        else break;
      }
      setActiveId(active);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Images, Mermaid and streamed Markdown may move headings after hydration.
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resize.disconnect();
    };
  }, [headings]);

  if (!headings.length) return null;

  return (
    <>
      <details className={styles.mobileToc}>
        <summary>本文目录</summary>
        <nav aria-label="文章目录">
          <TocLinks headings={headings} activeId={activeId} />
        </nav>
      </details>
      <aside className={styles.desktopTocRail}>
        <nav aria-label="文章目录" className={styles.desktopToc}>
          <p>本文目录</p>
          <TocLinks headings={headings} activeId={activeId} />
        </nav>
      </aside>
    </>
  );
}
