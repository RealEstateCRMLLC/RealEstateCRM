import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Referrals carry contact/deal data: authenticated workspace
// session required, scoped to the caller's workspace.
async function requireAccess() {
  const session = await getServerSession(authOptions);
  return requireWorkspaceAccess(session);
}

function accessError(e: unknown) {
  const mapped = workspaceErrorResponse(e);
  if (mapped) return mapped;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const referrals = await prisma.referral.findMany({
    where: {
      workspaceId: access.workspaceId,
      ...(status && { status }),
    },
    include: { partner: true, lead: { include: { contact: true } }, deal: true, contact: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(referrals);
}

export async function POST(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  const { type, partnerId, leadId, dealId, contactId, commissionRate, notes } = body;

  if (!type || !partnerId) {
    return NextResponse.json({ error: 'type, partnerId required' }, { status: 400 });
  }

  const referral = await prisma.referral.create({
    data: { type, partnerId, leadId, dealId, contactId, commissionRate, notes, workspaceId: access.workspaceId },
  });
  return NextResponse.json(referral, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  const { id, status, commissionRate, notes } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const existing = await prisma.referral.findUnique({ where: { id } });
  if (!existing || existing.workspaceId !== access.workspaceId) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });

  const referral = await prisma.referral.update({
    where: { id },
    data: { ...(status && { status }), ...(commissionRate !== undefined && { commissionRate }), ...(notes && { notes }) },
  });
  return NextResponse.json(referral);
}
