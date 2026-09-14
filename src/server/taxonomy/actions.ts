"use server";

import { refresh, updateTag as expireCacheTag } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { createClient } from "@/utils/supabase/server";
import { isValidSlug } from "@/lib/posts/slug";
import type { PostKind } from "@/lib/posts/types";
import { validateTagName } from "@/lib/taxonomy";
import {
  POST_LIST_CACHE_TAG,
  postDetailCacheTag,
} from "@/server/posts/public-posts";

export type TaxonomyField = "description" | "name" | "slug";

export type TaxonomyActionState = {
  message: string | null;
  tone: "error" | "success" | null;
  fieldErrors?: Partial<Record<TaxonomyField, string>>;
  created?: { id: number; name: string; slug?: string };
};

export type TaxonomyDeleteState = {
  message: string | null;
  tone: "error" | "success" | null;
  deletedId?: number;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readId(formData: FormData, key: string) {
  const value = Number(readString(formData, key));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function conflictState(
  error: { code?: string; hint?: string } | null,
  labels: { singular: string },
): TaxonomyActionState {
  if (error?.code === "40001") {
    return {
      message: `这个${labels.singular}已在其他页面修改，请关闭弹窗并重试。`,
      tone: "error",
    };
  }

  switch (error?.hint) {
    case "group_name_taken":
    case "tag_name_taken":
      return {
        message: `这个${labels.singular}名称已存在。`,
        tone: "error",
        fieldErrors: { name: "请输入尚未使用的名称。" },
      };
    case "group_slug_taken":
      return {
        message: `这个${labels.singular} Slug 已存在。`,
        tone: "error",
        fieldErrors: { slug: "请输入尚未使用的 Slug。" },
      };
    case "group_missing":
    case "tag_missing":
      return {
        message: `这个${labels.singular}已不存在，请刷新列表。`,
        tone: "error",
      };
    default:
      return {
        message: `${labels.singular}暂时无法保存，请稍后重试。`,
        tone: "error",
      };
  }
}

async function publicSlugsForGroup(groupId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("slug")
    .eq("group_id", groupId)
    .in("status", ["published", "archived"])
    .not("slug", "is", null);

  if (error) throw new Error("Unable to resolve affected Posts.", { cause: error });
  return data.flatMap((post) => (post.slug ? [post.slug] : []));
}

async function publicSlugsForTag(tagId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_tags")
    .select("posts!inner(slug, status)")
    .eq("tag_id", tagId)
    .in("posts.status", ["published", "archived"]);

  if (error) throw new Error("Unable to resolve affected tagged Posts.", { cause: error });
  return data.flatMap((postTag) =>
    postTag.posts.slug ? [postTag.posts.slug] : [],
  );
}

function invalidateDetails(slugs: readonly string[]) {
  for (const slug of new Set(slugs)) expireCacheTag(postDetailCacheTag(slug));
}

function validateGroupValues(
  formData: FormData,
  labels: { singular: string },
  editing: boolean,
) {
  const name = readString(formData, "name").trim();
  const slug = readString(formData, "slug").trim();
  const fieldErrors: Partial<Record<TaxonomyField, string>> = {};

  if (!name) fieldErrors.name = `请输入${labels.singular}名称。`;
  if (!editing && !isValidSlug(slug)) {
    fieldErrors.slug = "Slug 只能使用小写字母、数字和单个连字符。";
  }

  return { name, slug, fieldErrors };
}

export async function savePostGroup(
  kind: PostKind,
  previousState: TaxonomyActionState,
  formData: FormData,
): Promise<TaxonomyActionState> {
  await requireAdmin();

  const labels = { singular: kind === "regular" ? "分类" : "专栏" };
  const id = readId(formData, "id");
  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  const { name, slug, fieldErrors } = validateGroupValues(formData, labels, id !== null);
  const description = readString(formData, "description").trim() || null;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "请修正标出的字段后再保存。",
      tone: "error",
      fieldErrors,
    };
  }

  if (id !== null && !expectedUpdatedAt) {
    return { message: "缺少版本信息，请刷新后重试。", tone: "error" };
  }

  const affectedSlugs = id === null ? [] : await publicSlugsForGroup(id);
  const supabase = await createClient();
  const result = id === null
    ? await supabase.rpc("create_post_group", {
        p_kind: kind,
        p_name: name,
        p_slug: slug,
        p_description: description ?? "",
      })
    : await supabase.rpc("update_post_group", {
        p_group_id: id,
        p_expected_updated_at: expectedUpdatedAt,
        p_name: name,
        p_description: description ?? "",
      });

  if (result.error || !result.data) {
    return conflictState(result.error, labels);
  }

  expireCacheTag(POST_LIST_CACHE_TAG);
  if (id !== null) {
    invalidateDetails(affectedSlugs);
  }
  refresh();

  return {
    message: id === null ? `${labels.singular}已创建。` : `${labels.singular}已更新。`,
    tone: "success",
    created: id === null
      ? { id: result.data.id, name: result.data.name, slug: result.data.slug }
      : undefined,
  };
}

