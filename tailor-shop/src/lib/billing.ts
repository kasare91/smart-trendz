import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return _stripe;
}

export interface PlanAccess {
  plan: string;
  planStatus: string;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export async function getPlanAccess(tenantId: string): Promise<PlanAccess> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      planStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!tenant) throw new Error('Tenant not found');
  return tenant;
}

export function isPro(access: PlanAccess): boolean {
  return (
    access.plan === 'PRO' &&
    (access.planStatus === 'TRIAL' || access.planStatus === 'ACTIVE')
  );
}

export function isFreePlan(access: PlanAccess): boolean {
  return access.plan === 'FREE' || access.planStatus === 'FREE';
}

export function stripeStatusToPlanStatus(status: string): string {
  switch (status) {
    case 'trialing': return 'TRIAL';
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled':
    case 'unpaid': return 'CANCELLED';
    default: return 'FREE';
  }
}
