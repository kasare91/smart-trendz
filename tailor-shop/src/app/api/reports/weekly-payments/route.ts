import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/weekly-payments
 * Get payments grouped by day for a given week
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Fetch all payments in the range
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Group by payment method
    const byMethod = payments.reduce((acc, payment) => {
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
      const dayPayments = payments.filter((p) => {
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
      totalCount: payments.length,
      byMethod,
      byDay,
      allPayments: payments,
    });
  } catch (error) {
    console.error('Error fetching weekly payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly payments' },
      { status: 500 }
    );
  }
}
