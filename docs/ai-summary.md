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

For summary mode, success is `{ ok: true, value: { requestId, editRevision, postId?, mode: 'summary', summary } }`. Failure is `{ ok: false, error: { code, message } }`, with a fixed, sanitized message. Failures contain no partial candidate. `invalid_input` rejects malformed correlation/material; `input_too_large` reports a recognized upstream context-length error or HTTP 413; the existing configuration, authorization, provider, timeout, cancellation and invalid-response error categories remain applicable. No SDK response or reasoning escapes the interface. Usage stays in the existing sanitized model-call diagnostic, not the candidate. A successful model-call diagnostic means the protocol/text call completed; summary JSON validation can still reject that text.

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

### Studio editor

The shared Regular Post and Heartwork editor exposes **AI 生成** next to the metadata disclosure, including while the fields are collapsed. It defaults to Summary and Slug together, offers either field alone, and shows Summary only after first publication. Clicking generates from the current title and Markdown snapshot and expands the fields. A valid result replaces the selected fields directly; there is no separate candidate panel, acceptance step or AI undo/history.

Generation disables only its own button and mode selector. Editing and saving remain available. The editor advances its generation revision for every relevant input change, Markdown import/undo and recovery reset; publication invalidates any pending candidate. Late results after those changes or a change of Post identity are not applied. A brief inline message explains stale results or failures; retries are manual. The framework dispatches client Server Actions sequentially, so a save clicked during generation retains its click-time form snapshot but may wait for generation to finish before being sent.

After fields are filled, existing persistence rules apply: a saved Draft autosaves, an unsaved new Post is recovered through browser local storage, and Published/Archived Posts require manual saving. The generation action itself never writes Posts. The editor initially reads a non-sensitive availability status on the server; missing/disabled configuration leaves a settings link beside the disabled button. The link opens `/dashboard/settings#ai` in a new tab, and returning focus refreshes availability without replacing the editing state.

### Application contract

Use `applyPostGenerationResult` from `src/lib/ai/generation.ts` with an editor state containing `latestRequestId`, `editRevision`, `postId?` and both `summary` and `slug`:

1. Increment `editRevision` on **every title, body or selected target edit**, including undo/redo. Keep it monotonic for the editor lifetime. Changing Post identity also invalidates pending candidates.
2. Before dispatch, assign a fresh unique `latestRequestId` immediately and include it and the current `editRevision` in the request. A new attempt makes older candidates stale even if that attempt later fails. Do not interpret dispatch as cancellation of older work.
3. When the promise settles, apply against the **current** state (a functional state updater), not a captured render snapshot: `setEditor(current => applyPostGenerationResult(current, result))`. The helper accepts only matching latest request, edit revision and Post identity. Failure or stale success returns the unchanged state. Applied success increments the revision and clears the request ID, preventing duplicate application.
4. A summary present before dispatch can be replaced. Continue to save through the existing `createPostDraft`, `createAndPublishPost`, or `updatePostContent` action, including the existing `expectedUpdatedAt` conflict token.

Generation writes no Post, timestamp or public cache tag. Only the existing save actions persist the chosen candidate and invalidate the existing public list/detail caches. The public reader and metadata keep consuming the existing `summary` column; the Studio integration does not change public presentation.

## Capacity, protocols and time

Every generation sends the title and complete Markdown body in one model request. There is no local token estimation, character-based splitting, outline extraction, hierarchical merging, truncation, retry or provider fallback. The saved maximum output still bounds the request (up to 2,048 tokens for these fields). Provider context-limit errors and HTTP 413 produce a sanitized `input_too_large` failure; unrecognized errors remain generic provider failures. No partial candidate is returned, and the editor preserves its existing content.

The pinned `@earendil-works/pi-ai` 0.85.1 adapters receive `maxRetries: 0`, no tools and one abort signal through the existing DNS-pinned, HTTPS-only, redirect-blocking transport. Manually configured official DeepSeek connections use the Chat Completions path with thinking disabled. Custom Chat Completions, Responses and Anthropic Messages share the same prompt and JSON contract. The raw SSE envelope is bounded to 4 MiB and validated before SDK parsing: require explicit completion, reject refusal/truncation/error events and unfinished frames. This is necessary because the pinned Responses adapter merges refusal blocks into text, and the Chat adapter ignores refusal deltas. Ordinary response text still passes through the real SDK for normalized text and usage. The caller sees one atomic result.

Each model call has a 60-second deadline including transport destruction on success; the entire generation has a 180-second deadline including configuration reads and result validation. A call's timeout is also bounded by the remaining overall time. Timeout/cancellation aborts the external fetch; no later model call is scheduled if a pending configuration read eventually returns. Server-only callers may supply an `AbortSignal` as the second service argument. An AbortSignal is not serializable in a Server Action input, so the browser action relies on deadlines and stale-result rejection; closing a page does not promise remote cancellation or recovery. Socket destruction is initiated on failure without waiting past the deadline. No queue, resumability, history or business quota is added.

