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
import { deepSeekCompletion, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL } from './deepseek';

export interface ActiveProvider {
  client: ProviderClient;
  provider: string;
  model: string;
  source: 'setting' | 'env' | 'vault' | 'none';
  /** Resolved API key (server-only; never serialize into a response). */
  apiKey: string;
}

async function vaultKeyFor(provider: string): Promise<string | null> {
  let record;
  try {
    record = await prisma.apiKey.findUnique({ where: { provider } });
  } catch {
    return null;
  }
  if (!record) return null;
  try {
    return decrypt(record.key);
  } catch {
    // A stored key that cannot be decrypted (e.g. saved under a
    // rotated ENCRYPTION_SECRET, or a dev-seeded fixture) must not
    // silently read as "no key configured" — that made prod report
    // OpenAI active while every completion quietly ran DeepSeek.
    console.error(`[ai] stored ${provider} key could not be decrypted; re-save it in Settings → AI Models`);
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
    apiKey: key,
  };
}

/**
 * OpenAI-compatible chat endpoint for the dashboard chat (/api/chat),
 * resolved from the SAME active-provider choice as every other call
 * site — the chat follows the Settings provider switch, it does not
 * stay hardwired to DeepSeek. The route speaks the Chat Completions
 * API directly because the installed AI SDK packages are mutually
 * incompatible (ai@3.1 core rejects @ai-sdk/openai@1.3 stream parts —
 * "Unhandled chunk type: response-metadata"), while the raw HTTP
 * contract is stable across OpenAI, DeepSeek, Qwen, and Gemini's
 * OpenAI-compatible endpoint. Anthropic's Messages API is not
 * Chat-Completions-shaped, so it returns null here and the route
 * falls back to a plain completion via completeWithActiveProvider.
 */
const CHAT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: DEEPSEEK_BASE_URL,
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
};

export type ActiveChatEndpoint =
  | { endpoint: { provider: string; model: string; apiKey: string; baseUrl: string }; reason: 'ok' }
  | { endpoint: null; reason: 'anthropic'; provider: string }
  | { endpoint: null; reason: 'no-key'; provider: string }
  | { endpoint: null; reason: 'unconfigured' };

export async function getActiveChatEndpoint(): Promise<ActiveChatEndpoint> {
  const setting = await getAiProviderSetting();
  const active = await getActiveProvider();
  if (!active) {
    // An explicit Settings choice whose key cannot be loaded is a
    // configuration error the user must see, not a silent downgrade.
    return setting
      ? { endpoint: null, reason: 'no-key', provider: setting.provider }
      : { endpoint: null, reason: 'unconfigured' };
  }
  const baseUrl = CHAT_BASE_URLS[active.provider];
  if (!baseUrl) return { endpoint: null, reason: 'anthropic', provider: active.provider };
  return {
    endpoint: { provider: active.provider, model: active.model, apiKey: active.apiKey, baseUrl },
    reason: 'ok',
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
