import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';
import { AiError } from './errors';

export type NetworkBoundary = {
  resolve?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  fetch?: typeof undiciFetch;
};
function publicAddress(address: string): boolean {
  try { return ipaddr.parse(address).range() === 'unicast'; } catch { return false; }
}
export function validateEndpoint(value: string): URL {
  try {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) throw new Error();
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      /(^|\.)(localhost|local|internal|home\.arpa)\.?$/.test(host) ||
      (isIP(host) !== 0 && !publicAddress(host))) throw new Error();
    if (/\/(chat\/completions|responses|messages)\/?$/.test(url.pathname)) throw new Error();
    return url;
  } catch { throw new AiError('target_blocked'); }
}

/** Resolve once per request, reject all non-public answers, then pin that address in the socket lookup.
 * TLS still verifies the original hostname. No global dispatcher, proxy env, redirects or second DNS lookup. */
export function protectedTransport(endpoint: string, resource: string, signal: AbortSignal, boundary: NetworkBoundary = {}, method: 'POST' | 'GET' = 'POST') {
  const base = validateEndpoint(endpoint);
  const expected = `${base.href.replace(/\/$/, '')}${resource}`;
  const agents = new Set<Agent>();
  let blocked = false;
  let status: number | undefined;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    try {
      if (request.url !== expected || request.method !== method) throw new AiError('target_blocked');
      signal.throwIfAborted();
      const host = base.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] :
        await (boundary.resolve ?? (name => lookup(name, { all: true, verbatim: true })))(host);
      if (!addresses.length || addresses.some(a => !publicAddress(a.address) || isIP(a.address) !== a.family)) throw new AiError('target_blocked');
      signal.throwIfAborted();
      const pinned = addresses[0];
      const dispatcher = new Agent({ connect: {
        autoSelectFamily: false,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      } });
      agents.add(dispatcher);
      const response = await (boundary.fetch ?? undiciFetch)(request.url, {
        method, headers: request.headers, ...(method === 'POST' ? { body: await request.text() } : {}),
        signal, redirect: 'manual', dispatcher,
      });
      status = response.status;
      if (status >= 300 && status < 400) {
        await response.body?.cancel();
        throw new AiError('target_blocked');
      }
      return new Response(response.body as ReadableStream<Uint8Array> | null, {
        status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (error) {
      if (error instanceof AiError && error.code === 'target_blocked') blocked = true;
      throw error;
    }
  };
  return { fetch, get blocked() { return blocked; }, get status() { return status; },
    close: async () => { await Promise.all([...agents].map(agent => agent.destroy())); } };
}
