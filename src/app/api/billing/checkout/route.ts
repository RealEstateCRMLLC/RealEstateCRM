import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess, isWorkspaceAccessError } from '@/lib/workspace-access';
import { hasPermission } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { syncContactToVectorStore, syncLeadToVectorStore } from '@/lib/rag';
import {
  TSF_SKUS,
  UNIVERSAL_PLATFORM_BASE_MONTHLY_USD,
  buildBillingQuote,
  generateInvoiceRef,
  type BillingKind,
  type BillingLineItem,
} from '@/lib/billing/checkout';
import {
  appendBillingOrder,
  listBillingOrders,
  type BillingOrderRecord,
} from '@/lib/billing/order-store';

/**
 * Unified Checkout & Invoice Provisioning API (`/api/billing/checkout`).
 *
 * - When `STRIPE_SECRET_KEY` is present in `.env`, creates a live Stripe Checkout
 *   Session (`mode=payment` for one-time TSF packages; `mode=subscription` for
 *   recurring Universal CRM workspaces & add-ons) and returns `checkoutUrl`.
 * - When `STRIPE_SECRET_KEY` is not yet set, generates an itemized official
 *   invoice (`INV-UB-YYYYMMDD-XXXX`) payable via Bank Transfer (Mercury ACH/Wire)
 *   or Check payable to United Beats LLC, while creating the corresponding CRM
 *   `Contact`, `Lead`, and `Deal` (`stage: "PROPOSAL"`) immediately so zero revenue
 *   intent is ever lost.
 */

function resolvePublicOrigin(req: NextRequest): string {
  const configured =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://excellegacyrealtygroup.site';
  return configured.replace(/\/+$/, '');
}

