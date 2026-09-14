"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import sleepyAvatar from "@/assets/brand/sleepy-avatar.png";
import {
  DashboardIcon,
  GitHubIcon,
  LogOutIcon,
  MenuIcon,
  UserIcon,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { showToast } from "@/components/Toast";
import { signInWithGitHub } from "@/lib/auth/client";
import type { Viewer } from "@/lib/auth/types";
import { useSignOut } from "@/lib/auth/useSignOut";
import { SiteLink } from "../SiteLink";
import { usePostNavigationLocation } from "../PostNavigation";
import { PostMenu } from "./PostMenu";
import { ActiveIndicator } from "./ActiveIndicator";
import { NavigationIcon } from "./NavigationIcon";
import { usePostNavigation } from "./usePostNavigation";
import type { PostKind } from "@/lib/posts/types";
import styles from "./index.module.css";

type ActiveSection = "home" | "regular" | "heartwork" | "recent" | undefined;

const HEADER_FADE_DISTANCE = 80;
const HEADER_REVEAL_BUFFER = 50;

const navigation: ReadonlyArray<{
  label: string;
  href: string;
  section: Exclude<ActiveSection, undefined>;
  prefixes: readonly string[];
}> = [
  { label: "自述", href: "/", section: "home", prefixes: ["/"] },
  { label: "文稿", href: "/posts", section: "regular", prefixes: ["/posts", "/categories"] },
  { label: "心作", href: "/heartworks", section: "heartwork", prefixes: ["/heartworks", "/columns"] },
  { label: "时光", href: "/recent", section: "recent", prefixes: ["/recent"] },
];

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveActiveSection(pathname: string): ActiveSection {
  return navigation.find(({ prefixes }) => prefixes.some((prefix) => matchesPath(pathname, prefix)))?.section;
}

function BrandAvatar() {
  return (
    <Image
      src={sleepyAvatar}
      alt=""
      priority
      placeholder="blur"
      className="size-10 rounded-full bg-[#171515] object-cover"
    />
  );
}

function ViewerAvatar({ viewer, large = false }: { viewer: Viewer; large?: boolean }) {
  const size = large ? 40 : 32;

  if (!viewer.avatarUrl) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-surface font-semibold ${
          large ? "size-10 text-sm" : "size-8 text-xs"
        }`}
      >
        {viewer.displayName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={viewer.avatarUrl}
      alt=""
      width={size}
      height={size}
      className={large ? "size-10 rounded-full object-cover" : "size-8 rounded-full object-cover"}
    />
  );
}

function ReaderSummary({ viewer }: { viewer: Viewer | null }) {
  if (!viewer) {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted">
          <UserIcon className="size-[18px]" />
        </span>
        <div>
          <p className="text-sm font-semibold">读者</p>
          <p className="text-xs text-muted">尚未登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <ViewerAvatar viewer={viewer} large />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{viewer.displayName}</p>
        <p className="truncate text-xs text-muted">
          {viewer.username ? `@${viewer.username}` : "GitHub 读者"}
        </p>
      </div>
    </div>
  );
}

type AccountActionsProps = {
  viewer: Viewer | null;
  pending: boolean;
  onLogin: () => void;
  onSignOut: () => void;
};

function AccountActions({ viewer, pending, onLogin, onSignOut }: AccountActionsProps) {
  return (
    <>
      <ReaderSummary viewer={viewer} />
      <div className="my-1 border-t border-border" />
      {viewer?.isAdmin ? (
        <Link
          href="/dashboard"
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
        >
          <DashboardIcon className="size-[18px]" />
          进入 Admin 工作区
        </Link>
      ) : null}
      <button
        type="button"
        onClick={viewer ? onSignOut : onLogin}
        disabled={pending}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        {viewer ? <LogOutIcon className="size-[18px]" /> : <GitHubIcon />}
        {pending ? "请稍候…" : viewer ? "退出登录" : "GitHub 登录"}
      </button>
    </>
  );
}

function AccountMenu(props: AccountActionsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="账户"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {props.viewer ? (
          <ViewerAvatar viewer={props.viewer} />
        ) : (
          <span className="grid size-8 place-items-center rounded-full border border-dashed border-border text-muted">
            <UserIcon className="size-4" />
          </span>
        )}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="账户"
          className="absolute top-12 right-0 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-2 shadow-lg"
        >
          <AccountActions
            {...props}
            onLogin={() => {
              setOpen(false);
              props.onLogin();
            }}
            onSignOut={() => {
              setOpen(false);
              props.onSignOut();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollYRef = useRef(0);
  const upwardScrollRef = useRef(0);
  const headerOpacityRef = useRef(1);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = useId();
  const navigationLayoutId = useId();
  const [expanded, setExpanded] = useState<{ kind: PostKind; mobile: boolean } | null>(null);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const location = usePostNavigationLocation(pathname);
  const { resources, load } = usePostNavigation();
  const [loginPending, setLoginPending] = useState(false);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const { signingOut, signOut } = useSignOut();
  const pending = loginPending || signingOut;
  const activeSection = resolveActiveSection(pathname);

  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setExpanded(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    const media = window.matchMedia("(min-width: 821px)");
    function closeOnResize() {
      setExpanded(null);
      setMobileOpen(false);
    }
    media.addEventListener("change", closeOnResize);
    return () => media.removeEventListener("change", closeOnResize);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function outside(event: PointerEvent) {
      if (!mobileWrapperRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
        setExpanded(null);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      setExpanded(null);
      mobileTriggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [mobileOpen]);

  function renderNavigation(mobile: boolean) {
    return navigation.map(({ label, href, section }) => {
      if (section === "regular" || section === "heartwork") {
        return (
          <PostMenu
            key={section}
            kind={section}
            mobile={mobile}
            active={activeSection === section}
            currentGroup={location?.kind === section ? location.group : undefined}
            pathname={pathname}
            open={expanded?.kind === section && expanded.mobile === mobile && (!mobile || mobileOpen)}
            resource={resources[section]}
            onOpen={() => {
              setExpanded({ kind: section, mobile });
              load(section);
              headerOpacityRef.current = 1;
              setHeaderOpacity(1);
            }}
            onClose={() => setExpanded((current) => current?.kind === section && current.mobile === mobile ? null : current)}
            onNavigate={() => {
              setExpanded(null);
              setMobileOpen(false);
            }}
            onRetry={() => load(section)}
          />
        );
      }
      return (
        <motion.div key={section} layout={mobile ? false : "position"}>
          <SiteLink
            href={href}
            aria-current={activeSection === section ? "page" : undefined}
            onClick={() => { setExpanded(null); setMobileOpen(false); }}
            className={`flex items-center text-[15px] font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${mobile ? "min-h-12 rounded-xl px-3 hover:bg-foreground/5.5" : "relative min-h-10 rounded-full px-4"} ${activeSection === section ? `${mobile ? "bg-foreground/7" : ""} text-foreground` : "text-muted"}`}
          >
            {!mobile && activeSection === section ? <ActiveIndicator /> : null}
            <NavigationIcon kind={section} selected={activeSection === section} />
            <motion.span layout={mobile ? false : "position"} className="inline-block">{label}</motion.span>
          </SiteLink>
        </motion.div>
      );
    });
  }

  useEffect(() => {
    lastScrollYRef.current = Math.max(window.scrollY, 0);

    function updateHeaderVisibility() {
      const scrollY = Math.max(window.scrollY, 0);
      const delta = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      const headerHasOpenMenu = headerRef.current?.querySelector(
        '[aria-expanded="true"]',
      );

      if (
        scrollY === 0 ||
        headerHasOpenMenu ||
        headerRef.current?.matches(":focus-within")
      ) {
        upwardScrollRef.current = 0;
        headerOpacityRef.current = 1;
        setHeaderOpacity(1);
        return;
      }

      if (delta !== 0) {
        let fadeDelta = delta;
        if (delta > 0) {
          upwardScrollRef.current = 0;
        } else {
          // Consume the upward buffer before restoring opacity, including
          // when a single scroll event crosses the buffer boundary.
          const bufferedDistance = Math.min(
            -delta,
            HEADER_REVEAL_BUFFER - upwardScrollRef.current,
          );
          upwardScrollRef.current += bufferedDistance;
          fadeDelta += bufferedDistance;
        }
        const nextOpacity = Math.min(
          1,
          Math.max(0, headerOpacityRef.current - fadeDelta / HEADER_FADE_DISTANCE),
        );
        headerOpacityRef.current = nextOpacity;
        setHeaderOpacity(nextOpacity);
      }
    }

    window.addEventListener("scroll", updateHeaderVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderVisibility);
  }, []);

  async function handleGitHubLogin() {
    setLoginPending(true);
    const { error } = await signInWithGitHub(pathname);

    if (error) {
      setLoginPending(false);
      showToast(error.message || "无法开始 GitHub 登录，请稍后重试。", {
        tone: "error",
      });
    }
  }

  const accountActions = {
    viewer,
    pending,
    onLogin: handleGitHubLogin,
    onSignOut: signOut,
  };

  return (
    <header
      ref={headerRef}
      onFocusCapture={() => {
        upwardScrollRef.current = 0;
        headerOpacityRef.current = 1;
        setHeaderOpacity(1);
      }}
      style={{ opacity: headerOpacity }}
      className={`sticky top-0 z-40 px-3 pt-4 pb-2 sm:px-6 min-[821px]:px-10 min-[821px]:pt-7 min-[821px]:pb-3 ${
        headerOpacity === 0 ? "pointer-events-none" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <div className={`${styles.glass} flex items-center justify-between rounded-full p-[5px] min-[821px]:hidden`}>
          <SiteLink
            href="/"
            aria-label="Sleepy 首页"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BrandAvatar />
          </SiteLink>
          <div ref={mobileWrapperRef} className="relative">
            <button
              ref={mobileTriggerRef}
              type="button"
              aria-label={mobileOpen ? "关闭导航" : "打开导航"}
              aria-expanded={mobileOpen}
              aria-controls={mobileMenuId}
              onClick={() => { setMobileOpen((value) => !value); setExpanded(null); }}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-foreground/5.5 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <MenuIcon />
            </button>
            {/* Keep links mounted so closing the menu preserves navigation pending. */}
            <nav
              id={mobileMenuId}
              hidden={!mobileOpen}
              aria-label="移动端导航"
              className={`${styles.mobilePanel} max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain border border-border bg-background shadow-lg`}
            >
              <ThemeToggle showLabel />
              {renderNavigation(true)}
              <div className="mt-2 border-t border-border pt-2">
                <AccountActions
                  {...accountActions}
                  onLogin={() => {
                    setMobileOpen(false);
                    handleGitHubLogin();
                  }}
                  onSignOut={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                />
              </div>
            </nav>
          </div>
        </div>

        <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-4 min-[821px]:grid">
          <SiteLink
            href="/"
            aria-label="Sleepy 首页"
            className={`${styles.glass} grid size-[52px] place-items-center justify-self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
          >
            <BrandAvatar />
          </SiteLink>

          <MotionConfig reducedMotion="user" transition={{ type: "spring", duration: 0.42, bounce: 0.16 }}>
            <LayoutGroup id={navigationLayoutId}>
              <nav
                aria-label="主要导航"
                className={`${styles.glass} relative isolate flex min-h-[52px] items-center gap-0.5 rounded-full p-[5px]`}
              >
                {renderNavigation(false)}
                <motion.div layout="position">
                  <SiteLink
                    href="/recent"
                    className="flex min-h-10 items-center rounded-full px-4 text-[15px] font-medium text-muted transition-colors hover:text-foreground"
                  >
                    <NavigationIcon kind="more" selected={false} />
                    <motion.span layout="position" className="inline-block">更多</motion.span>
                  </SiteLink>
                </motion.div>
              </nav>
            </LayoutGroup>
          </MotionConfig>

          <div className={`${styles.glass} flex items-center gap-0.5 justify-self-end rounded-full p-[5px]`}>
            <ThemeToggle />
            <AccountMenu {...accountActions} />
          </div>
        </div>
      </div>
    </header>
  );
}
