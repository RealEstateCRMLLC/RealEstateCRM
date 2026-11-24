import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Alerts expose lead names/emails and are writable: authenticated
// workspace session required, scoped through the lead's workspace.
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
 * Search Alerts API
 * Saved property search alerts tied to leads (MLS-style notifications).
 * GET: list alerts (optionally by leadId).
 * POST: create a new alert.
 * DELETE: remove an alert.
 */
export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const activeOnly = searchParams.get('active') === 'true';

  const where: Record<string, unknown> = { lead: { workspaceId: access.workspaceId } };
  if (leadId) where.leadId = leadId;
  if (activeOnly) where.isActive = true;

  const alerts = await prisma.searchAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lead: {
        select: {
          id: true,
          contact: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
    take: 100,
  });

  return NextResponse.json({
    alerts: alerts.map(a => ({
      id: a.id,
      leadId: a.leadId,
      leadName: a.lead?.contact
        ? a.lead.contact.firstName + ' ' + a.lead.contact.lastName
        : 'Unknown',
      criteria: JSON.parse(a.criteria),
      type: a.type,
      frequency: a.frequency,
      isActive: a.isActive,
      createdAt: a.createdAt,
    })),
  });
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leadId, criteria, type, frequency } = body;
  if (!leadId || !criteria) {
    return NextResponse.json({ error: 'leadId and criteria required' }, { status: 400 });
  }

  // FK validation — leadId must reference an existing Lead or Prisma throws P2003 → 500
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.workspaceId !== access.workspaceId) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const alert = await prisma.searchAlert.create({
    data: {
      leadId,
      criteria: typeof criteria === 'string' ? criteria : JSON.stringify(criteria),
      type: type || 'VIEW',
      frequency: frequency || 'DAILY',
    },
  });

  return NextResponse.json({ id: alert.id, created: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const alert = await prisma.searchAlert.findUnique({ where: { id }, include: { lead: { select: { workspaceId: true } } } });
  if (!alert || alert.lead.workspaceId !== access.workspaceId) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  await prisma.searchAlert.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
