import { SiteLink as Link } from "./components/SiteLink";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[65dvh] w-[calc(100%-2.25rem)] max-w-2xl place-content-center py-24 text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">404 · 没有找到</p>
      <h1 className="mt-4 text-[clamp(2.5rem,7vw,4.5rem)] leading-none font-medium tracking-[-0.055em]">
        这页文字不在这里。
      </h1>
      <p className="mx-auto mt-6 max-w-lg text-base leading-8 text-muted">
        它可能已经移动，也可能从未写下。你可以回到首页，继续看看最近的文章。
      </p>
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
