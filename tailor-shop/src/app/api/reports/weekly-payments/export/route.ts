import { NextRequest } from 'next/server';
import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeCsv(value: string | number | null | undefined): string {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'reports:weekly-payments:export', ...RATE_LIMITS.general });
    if (limited) return limited;

    const user = await requireAuth();
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    if (!from || !to) {
      throw new ValidationError('from and to query params are required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    if (user.role !== 'ADMIN' && !user.branchId) {
      throw new ValidationError('User not assigned to a branch');
    }
    const branchId = user.branchId;

    toDate.setHours(23, 59, 59, 999);

    const where: Prisma.PaymentWhereInput = {
        paymentDate: {
          gte: fromDate,
          lte: toDate,
        },
        ...(user.role !== 'ADMIN'
          ? {
              order: {
                branchId: branchId as string,
              },
            }
          : {}), // FIXED: added branch isolation
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    const header = ['Date', 'Customer', 'Order', 'Method', 'Amount', 'Note'];
    const rows = payments.map((payment) => [
      format(payment.paymentDate, 'yyyy-MM-dd'),
      payment.order.customer.fullName,
      payment.order.orderNumber,
      payment.paymentMethod,
      payment.amount.toFixed(2),
      payment.note || '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments-${from}-${to}.csv"`,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Error exporting weekly payments:');
  }
}
