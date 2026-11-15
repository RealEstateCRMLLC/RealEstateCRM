import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/workspace-access';
import { objectsToCsv } from '@/lib/csv-export';

const FORECLOSURE_COLUMNS = [
  'record_type',
  'id',
  'county',
  'notice_type',
  'published_date',
  'sale_date',
  'mortgagor_name',
  'property_address',
  'city',
  'zip',
  'amount_due',
  'parcel_id',
  'law_firm',
  'status',
  'confidence',
  'tags',
  'updated_at',
] as const;

const DEALS_COLUMNS = [
  'id',
  'title',
  'stage',
  'value_usd',
  'contact_name',
  'contact_email',
  'contact_phone',
  'created_at',
  'updated_at',
] as const;

const LEADS_COLUMNS = [
  'id',
  'name',
  'email',
  'phone',
  'type',
  'status',
  'source',
  'score',
  'tags',
  'created_at',
] as const;

const CONTACTS_COLUMNS = [
  'id',
  'first_name',
  'last_name',
  'email',
  'phone',
  'address',
  'leads_count',
  'deals_count',
  'created_at',
] as const;

function parseSessionDraft(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as { draft?: Record<string, string> } & Record<string, unknown>;
    if (parsed && typeof parsed.draft === 'object' && parsed.draft !== null) {
      return parsed.draft;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * GET /api/export?entity=foreclosures|deals|leads|contacts
 * Workspace-scoped RFC-4180 CSV download for brokerage pipeline, leads, contacts, and parsed foreclosure records.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaceId: string;
  try {
    const access = await requireWorkspaceAccess(session);
    workspaceId = access.workspaceId;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entity = (request.nextUrl.searchParams.get('entity') || 'leads').toLowerCase();
  const dateStamp = new Date().toISOString().split('T')[0];

  try {
    if (entity === 'deals') {
      const deals = await prisma.deal.findMany({
        where: { workspaceId },
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
      });
      const rows = deals.map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value_usd: d.value ?? '',
        contact_name: `${d.contact?.firstName || ''} ${d.contact?.lastName || ''}`.trim(),
        contact_email: d.contact?.email || '',
        contact_phone: d.contact?.phone || '',
        created_at: d.createdAt.toISOString(),
        updated_at: d.updatedAt.toISOString(),
      }));
      const csv = objectsToCsv(rows, DEALS_COLUMNS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="crm-deals-${dateStamp}.csv"`,
        },
      });
    }

    if (entity === 'foreclosures') {
      const [sessions, foreclosureLeads] = await Promise.all([
        prisma.workflowSession.findMany({
          where: {
            workspaceId,
            type: { startsWith: 'foreclosure-intake' },
          },
          include: {
            lead: { include: { contact: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.lead.findMany({
          where: {
            workspaceId,
            OR: [
              { status: 'PREFORECLOSURE' },
              { tags: { contains: 'Foreclosure' } },
              { tags: { contains: 'foreclosure' } },
              { source: { contains: 'Foreclosure' } },
              { source: { contains: 'Legal News' } },
            ],
          },
          include: { contact: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      const rows: Record<string, unknown>[] = [];
      for (const s of sessions) {
        const draft = parseSessionDraft(s.data);
        const fallbackName = s.lead?.contact
          ? `${s.lead.contact.firstName} ${s.lead.contact.lastName || ''}`.trim()
          : '';
        rows.push({
          record_type: 'workflow_session',
          id: s.id,
          county: draft.county || 'Macomb',
          notice_type: draft.noticeType || '',
          published_date: draft.publishedDate || '',
          sale_date: draft.saleDate || '',
          mortgagor_name: draft.mortgagorName || fallbackName,
          property_address: draft.propertyAddress || s.lead?.contact?.address || '',
          city: draft.city || '',
          zip: draft.zip || '',
          amount_due: draft.amountDueText || '',
          parcel_id: draft.parcelId || '',
          law_firm: draft.lawFirm || '',
          status: draft.leadStatus || s.status,
          confidence: draft.confidence || '',
          tags: draft.tags || '',
          updated_at: s.updatedAt.toISOString(),
        });
      }

      for (const l of foreclosureLeads) {
        rows.push({
          record_type: 'foreclosure_lead',
          id: l.id,
          county: '',
          notice_type: l.source || 'Foreclosure Lead',
          published_date: '',
          sale_date: '',
          mortgagor_name: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim(),
          property_address: l.contact?.address || '',
          city: '',
          zip: '',
          amount_due: '',
          parcel_id: '',
          law_firm: '',
          status: l.status,
          confidence: '',
          tags: l.tags || '',
          updated_at: l.updatedAt.toISOString(),
        });
      }

      const csv = objectsToCsv(rows, FORECLOSURE_COLUMNS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="crm-foreclosures-${dateStamp}.csv"`,
        },
      });
    }

    if (entity === 'contacts') {
      const contacts = await prisma.contact.findMany({
        where: { workspaceId },
        include: {
          _count: { select: { leads: true, deals: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const rows = contacts.map((c) => ({
        id: c.id,
        first_name: c.firstName,
        last_name: c.lastName || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        leads_count: c._count.leads,
        deals_count: c._count.deals,
        created_at: c.createdAt.toISOString(),
      }));
      const csv = objectsToCsv(rows, CONTACTS_COLUMNS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="crm-contacts-${dateStamp}.csv"`,
        },
      });
    }

    if (entity === 'leads') {
      const leads = await prisma.lead.findMany({
        where: { workspaceId },
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
      });
      const rows = leads.map((l) => ({
        id: l.id,
        name: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim(),
        email: l.contact?.email || '',
        phone: l.contact?.phone || '',
        type: l.type,
        status: l.status,
        source: l.source || '',
        score: l.score ?? 0,
        tags: l.tags || '',
        created_at: l.createdAt.toISOString(),
      }));
      const csv = objectsToCsv(rows, LEADS_COLUMNS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="crm-leads-${dateStamp}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: `Unsupported export entity: ${entity}. Expected deals, leads, foreclosures, or contacts.` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Workspace CSV export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

/**
 * Asset Export API
 * POST /api/export — export content/assets in various formats (`csv`, `json`, `text`).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { type, format, data, filename } = body;

    if (!data || !format) {
      return NextResponse.json({ error: 'data and format are required' }, { status: 400 });
    }

    let content: string;
    let contentType: string;
    let ext: string;

    switch (format) {
      case 'csv': {
        if (!Array.isArray(data) || data.length === 0) {
          return NextResponse.json({ error: 'CSV export requires an array of objects' }, { status: 400 });
        }
        content = objectsToCsv(data as Record<string, unknown>[]);
        contentType = 'text/csv; charset=utf-8';
        ext = 'csv';
        break;
      }

      case 'json': {
        content = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        ext = 'json';
        break;
      }

      case 'text': {
        content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        contentType = 'text/plain';
        ext = 'txt';
        break;
      }

      default:
        return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
    }

    const exportFilename = filename || `${type || 'export'}-${new Date().toISOString().split('T')[0]}.${ext}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${exportFilename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
