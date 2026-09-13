import { SiteLink as Link } from "./components/SiteLink";
import { siteConfig } from "@/config/site";
import { postDescription, postPath } from "@/lib/posts/content";
import { listRecentPosts } from "@/server/posts/public-posts";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

export default async function Page() {
  const recentPosts = await listRecentPosts(3);

  return (
    <main className="mx-auto w-[calc(100%-2.25rem)] max-w-[1040px] pb-36 pt-16 sm:pt-20 min-[821px]:pt-24">
      <section>
        <p className="mb-4 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Sleepy 的个人角落
        </p>
        <h1 className="max-w-3xl text-[clamp(2.75rem,7vw,5.125rem)] leading-[1.05] font-medium tracking-[-0.055em] text-foreground">
          写下技术，
          <br />
          也写下生活。
        </h1>
        <p className="mt-7 max-w-2xl text-[17px] leading-[1.85] text-muted sm:text-xl">
          这里收集我在技术、设计与日常生活中的观察。希望每一篇文字，都值得你安静地读上一会儿。
        </p>
      </section>

      <section id="recent" className="mt-24 scroll-mt-32 min-[821px]:mt-28">
        <header className="mb-3 flex items-baseline justify-between gap-6">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">最近写下</h2>
          {recentPosts.length > 0 ? (
            <Link href="#recent" className="text-[13px] text-muted transition-colors hover:text-foreground">
              查看全部 →
            </Link>
          ) : null}
        </header>
        <div className="border-t border-border">
          {recentPosts.length > 0 ? (
            recentPosts.map((post) => (
              <article
                key={post.id}
                className="grid gap-3 border-b border-border py-7 min-[640px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:gap-8"
              >
                <div>
                  <h3 className="text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                    <Link href={postPath(post)} className="transition-colors hover:text-accent">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
                    {postDescription(post, siteConfig.description)}
                  </p>
                </div>
                <time dateTime={post.publishedAt} className="text-sm text-muted">
                  {dateFormatter.format(new Date(post.publishedAt))}
                </time>
              </article>
            ))
          ) : (
            <div className="py-16">
              <p className="text-base font-medium text-foreground">还没有公开文章</p>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
                第一篇已发布的普通文章或心作会出现在这里。
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
