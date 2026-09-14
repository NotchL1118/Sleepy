import 'server-only';
import { createClient } from '@/utils/supabase/server';
import { createAiService } from './service';
import { AiError, result } from './errors';
import type { AiGenerationAvailability } from '@/lib/ai/types';

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
export async function readAiGenerationAvailability(): Promise<AiGenerationAvailability> {
  const configuration = await result(readAiConfiguration);
  if (!configuration.ok || !configuration.value.ok) {
    return { available: false, message: 'AI 配置暂时不可用' };
  }
  const { enabled, models, defaultModelId } = configuration.value.value;
  const model = models.find(item => item.id === defaultModelId);
  if (!enabled) return { available: false, message: 'AI 已停用' };
  if (!model?.keySet) return { available: false, message: '请先配置 AI' };
  return { available: true, message: null };
}
/** Server-only capability: no API key, ciphertext, DB record or SDK structure escapes. */
export async function readAiSnapshot() {
  return (await aiService()).readSnapshot();
}
