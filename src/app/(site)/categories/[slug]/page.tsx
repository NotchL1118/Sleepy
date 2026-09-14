import { buildPostGroupMetadata, renderPostGroupRoute, type PostGroupRouteProps } from "../../lib/post-group-route";

export const instant = false;

export function generateMetadata(props: PostGroupRouteProps) {
  return buildPostGroupMetadata(props, "regular");
}

export default function CategoryPage(props: PostGroupRouteProps) {
  return renderPostGroupRoute(props, "regular");
}
