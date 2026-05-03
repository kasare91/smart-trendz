import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { eachDayOfInterval, format } from 'date-fns';
import { handleApiError, ValidationError } from '@/lib/errors';
import { getPagination, paginationResponse } from '@/lib/pagination';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Force dynamic rendering for this route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reports/weekly-payments
 * Get payments grouped by day for a given week
 */
export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'reports:weekly-payments', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const { page, pageSize, skip, take } = getPagination(searchParams);

    if (!startDateParam || !endDateParam) {
      throw new ValidationError('Start date and end date are required');
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    if (startDate > endDate) {
      throw new ValidationError('Start date must be before end date');
    }

    if (user.role !== 'ADMIN' && !user.branchId) {
      throw new ValidationError('User not assigned to a branch');
    }

    const branchFilter: Record<string, unknown> =
      user.role === 'SUPER_ADMIN'
        ? {}
        : user.role === 'ADMIN'
          ? { order: { branch: { tenantId: user.tenantId! } } } // tenantId non-null for non-SUPER_ADMIN users
          : { order: { branchId: user.branchId! } }; // branchId non-null for STAFF/VIEWER (validated above)

    const where = {
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
      ...branchFilter,
    };

    // Fetch all payments in the range once, scoped to user's branch for non-admins
    const [allPayments, totalPayments] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              customer: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { paymentDate: 'asc' },
      }),
      prisma.payment.count({ where }),
    ]);

    // Apply pagination in memory (weekly reports are bounded by date range)
    const pagedPayments = allPayments.slice(skip, skip + take);

    // Calculate totals
    const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // Group by payment method
    const byMethod = allPayments.reduce((acc, payment) => {
      const method = payment.paymentMethod;
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 };
      }
      acc[method].count++;
      acc[method].total += payment.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // Group by day
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const byDay = days.map((day) => {
      const dayPayments = allPayments.filter((p) => {
        const pDate = new Date(p.paymentDate);
        return format(pDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });

      return {
        date: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEEE'),
        total: dayPayments.reduce((sum, p) => sum + p.amount, 0),
        count: dayPayments.length,
        payments: dayPayments,
      };
    });

    return NextResponse.json({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      totalAmount,
      totalCount: allPayments.length,
      byMethod,
      byDay,
      allPayments: pagedPayments,
      allPaymentsPagination: paginationResponse(pagedPayments, page, pageSize, totalPayments).pagination,
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Error fetching weekly payments:');
  }
}
