import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPaymentConfirmationSMS } from '@/lib/notifications';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments
 * List all payments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const payments = await prisma.payment.findMany({
      where: {
        ...(orderId && { orderId }),
        ...(startDate &&
          endDate && {
            paymentDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments
 * Record a new payment for an order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, amount, paymentDate, paymentMethod = 'CASH', note } = body;

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Order ID and valid amount are required' },
        { status: 400 }
      );
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Calculate current balance
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = order.totalAmount - totalPaid;

    if (amount > balance) {
      return NextResponse.json(
        { error: `Payment amount exceeds outstanding balance (${balance.toFixed(2)})` },
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
      },
      include: {
        order: {
          include: {
            customer: true,
            payments: true,
          },
        },
      },
    });

    // Calculate new balance after this payment
    const totalPaidAfter = payment.order.payments.reduce((sum, p) => sum + p.amount, 0);
    const newBalance = payment.order.totalAmount - totalPaidAfter;

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
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
