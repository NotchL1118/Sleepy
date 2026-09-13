import type { Metadata } from "next";
import { SiteLink as Link } from "../components/SiteLink";
import { SwitchAccountButton } from "./switch-account-button";

export const metadata: Metadata = {
  title: "无权访问",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-7rem)] w-[calc(100%-2.25rem)] max-w-3xl place-items-center py-20 text-center">
      <section>
        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">403 · Forbidden</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">这里是 Admin 工作区</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted sm:text-base">
          当前 GitHub 身份没有进入工作区的权限。你可以返回公开站点，或者退出后切换账号。
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            返回首页
          </Link>
          <SwitchAccountButton />
        </div>
      </section>
    </main>
  );
}
