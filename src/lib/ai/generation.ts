import type { AiPostGenerationFields, AiPostGenerationMode, AiPostGenerationResult } from './types';
import { isValidSlug } from '../posts/slug';

/** Shared validation keeps the server response and atomic editor application in agreement. */
export function validateGeneratedFields(mode: AiPostGenerationMode, value: unknown): AiPostGenerationFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const keys = mode === 'both' ? ['summary', 'slug'] : [mode];
  if (!['summary', 'slug', 'both'].includes(mode) || Object.keys(fields).length !== keys.length ||
    keys.some(key => typeof fields[key] !== 'string')) return null;
  const summary = typeof fields.summary === 'string' ? fields.summary.trim() : '';
  if (mode !== 'slug' && (!summary || /[\x00-\x1f\x7f\u2028\u2029]/.test(summary) ||
    /<\/?(?:think|analysis|reasoning)\b|```/i.test(summary) || /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/.test(summary))) return null;
  if (mode !== 'summary' && (typeof fields.slug !== 'string' || !isValidSlug(fields.slug))) return null;
  if (mode === 'summary') return { mode, summary };
  if (mode === 'slug') return { mode, slug: fields.slug as string };
  return { mode, summary, slug: fields.slug as string };
}

export type PostGenerationApplicationState = {
  /** Set immediately when starting an attempt; never reuse a request ID. */
  latestRequestId: string | null;
  /** Increment on every title, body or selected target edit, including undo/redo. */
  editRevision: number;
  postId?: number;
  summary: string;
  slug: string;
};

/** Return the same state for failures/stale results, without assuming older work stopped. */
export function applyPostGenerationResult<T extends PostGenerationApplicationState>(current: T, result: AiPostGenerationResult): T {
  if (!result.ok || current.latestRequestId !== result.value.requestId ||
    current.editRevision !== result.value.editRevision || current.postId !== result.value.postId) return current;
  const { mode } = result.value;
  const values = Object.fromEntries(Object.entries(result.value).filter(([key]) =>
    !['mode', 'requestId', 'editRevision', 'postId'].includes(key)));
  const fields = validateGeneratedFields(mode, values);
  if (!fields) return current;
  const patch = fields.mode === 'summary' ? { summary: fields.summary } : fields.mode === 'slug' ? { slug: fields.slug } :
    { summary: fields.summary, slug: fields.slug };
  return { ...current, ...patch, editRevision: current.editRevision + 1, latestRequestId: null };
}
