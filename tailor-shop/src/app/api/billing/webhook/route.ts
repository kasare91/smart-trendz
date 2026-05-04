import { NextRequest, NextResponse } from 'next/server';
import { stripe, stripeStatusToPlanStatus } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) break;

        const subscription = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string)
          : null;

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: 'PRO',
            planStatus: subscription?.status
              ? stripeStatusToPlanStatus(subscription.status)
              : 'TRIAL',
            stripeSubscriptionId: (session.subscription as string | null) ?? undefined,
            stripeCustomerId: session.customer as string,
            trialEndsAt: subscription?.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (!tenant) break;

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            planStatus: stripeStatusToPlanStatus(sub.status),
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        if (!tenant) break;

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { plan: 'FREE', planStatus: 'FREE', stripeSubscriptionId: null },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await prisma.tenant.updateMany({
          where: { stripeCustomerId: customerId },
          data: { planStatus: 'PAST_DUE' },
        });
        break;
      }
    }
  } catch {
    console.error('Webhook processing error for event', event.id);
  }

  return NextResponse.json({ received: true });
}
