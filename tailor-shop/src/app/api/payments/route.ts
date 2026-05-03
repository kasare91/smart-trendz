import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPaymentConfirmationSMS } from '@/lib/notifications';
import { requireAuth, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { handleApiError, ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getBusinessProfile, DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';
import { Prisma } from '@prisma/client';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/payments
 * List all payments with optional filters
 * Branch filtering: Non-admin users only see their branch's payments
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'payments:get', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    const startDate = searchParams.get('startDate') || searchParams.get('from');
    const endDate = searchParams.get('endDate') || searchParams.get('to');
    const search = searchParams.get('search');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    // Build where clause
    const where: Prisma.PaymentWhereInput = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Build the nested order filter separately to keep Prisma types clean
    const orderFilter: Prisma.OrderWhereInput = {};

    if (search) {
      orderFilter.OR = [
        { orderNumber: { contains: search } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Tenant + branch scoping via the nested order relation
    if (user.role === 'SUPER_ADMIN') {
      // no filter on order
    } else if (user.role === 'ADMIN') {
      (orderFilter as Record<string, unknown>).branch = { tenantId: user.tenantId! }; // tenantId non-null for non-SUPER_ADMIN users
    } else {
      if (!user.branchId) throw new ValidationError('User not assigned to a branch');
      orderFilter.branchId = user.branchId;
    }

    // Always set where.order so the filter (or search) is applied
    if (search || user.role !== 'SUPER_ADMIN') {
      where.order = orderFilter;
    }

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          note: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json(paginationResponse(payments, page, pageSize, total));
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching payments:');
  }
}

/**
 * POST /api/payments
 * Record a new payment for an order
 * Branch verification: User must have access to the order's branch
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'payments:post', ...RATE_LIMITS.payment });
    if (limited) return limited;

    const user = await requireRole(['ADMIN', 'STAFF']);
    const body = await request.json();
    const { orderId, amount, paymentDate, paymentMethod = 'CASH', note } = body;
    const paymentAmount = parseFloat(amount);

    if (!orderId || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new ValidationError('Order ID and valid amount are required');
    }

    // Get order with branch info
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        customer: true,
        branch: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify user has access to this order's branch (three-way role check)
    if (user.role === 'SUPER_ADMIN') {
      // unrestricted
    } else if (user.role === 'ADMIN') {
      if (order.branch?.tenantId !== user.tenantId) {
        throw new ForbiddenError('Order not found');
      }
    } else if (order.branchId !== user.branchId) {
      throw new ForbiddenError('Order not found');
    }

    // Calculate current balance
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = order.totalAmount - totalPaid;

    if (paymentAmount > balance) {
      throw new ValidationError(`Payment amount exceeds outstanding balance (GHS ${balance.toFixed(2)})`);
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: paymentAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod,
        note: note || null,
        createdBy: user.id,
      },
      include: {
        order: {
          include: {
            customer: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            payments: true,
          },
        },
      },
    });

    // Calculate new balance after this payment
    const totalPaidAfter = payment.order.payments.reduce((sum, p) => sum + p.amount, 0);
    const newBalance = payment.order.totalAmount - totalPaidAfter;

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      branchId: order.branchId,
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: payment.id,
      description: `Recorded payment of GHS ${amount} for order ${order.orderNumber}`,
      metadata: {
        orderNumber: order.orderNumber,
        customerName: order.customer.fullName,
        amount: paymentAmount,
        paymentMethod,
        totalPaid: totalPaidAfter,
        balance: newBalance,
        branchName: order.branch?.name,
      },
    });

    // Send payment confirmation SMS
    try {
      const businessProfile = await getBusinessProfile(user.tenantId);
      await sendPaymentConfirmationSMS(
        payment.order.customer.phoneNumber,
        payment.order.customer.fullName,
        payment.order.orderNumber,
        paymentAmount,
        newBalance,
        businessProfile?.businessName || DEFAULT_BUSINESS_NAME
      );
    } catch (smsError) {
      // Log SMS error but don't fail the payment
      console.error('Failed to send payment confirmation SMS:', smsError);
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, 'Error creating payment:');
  }
}
