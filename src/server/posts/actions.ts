"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  POST_LIST_CACHE_TAG,
  postDetailCacheTag,
} from "./public-posts";
import { postKindOptions } from "@/lib/posts/post-kinds";
import { isValidSlug } from "@/lib/posts/slug";
import type { PostKind } from "@/lib/posts/types";
import { listPostNavigation } from "./public-navigation";

// Public, read-only entry point called on first menu interaction.
export async function loadPostNavigation(kind: PostKind) {
  if (kind !== "regular" && kind !== "heartwork") {
    throw new Error("Invalid Post kind.");
  }
  return listPostNavigation(kind);
}

export type PostField =
  | "bodyMarkdown"
  | "groupName"
  | "groupSlug"
  | "groupId"
  | "slug"
  | "tagIds"
  | "title";

export type PostActionState = {
  message: string | null;
  tone: "error" | "success" | null;
  updatedAt: string | null;
  fieldErrors?: Partial<Record<PostField, string>>;
  postId?: number;
  publishedPath?: string;
  saved?: boolean;
  studioPath?: string;
};

export type LifecycleActionState = {
  message: string | null;
  tone: "error" | "success" | null;
  updatedAt?: string;
};

export type PostTransition = "archive" | "restore" | "withdraw";

type DraftValues = {
  groupId: number | null;
  title: string | null;
  slug: string | null;
  summary: string | null;
  bodyMarkdown: string;
  expectedUpdatedAt: string | null;
  tagIds: number[];
};

type CreateDraftArgs =
  Database["public"]["Functions"]["create_post_draft"]["Args"];
type CreateAndPublishArgs =
  Database["public"]["Functions"]["create_and_publish_post"]["Args"];
type UpdateContentArgs =
  Database["public"]["Functions"]["update_post_content"]["Args"];
type PublishPostArgs =
  Database["public"]["Functions"]["publish_post"]["Args"];
type TransitionPostArgs =
  Database["public"]["Functions"]["transition_post"]["Args"];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readTagValues(
  formData: FormData,
  updatedAt: string | null,
):
  | Pick<DraftValues, "tagIds">
  | PostActionState {
  const tagIds = formData.getAll("tagId").map((value) =>
    typeof value === "string" ? Number(value) : Number.NaN,
  );
  const fieldErrors: Partial<Record<PostField, string>> = {};

  if (tagIds.some((tagId) => !Number.isSafeInteger(tagId) || tagId <= 0)) {
    fieldErrors.tagIds = "请选择有效的标签。";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "请修正标出的标签字段后再保存。",
      tone: "error",
      updatedAt,
      fieldErrors,
    };
  }

  return {
    tagIds: [...new Set(tagIds)],
  };
}

function readDraftValues(
  formData: FormData,
  kind: PostKind,
): DraftValues | PostActionState {
  const groupIdValue = readString(formData, "groupId");
  const groupId = groupIdValue ? Number(groupIdValue) : null;
  const slug = optionalText(readString(formData, "slug"));
  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt") || null;

  if (groupId !== null && (!Number.isSafeInteger(groupId) || groupId <= 0)) {
    return {
      message: `请选择有效的${postKindOptions[kind].groupLabel}。`,
      tone: "error",
      updatedAt: expectedUpdatedAt,
    };
  }

  if (slug !== null && !isValidSlug(slug)) {
    return {
      message: "Slug 只能使用小写字母、数字和单个连字符。",
      tone: "error",
      updatedAt: expectedUpdatedAt,
    };
  }

  const tagValues = readTagValues(formData, expectedUpdatedAt);
  if (isActionState(tagValues)) return tagValues;

  return {
    groupId,
    title: optionalText(readString(formData, "title")),
    slug,
    summary: optionalText(readString(formData, "summary")),
    bodyMarkdown: readString(formData, "bodyMarkdown"),
    expectedUpdatedAt,
    ...tagValues,
  };
}

type PublishValues = {
  bodyMarkdown: string;
  groupId: number;
  slug: string;
  summary: string | null;
  tagIds: number[];
  title: string;
};

