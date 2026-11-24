import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Partner directory + writes are workspace data: authenticated
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
  const type = searchParams.get('type');

  const partners = await prisma.partner.findMany({
    where: {
      workspaceId: access.workspaceId,
      ...(type && { type }),
      isActive: true,
    },
    include: { referrals: true, permissions: true },
    orderBy: { companyName: 'asc' },
  });
  return NextResponse.json(partners);
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
  const { companyName, contactName, email, phone, type, licenseNumber, address, website, notes } = body;

  if (!companyName || !type) {
    return NextResponse.json({ error: 'companyName, type required' }, { status: 400 });
  }

  const partner = await prisma.partner.create({
    data: { companyName, contactName, email, phone, type, licenseNumber, address, website, notes, workspaceId: access.workspaceId },
  });
  return NextResponse.json(partner, { status: 201 });
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
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing || existing.workspaceId !== access.workspaceId) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  await prisma.partner.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
