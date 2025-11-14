import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, format } from 'date-fns';

/**
 * GET /api/analytics
 * Get comprehensive analytics data
 * Branch filtering: Non-admin users only see their branch analytics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Build branch filter
    const branchFilter: any = {};
    if (user.role !== 'ADMIN') {
      if (!user.branchId) {
        return NextResponse.json(
          { error: 'User not assigned to a branch' },
          { status: 400 }
        );
      }
      branchFilter.branchId = user.branchId;
    }

    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);

    // 1. Monthly Revenue (last 6 months) - filtered by branch
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
    const monthlyRevenue = await Promise.all(
      months.map(async (month) => {
        const payments = await prisma.payment.findMany({
          where: {
            paymentDate: {
              gte: startOfMonth(month),
              lte: endOfMonth(month),
            },
            order: branchFilter,
          },
        });

        return {
          month: format(month, 'MMM yyyy'),
          monthKey: format(month, 'yyyy-MM'),
          revenue: payments.reduce((sum, p) => sum + p.amount, 0),
          orderCount: payments.length,
          averagePayment: payments.length > 0
            ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length
            : 0,
        };
      })
    );

    // 2. Customer Lifetime Value (Top 10) - filtered by branch
    const customers = await prisma.customer.findMany({
      where: branchFilter,
      include: {
        orders: {
          include: { payments: true },
        },
      },
    });

    const customerLTV = customers
      .map((customer) => {
        const totalSpent = customer.orders.reduce((sum, order) => {
          return sum + order.payments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        return {
          customerId: customer.id,
          customerName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          totalOrders: customer.orders.length,
          totalSpent,
          averageOrderValue: customer.orders.length > 0 ? totalSpent / customer.orders.length : 0,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10); // Top 10 customers

    // 3. Popular Items Analysis (based on order descriptions) - filtered by branch
    const allOrders = await prisma.order.findMany({
      where: branchFilter,
      select: { description: true, totalAmount: true },
    });

    // Simple keyword extraction from descriptions
    const itemCounts: Record<string, { count: number; revenue: number }> = {};
    allOrders.forEach((order) => {
      const words = order.description.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 3) { // Ignore short words
          if (!itemCounts[word]) {
            itemCounts[word] = { count: 0, revenue: 0 };
          }
          itemCounts[word].count++;
          itemCounts[word].revenue += order.totalAmount;
        }
      });
    });

    const popularItems = Object.entries(itemCounts)
      .map(([item, data]) => ({
        item,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 items

    // 4. Overall Statistics - filtered by branch
    const totalRevenue = await prisma.payment.aggregate({
      where: {
        order: branchFilter,
      },
      _sum: { amount: true },
    });

    const totalOrders = await prisma.order.count({
      where: branchFilter,
    });

    const activeOrders = await prisma.order.count({
      where: {
        ...branchFilter,
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
    });

    const allOrdersWithPayments = await prisma.order.findMany({
      where: {
        ...branchFilter,
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
      include: { payments: true },
    });

    const totalOutstanding = allOrdersWithPayments.reduce((sum, order) => {
      const paid = order.payments.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + (order.totalAmount - paid);
    }, 0);

    // 5. Payment Method Distribution - filtered by branch
    const paymentMethods = await prisma.payment.groupBy({
      where: {
        order: branchFilter,
      },
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: true,
    });

    const paymentMethodStats = paymentMethods.map((method) => ({
      method: method.paymentMethod,
      total: method._sum.amount || 0,
      count: method._count,
    }));

    // 6. Order Status Distribution - filtered by branch
    const orderStatuses = await prisma.order.groupBy({
      where: branchFilter,
      by: ['status'],
      _count: true,
    });

    const orderStatusStats = orderStatuses.map((status) => ({
      status: status.status,
      count: status._count,
    }));

    return NextResponse.json({
      overview: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalOrders,
        activeOrders,
        totalOutstanding,
        totalCustomers: customers.length,
      },
      monthlyRevenue,
      customerLTV,
      popularItems,
      paymentMethodStats,
      orderStatusStats,
      // Include branch info for context
      branch: user.role === 'ADMIN' ? 'All Branches' : user.branchName || 'Unknown',
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
