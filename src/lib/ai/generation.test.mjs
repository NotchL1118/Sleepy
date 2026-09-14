import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/src/lib/ai/generation.ts') && specifier === '../posts/slug') return nextResolve('../posts/slug.ts', context);
  return nextResolve(specifier, context);
}});
const { applyPostGenerationResult } = await import('./generation.ts');

const current = { latestRequestId: 'new', editRevision: 3, postId: 42, summary: '请求前已有摘要', slug: 'existing-slug' };
const success = { ok: true, value: { requestId: 'new', editRevision: 3, postId: 42, mode: 'summary', summary: '生成的候选' } };

test('the latest successful candidate may replace a pre-existing summary once', () => {
  const applied = applyPostGenerationResult(current, success);
  assert.equal(applied.summary, '生成的候选');
  assert.equal(applied.editRevision, 4);
  assert.equal(applied.latestRequestId, null);
  assert.equal(applyPostGenerationResult(applied, success), applied);
});

test('failures, older attempts and edits (including undo) preserve the current summary', () => {
  const failure = { ok: false, error: { code: 'timeout', message: '超时' } };
  for (const result of [failure, { ...success, value: { ...success.value, requestId: 'old' } }]) {
    assert.equal(applyPostGenerationResult(current, result), current);
  }
  // The editor advances its revision on every title, body, or summary edit, including undo.
  for (const editRevision of [4, 5, 6]) {
    const edited = { ...current, editRevision };
    assert.equal(applyPostGenerationResult(edited, success), edited);
  }
  const otherPost = { ...current, postId: 43 };
  assert.equal(applyPostGenerationResult(otherPost, success), otherPost);
  // Sending a newer attempt invalidates old success, even if the newer attempt fails.
  const newer = { ...current, latestRequestId: 'newer' };
  assert.equal(applyPostGenerationResult(newer, failure), newer);
  assert.equal(applyPostGenerationResult(newer, success), newer);
});

for (const mode of ['summary', 'slug', 'both']) {
  test(`${mode} replaces only selected existing fields and discards any stale attempt atomically`, () => {
    const fields = mode === 'summary' ? { summary: '新摘要' } : mode === 'slug' ? { slug: 'new-post-slug' } :
      { summary: '新摘要', slug: 'new-post-slug' };
    const result = { ok: true, value: { requestId: 'new', editRevision: 3, postId: 42, mode, ...fields } };
    const applied = applyPostGenerationResult(current, result);
    assert.equal(applied.summary, mode === 'slug' ? current.summary : '新摘要');
    assert.equal(applied.slug, mode === 'summary' ? current.slug : 'new-post-slug');
    for (const changed of ['title', 'bodyMarkdown', ...(mode === 'both' ? ['summary', 'slug'] : [mode])]) {
      const edited = { ...current, [changed]: 'edited', editRevision: 4 };
      assert.equal(applyPostGenerationResult(edited, result), edited);
    }
    const newer = { ...current, latestRequestId: 'newer' };
    assert.equal(applyPostGenerationResult(newer, result), newer);
    assert.equal(applyPostGenerationResult(applied, result), applied);
  });
}

test('a partially invalid combined candidate never changes either editing field', () => {
  for (const fields of [{ summary: '', slug: 'valid-slug' }, { summary: '有效摘要', slug: 'Bad_Slug' }, { summary: '缺少地址' }]) {
    assert.equal(applyPostGenerationResult(current, { ok: true, value: {
      requestId: 'new', editRevision: 3, postId: 42, mode: 'both', ...fields,
    } }), current);
  }
});
