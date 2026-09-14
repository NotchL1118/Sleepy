"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeftIcon, CheckIcon, ChevronIcon } from "@/components/icons";
import { showToast } from "@/components/Toast";
import { postKindOptions } from "@/lib/posts/post-kinds";
import type { PostStatus as StudioPostStatus } from "@/lib/posts/studio-post-filters";
import type { PostKind } from "@/lib/posts/types";
import { validateTagName } from "@/lib/taxonomy";
import {
  createAndPublishPost,
  createPostDraft,
  deletePost,
  publishPost,
  transitionPost,
  updatePostContent,
  type PostActionState,
  type PostField,
  type LifecycleActionState,
} from "@/server/posts/actions";
import type {
  PostGroupOption,
  StudioPost,
  TagOption,
} from "@/server/posts/studio-post-editor";
import { saveTag } from "@/server/taxonomy/actions";
import {
  MARKDOWN_FILE_ACCEPT,
  markdownFileContentError,
  markdownFileSelectionError,
} from "./markdown-import";
import {
  MarkdownEditorField,
  type EditorView,
} from "../MarkdownEditorField";
import { TaxonomyDialog } from "../TaxonomyManager";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { AiGenerationControl } from "./AiGenerationControl";
import type { AiGenerationAvailability, AiPostGenerationMode } from "@/lib/ai/types";
import { applyPostGenerationResult } from "@/lib/ai/generation";
import { generateAiPostFields } from "@/server/ai/actions";

type PostEditorProps = {
  post: StudioPost | null;
  groups: PostGroupOption[];
  kind: PostKind;
  tags: TagOption[];
  aiAvailability: AiGenerationAvailability;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "recovered";

type RecoveryState = {
  bodyMarkdown: string;
  groupId: string;
  slug: string;
  summary: string;
  tagIds: number[];
  title: string;
};

const emptyPostActionState: PostActionState = {
  message: null,
  tone: null,
  updatedAt: null,
};

const emptyLifecycleActionState: LifecycleActionState = {
  message: null,
  tone: null,
};

const viewStorageKey = "sleepy:post-editor:view";

type InlineTagResult =
  | { tag: TagOption }
  | { error: string };

type MarkdownImportUndo = {
  bodyMarkdown: string;
  fileName: string;
};

const editorStatusLabels = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
} as const satisfies Record<StudioPostStatus, string>;

const lifecycleTransitions = {
  draft: [],
  published: [
    { label: "撤回为草稿", value: "withdraw" },
    { label: "归档", value: "archive" },
  ],
  archived: [
    { label: "撤回为草稿", value: "withdraw" },
    { label: "恢复发布", value: "restore" },
  ],
} as const satisfies Record<
  StudioPostStatus,
  ReadonlyArray<{
    label: string;
    value: "archive" | "restore" | "withdraw";
  }>
>;

function FieldError({
  field,
  state,
}: {
  field: PostField;
  state: PostActionState;
}) {
  const message = state.fieldErrors?.[field];
  return message ? (
    <p id={`${field}-error`} className="mt-1 text-xs leading-5 text-foreground">
      {message}
    </p>
  ) : null;
}

