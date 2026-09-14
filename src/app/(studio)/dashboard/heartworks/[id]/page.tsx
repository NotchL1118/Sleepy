import type { Metadata } from "next";
import { readAiGenerationAvailability } from "@/server/ai/queries";
import { notFound } from "next/navigation";
import { PostEditor } from "../../components/PostEditor";
import { getPostGroups, getStudioPost, getTags } from "@/server/posts/studio-post-editor";

export const metadata: Metadata = { title: "管理心作" };
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

  const [post, groups, tags, aiAvailability] = await Promise.all([
    getStudioPost(id, "heartwork"),
    getPostGroups("heartwork"),
    getTags(),
    readAiGenerationAvailability(),
  ]);

  if (!post) notFound();

  return (
    <PostEditor post={post} groups={groups} kind="heartwork" tags={tags} aiAvailability={aiAvailability} />
  );
}
