import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostEditor } from "../../components/PostEditor";
import { getPostGroups, getStudioPost, getTags } from "@/server/posts/studio-post-editor";

export const metadata: Metadata = { title: "管理普通文章" };
// Platform headroom for the 180-second generation deadline and response delivery.
export const maxDuration = 200;
export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idValue } = await params;
  const id = Number(idValue);

  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [post, groups, tags] = await Promise.all([
    getStudioPost(id, "regular"),
    getPostGroups("regular"),
    getTags(),
  ]);

  if (!post) notFound();

  return (
    <PostEditor post={post} groups={groups} kind="regular" tags={tags} />
  );
}
