"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

export function SettingsDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLInputElement>("[data-autofocus]")?.focus();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20">
    <div className="p-5 sm:p-6"><header className="mb-4 flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="关闭对话框" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"><CloseIcon className="size-4" /></button></header>{children}</div>
  </dialog>;
}
