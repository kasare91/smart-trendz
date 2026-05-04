import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireRole(['ADMIN']);
    if (!user.tenantId) {
      return NextResponse.json({
        plan: 'FREE', planStatus: 'FREE', ordersThisMonth: 0,
        orderLimit: 50, hasStripeCustomer: false, trialEndsAt: null,
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { plan: true, planStatus: true, trialEndsAt: true, stripeCustomerId: true },
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const ordersThisMonth = await prisma.order.count({
      where: { branch: { tenantId: user.tenantId }, createdAt: { gte: startOfMonth } },
    });

    return NextResponse.json({
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      ordersThisMonth,
      orderLimit: tenant.plan === 'FREE' ? 50 : null,
      hasStripeCustomer: !!tenant.stripeCustomerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
