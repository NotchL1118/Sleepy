// Operator-only entry point. It uses the same Admin-checked application service as Next.
import { registerHooks } from 'node:module';
import postgres from 'postgres';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  if ((context.parentURL?.includes('/src/server/ai/') || context.parentURL?.includes('/src/lib/ai/')) && specifier.startsWith('.') && !specifier.endsWith('.ts')) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}});
const { createAiService } = await import('../src/server/ai/service.ts');
const command = process.argv[2];
const adminId = process.env.AI_MAINTENANCE_ADMIN_ID;
const databaseUrl = process.env.AI_MAINTENANCE_DATABASE_URL;
if (!['versions', 'rotate', 'test', 'summary'].includes(command) || !adminId || !databaseUrl || (command === 'test' && !process.argv[3])) {
  console.error('Usage: node --env-file=<server-env-file> scripts/ai-maintenance.mjs versions|rotate|test [model-id]|summary. Set AI_MAINTENANCE_DATABASE_URL and AI_MAINTENANCE_ADMIN_ID.');
  process.exit(1);
}
const db = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const output = await db.begin(async sql => {
    await sql`set local role authenticated`;
    await sql`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
    const service = createAiService({ rpc: async (name, args = {}) => {
      const keys = Object.keys(args);
      try {
        const rows = await sql.unsafe(`select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) as data`, Object.values(args));
        return { data: rows[0].data, error: null };
      } catch (error) { return { data: null, error: { code: error.code } }; }
    } });
    const result = command === 'versions' ? await service.credentialVersions() :
      command === 'rotate' ? await service.rotateCredentials() :
      command === 'summary' ? await service.generatePostFields({
        mode: 'summary', requestId: crypto.randomUUID(), editRevision: 0, title: '摘要接入验证',
        bodyMarkdown: '这是一次使用专用测试凭据的摘要接入验证。生成操作只返回候选，不保存文章，也不改变公开内容。',
      }) : await service.testConnection(process.argv[3]);
    if (!result.ok) throw new Error(result.error.code);
    return result;
  });
  console.info(JSON.stringify(output));
} catch {
  console.error('AI maintenance failed. No raw database or provider error is printed. Check Admin ID, deployment keys, model availability and database access. Rotation was rolled back.');
  process.exitCode = 1;
} finally { await db.end(); }
