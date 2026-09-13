"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const codeButtonClassName = "min-h-9 rounded px-2 text-xs text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";

export function CopyCodeButton({ source }: { source: string }) {
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setFeedback(null), 2000);
  }

  return <button type="button" className={codeButtonClassName} onClick={copy} aria-live="polite">
    {feedback === "copied" ? "已复制" : feedback === "failed" ? "复制失败，请手动选择" : "复制"}
  </button>;
}

export function CodeBlock({ source, language, children }: { source: string; language: string; children: ReactNode }) {
  const [wrap, setWrap] = useState(false);
  return <div data-code-block="" data-wrap={wrap ? "true" : undefined}>
    <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1">
      <span className="min-w-0 truncate font-sans text-xs text-muted">{language === "text" ? "代码" : language}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className={codeButtonClassName} aria-pressed={wrap} onClick={() => setWrap(!wrap)}>{wrap ? "保留原行" : "自动换行"}</button>
        <CopyCodeButton source={source} />
      </div>
    </div>
    {children}
  </div>;
}