The four Post editor pages export `maxDuration = 200` to give the application's 180-second deadline time to return a sanitized result. The installed Next.js guide requires this configuration on the page for its Server Actions. The production Vercel plan, custom-domain CDN/proxy timeout and actual end-to-end allowance cannot be verified from this checkout; before UI rollout, confirm they allow at least 200 seconds and probe the authenticated path with a controlled delayed provider. A platform cutoff shorter than the application deadline will not yield the application's typed timeout. This is a rollout prerequisite, not a claim of deployed support.

## Verification

Earlier Studio integration verification, before the A-layout redesign (2026-09-14): TypeScript, ESLint, all 105 application tests and 191 database assertions passed. The new connection tests cover all three protocols without persistence, saved-key reuse restricted to the original target and revision, authorization, blocked destinations and sanitized failures. Browser checks at desktop and 390px widths covered settings, both new-Post editors, the Summary-only entry for a Published Post, and rejection of an unsaved localhost endpoint using a synthetic key. No real model credential or Post content was saved during browser verification. The Webpack production build passed; the default Turbopack build encountered the existing local-port `EPERM` restriction. Real-provider and live deployment timing checks remain as described below.

Application tests use the existing local Postgres database and roll back their Auth, allowlist, configuration and content changes. They use real pi-ai adapters with controlled DNS/HTTP responses and fake clocks. Tests cover all three saved-protocol workflows through connection, generation, both Post kinds, explicit save and anonymous public reading, plus stale-save rejection, configuration snapshots, refusal, truncation, invalid JSON, partial streams, credential invalidation, SSRF defenses, upstream input limits, cancellation and both deadlines. The pure result-application tests cover existing summary replacement, new edits/undo, duplicate application, Post changes and late responses after a newer failure. Existing pgTAP tests continue to cover database permissions and save conflicts. Apply pending forward migrations before verification; never reset the existing local database.

Dedicated real-provider credentials have **not been supplied**, so no real DeepSeek/Chat Completions/Responses/Anthropic generation was executed. Routine tests never consume saved production keys. For an explicit smoke test, select a saved default configuration backed by a dedicated test key, then run from a secured operator environment:

```bash
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs test <saved-model-id>
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs summary
```

The second command summarizes fixed smoke-test text through the saved default configuration without writing a Post. Repeat with each required protocol as the default; inspect `ok: true` and a nonempty single-paragraph summary, without requiring identical wording. Record provider/model, date and outcome without credentials or raw provider responses. See [AI configuration](./ai-configuration.md) for operator environment and keyring setup.

Verification for #19 on 2026-09-14: TypeScript and ESLint passed; `pnpm test` passed all 87 application tests and 191 pgTAP assertions. Independent code-review axes reported zero Standards findings and zero Spec findings. `pnpm build` encountered an environment `EPERM` when Turbopack's PostCSS worker attempted to bind a local port; the supported `pnpm exec next build --webpack` production build passed. The repository's default build command remains unchanged.


## Issue #20 deployment verification

The application remains synchronous, with a 180-second request deadline and a 60-second cap per model call. The four existing Post editor page exports remain `maxDuration = 200`, allowing 20 seconds beyond the application budget for platform response handling. No `after`, background queue or resumability is introduced. The installed Next.js `maxDuration` guide confirms page exports configure their Server Actions. [Vercel duration documentation](https://vercel.com/docs/functions/configuring-functions/duration) confirms that deployment platforms enforce the configured allowance; an export alone does not prove the live project's plan or external proxy permits it.

**The Admin has accepted the backend implementation with live deployment verification deferred.** No CDN administration connection or Vercel project configuration is available in this session; the Admin will run the production check after deployment. The repo identifies the chain as `lsyfighting.cn` → external CDN → `vercel.lsyfighting.cn` → Vercel → page Server Action. Confirm the deployed function allowance is at least 200 seconds and both CDN origin-read/idle timeout and client request timeout exceed 200 seconds. Keep authenticated Studio requests uncached and preserve cookies and forwarded origin handling. Do not shorten the application deadline to accommodate an unverified proxy.

After the removal of segmentation, each attempt makes at most one model request. A controlled deployment check should verify that a response within the 60-second model budget succeeds and that a stalled request returns the typed timeout. The 180-second outer deadline still includes authorization, configuration reads and Slug collision checks. Local tests retain both deadline checks and cancellation; the earlier multi-stage long-text timing scenario no longer applies. No production model key was used.

Verification for #20 on 2026-09-14: `pnpm test` passed 100 application tests and 191 pgTAP assertions. TypeScript and targeted ESLint passed. The default Turbopack build hit the environment's local-port `EPERM`; `pnpm exec next build --webpack` passed. Its `.next/server/functions-config-manifest.json` lists `maxDuration: 200` for `/dashboard/posts/new`, `/dashboard/posts/[id]`, `/dashboard/heartworks/new` and `/dashboard/heartworks/[id]`. No migration, database reset or production deployment was performed.
