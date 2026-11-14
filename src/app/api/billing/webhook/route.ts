import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  markBillingOrderPaid,
  verifyStripeWebhookSignature,
} from '@/lib/billing/order-store';

/**
 * Stripe Webhook Receiver (`POST /api/billing/webhook`).
 *
 * Validates `stripe-signature` using HMAC-SHA256 (`STRIPE_WEBHOOK_SECRET`),
 * marks the corresponding `BillingOrderRecord` as `PAID`, advances the linked
 * Prisma `Deal` to `CLOSED_WON`, and appends an audit `Activity` note.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: 'STRIPE_WEBHOOK_SECRET is not configured on this host.' },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('stripe-signature');
  const verification = verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);

  if (!verification.valid) {
    return NextResponse.json(
      { ok: false, error: `Invalid Stripe signature: ${verification.reason}` },
      { status: 400 },
    );
  }

  let event: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed JSON event' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const sessionObj = event.data?.object;
    const invoiceRef =
      sessionObj?.metadata?.invoiceRef || sessionObj?.client_reference_id || undefined;
    const stripeSessionId = sessionObj?.id || undefined;

    const updatedOrder = await markBillingOrderPaid({ invoiceRef, stripeSessionId });
    const dealId = updatedOrder?.dealId || sessionObj?.metadata?.dealId;

    if (dealId) {
      try {
        const deal = await prisma.deal.update({
          where: { id: dealId },
          data: { stage: 'CLOSED_WON' },
        });
        await prisma.activity.create({
          data: {
            type: 'NOTE',
            content: `Stripe payment confirmed for ${invoiceRef || stripeSessionId || deal.title}. Deal advanced to CLOSED_WON.`,
            workspaceId: deal.workspaceId,
            dealId: deal.id,
            contactId: deal.contactId,
          },
        });
      } catch (err) {
        console.warn('[Billing Webhook] Deal update skipped:', err);
      }
    }
  }

  return NextResponse.json({ ok: true, received: true });
}
