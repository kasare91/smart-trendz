import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { handleApiError, ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { logActivity } from '@/lib/activity-log';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/customers/[id]/apply-credit
 * Apply a customer's credit balance as a payment on an order.
 * Body: { orderId: string, amount: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limited = rateLimit(request, { key: 'customers:apply-credit', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const body = await request.json();
    const { orderId, amount } = body;
    const applyAmount = parseFloat(amount);

    if (!orderId || !Number.isFinite(applyAmount) || applyAmount <= 0) {
      throw new ValidationError('Order ID and valid amount are required');
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: { branch: { select: { tenantId: true } } },
    });
    if (!customer) throw new NotFoundError('Customer not found');

    // Branch access check
    if (user.role === 'ADMIN' && customer.branch.tenantId !== user.tenantId) {
      throw new ForbiddenError('Customer not found');
    } else if (user.role === 'STAFF' && customer.branchId !== user.branchId) {
      throw new ForbiddenError('Customer not found');
    }

    if (customer.creditBalance < applyAmount) {
      throw new ValidationError(
        `Insufficient credit balance (available: GHS ${customer.creditBalance.toFixed(2)})`
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order || order.customerId !== params.id) throw new NotFoundError('Order not found');

    const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0);
    const orderBalance = order.totalAmount - totalPaid;
    if (orderBalance <= 0) {
      throw new ValidationError('This order has no outstanding balance');
    }

    const credited = Math.min(applyAmount, orderBalance);

    const [payment] = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          orderId,
          amount: credited,
          paymentDate: new Date(),
          paymentMethod: 'CREDIT',
          note: 'Applied from customer credit balance',
          createdBy: user.id,
        },
      });

      await tx.customer.update({
        where: { id: params.id },
        data: { creditBalance: { decrement: credited } },
      });

      return [newPayment];
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: order.branchId,
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: payment.id,
      description: `Applied GHS ${credited.toFixed(2)} credit to order ${order.orderNumber} for ${customer.fullName}`,
      metadata: { orderId, amount: credited, customerId: params.id },
    });

    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { creditBalance: true },
    });

    return NextResponse.json({
      payment,
      remainingCredit: updatedCustomer?.creditBalance ?? 0,
    }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error applying credit:');
  }
}
