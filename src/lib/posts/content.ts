import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { postKindOptions } from "./post-kinds";
import type { Post, PostHeading, PostKind } from "./types";

const POST_DESCRIPTION_LENGTH = 160;

function markdownPlainText(markdown: string) {
  const tree = unified().use(remarkParse).parse(markdown);
  return tree.children
    .map((node) => toString(node))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function postPath(post: Pick<Post, "kind" | "slug">) {
  return `${postKindOptions[post.kind].publicBasePath}/${post.slug}`;
}

export function postKindLabel(kind: PostKind) {
  return postKindOptions[kind].singularLabel;
}

export function postGroupLabel(kind: PostKind) {
  return postKindOptions[kind].groupLabel;
}

export function estimateReadingMinutes(markdown: string) {
  const plainText = markdownPlainText(markdown);
  const hanCharacters = plainText.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = plainText.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;

  return Math.max(1, Math.ceil(hanCharacters / 400 + latinWords / 220));
}

export function postDescription(
  post: Pick<Post, "bodyMarkdown" | "summary">,
  fallback: string,
) {
  const summary = post.summary?.trim();
  if (summary) return summary;

  const plainText = markdownPlainText(post.bodyMarkdown);
  if (!plainText) return fallback;

  const characters = Array.from(plainText);
  if (characters.length <= POST_DESCRIPTION_LENGTH) return plainText;

  return `${characters.slice(0, POST_DESCRIPTION_LENGTH).join("")}…`;
}

export function extractPostHeadings(markdown: string): readonly PostHeading[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const slugger = new GithubSlugger();
  const headings: PostHeading[] = [];

  visit(tree, "heading", (node) => {
    const title = toString(node).trim();
    const id = slugger.slug(title);

    if (title && (node.depth === 1 || node.depth === 2 || node.depth === 3 || node.depth === 4)) {
      headings.push({ depth: node.depth, id, title });
    }
  });

  return headings;
}
