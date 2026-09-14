import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AiConnectionInput, AiModelConfiguration, AiModelInput, AiPrompts, AiProtocol } from '@/lib/ai/types';
import type { Credential } from './credentials';
import { AiError } from './errors';
import { validateEndpoint } from './transport';
export type ModelRecord = {
  id: string; revision: number; name: string; protocol: AiProtocol; endpoint: string; model: string;
  max_output_tokens: number; credential?: Credential | null; key_set?: boolean;
};
export type SettingsRecord = { default_model_id: string | null; enabled: boolean; prompts: AiPrompts };
export function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AiError('invalid_configuration');
}
export function validatePrompts(value: AiPrompts): AiPrompts {
  for (const field of ['summary', 'slug'] as const) {
    if (typeof value?.[field] !== 'string' || !value[field].trim() || value[field].length > 32000) throw new AiError('invalid_configuration');
  }
  return { summary: value.summary, slug: value.slug };
}
export function connectionTarget(input: AiConnectionInput) {
  if (!input || !['openai-completions', 'openai-responses', 'anthropic-messages'].includes(input.protocol)) throw new AiError('invalid_configuration');
  const id = input.id ?? randomUUID();
  validateId(id);
  if (input.id !== undefined && (!Number.isInteger(input.revision) || input.revision! < 1)) throw new AiError('invalid_configuration');
  if (input.apiKey !== undefined && input.apiKey !== null && (typeof input.apiKey !== 'string' || !input.apiKey.trim() || input.apiKey.length > 8192 || input.apiKey.includes('sk-ant-oat') || /[\x00-\x20\x7f]/.test(input.apiKey))) throw new AiError('invalid_configuration');
  return { id, revision: input.revision ?? 1, protocol: input.protocol,
    endpoint: validateEndpoint(input.endpoint).href.replace(/\/$/, '') };
}
export function modelRecord(input: AiModelInput): ModelRecord {
  const target = connectionTarget(input);
  for (const [value, limit] of [[input.name, 120], [input.model, 200]] as const) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) throw new AiError('invalid_configuration');
  }
  if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0 || input.maxOutputTokens > 2147483647) throw new AiError('invalid_configuration');
  return { ...target, name: input.name.trim(), model: input.model.trim(), max_output_tokens: input.maxOutputTokens };
}
export function publicModel(record: ModelRecord): AiModelConfiguration {
  return { id: record.id, revision: record.revision, name: record.name, protocol: record.protocol, endpoint: record.endpoint,
    model: record.model, maxOutputTokens: record.max_output_tokens,
    keySet: record.key_set ?? record.credential != null };
}