function LifecycleControls({
  deleteAction,
  lifecycleAction,
  onAction,
  pending,
  status,
}: {
  deleteAction: (formData: FormData) => void | Promise<void>;
  lifecycleAction: (formData: FormData) => void;
  onAction: () => void;
  pending: boolean;
  status: StudioPostStatus;
}) {
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const secondary =
    "inline-flex min-h-9 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-55";
  const primary =
    "inline-flex min-h-9 items-center justify-center rounded-xl bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-55";

  useEffect(() => {
    if (!dialog && !menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || pending) return;
      setDialog(null);
      setMenuOpen(false);
    }

    function closeMenuOnOutsidePointerDown(event: PointerEvent) {
      if (
        menuOpen &&
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeMenuOnOutsidePointerDown);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeMenuOnOutsidePointerDown);
    };
  }, [dialog, menuOpen, pending]);

  function submitTransition(formData: FormData, transition: "restore" | "withdraw") {
    formData.set("transition", transition);
    setMenuOpen(false);
    onAction();
    lifecycleAction(formData);
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={pending}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? "post-more-menu" : undefined}
          onClick={() => setMenuOpen((current) => !current)}
          className={secondary}
        >
          更多
          <span aria-hidden className="ml-1 text-muted">···</span>
        </button>

        {menuOpen ? (
          <div
            id="post-more-menu"
            role="group"
            aria-label="文章操作"
            className="absolute top-full right-0 z-30 mt-2 w-40 rounded-xl border border-border bg-background p-1.5 shadow-xl"
          >
            {lifecycleTransitions[status].map((transition) =>
              transition.value === "archive" ? (
                <button
                  key={transition.value}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDialog("archive");
                  }}
                  className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                >
                  归档
                </button>
              ) : (
                <button
                  key={transition.value}
                  type="submit"
                  formAction={(formData) => submitTransition(formData, transition.value)}
                  className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {transition.label}
                </button>
              ),
            )}
            <div
              className={lifecycleTransitions[status].length ? "mt-1 border-t border-border pt-1" : ""}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setDialog("delete");
                }}
                className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
              >
                永久删除
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 p-4">
          <button
            type="button"
            aria-label="关闭确认框"
            className="absolute inset-0 cursor-default"
            onClick={() => !pending && setDialog(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-action-dialog-title"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl sm:p-7"
          >
            <p className="text-xs font-semibold tracking-[0.1em] text-accent uppercase">
              {dialog === "archive" ? "文章归档" : "危险操作"}
            </p>
            <h2
              id="post-action-dialog-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
            >
              {dialog === "archive" ? "确认归档这篇文章？" : "确认永久删除这篇文章？"}
            </h2>
            {dialog === "archive" ? (
              <label className="mt-5 block">
                <span className="text-sm font-medium">归档原因（可选）</span>
                <textarea
                  name="archiveNote"
                  rows={4}
                  autoFocus
                  placeholder="记录为什么归档"
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-accent"
                />
              </label>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">
                删除后无法恢复，文章内容和关联关系都会被永久移除。
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={pending}
                className={secondary}
              >
                取消
              </button>
              {dialog === "archive" ? (
                <button
                  type="submit"
                  formAction={(formData) => {
                    formData.set("transition", "archive");
                    onAction();
                    setDialog(null);
                    lifecycleAction(formData);
                  }}
                  disabled={pending}
                  className={primary}
                >
                  {pending ? "正在归档…" : "确认归档"}
                </button>
              ) : (
                <button
                  type="submit"
                  formAction={deleteAction}
                  disabled={pending}
                  className={primary}
                >
                  确认永久删除
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function GroupPicker({
  disabled,
  error,
  groups,
  label,
  onChange,
  onCreate,
  value,
}: {
  disabled: boolean;
  error?: string;
  groups: PostGroupOption[];
  label: string;
  onChange: (value: string) => void;
  onCreate: () => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const selected = groups.find((group) => String(group.id) === value);
  const filtered = groups.filter((group) =>
    group.name.toLocaleLowerCase("zh-CN").includes(query.toLocaleLowerCase("zh-CN")),
  );

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;

    selectedOptionRef.current?.scrollIntoView({ block: "nearest" });

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        closePicker();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePicker, open]);

  return (
    <div ref={pickerRef} className="relative min-w-0">
      <span className="mb-0.5 block text-[11px] font-medium text-muted">{label}</span>
      <input type="hidden" name="groupId" value={value} />
      <button
        id="groupId-control"
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? "group-picker-menu" : undefined}
        aria-describedby={error ? "groupId-error" : undefined}
        onClick={() => {
          if (open) closePicker();
          else setOpen(true);
        }}
        className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm outline-none transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-65"
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>
          {selected?.name ?? `选择${label}`}
        </span>
        <ChevronIcon
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          id="group-picker-menu"
          className="absolute top-full left-0 z-30 mt-2 w-[min(22rem,88vw)] rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`搜索${label}`}
            className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-1 max-h-52 overflow-y-auto">
            {filtered.length ? filtered.map((group) => {
              const isSelected = String(group.id) === value;
              return (
                <button
                  key={group.id}
                  ref={isSelected ? selectedOptionRef : undefined}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(String(group.id));
                    closePicker();
                  }}
                  className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    isSelected ? "bg-surface font-medium" : "hover:bg-surface"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <CheckIcon
                    className={`size-4 shrink-0 ${isSelected ? "text-accent opacity-100" : "opacity-0"}`}
                  />
                </button>
              );
            }) : (
              <p className="px-3 py-2 text-xs text-muted">没有匹配的{label}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              closePicker();
              onCreate();
            }}
            className="mt-1 min-h-9 w-full border-t border-border px-3 pt-2 text-left text-xs text-accent"
          >
            ＋ 新建{label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TagPicker({
  disabled,
  error,
  onChange,
  onCreate,
  tags,
  value,
}: {
  disabled: boolean;
  error?: string;
  onChange: (value: Set<number>) => void;
  onCreate: (name: string) => Promise<InlineTagResult>;
  tags: TagOption[];
  value: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const createInFlightRef = useRef(false);
  const selected = tags.filter((tag) => value.has(tag.id));
  const filtered = tags.filter((tag) =>
    tag.name.toLocaleLowerCase("zh-CN").includes(query.toLocaleLowerCase("zh-CN")),
  );

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCreateError(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        closePicker();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePicker, open]);

  async function submitTag() {
    if (createInFlightRef.current) return;

    const validation = validateTagName(query);
    if (validation.error) {
      setCreateError(validation.error);
      return;
    }

    createInFlightRef.current = true;
    setCreating(true);
    setCreateError(null);
    const result = await onCreate(validation.name);
    createInFlightRef.current = false;
    setCreating(false);

    if ("error" in result) {
      setCreateError(result.error);
      return;
    }

    closePicker();
    window.requestAnimationFrame(() => {
      document.getElementById("bodyMarkdown")?.focus();
    });
  }

  return (
    <div ref={pickerRef} className="relative min-w-0">
      <span className="mb-0.5 block text-[11px] font-medium text-muted">标签</span>
      {[...value].map((tagId) => (
        <input key={tagId} type="hidden" name="tagId" value={tagId} />
      ))}
      <div className="flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1.5 py-1">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md border border-border bg-surface py-1 pr-1 pl-2.5 text-xs"
          >
            <span className="truncate">{tag.name}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`取消选择标签 ${tag.name}`}
              onClick={() => {
                const next = new Set(value);
                next.delete(tag.id);
                onChange(next);
              }}
              className="grid size-5 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-65"
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}
        {open ? (
          <span className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border border-accent bg-background py-1 pr-2 pl-2.5 text-xs">
            <span aria-hidden className="text-accent">＋</span>
            <input
              autoFocus
              value={query}
              disabled={creating}
              aria-label="新建或搜索标签"
              aria-controls="tag-picker-menu"
              aria-describedby={createError ? "inline-tag-name-error" : undefined}
              onChange={(event) => {
                setQuery(event.target.value);
                setCreateError(null);
              }}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (
                    composingRef.current ||
                    event.nativeEvent.isComposing ||
                    event.nativeEvent.keyCode === 229
                  ) {
                    return;
                  }
                  event.preventDefault();
                  void submitTag();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closePicker();
                }
              }}
              placeholder={creating ? "正在创建…" : "输入标签"}
              className="w-24 min-w-0 bg-transparent outline-none placeholder:text-muted/70 sm:w-32"
            />
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-describedby={error ? "tagIds-error" : undefined}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-dashed border-border bg-background px-2.5 py-1 text-xs text-muted outline-none transition-colors hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-65"
          >
            <span aria-hidden>＋</span>
            添加标签
          </button>
        )}
      </div>
      {open ? (
        <div
          id="tag-picker-menu"
          className="absolute top-full left-0 z-30 mt-2 w-[min(25rem,88vw)] rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto p-1">
            {filtered.length ? filtered.map((tag) => (
              <label
                key={tag.id}
                className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-surface focus-within:outline-2 focus-within:outline-accent ${
                  value.has(tag.id)
                    ? "border-accent/40 bg-surface text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={value.has(tag.id)}
                  onChange={(event) => {
                    const next = new Set(value);
                    if (event.target.checked) next.add(tag.id);
                    else next.delete(tag.id);
                    onChange(next);
                  }}
                  className="sr-only"
                />
                {value.has(tag.id) ? <CheckIcon className="size-3.5 text-accent" /> : null}
                <span className="max-w-40 truncate">{tag.name}</span>
              </label>
            )) : (
              <p className="px-2 py-1.5 text-xs text-muted">没有匹配的已有标签</p>
            )}
          </div>
          {createError ? (
            <p id="inline-tag-name-error" className="mt-1 border-t border-border px-3 pt-2 text-xs leading-5 text-foreground">
              {createError}
            </p>
          ) : (
            <p className="mt-1 border-t border-border px-3 pt-2 text-xs leading-5 text-muted">
              输入名称后按 Enter 新建 · Esc 取消
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EditorViewControl({
  onChange,
  value,
}: {
  onChange: (view: EditorView) => void;
  value: EditorView;
}) {
  const buttonClass = (candidate: EditorView) =>
    `inline-flex min-h-8 items-center justify-center rounded-lg px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      value === candidate
        ? "bg-background text-foreground shadow-sm"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface p-0.5" aria-label="编辑视图">
      <button type="button" aria-pressed={value === "edit"} onClick={() => onChange("edit")} className={buttonClass("edit")}>
        编辑
      </button>
      <button type="button" aria-pressed={value === "split"} onClick={() => onChange("split")} className={`${buttonClass("split")} max-lg:hidden`}>
        双栏
      </button>
      <button type="button" aria-pressed={value === "preview"} onClick={() => onChange("preview")} className={buttonClass("preview")}>
        预览
      </button>
    </div>
  );
}

function focusFirstError(errors?: PostActionState["fieldErrors"]) {
  if (!errors) return;
  const order: Array<[PostField, string]> = [
    ["title", "title"],
    ["groupId", "groupId-control"],
    ["slug", "slug"],
    ["bodyMarkdown", "bodyMarkdown"],
  ];
  const target = order.find(([field]) => errors[field]);
  if (!target) return;

  window.requestAnimationFrame(() => {
    const element = document.getElementById(target[1]);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    element?.focus({ preventScroll: true });
  });
}

export function PostEditor({ post, groups, kind, tags, aiAvailability }: PostEditorProps) {
  const router = useRouter();
  const options = postKindOptions[kind];
  const status = (post?.status ?? "draft") as StudioPostStatus;
  const recoveryKey = `sleepy:post-editor:new:${kind}`;
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const recoveryReadyRef = useRef(post !== null);
  const currentPostIdRef = useRef<number | null>(post?.id ?? null);
  const currentUpdatedAtRef = useRef<string | null>(post?.updated_at ?? null);
  const bodyMarkdownRef = useRef(post?.body_markdown ?? "");
  const markdownFileInputRef = useRef<HTMLInputElement>(null);
  const markdownImportAttemptRef = useRef(0);
  const aiAttemptRef = useRef({ latestRequestId: null as string | null, editRevision: 0, mode: "both" as AiPostGenerationMode });
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const [availableGroups, setAvailableGroups] = useState(groups);
  const [availableTags, setAvailableTags] = useState(tags);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(post?.body_markdown ?? "");
  const [groupId, setGroupId] = useState(post?.group_id ? String(post.group_id) : "");
  const [tagIds, setTagIds] = useState(() => new Set(post?.tagIds ?? []));
  const [currentPostId, setCurrentPostId] = useState<number | null>(post?.id ?? null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(post?.updated_at ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveOperation, setSaveOperation] = useState<"save" | "publish">("save");
  const [feedback, setFeedback] = useState<PostActionState>({
    ...emptyPostActionState,
    updatedAt: post?.updated_at ?? null,
  });
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"group" | null>(null);
  const [taxonomyFeedback, setTaxonomyFeedback] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const [editorView, setEditorView] = useState<EditorView>("split");
  const [metaOpen, setMetaOpen] = useState(false);
  const [markdownImportError, setMarkdownImportError] = useState<string | null>(null);
  const [markdownImportUndo, setMarkdownImportUndo] = useState<MarkdownImportUndo | null>(null);

  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(
    transitionPost.bind(null, kind, currentPostId ?? 0),
    emptyLifecycleActionState,
  );
  const deleteAction = deletePost.bind(null, kind, currentPostId ?? 0);
  const { dirty, markMaybeDirty, readSnapshot } = useUnsavedChanges(
    formRef,
    savedSnapshot,
    true,
  );

  function invalidateAi(field?: "title" | "body" | "summary" | "slug") {
    const attempt = aiAttemptRef.current;
    if (!field || field === "title" || field === "body" || attempt.mode === "both" || attempt.mode === field) {
      attempt.editRevision++;
    }
  }

  async function generateFields(mode: AiPostGenerationMode): Promise<string> {
    const form = formRef.current;
    if (!form || aiAttemptRef.current.latestRequestId) return "";
    const data = new FormData(form);
    const body = bodyMarkdownRef.current;
    if (!body.trim()) return "请先填写正文。";
    setMetaOpen(true);
    const requestId = crypto.randomUUID();
    const attempt = aiAttemptRef.current;
    attempt.latestRequestId = requestId;
    attempt.mode = mode;
    const input = { requestId, editRevision: attempt.editRevision, mode,
      postId: currentPostIdRef.current ?? undefined,
      title: String(data.get("title") ?? ""), bodyMarkdown: body };
    try {
      const result = await generateAiPostFields(input);
      if (!formRef.current || aiAttemptRef.current.latestRequestId !== requestId) return "";
      if (!result.ok) return result.error.message;
      const currentData = new FormData(formRef.current);
      const current = { ...aiAttemptRef.current, postId: currentPostIdRef.current ?? undefined,
        summary: String(currentData.get("summary") ?? ""), slug: String(currentData.get("slug") ?? "") };
      const applied = applyPostGenerationResult(current, result);
      if (applied === current) return "内容已修改，本次结果未填入，请重新生成。";
      aiAttemptRef.current = { latestRequestId: applied.latestRequestId, editRevision: applied.editRevision, mode };
      if (mode !== "slug") setSummary(applied.summary);
      if (mode !== "summary") setSlug(applied.slug);
      clearFeedback();
      window.requestAnimationFrame(markMaybeDirty);
      return "";
    } catch {
      return "生成请求未完成，请稍后重试。";
    } finally {
      if (aiAttemptRef.current.latestRequestId === requestId) aiAttemptRef.current.latestRequestId = null;
    }
  }

  useEffect(() => () => { aiAttemptRef.current.latestRequestId = null; }, []);

  useEffect(() => {
    const element = summaryRef.current;
    if (!element || !metaOpen) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 112)}px`;
  }, [summary, metaOpen]);

  useEffect(() => {
    currentPostIdRef.current = currentPostId;
  }, [currentPostId]);

  useEffect(() => {
    currentUpdatedAtRef.current = currentUpdatedAt;
  }, [currentUpdatedAt]);

  useEffect(() => {
    bodyMarkdownRef.current = bodyMarkdown;
  }, [bodyMarkdown]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const storedView = window.localStorage.getItem(viewStorageKey);
    const frame = window.requestAnimationFrame(() => {
      if (storedView === "edit" || storedView === "preview") {
        setEditorView(storedView);
      } else if (storedView === "split" && media.matches) {
        setEditorView("split");
      } else if (!media.matches) {
        setEditorView("edit");
      }
    });

    function onBreakpointChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setEditorView((current) => current === "split" ? "edit" : current);
      }
    }

    media.addEventListener("change", onBreakpointChange);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", onBreakpointChange);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(viewStorageKey, editorView);
  }, [editorView]);

  useEffect(() => {
    if (!lifecycleState.message || !lifecycleState.tone) return;
    let frame = 0;
    if (lifecycleState.tone === "success" && lifecycleState.updatedAt) {
      currentUpdatedAtRef.current = lifecycleState.updatedAt;
      frame = window.requestAnimationFrame(() => {
        setCurrentUpdatedAt(lifecycleState.updatedAt ?? null);
      });
    }
    showToast(lifecycleState.message, {
      tone: lifecycleState.tone === "error" ? "error" : "info",
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lifecycleState.message, lifecycleState.tone, lifecycleState.updatedAt]);

  useEffect(() => {
    if (post !== null) return;

    const stored = window.localStorage.getItem(recoveryKey);
    if (stored) {
      try {
        const recovery = JSON.parse(stored) as RecoveryState;
        const frame = window.requestAnimationFrame(() => {
          aiAttemptRef.current.editRevision++;
          setTitle(recovery.title ?? "");
          setSlug(recovery.slug ?? "");
          setSummary(recovery.summary ?? "");
          setBodyMarkdown(recovery.bodyMarkdown ?? "");
          setGroupId(recovery.groupId ?? "");
          setTagIds(new Set(recovery.tagIds ?? []));
          setRecoveryNotice(true);
          setSaveStatus("recovered");
          recoveryReadyRef.current = true;
          window.requestAnimationFrame(markMaybeDirty);
        });
        return () => window.cancelAnimationFrame(frame);
      } catch {
        window.localStorage.removeItem(recoveryKey);
      }
    }
    recoveryReadyRef.current = true;
  }, [markMaybeDirty, post, recoveryKey]);

  useEffect(() => {
    if (currentPostId !== null || !recoveryReadyRef.current) return;

    const timeout = window.setTimeout(() => {
      const recovery: RecoveryState = {
        bodyMarkdown,
        groupId,
        slug,
        summary,
        tagIds: [...tagIds],
        title,
      };
      const hasContent = Boolean(
        title || slug || summary || bodyMarkdown || groupId || tagIds.size,
      );
      if (hasContent) {
        window.localStorage.setItem(recoveryKey, JSON.stringify(recovery));
      } else {
        window.localStorage.removeItem(recoveryKey);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [bodyMarkdown, currentPostId, groupId, recoveryKey, slug, summary, tagIds, title]);

  const clearFeedback = useCallback(() => {
    setFeedback((current) =>
      current.message || current.fieldErrors
        ? { ...emptyPostActionState, updatedAt: currentUpdatedAtRef.current }
        : current,
    );
  }, []);

  const collectFormData = useCallback(() => {
    const form = formRef.current;
    if (!form) return null;
    const formData = new FormData(form);
    const updatedAt = currentUpdatedAtRef.current;
    if (updatedAt) formData.set("expectedUpdatedAt", updatedAt);
    else formData.delete("expectedUpdatedAt");
    return formData;
  }, []);

  const savePost = useCallback(async (manual: boolean) => {
    if (savingRef.current) return;
    const formData = collectFormData();
    if (!formData) return;

    savingRef.current = true;
    setSaveOperation("save");
    setSaveStatus("saving");
    if (manual) setTaxonomyFeedback(null);
    const snapshot = readSnapshot();
    const postId = currentPostIdRef.current;
    const updatedAt = currentUpdatedAtRef.current;
    const previousState = {
      ...emptyPostActionState,
      updatedAt,
    };

    const result = postId === null
      ? await createPostDraft(kind, previousState, formData)
      : await updatePostContent(kind, postId, status, previousState, formData);

    savingRef.current = false;
    setFeedback(result);

    if (!result.saved || !result.updatedAt) {
      setSaveStatus("error");
      if (manual) {
        const firstFieldError = Object.values(result.fieldErrors ?? {}).find(Boolean);
        showToast(result.message ?? firstFieldError ?? "文章保存失败，请稍后重试。", {
          tone: "error",
        });
      }
      if (
        result.fieldErrors?.groupId ||
        result.fieldErrors?.slug ||
        result.fieldErrors?.tagIds
      ) {
        setMetaOpen(true);
      }
      focusFirstError(result.fieldErrors);
      return;
    }

    currentUpdatedAtRef.current = result.updatedAt;
    setCurrentUpdatedAt(result.updatedAt);
    setSavedSnapshot(snapshot);
    setSaveStatus(readSnapshot() === snapshot ? "saved" : "dirty");
    window.localStorage.removeItem(recoveryKey);
    setRecoveryNotice(false);

    if (postId === null && result.postId && result.studioPath) {
      currentPostIdRef.current = result.postId;
      setCurrentPostId(result.postId);
      window.history.replaceState(null, "", result.studioPath);
    }
  }, [collectFormData, kind, readSnapshot, recoveryKey, status]);

  useEffect(() => {
    if (
      status !== "draft" ||
      !dirty ||
      currentPostId === null ||
      saveStatus === "saving"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => void savePost(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [currentPostId, dirty, savePost, savedSnapshot, saveStatus, status]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        void savePost(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [savePost]);

  async function handlePublish() {
    if (status !== "draft" || savingRef.current) return;
    const formData = collectFormData();
    if (!formData) return;

    // A publication may lock the Slug while generation is still in flight.
    invalidateAi();

    savingRef.current = true;
    setSaveOperation("publish");
    setSaveStatus("saving");
    setTaxonomyFeedback(null);
    const postId = currentPostIdRef.current;
    const updatedAt = currentUpdatedAtRef.current;
    const previousState = { ...emptyPostActionState, updatedAt };
    const snapshot = readSnapshot();
    const result = postId === null
      ? await createAndPublishPost(kind, previousState, formData)
      : await publishPost(kind, postId, previousState, formData);

    savingRef.current = false;
    setFeedback(result);

    if (!result.saved || !result.postId || !result.studioPath) {
      setSaveStatus("error");
      const firstFieldError = Object.values(result.fieldErrors ?? {}).find(Boolean);
      showToast(
        result.message ?? firstFieldError ?? "发布失败，请检查文章内容后重试。",
        { tone: "error" },
      );
      if (
        result.fieldErrors?.groupId ||
        result.fieldErrors?.slug ||
        result.fieldErrors?.tagIds
      ) {
        setMetaOpen(true);
      }
      focusFirstError(result.fieldErrors);
      return;
    }

    setSavedSnapshot(snapshot);
    setSaveStatus("saved");
    window.localStorage.removeItem(recoveryKey);
    window.history.replaceState(null, "", result.studioPath);
    router.refresh();
  }

  function onFormChange() {
    clearFeedback();
    markMaybeDirty();
  }

  function changeBodyMarkdown(value: string) {
    invalidateAi("body");
    bodyMarkdownRef.current = value;
    setBodyMarkdown(value);
    setMarkdownImportError(null);
    setMarkdownImportUndo(null);
  }

  function focusMarkdownEditor() {
    if (editorView !== "edit") return;
    window.requestAnimationFrame(() => {
      document.getElementById("bodyMarkdown")?.focus();
    });
  }

  async function importMarkdownFiles(files: readonly File[]) {
    const attempt = ++markdownImportAttemptRef.current;
    const selectionError = markdownFileSelectionError(files);
    if (selectionError) {
      setMarkdownImportError(selectionError);
      return;
    }

    const file = files[0];
    try {
      const content = await file.text();
      if (markdownImportAttemptRef.current !== attempt) return;

      const contentError = markdownFileContentError(content);
      if (contentError) {
        setMarkdownImportError(contentError);
        return;
      }

      const previousBodyMarkdown = bodyMarkdownRef.current;
      invalidateAi("body");
      bodyMarkdownRef.current = content;
      setBodyMarkdown(content);
      setMarkdownImportError(null);
      setMarkdownImportUndo({
        bodyMarkdown: previousBodyMarkdown,
        fileName: file.name,
      });
      clearFeedback();
      window.requestAnimationFrame(markMaybeDirty);
      focusMarkdownEditor();
    } catch {
      if (markdownImportAttemptRef.current !== attempt) return;
      setMarkdownImportError(`无法读取“${file.name}”，原正文未更改。`);
    }
  }

  function undoMarkdownImport() {
    if (!markdownImportUndo) return;
    invalidateAi("body");
    bodyMarkdownRef.current = markdownImportUndo.bodyMarkdown;
    setBodyMarkdown(markdownImportUndo.bodyMarkdown);
    setMarkdownImportError(null);
    setMarkdownImportUndo(null);
    clearFeedback();
    window.requestAnimationFrame(markMaybeDirty);
    focusMarkdownEditor();
  }

  function clearRecovery() {
    invalidateAi();
    setTitle("");
    setSlug("");
    setSummary("");
    setBodyMarkdown("");
    bodyMarkdownRef.current = "";
    setMarkdownImportError(null);
    setMarkdownImportUndo(null);
    setGroupId("");
    setTagIds(new Set());
    setRecoveryNotice(false);
    window.localStorage.removeItem(recoveryKey);
    window.requestAnimationFrame(markMaybeDirty);
  }

  function selectEditorView(nextView: EditorView) {
    if (nextView === "split" && !window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }
    setEditorView(nextView);
  }

  async function createInlineTag(name: string): Promise<InlineTagResult> {
    const existing = availableTags.find(
      (tag) => tag.name.toLocaleLowerCase("zh-CN") === name.toLocaleLowerCase("zh-CN"),
    );
    if (existing) {
      setTagIds((current) => new Set(current).add(existing.id));
      window.requestAnimationFrame(markMaybeDirty);
      return { tag: existing };
    }

    const formData = new FormData();
    formData.set("name", name);
    const result = await saveTag(
      { message: null, tone: null },
      formData,
    );
    if (!result.created) {
      return {
        error: result.fieldErrors?.name ?? result.message ?? "标签暂时无法创建，请稍后重试。",
      };
    }

    const created = { id: result.created.id, name: result.created.name };
    setAvailableTags((current) =>
      current.some((tag) => tag.id === created.id)
        ? current
        : [...current, created].sort((left, right) =>
            left.name.localeCompare(right.name, "zh-CN"),
          ),
    );
    setTagIds((current) => new Set(current).add(created.id));
    window.requestAnimationFrame(markMaybeDirty);
    return { tag: created };
  }

  const effectiveSaveStatus = dirty && saveStatus !== "saving" && saveStatus !== "error"
    ? "dirty"
    : saveStatus;
  const saveCopy = useMemo(() => {
    const copies: Record<SaveStatus, string> = {
      idle: "",
      dirty: "未保存",
      saving: saveOperation === "publish" ? "正在发布…" : "正在保存…",
      saved: "已保存",
      error: saveOperation === "publish" ? "" : "保存失败",
      recovered: "已恢复",
    };
    return copies[effectiveSaveStatus];
  }, [effectiveSaveStatus, saveOperation]);

  const publishedPath = feedback.publishedPath ??
    (post?.slug && status !== "draft" ? `${options.publicBasePath}/${post.slug}` : undefined);

  const selectedGroupName = availableGroups.find(
    (group) => String(group.id) === groupId,
  )?.name;
  const metaSummary = [
    selectedGroupName ?? `未选择${options.groupLabel}`,
    tagIds.size ? `${tagIds.size} 个标签` : "无标签",
    slug.trim() || "未设置地址标识",
    summary.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <form
        ref={formRef}
        onInput={onFormChange}
        onChange={onFormChange}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <input type="hidden" name="expectedUpdatedAt" value={currentUpdatedAt ?? ""} />

        <header className="-mx-4 flex min-h-14 shrink-0 items-center gap-4 border-b border-border px-4 sm:-mx-7 sm:px-7 lg:-mx-6 lg:px-6">
          <Link
            href={options.studioBasePath}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="hidden sm:inline">返回{options.pluralLabel}</span>
          </Link>
          <span className="hidden size-1.5 rounded-full bg-accent sm:block" />
          <span className="hidden text-xs text-muted sm:block">
            {editorStatusLabels[status]}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {recoveryNotice ? (
              <button
                type="button"
                onClick={clearRecovery}
                className="hidden text-xs text-muted hover:text-foreground sm:block"
              >
                已恢复本地内容 · 清空
              </button>
            ) : null}
            {saveCopy ? (
              <span
                aria-live="polite"
                className={`min-w-14 text-right text-xs ${
                  saveStatus === "error" ? "text-foreground" : "text-muted"
                }`}
              >
                {saveCopy}
              </span>
            ) : null}
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <input
                ref={markdownFileInputRef}
                type="file"
                accept={MARKDOWN_FILE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  if (files.length) void importMarkdownFiles(files);
                }}
              />
              <button
                type="button"
                onClick={() => markdownFileInputRef.current?.click()}
                className="inline-flex min-h-9 shrink-0 items-center rounded-xl border border-border px-3 text-xs font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
              >
                导入 Markdown
              </button>
              {markdownImportUndo ? (
                <p role="status" className="min-w-0 max-w-48 truncate text-xs text-muted">
                  已导入 <span title={markdownImportUndo.fileName}>{markdownImportUndo.fileName}</span>
                  {" · "}
                  <button
                    type="button"
                    onClick={undoMarkdownImport}
                    className="font-medium text-foreground underline underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    撤销
                  </button>
                </p>
              ) : null}
              {markdownImportError ? (
                <p role="alert" className="min-w-0 max-w-48 truncate text-xs text-foreground">
                  {markdownImportError}
                </p>
              ) : null}
            </div>
            <EditorViewControl value={editorView} onChange={selectEditorView} />
            <button
              type="button"
              onClick={() => void savePost(true)}
              disabled={saveStatus === "saving"}
              className={`${status === "draft" ? "hidden sm:inline-flex" : "inline-flex"} min-h-9 items-center rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-55`}
            >
              {status === "draft" ? "保存草稿" : "保存修改"}
            </button>
            {status === "draft" ? (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={saveStatus === "saving"}
                  className="inline-flex min-h-9 items-center rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-55"
                >
                  发布
                </button>
            ) : null}
            {post ? (
              <LifecycleControls
                deleteAction={deleteAction}
                lifecycleAction={lifecycleAction}
                onAction={() => setFeedback(emptyPostActionState)}
                pending={lifecyclePending || saveStatus === "saving"}
                status={status}
              />
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col pt-3 sm:pt-4">
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => { invalidateAi("title"); setTitle(event.target.value); }}
            placeholder="写下标题"
            aria-invalid={Boolean(feedback.fieldErrors?.title)}
            aria-describedby={feedback.fieldErrors?.title ? "title-error" : undefined}
            className="w-full shrink-0 border-0 bg-transparent text-2xl font-semibold tracking-[-0.04em] outline-none placeholder:text-muted/45 sm:text-3xl"
          />
          <FieldError field="title" state={feedback} />

          <div className="mt-1.5 shrink-0 border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-x-4">
            <button
              type="button"
              onClick={() => setMetaOpen((current) => !current)}
              aria-expanded={metaOpen}
              aria-controls="post-meta-panel"
              className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 text-left text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="min-w-0 flex-1 truncate">{metaSummary}</span>
              <ChevronIcon
                className={`size-3.5 shrink-0 transition-transform ${metaOpen ? "rotate-180" : ""}`}
              />
            </button>
            <AiGenerationControl initialAvailability={aiAvailability} slugLocked={Boolean(post?.published_at)} onGenerate={generateFields} />
            </div>
            <div
              id="post-meta-panel"
              className={metaOpen ? "border-t border-border" : "hidden"}
            >
              <div className="grid gap-x-5 gap-y-2 py-2 lg:grid-cols-[minmax(10rem,.7fr)_minmax(15rem,1.35fr)_minmax(14rem,1fr)]">
                <div>
                  <GroupPicker
                    disabled={false}
                    error={feedback.fieldErrors?.groupId}
                    groups={availableGroups}
                    label={options.groupLabel}
                    value={groupId}
                    onChange={(value) => {
                      setGroupId(value);
                      window.requestAnimationFrame(markMaybeDirty);
                    }}
                    onCreate={() => setCreateMode("group")}
                  />
                  <FieldError field="groupId" state={feedback} />
                </div>
                <div>
                  <TagPicker
                    disabled={false}
                    error={feedback.fieldErrors?.tagIds}
                    tags={availableTags}
                    value={tagIds}
                    onChange={(value) => {
                      setTagIds(value);
                      window.requestAnimationFrame(markMaybeDirty);
                    }}
                    onCreate={createInlineTag}
                  />
                  <FieldError field="tagIds" state={feedback} />
                </div>
                <label className="min-w-0">
                  <span className="mb-0.5 block text-[11px] font-medium text-muted">
                    文章地址标识
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    value={slug}
                    readOnly={Boolean(post?.published_at)}
                    onChange={(event) => { invalidateAi("slug"); setSlug(event.target.value); }}
                    placeholder="lowercase-kebab-case"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(feedback.fieldErrors?.slug)}
                    aria-describedby={feedback.fieldErrors?.slug ? "slug-error" : undefined}
                    className="min-h-9 w-full border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted/55"
                  />
                  <FieldError field="slug" state={feedback} />
                </label>
              </div>

              <label className="block border-t border-border py-1">
                <span className="block text-[11px] font-medium text-muted">摘要</span>
                <textarea
                  ref={summaryRef}
                  name="summary"
                  value={summary}
                  rows={1}
                  onChange={(event) => { invalidateAi("summary"); setSummary(event.target.value); }}
                  placeholder="摘要（可选）"
                  className="min-h-8 max-h-28 w-full resize-none bg-transparent py-1 text-sm leading-6 outline-none placeholder:text-muted/55"
                />
              </label>
            </div>
          </div>

          {(feedback.message && !(saveOperation === "publish" && feedback.tone === "error")) || taxonomyFeedback ? (
            <p
              aria-live="polite"
              className={`mt-1.5 shrink-0 text-xs leading-5 ${
                feedback.tone === "success" ? "text-accent" : "text-foreground"
              }`}
            >
              {feedback.message ?? taxonomyFeedback}
              {publishedPath ? (
                <>
                  {" "}
                  <Link
                    href={publishedPath}
                    className="font-medium text-accent underline underline-offset-4"
                  >
                    查看公开文章
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 pt-1.5">
            <MarkdownEditorField
              kind={kind}
              value={bodyMarkdown}
              readOnly={false}
              error={feedback.fieldErrors?.bodyMarkdown}
              onChange={changeBodyMarkdown}
              onImportFiles={(files) => void importMarkdownFiles(files)}
              view={editorView}
            />
          </div>
        </div>
      </form>

      {createMode ? (
        <TaxonomyDialog
          item={null}
          mode={kind}
          onClose={() => setCreateMode(null)}
          onFeedback={setTaxonomyFeedback}
          onCreated={(created) => {
            setAvailableGroups((current) =>
              [...current, { id: created.id, name: created.name }].sort((left, right) =>
                left.name.localeCompare(right.name, "zh-CN"),
              ),
            );
            setGroupId(String(created.id));
            window.requestAnimationFrame(markMaybeDirty);
          }}
        />
      ) : null}
    </>
  );
}
