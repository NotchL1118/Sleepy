export type AiProtocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages';
export type AiPrompts = { summary: string; slug: string; outline: string };
export type AiModelInput = {
  id?: string;
  revision?: number;
  name: string;
  protocol: AiProtocol;
  /** Provider API base URL, e.g. https://api.openai.com/v1 (not the resource path). */
  endpoint: string;
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  enabled: boolean;
  /** Omit to retain a credential; null clears it; a string replaces it. */
  apiKey?: string | null;
};
export type AiModelConfiguration = Omit<AiModelInput, 'apiKey' | 'id' | 'revision'> & {
  id: string;
  revision: number;
  keySet: boolean;
};
export type AiConfiguration = {
  models: AiModelConfiguration[];
  defaultModelId: string | null;
  enabled: boolean;
  prompts: AiPrompts;
};
export type AiErrorCode = 'forbidden' | 'invalid_configuration' | 'configuration_missing' |
  'conflict' | 'storage_failed' | 'credential_unavailable' | 'disabled' | 'target_blocked' |
  'provider_failed' | 'invalid_response' | 'cancelled' | 'timeout';
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: { code: AiErrorCode; message: string } };
export type AiUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
export type AiDiagnostic = {
  modelId: string;
  protocol: AiProtocol;
  status: 'success' | AiErrorCode;
  durationMs: number;
  httpStatus?: number;
  usage?: AiUsage;
};
export type AiTextRequest = { system: string; text: string; maxOutputTokens: number; signal?: AbortSignal; timeoutMs?: number };
export type AiTextResult = AiResult<{ text: string; usage: AiUsage }> & { diagnostic: AiDiagnostic };
