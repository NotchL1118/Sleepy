export type PostKind = "regular" | "heartwork";
export type PostStatus = "published" | "archived";

export type PostGroup = {
  name: string;
  slug: string;
};

export type Post = {
  id: number;
  kind: PostKind;
  status: PostStatus;
  slug: string;
  title: string;
  summary?: string;
  bodyMarkdown: string;
  group: PostGroup;
  tags: readonly string[];
  publishedAt: string;
  updatedAt: string;
  archiveNote?: string;
};

export type PostPreview = Pick<
  Post,
  | "bodyMarkdown"
  | "group"
  | "id"
  | "kind"
  | "publishedAt"
  | "slug"
  | "summary"
  | "title"
>;

export type AdjacentPost = Pick<Post, "kind" | "slug" | "title" | "group">;

export type PostPageData = {
  post: Post;
  previousPost?: AdjacentPost;
  nextPost?: AdjacentPost;
};

export type PostRoute = Pick<Post, "kind" | "slug">;

export type PostHeading = {
  depth: 1 | 2 | 3 | 4;
  id: string;
  title: string;
};
