import assert from 'node:assert/strict';
import test from 'node:test';
import { applySummaryResult } from './summary.ts';

const current = { latestRequestId: 'new', editRevision: 3, postId: 42, summary: '请求前已有摘要' };
const success = { ok: true, value: { requestId: 'new', editRevision: 3, postId: 42, summary: '生成的候选' } };

test('the latest successful candidate may replace a pre-existing summary once', () => {
  const applied = applySummaryResult(current, success);
  assert.equal(applied.summary, '生成的候选');
  assert.equal(applied.editRevision, 4);
  assert.equal(applied.latestRequestId, null);
  assert.equal(applySummaryResult(applied, success), applied);
});

test('failures, older attempts and edits (including undo) preserve the current summary', () => {
  const failure = { ok: false, error: { code: 'timeout', message: '超时' } };
  for (const result of [failure, { ...success, value: { ...success.value, requestId: 'old' } }]) {
    assert.equal(applySummaryResult(current, result), current);
  }
  // The editor advances its revision on every title, body, or summary edit, including undo.
  for (const editRevision of [4, 5, 6]) {
    const edited = { ...current, editRevision };
    assert.equal(applySummaryResult(edited, success), edited);
  }
  const otherPost = { ...current, postId: 43 };
  assert.equal(applySummaryResult(otherPost, success), otherPost);
  // Sending a newer attempt invalidates old success, even if the newer attempt fails.
  const newer = { ...current, latestRequestId: 'newer' };
  assert.equal(applySummaryResult(newer, failure), newer);
  assert.equal(applySummaryResult(newer, success), newer);
});