function readPublishValues(
  formData: FormData,
  kind: PostKind,
  updatedAt: string | null,
  operation: "publish" | "save" = "publish",
): PublishValues | PostActionState {
  const options = postKindOptions[kind];
  const title = readString(formData, "title").trim();
  const slug = readString(formData, "slug").trim();
  const summary = optionalText(readString(formData, "summary"));
  const bodyMarkdown = readString(formData, "bodyMarkdown");
  const groupId = Number(readString(formData, "groupId"));
  const fieldErrors: Partial<Record<PostField, string>> = {};
  const tagValues = readTagValues(formData, updatedAt);

  if (isActionState(tagValues)) return tagValues;
  const actionLabel = operation === "publish" ? "发布" : "保存";
  if (!title) fieldErrors.title = `${actionLabel}前请填写标题。`;
  if (!isValidSlug(slug)) {
    fieldErrors.slug = "Slug 只能使用小写字母、数字和单个连字符。";
  }
  if (!bodyMarkdown.trim()) {
    fieldErrors.bodyMarkdown = `${actionLabel}前请填写 Markdown 正文。`;
  }
  if (!Number.isSafeInteger(groupId) || groupId <= 0) {
    fieldErrors.groupId = `请选择一个${options.singularLabel}${options.groupLabel}。`;
  }

  if (Object.keys(fieldErrors).length) {
    return {
      message: `请修正标出的字段后再${actionLabel}。`,
      tone: "error",
      updatedAt,
      fieldErrors,
    };
  }

  return {
    bodyMarkdown,
    groupId,
    slug,
    summary,
    tagIds: tagValues.tagIds,
    title,
  };
}

function isActionState(value: object | PostActionState): value is PostActionState {
  return "message" in value;
}

function isPostTransition(value: string): value is PostTransition {
  return (["archive", "restore", "withdraw"] as const).some(
    (transition) => transition === value,
  );
}

function addOptionalValues<
  T extends CreateDraftArgs | UpdateContentArgs,
>(args: T, values: DraftValues) {
  if (values.groupId !== null) args.p_group_id = values.groupId;
  if (values.title !== null) args.p_title = values.title;
  if (values.slug !== null) args.p_slug = values.slug;
  if (values.summary !== null) args.p_summary = values.summary;
  args.p_body_markdown = values.bodyMarkdown;
  args.p_tag_ids = values.tagIds;
  return args;
}

type WriteErrorCopy = {
  stale: string;
  fallback: string;
};

const draftWriteErrors: WriteErrorCopy = {
  stale: "这篇草稿已在别处更新。请重新加载后再保存，避免覆盖较新的内容。",
  fallback: "草稿暂时无法保存，请稍后重试。",
};

const contentWriteErrors: WriteErrorCopy = {
  stale: "这篇文章已在别处更新。请重新加载后再保存，避免覆盖较新的内容。",
  fallback: "文章暂时无法保存，请稍后重试。",
};

const publishWriteErrors: WriteErrorCopy = {
  stale: "这篇草稿已在别处更新。请重新加载后再发布。",
  fallback: "文章暂时无法发布，请稍后重试。",
};

/**
 * Maps a conflict token to Studio copy. The tokens come from the exception
 * HINT raised by the Post RPCs (see the tokenize migration); asserting them is
 * what `supabase/tests/0008_post_conflict_tokens.test.sql` is for.
 */
function conflictCopy(token: string, kind: PostKind) {
  const options = postKindOptions[kind];

  switch (token) {
    case "post_slug_taken":
      return {
        message: "这个 Slug 已被其他文章使用。",
        fieldErrors: { slug: "请输入尚未被其他文章使用的 Slug。" },
      };
    case "tag_missing":
      return {
        message: "所选标签不存在，请重新选择。",
        fieldErrors: { tagIds: "请重新选择标签。" },
      };
    case "group_name_taken":
      return {
        message: `这个${options.groupLabel}名称已存在。`,
        fieldErrors: { groupName: `这个${options.groupLabel}名称已被使用。` },
      };
    case "group_slug_taken":
      return {
        message: `这个${options.groupLabel} Slug 已存在。`,
        fieldErrors: { groupSlug: `这个${options.groupLabel} Slug 已被使用。` },
      };
    case "group_missing":
      return {
        message: `所选${options.groupLabel}不存在，或不属于${options.singularLabel}。`,
        fieldErrors: {
          groupId: `请重新选择${options.singularLabel}${options.groupLabel}。`,
        },
      };
    default:
      return null;
  }
}

