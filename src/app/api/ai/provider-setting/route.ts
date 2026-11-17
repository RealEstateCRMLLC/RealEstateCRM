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

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [setting, configured] = await Promise.all([getAiProviderSetting(), configuredProviders()]);
  return NextResponse.json({
    setting,
    configuredProviders: configured,
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
    const reply = await completeWithActiveProvider({
      prompt: 'Reply with exactly: provider-ok',
      system: 'You are a connectivity probe. Follow the instruction exactly.',
      maxTokens: 16,
      temperature: 0,
    });
    if (!reply) {
      return NextResponse.json({ ok: false, error: 'No active provider could complete (check keys / provider selection)' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, reply: reply.trim().slice(0, 120) });
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

  try {
    const setting = await saveAiProviderSetting({ provider, model: body.model });
    return NextResponse.json({ success: true, setting });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save setting' }, { status: 400 });
  }
}
