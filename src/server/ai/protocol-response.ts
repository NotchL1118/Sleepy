import 'server-only';
import type { AiProtocol } from '@/lib/ai/types';
import { AiError } from './errors';

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function containsRefusal(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = object(value);
  return record.type === 'refusal' || (typeof record.type === 'string' && record.type.startsWith('response.refusal.')) ||
    Boolean(record.refusal) || Object.values(value).some(containsRefusal);
}
function inputLimitError(value: unknown): boolean {
  const record = object(value);
  const error = object(record.error ?? object(record.response).error ?? record);
  return [error.code, error.type].some(code => typeof code === 'string' &&
    /^(context_length_exceeded|context_window_exceeded|input_too_long|prompt_too_long)$/.test(code)) ||
    typeof error.message === 'string' && /maximum context length|context (?:window|length).{0,60}exceed|prompt is too long|input is too long/i.test(error.message);
}

/** pi-ai merges Responses refusals into text and drops Chat refusal deltas.
 * Validate the protocol envelope before handing the same bytes to the real SDK.
 * This use case returns one atomic result, so buffering adds no visible latency.
 */
export async function validateProtocolResponse(response: Response, protocol: AiProtocol): Promise<Response> {
  if (!response.ok) {
    if (response.status === 413) {
      void response.body?.cancel().catch(() => undefined);
      throw new AiError('input_too_large');
    }
    // Bound error bodies too. Never expose upstream messages or credentials to the caller.
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new AiError('provider_failed');
        chunks.push(value);
      }
    } finally { if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); } }
    const bytes = Buffer.concat(chunks);
    let body: unknown;
    try { body = JSON.parse(bytes.toString('utf8')); } catch { /* Non-JSON failures stay generic. */ }
    if (inputLimitError(body)) throw new AiError('input_too_large');
    return new Response(bytes, { status: response.status, headers: response.headers });
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new AiError('invalid_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) throw new AiError('invalid_response');
      chunks.push(value);
    }
  } finally {
    // Cancellation is also forwarded by the protected transport's AbortSignal.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  let complete = false;
  let messageStopped = false;
  const inspect = (data: string) => {
    if (data === '[DONE]') return;
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { throw new AiError('invalid_response'); }
    if (inputLimitError(parsed)) throw new AiError('input_too_large');
    if (containsRefusal(parsed)) throw new AiError('invalid_response');
    const event = object(parsed);
    if (protocol === 'openai-completions' && Array.isArray(event.choices)) {
      for (const choice of event.choices) {
        const reason = object(choice).finish_reason;
        if (reason != null) {
          if (reason !== 'stop') throw new AiError('invalid_response');
          complete = true;
        }
      }
    } else if (protocol === 'openai-responses') {
      if (event.type === 'response.incomplete' || event.type === 'response.failed' || event.type === 'error') throw new AiError('invalid_response');
      if (event.type === 'response.completed') {
        if (object(event.response).status !== 'completed') throw new AiError('invalid_response');
        complete = true;
      }
    } else if (protocol === 'anthropic-messages') {
      if (event.type === 'error') throw new AiError('invalid_response');
      if (event.type === 'message_delta') {
        const reason = object(event.delta).stop_reason;
        if (reason != null) {
          if (reason !== 'end_turn') throw new AiError('invalid_response');
          complete = true;
        }
      }
      if (event.type === 'message_stop') messageStopped = true;
    }
  };
  let data: string[] = [];
  for (const line of new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r\n|\r|\n/)) {
    if (line === '') {
      if (data.length) inspect(data.join('\n'));
      data = [];
    } else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length || !complete || (protocol === 'anthropic-messages' && !messageStopped)) throw new AiError('invalid_response');
  return new Response(bytes, { status: response.status, headers: response.headers });
}
