import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import postgres from 'postgres';
import tls from 'node:tls';

// Supply the server condition and TS resolution for this Node-only application test.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if (context.parentURL?.includes('/src/server/ai/') && specifier.startsWith('./') && !specifier.endsWith('.ts')) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}});
const { createAiService } = await import('./service.ts');
const db = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres', { max: 1 });
const admin = '99999999-9999-4999-8999-999999999917';
const keyring = { activeVersion: 'v1', keys: { v1: Buffer.alloc(32, 17).toString('base64') } };

async function fixture(run) {
  const rollback = new Error('rollback fixture');
  try {
    await db.begin(async sql => {
      // Isolate existing Admin configuration only inside this rollback transaction.
      await sql`update private.ai_settings set default_model_id = null, enabled = true`;
      await sql`delete from private.ai_models`;
      await sql`delete from private.site_admins`;
      await sql`insert into auth.users(id, email) values (${admin}, 'ai-admin@example.test')`;
      await sql`insert into private.site_admins(user_id) values (${admin})`;
      await sql`set local role authenticated`;
      await sql`select set_config('request.jwt.claim.sub', ${admin}, true)`;
      const rpc = async (name, args = {}) => {
        assert.match(name, /^(is_admin|ai_[a-z_]+)$/);
        const keys = Object.keys(args);
        keys.forEach(key => assert.match(key, /^p_[a-z_]+$/));
        try {
          const rows = await sql.savepoint(tx => tx.unsafe(
            `select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) as data`,
            Object.values(args),
          ));
          return { data: rows[0].data, error: null };
        } catch (error) { return { data: null, error: { code: error.code } }; }
      };
      await run({ sql, rpc, service: createAiService({ rpc, keyring: () => keyring }) });
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
test.after(() => db.end());
const model = { name: 'Test model', protocol: 'openai-completions', endpoint: 'https://model.example/v1', model: 'test-model', contextWindow: 8192, maxOutputTokens: 512, enabled: true };

test('Admin saves multiple models and reads only credential status after persistence', () => fixture(async ({ service }) => {
  const first = await service.saveModel({ ...model, apiKey: 'test-secret-one' });
  assert.equal(first.ok, true, JSON.stringify(first));
  const second = await service.saveModel({ ...model, name: 'Second', apiKey: 'test-secret-two' });
  assert.equal(second.ok, true);
  const read = await service.readConfiguration();
  assert.equal(read.ok, true);
  assert.equal(read.value.models.find(m => m.id === first.value).keySet, true);
  assert.equal(JSON.stringify(read).includes('test-secret'), false);
  assert.equal(JSON.stringify(read).includes('credential'), false);
  assert.equal((await service.setDefaultModel(first.value)).ok, true);
  assert.equal((await service.setDefaultModel(second.value)).ok, true);
  assert.equal((await service.readConfiguration()).value.defaultModelId, second.value);
}));

const sse = data => `data: ${JSON.stringify(data)}\n\n`;
function responseFor(protocol) {
  if (protocol === 'openai-completions') return new Response(
    sse({ id: 'chat-test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }] }) +
    sse({ id: 'chat-test', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 } }) + 'data: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } });
  if (protocol === 'openai-responses') return new Response([
    { type: 'response.created', response: { id: 'resp_test', model: 'test-model', status: 'in_progress', output: [] } },
    { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_test', role: 'assistant', content: [], status: 'in_progress' } },
    { type: 'response.content_part.added', item_id: 'msg_test', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
    { type: 'response.output_text.delta', item_id: 'msg_test', output_index: 0, content_index: 0, delta: 'OK' },
    { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_test', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'OK', annotations: [] }] } },
    { type: 'response.completed', response: { id: 'resp_test', status: 'completed', output: [], usage: { input_tokens: 8, output_tokens: 1, total_tokens: 9 } } },
  ].map(sse).join(''), { headers: { 'content-type': 'text/event-stream' } });
  return new Response([
    { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', content: [], model: 'test-model', stop_reason: null, usage: { input_tokens: 8, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ].map(event => `event: ${event.type}\n${sse(event)}`).join(''), { headers: { 'content-type': 'text/event-stream' } });
}
for (const protocol of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
  test(`Admin connection test decrypts persisted credentials and makes a real ${protocol} SDK request`, () => fixture(async ({ rpc }) => {
    const requests = [];
    const service = createAiService({ rpc, keyring: () => keyring, network: {
      resolve: async () => [{ address: '93.184.216.34', family: 4 }],
      fetch: async (url, options) => { requests.push({ url, options }); return responseFor(protocol); },
    } });
    const saved = await service.saveModel({ ...model, protocol, apiKey: 'dedicated-test-key' });
    assert.equal(saved.ok, true);
    const connected = await service.testConnection(saved.value);
    assert.equal(connected.ok, true, JSON.stringify(connected));
    assert.equal(requests.length, 1);
    assert.equal(new Headers(requests[0].options.headers).get(protocol === 'anthropic-messages' ? 'x-api-key' : 'authorization'), protocol === 'anthropic-messages' ? 'dedicated-test-key' : 'Bearer dedicated-test-key');
    assert.equal(requests[0].options.body.includes('dedicated-test-key'), false);
    assert.equal(connected.value.usage.outputTokens, 1);
    assert.equal(JSON.stringify(connected).includes('dedicated-test-key'), false);
  }));
}

test('credential rotation includes disabled models and leaves no references to the old key version', () => fixture(async ({ rpc, service }) => {
  const saved = await service.saveModel({ ...model, enabled: false, apiKey: 'old-key-test' });
  assert.equal(saved.ok, true);
  const rotatedService = createAiService({ rpc, keyring: () => ({ activeVersion: 'v2', keys: { ...keyring.keys, v2: Buffer.alloc(32, 18).toString('base64') } }) });
  const rotated = await rotatedService.rotateCredentials();
  assert.equal(rotated.ok, true);
  assert.equal(rotated.value.rotated, 1);
  assert.deepEqual((await rotatedService.credentialVersions()).value, { v2: 1 });
}));

function networkService(rpc, fetch = async () => responseFor('openai-completions'), extra = {}) {
  return createAiService({ rpc, keyring: () => keyring, network: {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }], fetch,
  }, ...extra });
}
function value(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; }

test('every application entry rejects Readers and anonymous callers before any model request', () => fixture(async ({ sql, rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'reader-test-key' }));
  let requests = 0;
  const protectedService = networkService(rpc, async () => { requests++; return responseFor('openai-completions'); });
  for (const role of ['authenticated', 'anon']) {
    await sql.unsafe(`set local role ${role}`);
    await sql`select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999918', true)`;
    for (const invoke of [
      () => protectedService.readConfiguration(), () => protectedService.saveModel({ ...model, apiKey: 'never-sent' }),
      () => protectedService.setDefaultModel(id), () => protectedService.setEnabled(false),
      () => protectedService.updatePrompts({ summary: 's', slug: 's', outline: 's' }),
      () => protectedService.readSnapshot(id), () => protectedService.testConnection(id),
      () => protectedService.rotateCredentials(), () => protectedService.credentialVersions(),
    ]) assert.equal((await invoke()).error.code, 'forbidden');
  }
  assert.equal(requests, 0);
}));

test('prompt edits persist and a generation snapshot retains its original model and instructions', () => fixture(async ({ rpc, service }) => {
  const first = value(await service.saveModel({ ...model, apiKey: 'snapshot-test-key' }));
  value(await service.setDefaultModel(first));
  const prompts = { summary: '中文概括', slug: 'English slug', outline: 'Preserve qualifications' };
  value(await service.updatePrompts(prompts));
  const current = value(await networkService(rpc).readSnapshot());
  assert.deepEqual(current.prompts, prompts);
  value(await service.updatePrompts({ ...prompts, summary: 'Changed' }));
  value(await service.setDefaultModel(null));
  assert.deepEqual(current.prompts, prompts);
  assert.equal(current.model.id, first);
  assert.equal(value(await service.readConfiguration()).prompts.summary, 'Changed');
  assert.equal((await service.readSnapshot()).error.code, 'configuration_missing');
  assert.equal(Object.isFrozen(current.prompts), true);
  assert.equal(JSON.stringify(current).includes('snapshot-test-key'), false);
}));

test('endpoint and protocol changes revoke old keys; stale writes cannot restore them or touch another model', () => fixture(async ({ rpc, service }) => {
  const first = value(await service.saveModel({ ...model, apiKey: 'key-first' }));
  const second = value(await service.saveModel({ ...model, apiKey: 'key-second' }));
  const before = value(await service.readConfiguration()).models.find(m => m.id === first);
  value(await service.saveModel({ ...before, endpoint: 'https://new.example/v1' }));
  assert.equal((await service.testConnection(first)).error.code, 'credential_unavailable');
  assert.equal((await service.saveModel({ ...before, apiKey: 'stale-key' })).error.code, 'conflict');
  let seenKey;
  const testing = networkService(rpc, async (_url, options) => { seenKey = new Headers(options.headers).get('authorization'); return responseFor('openai-completions'); });
  value(await testing.testConnection(second));
  assert.equal(seenKey, 'Bearer key-second');
  const updated = value(await service.readConfiguration()).models.find(m => m.id === first);
  value(await service.saveModel({ ...updated, protocol: 'openai-responses', apiKey: 'fresh-key' }));
  const ready = value(await service.readConfiguration()).models.find(m => m.id === first);
  assert.equal(ready.keySet, true);
  value(await service.saveModel({ ...ready, protocol: 'anthropic-messages' }));
  assert.equal((await service.testConnection(first)).error.code, 'credential_unavailable');
}));

test('missing and wrong master keys, corrupt ciphertext and swapped credentials fail without leaking secrets', () => fixture(async ({ sql, rpc, service }) => {
  const first = value(await service.saveModel({ ...model, apiKey: 'sensitive-first' }));
  const second = value(await service.saveModel({ ...model, apiKey: 'sensitive-second' }));
  let requests = 0;
  const fetch = async () => { requests++; throw new Error('sensitive-first'); };
  for (const ring of [{ activeVersion: '', keys: {} }, { activeVersion: 'v1', keys: { v1: Buffer.alloc(32, 99).toString('base64') } }]) {
    const failed = await networkService(rpc, fetch, { keyring: () => ring }).testConnection(first);
    assert.equal(failed.error.code, 'credential_unavailable');
    assert.equal(JSON.stringify(failed).includes('sensitive'), false);
  }
  await sql`update private.ai_models set credential = (select credential from private.ai_models where id = ${second}) where id = ${first}`;
  assert.equal((await networkService(rpc, fetch).testConnection(first)).error.code, 'credential_unavailable');
  await sql`update private.ai_models set credential = jsonb_set(credential, '{tag}', '"broken"') where id = ${second}`;
  assert.equal((await networkService(rpc, fetch).testConnection(second)).error.code, 'credential_unavailable');
  assert.equal(requests, 0);
}));

test('unusable configurations fail before transmission and disabling persists', () => fixture(async ({ rpc, service }) => {
  for (const patch of [{ protocol: 'oauth' }, { contextWindow: 0 }, { maxOutputTokens: 8192 }, { contextWindow: 4.5 }, { apiKey: '' }, { apiKey: 'sk-ant-oat01-test-oauth-token' }, { endpoint: 'http://public.example' }, { endpoint: 'https://public.example/v1?api_key=secret' }]) {
    assert.equal((await service.saveModel({ ...model, ...patch })).ok, false);
  }
  const id = value(await service.saveModel({ ...model, apiKey: 'disable-key' }));
  value(await service.setDefaultModel(id));
  value(await service.setEnabled(false));
  assert.equal(value(await service.readConfiguration()).enabled, false);
  assert.equal((await service.testConnection(id)).error.code, 'disabled');
  value(await service.setEnabled(true));
  const saved = value(await service.readConfiguration()).models.find(m => m.id === id);
  value(await service.saveModel({ ...saved, enabled: false }));
  assert.equal((await networkService(rpc).testConnection(id)).error.code, 'disabled');
}));

for (const protocol of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
  test(`${protocol} provider errors never retry, fall back, or expose the raw error`, () => fixture(async ({ rpc, service }) => {
    const id = value(await service.saveModel({ ...model, protocol, apiKey: 'provider-test-key' }));
    let requests = 0;
    const diagnostics = [];
    const testing = networkService(rpc, async () => {
      requests++;
      return new Response(JSON.stringify({ error: { message: 'provider-test-key PRIVATE BODY', type: 'rate_limit_error' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '0' } });
    }, { recordDiagnostic: diagnostic => diagnostics.push(diagnostic) });
    const failed = await testing.testConnection(id);
    assert.equal(failed.error.code, 'provider_failed');
    assert.equal(requests, 1);
    assert.equal(diagnostics[0].httpStatus, 429);
    assert.equal(JSON.stringify([failed, diagnostics]).includes('provider-test-key'), false);
    assert.equal(JSON.stringify([failed, diagnostics]).includes('PRIVATE BODY'), false);
  }));
}

test('forbidden literal targets, DNS changes, mixed DNS answers and redirects never reach a private target', () => fixture(async ({ rpc, service }) => {
  for (const endpoint of ['https://localhost', 'https://127.1', 'https://2130706433', 'https://169.254.169.254', 'https://10.0.0.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://[fc00::1]', 'https://metadata.google.internal', 'https://user:secret@public.example']) {
    assert.equal((await service.saveModel({ ...model, endpoint })).ok, false, endpoint);
  }
  const id = value(await service.saveModel({ ...model, apiKey: 'ssrf-test-key' }));
  let requests = 0;
  let resolutions = 0;
  const testing = createAiService({ rpc, keyring: () => keyring, network: {
    resolve: async () => ++resolutions === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }],
    fetch: async () => { requests++; return responseFor('openai-completions'); },
  } });
  value(await testing.testConnection(id));
  assert.equal((await testing.testConnection(id)).error.code, 'target_blocked');
  assert.equal(requests, 1);
  const mixed = networkService(rpc, async () => { requests++; }, { network: {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }],
    fetch: async () => { requests++; },
  } });
  assert.equal((await mixed.testConnection(id)).error.code, 'target_blocked');
  const redirected = await networkService(rpc, async () => { requests++; return new Response(null, { status: 307, headers: { location: 'https://169.254.169.254/' } }); }).testConnection(id);
  assert.equal(redirected.error.code, 'target_blocked');
  assert.equal(requests, 2);
}));

test('model calls cancel an in-flight transport and cap a requested timeout at 60 seconds', () => fixture(async ({ rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'cancel-key' }));
  const observed = [];
  let started;
  let ready = new Promise(resolve => { started = resolve; });
  const testing = networkService(rpc, async (_url, options) => {
    observed.push(options.signal);
    started();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancel-key')), { once: true }));
  });
  const snapshot = value(await testing.readSnapshot(id));
  const controller = new AbortController();
  const pending = snapshot.call({ system: 'Test', text: 'Body', maxOutputTokens: 16, signal: controller.signal });
  await ready;
  controller.abort();
  assert.equal((await pending).error.code, 'cancelled');
  assert.equal(observed[0].aborted, true);
  ready = new Promise(resolve => { started = resolve; });
  const timed = snapshot.call({ system: 'Test', text: 'Body', maxOutputTokens: 16, timeoutMs: 10 });
  await ready;
  assert.equal((await timed).error.code, 'timeout');
  assert.equal(observed[1].aborted, true);
}));

test('requests larger than the time budget are aborted at exactly 60 seconds', t => fixture(async ({ rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'timeout-cap-key' }));
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let signal;
  const testing = networkService(rpc, async (_url, options) => {
    signal = options.signal;
    started();
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  const snapshot = value(await testing.readSnapshot(id));
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  try {
    const pending = snapshot.call({ system: 'Test', text: 'Body', maxOutputTokens: 16, timeoutMs: 180000 });
    await ready;
    t.mock.timers.tick(59999);
    assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    const failed = await pending;
    assert.equal(failed.error.code, 'timeout');
    assert.equal(failed.diagnostic.durationMs, 60000);
    assert.equal(signal.aborted, true);
  } finally { t.mock.timers.reset(); }
}));

test('missing persisted prompts fail explicitly without a runtime default', () => fixture(async ({ sql, rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'missing-config-key' }));
  await sql`reset role`;
  await sql`delete from private.ai_settings`;
  await sql`set local role authenticated`;
  assert.equal((await networkService(rpc).readSnapshot(id)).error.code, 'configuration_missing');
  assert.equal((await service.readConfiguration()).error.code, 'configuration_missing');
}));

test('truncated and empty model outputs cannot masquerade as a successful connection', () => fixture(async ({ rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'invalid-output-key' }));
  for (const [content, reason] of [['partial', 'length'], ['', 'stop']]) {
    const failed = await networkService(rpc, async () => new Response(
      sse({ choices: [{ index: 0, delta: { content }, finish_reason: reason }] }) + 'data: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    )).testConnection(id);
    assert.equal(failed.error.code, 'invalid_response');
  }
}));

test('completed reasoning-plus-text responses expose only the final text', () => fixture(async ({ rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'reasoning-test-key' }));
  const testing = networkService(rpc, async () => new Response(
    sse({ choices: [{ index: 0, delta: { reasoning_content: 'PRIVATE REASONING', content: 'OK' }, finish_reason: null }] }) +
    sse({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  ));
  const snapshot = value(await testing.readSnapshot(id));
  const response = await snapshot.call({ system: 'Test', text: 'Body', maxOutputTokens: 16 });
  assert.equal(value(response).text, 'OK');
  assert.equal(JSON.stringify(response).includes('PRIVATE REASONING'), false);
}));

test('the actual TLS connector uses the approved IP without resolving the hostname again', t => fixture(async ({ rpc, service }) => {
  const id = value(await service.saveModel({ ...model, apiKey: 'socket-test-key' }));
  let dnsCalls = 0;
  let connectedAddress;
  let servername;
  // Replace only the external TLS dial. All request construction, DNS checking,
  // Undici dispatch, and its configured socket lookup run normally.
  t.mock.method(tls, 'connect', options => {
    servername = options.servername;
    if (options.lookup) options.lookup(options.host, {}, (error, address) => {
      assert.equal(error, null);
      connectedAddress = address;
    });
    throw new Error('Controlled TLS dial stopped before network traffic');
  });
  const testing = createAiService({ rpc, keyring: () => keyring, network: {
    resolve: async () => ++dnsCalls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }],
  } });
  assert.equal((await testing.testConnection(id)).error.code, 'provider_failed');
  assert.equal(connectedAddress, '93.184.216.34');
  assert.equal(servername, 'model.example');
  assert.equal(dnsCalls, 1);
}));
