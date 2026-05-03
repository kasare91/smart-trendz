import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderReminder } from '@/lib/notifications';
import { getReminderType, getReminderWindowDate } from '@/lib/order-reminders';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
type CronDetail = {
  orderNumber: string;
  customerName: string;
  reminderType: string;
  skipped?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  error?: string;
};

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { key: 'notifications:cron', ...RATE_LIMITS.cron });
  if (limited) return limited;

  const secret = request.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
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
      details: [] as CronDetail[],
    };

    for (const order of orders) {
      const reminderType = getReminderType(order.dueDate);

      if (!reminderType) {
        results.skipped++;
        continue;
      }

      const windowDate = getReminderWindowDate(order.dueDate);
      let notificationLogId: string | null = null;

      const amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = order.totalAmount - amountPaid;

      try {
        const log = await prisma.orderNotificationLog.create({
          data: {
            orderId: order.id,
            reminderType,
            windowDate,
          },
          select: { id: true },
        });
        notificationLogId = log.id;

        const notificationResult = await sendOrderReminder(
          order.customer,
          order,
          balance
        );

        if (!notificationResult.email && !notificationResult.sms) {
          await prisma.orderNotificationLog.delete({ where: { id: notificationLogId } });
          results.skipped++;
          results.details.push({
            orderNumber: order.orderNumber,
            customerName: order.customer.fullName,
            reminderType,
            skipped: 'No notification channel sent',
          });
          continue;
        }

        await prisma.orderNotificationLog.update({
          where: { id: notificationLogId },
          data: {
            emailSent: notificationResult.email,
            smsSent: notificationResult.sms,
          },
        });

        results.notificationsSent++;
        if (notificationResult.email) results.emailsSent++;
        if (notificationResult.sms) results.smsSent++;

        results.details.push({
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          reminderType,
          emailSent: notificationResult.email,
          smsSent: notificationResult.sms,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          results.skipped++;
          results.details.push({
            orderNumber: order.orderNumber,
            customerName: order.customer.fullName,
            reminderType,
            skipped: 'Already notified for this reminder window',
          });
          continue;
        }

        if (notificationLogId) {
          await prisma.orderNotificationLog
            .delete({ where: { id: notificationLogId } })
            .catch((e) => console.error(`Failed to delete notification log ${notificationLogId} for order ${order.orderNumber}:`, e));
        }

        console.error(`Failed to send notification for order ${order.orderNumber}:`, error);
        results.failed++;
        results.details.push({
          orderNumber: order.orderNumber,
          customerName: order.customer.fullName,
          reminderType,
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
    return handleApiError(error, 'Error in notification cron job:');
  }
}
