import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getDueDateUrgency } from '@/lib/utils';
import { sendOrderReminder } from '@/lib/notifications';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';

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
    const limited = rateLimit(request, { key: 'notifications:send', ...RATE_LIMITS.cron });
    if (limited) return limited;

    await requireRole(['ADMIN', 'STAFF']);

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      throw new ValidationError('Order ID is required');
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
      throw new NotFoundError('Order not found');
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
  } catch (error: unknown) {
    return handleApiError(error, 'Error sending notification:');
  }
}
