"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { CloseIcon } from "@/components/icons";
import { CopyCodeButton, codeButtonClassName } from "../CodeBlock";
import { useDiagramViewport } from "./useDiagramViewport";
import styles from "./index.module.css";

function useDiagram(source: string) {
  const { resolvedTheme } = useTheme();
  const [result, setResult] = useState<{ source: string; theme: string; svg?: string; failed?: boolean }>();
  useEffect(() => {
    if (!resolvedTheme) return;
    let current = true;
    import("./renderer")
      .then(({ renderMermaid }) => renderMermaid(source, () => current))
      .then((svg) => {
        if (current && svg) setResult({ source, theme: resolvedTheme, svg });
      })
      .catch(() => {
        if (current) setResult({ source, theme: resolvedTheme, failed: true });
      });
    return () => { current = false; };
  }, [source, resolvedTheme]);
  return result?.source === source && result.theme === resolvedTheme ? result : undefined;
}

function DiagramFallback({ source, failed }: { source: string; failed?: boolean }) {
  return <>
    <p className="px-4 pt-3 font-sans text-xs text-muted" role="status">
      {failed ? "图形暂时无法显示，你仍可查看和复制源码。" : "正在准备图形，源码仍可阅读。"}
    </p>
    <pre tabIndex={0} aria-label="Mermaid 源码"><code>{source}</code></pre>
  </>;
}

function MermaidViewer({ source, onClose, id }: { source: string; onClose: () => void; id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const diagram = useDiagram(source);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const { viewportRef, graphRef, x, y, scale, zoom, zoomBy, fit, actual } = useDiagramViewport(diagram?.svg);

  return createPortal(<dialog ref={dialog} id={id} aria-labelledby={titleId} className={styles.dialog} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="relative flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 sm:px-5">
      <h2 id={titleId} className="font-sans text-sm font-medium">Mermaid 图形</h2>
      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
        <button type="button" className={codeButtonClassName} aria-label="缩小图形" disabled={!diagram?.svg} onClick={() => zoomBy(1 / 1.25)}>−</button>
        <output className="min-w-11 text-center font-sans text-xs tabular-nums text-muted" aria-label="缩放比例">{diagram?.svg ? `${Math.round(zoom * 100)}%` : "—"}</output>
        <button type="button" className={codeButtonClassName} aria-label="放大图形" disabled={!diagram?.svg || zoom >= 8} onClick={() => zoomBy(1.25)}>＋</button>
        <button type="button" className={codeButtonClassName} disabled={!diagram?.svg} onClick={fit}>适应窗口</button>
        <button type="button" className={codeButtonClassName} disabled={!diagram?.svg} onClick={actual}>100%</button>
        <button ref={closeButton} type="button" className={`${codeButtonClassName} absolute right-3 top-1 sm:static`} aria-label="关闭放大视图" onClick={onClose}><CloseIcon className="size-4" /></button>
      </div>
    </div>
    <div ref={viewportRef} className={styles.viewport} data-ready={diagram?.svg ? "true" : undefined} tabIndex={0} role="region" aria-label="图形画布，滚轮或双指缩放，拖拽平移；方向键移动，加减号缩放，0 适应窗口，1 原始尺寸">
      {diagram?.svg ? <motion.div ref={graphRef} className={styles.expandedGraph} style={{ x: x, y: y, scale: scale }} dangerouslySetInnerHTML={{ __html: diagram.svg }} /> : <DiagramFallback source={source} failed={diagram?.failed} />}
    </div>
    <p className="m-0 shrink-0 border-t border-border px-3 py-2 font-sans text-xs text-muted sm:px-5">滚轮 / 双指缩放 · 拖拽平移 · Esc 关闭</p>
  </dialog>, document.body);
}

export function MermaidBlock({ source }: { source: string }) {
  const diagram = useDiagram(source);
  const [showSource, setShowSource] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const openViewer = () => setOpen(true);

  return <div data-mermaid-block="" className={styles.block}>
    <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1">
      <span className="min-w-0 truncate font-sans text-xs text-muted">Mermaid</span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className={codeButtonClassName} aria-pressed={showSource} onClick={() => setShowSource(!showSource)}>{showSource ? "图形" : "源码"}</button>
        <CopyCodeButton source={source} />
        <button type="button" className={codeButtonClassName} onClick={openViewer} disabled={!diagram?.svg} aria-haspopup="dialog" aria-controls={open ? dialogId : undefined}>放大</button>
      </div>
    </div>
    {showSource ? <pre tabIndex={0} aria-label="Mermaid 源码"><code>{source}</code></pre> : diagram?.svg ?
      <div className={styles.canvas}>
        <button type="button" className={styles.graphButton} onClick={openViewer} aria-label="放大 Mermaid 图形" aria-haspopup="dialog" aria-controls={open ? dialogId : undefined}>
          <span className={styles.graph} dangerouslySetInnerHTML={{ __html: diagram.svg }} />
        </button>
      </div> : <DiagramFallback source={source} failed={diagram?.failed} />}
    {open ? <MermaidViewer source={source} id={dialogId} onClose={() => setOpen(false)} /> : null}
  </div>;
}
