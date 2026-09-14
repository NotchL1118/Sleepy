# On-demand Summary generation

Issue [#18](https://github.com/NotchL1118/Sleepy/issues/18) adds the summary-only backend use case. Call `generateAiSummary` from `src/server/ai/actions.ts`, or `aiService().generateSummary` from server-only code. Configuration reads and management remain in the existing AI module. Every generation authorizes the cookie-bound Admin before reading model configuration or sending material. Generation accepts no endpoint, key, permission flag, generation mode, or model override.

```ts
const result = await generateAiSummary({
  requestId: crypto.randomUUID(),
  editRevision: editor.editRevision,
  title: editor.title,
  bodyMarkdown: editor.bodyMarkdown,
  // Omit postId for unsaved content; otherwise use its existing positive numeric ID.
  postId: editor.postId,
});
```

Success is `{ ok: true, value: { requestId, editRevision, postId?, summary } }`. Failure is `{ ok: false, error: { code, message } }`, with a fixed, sanitized message. Failures contain no partial candidate. `invalid_input` rejects malformed correlation/material; `input_too_large` rejects material and instructions that cannot fit; the existing configuration, authorization, provider, timeout, cancellation and invalid-response error categories remain applicable. No SDK response or reasoning escapes the interface. Usage stays in the existing sanitized model-call diagnostic, not the candidate. A successful model-call diagnostic means the protocol/text call completed; summary JSON validation can still reject that text.

Generation captures the editing primitives before its first await, then reads one atomic default-model/settings snapshot and decrypts that snapshot's credential. A later default, key or prompt change affects later attempts. Only the title and complete Markdown body are sent as material; no saved summary, comment lookup, URL fetching, image download or tools are supplied. Post identity is correlation only: generation neither reads nor mutates a saved Post, so it supports new content and both Post kinds in all lifecycle states. The stored summary prompt sets the initial Chinese, roughly 100–200-character target; length is a style goal, not a database constraint. The result must be one JSON object with only a nonempty single-paragraph summary string.

## Applying a result

Use `applySummaryResult` from `src/lib/ai/summary.ts` with an editor state containing `latestRequestId`, `editRevision`, `postId?` and `summary`:

1. Increment `editRevision` on **every title, body or summary edit**, including undo/redo. Keep it monotonic for the editor lifetime. Changing Post identity also invalidates pending candidates.
2. Before dispatch, assign a fresh unique `latestRequestId` immediately and include it and the current `editRevision` in the request. A new attempt makes older candidates stale even if that attempt later fails. Do not interpret dispatch as cancellation of older work.
3. When the promise settles, apply against the **current** state (a functional state updater), not a captured render snapshot: `setEditor(current => applySummaryResult(current, result))`. The helper accepts only matching latest request, edit revision and Post identity. Failure or stale success returns the unchanged state. Applied success increments the revision and clears the request ID, preventing duplicate application.
4. A summary present before dispatch can be replaced. Continue to save through the existing `createPostDraft`, `createAndPublishPost`, or `updatePostContent` action, including the existing `expectedUpdatedAt` conflict token.

Generation writes no Post, timestamp or public cache tag. Only the existing save actions persist the chosen candidate and invalidate the existing public list/detail caches. The public reader and metadata keep consuming the existing `summary` column. This ticket adds no Studio controls or public presentation.

## Capacity, protocols and time

Short content uses one model request, with no model retries or provider fallback. The preflight budgets UTF-8 bytes of the exact title/body JSON plus the stored instruction and return contract, 1,024 tokens of protocol overhead, and up to 2,048 reserved output tokens (bounded by the saved model output capacity). Byte counting deliberately overestimates typical token counts for these protocols and can reject some fitting inputs. It never truncates the body. Long-text decomposition and model-specific tokenization are deferred.

The pinned `@earendil-works/pi-ai` 0.85.1 adapters receive `maxRetries: 0`, no tools and one abort signal through the existing DNS-pinned, HTTPS-only, redirect-blocking transport. The DeepSeek preset uses the same Chat Completions path with thinking disabled. Custom Chat Completions, Responses and Anthropic Messages share the same prompt and JSON contract. The raw SSE envelope is bounded to 4 MiB and validated before SDK parsing: require explicit completion, reject refusal/truncation/error events and unfinished frames. This is necessary because the pinned Responses adapter merges refusal blocks into text, and the Chat adapter ignores refusal deltas. Ordinary response text still passes through the real SDK for normalized text and usage. The caller sees one atomic result.

Each model call has a 60-second deadline including transport destruction on success; the entire generation has a 180-second deadline including configuration reads and result validation. A call's timeout is also bounded by the remaining overall time. Timeout/cancellation aborts the external fetch; no later model call is scheduled if a pending configuration read eventually returns. Server-only callers may supply an `AbortSignal` as the second service argument. An AbortSignal is not serializable in a Server Action input, so the browser action relies on deadlines and stale-result rejection; closing a page does not promise remote cancellation or recovery. Socket destruction is initiated on failure without waiting past the deadline. No queue, resumability, history or business quota is added.

The four Post editor pages export `maxDuration = 200` to give the application's 180-second deadline time to return a sanitized result. The installed Next.js guide requires this configuration on the page for its Server Actions. The production Vercel plan, custom-domain CDN/proxy timeout and actual end-to-end allowance cannot be verified from this checkout; before UI rollout, confirm they allow at least 200 seconds and probe the authenticated path with a controlled delayed provider. A platform cutoff shorter than the application deadline will not yield the application's typed timeout. This is a rollout prerequisite, not a claim of deployed support.

## Verification

Application tests use the existing local Postgres database and roll back their Auth, allowlist, configuration and content changes. They use real pi-ai adapters with controlled DNS/HTTP responses and fake clocks. Tests cover all three saved-protocol workflows through connection, generation, both Post kinds, explicit save and anonymous public reading, plus stale-save rejection, configuration snapshots, refusal, truncation, invalid JSON, partial streams, credential invalidation, SSRF defenses, capacity, cancellation and both deadlines. The pure result-application tests cover existing summary replacement, new edits/undo, duplicate application, Post changes and late responses after a newer failure. Existing pgTAP tests continue to cover database permissions and save conflicts. No migration or database reset is needed.

Dedicated real-provider credentials have **not been supplied**, so no real DeepSeek/Chat Completions/Responses/Anthropic generation was executed. Routine tests never consume saved production keys. For an explicit smoke test, select a saved default configuration backed by a dedicated test key, then run from a secured operator environment:

```bash
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs test <saved-model-id>
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs summary
```

The second command summarizes fixed smoke-test text through the saved default configuration without writing a Post. Repeat with each required protocol as the default; inspect `ok: true` and a nonempty single-paragraph summary, without requiring identical wording. Record provider/model, date and outcome without credentials or raw provider responses. See [AI configuration](./ai-configuration.md) for operator environment and keyring setup.

Verification on 2026-09-14: TypeScript and ESLint passed; `pnpm test` passed all 75 application tests and 191 pgTAP assertions. Independent code-review axes reported zero Standards findings and zero Spec findings. `pnpm build` encountered an environment `EPERM` when Turbopack's PostCSS worker attempted to bind a local port; the supported `pnpm exec next build --webpack` production build passed. The repository's default build command remains unchanged.
