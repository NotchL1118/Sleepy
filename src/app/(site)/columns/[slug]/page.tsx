import { buildPostGroupMetadata, renderPostGroupRoute, type PostGroupRouteProps } from "../../lib/post-group-route";

export const instant = false;

export function generateMetadata(props: PostGroupRouteProps) {
  return buildPostGroupMetadata(props, "heartwork");
}

export default function ColumnPage(props: PostGroupRouteProps) {
  return renderPostGroupRoute(props, "heartwork");
}