async function createStripeCheckoutSession(params: {
  secretKey: string;
  origin: string;
  invoiceRef: string;
  customerEmail: string;
  kind: BillingKind;
  items: BillingLineItem[];
  dealId: string;
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams();
  const stripeMode = params.kind === 'tsf' ? 'payment' : 'subscription';
  const returnPath = params.kind === 'tsf' ? '/trust-services' : '/universal';

  form.set('mode', stripeMode);
  form.set('client_reference_id', params.invoiceRef);
  form.set('customer_email', params.customerEmail);
  form.set('success_url', `${params.origin}${returnPath}?checkout=success&ref=${encodeURIComponent(params.invoiceRef)}`);
  form.set('cancel_url', `${params.origin}${returnPath}?checkout=canceled&ref=${encodeURIComponent(params.invoiceRef)}`);
  form.set('metadata[invoiceRef]', params.invoiceRef);
  form.set('metadata[dealId]', params.dealId);
  form.set('metadata[kind]', params.kind);

  params.items.forEach((item, idx) => {
    const prefix = `line_items[${idx}]`;
    form.set(`${prefix}[quantity]`, '1');
    form.set(`${prefix}[price_data][currency]`, 'usd');
    form.set(`${prefix}[price_data][unit_amount]`, String(Math.round(item.amountUsd * 100)));
    form.set(`${prefix}[price_data][product_data][name]`, item.name);
    form.set(`${prefix}[price_data][product_data][description]`, item.description.slice(0, 240));
    if (stripeMode === 'subscription') {
      form.set(`${prefix}[price_data][recurring][interval]`, 'month');
    }
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await res.json();
  if (!res.ok || !payload?.url || !payload?.id) {
    throw new Error(payload?.error?.message || `Stripe HTTP ${res.status}`);
  }
  return { id: String(payload.id), url: String(payload.url) };
}

export async function GET() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const session = await getServerSession(authOptions);

  let recentOrders: BillingOrderRecord[] | undefined;
  if (session?.user) {
    try {
      const ctx = await requireWorkspaceAccess(session);
      if (hasPermission(ctx.workspaceRole, 'manage:workspace')) {
        const all = await listBillingOrders();
        recentOrders = all
          .filter((o) => o.workspaceId === ctx.workspaceId)
          .slice(0, 25);
      }
    } catch (err) {
      if (!isWorkspaceAccessError(err)) {
        console.warn('Billing GET workspace lookup skipped:', err);
      }
    }
  }

  return NextResponse.json({
    stripeConfigured,
    mercuryFallbackEnabled: true,
    payee: 'United Beats LLC',
    acceptedFallbackMethods: [
      'Bank Transfer (Mercury ACH / Wire) payable to United Beats LLC',
      'Check payable to United Beats LLC',
    ],
    platformBaseMonthlyUsd: UNIVERSAL_PLATFORM_BASE_MONTHLY_USD,
    tsfSkus: Object.values(TSF_SKUS),
    ...(recentOrders ? { recentOrders } : {}),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!customerName || !customerEmail || !customerEmail.includes('@')) {
    return NextResponse.json(
      { ok: false, error: 'Valid customerName and customerEmail are required.' },
      { status: 400 },
    );
  }

  const kind = body.kind === 'tsf' || body.kind === 'universal' ? body.kind : null;
  if (!kind) {
    return NextResponse.json(
      { ok: false, error: 'Field "kind" must be "tsf" or "universal".' },
      { status: 400 },
    );
  }

  const quoteResult = buildBillingQuote({
    kind,
    tsfSkuId: typeof body.tsfSkuId === 'string' ? body.tsfSkuId.trim() : undefined,
    sectorId: typeof body.sectorId === 'string' ? body.sectorId.trim() : undefined,
    language: typeof body.language === 'string' ? body.language.trim() : undefined,
    addOnIds: Array.isArray(body.addOnIds)
      ? body.addOnIds.filter((x): x is string => typeof x === 'string')
      : undefined,
    includePlatformBase:
      typeof body.includePlatformBase === 'boolean' ? body.includePlatformBase : true,
  });

  if (!quoteResult.ok) {
    return NextResponse.json({ ok: false, error: quoteResult.error }, { status: 400 });
  }

  const { quote } = quoteResult;

  // Resolve target workspace (authenticated workspace if signed in, else primary workspace)
  let workspaceId: string | null = null;
  let userId: string | null = null;
  const session = await getServerSession(authOptions);
  if (session?.user) {
    try {
      const ctx = await requireWorkspaceAccess(session);
      workspaceId = ctx.workspaceId;
      userId = ctx.userId;
    } catch {
      // Fall back to default workspace below
    }
  }
  if (!workspaceId) {
    const primary = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!primary) {
      return NextResponse.json({ ok: false, error: 'No workspace configured.' }, { status: 500 });
    }
    workspaceId = primary.id;
  }

  const invoiceRef = generateInvoiceRef(new Date(), crypto.randomBytes(2).toString('hex'));

  // Create or reuse Contact + create CRM Lead + PROPOSAL Deal
  const parts = customerName.split(/\s+/);
  const firstName = parts[0] || 'Client';
  const lastName = parts.slice(1).join(' ') || null;

  let contact = await prisma.contact.findFirst({
    where: { workspaceId, email: customerEmail },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email: customerEmail,
        phone: customerPhone || null,
        workspaceId,
        userId,
      },
    });
  } else if (customerPhone && !contact.phone) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { phone: customerPhone },
    });
  }

  const sourceLabel =
    kind === 'tsf' ? 'TSF Checkout / Invoice' : 'Universal CRM B2B Checkout';

  const lead = await prisma.lead.create({
    data: {
      status: 'NEW',
      score: 90,
      source: sourceLabel,
      type: 'BUYER',
      workspaceId,
      contactId: contact.id,
      userId,
      tags: kind === 'tsf' ? '#TSF,#Checkout' : `#UniversalCRM,#${quote.sectorId || 'B2B'}`,
    },
  });

  const dealTitle = companyName
    ? `${companyName} — ${quote.summaryTitle} (${invoiceRef})`
    : `${customerName} — ${quote.summaryTitle} (${invoiceRef})`;

  const deal = await prisma.deal.create({
    data: {
      title: dealTitle,
      value: quote.dealValueUsd,
      stage: 'PROPOSAL',
      workspaceId,
      contactId: contact.id,
      userId,
    },
  });

  const itemizedSummary = quote.items
    .map(
      (i) =>
        `- ${i.name}: $${i.amountUsd}${i.interval === 'month' ? '/mo' : ' one-time'}`,
    )
    .join('\n');

  await prisma.activity.create({
    data: {
      type: 'NOTE',
      content:
        `Checkout / Invoice Created (${invoiceRef})\n` +
        `Payee: ${quote.payee}\n` +
        (companyName ? `Organization: ${companyName}\n` : '') +
        `${itemizedSummary}\n` +
        (notes ? `Customer Notes: ${notes}` : ''),
      workspaceId,
      userId,
      leadId: lead.id,
      dealId: deal.id,
      contactId: contact.id,
    },
  });

  void Promise.all([
    syncContactToVectorStore(contact),
    syncLeadToVectorStore(lead, contact),
  ]).catch(() => null);

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  let mode: 'stripe' | 'invoice' = 'invoice';
  let stripeSessionId: string | undefined;
  let stripeCheckoutUrl: string | undefined;

  if (stripeSecret) {
    try {
      const origin = resolvePublicOrigin(req);
      const stripeSession = await createStripeCheckoutSession({
        secretKey: stripeSecret,
        origin,
        invoiceRef,
        customerEmail,
        kind,
        items: quote.items,
        dealId: deal.id,
      });
      mode = 'stripe';
      stripeSessionId = stripeSession.id;
      stripeCheckoutUrl = stripeSession.url;
    } catch (err) {
      console.error('[Billing Checkout] Stripe session creation failed; issuing invoice fallback:', err);
      mode = 'invoice';
    }
  }

  const order: BillingOrderRecord = {
    id: crypto.randomUUID(),
    invoiceRef,
    kind,
    mode,
    status: mode === 'stripe' ? 'STRIPE_PENDING' : 'INVOICED',
    payee: quote.payee,
    workspaceId,
    sectorId: quote.sectorId,
    language: typeof body.language === 'string' ? body.language.trim() : 'en',
    customer: {
      name: customerName,
      email: customerEmail,
      ...(customerPhone ? { phone: customerPhone } : {}),
      ...(companyName ? { companyName } : {}),
    },
    items: quote.items,
    oneTimeTotalUsd: quote.oneTimeTotalUsd,
    monthlyTotalUsd: quote.monthlyTotalUsd,
    dealValueUsd: quote.dealValueUsd,
    dealId: deal.id,
    leadId: lead.id,
    ...(stripeSessionId ? { stripeSessionId } : {}),
    ...(stripeCheckoutUrl ? { stripeCheckoutUrl } : {}),
    ...(notes ? { notes } : {}),
    createdAt: new Date().toISOString(),
  };

  await appendBillingOrder(order);

  return NextResponse.json({
    ok: true,
    mode,
    ...(stripeCheckoutUrl ? { checkoutUrl: stripeCheckoutUrl } : {}),
    order,
    paymentInstructions: {
      payee: 'United Beats LLC',
      serviceEntity: quote.payee,
      methods: [
        'Bank Transfer (Mercury ACH / Wire) payable to United Beats LLC — reference ' + invoiceRef,
        'Check payable to United Beats LLC — memo ' + invoiceRef,
      ],
      note: stripeSecret
        ? 'Online card checkout initialized via Stripe.'
        : 'Your invoice and CRM proposal are active immediately. Our team will email Mercury ACH routing instructions for ' +
          invoiceRef +
          ' (online card checkout activates automatically when Stripe keys are enabled).',
    },
  });
}
