import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Offers are deal data: authenticated workspace session required,
// scoped to the caller's workspace. This answered anonymously with
// every workspace's offers.
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
  const listingId = searchParams.get('listingId');
  const status = searchParams.get('status');

  const offers = await prisma.offer.findMany({
    where: {
      workspaceId: access.workspaceId,
      ...(listingId && { listingId }),
      ...(status && { status }),
    },
    include: { listing: true, buyer: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(offers);
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
  const { amount, listingId, buyerContactId, agentId, contingencies, closingDate, earnestMoney, notes } = body;

  if (!amount || !listingId || !buyerContactId) {
    return NextResponse.json({ error: 'amount, listingId, buyerContactId required' }, { status: 400 });
  }

  const offer = await prisma.offer.create({
    data: {
      amount, listingId, buyerContactId, agentId,
      contingencies: contingencies ? JSON.stringify(contingencies) : null,
      closingDate: closingDate ? new Date(closingDate) : null,
      earnestMoney, notes, workspaceId: access.workspaceId,
    },
  });
  return NextResponse.json(offer, { status: 201 });
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
  const { id, status, notes, closingDate, earnestMoney } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing || existing.workspaceId !== access.workspaceId) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

  const offer = await prisma.offer.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes && { notes }),
      ...(closingDate && { closingDate: new Date(closingDate) }),
      ...(earnestMoney !== undefined && { earnestMoney }),
    },
  });
  return NextResponse.json(offer);
}
