import type { AiSummaryResult } from './types';

export type SummaryApplicationState = {
  /** Set immediately when starting an attempt; never reuse a request ID. */
  latestRequestId: string | null;
  /** Increment on every title, body or summary edit, including undo/redo. */
  editRevision: number;
  postId?: number;
  summary: string;
};

/** Return the same state for failures/stale results, without assuming older work stopped. */
export function applySummaryResult<T extends SummaryApplicationState>(current: T, result: AiSummaryResult): T {
  if (!result.ok || current.latestRequestId !== result.value.requestId ||
    current.editRevision !== result.value.editRevision || current.postId !== result.value.postId) return current;
  return { ...current, summary: result.value.summary, editRevision: current.editRevision + 1, latestRequestId: null };
}
