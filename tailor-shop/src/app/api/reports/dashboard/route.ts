import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getCurrentWeek, calculateDaysToDue } from '@/lib/utils';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics
 * Branch filtering: Non-admin users only see their branch data
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'reports:dashboard', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();

    // Build branch filter
    const branchFilter: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { branch: { tenantId: user.tenantId! } } // tenantId non-null for non-SUPER_ADMIN users
          : (() => {
              if (!user.branchId) throw new ValidationError('User not assigned to a branch');
              return { branchId: user.branchId };
            })();

    const { start: weekStart, end: weekEnd } = getCurrentWeek();

    // Active orders count (not COLLECTED or CANCELLED) - filtered by branch
    const activeOrdersCount = await prisma.order.count({
      where: {
        ...branchFilter,
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
    });

    // All active orders with payments for balance calculation - filtered by branch
    const activeOrders = await prisma.order.findMany({
      where: {
        ...branchFilter,
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

    // Total received this week - filtered by branch
    const weekPayments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: weekStart,
          lte: weekEnd,
        },
        order: branchFilter,
      },
    });

    const totalReceivedThisWeek = weekPayments.reduce((sum, p) => sum + p.amount, 0);

    // Upcoming orders (due within 5 days, not overdue) - filtered by branch
    const upcomingOrders = await prisma.order.findMany({
      where: {
        ...branchFilter,
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
    type UpcomingOrder = (typeof upcomingOrders)[number];
    const categorized: Record<'overdue' | 'due1Day' | 'due3Days' | 'due5Days', UpcomingOrder[]> = {
      overdue: [],
      due1Day: [],
      due3Days: [],
      due5Days: [],
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
      // Include branch info for context
      branch: user.role === 'ADMIN' ? 'All Branches' : user.branchName || 'Unknown',
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching dashboard data:');
  }
}
