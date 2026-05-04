import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/billing';
import { handleApiError, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireRole(['ADMIN']);
    if (!user.tenantId) throw new ValidationError('No tenant found');

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { stripeCustomerId: true },
    });
    if (!tenant?.stripeCustomerId) {
      throw new ValidationError('No billing account found. Please subscribe first.');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
