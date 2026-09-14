import 'server-only';
import type { AiErrorCode, AiResult } from '@/lib/ai/types';
const messages: Record<AiErrorCode, string> = {
  forbidden: '仅 Admin 可以管理或调用模型。',
  invalid_configuration: '模型配置或指令无效，请检查输入。',
  configuration_missing: '缺少模型或全站指令配置。',
  conflict: '配置已变更，请重新读取后再保存。',
  storage_failed: '配置暂时无法读取或保存。',
  credential_unavailable: '模型密钥不可用，请检查部署主密钥或重新录入凭据。',
  disabled: 'AI 生成已停用。',
  target_blocked: '模型接口地址或实际连接目标不被允许。',
  provider_failed: '模型连接失败，请检查协议、模型和凭据后手动重试。',
  model_list_unavailable: '未能获取模型列表，请检查接口配置，或直接填写模型 ID。',
  invalid_response: '模型未返回完整有效的文本。',
  cancelled: '模型调用已取消。',
  timeout: '模型调用超时，请手动重试。',
  invalid_input: '请提供有效的请求标识、编辑版本及完整 Markdown 正文。',
  input_too_large: '全文超出接口的输入限制，请缩短输入或更换模型后重试。原有内容未修改。',
};
export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode) { super(messages[code]); this.code = code; }
}
export function failure(error: unknown): Extract<AiResult<never>, { ok: false }> {
  const code = error instanceof AiError ? error.code : 'storage_failed';
  return { ok: false, error: { code, message: messages[code] } };
}
export async function result<T>(work: () => Promise<T>): Promise<AiResult<T>> {
  try { return { ok: true, value: await work() }; } catch (error) { return failure(error); }
}
