"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, SettingsIcon } from "@/components/icons";
import type { AiConfiguration, AiModelConfiguration } from "@/lib/ai/types";
import { deleteAiModel, saveAiPreferences, setDefaultAiModel } from "@/server/ai/actions";
import { ConnectionEditor } from "./ConnectionEditor";
import { SettingsDialog } from "./SettingsDialog";
import { buttonClass, inputClass, primaryClass, requestError } from "./controls";

function Preferences({ configuration, onBusy }: { configuration: AiConfiguration; onBusy: (busy: boolean) => void }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(configuration.enabled);
  const [prompts, setPrompts] = useState(configuration.prompts);
  const [feedback, save, pending] = useActionState(async (_: string, form: FormData) => {
    onBusy(true);
    try {
      const result = await saveAiPreferences(enabled, { summary: String(form.get("summary")), slug: String(form.get("slug")) });
      if (result.ok) router.refresh();
      return result.ok ? "生成偏好已保存。" : result.error.message;
    } catch { return requestError; }
    finally { onBusy(false); }
  }, "");
  return <form action={save} className="max-w-3xl">
    <h2 className="text-xl font-semibold tracking-tight">生成偏好</h2>
    <p className="mt-2 text-sm leading-6 text-muted">调整文章生成方式，应用于当前使用的连接。</p>
    <fieldset disabled={pending}>
      <div className="my-7 flex items-center justify-between gap-6 border-y border-border py-6">
        <div><h3 id="ai-enabled-label" className="text-sm font-medium">启用 AI 生成</h3><p className="mt-2 text-xs leading-6 text-muted">在编辑文章时，按需生成摘要与文章地址标识。</p></div>
        <button type="button" role="switch" aria-checked={enabled} aria-labelledby="ai-enabled-label" onClick={() => setEnabled(value => !value)} className={`flex h-6 w-10 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${enabled ? "justify-end bg-foreground" : "bg-border"}`}><span className="size-4 rounded-full bg-background" /></button>
      </div>
      {([["summary", "摘要生成指令"], ["slug", "Slug 生成指令"]] as const).map(([name, label]) => <label key={name} className="mb-6 block text-xs font-medium">
        <span className="mb-2.5 block">{label}</span>
        <textarea name={name} required maxLength={32000} value={prompts[name]} onChange={event => setPrompts(current => ({ ...current, [name]: event.target.value }))} className={`${inputClass} min-h-36 resize-y leading-7 font-normal`} />
      </label>)}
      <div className="flex justify-end border-t border-border pt-5"><button className={primaryClass}>{pending ? "保存中…" : "保存偏好"}</button></div>
    </fieldset>
    {feedback && <p role="status" className="mt-3 text-sm leading-6">{feedback}</p>}
    <p className="mt-6 text-xs leading-6 text-muted">生成失败时，文章原有内容保持不变。</p>
  </form>;
}