function writeErrorState(
  error: { code?: string; hint?: string } | null,
  copy: WriteErrorCopy,
  updatedAt: string | null,
  kind: PostKind,
): PostActionState {
  if (error?.code === "40001") {
    return { message: copy.stale, tone: "error", updatedAt };
  }

  const conflict = error?.hint ? conflictCopy(error.hint, kind) : null;
  if (conflict) {
    return {
      message: conflict.message,
      tone: "error",
      updatedAt,
      fieldErrors: conflict.fieldErrors,
    };
  }

  return { message: copy.fallback, tone: "error", updatedAt };
}

function invalidatePublicPostCaches(slug: string | null) {
  updateTag(POST_LIST_CACHE_TAG);
  if (slug) updateTag(postDetailCacheTag(slug));
}

export async function createPostDraft(
  kind: PostKind,
  _previousState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  await requireAdmin();

  const values = readDraftValues(formData, kind);
  if (isActionState(values)) return values;

  const args = addOptionalValues<CreateDraftArgs>(
    { p_kind: kind },
    values,
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_post_draft", args);

  if (error || !data) {
    return writeErrorState(error, draftWriteErrors, null, kind);
  }

  return {
    message: "草稿已保存。",
    tone: "success",
    updatedAt: data.updated_at,
    postId: data.id,
    saved: true,
    studioPath: `${postKindOptions[kind].studioBasePath}/${data.id}`,
  };
}

export async function updatePostContent(
  kind: PostKind,
  postId: number,
  status: "draft" | "published" | "archived",
  previousState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  await requireAdmin();

  if (!Number.isSafeInteger(postId) || postId <= 0) {
    return {
      message: "文章标识无效。",
      tone: "error",
      updatedAt: previousState.updatedAt,
    };
  }

  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt") || null;
  let values: DraftValues;
  if (status === "draft") {
    const draftValues = readDraftValues(formData, kind);
    if (isActionState(draftValues)) return draftValues;
    values = draftValues;
  } else {
    const publicValues = readPublishValues(
      formData,
      kind,
      expectedUpdatedAt,
      "save",
    );
    if (isActionState(publicValues)) return publicValues;
    values = { ...publicValues, expectedUpdatedAt };
  }

  if (!values.expectedUpdatedAt) {
    return {
      message: "缺少文章版本信息，请重新加载后再保存。",
      tone: "error",
      updatedAt: previousState.updatedAt,
    };
  }

  const args = addOptionalValues<UpdateContentArgs>(
    {
      p_post_id: postId,
      p_expected_updated_at: values.expectedUpdatedAt,
    },
    values,
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_post_content", args);

  if (error || !data) {
    return writeErrorState(
      error,
      status === "draft" ? draftWriteErrors : contentWriteErrors,
      values.expectedUpdatedAt,
      kind,
    );
  }

  if (status !== "draft") invalidatePublicPostCaches(data.slug);

  return {
    message: status === "draft" ? "草稿已保存。" : "文章修改已保存。",
    tone: "success",
    updatedAt: data.updated_at,
    saved: true,
  };
}

export async function createAndPublishPost(
  kind: PostKind,
  _previousState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  await requireAdmin();

  const options = postKindOptions[kind];
  const values = readPublishValues(formData, kind, null);
  if (isActionState(values)) return values;

  const args = {
    p_expected_kind: kind,
    p_group_id: values.groupId,
    p_title: values.title,
    p_slug: values.slug,
    p_summary: values.summary,
    p_body_markdown: values.bodyMarkdown,
    p_tag_ids: values.tagIds,
  };
  const supabase = await createClient();
  // PostgreSQL text accepts null for the optional Summary even though the
  // generated RPC Args model required parameters as non-null strings.
  const { data, error } = await supabase.rpc(
    "create_and_publish_post",
    args as unknown as CreateAndPublishArgs,
  );

  if (error || !data?.slug) {
    return writeErrorState(error, publishWriteErrors, null, kind);
  }

  invalidatePublicPostCaches(data.slug);

  return {
    message: "文章已发布，公开页面现在可以访问。",
    tone: "success",
    updatedAt: data.updated_at,
    postId: data.id,
    publishedPath: `${options.publicBasePath}/${data.slug}`,
    saved: true,
    studioPath: `${options.studioBasePath}/${data.id}`,
  };
}

export async function publishPost(
  kind: PostKind,
  postId: number,
  previousState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  await requireAdmin();

  const options = postKindOptions[kind];

  const updatedAt = readString(formData, "expectedUpdatedAt");

  if (!Number.isSafeInteger(postId) || postId <= 0) {
    return {
      message: "草稿标识无效。",
      tone: "error",
      updatedAt: previousState.updatedAt,
    };
  }

  if (!updatedAt) {
    return {
      message: "缺少草稿版本信息，请重新加载后再发布。",
      tone: "error",
      updatedAt: previousState.updatedAt,
    };
  }

  const values = readPublishValues(formData, kind, updatedAt);
  if (isActionState(values)) return values;

  const args = {
    p_post_id: postId,
    p_expected_kind: kind,
    p_expected_updated_at: updatedAt,
    p_group_id: values.groupId,
    p_new_group_name: null,
    p_new_group_slug: null,
    p_title: values.title,
    p_slug: values.slug,
    p_summary: values.summary,
    p_body_markdown: values.bodyMarkdown,
    p_tag_ids: values.tagIds,
  };
  const supabase = await createClient();
  // Generated Args treat unadorned SQL text/bigint parameters as required non-null.
  const { data, error } = await supabase.rpc(
    "publish_post",
    args as unknown as PublishPostArgs,
  );

  if (error || !data?.slug) {
    return writeErrorState(error, publishWriteErrors, updatedAt, kind);
  }

  invalidatePublicPostCaches(data.slug);
  refresh();

  const publishedPath = `${options.publicBasePath}/${data.slug}`;
  return {
    message: "文章已发布，公开页面现在可以访问。",
    tone: "success",
    updatedAt: data.updated_at,
    postId: data.id,
    publishedPath,
    saved: true,
    studioPath: `${options.studioBasePath}/${data.id}`,
  };
}

export async function transitionPost(
  kind: PostKind,
  postId: number,
  _previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  await requireAdmin();

  if (!Number.isSafeInteger(postId) || postId <= 0) {
    return { message: "文章标识无效。", tone: "error" };
  }

  const transition = readString(formData, "transition");
  if (!isPostTransition(transition)) {
    return { message: "文章状态操作无效。", tone: "error" };
  }

  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  if (!expectedUpdatedAt) {
    return { message: "缺少文章版本信息，请重新加载后再操作。", tone: "error" };
  }

  const args: TransitionPostArgs = {
    p_post_id: postId,
    p_expected_kind: kind,
    p_expected_updated_at: expectedUpdatedAt,
    p_transition: transition,
  };
  const archiveNote = optionalText(readString(formData, "archiveNote"));
  if (archiveNote !== null) args.p_archive_note = archiveNote;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_post", args);

  if (error || !data) {
    if (error?.code === "40001") {
      return {
        message: "这篇文章已在别处更新。请重新加载后再操作。",
        tone: "error",
      };
    }

    return { message: "文章状态暂时无法更新，请稍后重试。", tone: "error" };
  }

  invalidatePublicPostCaches(data.slug);
  refresh();

  const messages = {
    archive: "文章已归档，原公开地址仍可阅读。",
    restore: "文章已恢复发布。",
    withdraw: "文章已撤回为草稿，读者现在无法访问。",
  } as const satisfies Record<PostTransition, string>;

  return {
    message: messages[transition],
    tone: "success",
    updatedAt: data.updated_at,
  };
}

export async function deletePost(
  kind: PostKind,
  postId: number,
  formData: FormData,
) {
  await requireAdmin();

  if (!Number.isSafeInteger(postId) || postId <= 0) {
    throw new Error("Invalid Post identifier.");
  }

  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  if (!expectedUpdatedAt) {
    throw new Error("Missing expected Post version.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_post", {
    p_post_id: postId,
    p_expected_kind: kind,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error || !data) {
    throw new Error("Unable to hard-delete the Post.", { cause: error });
  }

  invalidatePublicPostCaches(data.slug);
  redirect(postKindOptions[kind].studioBasePath);
}
