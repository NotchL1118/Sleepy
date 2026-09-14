'use server';
import type { AiConnectionInput, AiModelInput, AiPrompts, AiPostGenerationInput } from '@/lib/ai/types';
import { aiService, readAiGenerationAvailability } from './queries';
import { failure } from './errors';

export async function generateAiPostFields(input: AiPostGenerationInput) {
  try { return await (await aiService()).generatePostFields(input); }
  catch (error) { return failure(error); }
}

export async function readAiPostGenerationOptions(postId?: number) {
  try { return await (await aiService()).readPostGenerationOptions(postId); }
  catch (error) { return failure(error); }
}

export async function saveAiModel(input: AiModelInput) {
  try { return await (await aiService()).saveModel(input); }
  catch (error) { return failure(error); }
}
export async function setDefaultAiModel(id: string | null) {
  try { return await (await aiService()).setDefaultModel(id); }
  catch (error) { return failure(error); }
}
export async function deleteAiModel(id: string, revision: number) {
  try { return await (await aiService()).deleteModel(id, revision); }
  catch (error) { return failure(error); }
}
export async function saveAiPreferences(enabled: boolean, prompts: AiPrompts) {
  try { return await (await aiService()).savePreferences(enabled, prompts); }
  catch (error) { return failure(error); }
}
export async function fetchAiModels(input: AiConnectionInput) {
  try { return await (await aiService()).discoverModels(input); }
  catch (error) { return failure(error); }
}
export async function testAiModel(input: AiModelInput) {
  try { return await (await aiService()).testModel(input); }
  catch (error) { return failure(error); }
}
export async function refreshAiGenerationAvailability() {
  return readAiGenerationAvailability();
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