export function AiSettings({ configuration }: { configuration: AiConfiguration }) {
  const router = useRouter();
  const [tab, setTab] = useState<"connections" | "preferences">("connections");
  const [selectedId, setSelectedId] = useState(configuration.defaultModelId ?? configuration.models[0]?.id ?? "new");
  const [mobileDetail, setMobileDetail] = useState(configuration.models.length === 0);
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<AiModelConfiguration | null>(null);
  const [notice, setNotice] = useState("");
  const [saveFlash, setSaveFlash] = useState<{ message: string; error: boolean } | null>(null);
  const [, mutate, pending] = useActionState(async (_: null, operation: { type: "activate" | "delete"; model: AiModelConfiguration }) => {
    setNotice("");
    try {
      const result = operation.type === "activate" ? await setDefaultAiModel(operation.model.id) : await deleteAiModel(operation.model.id, operation.model.revision);
      if (!result.ok) { setNotice(result.error.message); return null; }
      if (operation.type === "delete") {
        setDeleting(null);
        setSelectedId(configuration.models.find(item => item.id !== operation.model.id)?.id ?? "new");
        setMobileDetail(false);
      }
      router.refresh();
      setNotice(operation.type === "activate" ? `已使用「${operation.model.name}」。` : "连接已删除。");
    } catch { setNotice(requestError); }
    return null;
  }, null);
  const locked = busy || pending;
  const selected = configuration.models.find(model => model.id === selectedId) ?? null;
  const current = selectedId === configuration.defaultModelId;
  function select(id: string) {
    if (locked) return;
    setNotice("");
    setSaveFlash(null);
    if (id !== selectedId) setFormVersion(value => value + 1);
    setSelectedId(id);
    setMobileDetail(true);
  }
  function add() { setFormVersion(value => value + 1); select("new"); }
  function back() { setFormVersion(value => value + 1); setMobileDetail(false); }
  function onSaved(id: string) {
    setSaveFlash({ message: "已保存当前连接。", error: false });
    setSelectedId(id);
    router.refresh();
  }

  return <section id="ai" className="mt-8 scroll-mt-6 sm:mt-10">
    <nav aria-label="AI 设置分区" className="mb-8 flex items-center gap-5 border-b border-border">
      <span className="flex shrink-0 items-center gap-2 border-r border-border pr-5 text-xs font-semibold sm:text-sm"><SettingsIcon className="size-4" />AI 设置</span>
      <div className="flex gap-6">
        {([["connections", "连接配置"], ["preferences", "生成偏好"]] as const).map(([id, label]) => <button key={id} type="button" disabled={locked} aria-current={tab === id ? "page" : undefined} onClick={() => { if (id !== tab) { setTab(id); setNotice(""); setSaveFlash(null); setFormVersion(value => value + 1); } }} className={`-mb-px border-b-2 py-3.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 sm:text-sm ${tab === id ? "border-foreground font-medium" : "border-transparent text-muted hover:text-foreground"}`}>{label}</button>)}
      </div>
    </nav>
    {tab === "preferences" ? <Preferences configuration={configuration} onBusy={setBusy} /> : <div className="grid items-start gap-9 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(0,2fr)] lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <aside aria-label="连接列表" className={mobileDetail ? "hidden sm:block" : ""}>
        <div className="mb-4 flex items-center justify-between px-3"><h2 className="text-xs text-muted">连接 <span className="ml-1.5">{configuration.models.length}</span></h2><button type="button" disabled={locked} onClick={add} aria-label="新增连接" title="新增连接" className="grid size-9 place-items-center rounded-lg text-xl text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">+</button></div>
        <div className="space-y-1.5">{configuration.models.map(model => <button key={model.id} type="button" disabled={locked} aria-current={model.id === selectedId ? "true" : undefined} onClick={() => select(model.id)} className={`relative flex min-h-18 w-full items-center gap-3 rounded-lg px-3 py-4 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${model.id === selectedId ? "bg-surface before:absolute before:inset-y-5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent" : ""}`}>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted"><SettingsIcon className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{model.name}</span><span className="mt-1.5 block truncate font-mono text-[11px] text-muted">{model.model}</span></span>
          {model.id === configuration.defaultModelId && <span title="当前使用" className="size-1.5 shrink-0 rounded-full bg-accent"><span className="sr-only">当前使用</span></span>}
        </button>)}</div>
        {selectedId === "new" && <div className="mt-1.5 rounded-lg bg-surface px-3 py-4 text-sm font-medium">新连接<p className="mt-1.5 text-xs font-normal text-muted">填写连接信息</p></div>}
        <p className="px-3 pt-6 text-xs leading-6 text-muted">{configuration.models.length ? <>点击连接查看设置。<br />全站共用一套连接。</> : "添加第一套连接，开始使用 AI 生成。"}</p>
      </aside>
      <div className={`min-w-0 ${mobileDetail ? "" : "hidden sm:block"}`}>
        <button type="button" disabled={locked} onClick={back} className="mb-6 flex items-center gap-1.5 text-xs text-muted focus-visible:outline-2 focus-visible:outline-accent sm:hidden"><ArrowLeftIcon className="size-3.5" />所有连接</button>
        <header className="mb-7 flex min-h-10 items-start justify-between gap-4 sm:mb-9">
          <h2 className="min-w-0 text-xl font-semibold tracking-tight break-words sm:text-2xl">{selected?.name ?? "新连接"}</h2>
          {selected && (current ? <span className="mt-2 flex shrink-0 items-center gap-1.5 text-xs text-accent"><span className="size-1 rounded-full bg-accent" />当前使用</span> : <button type="button" disabled={locked || !selected.keySet} onClick={() => startTransition(() => mutate({ type: "activate", model: selected }))} className={`${buttonClass} shrink-0 text-xs`} title={!selected.keySet ? "请先保存 API Key" : undefined}>设为当前使用</button>)}
        </header>
        <ConnectionEditor key={`${selectedId}:${selected?.revision ?? 0}:${formVersion}`} model={selected} flash={saveFlash} onClearFlash={() => setSaveFlash(null)} onSaved={onSaved} onBusy={setBusy} locked={pending} onDelete={() => { setNotice(""); setSaveFlash(null); setDeleting(selected); }} onCancel={() => { setSelectedId(configuration.models[0]?.id ?? "new"); back(); }} />
        {notice && <p role="status" className="mt-4 text-sm leading-6">{notice}</p>}
      </div>
    </div>}
    {deleting && <SettingsDialog title={`删除「${deleting.name}」？`} onClose={() => { if (!pending) setDeleting(null); }}>
      <p className="text-sm leading-7 text-muted">{deleting.id === configuration.defaultModelId ? "这套连接正在使用。删除后，需要选择另一套连接才能继续生成。" : "删除后可以重新添加，其他连接不会受到影响。"}</p>
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={pending} className={buttonClass} onClick={() => setDeleting(null)}>取消</button><button type="button" disabled={pending} className={primaryClass} onClick={() => startTransition(() => mutate({ type: "delete", model: deleting }))}>{pending ? "删除中…" : "删除连接"}</button></div>
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    </SettingsDialog>}
  </section>;
}
