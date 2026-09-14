import { RecentPostsPage } from "../lib/recent-posts-route";

export const metadata = { title: "心作", alternates: { canonical: "/heartworks" } };

export default function HeartworksPage() {
  return <RecentPostsPage kind="heartwork" />;
}
