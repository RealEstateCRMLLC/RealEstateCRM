import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Token-based portal access (below) is the public client flow and
// stays open. Listing all portals and creating them are workspace
// operations: authenticated session required. The list previously
// exposed every portal with contact details anonymously.
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
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (token) {
    // Public endpoint for client portal access
    const portal = await prisma.clientPortal.findUnique({
      where: { token },
      include: {
        contact: true,
        workspace: true,
      },
    });
    if (!portal || !portal.isActive || (portal.expiresAt && portal.expiresAt < new Date())) {
      return NextResponse.json({ error: 'Portal not found or expired' }, { status: 404 });
    }
    // Return limited data for the client
    const listings = await prisma.listing.findMany({
      where: { workspaceId: portal.workspaceId, status: 'ACTIVE' },
      select: { id: true, address: true, listPrice: true, bedrooms: true, bathrooms: true, squareFeet: true, photos: true, status: true },
    });
    return NextResponse.json({ portal: { title: portal.title, contactName: portal.contact.firstName }, listings });
  }

  const workspaceId = searchParams.get('workspaceId');
  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const portals = await prisma.clientPortal.findMany({
    where: { workspaceId: access.workspaceId, isActive: true },
    include: { contact: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(portals);
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
  const { contactId, title, expiresAt } = body;

  if (!contactId) {
    return NextResponse.json({ error: 'contactId required' }, { status: 400 });
  }

  const portal = await prisma.clientPortal.create({
    data: {
      contactId, title, workspaceId: access.workspaceId,
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
  return NextResponse.json(portal, { status: 201 });
}
