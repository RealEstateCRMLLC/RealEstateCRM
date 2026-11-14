import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, isWorkspaceAccessError } from '@/lib/workspace-access';
import { hasPermission } from '@/lib/permissions';
import { getWorkspaceBranding, DEFAULT_BRANDING } from '@/lib/branding';
import prisma from '@/lib/prisma';
import { SECTOR_PACKS } from '@/lib/universal/sectors';
import { LANGUAGES, ADD_ONS } from '@/lib/universal/platform';
import {
  GENERATION_EXPERIENCES,
  defaultTenantRecord,
  resolveUniversalTenant,
  validateAndSanitizeTenantInput,
} from '@/lib/universal/tenant';
import {
  getStoredTenantRecord,
  saveStoredTenantRecord,
} from '@/lib/universal/tenant-store';

/**
 * Universal CRM Tenant Provisioning API (`workspace -> sector pack -> brand -> language`).
 *
 * - `GET /api/universal/tenant`:
 *     Returns the active workspace's resolved Universal CRM tenant configuration
 *     (merged with live Prisma `WorkspaceBranding`) when signed in, or a public
 *     read-only catalog + default preview when accessed from `/universal` unauthenticated.
 * - `PUT /api/universal/tenant`:
 *     Requires `manage:workspace` permission (`OWNER` / `BROKER` / `ADMIN`).
 *     Validates and persists sector pack, primary language (16 locales incl. RTL),
 *     generation UX preset, compatible United Beats LLC add-ons, custom vocabulary,
 *     and optional white-label brand fields directly onto the Prisma `Workspace`.
 */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const fallbackRecord = defaultTenantRecord('public-preview');
    return NextResponse.json({
      authenticated: false,
      canManage: false,
      resolved: resolveUniversalTenant(fallbackRecord, DEFAULT_BRANDING),
      catalog: {
        sectors: SECTOR_PACKS,
        languages: LANGUAGES,
        addOns: ADD_ONS,
        generations: GENERATION_EXPERIENCES,
      },
    });
  }

  let access;
  try {
    access = await requireWorkspaceAccess(session);
  } catch (err) {
    if (isWorkspaceAccessError(err)) {
      return NextResponse.json({ error: (err as Error).message }, { status: (err as { statusCode?: number }).statusCode ?? 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [branding, stored] = await Promise.all([
      getWorkspaceBranding(access.workspaceId),
      getStoredTenantRecord(access.workspaceId),
    ]);
    const canManage = hasPermission(access.workspaceRole, 'manage:workspace');
    return NextResponse.json({
      authenticated: true,
      canManage,
      workspaceId: access.workspaceId,
      role: access.workspaceRole,
      tenant: stored,
      resolved: resolveUniversalTenant(stored, branding),
      catalog: {
        sectors: SECTOR_PACKS,
        languages: LANGUAGES,
        addOns: ADD_ONS,
        generations: GENERATION_EXPERIENCES,
      },
    });
  } catch (error) {
    console.error('GET /api/universal/tenant error:', error);
    return NextResponse.json({ error: 'Failed to load Universal CRM configuration' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  let access;
  try {
    access = await requireWorkspaceAccess(session);
  } catch (err) {
    if (isWorkspaceAccessError(err)) {
      return NextResponse.json({ error: (err as Error).message }, { status: (err as { statusCode?: number }).statusCode ?? 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(access.workspaceRole, 'manage:workspace')) {
    return NextResponse.json(
      { error: 'Owner, Broker, or Admin role required to provision workspace sector and locale' },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateAndSanitizeTenantInput(body, access.workspaceId);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Optional white-label brand fields updated atomically on Prisma Workspace
    if (body.brand && typeof body.brand === 'object') {
      const brandInput = body.brand as Record<string, unknown>;
      const brandUpdate: Record<string, unknown> = {};

      if (brandInput.name !== undefined) {
        if (typeof brandInput.name !== 'string' || !brandInput.name.trim()) {
          return NextResponse.json({ error: 'Business / workspace name cannot be empty' }, { status: 400 });
        }
        brandUpdate.name = brandInput.name.trim().slice(0, 120);
      }
      if (brandInput.primaryColor !== undefined) {
        if (typeof brandInput.primaryColor !== 'string' || !HEX_COLOR.test(brandInput.primaryColor)) {
          return NextResponse.json({ error: 'primaryColor must be a 6-digit hex color like #2563eb' }, { status: 400 });
        }
        brandUpdate.primaryColor = brandInput.primaryColor;
      }
      if (brandInput.accentColor !== undefined) {
        if (typeof brandInput.accentColor !== 'string' || !HEX_COLOR.test(brandInput.accentColor)) {
          return NextResponse.json({ error: 'accentColor must be a 6-digit hex color like #d4af37' }, { status: 400 });
        }
        brandUpdate.accentColor = brandInput.accentColor;
      }
      if (brandInput.logoUrl !== undefined) {
        const rawLogo = typeof brandInput.logoUrl === 'string' ? brandInput.logoUrl.trim() : '';
        if (rawLogo && !/^https?:\/\//i.test(rawLogo) && !rawLogo.startsWith('/')) {
          return NextResponse.json({ error: 'logoUrl must be an http(s) URL or root-relative path' }, { status: 400 });
        }
        brandUpdate.logoUrl = rawLogo || null;
      }
      if (brandInput.portalSlug !== undefined) {
        const rawSlug = typeof brandInput.portalSlug === 'string' ? brandInput.portalSlug.trim().toLowerCase() : '';
        if (rawSlug) {
          if (!SLUG_PATTERN.test(rawSlug)) {
            return NextResponse.json(
              { error: 'Portal slug must be 3-64 chars of lowercase letters, numbers, and hyphens' },
              { status: 400 },
            );
          }
          const collision = await prisma.workspace.findFirst({
            where: { portalSlug: rawSlug, id: { not: access.workspaceId } },
            select: { id: true },
          });
          if (collision) {
            return NextResponse.json({ error: 'That portal slug is already in use by another workspace' }, { status: 409 });
          }
        }
        brandUpdate.portalSlug = rawSlug || null;
      }

      if (Object.keys(brandUpdate).length > 0) {
        await prisma.workspace.update({
          where: { id: access.workspaceId },
          data: brandUpdate,
        });
      }
    }

    const actorEmail = session?.user?.email || access.userId;
    const saved = await saveStoredTenantRecord({
      ...validation.record,
      updatedBy: actorEmail,
    });
    const branding = await getWorkspaceBranding(access.workspaceId);

    return NextResponse.json({
      tenant: saved,
      resolved: resolveUniversalTenant(saved, branding),
    });
  } catch (error) {
    console.error('PUT /api/universal/tenant error:', error);
    return NextResponse.json({ error: 'Failed to save Universal CRM configuration' }, { status: 500 });
  }
}
