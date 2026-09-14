import 'server-only';
import type { Model, Context, StreamOptions, StreamFunction } from '@earendil-works/pi-ai';
import { stream as completions } from '@earendil-works/pi-ai/api/openai-completions';
import { stream as responses } from '@earendil-works/pi-ai/api/openai-responses';
import { stream as messages } from '@earendil-works/pi-ai/api/anthropic-messages';
import type { AiProtocol, AiDiagnostic, AiTextRequest, AiTextResult, AiUsage } from '@/lib/ai/types';
import type { ModelRecord } from './configuration';
import { AiError, failure } from './errors';
import { protectedTransport, type NetworkBoundary } from './transport';

// Each protocol's permitted resource and matching pi-ai adapter change together.
const protocols: Record<AiProtocol, { resource: string; stream: StreamFunction<AiProtocol> }> = {
  'openai-completions': { resource: '/chat/completions', stream: (model, context, options) => completions(model as Model<'openai-completions'>, context, options) },
  'openai-responses': { resource: '/responses', stream: (model, context, options) => responses(model as Model<'openai-responses'>, context, options) },
  'anthropic-messages': { resource: '/v1/messages?beta=true', stream: (model, context, options) => messages(model as Model<'anthropic-messages'>, context, options) },
};

export async function callModel(record: ModelRecord, apiKey: string, request: AiTextRequest, network?: NetworkBoundary): Promise<AiTextResult> {
  const started = Date.now();
  const timerController = new AbortController();
  const signal = AbortSignal.any([timerController.signal, ...(request.signal ? [request.signal] : [])]);
  const timeoutMs = Math.min(request.timeoutMs ?? 60000, 60000);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; timerController.abort(); }, timeoutMs);
  const protocol = protocols[record.protocol];
  let transport: ReturnType<typeof protectedTransport> | undefined;
  let removeAbortListener = () => {};
  const diagnostic = (status: AiDiagnostic['status'], usage?: AiUsage): AiDiagnostic => ({
    modelId: record.id, protocol: record.protocol, status, durationMs: Date.now() - started,
    ...(transport?.status ? { httpStatus: transport.status } : {}), ...(usage ? { usage } : {}),
  });
  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof request.text !== 'string' || !request.text.trim() ||
      typeof request.system !== 'string' || !Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0 ||
      request.maxOutputTokens > record.max_output_tokens) throw new AiError('invalid_configuration');
    signal.throwIfAborted();
    transport = protectedTransport(record.endpoint, protocol.resource, signal, network);
    const model = {
      id: record.model, name: record.name, api: record.protocol, provider: 'sleepy-custom', baseUrl: record.endpoint,
      reasoning: false, input: ['text'], contextWindow: record.context_window, maxTokens: record.max_output_tokens,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    } satisfies Model<typeof record.protocol>;
    const context: Context = { systemPrompt: request.system, messages: [{ role: 'user', content: request.text, timestamp: started }] };
    const options: StreamOptions = { apiKey, fetch: transport.fetch, signal, maxRetries: 0, timeoutMs,
      maxTokens: request.maxOutputTokens, cacheRetention: 'none',
      // DeepSeek's current default is thinking mode; connection tests and this text contract use non-thinking.
      ...(record.protocol === 'openai-completions' && new URL(record.endpoint).hostname === 'api.deepseek.com' ? { onPayload: payload => ({ ...(payload as object), thinking: { type: 'disabled' } }) } : {}),
    };
    const cancelled = new Promise<never>((_, reject) => {
      const onAbort = () => reject(new AiError(timedOut ? 'timeout' : 'cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
    });
    const stream = protocol.stream(model, context, options);
    const output = await Promise.race([stream.result(), cancelled]);
    if (signal.aborted) throw new AiError(timedOut ? 'timeout' : 'cancelled');
    if (transport.blocked) throw new AiError('target_blocked');
    if (output.stopReason === 'error' || output.stopReason === 'aborted') throw new AiError('provider_failed');
    if (output.stopReason !== 'stop' || output.content.some(part => part.type !== 'text' && part.type !== 'thinking')) throw new AiError('invalid_response');
    const text = output.content.filter(part => part.type === 'text').map(part => part.text).join('').trim();
    if (!text || text.includes(apiKey)) throw new AiError('invalid_response');
    const usage: AiUsage = { inputTokens: output.usage.input, outputTokens: output.usage.output,
      cacheReadTokens: output.usage.cacheRead, cacheWriteTokens: output.usage.cacheWrite };
    if (Object.values(usage).some(value => !Number.isFinite(value) || value < 0)) throw new AiError('invalid_response');
    return { ok: true, value: { text, usage }, diagnostic: diagnostic('success', usage) };
  } catch (error) {
    const safe = signal.aborted ? new AiError(timedOut ? 'timeout' : 'cancelled') :
      transport?.blocked ? new AiError('target_blocked') : error instanceof AiError ? error : new AiError('provider_failed');
    return { ...failure(safe), diagnostic: diagnostic(safe.code) };
  } finally {
    clearTimeout(timer);
    removeAbortListener();
    timerController.abort();
    await transport?.close().catch(() => undefined);
  }
}
