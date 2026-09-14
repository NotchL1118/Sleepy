# AI configuration and connection tests

Issue [#17](https://github.com/NotchL1118/Sleepy/issues/17) implements the model configuration capability, now available in Studio at `/dashboard/settings#ai`. Post field generation is described in [ai-summary.md](./ai-summary.md). Saving configuration, saving or publishing Posts, and public page reads never call a provider automatically.

## Application interface

`src/server/ai/actions.ts` exports `saveAiModel`, `deleteAiModel`, `setDefaultAiModel`, `saveAiPreferences`, `fetchAiModels`, `testAiConnection`, `testAiModel`, `rotateAiCredentials` and `readAiCredentialVersions`. Queries in `src/server/ai/queries.ts` export `readAiConfiguration` and server-only `readAiSnapshot`. Each operation checks the cookie-bound `public.is_admin()` allowlist RPC independently, and every database RPC also checks the allowlist and retains invoker RLS. A caller cannot supply an authorization flag. `testAiConnection(id)` uses a saved configuration; `testAiModel(input)` accepts an unsaved configuration under the same authorization and target protection.

## Studio workflow

The AI section has separate connection-configuration and generation-preferences tabs. Adding, editing, testing or discovering a model never changes the active selection. Only the explicit “设为当前使用” action changes which saved connection is used.

The model form has independent **测试连接** and **保存** buttons. Testing sends the current form snapshot to `testAiModel`, without saving a model, credential or settings. It works before first save and while generation is disabled. The same protected transport, sanitized errors and 60-second call budget apply. The settings page provides `maxDuration = 80` for the call and response overhead. Saving validates configuration but does not require a successful connection test or call a provider.

When editing a saved model, leaving the key blank retains its saved key. An unsaved test can reuse that key only when the saved revision, protocol and normalized endpoint still match. Changing the protocol or address requires a freshly entered key; no stored credential is sent to a new destination. A newly entered key is used only in memory during testing and encrypted only when explicitly saved. Tests never echo the key or raw provider output to the browser.

Create a model with `{ name, protocol, endpoint, model, maxOutputTokens, apiKey }`. Update it by also supplying its returned `id` and `revision`. Stale revisions fail with `conflict`. Omit `apiKey` to retain a key, pass `null` to clear it, or pass a nonempty string to replace it. Changing protocol or normalized endpoint clears the old key, including at the database trigger boundary. A fresh key supplied with the same update binds to the new target. Ciphertexts authenticate the configuration ID, protocol and endpoint as associated data, so swapping records does not transfer credentials.

Reads return non-sensitive connection fields, `keySet`, one `defaultModelId`, global `enabled`, and the two shared prompts. A connection has one model. Selecting a connection with a saved key takes effect immediately and does not save its editor form. The global switch and both prompts save atomically through `saveAiPreferences`; editing a connection saves only that connection. Switching the viewed connection discards unsaved form changes without confirmation. Retargeting invalidates the old key and never chooses a substitute. Deleting the active connection clears its default reference in the same transaction; deletion checks the saved revision. SQL serializes all configuration mutations through the singleton settings row.

The settings page uses the selected A layout: connection list on the left, a spacious vertical form on the right, and save controls at its foot. Mobile navigation shows a list or an editor, with a back button. The separate generation-preferences tab contains the global switch and Summary/Slug instructions. Protocol and maximum output are collapsed under advanced settings. There are no provider catalogues, presets, context-capacity inputs or native selects. New connections start with empty name, address, key and model; only the protocol (Chat Completions) and maximum output (2,048) have defaults.

`readAiSnapshot()` returns `AiResult<{ model, prompts, call }>` for the default model. This is a **server-only capability**, not a serializable Server Action result. The model and prompts are fixed for that snapshot. `call({ system, text, maxOutputTokens, signal?, timeoutMs? })` returns text, usage, a success/error result and a sanitized diagnostic. The caller never sees a key, ciphertext, database record or SDK response. Snapshot calls recheck Admin authorization. A configuration change affects the next snapshot; an already acquired snapshot retains its original settings and credentials. Generation sends the full input using these captured prompts; the remote API enforces its input limit.

The original migration initialized instructions with `ON CONFLICT DO NOTHING`; the forward simplification migration removes only the obsolete outline instruction and preserves Admin edits to Summary and Slug. There are no runtime default prompts. Missing settings, prompts, default model, credentials, or invalid maximum output fail before transmission. The fixed `Return only OK` connection probe is independent of content-generation instructions.

## Pinned protocol behavior

Verified on 2026-09-14 against the published package and its source: **`@earendil-works/pi-ai@0.85.1`**, [official pi-ai repository](https://github.com/earendil-works/pi/tree/main/packages/ai). Only its three direct API adapters are imported; no coding-agent files, OAuth setup or provider fallback is used. All requests explicitly set `maxRetries: 0`, including pi-ai's retry wrapper; this version also disables the underlying SDK retry. The application passes cancellation and caps each model call at 60,000 ms, covering DNS, connection and streaming. Shorter caller budgets are accepted.

| Configuration protocol | Base endpoint example | Actual SDK request | Compatibility requirement |
| --- | --- | --- | --- |
| `openai-completions` | `https://api.openai.com/v1` | `/v1/chat/completions` | Streaming Chat Completions, text deltas and a terminal stop reason; usage is read when provided. |
| `openai-responses` | `https://api.openai.com/v1` | `/v1/responses` | Responses SSE events and a completed response; Chat-only gateways do not qualify. |
| `anthropic-messages` | `https://api.anthropic.com` | `/v1/messages?beta=true` | pi-ai 0.85.1 uses the Anthropic beta Messages client, API key header, version/beta headers and Messages SSE events. A gateway must support this exact request. Do not append `/v1` to this example. |

Endpoints are **API bases**, not full resource URLs. Query strings, credentials in URLs, fragments and full resource paths are rejected. Keys must be service API keys, not OAuth tokens. No user-defined headers or protocol plugins are accepted. Unsupported endpoint behavior produces a sanitized failure; do not strip the beta query, downgrade protocols or silently switch providers to make an incompatible service pass.

Model IDs are entered directly. Optional `fetchAiModels` uses the current address, protocol and typed or retained credential, without requiring a name or model ID and without saving anything. OpenAI-compatible protocols request `GET <base>/models`; Anthropic requests `GET <base>/v1/models?limit=100` and follows `after_id` pagination. Only model IDs are returned. A failed or empty list leaves manual entry available; discovery does not test generation support or overwrite advanced parameters. It has a 15-second overall deadline, bounded responses and pagination, no redirects or retries, and the same DNS pinning and key-binding rules as generation. A saved key is reused only with its original target and current revision.

The existing Chat Completions adapter disables thinking for the official DeepSeek endpoint to preserve its text-only behavior. This does not prefill or maintain a provider address catalogue.

The adapter accepts only complete, nonempty text with a successful terminal stop. Thinking blocks are discarded when final text exists. Truncation, tool output, reasoning-only output and raw provider errors are not usable text results. Diagnostics contain only configuration UUID, protocol, status, elapsed milliseconds, numeric HTTP status and token usage. Production emits those fields to the server log under `ai.model_call`; request text, raw errors/responses, endpoint URLs and credentials are excluded. There is no application quota, concurrency limit or automatic retry.

## Target protection

Every call validates HTTPS and the exact protocol resource, resolves the hostname, rejects the entire answer set if any address is not public unicast, then pins an approved address into a dedicated Undici connection lookup. TLS still verifies the original hostname. Numeric/alternate loopback forms, IPv4-mapped IPv6, private/link-local/metadata ranges, localhost/internal names and non-unicast addresses are rejected. The production dispatcher does not use environment proxy settings. Redirects are disabled and all 3xx responses fail. A second DNS resolution cannot substitute a private destination between checking and connecting. All response streams and dispatchers are cancelled/closed when the call completes or its budget expires.

## Deployment and key custody

1. Generate a 32-byte random master key in a secure terminal: `openssl rand -base64 32`. Store it in the deployment's server secret store and in a separately access-controlled recovery vault. Do not commit it or place it in logs or `NEXT_PUBLIC_*` variables.
2. Configure `AI_CREDENTIAL_ACTIVE_VERSION=v1` and `AI_CREDENTIAL_KEYS={"v1":"<generated-base64>"}`. Use the same versioned keyring on all application instances. This key is separate from Supabase credentials and Next's Server Action encryption key.
3. Apply pending migrations with `pnpm exec supabase migration up --local` locally. Production migrations use the project's normal deployment process; this task does not push them remotely. Preserve Auth users, the Admin allowlist and Posts. The new tables are in unexposed `private`; do not expose that schema through the Data API.
4. Configure models through the Admin application interface. Only encrypted API keys reach storage. Database backups and the master-key recovery vault must remain separately protected. Losing every copy of a referenced master key requires re-entering the affected provider credentials; neither the application nor a backup can recover their plaintext alone.
5. Deploy on a Node runtime with outbound HTTPS/DNS and a request duration that accommodates the 60-second model call plus authentication/database overhead. For later 180-second generation, verify the complete hosting/CDN/function path before enabling it; this issue makes no claim that the existing host already supports that longer request.

## Executable rotation procedure

The operator CLI uses the same service and a transaction, and prints only sanitized results. Install dev dependencies for this maintenance environment (`postgres` is a dev dependency). Supply a PostgreSQL connection that can `SET ROLE authenticated`, and the UUID already present in `private.site_admins`; it cannot bootstrap or promote an Admin. Put these operator-only values in a secured, uncommitted environment file:

```dotenv
AI_MAINTENANCE_DATABASE_URL=postgresql://<operator>:<password>@<database>:5432/postgres
AI_MAINTENANCE_ADMIN_ID=<existing-admin-uuid>
AI_CREDENTIAL_ACTIVE_VERSION=v2
AI_CREDENTIAL_KEYS={"v1":"<existing-key>","v2":"<new-random-key>"}
```

1. Back up the encrypted database and the recovery keyring separately. Generate `v2` with `openssl rand -base64 32`.
2. Add both versions to **all** instances, then switch every instance's active version to `v2`. Drain/restart old instances and old in-flight writes before retiring `v1`.
3. Inspect references, re-encrypt, and inspect again:

```bash
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs versions
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs rotate
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs versions
```

Rotation includes all connections, including inactive ones. Each write uses the saved revision and existing target; the CLI transaction rolls back the whole operation on errors or concurrent changes. The Server Action version may complete earlier model updates before a later conflict; it is safe to retry with both keys retained. An already-current ciphertext is still decrypted to verify the configured key. After rotation, run dedicated connection tests for the required models.

4. **Do not remove an old key while `versions` reports any reference to it**, while an old deployment can still write with it, or while an in-flight snapshot needs it. Keep old keys in the recovery vault for retained historical backups even after removing them from the live environment. Only retire a live key after all those conditions are resolved. Never reuse a version label with different key bytes.

## Verification and real provider smoke tests

Routine verification uses local Postgres transactions and controlled external DNS/HTTP responses. All three **real pi-ai adapters** build and parse protocol requests; only the external transport and necessary clock are replaced. It tests saved credential round trips, authorization, key isolation, target invalidation, DNS rebinding defenses, redirects, failures without retries, cancellation, exact timeout cap, prompt snapshots and rotation. No routine test reads a production API key or sends a request to a real provider. Application tests intentionally use the fixed existing local test database at port 54322, never an environment-selected remote database, and roll back their Auth/allowlist/configuration changes.

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

Before shipping a provider integration, use a **dedicated test credential** and a saved configuration for each protocol. From a secured operator environment with the same master keyring and existing Admin UUID, explicitly run:

```bash
node --env-file=<secured-env-file> scripts/ai-maintenance.mjs test <saved-model-id>
```

This reads and decrypts the saved credential and performs one minimal real request. Expect `ok: true`, `diagnostic.status: success` and usage if the service returns it. On failure, verify the exact base URL, protocol, model and output limit with that provider; retry manually after correcting the configuration. These real provider calls are not part of `pnpm test` and have not been run without explicitly supplied dedicated test credentials.


For generation modes and the editor application contract, see [Post field generation](./ai-summary.md).

## A-layout implementation verification (2026-09-14)

The prototype HTML has been removed. The forward migration was applied to the existing local database; a before/after comparison confirmed preservation of Auth users, the Admin allowlist, Posts, remaining connection fields and the two retained prompts. The application suite passed 105 tests and pgTAP passed 202 assertions. TypeScript, ESLint and the Webpack production build passed. The default Turbopack build hit the local environment’s port-binding permission restriction.

The three-layout prototype had been checked at desktop and mobile widths before A was selected. The production settings page still requires an authenticated browser smoke check: the browser was signed out, and automatic approval review rejected initiating GitHub sign-in without explicit authorization. No login bypass, fixture user or production model request was introduced.
