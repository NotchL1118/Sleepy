import 'server-only';
import { createClient } from '@/utils/supabase/server';
import { createAiService } from './service';
import { DEEPSEEK_PRESET } from './configuration';
import { result } from './errors';

/** Each service operation independently checks the cookie-bound Admin allowlist RPC. */
export async function aiService() {
  const client = await createClient();
  return createAiService({
    rpc: (name, args) => client.rpc(name, args as never),
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
