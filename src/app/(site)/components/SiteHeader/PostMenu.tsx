"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronIcon, FolderIcon } from "@/components/icons";
import { postKindOptions } from "@/lib/posts/post-kinds";
import { postGroupPath } from "@/lib/posts/navigation";
import type { PostGroup, PostKind, PostNavigationGroup } from "@/lib/posts/types";
import { SiteLink } from "../SiteLink";
import type { NavigationResource } from "./usePostNavigation";
import { NavigationIcon } from "./NavigationIcon";
import { ActiveIndicator } from "./ActiveIndicator";

type PostMenuProps = {
  kind: PostKind;
  mobile?: boolean;
  active: boolean;
  currentGroup?: PostGroup;
  pathname: string;
  open: boolean;
  resource?: NavigationResource;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: () => void;
  onRetry: () => void;
};

function MenuSkeleton({ mobile }: { mobile: boolean }) {
  return (
    <div role="status" className={`min-h-72 p-4 ${mobile ? "" : "grid grid-cols-[7rem_minmax(0,1fr)] gap-4"}`}>
      <span className="sr-only">正在加载分类和文章</span>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        {["w-16", "w-24", "w-20"].map((width) => <div key={width} className={`h-4 rounded bg-border ${width}`} />)}
      </div>
      <div aria-hidden="true" className="space-y-6 pt-6 motion-safe:animate-pulse min-[821px]:pt-0">
        {["w-3/4", "w-full", "w-2/3", "w-4/5", "w-1/2"].map((width) => <div key={width} className={`h-4 rounded bg-border ${width}`} />)}
      </div>
    </div>
  );
}

function GroupArticles({ group, kind, pathname, onNavigate }: {
  group: PostNavigationGroup;
  kind: PostKind;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="space-y-1">
      {group.posts.map((post) => {
        const href = `${postKindOptions[kind].publicBasePath}/${post.slug}`;
        const current = pathname === href;
        return (
          <li key={post.slug}>
            <SiteLink
              href={href}
              prefetch={false}
              aria-current={current ? "page" : undefined}
              onNavigate={onNavigate}
              className={`block rounded-lg px-3 py-3 text-sm leading-relaxed wrap-anywhere transition-colors hover:bg-surface hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${current ? "bg-surface font-medium text-accent" : ""}`}
            >
              {post.title}
            </SiteLink>
          </li>
        );
      })}
    </ul>
  );
}

