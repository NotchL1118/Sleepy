import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AiModelConfiguration, AiModelInput, AiPrompts, AiProtocol } from '@/lib/ai/types';
import type { Credential } from './credentials';
import { AiError } from './errors';
import { validateEndpoint } from './transport';
export type ModelRecord = {
  id: string; revision: number; name: string; protocol: AiProtocol; endpoint: string; model: string;
  context_window: number; max_output_tokens: number; enabled: boolean; credential?: Credential | null; key_set?: boolean;
};
export type SettingsRecord = { default_model_id: string | null; enabled: boolean; prompts: AiPrompts };
export function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AiError('invalid_configuration');
}
export function validatePrompts(value: AiPrompts): AiPrompts {
  for (const field of ['summary', 'slug', 'outline'] as const) {
    if (typeof value?.[field] !== 'string' || !value[field].trim() || value[field].length > 32000) throw new AiError('invalid_configuration');
  }
  return { summary: value.summary, slug: value.slug, outline: value.outline };
}
export function modelRecord(input: AiModelInput): ModelRecord {
  if (!input || !['openai-completions', 'openai-responses', 'anthropic-messages'].includes(input.protocol)) throw new AiError('invalid_configuration');
  for (const [value, limit] of [[input.name, 120], [input.model, 200]] as const) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) throw new AiError('invalid_configuration');
  }
  if (!Number.isInteger(input.contextWindow) || input.contextWindow <= 0 || input.contextWindow > 2147483647 ||
    !Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0 || input.maxOutputTokens >= input.contextWindow ||
    typeof input.enabled !== 'boolean') throw new AiError('invalid_configuration');
  const id = input.id ?? randomUUID();
  validateId(id);
  if (input.id !== undefined && (!Number.isInteger(input.revision) || input.revision! < 1)) throw new AiError('invalid_configuration');
  if (input.apiKey !== undefined && input.apiKey !== null && (typeof input.apiKey !== 'string' || !input.apiKey.trim() || input.apiKey.length > 8192 || input.apiKey.includes('sk-ant-oat') || /[\x00-\x20\x7f]/.test(input.apiKey))) throw new AiError('invalid_configuration');
  return { id, revision: input.revision ?? 1, name: input.name.trim(), protocol: input.protocol,
    endpoint: validateEndpoint(input.endpoint).href.replace(/\/$/, ''), model: input.model.trim(),
    context_window: input.contextWindow, max_output_tokens: input.maxOutputTokens, enabled: input.enabled };
}
export function publicModel(record: ModelRecord): AiModelConfiguration {
  return { id: record.id, revision: record.revision, name: record.name, protocol: record.protocol, endpoint: record.endpoint,
    model: record.model, contextWindow: record.context_window, maxOutputTokens: record.max_output_tokens,
    enabled: record.enabled, keySet: record.key_set ?? record.credential != null };
}
/** Verified 2026-09-14 against DeepSeek's official model details; no model-name inference for custom entries. */
export const DEEPSEEK_PRESET: Readonly<AiModelInput> = Object.freeze({
  name: 'DeepSeek Flash', protocol: 'openai-completions', endpoint: 'https://api.deepseek.com',
  model: 'deepseek-flash', contextWindow: 1_000_000, maxOutputTokens: 384_000, enabled: true,
});