export async function saveTag(
  previousState: TaxonomyActionState,
  formData: FormData,
): Promise<TaxonomyActionState> {
  await requireAdmin();

  const labels = { singular: "标签" };
  const id = readId(formData, "id");
  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  const { name, error } = validateTagName(readString(formData, "name"));
  const fieldErrors: Partial<Record<TaxonomyField, string>> = {};
  if (error) fieldErrors.name = error;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "请修正标出的字段后再保存。",
      tone: "error",
      fieldErrors,
    };
  }

  if (id !== null && !expectedUpdatedAt) {
    return { message: "缺少版本信息，请刷新后重试。", tone: "error" };
  }

  const affectedSlugs = id === null ? [] : await publicSlugsForTag(id);
  const supabase = await createClient();
  const result = id === null
    ? await supabase.rpc("create_tag", { p_name: name })
    : await supabase.rpc("update_tag", {
        p_tag_id: id,
        p_expected_updated_at: expectedUpdatedAt,
        p_name: name,
      });

  if (result.error || !result.data) {
    return conflictState(result.error, labels);
  }

  if (id !== null) invalidateDetails(affectedSlugs);
  refresh();

  return {
    message: id === null ? "标签已创建。" : "标签已更新。",
    tone: "success",
    created: id === null
      ? { id: result.data.id, name: result.data.name }
      : undefined,
  };
}

export async function deletePostGroup(
  kind: PostKind,
  _previousState: TaxonomyDeleteState,
  formData: FormData,
): Promise<TaxonomyDeleteState> {
  await requireAdmin();

  const label = kind === "regular" ? "分类" : "专栏";
  const id = readId(formData, "id");
  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  if (id === null || !expectedUpdatedAt) {
    return { message: `${label}版本信息无效，请刷新后重试。`, tone: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_post_group", {
    p_group_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) {
    if (error.hint === "group_in_use") {
      return { message: `这个${label}仍被文章引用，不能删除。`, tone: "error" };
    }
    if (error.code === "40001") {
      return { message: `这个${label}已被修改，请刷新后重试。`, tone: "error" };
    }
    return { message: `${label}暂时无法删除，请稍后重试。`, tone: "error" };
  }

  expireCacheTag(POST_LIST_CACHE_TAG);
  refresh();
  return { message: `${label}已永久删除。`, tone: "success", deletedId: id };
}

export async function deleteTag(
  _previousState: TaxonomyDeleteState,
  formData: FormData,
): Promise<TaxonomyDeleteState> {
  await requireAdmin();

  const id = readId(formData, "id");
  const expectedUpdatedAt = readString(formData, "expectedUpdatedAt");
  if (id === null || !expectedUpdatedAt) {
    return { message: "标签版本信息无效，请刷新后重试。", tone: "error" };
  }

  const affectedSlugs = await publicSlugsForTag(id);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_tag", {
    p_tag_id: id,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) {
    if (error.code === "40001") {
      return { message: "这个标签已被修改，请刷新后重试。", tone: "error" };
    }
    return { message: "标签暂时无法删除，请稍后重试。", tone: "error" };
  }

  invalidateDetails(affectedSlugs);
  refresh();
  return { message: "标签已删除，文章关联已解除。", tone: "success", deletedId: id };
}
