import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { PostGroupPageData, PostKind, PostListItem, PostNavigationGroup } from "@/lib/posts/types";
import { createPublicClient } from "@/utils/supabase/public";
import { POST_LIST_CACHE_TAG } from "./public-posts";

const GROUP_PAGE_SIZE = 20;

export async function listRecentNavigationPosts(kind?: PostKind): Promise<readonly (PostListItem & { kind: PostKind })[]> {
  "use cache";

  cacheLife("days");
  cacheTag(POST_LIST_CACHE_TAG);

  let query = createPublicClient()
    .from("posts")
    .select("kind, slug, title, published_at")
    .eq("status", "published");
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  if (error) throw new Error("Unable to load recent navigation articles.", { cause: error });
  return data.map((post) => ({
    kind: post.kind as PostKind,
    slug: post.slug!,
    title: post.title!,
    publishedAt: post.published_at!,
  }));
}

// Limit the embedded relation, not the number of groups, and never fetch bodies.
export async function listPostNavigation(kind: PostKind): Promise<readonly PostNavigationGroup[]> {
  "use cache";

  cacheLife("days");
  cacheTag(POST_LIST_CACHE_TAG);

  const { data, error } = await createPublicClient()
    .from("post_groups")
    .select("name, slug, posts!inner(slug, title, published_at)")
    .eq("kind", kind)
    .eq("posts.status", "published")
    .order("name")
    .order("slug")
    .order("published_at", { referencedTable: "posts", ascending: false })
    .order("id", { referencedTable: "posts", ascending: false })
    .limit(5, { referencedTable: "posts" });

  if (error) throw new Error("Unable to load Post navigation.", { cause: error });

  return data.map((group) => ({
    name: group.name,
    slug: group.slug,
    posts: group.posts.map((post) => ({
      slug: post.slug!,
      title: post.title!,
      publishedAt: post.published_at!,
    })),
  }));
}

export async function getPostGroupPage(
  kind: PostKind,
  slug: string,
  page: number,
): Promise<PostGroupPageData | undefined> {
  "use cache";

  cacheLife("days");
  cacheTag(POST_LIST_CACHE_TAG);

  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return undefined;

  const supabase = createPublicClient();
  const { data: group, error: groupError } = await supabase
    .from("post_groups")
    .select("id, name, slug")
    .eq("kind", kind)
    .eq("slug", slug)
    .maybeSingle();

  if (groupError) throw new Error("Unable to load Post Group.", { cause: groupError });
  if (!group) return undefined;

  const offset = (page - 1) * GROUP_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("posts")
    .select("slug, title, published_at", { count: "exact" })
    .eq("kind", kind)
    .eq("group_id", group.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + GROUP_PAGE_SIZE - 1);

  if (error) throw new Error("Unable to load Post Group articles.", { cause: error });
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / GROUP_PAGE_SIZE));
  if (page > totalPages) return undefined;

  return {
    name: group.name,
    slug: group.slug,
    page,
    totalPages,
    posts: data.map((post) => ({
      slug: post.slug!,
      title: post.title!,
      publishedAt: post.published_at!,
    })),
  };
}
