import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDueDateUrgency } from '@/lib/utils';
import { sendOrderReminder } from '@/lib/notifications';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/notifications/send
 * Manually send notification for a specific order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch order with customer and payments
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const urgency = getDueDateUrgency(order.dueDate);
    if (urgency === 'safe') {
      return NextResponse.json(
        { message: 'Order is not urgent yet (more than 5 days away)' },
        { status: 200 }
      );
    }

    // Calculate balance
    const amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = order.totalAmount - amountPaid;

    // Send notifications
    const results = await sendOrderReminder(order.customer, order, balance);

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      customerName: order.customer.fullName,
      emailSent: results.email,
      smsSent: results.sms,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
