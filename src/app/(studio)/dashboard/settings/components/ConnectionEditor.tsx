"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, ChevronIcon, CrossIcon } from "@/components/icons";
import { showToast } from "@/components/Toast";
import type { AiModelConfiguration, AiModelInput, AiProtocol } from "@/lib/ai/types";
import { fetchAiModels, saveAiModel, testAiModel } from "@/server/ai/actions";
import { buttonClass, inputClass, primaryClass, requestError } from "./controls";

const protocols: [AiProtocol, string][] = [
  ["openai-completions", "OpenAI Chat Completions"],
  ["openai-responses", "OpenAI Responses"],
  ["anthropic-messages", "Anthropic Messages"],
];

type Intent = "save" | "test" | "discover";
type ButtonStatus = "idle" | "loading" | "ok" | "error";
type Feedback = { intent: Intent | null; message: string; error: boolean; version: number };

function ButtonStatusIcon({ status }: { status: ButtonStatus }) {
  const reduceMotion = useReducedMotion() ?? false;
  if (status === "idle") return null;
  return <span className="grid size-3.5 place-items-center" aria-hidden="true">
    {status === "loading" && <span className="size-3 rounded-full border-[1.5px] border-current border-r-transparent motion-safe:animate-spin" />}
    {status === "ok" && <motion.span className="grid" initial={reduceMotion ? false : { scale: 0.45, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
      <CheckIcon className="size-3.5" />
    </motion.span>}
    {status === "error" && <motion.span className="grid" initial={reduceMotion ? false : { scale: 0.45, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
      <CrossIcon className="size-3.5" />
    </motion.span>}
  </span>;
}

function ModelCombobox({ id, value, onChange, onPick, models, disabled }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: () => void;
  models: string[] | null;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const query = value.trim().toLowerCase();
  const catalog = models ?? [];
  const matches = catalog.filter(model => model.toLowerCase().includes(query));

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
  const listOpen = open && !disabled;

  function emptyCopy() {
    if (models == null) return "尚未获取模型。点右侧「获取模型」，或直接填写 ID。";
    if (catalog.length) return "没有匹配结果，可以直接填写模型 ID。";
    return "接口没有返回模型，可以直接填写模型 ID。";
  }

  return <div ref={root} className="relative min-w-0 flex-1">
    <input id={id} role="combobox" aria-expanded={listOpen} aria-controls={listId} aria-autocomplete="list" className={`${inputClass} min-w-0 pr-10 font-mono text-xs`} name="model" required maxLength={200} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
    }} placeholder="输入模型 ID" autoCapitalize="none" spellCheck={false} autoComplete="off" />
    <button type="button" tabIndex={-1} aria-label={listOpen ? "收起模型列表" : "打开模型列表"} aria-expanded={listOpen} aria-controls={listId} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => setOpen(current => !current)} className="absolute inset-y-1 right-1 grid w-8 place-items-center rounded-md text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
      <ChevronIcon className={`size-3 transition-transform ${listOpen ? "rotate-180" : ""}`} />
    </button>
    {listOpen && <div id={listId} role="listbox" aria-label="模型列表" className="absolute inset-x-0 top-full z-10 mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-lg">
      {matches.map(model => <button key={model} type="button" role="option" aria-selected={model === value} onClick={() => { onChange(model); onPick(); setOpen(false); }} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left font-mono text-xs break-all hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
        <span>{model}</span>
        {model === value && <CheckIcon className="size-4 shrink-0 text-accent" />}
      </button>)}
      {!matches.length && <p className="px-3 py-5 text-sm leading-6 text-muted">{emptyCopy()}</p>}
    </div>}
  </div>;
}

export function ConnectionEditor({ model, flash, onClearFlash, onSaved, onBusy, locked, onDelete, onCancel }: {
  model: AiModelConfiguration | null;
  flash: { message: string; error: boolean } | null;
  onClearFlash: () => void;
  onSaved: (id: string) => void;
  onBusy: (busy: boolean) => void;
  locked: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [endpoint, setEndpoint] = useState(model?.endpoint ?? "");
  const [protocol, setProtocol] = useState<AiProtocol>(model?.protocol ?? "openai-completions");
  const [modelId, setModelId] = useState(model?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [output, setOutput] = useState(model?.maxOutputTokens ?? 2048);
  const [version, setVersion] = useState(0);
  const [models, setModels] = useState<string[] | null>(null);
  const [activeIntent, setActiveIntent] = useState<Intent | null>(null);
  const [icon, setIcon] = useState<{ intent: Intent; status: "ok" | "error" } | null>(null);
  const iconTimer = useRef(0);
  const protocolMenu = useRef<HTMLDetailsElement>(null);
  const targetChanged = Boolean(model && (endpoint.trim().replace(/\/$/, "") !== model.endpoint || protocol !== model.protocol));
  function pulse(intent: Intent, status: "ok" | "error") {
    setIcon({ intent, status });
    window.clearTimeout(iconTimer.current);
    iconTimer.current = window.setTimeout(() => setIcon(null), 1800);
  }
  const [feedback, submit, pending] = useActionState(async (_: Feedback, payload: { input: AiModelInput; intent: Intent; version: number }): Promise<Feedback> => {
    try {
      if (payload.intent === "discover") {
        const result = await fetchAiModels(payload.input);
        if (result.ok) {
          setModels(result.value);
          showToast(result.value.length ? `已获取 ${result.value.length} 个模型。` : "接口没有返回模型，可以直接填写模型 ID。");
        } else {
          showToast(result.error.message, { tone: "error" });
        }
        return { intent: "discover", message: "", error: !result.ok, version: payload.version };
      }
      if (payload.intent === "test") {
        const result = await testAiModel(payload.input);
        pulse("test", result.ok ? "ok" : "error");
        return { intent: "test", message: result.ok ? "连接正常。配置尚未保存。" : result.error.message, error: !result.ok, version: payload.version };
      }
      const result = await saveAiModel(payload.input);
      if (result.ok) {
        showToast("已保存当前连接。");
        onSaved(result.value);
        return { intent: "save", message: "已保存当前连接。", error: false, version: payload.version };
      }
      showToast(result.error.message, { tone: "error" });
      pulse("save", "error");
      return { intent: "save", message: result.error.message, error: true, version: payload.version };
    } catch {
      if (payload.intent === "discover") showToast(requestError, { tone: "error" });
      else {
        showToast(requestError, { tone: "error" });
        pulse(payload.intent, "error");
      }
      return { intent: payload.intent, message: payload.intent === "discover" ? "" : requestError, error: true, version: payload.version };
    }
    finally { onBusy(false); }
  }, { intent: null, message: "", error: false, version: -1 });
  const disabled = pending || locked;
  const localFeedback = !pending && (feedback.intent === "test" || feedback.intent === "save") && feedback.message && feedback.version === version ? feedback : null;
  const footerFeedback = localFeedback ?? (!pending && flash ? { intent: "save" as const, message: flash.message, error: flash.error } : null);

  useEffect(() => () => window.clearTimeout(iconTimer.current), []);

  function edit() {
    setVersion(value => value + 1);
    onClearFlash();
  }
  function retarget(next: { endpoint?: string; protocol?: AiProtocol }) {
    if (next.endpoint !== undefined) setEndpoint(next.endpoint);
    if (next.protocol !== undefined) setProtocol(next.protocol);
    setModels(null);
  }
  function statusFor(intent: Intent): ButtonStatus {
    if (pending && activeIntent === intent) return "loading";
    if (intent === "save" && footerFeedback?.intent === "save") return footerFeedback.error ? "error" : "ok";
    if (!pending && icon?.intent === intent && feedback.version === version) return icon.status;
    return "idle";
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const intent: Intent = value === "test" || value === "discover" ? value : "save";
    const input: AiModelInput = { ...(model ? { id: model.id, revision: model.revision } : {}),
      name, endpoint: endpoint.trim(), protocol, model: modelId, maxOutputTokens: output,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) };
    setActiveIntent(intent);
    onBusy(true);
    startTransition(() => submit({ input, intent, version }));
  }

  return <form onSubmit={onSubmit} onChange={edit}>
    <fieldset disabled={disabled} className="min-w-0">
      <div className="max-w-2xl space-y-6">
        <label className="block text-xs font-medium"><span className="mb-2.5 block">连接名称</span><input className={inputClass} name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="例如：日常写作" /></label>
        <label className="block text-xs font-medium"><span className="mb-2.5 block">API 地址</span><input className={`${inputClass} font-mono text-xs`} name="endpoint" type="url" required maxLength={2048} value={endpoint} onChange={event => retarget({ endpoint: event.target.value })} placeholder="https://your-api.example/v1" autoCapitalize="none" spellCheck={false} />
          <span className="mt-2 block text-[11px] leading-5 font-normal text-muted">填写 HTTPS 基础地址，不含 /chat/completions 等请求路径。</span>
        </label>
        <div><label htmlFor="ai-api-key" className="mb-2.5 block text-xs font-medium">API Key</label><div className="relative"><input id="ai-api-key" className={`${inputClass} pr-16 font-mono text-xs`} name="apiKey" type={showKey ? "text" : "password"} value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="new-password" maxLength={8192} required={!model?.keySet || targetChanged} placeholder={model?.keySet && !targetChanged ? "已设置，留空保留" : "输入 API Key"} />
          <button type="button" aria-label={showKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowKey(value => !value)} className="absolute inset-y-1 right-1 rounded-md px-3 text-xs text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">{showKey ? "隐藏" : "显示"}</button></div>
          {targetChanged && <p className="mt-2 text-[11px] leading-5 text-muted">地址或协议已修改，请重新填写密钥。</p>}
        </div>
        <div>
          <label htmlFor="ai-model-id" className="mb-2.5 block text-xs font-medium">模型 ID</label>
          <div className="flex items-center gap-2.5">
            <ModelCombobox id="ai-model-id" value={modelId} onChange={setModelId} onPick={edit} models={models} disabled={disabled} />
            <button className={`${buttonClass} shrink-0 text-xs`} type="submit" value="discover" formNoValidate>
              <ButtonStatusIcon status={statusFor("discover")} />
              获取模型
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">{models == null ? "直接填写，或获取后从列表中选择。" : models.length ? `已获取 ${models.length} 个模型。点输入框打开列表，输入可过滤，也可直接填写。` : "接口没有返回模型，可以直接填写模型 ID。"}</p>
        </div>
        <details className="group border-t border-border pt-1"><summary aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }} className="flex cursor-pointer list-none items-center gap-2 py-4 text-xs text-muted focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"><ChevronIcon className="size-3 -rotate-90 transition-transform group-open:rotate-0" />高级设置</summary>
          <div className="grid gap-5 pb-3 pt-2 xl:grid-cols-[1.5fr_1fr]">
            <div><span id="ai-protocol-label" className="mb-2.5 block text-xs font-medium">接口协议</span><details ref={protocolMenu} className="relative" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); protocolMenu.current!.open = false; protocolMenu.current?.querySelector("summary")?.focus(); } }}>
              <summary aria-labelledby="ai-protocol-label ai-protocol-value" onClick={event => { if (disabled) event.preventDefault(); }} className={`${inputClass} flex cursor-pointer list-none items-center justify-between gap-3 text-xs [&::-webkit-details-marker]:hidden`}><span id="ai-protocol-value">{protocols.find(([key]) => key === protocol)?.[1]}</span><ChevronIcon className="size-3 shrink-0" /></summary>
              <div className="absolute inset-x-0 top-full z-10 mt-2 rounded-lg border border-border bg-background p-1 shadow-lg" role="group" aria-label="接口协议选项">{protocols.map(([key, label]) => <button type="button" key={key} aria-pressed={protocol === key} onClick={() => { retarget({ protocol: key }); edit(); protocolMenu.current!.open = false; protocolMenu.current?.querySelector("summary")?.focus(); }} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-xs hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">{label}{protocol === key && <CheckIcon className="size-3 shrink-0 text-accent" />}</button>)}</div>
            </details></div>
            <label className="block text-xs font-medium"><span className="mb-2.5 block">最大输出 Token</span><input className={`${inputClass} font-mono text-xs`} name="maxOutputTokens" type="number" min={1} max={2147483647} required value={output} onChange={event => setOutput(Number(event.target.value))} /></label>
          </div>
        </details>
      </div>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <button type="button" onClick={model ? onDelete : onCancel} className="min-h-10 text-xs text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">{model ? "删除连接" : "取消新增"}</button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5">
          {footerFeedback && <p role={footerFeedback.error ? "alert" : "status"} className="order-last basis-full text-right text-sm leading-6 sm:order-first sm:basis-auto sm:max-w-72">{footerFeedback.message}</p>}
          <button className={`${buttonClass} border-transparent text-xs text-muted`} type="submit" value="test">
            <ButtonStatusIcon status={statusFor("test")} />
            测试连接
          </button>
          <button className={primaryClass} type="submit" value="save">
            <ButtonStatusIcon status={statusFor("save")} />
            保存修改
          </button>
        </div>
      </footer>
    </fieldset>
  </form>;
}
