'use server';
import type { AiModelInput, AiPrompts } from '@/lib/ai/types';
import { aiService } from './queries';

export async function saveAiModel(input: AiModelInput) {
  return (await aiService()).saveModel(input);
}
export async function setDefaultAiModel(id: string | null) {
  return (await aiService()).setDefaultModel(id);
}
export async function setAiEnabled(enabled: boolean) {
  return (await aiService()).setEnabled(enabled);
}
export async function updateAiPrompts(prompts: AiPrompts) {
  return (await aiService()).updatePrompts(prompts);
}
export async function testAiConnection(id: string) {
  return (await aiService()).testConnection(id);
}
export async function rotateAiCredentials() {
  return (await aiService()).rotateCredentials();
}
export async function readAiCredentialVersions() {
  return (await aiService()).credentialVersions();
}
