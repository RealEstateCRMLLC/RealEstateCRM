/**
 * Active AI provider setting (server-only).
 *
 * Why: provider clients exist for OpenAI/Anthropic/Gemini/DeepSeek/Qwen
 * and keys live in the encrypted vault, but call sites hardcoded
 * DeepSeek-first - there was no way to SWITCH the platform's active
 * provider. This store holds the workspace's chosen provider + model;
 * the resolver (active-provider.ts) turns it into a client.
 *
 * Storage follows the codebase's zero-migration hybrid pattern
 * (cf. universal tenant-store): a JSON file under data/, server-only.
 */
import { promises as fs } from 'fs';
import path from 'path';

export interface AiProviderSetting {
  provider: string;
  model: string;
  updatedAt: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'ai-provider.json');

export const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini', 'deepseek', 'qwen'] as const;

export const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen-plus',
};

export async function getAiProviderSetting(): Promise<AiProviderSetting | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AiProviderSetting;
    if (!parsed || typeof parsed.provider !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveAiProviderSetting(input: { provider: string; model?: string }): Promise<AiProviderSetting> {
  const provider = input.provider.toLowerCase();
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`Unsupported provider: ${input.provider}`);
  }
  const setting: AiProviderSetting = {
    provider,
    model: (input.model || '').trim() || DEFAULT_MODELS[provider],
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(setting, null, 2), 'utf8');
  return setting;
}

/**
 * Pure provider choice (unit-tested): explicit setting wins; otherwise
 * keep the historical behavior - env DeepSeek, then any configured
 * vault provider in DeepSeek/OpenAI preference order.
 */
export function pickProvider(
  setting: AiProviderSetting | null,
  configuredProviders: string[],
  env: { DEEPSEEK_API_KEY?: string },
): { provider: string; model: string; source: 'setting' | 'env' | 'vault' | 'none' } {
  if (setting && configuredProviders.includes(setting.provider)) {
    return { provider: setting.provider, model: setting.model || DEFAULT_MODELS[setting.provider], source: 'setting' };
  }
  if (env.DEEPSEEK_API_KEY) {
    return { provider: 'deepseek', model: DEFAULT_MODELS.deepseek, source: 'env' };
  }
  for (const p of ['deepseek', 'openai', 'anthropic', 'gemini', 'qwen']) {
    if (configuredProviders.includes(p)) {
      return { provider: p, model: DEFAULT_MODELS[p], source: 'vault' };
    }
  }
  return { provider: '', model: '', source: 'none' };
}
