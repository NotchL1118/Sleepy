"use client";

import { useEffect, useRef, useState } from "react";
import type { PostKind } from "@/lib/posts/types";
import { MarkdownPreview } from "../MarkdownPreview";

export type EditorView = "edit" | "split" | "preview";

const splitStorageKey = "sleepy:post-editor:split";

export function MarkdownEditorField({
  error,
  kind,
  onChange,
  onImportFiles,
  readOnly,
  value,
  view,
}: {
  error?: string;
  kind: PostKind;
  onChange: (value: string) => void;
  onImportFiles: (files: readonly File[]) => void;
  readOnly: boolean;
  value: string;
  view: EditorView;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fileDragDepthRef = useRef(0);
  const [editorShare, setEditorShare] = useState(50);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState(value);

  useEffect(() => {
    const storedShare = Number(window.localStorage.getItem(splitStorageKey));
    const frame = window.requestAnimationFrame(() => {
      if (Number.isFinite(storedShare) && storedShare >= 28 && storedShare <= 72) {
        setEditorShare(storedShare);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewMarkdown(value), 180);
    return () => window.clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    window.localStorage.setItem(splitStorageKey, String(editorShare));
  }, [editorShare]);

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    const frame = frameRef.current;
    if (!frame) return;
    const frameElement = frame;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    function resize(pointerEvent: PointerEvent) {
      const bounds = frameElement.getBoundingClientRect();
      const percentage = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      setEditorShare(Math.max(28, Math.min(72, percentage)));
    }

    function finish() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  }

  function canImportFromDrag(event: React.DragEvent<HTMLDivElement>) {
    return !readOnly &&
      window.matchMedia("(min-width: 768px)").matches &&
      Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!canImportFromDrag(event)) return;
    event.preventDefault();
    fileDragDepthRef.current += 1;
    setFileDragActive(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!canImportFromDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (fileDragDepthRef.current === 0) return;
    event.preventDefault();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setFileDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!canImportFromDrag(event)) return;
    event.preventDefault();
    fileDragDepthRef.current = 0;
    setFileDragActive(false);
    onImportFiles(Array.from(event.dataTransfer.files));
  }

  const columns = view === "split"
    ? `minmax(0, ${editorShare}fr) 0.5rem minmax(0, ${100 - editorShare}fr)`
    : "minmax(0, 1fr)";

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        ref={frameRef}
        style={{ gridTemplateColumns: columns }}
        className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)]"
      >
        {view !== "preview" ? (
          <textarea
            id="bodyMarkdown"
            name="bodyMarkdown"
            value={value}
            readOnly={readOnly}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Markdown 正文"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "bodyMarkdown-error" : undefined}
            className={`h-full w-full min-w-0 resize-none overflow-y-auto bg-transparent pt-3 pb-24 font-mono text-sm leading-7 outline-none [scrollbar-width:none] placeholder:font-sans placeholder:text-muted/55 [&::-webkit-scrollbar]:hidden ${
              view === "split" ? "pr-6" : ""
            }`}
          />
        ) : null}

        {view === "split" ? (
          <button
            type="button"
            aria-label="拖动调整编辑和预览宽度"
            title="拖动调整编辑和预览宽度"
            onPointerDown={beginResize}
            className="group relative hidden cursor-col-resize touch-none lg:block"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent" />
          </button>
        ) : null}

        {view !== "edit" ? (
          <div
            aria-label="正文预览"
            className={`min-h-0 min-w-0 overflow-y-auto pt-3 pb-24 ${
              view === "split" ? "pl-6" : ""
            }`}
          >
            <div className="mx-auto w-full max-w-(--content-reading-width)">
              <MarkdownPreview kind={kind} markdown={previewMarkdown} />
            </div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p
          id="bodyMarkdown-error"
          className="shrink-0 pb-2 text-xs leading-5 text-foreground"
        >
          {error}
        </p>
      ) : null}
      {fileDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center rounded-xl border-2 border-accent bg-background/92 md:flex">
          <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-sm">
            松开以导入 Markdown
          </p>
        </div>
      ) : null}
    </div>
  );
}
