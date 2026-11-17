/**
 * Active AI provider resolver (server-only).
 *
 * Turns the workspace's provider choice (provider-settings.ts) plus the
 * encrypted key vault into a ready ProviderClient. This is THE single
 * entry point call sites use, so switching providers in Settings
 * (OpenAI / Anthropic / Gemini / DeepSeek / Qwen) changes every AI
 * feature at once. Falls back to the historical behavior when nothing
 * is configured: env DeepSeek key, then any vault key.
 */
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { createProviderClient, type ProviderClient } from './llm-providers';
import { getAiProviderSetting, pickProvider, DEFAULT_MODELS } from './provider-settings';
import { deepSeekCompletion, DEEPSEEK_MODEL } from './deepseek';

export interface ActiveProvider {
  client: ProviderClient;
  provider: string;
  model: string;
  source: 'setting' | 'env' | 'vault' | 'none';
}

async function vaultKeyFor(provider: string): Promise<string | null> {
  try {
    const record = await prisma.apiKey.findUnique({ where: { provider } });
    if (!record) return null;
    return decrypt(record.key);
  } catch {
    return null;
  }
}

export async function getActiveProvider(): Promise<ActiveProvider | null> {
  const setting = await getAiProviderSetting();
  let configured: string[] = [];
  try {
    configured = (await prisma.apiKey.findMany({ select: { provider: true } })).map((k) => k.provider.toLowerCase());
  } catch {
    configured = [];
  }

  const choice = pickProvider(setting, configured, { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY });
  if (choice.source === 'none') return null;

  const key = choice.source === 'env' ? process.env.DEEPSEEK_API_KEY! : await vaultKeyFor(choice.provider);
  if (!key) return null;

  return {
    client: createProviderClient(choice.provider, choice.model, key),
    provider: choice.provider,
    model: choice.model,
    source: choice.source,
  };
}

/**
 * Convenience completion honoring the active provider, with the
 * platform DeepSeek env path preserved for parity. Returns null when
 * no provider is configured (callers fall back to deterministic logic).
 */
export async function completeWithActiveProvider(req: {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string | null> {
  const active = await getActiveProvider();
  if (active) {
    try {
      const result = await active.client.complete(req);
      return result.text;
    } catch (e) {
      console.warn(`[ai] ${active.provider} completion failed, trying DeepSeek env fallback:`, e);
    }
  }
  // Historical fallback: DeepSeek env key via the dedicated helper.
  try {
    if (process.env.DEEPSEEK_API_KEY) {
      return await deepSeekCompletion({ prompt: req.prompt, system: req.system });
    }
  } catch {
    // fall through
  }
  return null;
}

export { DEFAULT_MODELS, DEEPSEEK_MODEL };
