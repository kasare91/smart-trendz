import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeek, calculateDaysToDue } from '@/lib/utils';

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics
 */
export async function GET() {
  try {
    const { start: weekStart, end: weekEnd } = getCurrentWeek();

    // Active orders count (not COLLECTED or CANCELLED)
    const activeOrdersCount = await prisma.order.count({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
    });

    // All active orders with payments for balance calculation
    const activeOrders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
      include: {
        payments: true,
      },
    });

    // Calculate total outstanding balance
    const totalOutstanding = activeOrders.reduce((sum, order) => {
      const paid = order.payments.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + (order.totalAmount - paid);
    }, 0);

    // Total received this week
    const weekPayments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    const totalReceivedThisWeek = weekPayments.reduce((sum, p) => sum + p.amount, 0);

    // Upcoming orders (due within 5 days, not overdue)
    const upcomingOrders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
      include: {
        customer: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filter and categorize by urgency
    const now = new Date();
    const categorized = {
      overdue: [] as any[],
      due1Day: [] as any[],
      due3Days: [] as any[],
      due5Days: [] as any[],
    };

    upcomingOrders.forEach((order) => {
      const days = calculateDaysToDue(order.dueDate);

      if (days <= 0) categorized.overdue.push(order);
      else if (days <= 1) categorized.due1Day.push(order);
      else if (days <= 3) categorized.due3Days.push(order);
      else if (days <= 5) categorized.due5Days.push(order);
    });

    return NextResponse.json({
      activeOrdersCount,
      totalOutstanding,
      totalReceivedThisWeek,
      upcomingOrders: categorized,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
