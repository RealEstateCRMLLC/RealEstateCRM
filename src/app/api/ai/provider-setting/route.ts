import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  getAiProviderSetting,
  saveAiProviderSetting,
  SUPPORTED_PROVIDERS,
  DEFAULT_MODELS,
} from '@/lib/ai/provider-settings';
import { completeWithActiveProvider } from '@/lib/ai/active-provider';
import { decrypt } from '@/lib/encryption';

/**
 * Active AI provider selection.
 * GET: current setting + which providers have vault keys (switchable list)
 * POST {provider, model?}: set the active provider (must be configured,
 *        unless it is DeepSeek with an env key)
 * POST {action:'test'}: one tiny completion through the active provider
 *        so the operator can verify the switch end-to-end.
 */

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

async function configuredProviders(): Promise<string[]> {
  try {
    const keys = await prisma.apiKey.findMany({ select: { provider: true } });
    return keys.map((k) => k.provider.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Per-provider key health: can the stored key actually be decrypted in
 * THIS environment? A row can exist yet be unreadable (saved under a
 * rotated ENCRYPTION_SECRET, or a dev-seeded fixture) — presenting it
 * as a working configured key made the UI claim OpenAI was ready while
 * every call silently fell back. Health is a boolean probe only; key
 * material never leaves the server.
 */
async function keyHealthFor(providers: string[]): Promise<Record<string, 'ok' | 'unreadable'>> {
  const health: Record<string, 'ok' | 'unreadable'> = {};
  if (providers.length === 0) return health;
  try {
    const rows = await prisma.apiKey.findMany({ select: { provider: true, key: true } });
    for (const row of rows) {
      const id = row.provider.toLowerCase();
      if (!providers.includes(id)) continue;
      try {
        decrypt(row.key);
        health[id] = 'ok';
      } catch {
        health[id] = 'unreadable';
      }
    }
  } catch {
    // DB unreachable: report no health rather than guessing.
  }
  return health;
}

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [setting, configured] = await Promise.all([getAiProviderSetting(), configuredProviders()]);
  const keyHealth = await keyHealthFor(configured);
  return NextResponse.json({
    setting,
    configuredProviders: configured,
    keyHealth,
    envProviders: process.env.DEEPSEEK_API_KEY ? ['deepseek'] : [],
    supported: SUPPORTED_PROVIDERS.map((p) => ({ id: p, defaultModel: DEFAULT_MODELS[p] })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { provider?: string; model?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'test') {
    // Reasoning models spend part of the token budget thinking, so a
    // 16-token probe truncates the visible answer and "succeeds" with
    // reasoning fragments. Give it room and verify the marker actually
    // came back before declaring the provider healthy.
    const reply = await completeWithActiveProvider({
      prompt: 'Reply with exactly: provider-ok',
      system: 'You are a connectivity probe. Follow the instruction exactly.',
      maxTokens: 512,
      temperature: 0,
    });
    if (!reply) {
      return NextResponse.json({ ok: false, error: 'No active provider could complete (check keys / provider selection)' }, { status: 502 });
    }
    const trimmed = reply.trim().slice(0, 120);
    if (!trimmed.toLowerCase().includes('provider-ok')) {
      return NextResponse.json(
        { ok: false, error: 'The active provider answered but did not return the expected marker.', reply: trimmed },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, reply: trimmed });
  }

  if (!body.provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const provider = body.provider.toLowerCase();
  const configured = await configuredProviders();
  const switchable = configured.includes(provider) || (provider === 'deepseek' && !!process.env.DEEPSEEK_API_KEY);
  if (!switchable) {
    return NextResponse.json(
      { error: `Provider "${provider}" has no key configured. Add its key above first.` },
      { status: 400 },
    );
  }

  // A stored-but-undecryptable key must not become the active provider:
  // switching to it would silently degrade every AI feature. The
  // DeepSeek env-key path has no vault row, so it is exempt.
  if (configured.includes(provider)) {
    const health = await keyHealthFor([provider]);
    if (health[provider] === 'unreadable') {
      return NextResponse.json(
        { error: `Provider "${provider}" has a stored key that cannot be decrypted in this environment. Re-save its key above, then switch.` },
        { status: 400 },
      );
    }
  }

  try {
    const setting = await saveAiProviderSetting({ provider, model: body.model });
    return NextResponse.json({ success: true, setting });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save setting' }, { status: 400 });
  }
}
