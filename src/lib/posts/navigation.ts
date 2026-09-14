import type { PostKind } from "./types";

export function postGroupPath(kind: PostKind, slug: string) {
  return `/${kind === "regular" ? "categories" : "columns"}/${encodeURIComponent(slug)}`;
}

export function parsePostGroupPage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return undefined;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 100_000 ? page : undefined;
}
