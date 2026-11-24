import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, workspaceErrorResponse } from '@/lib/workspace-access';

// Published-site lookup by slug stays public (that is how agent
// websites are served). Everything else — listing all sites incl.
// drafts, creating, editing — is workspace data and requires an
// authenticated session. Those answered anonymously.
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
  const workspaceId = searchParams.get('workspaceId');
  const slug = searchParams.get('slug');

  if (slug) {
    // Public endpoint for published site
    const site = await prisma.agentSite.findUnique({
      where: { slug },
      include: { template: true, user: { select: { name: true, email: true, image: true } } },
    });
    if (!site || !site.isPublished) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    return NextResponse.json(site);
  }

  let access;
  try {
    access = await requireAccess();
  } catch (e) {
    return accessError(e);
  }
  const sites = await prisma.agentSite.findMany({
    where: { workspaceId: access.workspaceId },
    include: { template: true, user: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(sites);
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
  const { slug, title, content, domain, templateId } = body;

  if (!slug || !title) {
    return NextResponse.json({ error: 'slug, title required' }, { status: 400 });
  }

  const site = await prisma.agentSite.create({
    data: {
      slug, title,
      content: content ? JSON.stringify(content) : null,
      domain, templateId, userId: access.userId, workspaceId: access.workspaceId,
    },
  });
  return NextResponse.json(site, { status: 201 });
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
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // P2025 guard — update on missing id throws → 500
  const existing = await prisma.agentSite.findUnique({ where: { id } });
  if (!existing || existing.workspaceId !== access.workspaceId) return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  // Never let the body move a site across workspaces or owners.
  delete data.workspaceId;
  delete data.userId;
  if (data.content) data.content = JSON.stringify(data.content);
  const site = await prisma.agentSite.update({ where: { id }, data });
  return NextResponse.json(site);
}
