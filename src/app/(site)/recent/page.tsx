import { RecentPostsPage } from "../lib/recent-posts-route";

export const metadata = { title: "最近文章", alternates: { canonical: "/recent" } };

export default function RecentPage() {
  return <RecentPostsPage />;
}
