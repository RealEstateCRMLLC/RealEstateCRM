import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUserToken, revokeUserToken, getUserTokenMeta } from '@/lib/mcp/user-tokens';

/**
 * Per-user MCP token management (session-authenticated).
 * GET: whether the signed-in user has a token (+ timestamps, never the token)
 * POST: generate/rotate - returns the plaintext exactly once
 * DELETE: revoke
 */

async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) return null;
  return { userId, email: session.user.email || '' };
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const meta = await getUserTokenMeta(user.userId);
  return NextResponse.json({ hasToken: !!meta, ...(meta || {}) });
}

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { plaintext, record } = await generateUserToken(user.userId, user.email);
  return NextResponse.json({
    success: true,
    token: plaintext,
    createdAt: record.createdAt,
    note: 'Copy this token now - it is shown once and only its hash is stored. Paste it into your AI client as the Bearer token for /api/mcp.',
  });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const revoked = await revokeUserToken(user.userId);
  return NextResponse.json({ success: true, revoked });
}
