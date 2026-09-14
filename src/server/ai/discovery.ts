import 'server-only';
import type { AiProtocol } from '@/lib/ai/types';
import { AiError } from './errors';
import { protectedTransport, type NetworkBoundary } from './transport';

/** Optional discovery uses the same destination protections as generation, without any writes. */
export async function discoverModels(target: { endpoint: string; protocol: AiProtocol }, apiKey: string, network?: NetworkBoundary): Promise<string[]> {
  const controller = new AbortController();
  let transport: ReturnType<typeof protectedTransport> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new AiError('timeout')); }, 15000);
  });
  const work = async () => {
    const anthropic = target.protocol === 'anthropic-messages';
    const ids = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      controller.signal.throwIfAborted();
      const resource = anthropic ? `/v1/models?limit=100${cursor ? `&after_id=${encodeURIComponent(cursor)}` : ''}` : '/models';
      transport = protectedTransport(target.endpoint, resource, controller.signal, network, 'GET');
      const response = await transport.fetch(`${target.endpoint}${resource}`, {
        method: 'GET', signal: controller.signal,
        headers: anthropic ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', accept: 'application/json' } :
          { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      });
      if (!response.ok || !response.body) {
        void response.body?.cancel().catch(() => undefined);
        throw new AiError('model_list_unavailable');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024 * 1024) throw new AiError('model_list_unavailable');
          chunks.push(value);
        }
      } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(body?.data)) throw new AiError('model_list_unavailable');
      for (const item of body.data) {
        if (typeof item?.id !== 'string' || !item.id.trim() || item.id.length > 200 || /[\x00-\x1f\x7f]/.test(item.id) || item.id.includes(apiKey)) throw new AiError('model_list_unavailable');
        ids.add(item.id);
        if (ids.size > 5000) throw new AiError('model_list_unavailable');
      }
      cursor = anthropic && body.has_more === true ? body.last_id : undefined;
      if (anthropic && body.has_more === true) {
        if (typeof cursor !== 'string' || !cursor || cursor.length > 200 || cursors.has(cursor)) throw new AiError('model_list_unavailable');
        cursors.add(cursor);
        if (cursors.size > 50) throw new AiError('model_list_unavailable');
      }
      await transport.close();
    } while (cursor);
    return [...ids].sort((a, b) => a.localeCompare(b));
  };
  try { return await Promise.race([work(), timeout]); }
  catch (error) { throw error instanceof AiError ? error : new AiError('model_list_unavailable'); }
  finally {
    clearTimeout(timer);
    controller.abort();
    void transport?.close().catch(() => undefined);
  }
}
