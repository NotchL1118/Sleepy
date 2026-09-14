import type { Metadata } from "next";
import { readAiGenerationAvailability } from "@/server/ai/queries";
import { PostEditor } from "../../components/PostEditor";
import { getPostGroups, getTags } from "@/server/posts/studio-post-editor";

export const metadata: Metadata = { title: "新建普通文章" };
// Platform headroom for the 180-second generation deadline and response delivery.
export const maxDuration = 200;
export const instant = false;

export default async function Page() {
  const [groups, tags, aiAvailability] = await Promise.all([
    getPostGroups("regular"),
    getTags(),
    readAiGenerationAvailability(),
  ]);
  return (
    <PostEditor post={null} groups={groups} kind="regular" tags={tags} aiAvailability={aiAvailability} />
  );
}
