import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Access-control settings themselves are workspace data: auth
// required. The PUT previously let anonymous callers rewrite who
// can view leads, deals, and contacts.
async function requireAccess() {
  const session = await getServerSession(authOptions);
  return requireWorkspaceAccess(session);
}

function accessError(e: unknown) {
  const mapped = workspaceErrorResponse(e);
  if (mapped) return mapped;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Partner Permissions API
 * Per-partner access control for leads, deals, contacts, and referrals.
 * GET: fetch permissions for a partner (or all).
 * PUT: upsert permissions.
 */
export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get('partnerId');
  const workspaceId = access.workspaceId;

  const where: Record<string, unknown> = { workspaceId };
  if (partnerId) where.partnerId = partnerId;

  const permissions = await prisma.partnerPermission.findMany({
    where,
    include: {
      partner: { select: { id: true, companyName: true, contactName: true, type: true } },
    },
    take: 100,
  });

  return NextResponse.json({
    permissions: permissions.map(p => ({
      id: p.id,
      partnerId: p.partnerId,
      partnerName: p.partner?.contactName,
      partnerCompany: p.partner?.companyName,
      canViewLeads: p.canViewLeads,
      canViewDeals: p.canViewDeals,
      canViewContacts: p.canViewContacts,
      canCreateReferral: p.canCreateReferral,
      canEditReferral: p.canEditReferral,
    })),
  });
}

export async function PUT(request: NextRequest) {
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { partnerId, workspaceId, ...permissions } = body;
  if (!partnerId) {
    return NextResponse.json({ error: 'partnerId required' }, { status: 400 });
  }

  const wsId = access.workspaceId;
  const data: Record<string, unknown> = {};
  if (permissions.canViewLeads !== undefined) data.canViewLeads = !!permissions.canViewLeads;
  if (permissions.canViewDeals !== undefined) data.canViewDeals = !!permissions.canViewDeals;
  if (permissions.canViewContacts !== undefined) data.canViewContacts = !!permissions.canViewContacts;
  if (permissions.canCreateReferral !== undefined) data.canCreateReferral = !!permissions.canCreateReferral;
  if (permissions.canEditReferral !== undefined) data.canEditReferral = !!permissions.canEditReferral;

  // No unique constraint exists on partnerId, so upsert({where:
  // {partnerId}}) is invalid and always threw. Find-then-write.
  const existing = await prisma.partnerPermission.findFirst({
    where: { partnerId, workspaceId: wsId },
  });
  const perm = existing
    ? await prisma.partnerPermission.update({ where: { id: existing.id }, data })
    : await prisma.partnerPermission.create({
        data: {
          partnerId,
          workspaceId: wsId,
          ...data,
        },
      });

  return NextResponse.json({ id: perm.id, saved: true });
}