function GroupMenuHeading({ group, kind, onNavigate }: {
  group?: PostNavigationGroup;
  kind: PostKind;
  onNavigate: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-border bg-background px-3">
      <p className="min-w-0 truncate text-xs text-muted" title={group?.name}>
        {group?.name ?? postKindOptions[kind].groupLabel}
      </p>
      {group ? (
        <SiteLink
          href={postGroupPath(kind, group.slug)}
          prefetch={false}
          onNavigate={onNavigate}
          aria-label={`查看${group.name}的全部文章`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded px-1 text-xs text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          查看全部 <span aria-hidden="true">→</span>
        </SiteLink>
      ) : null}
    </div>
  );
}

export function PostMenu({ kind, mobile = false, active, currentGroup, pathname, open, resource, onOpen, onClose, onNavigate, onRetry }: PostMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuId = useId();
  const triggerId = useId();
  const [selection, setSelection] = useState<string | null | undefined>(undefined);
  const label = kind === "regular" ? "文稿" : "心作";
  const groups = resource?.groups;
  const preferredSlug = groups?.find((group) => group.slug === currentGroup?.slug)?.slug ?? groups?.[0]?.slug;
  const selectedSlug = selection === undefined ? preferredSlug : selection;
  const selectedGroup = groups?.find((group) => group.slug === selectedSlug) ?? groups?.[0];

  function clearTimers() {
    clearTimeout(hoverTimer.current);
    clearTimeout(closeTimer.current);
  }

  function show() {
    clearTimers();
    if (!open) {
      setSelection(undefined);
      onOpen();
    }
  }

  function navigate() {
    clearTimers();
    onNavigate();
  }

  useEffect(() => () => {
    clearTimeout(hoverTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open || mobile) return;
    function outside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearTimeout(hoverTimer.current);
        clearTimeout(closeTimer.current);
        onClose();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, mobile, onClose]);

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={(event) => {
        if (mobile || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches) return;
        clearTimers();
        hoverTimer.current = setTimeout(show, 120);
      }}
      onPointerLeave={(event) => {
        if (mobile || event.pointerType !== "mouse") return;
        clearTimers();
        closeTimer.current = setTimeout(onClose, 180);
      }}
      onBlur={(event) => {
        if (mobile) return;
        if (!event.currentTarget.contains(event.relatedTarget)) {
          clearTimers();
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          clearTimers();
          onClose();
          triggerRef.current?.focus();
        }
      }}
    >
      <motion.div layout={mobile ? false : "position"} className={`flex items-center ${mobile ? "w-full rounded-xl" : "relative rounded-full"} ${active && mobile ? "bg-foreground/7" : ""}`}>
        {active && !mobile ? <ActiveIndicator /> : null}
        <SiteLink
          ref={triggerRef}
          id={triggerId}
          href={postKindOptions[kind].publicBasePath}
          prefetch={false}
          aria-current={active ? pathname === postKindOptions[kind].publicBasePath ? "page" : "location" : undefined}
          aria-expanded={open}
          aria-controls={menuId}
          onNavigate={navigate}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              show();
            }
          }}
          className={`flex items-center text-[15px] font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${mobile ? "min-h-12 min-w-0 flex-1 rounded-xl px-3 text-left hover:bg-foreground/5.5" : "min-h-10 rounded-full px-4"} ${active ? "text-foreground" : "text-muted"}`}
        >
          <NavigationIcon kind={kind} selected={active} />
          <motion.span layout={mobile ? false : "position"} className="inline-block">{label}</motion.span>
        </SiteLink>
        <button
          type="button"
          aria-label={`${open ? "收起" : "展开"}${label}预览`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => { clearTimers(); if (open) onClose(); else show(); }}
          className={`${mobile ? "grid" : "hidden [@media(hover:none)]:grid"} size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent`}
        >
          <ChevronIcon className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
        </button>
      </motion.div>
      {/* Preserve mounted links while closing so SiteLink can signal a pending route. */}
      <div
        id={menuId}
        hidden={!open}
        role="region"
        aria-labelledby={triggerId}
        className={mobile ? "py-2" : "absolute top-full left-1/2 z-50 w-[min(34rem,calc(100vw-3rem))] -translate-x-1/2 pt-3"}
      >
        <div className={`overflow-y-auto overscroll-contain bg-background ${mobile ? "rounded-xl border border-border" : "max-h-[min(32rem,calc(100dvh-8rem))] rounded-2xl border border-border shadow-lg"}`}>
          {resource?.error ? (
            <div role="alert" className="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-sm text-muted">
              <p>暂时无法加载{label}，请重试。</p>
              <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-border px-5 text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">重新加载</button>
            </div>
          ) : !groups ? <MenuSkeleton mobile={mobile} /> : groups.length === 0 ? (
            <p role="status" className="grid min-h-72 place-items-center p-6 text-sm text-muted">还没有已发布的{label}。</p>
          ) : mobile ? (
            <>
              <GroupMenuHeading group={groups.find((group) => group.slug === selectedSlug)} kind={kind} onNavigate={navigate} />
              <div className="p-2">
                {groups.map((group, index) => (
                  <div key={group.slug}>
                    <div className={`flex items-center rounded-lg ${selectedSlug === group.slug ? "bg-surface font-medium" : "text-muted"}`}>
                      <SiteLink
                        href={postGroupPath(kind, group.slug)}
                        prefetch={false}
                        onNavigate={navigate}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-sm wrap-anywhere hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <FolderIcon selected={selectedSlug === group.slug} className={`size-4 shrink-0 ${selectedSlug === group.slug ? "text-accent" : "text-muted"}`} />
                        <span className="min-w-0">{group.name}</span>
                      </SiteLink>
                      <button
                        type="button"
                        aria-label={`预览${group.name}的文章`}
                        aria-expanded={open && selectedSlug === group.slug}
                        aria-controls={`${menuId}-${index}`}
                        onClick={() => setSelection(selectedSlug === group.slug ? null : group.slug)}
                        className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <ChevronIcon className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${selectedSlug === group.slug ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    <div id={`${menuId}-${index}`} hidden={selectedSlug !== group.slug} className="py-2 pl-2">
                      <GroupArticles group={group} kind={kind} pathname={pathname} onNavigate={navigate} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-72 grid-cols-[9rem_minmax(0,1fr)]">
              <div className="border-r border-border p-2">
                <p className="px-2 pt-2 pb-3 text-xs text-muted">{postKindOptions[kind].groupLabel}</p>
                {groups.map((group) => (
                  <SiteLink
                    key={group.slug}
                    href={postGroupPath(kind, group.slug)}
                    prefetch={false}
                    aria-current={pathname === postGroupPath(kind, group.slug) ? "page" : undefined}
                    onPointerEnter={(event) => { if (event.pointerType === "mouse") setSelection(group.slug); }}
                    onFocus={() => setSelection(group.slug)}
                    onNavigate={navigate}
                    className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm wrap-anywhere transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent ${selectedGroup?.slug === group.slug ? "bg-surface font-medium text-foreground" : "text-muted"}`}
                  >
                    <FolderIcon selected={selectedGroup?.slug === group.slug} className={`size-4 shrink-0 ${selectedGroup?.slug === group.slug ? "text-accent" : "text-muted"}`} />
                    <span className="min-w-0">{group.name}</span>
                  </SiteLink>
                ))}
              </div>
              <div className="min-w-0">
                <GroupMenuHeading group={selectedGroup} kind={kind} onNavigate={navigate} />
                <div className="p-2">
                  {selectedGroup ? <GroupArticles group={selectedGroup} kind={kind} pathname={pathname} onNavigate={navigate} /> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
