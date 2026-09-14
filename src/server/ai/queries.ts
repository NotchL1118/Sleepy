import 'server-only';
import { createClient } from '@/utils/supabase/server';
import { createAiService } from './service';
import { DEEPSEEK_PRESET } from './configuration';
import { AiError, result } from './errors';

/** Each service operation independently checks the cookie-bound Admin allowlist RPC. */
export async function aiService() {
  const client = await createClient();
  return createAiService({
    rpc: (name, args) => client.rpc(name, args as never),
    posts: {
      read: async postId => {
        const { data, error } = await client.from('posts').select('published_at').eq('id', postId).maybeSingle();
        if (error) throw new AiError('storage_failed');
        return data;
      },
      isSlugTaken: async (slug, postId) => {
        let query = client.from('posts').select('id').eq('slug', slug);
        if (postId !== undefined) query = query.neq('id', postId);
        const { data, error } = await query.maybeSingle();
        if (error) throw new AiError('storage_failed');
        return data !== null;
      },
    },
    recordDiagnostic: diagnostic => console.info('ai.model_call', diagnostic),
  });
}
export async function readAiConfiguration() {
  return (await aiService()).readConfiguration();
}
/** Server-only capability: no API key, ciphertext, DB record or SDK structure escapes. */
export async function readAiSnapshot() {
  return (await aiService()).readSnapshot();
}
export async function readAiPresets() {
  const service = await aiService();
  const configuration = await service.readConfiguration();
  if (!configuration.ok) return configuration;
  return result(async () => [DEEPSEEK_PRESET]);
}
