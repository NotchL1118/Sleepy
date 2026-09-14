import 'server-only';
import type { AiConfiguration, AiConnectionInput, AiModelInput, AiPrompts, AiTextRequest, AiDiagnostic, AiTextResult, AiPostGenerationInput, AiPostGenerationOptions } from '@/lib/ai/types';
import { connectionTarget, modelRecord, publicModel, validateId, validatePrompts, type ModelRecord, type SettingsRecord } from './configuration';
import { decryptCredential, encryptCredential, environmentKeyring, type Keyring } from './credentials';
import { AiError, result } from './errors';
import { callModel } from './model';
import type { NetworkBoundary } from './transport';
import { generatePostFields } from './generation';
import { discoverModels } from './discovery';
export type AiRpc = 'is_admin' | 'ai_list_configuration' | 'ai_save_model' | 'ai_delete_model' | 'ai_update_settings' | 'ai_model_snapshot';
export type AiDependencies = {
  rpc: (name: AiRpc, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  posts: {
    read: (postId: number) => Promise<{ published_at: string | null } | null>;
    isSlugTaken: (slug: string, postId?: number) => Promise<boolean>;
  };
  keyring?: () => Keyring;
  network?: NetworkBoundary;
  recordDiagnostic?: (diagnostic: AiDiagnostic) => void;
};
/** Application boundary shared by Server Actions and transaction-backed integration tests. */
export function createAiService(dependencies: AiDependencies) {
  async function rpc(name: AiRpc, args?: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await dependencies.rpc(name, args);
    if (error) throw new AiError(error.code === '42501' ? 'forbidden' : error.code === '40001' ? 'conflict' : 'storage_failed');
    return data;
  }
  async function authorize() {
    if (await rpc('is_admin') !== true) throw new AiError('forbidden');
  }
  async function snapshot(id?: string) {
    await authorize();
    if (id !== undefined) validateId(id);
    const data = await rpc('ai_model_snapshot', { p_id: id ?? null }) as { model: ModelRecord | null; settings: SettingsRecord } | null;
    if (!data?.model || !data.settings?.prompts) throw new AiError('configuration_missing');
    if (!data.settings.enabled) throw new AiError('disabled');
    const prompts = Object.freeze(validatePrompts(data.settings.prompts));
    const record = data.model;
    // Revalidate persisted configuration before any credential use or network request.
    modelRecord(publicModel(record));
    if (!record.credential) throw new AiError('credential_unavailable');
    const apiKey = decryptCredential(record.credential, record, (dependencies.keyring ?? environmentKeyring)());
    return Object.freeze({
      model: Object.freeze(publicModel(record)), prompts,
      call: async (request: AiTextRequest): Promise<AiTextResult> => {
        const permission = await result(authorize);
        const response: AiTextResult = permission.ok
          ? await callModel(record, apiKey, request, dependencies.network)
          : { ...permission, diagnostic: { modelId: record.id, protocol: record.protocol, status: permission.error.code, durationMs: 0 } };
        dependencies.recordDiagnostic?.(response.diagnostic);
        return response;
      },
    });
  }
  async function generationOptions(postId?: number): Promise<AiPostGenerationOptions> {
    await authorize();
    if (postId !== undefined) {
      if (!Number.isSafeInteger(postId) || postId <= 0) throw new AiError('invalid_input');
      const post = await dependencies.posts.read(postId);
      if (!post) throw new AiError('invalid_input');
      if (post.published_at !== null) return { modes: ['summary'], defaultMode: 'summary' };
    }
    return { modes: ['summary', 'slug', 'both'], defaultMode: 'both' };
  }
  async function credentialRecords() {
    const data = await rpc('ai_list_configuration') as { models: ModelRecord[] };
    const records: ModelRecord[] = [];
    for (const model of data.models) {
      const snapshot = await rpc('ai_model_snapshot', { p_id: model.id }) as { model: ModelRecord };
      if (snapshot.model?.credential) records.push(snapshot.model);
    }
    return records;
  }
  async function formCredential(input: AiConnectionInput, target: ReturnType<typeof connectionTarget>) {
    let apiKey = input.apiKey;
    if (apiKey === undefined && input.id) {
      const saved = await rpc('ai_model_snapshot', { p_id: target.id }) as { model: ModelRecord | null } | null;
      if (!saved?.model) throw new AiError('configuration_missing');
      if (saved.model.revision !== target.revision) throw new AiError('conflict');
      // A stored secret must never follow an edited protocol or destination.
      if (saved.model.protocol !== target.protocol || saved.model.endpoint !== target.endpoint || !saved.model.credential) {
        throw new AiError('credential_unavailable');
      }
      apiKey = decryptCredential(saved.model.credential, saved.model, (dependencies.keyring ?? environmentKeyring)());
    }
    if (!apiKey) throw new AiError('credential_unavailable');
    return apiKey;
  }
  return {
    generatePostFields: (input: AiPostGenerationInput, signal?: AbortSignal) => generatePostFields(input, () => snapshot(), {
      options: generationOptions,
      isSlugTaken: async (slug, postId) => {
        await authorize();
        return dependencies.posts.isSlugTaken(slug, postId);
      },
    }, signal),
    readPostGenerationOptions: (postId?: number) => result(() => generationOptions(postId)),
    credentialVersions: () => result(async () => {
      await authorize();
      const versions: Record<string, number> = Object.create(null);
      for (const record of await credentialRecords()) {
        const version = record.credential!.version;
        versions[version] = (versions[version] ?? 0) + 1;
      }
      return { ...versions };
    }),
    rotateCredentials: () => result(async () => {
      await authorize();
      const ring = (dependencies.keyring ?? environmentKeyring)();
      let rotated = 0;
      for (const record of await credentialRecords()) {
        const secret = decryptCredential(record.credential!, record, ring);
        // Verify active-version ciphertext too, so a wrong deployment key cannot look healthy.
        if (record.credential!.version === ring.activeVersion) continue;
        const credential = encryptCredential(secret, record, ring);
        await rpc('ai_save_model', { p_model: record, p_expected_revision: record.revision,
          p_credential: credential, p_replace_credential: true });
        rotated++;
      }
      return { rotated };
    }),
    readSnapshot: (id?: string) => result(() => snapshot(id)),
    testModel: (input: AiModelInput) => result(async () => {
      await authorize();
      // Validate and capture the unsaved form before awaiting any saved credential.
      const record = modelRecord(input);
      const apiKey = await formCredential(input, record);
      const response = await callModel(record, apiKey, {
        system: 'Return only OK.', text: 'Connection test.', maxOutputTokens: Math.min(32, record.max_output_tokens),
      }, dependencies.network);
      dependencies.recordDiagnostic?.(response.diagnostic);
      if (!response.ok) throw new AiError(response.error.code);
      // Testing never writes a model, credential, default selection or settings.
      return { durationMs: response.diagnostic.durationMs };
    }),
    discoverModels: (input: AiConnectionInput) => result(async () => {
      await authorize();
      const target = connectionTarget(input);
      const apiKey = await formCredential(input, target);
      return discoverModels(target, apiKey, dependencies.network);
    }),
    testConnection: async (id: string) => {
      const prepared = await result(() => snapshot(id));
      if (!prepared.ok) return prepared;
      const current = prepared.value;
      const response = await current.call({ system: 'Return only OK.', text: 'Connection test.', maxOutputTokens: Math.min(32, current.model.maxOutputTokens) });
      if (!response.ok) return response;
      return { ok: true as const, value: { usage: response.value.usage }, diagnostic: response.diagnostic };
    },
    readConfiguration: () => result(async (): Promise<AiConfiguration> => {
      await authorize();
      const data = await rpc('ai_list_configuration') as { models: ModelRecord[]; settings: SettingsRecord | null };
      if (!data.settings) throw new AiError('configuration_missing');
      return { models: data.models.map(publicModel), defaultModelId: data.settings.default_model_id,
        enabled: data.settings.enabled, prompts: validatePrompts(data.settings.prompts) };
    }),
    saveModel: (input: AiModelInput) => result(async () => {
      await authorize();
      const record = modelRecord(input);
      const credential = typeof input.apiKey === 'string' ? encryptCredential(input.apiKey, record, (dependencies.keyring ?? environmentKeyring)()) : null;
      return await rpc('ai_save_model', { p_model: record, p_expected_revision: input.id ? input.revision : null,
        p_credential: credential, p_replace_credential: input.apiKey !== undefined }) as string;
    }),
    deleteModel: (id: string, revision: number) => result(async () => {
      await authorize();
      validateId(id);
      if (!Number.isInteger(revision) || revision < 1) throw new AiError('invalid_configuration');
      await rpc('ai_delete_model', { p_id: id, p_expected_revision: revision });
    }),
    setDefaultModel: (id: string | null) => result(async () => {
      await authorize();
      if (id !== null) validateId(id);
      await rpc('ai_update_settings', { p_patch: { default_model_id: id } });
    }),
    savePreferences: (enabled: boolean, prompts: AiPrompts) => result(async () => {
      await authorize();
      if (typeof enabled !== 'boolean') throw new AiError('invalid_configuration');
      await rpc('ai_update_settings', { p_patch: { enabled, prompts: validatePrompts(prompts) } });
    }),
  };
}
