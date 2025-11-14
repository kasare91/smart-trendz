import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPaymentConfirmationSMS } from '@/lib/notifications';
import { requireAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { hasAccessToBranch } from '@/lib/branch';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments
 * List all payments with optional filters
 * Branch filtering: Non-admin users only see their branch's payments
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Branch filtering: Non-admin users can only see their branch's payments
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        return NextResponse.json(
          { error: 'User not assigned to a branch' },
          { status: 400 }
        );
      }
      where.order = {
        branchId: user.branchId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
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
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

/**
 * POST /api/payments
 * Record a new payment for an order
 * Branch verification: User must have access to the order's branch
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { orderId, amount, paymentDate, paymentMethod = 'CASH', note } = body;

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Order ID and valid amount are required' },
        { status: 400 }
      );
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
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this order's branch
    if (!hasAccessToBranch(user, order.branchId)) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 403 }
      );
    }

    // Calculate current balance
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = order.totalAmount - totalPaid;

    if (amount > balance) {
      return NextResponse.json(
        { error: `Payment amount exceeds outstanding balance (GHS ${balance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: parseFloat(amount),
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
        amount: parseFloat(amount),
        paymentMethod,
        totalPaid: totalPaidAfter,
        balance: newBalance,
        branchName: order.branch?.name,
      },
    });

    // Send payment confirmation SMS
    try {
      await sendPaymentConfirmationSMS(
        payment.order.customer.phoneNumber,
        payment.order.customer.fullName,
        payment.order.orderNumber,
        parseFloat(amount),
        newBalance
      );
    } catch (smsError) {
      // Log SMS error but don't fail the payment
      console.error('Failed to send payment confirmation SMS:', smsError);
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
