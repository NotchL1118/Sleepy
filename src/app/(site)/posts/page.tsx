import { RecentPostsPage } from "../lib/recent-posts-route";

export const metadata = { title: "文稿", alternates: { canonical: "/posts" } };

export default function PostsPage() {
  return <RecentPostsPage kind="regular" />;
}
