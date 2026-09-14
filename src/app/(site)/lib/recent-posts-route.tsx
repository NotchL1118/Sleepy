import type { PostKind } from "@/lib/posts/types";
import { postKindOptions } from "@/lib/posts/post-kinds";
import { listRecentNavigationPosts } from "@/server/posts/public-navigation";
import { SiteLink } from "../components/SiteLink";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" });

export async function RecentPostsPage({ kind }: { kind?: PostKind }) {
  const posts = await listRecentNavigationPosts(kind);
  const title = kind === "regular" ? "文稿" : kind === "heartwork" ? "心作" : "最近文章";

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-32 sm:px-10">
      <p className="mb-3 text-sm text-muted">最近写下</p>
      <h1 className="mb-10 text-3xl font-semibold">{title}</h1>
      {posts.length ? (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <li key={post.slug}>
              <SiteLink
                href={`${postKindOptions[post.kind].publicBasePath}/${post.slug}`}
                className="flex flex-col gap-2 py-5 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="min-w-0 leading-relaxed wrap-anywhere">{post.title}</span>
                <time dateTime={post.publishedAt} className="shrink-0 text-sm text-muted">{dateFormatter.format(new Date(post.publishedAt))}</time>
              </SiteLink>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">这里还没有已发布的文章。</p>}
    </main>
  );
}
