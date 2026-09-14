# On-demand Post field generation

Issues [#18](https://github.com/NotchL1118/Sleepy/issues/18), [#19](https://github.com/NotchL1118/Sleepy/issues/19) and [#20](https://github.com/NotchL1118/Sleepy/issues/20) provide on-demand Summary and Slug candidates. Call `generateAiPostFields` from `src/server/ai/actions.ts`, or `aiService().generatePostFields` from server-only code. Configuration reads and management remain in the existing AI module. Every generation authorizes the cookie-bound Admin before reading model configuration or sending material. Generation accepts no endpoint, key, permission flag or model override.

```ts
const result = await generateAiPostFields({
  mode: 'summary', // Omit to use the server-derived default.
  requestId: crypto.randomUUID(),
  editRevision: editor.editRevision,
  title: editor.title,
  bodyMarkdown: editor.bodyMarkdown,
  // Omit postId for unsaved content; otherwise use its existing positive numeric ID.
  postId: editor.postId,
});
```

For summary mode, success is `{ ok: true, value: { requestId, editRevision, postId?, mode: 'summary', summary } }`. Failure is `{ ok: false, error: { code, message } }`, with a fixed, sanitized message. Failures contain no partial candidate. `invalid_input` rejects malformed correlation/material; `input_too_large` rejects a title, instructions or minimum fragment that cannot fit; `non_convergent` rejects outlines that cannot be reduced safely; the existing configuration, authorization, provider, timeout, cancellation and invalid-response error categories remain applicable. No SDK response or reasoning escapes the interface. Usage stays in the existing sanitized model-call diagnostic, not the candidate. A successful model-call diagnostic means the protocol/text call completed; summary JSON validation can still reject that text.

Generation captures the editing primitives before its first await, then reads one atomic default-model/settings snapshot and decrypts that snapshot's credential. A later default, key or prompt change affects later attempts. Only the title and complete Markdown body are sent as material; no saved summary, comment lookup, URL fetching, image download or tools are supplied. Generation reads saved Post publication history to determine the allowed modes, but never mutates a Post. Both Post kinds use the same contract. The stored summary prompt sets the initial Chinese, roughly 100–200-character target; length is a style goal, not a database constraint. The result must be one JSON object containing exactly the selected fields, with a nonempty single-paragraph summary string when selected.

## Modes, Slug checks and saving

Issue #19 extends the summary-only backend into `generateAiPostFields(input)` in
`src/server/ai/actions.ts`. Its application boundary is
`createAiService(...).generatePostFields(input, signal?)`. It accepts the current
`title`, full `bodyMarkdown`, a unique `requestId`, an `editRevision`, an optional
saved `postId`, and optional `mode: 'summary' | 'slug' | 'both'`.

Use `readAiPostGenerationOptions(postId?)` to obtain available modes and the
default. Unsaved Posts and saved Posts with no first publication default to
`both`. A saved Post with `published_at` set permits only `summary`, even after
archival or withdrawal to draft. Generation rereads this history on the server;
client status and editability flags grant no capability. Unknown Post IDs fail.

The selected stored instructions are combined into the final model call. Success
returns the request correlation fields, resolved `mode`, and only the selected
`summary` and/or `slug`. Missing instructions, incomplete protocol output, empty
or invalid selected fields fail the entire attempt. Slugs reuse the Post format
validator. A collision with any other Post, regardless of kind or status, is
resolved by checking `-2`, `-3`, and subsequent numeric suffixes without another
model call. These lookups do not reserve addresses or write Posts.

Pass the result to `applyPostGenerationResult(current, result)` from
`src/lib/ai/generation.ts`. The state contains both editing fields, the current
`postId`, `editRevision`, and `latestRequestId`. Set a fresh request ID immediately
on every attempt. Advance the revision on every title, body, or selected target
edit, including undo/redo, and invalidate the request when its field selection
changes. The helper discards failures and mismatched attempts unchanged, replaces
only the selected fields on success, advances the revision and consumes the
request ID. Both fields must be valid before either can change; existing text
may be replaced. No editor control is introduced in this issue.

Candidates persist only through the existing Post save action. The database
still rejects a competing save that claims the Slug first, stale editing
revisions, and changes to a previously published Slug. Generation never
invalidates public caches. The existing 60-second model-call and 180-second
overall deadlines include the new reads and collision checks; there is no
automatic retry, fallback, history or auto-save.

## Applying a result

Use `applyPostGenerationResult` from `src/lib/ai/generation.ts` with an editor state containing `latestRequestId`, `editRevision`, `postId?` and both `summary` and `slug`:

1. Increment `editRevision` on **every title, body or selected target edit**, including undo/redo. Keep it monotonic for the editor lifetime. Changing Post identity also invalidates pending candidates.
2. Before dispatch, assign a fresh unique `latestRequestId` immediately and include it and the current `editRevision` in the request. A new attempt makes older candidates stale even if that attempt later fails. Do not interpret dispatch as cancellation of older work.
3. When the promise settles, apply against the **current** state (a functional state updater), not a captured render snapshot: `setEditor(current => applyPostGenerationResult(current, result))`. The helper accepts only matching latest request, edit revision and Post identity. Failure or stale success returns the unchanged state. Applied success increments the revision and clears the request ID, preventing duplicate application.
4. A summary present before dispatch can be replaced. Continue to save through the existing `createPostDraft`, `createAndPublishPost`, or `updatePostContent` action, including the existing `expectedUpdatedAt` conflict token.

Generation writes no Post, timestamp or public cache tag. Only the existing save actions persist the chosen candidate and invalidate the existing public list/detail caches. The public reader and metadata keep consuming the existing `summary` column. This ticket adds no Studio controls or public presentation.

## Capacity, protocols and time

Short content uses one model request, with no model retries or provider fallback. The preflight budgets UTF-8 bytes of the exact title/body JSON plus the stored instruction and return contract, 1,024 tokens of protocol overhead, and up to 2,048 reserved output tokens (bounded by the saved model output capacity). Byte counting deliberately overestimates typical token counts for these protocols and can split some fitting inputs. It never truncates the body. The same calculation checks every intermediate and final request.

Long content uses the stored outline instruction from the initial snapshot. Markdown is parsed for top-level block boundaries, then sliced by original offsets, preserving whitespace and code exactly. Sections retain their heading path; oversized headings use source offsets instead of duplicating their text in metadata. Full blocks are packed when possible; oversized paragraphs and code blocks are split at Unicode-safe boundaries. Intermediate requests contain the title, section context and fragment; no links or images are fetched.

Each extraction returns exactly `{ "outline": "nonempty text" }`. Outlines retain source order. If they do not fit the final request, consecutive groups are reduced again with the same outline instruction. Every level must reduce serialized material bytes by at least 10%; expansion, negligible progress or an individual outline that cannot fit a merge request fails with `non_convergent`. There is no truncation, retry or partial success. Output reserves are capacity limits, not a forced 100–200-character intermediate summary. Only the final request uses the selected summary/slug instructions and validates the original candidate contract. Slug-only generation also processes the entire body.

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

Verification for #19 on 2026-09-14: TypeScript and ESLint passed; `pnpm test` passed all 87 application tests and 191 pgTAP assertions. Independent code-review axes reported zero Standards findings and zero Spec findings. `pnpm build` encountered an environment `EPERM` when Turbopack's PostCSS worker attempted to bind a local port; the supported `pnpm exec next build --webpack` production build passed. The repository's default build command remains unchanged.


## Issue #20 deployment verification and blockers

The application remains synchronous, with a 180-second request deadline and a 60-second cap per model call. The four existing Post editor page exports remain `maxDuration = 200`, allowing 20 seconds beyond the application budget for platform response handling. No `after`, background queue or resumability is introduced. The installed Next.js `maxDuration` guide confirms page exports configure their Server Actions. [Vercel duration documentation](https://vercel.com/docs/functions/configuring-functions/duration) confirms that deployment platforms enforce the configured allowance; an export alone does not prove the live project's plan or external proxy permits it.

**Live rollout is blocked pending deployment access and an end-to-end delayed-provider check.** No CDN administration connection or Vercel project configuration is available in this session. The repo identifies the chain as `lsyfighting.cn` → external CDN → `vercel.lsyfighting.cn` → Vercel → page Server Action. Confirm the deployed function allowance is at least 200 seconds and both CDN origin-read/idle timeout and client request timeout exceed 200 seconds. Keep authenticated Studio requests uncached and preserve cookies and forwarded origin handling. Do not shorten the application deadline to accommodate an unverified proxy.

Before rollout, use a dedicated controlled HTTPS model endpoint with the existing SSRF protections and a dedicated test key. On an authenticated deployed editor action, return valid intermediate responses after 50 seconds per call: verify a final result near 170 seconds succeeds through the canonical CDN hostname, then hold the last response across 180 seconds and verify a typed `timeout`, with no later model request. Also cancel a server-only call and check its transport receives abort. Repeat against the Vercel origin where authentication permits to distinguish proxy and function cutoffs. Record wall-clock duration, HTTP status and sanitized error code, without material or credentials. No temporary public probe route or production configuration change was introduced.

Controlled application tests exercise the same three protocols using the real SDK adapters and fake timers: successful sequential calls advance to 150 seconds, the remaining active call aborts at 180 seconds, and late responses schedule no further calls. These verify application behavior, **not** the live CDN allowance. Dedicated real-provider test credentials were not supplied; no production model key was used.

Verification for #20 on 2026-09-14: `pnpm test` passed 100 application tests and 191 pgTAP assertions. TypeScript and targeted ESLint passed. The default Turbopack build hit the environment's local-port `EPERM`; `pnpm exec next build --webpack` passed. Its `.next/server/functions-config-manifest.json` lists `maxDuration: 200` for `/dashboard/posts/new`, `/dashboard/posts/[id]`, `/dashboard/heartworks/new` and `/dashboard/heartworks/[id]`. No migration, database reset or production deployment was performed.
