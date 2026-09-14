import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { postKindOptions } from "@/lib/posts/post-kinds";
import { parsePostGroupPage, postGroupPath } from "@/lib/posts/navigation";
import type { PostKind } from "@/lib/posts/types";
import { getPostGroupPage } from "@/server/posts/public-navigation";
import { PostNavigationLocation } from "../components/PostNavigation";
import { SiteLink } from "../components/SiteLink";

export type PostGroupRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

async function resolveGroup({ params, searchParams }: PostGroupRouteProps, kind: PostKind) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parsePostGroupPage(query.page);
  return page === undefined ? undefined : getPostGroupPage(kind, slug, page);
}

export async function buildPostGroupMetadata(props: PostGroupRouteProps, kind: PostKind): Promise<Metadata> {
  const group = await resolveGroup(props, kind);
  if (!group) return { title: "分组未找到", robots: { index: false, follow: false } };

  const basePath = postGroupPath(kind, group.slug);
  return {
    title: `${group.name} · ${postKindOptions[kind].groupLabel}${group.page > 1 ? ` · 第 ${group.page} 页` : ""}`,
    alternates: { canonical: group.page === 1 ? basePath : `${basePath}?page=${group.page}` },
  };
}

export async function renderPostGroupRoute(props: PostGroupRouteProps, kind: PostKind) {
  const group = await resolveGroup(props, kind);
  if (!group) notFound();
  const pathname = postGroupPath(kind, group.slug);

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-32 sm:px-10">
      <PostNavigationLocation pathname={pathname} kind={kind} group={{ name: group.name, slug: group.slug }} />
      <p className="mb-3 text-sm text-muted">{postKindOptions[kind].groupLabel}</p>
      <h1 className="mb-10 text-3xl leading-snug font-semibold wrap-anywhere">{group.name}</h1>
      {group.posts.length ? (
        <ul className="divide-y divide-border">
          {group.posts.map((post) => (
            <li key={post.slug}>
              <SiteLink
                href={`${postKindOptions[kind].publicBasePath}/${post.slug}`}
                className="flex flex-col gap-2 py-5 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="min-w-0 leading-relaxed wrap-anywhere">{post.title}</span>
                <time dateTime={post.publishedAt} className="shrink-0 text-sm text-muted">
                  {dateFormatter.format(new Date(post.publishedAt))}
                </time>
              </SiteLink>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">这里还没有已发布的文章。</p>}
      {group.totalPages > 1 ? (
        <nav aria-label="文章分页" className="mt-10 flex items-center justify-between gap-4 text-sm">
          {group.page > 1 ? (
            <SiteLink href={group.page === 2 ? pathname : `${pathname}?page=${group.page - 1}`} className="py-3 hover:text-accent">上一页</SiteLink>
          ) : <span />}
          <span className="text-muted">第 {group.page} / {group.totalPages} 页</span>
          {group.page < group.totalPages ? (
            <SiteLink href={`${pathname}?page=${group.page + 1}`} className="py-3 hover:text-accent">下一页</SiteLink>
          ) : <span />}
        </nav>
      ) : null}
    </main>
  );
}
