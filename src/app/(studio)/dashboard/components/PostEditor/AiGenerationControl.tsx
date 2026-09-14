"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { AiGenerationAvailability, AiPostGenerationMode } from "@/lib/ai/types";
import { refreshAiGenerationAvailability } from "@/server/ai/actions";

export function AiGenerationControl({ initialAvailability, slugLocked, onGenerate }: {
  initialAvailability: AiGenerationAvailability;
  slugLocked: boolean;
  onGenerate: (mode: AiPostGenerationMode) => Promise<string>;
}) {
  const [availability, setAvailability] = useState(initialAvailability);
  const [mode, setMode] = useState<AiPostGenerationMode>("both");
  const selectedMode = slugLocked ? "summary" : mode;
  const [message, generate, pending] = useActionState(async (_: string, selected: AiPostGenerationMode) => onGenerate(selected), "");

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const next = await refreshAiGenerationAvailability();
        if (active) setAvailability(next);
      } catch {
        if (active) setAvailability({ available: false, message: "AI 配置暂时不可用" });
      } finally { refreshing = false; }
    }
    function onFocus() { startTransition(() => { void refresh(); }); }
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); };
  }, []);

  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 py-1 text-xs">
    <div className="flex items-center gap-2">
      {!slugLocked && <select aria-label="AI 生成内容" value={mode} disabled={pending} onChange={event => setMode(event.target.value as AiPostGenerationMode)} className="min-h-9 max-w-full rounded-lg bg-background px-1 text-muted outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50">
        <option value="both">摘要和 Slug</option><option value="summary">仅摘要</option><option value="slug">仅 Slug</option>
      </select>}
      <button type="button" disabled={pending || !availability.available} onClick={() => startTransition(() => generate(selectedMode))} className="min-h-9 shrink-0 rounded-lg border border-border px-3 font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
        {pending ? "生成中…" : slugLocked ? "AI 生成摘要" : "AI 生成"}
      </button>
    </div>
    {!availability.available && <span className="text-muted">{availability.message} · <a href="/dashboard/settings#ai" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">AI 设置</a></span>}
    {(pending || message) && <span role="status" className="basis-full text-right leading-5 text-muted">{pending ? "正在生成…" : message}</span>}
  </div>;
}
