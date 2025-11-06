import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDueDateUrgency } from '@/lib/utils';
import { sendOrderReminder } from '@/lib/notifications';

/**
 * GET /api/notifications/cron
 * Cron job to send daily notifications for orders due soon
 *
 * Usage with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/notifications/cron",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 *
 * Or call manually: GET /api/notifications/cron?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const secretParam = request.nextUrl.searchParams.get('secret');

  const expectedSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

  if (authHeader !== `Bearer ${expectedSecret}` && secretParam !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting daily notification cron job...');

    // Fetch all active orders (not collected or cancelled)
    const orders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    const results = {
      totalOrders: orders.length,
      notificationsSent: 0,
      emailsSent: 0,
      smsSent: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const order of orders) {
      const urgency = getDueDateUrgency(order.dueDate);

      // Only send for orders that are urgent (5 days or less, or overdue)
      if (urgency === 'safe') {
        results.skipped++;
        continue;
      }

      const amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = order.totalAmount - amountPaid;

      try {
        const notificationResult = await sendOrderReminder(
          order.customer,
          order,
          balance
        );

        results.notificationsSent++;
        if (notificationResult.email) results.emailsSent++;
        if (notificationResult.sms) results.smsSent++;

        results.details.push({
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          urgency,
          emailSent: notificationResult.email,
          smsSent: notificationResult.sms,
        });
      } catch (error) {
        console.error(`Failed to send notification for order ${order.orderNumber}:`, error);
        results.failed++;
        results.details.push({
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          urgency,
          error: 'Failed to send',
        });
      }
    }

    console.log('Notification cron job completed:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalOrders: results.totalOrders,
        notificationsSent: results.notificationsSent,
        emailsSent: results.emailsSent,
        smsSent: results.smsSent,
        skipped: results.skipped,
        failed: results.failed,
      },
      details: results.details,
    });
  } catch (error) {
    console.error('Error in notification cron job:', error);
    return NextResponse.json(
      { error: 'Failed to run notification cron job' },
      { status: 500 }
    );
  }
}
