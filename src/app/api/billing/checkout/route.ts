import { NextResponse } from 'next/server';
import { isBillingCheckoutArmed } from '@/lib/billing/checkout';

/**
 * Billing Checkout Gate (`/api/billing/checkout` — Disarmed in v0.66.1).
 *
 * Per owner/coordinator governance:
 *   - Self-serve invoicing (`INV-UB-*`), automatic `PROPOSAL` Deal creation at
 *     unapproved SKU prices, and Stripe Checkout session creation are disarmed
 *     until the owner explicitly sets retail/SaaS pricing and enables
 *     `BILLING_CHECKOUT_ENABLED=true`.
 *   - Public forms on `/universal` and `/trust-services` submit plain lead
 *     inquiries to `POST /api/leads/external` instead.
 */

export async function GET() {
  const armed = isBillingCheckoutArmed(process.env);
  return NextResponse.json({
    armed,
    stripeConfigured: armed && Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    mode: 'lead_only',
    note: armed
      ? 'Owner-authorized billing checkout is enabled.'
      : 'Self-serve checkout and invoicing are disarmed pending owner pricing authorization; public forms capture leads only.',
  });
}

export async function POST() {
  if (!isBillingCheckoutArmed(process.env)) {
    return NextResponse.json(
      {
        ok: false,
        armed: false,
        error:
          'Self-serve checkout and invoice generation are currently disarmed pending owner pricing approval. Please submit an inquiry via /api/leads/external.',
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      armed: true,
      error: 'No owner-approved self-serve SKUs are configured yet.',
    },
    { status: 501 },
  );
}
