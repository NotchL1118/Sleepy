import type { Metadata } from "next";
import { PostEditor } from "../../components/PostEditor";
import { getPostGroups, getTags } from "@/server/posts/studio-post-editor";

export const metadata: Metadata = { title: "新建心作" };
// Platform headroom for the 180-second generation deadline and response delivery.
export const maxDuration = 200;
export const instant = false;

export default async function Page() {
  const [groups, tags] = await Promise.all([
    getPostGroups("heartwork"),
    getTags(),
  ]);
  return (
    <PostEditor post={null} groups={groups} kind="heartwork" tags={tags} />
  );
}
